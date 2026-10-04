import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formaterCreneau } from "@/lib/format";
import { disponibilitesSessions } from "@/lib/commerce/service";
import { Banniere } from "@/app/components/Banniere";
import { actionAdminSession, actionAdminSessionModifier } from "@/lib/actions/adminCatalogue";

export const dynamic = "force-dynamic";

export default async function AdminSessions({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const [cours, formateurs, sessions] = await Promise.all([
    prisma.cours.findMany({ orderBy: { titre: "asc" } }),
    prisma.formateur.findMany({ orderBy: { nom: "asc" } }),
    prisma.session.findMany({
      include: { cours: true, emploiDuTemps: { include: { cours: true } }, formateur: true },
      orderBy: { dateReelle: "desc" },
      take: 40,
    }),
  ]);
  const stocks = await disponibilitesSessions(sessions.map((session) => session.id));

  return (
    <>
      <h1>Sessions</h1>
      <p className="lead">
        Une session est une date précise, avec une capacité. Le lien Zoom se saisit à la main : aucune réunion n’est
        créée automatiquement ici.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <form className="stack card" action={actionAdminSession}>
        <h2>Nouvelle session</h2>
        <label>
          Formation
          <select name="coursId" required>
            {cours.map((item) => (
              <option key={item.id} value={item.id}>
                {item.titre}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Date
            <input type="date" name="jour" required />
          </label>
          <label>
            Début
            <input type="time" name="heureDebut" required defaultValue="09:00" />
          </label>
          <label>
            Fin
            <input type="time" name="heureFin" required defaultValue="17:00" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Fuseau
            <input name="fuseau" defaultValue="Europe/Paris" required />
          </label>
          <label>
            Capacité maximale
            <input type="number" name="capaciteMax" min={1} defaultValue={20} required />
          </label>
        </div>
        <label>
          Formateur
          <select name="formateurId" defaultValue="">
            <option value="">À désigner plus tard</option>
            {formateurs.map((formateur) => (
              <option key={formateur.id} value={formateur.id}>
                {formateur.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Ouvrir la session</button>
      </form>

      <div className="grid" style={{ marginTop: "1rem" }}>
        {sessions.length === 0 ? (
          <div className="empty">Aucune session.</div>
        ) : (
          sessions.map((session) => {
            const stock = stocks.get(session.id);
            const titre = session.cours?.titre ?? session.emploiDuTemps?.cours.titre ?? "Formation";
            return (
              <form className="stack card" action={actionAdminSessionModifier} key={session.id}>
                <h2>{titre}</h2>
                <p>{formaterCreneau(session.dateReelle, session.fuseauHoraire)}</p>
                <p className="muted">
                  Confirmées {stock?.confirmees ?? 0} · réservations actives {stock?.reservees ?? 0} · disponibles{" "}
                  {stock?.disponibles ?? 0}
                </p>
                <input type="hidden" name="sessionId" value={session.id} />
                <label>
                  Capacité maximale
                  <input type="number" name="capaciteMax" min={1} defaultValue={session.capaciteMax} required />
                </label>
                <label>
                  Inscriptions
                  <select name="statutInscription" defaultValue={session.statutInscription}>
                    <option value="OUVERTE">Ouvertes</option>
                    <option value="FERMEE">Fermées</option>
                    <option value="COMPLETE">Complète</option>
                    <option value="ANNULEE">Annulée</option>
                  </select>
                </label>
                <label>
                  Lien Zoom
                  <input name="lienZoomManuel" defaultValue={session.lienZoomManuel ?? ""} placeholder="https://zoom.us/j/…" />
                </label>
                <button type="submit">Enregistrer</button>
              </form>
            );
          })
        )}
      </div>
    </>
  );
}
