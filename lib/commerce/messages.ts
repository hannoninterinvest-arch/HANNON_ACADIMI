const MESSAGES: Record<string, string> = {
  STOCK_INSUFFISANT: "Il ne reste pas assez de places sur cette session.",
  SESSION_FERMEE: "Les inscriptions sont fermées pour cette session.",
  QUANTITE_INVALIDE: "La quantité demandée n'est pas valide.",
  QUOTA_AFFECTATION: "Toutes les places achetées sont déjà affectées. Achetez un lot supplémentaire pour inscrire d'autres employés.",
  HORS_ORGANISATION: "Cette personne n'appartient pas à votre organisation.",
  DEJA_AFFECTE: "Cet employé est déjà inscrit à cette session.",
  CAPACITE_TROP_BASSE: "La capacité ne peut pas passer sous les places déjà confirmées ou réservées.",
  RESERVATION_EXPIREE: "La réservation a expiré. Les places ont été libérées.",
  MONTANT_INVALIDE: "Le montant confirmé ne correspond pas à la commande.",
  TARIF_MANQUANT: "Cette formation n'a pas encore de tarif.",
  SESSION_INTROUVABLE: "Session introuvable.",
  ACCES: "Vous n'avez pas accès à cette ressource.",
  INVITATION: "Cette invitation est invalide ou expirée.",
  EMAIL: "Un compte existe déjà avec cette adresse.",
  CHAMPS: "Merci de vérifier les champs du formulaire.",
  PAIEMENT: "Le paiement n'a pas pu être ouvert.",
};

export function messageErreur(code: string | undefined): string | null {
  if (!code) {
    return null;
  }
  return MESSAGES[code] ?? "L'opération n'a pas abouti. Réessayez ou contactez l'équipe Hannon Acadimi.";
}

export function codeDepuis(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (error instanceof Error) {
    if (error.message.startsWith("SESSION_") || error.message.startsWith("TARIF_") || error.message.startsWith("COURS_")) {
      return error.message;
    }
    return "PAIEMENT";
  }
  return "INATTENDUE";
}
