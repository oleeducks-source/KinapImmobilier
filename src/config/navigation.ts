/**
 * Navigation principale — sensible aux permissions (Phase 0 §27).
 * Le masquage ici est un confort UX ; la seule protection réelle est
 * src/server/permissions/check.ts, appliquée côté serveur sur chaque action.
 */

import type { ModuleLiteral } from "@/server/permissions/matrix";

export interface NavItem {
  label: string;
  href: string;
  module: ModuleLiteral;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", module: "period_statements" },
  { label: "Locataires", href: "/tenants", module: "tenants" },
  { label: "Baux", href: "/leases", module: "leases" },
  { label: "Unités", href: "/units", module: "units" },
  { label: "Encaissements", href: "/payments", module: "payments" },
  { label: "Cautions", href: "/deposits", module: "deposits" },
  { label: "Impayés", href: "/arrears", module: "arrears" },
  { label: "Relevés de période", href: "/period-statements", module: "period_statements" },
  { label: "Décaissements", href: "/disbursements", module: "disbursements" },
  { label: "Documents", href: "/documents", module: "documents" },
  { label: "Utilisateurs", href: "/users", module: "users" },
  { label: "Journal d'audit", href: "/audit-log", module: "audit_log" },
];
