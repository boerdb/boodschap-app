import { DEFAULT_COMPARE_STORES, STORE_LABELS } from "./stores";
import type { StoreId, StorePrice } from "./types";

function hashEan(ean: string): number {
  let h = 0;
  for (let i = 0; i < ean.length; i++) {
    h = (h * 31 + ean.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function mockPricesForEan(
  ean: string,
  productName?: string
): StorePrice[] {
  const base = 150 + (hashEan(ean) % 450);
  const now = Math.floor(Date.now() / 1000);
  const offsets: Record<StoreId, number> = {
    ah: 0,
    jumbo: 12,
    plus: 8,
    dirk: -5,
    spar: 15,
    hoogvliet: 10,
    aldi: -15,
    lidl: -12,
    vomar: 5,
    poiesz: 3,
    dekamarkt: 7,
  };

  return DEFAULT_COMPARE_STORES.map((store) => {
    const priceCents = base + (offsets[store] ?? 0);
    return {
      store,
      storeLabel: STORE_LABELS[store],
      priceCents,
      currency: "EUR" as const,
      productName: productName ?? `Product ${ean}`,
      source: "mock" as const,
      isPromo: false,
      fetchedAt: now,
    };
  }).sort((a, b) => a.priceCents - b.priceCents);
}
