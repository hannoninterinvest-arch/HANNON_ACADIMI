import { prisma } from "@/lib/prisma";
import { describeMissingSecrets, getAppTimezone, getSessionHorizonJours } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`badge ${ok ? "" : "warn"}`}>{label}</span>;
}

export default async function HomePage() {
  const [formateurs, licences, emplois, sessions] = await Promise.all([
    prisma.formateur.findMany({ orderBy: { nom: "asc" } }),
    prisma.licenceZoom.findMany({ orderBy: { compteEmail: "asc" } }),
    prisma.emploiDuTemps.findMany({
      include: { cours: true, formateur: true },
      orderBy: { heureDebut: "asc" },
    }),
    prisma.session.findMany({
      include: { emploiDuTemps: { include: { cours: true } } },
      orderBy: { dateReelle: "asc" },
      take: 20,
    }),
  ]);

  const missing = describeMissingSecrets();
  const timezone = getAppTimezone();
  let horizon = 14;
  try {
    horizon = getSessionHorizonJours();
  } catch {
    horizon = 14;
  }

  return (
    <main>
      <h1>Hannon Acadimi</h1>
      <p className="lead">
        Plateforme e-learning — création automatique des réunions Zoom via un pool de licences,
        sans jamais donner les identifiants Zoom aux formateurs.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Configuration</h2>
        <p>
          Fuseau : <code>{timezone}</code> — horizon de génération : {horizon} jours
        </p>
        {missing.length === 0 ? (
          <Badge ok label="Toutes les variables d'environnement sont renseignées" />
        ) : (
          <p className="missing">
            Variables encore vides (l&apos;app démarre, mais Zoom / e-mail ne pourront pas
            être appelés) : <code>{missing.join(", ")}</code>
          </p>
        )}
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Formateurs ({formateurs.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {formateurs.map((f) => (
                <tr key={f.id}>
                  <td>{f.nom}</td>
                  <td>{f.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Pool Zoom ({licences.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Compte</th>
                <th>Statut</th>
                <th>Host key</th>
              </tr>
            </thead>
            <tbody>
              {licences.map((l) => (
                <tr key={l.id}>
                  <td>{l.compteEmail}</td>
                  <td>
                    <span className={`badge ${l.statut === "LIBRE" ? "" : "warn"}`}>
                      {l.statut}
                    </span>
                  </td>
                  <td>
                    <code>{l.hostKey ?? "—"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Emplois du temps</h2>
        {emplois.length === 0 ? (
          <p>Aucun créneau. Lancez <code>npx prisma db seed</code>.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cours</th>
                <th>Formateur</th>
                <th>Créneau</th>
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
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Sessions ({sessions.length} affichées)</h2>
        {sessions.length === 0 ? (
          <p>
            Pas encore de session. Appeler{" "}
            <code>POST /api/cron/generer-sessions</code> avec le header{" "}
            <code>Authorization: Bearer CRON_SECRET</code>.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Cours</th>
                <th>Statut</th>
                <th>Join URL</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.dateReelle.toISOString()}</td>
                  <td>{s.emploiDuTemps.cours.titre}</td>
                  <td>
                    <span className={`badge ${s.statut === "ANNULEE" ? "warn" : ""}`}>
                      {s.statut}
                    </span>
                  </td>
                  <td>{s.joinUrl ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="footer">
        Routes internes : <code>/api/cron/generer-sessions</code>,{" "}
        <code>/api/webhooks/zoom</code>, <code>/api/sessions</code>,{" "}
        <code>/api/emplois-du-temps/[id]</code>
      </p>
    </main>
  );
}
