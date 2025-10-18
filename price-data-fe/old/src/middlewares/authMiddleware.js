import jwt from "jsonwebtoken";
import config from "../config/config.js";

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    res
      .status(401)
      .json({ msg: "Authentication Headers are missing or invalid" });
  }

  const authToken = header?.split(" ")[1];
  if (!authToken) {
    res.status(400).json({ msg: "Token Invalid or missing" });
    return;
  }
  try {
    const verify = await jwt.verify(authToken, config.jwtPass);
    req.id = verify.id;
    req.updatePassword = verify.updatePassword;
    next();
  } catch (e) {
    res.status(400).json({ msg: "JWT expired or invalid" });
  }
};

export default authMiddleware;
