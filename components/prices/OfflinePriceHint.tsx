"use client";

import { useEffect, useState } from "react";
import type { StoreId } from "@/lib/api/types";
import {
  getCachedPriceQuote,
  isPriceQuoteFresh,
} from "@/lib/offline/prices";

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function pickDisplayPrice(
  prices: { store: string; storeLabel: string; priceCents: number }[],
  lowest: { storeLabel: string; priceCents: number } | null,
  preferredStores: StoreId[]
) {
  const preferredSet = new Set(preferredStores);
  const fromPreferred = prices.filter((p) =>
    preferredSet.has(p.store as StoreId)
  );
  if (fromPreferred.length) {
    const best = fromPreferred.reduce((a, b) =>
      a.priceCents <= b.priceCents ? a : b
    );
    return best;
  }
  return lowest;
}

export function OfflinePriceHint({
  barcode,
  preferredStores = [],
}: {
  barcode: string;
  preferredStores?: StoreId[];
}) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const quote = await getCachedPriceQuote(barcode);
      if (cancelled || !quote || !isPriceQuoteFresh(quote)) return;
      const pick = pickDisplayPrice(
        quote.prices,
        quote.lowest,
        preferredStores
      );
      if (pick) {
        setHint(`${formatEuro(pick.priceCents)} · ${pick.storeLabel}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barcode, preferredStores]);

  if (!hint) return null;
  return <div className="list-item-meta">{hint} (offline)</div>;
}
