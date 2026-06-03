"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={resolvedTheme === "dark" ? "Licht thema" : "Donker thema"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? (
        <Sun size={20} aria-hidden />
      ) : (
        <Moon size={20} aria-hidden />
      )}
    </button>
  );
}
