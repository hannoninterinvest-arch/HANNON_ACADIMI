import type {
  AffectationStock,
  CommandeStock,
  CommerceStore,
  CommerceTx,
  NouvelleCommande,
  ReservationStock,
  SessionStock,
  StatutReservationStock,
} from "@/lib/commerce/moteur";

type Etat = {
  sessions: Map<string, SessionStock>;
  commandes: Map<string, CommandeStock>;
  reservations: Map<string, ReservationStock>;
  affectations: Map<string, AffectationStock>;
  membres: Set<string>;
};

function membreCle(societeId: string, compteId: string): string {
  return `${societeId}:${compteId}`;
}

export class MemoireCommerce implements CommerceStore {
  private etat: Etat = {
    sessions: new Map(),
    commandes: new Map(),
    reservations: new Map(),
    affectations: new Map(),
    membres: new Set(),
  };
  private sequence = 0;
  private chaine: Promise<unknown> = Promise.resolve();

  ajouterSession(session: SessionStock): void {
    this.etat.sessions.set(session.id, { ...session });
  }

  ajouterMembre(societeId: string, compteId: string): void {
    this.etat.membres.add(membreCle(societeId, compteId));
  }

  transaction<T>(fn: (tx: CommerceTx) => Promise<T>): Promise<T> {
    const execution = this.chaine.then(() => fn(this.creerTx()));
    this.chaine = execution.then(
      () => undefined,
      () => undefined,
    );
    return execution;
  }

  private identifiant(prefixe: string): string {
    this.sequence += 1;
    return `${prefixe}_${this.sequence}`;
  }

  private creerTx(): CommerceTx {
    const etat = this.etat;
    const identifiant = (prefixe: string) => this.identifiant(prefixe);
    return {
      async lockSession(sessionId) {
        const session = etat.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session introuvable : ${sessionId}`);
        }
        return { ...session };
      },
      async definirCapacite(sessionId, capaciteMax) {
        const session = etat.sessions.get(sessionId);
        if (!session) {
          throw new Error(`Session introuvable : ${sessionId}`);
        }
        session.capaciteMax = capaciteMax;
      },
      async sommeConfirmees(sessionId) {
        return Array.from(etat.commandes.values())
          .filter((commande) => commande.sessionId === sessionId && commande.statut === "PAYEE")
          .reduce((total, commande) => total + commande.quantite, 0);
      },
      async sommeReservationsActives(sessionId, maintenant) {
        return Array.from(etat.reservations.values())
          .filter(
            (reservation) =>
              reservation.sessionId === sessionId &&
              reservation.statut === "ACTIVE" &&
              reservation.expireLe.getTime() > maintenant.getTime(),
          )
          .reduce((total, reservation) => total + reservation.quantite, 0);
      },
      async creerCommande(data: NouvelleCommande) {
        const commande: CommandeStock = {
          ...data,
          id: identifiant("cmd"),
          statut: "EN_ATTENTE",
          referenceFournisseur: null,
          payeeLe: null,
        };
        etat.commandes.set(commande.id, commande);
        return { ...commande };
      },
      async lireCommande(id) {
        const commande = etat.commandes.get(id);
        return commande ? { ...commande } : null;
      },
      async majCommande(id, patch) {
        const commande = etat.commandes.get(id);
        if (!commande) {
          throw new Error(`Commande introuvable : ${id}`);
        }
        Object.assign(commande, patch);
      },
      async creerReservation(data) {
        const reservation: ReservationStock = {
          ...data,
          id: identifiant("res"),
          statut: data.statut ?? "ACTIVE",
        };
        etat.reservations.set(reservation.id, reservation);
        return { ...reservation };
      },
      async lireReservationCommande(commandeId) {
        const reservation = Array.from(etat.reservations.values()).find((item) => item.commandeId === commandeId);
        return reservation ? { ...reservation } : null;
      },
      async majReservation(id, statut: StatutReservationStock) {
        const reservation = etat.reservations.get(id);
        if (!reservation) {
          throw new Error(`Réservation introuvable : ${id}`);
        }
        reservation.statut = statut;
      },
      async reservationsActivesExpirees(maintenant) {
        return Array.from(etat.reservations.values())
          .filter(
            (reservation) =>
              reservation.statut === "ACTIVE" && reservation.expireLe.getTime() <= maintenant.getTime(),
          )
          .map((reservation) => ({ ...reservation }));
      },
      async estMembre(societeId, compteId) {
        return etat.membres.has(membreCle(societeId, compteId));
      },
      async commandesPayeesOrganisation(societeId, sessionId) {
        return Array.from(etat.commandes.values())
          .filter(
            (commande) =>
              commande.societeId === societeId &&
              commande.sessionId === sessionId &&
              commande.statut === "PAYEE",
          )
          .map((commande) => ({ ...commande }));
      },
      async affectationsOrganisationSession(societeId, sessionId) {
        return Array.from(etat.affectations.values())
          .filter((item) => item.societeId === societeId && item.sessionId === sessionId)
          .map((item) => ({ ...item }));
      },
      async lireAffectation(id) {
        const affectation = etat.affectations.get(id);
        return affectation ? { ...affectation } : null;
      },
      async affectationSessionCompte(sessionId, compteId) {
        const affectation = Array.from(etat.affectations.values()).find(
          (item) => item.sessionId === sessionId && item.compteId === compteId,
        );
        return affectation ? { ...affectation } : null;
      },
      async creerAffectation(data) {
        const affectation: AffectationStock = { ...data, id: identifiant("aff") };
        etat.affectations.set(affectation.id, affectation);
        return { ...affectation };
      },
      async supprimerAffectation(id) {
        etat.affectations.delete(id);
      },
      async supprimerAffectationsCommande(commandeId) {
        const ids = Array.from(etat.affectations.entries())
          .filter(([, affectation]) => affectation.commandeId === commandeId)
          .map(([id]) => id);
        ids.forEach((id) => etat.affectations.delete(id));
        return ids.length;
      },
    };
  }
}
