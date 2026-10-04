export const NIVEAUX_ETUDE = [
  "Collège",
  "Baccalauréat",
  "Bac+2",
  "Licence",
  "Master",
  "Doctorat",
  "Autre",
] as const;

export const SITUATIONS = [
  "Étudiant",
  "Salarié",
  "Indépendant",
  "En recherche d’emploi",
  "Autre",
] as const;

export type ProfilParticulier = {
  prenom: string;
  nom: string;
  telephone: string;
  niveauEtude: string;
  situation: string;
  ville: string;
  dateNaissance: Date;
  nomComplet: string;
};

function texte(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function autorise(valeur: string, liste: readonly string[]): boolean {
  return liste.some((item) => item === valeur);
}

function ageAu(date: Date, maintenant: Date): number {
  let age = maintenant.getUTCFullYear() - date.getUTCFullYear();
  const mois = maintenant.getUTCMonth() - date.getUTCMonth();
  if (mois < 0 || (mois === 0 && maintenant.getUTCDate() < date.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function lireProfilParticulier(form: FormData, maintenant = new Date()): ProfilParticulier | null {
  const prenom = texte(form, "prenom");
  const nom = texte(form, "nom");
  const telephone = texte(form, "telephone");
  const niveauEtude = texte(form, "niveauEtude");
  const situation = texte(form, "situation");
  const ville = texte(form, "ville");
  const naissance = texte(form, "dateNaissance");
  const chiffres = telephone.replace(/\D/g, "");
  if (
    prenom.length < 2 ||
    nom.length < 2 ||
    chiffres.length < 8 ||
    telephone.length > 24 ||
    ville.length < 2 ||
    !autorise(niveauEtude, NIVEAUX_ETUDE) ||
    !autorise(situation, SITUATIONS) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(naissance)
  ) {
    return null;
  }
  const dateNaissance = new Date(`${naissance}T00:00:00.000Z`);
  if (Number.isNaN(dateNaissance.getTime())) {
    return null;
  }
  const age = ageAu(dateNaissance, maintenant);
  if (age < 16 || age > 100) {
    return null;
  }
  return {
    prenom,
    nom,
    telephone,
    niveauEtude,
    situation,
    ville,
    dateNaissance,
    nomComplet: `${prenom} ${nom}`,
  };
}
