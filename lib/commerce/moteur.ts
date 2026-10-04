import type { Devis, ProfilTarif, TypeRemise } from "@/lib/commerce/tarifs";

export type StatutInscriptionSession = "OUVERTE" | "FERMEE" | "COMPLETE" | "ANNULEE";
export type StatutCommandeStock = "EN_ATTENTE" | "PAYEE" | "ECHOUEE" | "ANNULEE" | "REMBOURSEE";
export type StatutReservationStock = "ACTIVE" | "CONFIRMEE" | "LIBEREE" | "EXPIREE";
export type TypeAcheteurStock = "PARTICULIER" | "ORGANISATION";

export class RegleMetierError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RegleMetierError";
    this.code = code;
  }
}

export type SessionStock = {
  id: string;
  capaciteMax: number;
  statutInscription: StatutInscriptionSession;
  dateReelle: Date;
};

export type CommandeStock = {
  id: string;
  reference: string;
  compteId: string;
  societeId: string | null;
  coursId: string;
  sessionId: string;
  quantite: number;
  prixUnitaireCentimes: number;
  remiseUnitaireCentimes: number;
  totalCentimes: number;
  devise: string;
  statut: StatutCommandeStock;
  typeAcheteur: TypeAcheteurStock;
  profilTarif: ProfilTarif;
  seuilApplique: number | null;
  typeRemiseApplique: TypeRemise | null;
  valeurRemiseAppliquee: number | null;
  libelleRemise: string | null;
  fournisseurPaiement: string;
  referenceFournisseur: string | null;
  payeeLe: Date | null;
};

export type ReservationStock = {
  id: string;
  sessionId: string;
  commandeId: string;
  quantite: number;
  expireLe: Date;
  statut: StatutReservationStock;
};

export type AffectationStock = {
  id: string;
  commandeId: string;
  societeId: string;
  sessionId: string;
  compteId: string;
};

export type NouvelleCommande = Omit<CommandeStock, "id" | "statut" | "referenceFournisseur" | "payeeLe">;

export interface CommerceTx {
  lockSession(sessionId: string): Promise<SessionStock>;
  definirCapacite(sessionId: string, capaciteMax: number): Promise<void>;
  sommeConfirmees(sessionId: string): Promise<number>;
  sommeReservationsActives(sessionId: string, maintenant: Date): Promise<number>;
  creerCommande(data: NouvelleCommande): Promise<CommandeStock>;
  lireCommande(id: string): Promise<CommandeStock | null>;
  majCommande(
    id: string,
    patch: Partial<Pick<CommandeStock, "statut" | "referenceFournisseur" | "payeeLe">>,
  ): Promise<void>;
  creerReservation(data: Omit<ReservationStock, "id" | "statut"> & { statut?: StatutReservationStock }): Promise<ReservationStock>;
  lireReservationCommande(commandeId: string): Promise<ReservationStock | null>;
  majReservation(id: string, statut: StatutReservationStock): Promise<void>;
  reservationsActivesExpirees(maintenant: Date): Promise<ReservationStock[]>;
  estMembre(societeId: string, compteId: string): Promise<boolean>;
  commandesPayeesOrganisation(societeId: string, sessionId: string): Promise<CommandeStock[]>;
  affectationsOrganisationSession(societeId: string, sessionId: string): Promise<AffectationStock[]>;
  lireAffectation(id: string): Promise<AffectationStock | null>;
  affectationSessionCompte(sessionId: string, compteId: string): Promise<AffectationStock | null>;
  creerAffectation(data: Omit<AffectationStock, "id">): Promise<AffectationStock>;
  supprimerAffectation(id: string): Promise<void>;
  supprimerAffectationsCommande(commandeId: string): Promise<number>;
}

export interface CommerceStore {
  transaction<T>(fn: (tx: CommerceTx) => Promise<T>): Promise<T>;
}

export function placesDisponibles(
  capaciteMax: number,
  confirmees: number,
  reservationsActives: number,
): number {
  return Math.max(0, capaciteMax - confirmees - reservationsActives);
}

export async function lireDisponibilite(
  store: CommerceStore,
  sessionId: string,
  maintenant: Date,
): Promise<{ capaciteMax: number; confirmees: number; reservees: number; disponibles: number }> {
  return store.transaction(async (tx) => {
    const session = await tx.lockSession(sessionId);
    const confirmees = await tx.sommeConfirmees(sessionId);
    const reservees = await tx.sommeReservationsActives(sessionId, maintenant);
    return {
      capaciteMax: session.capaciteMax,
      confirmees,
      reservees,
      disponibles: placesDisponibles(session.capaciteMax, confirmees, reservees),
    };
  });
}

export async function reserverPlaces(
  store: CommerceStore,
  demande: {
    sessionId: string;
    compteId: string;
    societeId: string | null;
    coursId: string;
    quantite: number;
    typeAcheteur: TypeAcheteurStock;
    devis: Devis;
    fournisseurPaiement: string;
    reference: string;
    ttlMs: number;
  },
  maintenant: Date,
): Promise<CommandeStock> {
  if (!Number.isInteger(demande.quantite) || demande.quantite < 1) {
    throw new RegleMetierError("QUANTITE_INVALIDE", "La quantité demandée est invalide.");
  }
  if (demande.typeAcheteur === "PARTICULIER" && demande.quantite !== 1) {
    throw new RegleMetierError("QUANTITE_INVALIDE", "Un particulier achète une place pour lui-même.");
  }
  if (demande.typeAcheteur === "ORGANISATION" && !demande.societeId) {
    throw new RegleMetierError("ORGANISATION_REQUISE", "Une organisation est requise pour cet achat.");
  }
  if (demande.devis.quantite !== demande.quantite || demande.devis.totalCentimes < 0) {
    throw new RegleMetierError("MONTANT_INVALIDE", "Le montant calculé est incohérent.");
  }

  return store.transaction(async (tx) => {
    const session = await tx.lockSession(demande.sessionId);
    if (session.statutInscription !== "OUVERTE") {
      throw new RegleMetierError("SESSION_FERMEE", "Les inscriptions sont fermées pour cette session.");
    }
    const confirmees = await tx.sommeConfirmees(demande.sessionId);
    const reservees = await tx.sommeReservationsActives(demande.sessionId, maintenant);
    const disponibles = placesDisponibles(session.capaciteMax, confirmees, reservees);
    if (disponibles < demande.quantite) {
      throw new RegleMetierError(
        "STOCK_INSUFFISANT",
        `Il reste ${disponibles} place(s) disponible(s) sur cette session.`,
      );
    }
    const commande = await tx.creerCommande({
      reference: demande.reference,
      compteId: demande.compteId,
      societeId: demande.societeId,
      coursId: demande.coursId,
      sessionId: demande.sessionId,
      quantite: demande.quantite,
      prixUnitaireCentimes: demande.devis.prixUnitaireCentimes,
      remiseUnitaireCentimes: demande.devis.remiseUnitaireCentimes,
      totalCentimes: demande.devis.totalCentimes,
      devise: demande.devis.devise,
      typeAcheteur: demande.typeAcheteur,
      profilTarif: demande.devis.profil,
      seuilApplique: demande.devis.seuil,
      typeRemiseApplique: demande.devis.typeRemise,
      valeurRemiseAppliquee: demande.devis.valeurRemise,
      libelleRemise: demande.devis.libelle,
      fournisseurPaiement: demande.fournisseurPaiement,
    });
    await tx.creerReservation({
      sessionId: demande.sessionId,
      commandeId: commande.id,
      quantite: demande.quantite,
      expireLe: new Date(maintenant.getTime() + demande.ttlMs),
    });
    return commande;
  });
}

export type ResultatConfirmation =
  | { ok: true; dejaConfirmee: boolean }
  | { ok: false; code: string; message: string };

export async function confirmerPaiement(
  store: CommerceStore,
  commandeId: string,
  referenceFournisseur: string,
  maintenant: Date,
): Promise<ResultatConfirmation> {
  return store.transaction(async (tx) => {
    const commande = await tx.lireCommande(commandeId);
    if (!commande) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    await tx.lockSession(commande.sessionId);
    const fraiche = await tx.lireCommande(commandeId);
    if (!fraiche) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    if (fraiche.statut === "PAYEE") {
      return { ok: true, dejaConfirmee: true };
    }
    if (fraiche.statut !== "EN_ATTENTE") {
      return {
        ok: false,
        code: "STATUT_INVALIDE",
        message: "Cette commande ne peut plus être confirmée.",
      };
    }
    const reservation = await tx.lireReservationCommande(commandeId);
    if (!reservation || reservation.statut !== "ACTIVE") {
      return { ok: false, code: "RESERVATION_ABSENTE", message: "La réservation n'est plus active." };
    }
    if (reservation.expireLe.getTime() <= maintenant.getTime()) {
      await tx.majReservation(reservation.id, "EXPIREE");
      await tx.majCommande(commandeId, { statut: "ANNULEE" });
      return { ok: false, code: "RESERVATION_EXPIREE", message: "La réservation a expiré." };
    }
    await tx.majReservation(reservation.id, "CONFIRMEE");
    await tx.majCommande(commandeId, {
      statut: "PAYEE",
      referenceFournisseur,
      payeeLe: maintenant,
    });
    return { ok: true, dejaConfirmee: false };
  });
}

export async function echouerPaiement(
  store: CommerceStore,
  commandeId: string,
): Promise<ResultatConfirmation> {
  return store.transaction(async (tx) => {
    const commande = await tx.lireCommande(commandeId);
    if (!commande) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    await tx.lockSession(commande.sessionId);
    const fraiche = await tx.lireCommande(commandeId);
    if (!fraiche) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    if (fraiche.statut === "ECHOUEE" || fraiche.statut === "ANNULEE") {
      return { ok: true, dejaConfirmee: true };
    }
    if (fraiche.statut === "PAYEE" || fraiche.statut === "REMBOURSEE") {
      return { ok: false, code: "STATUT_INVALIDE", message: "Un paiement déjà confirmé ne passe pas en échec." };
    }
    const reservation = await tx.lireReservationCommande(commandeId);
    if (reservation && reservation.statut === "ACTIVE") {
      await tx.majReservation(reservation.id, "LIBEREE");
    }
    await tx.majCommande(commandeId, { statut: "ECHOUEE" });
    return { ok: true, dejaConfirmee: false };
  });
}

export async function annulerCommande(
  store: CommerceStore,
  commandeId: string,
): Promise<ResultatConfirmation> {
  return store.transaction(async (tx) => {
    const commande = await tx.lireCommande(commandeId);
    if (!commande) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    await tx.lockSession(commande.sessionId);
    const fraiche = await tx.lireCommande(commandeId);
    if (!fraiche) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    if (fraiche.statut === "ANNULEE") {
      return { ok: true, dejaConfirmee: true };
    }
    if (fraiche.statut !== "EN_ATTENTE") {
      return { ok: false, code: "STATUT_INVALIDE", message: "Seule une commande en attente peut être annulée." };
    }
    const reservation = await tx.lireReservationCommande(commandeId);
    if (reservation && reservation.statut === "ACTIVE") {
      await tx.majReservation(reservation.id, "LIBEREE");
    }
    await tx.majCommande(commandeId, { statut: "ANNULEE" });
    return { ok: true, dejaConfirmee: false };
  });
}

export async function rembourserCommande(
  store: CommerceStore,
  commandeId: string,
): Promise<ResultatConfirmation> {
  return store.transaction(async (tx) => {
    const commande = await tx.lireCommande(commandeId);
    if (!commande) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    await tx.lockSession(commande.sessionId);
    const fraiche = await tx.lireCommande(commandeId);
    if (!fraiche) {
      return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
    }
    if (fraiche.statut === "REMBOURSEE") {
      return { ok: true, dejaConfirmee: true };
    }
    if (fraiche.statut !== "PAYEE") {
      return { ok: false, code: "STATUT_INVALIDE", message: "Seule une commande payée peut être remboursée." };
    }
    await tx.supprimerAffectationsCommande(commandeId);
    await tx.majCommande(commandeId, { statut: "REMBOURSEE" });
    return { ok: true, dejaConfirmee: false };
  });
}

export async function expirerReservations(
  store: CommerceStore,
  maintenant: Date,
): Promise<number> {
  const candidates = await store.transaction(async (tx) => tx.reservationsActivesExpirees(maintenant));
  let compteur = 0;
  for (const reservation of candidates) {
    const resultat = await store.transaction(async (tx) => {
      const commande = await tx.lireCommande(reservation.commandeId);
      if (!commande) {
        return false;
      }
      await tx.lockSession(commande.sessionId);
      const fraiche = await tx.lireReservationCommande(reservation.commandeId);
      const etat = await tx.lireCommande(reservation.commandeId);
      if (!fraiche || !etat) {
        return false;
      }
      if (fraiche.statut !== "ACTIVE" || etat.statut !== "EN_ATTENTE") {
        return false;
      }
      if (fraiche.expireLe.getTime() > maintenant.getTime()) {
        return false;
      }
      await tx.majReservation(fraiche.id, "EXPIREE");
      await tx.majCommande(etat.id, { statut: "ANNULEE" });
      return true;
    });
    if (resultat) {
      compteur += 1;
    }
  }
  return compteur;
}

export async function reduireCapacite(
  store: CommerceStore,
  sessionId: string,
  nouvelleCapacite: number,
  maintenant: Date,
): Promise<void> {
  if (!Number.isInteger(nouvelleCapacite) || nouvelleCapacite < 1) {
    throw new RegleMetierError("CAPACITE_INVALIDE", "La capacité doit être un entier supérieur ou égal à 1.");
  }
  await store.transaction(async (tx) => {
    await tx.lockSession(sessionId);
    const confirmees = await tx.sommeConfirmees(sessionId);
    const reservees = await tx.sommeReservationsActives(sessionId, maintenant);
    if (nouvelleCapacite < confirmees + reservees) {
      throw new RegleMetierError(
        "CAPACITE_TROP_BASSE",
        `La capacité ne peut pas passer sous ${confirmees + reservees} place(s) déjà confirmée(s) ou réservée(s).`,
      );
    }
    await tx.definirCapacite(sessionId, nouvelleCapacite);
  });
}

export async function affecterPlace(input: {
  store: CommerceStore;
  societeId: string;
  sessionId: string;
  compteId: string;
}): Promise<AffectationStock> {
  return input.store.transaction(async (tx) => {
    await tx.lockSession(input.sessionId);
    const membre = await tx.estMembre(input.societeId, input.compteId);
    if (!membre) {
      throw new RegleMetierError(
        "HORS_ORGANISATION",
        "Cet utilisateur n'appartient pas à l'organisation.",
      );
    }
    const deja = await tx.affectationSessionCompte(input.sessionId, input.compteId);
    if (deja) {
      throw new RegleMetierError(
        "DEJA_AFFECTE",
        "Cet employé est déjà inscrit à cette session.",
      );
    }
    const commandes = await tx.commandesPayeesOrganisation(input.societeId, input.sessionId);
    const affectations = await tx.affectationsOrganisationSession(input.societeId, input.sessionId);
    const achetees = commandes.reduce((total, commande) => total + commande.quantite, 0);
    if (affectations.length >= achetees) {
      throw new RegleMetierError(
        "QUOTA_AFFECTATION",
        "Toutes les places achetées sont déjà affectées.",
      );
    }
    const commande = commandes.find((candidate) => {
      const utilisees = affectations.filter((item) => item.commandeId === candidate.id).length;
      return utilisees < candidate.quantite;
    });
    if (!commande) {
      throw new RegleMetierError(
        "QUOTA_AFFECTATION",
        "Toutes les places achetées sont déjà affectées.",
      );
    }
    return tx.creerAffectation({
      commandeId: commande.id,
      societeId: input.societeId,
      sessionId: input.sessionId,
      compteId: input.compteId,
    });
  });
}

export async function desaffecterPlace(input: {
  store: CommerceStore;
  societeId: string;
  affectationId: string;
  maintenant: Date;
}): Promise<void> {
  await input.store.transaction(async (tx) => {
    const cible = await tx.lireAffectation(input.affectationId);
    if (!cible || cible.societeId !== input.societeId) {
      throw new RegleMetierError("AFFECTATION_INTROUVABLE", "Affectation introuvable pour cette organisation.");
    }
    const session = await tx.lockSession(cible.sessionId);
    if (session.dateReelle.getTime() <= input.maintenant.getTime()) {
      throw new RegleMetierError(
        "SESSION_COMMENCEE",
        "La désaffectation n'est plus possible après le début de la session.",
      );
    }
    await tx.supprimerAffectation(cible.id);
  });
}
