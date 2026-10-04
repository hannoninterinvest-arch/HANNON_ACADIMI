"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { enregistrerDocument } from "@/lib/documents";
import { combinerDateHeure } from "@/lib/format";
import { fixerCapacite } from "@/lib/commerce/service";
import { codeDepuis } from "@/lib/commerce/messages";
import { PrismaCommerceStore } from "@/lib/commerce/prismaStore";
import { rembourserCommande } from "@/lib/commerce/moteur";
import type { ProfilTarif, StatutDemande, StatutOuvertureSession, TypeRemise } from "@prisma/client";

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function entier(form: FormData, key: string): number {
  return Number.parseInt(texte(form, key) || "0", 10);
}

export async function actionAdminTarif(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const prixB2cCentimes = Math.round(Number(texte(form, "prixB2c") || "0") * 100);
  const prixOrganisationCentimes = Math.round(Number(texte(form, "prixOrganisation") || "0") * 100);
  const seuil = entier(form, "seuil") || 10;
  const typeRemise = texte(form, "typeRemise") === "MONTANT_FIXE" ? "MONTANT_FIXE" : "POURCENTAGE";
  const valeur =
    typeRemise === "MONTANT_FIXE"
      ? Math.round(Number(texte(form, "valeur") || "0") * 100)
      : entier(form, "valeur");
  const profils = ["B2B", "B2G"].filter((profil) => form.get(`profil_${profil}`) === "on") as ProfilTarif[];
  if (!coursId || prixB2cCentimes < 0 || prixOrganisationCentimes < 0 || seuil < 1) {
    redirect("/espace/admin/tarifs?erreur=CHAMPS");
  }
  if (typeRemise === "POURCENTAGE" && (valeur < 0 || valeur > 100)) {
    redirect("/espace/admin/tarifs?erreur=CHAMPS");
  }
  const tarif = await prisma.tarifFormation.upsert({
    where: { coursId },
    update: { prixB2cCentimes, prixOrganisationCentimes },
    create: { coursId, prixB2cCentimes, prixOrganisationCentimes },
  });
  await prisma.regleRemise.deleteMany({ where: { tarifId: tarif.id } });
  if (profils.length > 0 && valeur > 0) {
    await prisma.regleRemise.create({
      data: {
        tarifId: tarif.id,
        seuilQuantite: seuil,
        typeRemise: typeRemise as TypeRemise,
        valeur,
        profils,
        actif: true,
      },
    });
  }
  revalidatePath("/espace/admin/tarifs");
  revalidatePath("/catalogue");
  redirect("/espace/admin/tarifs?ok=1");
}

export async function actionAdminSession(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const jour = texte(form, "jour");
  const heureDebut = texte(form, "heureDebut");
  const heureFin = texte(form, "heureFin");
  const fuseau = texte(form, "fuseau") || "Europe/Paris";
  const capaciteMax = entier(form, "capaciteMax");
  const formateurId = texte(form, "formateurId") || null;
  if (!coursId || !jour || !heureDebut || !heureFin || capaciteMax < 1) {
    redirect("/espace/admin/sessions?erreur=CHAMPS");
  }
  let dateReelle: Date;
  let dateFin: Date;
  try {
    dateReelle = combinerDateHeure(jour, heureDebut, fuseau);
    dateFin = combinerDateHeure(jour, heureFin, fuseau);
  } catch {
    redirect("/espace/admin/sessions?erreur=CHAMPS");
  }
  if (dateFin.getTime() <= dateReelle.getTime()) {
    redirect("/espace/admin/sessions?erreur=CHAMPS");
  }
  await prisma.session.create({
    data: {
      coursId,
      formateurId,
      dateReelle,
      dateFin,
      fuseauHoraire: fuseau,
      capaciteMax,
      statutInscription: "OUVERTE",
      statut: "PLANIFIEE",
    },
  });
  revalidatePath("/espace/admin/sessions");
  redirect("/espace/admin/sessions?ok=1");
}

export async function actionAdminSessionModifier(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const sessionId = texte(form, "sessionId");
  const lienZoomManuel = texte(form, "lienZoomManuel") || null;
  const capaciteMax = entier(form, "capaciteMax");
  const statutInscription = texte(form, "statutInscription") as StatutOuvertureSession;
  const statuts: StatutOuvertureSession[] = ["OUVERTE", "FERMEE", "COMPLETE", "ANNULEE"];
  if (!sessionId || !statuts.includes(statutInscription) || capaciteMax < 1) {
    redirect("/espace/admin/sessions?erreur=CHAMPS");
  }
  try {
    await fixerCapacite(sessionId, capaciteMax);
  } catch (error) {
    redirect(`/espace/admin/sessions?erreur=${encodeURIComponent(codeDepuis(error))}`);
  }
  await prisma.session.update({
    where: { id: sessionId },
    data: { lienZoomManuel, statutInscription },
  });
  revalidatePath("/espace/admin/sessions");
  redirect("/espace/admin/sessions?ok=maj");
}

export async function actionAdminDemande(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const id = texte(form, "id");
  const statut = texte(form, "statut") as StatutDemande;
  const autorises: StatutDemande[] = ["NOUVELLE", "EN_COURS", "PROPOSITION_ENVOYEE", "CLOTUREE"];
  if (!id || !autorises.includes(statut)) {
    redirect("/espace/admin/demandes?erreur=CHAMPS");
  }
  await prisma.demandeFormation.update({ where: { id }, data: { statut } });
  redirect("/espace/admin/demandes?ok=1");
}

export async function actionAdminRembourser(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const commandeId = texte(form, "commandeId");
  const store = new PrismaCommerceStore(prisma);
  const resultat = await rembourserCommande(store, commandeId);
  redirect(`/espace/admin/commandes?ok=${resultat.ok ? "rembourse" : "erreur"}&erreur=${resultat.ok ? "" : resultat.code}`);
}

export async function actionAdminRessource(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const titre = texte(form, "titre");
  const fichier = form.get("fichier");
  if (!coursId || !titre || !(fichier instanceof File) || fichier.size === 0) {
    redirect("/espace/admin/documents?erreur=CHAMPS");
  }
  const stocke = await enregistrerDocument("ressources", fichier);
  await prisma.ressourceCours.create({
    data: {
      coursId,
      titre,
      description: texte(form, "description") || null,
      nomFichier: stocke.nom,
      cheminStockage: stocke.chemin,
      typeMime: stocke.typeMime,
    },
  });
  redirect("/espace/admin/documents?ok=ressource");
}

export async function actionAdminCertificat(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const compteId = texte(form, "compteId");
  const coursId = texte(form, "coursId");
  const titre = texte(form, "titre");
  const fichier = form.get("fichier");
  if (!compteId || !coursId || !titre || !(fichier instanceof File) || fichier.size === 0) {
    redirect("/espace/admin/documents?erreur=CHAMPS");
  }
  const stocke = await enregistrerDocument("certificats", fichier);
  await prisma.certificat.create({
    data: {
      compteId,
      coursId,
      sessionId: texte(form, "sessionId") || null,
      titre,
      nomFichier: stocke.nom,
      cheminStockage: stocke.chemin,
      typeMime: stocke.typeMime,
    },
  });
  redirect("/espace/admin/documents?ok=certificat");
}
