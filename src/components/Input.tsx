import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        style={{
          padding: "8px 12px",
          borderRadius: "var(--radius-sm)",
          border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
          fontSize: 14,
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          ...style,
        }}
      />
      {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}
