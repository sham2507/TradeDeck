import dotenv from "dotenv";

dotenv.config();

const portEnv = process.env.MAIN_PORT;
const jwtPassEnv = process.env.JWT_PASS;
const cacheEnv = process.env.CACHE_PORT;
const marketDataUrlEnv = process.env.MARKET_DATA_URL;

if (!portEnv || !jwtPassEnv || !cacheEnv || !marketDataUrlEnv) {
  throw new Error("Env Files are missing");
}

const config = {
  port: portEnv,
  jwtPass: jwtPassEnv,
  cachePort: cacheEnv,
  marketDataUrl: marketDataUrlEnv,
};

export default config;
