/** Kết quả tìm kiếm master data */
export interface MasterDataSearchResult {
  brands: MasterDataItem[];
  categories: MasterDataItem[];
  notes: MasterDataItem[];
  families: MasterDataItem[];
  attributes: MasterDataItem[];
  products: MasterDataItem[];
}

/** Interface cho item trong master data */
export interface MasterDataItem {
  Id?: string | number;
  Name?: string;
  Value?: string;
}

/** Kết quả mapping từ normalization */
export interface KeywordMapping {
  original: string;
  corrected: string[];
}

/** Kết quả encode từ master data search */
export interface MasterDataSearchOutput {
  brands: MasterDataItem[];
  categories: MasterDataItem[];
  notes: MasterDataItem[];
  families: MasterDataItem[];
  attributes: MasterDataItem[];
  products: MasterDataItem[];
  keywordMappings: KeywordMapping[];
  summaryFoundLabels: {
    brands: string[];
    categories: string[];
    notes: string[];
    families: string[];
    attributes: string[];
    products: string[];
  };
}
