"use client";

import type { PriceQuote, StoreId } from "@/lib/api/types";
import { PreferredStorePicker } from "@/components/prices/PreferredStorePicker";

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

interface PriceComparisonProps {
  quote: PriceQuote | null;
  loading?: boolean;
  error?: string | null;
  preferredStores: StoreId[];
  onPreferredStoresChange?: (stores: StoreId[]) => void;
  compact?: boolean;
}

export function PriceComparison({
  quote,
  loading,
  error,
  preferredStores,
  onPreferredStoresChange,
  compact = false,
}: PriceComparisonProps) {
  if (loading) {
    return <p className="price-panel-hint">Prijzen ophalen… (kan even duren)</p>;
  }
  if (error) {
    return <p className="price-panel-error">{error}</p>;
  }
  if (!quote?.prices.length) {
    return null;
  }

  const { lowest, preferred, preferredPrices, prices, sourceNote, cached } =
    quote;
  const preferredSet = new Set(preferredStores);

  return (
    <div className={`price-panel ${compact ? "price-panel-compact" : ""}`}>
      <div className="price-panel-head">
        <strong>Prijzen</strong>
        {lowest && (
          <span className="price-lowest">
            Laagste: {formatEuro(lowest.priceCents)} bij {lowest.storeLabel}
          </span>
        )}
        {preferred &&
          preferred.store !== lowest?.store &&
          preferredStores.length === 1 && (
            <span className="price-preferred">
              Jouw winkel: {formatEuro(preferred.priceCents)} bij{" "}
              {preferred.storeLabel}
            </span>
          )}
        {preferredPrices.length > 1 && (
          <span className="price-preferred">
            Jouw winkels:{" "}
            {preferredPrices
              .map((p) => `${p.storeLabel} ${formatEuro(p.priceCents)}`)
              .join(" · ")}
          </span>
        )}
      </div>

      {onPreferredStoresChange && (
        <PreferredStorePicker
          value={preferredStores}
          onChange={onPreferredStoresChange}
          compact={compact}
        />
      )}

      <ul className="price-store-list">
        {prices.map((p) => (
          <li
            key={p.store}
            className={`price-store-row ${p.store === lowest?.store ? "is-lowest" : ""} ${preferredSet.has(p.store) ? "is-preferred" : ""}`}
          >
            <span className="price-store-name">{p.storeLabel}</span>
            <span className="price-store-amount">
              {formatEuro(p.priceCents)}
              {p.isPromo && p.oldPriceCents != null && (
                <span className="price-old">
                  {" "}
                  {formatEuro(p.oldPriceCents)}
                </span>
              )}
            </span>
            {p.unitSize && (
              <span className="price-store-unit">{p.unitSize}</span>
            )}
          </li>
        ))}
      </ul>

      {(sourceNote || cached) && (
        <p className="price-panel-meta">
          {cached ? "Uit cache · " : ""}
          {sourceNote}
        </p>
      )}
    </div>
  );
}
