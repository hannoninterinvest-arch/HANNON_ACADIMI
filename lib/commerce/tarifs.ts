export type ProfilTarif = "B2C" | "B2B" | "B2G";
export type TypeRemise = "POURCENTAGE" | "MONTANT_FIXE";

export type RegleRemiseSaisie = {
  seuilQuantite: number;
  typeRemise: TypeRemise;
  valeur: number;
  profils: ProfilTarif[];
  actif: boolean;
};

export type Devis = {
  profil: ProfilTarif;
  quantite: number;
  prixUnitaireCentimes: number;
  remiseUnitaireCentimes: number;
  prixUnitaireNetCentimes: number;
  totalCentimes: number;
  remiseTotaleCentimes: number;
  devise: "EUR";
  seuil: number | null;
  remiseAppliquee: boolean;
  typeRemise: TypeRemise | null;
  valeurRemise: number | null;
  libelle: string;
};

export class TarificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TarificationError";
  }
}

function entierPositif(valeur: number, message: string): void {
  if (!Number.isInteger(valeur) || valeur < 0) {
    throw new TarificationError(message);
  }
}

export function remiseUnitaireCentimes(
  prixUnitaireCentimes: number,
  typeRemise: TypeRemise,
  valeur: number,
): number {
  entierPositif(prixUnitaireCentimes, "Le prix unitaire doit être un nombre entier de centimes.");
  if (!Number.isInteger(valeur) || valeur < 0) {
    throw new TarificationError("La valeur de remise doit être un entier positif.");
  }
  if (typeRemise === "POURCENTAGE") {
    if (valeur > 100) {
      throw new TarificationError("Une remise en pourcentage ne peut pas dépasser 100.");
    }
    const remise = Math.round((prixUnitaireCentimes * valeur) / 100);
    return Math.min(prixUnitaireCentimes, remise);
  }
  return Math.min(prixUnitaireCentimes, valeur);
}

function regleApplicable(
  regles: RegleRemiseSaisie[],
  profil: ProfilTarif,
  quantite: number,
  prixUnitaireCentimes: number,
): RegleRemiseSaisie | null {
  const eligibles = regles.filter(
    (regle) => regle.actif && regle.profils.includes(profil) && quantite >= regle.seuilQuantite,
  );
  if (eligibles.length === 0) {
    return null;
  }
  eligibles.sort((a, b) => {
    if (b.seuilQuantite !== a.seuilQuantite) {
      return b.seuilQuantite - a.seuilQuantite;
    }
    const remiseA = remiseUnitaireCentimes(prixUnitaireCentimes, a.typeRemise, a.valeur);
    const remiseB = remiseUnitaireCentimes(prixUnitaireCentimes, b.typeRemise, b.valeur);
    return remiseB - remiseA;
  });
  return eligibles[0] ?? null;
}

export function calculerDevis(input: {
  profil: ProfilTarif;
  quantite: number;
  prixB2cCentimes: number;
  prixOrganisationCentimes: number;
  regles: RegleRemiseSaisie[];
}): Devis {
  if (!Number.isInteger(input.quantite) || input.quantite < 1) {
    throw new TarificationError("La quantité doit être un entier supérieur ou égal à 1.");
  }
  entierPositif(input.prixB2cCentimes, "Le prix individuel est invalide.");
  entierPositif(input.prixOrganisationCentimes, "Le prix organisation est invalide.");

  for (const regle of input.regles) {
    if (!Number.isInteger(regle.seuilQuantite) || regle.seuilQuantite < 1) {
      throw new TarificationError("Le seuil de remise doit être un entier supérieur ou égal à 1.");
    }
  }

  const prixUnitaireCentimes =
    input.profil === "B2C" ? input.prixB2cCentimes : input.prixOrganisationCentimes;
  const regle = regleApplicable(input.regles, input.profil, input.quantite, prixUnitaireCentimes);
  const remiseUnitaire = regle
    ? remiseUnitaireCentimes(prixUnitaireCentimes, regle.typeRemise, regle.valeur)
    : 0;
  const net = prixUnitaireCentimes - remiseUnitaire;
  const seuilAffiche =
    regle?.seuilQuantite ??
    input.regles.find((item) => item.actif && item.profils.includes(input.profil))?.seuilQuantite ??
    null;

  let libelle = "Tarif de base, sans remise.";
  if (regle && remiseUnitaire > 0) {
    libelle =
      regle.typeRemise === "POURCENTAGE"
        ? `Remise de ${regle.valeur} % dès ${regle.seuilQuantite} places, appliquée à chaque place.`
        : `Remise fixe par place dès ${regle.seuilQuantite} places, appliquée à chaque place.`;
  } else if (seuilAffiche && input.quantite < seuilAffiche) {
    libelle = `Tarif de base. La remise s'applique à partir de ${seuilAffiche} places, sur toutes les places.`;
  }

  return {
    profil: input.profil,
    quantite: input.quantite,
    prixUnitaireCentimes,
    remiseUnitaireCentimes: remiseUnitaire,
    prixUnitaireNetCentimes: net,
    totalCentimes: net * input.quantite,
    remiseTotaleCentimes: remiseUnitaire * input.quantite,
    devise: "EUR",
    seuil: regle?.seuilQuantite ?? seuilAffiche,
    remiseAppliquee: remiseUnitaire > 0,
    typeRemise: regle?.typeRemise ?? null,
    valeurRemise: regle?.valeur ?? null,
    libelle,
  };
}
