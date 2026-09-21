import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password (Argon2id)", () => {
  it("hache un mot de passe et le vérifie correctement", async () => {
    const hash = await hashPassword("MotDePasseValide123!");
    expect(hash).not.toContain("MotDePasseValide123!");
    expect(await verifyPassword(hash, "MotDePasseValide123!")).toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await hashPassword("MotDePasseValide123!");
    expect(await verifyPassword(hash, "MauvaisMotDePasse")).toBe(false);
  });

  it("refuse un mot de passe trop court", async () => {
    await expect(hashPassword("court")).rejects.toThrow();
  });

  it("ne jette jamais d'exception sur un hash corrompu (retourne false)", async () => {
    expect(await verifyPassword("hash-invalide", "quelconque")).toBe(false);
  });
});
