import { actionInscriptionSociete } from "@/lib/actions";

export default function InscriptionSocietePage({
  searchParams,
}: {
  searchParams: { erreur?: string };
}) {
  return (
    <main>
      <h1>Compte organisation</h1>
      <p className="lead">
        Entreprise ou organisme public : le responsable achète des places, invite ses collaborateurs et affecte
        les sessions payées.
      </p>
      {searchParams.erreur === "email" ? (
        <p className="missing">Cet e-mail a déjà un compte.</p>
      ) : null}
      {searchParams.erreur === "champs" ? (
        <p className="missing">Tous les champs sont requis (mot de passe 8 caractères min.).</p>
      ) : null}
      <form className="stack card" action={actionInscriptionSociete}>
        <fieldset>
          <legend>Type d’organisation</legend>
          <label>
            <input type="radio" name="typeOrganisation" value="ENTREPRISE" defaultChecked /> Entreprise (B2B)
          </label>
          <label>
            <input type="radio" name="typeOrganisation" value="ORGANISME_PUBLIC" /> Organisme public (B2G)
          </label>
        </fieldset>
        <label>
          Votre nom
          <input name="nom" required />
        </label>
        <label>
          Nom de l’organisation
          <input name="nomSociete" required />
        </label>
        <label>
          Téléphone
          <input name="telephone" autoComplete="tel" />
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
