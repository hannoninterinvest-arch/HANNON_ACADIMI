import { describe, expect, it } from "vitest";
import {
  peutGererOrganisation,
  peutVoirCertificat,
  peutVoirCommande,
  rolePourInscriptionPublique,
} from "@/lib/acces";

describe("autorisations", () => {
  it("n'accorde jamais le rôle administrateur via l'inscription publique", () => {
    expect(rolePourInscriptionPublique("PARTICULIER")).toBe("ETUDIANT_B2C");
    expect(rolePourInscriptionPublique("ENTREPRISE")).toBe("SOCIETE");
    expect(rolePourInscriptionPublique("ORGANISME_PUBLIC")).toBe("SOCIETE");
    expect(() => rolePourInscriptionPublique("ADMIN")).toThrow("TYPE_COMPTE_INVALIDE");
    expect(() => rolePourInscriptionPublique("FORMATEUR")).toThrow("TYPE_COMPTE_INVALIDE");
  });

  it("isole les commandes et les certificats entre organisations", () => {
    const orgA = { id: "resp-a", role: "SOCIETE", societeId: "org-a" };
    const orgB = { id: "resp-b", role: "SOCIETE", societeId: "org-b" };
    const employe = { id: "emp-1", role: "EMPLOYE", societeId: "org-a" };
    const commande = { compteId: "resp-a", societeId: "org-a" };

    expect(peutVoirCommande(orgA, commande)).toBe(true);
    expect(peutVoirCommande(orgB, commande)).toBe(false);
    expect(peutVoirCommande(employe, commande)).toBe(false);
    expect(peutGererOrganisation(orgA, "org-a")).toBe(true);
    expect(peutGererOrganisation(orgA, "org-b")).toBe(false);
    expect(peutVoirCertificat(employe, { compteId: "emp-1" })).toBe(true);
    expect(peutVoirCertificat(employe, { compteId: "emp-2" })).toBe(false);
    expect(peutVoirCertificat(orgA, { compteId: "emp-1" })).toBe(false);
  });
});
