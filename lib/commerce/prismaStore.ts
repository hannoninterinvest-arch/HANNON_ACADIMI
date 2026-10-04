import { Prisma, type PrismaClient } from "@prisma/client";
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

type Db = PrismaClient | Prisma.TransactionClient;

function versCommande(row: {
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
  statut: CommandeStock["statut"];
  typeAcheteur: CommandeStock["typeAcheteur"];
  profilTarif: CommandeStock["profilTarif"];
  seuilApplique: number | null;
  typeRemiseApplique: CommandeStock["typeRemiseApplique"];
  valeurRemiseAppliquee: number | null;
  libelleRemise: string | null;
  fournisseurPaiement: string;
  referenceFournisseur: string | null;
  payeeLe: Date | null;
}): CommandeStock {
  return { ...row };
}

export class PrismaCommerceStore implements CommerceStore {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(fn: (tx: CommerceTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (db) => fn(this.creerTx(db)), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  private creerTx(db: Db): CommerceTx {
    return {
      async lockSession(sessionId) {
        const rows = await db.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE
        `;
        if (rows.length === 0) {
          throw new Error(`Session introuvable : ${sessionId}`);
        }
        const session = await db.session.findUnique({ where: { id: sessionId } });
        if (!session) {
          throw new Error(`Session introuvable : ${sessionId}`);
        }
        const stock: SessionStock = {
          id: session.id,
          capaciteMax: session.capaciteMax,
          statutInscription: session.statutInscription,
          dateReelle: session.dateReelle,
        };
        return stock;
      },
      async definirCapacite(sessionId, capaciteMax) {
        await db.session.update({ where: { id: sessionId }, data: { capaciteMax } });
      },
      async sommeConfirmees(sessionId) {
        const total = await db.commande.aggregate({
          where: { sessionId, statut: "PAYEE" },
          _sum: { quantite: true },
        });
        return total._sum.quantite ?? 0;
      },
      async sommeReservationsActives(sessionId, maintenant) {
        const total = await db.reservationPlaces.aggregate({
          where: { sessionId, statut: "ACTIVE", expireLe: { gt: maintenant } },
          _sum: { quantite: true },
        });
        return total._sum.quantite ?? 0;
      },
      async creerCommande(data: NouvelleCommande) {
        const row = await db.commande.create({
          data: {
            ...data,
            statut: "EN_ATTENTE",
          },
        });
        return versCommande(row);
      },
      async lireCommande(id) {
        const row = await db.commande.findUnique({ where: { id } });
        return row ? versCommande(row) : null;
      },
      async majCommande(id, patch) {
        await db.commande.update({ where: { id }, data: patch });
      },
      async creerReservation(data) {
        const row = await db.reservationPlaces.create({
          data: {
            sessionId: data.sessionId,
            commandeId: data.commandeId,
            quantite: data.quantite,
            expireLe: data.expireLe,
            statut: data.statut ?? "ACTIVE",
          },
        });
        const reservation: ReservationStock = {
          id: row.id,
          sessionId: row.sessionId,
          commandeId: row.commandeId,
          quantite: row.quantite,
          expireLe: row.expireLe,
          statut: row.statut,
        };
        return reservation;
      },
      async lireReservationCommande(commandeId) {
        const row = await db.reservationPlaces.findUnique({ where: { commandeId } });
        if (!row) {
          return null;
        }
        return {
          id: row.id,
          sessionId: row.sessionId,
          commandeId: row.commandeId,
          quantite: row.quantite,
          expireLe: row.expireLe,
          statut: row.statut,
        };
      },
      async majReservation(id, statut: StatutReservationStock) {
        await db.reservationPlaces.update({ where: { id }, data: { statut } });
      },
      async reservationsActivesExpirees(maintenant) {
        const rows = await db.reservationPlaces.findMany({
          where: { statut: "ACTIVE", expireLe: { lte: maintenant } },
        });
        return rows.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          commandeId: row.commandeId,
          quantite: row.quantite,
          expireLe: row.expireLe,
          statut: row.statut,
        }));
      },
      async estMembre(societeId, compteId) {
        const appartenance = await db.appartenance.findUnique({
          where: { compteId_societeId: { compteId, societeId } },
        });
        if (appartenance) {
          return true;
        }
        const compte = await db.compte.findUnique({ where: { id: compteId } });
        return Boolean(compte && compte.societeId === societeId && compte.role === "EMPLOYE");
      },
      async commandesPayeesOrganisation(societeId, sessionId) {
        const rows = await db.commande.findMany({
          where: { societeId, sessionId, statut: "PAYEE" },
          orderBy: { createdAt: "asc" },
        });
        return rows.map(versCommande);
      },
      async affectationsOrganisationSession(societeId, sessionId) {
        const rows = await db.affectation.findMany({ where: { societeId, sessionId } });
        return rows.map((row) => ({
          id: row.id,
          commandeId: row.commandeId,
          societeId: row.societeId,
          sessionId: row.sessionId,
          compteId: row.compteId,
        }));
      },
      async lireAffectation(id) {
        const row = await db.affectation.findUnique({ where: { id } });
        if (!row) {
          return null;
        }
        return {
          id: row.id,
          commandeId: row.commandeId,
          societeId: row.societeId,
          sessionId: row.sessionId,
          compteId: row.compteId,
        };
      },
      async affectationSessionCompte(sessionId, compteId) {
        const row = await db.affectation.findUnique({
          where: { sessionId_compteId: { sessionId, compteId } },
        });
        if (!row) {
          return null;
        }
        return {
          id: row.id,
          commandeId: row.commandeId,
          societeId: row.societeId,
          sessionId: row.sessionId,
          compteId: row.compteId,
        };
      },
      async creerAffectation(data: Omit<AffectationStock, "id">) {
        const row = await db.affectation.create({ data });
        return {
          id: row.id,
          commandeId: row.commandeId,
          societeId: row.societeId,
          sessionId: row.sessionId,
          compteId: row.compteId,
        };
      },
      async supprimerAffectation(id) {
        await db.affectation.delete({ where: { id } });
      },
      async supprimerAffectationsCommande(commandeId) {
        const resultat = await db.affectation.deleteMany({ where: { commandeId } });
        return resultat.count;
      },
    };
  }
}
