import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionSocieteAchat, actionSocieteEmploye } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SocieteEspace({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  const user = await requireRole("SOCIETE");
  if (!user.societeId) {
    return <p>Compte société incomplet.</p>;
  }

  const [cours, achats, employes, emplois] = await Promise.all([
    prisma.cours.findMany({ orderBy: { titre: "asc" } }),
    prisma.achatPlaces.findMany({
      where: { societeId: user.societeId },
      include: { cours: true },
    }),
    prisma.compte.findMany({
      where: { societeId: user.societeId, role: "EMPLOYE" },
      include: { etudiant: { include: { inscriptions: { include: { cours: true } } } } },
    }),
    prisma.emploiDuTemps.findMany({
      include: { cours: true, formateur: true },
      orderBy: [{ jourSemaine: "asc" }, { heureDebut: "asc" }],
    }),
  ]);

  return (
    <>
      <h1>Espace société</h1>
      <p className="lead">Achetez des places, assignez vos employés, suivez l’emploi du temps.</p>
      {searchParams.ok === "achat" ? <p className="ok">Places achetées.</p> : null}
      {searchParams.ok === "employe" ? <p className="ok">Employé ajouté (mot de passe par défaut Hannon2026!).</p> : null}
      {searchParams.erreur === "places" ? (
        <p className="missing">Plus de places disponibles sur cette formation. Achetez-en d’abord.</p>
      ) : null}

      <form className="stack card" action={actionSocieteAchat}>
        <h2>Acheter des places</h2>
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
          Nombre de places
          <input type="number" name="nbPlaces" min={1} defaultValue={5} required />
        </label>
        <button type="submit">Acheter</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Places</h2>
        <ul className="plain">
          {achats.map((a) => (
            <li key={a.id}>
              {a.cours.titre} — {a.nbPlaces} places
            </li>
          ))}
        </ul>
      </section>

      <form className="stack card" style={{ marginTop: "1rem" }} action={actionSocieteEmploye}>
        <h2>Ajouter un employé</h2>
        <label>
          Nom
          <input name="nom" required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" required />
        </label>
        <label>
          Formation (doit avoir des places)
          <select name="coursId" required>
            {achats.map((a) => (
              <option key={a.id} value={a.coursId}>
                {a.cours.titre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Créer le compte employé</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Employés</h2>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Formations</th>
            </tr>
          </thead>
          <tbody>
            {employes.map((e) => (
              <tr key={e.id}>
                <td>{e.nom}</td>
                <td>{e.email}</td>
                <td>
                  {e.etudiant?.inscriptions.map((i) => i.cours.titre).join(", ") ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Emploi du temps global</h2>
        <table>
          <thead>
            <tr>
              <th>Formation</th>
              <th>Formateur</th>
              <th>Créneau</th>
            </tr>
          </thead>
          <tbody>
            {emplois.map((e) => (
              <tr key={e.id}>
                <td>{e.cours.titre}</td>
                <td>{e.formateur.nom}</td>
                <td>
                  {e.jourSemaine} {e.heureDebut}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
