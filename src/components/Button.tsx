import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--color-primary)", color: "var(--color-primary-contrast)", border: "1px solid var(--color-primary)" },
  secondary: { background: "var(--color-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" },
  danger: { background: "var(--color-danger)", color: "#fff", border: "1px solid var(--color-danger)" },
  ghost: { background: "transparent", color: "var(--color-text-secondary)", border: "1px solid transparent" },
};

export function Button({ variant = "primary", style, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...VARIANT_STYLES[variant],
        padding: "8px 16px",
        borderRadius: "var(--radius-sm)",
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 120ms ease",
        ...style,
      }}
    />
  );
}
