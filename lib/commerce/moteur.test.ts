import { describe, expect, it } from "vitest";
import { calculerDevis } from "@/lib/commerce/tarifs";
import { MemoireCommerce } from "@/lib/commerce/memoire";
import {
  affecterPlace,
  confirmerPaiement,
  desaffecterPlace,
  expirerReservations,
  lireDisponibilite,
  placesDisponibles,
  reduireCapacite,
  RegleMetierError,
  reserverPlaces,
} from "@/lib/commerce/moteur";

const maintenant = new Date("2026-10-04T10:00:00.000Z");

function devisOrg(quantite: number) {
  return calculerDevis({
    profil: "B2B",
    quantite,
    prixB2cCentimes: 49000,
    prixOrganisationCentimes: 10000,
    regles: [
      {
        seuilQuantite: 10,
        typeRemise: "POURCENTAGE",
        valeur: 15,
        profils: ["B2B", "B2G"],
        actif: true,
      },
    ],
  });
}

function preparer(capacite: number) {
  const store = new MemoireCommerce();
  store.ajouterSession({
    id: "sess",
    capaciteMax: capacite,
    statutInscription: "OUVERTE",
    dateReelle: new Date("2026-11-02T08:00:00.000Z"),
  });
  return store;
}

async function acheter(
  store: MemoireCommerce,
  quantite: number,
  reference: string,
  options?: { societeId?: string; ttlMs?: number; compteId?: string },
) {
  return reserverPlaces(
    store,
    {
      sessionId: "sess",
      compteId: options?.compteId ?? "acheteur",
      societeId: options?.societeId ?? "org-a",
      coursId: "cours",
      quantite,
      typeAcheteur: "ORGANISATION",
      devis: devisOrg(quantite),
      fournisseurPaiement: "test",
      reference,
      ttlMs: options?.ttlMs ?? 30 * 60 * 1000,
    },
    maintenant,
  );
}

describe("places et affectations", () => {
  it("calcule les places disponibles", () => {
    expect(placesDisponibles(50, 20, 5)).toBe(25);
    expect(placesDisponibles(10, 8, 4)).toBe(0);
  });

  it("achète 50 places et refuse la 51e affectation sans retoucher le stock global", async () => {
    const store = preparer(50);
    const commande = await acheter(store, 50, "HA-50");
    const confirmation = await confirmerPaiement(store, commande.id, "pay_50", maintenant);
    expect(confirmation.ok).toBe(true);

    const employes = Array.from({ length: 51 }, (_, index) => `emp-${index + 1}`);
    for (const employe of employes) {
      store.ajouterMembre("org-a", employe);
    }

    for (let index = 0; index < 50; index += 1) {
      await affecterPlace({
        store,
        societeId: "org-a",
        sessionId: "sess",
        compteId: employes[index] ?? "",
      });
    }

    await expect(
      affecterPlace({
        store,
        societeId: "org-a",
        sessionId: "sess",
        compteId: "emp-51",
      }),
    ).rejects.toMatchObject({ code: "QUOTA_AFFECTATION" });

    const avant = await lireDisponibilite(store, "sess", maintenant);
    expect(avant.confirmees).toBe(50);
    expect(avant.disponibles).toBe(0);

    const premiere = await store.transaction(async (tx) => {
      const liste = await tx.affectationsOrganisationSession("org-a", "sess");
      return liste[0];
    });
    await desaffecterPlace({
      store,
      societeId: "org-a",
      affectationId: premiere?.id ?? "",
      maintenant,
    });

    const apres = await lireDisponibilite(store, "sess", maintenant);
    expect(apres.confirmees).toBe(50);
    expect(apres.disponibles).toBe(0);
    const restantes = await store.transaction(async (tx) => tx.affectationsOrganisationSession("org-a", "sess"));
    expect(restantes).toHaveLength(49);
  });

  it("empêche deux achats simultanés de dépasser un stock limité", async () => {
    const store = preparer(5);
    const resultats = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        acheter(store, 1, `HA-${index}`, { societeId: `org-${index}` }).then(
          (commande) => ({ ok: true as const, commande }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
      ),
    );
    const succes = resultats.filter((resultat) => resultat.ok);
    expect(succes).toHaveLength(5);
    const stock = await lireDisponibilite(store, "sess", maintenant);
    expect(stock.reservees).toBe(5);
    expect(stock.disponibles).toBe(0);
    expect(stock.confirmees).toBe(0);
  });

  it("ne confirme qu'une fois un paiement répété", async () => {
    const store = preparer(10);
    const commande = await acheter(store, 4, "HA-4");
    const premiere = await confirmerPaiement(store, commande.id, "pay_4", maintenant);
    const seconde = await confirmerPaiement(store, commande.id, "pay_4", maintenant);
    expect(premiere).toEqual({ ok: true, dejaConfirmee: false });
    expect(seconde).toEqual({ ok: true, dejaConfirmee: true });
    const stock = await lireDisponibilite(store, "sess", maintenant);
    expect(stock.confirmees).toBe(4);
    expect(stock.reservees).toBe(0);
  });

  it("libère les places quand la réservation expire", async () => {
    const store = preparer(8);
    await acheter(store, 3, "HA-exp", { ttlMs: 1000 });
    const avant = await lireDisponibilite(store, "sess", maintenant);
    expect(avant.disponibles).toBe(5);

    const plusTard = new Date(maintenant.getTime() + 60_000);
    const expirees = await expirerReservations(store, plusTard);
    expect(expirees).toBe(1);
    const apres = await lireDisponibilite(store, "sess", plusTard);
    expect(apres.disponibles).toBe(8);
    expect(apres.reservees).toBe(0);

    const commande = await store.transaction(async (tx) => {
      const toutes = await tx.reservationsActivesExpirees(new Date(0));
      return toutes;
    });
    expect(commande).toHaveLength(0);
  });

  it("refuse une confirmation après expiration", async () => {
    const store = preparer(8);
    const commande = await acheter(store, 2, "HA-late", { ttlMs: 1000 });
    const resultat = await confirmerPaiement(
      store,
      commande.id,
      "pay_late",
      new Date(maintenant.getTime() + 60_000),
    );
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.code).toBe("RESERVATION_EXPIREE");
    }
    const stock = await lireDisponibilite(store, "sess", new Date(maintenant.getTime() + 60_000));
    expect(stock.confirmees).toBe(0);
    expect(stock.disponibles).toBe(8);
  });

  it("bloque la double affectation et l'accès d'une autre organisation", async () => {
    const store = preparer(20);
    const commande = await acheter(store, 5, "HA-org");
    await confirmerPaiement(store, commande.id, "pay_org", maintenant);
    store.ajouterMembre("org-a", "emp-1");
    store.ajouterMembre("org-b", "emp-b");

    await affecterPlace({ store, societeId: "org-a", sessionId: "sess", compteId: "emp-1" });
    await expect(
      affecterPlace({ store, societeId: "org-a", sessionId: "sess", compteId: "emp-1" }),
    ).rejects.toMatchObject({ code: "DEJA_AFFECTE" });
    await expect(
      affecterPlace({ store, societeId: "org-a", sessionId: "sess", compteId: "emp-b" }),
    ).rejects.toMatchObject({ code: "HORS_ORGANISATION" });
  });

  it("refuse de baisser la capacité sous les places occupées", async () => {
    const store = preparer(10);
    const commande = await acheter(store, 6, "HA-cap");
    await confirmerPaiement(store, commande.id, "pay_cap", maintenant);
    await acheter(store, 2, "HA-hold");
    await expect(reduireCapacite(store, "sess", 7, maintenant)).rejects.toBeInstanceOf(RegleMetierError);
    await reduireCapacite(store, "sess", 8, maintenant);
    const stock = await lireDisponibilite(store, "sess", maintenant);
    expect(stock.capaciteMax).toBe(8);
    expect(stock.disponibles).toBe(0);
  });

  it("conserve le prix figé sur la commande", async () => {
    const store = preparer(30);
    const commande = await acheter(store, 10, "HA-prix");
    expect(commande.totalCentimes).toBe(85000);
    expect(commande.remiseUnitaireCentimes).toBe(1500);
    const autre = devisOrg(10);
    autre.totalCentimes = 1;
    expect(commande.totalCentimes).toBe(85000);
  });
});
