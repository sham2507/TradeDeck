const { default: axios } = require("axios");
const jwt = require("jsonwebtoken");

const config = require("../config/config");

async function backendCheck() {
  const token = jwt.sign(
    {
      id: "ws-frontend",
      updatePassword: false,
    },
    config.jwtPass,
    { expiresIn: 60 * 5 }
  );

  try {
    const reqCredentials = await axios.get("http://localhost:3000/health", {
      headers: { Authorization: "Bearer " + token },
    });
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = backendCheck;
