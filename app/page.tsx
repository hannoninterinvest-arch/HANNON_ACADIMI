import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { seedIfEmpty } from "@/lib/seed";
import { formatEuros, formaterCreneau, decouperCreneau } from "@/lib/format";
import { VISUELS } from "@/lib/visuels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  try {
    await seedIfEmpty(prisma);
  } catch {
    // La page reste lisible si la base n’est pas encore migrée.
  }

  const [cours, sessions, compteurs] = await Promise.all([
    prisma.cours
      .findMany({
        where: { ouvertB2c: true },
        orderBy: { titre: "asc" },
        take: 6,
        include: {
          tarif: { include: { regles: { where: { actif: true }, take: 1 } } },
          sessionsCommerciales: {
            where: { statutInscription: "OUVERTE", dateReelle: { gte: new Date() } },
            orderBy: { dateReelle: "asc" },
            take: 1,
            include: { formateur: { select: { nom: true } } },
          },
        },
      })
      .catch(() => []),
    prisma.session
      .findMany({
        where: { statutInscription: "OUVERTE", dateReelle: { gte: new Date() } },
        orderBy: { dateReelle: "asc" },
        take: 3,
        include: { cours: true, formateur: true, emploiDuTemps: { include: { cours: true, formateur: true } } },
      })
      .catch(() => []),
    Promise.all([
      prisma.cours.count().catch(() => 0),
      prisma.session.count({ where: { statutInscription: "OUVERTE" } }).catch(() => 0),
      prisma.societe.count().catch(() => 0),
      prisma.formateur.count().catch(() => 0),
    ]).catch(() => [0, 0, 0, 0] as const),
  ]);

  const [formations, sessionsOuvertes, organisations, formateurs] = compteurs;
  const annee = DateTime.now().setZone("Europe/Paris").year;

  return (
    <main className="home">
      <section className="hero-academy" aria-label="Formation en ligne chez Hannon Academy">
        <div className="wrap hero-copy">
          <p className="kicker">Formations en ligne</p>
          <h1>Vos classes, en direct.</h1>
          <p className="lead">
            Une affiche, un formateur, un domaine et une session datée. Vous créez votre compte, vous réservez
            votre place, puis vous rejoignez la classe depuis votre espace.
          </p>
          <form className="finder" action="/catalogue" method="get">
            <label className="sr-only" htmlFor="recherche-formation">
              Rechercher une formation
            </label>
            <input id="recherche-formation" name="q" placeholder="Rechercher une formation…" />
            <button className="btn-gold" type="submit">
              Rechercher
            </button>
          </form>
          <ol className="hero-steps">
            <li>
              <span>01</span>Choisissez une classe en ligne
            </li>
            <li>
              <span>02</span>Complétez votre dossier
            </li>
            <li>
              <span>03</span>Rejoignez la session
            </li>
          </ol>
        </div>
      </section>

      <section className="galerie" aria-label="La formation chez Hannon Academy">
        <div className="wrap mosaic">
          <figure>
            <img src={VISUELS[0].src} alt={VISUELS[0].alt} />
            <figcaption>Depuis chez vous</figcaption>
          </figure>
          <figure>
            <img src={VISUELS[1].src} alt={VISUELS[1].alt} />
            <figcaption>Classe en direct</figcaption>
          </figure>
          <figure>
            <img src={VISUELS[2].src} alt={VISUELS[2].alt} />
            <figcaption>Avec votre formateur</figcaption>
          </figure>
        </div>
      </section>

      <section className="upcoming-band" id="calendrier">
        <div className="wrap upcoming-layout">
          <div className="upcoming-title">
            <p className="eyebrow">Calendrier</p>
            <h2>Formations à venir</h2>
            <Link href="/catalogue">Tout le calendrier</Link>
          </div>
          {sessions.length === 0 ? (
            <div className="empty light">
              <p>Aucune session ouverte pour le moment.</p>
              <Link className="btn-gold" href="/demande">
                Décrire un besoin
              </Link>
            </div>
          ) : (
            <div className="upcoming-grid">
              {sessions.map((session) => {
                const titre = session.cours?.titre ?? session.emploiDuTemps?.cours.titre ?? "Formation";
                const domaine = session.cours?.domaine ?? session.emploiDuTemps?.cours.domaine;
                const formateur = session.formateur?.nom ?? session.emploiDuTemps?.formateur.nom;
                const coursId = session.coursId ?? session.emploiDuTemps?.coursId;
                const date = decouperCreneau(session.dateReelle, session.fuseauHoraire);
                return (
                  <article className="session-ticket" key={session.id}>
                    <div className="date-block">
                      <strong>{date.jour}</strong>
                      <span>{date.mois}</span>
                      <em>{date.heure}</em>
                    </div>
                    <div className="ticket-body">
                      <p className="upcoming-meta">
                        <span>{domaine || "En ligne"}</span>
                        <span>{formateur || `${session.capaciteMax} places`}</span>
                      </p>
                      <h3>{titre}</h3>
                      <p className="muted">{formaterCreneau(session.dateReelle, session.fuseauHoraire)}</p>
                      {coursId ? (
                        <Link className="btn" href={`/formations/${coursId}`}>
                          Choisir cette session
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="section center-head">
        <div className="wrap">
          <p className="eyebrow">Nos formations</p>
          <h2>Incontournables</h2>
          <p className="lead center">
            Chaque formation en ligne affiche son domaine, son formateur et le tarif d’une place.
          </p>
          {cours.length === 0 ? (
            <div className="empty">
              <p>Aucune formation publiée pour le moment.</p>
            </div>
          ) : (
            <div className="course-grid">
              {cours.map((item) => {
                const regle = item.tarif?.regles[0];
                const session = item.sessionsCommerciales[0];
                const date = session ? decouperCreneau(session.dateReelle, session.fuseauHoraire) : null;
                return (
                  <article className="course-card" key={item.id}>
                    <div className="upcoming-meta">
                      <span>{item.domaine || "En ligne"}</span>
                      <span>{date ? `${date.jour} ${date.mois}` : "Sur demande"}</span>
                    </div>
                    {item.imageChemin ? <img className="course-photo" src={item.imageChemin} alt="" /> : null}
                    <h3>{item.titre}</h3>
                    <p className="muted">{session?.formateur?.nom ?? "Formateur annoncé avant la session"}</p>
                    <p className="muted">{item.description}</p>
                    <p className="price">
                      {item.tarif ? formatEuros(item.tarif.prixB2cCentimes) : "Tarif à venir"}
                      <span className="muted"> / personne</span>
                    </p>
                    {regle ? (
                      <p className="tag">
                        Remise {regle.typeRemise === "POURCENTAGE" ? `${regle.valeur} %` : "fixe"} dès {regle.seuilQuantite}{" "}
                        places
                      </p>
                    ) : null}
                    <Link className="btn" href={`/formations/${item.id}`}>
                      Voir la fiche
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
          <p className="center" style={{ marginTop: "1.4rem" }}>
            <Link className="btn-secondary" href="/catalogue">
              Toutes les formations
            </Link>
          </p>
        </div>
      </section>

      <section className="section formats">
        <div className="wrap">
          <h2 className="center">La classe se tient en ligne</h2>
          <div className="mode-grid">
            <article className="mode-card featured">
              <img className="mode-photo" src={VISUELS[2].src} alt="" />
              <span className="mode-index">01</span>
              <h3>Classe en ligne</h3>
              <ul>
                <li>Rejoignez le formateur en direct, depuis chez vous.</li>
                <li>L’affiche, le domaine et les détails sont sur la fiche.</li>
                <li>Le lien et le code de réunion arrivent dans votre espace.</li>
              </ul>
              <Link className="btn-gold" href="/catalogue">
                Voir les classes
              </Link>
            </article>
            <article className="mode-card">
              <img className="mode-photo" src={VISUELS[3].src} alt="" />
              <span className="mode-index">02</span>
              <h3>Présentiel sur demande</h3>
              <ul>
                <li>Une session en salle, quand le sujet s’y prête.</li>
                <li>Même fiche, même suivi, même certificat.</li>
                <li>Le calendrier reste visible dans votre espace.</li>
              </ul>
            </article>
            <article className="mode-card">
              <img className="mode-photo" src={VISUELS[0].src} alt="" />
              <span className="mode-index">03</span>
              <h3>Intra-entreprise</h3>
              <ul>
                <li>Une organisation achète un lot de places.</li>
                <li>Elle invite ses collaborateurs et les affecte.</li>
                <li>Le serveur refuse tout dépassement du quota.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="voices">
            <p className="eyebrow">Parcours</p>
            <h2>Ce que chacun retrouve</h2>
            <div className="quotes">
              <article className="quote-card">
                <p>Je choisis une session, je paie ma place et je retrouve mon planning, mes documents et mon certificat.</p>
                <span className="tag">Particulier</span>
              </article>
              <article className="quote-card">
                <p>Nous achetons un lot, nous voyons le prix remisé avant de valider, puis nous affectons nos employés.</p>
                <span className="tag">Entreprise</span>
              </article>
              <article className="quote-card">
                <p>Nous décrivons un besoin pour nos équipes. La demande n’achète rien et ne bloque aucune place.</p>
                <span className="tag">Organisme public</span>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="stat-grid four">
            <div className="stat">
              <strong>{formations}</strong>
              <span>Formations au catalogue</span>
            </div>
            <div className="stat">
              <strong>{sessionsOuvertes}</strong>
              <span>Sessions ouvertes</span>
            </div>
            <div className="stat">
              <strong>{organisations}</strong>
              <span>Organisations en {annee}</span>
            </div>
            <div className="stat">
              <strong>{formateurs}</strong>
              <span>Formateurs</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section center-head">
        <div className="wrap">
          <p className="eyebrow">Repères</p>
          <h2>Une académie, plusieurs accès</h2>
          <div className="partner-row">
            <article>
              <strong>Visio Zoom</strong>
              <span>Lien publié dans l’espace</span>
            </article>
            <article>
              <strong>Certificat nominatif</strong>
              <span>Téléchargement protégé</span>
            </article>
            <article>
              <strong>Lots B2B</strong>
              <span>Remise dès le seuil</span>
            </article>
            <article>
              <strong>Lots B2G</strong>
              <span>Même moteur de places</span>
            </article>
            <article>
              <strong>Places limitées</strong>
              <span>Stock tenu à la confirmation</span>
            </article>
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="wrap closing-inner">
          <div>
            <p className="eyebrow">Prochaine session</p>
            <h2>Réservez une place, ou décrivez un besoin.</h2>
          </div>
          <div className="actions">
            <Link className="btn-gold" href="/catalogue">
              Voir les formations
            </Link>
            <Link className="btn-secondary" href="/demande">
              Organiser une intra
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
