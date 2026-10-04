import { describe, expect, it } from "vitest";
import { hasherJetonInvitation, parserCsvEmployes, preparerDemande } from "@/lib/invitations";

describe("invitations et demandes", () => {
  it("lit un CSV nom,email et ignore l'en-tête", () => {
    const lignes = parserCsvEmployes("nom,email\nAda Lovelace,ada@exemple.fr\nmauvais\nBob,bob@exemple.fr");
    expect(lignes).toEqual([
      { nom: "Ada Lovelace", email: "ada@exemple.fr" },
      { nom: "Bob", email: "bob@exemple.fr" },
    ]);
  });

  it("ne réserve aucune place pour une demande de formation", () => {
    const demande = preparerDemande({
      organisationNom: "Mairie de Rivage",
      contactNom: "Inès Bernard",
      email: "ines@mairie.fr",
      telephone: "0102030405",
      sujet: "Gestion de projet",
      nbParticipants: 12,
      periodeSouhaitee: "Janvier 2027",
      message: "Besoin d'une session intra.",
    });
    expect(demande.reserveDesPlaces).toBe(false);
    expect(demande.donnees).not.toHaveProperty("sessionId");
  });

  it("hash le jeton d'invitation sans le conserver en clair", () => {
    const hash = hasherJetonInvitation("jeton-secret");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("jeton-secret");
    expect(hasherJetonInvitation("jeton-secret")).toBe(hash);
  });
});
