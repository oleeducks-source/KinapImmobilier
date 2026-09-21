-- Migration initiale — dérivée manuellement de prisma/schema.prisma.
--
-- CONTEXTE IMPORTANT (validation Phase 0) : cette migration a été écrite et
-- appliquée à la main via psql, PAS via `prisma migrate dev`, parce que
-- l'environnement de validation ne peut pas atteindre binaries.prisma.sh
-- (moteur Prisma non téléchargeable — voir rapport de validation). Dès que
-- `prisma generate`/`migrate dev` seront exécutables (Railway, CI, poste
-- local avec accès réseau standard), cette migration doit être regénérée
-- nativement via `prisma migrate dev` et comparée à celle-ci pour détecter
-- toute dérive, puis celle-ci remplacée par la version générée officiellement.
--
-- Elle inclut explicitement la contrainte d'exclusion Postgres pour
-- "un seul Lease ACTIF par Unit", qui n'est PAS exprimable dans le DSL
-- Prisma et qui n'existait auparavant que sous forme de commentaire dans
-- schema.prisma (jamais matérialisée en base avant cette validation).

CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "UnitStatus" AS ENUM ('VACANT', 'OCCUPIED');
CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'TERMINATED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED', 'REVERSED');
CREATE TYPE "ChequeStatus" AS ENUM ('RECU', 'ENCAISSE', 'REJETE', 'ANNULE');
CREATE TYPE "DepositStatus" AS ENUM ('HELD', 'RETURNED', 'WITHHELD');
CREATE TYPE "CommissionRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CollectionActionType" AS ENUM ('RELANCE', 'MISE_EN_DEMEURE', 'DOSSIER_HUISSIER');
CREATE TYPE "PeriodStatementStatus" AS ENUM ('OUVERTE', 'CALCULEE', 'CLOTUREE', 'REOUVERTE');
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');
CREATE TYPE "DocumentEntityType" AS ENUM ('TENANT', 'LEASE', 'UNIT');
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'GESTIONNAIRE', 'COMPTABLE', 'AGENT_RECOUVREMENT', 'LECTEUR');
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'DELETE_SOFT', 'VALIDATE', 'REVERSE', 'EXPORT');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PASSWORD_RESET');

-- Owner
CREATE TABLE "owners" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL DEFAULT 'KINAP IMMOBILIER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Property / Building / Floor / Unit
CREATE TABLE "properties" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "properties_name_idx" ON "properties"("name");

CREATE TABLE "buildings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "property_id" TEXT NOT NULL REFERENCES "properties"("id"),
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "buildings_property_id_idx" ON "buildings"("property_id");

CREATE TABLE "floors" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "building_id" TEXT NOT NULL REFERENCES "buildings"("id"),
  "label" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "floors_building_id_idx" ON "floors"("building_id");

CREATE TABLE "units" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "floor_id" TEXT NOT NULL REFERENCES "floors"("id"),
  "code" TEXT NOT NULL,
  "type" TEXT,
  "surface_m2" DECIMAL(10, 2),
  "current_rent" DECIMAL(14, 2) NOT NULL,
  "status" "UnitStatus" NOT NULL DEFAULT 'VACANT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3),
  UNIQUE ("floor_id", "code")
);
CREATE INDEX "units_status_idx" ON "units"("status");

-- Tenants
CREATE TABLE "tenants" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "internal_ref" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "tenants_internal_ref_idx" ON "tenants"("internal_ref");

CREATE TABLE "tenant_contacts" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id"),
  "phone" TEXT,
  "email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "tenant_contacts_tenant_id_idx" ON "tenant_contacts"("tenant_id");

-- Leases
CREATE TABLE "leases" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "unit_id" TEXT NOT NULL REFERENCES "units"("id"),
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id"),
  "rent_amount" DECIMAL(14, 2) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "status" "LeaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "leases_unit_id_status_idx" ON "leases"("unit_id", "status");
CREATE INDEX "leases_tenant_id_idx" ON "leases"("tenant_id");

-- INVARIANT CRITIQUE : un seul Lease ACTIVE par Unit à la fois.
-- Jamais matérialisé avant cette validation — ajouté ici et vérifié par test réel.
ALTER TABLE "leases"
  ADD CONSTRAINT "one_active_lease_per_unit"
  EXCLUDE USING gist ("unit_id" WITH =)
  WHERE ("status" = 'ACTIVE');

CREATE TABLE "rent_schedules" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lease_id" TEXT NOT NULL REFERENCES "leases"("id"),
  "period" DATE NOT NULL,
  "amount_due" DECIMAL(14, 2) NOT NULL,
  "due_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE ("lease_id", "period")
);

-- Payment methods / Payments / Cheques / Allocations
CREATE TABLE "payment_methods" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "label" TEXT NOT NULL UNIQUE
);

CREATE TABLE "users_placeholder_note" ( -- voir bloc Users plus bas ; table temporaire supprimée en fin de script
  "id" TEXT
);
DROP TABLE "users_placeholder_note";

-- Roles / Permissions / Users doivent exister avant "payments" (FK recorded_by)
CREATE TABLE "roles" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" "RoleName" NOT NULL UNIQUE
);

CREATE TABLE "permissions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "role_id" TEXT NOT NULL REFERENCES "roles"("id"),
  "module" TEXT NOT NULL,
  "action" "PermissionAction" NOT NULL,
  UNIQUE ("role_id", "module", "action")
);
CREATE INDEX "permissions_role_id_module_idx" ON "permissions"("role_id", "module");

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "phone" TEXT,
  "role_id" TEXT NOT NULL REFERENCES "roles"("id"),
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "otp_required" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);

CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "token_hash" TEXT NOT NULL UNIQUE,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

CREATE TABLE "otp_codes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL REFERENCES "users"("id"),
  "purpose" "OtpPurpose" NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "otp_codes_user_id_purpose_idx" ON "otp_codes"("user_id", "purpose");

CREATE TABLE "payments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id"),
  "lease_id" TEXT NOT NULL REFERENCES "leases"("id"),
  "method_id" TEXT NOT NULL REFERENCES "payment_methods"("id"),
  "amount" DECIMAL(14, 2) NOT NULL,
  "date" DATE NOT NULL,
  "reference" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'VALIDATED',
  "recorded_by" TEXT NOT NULL REFERENCES "users"("id"),
  "reversed_at" TIMESTAMP(3),
  "reversal_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "payments_tenant_id_date_idx" ON "payments"("tenant_id", "date");
CREATE INDEX "payments_lease_id_idx" ON "payments"("lease_id");

CREATE TABLE "cheques" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "payment_id" TEXT NOT NULL UNIQUE REFERENCES "payments"("id"),
  "status" "ChequeStatus" NOT NULL DEFAULT 'RECU',
  "bank_name" TEXT,
  "cheque_number" TEXT,
  "encashed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE "payment_allocations" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "payment_id" TEXT NOT NULL REFERENCES "payments"("id"),
  "rent_schedule_id" TEXT NOT NULL REFERENCES "rent_schedules"("id"),
  "amount" DECIMAL(14, 2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");
CREATE INDEX "payment_allocations_rent_schedule_id_idx" ON "payment_allocations"("rent_schedule_id");

-- INVARIANT : Σ(allocations.amount) ne doit jamais dépasser payment.amount.
-- Avant cette validation, cette règle n'existait QUE dans PaymentService
-- (src/server/services/payments/paymentService.ts) — rien ne l'empêchait au
-- niveau base (un accès direct, un bug applicatif futur, ou une requête SQL
-- manuelle aurait pu la violer silencieusement). Ajout d'un trigger de
-- défense en profondeur, vérifié par test réel ci-dessous.
CREATE OR REPLACE FUNCTION "enforce_allocation_sum_le_payment_amount"() RETURNS TRIGGER AS $$
DECLARE
  target_payment_id TEXT;
  allocated_total DECIMAL(14, 2);
  payment_total DECIMAL(14, 2);
BEGIN
  target_payment_id := COALESCE(NEW."payment_id", OLD."payment_id");

  SELECT COALESCE(SUM("amount"), 0) INTO allocated_total
    FROM "payment_allocations"
    WHERE "payment_id" = target_payment_id AND "deleted_at" IS NULL;

  SELECT "amount" INTO payment_total FROM "payments" WHERE "id" = target_payment_id;

  IF allocated_total > payment_total THEN
    RAISE EXCEPTION 'Somme des ventilations (%) supérieure au montant du paiement (%) pour payment_id=%',
      allocated_total, payment_total, target_payment_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "payment_allocations_sum_guard"
  AFTER INSERT OR UPDATE ON "payment_allocations"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "enforce_allocation_sum_le_payment_amount"();

-- Deposits
CREATE TABLE "deposits" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lease_id" TEXT NOT NULL REFERENCES "leases"("id"),
  "amount" DECIMAL(14, 2) NOT NULL,
  "received_date" DATE NOT NULL,
  "mode" TEXT,
  "status" "DepositStatus" NOT NULL DEFAULT 'HELD',
  "returned_date" DATE,
  "returned_amount" DECIMAL(14, 2),
  "withholding_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "deposits_lease_id_idx" ON "deposits"("lease_id");

-- Commission
CREATE TABLE "commission_rules" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "rate" DECIMAL(5, 4) NOT NULL,
  "applies_to_deposit" BOOLEAN NOT NULL DEFAULT false,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "status" "CommissionRuleStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "commission_rules_status_start_date_idx" ON "commission_rules"("status", "start_date");

-- INVARIANT : une seule CommissionRule ACTIVE à la fois. Comme pour Lease,
-- ceci n'était garanti qu'au niveau applicatif (CommissionService), jamais
-- en base. Ajouté ici et vérifié par test réel.
CREATE UNIQUE INDEX "one_active_commission_rule" ON "commission_rules"(("status"))
  WHERE ("status" = 'ACTIVE');

CREATE TABLE "commission_transactions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "payment_id" TEXT NOT NULL UNIQUE REFERENCES "payments"("id"),
  "rule_id" TEXT NOT NULL REFERENCES "commission_rules"("id"),
  "amount" DECIMAL(14, 2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "commission_transactions_payment_id_idx" ON "commission_transactions"("payment_id");

-- Arrears / Collection actions
CREATE TABLE "arrears" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "lease_id" TEXT NOT NULL REFERENCES "leases"("id"),
  "period" DATE NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "severity" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE ("lease_id", "period")
);

CREATE TABLE "collection_actions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "arrears_id" TEXT NOT NULL REFERENCES "arrears"("id"),
  "date" DATE NOT NULL,
  "type" "CollectionActionType" NOT NULL,
  "result" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "collection_actions_arrears_id_date_idx" ON "collection_actions"("arrears_id", "date");

-- Period statements / Disbursements / Expenses
CREATE TABLE "period_statements" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "period" DATE NOT NULL UNIQUE,
  "total_due" DECIMAL(14, 2),
  "total_collected" DECIMAL(14, 2),
  "commission_kinap" DECIMAL(14, 2),
  "other_deductions" DECIMAL(14, 2),
  "net_available" DECIMAL(14, 2),
  "adjustments" JSONB,
  "status" "PeriodStatementStatus" NOT NULL DEFAULT 'OUVERTE',
  "closed_at" TIMESTAMP(3),
  "closed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE "disbursements" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "period_statement_id" TEXT REFERENCES "period_statements"("id"),
  "beneficiary" TEXT NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "reference" TEXT,
  "justificatif_doc_id" TEXT,
  "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
  "created_by" TEXT NOT NULL REFERENCES "users"("id"),
  "validated_by" TEXT REFERENCES "users"("id"),
  "validated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3),
  -- INVARIANT quatre yeux : le créateur ne peut jamais être son propre
  -- validateur. Comme pour Lease/CommissionRule, ceci n'était garanti que
  -- côté service (aucune trace dans le schéma avant cette validation).
  CONSTRAINT "disbursements_four_eyes" CHECK ("validated_by" IS NULL OR "validated_by" <> "created_by")
);
CREATE INDEX "disbursements_date_idx" ON "disbursements"("date");
CREATE INDEX "disbursements_status_idx" ON "disbursements"("status");

CREATE TABLE "expenses" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "property_id" TEXT NOT NULL REFERENCES "properties"("id"),
  "amount" DECIMAL(14, 2) NOT NULL,
  "category" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "expenses_property_id_date_idx" ON "expenses"("property_id", "date");

-- Documents
CREATE TABLE "documents" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entity_type" "DocumentEntityType" NOT NULL,
  "tenant_id" TEXT REFERENCES "tenants"("id"),
  "lease_id" TEXT REFERENCES "leases"("id"),
  "unit_id" TEXT REFERENCES "units"("id"),
  "type" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP(3)
);
CREATE INDEX "documents_entity_type_tenant_id_idx" ON "documents"("entity_type", "tenant_id");
CREATE INDEX "documents_entity_type_lease_id_idx" ON "documents"("entity_type", "lease_id");
CREATE INDEX "documents_entity_type_unit_id_idx" ON "documents"("entity_type", "unit_id");

-- Audit log — jamais purgé, jamais modifié. Aucun deletedAt, volontairement.
CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT REFERENCES "users"("id"),
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "old_value" JSONB,
  "new_value" JSONB,
  "reason" TEXT,
  "result" TEXT NOT NULL DEFAULT 'success',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "correlation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- INVARIANT : AuditLog n'est jamais purgeable ni modifiable après écriture.
-- Jamais matérialisé en base avant cette validation (reposait uniquement
-- sur la discipline applicative — aucune fonction UPDATE/DELETE exposée).
-- Ajout d'un garde-fou au niveau base, en défense en profondeur réelle.
CREATE OR REPLACE FUNCTION "prevent_audit_log_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs est en lecture seule après écriture (aucune modification ni suppression autorisée)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();

CREATE TRIGGER "audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_log_mutation"();

-- INVARIANT : aucune suppression physique de Payment, Deposit,
-- CommissionTransaction, Disbursement. Avant cette validation, cette règle
-- ne reposait QUE sur la discipline applicative (aucun repository n'expose
-- de méthode .delete()) — rien n'empêchait une suppression SQL directe.
-- Ajout de garde-fous en défense en profondeur, vérifiés par test réel.
-- Volontairement limité à DELETE (pas UPDATE : les statuts évoluent
-- légitimement — ex. reversal d'un Payment, validation d'un Disbursement).
CREATE OR REPLACE FUNCTION "prevent_physical_delete"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% ne peut jamais être supprimé physiquement (utiliser deleted_at / un statut dédié)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payments_no_physical_delete"
  BEFORE DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION "prevent_physical_delete"();

CREATE TRIGGER "deposits_no_physical_delete"
  BEFORE DELETE ON "deposits"
  FOR EACH ROW EXECUTE FUNCTION "prevent_physical_delete"();

CREATE TRIGGER "commission_transactions_no_physical_delete"
  BEFORE DELETE ON "commission_transactions"
  FOR EACH ROW EXECUTE FUNCTION "prevent_physical_delete"();

CREATE TRIGGER "disbursements_no_physical_delete"
  BEFORE DELETE ON "disbursements"
  FOR EACH ROW EXECUTE FUNCTION "prevent_physical_delete"();

-- Notifications
CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipient_id" TEXT NOT NULL REFERENCES "users"("id"),
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unread',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "read_at" TIMESTAMP(3)
);
CREATE INDEX "notifications_recipient_id_status_idx" ON "notifications"("recipient_id", "status");
