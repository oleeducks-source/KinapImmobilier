/**
 * Client Prisma singleton.
 *
 * En développement, Next.js recharge les modules à chaud, ce qui créerait
 * une nouvelle instance de PrismaClient (et donc un nouveau pool de connexions)
 * à chaque modification de fichier sans cette protection via `globalThis`.
 */

import { PrismaClient } from "@prisma/client";
import { getEnv } from "@/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const env = getEnv();
  return new PrismaClient({
    log: env.APP_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Instanciation paresseuse via Proxy : le client Prisma (et donc la
 * validation d'environnement + le chargement du moteur généré) n'est
 * construit qu'au premier accès réel, pas au moment de l'import du module.
 * Cela évite qu'un import transitif (ex. un module de permissions pur
 * important ce fichier uniquement pour le typage) ne force inutilement une
 * connexion base de données — notamment utile pour les tests unitaires qui
 * n'exercent jamais de chemin de code touchant la base.
 */
function getPrismaSingleton(): PrismaClient {
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient();
  }
  return globalThis.__prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaSingleton();
    const value = Reflect.get(client as object, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
