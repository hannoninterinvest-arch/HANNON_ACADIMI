import { PrismaClient, JourSemaine } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.inscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.licenceZoom.deleteMany();
  await prisma.emploiDuTemps.deleteMany();
  await prisma.etudiant.deleteMany();
  await prisma.cours.deleteMany();
  await prisma.formateur.deleteMany();

  const [formateurA, formateurB] = await Promise.all([
    prisma.formateur.create({
      data: {
        nom: "Amira Benali",
        email: "amira.benali@hannon-acadimi.test",
      },
    }),
    prisma.formateur.create({
      data: {
        nom: "Karim El Idrissi",
        email: "karim.elidrissi@hannon-acadimi.test",
      },
    }),
  ]);

  const cours = await prisma.cours.create({
    data: {
      titre: "Anglais professionnel B1",
      description: "Cours hebdomadaire en visio — lundi 18h-20h.",
    },
  });

  const [etudiantA, etudiantB] = await Promise.all([
    prisma.etudiant.create({
      data: {
        nom: "Sofia Martin",
        email: "sofia.martin@hannon-acadimi.test",
      },
    }),
    prisma.etudiant.create({
      data: {
        nom: "Youssef Haddad",
        email: "youssef.haddad@hannon-acadimi.test",
      },
    }),
  ]);

  await prisma.inscription.createMany({
    data: [
      { etudiantId: etudiantA.id, coursId: cours.id },
      { etudiantId: etudiantB.id, coursId: cours.id },
    ],
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
  });

  const aujourdHui = new Date();
  const debutPeriode = new Date(
    Date.UTC(aujourdHui.getUTCFullYear(), aujourdHui.getUTCMonth(), 1),
  );
  const finPeriode = new Date(
    Date.UTC(aujourdHui.getUTCFullYear(), aujourdHui.getUTCMonth() + 4, 0),
  );

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

  // formateurB est seedé pour les tests d'assignation ; pas d'EDT pour l'instant
  void formateurB;

  const counts = await prisma.$transaction([
    prisma.formateur.count(),
    prisma.licenceZoom.count(),
    prisma.emploiDuTemps.count(),
    prisma.cours.count(),
    prisma.etudiant.count(),
  ]);

  console.info("Seed OK", {
    formateurs: counts[0],
    licences: counts[1],
    emploisDuTemps: counts[2],
    cours: counts[3],
    etudiants: counts[4],
  });
}

main()
  .catch((error: unknown) => {
    console.error("Seed échoué", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
