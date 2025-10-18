require("dotenv").config();

const urlEnv = process.env.URL;
const portEnv = process.env.WS_PORT;
const jwtPassEnv = process.env.JWT_PASS;

if (!urlEnv || !jwtPassEnv || !portEnv) {
  throw new Error("Env Files are missing");
}

const config = {
  url: urlEnv,
  jwtPass: jwtPassEnv,
  port: portEnv,
};

module.exports = config;
