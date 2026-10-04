import { describe, expect, it } from "vitest";
import { calculerDevis, remiseUnitaireCentimes, TarificationError } from "@/lib/commerce/tarifs";

const regleQuinze = {
  seuilQuantite: 10,
  typeRemise: "POURCENTAGE" as const,
  valeur: 15,
  profils: ["B2B" as const, "B2G" as const],
  actif: true,
};

describe("calculerDevis", () => {
  it("laisse 9 places au tarif de base et applique 15 % sur toutes les places dès 10", () => {
    const neuf = calculerDevis({
      profil: "B2B",
      quantite: 9,
      prixB2cCentimes: 49000,
      prixOrganisationCentimes: 10000,
      regles: [regleQuinze],
    });
    expect(neuf.remiseAppliquee).toBe(false);
    expect(neuf.prixUnitaireNetCentimes).toBe(10000);
    expect(neuf.totalCentimes).toBe(90000);

    const dix = calculerDevis({
      profil: "B2B",
      quantite: 10,
      prixB2cCentimes: 49000,
      prixOrganisationCentimes: 10000,
      regles: [regleQuinze],
    });
    expect(dix.remiseUnitaireCentimes).toBe(1500);
    expect(dix.prixUnitaireNetCentimes).toBe(8500);
    expect(dix.totalCentimes).toBe(85000);
    expect(dix.remiseAppliquee).toBe(true);
  });

  it("n'impose pas le seuil comme quantité minimale", () => {
    const devis = calculerDevis({
      profil: "B2G",
      quantite: 1,
      prixB2cCentimes: 1000,
      prixOrganisationCentimes: 800,
      regles: [regleQuinze],
    });
    expect(devis.totalCentimes).toBe(800);
    expect(devis.libelle).toContain("à partir de 10");
  });

  it("applique un montant fixe par place uniquement au-dessus du seuil", () => {
    const devis = calculerDevis({
      profil: "B2B",
      quantite: 12,
      prixB2cCentimes: 1000,
      prixOrganisationCentimes: 5000,
      regles: [
        {
          seuilQuantite: 10,
          typeRemise: "MONTANT_FIXE",
          valeur: 500,
          profils: ["B2B"],
          actif: true,
        },
      ],
    });
    expect(devis.remiseUnitaireCentimes).toBe(500);
    expect(devis.totalCentimes).toBe(4500 * 12);
  });

  it("n'applique pas une remise B2B à un particulier", () => {
    const devis = calculerDevis({
      profil: "B2C",
      quantite: 1,
      prixB2cCentimes: 49000,
      prixOrganisationCentimes: 10000,
      regles: [regleQuinze],
    });
    expect(devis.prixUnitaireCentimes).toBe(49000);
    expect(devis.remiseAppliquee).toBe(false);
    expect(devis.totalCentimes).toBe(49000);
  });

  it("arrondit le pourcentage au centime le plus proche", () => {
    expect(remiseUnitaireCentimes(999, "POURCENTAGE", 15)).toBe(150);
    expect(remiseUnitaireCentimes(333, "POURCENTAGE", 10)).toBe(33);
  });

  it("refuse une quantité nulle et un pourcentage hors limites", () => {
    expect(() =>
      calculerDevis({
        profil: "B2B",
        quantite: 0,
        prixB2cCentimes: 100,
        prixOrganisationCentimes: 100,
        regles: [],
      }),
    ).toThrow(TarificationError);
    expect(() => remiseUnitaireCentimes(1000, "POURCENTAGE", 140)).toThrow(TarificationError);
  });
});
