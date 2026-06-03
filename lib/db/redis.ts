import { createClient, type RedisClientType } from "redis";

const REDIS_PAYLOAD_KEY = "boodschap:checkjebon:payload";
const REDIS_META_KEY = "boodschap:checkjebon:meta";

export { REDIS_PAYLOAD_KEY, REDIS_META_KEY };

const globalForRedis = globalThis as typeof globalThis & {
  __boodschapRedis?: RedisClientType;
  __boodschapRedisConnecting?: Promise<RedisClientType | null>;
};

export function hasRedisUrl(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/** Zelfde patroon als news-app (`lib/redis.ts`). */
export async function redisPing(): Promise<boolean> {
  if (!hasRedisUrl()) return false;
  try {
    const redis = await getRedis();
    if (!redis) return false;
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}

export async function getRedis(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (globalForRedis.__boodschapRedis?.isOpen) {
    return globalForRedis.__boodschapRedis;
  }

  if (!globalForRedis.__boodschapRedisConnecting) {
    globalForRedis.__boodschapRedisConnecting = (async () => {
      const client = createClient({ url });
      client.on("error", (err) => {
        console.error("[redis]", err.message);
      });
      try {
        await client.connect();
        globalForRedis.__boodschapRedis = client;
        return client;
      } catch (err) {
        console.error("[redis] connect failed", err);
        return null;
      } finally {
        globalForRedis.__boodschapRedisConnecting = undefined;
      }
    })();
  }

  return globalForRedis.__boodschapRedisConnecting;
}

export interface CheckjebonRedisMeta {
  sourceUrl: string;
  byteSize: number;
  storeCount: number;
  syncedAt: number;
}

export async function writeCheckjebonToRedis(
  payload: string,
  meta: CheckjebonRedisMeta
): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  await redis.set(REDIS_PAYLOAD_KEY, payload);
  await redis.set(REDIS_META_KEY, JSON.stringify(meta));
  return true;
}

export async function readCheckjebonFromRedis(): Promise<{
  payload: string;
  meta: CheckjebonRedisMeta;
} | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const [payload, metaRaw] = await Promise.all([
    redis.get(REDIS_PAYLOAD_KEY),
    redis.get(REDIS_META_KEY),
  ]);
  if (!payload || !metaRaw) return null;
  try {
    const meta = JSON.parse(metaRaw) as CheckjebonRedisMeta;
    return { payload, meta };
  } catch {
    return null;
  }
}

export async function getCheckjebonRedisMeta(): Promise<CheckjebonRedisMeta | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const metaRaw = await redis.get(REDIS_META_KEY);
  if (!metaRaw) return null;
  try {
    return JSON.parse(metaRaw) as CheckjebonRedisMeta;
  } catch {
    return null;
  }
}
