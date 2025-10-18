import { Request, Response, NextFunction } from "express";

import { PrismaClient } from "@prisma/client";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { nanoid } from "nanoid";

import { AppError } from "../middlewares/errorHandler";

import redisClient from "../utils/initializeCache";

import parseZodSchema from "../utils/parseSchema";

import {
  createTradeInfoBody,
  updateTradeInfoBody,
} from "../zodSchemas/tradeInfoSchema";
import getReadableId from "../utils/getReadableId";

interface CustomRequest extends Request {
  id?: string;
  updatePassword?: string;
}

const prisma = new PrismaClient();

dayjs.extend(utc);
dayjs.extend(timezone);

const channel = "tradeInfo";
const message = "updated";

export const getTradeInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await prisma.tradeDetails.findMany({
      where: { isDeleted: false, isDummy: false },
      include: {
        liveTradePositions: true,
        instance: true,
      },
    });
    res.status(200).json({ data });
  } catch (e) {
    next(e);
  }
};

export const createTradeInfo = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;
  try {
    const parseSchemaResult = parseZodSchema(body, createTradeInfoBody);

    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    const { pointOfAdjustment, instanceId, legCount } = body;

    const id = nanoid(16);

    await prisma.tradeDetails.create({
      data: {
        id: id,
        humanId: getReadableId(),
        qty: 0,
        legCount,
        currentQty: 0,
        entryPrice: 0,
        takeProfitPremium: 0,
        stopLossPoints: 0,
        takeProfitPoints: 0,
        stopLossPremium: 0,
        entrySpotPrice: 0,
        lastPointOfAdjustment: 0,
        pointOfAdjustment: pointOfAdjustment,
        pointOfAdjustmentUpperLimit: 0,
        pointOfAdjustmentLowerLimit: 0,
        createdBy: req.id!,
        instanceId: instanceId,
        updatedAt: new Date(),
      },
    });
    await redisClient.publish(channel, message);

    res.status(200).json({ msg: "created successfully" });
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export const updateTradeInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  const id = req.query.id as string;
  try {
    const parseSchemaResult = parseZodSchema(body, updateTradeInfoBody);

    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    await prisma.tradeDetails.update({
      where: { id },
      data: { ...body, updatedAt: new Date() },
    });
    await redisClient.publish(channel, message);
    res.status(200).json({ msg: "updated successfully" });
  } catch (e) {
    next(e);
  }
};

export const deleteTradeInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = req.query.id as string;
  try {
    await prisma.tradeDetails.update({
      where: { id },
      data: { isDeleted: true, updatedAt: new Date() },
    });
    await redisClient.publish(channel, message);
    res.status(200).json({ msg: "deleted successfully" });
  } catch (e) {
    next(e);
  }
};

export const cancelTrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = req.query.id as string;
  try {
    await prisma.tradeDetails.update({
      where: { id, entryTriggered: false },
      data: {
        entryType: "UNDEFINED",
        qty: 0,
        updatedAt: new Date(),
      },
    });
    await redisClient.publish(channel, message);
    res.status(200).json({ status: "ok" });
  } catch (e) {
    next(e);
  }
};
