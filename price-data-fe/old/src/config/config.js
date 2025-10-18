import dotenv from "dotenv";

dotenv.config();

const portEnv = process.env.PORT;
const jwtPassEnv = process.env.JWT_PASS;

if (!portEnv || !jwtPassEnv) throw new Error("Env File Missing");

const config = {
  port: portEnv,
  jwtPass: jwtPassEnv,
};

export default config;
