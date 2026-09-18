import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionAdminLicenceZoom } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminZoomPage({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const licences = await prisma.licenceZoom.findMany({
    include: { sessionEnCours: { include: { emploiDuTemps: { include: { cours: true } } } } },
    orderBy: { compteEmail: "asc" },
  });
  const libres = licences.filter((l) => l.statut === "LIBRE").length;

  return (
    <>
      <h1>Pool Zoom Pro</h1>
      <p className="lead">
        Ajoutez autant de licences Pro que de séances simultanées. Occupé = meeting en cours.
        Libre = disponible pour une nouvelle session.
      </p>
      <p>
        Comptes <strong>pas en meeting</strong> : <span className="badge">{libres}</span> /{" "}
        {licences.length}
      </p>
      {searchParams.ok ? <p className="ok">Licence enregistrée.</p> : null}
      {searchParams.erreur ? <p className="missing">E-mail et Zoom User ID requis.</p> : null}

      <form className="stack card" action={actionAdminLicenceZoom}>
        <h2>Ajouter un compte Zoom Pro</h2>
        <label>
          E-mail du compte Zoom
          <input type="email" name="compteEmail" required />
        </label>
        <label>
          Zoom User ID
          <input name="zoomUserId" required placeholder="id utilisateur Marketplace" />
        </label>
        <label>
          Host key (6–10 chiffres, optionnel)
          <input name="hostKey" />
        </label>
        <button type="submit">Ajouter au pool</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>Compte</th>
              <th>User ID</th>
              <th>Statut</th>
              <th>Séance en cours</th>
            </tr>
          </thead>
          <tbody>
            {licences.map((l) => (
              <tr key={l.id}>
                <td>{l.compteEmail}</td>
                <td>
                  <code>{l.zoomUserId}</code>
                </td>
                <td>
                  <span className={`badge ${l.statut === "LIBRE" ? "" : "warn"}`}>{l.statut}</span>
                </td>
                <td>
                  {l.sessionEnCours
                    ? l.sessionEnCours.emploiDuTemps.cours.titre
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
