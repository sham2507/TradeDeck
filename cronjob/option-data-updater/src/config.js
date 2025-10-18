import dotenv from "dotenv";

dotenv.config();

const cacheEnv = process.env.CACHE_PORT;
const marketDataUrlEnv = process.env.MARKET_DATA_URL;

if (!cacheEnv || !marketDataUrlEnv) {
  throw new Error("Env Files are missing");
}

const config = {
  cachePort: cacheEnv,
  marketDataUrl: marketDataUrlEnv,
};

export default config;
