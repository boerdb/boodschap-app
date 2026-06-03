import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import type { StoreId, StorePrice } from "./types";

const TTL_HOURS = Number(process.env.PRICE_CACHE_TTL_HOURS ?? 24) || 24;

export async function readPriceCache(
  pool: Pool,
  ean: string
): Promise<StorePrice[] | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT store, price_cents AS priceCents, currency, product_name AS productName,
            unit_size AS unitSize, url, is_promo AS isPromo, old_price_cents AS oldPriceCents,
            source, UNIX_TIMESTAMP(fetched_at) AS fetchedAt
     FROM price_cache
     WHERE ean = ? AND fetched_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [ean, TTL_HOURS]
  );
  if (!rows.length) return null;
  return rows.map((r) => ({
    store: r.store as StoreId,
    storeLabel: "",
    priceCents: Number(r.priceCents),
    currency: "EUR",
    productName: String(r.productName ?? ""),
    unitSize: r.unitSize ? String(r.unitSize) : undefined,
    url: r.url ? String(r.url) : undefined,
    isPromo: Boolean(r.isPromo),
    oldPriceCents:
      r.oldPriceCents != null ? Number(r.oldPriceCents) : undefined,
    source: r.source as StorePrice["source"],
    fetchedAt: Number(r.fetchedAt),
  }));
}

export async function writePriceCache(
  pool: Pool,
  ean: string,
  prices: StorePrice[]
): Promise<void> {
  for (const p of prices) {
    await pool.execute(
      `INSERT INTO price_cache
         (ean, store, price_cents, currency, product_name, unit_size, url, is_promo, old_price_cents, source)
       VALUES (?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         price_cents = VALUES(price_cents),
         product_name = VALUES(product_name),
         unit_size = VALUES(unit_size),
         url = VALUES(url),
         is_promo = VALUES(is_promo),
         old_price_cents = VALUES(old_price_cents),
         source = VALUES(source),
         fetched_at = CURRENT_TIMESTAMP`,
      [
        ean,
        p.store,
        p.priceCents,
        p.productName,
        p.unitSize ?? null,
        p.url ?? null,
        p.isPromo ? 1 : 0,
        p.oldPriceCents ?? null,
        p.source,
      ]
    );
  }
}
