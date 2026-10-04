import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cronAuth";
import { libererReservationsExpirees } from "@/lib/commerce/service";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!authorizeCron(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const liberees = await libererReservationsExpirees();
    return NextResponse.json({ liberees });
  } catch (error) {
    logger.error("Expiration des réservations en échec", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}
