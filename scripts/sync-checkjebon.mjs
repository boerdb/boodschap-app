#!/usr/bin/env node
/**
 * Download Checkjebon open data → MariaDB (192.168.1.14) tabel checkjebon_dataset.
 * Optioneel ook lokaal bestand op Next-server als backup.
 *
 * Cron op .32: 0 5 * * * cd /var/www/boodschap-app && node scripts/sync-checkjebon.mjs
 */
import { mkdir, writeFile } from "fs/promises";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { createClient } from "redis";

const SOURCE =
  process.env.CHECKJEBON_DATA_URL ||
  "https://raw.githubusercontent.com/supermarkt/checkjebon/main/data/supermarkets.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
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
  console.log("Downloading Checkjebon dataset…");
  const res = await fetch(SOURCE, {
    headers: { "User-Agent": "BoodschapApp/1.0 (home sync)" },
  });
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid dataset format");
  }

  const byteSize = Buffer.byteLength(text, "utf8");
  const storeCount = parsed.length;
  console.log(
    `Downloaded ${(byteSize / 1_000_000).toFixed(1)} MB, ${storeCount} supermarkets`
  );

  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    console.error("DATABASE_URL ontbreekt — kan niet naar MariaDB schrijven.");
    process.exit(1);
  }

  const pool = mysql.createPool(dbUrl);
  await pool.execute(
    `INSERT INTO checkjebon_dataset (id, payload, source_url, byte_size, store_count)
     VALUES (1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payload = VALUES(payload),
       source_url = VALUES(source_url),
       byte_size = VALUES(byte_size),
       store_count = VALUES(store_count),
       synced_at = CURRENT_TIMESTAMP`,
    [text, SOURCE, byteSize, storeCount]
  );
  await pool.end();
  console.log("Opgeslagen in MariaDB: boodschap.checkjebon_dataset");

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    const syncedAt = Math.floor(Date.now() / 1000);
    await redis.set("boodschap:checkjebon:payload", text);
    await redis.set(
      "boodschap:checkjebon:meta",
      JSON.stringify({
        sourceUrl: SOURCE,
        byteSize,
        storeCount,
        syncedAt,
      })
    );
    await redis.quit();
    console.log("Opgeslagen in Redis: boodschap:checkjebon:*");
  } else {
    console.log("REDIS_URL niet gezet — sla Redis-over over.");
  }

  if (process.env.PRICE_DATA_BACKUP_FILE !== "0") {
    const outDir = process.env.PRICE_DATA_DIR || join(root, "data", "prices");
    await mkdir(outDir, { recursive: true });
    const outFile = join(outDir, "supermarkets.json");
    await writeFile(outFile, text, "utf8");
    await writeFile(
      join(outDir, "meta.json"),
      JSON.stringify(
        { source: SOURCE, syncedAt: new Date().toISOString(), bytes: byteSize },
        null,
        2
      ),
      "utf8"
    );
    console.log(`Backup: ${outFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
