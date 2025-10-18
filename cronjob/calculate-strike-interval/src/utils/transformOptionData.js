const transformOptionsData = (optionsData) => {
  const result = {
    indices: [],
    expiry: {},
  };

  const indexSet = new Set();
  optionsData.forEach((option) => {
    indexSet.add(option.indexName.toLowerCase());
  });
  result.indices = Array.from(indexSet).sort();

  optionsData.forEach((option) => {
    const indexKey = option.indexName.toLowerCase();
    result.expiry[indexKey] = result.expiry[indexKey] || [];

    if (!result.expiry[indexKey].includes(option.expiryInWords)) {
      result.expiry[indexKey].push(option.expiryInWords);
      result.expiry[indexKey].sort((a, b) => {
        const dateA = new Date(
          optionsData.find((o) => o.expiryInWords === a)?.expiryInDate || 0
        );
        const dateB = new Date(
          optionsData.find((o) => o.expiryInWords === b)?.expiryInDate || 0
        );
        return dateA.getTime() - dateB.getTime();
      });
    }
  });

  return result;
};

export default transformOptionsData;
