import { NextResponse } from "next/server";
import { JourSemaine } from "@prisma/client";
import { authorizeCron } from "@/lib/cronAuth";
import { modifierEmploiDuTempsAPartirDe, SessionMutationError } from "@/lib/sessions";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const JOURS = new Set<string>(Object.values(JourSemaine));

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: {
    aPartirDe?: string;
    jourSemaine?: string;
    heureDebut?: string;
    dureeMinutes?: number;
    formateurId?: string;
    dateFinPeriode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!body.aPartirDe) {
    return NextResponse.json(
      { error: "aPartirDe (ISO 8601) est obligatoire pour une modification d'EDT récurrent" },
      { status: 400 },
    );
  }

  if (body.jourSemaine && !JOURS.has(body.jourSemaine)) {
    return NextResponse.json({ error: "jourSemaine invalide" }, { status: 400 });
  }

  try {
    const resultat = await modifierEmploiDuTempsAPartirDe({
      emploiDuTempsId: context.params.id,
      aPartirDe: new Date(body.aPartirDe),
      patch: {
        jourSemaine: body.jourSemaine as JourSemaine | undefined,
        heureDebut: body.heureDebut,
        dureeMinutes: body.dureeMinutes,
        formateurId: body.formateurId,
        dateFinPeriode: body.dateFinPeriode ? new Date(body.dateFinPeriode) : undefined,
      },
    });
    return NextResponse.json(resultat);
  } catch (error) {
    logger.error("PATCH emploi du temps échoué", {
      emploiDuTempsId: context.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    const status = error instanceof SessionMutationError ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne" },
      { status },
    );
  }
}
