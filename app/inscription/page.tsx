import { actionInscriptionB2c } from "@/lib/actions";

export default function InscriptionPage({
  searchParams,
}: {
  searchParams: { erreur?: string };
}) {
  return (
    <main>
      <h1>Compte étudiant (B2C)</h1>
      <p className="lead">Créez votre compte et inscrivez-vous à une ou plusieurs formations.</p>
      {searchParams.erreur === "email" ? (
        <p className="missing">Cet e-mail a déjà un compte.</p>
      ) : null}
      {searchParams.erreur === "champs" ? (
        <p className="missing">Nom, e-mail et mot de passe (8 caractères min.) sont requis.</p>
      ) : null}
      <form className="stack card" action={actionInscriptionB2c}>
        <label>
          Nom
          <input name="nom" required />
        </label>
        <label>
          E-mail
          <input type="email" name="email" required />
        </label>
        <label>
          Mot de passe
          <input type="password" name="motDePasse" required minLength={8} />
        </label>
        <button type="submit">Créer mon compte</button>
      </form>
    </main>
  );
}
