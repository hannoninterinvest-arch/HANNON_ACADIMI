import { DateTime } from "luxon";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { participantsParSession } from "@/lib/participants";
import { VISUELS } from "@/lib/visuels";
import { Banniere } from "@/app/components/Banniere";
import {
  actionAdminFormationComplet,
  actionAdminFormationModifier,
  actionAdminFormationSupprimer,
} from "@/lib/actions/adminStudio";

export const dynamic = "force-dynamic";

function champ(date: Date, fuseau: string, format: string): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(fuseau).toFormat(format);
}

export default async function AdminFormations({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const [cours, formateurs] = await Promise.all([
    prisma.cours.findMany({
      include: {
        sessionsCommerciales: { orderBy: { dateReelle: "asc" } },
      },
      orderBy: { titre: "asc" },
    }),
    prisma.formateur.findMany({ orderBy: { nom: "asc" } }),
  ]);
  const participants = await participantsParSession(
    cours.flatMap((item) => item.sessionsCommerciales.map((session) => session.id)),
    true,
  );

  return (
    <>
      <h1>Formations</h1>
      <p className="lead">
        Publiez l’affiche, le domaine, le formateur, les détails et la session en ligne. Le catalogue reste vide
        tant que vous n’en publiez pas.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <form className="stack card" action={actionAdminFormationComplet}>
        <h2>Nouvelle formation</h2>
        <label>
          Titre
          <input name="titre" required />
        </label>
        <div className="form-row">
          <label>
            Domaine
            <input name="domaine" placeholder="Bureautique, langues, management…" />
          </label>
          <label>
            Formateur
            <select name="formateurId" defaultValue="">
              <option value="">Annoncé plus tard</option>
              {formateurs.map((formateur) => (
                <option key={formateur.id} value={formateur.id}>
                  {formateur.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Détails de la formation
          <textarea name="description" rows={3} placeholder="Objectifs, public, déroulé de la classe en ligne…" />
        </label>
        <label>
          Emploi du temps
          <input name="horaire" placeholder="Tous les lundis, 18h–20h" />
        </label>
        <div className="form-row">
          <label>
            Date de début
            <input type="date" name="jour" required />
          </label>
          <label>
            Heure de début
            <input type="time" name="heureDebut" required defaultValue="09:00" />
          </label>
          <label>
            Heure de fin
            <input type="time" name="heureFin" required defaultValue="12:00" />
          </label>
        </div>
        <label>
          Capacité
          <input type="number" name="capaciteMax" min={1} defaultValue={20} required />
        </label>
        <div className="form-row">
          <label>
            Prix particulier (€)
            <input name="prixB2c" inputMode="decimal" placeholder="120" />
          </label>
          <label>
            Prix organisation (€)
            <input name="prixOrganisation" inputMode="decimal" placeholder="90" />
          </label>
        </div>
        <label>
          Lien Zoom
          <input name="lienZoomManuel" placeholder="https://zoom.us/j/…" />
        </label>
        <label>
          Code de réunion
          <input name="codeReunion" placeholder="123 456 7890" />
        </label>
        <label>
          Photo de la bibliothèque
          <select name="visuel" defaultValue="">
            <option value="">Aucune</option>
            {VISUELS.map((visuel) => (
              <option key={visuel.src} value={visuel.src}>
                {visuel.alt}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ou déposer l’affiche
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif" />
        </label>
        <button type="submit">Publier la formation</button>
      </form>

      <div className="grid" style={{ marginTop: "1rem" }}>
        {cours.length === 0 ? (
          <div className="empty">Aucune formation pour le moment.</div>
        ) : (
          cours.map((item) => {
            const session = item.sessionsCommerciales[0];
            const personnes = item.sessionsCommerciales.flatMap((seance) => participants.get(seance.id) ?? []);
            const uniques = Array.from(new Map(personnes.map((personne) => [personne.id, personne])).values());
            return (
              <article className="card" key={item.id}>
                {item.imageChemin ? (
                  <img className="course-photo" src={item.imageChemin} alt="" />
                ) : null}
                <form className="stack" action={actionAdminFormationModifier}>
                  <input type="hidden" name="coursId" value={item.id} />
                  {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}
                  <label>
                    Titre
                    <input name="titre" defaultValue={item.titre} required />
                  </label>
                  <div className="form-row">
                    <label>
                      Domaine
                      <input name="domaine" defaultValue={item.domaine ?? ""} />
                    </label>
                    <label>
                      Formateur
                      <select name="formateurId" defaultValue={session?.formateurId ?? ""}>
                        <option value="">Annoncé plus tard</option>
                        {formateurs.map((formateur) => (
                          <option key={formateur.id} value={formateur.id}>
                            {formateur.nom}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Détails
                    <textarea name="description" rows={2} defaultValue={item.description ?? ""} />
                  </label>
                  <label>
                    Emploi du temps
                    <input name="horaire" defaultValue={item.horaire ?? ""} />
                  </label>
                  {session ? (
                    <div className="form-row">
                      <label>
                        Date
                        <input type="date" name="jour" defaultValue={champ(session.dateReelle, session.fuseauHoraire, "yyyy-MM-dd")} />
                      </label>
                      <label>
                        Début
                        <input type="time" name="heureDebut" defaultValue={champ(session.dateReelle, session.fuseauHoraire, "HH:mm")} />
                      </label>
                      <label>
                        Fin
                        <input
                          type="time"
                          name="heureFin"
                          defaultValue={session.dateFin ? champ(session.dateFin, session.fuseauHoraire, "HH:mm") : "12:00"}
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="muted">Ajoutez une date depuis Sessions.</p>
                  )}
                  <label>
                    Lien Zoom
                    <input name="lienZoomManuel" defaultValue={session?.lienZoomManuel ?? ""} />
                  </label>
                  <label>
                    Code de réunion
                    <input name="codeReunion" defaultValue={session?.codeReunion ?? ""} />
                  </label>
                  <label>
                    Photo
                    <select name="visuel" defaultValue={item.imageChemin && VISUELS.some((visuel) => visuel.src === item.imageChemin) ? item.imageChemin : ""}>
                      <option value="">Garder la photo actuelle</option>
                      {VISUELS.map((visuel) => (
                        <option key={visuel.src} value={visuel.src}>
                          {visuel.alt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nouvelle photo
                    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif" />
                  </label>
                  <label className="check">
                    <input type="checkbox" name="retirerPhoto" /> Retirer la photo
                  </label>
                  <button type="submit">Enregistrer</button>
                </form>
                <h3>Personnes inscrites</h3>
                {uniques.length === 0 ? (
                  <p className="muted">Personne n’est encore inscrit à cette formation.</p>
                ) : (
                  <ul className="plain">
                    {uniques.map((personne) => (
                      <li key={personne.id}>
                        {personne.nom}
                        {personne.email ? <span className="muted"> · {personne.email}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={actionAdminFormationSupprimer}>
                  <input type="hidden" name="coursId" value={item.id} />
                  <label className="check">
                    <input type="checkbox" name="confirmer" required /> Confirmer la suppression
                  </label>
                  <button type="submit" className="btn-secondary">
                    Supprimer
                  </button>
                </form>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
