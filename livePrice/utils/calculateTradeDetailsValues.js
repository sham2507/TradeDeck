const calculateStrikeInterval = require("./calculateStrikeInterval");

const calculateRequiredScript = async (
  data,
  indexPrice,
  indexStrikeInterval
) => {
  // get required indexPrice from index list
  const getCurrentPrice = indexPrice.filter(
    (item) => item.name === data.indexName
  );

  //   stores in variable
  const currentPrice = getCurrentPrice[0].price;

  //   calculate the strike interval based on indexName and expiry
  const strikeInterval = await calculateStrikeInterval(
    data.indexName,
    data.expiry,
    indexStrikeInterval
  );

  // 1. Current strike (nearest rounded interval)
  const currentStrike =
    Math.round(currentPrice / strikeInterval) * strikeInterval;

  // 2. Calculate max possible lower strikes (up to 2)
  const lowerStrikes = [];
  for (let i = 1; i <= 2; i++) {
    const lowerStrike = currentStrike - i * strikeInterval;
    // Only add if within ltpRange
    if (currentPrice - lowerStrike <= data.ltpRange) {
      lowerStrikes.push(lowerStrike);
    } else {
      break; // Stop if beyond ltpRange
    }
  }

  // 3. Upper strikes (up to currentStrike + ltpRange)
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

  const optionNames = [
    ...requiredStrikes.map(
      (opt) => `${data.indexName} ${data.expiry} CE ${opt}`
    ),
    ...requiredStrikes.map(
      (opt) => `${data.indexName} ${data.expiry} PE ${opt}`
    ),
  ];

  return { optionNames, requiredStrikes };
};

const calculateTradeDetailsValues = async (
  tradeDetails,
  indexPrice,
  optionPrice,
  indexStrikeInterval
) => {
  if (!Array.isArray(optionPrice)) {
    throw new Error(
      "❌ optionPrice must be an array, got: " + typeof optionPrice
    );
  }
  const tradeDetailsValues = await Promise.all(
    tradeDetails.map(async (each) => {
      const reqStrikes = await calculateRequiredScript(
        each,
        indexPrice,
        indexStrikeInterval
      );
      const optionWithPrices = reqStrikes.optionNames.map((each) => {
        const matched = optionPrice.find((item) => item.optionName === each);
        return {
          name: each,
          price: matched ? matched.price : null,
        };
      });
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

      for (const key of Object.keys(ceMap)) {
        if (peMap[key] !== undefined) {
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
  return tradeDetailsValues;
};

module.exports = calculateTradeDetailsValues;
