"use client";

import { GENERIC_INTERNAL_ERROR_MESSAGE } from "@/lib/errors";

/**
 * Limite d'erreur globale (App Router). N'affiche jamais error.message brut
 * (qui peut contenir un détail Next.js/React interne) — uniquement le
 * message générique homogène défini côté serveur.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: 48, textAlign: "center", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Une erreur est survenue</h1>
      <p style={{ color: "#5b6270", marginBottom: 24 }}>{GENERIC_INTERNAL_ERROR_MESSAGE}</p>
      <button
        onClick={reset}
        style={{
          padding: "8px 16px",
          borderRadius: 6,
          border: "1px solid #1c4e80",
          background: "#1c4e80",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
