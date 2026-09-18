import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminEtudiantsPage() {
  await requireRole("ADMIN");
  const etudiants = await prisma.etudiant.findMany({
    include: {
      compte: true,
      inscriptions: { include: { cours: true } },
    },
    orderBy: { nom: "asc" },
  });

  return (
    <>
      <h1>Étudiants</h1>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Type</th>
              <th>Formations</th>
            </tr>
          </thead>
          <tbody>
            {etudiants.map((e) => (
              <tr key={e.id}>
                <td>{e.nom}</td>
                <td>{e.email}</td>
                <td>{e.compte?.role ?? "—"}</td>
                <td>{e.inscriptions.map((i) => i.cours.titre).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
