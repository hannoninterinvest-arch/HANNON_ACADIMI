import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionAdminFormateur } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminFormateurs({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const formateurs = await prisma.formateur.findMany({
    include: { compte: true, emploisDuTemps: true },
    orderBy: { nom: "asc" },
  });

  return (
    <>
      <h1>Formateurs</h1>
      <p className="lead">Le nom, la spécialité et la photo apparaissent sur la fiche de chaque formation.</p>
      {searchParams.ok ? <p className="ok">Formateur enregistré. Mot de passe par défaut : Hannon2026!</p> : null}
      {searchParams.erreur === "PHOTO" ? (
        <p className="missing">La photo doit être une image jpg, png, webp ou avif de 5 Mo au plus.</p>
      ) : null}
      {searchParams.erreur === "champs" ? <p className="missing">Nom et e-mail sont requis.</p> : null}
      <form className="stack card" action={actionAdminFormateur}>
        <h2>Ajouter un formateur</h2>
        <label>
          Nom
          <input name="nom" required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" required />
        </label>
        <label>
          Spécialité
          <input name="specialite" placeholder="Tableur, anglais professionnel, gestion de projet…" />
        </label>
        <label>
          Photo
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif" />
        </label>
        <label>
          Mot de passe initial
          <input name="motDePasse" placeholder="Hannon2026!" />
        </label>
        <button type="submit">Créer le compte formateur</button>
      </form>
      <section className="card" style={{ marginTop: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Spécialité</th>
              <th>E-mail</th>
              <th>Compte</th>
              <th>Créneaux</th>
            </tr>
          </thead>
          <tbody>
            {formateurs.map((f) => (
              <tr key={f.id}>
                <td>
                  {f.photoChemin ? <img className="vignette" src={f.photoChemin} alt="" /> : null}
                  {f.nom}
                </td>
                <td>{f.specialite || "—"}</td>
                <td>{f.email}</td>
                <td>{f.compte ? "oui" : "non"}</td>
                <td>{f.emploisDuTemps.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
