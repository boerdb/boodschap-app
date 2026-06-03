"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addListItem,
  deleteListItem,
  fetchListItems,
  patchListItem,
  setPreferredStores,
} from "@/lib/api/client";
import type { ListItem, StoreId } from "@/lib/api/types";
import { PreferredStorePicker } from "@/components/prices/PreferredStorePicker";
import { OfflinePriceHint } from "@/components/prices/OfflinePriceHint";
import {
  clearSession,
  getSession,
  setSession,
  type StoredSession,
} from "@/lib/auth/session";
import {
  cacheListItems,
  enqueueAction,
  getCachedListItems,
} from "@/lib/offline/queue";
import { flushOfflineQueue } from "@/lib/offline/sync";

const POLL_MS = 4000;

export default function LijstPage() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [preferredStores, setPreferredStoresState] = useState<StoreId[]>([]);
  const lastSyncRef = useRef(0);
  const householdId = session?.householdId;
  const token = session?.token;

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      router.replace("/login");
      return;
    }
    setSession(s);
    setPreferredStoresState(
      s?.preferredStores?.length
        ? s.preferredStores
        : s?.preferredStore
          ? [s.preferredStore]
          : []
    );
  }, [router]);

  const load = useCallback(
    async (incremental = false) => {
      if (!householdId || !token) return;
      const since = incremental ? lastSyncRef.current : undefined;
      try {
        const { items: fresh } = await fetchListItems(
          householdId,
          since && since > 0 ? since : undefined
        );
        if (incremental && since && since > 0) {
          setItems((prev) => {
            const map = new Map(prev.map((i) => [i.id, i]));
            for (const it of fresh) map.set(it.id, it);
            return Array.from(map.values()).sort(sortItems);
          });
        } else {
          setItems(fresh.sort(sortItems));
        }
        await cacheListItems(
          incremental && since && since > 0
            ? await mergeWithCache(fresh)
            : fresh
        );
        setError(null);
        if (fresh.length > 0) {
          const maxUpdated = Math.max(...fresh.map((i) => i.updatedAt));
          if (maxUpdated > lastSyncRef.current) {
            lastSyncRef.current = maxUpdated;
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Laden mislukt";
        if (
          message.includes("ingelogd") ||
          message.includes("Sessie verlopen")
        ) {
          clearSession();
          router.replace("/login");
          return;
        }
        if (!navigator.onLine) {
          const cached = await getCachedListItems();
          if (cached.length) {
            setItems(cached.sort(sortItems));
            setError(null);
            return;
          }
        }
        setError(message);
      }
    },
    [householdId, token, router]
  );

  useEffect(() => {
    if (!token || !householdId) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await flushOfflineQueue();
        if (!cancelled) await load(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, householdId, load]);

  useEffect(() => {
    if (!token || !householdId) return;
    const id = setInterval(() => {
      if (document.hidden || !navigator.onLine) return;
      void load(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [token, householdId, load]);

  useEffect(() => {
    const onOnline = () => void flushOfflineQueue().then(() => load(false));
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  async function mergeWithCache(incoming: ListItem[]): Promise<ListItem[]> {
    const cached = await getCachedListItems();
    const map = new Map(cached.map((i) => [i.id, i]));
    for (const it of incoming) map.set(it.id, it);
    return Array.from(map.values());
  }

  async function toggleChecked(item: ListItem) {
    if (!session || item.id < 0) return;
    const next = !item.checked;
    setItems((prev) =>
      prev
        .map((i) => (i.id === item.id ? { ...i, checked: next } : i))
        .sort(sortItems)
    );
    try {
      await patchListItem(item.id, { checked: next });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("niet gevonden")) {
        void load(false);
        return;
      }
      if (!navigator.onLine) {
        await enqueueAction({
          type: "patch",
          householdId: session.householdId,
          payload: { itemId: item.id, checked: next },
        });
        return;
      }
      void load(false);
    }
  }

  async function removeItem(item: ListItem) {
    if (!session || item.id < 0) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await deleteListItem(item.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("niet gevonden")) return;
      if (!navigator.onLine) {
        await enqueueAction({
          type: "delete",
          householdId: session.householdId,
          payload: { itemId: item.id },
        });
      } else {
        void load(false);
      }
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const name = manualName.trim();
    if (!name || !session) return;
    setManualName("");
    try {
      const { item } = await addListItem(session.householdId, { name });
      setItems((prev) => [...prev, item].sort(sortItems));
      lastSyncRef.current = Math.max(lastSyncRef.current, item.updatedAt);
      setError(null);
    } catch {
      if (!navigator.onLine) {
        await enqueueAction({
          type: "add",
          householdId: session.householdId,
          payload: { name },
        });
        const temp: ListItem = {
          id: -Date.now(),
          barcode: null,
          name,
          quantity: 1,
          checked: false,
          addedBy: session.userId,
          updatedAt: Math.floor(Date.now() / 1000),
        };
        setItems((prev) => [...prev, temp].sort(sortItems));
      }
    }
  }

  if (!session) {
    return <p className="empty-state">Laden…</p>;
  }

  return (
    <div>
      <p className="household-badge">
        {session.householdName} · {session.displayName}
      </p>
      <div className="lijst-store-pick">
        <PreferredStorePicker
          value={preferredStores}
          onChange={(stores) => {
            setPreferredStoresState(stores);
            void setPreferredStores(stores).then(() => {
              if (session) {
                setSession({
                  ...session,
                  preferredStores: stores,
                  preferredStore: stores[0] ?? null,
                });
              }
            });
          }}
        />
      </div>
      <p className="household-badge">
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
          onClick={() => {
            clearSession();
            router.replace("/login");
          }}
        >
          Uitloggen
        </button>
      </p>

      <form
        onSubmit={addManual}
        className="lijst-add-form"
      >
        <input
          className="input"
          placeholder="Handmatig toevoegen…"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          +
        </button>
      </form>

      {error && !items.length && (
        <p className="scanner-error">{error}</p>
      )}
      {loading && !items.length && !error ? (
        <p className="empty-state">Laden…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">
          Lijst is leeg. Scan een product of voeg handmatig toe.
        </p>
      ) : (
        <ul className="lijst-items">
          {items.map((item) => (
            <li
              key={item.id}
              className={`list-item ${item.checked ? "checked" : ""}`}
            >
              <input
                type="checkbox"
                className="list-item-check"
                checked={item.checked}
                onChange={() => void toggleChecked(item)}
                aria-label={`${item.name} afvinken`}
              />
              <div className="list-item-body">
                <div className="list-item-name">{item.name}</div>
                {item.barcode && (
                  <>
                    <div className="list-item-meta">EAN {item.barcode}</div>
                    <OfflinePriceHint
                      barcode={item.barcode}
                      preferredStores={preferredStores}
                    />
                  </>
                )}
              </div>
              <button
                type="button"
                className="list-item-delete"
                aria-label="Verwijderen"
                onClick={() => void removeItem(item)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sortItems(a: ListItem, b: ListItem): number {
  if (a.checked !== b.checked) return a.checked ? 1 : -1;
  return b.updatedAt - a.updatedAt;
}
