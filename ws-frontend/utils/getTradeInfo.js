const { default: axios } = require("axios");
const jwt = require("jsonwebtoken");
const config = require("../config/config.js");

const getTradeInfo = async () => {
  try {
    const token = jwt.sign(
      {
        id: "live-price",
        updatePassword: false,
      },
      config.jwtPass,
      { expiresIn: 60 * 5 }
    );

    const info = await axios.get("http://localhost:3000/user/instances", {
      headers: { Authorization: "Bearer " + token },
    });
    return info.data;
  } catch (e) {
    console.log(e);
    return null;
  }
};

module.exports = getTradeInfo;
