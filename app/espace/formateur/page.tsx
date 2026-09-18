import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FormateurEspace() {
  const user = await requireRole("FORMATEUR");
  const sessions = user.formateurId
    ? await prisma.session.findMany({
        where: { emploiDuTemps: { formateurId: user.formateurId } },
        include: { emploiDuTemps: { include: { cours: true } } },
        orderBy: { dateReelle: "asc" },
        take: 40,
      })
    : [];
  const emplois = user.formateurId
    ? await prisma.emploiDuTemps.findMany({
        where: { formateurId: user.formateurId },
        include: { cours: true },
      })
    : [];

  return (
    <>
      <h1>Mes séances</h1>
      <p className="lead">
        Utilisez le host key pour devenir animateur. Vous n’avez jamais les identifiants du
        compte Zoom du pool.
      </p>
      <section className="card">
        <h2>Emploi du temps</h2>
        <ul className="plain">
          {emplois.map((e) => (
            <li key={e.id}>
              {e.cours.titre} — {e.jourSemaine} {e.heureDebut} ({e.dureeMinutes} min)
            </li>
          ))}
        </ul>
      </section>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Sessions</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Cours</th>
              <th>Statut</th>
              <th>Lien</th>
              <th>Host key</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.dateReelle.toISOString()}</td>
                <td>{s.emploiDuTemps.cours.titre}</td>
                <td>
                  <span className="badge">{s.statut}</span>
                </td>
                <td>
                  {s.joinUrl ? (
                    <a href={s.joinUrl} target="_blank" rel="noreferrer">
                      Rejoindre
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <code>{s.hostKey ?? "—"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
