"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import {
  addListItem,
  fetchProductPrices,
  lookupOff,
} from "@/lib/api/client";
import type { PriceQuote, StoreId } from "@/lib/api/types";
import { PriceComparison } from "@/components/prices/PriceComparison";
import { getSession, setSession } from "@/lib/auth/session";
import { enqueueAction } from "@/lib/offline/queue";

export default function ScanPage() {
  const router = useRouter();
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  useEffect(() => {
    const s = getSession();
    setSessionState(s);
    setPreferredStoresState(
      s?.preferredStores?.length
        ? s.preferredStores
        : s?.preferredStore
          ? [s.preferredStore]
          : []
    );
  }, []);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    brand?: string;
    imageUrl?: string;
    barcode: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [preferredStores, setPreferredStoresState] = useState<StoreId[]>([]);

  useEffect(() => {
    if (!getSession()?.token) router.replace("/login");
  }, [router]);

  const onScan = useCallback(
    async (raw: string) => {
      const barcode = raw.replace(/\D/g, "");
      if (barcode.length < 8 || busy) return;
      setBusy(true);
      setPaused(true);
      setStatus("Product opzoeken…");
      try {
        const product = await lookupOff(barcode);
        const p = product ?? { barcode, name: `Product ${barcode}` };
        setPreview(p);
        if (!product) {
          setStatus("Niet in Open Food Facts — pas de naam aan op de lijst.");
        } else {
          setStatus(null);
        }
        setPriceQuote(null);
        setPriceError(null);
        setPriceLoading(true);
        try {
          const {
            getCachedPriceQuote,
            isPriceQuoteFresh,
          } = await import("@/lib/offline/prices");

          if (!navigator.onLine) {
            const cached = await getCachedPriceQuote(barcode);
            if (cached && isPriceQuoteFresh(cached)) {
              setPriceQuote(cached);
            } else {
              setPriceError(
                "Offline — geen opgeslagen prijzen. Eerder online scannen of wachten op Wi‑Fi."
              );
            }
          } else {
            try {
              const quote = await fetchProductPrices(barcode, { name: p.name });
              setPriceQuote(quote);
            } catch (err) {
              const cached = await getCachedPriceQuote(barcode);
              if (cached && isPriceQuoteFresh(cached)) {
                setPriceQuote(cached);
                setPriceError("Live prijzen niet bereikbaar — toont opgeslagen prijzen.");
              } else {
                setPriceError(
                  err instanceof Error ? err.message : "Prijzen laden mislukt"
                );
              }
            }
          }
        } finally {
          setPriceLoading(false);
        }
      } catch {
        setPreview({ barcode, name: `Product ${barcode}` });
        setStatus("OFF niet bereikbaar — standaardnaam gebruikt.");
        setPriceLoading(false);
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  async function addToList() {
    if (!preview || !session) return;
    setBusy(true);
    try {
      await addListItem(session.householdId, {
        name: preview.name,
        barcode: preview.barcode,
      });
      setStatus(`${preview.name} toegevoegd!`);
      setPreview(null);
      setPaused(false);
      setTimeout(() => router.push("/lijst"), 800);
    } catch {
      if (!navigator.onLine) {
        await enqueueAction({
          type: "add",
          householdId: session.householdId,
          payload: {
            name: preview.name,
            barcode: preview.barcode,
          },
        });
        setStatus("Offline opgeslagen — sync bij verbinding.");
        setTimeout(() => router.push("/lijst"), 1200);
      } else {
        setStatus("Toevoegen mislukt.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <p className="empty-state">Laden…</p>;
  }

  return (
    <div>
      <BarcodeScanner onScan={onScan} paused={paused || !!preview} />

      {status && <p className="scanner-hint">{status}</p>}

      {preview && (
        <div style={{ marginTop: "1rem" }}>
          {preview.imageUrl && (
            <Image
              src={preview.imageUrl}
              alt=""
              width={80}
              height={80}
              unoptimized
              style={{ borderRadius: 8, objectFit: "contain" }}
            />
          )}
          <h3 style={{ margin: "0.5rem 0" }}>{preview.name}</h3>
          {preview.brand && (
            <p className="household-badge">{preview.brand}</p>
          )}
          <p className="household-badge">EAN {preview.barcode}</p>
          <PriceComparison
            quote={priceQuote}
            loading={priceLoading}
            error={priceError}
            preferredStores={preferredStores}
            storesEditHref="/lijst"
          />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void addToList()}
            >
              Op lijst
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPreview(null);
                setPaused(false);
                setStatus(null);
                setPriceQuote(null);
                setPriceError(null);
              }}
            >
              Opnieuw scannen
            </button>
          </div>
        </div>
      )}

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/lijst" className="btn btn-secondary">
          Terug naar lijst
        </Link>
      </p>
    </div>
  );
}
