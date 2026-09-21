/** États UI standards — chargement, vide, erreur — utilisés partout dans l'app. */

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--color-text-muted)" }}>
      {label}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ padding: "var(--space-7)", textAlign: "center" }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{title}</p>
      {description && <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{description}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-danger-bg)",
        color: "var(--color-danger)",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}
