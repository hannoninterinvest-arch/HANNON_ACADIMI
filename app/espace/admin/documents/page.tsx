import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Banniere } from "@/app/components/Banniere";
import { actionAdminCertificat, actionAdminRessource } from "@/lib/actions/adminCatalogue";

export const dynamic = "force-dynamic";

export default async function AdminDocuments({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const [cours, comptes, sessions] = await Promise.all([
    prisma.cours.findMany({ orderBy: { titre: "asc" }, include: { ressources: true } }),
    prisma.compte.findMany({
      where: { role: { in: ["ETUDIANT_B2C", "EMPLOYE", "SOCIETE"] } },
      orderBy: { nom: "asc" },
    }),
    prisma.session.findMany({
      where: { coursId: { not: null } },
      include: { cours: true },
      orderBy: { dateReelle: "desc" },
      take: 30,
    }),
  ]);

  return (
    <>
      <h1>Ressources et certificats</h1>
      <p className="lead">Les fichiers personnels sont stockés hors du dossier public et servis après contrôle d’accès.</p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <form className="stack card" action={actionAdminRessource}>
        <h2>Ressource de cours</h2>
        <label>
          Formation
          <select name="coursId" required>
            {cours.map((item) => (
              <option key={item.id} value={item.id}>
                {item.titre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre
          <input name="titre" required />
        </label>
        <label>
          Description
          <input name="description" />
        </label>
        <label>
          Fichier
          <input type="file" name="fichier" required />
        </label>
        <button type="submit">Déposer</button>
      </form>

      <form className="stack card" action={actionAdminCertificat} style={{ marginTop: "1rem" }}>
        <h2>Attribuer un certificat</h2>
        <label>
          Apprenant
          <select name="compteId" required>
            {comptes.map((compte) => (
              <option key={compte.id} value={compte.id}>
                {compte.nom} · {compte.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formation
          <select name="coursId" required>
            {cours.map((item) => (
              <option key={item.id} value={item.id}>
                {item.titre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Session
          <select name="sessionId" defaultValue="">
            <option value="">Non liée</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.cours?.titre} · {session.dateReelle.toLocaleDateString("fr-FR")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre du certificat
          <input name="titre" required defaultValue="Certificat de réalisation" />
        </label>
        <label>
          Fichier
          <input type="file" name="fichier" required />
        </label>
        <button type="submit">Attribuer</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Ressources déjà en ligne</h2>
        {cours.every((item) => item.ressources.length === 0) ? (
          <p>Aucune ressource.</p>
        ) : (
          <ul className="plain">
            {cours.flatMap((item) =>
              item.ressources.map((ressource) => (
                <li key={ressource.id}>
                  {item.titre} — {ressource.titre}
                </li>
              )),
            )}
          </ul>
        )}
      </section>
    </>
  );
}
