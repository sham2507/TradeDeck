// calculateTradeDetailsValues.js
const calculateStrikeInterval = require("./calculateStrikeInterval");

const calculateRequiredScript = async (
  data,
  indexPrice,
  indexStrikeInterval
) => {
  const priceMap = new Map(indexPrice.map((item) => [item.name, item.price]));
  const currentPrice = priceMap.get(data.indexName);
  if (!currentPrice) return { optionNames: [], requiredStrikes: [] };

  const strikeInterval = await calculateStrikeInterval(
    data.indexName,
    data.expiry,
    indexStrikeInterval
  );

  const currentStrike =
    Math.round(currentPrice / strikeInterval) * strikeInterval;

  const lowerStrikes = [];
  for (let i = 1; i <= 2; i++) {
    const strike = currentStrike - i * strikeInterval;
    if (currentPrice - strike <= data.ltpRange) {
      lowerStrikes.push(strike);
    } else {
      break;
    }
  }

  const upperStrike =
    Math.ceil((currentStrike + data.ltpRange) / strikeInterval) *
    strikeInterval;
  const upperStrikes = [];
  for (
    let strike = currentStrike + strikeInterval;
    strike <= upperStrike;
    strike += strikeInterval
  ) {
    upperStrikes.push(strike);
  }

  const requiredStrikes = [
    ...lowerStrikes,
    currentStrike,
    ...upperStrikes,
  ].sort((a, b) => a - b);

  const optionNames = requiredStrikes.flatMap((strike) => [
    `${data.indexName} ${data.expiry} CE ${strike}`,
    `${data.indexName} ${data.expiry} PE ${strike}`,
  ]);

  return { optionNames, requiredStrikes };
};

const calculateTradeDetailsValues = async (
  tradeDetails,
  indexPrice,
  optionPrice,
  indexStrikeInterval
) => {
  if (!Array.isArray(optionPrice)) {
    throw new Error("❌ optionPrice must be an array");
  }

  const optionPriceMap = new Map(
    optionPrice.map((item) => [item.optionName, item.price])
  );

  const results = await Promise.all(
    tradeDetails.map(async (each) => {
      const { optionNames } = await calculateRequiredScript(
        each,
        indexPrice,
        indexStrikeInterval
      );

      const optionWithPrices = optionNames.map((name) => ({
        name,
        price: optionPriceMap.get(name) ?? null,
      }));

      const ceMap = {};
      const peMap = {};

      for (const item of optionWithPrices) {
        const [index, expiry, type, strike] = item.name.split(" ");
        const key = `${index} ${expiry} ${strike}`;

        if (type === "CE") ceMap[key] = item.price;
        if (type === "PE") peMap[key] = item.price;
      }

      const combinedPremiumArray = [];
      const spreadPremiumArray = [];

      for (const key in ceMap) {
        if (peMap[key] != null) {
          combinedPremiumArray.push({
            name: key,
            combinedPremium: ceMap[key] + peMap[key],
          });
          spreadPremiumArray.push({
            name: key,
            spreadPremium: ceMap[key] - peMap[key],
          });
        }
      }

      return {
        id: each.id,
        combinedPremiumArray,
        spreadPremiumArray,
      };
    })
  );

  return results;
};

module.exports = calculateTradeDetailsValues;
