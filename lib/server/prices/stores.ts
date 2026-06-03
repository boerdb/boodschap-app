import type { StoreId } from "./types";

export const STORE_LABELS: Record<StoreId, string> = {
  ah: "Albert Heijn",
  jumbo: "Jumbo",
  plus: "Plus",
  dirk: "Dirk",
  spar: "SPAR",
  hoogvliet: "Hoogvliet",
  aldi: "Aldi",
  lidl: "Lidl",
  vomar: "Vomar",
  poiesz: "Poiesz",
  dekamarkt: "DekaMarkt",
};

const CJB_STORE_NAME_TO_ID: Record<string, StoreId> = {
  ah: "ah",
  "albert heijn": "ah",
  jumbo: "jumbo",
  plus: "plus",
  dirk: "dirk",
  spar: "spar",
  hoogvliet: "hoogvliet",
  aldi: "aldi",
  lidl: "lidl",
  vomar: "vomar",
  poiesz: "poiesz",
  dekamarkt: "dekamarkt",
};

export function normalizeStoreId(raw: string): StoreId | null {
  const key = raw.trim().toLowerCase();
  return CJB_STORE_NAME_TO_ID[key] ?? null;
}

export function parseSupermarketList(
  envValue: string | undefined
): StoreId[] | undefined {
  if (!envValue?.trim()) return undefined;
  const ids = envValue
    .split(",")
    .map((s) => normalizeStoreId(s.trim()))
    .filter((id): id is StoreId => id != null);
  return ids.length ? ids : undefined;
}

export const DEFAULT_COMPARE_STORES: StoreId[] = ["ah", "jumbo", "plus"];
