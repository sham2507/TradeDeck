import express from "express";
import cors from "cors";

import { errorHandler } from "./middlewares/errorHandler";

import authRoutes from "./routes/authRoutes";
import tradeInfo from "./routes/tradesInfoRoutes";

const app = express();

app.use(express.json());

app.use(cors());

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "running" });
});

app.use("/auth", authRoutes);

app.use("/user", tradeInfo);

app.use(errorHandler);

export default app;
