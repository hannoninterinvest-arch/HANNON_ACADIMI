import { RoleCompte, type PrismaClient } from "@prisma/client";
import { logger } from "./logger";
import { hasherMotDePasse } from "./password";

export const MOT_DE_PASSE_DEMO = "Hannon2026!";

export type SeedResult = {
  seeded: boolean;
  reason: "created" | "already_populated";
  formateurs: number;
  licences: number;
  emploisDuTemps: number;
  cours: number;
  etudiants: number;
};

async function counts(prisma: PrismaClient) {
  const [formateurs, licences, emploisDuTemps, cours, etudiants] = await prisma.$transaction([
    prisma.formateur.count(),
    prisma.licenceZoom.count(),
    prisma.emploiDuTemps.count(),
    prisma.cours.count(),
    prisma.etudiant.count(),
  ]);
  return { formateurs, licences, emploisDuTemps, cours, etudiants };
}

export async function seedIfEmpty(prisma: PrismaClient): Promise<SeedResult> {
  const before = await counts(prisma);
  const admin = await prisma.compte.findFirst({ where: { role: RoleCompte.ADMIN }, select: { id: true } });
  if (admin) {
    return { seeded: false, reason: "already_populated", ...before };
  }
  await prisma.compte.create({
    data: {
      email: "admin@hannon-acadimi.test",
      nom: "Admin Hannon",
      motDePasse: await hasherMotDePasse(MOT_DE_PASSE_DEMO),
      role: RoleCompte.ADMIN,
    },
  });
  logger.info("Administrateur initial créé, aucun catalogue prérempli");
  return { seeded: true, reason: "created", ...before };
}
