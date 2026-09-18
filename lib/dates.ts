import { JourSemaine } from "@prisma/client";
import { DateTime } from "luxon";
import { getAppTimezone } from "@/lib/env";

export const JOUR_VERS_ISO: Record<JourSemaine, number> = {
  LUNDI: 1,
  MARDI: 2,
  MERCREDI: 3,
  JEUDI: 4,
  VENDREDI: 5,
  SAMEDI: 6,
  DIMANCHE: 7,
};

const HEURE_DEBUT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHeureDebut(heureDebut: string): { hour: number; minute: number } {
  const match = HEURE_DEBUT_REGEX.exec(heureDebut);
  if (!match || match[1] === undefined || match[2] === undefined) {
    throw new Error(`heureDebut invalide (attendu HH:mm) : ${heureDebut}`);
  }
  return {
    hour: Number.parseInt(match[1], 10),
    minute: Number.parseInt(match[2], 10),
  };
}

export function dateReelleDuCreneau(
  jour: DateTime,
  heureDebut: string,
  timezone: string = getAppTimezone(),
): DateTime {
  const { hour, minute } = parseHeureDebut(heureDebut);
  const local = jour.setZone(timezone, { keepLocalTime: false }).startOf("day").set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (!local.isValid) {
    throw new Error(`Date de créneau invalide : ${local.invalidReason ?? "unknown"}`);
  }
  return local;
}

export type EmploiPourOccurrences = {
  jourSemaine: JourSemaine;
  heureDebut: string;
  dateDebutPeriode: Date;
  dateFinPeriode: Date;
};

/**
 * Occurrences du créneau dans [debutInclusive, finExclusive],
 * bornées par dateDebutPeriode / dateFinPeriode (dates civiles du fuseau).
 */
export function listerOccurrences(
  emploi: EmploiPourOccurrences,
  debutInclusive: Date,
  finExclusive: Date,
  timezone: string = getAppTimezone(),
): Date[] {
  const isoJour = JOUR_VERS_ISO[emploi.jourSemaine];
  const periodeDebut = DateTime.fromJSDate(emploi.dateDebutPeriode, { zone: "utc" }).toISODate();
  const periodeFin = DateTime.fromJSDate(emploi.dateFinPeriode, { zone: "utc" }).toISODate();
  if (!periodeDebut || !periodeFin) {
    throw new Error("Période d'emploi du temps invalide");
  }

  let curseur = DateTime.fromJSDate(debutInclusive, { zone: timezone }).startOf("day");
  const fin = DateTime.fromJSDate(finExclusive, { zone: timezone });
  const occurrences: Date[] = [];

  while (curseur < fin) {
    const dateCivile = curseur.toISODate();
    if (
      curseur.weekday === isoJour &&
      dateCivile &&
      dateCivile >= periodeDebut &&
      dateCivile <= periodeFin
    ) {
      occurrences.push(dateReelleDuCreneau(curseur, emploi.heureDebut, timezone).toJSDate());
    }
    curseur = curseur.plus({ days: 1 });
  }

  return occurrences;
}

export function finSession(dateReelle: Date, dureeMinutes: number): Date {
  return DateTime.fromJSDate(dateReelle).plus({ minutes: dureeMinutes }).toJSDate();
}

export function formatZoomStartTime(dateReelle: Date, timezone: string = getAppTimezone()): string {
  const local = DateTime.fromJSDate(dateReelle, { zone: timezone });
  return local.toFormat("yyyy-MM-dd'T'HH:mm:ss");
}
