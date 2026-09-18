import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getEmailEnv, hasEmailCredentials } from "@/lib/env";

export type TypeNotification = "CREATION" | "MODIFICATION" | "ANNULATION";

const SUJETS: Record<TypeNotification, string> = {
  CREATION: "Votre cours en visio a été planifié",
  MODIFICATION: "Modification de votre cours en visio",
  ANNULATION: "Annulation de votre cours en visio",
};

function htmlPour(type: TypeNotification, params: {
  coursTitre: string;
  dateReelle: Date;
  formateurNom: string;
  joinUrl: string | null;
}): string {
  const dateFmt = params.dateReelle.toLocaleString("fr-FR", {
    timeZone: process.env.APP_TIMEZONE ?? "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const intro =
    type === "ANNULATION"
      ? `Le cours <strong>${params.coursTitre}</strong> prévu le ${dateFmt} avec ${params.formateurNom} est <strong>annulé</strong>.`
      : type === "MODIFICATION"
        ? `Le cours <strong>${params.coursTitre}</strong> a été <strong>modifié</strong>. Nouvelle date/heure : ${dateFmt} (formateur : ${params.formateurNom}).`
        : `Le cours <strong>${params.coursTitre}</strong> est planifié le ${dateFmt} avec ${params.formateurNom}.`;

  const lien = params.joinUrl
    ? `<p>Lien de connexion étudiants : <a href="${params.joinUrl}">${params.joinUrl}</a></p>`
    : "";

  return `<p>${intro}</p>${lien}<p>— Hannon Acadimi</p>`;
}

export async function notifierChangement(
  sessionId: string,
  type: TypeNotification,
): Promise<{ envoyes: number; ignores: boolean }> {
  if (!hasEmailCredentials()) {
    logger.warn("notifierChangement ignoré : RESEND_API_KEY / RESEND_FROM_EMAIL manquants", {
      sessionId,
      type,
    });
    return { envoyes: 0, ignores: true };
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      emploiDuTemps: {
        include: {
          cours: {
            include: { inscriptions: { include: { etudiant: true } } },
          },
          formateur: true,
        },
      },
    },
  });

  if (!session) {
    logger.error("notifierChangement : session introuvable", { sessionId, type });
    throw new Error(`Session introuvable : ${sessionId}`);
  }

  const destinataires = session.emploiDuTemps.cours.inscriptions.map(
    (inscription) => inscription.etudiant.email,
  );

  if (destinataires.length === 0) {
    logger.info("notifierChangement : aucun étudiant inscrit", {
      sessionId,
      coursId: session.emploiDuTemps.coursId,
      type,
    });
    return { envoyes: 0, ignores: false };
  }

  const { apiKey, from } = getEmailEnv();
  const resend = new Resend(apiKey);
  const html = htmlPour(type, {
    coursTitre: session.emploiDuTemps.cours.titre,
    dateReelle: session.dateReelle,
    formateurNom: session.emploiDuTemps.formateur.nom,
    joinUrl: session.joinUrl,
  });

  const { data, error } = await resend.emails.send({
    from,
    to: destinataires,
    subject: `[${session.emploiDuTemps.cours.titre}] ${SUJETS[type]}`,
    html,
  });

  if (error) {
    logger.error("Échec d'envoi Resend", {
      sessionId,
      type,
      destinataires,
      resendMessage: error.message,
    });
    throw new Error(`Notification email échouée : ${error.message}`);
  }

  logger.info("Notification envoyée aux étudiants", {
    sessionId,
    type,
    envoyes: destinataires.length,
    resendId: data?.id,
  });
  return { envoyes: destinataires.length, ignores: false };
}

export async function envoyerAlerteOps(params: { sujet: string; html: string }): Promise<void> {
  if (!hasEmailCredentials()) {
    logger.warn("Alerte ops ignorée : credentials email manquants", { sujet: params.sujet });
    return;
  }
  const { apiKey, from, alertEmail } = getEmailEnv();
  if (!alertEmail) {
    logger.warn("Alerte ops ignorée : ALERT_EMAIL manquant", { sujet: params.sujet });
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: alertEmail,
    subject: params.sujet,
    html: params.html,
  });
  if (error) {
    logger.error("Échec d'alerte ops Resend", {
      sujet: params.sujet,
      resendMessage: error.message,
    });
  }
}
