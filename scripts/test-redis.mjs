/**
 * Redis-verbinding testen (zelfde server/poort als news-app).
 *   npm run test:redis
 *   REDIS_URL=redis://192.168.1.14:6379 node scripts/test-redis.mjs
 */
import { createClient } from "redis";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^REDIS_URL=(.+)$/);
    if (m && !process.env.REDIS_URL) {
      process.env.REDIS_URL = m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.log("REDIS_URL niet gezet (.env.local of omgevingsvariabele)");
  process.exit(1);
}

const safeUrl = url.replace(/:([^:@/]+)@/, ":***@");
console.log("Verbinden met:", safeUrl);

const client = createClient({
  url,
  socket: { connectTimeout: 8_000, reconnectStrategy: false },
});

let lastError = "";
client.on("error", (e) => {
  lastError = e.message;
});

try {
  await client.connect();
  const pong = await client.ping();
  console.log("PING ->", pong);

  const testKey = "boodschap:connection-test";
  await client.set(testKey, JSON.stringify({ at: new Date().toISOString() }));
  const val = await client.get(testKey);
  console.log("SET/GET test ->", val);

  const keys = await client.keys("boodschap:*");
  console.log("Bestaande boodschap keys:", keys.length ? keys : "(nog geen)");

  const payload = await client.get("boodschap:checkjebon:payload");
  const meta = await client.get("boodschap:checkjebon:meta");
  if (payload) {
    console.log(
      `Checkjebon in Redis: payload ${(payload.length / 1e6).toFixed(2)} MB, meta=${meta ?? "(geen)"}`
    );
  } else {
    console.log("Checkjebon nog niet in Redis (draai: npm run sync:prices)");
  }

  await client.quit();
  console.log("\nRedis werkt. Zelfde REDIS_URL als news-app op .14:6379.");
} catch (err) {
  const msg = err.message || lastError;
  console.error("\nVerbinding mislukt:", msg);
  try {
    await client.destroy();
  } catch {
    // ignore
  }
  if (msg.includes("protected mode")) {
    console.log("\nRedis blokkeert externe verbindingen — zie news-app README (SSH-tunnel of bind).");
  }
  process.exit(1);
}
