"use client";

import { useState } from "react";
import type { StoreId } from "@/lib/api/types";
import { formatPreferredStoreSummary } from "@/lib/prices/preferred-stores";
import { PreferredStorePicker } from "@/components/prices/PreferredStorePicker";

interface PreferredStoresSectionProps {
  value: StoreId[];
  onChange: (stores: StoreId[]) => void;
  /** Standaard ingeklapt zodat chips niet altijd in beeld zijn */
  defaultOpen?: boolean;
}

export function PreferredStoresSection({
  value,
  onChange,
  defaultOpen = false,
}: PreferredStoresSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const summary = formatPreferredStoreSummary(value);

  return (
    <div className="preferred-stores-section">
      <button
        type="button"
        className="preferred-stores-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="preferred-stores-toggle-label">Voorkeurswinkels</span>
        <span className="preferred-stores-toggle-summary">{summary}</span>
        <span className="preferred-stores-toggle-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="preferred-stores-panel">
          <PreferredStorePicker
            value={value}
            onChange={onChange}
            label=""
          />
        </div>
      )}
    </div>
  );
}
