import { STORE_LABELS } from "./stores";
import type { StorePrice } from "./types";

const AH_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "X-Application": "AHWEBSHOP",
  "User-Agent": "Appie/8.8.2 Model/phone Android/7.0-API24",
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAhToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const res = await fetch(
    "https://api.ah.nl/mobile-auth/v1/auth/token/anonymous",
    {
      method: "POST",
      headers: AH_HEADERS,
      body: JSON.stringify({ clientId: "appie" }),
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 600) * 1000,
  };
  return data.access_token;
}

interface AhProduct {
  title?: string;
  salesUnitSize?: string;
  currentPrice?: number | null;
  priceBeforeBonus?: number | null;
  isBonus?: boolean;
}

function ahPriceCents(p: AhProduct): number | null {
  const price =
    p.currentPrice != null && p.currentPrice > 0
      ? p.currentPrice
      : p.priceBeforeBonus;
  if (price == null || price <= 0) return null;
  return Math.round(price * 100);
}

export async function fetchAhPriceByEan(
  ean: string
): Promise<StorePrice | null> {
  const token = await getAhToken();
  if (!token) return null;

  const res = await fetch(
    `https://api.ah.nl/mobile-services/product/search/v1/gtin/${encodeURIComponent(ean)}`,
    {
      headers: { ...AH_HEADERS, Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return null;

  const p = (await res.json()) as AhProduct;
  const priceCents = ahPriceCents(p);
  if (priceCents == null || !p.title) return null;

  const oldCents =
    p.priceBeforeBonus != null && p.priceBeforeBonus > 0
      ? Math.round(p.priceBeforeBonus * 100)
      : undefined;

  return {
    store: "ah",
    storeLabel: STORE_LABELS.ah,
    priceCents,
    currency: "EUR",
    productName: p.title,
    unitSize: p.salesUnitSize,
    isPromo: Boolean(p.isBonus) || (oldCents != null && oldCents > priceCents),
    oldPriceCents:
      oldCents != null && oldCents > priceCents ? oldCents : undefined,
    source: "ah",
    fetchedAt: Math.floor(Date.now() / 1000),
  };
}
