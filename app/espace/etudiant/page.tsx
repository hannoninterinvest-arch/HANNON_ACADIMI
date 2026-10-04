import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formaterCreneau, lienZoomSession } from "@/lib/format";
import { participantsParSession } from "@/lib/participants";
import { Banniere } from "@/app/components/Banniere";
import { CompteARebours } from "@/app/components/CompteARebours";
import { BoutonCopier } from "@/app/components/BoutonCopier";

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
      image: commande.cours.imageChemin,
      horaire: commande.cours.horaire,
      session: commande.session,
      origine: "Achat personnel",
    })),
    ...affectations.map((affectation) => ({
      id: affectation.session.id,
      titre: affectation.commande.cours.titre,
      image: affectation.commande.cours.imageChemin,
      horaire: affectation.commande.cours.horaire,
      session: affectation.session,
      origine: affectation.societe.nom,
    })),
    ...historiques.flatMap((inscription) =>
      inscription.cours.emploisDuTemps.flatMap((edt) =>
        edt.sessions.map((session) => ({
          id: session.id,
          titre: inscription.cours.titre,
          image: inscription.cours.imageChemin,
          horaire: inscription.cours.horaire,
          session,
          origine: "Inscription existante",
        })),
      ),
    ),
  ]
    .filter((seance, index, liste) => liste.findIndex((autre) => autre.id === seance.id) === index)
    .sort((a, b) => a.session.dateReelle.getTime() - b.session.dateReelle.getTime());
  const participants = await participantsParSession(
    seances.map((seance) => seance.session.id),
    false,
  );

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

      <section>
        <h2>Mes formations</h2>
        {seances.length === 0 ? (
          <p>Aucune séance à venir.</p>
        ) : (
          <div className="live-grid">
            {seances.map((seance) => {
              const lien = lienZoomSession(seance.session);
              const presents = participants.get(seance.session.id) ?? [];
              return (
                <article className="live-card" key={seance.id}>
                  {seance.image ? <img src={seance.image} alt="" /> : null}
                  <div>
                    <p className="upcoming-meta">
                      <span>{seance.origine}</span>
                      <span>{seance.session.fuseauHoraire}</span>
                    </p>
                    <h3>{seance.titre}</h3>
                    <p>{formaterCreneau(seance.session.dateReelle, seance.session.fuseauHoraire)}</p>
                    {seance.horaire ? <p className="muted">{seance.horaire}</p> : null}
                    <CompteARebours
                      debutIso={seance.session.dateReelle.toISOString()}
                      finIso={seance.session.dateFin ? seance.session.dateFin.toISOString() : null}
                    />
                    <div className="actions">
                      {lien ? (
                        <a className="btn zoom-cta" href={lien} target="_blank" rel="noreferrer">
                          Rejoindre sur Zoom
                        </a>
                      ) : (
                        <span className="muted">Le lien Zoom n’est pas encore renseigné.</span>
                      )}
                      {seance.session.codeReunion ? <BoutonCopier valeur={seance.session.codeReunion} /> : null}
                    </div>
                    <h4>Participants</h4>
                    {presents.length === 0 ? (
                      <p className="muted">Vous êtes le premier inscrit visible.</p>
                    ) : (
                      <ul className="plain">
                        {presents.map((personne) => (
                          <li key={personne.id}>{personne.nom}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
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
