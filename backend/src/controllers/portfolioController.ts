import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

import redisClient from "../utils/initializeCache";

import { AppError } from "../middlewares/errorHandler";

const prisma = new PrismaClient();

const channel = "tradeInfo";
const message = "updated";

export const getPortfolio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbResponse = await prisma.portfolioSettings.findMany({});
    res.status(200).json({ data: dbResponse });
  } catch (e) {
    next(e);
  }
};

export const updatePortfolio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { stopLossAmount, targetAmount, stopLossTrailing, isEnabled } =
    req.query as {
      stopLossAmount?: string;
      targetAmount?: string;
      stopLossTrailing?: string;
      isEnabled?: string;
    };

  if (!stopLossAmount && !stopLossTrailing && !isEnabled && !targetAmount) {
    const err = new Error("At least one parameter is expected") as AppError;
    err.status = 400;
    return next(err);
  }

  const updateData: Record<string, any> = {};

  if (stopLossAmount !== undefined) {
    const amount = parseFloat(stopLossAmount);
    if (isNaN(amount)) {
      const err = new Error("Invalid stopLossAmount") as AppError;
      err.status = 400;
      return next(err);
    }
    updateData.stopLossAmount = amount;
  }

  if (targetAmount !== undefined) {
    const amount = parseFloat(targetAmount);
    if (isNaN(amount)) {
      const err = new Error("Invalid stopLossAmount") as AppError;
      err.status = 400;
      return next(err);
    }
    updateData.targetAmount = amount;
  }

  if (stopLossTrailing !== undefined) {
    const trailing = parseFloat(stopLossTrailing);
    if (isNaN(trailing)) {
      const err = new Error("Invalid stopLossTrailing") as AppError;
      err.status = 400;
      return next(err);
    }
    updateData.stopLossTrailing = trailing;
  }

  if (isEnabled !== undefined) {
    if (isEnabled !== "true" && isEnabled !== "false") {
      const err = new Error("Invalid isEnabled value") as AppError;
      err.status = 400;
      return next(err);
    }
    updateData.isEnabled = isEnabled === "true";
  }

  try {
    await prisma.portfolioSettings.updateMany({
      data: updateData,
    });

    await redisClient.publish(channel, message);

    res.status(200).json({ message: "Portfolio updated successfully" });
  } catch (e) {
    next(e);
  }
};
