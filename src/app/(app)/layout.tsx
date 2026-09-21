import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "@/server/auth/session";
import { loadActor } from "@/server/permissions/check";
import { hasPermission } from "@/server/permissions/check";
import { NAV_ITEMS } from "@/config/navigation";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Mise en page authentifiée — fondation Phase 0.
 * Résout la session serveur AVANT tout rendu ; aucune page sous ce groupe
 * de routes ne peut être atteinte sans session valide. La navigation
 * affichée est filtrée par permission (masquage UX, jamais une garantie
 * de sécurité à elle seule — cf. src/server/permissions/check.ts).
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let actor;
  try {
    const session = await resolveSession(rawToken);
    actor = await loadActor(session);
  } catch {
    redirect("/login");
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => hasPermission(actor, item.module, "VIEW"));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          padding: "var(--space-5) var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "var(--space-5)" }}>KINAP IMMOBILIER</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {visibleNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                color: "var(--color-text-secondary)",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 56,
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "var(--space-4)",
            padding: "0 var(--space-5)",
            background: "var(--color-surface)",
          }}
        >
          <button
            aria-label="Notifications"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            🔔
          </button>
          <a href="/profile" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Mon profil
          </a>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--color-text-secondary)",
                padding: 0,
              }}
            >
              Se déconnecter
            </button>
          </form>
        </header>

        <main style={{ flex: 1, padding: "var(--space-6)" }}>{children}</main>
      </div>
    </div>
  );
}
