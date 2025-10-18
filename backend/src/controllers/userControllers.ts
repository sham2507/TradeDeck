import { Request, Response, NextFunction } from "express";

import { PrismaClient } from "@prisma/client";

import axios from "axios";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { AppError } from "../middlewares/errorHandler";

import redisClient from "../utils/initializeCache";

import transformOptionsData from "../utils/transformOptionsData";
import fetchIndicesLotSize from "../utils/fetchIndicesLot";
import getExpiryTime from "../utils/expiryTime";
import getLowestCombinedOptionData from "../utils/caculateLowestCandle";

const prisma = new PrismaClient();

const channel = "tradeInfo";
const message = "updated";

dayjs.extend(utc);
dayjs.extend(timezone);

export const getIndicesData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const value = await redisClient.get("optionsData");
    const optionsData = value ? JSON.parse(value) : null;
    if (!optionsData) {
      const err = new Error("Cannot get Options Data") as AppError;
      err.status = 400;
      throw err;
    }
    const getExpiry = transformOptionsData(optionsData);
    res.status(200).json({ data: getExpiry });
  } catch (e) {
    next(e);
  }
};

export const getRemainingSymbols = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const value = await redisClient.get("remainingCount");

    res.status(200).json({ value });
  } catch (e) {
    next(e);
  }
};

export const getLotSize = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const value = await redisClient.get("optionsData");
    const optionsData = value ? JSON.parse(value) : null;
    if (!optionsData) {
      const err = new Error("Cannot get Options Data") as AppError;
      err.status = 400;
      throw err;
    }

    const dataFromRedis = await redisClient.get("indicesLot");
    const data = dataFromRedis ? JSON.parse(dataFromRedis) : null;

    if (!dataFromRedis) {
      const indicesData = transformOptionsData(optionsData);
      const fetchedData = await fetchIndicesLotSize(optionsData, indicesData);
      const ttl = getExpiryTime();
      await redisClient.set("indicesLot", JSON.stringify(fetchedData), {
        EX: ttl,
      });
      res.status(200).json({ fetchedData });
      return;
    }
    res.status(200).json({ data });
  } catch (e) {
    next(e);
  }
};

export const getFundsData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = await redisClient.get("interactiveSession");
    if (!token || token === null) {
      const err = new Error("Interactive session token not found") as AppError;
      err.status = 400;
      throw err;
    }

    const response = await axios.get(
      "https://trading.bigul.co/interactive/user/balance",
      { headers: { Authorization: token } }
    );

    const balance = response.data.result.BalanceList[0].limitObject;
    const marginAvailable = balance.RMSSubLimits.netMarginAvailable;
    const marginUtilized = balance.marginUtilized.MarginUsed;

    res.status(200).json({ data: { marginAvailable, marginUtilized } });
  } catch (e) {
    next(e);
  }
};

export const getClosedMtmData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = await redisClient.get("interactiveSession");
    if (!token || token === null) {
      const err = new Error("Interactive session token not found") as AppError;
      err.status = 400;
      throw err;
    }

    const response = await axios.get(
      "https://trading.bigul.co/interactive/portfolio/positions?dayOrNet=DayWise",
      { headers: { Authorization: token } }
    );

    const positions = response.data.result.positionList;
    const modifiedPositions = positions.filter(
      (each: { Quantity: string }) => each.Quantity === "0"
    );

    const totalNetAmount = modifiedPositions.reduce(
      (sum: number, item: { NetAmount: string }) => {
        return sum + parseFloat(item.NetAmount);
      },
      0
    );

    res.status(200).json({ totalNetAmount });
  } catch (e) {
    next(e);
  }
};

export const getCandles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { indexName, expiryDate, range } = req.query as {
    indexName: string;
    expiryDate: string;
    range: string;
  };
  try {
    const value = await redisClient.get("optionsData");
    const token = await redisClient.get("marketDataToken");
    const optionsData = value ? JSON.parse(value) : null;

    if (!optionsData || !token) {
      const err = new Error("Something Went Wrong! - data error") as AppError;
      err.status = 400;
      throw err;
    }

    if (!indexName || indexName === null || indexName === "") {
      const err = new Error("indexName is not Provided") as AppError;
      err.status = 400;
      throw err;
    }
    if (!expiryDate || expiryDate === null || expiryDate === "") {
      const err = new Error("expiry is not Provided") as AppError;
      err.status = 400;
      throw err;
    }

    if (!range || range === null || range === "") {
      const err = new Error("indexName is not Provided") as AppError;
      err.status = 400;
      throw err;
    }

    console.log("here");
    const result = await getLowestCombinedOptionData(
      indexName,
      expiryDate,
      parseInt(range),
      optionsData,
      token
    );

    res.status(200).json({ data: result });
  } catch (e) {
    next(e);
  }
};

export const userExit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = req.query.id as string;
  const exit = req.query.exit as string;
  if (!id || !exit) {
    const err = new Error() as AppError;
    err.status = 400;
    err.message = "id or exit query is missing ";
    throw err;
  }
  try {
    await prisma.tradeDetails.update({
      where: { id },
      data: { userExit: parseInt(exit) },
    });
    await redisClient.publish(channel, message);
    res.status(200).json({ msg: "updated successfully" });
  } catch (e) {
    next(e);
  }
};

export const squareOffAll = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await prisma.tradeDetails.findMany({
      where: { entryTriggered: true, alive: true },
      select: { liveTradePositions: true, entrySide: true },
    });

    const liveTradePositions = data.flatMap((item) =>
      item.liveTradePositions.map((pos) => ({ ...pos, side: item.entrySide }))
    );

    console.log(liveTradePositions);

    //  get  liveTradePosition  list
    //  place opp.order(sell for buy and buy for sell) for the current qty and await whole list
    //  store exit app order id
    //  get the exit price using the exit app order id
    //  update currentQty = 0 , exitAppOrderId,closePrice,closed :true
    //  after that update tradeDetails.updateMany where entryTriggered true and alive true  to alive false and reason user square off all
    // await prisma.tradeDetails.updateMany({
    //   where: { entryTriggered: true, alive: false },
    //   data: { userExit: 100 },
    // });
    // await redisClient.publish(channel, message);
    res.status(200).json({ msg: "updated successfully" });
  } catch (e) {
    next(e);
  }
};

export const getServicesEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const keys = [
      "tp_service_last_redis",
      "tp_service_last_socket",
      "tp_service_last_check",
      "sl_service_last_redis",
      "sl_service_last_socket",
      "sl_service_last_check",
      "place_order_service_last_redis",
      "place_order_service_last_socket",
      "place_order_service_last_check",
      "adjustment_service_last_redis",
      "adjustment_service_last_socket",
      "adjustment_service_last_check",
    ];

    const values = await Promise.all(keys.map((key) => redisClient.get(key)));

    const result = keys.map((key, index) => {
      const parts = key.split("_");
      const serviceIndex = parts.indexOf("service");

      const name = parts.slice(0, serviceIndex + 1).join("_"); // e.g., place_order_service
      const type = parts.slice(serviceIndex + 1).join("_"); // e.g., last_redis

      const rawTimestamp = values[index];
      let date = null;

      if (rawTimestamp) {
        const timestamp = parseInt(rawTimestamp);
        if (!isNaN(timestamp)) {
          date = dayjs
            .unix(timestamp)
            .tz("Asia/Kolkata")
            .format("YYYY-MM-DD HH:mm:ss");
        }
      }

      return {
        name,
        type,
        date,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};
