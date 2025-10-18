import redisClient from "./utils/initRedis.js";
import transformOptionsData from "./utils/transformOptionData.js";
import calculateStrikeInterval from "./utils/calculateStrikeInterval.js";
import getExpiryTime from "../../option-data-updater/src/utils/getExpiryTime.js";

const main = async () => {
  await redisClient.connect();
  const value = await redisClient.get("optionsData");
  const optionsData = value ? JSON.parse(value) : null;

  if (optionsData === null) throw new Error("no option data");

  const indicesDetails = transformOptionsData(optionsData);

  const result = [];

  for (const indexName of indicesDetails.indices) {
    const expiries = indicesDetails.expiry[indexName];
    for (const expiry of expiries) {
      const strikeInterval = await calculateStrikeInterval(
        indexName.toUpperCase(),
        expiry,
        optionsData
      );

      if (strikeInterval) {
        result.push({
          indexName,
          expiry,
          strikeInterval,
        });
      }
    }
  }
  const ttl = getExpiryTime();
  await redisClient.set("indexStrikeInterval", JSON.stringify(result), {
    EX: ttl,
  });
  redisClient.quit();
};

main();
