import Link from "next/link";
import { lireSession, libelleRole, cheminEspace } from "@/lib/auth";
import { actionDeconnexion } from "@/lib/actions";
import { prisma } from "@/lib/prisma";

export async function Header() {
  const session = await lireSession();
  const societe = session?.societeId
    ? await prisma.societe.findUnique({ where: { id: session.societeId }, select: { type: true } }).catch(() => null)
    : null;

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Hannon Acadimi
      </Link>
      <nav aria-label="Navigation principale">
        <Link href="/catalogue">Catalogue</Link>
        <Link href="/demande">Demande</Link>
        {session ? (
          <>
            <span className="who-chip">
              {session.nom} · {libelleRole(session.role, societe?.type)}
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
            <Link href="/inscription">Particulier</Link>
            <Link href="/inscription-societe">Organisation</Link>
            <Link className="btn" href="/connexion">
              Connexion
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
