import { randomBytes } from "node:crypto";
import type { ProfilTarif, TypeRemise } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPaymentMode, getReservationTtlMs } from "@/lib/env";
import { creerSessionPaiement } from "@/lib/paiement/provider";
import { PrismaCommerceStore } from "@/lib/commerce/prismaStore";
import {
  affecterPlace,
  annulerCommande,
  desaffecterPlace,
  expirerReservations,
  lireDisponibilite,
  reduireCapacite,
  reserverPlaces,
} from "@/lib/commerce/moteur";
import { calculerDevis, type Devis, type RegleRemiseSaisie } from "@/lib/commerce/tarifs";

const store = new PrismaCommerceStore(prisma);

export function referenceCommande(): string {
  return `HA-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`.toUpperCase();
}

export async function disponibiliteSession(sessionId: string, maintenant = new Date()) {
  return lireDisponibilite(store, sessionId, maintenant);
}

export async function disponibilitesSessions(sessionIds: string[], maintenant = new Date()) {
  if (sessionIds.length === 0) {
    return new Map<string, { capaciteMax: number; confirmees: number; reservees: number; disponibles: number }>();
  }
  const sessions = await prisma.session.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, capaciteMax: true },
  });
  const [confirmees, reservees] = await Promise.all([
    prisma.commande.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: sessionIds }, statut: "PAYEE" },
      _sum: { quantite: true },
    }),
    prisma.reservationPlaces.groupBy({
      by: ["sessionId"],
      where: { sessionId: { in: sessionIds }, statut: "ACTIVE", expireLe: { gt: maintenant } },
      _sum: { quantite: true },
    }),
  ]);
  const confirmeesMap = new Map(confirmees.map((ligne) => [ligne.sessionId, ligne._sum.quantite ?? 0]));
  const reserveesMap = new Map(reservees.map((ligne) => [ligne.sessionId, ligne._sum.quantite ?? 0]));
  return new Map(
    sessions.map((session) => {
      const occupeesConfirmees = confirmeesMap.get(session.id) ?? 0;
      const occupeesReservees = reserveesMap.get(session.id) ?? 0;
      return [
        session.id,
        {
          capaciteMax: session.capaciteMax,
          confirmees: occupeesConfirmees,
          reservees: occupeesReservees,
          disponibles: Math.max(0, session.capaciteMax - occupeesConfirmees - occupeesReservees),
        },
      ] as const;
    }),
  );
}

function versRegles(
  regles: Array<{
    seuilQuantite: number;
    typeRemise: TypeRemise;
    valeur: number;
    profils: ProfilTarif[];
    actif: boolean;
  }>,
): RegleRemiseSaisie[] {
  return regles.map((regle) => ({
    seuilQuantite: regle.seuilQuantite,
    typeRemise: regle.typeRemise,
    valeur: regle.valeur,
    profils: regle.profils,
    actif: regle.actif,
  }));
}

export async function devisSession(input: {
  sessionId: string;
  profil: "B2C" | "B2B" | "B2G";
  quantite: number;
}): Promise<Devis> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: { cours: { include: { tarif: { include: { regles: true } } } }, emploiDuTemps: { include: { cours: { include: { tarif: { include: { regles: true } } } } } } },
  });
  if (!session) {
    throw new Error("SESSION_INTROUVABLE");
  }
  const cours = session.cours ?? session.emploiDuTemps?.cours;
  if (!cours?.tarif) {
    throw new Error("TARIF_MANQUANT");
  }
  const quantite = input.profil === "B2C" ? 1 : input.quantite;
  return calculerDevis({
    profil: input.profil,
    quantite,
    prixB2cCentimes: cours.tarif.prixB2cCentimes,
    prixOrganisationCentimes: cours.tarif.prixOrganisationCentimes,
    regles: versRegles(cours.tarif.regles),
  });
}

export async function ouvrirCommande(input: {
  sessionId: string;
  compteId: string;
  societeId: string | null;
  profil: "B2C" | "B2B" | "B2G";
  quantite: number;
}): Promise<{ commandeId: string; url: string; modeTest: boolean }> {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: {
      cours: true,
      emploiDuTemps: { include: { cours: true } },
    },
  });
  if (!session) {
    throw new Error("SESSION_INTROUVABLE");
  }
  const cours = session.cours ?? session.emploiDuTemps?.cours;
  if (!cours) {
    throw new Error("COURS_INTROUVABLE");
  }
  const groupe = await prisma.groupe.findUnique({ where: { sessionId: session.id } });
  if (groupe) {
    const retenu = await prisma.candidature.findFirst({
      where: {
        groupeId: groupe.id,
        compteId: input.compteId,
        statut: { in: ["DANS_GROUPE", "PAYEE"] },
      },
    });
    if (!groupe.paiementOuvert || !retenu || retenu.statut === "PAYEE" || input.profil !== "B2C") {
      const code = retenu?.statut === "PAYEE" ? "DEJA_PAYE" : "PAIEMENT_FERME";
      throw Object.assign(new Error(code), { code });
    }
  }
  const devis = await devisSession(input);
  const typeAcheteur = input.profil === "B2C" ? "PARTICULIER" : "ORGANISATION";
  const commande = await reserverPlaces(
    store,
    {
      sessionId: session.id,
      compteId: input.compteId,
      societeId: typeAcheteur === "ORGANISATION" ? input.societeId : null,
      coursId: cours.id,
      quantite: devis.quantite,
      typeAcheteur,
      devis,
      fournisseurPaiement: getPaymentMode(),
      reference: referenceCommande(),
      ttlMs: getReservationTtlMs(),
    },
    new Date(),
  );
  try {
    const paiement = await creerSessionPaiement({
      id: commande.id,
      quantite: commande.quantite,
      totalCentimes: commande.totalCentimes,
      prixUnitaireCentimes: commande.prixUnitaireCentimes,
      remiseUnitaireCentimes: commande.remiseUnitaireCentimes,
      titre: cours.titre,
    });
    return { commandeId: commande.id, url: paiement.url, modeTest: paiement.modeTest };
  } catch (error) {
    await annulerCommande(store, commande.id);
    throw error;
  }
}

export async function annulerCommandeEnAttente(commandeId: string) {
  return annulerCommande(store, commandeId);
}

export async function affecterEmploye(input: { societeId: string; sessionId: string; compteId: string }) {
  return affecterPlace({ store, ...input });
}

export async function retirerEmploye(input: { societeId: string; affectationId: string }) {
  return desaffecterPlace({ store, ...input, maintenant: new Date() });
}

export async function fixerCapacite(sessionId: string, capaciteMax: number) {
  return reduireCapacite(store, sessionId, capaciteMax, new Date());
}

export async function libererReservationsExpirees() {
  return expirerReservations(store, new Date());
}
