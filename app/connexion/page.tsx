import { actionConnexion } from "@/lib/actions";
import { MOT_DE_PASSE_DEMO } from "@/lib/seed";
import { lireSession, cheminEspace } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: { erreur?: string; next?: string };
}) {
  const session = await lireSession();
  if (session) {
    redirect(cheminEspace(session.role));
  }

  return (
    <main>
      <h1>Connexion</h1>
      <p className="lead">Particuliers, responsables de formation et apprenants utilisent la même porte d’entrée.</p>
      {searchParams.erreur === "identifiants" ? (
        <p className="alert err">E-mail ou mot de passe incorrect.</p>
      ) : null}
      {searchParams.erreur === "invitation" ? (
        <p className="alert err">Cette invitation n’est plus valable.</p>
      ) : null}
      <form className="stack card" action={actionConnexion}>
        {searchParams.next?.startsWith("/") ? <input type="hidden" name="next" value={searchParams.next} /> : null}
        <label>
          E-mail
          <input type="email" name="email" required autoComplete="username" />
        </label>
        <label>
          Mot de passe
          <input type="password" name="motDePasse" required autoComplete="current-password" />
        </label>
        <button type="submit">Entrer</button>
      </form>
      <p className="footer">
        Comptes de démo (mot de passe <code>{MOT_DE_PASSE_DEMO}</code>) :<br />
        Admin <code>admin@hannon-acadimi.test</code> · Formateur{" "}
        <code>amira.benali@hannon-acadimi.test</code> · Particulier{" "}
        <code>sofia.martin@hannon-acadimi.test</code> · Entreprise{" "}
        <code>rh@atlas-formation.test</code> · Organisme public{" "}
        <code>contact@mairie-rivage.test</code> · Apprenant{" "}
        <code>employe.atlas@hannon-acadimi.test</code>
      </p>
    </main>
  );
}
