import type { Pool } from "mysql2/promise";
import { hasDatabaseUrl, getPool } from "@/lib/db/mysql";
import { fetchAhPriceByEan } from "./ah";
import {
  getDatasetMeta,
  lookupPricesByProductName,
} from "./checkjebon-data";
import { readPriceCache, writePriceCache } from "./cache";
import { mockPricesForEan } from "./mock";
import { STORE_LABELS } from "./stores";
import type { PriceQuote, StoreId, StorePrice } from "./types";

function withLabels(prices: StorePrice[]): StorePrice[] {
  return prices.map((p) => ({
    ...p,
    storeLabel: STORE_LABELS[p.store] ?? p.store,
  }));
}

function mergePrices(existing: StorePrice[], incoming: StorePrice[]): StorePrice[] {
  const map = new Map<StoreId, StorePrice>();
  for (const p of existing) map.set(p.store, p);
  for (const p of incoming) {
    const prev = map.get(p.store);
    if (!prev || p.fetchedAt >= prev.fetchedAt) map.set(p.store, p);
  }
  return [...map.values()].sort((a, b) => a.priceCents - b.priceCents);
}

function buildQuote(
  ean: string,
  prices: StorePrice[],
  cached: boolean,
  preferredStore: StoreId | null,
  sourceNote?: string
): PriceQuote {
  const labeled = withLabels(prices);
  const lowest = labeled[0] ?? null;
  const preferred =
    preferredStore != null
      ? labeled.find((p) => p.store === preferredStore) ?? null
      : null;
  return {
    ean,
    prices: labeled,
    lowest,
    preferred,
    cached,
    sourceNote,
  };
}

async function fetchLivePrices(
  ean: string,
  productName?: string
): Promise<{ prices: StorePrice[]; sourceNote?: string }> {
  let prices: StorePrice[] = [];
  const notes: string[] = [];
  const meta = await getDatasetMeta();

  if (productName) {
    const cjb = await lookupPricesByProductName(productName);
    if (cjb.length) {
      prices = mergePrices(prices, cjb);
      notes.push(
        meta.storage === "redis"
          ? `Checkjebon via Redis .14 (${meta.storeCount ?? "?"} ketens).`
          : meta.storage === "mariadb"
            ? `Checkjebon via MariaDB (${meta.storeCount ?? "?"} ketens).`
            : meta.exists
              ? "Checkjebon (lokaal bestand)."
              : "Geen dataset — run `npm run sync:prices`."
      );
    }
  }

  const ah = await fetchAhPriceByEan(ean);
  if (ah) {
    prices = mergePrices(prices, [ah]);
    notes.push("Albert Heijn via barcode (eigen server, gratis API).");
  }

  if (prices.length) {
    return { prices, sourceNote: notes.join(" ") };
  }

  return {
    prices: mockPricesForEan(ean, productName),
    sourceNote:
      meta.exists
        ? "Geen match in dataset — demo-prijzen."
        : "Dataset ontbreekt. Voer `npm run sync:prices` uit (schrijft naar MariaDB).",
  };
}

export async function getProductPrices(
  ean: string,
  options: {
    productName?: string;
    preferredStore?: StoreId | null;
    forceRefresh?: boolean;
  } = {}
): Promise<PriceQuote> {
  const normalized = ean.replace(/\D/g, "");
  if (normalized.length < 8) {
    return buildQuote(normalized, [], false, options.preferredStore ?? null);
  }

  const useDb = hasDatabaseUrl();
  let cached = false;
  let prices: StorePrice[] = [];

  if (useDb && !options.forceRefresh) {
    const pool = getPool();
    const fromDb = await readPriceCache(pool, normalized);
    if (fromDb?.length) {
      prices = fromDb;
      cached = true;
    }
  }

  if (!prices.length) {
    const live = await fetchLivePrices(normalized, options.productName);
    prices = live.prices;
    if (useDb && prices.length && live.prices[0]?.source !== "mock") {
      await writePriceCache(getPool(), normalized, prices);
    }
    return buildQuote(
      normalized,
      prices,
      false,
      options.preferredStore ?? null,
      live.sourceNote
    );
  }

  if (options.productName && prices.length < 3) {
    const extra = await lookupPricesByProductName(options.productName);
    if (extra.length) {
      prices = mergePrices(prices, extra);
      cached = false;
    }
  }

  return buildQuote(
    normalized,
    prices,
    cached,
    options.preferredStore ?? null,
    cached ? "Prijzen uit MariaDB (price_cache)." : undefined
  );
}

export async function getPriceDatasetStatus() {
  return getDatasetMeta();
}

export async function getHouseholdPreferredStore(
  pool: Pool,
  householdId: number
): Promise<StoreId | null> {
  const [rows] = (await pool.execute(
    "SELECT preferred_store FROM households WHERE id = ?",
    [householdId]
  )) as [{ preferred_store: string | null }[], unknown];
  const raw = rows[0]?.preferred_store;
  if (!raw) return null;
  return raw as StoreId;
}

export async function setHouseholdPreferredStore(
  pool: Pool,
  householdId: number,
  store: StoreId | null
): Promise<void> {
  await pool.execute("UPDATE households SET preferred_store = ? WHERE id = ?", [
    store,
    householdId,
  ]);
}
