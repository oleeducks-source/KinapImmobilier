/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Aucune clé serveur (STORAGE_*, OTP_PROVIDER credentials, SESSION_SECRET, DATABASE_URL)
  // ne doit jamais être ajoutée ici sous NEXT_PUBLIC_* par erreur — voir src/config/env.ts
  // qui valide strictement la séparation client/serveur au démarrage.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // aligné sur la limite documentaire (Décision #4, Phase 2.1)
    },
  },
};

module.exports = nextConfig;
