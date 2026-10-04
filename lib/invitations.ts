import { createHash, randomBytes } from "node:crypto";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function genererJetonInvitation(): string {
  return randomBytes(32).toString("base64url");
}

export function hasherJetonInvitation(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function parserCsvEmployes(contenu: string): Array<{ nom: string; email: string }> {
  const lignes = contenu
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);
  if (lignes.length === 0) {
    return [];
  }
  const premiere = lignes[0]?.toLowerCase() ?? "";
  const debut = premiere.includes("email") || premiere.includes("e-mail") ? 1 : 0;
  const resultat: Array<{ nom: string; email: string }> = [];
  const vus = new Set<string>();

  for (const ligne of lignes.slice(debut)) {
    const cellules = ligne.split(/[;,]/).map((cellule) => cellule.trim().replace(/^"|"$/g, ""));
    const emailBrut = (cellules.length >= 2 ? cellules[1] : cellules[0]) ?? "";
    const nomBrut = cellules.length >= 2 ? cellules[0] : "";
    const email = emailBrut.toLowerCase();
    if (!EMAIL.test(email) || vus.has(email)) {
      continue;
    }
    vus.add(email);
    const nom = nomBrut || email.split("@")[0] || email;
    resultat.push({ nom, email });
  }
  return resultat;
}

export type DemandeSaisie = {
  organisationNom: string;
  contactNom: string;
  email: string;
  telephone: string;
  sujet: string;
  nbParticipants: number;
  periodeSouhaitee: string;
  message: string;
};

export function preparerDemande(input: DemandeSaisie): { reserveDesPlaces: false; donnees: DemandeSaisie } {
  if (!input.organisationNom || !input.contactNom || !EMAIL.test(input.email)) {
    throw new Error("DEMANDE_INVALIDE");
  }
  if (!input.telephone || !input.sujet || !input.periodeSouhaitee || !input.message) {
    throw new Error("DEMANDE_INVALIDE");
  }
  if (!Number.isInteger(input.nbParticipants) || input.nbParticipants < 1) {
    throw new Error("DEMANDE_INVALIDE");
  }
  return { reserveDesPlaces: false, donnees: { ...input, email: input.email.toLowerCase() } };
}
