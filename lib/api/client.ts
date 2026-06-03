import type {
  ListItem,
  OffProduct,
  PriceQuote,
  SessionInfo,
  StoreId,
} from "./types";
import { getAuthHeaders } from "@/lib/auth/session";

const API_BASE = "/api/boodschap";

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `Fout ${res.status}`
    );
  }
  return data as T;
}

export async function login(
  displayName: string,
  inviteCode: string
): Promise<SessionInfo> {
  return apiFetch<SessionInfo>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ displayName, inviteCode }),
  });
}

export async function fetchMe(): Promise<Omit<SessionInfo, "token">> {
  return apiFetch("/auth/me");
}

export async function fetchListItems(
  householdId: number,
  updatedSince?: number
): Promise<{ items: ListItem[] }> {
  const q =
    updatedSince != null ? `?updated_since=${updatedSince}` : "";
  return apiFetch(`/lists/${householdId}/items${q}`);
}

export async function addListItem(
  householdId: number,
  payload: { name: string; barcode?: string; quantity?: number }
): Promise<{ item: ListItem }> {
  return apiFetch(`/lists/${householdId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchListItem(
  itemId: number,
  payload: Partial<{ checked: boolean; quantity: number; name: string }>
): Promise<void> {
  await apiFetch(`/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteListItem(itemId: number): Promise<void> {
  await apiFetch(`/items/${itemId}`, { method: "DELETE" });
}

export async function fetchProductPrices(
  ean: string,
  options?: { name?: string; refresh?: boolean }
): Promise<PriceQuote> {
  const params = new URLSearchParams({ ean });
  if (options?.name) params.set("name", options.name);
  if (options?.refresh) params.set("refresh", "1");
  const quote = await apiFetch<PriceQuote>(`/prices?${params}`);
  if (typeof window !== "undefined" && navigator.onLine) {
    const { cachePriceQuote } = await import("@/lib/offline/prices");
    await cachePriceQuote(ean, quote);
  }
  return quote;
}

export async function fetchPriceDatasetMeta(): Promise<{
  storage: "redis" | "mariadb" | "file" | "none";
  location: string;
  exists: boolean;
  updatedAt: number | null;
  sizeBytes: number | null;
  storeCount: number | null;
}> {
  return apiFetch("/prices/dataset");
}

export async function fetchPreferredStore(): Promise<{
  preferredStore: StoreId | null;
}> {
  return apiFetch("/settings/preferred-store");
}

export async function setPreferredStore(
  store: StoreId | null
): Promise<{ preferredStore: StoreId | null }> {
  return apiFetch("/settings/preferred-store", {
    method: "PATCH",
    body: JSON.stringify({ store }),
  });
}

export async function lookupOff(barcode: string): Promise<OffProduct | null> {
  const fields = "product_name,brands,image_front_url,code";
  const url = `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=${fields}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "BoodschapApp/1.0 (personal use)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const product = data?.product;
  if (!product?.product_name) return null;
  return {
    barcode,
    name: product.product_name as string,
    brand: product.brands as string | undefined,
    imageUrl: product.image_front_url as string | undefined,
  };
}
