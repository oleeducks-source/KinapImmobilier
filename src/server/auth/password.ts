/**
 * Hachage et vérification des mots de passe — Argon2id (Phase 2.1 Décision #3).
 *
 * Règles :
 *  - jamais de mot de passe en clair en base, en log, ou dans une réponse API ;
 *  - paramètres Argon2id explicites plutôt que les défauts de la librairie,
 *    pour ne pas dépendre silencieusement d'un changement de version.
 */

import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 Mo, recommandation OWASP pour argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainPassword: string): Promise<string> {
  if (plainPassword.length < 12) {
    throw new Error("Le mot de passe doit contenir au moins 12 caractères.");
  }
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  plainPassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, plainPassword);
  } catch {
    // Hash corrompu ou format inattendu : traité comme un échec de vérification,
    // jamais comme une exception qui remonterait un détail interne au client.
    return false;
  }
}
