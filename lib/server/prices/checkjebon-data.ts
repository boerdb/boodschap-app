import { readFile, stat } from "fs/promises";
import path from "path";
import type { RowDataPacket } from "mysql2";
import { getPool, hasDatabaseUrl } from "@/lib/db/mysql";
import {
  getCheckjebonRedisMeta,
  hasRedisUrl,
  readCheckjebonFromRedis,
} from "@/lib/db/redis";
import { normalizeStoreId } from "./stores";
import type { StoreId, StorePrice } from "./types";

interface CjbProduct {
  n: string;
  l?: string;
  p: number;
  s?: string;
}

interface CjbSupermarket {
  n: string;
  d: CjbProduct[];
}

let loadedAt = 0;
let dataset: CjbSupermarket[] | null = null;
let cacheSource: "redis" | "mariadb" | "file" | null = null;
let cacheSyncedAt = 0;
let fileMtime = 0;

export function getCheckjebonFilePath(): string {
  return (
    process.env.PRICE_DATA_PATH?.trim() ||
    path.join(process.cwd(), "data", "prices", "supermarkets.json")
  );
}

function applyParsed(
  parsed: CjbSupermarket[],
  source: "redis" | "mariadb" | "file",
  syncedAt: number
): CjbSupermarket[] | null {
  dataset = Array.isArray(parsed) ? parsed : null;
  cacheSource = source;
  cacheSyncedAt = syncedAt;
  loadedAt = Date.now();
  return dataset;
}

async function loadFromRedis(): Promise<CjbSupermarket[] | null> {
  if (!hasRedisUrl()) return null;
  const hit = await readCheckjebonFromRedis();
  if (!hit) return null;

  const syncedAt = hit.meta.syncedAt;
  if (
    dataset &&
    cacheSource === "redis" &&
    cacheSyncedAt === syncedAt &&
    Date.now() - loadedAt < 60_000
  ) {
    return dataset;
  }

  const parsed = JSON.parse(hit.payload) as CjbSupermarket[];
  return applyParsed(parsed, "redis", syncedAt);
}

async function loadFromMariaDb(): Promise<CjbSupermarket[] | null> {
  if (!hasDatabaseUrl()) return null;
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT payload, byte_size AS byteSize, store_count AS storeCount,
            UNIX_TIMESTAMP(synced_at) AS syncedAt
     FROM checkjebon_dataset WHERE id = 1`
  );
  const row = rows[0];
  if (!row?.payload) return null;

  const syncedAt = Number(row.syncedAt);
  if (
    dataset &&
    cacheSource === "mariadb" &&
    cacheSyncedAt === syncedAt &&
    Date.now() - loadedAt < 60_000
  ) {
    return dataset;
  }

  const parsed = JSON.parse(String(row.payload)) as CjbSupermarket[];
  return applyParsed(parsed, "mariadb", syncedAt);
}

async function loadFromFile(): Promise<CjbSupermarket[] | null> {
  const filePath = getCheckjebonFilePath();
  try {
    const st = await stat(filePath);
    if (
      dataset &&
      cacheSource === "file" &&
      fileMtime === st.mtimeMs &&
      Date.now() - loadedAt < 60_000
    ) {
      return dataset;
    }
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CjbSupermarket[];
    fileMtime = st.mtimeMs;
    return applyParsed(parsed, "file", Math.floor(st.mtimeMs / 1000));
  } catch {
    return null;
  }
}

async function loadDataset(): Promise<CjbSupermarket[] | null> {
  const fromRedis = await loadFromRedis();
  if (fromRedis?.length) return fromRedis;
  const fromDb = await loadFromMariaDb();
  if (fromDb?.length) return fromDb;
  return loadFromFile();
}

export async function getDatasetMeta(): Promise<{
  storage: "redis" | "mariadb" | "file" | "none";
  location: string;
  exists: boolean;
  updatedAt: number | null;
  sizeBytes: number | null;
  storeCount: number | null;
}> {
  if (hasRedisUrl()) {
    const meta = await getCheckjebonRedisMeta();
    if (meta) {
      return {
        storage: "redis",
        location: "Redis 192.168.1.14 (boodschap:checkjebon:*)",
        exists: true,
        updatedAt: meta.syncedAt,
        sizeBytes: meta.byteSize,
        storeCount: meta.storeCount,
      };
    }
  }

  if (hasDatabaseUrl()) {
    try {
      const pool = getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT byte_size AS byteSize, store_count AS storeCount,
                UNIX_TIMESTAMP(synced_at) AS syncedAt, source_url AS sourceUrl
         FROM checkjebon_dataset WHERE id = 1`
      );
      const row = rows[0];
      if (row) {
        return {
          storage: "mariadb",
          location: "MariaDB boodschap.checkjebon_dataset",
          exists: true,
          updatedAt: Number(row.syncedAt) || null,
          sizeBytes: Number(row.byteSize) || null,
          storeCount: row.storeCount != null ? Number(row.storeCount) : null,
        };
      }
    } catch {
      /* fall through */
    }
  }

  const filePath = getCheckjebonFilePath();
  try {
    const st = await stat(filePath);
    const data = await loadFromFile();
    return {
      storage: "file",
      location: filePath,
      exists: true,
      updatedAt: Math.floor(st.mtimeMs / 1000),
      sizeBytes: st.size,
      storeCount: data?.length ?? null,
    };
  } catch {
    return {
      storage: "none",
      location: hasDatabaseUrl()
        ? "MariaDB checkjebon_dataset (leeg) — run sync:prices"
        : filePath,
      exists: false,
      updatedAt: null,
      sizeBytes: null,
      storeCount: null,
    };
  }
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyScore(query: string, productName: string): number {
  const q = normalizeQuery(query);
  const p = normalizeQuery(productName);
  if (!q || !p) return -1;
  let qi = 0;
  for (let i = 0; i < p.length && qi < q.length; i++) {
    if (p[i] === q[qi]) qi++;
  }
  if (qi !== q.length) return -1;
  return q.length * 10 - Math.abs(p.length - q.length);
}

function storeUrl(store: StoreId, link?: string): string | undefined {
  if (!link) return undefined;
  if (link.startsWith("http")) return link;
  if (store === "ah") return `https://www.ah.nl/producten/product/${link}`;
  if (store === "jumbo") return `https://www.jumbo.com/producten/${link}`;
  return undefined;
}

export async function lookupPricesByProductName(
  productName: string
): Promise<StorePrice[]> {
  const data = await loadDataset();
  if (!data?.length || !productName.trim()) return [];

  const now = Math.floor(Date.now() / 1000);
  const results: StorePrice[] = [];

  for (const market of data) {
    const store = normalizeStoreId(market.n);
    if (!store || !market.d?.length) continue;

    let best: { product: CjbProduct; score: number } | null = null;
    for (const product of market.d) {
      const score = fuzzyScore(productName, product.n);
      if (score < 0) continue;
      if (!best || score > best.score) {
        best = { product, score };
      }
    }

    if (!best || best.product.p <= 0) continue;

    results.push({
      store,
      storeLabel: "",
      priceCents: Math.round(best.product.p * 100),
      currency: "EUR",
      productName: best.product.n,
      unitSize: best.product.s,
      url: storeUrl(store, best.product.l),
      isPromo: false,
      source: "checkjebon",
      fetchedAt: now,
    });
  }

  return results.sort((a, b) => a.priceCents - b.priceCents);
}

/** Invalideer in-memory cache na sync */
export function invalidateCheckjebonCache(): void {
  dataset = null;
  loadedAt = 0;
  cacheSource = null;
}
