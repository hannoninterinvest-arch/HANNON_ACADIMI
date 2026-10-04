import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatEuros } from "@/lib/format";
import { Banniere } from "@/app/components/Banniere";
import { actionAdminRembourser } from "@/lib/actions/adminCatalogue";

export const dynamic = "force-dynamic";

export default async function AdminCommandes({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const commandes = await prisma.commande.findMany({
    include: { cours: true, societe: true, compte: true, affectations: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <>
      <h1>Commandes</h1>
      <p className="lead">Les prix affichés sont ceux enregistrés au moment de l’achat.</p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      {commandes.length === 0 ? (
        <div className="empty">Aucune commande.</div>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Acheteur</th>
                <th>Formation</th>
                <th>Places</th>
                <th>Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((commande) => (
                <tr key={commande.id}>
                  <td>{commande.reference}</td>
                  <td>{commande.societe?.nom ?? commande.compte.nom}</td>
                  <td>{commande.cours.titre}</td>
                  <td>
                    {commande.quantite}
                    {commande.affectations.length > 0 ? ` · ${commande.affectations.length} affectées` : ""}
                  </td>
                  <td>{formatEuros(commande.totalCentimes)}</td>
                  <td>{commande.statut}</td>
                  <td>
                    {commande.statut === "PAYEE" ? (
                      <form action={actionAdminRembourser}>
                        <input type="hidden" name="commandeId" value={commande.id} />
                        <button type="submit" className="btn-secondary">
                          Rembourser
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
