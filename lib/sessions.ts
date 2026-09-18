import type { Prisma, Session } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { hasZoomCredentials } from "@/lib/env";
import { getAppTimezone } from "@/lib/env";
import { dateReelleDuCreneau, finSession, formatZoomStartTime, JOUR_VERS_ISO } from "@/lib/dates";
import { deleteMeeting, updateMeeting } from "@/lib/zoom";
import { libererCompte } from "@/lib/licencePool";
import { notifierChangement } from "@/lib/notifications";
import { DateTime } from "luxon";

export class SessionMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionMutationError";
  }
}

async function chargerSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { emploiDuTemps: { include: { cours: true, formateur: true } } },
  });
  if (!session) {
    throw new SessionMutationError(`Session introuvable : ${sessionId}`);
  }
  return session;
}

async function patchZoomSiPossible(params: {
  zoomMeetingId: string | null;
  startTime?: Date;
  durationMinutes?: number;
  topic?: string;
}): Promise<void> {
  if (!params.zoomMeetingId) {
    return;
  }
  if (!hasZoomCredentials()) {
    logger.warn("Mise à jour Zoom ignorée : credentials Zoom manquants", {
      zoomMeetingId: params.zoomMeetingId,
    });
    return;
  }
  await updateMeeting(params.zoomMeetingId, {
    topic: params.topic,
    startTime: params.startTime ? formatZoomStartTime(params.startTime) : undefined,
    durationMinutes: params.durationMinutes,
    timezone: getAppTimezone(),
  });
}

export type ModificationSessionPonctuelle = {
  dateReelle?: Date;
  dureeMinutes?: number;
};

/**
 * Modifie une session ponctuelle (PATCH Zoom + update DB).
 * N'accepte que les sessions pas encore commencées.
 */
export async function modifierSessionPonctuelle(
  sessionId: string,
  patch: ModificationSessionPonctuelle,
): Promise<Session> {
  const session = await chargerSession(sessionId);
  if (session.statut !== "PLANIFIEE") {
    throw new SessionMutationError(
      `Impossible de modifier une session au statut ${session.statut}`,
    );
  }

  const prochaineDate = patch.dateReelle ?? session.dateReelle;
  const prochaineDuree = patch.dureeMinutes ?? session.emploiDuTemps.dureeMinutes;

  await patchZoomSiPossible({
    zoomMeetingId: session.zoomMeetingId,
    startTime: prochaineDate,
    durationMinutes: prochaineDuree,
    topic: session.emploiDuTemps.cours.titre,
  });

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { dateReelle: prochaineDate },
  });

  if (patch.dureeMinutes !== undefined && patch.dureeMinutes !== session.emploiDuTemps.dureeMinutes) {
    logger.warn(
      "La durée d'une session ponctuelle a été changée côté Zoom uniquement ; l'EDT récurrent n'est pas modifié",
      { sessionId, dureeMinutes: patch.dureeMinutes },
    );
  }

  try {
    await notifierChangement(sessionId, "MODIFICATION");
  } catch (error) {
    logger.error("Notification de modification échouée (session déjà mise à jour)", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info("Session ponctuelle modifiée", {
    sessionId,
    dateReelle: updated.dateReelle.toISOString(),
  });
  return updated;
}

/**
 * Annule une session : DELETE Zoom + statut ANNULEE. Jamais de suppression en DB.
 */
export async function annulerSession(sessionId: string, notifier = true): Promise<Session> {
  const session = await chargerSession(sessionId);
  if (session.statut === "ANNULEE") {
    return session;
  }
  if (session.statut === "TERMINEE") {
    throw new SessionMutationError("Impossible d'annuler une session déjà terminée");
  }

  if (session.zoomMeetingId && hasZoomCredentials()) {
    await deleteMeeting(session.zoomMeetingId);
  } else if (session.zoomMeetingId && !hasZoomCredentials()) {
    logger.warn("Suppression Zoom ignorée : credentials Zoom manquants", {
      sessionId,
      zoomMeetingId: session.zoomMeetingId,
    });
  }

  if (session.statut === "EN_COURS") {
    await libererCompte(sessionId);
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { statut: "ANNULEE" },
  });

  if (notifier) {
    try {
      await notifierChangement(sessionId, "ANNULATION");
    } catch (error) {
      logger.error("Notification d'annulation échouée (session déjà annulée en DB)", {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Session annulée", { sessionId });
  return updated;
}

export type ModificationEmploiDuTemps = {
  jourSemaine?: Prisma.EmploiDuTempsUpdateInput["jourSemaine"];
  heureDebut?: string;
  dureeMinutes?: number;
  formateurId?: string;
  dateFinPeriode?: Date;
};

/**
 * Modifie un EDT récurrent à partir d'une date.
 * N'affecte que les sessions futures encore PLANIFIEE.
 */
export async function modifierEmploiDuTempsAPartirDe(params: {
  emploiDuTempsId: string;
  aPartirDe: Date;
  patch: ModificationEmploiDuTemps;
}): Promise<{ edtId: string; sessionsMisesAJour: number; sessionsAnnulees: number }> {
  const edt = await prisma.emploiDuTemps.findUnique({
    where: { id: params.emploiDuTempsId },
    include: { cours: true },
  });
  if (!edt) {
    throw new SessionMutationError(`Emploi du temps introuvable : ${params.emploiDuTempsId}`);
  }

  const updatedEdt = await prisma.emploiDuTemps.update({
    where: { id: params.emploiDuTempsId },
    data: {
      jourSemaine: params.patch.jourSemaine,
      heureDebut: params.patch.heureDebut,
      dureeMinutes: params.patch.dureeMinutes,
      formateurId: params.patch.formateurId,
      dateFinPeriode: params.patch.dateFinPeriode,
    },
  });

  const sessions = await prisma.session.findMany({
    where: {
      emploiDuTempsId: params.emploiDuTempsId,
      statut: "PLANIFIEE",
      dateReelle: { gte: params.aPartirDe },
    },
  });

  const timezone = getAppTimezone();
  const nouveauIsoJour = JOUR_VERS_ISO[updatedEdt.jourSemaine];
  let sessionsMisesAJour = 0;
  let sessionsAnnulees = 0;

  for (const session of sessions) {
    const locale = DateTime.fromJSDate(session.dateReelle, { zone: timezone });
    const jourChange = locale.weekday !== nouveauIsoJour;

    if (jourChange) {
      await annulerSession(session.id, true);
      sessionsAnnulees += 1;
      continue;
    }

    const nouvelleDate = dateReelleDuCreneau(locale, updatedEdt.heureDebut, timezone).toJSDate();
    const dateChangee = nouvelleDate.getTime() !== session.dateReelle.getTime();
    const dureeChangee =
      params.patch.dureeMinutes !== undefined &&
      params.patch.dureeMinutes !== edt.dureeMinutes;

    if (!dateChangee && !dureeChangee) {
      continue;
    }

    await patchZoomSiPossible({
      zoomMeetingId: session.zoomMeetingId,
      startTime: nouvelleDate,
      durationMinutes: updatedEdt.dureeMinutes,
      topic: edt.cours.titre,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { dateReelle: nouvelleDate },
    });

    try {
      await notifierChangement(session.id, "MODIFICATION");
    } catch (error) {
      logger.error("Notification de modification EDT échouée", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    sessionsMisesAJour += 1;
  }

  logger.info("Emploi du temps modifié à partir d'une date", {
    emploiDuTempsId: params.emploiDuTempsId,
    aPartirDe: params.aPartirDe.toISOString(),
    sessionsMisesAJour,
    sessionsAnnulees,
  });

  return {
    edtId: updatedEdt.id,
    sessionsMisesAJour,
    sessionsAnnulees,
  };
}

export { finSession };
