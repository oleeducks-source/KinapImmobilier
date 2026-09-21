/**
 * Variables d'environnement minimales pour les tests unitaires qui importent
 * (même transitivement) src/lib/prisma.ts ou src/config/env.ts, sans pour
 * autant nécessiter une vraie base de données (voir tests d'intégration,
 * qui eux exigent DATABASE_URL — cf. tests/integration/).
 *
 * Ces valeurs ne sont jamais utilisées en dehors de ce process de test.
 */

// NODE_ENV est déjà positionné à "test" par Vitest — @types/node le déclare
// en lecture seule, on ne le réaffecte donc pas ici.
process.env.APP_ENV ??= "development";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/kinap_test";
process.env.DIRECT_DATABASE_URL ??= "postgresql://test:test@localhost:5432/kinap_test";
process.env.SESSION_SECRET ??= "test-only-session-secret-not-a-real-secret-000";
process.env.OTP_PROVIDER ??= "mock";
process.env.APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
