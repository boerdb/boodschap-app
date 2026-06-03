"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { login } from "@/lib/api/client";
import { clearOfflineData } from "@/lib/offline/queue";
import { getSession, setSession } from "@/lib/auth/session";

export default function LoginPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("THUIS");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getSession();
    if (existing?.token) router.replace("/lijst");
    else if (existing?.displayName) setDisplayName(existing.displayName);
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(displayName.trim(), inviteCode.trim());
      await clearOfflineData();
      setSession({
        token: session.token,
        userId: session.userId,
        displayName: session.displayName,
        householdId: session.householdId,
        householdName: session.householdName,
      });
      router.replace("/lijst");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: "0.5rem" }}>Inloggen</h2>
      <p className="household-badge">
        Voer je naam en de huishoudcode in om de gedeelde lijst te openen.
      </p>
      <form className="login-form" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="name">
            Jouw naam
          </label>
          <input
            id="name"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Bijv. Ben"
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label" htmlFor="code">
            Huishoudcode
          </label>
          <input
            id="code"
            className="input"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="THUIS"
            required
          />
        </div>
        {error && <p className="scanner-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Bezig…" : "Naar de lijst"}
        </button>
      </form>
      <p className="household-badge" style={{ textAlign: "center" }}>
        Standaard code voor demo: <strong>THUIS</strong>
      </p>
    </div>
  );
}
