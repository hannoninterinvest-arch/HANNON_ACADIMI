import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionAdminEdt } from "@/lib/actions";
import { JourSemaine } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminEdtPage({
  searchParams,
}: {
  searchParams: { ok?: string };
}) {
  await requireRole("ADMIN");
  const [cours, formateurs, emplois, sessions] = await Promise.all([
    prisma.cours.findMany({ orderBy: { titre: "asc" } }),
    prisma.formateur.findMany({ orderBy: { nom: "asc" } }),
    prisma.emploiDuTemps.findMany({
      include: { cours: true, formateur: true },
      orderBy: [{ jourSemaine: "asc" }, { heureDebut: "asc" }],
    }),
    prisma.session.findMany({
      include: { emploiDuTemps: { include: { cours: true } }, licenceZoom: true },
      orderBy: { dateReelle: "asc" },
      take: 30,
    }),
  ]);

  return (
    <>
      <h1>Emploi du temps global</h1>
      {searchParams.ok ? <p className="ok">Créneau ajouté.</p> : null}
      <form className="stack card" action={actionAdminEdt}>
        <h2>Ajouter un créneau récurrent</h2>
        <label>
          Formation
          <select name="coursId" required>
            {cours.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formateur
          <select name="formateurId" required>
            {formateurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jour
          <select name="jourSemaine" required>
            {Object.values(JourSemaine).map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
        <label>
          Heure (HH:mm)
          <input name="heureDebut" placeholder="18:00" required />
        </label>
        <label>
          Durée (minutes)
          <input name="dureeMinutes" type="number" defaultValue={120} />
        </label>
        <label>
          Début de période
          <input name="dateDebutPeriode" type="date" required />
        </label>
        <label>
          Fin de période
          <input name="dateFinPeriode" type="date" required />
        </label>
        <button type="submit">Enregistrer le créneau</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Créneaux</h2>
        <table>
          <thead>
            <tr>
              <th>Formation</th>
              <th>Formateur</th>
              <th>Quand</th>
              <th>Période</th>
            </tr>
          </thead>
          <tbody>
            {emplois.map((e) => (
              <tr key={e.id}>
                <td>{e.cours.titre}</td>
                <td>{e.formateur.nom}</td>
                <td>
                  {e.jourSemaine} {e.heureDebut} ({e.dureeMinutes} min)
                </td>
                <td>
                  {e.dateDebutPeriode.toISOString().slice(0, 10)} →{" "}
                  {e.dateFinPeriode.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Sessions Zoom à venir</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Cours</th>
              <th>Statut</th>
              <th>Licence</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.dateReelle.toISOString()}</td>
                <td>{s.emploiDuTemps.cours.titre}</td>
                <td>
                  <span className={`badge ${s.statut === "EN_COURS" ? "warn" : ""}`}>
                    {s.statut}
                  </span>
                </td>
                <td>{s.licenceZoom?.compteEmail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
