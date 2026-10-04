import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatEuros } from "@/lib/format";
import { Banniere } from "@/app/components/Banniere";
import { actionAdminTarif } from "@/lib/actions/adminCatalogue";

export const dynamic = "force-dynamic";

export default async function AdminTarifs({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const cours = await prisma.cours.findMany({
    include: { tarif: { include: { regles: true } } },
    orderBy: { titre: "asc" },
  });

  return (
    <>
      <h1>Tarifs et remises</h1>
      <p className="lead">
        Le seuil ouvre une remise, ce n’est pas une quantité minimale. Les montants sont figés sur chaque commande.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="grid">
        {cours.map((item) => {
          const regle = item.tarif?.regles[0];
          return (
            <form className="stack card" action={actionAdminTarif} key={item.id}>
              <h2>{item.titre}</h2>
              {item.tarif ? (
                <p className="muted">
                  Actuel : {formatEuros(item.tarif.prixB2cCentimes)} particulier ·{" "}
                  {formatEuros(item.tarif.prixOrganisationCentimes)} organisation
                </p>
              ) : (
                <p className="muted">Aucun tarif publié.</p>
              )}
              <input type="hidden" name="coursId" value={item.id} />
              <div className="form-row">
                <label>
                  Prix individuel (€)
                  <input name="prixB2c" type="number" min={0} step="0.01" required defaultValue={item.tarif ? (item.tarif.prixB2cCentimes / 100).toFixed(2) : "490.00"} />
                </label>
                <label>
                  Prix organisation / place (€)
                  <input name="prixOrganisation" type="number" min={0} step="0.01" required defaultValue={item.tarif ? (item.tarif.prixOrganisationCentimes / 100).toFixed(2) : "390.00"} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Seuil de remise
                  <input name="seuil" type="number" min={1} defaultValue={regle?.seuilQuantite ?? 10} required />
                </label>
                <label>
                  Type
                  <select name="typeRemise" defaultValue={regle?.typeRemise ?? "POURCENTAGE"}>
                    <option value="POURCENTAGE">Pourcentage</option>
                    <option value="MONTANT_FIXE">Montant fixe par place (€)</option>
                  </select>
                </label>
                <label>
                  Valeur
                  <input name="valeur" type="number" min={0} step="0.01" defaultValue={regle ? (regle.typeRemise === "MONTANT_FIXE" ? (regle.valeur / 100).toFixed(2) : String(regle.valeur)) : "15"} required />
                </label>
              </div>
              <fieldset>
                <legend>Profils concernés</legend>
                <label>
                  <input type="checkbox" name="profil_B2B" defaultChecked={regle ? regle.profils.includes("B2B") : true} /> B2B
                </label>
                <label>
                  <input type="checkbox" name="profil_B2G" defaultChecked={regle ? regle.profils.includes("B2G") : true} /> B2G
                </label>
              </fieldset>
              <button type="submit">Enregistrer le tarif</button>
            </form>
          );
        })}
      </div>
    </>
  );
}
