import type { LicenceZoom, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { hasEmailCredentials } from "@/lib/env";
import { envoyerAlerteOps } from "@/lib/notifications";
import { genererHostKey, setUserHostKey } from "@/lib/zoom";

export class AucuneLicenceDisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AucuneLicenceDisponibleError";
  }
}

type LicenceRow = {
  id: string;
  compteEmail: string;
  zoomUserId: string;
  statut: "LIBRE" | "OCCUPE";
  hostKey: string | null;
  sessionIdEnCours: string | null;
};

function mapLicence(row: LicenceRow): LicenceZoom {
  return {
    id: row.id,
    compteEmail: row.compteEmail,
    zoomUserId: row.zoomUserId,
    statut: row.statut,
    hostKey: row.hostKey,
    sessionIdEnCours: row.sessionIdEnCours,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Trouve une licence sans session PLANIFIEE/EN_COURS qui se chevauche avec [debut, fin).
 * Verrou PostgreSQL : FOR UPDATE SKIP LOCKED pour éviter deux jobs concurrents.
 */
export async function trouverCompteLibre(params: {
  debut: Date;
  fin: Date;
}): Promise<LicenceZoom> {
  const { debut, fin } = params;

  try {
    const licence = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LicenceRow[]>`
        SELECT l.id, l."compteEmail", l."zoomUserId", l.statut, l."hostKey", l."sessionIdEnCours"
        FROM "LicenceZoom" l
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Session" s
          INNER JOIN "EmploiDuTemps" e ON e.id = s."emploiDuTempsId"
          WHERE s."licenceZoomId" = l.id
            AND s.statut IN ('PLANIFIEE', 'EN_COURS')
            AND s."dateReelle" < ${fin}
            AND (s."dateReelle" + (e."dureeMinutes" * INTERVAL '1 minute')) > ${debut}
        )
        ORDER BY l."updatedAt" ASC, l.id ASC
        LIMIT 1
        FOR UPDATE OF l SKIP LOCKED
      `;

      const row = rows[0];
      if (!row) {
        return null;
      }

      // Touch pour fairness du round-robin
      await tx.licenceZoom.update({
        where: { id: row.id },
        data: { updatedAt: new Date() },
      });

      return mapLicence(row);
    });

    if (!licence) {
      await signalerPoolSature({ debut, fin });
      throw new AucuneLicenceDisponibleError(
        `Aucune licence Zoom disponible pour le créneau ${debut.toISOString()} → ${fin.toISOString()}`,
      );
    }

    logger.info("Licence Zoom sélectionnée dans le pool", {
      licenceId: licence.id,
      compteEmail: licence.compteEmail,
      debut: debut.toISOString(),
    });
    return licence;
  } catch (error) {
    if (error instanceof AucuneLicenceDisponibleError) {
      throw error;
    }
    logger.error("Erreur lors de la recherche d'une licence libre", {
      error: error instanceof Error ? error.message : String(error),
      debut: debut.toISOString(),
      fin: fin.toISOString(),
    });
    throw error;
  }
}

async function signalerPoolSature(params: { debut: Date; fin: Date }): Promise<void> {
  logger.error("Pool de licences Zoom saturé : aucune licence disponible", {
    debut: params.debut.toISOString(),
    fin: params.fin.toISOString(),
  });

  if (!hasEmailCredentials()) {
    logger.warn("Alerte pool saturé non envoyée : RESEND_API_KEY / RESEND_FROM_EMAIL manquants");
    return;
  }

  try {
    await envoyerAlerteOps({
      sujet: "[Hannon Acadimi] Pool de licences Zoom saturé",
      html: `<p>Aucune licence Zoom n'est disponible pour le créneau <strong>${params.debut.toISOString()}</strong> → <strong>${params.fin.toISOString()}</strong>.</p><p>Ajoutez une licence dans <code>LicenceZoom</code> ou décalez un cours.</p>`,
    });
  } catch (error) {
    logger.error("Impossible d'envoyer l'alerte de pool saturé", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function libererCompte(sessionId: string): Promise<void> {
  const result = await prisma.licenceZoom.updateMany({
    where: { sessionIdEnCours: sessionId },
    data: {
      statut: "LIBRE",
      sessionIdEnCours: null,
    },
  });

  if (result.count === 0) {
    logger.warn("libererCompte : aucune licence n'était occupée par cette session", { sessionId });
    return;
  }

  logger.info("Licence Zoom libérée", { sessionId, licencesMisesAJour: result.count });
}

export async function occuperCompte(params: {
  licenceId: string;
  sessionId: string;
}): Promise<void> {
  await prisma.licenceZoom.update({
    where: { id: params.licenceId },
    data: {
      statut: "OCCUPE",
      sessionIdEnCours: params.sessionId,
    },
  });
  logger.info("Licence Zoom marquée OCCUPE", params);
}

export async function assurerHostKey(licence: LicenceZoom): Promise<string> {
  if (licence.hostKey) {
    return licence.hostKey;
  }

  const hostKey = genererHostKey();
  try {
    await setUserHostKey(licence.zoomUserId, hostKey);
  } catch (error) {
    logger.error("Impossible de poser la host key sur Zoom — on la stocke quand même en base", {
      licenceId: licence.id,
      zoomUserId: licence.zoomUserId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await prisma.licenceZoom.update({
    where: { id: licence.id },
    data: { hostKey },
  });
  return hostKey;
}

export type TxClient = Prisma.TransactionClient;
