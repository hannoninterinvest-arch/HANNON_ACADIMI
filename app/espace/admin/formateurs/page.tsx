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
      {searchParams.ok ? <p className="ok">Formateur enregistré. Mot de passe par défaut : Hannon2026!</p> : null}
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
              <th>E-mail</th>
              <th>Compte</th>
              <th>Créneaux</th>
            </tr>
          </thead>
          <tbody>
            {formateurs.map((f) => (
              <tr key={f.id}>
                <td>{f.nom}</td>
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
