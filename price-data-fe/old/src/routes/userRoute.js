import { Router } from "express";

import authMiddleware from "../middlewares/authMiddleware";
import { getIndexPrice, getPositionPrice } from "../controllers/userController";

const router = Router();

router.get("/indexPrice", authMiddleware, getIndexPrice);

router.get("/position", authMiddleware, getPositionPrice);

export default router;
