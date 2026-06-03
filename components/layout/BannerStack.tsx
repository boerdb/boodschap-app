"use client";

import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { usePwaUpdate } from "@/hooks/usePwaUpdate";

export function BannerStack() {
  const {
    showAndroidInstallBanner,
    showIosInstallBanner,
    installApp,
    dismissAndroidBanner,
    dismissIosBanner,
  } = useInstallPrompt();

  const { showUpdateBanner, applyUpdate, dismissUpdateBanner } = usePwaUpdate();

  if (
    !showAndroidInstallBanner &&
    !showIosInstallBanner &&
    !showUpdateBanner
  ) {
    return null;
  }

  return (
    <div className="banner-stack">
      {showAndroidInstallBanner && (
        <div className="platform-banner android-banner">
          <button
            type="button"
            className="banner-close"
            onClick={dismissAndroidBanner}
            aria-label="Verberg installatiebanner"
          >
            <X size={18} />
          </button>
          <div className="banner-copy">
            <strong>Installeer op je telefoon</strong>
            <span>
              Zet Boodschappen op je startscherm voor snelle toegang en offline
              gebruik.
            </span>
          </div>
          <div className="banner-actions">
            <button type="button" onClick={() => void installApp()}>
              <Download size={14} className="banner-btn-icon" aria-hidden />
              Installeer
            </button>
          </div>
        </div>
      )}

      {showIosInstallBanner && (
        <div className="platform-banner ios-banner">
          <button
            type="button"
            className="banner-close"
            onClick={dismissIosBanner}
            aria-label="Verberg installatie-instructie"
          >
            <X size={18} />
          </button>
          <div className="banner-copy">
            <strong>Installeer op iPhone/iPad</strong>
            <span>
              Tik op <em>Deel</em> en kies <em>Zet op beginscherm</em>.
            </span>
          </div>
          <div className="banner-actions" aria-hidden>
            <Share size={22} />
          </div>
        </div>
      )}

      {showUpdateBanner && (
        <div className="platform-banner update-banner">
          <button
            type="button"
            className="banner-close"
            onClick={dismissUpdateBanner}
            aria-label="Verberg updatebanner"
          >
            <X size={18} />
          </button>
          <div className="banner-copy">
            <strong>Nieuwe versie beschikbaar</strong>
            <span>Werk de app bij voor de laatste verbeteringen.</span>
          </div>
          <div className="banner-actions">
            <button type="button" onClick={applyUpdate}>
              Update nu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
