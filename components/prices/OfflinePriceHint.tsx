"use client";

import { useEffect, useState } from "react";
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

export function OfflinePriceHint({
  barcode,
  preferredStore,
}: {
  barcode: string;
  preferredStore?: string | null;
}) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const quote = await getCachedPriceQuote(barcode);
      if (cancelled || !quote || !isPriceQuoteFresh(quote)) return;
      const pick =
        (preferredStore
          ? quote.prices.find((p) => p.store === preferredStore)
          : null) ??
        quote.lowest;
      if (pick) {
        setHint(`${formatEuro(pick.priceCents)} · ${pick.storeLabel}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barcode, preferredStore]);

  if (!hint) return null;
  return <div className="list-item-meta">{hint} (offline)</div>;
}
