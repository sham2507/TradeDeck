const calculateStrikeInterval = async (
  indexName,
  expiry,
  indexStrikeInterval
) => {
  try {
    if (!Array.isArray(indexStrikeInterval)) {
      throw new Error("Invalid indexStrikeInterval data");
    }

    const found = indexStrikeInterval.find(
      (entry) =>
        entry.indexName === indexName.toLowerCase() && entry.expiry === expiry
    );

    if (!found) {
      throw new Error(`Strike interval not found for ${indexName} - ${expiry}`);
    }

    return found.strikeInterval;
  } catch (e) {
    console.log(e.message);
    return null;
  }
};

module.exports = calculateStrikeInterval;
