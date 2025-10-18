export default function convertToLightweightCandles(rawData: string) {
  return rawData
    .split(",")
    .filter(Boolean)
    .map((candle) => {
      const parts = candle.split("|");
      return {
        time: parseInt(parts[0], 10), // time in seconds
        open: parseFloat(parts[1]),
        high: parseFloat(parts[2]),
        low: parseFloat(parts[3]),
        close: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
      };
    });
}
