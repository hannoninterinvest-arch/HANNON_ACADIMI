export function peutCreerGroupe(personnesDisponibles: number, effectifMinimal: number): boolean {
  return effectifMinimal >= 1 && personnesDisponibles >= effectifMinimal;
}

export function peutOuvrirPaiement(
  personnesDuGroupe: number,
  effectifMinimal: number,
  dejaOuvert: boolean,
): boolean {
  return !dejaOuvert && effectifMinimal >= 1 && personnesDuGroupe >= effectifMinimal;
}

export function libelleCandidature(statut: string): string {
  switch (statut) {
    case "CONTACTE":
      return "Contacté";
    case "DANS_GROUPE":
      return "Dans le groupe";
    case "PAYEE":
      return "Place confirmée";
    case "ANNULEE":
      return "Annulée";
    default:
      return "Demande reçue";
  }
}
