import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lireSession } from "@/lib/auth";
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
  const ressource = await prisma.ressourceCours.findUnique({ where: { id: context.params.id } });
  if (!ressource) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (session.role !== "ADMIN") {
    const [commande, affectation, inscription] = await Promise.all([
      prisma.commande.findFirst({
        where: { compteId: session.id, coursId: ressource.coursId, statut: "PAYEE", typeAcheteur: "PARTICULIER" },
      }),
      prisma.affectation.findFirst({
        where: { compteId: session.id, commande: { coursId: ressource.coursId, statut: "PAYEE" } },
      }),
      session.etudiantId
        ? prisma.inscription.findFirst({ where: { etudiantId: session.etudiantId, coursId: ressource.coursId } })
        : Promise.resolve(null),
    ]);
    if (!commande && !affectation && !inscription) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }
  const contenu = await lireDocument(ressource.cheminStockage);
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": ressource.typeMime,
      "Content-Disposition": `attachment; filename="${ressource.nomFichier.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
