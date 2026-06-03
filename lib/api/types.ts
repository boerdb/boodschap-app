export interface ListItem {
  id: number;
  barcode: string | null;
  name: string;
  quantity: number;
  checked: boolean;
  addedBy: number | null;
  updatedAt: number;
}

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
  /** Goedkoopste prijs bij een van je voorkeurswinkels */
  preferred: StorePrice | null;
  /** Alle prijzen bij je voorkeurswinkels */
  preferredPrices: StorePrice[];
  cached: boolean;
  sourceNote?: string;
}

export interface SessionInfo {
  token: string;
  userId: number;
  displayName: string;
  householdId: number;
  householdName: string;
  preferredStores?: StoreId[];
  /** @deprecated eerste voorkeur; gebruik preferredStores */
  preferredStore?: StoreId | null;
}

export interface OffProduct {
  name: string;
  brand?: string;
  imageUrl?: string;
  barcode: string;
}
