import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSocietesPage() {
  await requireRole("ADMIN");
  const societes = await prisma.societe.findMany({
    include: {
      achats: { include: { cours: true } },
      comptes: { where: { role: "EMPLOYE" } },
    },
    orderBy: { nom: "asc" },
  });

  return (
    <>
      <h1>Sociétés</h1>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Société</th>
              <th>E-mail</th>
              <th>Places achetées</th>
              <th>Employés</th>
            </tr>
          </thead>
          <tbody>
            {societes.map((s) => (
              <tr key={s.id}>
                <td>{s.nom}</td>
                <td>{s.email}</td>
                <td>
                  {s.achats.map((a) => `${a.cours.titre} × ${a.nbPlaces}`).join(" ; ") || "—"}
                </td>
                <td>{s.comptes.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
