import app from "./app";
import config from "./config/config";
import { connectRedis } from "./utils/initializeCache";
import redisClient from "./utils/initializeCache";

const startServer = async () => {
  try {
    await connectRedis();
    console.log("Connected to Redis");

    const server = app.listen(config.port, () => {
      console.log("Server running on port " + config.port);
    });

    const shutdown = async () => {
      console.log("Shutting down...");
      await redisClient.quit();
      server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("uncaughtException", (err) => {
      console.error("Uncaught Exception:", err);
      shutdown();
    });
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

startServer();
