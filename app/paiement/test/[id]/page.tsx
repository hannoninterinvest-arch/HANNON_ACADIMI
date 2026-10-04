import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { peutVoirCommande } from "@/lib/acces";
import { getPaymentMode } from "@/lib/env";
import { formatEuros } from "@/lib/format";
import { actionSimulerPaiement } from "@/lib/actions/commerce";
import { Banniere } from "@/app/components/Banniere";

export const dynamic = "force-dynamic";

export default async function PaiementTestPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erreur?: string };
}) {
  const user = await requireUser();
  if (getPaymentMode() !== "test") {
    redirect(`/paiement/retour?commande=${params.id}`);
  }
  const commande = await prisma.commande.findUnique({
    where: { id: params.id },
    include: { cours: true },
  });
  if (!commande) {
    notFound();
  }
  if (!peutVoirCommande(user, commande)) {
    redirect("/paiement/retour?erreur=ACCES");
  }

  return (
    <main>
      <p className="banner-test">Mode test — aucun prélèvement réel. La confirmation passe par un webhook signé.</p>
      <h1>Paiement de test</h1>
      <Banniere erreur={searchParams.erreur} />
      <section className="card">
        <h2>{commande.cours.titre}</h2>
        <p>
          Prix unitaire net {formatEuros(commande.prixUnitaireCentimes - commande.remiseUnitaireCentimes)} · remise{" "}
          {formatEuros(commande.remiseUnitaireCentimes)} / place · total {formatEuros(commande.totalCentimes)}
        </p>
        <p className="muted">{commande.libelleRemise}</p>
        <p>Statut actuel : {commande.statut}</p>
        {commande.statut === "EN_ATTENTE" ? (
          <div className="actions">
            <form action={actionSimulerPaiement}>
              <input type="hidden" name="commandeId" value={commande.id} />
              <input type="hidden" name="issue" value="succes" />
              <button type="submit">Simuler un paiement réussi</button>
            </form>
            <form action={actionSimulerPaiement}>
              <input type="hidden" name="commandeId" value={commande.id} />
              <input type="hidden" name="issue" value="echec" />
              <button type="submit" className="btn-secondary">
                Simuler un échec
              </button>
            </form>
          </div>
        ) : (
          <Link href={`/paiement/retour?commande=${commande.id}`}>Voir l’état enregistré</Link>
        )}
      </section>
    </main>
  );
}
