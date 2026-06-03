"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_UPDATE = "boodschap-dismiss-update";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DISMISS_UPDATE) === "1";
}

export function usePwaUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissUpdate, setDismissUpdate] = useState(false);

  useEffect(() => {
    setDismissUpdate(readDismissed());
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      window.location.reload();
    };

    const checkWaiting = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.ready.then((registration) => {
      checkWaiting(registration);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setUpdateAvailable(true);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker.ready.then((registration) => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    setUpdateAvailable(false);
  }, []);

  const dismissUpdateBanner = useCallback(() => {
    sessionStorage.setItem(DISMISS_UPDATE, "1");
    setDismissUpdate(true);
  }, []);

  const showUpdateBanner = updateAvailable && !dismissUpdate;

  return { showUpdateBanner, applyUpdate, dismissUpdateBanner };
}
