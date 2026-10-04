import { describe, expect, it } from "vitest";
import { lireProfilParticulier } from "@/lib/profil";

const maintenant = new Date("2026-10-04T12:00:00.000Z");

function formulaire(champs: Record<string, string>): FormData {
  const form = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) {
    form.set(cle, valeur);
  }
  return form;
}

const complet = {
  prenom: "Léa",
  nom: "Martin",
  telephone: "06 12 34 56 78",
  dateNaissance: "1998-04-12",
  ville: "Lyon",
  niveauEtude: "Licence",
  situation: "En recherche d’emploi",
};

describe("lireProfilParticulier", () => {
  it("accepte un dossier complet", () => {
    const profil = lireProfilParticulier(formulaire(complet), maintenant);
    expect(profil?.nomComplet).toBe("Léa Martin");
    expect(profil?.niveauEtude).toBe("Licence");
    expect(profil?.dateNaissance.toISOString().slice(0, 10)).toBe("1998-04-12");
  });

  it("refuse un dossier incomplet, un mineur ou un niveau inconnu", () => {
    expect(lireProfilParticulier(formulaire({ ...complet, telephone: "123" }), maintenant)).toBeNull();
    expect(lireProfilParticulier(formulaire({ ...complet, dateNaissance: "2015-01-01" }), maintenant)).toBeNull();
    expect(lireProfilParticulier(formulaire({ ...complet, niveauEtude: "CAP" }), maintenant)).toBeNull();
    expect(lireProfilParticulier(formulaire({ ...complet, prenom: "" }), maintenant)).toBeNull();
  });
});
