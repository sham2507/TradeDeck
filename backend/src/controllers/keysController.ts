import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

import { AppError } from "../middlewares/errorHandler";

import parseZodSchema from "../utils/parseSchema";

import { updateKeyBody } from "../zodSchemas/keySchema";

interface CustomRequest extends Request {
  id?: string;
  updatePassword?: string;
}

const prisma = new PrismaClient();

export const getKeys = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await prisma.credentials.findMany();
    res.status(200).json({ keys: data });
  } catch (e) {
    next(e);
  }
};

export const updateKeys = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  try {
    if (!req.query.keyName)
      throw Object.assign(new Error("keyName is required"), {
        status: 400,
      }) as AppError;
    if (!req.id)
      throw Object.assign(new Error("id is required"), {
        status: 400,
      }) as AppError;

    const keyName = req.query.keyName as string;

    const parseSchemaResult = parseZodSchema(body, updateKeyBody);

    if (parseSchemaResult !== "ok")
      throw Object.assign(new Error("parseSchemaResult"), {
        status: 400,
      }) as AppError;

    const findKeyName = await prisma.credentials.findFirst({
      where: { keyName },
    });

    if (!findKeyName) {
      await prisma.credentials.create({
        data: {
          keyName,
          apiKey: body.apiKey,
          apiSecret: body.apiSecret,
          userId: req.id,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.credentials.update({
        where: { keyName },
        data: { ...body, updatedAt: new Date() },
      });
    }
    res.status(200).json({ msg: "Credentials Updated" });
  } catch (e) {
    next(e);
  }
};
