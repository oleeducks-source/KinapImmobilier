import { describe, it, expect } from "vitest";
import { redactAuditValue } from "@/server/audit/log";

/**
 * Défense en profondeur ajoutée en Phase 0.1 : recordAuditEvent() ne doit
 * jamais persister un secret dans oldValue/newValue, même si un appelant
 * futur en inclut un par erreur (cf. audit/log.ts). Fonction pure, testable
 * sans Prisma ni base de données.
 */
describe("redactAuditValue — masquage des secrets avant écriture AuditLog", () => {
  it("masque un mot de passe et son hash", () => {
    const result = redactAuditValue({ password: "hunter2", passwordHash: "argon2id$..." });
    expect(result).toEqual({ password: "[REDACTED]", passwordHash: "[REDACTED]" });
  });

  it("masque un code OTP et un token de session, imbriqués", () => {
    const result = redactAuditValue({
      user: { id: "u1" },
      otpCode: "123456",
      session: { token: "abc", tokenHash: "def" },
    });
    expect(result).toEqual({
      user: { id: "u1" },
      otpCode: "[REDACTED]",
      session: { token: "[REDACTED]", tokenHash: "[REDACTED]" },
    });
  });

  it("masque DATABASE_URL quelle que soit la casse de la clé", () => {
    const result = redactAuditValue({ DATABASE_URL: "postgresql://...", databaseUrl: "postgresql://..." });
    expect(result).toEqual({ DATABASE_URL: "[REDACTED]", databaseUrl: "[REDACTED]" });
  });

  it("laisse intactes les données non sensibles", () => {
    const result = redactAuditValue({ amount: 750000, leaseId: "lease-1", allocationsCount: 3 });
    expect(result).toEqual({ amount: 750000, leaseId: "lease-1", allocationsCount: 3 });
  });

  it("gère les tableaux d'objets", () => {
    const result = redactAuditValue([{ token: "a" }, { amount: 1 }]);
    expect(result).toEqual([{ token: "[REDACTED]" }, { amount: 1 }]);
  });

  it("renvoie les valeurs primitives inchangées", () => {
    expect(redactAuditValue("plain string")).toBe("plain string");
    expect(redactAuditValue(42)).toBe(42);
    expect(redactAuditValue(null)).toBe(null);
  });
});
