"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lireSession, requireUser, type SessionUser } from "@/lib/auth";
import { peutVoirCommande } from "@/lib/acces";
import { getPaymentMode, getPaymentWebhookSecret } from "@/lib/env";
import { codeDepuis } from "@/lib/commerce/messages";
import {
  annulerCommandeEnAttente,
  devisSession,
  ouvrirCommande,
} from "@/lib/commerce/service";
import type { Devis } from "@/lib/commerce/tarifs";
import { evenementDepuisCorpsHannon, traiterEvenementPaiement } from "@/lib/paiement/traiter";
import { signerCorps, verifierSignatureHannon } from "@/lib/paiement/signature";

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

async function contexteAchat(user: SessionUser): Promise<{
  profil: "B2C" | "B2B" | "B2G";
  societeId: string | null;
}> {
  if (user.role === "SOCIETE" && user.societeId) {
    const societe = await prisma.societe.findUnique({ where: { id: user.societeId } });
    return {
      profil: societe?.type === "ORGANISME_PUBLIC" ? "B2G" : "B2B",
      societeId: user.societeId,
    };
  }
  if (user.role === "ETUDIANT_B2C" || user.role === "EMPLOYE") {
    return { profil: "B2C", societeId: null };
  }
  const erreur = new Error("ACHAT_NON_AUTORISE");
  Object.assign(erreur, { code: "ACCES" });
  throw erreur;
}

export async function actionCalculerDevis(
  sessionId: string,
  quantite: number,
): Promise<Devis | { erreur: string }> {
  try {
    const user = await lireSession();
    if (!user) {
      return { erreur: "ACCES" };
    }
    const contexte = await contexteAchat(user);
    const devis = await devisSession({
      sessionId,
      profil: contexte.profil,
      quantite: contexte.profil === "B2C" ? 1 : quantite,
    });
    return devis;
  } catch (error) {
    return { erreur: codeDepuis(error) };
  }
}

export async function actionCreerCommande(form: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = texte(form, "sessionId");
  const quantite = Number.parseInt(texte(form, "quantite") || "1", 10);
  const retour = texte(form, "retour") || "/catalogue";
  let url: string | null = null;
  let erreur = "PAIEMENT";
  try {
    const contexte = await contexteAchat(user);
    const resultat = await ouvrirCommande({
      sessionId,
      compteId: user.id,
      societeId: contexte.societeId,
      profil: contexte.profil,
      quantite,
    });
    url = resultat.url;
  } catch (error) {
    erreur = codeDepuis(error);
  }
  if (url) {
    redirect(url);
  }
  const separateur = retour.includes("?") ? "&" : "?";
  redirect(`${retour}${separateur}erreur=${encodeURIComponent(erreur)}`);
}

export async function actionAnnulerCommande(form: FormData): Promise<void> {
  const user = await requireUser();
  const commandeId = texte(form, "commandeId");
  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  if (!commande || !peutVoirCommande(user, commande)) {
    redirect("/paiement/retour?erreur=ACCES");
  }
  await annulerCommandeEnAttente(commandeId);
  redirect(`/paiement/retour?commande=${commandeId}`);
}

export async function actionSimulerPaiement(form: FormData): Promise<void> {
  const user = await requireUser();
  const commandeId = texte(form, "commandeId");
  if (getPaymentMode() !== "test") {
    redirect(`/paiement/retour?commande=${commandeId}&erreur=MODE`);
  }
  const commande = await prisma.commande.findUnique({ where: { id: commandeId } });
  if (!commande || !peutVoirCommande(user, commande)) {
    redirect("/paiement/retour?erreur=ACCES");
  }
  const issue = texte(form, "issue") === "echec" ? "paiement.echoue" : "paiement.reussi";
  const corps = JSON.stringify({
    type: issue,
    commandeId: commande.id,
    reference: `test_${commande.id}`,
    montantCentimes: commande.totalCentimes,
    devise: commande.devise,
  });
  const signature = signerCorps(getPaymentWebhookSecret(), corps);
  if (!verifierSignatureHannon(getPaymentWebhookSecret(), corps, signature)) {
    redirect(`/paiement/test/${commandeId}?erreur=SIGNATURE`);
  }
  await traiterEvenementPaiement(evenementDepuisCorpsHannon(corps));
  redirect(`/paiement/retour?commande=${commandeId}`);
}
