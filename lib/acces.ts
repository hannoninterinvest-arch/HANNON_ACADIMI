export type Lecteur = {
  id: string;
  role: string;
  societeId: string | null;
};

export function peutVoirCommande(
  user: Lecteur,
  commande: { compteId: string; societeId: string | null },
): boolean {
  if (user.role === "ADMIN") {
    return true;
  }
  if (commande.societeId) {
    return user.role === "SOCIETE" && user.societeId === commande.societeId;
  }
  return user.id === commande.compteId;
}

export function peutVoirCertificat(user: Lecteur, certificat: { compteId: string }): boolean {
  return user.role === "ADMIN" || user.id === certificat.compteId;
}

export function peutGererOrganisation(user: Lecteur, societeId: string): boolean {
  return user.role === "ADMIN" || (user.role === "SOCIETE" && user.societeId === societeId);
}

export function rolePourInscriptionPublique(type: string): "ETUDIANT_B2C" | "SOCIETE" {
  if (type === "ENTREPRISE" || type === "ORGANISME_PUBLIC") {
    return "SOCIETE";
  }
  if (type === "PARTICULIER") {
    return "ETUDIANT_B2C";
  }
  throw new Error("TYPE_COMPTE_INVALIDE");
}
