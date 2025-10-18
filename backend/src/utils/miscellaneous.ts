import { OptionDataType } from "../types/fetchIndicesTypes";

export function formatExpiry(expiry: string) {
  const day = expiry.slice(0, 2);
  const month = expiry.slice(2, 5);
  const year = expiry.slice(5);

  const formattedMonth =
    month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
  return day + formattedMonth + year;
}

export function getExchangeId(symbol: string) {
  let segment;
  if (symbol === "BANKEX" || symbol === "SENSEX") {
    segment = 12;
  }
  if (
    symbol === "NIFTY" ||
    symbol === "BANKNIFTY" ||
    symbol === "FINNIFTY" ||
    symbol === "MIDCPNIFTY"
  ) {
    segment = 2;
  }
  if (segment) {
    return segment;
  }
  throw new Error("error get Exchange id");
}

export function getSeries(symbol: string) {
  let series;
  if (symbol === "BANKEX" || symbol === "SENSEX") {
    series = "IO";
  }
  if (
    symbol === "NIFTY" ||
    symbol === "BANKNIFTY" ||
    symbol === "FINNIFTY" ||
    symbol === "MIDCPNIFTY"
  ) {
    series = "OPTIDX";
  }
  if (series) {
    return series;
  }
  throw new Error("error get Exchange id");
}

export function getInstrumentIdByOptionName(
  dataArray: OptionDataType[],
  optionName: string
) {
  const item = dataArray.find((obj) => obj.optionName === optionName);
  return item ? item.instrumentId : 0;
}

export function getTodayStartEnd() {
  const today = new Date();

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Start Date - 7 days before today
  const startDate = new Date();
  startDate.setDate(today.getDate() - 1);

  const startMonth = monthNames[startDate.getMonth()];
  const startDay = String(startDate.getDate()).padStart(2, "0");
  const startYear = startDate.getFullYear();

  const start = `${startMonth} ${startDay} ${startYear} 091500`;

  // End Date - today
  const endMonth = monthNames[today.getMonth()];
  const endDay = String(today.getDate()).padStart(2, "0");
  const endYear = today.getFullYear();

  const end = `${endMonth} ${endDay} ${endYear} 153000`;

  return { start, end };
}
