"use client";

import { Button } from "@/components/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Boîte de confirmation générique — utilisée avant toute action sensible
 * (contre-passation, validation de décaissement, clôture de période...). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 23, 31, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-5)",
          maxWidth: 420,
          width: "90%",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>{title}</h2>
        {description && (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>{description}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
