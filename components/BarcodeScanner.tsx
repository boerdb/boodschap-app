"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  paused?: boolean;
}

export function BarcodeScanner({ onScan, paused }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCode = useRef("");
  const lastAt = useRef(0);

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      if (code === lastCode.current && now - lastAt.current < 2000) return;
      lastCode.current = code;
      lastAt.current = now;
      onScan(code);
    },
    [onScan]
  );

  useEffect(() => {
    if (paused) return;

    let active = true;
    let stream: MediaStream | null = null;
    let detectTimer: ReturnType<typeof setInterval> | null = null;
    let stopZxing: (() => void) | undefined;
    const zxingReader = new BrowserMultiFormatReader();

    async function startNative(video: HTMLVideoElement): Promise<boolean> {
      const BarcodeDetectorCtor = (
        globalThis as unknown as { BarcodeDetector?: typeof BarcodeDetector }
      ).BarcodeDetector;
      if (!BarcodeDetectorCtor) return false;
      const detector = new BarcodeDetectorCtor({
        formats: ["ean_13", "ean_8", "upc_a"],
      });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      detectTimer = setInterval(async () => {
        if (!active || video.readyState < 2) return;
        try {
          const codes = await detector.detect(video);
          const ean = codes.find((c) => c.rawValue)?.rawValue;
          if (ean) handleCode(ean.replace(/\D/g, ""));
        } catch {
          /* skip frame */
        }
      }, 400);
      return true;
    }

    async function startZxing(video: HTMLVideoElement) {
      const controls = await zxingReader.decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          if (!active || !result) return;
          handleCode(result.getText().replace(/\D/g, ""));
        }
      );
      stopZxing = () => controls.stop();
    }

    async function run() {
      const video = videoRef.current;
      if (!video) return;
      setError(null);
      try {
        const nativeOk = await startNative(video);
        if (!nativeOk) await startZxing(video);
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "Camera niet beschikbaar. Geef toestemming of gebruik HTTPS."
          );
        }
      }
    }

    void run();

    return () => {
      active = false;
      if (detectTimer) clearInterval(detectTimer);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      stopZxing?.();
    };
  }, [paused, handleCode]);

  return (
    <div className="scanner-wrap">
      <video ref={videoRef} className="scanner-video" playsInline muted />
      {error && <p className="scanner-error">{error}</p>}
      <p className="scanner-hint">Richt de camera op de barcode</p>
    </div>
  );
}
