import { actionConnexion } from "@/lib/actions";
import { MOT_DE_PASSE_DEMO } from "@/lib/seed";
import { lireSession, cheminEspace } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: { erreur?: string };
}) {
  const session = await lireSession();
  if (session) {
    redirect(cheminEspace(session.role));
  }

  return (
    <main>
      <h1>Connexion</h1>
      <p className="lead">Accédez à votre espace selon votre type de compte.</p>
      {searchParams.erreur ? (
        <p className="missing">E-mail ou mot de passe incorrect.</p>
      ) : null}
      <form className="stack card" action={actionConnexion}>
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
        <code>amira.benali@hannon-acadimi.test</code> · Étudiant{" "}
        <code>sofia.martin@hannon-acadimi.test</code> · Société{" "}
        <code>rh@atlas-formation.test</code> · Employé{" "}
        <code>employe.atlas@hannon-acadimi.test</code>
      </p>
    </main>
  );
}
