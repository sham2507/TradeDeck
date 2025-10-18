import { PrismaClient } from "@prisma/client";
import {
  getExchangeId,
  getInstrumentIdByOptionName,
  getTodayStartEnd,
} from "../utils/miscellaneous";
import axios from "axios";
import { AppError } from "../middlewares/errorHandler";
import { OptionDataType } from "../types/fetchIndicesTypes";
import convertToLightweightCandles from "./convertCandleData";

const indexAPIData = [
  { indexName: "nifty", exchangeInstrumentId: "26000", exchangeSegment: "1" },
  {
    indexName: "finnifty",
    exchangeInstrumentId: "26034",
    exchangeSegment: "1",
  },
  {
    indexName: "midcpnifty",
    exchangeInstrumentId: "26121",
    exchangeSegment: "1",
  },
  {
    indexName: "banknifty",
    exchangeInstrumentId: "26001",
    exchangeSegment: "1",
  },
  { indexName: "sensex", exchangeInstrumentId: "26065", exchangeSegment: "11" },
  { indexName: "bankex", exchangeInstrumentId: "26118", exchangeSegment: "11" },
];

interface HistoricalDataInput {
  symbolId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: Date;
}

const prisma = new PrismaClient();

export async function getOHLCData(
  indexName: string,
  token: string,
  optionName: string,
  optionsData: OptionDataType[]
) {
  const type = optionName.length === 0 ? "INDEX" : "OPTION";
  const symbolName = optionName.length === 0 ? indexName : optionName;

  let symbolRecord = await prisma.symbol.findFirst({
    where: { symbolName, type },
  });

  if (!symbolRecord) {
    try {
      symbolRecord = await prisma.symbol.create({
        data: { symbolName, type, updatedAt: new Date() },
      });
    } catch (error) {
      console.log(error);
    }
  }

  if (symbolRecord === null || !symbolRecord)
    throw new Error("Symbol record not found");

  const symbolId = symbolRecord.id;

  const latestData = await prisma.historicalData.findFirst({
    where: { symbolId },
    orderBy: { date: "desc" },
  });

  const now = new Date();

  // Convert to IST
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const day = istNow.getUTCDay();
  const hours = istNow.getUTCHours();
  const minutes = istNow.getUTCMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const isWithinTime =
    (hours > 9 || (hours === 9 && minutes >= 14)) &&
    (hours < 15 || (hours === 15 && minutes <= 31));

  let needsFetch = true;
  // let needsFetch = false;

  // console.log("latestData", latestData, "|", "symbolId", symbolName);

  // console.log();

  // if (!latestData) {
  //   needsFetch = true;
  // } else {
  //   if (isWeekday && isWithinTime) {
  //     const lastTime = latestData.date.getTime();
  //     needsFetch = (now.getTime() - lastTime) / 1000 > 60;
  //   }
  // }

  if (needsFetch) {
    let exchangeInstrumentID;
    let exchangeSegment;

    if (optionName.length === 0) {
      const indexConfig = indexAPIData.find(
        (x) => x.indexName.toLowerCase() === indexName.toLowerCase()
      );
      if (!indexConfig) throw new Error("Index config not found");

      exchangeSegment = indexConfig.exchangeSegment;
      exchangeInstrumentID = parseInt(indexConfig.exchangeInstrumentId);
    } else {
      exchangeInstrumentID = getInstrumentIdByOptionName(
        optionsData,
        optionName
      );
      if (exchangeInstrumentID === 0) {
        const err = new Error("Cannot get Instrument Id") as AppError;
        err.status = 400;
        throw err;
      }
      exchangeSegment = getExchangeId(indexName);
    }

    const { start, end } = getTodayStartEnd();
    const compressionValue = 60;

    // Aug 10 2025 091500 Aug 11 2025 153000

    // const start = "Sep 15 2025 091500";
    // const end = "Sep 15 2025 153000";

    const response = await axios.get(
      "https://trading.bigul.co/apimarketdata/instruments/ohlc",
      {
        headers: { Authorization: token },
        params: {
          exchangeSegment,
          exchangeInstrumentID,
          startTime: start,
          endTime: end,
          compressionValue,
        },
      }
    );

    // console.log(response);

    if (response.data.result.dataReponse === "")
      throw new Error("No data available for the given symbol");

    const dataResponse = response?.data?.result?.dataReponse;
    const chartData = convertToLightweightCandles(dataResponse);

    const historicalData: HistoricalDataInput[] = chartData.map((candle) => {
      return {
        symbolId,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
        date: new Date(candle.time * 1000),
      };
    });

    if (historicalData.length > 0) {
      const date = historicalData[historicalData.length - 1].date;
      const lastTime = Math.floor(date.getTime() / 1000);
      const seconds = new Date(lastTime).getSeconds();

      if (seconds !== 59) {
        historicalData.pop();
      }
    }

    try {
      await prisma.historicalData.createMany({
        data: historicalData,
        skipDuplicates: true,
      });
      await prisma.symbol.update({
        where: { id: symbolId },
        data: { updatedAt: new Date() },
      });
    } catch (err) {
      console.log(symbolName);
      // console.log(historicalData[0].date); // console.log(err);
      // console.log(historicalData[1]);
      // console.log("creation", symbolName);
      // console.log(err);
      // console.log(historicalData.length);
      // console.log(new Date((historicalData.date * 1000).getTime()));
    }
  }

  try {
    const dbData = await prisma.historicalData.findMany({
      where: { symbolId },
      orderBy: { date: "asc" },
    });

    const formattedData = dbData.map((d) => ({
      time: Math.floor(d.date.getTime() / 1000),
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
    }));

    return formattedData;
  } catch (e) {
    console.log(e);
    return [];
  }
}
