import { prisma } from "@/lib/prisma";
import { lireSession } from "@/lib/auth";
import { actionDemandeFormation } from "@/lib/actions/organisation";
import { Banniere } from "@/app/components/Banniere";

export const dynamic = "force-dynamic";

export default async function DemandePage({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  const session = await lireSession();
  const societe = session?.societeId
    ? await prisma.societe.findUnique({ where: { id: session.societeId } })
    : null;
  const cours = await prisma.cours.findMany({ orderBy: { titre: "asc" } }).catch(() => []);

  return (
    <main>
      <p className="eyebrow">Organisations</p>
      <h1>Demander une formation</h1>
      <p className="lead">
        Décrivez le besoin de votre équipe. Cette demande n’achète pas de places et ne réserve aucune session.
      </p>
      {searchParams.ok ? (
        <p className="alert ok" role="status">
          Votre demande a bien été reçue. Notre équipe vous contactera pour étudier votre besoin.
        </p>
      ) : (
        <Banniere erreur={searchParams.erreur} />
      )}
      <form className="stack card" action={actionDemandeFormation}>
        <div className="form-row">
          <label>
            Organisation
            <input name="organisationNom" required defaultValue={societe?.nom ?? ""} />
          </label>
          <label>
            Contact
            <input name="contactNom" required defaultValue={session?.nom ?? ""} />
          </label>
        </div>
        <div className="form-row">
          <label>
            E-mail
            <input type="email" name="email" required defaultValue={session?.email ?? societe?.email ?? ""} />
          </label>
          <label>
            Téléphone
            <input name="telephone" required defaultValue={societe?.telephone ?? ""} autoComplete="tel" />
          </label>
        </div>
        <label>
          Formation du catalogue
          <select name="coursId" defaultValue="">
            <option value="">Sujet personnalisé</option>
            {cours.map((item) => (
              <option key={item.id} value={item.id}>
                {item.titre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sujet personnalisé
          <input name="sujetPersonnalise" placeholder="Obligatoire si aucune formation du catalogue n’est choisie" />
        </label>
        <div className="form-row">
          <label>
            Nombre de participants
            <input type="number" name="nbParticipants" min={1} required defaultValue={10} />
          </label>
          <label>
            Période souhaitée
            <input name="periodeSouhaitee" required placeholder="Mars 2027" />
          </label>
        </div>
        <label>
          Message
          <textarea name="message" required placeholder="Contexte, niveau attendu, contraintes." />
        </label>
        <button type="submit">Envoyer la demande</button>
      </form>
    </main>
  );
}
