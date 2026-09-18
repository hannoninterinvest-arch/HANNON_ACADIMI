import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionAdminFormation } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminFormations({
  searchParams,
}: {
  searchParams: { ok?: string };
}) {
  await requireRole("ADMIN");
  const cours = await prisma.cours.findMany({
    include: { _count: { select: { inscriptions: true, emploisDuTemps: true } } },
    orderBy: { titre: "asc" },
  });

  return (
    <>
      <h1>Formations</h1>
      {searchParams.ok ? <p className="ok">Formation créée.</p> : null}
      <form className="stack card" action={actionAdminFormation}>
        <h2>Nouvelle formation</h2>
        <label>
          Titre
          <input name="titre" required />
        </label>
        <label>
          Description
          <textarea name="description" rows={3} />
        </label>
        <button type="submit">Publier</button>
      </form>
      <section className="card" style={{ marginTop: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Inscrits</th>
              <th>Créneaux</th>
            </tr>
          </thead>
          <tbody>
            {cours.map((c) => (
              <tr key={c.id}>
                <td>{c.titre}</td>
                <td>{c._count.inscriptions}</td>
                <td>{c._count.emploisDuTemps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
