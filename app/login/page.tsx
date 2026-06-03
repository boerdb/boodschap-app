"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { login } from "@/lib/api/client";
import { clearOfflineData } from "@/lib/offline/queue";
import { getSession, setSession } from "@/lib/auth/session";

const HOUSEHOLD_CODE = "THUIS";
const MEMBERS = ["Ben", "Ineke"] as const;

export default function LoginPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getSession();
    if (existing?.token) router.replace("/lijst");
    else if (existing?.displayName) setDisplayName(existing.displayName);
  }, [router]);

  async function doLogin(name: string) {
    setError(null);
    setLoading(true);
    try {
      const session = await login(name.trim(), HOUSEHOLD_CODE);
      await clearOfflineData();
      setSession({
        token: session.token,
        userId: session.userId,
        displayName: session.displayName,
        householdId: session.householdId,
        householdName: session.householdName,
        preferredStores: session.preferredStores?.length
          ? session.preferredStores
          : session.preferredStore
            ? [session.preferredStore]
            : [],
        preferredStore: session.preferredStore ?? null,
      });
      router.replace("/lijst");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await doLogin(displayName);
  }

  return (
    <div>
      <h2 className="login-title">Inloggen</h2>
      <p className="household-badge">
        Kies wie je bent om de gedeelde lijst van {HOUSEHOLD_CODE} te openen.
      </p>

      <div className="login-members">
        {MEMBERS.map((name) => (
          <button
            key={name}
            type="button"
            className="btn btn-primary login-member-btn"
            disabled={loading}
            onClick={() => void doLogin(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <form className="login-form" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="name">
            Of typ je naam
          </label>
          <input
            id="name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ben of Ineke"
            autoComplete="name"
          />
        </div>
        {error && <p className="scanner-error">{error}</p>}
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={loading || !displayName.trim()}
        >
          {loading ? "Bezig…" : "Naar de lijst"}
        </button>
      </form>
    </div>
  );
}
