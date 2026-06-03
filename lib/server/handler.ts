import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { ListItem } from "@/lib/api/types";
import { getPool, hasDatabaseUrl } from "@/lib/db/mysql";
import { normalizeStoreId } from "@/lib/server/prices/stores";
import type { StoreId } from "@/lib/server/prices/types";
import { hasRedisUrl, redisPing } from "@/lib/db/redis";
import {
  getHouseholdPreferredStore,
  getPriceDatasetStatus,
  getProductPrices,
  setHouseholdPreferredStore,
} from "@/lib/server/prices/service";
import * as mock from "./mock-store";

export interface ApiContext {
  path: string;
  method: string;
  searchParams: URLSearchParams;
  body: Record<string, unknown>;
  token: string | null;
}

function rowToItem(row: RowDataPacket): ListItem {
  return {
    id: Number(row.id),
    barcode: row.barcode ?? null,
    name: row.name,
    quantity: Number(row.quantity),
    checked: Boolean(row.checked),
    addedBy: row.addedBy != null ? Number(row.addedBy) : null,
    updatedAt: Number(row.updatedAt),
  };
}

async function dbSession(token: string) {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.user_id AS userId, s.household_id AS householdId,
            u.display_name AS displayName, h.name AS householdName,
            h.preferred_store AS preferredStore
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN households h ON h.id = s.household_id
     WHERE s.token = ? AND s.expires_at > NOW()`,
    [token]
  );
  return rows[0] ?? null;
}

export async function handleApi(ctx: ApiContext): Promise<Response> {
  const proxyBase = process.env.BOODSCHAP_API_BASE?.replace(/\/$/, "");
  if (proxyBase) {
    const url = `${proxyBase}${ctx.path}${ctx.searchParams.toString() ? `?${ctx.searchParams}` : ""}`;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (ctx.token) headers.Authorization = `Bearer ${ctx.token}`;
    const res = await fetch(url, {
      method: ctx.method,
      headers,
      body:
        ctx.method !== "GET" && ctx.method !== "DELETE"
          ? JSON.stringify(ctx.body)
          : undefined,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const useDb = hasDatabaseUrl();
  const { path, method, body, token, searchParams } = ctx;

  if (method === "POST" && path === "/auth/login") {
    const displayName = String(body.displayName ?? "").trim();
    const inviteCode = String(body.inviteCode ?? "").trim().toUpperCase();
    if (!displayName || !inviteCode) {
      return json({ error: "Naam en code zijn verplicht" }, 400);
    }
    if (!useDb) {
      const session = mock.mockLogin(displayName, inviteCode);
      if (!session) return json({ error: "Onbekende huishoudcode" }, 404);
      return json(session);
    }
    const pool = getPool();
    const [hh] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name FROM households WHERE invite_code = ?",
      [inviteCode]
    );
    if (!hh[0]) return json({ error: "Onbekende huishoudcode" }, 404);
    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.display_name AS displayName
       FROM users u
       INNER JOIN household_members hm ON hm.user_id = u.id
       WHERE hm.household_id = ? AND LOWER(u.display_name) = LOWER(?)
       LIMIT 1`,
      [hh[0].id, displayName]
    );
    if (!users[0]) {
      return json(
        { error: "Onbekende gebruiker voor dit huishouden" },
        403
      );
    }
    const userId = Number(users[0].id);
    const resolvedName = String(users[0].displayName);
    const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await pool.execute(
      `INSERT INTO sessions (token, user_id, household_id, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 90 DAY))`,
      [sessionToken, userId, hh[0].id]
    );
    return json({
      token: sessionToken,
      userId,
      displayName: resolvedName,
      householdId: Number(hh[0].id),
      householdName: hh[0].name,
    });
  }

  if (method === "GET" && path === "/auth/me") {
    if (!token) return json({ error: "Niet ingelogd" }, 401);
    if (!useDb) {
      const s = mock.mockSession(token);
      if (!s) return json({ error: "Sessie verlopen" }, 401);
      const { token: _t, ...rest } = s;
      return json({ ...rest, preferredStore: mock.mockPreferredStore() });
    }
    const s = await dbSession(token);
    if (!s) return json({ error: "Sessie verlopen" }, 401);
    return json({
      userId: Number(s.userId),
      displayName: s.displayName,
      householdId: Number(s.householdId),
      householdName: s.householdName,
      preferredStore: s.preferredStore ?? null,
    });
  }

  if (!token) return json({ error: "Niet ingelogd" }, 401);
  const session = useDb
    ? await dbSession(token)
    : mock.mockSession(token);
  if (!session) return json({ error: "Sessie verlopen" }, 401);

  const householdId = Number(
    "householdId" in session ? session.householdId : session.household_id
  );
  const userId = Number("userId" in session ? session.userId : session.user_id);
  const preferredStore = (
    "preferredStore" in session
      ? session.preferredStore
      : "preferred_store" in session
        ? (session as RowDataPacket).preferred_store
        : mock.mockPreferredStore()
  ) as StoreId | null;

  if (method === "GET" && path === "/health/redis") {
    if (!hasRedisUrl()) {
      return json({
        configured: false,
        ok: true,
        message: "REDIS_URL niet gezet; prijzen via MariaDB of bestand",
      });
    }
    const ok = await redisPing();
    return json({
      configured: true,
      ok,
      message: ok ? "Redis bereikbaar" : "Redis niet bereikbaar",
    });
  }

  if (method === "GET" && path === "/prices/dataset") {
    const meta = await getPriceDatasetStatus();
    return json(meta);
  }

  if (method === "GET" && path === "/prices") {
    const ean = String(searchParams.get("ean") ?? "").replace(/\D/g, "");
    const name = searchParams.get("name")?.trim() || undefined;
    const refresh = searchParams.get("refresh") === "1";
    if (ean.length < 8) {
      return json({ error: "Ongeldige barcode" }, 400);
    }
    const quote = await getProductPrices(ean, {
      productName: name,
      preferredStore,
      forceRefresh: refresh,
    });
    return json(quote);
  }

  if (method === "GET" && path === "/settings/preferred-store") {
    return json({ preferredStore });
  }

  if (method === "PATCH" && path === "/settings/preferred-store") {
    const storeRaw = body.store;
    const store =
      storeRaw == null || storeRaw === ""
        ? null
        : normalizeStoreId(String(storeRaw));
    if (storeRaw != null && storeRaw !== "" && !store) {
      return json({ error: "Onbekende winkel" }, 400);
    }
    if (!useDb) {
      mock.mockSetPreferredStore(store);
      return json({ preferredStore: store });
    }
    await setHouseholdPreferredStore(getPool(), householdId, store);
    return json({ preferredStore: store });
  }

  const listMatch = path.match(/^\/lists\/(\d+)\/items$/);
  if (listMatch) {
    const hid = Number(listMatch[1]);
    if (hid !== householdId) return json({ error: "Geen toegang" }, 403);

    if (method === "GET") {
      const since = searchParams.get("updated_since");
      if (!useDb) {
        return json({
          items: mock.mockListItems(
            hid,
            since ? Number(since) : undefined
          ),
        });
      }
      let sql = `SELECT id, barcode, name, quantity, checked, added_by AS addedBy,
                        UNIX_TIMESTAMP(updated_at) AS updatedAt
                 FROM list_items WHERE household_id = ?`;
      const params: (number | string)[] = [hid];
      if (since) {
        sql += " AND updated_at > FROM_UNIXTIME(?)";
        params.push(Number(since));
      }
      sql += " ORDER BY checked ASC, updated_at DESC";
      const pool = getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
      return json({ items: rows.map(rowToItem) });
    }

    if (method === "POST") {
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Naam is verplicht" }, 400);
      const barcode = body.barcode ? String(body.barcode).trim() : undefined;
      const quantity = Number(body.quantity ?? 1) || 1;
      if (!useDb) {
        const item = mock.mockAddItem(hid, userId, { name, barcode, quantity });
        return json({ item }, 201);
      }
      const pool = getPool();
      const [ins] = await pool.execute<ResultSetHeader>(
        `INSERT INTO list_items (household_id, barcode, name, quantity, added_by)
         VALUES (?, ?, ?, ?, ?)`,
        [hid, barcode ?? null, name, quantity, userId]
      );
      const id = ins.insertId;
      return json(
        {
          item: {
            id,
            barcode: barcode ?? null,
            name,
            quantity,
            checked: false,
            addedBy: userId,
            updatedAt: Math.floor(Date.now() / 1000),
          },
        },
        201
      );
    }
  }

  const itemMatch = path.match(/^\/items\/(\d+)$/);
  if (itemMatch) {
    const itemId = Number(itemMatch[1]);
    if (method === "PATCH") {
      const patch: Partial<{ checked: boolean; quantity: number; name: string }> = {};
      if ("checked" in body) patch.checked = Boolean(body.checked);
      if ("quantity" in body) patch.quantity = Number(body.quantity);
      if ("name" in body) patch.name = String(body.name);
      if (!useDb) {
        if (!mock.mockPatchItem(itemId, householdId, patch)) {
          return json({ error: "Item niet gevonden" }, 404);
        }
        return json({ ok: true });
      }
      const pool = getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM list_items WHERE id = ? AND household_id = ?",
        [itemId, householdId]
      );
      if (!rows[0]) return json({ error: "Item niet gevonden" }, 404);
      const sets: string[] = [];
      const params: (string | number)[] = [];
      if (patch.checked !== undefined) {
        sets.push("checked = ?");
        params.push(patch.checked ? 1 : 0);
      }
      if (patch.quantity !== undefined) {
        sets.push("quantity = ?");
        params.push(patch.quantity);
      }
      if (patch.name !== undefined) {
        sets.push("name = ?");
        params.push(patch.name);
      }
      if (sets.length) {
        params.push(itemId);
        await pool.execute(
          `UPDATE list_items SET ${sets.join(", ")} WHERE id = ?`,
          params
        );
      }
      return json({ ok: true });
    }
    if (method === "DELETE") {
      if (!useDb) {
        if (!mock.mockDeleteItem(itemId)) {
          return json({ error: "Item niet gevonden" }, 404);
        }
        return json({ ok: true });
      }
      const pool = getPool();
      const [res] = await pool.execute(
        "DELETE FROM list_items WHERE id = ? AND household_id = ?",
        [itemId, householdId]
      );
      if ((res as { affectedRows: number }).affectedRows === 0) {
        return json({ error: "Item niet gevonden" }, 404);
      }
      return json({ ok: true });
    }
  }

  return json({ error: "Route niet gevonden" }, 404);
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
