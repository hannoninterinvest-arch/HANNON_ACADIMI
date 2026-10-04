import Link from "next/link";
import { lireSession, libelleRole, cheminEspace } from "@/lib/auth";
import { actionDeconnexion } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { MenuPrincipal } from "./components/MenuPrincipal";

export async function Header() {
  const session = await lireSession();
  const societe = session?.societeId
    ? await prisma.societe.findUnique({ where: { id: session.societeId }, select: { type: true } }).catch(() => null)
    : null;

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <span>Centre de formation professionnelle</span>
          <span className="topbar-gold">Présentiel · Distanciel · Intra-entreprise</span>
          <Link href="/demande">Demander une session</Link>
        </div>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <img src="/marque-hannon.png" alt="Hannon Academy" />
          </Link>
          <MenuPrincipal>
            <Link href="/catalogue">Formations</Link>
            <Link href="/#calendrier">Calendrier</Link>
            <Link href="/demande">Intra-entreprise</Link>
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
                <Link className="btn-gold" href="/connexion">
                  Connexion
                </Link>
              </>
            )}
          </MenuPrincipal>
        </div>
      </header>
    </>
  );
}
