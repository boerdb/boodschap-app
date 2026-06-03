#!/usr/bin/env node
/**
 * Vult price_cache voor bekende barcodes via gratis AH GTIN-API.
 * Cron: 0 6 * * * cd /var/www/boodschap-app && node scripts/sync-ah-eans.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const AH_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "X-Application": "AHWEBSHOP",
  "User-Agent": "Appie/8.8.2 Model/phone Android/7.0-API24",
};

async function ahToken() {
  const res = await fetch(
    "https://api.ah.nl/mobile-auth/v1/auth/token/anonymous",
    {
      method: "POST",
      headers: AH_HEADERS,
      body: JSON.stringify({ clientId: "appie" }),
    }
  );
  if (!res.ok) throw new Error(`AH auth ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function ahGtin(token, ean) {
  const res = await fetch(
    `https://api.ah.nl/mobile-services/product/search/v1/gtin/${ean}`,
    { headers: { ...AH_HEADERS, Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const p = await res.json();
  const price =
    p.currentPrice > 0 ? p.currentPrice : p.priceBeforeBonus;
  if (!price || !p.title) return null;
  return {
    name: p.title,
    unitSize: p.salesUnitSize,
    priceCents: Math.round(price * 100),
    oldPriceCents:
      p.priceBeforeBonus > price
        ? Math.round(p.priceBeforeBonus * 100)
        : null,
    isPromo: Boolean(p.isBonus),
  };
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const env = readFileSync(join(root, ".env.local"), "utf8");
    const m = env.match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* ignore */
  }
  return null;
}

async function main() {
  const url = resolveDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL ontbreekt");
    process.exit(1);
  }

  const pool = mysql.createPool(url);
  const [rows] = await pool.query(
    `SELECT DISTINCT barcode AS ean FROM list_items
     WHERE barcode IS NOT NULL AND LENGTH(barcode) >= 8
     UNION
     SELECT ean FROM product_cache WHERE LENGTH(ean) >= 8
     LIMIT 200`
  );

  const eans = rows.map((r) => String(r.ean).replace(/\D/g, "")).filter(Boolean);
  console.log(`Syncing ${eans.length} barcodes naar AH price_cache…`);

  const token = await ahToken();
  let ok = 0;
  for (const ean of eans) {
    const hit = await ahGtin(token, ean);
    if (!hit) continue;
    await pool.execute(
      `INSERT INTO price_cache
         (ean, store, price_cents, currency, product_name, unit_size, is_promo, old_price_cents, source)
       VALUES (?, 'ah', ?, 'EUR', ?, ?, ?, ?, 'ah')
       ON DUPLICATE KEY UPDATE
         price_cents = VALUES(price_cents),
         product_name = VALUES(product_name),
         unit_size = VALUES(unit_size),
         is_promo = VALUES(is_promo),
         old_price_cents = VALUES(old_price_cents),
         source = 'ah',
         fetched_at = CURRENT_TIMESTAMP`,
      [
        ean,
        hit.priceCents,
        hit.name,
        hit.unitSize ?? null,
        hit.isPromo ? 1 : 0,
        hit.oldPriceCents,
      ]
    );
    ok++;
    await new Promise((r) => setTimeout(r, 250));
  }

  await pool.end();
  console.log(`Klaar: ${ok}/${eans.length} AH-prijzen bijgewerkt.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
