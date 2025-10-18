async function getLatestStreamEntry(redisClient) {
  const streamKey = "tradeStream";
  try {
    const result = await redisClient.xRevRange(streamKey, "+", "-", {
      COUNT: 1,
    });

    if (result.length > 0) {
      const entry = result[0];
      const id = entry.id;
      const fields = entry.message;
      return { id, fields };
    }

    return null;
  } catch (err) {
    console.error("Error fetching latest stream entry:", err);
    return null;
  }
}

module.exports = getLatestStreamEntry;
