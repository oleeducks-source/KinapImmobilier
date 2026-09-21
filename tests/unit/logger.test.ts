import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "@/lib/logger";

describe("logger — masquage systématique des secrets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("masque un mot de passe et un token dans le contexte loggé", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.info("connexion utilisateur", {
      email: "demo@example.com",
      password: "SuperSecret123!",
      tokenHash: "abc123",
    });

    expect(spy).toHaveBeenCalled();
    const loggedLine = spy.mock.calls[0]?.[0] as string;
    expect(loggedLine).toContain("[REDACTED]");
    expect(loggedLine).not.toContain("SuperSecret123!");
    expect(loggedLine).not.toContain("abc123");
    expect(loggedLine).toContain("demo@example.com");
  });

  it("masque DATABASE_URL (avec underscore) — régression Phase 0.1", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.info("démarrage", { DATABASE_URL: "postgresql://user:pass@host/db" });

    const loggedLine = spy.mock.calls[0]?.[0] as string;
    expect(loggedLine).toContain("[REDACTED]");
    expect(loggedLine).not.toContain("postgresql://user:pass@host/db");
  });
});
