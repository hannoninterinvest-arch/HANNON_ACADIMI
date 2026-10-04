import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { seedIfEmpty } from "@/lib/seed";
import { formatEuros } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  try {
    await seedIfEmpty(prisma);
  } catch {
    // La page reste lisible si la base n’est pas encore migrée.
  }

  const cours = await prisma.cours
    .findMany({
      where: { ouvertB2c: true },
      orderBy: { titre: "asc" },
      take: 6,
      include: { tarif: { include: { regles: { where: { actif: true }, take: 1 } } } },
    })
    .catch(() => []);

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Formations en direct</p>
          <h1>Apprendre ensemble, en visioconférence.</h1>
          <p className="lead">
            Hannon Acadimi accueille les particuliers, les entreprises et les organismes publics.
            Choisissez une session datée, voyez les places restantes et le tarif applicable, puis
            retrouvez le lien Zoom, les ressources et votre certificat dans votre espace.
          </p>
          <div className="actions">
            <Link className="btn" href="/catalogue">
              Voir le catalogue
            </Link>
            <Link className="btn-secondary" href="/inscription">
              Créer un compte
            </Link>
            <Link className="btn-secondary" href="/demande">
              Demander une formation
            </Link>
          </div>
        </div>
        <aside className="card">
          <h2>Trois façons de nous rejoindre</h2>
          <p>Un particulier achète sa place et suit sa session.</p>
          <p>Une entreprise ou un organisme public achète un lot de places, puis affecte ses collaborateurs.</p>
          <p>La remise s’applique à tout le lot dès que le seuil est atteint. En dessous, le tarif de base reste ouvert.</p>
        </aside>
      </section>

      <section>
        <h2>Au catalogue</h2>
        {cours.length === 0 ? (
          <div className="empty">
            <p>Aucune formation publiée pour le moment. Revenez bientôt, ou envoyez-nous une demande.</p>
            <Link className="btn" href="/demande">
              Décrire un besoin
            </Link>
          </div>
        ) : (
          <div className="course-grid">
            {cours.map((item) => {
              const regle = item.tarif?.regles[0];
              return (
                <article className="course-card" key={item.id}>
                  <span className="tag">Session en visio</span>
                  <h3>{item.titre}</h3>
                  <p className="muted">{item.description}</p>
                  <p className="price">
                    {item.tarif ? formatEuros(item.tarif.prixB2cCentimes) : "Tarif à venir"}
                    <span className="muted"> / personne</span>
                  </p>
                  {regle ? (
                    <p className="muted">
                      Organisations : remise {regle.typeRemise === "POURCENTAGE" ? `${regle.valeur} %` : "fixe"} dès{" "}
                      {regle.seuilQuantite} places.
                    </p>
                  ) : null}
                  <Link className="btn" href={`/formations/${item.id}`}>
                    Voir les sessions
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
