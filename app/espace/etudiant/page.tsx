import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formaterCreneau, lienZoomSession } from "@/lib/format";
import { Banniere } from "@/app/components/Banniere";

export const dynamic = "force-dynamic";

export default async function EspaceApprenant({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  const user = await requireRole("ETUDIANT_B2C", "EMPLOYE", "SOCIETE");
  const [personnelles, affectations, certificats, historiques] = await Promise.all([
    prisma.commande.findMany({
      where: { compteId: user.id, statut: "PAYEE", typeAcheteur: "PARTICULIER" },
      include: { cours: { include: { ressources: true } }, session: true },
      orderBy: { session: { dateReelle: "asc" } },
    }),
    prisma.affectation.findMany({
      where: { compteId: user.id },
      include: {
        session: true,
        societe: true,
        commande: { include: { cours: { include: { ressources: true } } } },
      },
    }),
    prisma.certificat.findMany({
      where: { compteId: user.id },
      include: { cours: true },
      orderBy: { emisLe: "desc" },
    }),
    user.etudiantId
      ? prisma.inscription.findMany({
          where: { etudiantId: user.etudiantId },
          include: {
            cours: {
              include: {
                ressources: true,
                emploisDuTemps: {
                  include: {
                    sessions: { where: { statut: { in: ["PLANIFIEE", "EN_COURS"] } }, orderBy: { dateReelle: "asc" }, take: 4 },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const seances = [
    ...personnelles.map((commande) => ({
      id: commande.session.id,
      titre: commande.cours.titre,
      session: commande.session,
      origine: "Achat personnel",
    })),
    ...affectations.map((affectation) => ({
      id: `${affectation.id}-org`,
      titre: affectation.commande.cours.titre,
      session: affectation.session,
      origine: affectation.societe.nom,
    })),
    ...historiques.flatMap((inscription) =>
      inscription.cours.emploisDuTemps.flatMap((edt) =>
        edt.sessions.map((session) => ({
          id: session.id,
          titre: inscription.cours.titre,
          session,
          origine: "Inscription existante",
        })),
      ),
    ),
  ].sort((a, b) => a.session.dateReelle.getTime() - b.session.dateReelle.getTime());

  const ressources = new Map<string, { id: string; titre: string; nomFichier: string }>();
  for (const commande of personnelles) {
    for (const ressource of commande.cours.ressources) {
      ressources.set(ressource.id, ressource);
    }
  }
  for (const affectation of affectations) {
    for (const ressource of affectation.commande.cours.ressources) {
      ressources.set(ressource.id, ressource);
    }
  }
  for (const inscription of historiques) {
    for (const ressource of inscription.cours.ressources) {
      ressources.set(ressource.id, ressource);
    }
  }

  const vide = seances.length === 0 && certificats.length === 0;

  return (
    <>
      <h1>Mon espace</h1>
      <p className="lead">Vos sessions, votre planning, les liens Zoom, les ressources et les certificats.</p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      {searchParams.ok === "rattachement" ? (
        <p className="alert ok">Votre compte est rattaché à l’organisation. Vos achats personnels sont conservés.</p>
      ) : null}
      {vide ? (
        <div className="empty">
          <p>Vous n’avez pas encore de formation. Achetez une place ou attendez l’affectation de votre organisation.</p>
          <Link className="btn" href="/catalogue">
            Voir le catalogue
          </Link>
        </div>
      ) : null}

      <section className="card">
        <h2>Emploi du temps</h2>
        {seances.length === 0 ? (
          <p>Aucune séance à venir.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Formation</th>
                  <th>Accès</th>
                  <th>Zoom</th>
                </tr>
              </thead>
              <tbody>
                {seances.map((seance) => {
                  const lien = lienZoomSession(seance.session);
                  return (
                    <tr key={seance.id}>
                      <td>{formaterCreneau(seance.session.dateReelle, seance.session.fuseauHoraire)}</td>
                      <td>
                        {seance.titre}
                        <br />
                        <span className="muted">{seance.origine}</span>
                      </td>
                      <td>{seance.session.fuseauHoraire}</td>
                      <td>
                        {lien ? (
                          <a className="btn zoom-cta" href={lien} target="_blank" rel="noreferrer">
                            Rejoindre la formation sur Zoom
                          </a>
                        ) : (
                          <span className="muted">Le lien Zoom n’est pas encore renseigné. Il apparaîtra ici dès qu’il sera ajouté.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Ressources de cours</h2>
        {ressources.size === 0 ? (
          <p>Aucun document n’a encore été déposé pour vos formations.</p>
        ) : (
          <ul className="plain">
            {Array.from(ressources.values()).map((ressource) => (
              <li key={ressource.id}>
                <a href={`/api/documents/ressources/${ressource.id}`}>{ressource.titre}</a>
                <span className="muted"> · {ressource.nomFichier}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Certificats</h2>
        {certificats.length === 0 ? (
          <p>Aucun certificat ne vous a encore été attribué.</p>
        ) : (
          <ul className="plain">
            {certificats.map((certificat) => (
              <li key={certificat.id}>
                <a href={`/api/documents/certificats/${certificat.id}`}>{certificat.titre}</a>
                <span className="muted"> · {certificat.cours.titre} · télécharger</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
