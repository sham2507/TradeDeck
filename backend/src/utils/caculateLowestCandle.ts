import calculateStrikeInterval from "./calculateStrikeInterval";
import { getOHLCData } from "./getOHLCData";
import { OptionDataType } from "../types/fetchIndicesTypes";

interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CombinedResult {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  strike: number;
}

interface OptionCacheEntry {
  prices: Record<number, OHLCData>;
  fetchedAt: number;
}

async function getLowestCombinedOptionData(
  symbol: string,
  expiry: string,
  range: number,
  optionData: OptionDataType[],
  token: string
): Promise<CombinedResult[]> {
  try {
    const optionPriceCache: Record<string, OptionCacheEntry> = {};

    const strikeInterval = await calculateStrikeInterval(
      symbol,
      expiry,
      optionData
    );

    if (strikeInterval === undefined) {
      throw new Error("Failed to calculate strike interval");
    }

    const indexData: OHLCData[] = await getOHLCData(
      symbol,
      token,
      "",
      optionData
    );

    if (!indexData || indexData.length === 0) {
      throw new Error("No index data available for the given symbol");
    }

    const lowestSumArray: CombinedResult[] = [];

    for (const candle of indexData) {
      const { time, close: indexPrice } = candle;

      const nearestStrike =
        Math.round(indexPrice / strikeInterval) * strikeInterval;

      const strikes: number[] = [];
      const halfRangePoints = range / strikeInterval;
      for (let i = -halfRangePoints; i <= halfRangePoints; i++) {
        strikes.push(nearestStrike + i * strikeInterval);
      }

      let lowestSum = Infinity;
      let bestOHLC: {
        open: number;
        high: number;
        low: number;
        close: number;
      } | null = null;
      let bestStrike: number | null = null;

      const pricePromises = strikes.map(async (strike) => {
        const ceOptionName = `${symbol} ${expiry} CE ${strike}`;
        const peOptionName = `${symbol} ${expiry} PE ${strike}`;

        const getOHLC = async (
          optionName: string
        ): Promise<OHLCData | undefined> => {
          const now = Date.now();

          if (!optionPriceCache[optionName]) {
            const ohlcData = await getOHLCData(
              symbol,
              token,
              optionName,
              optionData
            );
            const priceMap: Record<number, OHLCData> = {};
            for (const data of ohlcData) {
              priceMap[data.time] = data;
            }
            optionPriceCache[optionName] = {
              prices: priceMap,
              fetchedAt: Date.now(), // Optional, fetchedAt still can be kept for debugging
            };
          }
          return optionPriceCache[optionName].prices[time];
        };

        const [ceData, peData] = await Promise.all([
          getOHLC(ceOptionName),
          getOHLC(peOptionName),
        ]);

        if (ceData && peData) {
          const combinedOHLC = {
            open: ceData.open + peData.open,
            high: ceData.high + peData.high,
            low: ceData.low + peData.low,
            close: ceData.close + peData.close,
          };

          return { strike, combinedOHLC };
        }

        return undefined;
      });

      const results = await Promise.all(pricePromises);

      for (const res of results) {
        if (res) {
          const { strike, combinedOHLC } = res;
          if (combinedOHLC.close < lowestSum) {
            lowestSum = combinedOHLC.close;
            bestOHLC = combinedOHLC;
            bestStrike = strike;
          }
        }
      }

      if (bestOHLC && bestStrike !== null) {
        lowestSumArray.push({
          time: time,
          open: bestOHLC.open,
          high: bestOHLC.high,
          low: bestOHLC.low,
          close: bestOHLC.close,
          strike: bestStrike,
        });
      }
    }

    if (lowestSumArray.length > 0) {
      const lastTime = lowestSumArray[lowestSumArray.length - 1].time;
      const seconds = new Date(lastTime).getSeconds();

      if (seconds !== 59) {
        lowestSumArray.pop();
      }
    }

    return lowestSumArray;
  } catch (error) {
    console.error("Error fetching or processing data:", error);
    return [];
  }
}

export default getLowestCombinedOptionData;
