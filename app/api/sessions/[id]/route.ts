import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { modifierSessionPonctuelle, annulerSession, SessionMutationError } from "@/lib/sessions";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const session = await prisma.session.findUnique({
    where: { id: context.params.id },
    include: {
      emploiDuTemps: { include: { cours: true, formateur: true } },
      licenceZoom: true,
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { dateReelle?: string; dureeMinutes?: number };
  try {
    body = (await request.json()) as { dateReelle?: string; dureeMinutes?: number };
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  try {
    const session = await modifierSessionPonctuelle(context.params.id, {
      dateReelle: body.dateReelle ? new Date(body.dateReelle) : undefined,
      dureeMinutes: body.dureeMinutes,
    });
    return NextResponse.json(session);
  } catch (error) {
    logger.error("PATCH session échoué", {
      sessionId: context.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    const status = error instanceof SessionMutationError ? 409 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne" },
      { status },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const session = await annulerSession(context.params.id);
    return NextResponse.json(session);
  } catch (error) {
    logger.error("DELETE (annulation) session échoué", {
      sessionId: context.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    const status = error instanceof SessionMutationError ? 409 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne" },
      { status },
    );
  }
}
