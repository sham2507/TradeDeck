interface OptionData {
  instrumentId: string;
  optionName: string;
  indexName: string;
  expiryInWords: string;
  optionType: string;
  optionStrikePrice: string;
  expiryInDate: string;
}

interface TransformedData {
  indices: string[];
  expiry: Record<string, string[]>;
}

const transformOptionsData = (optionsData: OptionData[]): TransformedData => {
  const result: TransformedData = {
    indices: [],
    expiry: {},
  };

  // Get unique indices (lowercase)
  const indexSet = new Set<string>();
  optionsData.forEach((option: OptionData) => {
    indexSet.add(option.indexName.toLowerCase());
  });
  result.indices = Array.from(indexSet).sort();

  // Get unique expiries per index
  optionsData.forEach((option: OptionData) => {
    const indexKey = option.indexName.toLowerCase();
    result.expiry[indexKey] = result.expiry[indexKey] || [];

    if (!result.expiry[indexKey].includes(option.expiryInWords)) {
      result.expiry[indexKey].push(option.expiryInWords);
      // Sort chronologically using expiryInDate
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
