const { ThreadWorker } = require("poolifier");
const calculateRequiredScripts = require("./calculateRequiredScripts");
const calculateTradeDetailsValues = require("./calculateTradeDetailsValues");

module.exports = new ThreadWorker({
  taskFunction: async ({ method, args }) => {
    switch (method) {
      case "calculateRequiredScripts":
        return await calculateRequiredScripts(
          args.data,
          args.indexPrice,
          args.optionsData,
          args.indexStrikeInterval
        );
      case "calculateTradeDetailsValues":
        return await calculateTradeDetailsValues(
          args.latestTradeData,
          args.indexLivePrice,
          args.optionPrice,
          args.indexStrikeInterval
        );
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  },
});
