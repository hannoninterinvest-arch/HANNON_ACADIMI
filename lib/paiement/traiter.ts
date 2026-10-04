import { prisma } from "@/lib/prisma";
import { PrismaCommerceStore } from "@/lib/commerce/prismaStore";
import { synchroniserCandidatureApresRemboursement, synchroniserCandidaturePayee } from "@/lib/groupesSuivi";
import {
  annulerCommande,
  confirmerPaiement,
  echouerPaiement,
  rembourserCommande,
  type ResultatConfirmation,
} from "@/lib/commerce/moteur";

const store = new PrismaCommerceStore(prisma);

export type EvenementPaiement = {
  type: "paiement.reussi" | "paiement.echoue" | "paiement.rembourse" | "paiement.annule";
  commandeId: string;
  reference: string;
  montantCentimes?: number | null;
  devise?: string | null;
};

export async function traiterEvenementPaiement(
  evenement: EvenementPaiement,
  maintenant: Date = new Date(),
): Promise<ResultatConfirmation> {
  const commande = await prisma.commande.findUnique({ where: { id: evenement.commandeId } });
  if (!commande) {
    return { ok: false, code: "COMMANDE_INTROUVABLE", message: "Commande introuvable." };
  }
  if (
    evenement.type === "paiement.reussi" &&
    evenement.montantCentimes != null &&
    (evenement.montantCentimes !== commande.totalCentimes ||
      (evenement.devise && evenement.devise.toLowerCase() !== commande.devise.toLowerCase()))
  ) {
    return { ok: false, code: "MONTANT_INVALIDE", message: "Le montant confirmé ne correspond pas à la commande." };
  }

  if (evenement.type === "paiement.reussi") {
    const resultat = await confirmerPaiement(store, commande.id, evenement.reference, maintenant);
    if (resultat.ok) {
      await synchroniserCandidaturePayee(commande.compteId, commande.sessionId);
    }
    return resultat;
  }
  if (evenement.type === "paiement.echoue") {
    return echouerPaiement(store, commande.id);
  }
  if (evenement.type === "paiement.annule") {
    return annulerCommande(store, commande.id);
  }
  const remboursement = await rembourserCommande(store, commande.id);
  if (remboursement.ok) {
    await synchroniserCandidatureApresRemboursement(commande.compteId, commande.sessionId);
  }
  return remboursement;
}

export function evenementDepuisCorpsHannon(corps: string): EvenementPaiement {
  const json = JSON.parse(corps) as Partial<EvenementPaiement>;
  if (
    json.type !== "paiement.reussi" &&
    json.type !== "paiement.echoue" &&
    json.type !== "paiement.rembourse" &&
    json.type !== "paiement.annule"
  ) {
    throw new Error("EVENEMENT_INVALIDE");
  }
  if (!json.commandeId || !json.reference) {
    throw new Error("EVENEMENT_INVALIDE");
  }
  return {
    type: json.type,
    commandeId: json.commandeId,
    reference: json.reference,
    montantCentimes: json.montantCentimes ?? null,
    devise: json.devise ?? null,
  };
}
