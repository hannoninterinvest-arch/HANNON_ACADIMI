import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionEtudiantInscription } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function EtudiantEspace({
  searchParams,
}: {
  searchParams: { ok?: string };
}) {
  const user = await requireRole("ETUDIANT_B2C", "EMPLOYE");
  const inscriptions = user.etudiantId
    ? await prisma.inscription.findMany({
        where: { etudiantId: user.etudiantId },
        include: {
          cours: {
            include: {
              emploisDuTemps: {
                include: {
                  sessions: {
                    where: { statut: { in: ["PLANIFIEE", "EN_COURS"] } },
                    orderBy: { dateReelle: "asc" },
                    take: 5,
                  },
                },
              },
            },
          },
        },
      })
    : [];
  const inscrits = new Set(inscriptions.map((i) => i.coursId));
  const catalogue =
    user.role === "ETUDIANT_B2C"
      ? await prisma.cours.findMany({
          where: { ouvertB2c: true, id: { notIn: Array.from(inscrits) } },
          orderBy: { titre: "asc" },
        })
      : [];

  return (
    <>
      <h1>Mes formations</h1>
      {searchParams.ok ? <p className="ok">Inscription enregistrée.</p> : null}

      {user.role === "ETUDIANT_B2C" ? (
        <section className="card">
          <h2>S’inscrire à une formation</h2>
          {catalogue.length === 0 ? (
            <p>Aucune formation supplémentaire disponible.</p>
          ) : (
            catalogue.map((c) => (
              <form key={c.id} action={actionEtudiantInscription} style={{ marginBottom: "0.5rem" }}>
                <input type="hidden" name="coursId" value={c.id} />
                <strong>{c.titre}</strong>
                {c.description ? ` — ${c.description}` : ""}{" "}
                <button type="submit">Rejoindre</button>
              </form>
            ))
          )}
        </section>
      ) : null}

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Cours suivis</h2>
        {inscriptions.length === 0 ? (
          <p>Pas encore de formation.</p>
        ) : (
          inscriptions.map((i) => (
            <div key={i.id} style={{ marginBottom: "1rem" }}>
              <h3>{i.cours.titre}</h3>
              <ul className="plain">
                {i.cours.emploisDuTemps.flatMap((edt) =>
                  edt.sessions.map((s) => (
                    <li key={s.id}>
                      {s.dateReelle.toISOString()} — {s.statut}
                      {s.joinUrl ? (
                        <>
                          {" "}
                          ·{" "}
                          <a href={s.joinUrl} target="_blank" rel="noreferrer">
                            Lien visio
                          </a>
                        </>
                      ) : null}
                    </li>
                  )),
                )}
              </ul>
            </div>
          ))
        )}
      </section>
    </>
  );
}
