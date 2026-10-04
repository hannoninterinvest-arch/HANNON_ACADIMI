import { actionInscriptionB2c } from "@/lib/actions";
import { ChampsProfil } from "@/app/components/ChampsProfil";

export default function InscriptionPage({
  searchParams,
}: {
  searchParams: { erreur?: string; next?: string };
}) {
  return (
    <main className="inscription">
      <div className="inscription-studio">
        <aside className="inscription-visuel" aria-label="Une apprenante en formation en ligne">
          <img src="/hannon-apprenante-en-ligne.avif" alt="" />
          <div className="overlay">
            <p className="kicker">Compte particulier</p>
            <h1>Rejoignez la classe en ligne.</h1>
            <p>Votre dossier est complet dès l’inscription : identité, études, téléphone et ville.</p>
          </div>
        </aside>
        <form className="stack card" action={actionInscriptionB2c}>
          <h2>Vos informations</h2>
          {searchParams.next?.startsWith("/formations/") ? <input type="hidden" name="next" value={searchParams.next} /> : null}
          {searchParams.erreur === "email" ? <p className="missing">Cet e-mail a déjà un compte.</p> : null}
          {searchParams.erreur === "champs" ? (
            <p className="missing">
              Prénom, nom, téléphone, date de naissance, ville, niveau d’études, situation, e-mail et mot de passe
              (8 caractères) sont requis. L’inscription est ouverte à partir de 16 ans.
            </p>
          ) : null}
          {searchParams.erreur === "particulier" ? (
            <p className="missing">Le compte public est réservé aux particuliers. Une organisation est ouverte par l’équipe Hannon.</p>
          ) : null}
          <ChampsProfil />
          <label>
            E-mail
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            Mot de passe
            <input type="password" name="motDePasse" required minLength={8} autoComplete="new-password" />
          </label>
          <button type="submit">Créer mon compte</button>
        </form>
      </div>
    </main>
  );
}
