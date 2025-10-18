import { createClient } from "redis";
import config from "./config.js";

const redisClient = createClient({
  url: "redis://localhost:" + config.cachePort,
});

redisClient.on("error", (err) => console.error("Redis Error:", err));

export default redisClient;
