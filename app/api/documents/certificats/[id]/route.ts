import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lireSession } from "@/lib/auth";
import { peutVoirCertificat } from "@/lib/acces";
import { lireDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { id: string } },
): Promise<NextResponse> {
  const session = await lireSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const certificat = await prisma.certificat.findUnique({ where: { id: context.params.id } });
  if (!certificat) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (!peutVoirCertificat(session, certificat)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const contenu = await lireDocument(certificat.cheminStockage);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": certificat.typeMime,
      "Content-Disposition": `attachment; filename="${certificat.nomFichier.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
