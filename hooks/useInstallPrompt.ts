"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_ANDROID = "boodschap-dismiss-android-install";
const DISMISS_IOS = "boodschap-dismiss-ios-install";

function readDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(key) === "1";
}

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissAndroid, setDismissAndroid] = useState(false);
  const [dismissIos, setDismissIos] = useState(false);

  useEffect(() => {
    setShowIosHint(shouldShowIosInstallHint());
    setDismissAndroid(readDismissed(DISMISS_ANDROID));
    setDismissIos(readDismissed(DISMISS_IOS));
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }, [installPrompt]);

  const dismissAndroidBanner = useCallback(() => {
    sessionStorage.setItem(DISMISS_ANDROID, "1");
    setDismissAndroid(true);
  }, []);

  const dismissIosBanner = useCallback(() => {
    sessionStorage.setItem(DISMISS_IOS, "1");
    setDismissIos(true);
  }, []);

  const showAndroidInstallBanner = !!installPrompt && !dismissAndroid;
  const showIosInstallBanner =
    showIosHint && !installPrompt && !dismissIos;

  return {
    showAndroidInstallBanner,
    showIosInstallBanner,
    installApp,
    dismissAndroidBanner,
    dismissIosBanner,
  };
}

function shouldShowIosInstallHint(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator;
  const ua = nav.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in nav &&
      Boolean((nav as Navigator & { standalone?: boolean }).standalone));
  return isIOS && !isStandalone;
}
