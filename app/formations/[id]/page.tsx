import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lireSession } from "@/lib/auth";
import { formatEuros, formaterCreneau } from "@/lib/format";
import { libelleCandidature } from "@/lib/groupes";
import { Banniere } from "@/app/components/Banniere";
import { actionCandidature, actionPayerGroupe } from "@/lib/actions/groupes";

export const dynamic = "force-dynamic";

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((partie) => partie[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function FormationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erreur?: string; ok?: string };
}) {
  const cours = await prisma.cours.findUnique({
    where: { id: params.id },
    include: {
      tarif: { include: { regles: { where: { actif: true } } } },
      groupes: { include: { formateur: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!cours) {
    notFound();
  }
  const sessionUtilisateur = await lireSession();
  const [candidature, demandes, sessionFormateur] = await Promise.all([
    sessionUtilisateur
      ? prisma.candidature.findUnique({
          where: { coursId_compteId: { coursId: cours.id, compteId: sessionUtilisateur.id } },
          include: { groupe: true },
        })
      : Promise.resolve(null),
    prisma.candidature.count({ where: { coursId: cours.id, statut: { not: "ANNULEE" } } }),
    prisma.session.findFirst({
      where: {
        formateurId: { not: null },
        OR: [{ coursId: cours.id }, { emploiDuTemps: { coursId: cours.id } }],
      },
      include: { formateur: true },
      orderBy: { dateReelle: "asc" },
    }),
  ]);
  const formateur = cours.groupes.find((groupe) => groupe.formateur)?.formateur ?? sessionFormateur?.formateur ?? null;
  const peutDemander = sessionUtilisateur?.role === "ETUDIANT_B2C" || sessionUtilisateur?.role === "EMPLOYE";
  const paiementOuvert = Boolean(
    candidature?.statut === "DANS_GROUPE" && candidature.groupe?.paiementOuvert && candidature.groupe.sessionId,
  );

  return (
    <main className="fiche">
      <p className="eyebrow">Formation en ligne</p>
      <div className="fiche-layout">
        <article className="fiche-corps">
          <div className={cours.imageChemin ? "affiche" : "affiche affiche-vide"}>
            {cours.imageChemin ? <img src={cours.imageChemin} alt="" /> : null}
            <span className="domaine-pill">{cours.domaine || "Formation en ligne"}</span>
          </div>
          <div className="formateur-ligne">
            {formateur?.photoChemin ? (
              <img className="formateur-photo" src={formateur.photoChemin} alt="" />
            ) : (
              <span className="formateur-initiales" aria-hidden="true">
                {formateur ? initiales(formateur.nom) : "HA"}
              </span>
            )}
            <div>
              <p className="eyebrow">Formateur</p>
              <strong>{formateur?.nom ?? "Annoncé avant la session"}</strong>
              <p className="muted">{formateur?.specialite || "Intervenant Hannon Academy"}</p>
            </div>
          </div>
          <h1>{cours.titre}</h1>
          <p className="lead">{cours.description || "Classe en direct. Vous déposez votre demande, puis le groupe se constitue."}</p>
          <ul className="fiche-details">
            <li>
              <span>Domaine</span>
              <strong>{cours.domaine || "À préciser"}</strong>
            </li>
            <li>
              <span>Horaire</span>
              <strong>{cours.horaire || "Fixé avec le groupe"}</strong>
            </li>
            <li>
              <span>Groupe dès</span>
              <strong>
                {cours.effectifMinimal} participant{cours.effectifMinimal > 1 ? "s" : ""}
              </strong>
            </li>
          </ul>
          {cours.groupes.some((groupe) => groupe.dateDebut) ? (
            <section>
              <h2>Groupes</h2>
              {cours.groupes
                .filter((groupe) => groupe.dateDebut)
                .map((groupe) => (
                  <p key={groupe.id}>
                    <strong>{groupe.nom}</strong>
                    {groupe.dateDebut ? ` · ${formaterCreneau(groupe.dateDebut, "Europe/Paris")}` : ""}
                    {groupe.horaire ? ` · ${groupe.horaire}` : ""}
                    {groupe.formateur ? ` · ${groupe.formateur.nom}` : ""}
                  </p>
                ))}
            </section>
          ) : null}
        </article>

        <aside className="fiche-achat">
          <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
          <section className="card demande-carte">
            <h2>Rejoindre cette formation</h2>
            <p>
              {demandes} demande{demandes > 1 ? "s" : ""}. Un nouveau groupe s’ouvre à partir de {cours.effectifMinimal}{" "}
              participant{cours.effectifMinimal > 1 ? "s" : ""}.
            </p>
            <ol className="etapes-demande">
              <li>Vous remplissez le formulaire.</li>
              <li>Nous vous contactons.</li>
              <li>Le paiement s’ouvre quand le groupe atteint le minimum.</li>
              <li>Le paiement en ligne est confirmé automatiquement. Les espèces sont confirmées par l’équipe.</li>
            </ol>
            {cours.tarif ? (
              <p>
                Tarif particulier : <strong>{formatEuros(cours.tarif.prixB2cCentimes)}</strong>
              </p>
            ) : (
              <p className="muted">Le tarif sera communiqué avec l’ouverture du paiement.</p>
            )}
            {candidature && candidature.statut !== "ANNULEE" ? (
              <p className="tag">{libelleCandidature(candidature.statut)}</p>
            ) : null}
            {paiementOuvert && candidature ? (
              <form action={actionPayerGroupe}>
                <input type="hidden" name="candidatureId" value={candidature.id} />
                <button type="submit">Payer en ligne</button>
                <p className="muted">Si vous payez en espèces, l’équipe confirmera votre place.</p>
              </form>
            ) : null}
            {candidature?.statut === "PAYEE" ? (
              <p>
                <Link className="btn" href="/espace/etudiant">
                  Voir ma formation
                </Link>
              </p>
            ) : null}
            {!sessionUtilisateur ? (
              <div className="actions">
                <Link className="btn" href={`/inscription?next=/formations/${cours.id}`}>
                  Créer mon compte
                </Link>
                <Link className="btn-secondary" href={`/connexion?next=/formations/${cours.id}`}>
                  J’ai déjà un compte
                </Link>
              </div>
            ) : null}
            {peutDemander && (!candidature || candidature.statut === "ANNULEE") ? (
              <form className="stack" action={actionCandidature}>
                <input type="hidden" name="coursId" value={cours.id} />
                <p>
                  <strong>{sessionUtilisateur?.nom}</strong>
                </p>
                <label>
                  Message pour l’équipe
                  <textarea name="message" rows={3} placeholder="Vos disponibilités, une question…" />
                </label>
                <button type="submit">Envoyer ma demande</button>
              </form>
            ) : null}
            {sessionUtilisateur && !peutDemander && !candidature ? (
              <p className="muted">Le formulaire est réservé aux particuliers.</p>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}
