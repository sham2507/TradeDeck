const calculateStrikeInterval = require("./calculateStrikeInterval");

const calculateRequiredScripts = async (
  data,
  indexPrice,
  optionsDatas,
  indexStrikeInterval
) => {
  try {
    if (optionsDatas === null || !optionsDatas) {
      throw new Error("no option data");
    }

    if (indexPrice.length <= 0 || !indexPrice) throw new Error("no index data");

    const requiredScripts = await Promise.all(
      data.map(async (each) => {
        const getCurrentPrice = indexPrice.filter(
          (item) => item.name === each.indexName
        );

        const currentPrice = getCurrentPrice[0].price;

        const strikeInterval = await calculateStrikeInterval(
          each.indexName,
          each.expiry,
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
          if (currentPrice - lowerStrike <= each.ltpRange) {
            lowerStrikes.push(lowerStrike);
          } else {
            break; // Stop if beyond ltpRange
          }
        }

        // 3. Upper strikes (up to currentStrike + ltpRange)
        const upperStrike =
          Math.ceil((currentStrike + each.ltpRange) / strikeInterval) *
          strikeInterval;
        const upperStrikes = [];
        for (
          let strike = currentStrike + strikeInterval;
          strike <= upperStrike;
          strike += strikeInterval
        ) {
          upperStrikes.push(strike);
        }

        // 4. Combine all strikes
        const requiredStrikes = [
          ...lowerStrikes,
          currentStrike,
          ...upperStrikes,
        ].sort((a, b) => a - b);

        // console.log(`Current Price: ${currentPrice}`);
        // console.log(`Strike Interval: ${strikeInterval}`);
        // console.log(`LTP Range: ${each.ltpRange}`);
        // console.log(`Required Strikes: ${requiredStrikes.join(", ")}`);

        const optionNames = [
          ...requiredStrikes.map(
            (opt) => `${each.indexName} ${each.expiry} CE ${opt}`
          ),
          ...requiredStrikes.map(
            (opt) => `${each.indexName} ${each.expiry} PE ${opt}`
          ),
        ];

        return optionsDatas.filter((option) =>
          optionNames.includes(option.optionName)
        );

        // return {
        //   id: each.id,
        //   indexName: each.indexName,
        //   expiry: each.expiry,
        //   ltpRange: each.ltpRange,
        //   currentPrice,
        //   strikeInterval,
        //   currentStrike,
        //   ltpRange: each.ltpRange,
        //   requiredStrikes,
        //   lowerStrikeCount: lowerStrikes.length,
        //   upperStrikeCount: upperStrikes.length,
        // };
      })
    );
    return requiredScripts.flat();
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

module.exports = calculateRequiredScripts;
