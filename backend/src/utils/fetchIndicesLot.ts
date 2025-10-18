import { IndicesDataType, OptionDataType } from "../types/fetchIndicesTypes";
import fetchLotSize from "./fetchLotSize";

const SYMBOL_MAP: Record<string, string> = {
  bankex: "BANKEX",
  banknifty: "BANKNIFTY",
  finnifty: "FINNIFTY",
  midcpnifty: "MIDCPNIFTY",
  nifty: "NIFTY",
  sensex: "SENSEX",
};

const fetchIndicesLotSize = async (
  optionData: OptionDataType[],
  indicesData: IndicesDataType
) => {
  const res_arr = [];
  const lookupMap = new Map();

  for (const opt of optionData) {
    const key = `${opt.indexName.toUpperCase()}-${opt.expiryInWords}`;
    if (!lookupMap.has(key)) {
      lookupMap.set(key, opt.optionStrikePrice);
    }
  }

  for (const index of indicesData.indices) {
    const expiries = indicesData.expiry[index] || [];
    for (const expiry of expiries) {
      const key = `${SYMBOL_MAP[index]}-${expiry}`;
      const strikePrice = lookupMap.get(key);

      if (strikePrice) {
        const res = await fetchLotSize(index, expiry, strikePrice);
        res_arr.push(res);
      } else {
        throw new Error("No matching Option found");
      }
    }
  }

  return res_arr;
};

export default fetchIndicesLotSize;
