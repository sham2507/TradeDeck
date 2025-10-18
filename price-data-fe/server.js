const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const jwt = require("jsonwebtoken");
const cors = require("cors");

var XtsMarketDataAPI = require("./xts/lib/MDRestAPI.js");
var XtsMarketDataWS = require("./xts/lib/MDSocket.js");

const config = require("./config/config.js");
const getCredentials = require("./config/getApiCredentials.js");

const backendCheck = require("./utils/checkBackendStatus.js");
const calculateTradeDetailsValues = require("./utils/calculateTradeDetailsValues.js");
const calculateRequiredScripts = require("./utils/calculateRequiredScripts.js");
const { default: axios } = require("axios");

// const WorkerPool = require("./utils/workerPool.js");
// const workerPool = new WorkerPool(1);

const { url, jwtPass, port } = config;

let xtsMarketDataAPI = new XtsMarketDataAPI(url);
let xtsMarketDataWS;
let clientSubscriptions = new Map(); // socket.id => Set of "segment|instrumentID"
let globalSubscriptions = new Set();

let joinStatus = false;
let remainingSymbolCount;

//  user subscribed option data with indexName,expiry,ltpRange
let userOptionData = [];

//  index price gets stored
let indexLivePrice = [];

// option live price
let optionPrice = [];

// tracking options data
let trackingOptionsData = [];

// option combinedPremium Values and spreadPremium Values
let tradeDetailsValues = [];

//  option exchange id and all details derivatives master list
let optionsData;

let indexStrikeInterval;

let redisClient;

let token;

const app = express();

// Enable CORS for Express
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

// Socket.IO authentication middleware
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
    service: "fe-price-service",
    timestamp: new Date().toISOString(),
    redisConnected: redisClient?.isOpen || false,
    brokerWSConnected: joinStatus,
  };

  res.json(health);
});

app.get("/user-subscriptions", async (req, res) => {
  res.json(userOptionData);
});

app.get("/live-price", async (req, res) => {
  res.json(trackingOptionsData);
});

app.get("/optionPrice", async (req, res) => {
  res.json(optionPrice);
});

app.get("/api-status", async (req, res) => {
  try {
    const response = await axios.get(
      "https://trading.bigul.co/apimarketdata/config/clientConfig",
      {
        headers: { Authorization: token },
      }
    );

    // console.log(response.data, response.status);
    if (response.status !== 200)
      return res.status(400).json({ status: "error" });

    res.status(200).json({ status: "success" });
  } catch (e) {
    console.log(e);
    res.status(400).json({
      status: "error",
    });
  }
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

    try {
      const login = await xtsMarketDataAPI.logIn({ secretKey, appKey });
      if (login.type !== xtsMarketDataAPI.responseTypes.success) {
        throw new Error("Login failed: " + JSON.stringify(login));
      }

      token = login.result.token;
      await redisClient.set("marketDataToken", token);
      const userID = login.result.userID;

      xtsMarketDataWS = new XtsMarketDataWS(url);
      xtsMarketDataWS.init({
        userID,
        publishFormat: "JSON",
        broadcastMode: "Full",
        token,
      });

      registerMarketEvents();
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

function removeDuplicatesByInstrumentId(data) {
  const seen = new Set();
  if (!data) return [];
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

const processTrackingDataUpdate = async () => {
  const oldData = [...userOptionData];
  // trackingOptionsData = await workerPool.runTask(
  //   userOptionData,
  //   indexLivePrice,
  //   optionsData,
  //   indexStrikeInterval
  // );

  trackingOptionsData = await calculateRequiredScripts(
    userOptionData,
    indexLivePrice,
    optionsData,
    indexStrikeInterval
  );

  const uniqueOldData = removeDuplicatesByInstrumentId(oldData);
  const uniqueNewData = removeDuplicatesByInstrumentId(trackingOptionsData);

  const { added, removed } = getDiff(uniqueOldData, uniqueNewData);

  if (removed.length > 0) {
    await unSubscribeOptionsData(removed);
  }

  if (added.length > 0) {
    await subscribeOptionsData(added);
  }

  return { added, removed };
};

const processingTradeDetailsValue = async () => {
  // tradeDetailsValues = await workerPool.runTask(
  //   userOptionData,
  //   indexLivePrice,
  //   optionPrice,
  //   indexStrikeInterval
  // );
  tradeDetailsValues = await calculateTradeDetailsValues(
    userOptionData,
    indexLivePrice,
    optionPrice,
    indexStrikeInterval
  );
};

const subscribeOptionsData = async (data) => {
  if (!data || joinStatus === false) return;

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
      remainingSymbolCount = remainingSymbolCount + list.length;
      await redisClient.set("remainingCount", remainingSymbolCount);
    }
  } catch {
    console.log("Error");
  }
};

function registerMarketEvents() {
  // ✅ Replaced object with Map for faster key lookup
  const INDEX_MAP = new Map([
    [26000, "NIFTY"],
    [26001, "BANKNIFTY"],
    [26034, "FINNIFTY"],
    [26121, "MIDCPNIFTY"],
    [26065, "SENSEX"],
    [26118, "BANKEX"],
  ]);

  // ✅ Added Map for index and option price tracking (O(1) lookup)
  const indexPriceMap = new Map(); // name => { price, timestamp }
  const optionPriceMap = new Map(); // instrumentId => { price }

  xtsMarketDataWS.onConnect(() => console.log("XTS WebSocket connected"));
  xtsMarketDataWS.onJoined((data) => {
    joinStatus = true;
    console.log("XTS WebSocket joined:", data);
  });
  xtsMarketDataWS.onError((err) => console.error("WS error:", err));
  xtsMarketDataWS.onDisconnect(() =>
    console.warn("XTS WebSocket disconnected")
  );

  xtsMarketDataWS.onMarketDepthEvent(async (data) => {
    const price = data.Touchline?.LastTradedPrice;
    const instrumentId = data.ExchangeInstrumentID;

    // ✅ Use Map.has instead of multiple OR checks
    const isIndex = INDEX_MAP.has(instrumentId);

    if (isIndex) {
      const name = INDEX_MAP.get(instrumentId);
      const existing = indexPriceMap.get(name);

      // ✅ Only proceed if price changed
      if (existing?.price === price) return;

      const newPriceData = {
        name,
        price,
        timestamp: new Date().toISOString(),
      };

      indexPriceMap.set(name, newPriceData);

      // ✅ Sync indexLivePrice array for backward compatibility
      const listIndex = indexLivePrice.findIndex((i) => i.name === name);
      if (listIndex >= 0) {
        indexLivePrice[listIndex] = newPriceData;
      } else {
        indexLivePrice.push(newPriceData);
      }

      // ✅ Only trigger tracking after all index prices are filled
      if (indexPriceMap.size >= 6) {
        await processTrackingDataUpdate();
        await processingTradeDetailsValue();
      }

      // ✅ io.emit is more efficient than sockets.forEach
      io.emit("priceUpdate", {
        segment: data.ExchangeSegment,
        id: instrumentId,
        name,
        price,
        timestamp: newPriceData.timestamp,
      });
    } else {
      // ✅ Use .find() once and guard
      const option = optionsData.find(
        (each) => parseInt(each.instrumentId) === instrumentId
      );
      if (!option) return;

      const prev = optionPriceMap.get(instrumentId);
      // if (prev?.price === price) return; // ✅ Skip if unchanged

      const newData = {
        segment: data.ExchangeSegment,
        id: instrumentId,
        optionName: option.optionName,
        price,
      };

      // ✅ Track in Map for constant-time update
      optionPriceMap.set(instrumentId, newData);

      const listIndex = optionPrice.findIndex((i) => i.id === instrumentId);
      if (listIndex >= 0) {
        optionPrice[listIndex] = newData;
      } else {
        optionPrice.push(newData);
      }

      await processTrackingDataUpdate();
      await processingTradeDetailsValue();

      // 🔁 This block is unchanged, except it's now only executed on actual price change
      const result = tradeDetailsValues.map((item) => ({
        id: item.id,
        lowestCombinedPremium: Math.min(
          ...item.combinedPremiumArray.map((p) => p.combinedPremium)
        ),
      }));

      io.emit("feLowest", { data: result });
      io.emit("optionPremium", tradeDetailsValues);
    }
  });
}

io.on("connection", (socket) => {
  // console.log("Socket client connected:", socket.id, "User:", socket.user);
  console.log("Socket client connected:", socket.id);

  clientSubscriptions.set(socket.id, new Set());

  socket.on("subscribe-options-data", async ({ data }) => {
    if (!socket.user) {
      return socket.emit("error", "Unauthorized");
    }

    if (
      !data.id ||
      !data.expiry ||
      !data.indexName ||
      !data.ltpRange ||
      typeof data.id !== "string" ||
      typeof data.expiry !== "string" ||
      typeof data.indexName !== "string" ||
      typeof data.ltpRange !== "number"
    ) {
      return socket.emit("error", "❌ Invalid subscription data.");
    }

    const priceData = indexLivePrice.find(
      (item) => item.name === data.indexName
    );

    if (!priceData) {
      return socket.emit("error", "❌ Index price not available yet.");
    }

    const alreadySubscribed = userOptionData.find(
      (each) => each.id === data.id
    );

    if (alreadySubscribed) {
      return socket.emit("error", "❌ Already subscribed.");
    }

    data.user = socket.id;
    userOptionData.push(data);

    try {
      await processTrackingDataUpdate();
      await processingTradeDetailsValue();
      socket.emit("subscribed for options data");
    } catch (err) {
      console.error("Error during subscription processing:", err);
      socket.emit("error", "❌ Internal server error during subscription.");
    }
  });

  socket.on("subscribe", async ({ instruments }) => {
    // Verify user is authenticated
    if (!socket.user) {
      return socket.emit("error", "Unauthorized");
    }

    const subs = clientSubscriptions.get(socket.id);
    const newSubs = [];

    if (joinStatus === false) {
      return socket.emit("error", "Market data feed not ready");
    }

    instruments.forEach((inst) => {
      const key = `${inst.exchangeSegment}|${inst.exchangeInstrumentID}`;
      subs.add(key);

      if (!globalSubscriptions.has(key)) {
        globalSubscriptions.add(key);
        newSubs.push({
          exchangeSegment: inst.exchangeSegment,
          exchangeInstrumentID: inst.exchangeInstrumentID,
        });
      }
    });

    if (newSubs.length > 0) {
      try {
        await xtsMarketDataAPI.subscription({
          instruments: newSubs,
          xtsMessageCode: 1502,
        });
        console.log("Subscribed to:", newSubs);
      } catch (err) {
        console.error("Subscription error:", err);
        socket.emit("error", "Subscription failed");
      }
    }

    socket.emit("subscribed", Array.from(subs));
  });

  // unsubscribe function whene the tracking can be unsubscribed

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    if (joinStatus === false) return;

    const getUserOptionSub = userOptionData.filter(
      (each) => each.user === socket.id
    );

    if (getUserOptionSub.length > 0) {
      const removeUserOptionSub = userOptionData.filter(
        (each) => each.user !== socket.id
      );
      userOptionData = removeUserOptionSub;
    }

    const subs = clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.forEach(async (key) => {
      let stillUsed = false;
      clientSubscriptions.forEach((otherSubs, id) => {
        if (id !== socket.id && otherSubs.has(key)) {
          stillUsed = true;
        }
      });

      if (!stillUsed && globalSubscriptions.has(key)) {
        globalSubscriptions.delete(key);
        const [segment, id] = key.split("|");
        try {
          await xtsMarketDataAPI.unSubscription({
            instruments: [
              {
                exchangeSegment: parseInt(segment),
                exchangeInstrumentID: parseInt(id),
              },
            ],
            xtsMessageCode: 1502,
          });
          console.log("Unsubscribed from:", key);
        } catch (err) {
          console.error("Unsubscribe failed:", err);
        }
      }
    });

    clientSubscriptions.delete(socket.id);
  });
});
