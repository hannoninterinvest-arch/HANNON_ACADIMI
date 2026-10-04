import { DateTime } from "luxon";

export function formatEuros(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(centimes / 100);
}

export function formaterCreneau(date: Date, fuseau: string): string {
  const local = DateTime.fromJSDate(date, { zone: "utc" }).setZone(fuseau).setLocale("fr");
  if (!local.isValid) {
    return date.toISOString();
  }
  return local.toLocaleString({
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function combinerDateHeure(jour: string, heure: string, fuseau: string): Date {
  const dt = DateTime.fromISO(`${jour}T${heure}`, { zone: fuseau });
  if (!dt.isValid) {
    throw new Error("La date ou l'heure est invalide.");
  }
  return dt.toJSDate();
}

export function lienZoomSession(session: {
  lienZoomManuel: string | null;
  joinUrl: string | null;
}): string | null {
  const manuel = session.lienZoomManuel?.trim();
  if (manuel) {
    return manuel;
  }
  const joint = session.joinUrl?.trim();
  return joint || null;
}
