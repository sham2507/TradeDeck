import dotenv from "dotenv";

dotenv.config();

const cacheEnv = process.env.CACHE_PORT;

if (!cacheEnv) {
  throw new Error("Env Files are missing");
}

const config = {
  cachePort: cacheEnv,
};

export default config;
