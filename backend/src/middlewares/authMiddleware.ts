import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

import config from "../config/config";

interface CustomRequest extends Request {
  id?: string;
  updatePassword?: string;
}

const authMiddleware = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  if (!header) {
    res
      .status(401)
      .json({ msg: "Authentication Headers are missing or invalid" });
    return;
  }

  const authToken = header?.split(" ")[1];
  if (!authToken) {
    res.status(400).json({ msg: "Token Invalid or missing" });
    return;
  }
  try {
    const verify = (await jwt.verify(authToken, config.jwtPass)) as JwtPayload;
    req.id = verify.id;
    req.updatePassword = verify.updatePassword;
    next();
  } catch (e) {
    res.status(400).json({ msg: "JWT expired or invalid" });
  }
};

export default authMiddleware;
