import { describe, it, expect } from "vitest";
import { generateOtpCode, hashOtpCode, OTP_CODE_LENGTH, OTP_TTL_MS } from "@/server/otp/crypto";

describe("OTP — fonctions pures (sans Prisma)", () => {
  it("génère un code à exactement 6 chiffres numériques", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_CODE_LENGTH);
      expect(/^\d{6}$/.test(code)).toBe(true);
    }
  });

  it("le TTL est bien de 5 minutes", () => {
    expect(OTP_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("hashe un code de façon déterministe (même code -> même hash)", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });

  it("deux codes différents produisent des hash différents", () => {
    expect(hashOtpCode("123456")).not.toBe(hashOtpCode("654321"));
  });

  it("le hash ne contient jamais le code en clair", () => {
    const hash = hashOtpCode("123456");
    expect(hash).not.toContain("123456");
    expect(hash).toHaveLength(64); // SHA-256 hex
  });

  it("génère des codes avec un zéro non significatif préservé (padStart)", () => {
    // On ne peut pas forcer randomInt à renvoyer une petite valeur directement,
    // mais on vérifie que la fonction de padding est bien appliquée en
    // testant la propriété structurelle sur un grand échantillon : aucun
    // code ne doit jamais faire moins de 6 caractères.
    const codes = Array.from({ length: 200 }, () => generateOtpCode());
    expect(codes.every((c) => c.length === 6)).toBe(true);
  });
});
