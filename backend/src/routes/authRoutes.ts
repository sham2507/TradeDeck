import { Router } from "express";
import {
  authenticateUser,
  createTOtp,
  updateCredentials,
  verifyUser,
  addUser,
} from "../controllers/authController";

import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

router.post("/login", authenticateUser);

router.post("/register", addUser);

router.put("/credentials", authMiddleware, updateCredentials);

router.post("/tOtp", authMiddleware, createTOtp);

router.get("/verify", authMiddleware, verifyUser);

export default router;
