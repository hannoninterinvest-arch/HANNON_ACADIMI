import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatEuros, formaterCreneau } from "@/lib/format";
import { Banniere } from "@/app/components/Banniere";
import { actionAffecterEmploye, actionDesaffecterEmploye } from "@/lib/actions/organisation";

export const dynamic = "force-dynamic";

export default async function EspaceOrganisation({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  const user = await requireRole("SOCIETE");
  if (!user.societeId) {
    return <p>Compte organisation incomplet.</p>;
  }
  const societeId = user.societeId;
  const [societe, commandes, membres, historiques] = await Promise.all([
    prisma.societe.findUnique({ where: { id: societeId } }),
    prisma.commande.findMany({
      where: { societeId },
      include: {
        cours: true,
        session: true,
        affectations: { include: { compte: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appartenance.findMany({
      where: { societeId },
      include: { compte: true },
      orderBy: { compte: { nom: "asc" } },
    }),
    prisma.achatPlaces.findMany({ where: { societeId }, include: { cours: true } }),
  ]);
  const payees = commandes.filter((commande) => commande.statut === "PAYEE");
  const placesAchetees = payees.reduce((total, commande) => total + commande.quantite, 0);
  const placesAffectees = payees.reduce((total, commande) => total + commande.affectations.length, 0);

  return (
    <>
      <h1>{societe?.type === "ORGANISME_PUBLIC" ? "Espace organisme public" : "Espace entreprise"}</h1>
      <p className="lead">
        {societe?.nom}. Achetez des places sur une session, puis affectez vos collaborateurs dans la limite du lot payé.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="stat-grid">
        <div className="stat">
          <span>Places achetées</span>
          <strong>{placesAchetees}</strong>
        </div>
        <div className="stat">
          <span>Places affectées</span>
          <strong>{placesAffectees}</strong>
        </div>
        <div className="stat">
          <span>Reste à affecter</span>
          <strong>{placesAchetees - placesAffectees}</strong>
        </div>
      </div>
      <p className="actions">
        <Link className="btn" href="/catalogue">
          Acheter des places
        </Link>
        <Link className="btn-secondary" href="/espace/societe/equipe">
          Gérer l’équipe
        </Link>
      </p>

      {payees.length === 0 ? (
        <div className="empty">
          <p>Aucun lot confirmé. Choisissez une session dans le catalogue : la disponibilité est revérifiée à chaque achat.</p>
        </div>
      ) : (
        payees.map((commande) => {
          const restantes = commande.quantite - commande.affectations.length;
          return (
            <section className="card" key={commande.id} style={{ marginTop: "1rem" }}>
              <h2>{commande.cours.titre}</h2>
              <p>{formaterCreneau(commande.session.dateReelle, commande.session.fuseauHoraire)}</p>
              <p>
                {commande.quantite} places achetées · {commande.affectations.length} affectées · {restantes} restantes ·{" "}
                {formatEuros(commande.totalCentimes)}
              </p>
              <p className="muted">{commande.libelleRemise}</p>
              {commande.affectations.length === 0 ? (
                <p>Aucun employé inscrit sur ce lot.</p>
              ) : (
                <ul className="plain">
                  {commande.affectations.map((affectation) => (
                    <li key={affectation.id}>
                      {affectation.compte.nom} · {affectation.compte.email}{" "}
                      <form action={actionDesaffecterEmploye} style={{ display: "inline" }}>
                        <input type="hidden" name="affectationId" value={affectation.id} />
                        <button type="submit" className="btn-secondary">
                          Retirer
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {restantes > 0 ? (
                <form className="stack" action={actionAffecterEmploye} style={{ marginTop: "0.8rem" }}>
                  <input type="hidden" name="sessionId" value={commande.sessionId} />
                  <label>
                    Affecter un membre
                    <select name="compteId" required defaultValue="">
                      <option value="" disabled>
                        Choisir
                      </option>
                      {membres.map((membre) => (
                        <option key={membre.compteId} value={membre.compteId}>
                          {membre.compte.nom} · {membre.role === "RESPONSABLE" ? "responsable" : "apprenant"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">Inscrire sur une place du lot</button>
                </form>
              ) : (
                <p className="muted">Ce lot est complet. Un achat supplémentaire revérifie les places de la session.</p>
              )}
              <p>
                <Link href={`/formations/${commande.coursId}`}>Acheter des places supplémentaires</Link>
              </p>
            </section>
          );
        })
      )}

      {historiques.length > 0 ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Achats historiques</h2>
          <p className="muted">Conservés pour mémoire. Les nouvelles places passent par une commande payée.</p>
          <ul className="plain">
            {historiques.map((achat) => (
              <li key={achat.id}>
                {achat.cours.titre} — {achat.nbPlaces} places
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Commandes</h2>
        {commandes.length === 0 ? (
          <p>Pas encore de commande.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Statut</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((commande) => (
                  <tr key={commande.id}>
                    <td>{commande.reference}</td>
                    <td>{commande.statut}</td>
                    <td>{formatEuros(commande.totalCentimes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
