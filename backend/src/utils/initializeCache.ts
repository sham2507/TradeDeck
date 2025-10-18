import { createClient } from "redis";
import config from "../config/config";


const redisClient = createClient({
  url: "redis://localhost:" + config.cachePort,
});

redisClient.on("error", (err) => console.error("Redis Error:", err));


let isConnected = false;

export const connectRedis = async () => {
  if (!isConnected) {
    await redisClient.connect();
    isConnected = true;
  }
};


export default redisClient;
