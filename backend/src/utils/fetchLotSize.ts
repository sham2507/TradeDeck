import axios from "axios";
import { formatExpiry, getExchangeId, getSeries } from "./miscellaneous";
import config from "../config/config";

const SYMBOL_MAP: Record<string, string> = {
  bankex: "BANKEX",
  banknifty: "BANKNIFTY",
  finnifty: "FINNIFTY",
  midcpnifty: "MIDCPNIFTY",
  nifty: "NIFTY",
  sensex: "SENSEX",
};

const fetchLotSize = async (
  index: string,
  expiry: string,
  strikePrice: string
) => {
  const symbol = SYMBOL_MAP[index];
  const url = config.marketDataUrl + `/instruments/instrument/optionSymbol`;

  const params = {
    exchangeSegment: getExchangeId(symbol),
    series: getSeries(symbol),
    symbol,
    expiryDate: formatExpiry(expiry),
    optionType: "CE",
    strikePrice,
  };

  try {
    const { data } = await axios.get(url, { params });
    const lotSize = data?.result[0]?.LotSize || "";
    return { optionName: `${index}${expiry}`, lotSize };
  } catch (err: any) {
    throw new Error(err);
  }
};

export default fetchLotSize;
