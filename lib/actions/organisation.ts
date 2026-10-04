"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { creerCookieSession, lireSession, requireRole, type SessionUser } from "@/lib/auth";
import { getAppUrl, getEmailEnv, hasEmailCredentials } from "@/lib/env";
import { poserFlash } from "@/lib/flash";
import {
  genererJetonInvitation,
  hasherJetonInvitation,
  parserCsvEmployes,
  preparerDemande,
} from "@/lib/invitations";
import { affecterEmploye, retirerEmploye } from "@/lib/commerce/service";
import { codeDepuis } from "@/lib/commerce/messages";
import { hasherMotDePasse } from "@/lib/password";

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

async function societeConnectee() {
  const user = await requireRole("SOCIETE");
  if (!user.societeId) {
    redirect("/espace/societe?erreur=CHAMPS");
  }
  return user;
}

async function prevenirInvitation(email: string, organisation: string, url: string): Promise<boolean> {
  if (!hasEmailCredentials()) {
    return false;
  }
  const { apiKey, from } = getEmailEnv();
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `Invitation à rejoindre ${organisation}`,
    html: `<p>Vous êtes invité à rejoindre <strong>${organisation}</strong> sur Hannon Acadimi.</p><p><a href="${url}">Définir votre accès</a></p>`,
  });
  return !error;
}

async function creerInvitation(societeId: string, nom: string, email: string) {
  const existant = await prisma.compte.findUnique({ where: { email } });
  if (existant?.role === "ADMIN") {
    return { ignore: "admin" as const, lien: null };
  }
  const deja = await prisma.appartenance.findFirst({
    where: { societeId, compte: { email } },
  });
  if (deja) {
    return { ignore: "membre" as const, lien: null };
  }
  const jeton = genererJetonInvitation();
  const expireLe = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.invitation.updateMany({
    where: { societeId, email, accepteeLe: null },
    data: { expireLe: new Date() },
  });
  await prisma.invitation.create({
    data: {
      societeId,
      email,
      nom: nom || existant?.nom || email,
      jetonHash: hasherJetonInvitation(jeton),
      expireLe,
      compteExistantId: existant?.id ?? null,
    },
  });
  return { ignore: null, lien: `${getAppUrl()}/invitation/${jeton}`, email, existant: Boolean(existant) };
}

export async function actionInviterEmploye(form: FormData): Promise<void> {
  const user = await societeConnectee();
  const nom = texte(form, "nom");
  const email = texte(form, "email").toLowerCase();
  if (!nom || !email) {
    redirect("/espace/societe/equipe?erreur=CHAMPS");
  }
  const societe = await prisma.societe.findUnique({ where: { id: user.societeId ?? "" } });
  const invitation = await creerInvitation(user.societeId ?? "", nom, email);
  if (invitation.ignore === "admin") {
    redirect("/espace/societe/equipe?erreur=ACCES");
  }
  if (invitation.ignore === "membre") {
    redirect("/espace/societe/equipe?erreur=DEJA_AFFECTE");
  }
  const envoye = invitation.lien
    ? await prevenirInvitation(email, societe?.nom ?? "votre organisation", invitation.lien)
    : false;
  if (!envoye && invitation.lien) {
    await poserFlash({ liens: [invitation.lien] });
  }
  redirect(`/espace/societe/equipe?ok=${invitation.existant ? "rattachement" : "invitation"}`);
}

export async function actionCreerCompteEmploye(form: FormData): Promise<void> {
  const user = await societeConnectee();
  const nom = texte(form, "nom");
  const email = texte(form, "email").toLowerCase();
  const motDePasse = String(form.get("motDePasse") ?? "");
  if (!nom || !email || motDePasse.length < 8 || !user.societeId) {
    redirect("/espace/societe/equipe?erreur=CHAMPS");
  }
  if (await prisma.compte.findUnique({ where: { email } })) {
    redirect("/espace/societe/equipe?erreur=EMAIL");
  }
  await prisma.compte.create({
    data: {
      nom,
      email,
      motDePasse: await hasherMotDePasse(motDePasse),
      role: "EMPLOYE",
      societeId: user.societeId,
      appartenances: { create: { societeId: user.societeId, role: "APPRENANT" } },
    },
  });
  redirect("/espace/societe/equipe?ok=employe");
}

export async function actionImporterCsv(form: FormData): Promise<void> {
  const user = await societeConnectee();
  const fichier = form.get("fichier");
  const contenu =
    fichier instanceof File ? await fichier.text() : texte(form, "contenu");
  const lignes = parserCsvEmployes(contenu);
  if (lignes.length === 0) {
    redirect("/espace/societe/equipe?erreur=CHAMPS");
  }
  if (lignes.length > 200) {
    redirect("/espace/societe/equipe?erreur=QUANTITE_INVALIDE");
  }
  const societe = await prisma.societe.findUnique({ where: { id: user.societeId ?? "" } });
  const liens: string[] = [];
  let creees = 0;
  for (const ligne of lignes) {
    const invitation = await creerInvitation(user.societeId ?? "", ligne.nom, ligne.email);
    if (invitation.lien) {
      creees += 1;
      const envoye = await prevenirInvitation(ligne.email, societe?.nom ?? "votre organisation", invitation.lien);
      if (!envoye) {
        liens.push(invitation.lien);
      }
    }
  }
  if (liens.length > 0) {
    await poserFlash({ liens: liens.slice(0, 20) });
  }
  redirect(`/espace/societe/equipe?ok=csv&nombre=${creees}`);
}

export async function actionAffecterEmploye(form: FormData): Promise<void> {
  const user = await societeConnectee();
  const sessionId = texte(form, "sessionId");
  const compteId = texte(form, "compteId");
  try {
    await affecterEmploye({ societeId: user.societeId ?? "", sessionId, compteId });
  } catch (error) {
    redirect(`/espace/societe?erreur=${encodeURIComponent(codeDepuis(error))}`);
  }
  redirect("/espace/societe?ok=affectation");
}

export async function actionDesaffecterEmploye(form: FormData): Promise<void> {
  const user = await societeConnectee();
  const affectationId = texte(form, "affectationId");
  try {
    await retirerEmploye({ societeId: user.societeId ?? "", affectationId });
  } catch (error) {
    redirect(`/espace/societe?erreur=${encodeURIComponent(codeDepuis(error))}`);
  }
  redirect("/espace/societe?ok=desaffectation");
}

export async function actionDemandeFormation(form: FormData): Promise<void> {
  const session = await lireSession();
  const coursId = texte(form, "coursId");
  const sujetPersonnalise = texte(form, "sujetPersonnalise");
  if (!coursId && !sujetPersonnalise) {
    redirect("/demande?erreur=CHAMPS");
  }
  let prepare;
  try {
    prepare = preparerDemande({
      organisationNom: texte(form, "organisationNom"),
      contactNom: texte(form, "contactNom"),
      email: texte(form, "email").toLowerCase(),
      telephone: texte(form, "telephone"),
      sujet: sujetPersonnalise || "Formation du catalogue",
      nbParticipants: Number.parseInt(texte(form, "nbParticipants") || "0", 10),
      periodeSouhaitee: texte(form, "periodeSouhaitee"),
      message: texte(form, "message"),
    });
  } catch {
    redirect("/demande?erreur=CHAMPS");
  }
  if (prepare.reserveDesPlaces) {
    redirect("/demande?erreur=INATTENDUE");
  }
  await prisma.demandeFormation.create({
    data: {
      societeId: session?.role === "SOCIETE" ? session.societeId : null,
      organisationNom: prepare.donnees.organisationNom,
      contactNom: prepare.donnees.contactNom,
      email: prepare.donnees.email,
      telephone: prepare.donnees.telephone,
      coursId: coursId || null,
      sujetPersonnalise: sujetPersonnalise || null,
      nbParticipants: prepare.donnees.nbParticipants,
      periodeSouhaitee: prepare.donnees.periodeSouhaitee,
      message: prepare.donnees.message,
      statut: "NOUVELLE",
    },
  });
  redirect("/demande?ok=1");
}

function sessionDepuisCompte(compte: {
  id: string;
  email: string;
  nom: string;
  role: SessionUser["role"];
  societeId: string | null;
  formateurId: string | null;
  etudiantId: string | null;
}): SessionUser {
  return {
    id: compte.id,
    email: compte.email,
    nom: compte.nom,
    role: compte.role,
    societeId: compte.societeId,
    formateurId: compte.formateurId,
    etudiantId: compte.etudiantId,
  };
}

export async function actionAccepterInvitation(form: FormData): Promise<void> {
  const jeton = texte(form, "jeton");
  const motDePasse = String(form.get("motDePasse") ?? "");
  const invitation = await prisma.invitation.findUnique({
    where: { jetonHash: hasherJetonInvitation(jeton) },
    include: { societe: true },
  });
  if (!invitation || invitation.accepteeLe || invitation.expireLe.getTime() < Date.now()) {
    redirect("/connexion?erreur=invitation");
  }

  if (invitation.compteExistantId) {
    const session = await lireSession();
    if (!session) {
      redirect(`/connexion?next=${encodeURIComponent(`/invitation/${jeton}`)}`);
    }
    if (session.id !== invitation.compteExistantId || session.role === "ADMIN") {
      redirect(`/invitation/${jeton}?erreur=compte`);
    }
    await prisma.appartenance.upsert({
      where: { compteId_societeId: { compteId: session.id, societeId: invitation.societeId } },
      update: {},
      create: { compteId: session.id, societeId: invitation.societeId, role: "APPRENANT" },
    });
    if (!session.etudiantId) {
      const etudiant = await prisma.etudiant.upsert({
        where: { email: session.email },
        update: { nom: session.nom },
        create: { nom: session.nom, email: session.email },
      });
      await prisma.compte.update({
        where: { id: session.id },
        data: { etudiantId: etudiant.id },
      });
      await creerCookieSession({ ...session, etudiantId: etudiant.id });
    }
    await prisma.invitation.update({ where: { id: invitation.id }, data: { accepteeLe: new Date() } });
    redirect("/espace/etudiant?ok=rattachement");
  }

  if (motDePasse.length < 8) {
    redirect(`/invitation/${jeton}?erreur=champs`);
  }
  const nom = texte(form, "nom") || invitation.nom;
  const email = invitation.email.toLowerCase();
  if (await prisma.compte.findUnique({ where: { email } })) {
    redirect(`/invitation/${jeton}?erreur=email`);
  }
  const etudiant = await prisma.etudiant.upsert({
    where: { email },
    update: { nom },
    create: { nom, email },
  });
  const compte = await prisma.compte.create({
    data: {
      nom,
      email,
      motDePasse: await hasherMotDePasse(motDePasse),
      role: "EMPLOYE",
      societeId: invitation.societeId,
      etudiantId: etudiant.id,
    },
  });
  await prisma.appartenance.create({
    data: { compteId: compte.id, societeId: invitation.societeId, role: "APPRENANT" },
  });
  await prisma.invitation.update({ where: { id: invitation.id }, data: { accepteeLe: new Date() } });
  await creerCookieSession(sessionDepuisCompte(compte));
  redirect("/espace/etudiant?ok=invitation");
}
