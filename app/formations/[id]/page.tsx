import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { lireSession } from "@/lib/auth";
import { formatEuros, formaterCreneau } from "@/lib/format";
import { disponibilitesSessions, devisSession } from "@/lib/commerce/service";
import { Banniere } from "@/app/components/Banniere";
import { FormulaireAchat } from "@/app/components/FormulaireAchat";
import { actionCalculerDevis, actionCreerCommande } from "@/lib/actions/commerce";

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
  searchParams: { erreur?: string };
}) {
  const cours = await prisma.cours.findUnique({
    where: { id: params.id },
    include: { tarif: { include: { regles: { where: { actif: true } } } } },
  });
  if (!cours) {
    notFound();
  }
  const sessions = await prisma.session.findMany({
    where: {
      statutInscription: "OUVERTE",
      OR: [{ coursId: cours.id }, { emploiDuTemps: { coursId: cours.id } }],
    },
    include: { formateur: true },
    orderBy: { dateReelle: "asc" },
  });
  const stocks = await disponibilitesSessions(sessions.map((session) => session.id));
  const sessionUtilisateur = await lireSession();
  const profil =
    sessionUtilisateur?.role === "SOCIETE"
      ? (
          await prisma.societe.findUnique({ where: { id: sessionUtilisateur.societeId ?? "" } })
        )?.type === "ORGANISME_PUBLIC"
        ? "B2G"
        : "B2B"
      : "B2C";
  const peutAcheter =
    sessionUtilisateur?.role === "ETUDIANT_B2C" ||
    sessionUtilisateur?.role === "EMPLOYE" ||
    sessionUtilisateur?.role === "SOCIETE";
  const devisParSession = new Map<string, Awaited<ReturnType<typeof devisSession>>>();
  if (cours.tarif && peutAcheter) {
    await Promise.all(
      sessions.map(async (session) => {
        try {
          devisParSession.set(
            session.id,
            await devisSession({ sessionId: session.id, profil, quantite: 1 }),
          );
        } catch {
          // Le formulaire reste masqué si le tarif de la session est illisible.
        }
      }),
    );
  }
  const formateur = sessions.find((session) => session.formateur)?.formateur ?? null;

  return (
    <main className="fiche">
      <p className="eyebrow">Formation en ligne</p>
      <div className="fiche-layout">
        <article className="fiche-corps">
          <div className={cours.imageChemin ? "affiche" : "affiche affiche-vide"}>
            {cours.imageChemin ? <img src={cours.imageChemin} alt="" /> : null}
            <span className="domaine-pill">{cours.domaine || "Formation en ligne"}</span>
          </div>
          <h1>{cours.titre}</h1>
          <p className="lead">{cours.description || "Classe en direct, sur une session datée, avec un nombre de places tenu."}</p>
          <ul className="fiche-details">
            <li>
              <span>Domaine</span>
              <strong>{cours.domaine || "À préciser"}</strong>
            </li>
            <li>
              <span>Horaire</span>
              <strong>{cours.horaire || "Voir la session"}</strong>
            </li>
            <li>
              <span>Format</span>
              <strong>Classe en ligne</strong>
            </li>
          </ul>
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
        </article>

        <aside className="fiche-achat">
          <Banniere erreur={searchParams.erreur} />
          <section className="card">
            <h2>Tarifs</h2>
            {cours.tarif ? (
              <>
                <p>
                  Particulier : <strong>{formatEuros(cours.tarif.prixB2cCentimes)}</strong>
                </p>
                <p>
                  Organisation, prix de base par place :{" "}
                  <strong>{formatEuros(cours.tarif.prixOrganisationCentimes)}</strong>
                </p>
                {cours.tarif.regles.length === 0 ? (
                  <p className="muted">Aucune remise n’est configurée.</p>
                ) : (
                  cours.tarif.regles.map((regle) => (
                    <p key={regle.id}>
                      Dès {regle.seuilQuantite} places ({regle.profils.join(", ")}), remise{" "}
                      {regle.typeRemise === "POURCENTAGE" ? `${regle.valeur} %` : formatEuros(regle.valeur)} sur toutes
                      les places. Acheter moins de places reste possible, au tarif de base.
                    </p>
                  ))
                )}
              </>
            ) : (
              <p>Le tarif de cette formation n’est pas encore publié.</p>
            )}
          </section>

          {sessions.length === 0 ? (
            <div className="empty">
              <p>Aucune session n’est ouverte à l’inscription.</p>
              <Link className="btn" href="/demande">
                Demander cette formation
              </Link>
            </div>
          ) : (
            sessions.map((session) => {
              const stock = stocks.get(session.id);
              const devis = devisParSession.get(session.id) ?? null;
              return (
                <article className="card" key={session.id}>
                  <h2>{formaterCreneau(session.dateReelle, session.fuseauHoraire)}</h2>
                  <p>
                    {session.formateur ? session.formateur.nom : "Formateur à confirmer"}
                    {session.dateFin ? ` · fin ${formaterCreneau(session.dateFin, session.fuseauHoraire)}` : ""}
                  </p>
                  <p>
                    <span className={stock && stock.disponibles > 0 ? "badge ok" : "badge warn"}>
                      {stock?.disponibles ?? 0} place(s) disponible(s)
                    </span>{" "}
                    sur {stock?.capaciteMax ?? session.capaciteMax}.
                  </p>
                  {!sessionUtilisateur ? (
                    <p>
                      <Link className="btn" href={`/connexion?next=/formations/${cours.id}`}>
                        Se connecter pour s’inscrire
                      </Link>
                    </p>
                  ) : null}
                  {peutAcheter && devis ? (
                    <FormulaireAchat
                      sessionId={session.id}
                      retour={`/formations/${cours.id}`}
                      profil={profil}
                      places={stock?.disponibles ?? 0}
                      devisInitial={devis}
                      calculer={actionCalculerDevis}
                      acheter={actionCreerCommande}
                    />
                  ) : null}
                  {sessionUtilisateur && !peutAcheter ? (
                    <p className="muted">Ce profil ne peut pas acheter une place depuis le catalogue.</p>
                  ) : null}
                </article>
              );
            })
          )}
        </aside>
      </div>
    </main>
  );
}
