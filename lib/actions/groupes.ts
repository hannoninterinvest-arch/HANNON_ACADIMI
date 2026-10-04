"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth";
import { combinerDateHeure } from "@/lib/format";
import { PrismaCommerceStore } from "@/lib/commerce/prismaStore";
import { confirmerPaiement, reduireCapacite, reserverPlaces } from "@/lib/commerce/moteur";
import { codeDepuis } from "@/lib/commerce/messages";
import { devisSession, ouvrirCommande, referenceCommande } from "@/lib/commerce/service";
import { getReservationTtlMs } from "@/lib/env";
import { peutCreerGroupe, peutOuvrirPaiement } from "@/lib/groupes";
import { synchroniserCandidaturePayee } from "@/lib/groupesSuivi";

const store = new PrismaCommerceStore(prisma);

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function echec(code: string): never {
  throw Object.assign(new Error(code), { code });
}

function retourGroupe(coursId: string, code: string, ok = false): never {
  redirect(`/espace/admin/formations/${coursId}?${ok ? "ok" : "erreur"}=${code}`);
}

function effectifDepuis(valeur: string, actuel: number): number {
  if (!valeur) {
    return actuel;
  }
  const nombre = Number.parseInt(valeur, 10);
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 500) {
    echec("CHAMPS");
  }
  return nombre;
}

export async function actionCandidature(form: FormData): Promise<void> {
  const user = await requireUser();
  const coursId = texte(form, "coursId");
  const message = texte(form, "message");
  if (!coursId) {
    redirect("/catalogue?erreur=CHAMPS");
  }
  if (user.role !== "ETUDIANT_B2C" && user.role !== "EMPLOYE") {
    redirect(`/formations/${coursId}?erreur=PARTICULIER`);
  }
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { id: true, ouvertB2c: true } });
  if (!cours || !cours.ouvertB2c) {
    redirect("/catalogue?erreur=CHAMPS");
  }
  const existe = await prisma.candidature.findUnique({ where: { coursId_compteId: { coursId, compteId: user.id } } });
  if (existe && existe.statut !== "ANNULEE") {
    redirect(`/formations/${coursId}?erreur=CANDIDATURE`);
  }
  if (existe) {
    await prisma.candidature.update({
      where: { id: existe.id },
      data: { statut: "EN_ATTENTE", message: message || null, groupeId: null },
    });
  } else {
    await prisma.candidature.create({
      data: { coursId, compteId: user.id, message: message || null, statut: "EN_ATTENTE" },
    });
  }
  revalidatePath(`/formations/${coursId}`);
  redirect(`/formations/${coursId}?ok=candidature`);
}

export async function actionAdminEffectif(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { effectifMinimal: true } });
  if (!cours) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  try {
    const effectifMinimal = effectifDepuis(texte(form, "effectifMinimal"), cours.effectifMinimal);
    await prisma.cours.update({ where: { id: coursId }, data: { effectifMinimal } });
  } catch (error) {
    retourGroupe(coursId, codeDepuis(error));
  }
  revalidatePath(`/formations/${coursId}`);
  retourGroupe(coursId, "groupe", true);
}

export async function actionCreerGroupe(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const coursId = texte(form, "coursId");
  const cours = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!cours) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  const disponibles = await prisma.candidature.count({
    where: { coursId, groupeId: null, statut: { in: ["EN_ATTENTE", "CONTACTE"] } },
  });
  if (!peutCreerGroupe(disponibles, cours.effectifMinimal)) {
    retourGroupe(coursId, "MINIMUM");
  }
  const deja = await prisma.groupe.count({ where: { coursId } });
  const nom = texte(form, "nom") || `Groupe ${deja + 1}`;
  await prisma.groupe.create({
    data: { coursId, nom, effectifMinimal: cours.effectifMinimal },
  });
  retourGroupe(coursId, "groupe", true);
}

export async function actionEnregistrerGroupe(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const groupeId = texte(form, "groupeId");
  const groupe = await prisma.groupe.findUnique({
    where: { id: groupeId },
    include: { candidatures: true },
  });
  if (!groupe) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  const coursId = groupe.coursId;
  try {
    const formateurId = texte(form, "formateurId");
    if (formateurId) {
      const formateur = await prisma.formateur.findUnique({ where: { id: formateurId }, select: { id: true } });
      if (!formateur) {
        echec("CHAMPS");
      }
    }
    const jour = texte(form, "jour");
    const heureDebut = texte(form, "heureDebut");
    const heureFin = texte(form, "heureFin");
    let dateDebut = groupe.dateDebut;
    let dateFin = groupe.dateFin;
    if (jour || heureDebut || heureFin) {
      if (!jour || !heureDebut || !heureFin) {
        echec("CHAMPS");
      }
      try {
        dateDebut = combinerDateHeure(jour, heureDebut, "Europe/Paris");
        dateFin = combinerDateHeure(jour, heureFin, "Europe/Paris");
      } catch {
        echec("CHAMPS");
      }
      if (dateFin.getTime() <= dateDebut.getTime()) {
        echec("CHAMPS");
      }
    }
    const membres = form.getAll("membreId").map((valeur) => String(valeur));
    const payes = groupe.candidatures.filter((candidature) => candidature.statut === "PAYEE").map((candidature) => candidature.compteId);
    if (payes.some((compteId) => !membres.includes(compteId))) {
      echec("DEJA_PAYE");
    }
    const candidatures = membres.length
      ? await prisma.candidature.findMany({ where: { coursId, compteId: { in: membres } } })
      : [];
    if (candidatures.length !== new Set(membres).size) {
      echec("CHAMPS");
    }
    for (const candidature of candidatures) {
      if (candidature.groupeId && candidature.groupeId !== groupe.id) {
        echec("DEJA_GROUPE");
      }
      if (candidature.statut === "ANNULEE") {
        echec("CHAMPS");
      }
    }
    const retires = groupe.candidatures.filter(
      (candidature) => candidature.statut !== "PAYEE" && !membres.includes(candidature.compteId),
    );
    await prisma.$transaction(async (tx) => {
      if (retires.length > 0) {
        await tx.candidature.updateMany({
          where: { id: { in: retires.map((candidature) => candidature.id) } },
          data: { groupeId: null, statut: "EN_ATTENTE" },
        });
      }
      if (candidatures.length > 0) {
        await tx.candidature.updateMany({
          where: { id: { in: candidatures.filter((candidature) => candidature.statut !== "PAYEE").map((candidature) => candidature.id) } },
          data: { groupeId: groupe.id, statut: "DANS_GROUPE" },
        });
      }
      await tx.groupe.update({
        where: { id: groupe.id },
        data: {
          nom: texte(form, "nom") || groupe.nom,
          horaire: texte(form, "horaire") || null,
          lienZoom: texte(form, "lienZoom") || null,
          codeReunion: texte(form, "codeReunion") || null,
          formateurId: formateurId || null,
          dateDebut,
          dateFin,
        },
      });
      if (groupe.sessionId) {
        await tx.session.update({
          where: { id: groupe.sessionId },
          data: {
            formateurId: formateurId || null,
            lienZoomManuel: texte(form, "lienZoom") || null,
            codeReunion: texte(form, "codeReunion") || null,
            ...(dateDebut && dateFin ? { dateReelle: dateDebut, dateFin } : {}),
          },
        });
      }
    });
    if (groupe.sessionId && membres.length >= 1) {
      await reduireCapacite(store, groupe.sessionId, membres.length, new Date());
    }
  } catch (error) {
    retourGroupe(coursId, codeDepuis(error));
  }
  revalidatePath(`/formations/${coursId}`);
  revalidatePath("/espace/etudiant");
  retourGroupe(coursId, "groupe", true);
}

export async function actionOuvrirPaiement(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const groupeId = texte(form, "groupeId");
  const groupe = await prisma.groupe.findUnique({
    where: { id: groupeId },
    include: { cours: { include: { tarif: true } }, candidatures: true },
  });
  if (!groupe) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  const coursId = groupe.coursId;
  try {
    const personnes = groupe.candidatures.filter((candidature) => candidature.statut === "DANS_GROUPE" || candidature.statut === "PAYEE").length;
    if (!peutOuvrirPaiement(personnes, groupe.effectifMinimal, groupe.paiementOuvert)) {
      echec("MINIMUM");
    }
    if (!groupe.dateDebut || !groupe.dateFin) {
      echec("DATE");
    }
    if (!groupe.cours.tarif) {
      echec("TARIF_MANQUANT");
    }
    const session = await prisma.session.create({
      data: {
        coursId,
        formateurId: groupe.formateurId,
        dateReelle: groupe.dateDebut,
        dateFin: groupe.dateFin,
        fuseauHoraire: "Europe/Paris",
        capaciteMax: personnes,
        statutInscription: "OUVERTE",
        statut: "PLANIFIEE",
        lienZoomManuel: groupe.lienZoom,
        codeReunion: groupe.codeReunion,
      },
    });
    await prisma.groupe.update({
      where: { id: groupe.id },
      data: { sessionId: session.id, paiementOuvert: true },
    });
  } catch (error) {
    retourGroupe(coursId, codeDepuis(error));
  }
  revalidatePath(`/formations/${coursId}`);
  retourGroupe(coursId, "paiement", true);
}

export async function actionConfirmerEspeces(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const candidatureId = texte(form, "candidatureId");
  const candidature = await prisma.candidature.findUnique({
    where: { id: candidatureId },
    include: { groupe: true },
  });
  if (!candidature?.groupe?.sessionId || !candidature.groupe.paiementOuvert) {
    redirect("/espace/admin/formations?erreur=PAIEMENT_FERME");
  }
  const coursId = candidature.coursId;
  if (candidature.statut === "PAYEE") {
    retourGroupe(coursId, "especes", true);
  }
  if (candidature.statut !== "DANS_GROUPE") {
    retourGroupe(coursId, "CHAMPS");
  }
  try {
    const enAttente = await prisma.commande.findFirst({
      where: { compteId: candidature.compteId, sessionId: candidature.groupe.sessionId, statut: "EN_ATTENTE" },
    });
    let commandeId = enAttente?.id ?? null;
    if (commandeId) {
      const confirmationExistante = await confirmerPaiement(store, commandeId, `especes_${commandeId}`, new Date());
      if (confirmationExistante.ok) {
        await prisma.commande.update({ where: { id: commandeId }, data: { fournisseurPaiement: "especes" } });
        await synchroniserCandidaturePayee(candidature.compteId, candidature.groupe.sessionId);
        revalidatePath("/espace/etudiant");
        retourGroupe(coursId, "especes", true);
      }
      if (confirmationExistante.code !== "RESERVATION_EXPIREE" && confirmationExistante.code !== "RESERVATION_ABSENTE") {
        echec(confirmationExistante.code);
      }
      commandeId = null;
    }
    if (!commandeId) {
      const devis = await devisSession({ sessionId: candidature.groupe.sessionId, profil: "B2C", quantite: 1 });
      const commande = await reserverPlaces(
        store,
        {
          sessionId: candidature.groupe.sessionId,
          compteId: candidature.compteId,
          societeId: null,
          coursId,
          quantite: 1,
          typeAcheteur: "PARTICULIER",
          devis,
          fournisseurPaiement: "especes",
          reference: referenceCommande(),
          ttlMs: getReservationTtlMs(),
        },
        new Date(),
      );
      commandeId = commande.id;
    }
    const confirmation = await confirmerPaiement(store, commandeId, `especes_${commandeId}`, new Date());
    if (!confirmation.ok) {
      echec(confirmation.code);
    }
    await prisma.commande.update({ where: { id: commandeId }, data: { fournisseurPaiement: "especes" } });
    await synchroniserCandidaturePayee(candidature.compteId, candidature.groupe.sessionId);
  } catch (error) {
    retourGroupe(coursId, codeDepuis(error));
  }
  revalidatePath("/espace/etudiant");
  retourGroupe(coursId, "especes", true);
}

export async function actionContacterCandidat(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const candidatureId = texte(form, "candidatureId");
  const candidature = await prisma.candidature.findUnique({ where: { id: candidatureId } });
  if (!candidature) {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  if (candidature.statut === "EN_ATTENTE") {
    await prisma.candidature.update({ where: { id: candidature.id }, data: { statut: "CONTACTE" } });
  }
  retourGroupe(candidature.coursId, "contact", true);
}

export async function actionPayerGroupe(form: FormData): Promise<void> {
  const user = await requireUser();
  const candidatureId = texte(form, "candidatureId");
  const candidature = await prisma.candidature.findUnique({ where: { id: candidatureId }, include: { groupe: true } });
  const retour = candidature ? `/formations/${candidature.coursId}` : "/espace/etudiant";
  if (!candidature || candidature.compteId !== user.id || !candidature.groupe?.sessionId) {
    redirect(`${retour}?erreur=PAIEMENT_FERME`);
  }
  if (candidature.statut === "PAYEE") {
    redirect("/espace/etudiant?ok=achat");
  }
  let url: string | null = null;
  let erreur = "PAIEMENT";
  try {
    const resultat = await ouvrirCommande({
      sessionId: candidature.groupe.sessionId,
      compteId: user.id,
      societeId: null,
      profil: "B2C",
      quantite: 1,
    });
    url = resultat.url;
  } catch (error) {
    erreur = codeDepuis(error);
  }
  if (url) {
    redirect(url);
  }
  redirect(`${retour}?erreur=${encodeURIComponent(erreur)}`);
}

export async function actionSupprimerGroupe(form: FormData): Promise<void> {
  await requireRole("ADMIN");
  const groupeId = texte(form, "groupeId");
  const groupe = await prisma.groupe.findUnique({
    where: { id: groupeId },
    include: { candidatures: true },
  });
  if (!groupe || form.get("confirmer") !== "on") {
    redirect("/espace/admin/formations?erreur=CHAMPS");
  }
  if (groupe.candidatures.some((candidature) => candidature.statut === "PAYEE") || groupe.paiementOuvert) {
    retourGroupe(groupe.coursId, "GROUPE_LIE");
  }
  await prisma.$transaction(async (tx) => {
    await tx.candidature.updateMany({
      where: { groupeId: groupe.id },
      data: { groupeId: null, statut: "EN_ATTENTE" },
    });
    await tx.groupe.delete({ where: { id: groupe.id } });
  });
  retourGroupe(groupe.coursId, "suppression", true);
}
