const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

var XtsMarketDataAPI = require("../xts/lib/MDRestAPI.js");
var XtsMarketDataWS = require("../xts/lib/MDSocket.js");

const config = require("../config/config.js");
const { secretKey, appKey, url, jwtPass } = config;

let joinStatus = false;

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
    credentials: true,
  },
});

const PORT = 3000;

server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);

let xtsMarketDataAPI = new XtsMarketDataAPI(url);
let xtsMarketDataWS;
let clientSubscriptions = new Map(); // socket.id => Set of "segment|instrumentID"
let globalSubscriptions = new Set();

(async () => {
  try {
    const login = await xtsMarketDataAPI.logIn({ secretKey, appKey });
    if (login.type !== xtsMarketDataAPI.responseTypes.success) {
      throw new Error("Login failed: " + JSON.stringify(login));
    }

    const token = login.result.token;
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
})();

function registerMarketEvents() {
  xtsMarketDataWS.onConnect(() => console.log("XTS WebSocket connected"));
  xtsMarketDataWS.onJoined((data) => {
    (joinStatus = true), console.log("XTS WebSocket joined:", data);
  });
  xtsMarketDataWS.onError((err) => console.error("WS error:", err));
  xtsMarketDataWS.onDisconnect(() =>
    console.warn("XTS WebSocket disconnected")
  );

  xtsMarketDataWS.onMarketDepthEvent((data) => {
    const key = `${data.ExchangeSegment}|${data.ExchangeInstrumentID}`;
    const price = data.Touchline?.LastTradedPrice;

    console.log({
      segment: data.ExchangeSegment,
      id: data.ExchangeInstrumentID,
      price,
    });

    if (!price) return;

    io.sockets.sockets.forEach((socket) => {
      const subs = clientSubscriptions.get(socket.id);
      if (subs?.has(key)) {
        socket.emit("priceUpdate", {
          segment: data.ExchangeSegment,
          id: data.ExchangeInstrumentID,
          price,
        });
      }
    });
  });
}

io.on("connection", (socket) => {
  console.log("Socket client connected:", socket.id);
  clientSubscriptions.set(socket.id, new Set());

  socket.on("subscribe", async ({ instruments }) => {
    const subs = clientSubscriptions.get(socket.id);
    const newSubs = [];

    if (joinStatus === false) return;

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

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
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
            xtsMessageCode: 1503,
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
