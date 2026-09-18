import { JourSemaine, RoleCompte, type PrismaClient } from "@prisma/client";
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

export async function assurerComptesDemo(prisma: PrismaClient): Promise<void> {
  const hash = await hasherMotDePasse(MOT_DE_PASSE_DEMO);

  await prisma.compte.upsert({
    where: { email: "admin@hannon-acadimi.test" },
    update: { role: RoleCompte.ADMIN, nom: "Admin Hannon" },
    create: {
      email: "admin@hannon-acadimi.test",
      nom: "Admin Hannon",
      motDePasse: hash,
      role: RoleCompte.ADMIN,
    },
  });

  const amira = await prisma.formateur.findUnique({
    where: { email: "amira.benali@hannon-acadimi.test" },
  });
  if (amira) {
    await prisma.compte.upsert({
      where: { email: amira.email },
      update: { role: RoleCompte.FORMATEUR, formateurId: amira.id, nom: amira.nom },
      create: {
        email: amira.email,
        nom: amira.nom,
        motDePasse: hash,
        role: RoleCompte.FORMATEUR,
        formateurId: amira.id,
      },
    });
  }

  const sofia = await prisma.etudiant.findUnique({
    where: { email: "sofia.martin@hannon-acadimi.test" },
  });
  if (sofia) {
    await prisma.compte.upsert({
      where: { email: sofia.email },
      update: { role: RoleCompte.ETUDIANT_B2C, etudiantId: sofia.id, nom: sofia.nom },
      create: {
        email: sofia.email,
        nom: sofia.nom,
        motDePasse: hash,
        role: RoleCompte.ETUDIANT_B2C,
        etudiantId: sofia.id,
      },
    });
  }

  const societe = await prisma.societe.upsert({
    where: { email: "rh@atlas-formation.test" },
    update: { nom: "Atlas Formation" },
    create: { nom: "Atlas Formation", email: "rh@atlas-formation.test" },
  });
  await prisma.compte.upsert({
    where: { email: "rh@atlas-formation.test" },
    update: { role: RoleCompte.SOCIETE, societeId: societe.id, nom: "RH Atlas" },
    create: {
      email: "rh@atlas-formation.test",
      nom: "RH Atlas",
      motDePasse: hash,
      role: RoleCompte.SOCIETE,
      societeId: societe.id,
    },
  });

  const employe = await prisma.etudiant.upsert({
    where: { email: "employe.atlas@hannon-acadimi.test" },
    update: { nom: "Nour Atlas" },
    create: { nom: "Nour Atlas", email: "employe.atlas@hannon-acadimi.test" },
  });
  await prisma.compte.upsert({
    where: { email: employe.email },
    update: {
      role: RoleCompte.EMPLOYE,
      societeId: societe.id,
      etudiantId: employe.id,
      nom: employe.nom,
    },
    create: {
      email: employe.email,
      nom: employe.nom,
      motDePasse: hash,
      role: RoleCompte.EMPLOYE,
      societeId: societe.id,
      etudiantId: employe.id,
    },
  });
}

export async function seedIfEmpty(prisma: PrismaClient): Promise<SeedResult> {
  const before = await counts(prisma);
  if (before.formateurs > 0 || before.licences > 0 || before.emploisDuTemps > 0) {
    await assurerComptesDemo(prisma);
    logger.info("Seed métier ignoré (données déjà présentes), comptes démo assurés", before);
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
        ouvertB2c: true,
      },
    }));

  const etudiantA = await prisma.etudiant.upsert({
    where: { email: "sofia.martin@hannon-acadimi.test" },
    update: {},
    create: { nom: "Sofia Martin", email: "sofia.martin@hannon-acadimi.test" },
  });
  await prisma.etudiant.upsert({
    where: { email: "youssef.haddad@hannon-acadimi.test" },
    update: {},
    create: { nom: "Youssef Haddad", email: "youssef.haddad@hannon-acadimi.test" },
  });

  await prisma.inscription.createMany({
    data: [{ etudiantId: etudiantA.id, coursId: cours.id }],
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

  await assurerComptesDemo(prisma);
  const after = await counts(prisma);
  logger.info("Seed de démonstration inséré", after);
  return { seeded: true, reason: "created", ...after };
}
