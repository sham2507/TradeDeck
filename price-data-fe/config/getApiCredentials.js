const { default: axios } = require("axios");
const jwt = require("jsonwebtoken");

const config = require("./config");

async function getCredentials() {
  const token = jwt.sign(
    {
      id: "live-price",
      updatePassword: false,
    },
    config.jwtPass,
    { expiresIn: 60 * 5 }
  );

  const reqCredentials = await axios.get("http://localhost:3000/user/keys", {
    headers: { Authorization: "Bearer " + token },
  });

  const key = reqCredentials.data.keys.filter(
    (each) => each.keyName === "key-2"
  )[0];

  if (reqCredentials.data) {
    return {
      appKey: key.apiKey,
      secretKey: key.apiSecret,
    };
  }

  return null;
}

module.exports = getCredentials;
