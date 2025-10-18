import { Request, Response, NextFunction } from "express";

import { PrismaClient } from "@prisma/client";

import bcrypt from "bcryptjs";

import Speakeasy from "speakeasy";

import jwt from "jsonwebtoken";

import { AppError } from "../middlewares/errorHandler";

import parseZodSchema from "../utils/parseSchema";

import {
  addUserBody,
  createTOtpBody,
  updateCredentialsBody,
  userLoginBody,
} from "../zodSchemas/authSchema";

import config from "../config/config";

interface CustomRequest extends Request {
  id?: string;
  updatePassword?: string;
}

const prisma = new PrismaClient();

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  try {
    const parseSchemaResult = parseZodSchema(body, userLoginBody);

    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    const data = await prisma.user.findFirst();

    if (!data) {
      const err = new Error("Create User to Login") as AppError;
      err.status = 400;
      throw err;
    }

    const verifyPassword = bcrypt.compareSync(body.password, data.password);

    if (verifyPassword === false) {
      const err = new Error("Incorrect Password") as AppError;
      err.status = 400;
      throw err;
    }

    const token = jwt.sign(
      {
        id: data.id,
        updatePassword: data.reset,
      },
      config.jwtPass,
      { expiresIn: 60 * 600 }
      // sec *  min
    );

    if (data?.reset === true) {
      res.status(200).json({ updatePassword: true, msg: "ok", token });
      return;
    }

    // const getCredentials = await prisma.credentials.findFirst({
    //   where: { keyName: "key-1" },
    // });
    // if (!getCredentials)
    //   throw Object.assign(new Error("credentials are invalid"), {
    //     status: 400,
    //   }) as AppError;

    // const brokerLogin = await axios.post(
    //   "https://trading.bigul.co/interactive/user/session",
    //   {
    //     secretKey: getCredentials.apiSecret,
    //     appKey: getCredentials.apiKey,
    //     source: "WebAPI",
    //   }
    // );
    // console.log(brokerLogin.data.result.userID);

    // // 36300 - 10 HOURS

    // await redisClient.set("userId", brokerLogin.data.result.userID, {
    //   EX: 36300,
    // });

    // await redisClient.set("interactiveSession", brokerLogin.data.result.token, {
    //   EX: 36300,
    // });

    if (!body.otp) {
      const err = new Error("Otp is required") as AppError;
      err.status = 400;
      throw err;
    }

    let validateTOtp = Speakeasy.totp.verify({
      secret: data.credentials,
      encoding: "base32",
      token: body.otp,
      window: 1,
    });

    // prod remove
    validateTOtp = 100 > 2;

    if (validateTOtp !== true) {
      const err = new Error("Invalid Otp") as AppError;
      err.status = 400;
      throw err;
    }

    res.status(200).json({ updatePassword: false, msg: "ok", token });
  } catch (e) {
    next(e);
  }
};

export const updateCredentials = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;
  try {
    const parseSchemaResult = parseZodSchema(body, updateCredentialsBody);

    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    const data = await prisma.user.findFirst({
      where: {
        id: req.id,
      },
    });

    if (!data) {
      const err = new Error("Something Went wrong") as AppError;
      err.status = 400;
      throw err;
    }

    const verifyPassword = bcrypt.compareSync(body.oldPassword, data.password);

    if (verifyPassword === false) {
      const err = new Error("Incorrect Old Password") as AppError;
      err.status = 400;
      throw err;
    }

    const hashPassword = bcrypt.hashSync(body.newPassword);

    await prisma.user.update({
      where: {
        id: data.id,
      },
      data: { password: hashPassword },
    });

    const authenticator = Speakeasy.generateSecret({
      name: "trade-deck:Keshav",
    });

    res.status(200).json({ msg: "Password updated", authenticator });
  } catch (e) {
    next(e);
  }
};

export const createTOtp = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;

  try {
    const parseSchemaResult = parseZodSchema(body, createTOtpBody);

    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }

    const validateTOtp = Speakeasy.totp.verify({
      secret: body.credential,
      encoding: "base32",
      token: body.otp,
      window: 1,
    });

    if (validateTOtp !== true) {
      const err = new Error("Invalid Otp") as AppError;
      err.status = 400;
      throw err;
    }

    await prisma.user.update({
      where: { id: req.id },
      data: { credentials: body.credential, reset: false },
    });

    res.status(200).json({ msg: "success" });
  } catch (e) {
    next(e);
  }
};

export const verifyUser = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  res
    .status(200)
    .json({ msg: "success", id: req.id, updatePassword: req.updatePassword });
};

export const addUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const body = req.body;
  try {
    const parseSchemaResult = parseZodSchema(body, addUserBody);
    if (parseSchemaResult !== "ok") {
      const err = new Error(parseSchemaResult) as AppError;
      err.status = 400;
      throw err;
    }
    const { credentials, password, reset } = body;
    const hashedPassword = bcrypt.hashSync(password);
    await prisma.user.create({
      data: {
        credentials,
        password: hashedPassword,
        reset,
      },
    });

    await prisma.portfolioSettings.create({ data: {} });

    res.status(200).json({ msg: "User added successfully" });
  } catch (e) {
    next(e);
  }
};
