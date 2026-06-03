export type StoreId =
  | "ah"
  | "jumbo"
  | "plus"
  | "dirk"
  | "spar"
  | "hoogvliet"
  | "aldi"
  | "lidl"
  | "vomar"
  | "poiesz"
  | "dekamarkt";

export interface StorePrice {
  store: StoreId;
  storeLabel: string;
  priceCents: number;
  currency: "EUR";
  productName: string;
  unitSize?: string;
  url?: string;
  isPromo: boolean;
  oldPriceCents?: number;
  source: "ah" | "checkjebon" | "mock";
  fetchedAt: number;
}

export interface PriceQuote {
  ean: string;
  prices: StorePrice[];
  lowest: StorePrice | null;
  preferred: StorePrice | null;
  preferredPrices: StorePrice[];
  cached: boolean;
  sourceNote?: string;
}
