import axios from "axios";

import redisClient from "./initRedis.js";
import config from "./config.js";
import getExpiryTime from "./utils/getExpiryTime.js";

import { writeFileSync } from "fs";

const getOptionsData = async () => {
  try {
    const getOptionData = await axios.post(
      config.marketDataUrl + "/instruments/master",
      {
        exchangeSegmentList: ["BSEFO", "NSEFO"],
      }
    );

    const optionLines = getOptionData.data.result.split("\n");

    const optionDataFiltered = optionLines
      .filter((line) => {
        const parts = line.split("|");
        return (
          (parts[3] === "BANKEX" && parts[5] === "IO") ||
          (parts[3] === "SENSEX" && parts[5] === "IO") ||
          (parts[3] === "NIFTY" && parts[5] === "OPTIDX") ||
          (parts[3] === "BANKNIFTY" && parts[5] === "OPTIDX") ||
          (parts[3] === "FINNIFTY" && parts[5] === "OPTIDX") ||
          (parts[3] === "MIDCPNIFTY" && parts[5] === "OPTIDX")
        );
      })
      .map((line) => {
        const parts = line.split("|");
        return {
          instrumentId: parts[1],
          optionName: parts[19],
          indexName: parts[19].split(" ")[0],
          expiryInWords: parts[19].split(" ")[1],
          optionType: parts[19].split(" ")[2],
          optionStrikePrice: parts[19].split(" ")[3],
          expiryInDate: parts[16],
        };
      });

    const ttl = getExpiryTime();
    redisClient.connect().then(async () => {
      await redisClient.set("optionsData", JSON.stringify(optionDataFiltered), {
        EX: ttl,
      });

      await redisClient.quit();
    });
    // const csv =
    //   "instrumentId,optionName,indexName,expiryInWords,optionType,optionStrikePrice,expiryInDate\n" +
    //   optionDataFiltered
    //     .map(
    //       (item) =>
    //         `${item.instrumentId},${item.optionName},${item.indexName},${item.expiryInWords},${item.optionType},${item.optionStrikePrice},${item.expiryInDate}`
    //     )
    //     .join("\n");

    // writeFileSync("filteredOptions.csv", csv, "utf-8");
  } catch (e) {
    console.log(e);
  }
};

const getIndicesData = async () => {
  try {
    const getNseData = await axios.get(
      config.marketDataUrl + "/instruments/indexlist?exchangeSegment=1"
    );
    const NseList = getNseData.data.result.indexList;

    const getBseData = await axios.get(
      config.marketDataUrl + "/instruments/indexlist?exchangeSegment=11"
    );
    const BseList = getBseData.data.result.indexList;

    const NseModified = NseList.map((each) => {
      return {
        indexName: each.split("_")[0],
        exchangeInstrumentId: each.split("_")[1],
      };
    });

    const BseModified = BseList.map((each) => {
      return {
        indexName: each.split("_")[0],
        exchangeInstrumentId: each.split("_")[1],
      };
    });

    const indexData = [...NseModified, ...BseModified];

    const ttl = getExpiryTime();
    redisClient.connect().then(async () => {
      await redisClient.set("IndexData", JSON.stringify(indexData), {
        EX: ttl,
      });
      await redisClient.quit();
    });
  } catch (e) {
    console.log(e);
  }
};

const main = async () => {
  await getOptionsData();
  await getIndicesData();
};

main();

// const csv =
//   "instrumentId,optionName,indexName,expiryInWords,optionType,optionStrikePrice,expiryInDate\n" +
//   optionDataFiltered
//     .map(
//       (item) =>
//         `${item.instrumentId},${item.optionName},${item.indexName},${item.expiryInWords},${item.optionType},${item.optionStrikePrice},${item.expiryInDate}`
//     )
//     .join("\n");

// writeFileSync("filteredOptions.csv", csv, "utf-8");
