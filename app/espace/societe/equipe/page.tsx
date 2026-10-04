import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lireFlash } from "@/lib/flash";
import { Banniere } from "@/app/components/Banniere";
import { actionImporterCsv, actionInviterEmploye } from "@/lib/actions/organisation";

export const dynamic = "force-dynamic";

export default async function EquipePage({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string; nombre?: string };
}) {
  const user = await requireRole("SOCIETE");
  if (!user.societeId) {
    return <p>Compte organisation incomplet.</p>;
  }
  const flash = await lireFlash<{ liens?: string[] }>();
  const [membres, invitations] = await Promise.all([
    prisma.appartenance.findMany({
      where: { societeId: user.societeId },
      include: { compte: true },
      orderBy: { compte: { nom: "asc" } },
    }),
    prisma.invitation.findMany({
      where: { societeId: user.societeId, accepteeLe: null, expireLe: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <h1>Équipe</h1>
      <p className="lead">
        Ajoutez un collaborateur ou importez un CSV (colonnes nom, email). Un nouveau compte reçoit une invitation
        pour choisir son mot de passe. Une adresse déjà inscrite est rattachée, sans doublon.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      {searchParams.nombre ? <p className="alert ok">{searchParams.nombre} invitation(s) créée(s).</p> : null}
      {flash?.liens && flash.liens.length > 0 ? (
        <section className="card">
          <h2>Liens d’invitation</h2>
          <p className="muted">
            L’envoi d’e-mail n’est pas configuré (RESEND). Transmettez ces liens vous-même. Ils ne seront plus affichés.
          </p>
          <ul className="plain">
            {flash.liens.map((lien) => (
              <li key={lien}>
                <a href={lien}>{lien}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="stack card" action={actionInviterEmploye} style={{ marginTop: "1rem" }}>
        <h2>Ajouter une personne</h2>
        <label>
          Nom
          <input name="nom" required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" required />
        </label>
        <button type="submit">Envoyer l’invitation</button>
      </form>

      <form className="stack card" action={actionImporterCsv} style={{ marginTop: "1rem" }}>
        <h2>Import CSV</h2>
        <label>
          Fichier
          <input type="file" name="fichier" accept=".csv,text/csv" required />
        </label>
        <button type="submit">Importer</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Membres</h2>
        {membres.length === 0 ? (
          <p>Personne n’a encore rejoint l’organisation.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>E-mail</th>
                  <th>Rôle</th>
                </tr>
              </thead>
              <tbody>
                {membres.map((membre) => (
                  <tr key={membre.id}>
                    <td>{membre.compte.nom}</td>
                    <td>{membre.compte.email}</td>
                    <td>{membre.role === "RESPONSABLE" ? "Responsable" : "Apprenant"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Invitations en attente</h2>
        {invitations.length === 0 ? (
          <p>Aucune invitation en cours.</p>
        ) : (
          <ul className="plain">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                {invitation.nom} · {invitation.email} ·{" "}
                {invitation.compteExistantId ? "rattachement à confirmer" : "création de compte"} · expire le{" "}
                {invitation.expireLe.toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
