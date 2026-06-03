import { get, set } from "idb-keyval";
import type { PriceQuote } from "@/lib/api/types";

const PREFIX = "boodschap_price_";
const META_KEY = "boodschap_price_meta";

function key(ean: string): string {
  return `${PREFIX}${ean.replace(/\D/g, "")}`;
}

export async function cachePriceQuote(
  ean: string,
  quote: PriceQuote
): Promise<void> {
  await set(key(ean), quote);
  await set(META_KEY, { updatedAt: Date.now() });
}

export async function getCachedPriceQuote(
  ean: string
): Promise<PriceQuote | null> {
  return (await get<PriceQuote>(key(ean))) ?? null;
}

/** Offline prijzen ouder dan 7 dagen niet meer tonen */
export function isPriceQuoteFresh(
  quote: PriceQuote,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000
): boolean {
  const newest = quote.prices.reduce(
    (max, p) => Math.max(max, p.fetchedAt * 1000),
    0
  );
  return newest > 0 && Date.now() - newest < maxAgeMs;
}

export async function clearPriceCache(): Promise<void> {
  const { keys, del } = await import("idb-keyval");
  const all = await keys();
  for (const k of all) {
    if (String(k).startsWith(PREFIX) || k === META_KEY) {
      await del(k);
    }
  }
}
