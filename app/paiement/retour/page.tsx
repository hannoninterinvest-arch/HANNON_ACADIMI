import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { lireSession, cheminEspace } from "@/lib/auth";
import { peutVoirCommande } from "@/lib/acces";
import { formatEuros, formaterCreneau } from "@/lib/format";
import { Banniere } from "@/app/components/Banniere";
import { actionAnnulerCommande } from "@/lib/actions/commerce";

export const dynamic = "force-dynamic";

const LIBELLES = {
  EN_ATTENTE: "En attente de confirmation du paiement",
  PAYEE: "Payée",
  ECHOUEE: "Échouée",
  ANNULEE: "Annulée",
  REMBOURSEE: "Remboursée",
} as const;

export default async function RetourPaiement({
  searchParams,
}: {
  searchParams: { commande?: string; erreur?: string };
}) {
  const session = await lireSession();
  const commande = searchParams.commande
    ? await prisma.commande.findUnique({
        where: { id: searchParams.commande },
        include: { cours: true, session: true },
      })
    : null;
  const visible = session && commande ? peutVoirCommande(session, commande) : false;

  return (
    <main>
      <p className="eyebrow">Paiement</p>
      <h1>État de la commande</h1>
      <p className="lead">
        Cette page affiche l’état enregistré après vérification auprès du prestataire. Elle ne confirme pas
        le paiement.
      </p>
      <Banniere erreur={searchParams.erreur} />
      {!commande || !visible ? (
        <div className="empty">
          <p>Aucune commande accessible à afficher.</p>
          <Link href="/catalogue">Retour au catalogue</Link>
        </div>
      ) : (
        <section className="card">
          <h2>{commande.cours.titre}</h2>
          <p>
            <span className={commande.statut === "PAYEE" ? "badge ok" : "badge warn"}>
              {LIBELLES[commande.statut]}
            </span>
          </p>
          <p>
            {commande.quantite} place(s) · {formatEuros(commande.totalCentimes)} · référence {commande.reference}
          </p>
          <p>{formaterCreneau(commande.session.dateReelle, commande.session.fuseauHoraire)}</p>
          {commande.statut === "PAYEE" && session ? (
            <p>
              <Link className="btn" href={cheminEspace(session.role)}>
                Ouvrir mon espace
              </Link>
            </p>
          ) : null}
          {commande.statut === "EN_ATTENTE" ? (
            <>
              <p className="muted">
                Si vous venez de payer, attendez la confirmation. Vous pouvez aussi reprendre le paiement en
                mode test ou annuler pour libérer les places.
              </p>
              <div className="actions">
                <Link className="btn" href={`/paiement/test/${commande.id}`}>
                  Reprendre
                </Link>
                <form action={actionAnnulerCommande}>
                  <input type="hidden" name="commandeId" value={commande.id} />
                  <button type="submit" className="btn-secondary">
                    Annuler la commande
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </section>
      )}
    </main>
  );
}
