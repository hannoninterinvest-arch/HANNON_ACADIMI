import Link from "next/link";

export default function InscriptionSocietePage() {
  return (
    <main>
      <p className="eyebrow">Organisations</p>
      <h1>Les comptes organisation sont ouverts par l’académie</h1>
      <p className="lead">
        Un particulier crée son compte lui-même. Une entreprise ou un organisme public est créé par un administrateur,
        puis le responsable ouvre les comptes de ses collaborateurs.
      </p>
      <div className="actions">
        <Link className="btn" href="/inscription">
          Créer un compte particulier
        </Link>
        <Link className="btn-secondary" href="/connexion">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
