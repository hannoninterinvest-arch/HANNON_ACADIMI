import { JourSemaine, type PrismaClient } from "@prisma/client";
import { logger } from "./logger";

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

/**
 * Insère le jeu de démo uniquement si la base est vide.
 * Ne supprime jamais de données existantes.
 */
export async function seedIfEmpty(prisma: PrismaClient): Promise<SeedResult> {
  const before = await counts(prisma);
  if (before.formateurs > 0 || before.licences > 0 || before.emploisDuTemps > 0) {
    logger.info("Seed ignoré : la base contient déjà des données", before);
    return { seeded: false, reason: "already_populated", ...before };
  }

  const formateurA = await prisma.formateur.upsert({
    where: { email: "amira.benali@hannon-acadimi.test" },
    update: {},
    create: {
      nom: "Amira Benali",
      email: "amira.benali@hannon-acadimi.test",
    },
  });
  await prisma.formateur.upsert({
    where: { email: "karim.elidrissi@hannon-acadimi.test" },
    update: {},
    create: {
      nom: "Karim El Idrissi",
      email: "karim.elidrissi@hannon-acadimi.test",
    },
  });

  const cours =
    (await prisma.cours.findFirst({ where: { titre: "Anglais professionnel B1" } })) ??
    (await prisma.cours.create({
      data: {
        titre: "Anglais professionnel B1",
        description: "Cours hebdomadaire en visio — lundi 18h-20h.",
      },
    }));

  const etudiantA = await prisma.etudiant.upsert({
    where: { email: "sofia.martin@hannon-acadimi.test" },
    update: {},
    create: { nom: "Sofia Martin", email: "sofia.martin@hannon-acadimi.test" },
  });
  const etudiantB = await prisma.etudiant.upsert({
    where: { email: "youssef.haddad@hannon-acadimi.test" },
    update: {},
    create: { nom: "Youssef Haddad", email: "youssef.haddad@hannon-acadimi.test" },
  });

  await prisma.inscription.createMany({
    data: [
      { etudiantId: etudiantA.id, coursId: cours.id },
      { etudiantId: etudiantB.id, coursId: cours.id },
    ],
    skipDuplicates: true,
  });

  await prisma.licenceZoom.createMany({
    data: [
      {
        compteEmail: "zoom-pool-01@hannon-acadimi.test",
        zoomUserId: "zoom-user-pool-01",
        statut: "LIBRE",
        hostKey: "111111",
      },
      {
        compteEmail: "zoom-pool-02@hannon-acadimi.test",
        zoomUserId: "zoom-user-pool-02",
        statut: "LIBRE",
        hostKey: "222222",
      },
      {
        compteEmail: "zoom-pool-03@hannon-acadimi.test",
        zoomUserId: "zoom-user-pool-03",
        statut: "LIBRE",
        hostKey: "333333",
      },
    ],
    skipDuplicates: true,
  });

  const aujourdHui = new Date();
  const debutPeriode = new Date(Date.UTC(aujourdHui.getUTCFullYear(), aujourdHui.getUTCMonth(), 1));
  const finPeriode = new Date(Date.UTC(aujourdHui.getUTCFullYear(), aujourdHui.getUTCMonth() + 4, 0));

  const edtExistant = await prisma.emploiDuTemps.findFirst({
    where: { coursId: cours.id, formateurId: formateurA.id },
  });
  if (!edtExistant) {
    await prisma.emploiDuTemps.create({
      data: {
        coursId: cours.id,
        formateurId: formateurA.id,
        jourSemaine: JourSemaine.LUNDI,
        heureDebut: "18:00",
        dureeMinutes: 120,
        dateDebutPeriode: debutPeriode,
        dateFinPeriode: finPeriode,
      },
    });
  }

  const after = await counts(prisma);
  logger.info("Seed de démonstration inséré", after);
  return { seeded: true, reason: "created", ...after };
}
