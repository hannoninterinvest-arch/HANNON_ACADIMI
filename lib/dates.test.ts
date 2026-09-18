import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { JourSemaine } from "@prisma/client";
import { listerOccurrences, parseHeureDebut, formatZoomStartTime } from "@/lib/dates";

describe("parseHeureDebut", () => {
  it("accepte HH:mm valide", () => {
    expect(parseHeureDebut("18:00")).toEqual({ hour: 18, minute: 0 });
    expect(parseHeureDebut("09:30")).toEqual({ hour: 9, minute: 30 });
  });

  it("rejette un format invalide", () => {
    expect(() => parseHeureDebut("8:00")).toThrow();
    expect(() => parseHeureDebut("25:00")).toThrow();
  });
});

describe("listerOccurrences", () => {
  it("génère uniquement les lundis 18h dans la fenêtre, bornés par la période", () => {
    const timezone = "Europe/Paris";
    const emploi = {
      jourSemaine: JourSemaine.LUNDI,
      heureDebut: "18:00",
      dateDebutPeriode: new Date("2026-09-01T00:00:00.000Z"),
      dateFinPeriode: new Date("2026-09-30T00:00:00.000Z"),
    };

    const debut = DateTime.fromISO("2026-09-18T00:00:00", { zone: timezone }).toJSDate();
    const fin = DateTime.fromISO("2026-10-02T00:00:00", { zone: timezone }).toJSDate();
    const dates = listerOccurrences(emploi, debut, fin, timezone);

    const iso = dates.map((d) =>
      DateTime.fromJSDate(d, { zone: timezone }).toFormat("yyyy-LL-dd HH:mm"),
    );

    expect(iso).toEqual(["2026-09-21 18:00", "2026-09-28 18:00"]);
    expect(
      dates.every((d) => DateTime.fromJSDate(d, { zone: timezone }).weekday === 1),
    ).toBe(true);
  });

  it("n'émet rien hors période", () => {
    const timezone = "Europe/Paris";
    const dates = listerOccurrences(
      {
        jourSemaine: JourSemaine.LUNDI,
        heureDebut: "18:00",
        dateDebutPeriode: new Date("2026-01-01T00:00:00.000Z"),
        dateFinPeriode: new Date("2026-01-31T00:00:00.000Z"),
      },
      DateTime.fromISO("2026-09-18T00:00:00", { zone: timezone }).toJSDate(),
      DateTime.fromISO("2026-10-02T00:00:00", { zone: timezone }).toJSDate(),
      timezone,
    );
    expect(dates).toEqual([]);
  });
});

describe("formatZoomStartTime", () => {
  it("formate sans suffixe Z, dans le fuseau demandé", () => {
    const dt = DateTime.fromISO("2026-09-21T18:00:00", { zone: "Europe/Paris" }).toJSDate();
    expect(formatZoomStartTime(dt, "Europe/Paris")).toBe("2026-09-21T18:00:00");
  });
});
