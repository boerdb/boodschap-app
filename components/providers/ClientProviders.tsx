"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { SerwistProvider } from "@/components/providers/SerwistProvider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const inner = (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );

  if (process.env.NODE_ENV === "development") {
    return inner;
  }

  return <SerwistProvider swUrl="/sw.js">{inner}</SerwistProvider>;
}
