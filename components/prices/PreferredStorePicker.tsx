"use client";

import type { StoreId } from "@/lib/api/types";
import { STORE_OPTIONS } from "@/lib/prices/store-options";
import { MAX_PREFERRED_STORES } from "@/lib/prices/preferred-stores";

interface PreferredStorePickerProps {
  value: StoreId[];
  onChange: (stores: StoreId[]) => void;
  label?: string;
  compact?: boolean;
}

export function PreferredStorePicker({
  value,
  onChange,
  label = "Voorkeurswinkels",
  compact = false,
}: PreferredStorePickerProps) {
  const atMax = value.length >= MAX_PREFERRED_STORES;

  function toggle(id: StoreId) {
    if (value.includes(id)) {
      onChange(value.filter((s) => s !== id));
      return;
    }
    if (atMax) return;
    onChange([...value, id]);
  }

  const showHeader = Boolean(label);

  return (
    <div className={`preferred-store-pick ${compact ? "preferred-store-pick-compact" : ""}`}>
      {showHeader && (
        <>
          <span className="preferred-store-pick-label">{label}</span>
          <p className="preferred-store-pick-hint">
            Kies tot {MAX_PREFERRED_STORES} winkels — prijzen daar worden gemarkeerd.
          </p>
        </>
      )}
      <div className="preferred-store-chips" role="group" aria-label={label}>
        {STORE_OPTIONS.map((o) => {
          const on = value.includes(o.id);
          const disabled = !on && atMax;
          return (
            <button
              key={o.id}
              type="button"
              className={`preferred-store-chip ${on ? "is-on" : ""}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(o.id)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <button
          type="button"
          className="preferred-store-clear"
          onClick={() => onChange([])}
        >
          Wis voorkeuren
        </button>
      )}
    </div>
  );
}
