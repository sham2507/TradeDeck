import { OptionDataType } from "../types/fetchIndicesTypes";

const calculateStrikeInterval = async (
  indexName: string,
  expiry: string,
  optionsDatas: OptionDataType[]
) => {
  try {
    if (!optionsDatas || !Array.isArray(optionsDatas)) {
      throw new Error(
        "Invalid or missing optionsDatas in calculateStrikeInterval"
      );
    }

    const optionsData = optionsDatas.filter(
      (opt) => opt.indexName === indexName && opt.expiryInWords === expiry
    );

    const strikes = [
      ...new Set(optionsData.map((opt) => Number(opt.optionStrikePrice))),
    ].sort((a, b) => a - b);

    const intervals = [];
    for (let i = 1; i < strikes.length; i++) {
      const interval = strikes[i] - strikes[i - 1];
      if (interval > 0) intervals.push(interval);
    }

    if (intervals.length === 0) {
      throw new Error(`No valid intervals found for ${indexName}-${expiry}`);
    }

    const minInterval = Math.min(...intervals);
    const validIntervals = intervals.filter((int) => int % minInterval === 0);

    if (validIntervals.length !== intervals.length) {
      console.warn(`Mixed intervals detected for ${indexName}:`, [
        ...new Set(intervals),
      ]);
    }

    return minInterval;
  } catch (e) {
    console.log(e);
  }
};

export default calculateStrikeInterval;
