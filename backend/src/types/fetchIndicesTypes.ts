export interface OptionDataType {
  instrumentId: string;
  optionName: string;
  indexName: string;
  expiryInWords: string;
  optionType: string;
  optionStrikePrice: string;
  expiryInDate: string;
}

export interface IndicesDataType {
  indices: string[];
  expiry: Record<string, string[]>;
}
