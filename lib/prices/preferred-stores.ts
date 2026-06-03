import type { StoreId } from "@/lib/api/types";
import { STORE_OPTIONS } from "@/lib/prices/store-options";

const VALID = new Set(STORE_OPTIONS.map((o) => o.id));

export const MAX_PREFERRED_STORES = 6;

export function normalizePreferredStores(
  raw: unknown
): StoreId[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim().toLowerCase() as StoreId;
    if (!VALID.has(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_PREFERRED_STORES) break;
  }
  return out;
}

export function parsePreferredStoresJson(
  json: string | Buffer | object | null | undefined,
  legacySingle: string | null | undefined
): StoreId[] {
  if (json != null && json !== "") {
    try {
      const value =
        typeof json === "string" || Buffer.isBuffer(json)
          ? JSON.parse(json.toString())
          : json;
      const parsed = normalizePreferredStores(value);
      if (parsed.length) return parsed;
    } catch {
      /* fall through */
    }
  }
  if (legacySingle?.trim()) {
    const id = legacySingle.trim().toLowerCase() as StoreId;
    if (VALID.has(id)) return [id];
  }
  return [];
}

export function togglePreferredStore(
  current: StoreId[],
  store: StoreId
): StoreId[] {
  if (current.includes(store)) {
    return current.filter((s) => s !== store);
  }
  if (current.length >= MAX_PREFERRED_STORES) return current;
  return [...current, store];
}
