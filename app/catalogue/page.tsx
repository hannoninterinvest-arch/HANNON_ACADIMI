import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatEuros, formaterCreneau, decouperCreneau } from "@/lib/format";
import { disponibilitesSessions } from "@/lib/commerce/service";

export const dynamic = "force-dynamic";

export default async function CataloguePage({ searchParams }: { searchParams: { q?: string } }) {
  const recherche = searchParams.q?.trim() ?? "";
  const cours = await prisma.cours.findMany({
    where: {
      ouvertB2c: true,
      ...(recherche
        ? {
            OR: [
              { titre: { contains: recherche, mode: "insensitive" } },
              { description: { contains: recherche, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { titre: "asc" },
    include: {
      tarif: { include: { regles: { where: { actif: true } } } },
      sessionsCommerciales: {
        where: { statutInscription: "OUVERTE", dateReelle: { gte: new Date() } },
        orderBy: { dateReelle: "asc" },
        take: 1,
      },
    },
  });
  const ids = cours.flatMap((item) => item.sessionsCommerciales.map((session) => session.id));
  const stocks = await disponibilitesSessions(ids);

  return (
    <main>
      <p className="eyebrow">Catalogue</p>
      <h1>Formations ouvertes</h1>
      <p className="lead">
        Chaque carte indique le tarif individuel, la condition de remise pour les organisations et la prochaine
        session avec ses places restantes.
      </p>
      <form className="finder finder-page" action="/catalogue" method="get">
        <label className="sr-only" htmlFor="q">
          Rechercher une formation
        </label>
        <input id="q" name="q" defaultValue={recherche} placeholder="Rechercher une formation…" />
        <button className="btn-gold" type="submit">
          Rechercher
        </button>
      </form>
      {recherche ? (
        <p className="muted">
          {cours.length} formation{cours.length > 1 ? "s" : ""} pour « {recherche} ».
        </p>
      ) : null}
      {cours.length === 0 ? (
        <div className="empty">
          <p>{recherche ? "Aucune formation ne correspond à cette recherche." : "Le catalogue est vide pour l’instant."}</p>
          <Link href={recherche ? "/catalogue" : "/demande"}>{recherche ? "Voir tout le catalogue" : "Proposer un sujet"}</Link>
        </div>
      ) : (
        <div className="course-grid">
          {cours.map((item) => {
            const session = item.sessionsCommerciales[0];
            const stock = session ? stocks.get(session.id) : undefined;
            const regle = item.tarif?.regles.find((regleItem) => regleItem.profils.includes("B2B"));
            const date = session ? decouperCreneau(session.dateReelle, session.fuseauHoraire) : null;
            return (
              <article className="course-card" key={item.id}>
                {item.imageChemin ? <img className="course-photo" src={item.imageChemin} alt="" /> : null}
                <div className="upcoming-meta">
                  <span>Réf. HA-{item.id.slice(-4).toUpperCase()}</span>
                  <span>{date ? `${date.jour} ${date.mois} · ${date.heure}` : "Sur demande"}</span>
                </div>
                <h2>{item.titre}</h2>
                <p className="muted">{item.description}</p>
                <p className="price">{item.tarif ? formatEuros(item.tarif.prixB2cCentimes) : "Tarif non publié"}</p>
                {item.tarif ? (
                  <p className="muted">Organisation : {formatEuros(item.tarif.prixOrganisationCentimes)} / place</p>
                ) : null}
                {regle ? (
                  <p className="tag">
                    Remise {regle.typeRemise === "POURCENTAGE" ? `${regle.valeur} %` : formatEuros(regle.valeur)} dès{" "}
                    {regle.seuilQuantite} places
                  </p>
                ) : null}
                {session ? (
                  <p>
                    {formaterCreneau(session.dateReelle, session.fuseauHoraire)}
                    <br />
                    <strong>{stock?.disponibles ?? session.capaciteMax} places disponibles</strong>
                  </p>
                ) : (
                  <p className="muted">Aucune session ouverte. Une demande reste possible.</p>
                )}
                <Link className="btn" href={`/formations/${item.id}`}>
                  Choisir une session
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
