"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, ScanBarcode } from "lucide-react";
import { BannerStack } from "./BannerStack";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/login";

  return (
    <div className="app-shell">
      <BannerStack />
      <header className="app-header">
        <h1 className="app-header-title">Boodschappen</h1>
        <ThemeToggle />
      </header>
      <main className="app-main">{children}</main>
      {!hideNav && (
        <nav className="app-nav" aria-label="Hoofdnavigatie">
          <Link
            href="/lijst"
            className={`app-nav-link ${pathname === "/lijst" ? "active" : ""}`}
          >
            <List size={22} aria-hidden />
            <span>Lijst</span>
          </Link>
          <Link
            href="/scan"
            className={`app-nav-link ${pathname === "/scan" ? "active" : ""}`}
          >
            <ScanBarcode size={22} aria-hidden />
            <span>Scan</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
