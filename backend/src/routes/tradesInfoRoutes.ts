import { Router } from "express";

import {
  createTradeInfo,
  deleteTradeInfo,
  getTradeInfo,
  updateTradeInfo,
  cancelTrade,
} from "../controllers/tradeInfoController";

import authMiddleware from "../middlewares/authMiddleware";
import {
  getCandles,
  getClosedMtmData,
  getFundsData,
  getIndicesData,
  getLotSize,
  getRemainingSymbols,
  getServicesEvents,
  squareOffAll,
  userExit,
} from "../controllers/userControllers";
import { getKeys, updateKeys } from "../controllers/keysController";
import {
  createPosition,
  getPosition,
  updatePosition,
  updatePositionBulk,
} from "../controllers/positionController";
import {
  getPortfolio,
  updatePortfolio,
} from "../controllers/portfolioController";
import {
  createInstance,
  deleteInstance,
  getInstance,
} from "../controllers/instancesController";

const router = Router();

// instances endPoints

router.get("/instances", authMiddleware, getInstance);

router.post("/instances", authMiddleware, createInstance);

router.delete("/instances", authMiddleware, deleteInstance);

// tradeInfo endPoints

router.get("/tradeInfo", authMiddleware, getTradeInfo);

router.post("/tradeInfo", authMiddleware, createTradeInfo);

router.put("/tradeInfo", authMiddleware, updateTradeInfo);

router.delete("/tradeInfo", authMiddleware, deleteTradeInfo);

router.delete("/cancelOrder", authMiddleware, cancelTrade);

// keys endPoints
router.get("/keys", authMiddleware, getKeys);

router.put("/keys", authMiddleware, updateKeys);

// position endPoints

router.get("/position", authMiddleware, getPosition);

router.post("/position", authMiddleware, createPosition);

router.put("/position", authMiddleware, updatePosition);

router.put("/bulk/position", authMiddleware, updatePositionBulk);

// portfolio trailing end points

router.get("/portfolio", getPortfolio);

router.put("/portfolio", updatePortfolio);

// frontend endpoints

router.get("/candle", authMiddleware, getCandles);

router.get("/funds", authMiddleware, getFundsData);

router.get("/closedMtm", authMiddleware, getClosedMtmData);

router.get("/symbol", authMiddleware, getRemainingSymbols);

router.get("/optionData", authMiddleware, getIndicesData);

router.get("/lotSize", authMiddleware, getLotSize);

router.get("/userExit", authMiddleware, userExit);

router.get("/squareOffAll", authMiddleware, squareOffAll);

router.get("/servicesEvents", getServicesEvents);

export default router;
