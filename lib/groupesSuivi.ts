import { prisma } from "@/lib/prisma";

export async function synchroniserCandidaturePayee(compteId: string, sessionId: string): Promise<void> {
  const groupe = await prisma.groupe.findUnique({ where: { sessionId }, select: { id: true } });
  if (!groupe) {
    return;
  }
  await prisma.candidature.updateMany({
    where: { groupeId: groupe.id, compteId, statut: { not: "PAYEE" } },
    data: { statut: "PAYEE" },
  });
}

export async function synchroniserCandidatureApresRemboursement(compteId: string, sessionId: string): Promise<void> {
  const groupe = await prisma.groupe.findUnique({ where: { sessionId }, select: { id: true } });
  if (!groupe) {
    return;
  }
  await prisma.candidature.updateMany({
    where: { groupeId: groupe.id, compteId, statut: "PAYEE" },
    data: { statut: "DANS_GROUPE" },
  });
}
