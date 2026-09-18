import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { seedIfEmpty } from "@/lib/seed";
import { genererSessionsAVenir } from "@/lib/genererSessions";
import { logger } from "@/lib/logger";
import { EnvError } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!authorizeCron(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const seed = await seedIfEmpty(prisma);
    const sessions = seed.seeded || seed.emploisDuTemps > 0
      ? await genererSessionsAVenir()
      : null;

    return NextResponse.json({ seed, sessions });
  } catch (error) {
    logger.error("Cron seed en échec", {
      error: error instanceof Error ? error.message : String(error),
    });
    const status = error instanceof EnvError ? 500 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne" },
      { status },
    );
  }
}
