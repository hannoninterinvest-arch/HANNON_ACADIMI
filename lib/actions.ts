"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JourSemaine, RoleCompte } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  creerCookieSession,
  cheminEspace,
  requireRole,
  requireUser,
  supprimerCookieSession,
  type SessionUser,
} from "@/lib/auth";
import { hasherMotDePasse, verifierMotDePasse } from "@/lib/password";

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function sessionDepuisCompte(compte: {
  id: string;
  email: string;
  nom: string;
  role: RoleCompte;
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

export async function actionConnexion(form: FormData): Promise<void> {
  const email = texte(form, "email").toLowerCase();
  const motDePasse = String(form.get("motDePasse") ?? "");
  const compte = await prisma.compte.findUnique({ where: { email } });
  if (!compte || !(await verifierMotDePasse(motDePasse, compte.motDePasse))) {
    redirect("/connexion?erreur=identifiants");
  }
  await creerCookieSession(sessionDepuisCompte(compte));
  const suivant = texte(form, "next");
  if (suivant.startsWith("/") && !suivant.startsWith("//")) {
    redirect(suivant);
  }
  redirect(cheminEspace(compte.role));
}

export async function actionDeconnexion(): Promise<void> {
  await supprimerCookieSession();
  redirect("/");
}

export async function actionInscriptionB2c(form: FormData): Promise<void> {
  const nom = texte(form, "nom");
  const email = texte(form, "email").toLowerCase();
  const motDePasse = String(form.get("motDePasse") ?? "");
  if (!nom || !email || motDePasse.length < 8) {
    redirect("/inscription?erreur=champs");
  }
  const existe = await prisma.compte.findUnique({ where: { email } });
  if (existe) {
    redirect("/inscription?erreur=email");
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
      role: RoleCompte.ETUDIANT_B2C,
      etudiantId: etudiant.id,
    },
  });
  await creerCookieSession(sessionDepuisCompte(compte));
  redirect("/espace/etudiant");
}

export async function actionInscriptionSociete(): Promise<void> {
  redirect("/inscription?erreur=particulier");
}

export async function actionAdminFormateur(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const nom = texte(form, "nom");
  const email = texte(form, "email").toLowerCase();
  const motDePasse = String(form.get("motDePasse") ?? "Hannon2026!");
  if (!nom || !email) {
    redirect("/espace/admin/formateurs?erreur=champs");
  }
  const formateur = await prisma.formateur.upsert({
    where: { email },
    update: { nom },
    create: { nom, email },
  });
  await prisma.compte.upsert({
    where: { email },
    update: { nom, role: "FORMATEUR", formateurId: formateur.id },
    create: {
      nom,
      email,
      motDePasse: await hasherMotDePasse(motDePasse),
      role: "FORMATEUR",
      formateurId: formateur.id,
    },
  });
  revalidatePath("/espace/admin/formateurs");
  redirect("/espace/admin/formateurs?ok=1");
}

export async function actionAdminFormation(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const titre = texte(form, "titre");
  const description = texte(form, "description");
  if (!titre) {
    redirect("/espace/admin/formations?erreur=champs");
  }
  await prisma.cours.create({
    data: { titre, description: description || null, ouvertB2c: true },
  });
  revalidatePath("/espace/admin/formations");
  redirect("/espace/admin/formations?ok=1");
}

export async function actionAdminEdt(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const formateurId = texte(form, "formateurId");
  const jourSemaine = texte(form, "jourSemaine") as JourSemaine;
  const heureDebut = texte(form, "heureDebut");
  const dureeMinutes = Number.parseInt(texte(form, "dureeMinutes") || "120", 10);
  const dateDebutPeriode = new Date(texte(form, "dateDebutPeriode"));
  const dateFinPeriode = new Date(texte(form, "dateFinPeriode"));
  if (!coursId || !formateurId || !heureDebut) {
    redirect("/espace/admin/emploi-du-temps?erreur=champs");
  }
  await prisma.emploiDuTemps.create({
    data: {
      coursId,
      formateurId,
      jourSemaine,
      heureDebut,
      dureeMinutes,
      dateDebutPeriode,
      dateFinPeriode,
    },
  });
  revalidatePath("/espace/admin/emploi-du-temps");
  redirect("/espace/admin/emploi-du-temps?ok=1");
}

export async function actionAdminLicenceZoom(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const compteEmail = texte(form, "compteEmail").toLowerCase();
  const zoomUserId = texte(form, "zoomUserId");
  const hostKey = texte(form, "hostKey") || null;
  if (!compteEmail || !zoomUserId) {
    redirect("/espace/admin/zoom?erreur=champs");
  }
  await prisma.licenceZoom.upsert({
    where: { compteEmail },
    update: { zoomUserId, hostKey, statut: "LIBRE" },
    create: { compteEmail, zoomUserId, hostKey, statut: "LIBRE" },
  });
  revalidatePath("/espace/admin/zoom");
  redirect("/espace/admin/zoom?ok=1");
}

export async function actionEtudiantInscription(): Promise<void> {
  await requireRole("ETUDIANT_B2C");
  redirect("/catalogue");
}

export async function actionSocieteAchat(): Promise<void> {
  await requireRole("SOCIETE");
  redirect("/catalogue");
}

export async function actionSocieteEmploye(): Promise<void> {
  await requireRole("SOCIETE");
  redirect("/espace/societe/equipe");
}

export async function actionRequireUser(): Promise<SessionUser> {
  return requireUser();
}
