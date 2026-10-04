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
  PHOTO: "La photo doit être une image jpg, png, webp ou avif de 5 Mo au plus.",
  LIEE: "Cette formation a des achats ou des certificats. Elle ne peut pas être supprimée.",
  SESSION_LIEE: "Cette session a des achats. Elle ne peut pas être supprimée.",
  DERNIER_ADMIN: "Le dernier administrateur ne peut pas être supprimé.",
  COMPTE_LIE: "Ce compte a des achats ou des affectations. Il ne peut pas être supprimé.",
  SOCIETE_LIEE: "Cette organisation a des achats. Elle ne peut pas être supprimée.",
  SOI: "Vous ne pouvez pas supprimer votre propre compte.",
  CANDIDATURE: "Vous avez déjà déposé une demande pour cette formation.",
  MINIMUM: "Le nombre minimal de participants n’est pas encore atteint.",
  PAIEMENT_FERME: "Le paiement de ce groupe n’est pas encore ouvert pour vous.",
  DEJA_PAYE: "Cette place est déjà confirmée.",
  DEJA_GROUPE: "Cette personne est déjà dans un autre groupe.",
  DATE: "Indiquez la date et les heures du groupe avant d’ouvrir le paiement.",
  GROUPE_LIE: "Ce groupe a des places confirmées. Il ne peut pas être supprimé.",
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
