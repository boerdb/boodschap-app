"use client";

import type { PriceQuote, StoreId } from "@/lib/api/types";
import { STORE_OPTIONS } from "@/lib/prices/store-options";

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
  preferredStore: StoreId | null;
  onPreferredStoreChange?: (store: StoreId | null) => void;
  compact?: boolean;
}

export function PriceComparison({
  quote,
  loading,
  error,
  preferredStore,
  onPreferredStoreChange,
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

  const { lowest, preferred, prices, sourceNote, cached } = quote;

  return (
    <div className={`price-panel ${compact ? "price-panel-compact" : ""}`}>
      <div className="price-panel-head">
        <strong>Prijzen</strong>
        {lowest && (
          <span className="price-lowest">
            Laagste: {formatEuro(lowest.priceCents)} bij {lowest.storeLabel}
          </span>
        )}
        {preferred && preferred.store !== lowest?.store && (
          <span className="price-preferred">
            Jouw winkel: {formatEuro(preferred.priceCents)} bij{" "}
            {preferred.storeLabel}
          </span>
        )}
      </div>

      {onPreferredStoreChange && (
        <label className="price-store-pick">
          <span>Voorkeurswinkel</span>
          <select
            className="input"
            value={preferredStore ?? ""}
            onChange={(e) =>
              onPreferredStoreChange(
                e.target.value ? (e.target.value as StoreId) : null
              )
            }
          >
            <option value="">Geen voorkeur</option>
            {STORE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="price-store-list">
        {prices.map((p) => (
          <li
            key={p.store}
            className={`price-store-row ${p.store === lowest?.store ? "is-lowest" : ""} ${p.store === preferredStore ? "is-preferred" : ""}`}
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
