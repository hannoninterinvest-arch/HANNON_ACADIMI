import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { seedIfEmpty } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  try {
    await seedIfEmpty(prisma);
  } catch {
    // la page marketing reste lisible même si Neon n'est pas prêt
  }

  const cours = await prisma.cours.findMany({
    where: { ouvertB2c: true },
    orderBy: { titre: "asc" },
    take: 8,
  }).catch(() => []);

  return (
    <main>
      <h1>Hannon Acadimi</h1>
      <p className="lead">
        Formations en visio. Les formateurs animent avec un host key : jamais les identifiants
        Zoom du pool. Cinq types de comptes, un emploi du temps global, des licences Zoom Pro
        empilables pour des séances simultanées.
      </p>

      <p>
        <Link className="btn" href="/connexion">
          Se connecter
        </Link>{" "}
        <Link className="btn-secondary" href="/inscription">
          Créer un compte étudiant
        </Link>
      </p>

      <div className="roles">
        <article className="card role-card">
          <h3>1. Admin</h3>
          <p>Gère formateurs, formations, étudiants, sociétés et le pool Zoom.</p>
        </article>
        <article className="card role-card">
          <h3>2. Formateur</h3>
          <p>Voit ses séances, le lien et le host key — pas le mot de passe Zoom.</p>
        </article>
        <article className="card role-card">
          <h3>3. Étudiant B2C</h3>
          <p>Crée son compte et s’inscrit à une ou plusieurs formations.</p>
        </article>
        <article className="card role-card">
          <h3>4. Société</h3>
          <p>Achète des places pour ses employés et suit l’emploi du temps.</p>
        </article>
        <article className="card role-card">
          <h3>5. Employé</h3>
          <p>Rejoint les formations payées par sa société.</p>
        </article>
      </div>

      <section className="card">
        <h2>Catalogue</h2>
        {cours.length === 0 ? (
          <p>Aucune formation publiée pour le moment.</p>
        ) : (
          <ul className="plain">
            {cours.map((c) => (
              <li key={c.id}>
                <strong>{c.titre}</strong>
                {c.description ? ` — ${c.description}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
