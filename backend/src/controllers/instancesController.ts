import { Request, Response, NextFunction } from "express";

import { PrismaClient } from "@prisma/client";

import { AppError } from "../middlewares/errorHandler";

import parseZodSchema from "../utils/parseSchema";

import {
  createInstanceBody,
  deleteInstanceQuery,
} from "../zodSchemas/instanceSchema";

const prisma = new PrismaClient();

interface CustomRequest extends Request {
  id?: string;
  updatePassword?: string;
}

export const getInstance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await prisma.instance.findMany({
      where: {
        isDeleted: false,
        isDummy: false,
      },
      include: {
        tradeDetails: {
          where: {
            isDeleted: false,
            isDummy: false,
          },
          include: {
            liveTradePositions: {
              where: {
                closed: false,
              },
            },
          },
        },
      },
    });
    res.status(200).json({ data });
  } catch (e) {
    next(e);
  }
};

export const createInstance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;
  try {
    const parseSchemaResult = parseZodSchema(body, createInstanceBody);

    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    const { indexName, expiry, ltpRange, legCount } = body;

    await prisma.instance.create({
      data: {
        indexName,
        expiry,
        ltpRange,

        updatedAt: new Date(),
      },
    });

    res.status(200).json({ msg: "created successfully" });
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export const deleteInstance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const query = Object.fromEntries(Object.entries(req.query)) as { id: string };
  try {
    const parseSchemaResult = parseZodSchema(query, deleteInstanceQuery);

    if (parseSchemaResult !== "ok") {
      console.log(parseSchemaResult);
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    const getInfo = await prisma.tradeDetails.findMany({
      where: { instanceId: query.id, isDeleted: false, alive: true },
    });

    if (getInfo.length > 0) {
      const err = new Error(
        "Cannot delete instance with active trades"
      ) as AppError;
      err.status = 400;
      throw err;
    }
    await prisma.instance.update({
      where: { id: query.id },
      data: { isDeleted: true },
    });
    res.status(200).json({ msg: "Instance deleted successfully" });
  } catch (e) {
    next(e);
  }
};
