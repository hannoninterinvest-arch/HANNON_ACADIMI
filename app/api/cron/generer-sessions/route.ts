import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cronAuth";
import { genererSessionsAVenir } from "@/lib/genererSessions";
import { logger } from "@/lib/logger";
import { EnvError } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!authorizeCron(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const resultat = await genererSessionsAVenir();
    const status = resultat.echecs.length > 0 && resultat.creees === 0 ? 500 : 200;
    return NextResponse.json(resultat, { status });
  } catch (error) {
    logger.error("Cron generer-sessions en échec", {
      error: error instanceof Error ? error.message : String(error),
    });
    const status = error instanceof EnvError ? 500 : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur interne",
      },
      { status },
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}
