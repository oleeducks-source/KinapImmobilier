# KINAP IMMOBILIER — Fondations (Phase 0)

Application de gestion locative pour **KINAP IMMOBILIER** (propriétaire unique,
Côte d'Ivoire). Ce dépôt contient les **fondations techniques** issues de la
Phase 0, construites sur l'architecture verrouillée en Phase 2 et les
décisions arbitrées en Phase 2.1 (voir les documents de spécification
associés, hors de ce dépôt).

Ce document liste ce qui existe, ce qui n'existe pas encore, et comment
démarrer en local.

## Stack

- **Next.js (App Router) + React + TypeScript**, strict mode.
- **PostgreSQL** via **Prisma ORM**.
- Hébergement cible : **Railway** (application + base de données).
- Stockage documentaire : **Object Storage S3-compatible** (jamais en base).
- Auth : **Argon2id** (mots de passe) + **OTP** (abstraction `OTPProvider`,
  implémentation provisoire **Twilio**).
- RBAC : 6 rôles × 7 actions, vérifié **exclusivement côté serveur**.

## Ce que la Phase 0 livre

- Squelette du projet (config TypeScript stricte, Next.js, lint, tests).
- Schéma Prisma complet (~26 entités) avec les invariants financiers
  encodés en commentaires et contraintes : `Payment` ≠ `PaymentAllocation`,
  un seul `Lease` `ACTIVE` par `Unit`, une seule `CommissionRule` `ACTIVE`,
  aucune suppression physique des tables financières critiques, `AuditLog`
  jamais purgé.
- Validation d'environnement stricte au démarrage (`src/config/env.ts`) —
  aucune valeur par défaut silencieuse pour un secret.
- Authentification : hachage Argon2id, sessions serveur (token haché,
  jamais stocké en clair), abstraction OTP (`OTPProvider` → `Twilio` / `mock`).
- RBAC : matrice de permissions (`src/server/permissions/matrix.ts`) et
  vérification serveur (`src/server/permissions/check.ts`).
- AuditLog centralisé, jamais purgeable.
- Exemple canonique de service transactionnel : `PaymentService`
  (`src/server/services/payments/paymentService.ts`) — démontre le pattern
  Payment + PaymentAllocation + CommissionTransaction + AuditLog dans une
  seule transaction Prisma.
- Stockage documentaire S3-compatible (upload, hash SHA-256, URL signée).
- Gestion d'erreurs homogène — aucune fuite de détail interne (stack,
  secrets, erreurs Prisma brutes) vers le client.
- Rate limiting configurable (login, OTP).
- Pipeline CI/CD (`.github/workflows/ci.yml`) : lint, typecheck, tests,
  build, vérifications Prisma, déploiement Staging puis Production
  (Production protégée par un environnement GitHub à validation manuelle).
- Seed de développement **strictement fictif** (`prisma/seed.ts`) — jamais
  de données réelles KINAP.
- Tests fondamentaux unitaires, d'intégration et de sécurité (`tests/`).
- Fondations UI : design system minimal (`src/components/`), écrans de
  connexion / récupération / vérification OTP, mise en page authentifiée
  avec navigation sensible aux permissions, tableau de bord *fondation
  uniquement*.

## Ce que la Phase 0 NE livre PAS (volontairement)

- Aucun import Excel réel, aucune migration de données historiques.
- Aucun module métier complet (locataires, baux, encaissements, impayés,
  décaissements, documents) — seules les briques serveur et un exemple
  transactionnel existent.
- Aucun workflow locatif complet.
- Aucune introduction de multi-propriétaire ni de seconde commission
  huissier — le modèle reste single-owner, commission unique à 8 %.
- Le tableau de bord et `PeriodStatement` sont des **fondations** (structure,
  filtres, coquilles de KPI) — pas de calcul réel branché.

## État de validation (dernière vérification réelle)

- `npm run lint` : 0 erreur.
- `npm run typecheck` (`tsconfig.typecheck.json`, couvre `src/`, `prisma/`, `tests/`) : 12 erreurs, **toutes** dues à l'absence du client Prisma généré (voir ci-dessous) — aucune ne relève d'un bug de code indépendant.
- `npm run test` : 21/22 tests passent. Le seul échec (`tests/integration/paymentService.test.ts`) est dû à la même cause.
- `npm run build` : bloqué à l'étape de vérification de types, même cause.
- Invariants financiers critiques (Lease unique actif, Payment/PaymentAllocation, surallocation refusée, commission 8 %, Deposit isolé, AuditLog immuable, four-eyes, non-suppression physique) : **vérifiés réellement en SQL direct** contre une base PostgreSQL 16 locale (voir `prisma/migrations/20260101000000_init/migration.sql`).

**Blocage d'environnement identifié et non contournable dans certains sandbox** : `prisma generate` / `validate` / `migrate` nécessitent de télécharger un moteur natif depuis `binaries.prisma.sh`. Si ce host est bloqué par une politique réseau (proxy sortant, allowlist d'entreprise), toutes les commandes Prisma échouent avec une erreur `403 Forbidden` explicite — ce n'est pas un bug du code. Sur Railway, en CI GitHub Actions, ou sur un poste avec accès réseau standard, `npm install && npx prisma generate` résout ce point immédiatement.

La migration initiale (`prisma/migrations/20260101000000_init/migration.sql`) a été écrite et appliquée à la main via `psql` (pas via `prisma migrate dev`, indisponible dans cet environnement) et inclut des contraintes SQL qui ne sont pas exprimables dans le DSL Prisma : contrainte d'exclusion (un seul bail actif par unité), index unique partiel (une seule règle de commission active), triggers d'immuabilité (`audit_logs`) et de non-suppression physique (`payments`, `deposits`, `commission_transactions`, `disbursements`), trigger différé de contrôle de ventilation (Σ allocations ≤ montant du paiement). **Dès que `prisma migrate dev` sera exécutable**, régénérer la migration nativement et la comparer à celle-ci pour détecter toute dérive.

## Démarrage local

```bash
cp .env.example .env
# Renseigner DATABASE_URL, DIRECT_DATABASE_URL, SESSION_SECRET (≥ 32
# caractères aléatoires), et les autres variables selon l'environnement.

npm install
npm run prisma:generate
npm run prisma:migrate:dev   # première migration, contre une base Dev locale
npm run seed                 # données de démonstration fictives
npm run dev
```

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement Next.js |
| `npm run build` / `npm run start` | Build et exécution en production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Tests (Vitest) |
| `npm run prisma:migrate:dev` | Nouvelle migration Prisma (Dev) |
| `npm run prisma:migrate:deploy` | Application des migrations (Staging/Prod) |
| `npm run seed` | Seed de développement (données fictives) |

## Environnements

Trois environnements strictement séparés — **Dev**, **Staging**, **Prod** —
chacun avec ses propres identifiants de base de données, son propre
`SESSION_SECRET`, et ses propres identifiants Twilio/Object Storage. Aucun
secret n'est jamais partagé entre environnements ni commité dans Git (voir
`.env.example` et `.gitignore`).

## Références

Ce dépôt s'appuie sur trois documents de spécification verrouillés,
produits en amont de cette Phase 0 :

1. Architecture et spécifications — Phase 1.
2. Architecture technique définitive — Phase 2.
3. Décisions techniques verrouillées — Phase 2.1.

Toute divergence entre ce code et ces documents doit être traitée comme un
bug de conformité, pas comme une évolution silencieuse des règles métier.
