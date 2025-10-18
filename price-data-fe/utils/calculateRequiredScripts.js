// calculateRequiredScripts.js
const calculateStrikeInterval = require("./calculateStrikeInterval");

const calculateRequiredScripts = async (
  data,
  indexPrice,
  optionsData,
  indexStrikeInterval
) => {
  try {
    if (!Array.isArray(optionsData) || !Array.isArray(indexPrice)) {
      throw new Error("Invalid input data");
    }

    const priceMap = new Map(indexPrice.map((p) => [p.name, p.price]));
    const intervalCache = new Map();
    const optionsMap = new Map();

    // Build optionsMap with keys like "SENSEX 30OCT2025 CE 76200"
    for (const opt of optionsData) {
      optionsMap.set(opt.optionName, opt);
    }

    const result = [];

    for (const each of data) {
      const currentPrice = priceMap.get(each.indexName);
      if (!currentPrice) continue;

      const intervalKey = `${each.indexName}_${each.expiry}`;
      let strikeInterval = intervalCache.get(intervalKey);
      if (!strikeInterval) {
        strikeInterval = await calculateStrikeInterval(
          each.indexName,
          each.expiry,
          indexStrikeInterval
        );
        intervalCache.set(intervalKey, strikeInterval);
      }

      const currentStrike =
        Math.round(currentPrice / strikeInterval) * strikeInterval;

      const lowerStrikes = [];
      for (let i = 1; i <= 2; i++) {
        const s = currentStrike - i * strikeInterval;
        if (currentPrice - s <= each.ltpRange) {
          lowerStrikes.push(s);
        } else {
          break;
        }
      }

      const upperStrike =
        Math.ceil((currentStrike + each.ltpRange) / strikeInterval) *
        strikeInterval;

      const upperStrikes = [];
      for (
        let s = currentStrike + strikeInterval;
        s <= upperStrike;
        s += strikeInterval
      ) {
        upperStrikes.push(s);
      }

      const allStrikes = [...lowerStrikes, currentStrike, ...upperStrikes];

      for (const strike of allStrikes) {
        const ceKey = `${each.indexName} ${each.expiry} CE ${strike}`;
        const peKey = `${each.indexName} ${each.expiry} PE ${strike}`;

        if (optionsMap.has(ceKey)) result.push(optionsMap.get(ceKey));
        if (optionsMap.has(peKey)) result.push(optionsMap.get(peKey));
      }
    }

    return result;
  } catch (error) {
    console.error("Error in calculateRequiredScripts:", error);
    throw error;
  }
};

module.exports = calculateRequiredScripts;
