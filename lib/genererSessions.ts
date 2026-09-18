import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getAppTimezone,
  getSessionHorizonJours,
  hasZoomCredentials,
} from "@/lib/env";
import { finSession, formatZoomStartTime, listerOccurrences } from "@/lib/dates";
import { createMeeting } from "@/lib/zoom";
import { ZoomApiError } from "@/lib/zoom";
import { assurerHostKey, trouverCompteLibre } from "@/lib/licencePool";
import { AucuneLicenceDisponibleError } from "@/lib/licencePool";
import { DateTime } from "luxon";

export type ResultatGeneration = {
  horizonJours: number;
  candidates: number;
  creees: number;
  ignoreesDejaExistantes: number;
  echecs: Array<{ emploiDuTempsId: string; dateReelle: string; raison: string }>;
};

export async function genererSessionsAVenir(): Promise<ResultatGeneration> {
  const horizonJours = getSessionHorizonJours();
  const timezone = getAppTimezone();
  const maintenant = DateTime.now().setZone(timezone);
  const debutFenêtre = maintenant.startOf("day");
  const finFenêtre = debutFenêtre.plus({ days: horizonJours });

  const emplois = await prisma.emploiDuTemps.findMany({
    include: { cours: true, formateur: true },
  });

  const resultat: ResultatGeneration = {
    horizonJours,
    candidates: 0,
    creees: 0,
    ignoreesDejaExistantes: 0,
    echecs: [],
  };

  logger.info("Génération des sessions Zoom — scan de la fenêtre glissante", {
    debut: debutFenêtre.toISO(),
    fin: finFenêtre.toISO(),
    horizonJours,
    emplois: emplois.length,
  });

  for (const emploi of emplois) {
    const dates = listerOccurrences(
      emploi,
      debutFenêtre.toJSDate(),
      finFenêtre.toJSDate(),
      timezone,
    );
    resultat.candidates += dates.length;

    for (const dateReelle of dates) {
      const existante = await prisma.session.findUnique({
        where: {
          emploiDuTempsId_dateReelle: {
            emploiDuTempsId: emploi.id,
            dateReelle,
          },
        },
      });

      if (existante) {
        resultat.ignoreesDejaExistantes += 1;
        continue;
      }

      const fin = finSession(dateReelle, emploi.dureeMinutes);

      try {
        const licence = await trouverCompteLibre({ debut: dateReelle, fin });
        const hostKey = await assurerHostKey(licence);

        let zoomMeetingId: string | null = null;
        let joinUrl: string | null = null;

        if (hasZoomCredentials()) {
          const meeting = await createMeeting({
            zoomUserId: licence.zoomUserId,
            topic: `${emploi.cours.titre} — ${emploi.formateur.nom}`,
            startTime: formatZoomStartTime(dateReelle, timezone),
            durationMinutes: emploi.dureeMinutes,
            timezone,
            agenda: `Cours ${emploi.cours.titre} animé par ${emploi.formateur.nom}`,
          });
          zoomMeetingId = String(meeting.id);
          joinUrl = meeting.join_url;
        } else {
          logger.warn(
            "ZOOM_* manquants : session créée en base sans réunion Zoom réelle",
            { emploiDuTempsId: emploi.id, dateReelle: dateReelle.toISOString() },
          );
        }

        await prisma.session.create({
          data: {
            emploiDuTempsId: emploi.id,
            dateReelle,
            zoomMeetingId,
            joinUrl,
            hostKey,
            statut: "PLANIFIEE",
            licenceZoomId: licence.id,
          },
        });
        resultat.creees += 1;
      } catch (error) {
        const raison =
          error instanceof AucuneLicenceDisponibleError || error instanceof ZoomApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        logger.error("Échec de création d'une session Zoom", {
          emploiDuTempsId: emploi.id,
          dateReelle: dateReelle.toISOString(),
          raison,
        });
        resultat.echecs.push({
          emploiDuTempsId: emploi.id,
          dateReelle: dateReelle.toISOString(),
          raison,
        });
      }
    }
  }

  logger.info("Génération des sessions terminée", resultat);
  return resultat;
}
