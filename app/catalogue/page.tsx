import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatEuros, formaterCreneau } from "@/lib/format";
import { disponibilitesSessions } from "@/lib/commerce/service";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const cours = await prisma.cours.findMany({
    where: { ouvertB2c: true },
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
        Chaque carte indique le tarif individuel, la condition de remise pour les organisations et la
        prochaine session avec ses places restantes.
      </p>
      {cours.length === 0 ? (
        <div className="empty">
          <p>Le catalogue est vide pour l’instant.</p>
          <Link href="/demande">Proposer un sujet</Link>
        </div>
      ) : (
        <div className="course-grid">
          {cours.map((item) => {
            const session = item.sessionsCommerciales[0];
            const stock = session ? stocks.get(session.id) : undefined;
            const regle = item.tarif?.regles.find((regleItem) => regleItem.profils.includes("B2B"));
            return (
              <article className="course-card" key={item.id}>
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
                    Prochaine session : {formaterCreneau(session.dateReelle, session.fuseauHoraire)}
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
