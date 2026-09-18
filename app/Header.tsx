import Link from "next/link";
import { lireSession, LIBELLES_ROLE, cheminEspace } from "@/lib/auth";
import { actionDeconnexion } from "@/lib/actions";

export async function Header() {
  const session = await lireSession();
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Hannon Acadimi
      </Link>
      <nav>
        {session ? (
          <>
            <span>
              {session.nom} · {LIBELLES_ROLE[session.role]}
            </span>
            <Link href={cheminEspace(session.role)}>Mon espace</Link>
            <form action={actionDeconnexion}>
              <button type="submit" className="btn-secondary">
                Déconnexion
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/inscription">Étudiant</Link>
            <Link href="/inscription-societe">Société</Link>
            <Link className="btn" href="/connexion">
              Connexion
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
