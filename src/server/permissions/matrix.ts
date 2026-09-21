/**
 * Matrice RBAC — 6 rôles × modules × 7 actions (Phase 2 §6, Phase 2.1 Décision #5).
 *
 * Cette matrice est la SEULE source de vérité pour les autorisations. Elle est
 * utilisée pour :
 *  - le seed (prisma/seed.ts), qui matérialise ces droits en base (table `permissions`) ;
 *  - la navigation côté UI (masquage des liens — jamais une garantie de sécurité) ;
 *  - la vérification côté serveur (src/server/permissions/check.ts), qui est
 *    la SEULE vérification qui compte : toute autorisation côté client est
 *    strictement décorative.
 */

export const ROLE_NAMES = [
  "SUPER_ADMIN",
  "ADMIN",
  "GESTIONNAIRE",
  "COMPTABLE",
  "AGENT_RECOUVREMENT",
  "LECTEUR",
] as const;
export type RoleNameLiteral = (typeof ROLE_NAMES)[number];

export const PERMISSION_ACTIONS = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE_SOFT",
  "VALIDATE",
  "REVERSE",
  "EXPORT",
] as const;
export type PermissionActionLiteral = (typeof PERMISSION_ACTIONS)[number];

export const MODULES = [
  "tenants",
  "leases",
  "units",
  "payments",
  "deposits",
  "commissions",
  "arrears",
  "period_statements",
  "disbursements",
  "expenses",
  "documents",
  "users",
  "audit_log",
] as const;
export type ModuleLiteral = (typeof MODULES)[number];

type PermissionMatrix = Record<RoleNameLiteral, Partial<Record<ModuleLiteral, PermissionActionLiteral[]>>>;

const ALL_ACTIONS: PermissionActionLiteral[] = [...PERMISSION_ACTIONS];
const READ_ONLY: PermissionActionLiteral[] = ["VIEW", "EXPORT"];

/**
 * SUPER_ADMIN : accès total, y compris gestion des utilisateurs et de l'audit.
 * ADMIN : accès métier total, mais pas de gestion des comptes utilisateurs.
 * GESTIONNAIRE : opérations quotidiennes (locataires, baux, encaissements,
 *   décaissements) mais ne VALIDATE jamais un décaissement/paiement qu'il a créé
 *   lui-même (règle des quatre yeux appliquée au niveau service, pas ici).
 * COMPTABLE : validation financière, clôtures de période, décaissements.
 * AGENT_RECOUVREMENT : impayés et actions de recouvrement uniquement, lecture
 *   large pour contextualiser, aucune écriture financière.
 * LECTEUR : lecture seule sur tout, aucune écriture.
 */
export const PERMISSION_MATRIX: PermissionMatrix = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m, ALL_ACTIONS])) as PermissionMatrix["SUPER_ADMIN"],

  ADMIN: {
    tenants: ALL_ACTIONS,
    leases: ALL_ACTIONS,
    units: ALL_ACTIONS,
    payments: ALL_ACTIONS,
    deposits: ALL_ACTIONS,
    commissions: ALL_ACTIONS,
    arrears: ALL_ACTIONS,
    period_statements: ALL_ACTIONS,
    disbursements: ALL_ACTIONS,
    expenses: ALL_ACTIONS,
    documents: ALL_ACTIONS,
    audit_log: READ_ONLY,
  },

  GESTIONNAIRE: {
    tenants: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    leases: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    units: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    payments: ["VIEW", "CREATE", "EXPORT"],
    deposits: ["VIEW", "CREATE", "EXPORT"],
    commissions: ["VIEW", "EXPORT"],
    arrears: ["VIEW", "EXPORT"],
    period_statements: ["VIEW", "EXPORT"],
    disbursements: ["VIEW", "CREATE", "EXPORT"], // initie, ne valide jamais
    expenses: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    documents: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
  },

  COMPTABLE: {
    tenants: ["VIEW", "EXPORT"],
    leases: ["VIEW", "EXPORT"],
    units: ["VIEW", "EXPORT"],
    payments: ["VIEW", "CREATE", "VALIDATE", "REVERSE", "EXPORT"],
    deposits: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    commissions: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    arrears: ["VIEW", "EXPORT"],
    period_statements: ["VIEW", "CREATE", "UPDATE", "VALIDATE", "EXPORT"],
    disbursements: ["VIEW", "VALIDATE", "EXPORT"], // valide, n'initie pas
    expenses: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    documents: ["VIEW", "CREATE", "EXPORT"],
  },

  AGENT_RECOUVREMENT: {
    tenants: ["VIEW"],
    leases: ["VIEW"],
    units: ["VIEW"],
    payments: ["VIEW"],
    arrears: ["VIEW", "CREATE", "UPDATE", "EXPORT"],
    period_statements: ["VIEW"],
    documents: ["VIEW", "CREATE"],
  },

  LECTEUR: Object.fromEntries(MODULES.map((m) => [m, ["VIEW"] as PermissionActionLiteral[]])) as PermissionMatrix["LECTEUR"],
};
