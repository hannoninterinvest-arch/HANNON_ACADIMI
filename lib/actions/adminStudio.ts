"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { RoleCompte, TypeOrganisation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { combinerDateHeure } from "@/lib/format";
import { hasherMotDePasse } from "@/lib/password";
import { enregistrerPhotoFormation } from "@/lib/photos";
import { lireProfilParticulier } from "@/lib/profil";
import { visuelAutorise } from "@/lib/visuels";

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

async function photoDepuisFormulaire(form: FormData): Promise<string | null | undefined> {
  const fichier = form.get("photo");
  if (fichier instanceof File && fichier.size > 0) {
    return enregistrerPhotoFormation(fichier);
  }
  const visuel = texte(form, "visuel");
  if (!visuel) {
    return undefined;
  }
  if (!visuelAutorise(visuel)) {
    throw new Error("PHOTO");
  }
  return visuel;
}

async function creerSessionInitiale(coursId: string, form: FormData): Promise<void> {
  const jour = texte(form, "jour");
  const heureDebut = texte(form, "heureDebut");
  const heureFin = texte(form, "heureFin");
  if (!jour && !heureDebut && !heureFin) {
    return;
  }
  if (!jour || !heureDebut || !heureFin) {
    throw new Error("CHAMPS");
  }
  const dateReelle = combinerDateHeure(jour, heureDebut, "Europe/Paris");
  const dateFin = combinerDateHeure(jour, heureFin, "Europe/Paris");
  if (dateFin.getTime() <= dateReelle.getTime()) {
    throw new Error("CHAMPS");
  }
  const capacite = Number.parseInt(texte(form, "capaciteMax") || "20", 10);
  const formateurId = await formateurDepuisFormulaire(form);
  await prisma.session.create({
    data: {
      coursId,
      formateurId,
      dateReelle,
      dateFin,
      fuseauHoraire: "Europe/Paris",
      capaciteMax: capacite >= 1 ? capacite : 20,
      statutInscription: "OUVERTE",
      statut: "PLANIFIEE",
      lienZoomManuel: texte(form, "lienZoomManuel") || null,
      codeReunion: texte(form, "codeReunion") || null,
    },
  });
}

async function formateurDepuisFormulaire(form: FormData): Promise<string | null> {
  const formateurId = texte(form, "formateurId");
  if (!formateurId) {
    return null;
  }
  const formateur = await prisma.formateur.findUnique({ where: { id: formateurId }, select: { id: true } });
  if (!formateur) {
    throw new Error("CHAMPS");
  }
  return formateur.id;
}

export async function actionAdminFormationComplet(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const titre = texte(form, "titre");
  if (!titre) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  try {
    const imageChemin = await photoDepuisFormulaire(form);
    const cours = await prisma.cours.create({
      data: {
        titre,
        domaine: texte(form, "domaine") || null,
        description: texte(form, "description") || null,
        horaire: texte(form, "horaire") || null,
        imageChemin: imageChemin ?? null,
        ouvertB2c: true,
      },
    });
    const prixB2c = Math.round(Number(texte(form, "prixB2c") || "0") * 100);
    const prixOrganisation = Math.round(Number(texte(form, "prixOrganisation") || "0") * 100);
    if (prixB2c > 0) {
      await prisma.tarifFormation.create({
        data: {
          coursId: cours.id,
          prixB2cCentimes: prixB2c,
          prixOrganisationCentimes: prixOrganisation > 0 ? prixOrganisation : prixB2c,
        },
      });
    }
    try {
      await creerSessionInitiale(cours.id, form);
    } catch (error) {
      await prisma.cours.delete({ where: { id: cours.id } });
      throw error;
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "CHAMPS";
    redirect(`/espace/admin/formations?erreur=${code === "PHOTO" || code === "CHAMPS" ? code : "CHAMPS"}`);
  }
  revalidatePath("/catalogue");
  redirect("/espace/admin/formations?ok=formation");
}

export async function actionAdminFormationModifier(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const titre = texte(form, "titre");
  if (!coursId || !titre) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  const actuel = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!actuel) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  let imageChemin = actuel.imageChemin;
  try {
    const photo = await photoDepuisFormulaire(form);
    if (photo !== undefined) {
      imageChemin = photo;
    }
    if (form.get("retirerPhoto") === "on") {
      imageChemin = null;
    }
    await prisma.cours.update({
      where: { id: coursId },
      data: {
        titre,
        domaine: texte(form, "domaine") || null,
        description: texte(form, "description") || null,
        horaire: texte(form, "horaire") || null,
        imageChemin,
      },
    });
    const sessionId = texte(form, "sessionId");
    if (sessionId) {
      const session = await prisma.session.findFirst({ where: { id: sessionId, coursId } });
      if (!session) {
        throw new Error("CHAMPS");
      }
      const jour = texte(form, "jour");
      const heureDebut = texte(form, "heureDebut");
      const heureFin = texte(form, "heureFin");
      const data: {
        lienZoomManuel: string | null;
        codeReunion: string | null;
        formateurId: string | null;
        dateReelle?: Date;
        dateFin?: Date;
      } = {
        lienZoomManuel: texte(form, "lienZoomManuel") || null,
        codeReunion: texte(form, "codeReunion") || null,
        formateurId: await formateurDepuisFormulaire(form),
      };
      if (jour && heureDebut && heureFin) {
        data.dateReelle = combinerDateHeure(jour, heureDebut, "Europe/Paris");
        data.dateFin = combinerDateHeure(jour, heureFin, "Europe/Paris");
        if (data.dateFin.getTime() <= data.dateReelle.getTime()) {
          throw new Error("CHAMPS");
        }
      }
      await prisma.session.update({ where: { id: sessionId }, data });
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "CHAMPS";
    redirect(`/espace/admin/formations?erreur=${code === "PHOTO" || code === "CHAMPS" ? code : "CHAMPS"}`);
  }
  revalidatePath("/catalogue");
  redirect("/espace/admin/formations?ok=formation");
}

export async function actionAdminFormationSupprimer(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  if (!coursId || form.get("confirmer") !== "on") {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  const [payees, certificats] = await Promise.all([
    prisma.commande.count({ where: { coursId, statut: "PAYEE" } }),
    prisma.certificat.count({ where: { coursId } }),
  ]);
  if (payees > 0 || certificats > 0) {
    redirect("/espace/admin/formations?erreur=LIEE");
  }
  await prisma.$transaction(async (tx) => {
    const sessions = await tx.session.findMany({
      where: { OR: [{ coursId }, { emploiDuTemps: { coursId } }] },
      select: { id: true },
    });
    const ids = sessions.map((session) => session.id);
    if (ids.length > 0) {
      await tx.licenceZoom.updateMany({
        where: { sessionIdEnCours: { in: ids } },
        data: { sessionIdEnCours: null, statut: "LIBRE" },
      });
      await tx.commande.deleteMany({ where: { sessionId: { in: ids } } });
      await tx.session.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.emploiDuTemps.deleteMany({ where: { coursId } });
    await tx.inscription.deleteMany({ where: { coursId } });
    await tx.achatPlaces.deleteMany({ where: { coursId } });
    await tx.cours.delete({ where: { id: coursId } });
  });
  revalidatePath("/catalogue");
  redirect("/espace/admin/formations?ok=suppression");
}

export async function actionAdminCompteCreer(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const email = texte(form, "email").toLowerCase();
  const motDePasse = String(form.get("motDePasse") ?? "");
  const roleDemande = texte(form, "role");
  const role: RoleCompte = roleDemande === "ADMIN" ? "ADMIN" : "ETUDIANT_B2C";
  const profil = role === "ETUDIANT_B2C" ? lireProfilParticulier(form) : null;
  const nom = role === "ADMIN" ? texte(form, "nom") : profil?.nomComplet ?? "";
  if (!nom || !email || motDePasse.length < 8 || (role === "ETUDIANT_B2C" && !profil)) {
    redirect("/espace/admin/comptes?erreur=CHAMPS");
  }
  if (await prisma.compte.findUnique({ where: { email } })) {
    redirect("/espace/admin/comptes?erreur=EMAIL");
  }
  const hash = await hasherMotDePasse(motDePasse);
  if (role === "ADMIN") {
    await prisma.compte.create({ data: { nom, email, motDePasse: hash, role: "ADMIN" } });
  } else if (profil) {
    const etudiant = await prisma.etudiant.create({
      data: {
        nom: profil.nom,
        prenom: profil.prenom,
        email,
        telephone: profil.telephone,
        niveauEtude: profil.niveauEtude,
        situation: profil.situation,
        ville: profil.ville,
        dateNaissance: profil.dateNaissance,
      },
    });
    await prisma.compte.create({
      data: { nom: profil.nomComplet, email, motDePasse: hash, role: "ETUDIANT_B2C", etudiantId: etudiant.id },
    });
  }
  redirect("/espace/admin/comptes?ok=compte");
}

export async function actionAdminSocieteCreer(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const nomSociete = texte(form, "nomSociete");
  const nom = texte(form, "nom");
  const email = texte(form, "email").toLowerCase();
  const telephone = texte(form, "telephone") || null;
  const motDePasse = String(form.get("motDePasse") ?? "");
  const type: TypeOrganisation = texte(form, "typeOrganisation") === "ORGANISME_PUBLIC" ? "ORGANISME_PUBLIC" : "ENTREPRISE";
  if (!nomSociete || !nom || !email || motDePasse.length < 8) {
    redirect("/espace/admin/comptes?erreur=CHAMPS");
  }
  if (
    (await prisma.compte.findUnique({ where: { email } })) ||
    (await prisma.societe.findUnique({ where: { email } }))
  ) {
    redirect("/espace/admin/comptes?erreur=EMAIL");
  }
  const societe = await prisma.societe.create({ data: { nom: nomSociete, email, telephone, type } });
  await prisma.compte.create({
    data: {
      nom,
      email,
      motDePasse: await hasherMotDePasse(motDePasse),
      role: "SOCIETE",
      societeId: societe.id,
      appartenances: { create: { societeId: societe.id, role: "RESPONSABLE" } },
    },
  });
  redirect("/espace/admin/comptes?ok=societe");
}

export async function actionAdminCompteModifier(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const compteId = texte(form, "compteId");
  const nom = texte(form, "nom");
  const email = texte(form, "email").toLowerCase();
  const motDePasse = String(form.get("motDePasse") ?? "");
  if (!compteId || !nom || !email) {
    redirect("/espace/admin/comptes?erreur=CHAMPS");
  }
  const occupe = await prisma.compte.findFirst({ where: { email, NOT: { id: compteId } } });
  if (occupe) {
    redirect("/espace/admin/comptes?erreur=EMAIL");
  }
  await prisma.compte.update({
    where: { id: compteId },
    data: {
      nom,
      email,
      ...(motDePasse.length >= 8 ? { motDePasse: await hasherMotDePasse(motDePasse) } : {}),
    },
  });
  const compte = await prisma.compte.findUnique({ where: { id: compteId } });
  if (compte?.etudiantId) {
    await prisma.etudiant.update({ where: { id: compte.etudiantId }, data: { nom, email } });
  }
  redirect("/espace/admin/comptes?ok=maj");
}

export async function actionAdminCompteSupprimer(form: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const compteId = texte(form, "compteId");
  if (!compteId || form.get("confirmer") !== "on") {
    redirect("/espace/admin/comptes?erreur=CHAMPS");
  }
  if (compteId === admin.id) {
    redirect("/espace/admin/comptes?erreur=SOI");
  }
  const compte = await prisma.compte.findUnique({ where: { id: compteId } });
  if (!compte) {
    redirect("/espace/admin/comptes?erreur=CHAMPS");
  }
  if (compte.role === "ADMIN") {
    const autres = await prisma.compte.count({ where: { role: "ADMIN", NOT: { id: compteId } } });
    if (autres < 1) {
      redirect("/espace/admin/comptes?erreur=DERNIER_ADMIN");
    }
  }
  const [commandes, affectations] = await Promise.all([
    prisma.commande.count({ where: { compteId } }),
    prisma.affectation.count({ where: { compteId } }),
  ]);
  if (commandes > 0 || affectations > 0) {
    redirect("/espace/admin/comptes?erreur=COMPTE_LIE");
  }
  await prisma.appartenance.deleteMany({ where: { compteId } });
  await prisma.compte.delete({ where: { id: compteId } });
  if (compte.etudiantId) {
    await prisma.inscription.deleteMany({ where: { etudiantId: compte.etudiantId } });
    await prisma.etudiant.delete({ where: { id: compte.etudiantId } }).catch(() => undefined);
  }
  redirect("/espace/admin/comptes?ok=suppression");
}

export async function actionAdminSocieteSupprimer(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const societeId = texte(form, "societeId");
  if (!societeId || form.get("confirmer") !== "on") {
    redirect("/espace/admin/comptes?erreur=CHAMPS");
  }
  const commandes = await prisma.commande.count({ where: { societeId } });
  if (commandes > 0) {
    redirect("/espace/admin/comptes?erreur=SOCIETE_LIEE");
  }
  const comptes = await prisma.compte.findMany({ where: { societeId }, select: { id: true, etudiantId: true } });
  const ids = comptes.map((compte) => compte.id);
  const lies = ids.length
    ? await prisma.commande.count({ where: { compteId: { in: ids } } })
    : 0;
  if (lies > 0) {
    redirect("/espace/admin/comptes?erreur=COMPTE_LIE");
  }
  await prisma.$transaction(async (tx) => {
    await tx.appartenance.deleteMany({ where: { societeId } });
    await tx.invitation.deleteMany({ where: { societeId } });
    await tx.demandeFormation.updateMany({ where: { societeId }, data: { societeId: null } });
    if (ids.length > 0) {
      await tx.compte.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.societe.delete({ where: { id: societeId } });
  });
  redirect("/espace/admin/comptes?ok=suppression");
}
