import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaCommerceStore } from "@/lib/commerce/prismaStore";
import {
  affecterPlace,
  confirmerPaiement,
  lireDisponibilite,
  reserverPlaces,
} from "@/lib/commerce/moteur";
import { calculerDevis } from "@/lib/commerce/tarifs";

const actif = Boolean(process.env.DATABASE_URL);
const prisma = actif ? new PrismaClient() : null;

describe.skipIf(!actif)("stock PostgreSQL", () => {
  const suffix = `it-${Date.now()}`;
  let coursId = "";
  let sessionId = "";
  let compteId = "";
  let societeId = "";
  const employes: string[] = [];

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    await prisma.commande.deleteMany({ where: { coursId } });
    await prisma.session.deleteMany({ where: { coursId } });
    await prisma.cours.deleteMany({ where: { id: coursId } });
    if (employes.length > 0) {
      await prisma.compte.deleteMany({ where: { id: { in: employes } } });
    }
    if (compteId) {
      await prisma.compte.deleteMany({ where: { id: compteId } });
    }
    if (societeId) {
      await prisma.societe.deleteMany({ where: { id: societeId } });
    }
    await prisma.$disconnect();
  });

  it("empêche la survente et la double confirmation sur la base", async () => {
    if (!prisma) {
      return;
    }
    const store = new PrismaCommerceStore(prisma);
    const cours = await prisma.cours.create({
      data: { titre: `Concurrence ${suffix}`, ouvertB2c: true },
    });
    coursId = cours.id;
    await prisma.tarifFormation.create({
      data: {
        coursId: cours.id,
        prixB2cCentimes: 10000,
        prixOrganisationCentimes: 8000,
        regles: {
          create: {
            seuilQuantite: 10,
            typeRemise: "POURCENTAGE",
            valeur: 15,
            profils: ["B2B", "B2G"],
          },
        },
      },
    });
    const session = await prisma.session.create({
      data: {
        coursId: cours.id,
        dateReelle: new Date("2026-12-01T08:00:00.000Z"),
        dateFin: new Date("2026-12-01T12:00:00.000Z"),
        capaciteMax: 5,
        statutInscription: "OUVERTE",
      },
    });
    sessionId = session.id;
    const compte = await prisma.compte.create({
      data: {
        email: `${suffix}@hannon.test`,
        nom: "Acheteur test",
        motDePasse: "hash",
        role: "ETUDIANT_B2C",
      },
    });
    compteId = compte.id;
    const devis = calculerDevis({
      profil: "B2C",
      quantite: 1,
      prixB2cCentimes: 10000,
      prixOrganisationCentimes: 8000,
      regles: [],
    });
    const maintenant = new Date("2026-10-04T10:00:00.000Z");
    const resultats = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        reserverPlaces(
          store,
          {
            sessionId,
            compteId,
            societeId: null,
            coursId,
            quantite: 1,
            typeAcheteur: "PARTICULIER",
            devis,
            fournisseurPaiement: "test",
            reference: `IT-${suffix}-${index}`,
            ttlMs: 30 * 60 * 1000,
          },
          maintenant,
        ).then(
          (commande) => ({ ok: true as const, id: commande.id }),
          () => ({ ok: false as const, id: "" }),
        ),
      ),
    );
    const succes = resultats.filter((resultat) => resultat.ok);
    expect(succes).toHaveLength(5);
    const reserve = await lireDisponibilite(store, sessionId, maintenant);
    expect(reserve.disponibles).toBe(0);
    expect(reserve.reservees).toBe(5);

    const premiere = succes[0];
    if (!premiere) {
      throw new Error("réservation manquante");
    }
    await confirmerPaiement(store, premiere.id, `pay-${premiere.id}`, maintenant);
    await confirmerPaiement(store, premiere.id, `pay-${premiere.id}`, maintenant);
    const apres = await lireDisponibilite(store, sessionId, maintenant);
    expect(apres.confirmees).toBe(1);
    expect(apres.reservees).toBe(4);
  });

  it("refuse la place au-delà du lot acheté", async () => {
    if (!prisma) {
      return;
    }
    const store = new PrismaCommerceStore(prisma);
    const societe = await prisma.societe.create({
      data: { nom: `Org ${suffix}`, email: `org-${suffix}@hannon.test`, type: "ENTREPRISE" },
    });
    societeId = societe.id;
    const session = await prisma.session.create({
      data: {
        coursId,
        dateReelle: new Date("2027-01-15T08:00:00.000Z"),
        capaciteMax: 20,
        statutInscription: "OUVERTE",
      },
    });
    const devis = calculerDevis({
      profil: "B2B",
      quantite: 2,
      prixB2cCentimes: 10000,
      prixOrganisationCentimes: 8000,
      regles: [
        {
          seuilQuantite: 10,
          typeRemise: "POURCENTAGE",
          valeur: 15,
          profils: ["B2B", "B2G"],
          actif: true,
        },
      ],
    });
    expect(devis.remiseAppliquee).toBe(false);
    expect(devis.totalCentimes).toBe(16000);
    const maintenant = new Date("2026-10-04T10:00:00.000Z");
    const commande = await reserverPlaces(
      store,
      {
        sessionId: session.id,
        compteId,
        societeId,
        coursId,
        quantite: 2,
        typeAcheteur: "ORGANISATION",
        devis,
        fournisseurPaiement: "test",
        reference: `IT-ORG-${suffix}`,
        ttlMs: 30 * 60 * 1000,
      },
      maintenant,
    );
    await confirmerPaiement(store, commande.id, `pay-org-${suffix}`, maintenant);
    for (let index = 0; index < 3; index += 1) {
      const employe = await prisma.compte.create({
        data: {
          email: `emp-${suffix}-${index}@hannon.test`,
          nom: `Employé ${index}`,
          motDePasse: "hash",
          role: "EMPLOYE",
          societeId,
          appartenances: { create: { societeId, role: "APPRENANT" } },
        },
      });
      employes.push(employe.id);
    }
    await affecterPlace({ store, societeId, sessionId: session.id, compteId: employes[0] ?? "" });
    await affecterPlace({ store, societeId, sessionId: session.id, compteId: employes[1] ?? "" });
    await expect(
      affecterPlace({ store, societeId, sessionId: session.id, compteId: employes[2] ?? "" }),
    ).rejects.toMatchObject({ code: "QUOTA_AFFECTATION" });
    const stock = await lireDisponibilite(store, session.id, maintenant);
    expect(stock.confirmees).toBe(2);
    expect(stock.disponibles).toBe(18);
  });
});
