import { actionInscriptionSociete } from "@/lib/actions";

export default function InscriptionSocietePage({
  searchParams,
}: {
  searchParams: { erreur?: string };
}) {
  return (
    <main>
      <h1>Compte société (B2B)</h1>
      <p className="lead">
        Achetez des places pour vos employés, assignez-les à des formations, suivez l’emploi du
        temps.
      </p>
      {searchParams.erreur === "email" ? (
        <p className="missing">Cet e-mail a déjà un compte.</p>
      ) : null}
      {searchParams.erreur === "champs" ? (
        <p className="missing">Tous les champs sont requis (mot de passe 8 caractères min.).</p>
      ) : null}
      <form className="stack card" action={actionInscriptionSociete}>
        <label>
          Votre nom
          <input name="nom" required />
        </label>
        <label>
          Nom de la société
          <input name="nomSociete" required />
        </label>
        <label>
          E-mail professionnel
          <input type="email" name="email" required />
        </label>
        <label>
          Mot de passe
          <input type="password" name="motDePasse" required minLength={8} />
        </label>
        <button type="submit">Créer le compte société</button>
      </form>
    </main>
  );
}
