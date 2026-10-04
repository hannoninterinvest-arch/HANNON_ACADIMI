import { prisma } from "@/lib/prisma";

export type Participant = { id: string; nom: string; email?: string };

export async function participantsParSession(
  sessionIds: string[],
  avecEmail: boolean,
): Promise<Map<string, Participant[]>> {
  const resultat = new Map<string, Participant[]>();
  if (sessionIds.length === 0) {
    return resultat;
  }
  const [commandes, affectations] = await Promise.all([
    prisma.commande.findMany({
      where: {
        sessionId: { in: sessionIds },
        statut: "PAYEE",
        typeAcheteur: "PARTICULIER",
        compte: { role: { not: "ADMIN" } },
      },
      select: { sessionId: true, compte: { select: { id: true, nom: true, email: true } } },
    }),
    prisma.affectation.findMany({
      where: { sessionId: { in: sessionIds }, compte: { role: { not: "ADMIN" } } },
      select: { sessionId: true, compte: { select: { id: true, nom: true, email: true } } },
    }),
  ]);
  const seaux = new Map<string, Map<string, Participant>>();
  const ajouter = (sessionId: string, compte: { id: string; nom: string; email: string }) => {
    const seau = seaux.get(sessionId) ?? new Map<string, Participant>();
    seau.set(compte.id, {
      id: compte.id,
      nom: compte.nom,
      email: avecEmail ? compte.email : undefined,
    });
    seaux.set(sessionId, seau);
  };
  for (const ligne of commandes) {
    ajouter(ligne.sessionId, ligne.compte);
  }
  for (const ligne of affectations) {
    ajouter(ligne.sessionId, ligne.compte);
  }
  Array.from(seaux.entries()).forEach(([sessionId, seau]) => {
    const personnes = Array.from(seau.values()).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    resultat.set(sessionId, personnes);
  });
  return resultat;
}
