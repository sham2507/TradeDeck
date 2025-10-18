import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

import parseZodSchema from "../utils/parseSchema";

import { AppError } from "../middlewares/errorHandler";

import {
  liveTradePositionsBody,
  updateLiveTradePositionBody,
  updateLiveTradePositionBulkBody,
} from "../zodSchemas/positionSchema";

const prisma = new PrismaClient();

export const createPosition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  try {
    const parseSchemaResult = parseZodSchema(body, liveTradePositionsBody);

    if (parseSchemaResult !== "ok")
      throw Object.assign(new Error(parseSchemaResult), {
        status: 400,
      }) as AppError;
    const addUpdateTime = body.positions.map((each: any) => ({
      ...each,
      updatedAt: new Date(),
    }));
    await prisma.liveTradePosition.createMany({
      data: [...addUpdateTime],
    });
    res.status(200).json({ msg: "positions created" });
  } catch (e) {
    next(e);
  }
};

export const updatePosition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  try {
    const parseSchemaResult = parseZodSchema(body, updateLiveTradePositionBody);

    if (parseSchemaResult !== "ok")
      throw Object.assign(new Error(parseSchemaResult), {
        status: 400,
      }) as AppError;

    const { tradeDetailsId, data } = body;

    const result = await prisma.liveTradePosition.updateMany({
      where: { tradeDetailsId },
      data,
    });

    if (result.count > 0) {
      res.status(200).json({
        success: true,
      });

      return;
    }
    res.status(400).json({
      success: false,
    });
  } catch (e) {
    next(e);
  }
};

export const updatePositionBulk = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  try {
    const parseSchemaResult = parseZodSchema(
      body,
      updateLiveTradePositionBulkBody
    );

    if (parseSchemaResult !== "ok")
      throw Object.assign(new Error(parseSchemaResult), {
        status: 400,
      }) as AppError;

    const position = body.positions;

    const result = await Promise.all(
      position.map(({ id, data }: { id: string; data: any }) =>
        prisma.liveTradePosition.update({
          where: { id },
          data,
        })
      )
    );

    res.status(200).json({
      success: true,
      count: result.length,
    });
  } catch (e) {
    next(e);
  }
};

export const getPosition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = req.query.id as string;
  try {
    let data;

    if (!id) {
      data = await prisma.liveTradePosition.findMany();
    } else {
      data = await prisma.liveTradePosition.findMany({
        where: { tradeDetailsId: id },
      });
    }
    res.status(200).json({ positions: data });
  } catch (e) {
    next(e);
  }
};
