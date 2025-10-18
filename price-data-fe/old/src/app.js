import express from "express";
import cors from "cors";

import { errorHandler } from "./middlewares/errorHandler";
import userRoutes from "./routes/userRoute.js";

const app = express();

app.use(express.json());

app.use(cors());

app.use(errorHandler);

app.use("/user", userRoutes);

export default app;
