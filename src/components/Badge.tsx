type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_STYLES: Record<BadgeTone, React.CSSProperties> = {
  neutral: { background: "#eef0f3", color: "var(--color-text-secondary)" },
  success: { background: "var(--color-success-bg)", color: "var(--color-success)" },
  warning: { background: "var(--color-warning-bg)", color: "var(--color-warning)" },
  danger: { background: "var(--color-danger-bg)", color: "var(--color-danger)" },
  info: { background: "var(--color-info-bg)", color: "var(--color-primary)" },
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      style={{
        ...TONE_STYLES[tone],
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
