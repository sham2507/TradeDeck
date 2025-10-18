const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const jwt = require("jsonwebtoken");
const cors = require("cors");

var XtsMarketDataAPI = require("./xts/lib/MDRestAPI.js");
var XtsMarketDataWS = require("./xts/lib/MDSocket.js");

const getLatestStreamEntry = require("./utils/getStream.js");
const listenForNewMessages = require("./utils/latestData.js");
const path = require("path");

const config = require("./config/config.js");
const getCredentials = require("./config/getApiCredentials.js");

const backendCheck = require("./utils/checkBackendStatus.js");

const WorkerPool = require("./utils/workerPool.js");
const workerPool = new WorkerPool(2);

const { url, jwtPass, port } = config;

//  secretKey, appKey,

let xtsMarketDataAPI = new XtsMarketDataAPI(url);
let xtsMarketDataWS;
let clientSubscriptions = new Map();

let remainingSymbolCount;
let joinStatus = false;

let latestTradeData = [];
let indexLivePrice = [];
let trackingOptionsData = [];
let optionPrice = [];
let tradeDetailsValues = [];

let optionsData;

let indexStrikeInterval;

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

app.get("/client-subscribed-data", async (req, res) => {
  res.json(clientSubscriptions);
});

app.get("/tracking-options-data", async (req, res) => {
  res.json(trackingOptionsData);
});

server.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);

(async () => {
  const mainFn = async () => {
    redisClient = createClient();
    await redisClient.connect();
    const value = await redisClient.get("optionsData");
    const value2 = await redisClient.get("indexStrikeInterval");

    optionsData = value ? JSON.parse(value) : null;
    indexStrikeInterval = value2 ? JSON.parse(value2) : null;

    if (optionsData === null) throw new Error("no option data");
    if (indexStrikeInterval === null)
      throw new Error("no index strike interval data");

    const info = await getCredentials();
    if (info === null) throw new Error("Cannot Fetch keys");
    const { appKey, secretKey } = info;

    await streamData();

    try {
      const login = await xtsMarketDataAPI.logIn({ secretKey, appKey });
      if (login.type !== xtsMarketDataAPI.responseTypes.success) {
        throw new Error("Login failed: " + JSON.stringify(login));
      }

      const token = login.result.token;
      // console.log(token);
      const userID = login.result.userID;

      xtsMarketDataWS = new XtsMarketDataWS(url);
      xtsMarketDataWS.init({
        userID,
        publishFormat: "JSON",
        broadcastMode: "Full",
        token,
      });

      registerMarketEvents();
      const id = setInterval(() => {
        if (joinStatus) {
          subscribeIndexData();
          clearInterval(id);
        }
      }, 1000 * 5);
    } catch (err) {
      console.error("XTS Init Failed:", err);
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

  checkBackend();
})();

const processingTradeDetailsValue = async () => {
  tradeDetailsValues = await workerPool.runTask("calculateTradeDetailsValues", {
    latestTradeData,
    indexLivePrice,
    optionPrice,
    indexStrikeInterval,
  });
};

const processTrackingDataUpdate = async (newTradeData) => {
  const oldData = [...trackingOptionsData];

  trackingOptionsData = await workerPool.runTask("calculateRequiredScripts", {
    data: newTradeData,
    indexPrice: indexLivePrice,
    optionsData,
    indexStrikeInterval,
  });

  const uniqueOldData = removeDuplicatesByInstrumentId(oldData);
  const uniqueNewData = removeDuplicatesByInstrumentId(trackingOptionsData);

  const { added, removed } = getDiff(uniqueOldData, uniqueNewData);
  // if (added.length > 0) console.log("added", added);

  // if (removed.length > 0) console.log("removed", removed);

  if (removed.length > 0) {
    await unSubscribeOptionsData(removed);
  }

  if (added.length > 0) {
    await subscribeOptionsData(added);
  }

  return { added, removed };
};

const streamData = async () => {
  const data = await getLatestStreamEntry(redisClient);
  if (data) {
    latestTradeData = JSON.parse(data.fields.trades);
  }
  listenForNewMessages(async (data) => {
    const array = data.fields.trades;
    latestTradeData = JSON.parse(array);
    if (indexLivePrice.length >= 6) {
      await processTrackingDataUpdate(latestTradeData);
      await processingTradeDetailsValue();
    }
  }, redisClient);
};

function removeDuplicatesByInstrumentId(data) {
  const seen = new Set();
  return data.filter((item) => {
    if (seen.has(item.instrumentId)) return false;
    seen.add(item.instrumentId);
    return true;
  });
}

function getDiff(oldData, newData) {
  const oldIds = new Set(oldData.map((item) => item.instrumentId));
  const newIds = new Set(newData.map((item) => item.instrumentId));

  const added = newData.filter((item) => !oldIds.has(item.instrumentId));
  const removed = oldData.filter((item) => !newIds.has(item.instrumentId));

  return { added, removed };
}

function registerMarketEvents() {
  xtsMarketDataWS.onConnect(() => console.log("XTS WebSocket connected"));
  xtsMarketDataWS.onJoined((data) => {
    (joinStatus = true), console.log("XTS WebSocket joined:", data);
  });
  xtsMarketDataWS.onError((err) => console.error("WS error:", err));
  xtsMarketDataWS.onDisconnect(() =>
    console.warn("XTS WebSocket disconnected")
  );

  xtsMarketDataWS.onMarketDepthEvent(async (data) => {
    // console.log(data);
    const price = data.Touchline?.LastTradedPrice;

    const getName = {
      26000: "NIFTY",
      26001: "BANKNIFTY",
      26034: "FINNIFTY",
      26121: "MIDCPNIFTY",
      26065: "SENSEX",
      26118: "BANKEX",
    };

    if (
      data.ExchangeInstrumentID !== 26000 &&
      data.ExchangeInstrumentID !== 26001 &&
      data.ExchangeInstrumentID !== 26034 &&
      data.ExchangeInstrumentID !== 26121 &&
      data.ExchangeInstrumentID !== 26065 &&
      data.ExchangeInstrumentID !== 26118
    ) {
      const findOptionsInfo = optionsData.filter(
        (each) => parseInt(each.instrumentId) === data.ExchangeInstrumentID
      );

      if (!findOptionsInfo) throw new Error("something went wrong");

      io.sockets.sockets.forEach((socket) => {
        socket.emit("optionPriceUpdate", {
          segment: data.ExchangeSegment,
          id: data.ExchangeInstrumentID,
          optionName: findOptionsInfo[0]?.optionName,
          price,
        });
      });

      // if (!price) throw new Error("something went wrong");

      // const optionName = findOptionsInfo[0].optionName;

      const existingIndex = optionPrice.findIndex(
        (item) => item.id === data.ExchangeInstrumentID
      );

      if (existingIndex >= 0) {
        // Update only the price or other fields as needed
        optionPrice[existingIndex].price = price;
      } else {
        // Push the new option
        optionPrice.push({
          segment: data.ExchangeSegment,
          optionName: findOptionsInfo[0].optionName,
          id: data.ExchangeInstrumentID,
          price,
        });
      }

      await processTrackingDataUpdate(latestTradeData);

      await processingTradeDetailsValue();

      // console.log("optionPrice", optionPrice);
      // console.log("tracking options:", trackingOptionsData);

      const result = tradeDetailsValues.map((item) => {
        const lowest = Math.min(
          ...item.combinedPremiumArray.map((p) => p.combinedPremium)
        );

        return { id: item.id, lowestCombinedPremium: lowest };
      });

      io.sockets.sockets.forEach((socket) => {
        socket.emit("optionPremium", {
          data: tradeDetailsValues,
        });
      });

      io.sockets.sockets.forEach((socket) => {
        socket.emit("feLowest", {
          data: result,
        });
      });
    } else {
      const indexName = getName[data.ExchangeInstrumentID];
      const priceData = {
        name: indexName,
        price,
        timestamp: new Date().toISOString(),
      };

      const existingIndex = indexLivePrice.findIndex(
        (item) => item.name === indexName
      );

      if (existingIndex >= 0) {
        indexLivePrice[existingIndex] = priceData;
      } else {
        indexLivePrice.push(priceData);
      }

      if (indexLivePrice.length >= 6) {
        await processTrackingDataUpdate(latestTradeData);
        await processingTradeDetailsValue();
      }

      io.sockets.sockets.forEach((socket) => {
        socket.emit("indexPriceUpdate", {
          name: indexName,
          price,
          timestamp: new Date().toISOString(),
        });
      });
    }
  });
}

const subscribeOptionsData = async (data) => {
  if (!data || joinStatus === false) return;

  // const currentEpoch = Math.floor(Date.now() / 1000);

  // const timeSinceLast = currentEpoch - lastSubscribedTime;
  // if (timeSinceLast < RATE_LIMIT_SECONDS) {
  //   const waitTime = (RATE_LIMIT_SECONDS - timeSinceLast) * 1000;
  //   // console.log(`Waiting ${waitTime / 1000}s before next request...`);
  //   await new Promise((resolve) => setTimeout(resolve, waitTime));
  // }

  const list = data.map((each) => {
    const getSegment =
      each.indexName === "BANKNIFTY" ||
      each.indexName === "MIDCPNIFTY" ||
      each.indexName === "FINNIFTY" ||
      each.indexName === "NIFTY"
        ? 2
        : 12;
    return {
      exchangeSegment: getSegment,
      exchangeInstrumentID: each.instrumentId,
    };
  });

  try {
    if (list.length > 0) {
      const res = await xtsMarketDataAPI.subscription({
        instruments: list,
        xtsMessageCode: 1502,
      });
      lastSubscribedTime = Math.floor(Date.now() / 1000);

      if (res.result) {
        const remainingSymbolCount = res.result.Remaining_Subscription_Count;
        await redisClient.set("remainingCount", remainingSymbolCount);
      }
    }
  } catch (e) {
    console.log("Error subscribing:", e);
  }
};

const unSubscribeOptionsData = async (data) => {
  if (!data || data.length < 0 || joinStatus === false) return;

  // const currentEpoch = Math.floor(Date.now() / 1000);

  // const timeSinceLast = currentEpoch - lastSubscribedTime;
  // if (timeSinceLast < RATE_LIMIT_SECONDS) {
  //   const waitTime = (RATE_LIMIT_SECONDS - timeSinceLast) * 1000;
  //   // console.log(`Waiting ${waitTime / 1000}s before next request...`);
  //   await new Promise((resolve) => setTimeout(resolve, waitTime));
  // }

  const list = data.map((each) => {
    const getSegment =
      each.indexName === "BANKNIFTY" ||
      each.indexName === "MIDCPNIFTY" ||
      each.indexName === "FINNIFTY" ||
      each.indexName === "NIFTY"
        ? 2
        : 12;
    return {
      exchangeSegment: getSegment,
      exchangeInstrumentID: each.instrumentId,
    };
  });
  try {
    if (list.length > 0) {
      const res = await xtsMarketDataAPI.unSubscription({
        instruments: list,
        xtsMessageCode: 1502,
      });
      lastSubscribedTime = Math.floor(Date.now() / 1000);
      remainingSymbolCount = remainingSymbolCount + list.length;
      await redisClient.set("remainingCount", remainingSymbolCount);
    }
  } catch {
    console.log("Error");
  }
};

const subscribeIndexData = async () => {
  // const currentEpoch = Math.floor(Date.now() / 1000);

  // const timeSinceLast = currentEpoch - lastSubscribedTime;
  // if (timeSinceLast < RATE_LIMIT_SECONDS) {
  //   const waitTime = (RATE_LIMIT_SECONDS - timeSinceLast) * 1000;
  //   // console.log(`Waiting ${waitTime / 1000}s before next request...`);
  //   await new Promise((resolve) => setTimeout(resolve, waitTime));
  // }

  const indexList = [
    {
      exchangeSegment: 1,
      exchangeInstrumentID: 26000, // NIF
    },
    {
      exchangeSegment: 1,
      exchangeInstrumentID: 26001, // BANK
    },
    {
      exchangeSegment: 1,
      exchangeInstrumentID: 26034, //FIN
    },
    {
      exchangeSegment: 1,
      exchangeInstrumentID: 26121, // MIDCAPNIF
    },
    {
      exchangeSegment: 11,
      exchangeInstrumentID: 26065, // sensex
    },
    {
      exchangeSegment: 11,
      exchangeInstrumentID: 26118, //bankex
    },
  ];
  try {
    const res = await xtsMarketDataAPI.subscription({
      instruments: indexList,
      xtsMessageCode: 1502,
    });
    lastSubscribedTime = Math.floor(Date.now() / 1000);

    if (res.result) {
      remainingSymbolCount = res.result.Remaining_Subscription_Count;
      await redisClient.set("remainingCount", remainingSymbolCount);
    }
  } catch (err) {
    console.error("Subscription error:", err);
  }
};

io.on("connection", (socket) => {
  // if (joinStatus === false) return;
  console.log("Socket client connected:", socket.id);

  socket.emit("lastPrice", {
    optionsData: tradeDetailsValues,
    optionPrice: optionPrice,
    IndexPrice: indexLivePrice,
  });

  clientSubscriptions.set(socket.id, new Set());

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    clientSubscriptions.delete(socket.id);
  });
});
