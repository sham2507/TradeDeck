const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("redis");

var XTSInteractiveWS = require("./xts/lib/interactiveSocket");
var XTSInteractive = require("./xts/lib/interactiveRestAPI");

const config = require("./config/config.js");

const backendCheck = require("./utils/checkBackendStatus.js");
const getTradeInfo = require("./utils/getTradeInfo.js");
const getCredentials = require("./config/getApiCredentials.js");

const { url, jwtPass, port } = config;

var xtsInteractiveWS = null;

let joinStatus = false;
let redisClient;

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    let token = socket.handshake.auth.token;

    // Fall back to header (for Postman or non-browser clients)
    if (!token && socket.handshake.headers.authorization) {
      const header = socket.handshake.headers.authorization;
      if (header.startsWith("Bearer ")) {
        token = header.slice(7);
      }
    }

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    jwt.verify(token, jwtPass, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token"));
      }

      socket.user = decoded; // Attach decoded user
      next();
    });
  } catch (err) {
    console.error("Authentication error:", err.message);
    next(new Error("Authentication error"));
  }
});

app.get("/health", async (req, res) => {
  const health = {
    service: "live-price-service",
    timestamp: new Date().toISOString(),
    redisConnected: redisClient?.isOpen || false,
    brokerWSConnected: joinStatus,
  };

  res.json(health);
});

server.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);

const registerEvents = async function () {
  //instantiating the listeners for all event related data

  //"connect" event listener
  xtsInteractiveWS.onConnect((connectData) => {
    // console.log(connectData);
  });

  //"joined" event listener
  xtsInteractiveWS.onJoined((joinedData) => {
    joinStatus = true;
    console.log(joinedData);
  });

  //"error" event listener
  xtsInteractiveWS.onError((errorData) => {
    console.log(errorData);
  });

  //"disconnect" event listener
  xtsInteractiveWS.onDisconnect((disconnectData) => {
    console.log(disconnectData);
  });

  //"order" event listener
  xtsInteractiveWS.onOrder((orderData) => {
    // console.log(orderData);
    io.emit("order", orderData);
  });

  //"trade" event listener
  xtsInteractiveWS.onTrade((tradeData) => {
    // console.log(tradeData);
    io.emit("tradeData", tradeData);
  });

  //"position" event listener
  xtsInteractiveWS.onPosition((positionData) => {
    // console.log(positionData);
    io.emit("positionData", positionData);
  });

  //"logout" event listener
  xtsInteractiveWS.onLogout((logoutData) => {
    io.emit("logout", logoutData);
    console.log(logoutData);
  });
};

const subscribeToChannel = async () => {
  const subscriber = createClient();

  subscriber.on("error", (err) => {
    console.error("Redis subscriber error:", err);
  });

  await subscriber.connect();

  await subscriber.subscribe("tradeInfo", async () => {
    const info = await getTradeInfo();
    io.emit("tradeInfo", info);
  });
};

const mainFn = async () => {
  try {
    redisClient = createClient();
    await redisClient.connect();

    const info = await getCredentials();
    if (info === null) throw new Error("Cannot Fetch keys");
    const { appKey, secretKey } = info;

    // let userID = await redisClient.get("userId");
    // let token = await redisClient.get("interactiveSession");
    // let source = ""
    xtsInteractive = new XTSInteractive(url);

    var loginRequest = {
      secretKey,
      appKey,
    };

    let logIn = await xtsInteractive.logIn(loginRequest);

    if (logIn && logIn.type == xtsInteractive.responseTypes.success) {
      xtsInteractiveWS = new XTSInteractiveWS(url);
      userID = logIn.result.userID;
      token = logIn.result.token;
      await redisClient.set("interactiveSession", token);

      var socketInitRequest = {
        userID,
        token,
      };
      xtsInteractiveWS.init(socketInitRequest);

      await registerEvents();
      await subscribeToChannel();
    } else {
      console.error(logIn);
    }
  } catch (e) {
    console.log(e);
  }
};

const checkBackend = async () => {
  const status = await backendCheck();
  if (status) {
    console.log("Backend running, initializing...");
    await mainFn();
  } else {
    console.log("Backend not running, retrying...");
    setTimeout(checkBackend, 5000);
  }
};

(async () => {
  await checkBackend();
})();
