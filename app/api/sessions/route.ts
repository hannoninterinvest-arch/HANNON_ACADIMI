import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const sessions = await prisma.session.findMany({
    orderBy: { dateReelle: "asc" },
    include: {
      emploiDuTemps: { include: { cours: true, formateur: true } },
      licenceZoom: { select: { id: true, compteEmail: true, statut: true } },
    },
  });
  return NextResponse.json(sessions);
}
