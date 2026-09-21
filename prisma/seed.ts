/**
 * Seed de développement — données strictement FICTIVES.
 *
 * Interdiction absolue (Phase 0 §19, §33) : ce script ne doit JAMAIS importer,
 * copier, ni s'inspirer de données réelles KINAP (locataires, montants, biens
 * réels tirés de l'Excel existant). Tous les noms, montants et adresses
 * ci-dessous sont inventés pour la démonstration et les tests.
 */

import { PrismaClient, RoleName, PermissionAction } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { PERMISSION_MATRIX, MODULES } from "../src/server/permissions/matrix";

const prisma = new PrismaClient();

async function seedRolesAndPermissions() {
  for (const roleName of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    const allowedByModule = PERMISSION_MATRIX[roleName] ?? {};
    for (const moduleName of MODULES) {
      const actions = allowedByModule[moduleName] ?? [];
      for (const action of actions) {
        await prisma.permission.upsert({
          where: {
            roleId_module_action: { roleId: role.id, module: moduleName, action: action as PermissionAction },
          },
          update: {},
          create: { roleId: role.id, module: moduleName, action: action as PermissionAction },
        });
      }
    }
  }
}

async function seedUsers() {
  const roles = await prisma.role.findMany();
  const roleIdByName = new Map(roles.map((r) => [r.name, r.id]));

  const demoUsers: Array<{ email: string; roleName: RoleName }> = [
    { email: "superadmin@demo.kinap-immobilier.test", roleName: RoleName.SUPER_ADMIN },
    { email: "admin@demo.kinap-immobilier.test", roleName: RoleName.ADMIN },
    { email: "gestionnaire@demo.kinap-immobilier.test", roleName: RoleName.GESTIONNAIRE },
    { email: "comptable@demo.kinap-immobilier.test", roleName: RoleName.COMPTABLE },
    { email: "recouvrement@demo.kinap-immobilier.test", roleName: RoleName.AGENT_RECOUVREMENT },
    { email: "lecteur@demo.kinap-immobilier.test", roleName: RoleName.LECTEUR },
  ];

  // Mot de passe de démonstration unique, jamais utilisé hors environnement local.
  const passwordHash = await hashPassword("ChangeMoiEnDev!2026");

  for (const demoUser of demoUsers) {
    const roleId = roleIdByName.get(demoUser.roleName);
    if (!roleId) continue;
    await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: { email: demoUser.email, passwordHash, roleId },
    });
  }
}

async function seedOwnerAndCommission() {
  const ownerCount = await prisma.owner.count();
  if (ownerCount === 0) {
    await prisma.owner.create({ data: { name: "KINAP IMMOBILIER" } });
  }

  const activeRule = await prisma.commissionRule.findFirst({ where: { status: "ACTIVE" } });
  if (!activeRule) {
    await prisma.commissionRule.create({
      data: { rate: 0.08, appliesToDeposit: false, startDate: new Date("2026-01-01"), status: "ACTIVE" },
    });
  }
}

async function seedPaymentMethods() {
  const methods = ["especes", "cheque", "wave", "orange_money", "virement"];
  for (const label of methods) {
    await prisma.paymentMethod.upsert({ where: { label }, update: {}, create: { label } });
  }
}

async function seedFictionalPortfolio() {
  // Exemple purement illustratif — un immeuble, un étage, deux unités, un
  // locataire fictif, un bail actif. Sert de jeu de données minimal pour les
  // tests d'intégration et la démonstration de l'écran de base.
  const property = await prisma.property.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Résidence Démo Cocody",
      address: "Cocody, Abidjan (adresse fictive de démonstration)",
    },
  });

  const building = await prisma.building.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000002", propertyId: property.id, name: "Bâtiment A" },
  });

  const floor = await prisma.floor.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000003", buildingId: building.id, label: "Rez-de-chaussée" },
  });

  await prisma.unit.upsert({
    where: { id: "00000000-0000-0000-0000-000000000004" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000004",
      floorId: floor.id,
      code: "RDC-01",
      type: "appartement",
      currentRent: 150000,
      status: "VACANT",
    },
  });
}

async function main() {
  await seedRolesAndPermissions();
  await seedUsers();
  await seedOwnerAndCommission();
  await seedPaymentMethods();
  await seedFictionalPortfolio();
  // eslint-disable-next-line no-console
  console.log("Seed de développement terminé (données fictives uniquement).");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
