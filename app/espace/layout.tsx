import Link from "next/link";
import { requireUser, libelleRole } from "@/lib/auth";
import type { RoleCompte } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const NAV: Record<RoleCompte, Array<{ href: string; label: string }>> = {
  ADMIN: [
    { href: "/espace/admin", label: "Vue d’ensemble" },
    { href: "/espace/admin/formations", label: "Formations" },
    { href: "/espace/admin/sessions", label: "Sessions" },
    { href: "/espace/admin/tarifs", label: "Tarifs" },
    { href: "/espace/admin/commandes", label: "Commandes" },
    { href: "/espace/admin/demandes", label: "Demandes" },
    { href: "/espace/admin/documents", label: "Ressources et certificats" },
    { href: "/espace/admin/formateurs", label: "Formateurs" },
    { href: "/espace/admin/emploi-du-temps", label: "Planning récurrent" },
    { href: "/espace/admin/etudiants", label: "Apprenants" },
    { href: "/espace/admin/societes", label: "Organisations" },
    { href: "/espace/admin/zoom", label: "Pool Zoom" },
  ],
  FORMATEUR: [{ href: "/espace/formateur", label: "Mes séances" }],
  ETUDIANT_B2C: [
    { href: "/espace/etudiant", label: "Mes formations" },
    { href: "/catalogue", label: "Catalogue" },
  ],
  SOCIETE: [
    { href: "/espace/societe", label: "Places achetées" },
    { href: "/espace/societe/equipe", label: "Équipe" },
    { href: "/catalogue", label: "Catalogue" },
    { href: "/demande", label: "Demander une formation" },
  ],
  EMPLOYE: [
    { href: "/espace/etudiant", label: "Mes formations" },
    { href: "/catalogue", label: "Catalogue" },
  ],
};

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const societe = user.societeId
    ? await prisma.societe.findUnique({ where: { id: user.societeId }, select: { type: true, nom: true } })
    : null;
  return (
    <main>
      <div className="espace">
        <aside className="side">
          <div className="who">
            {user.nom}
            <br />
            {libelleRole(user.role, societe?.type)}
            {societe ? (
              <>
                <br />
                {societe.nom}
              </>
            ) : null}
          </div>
          <nav aria-label="Espace personnel">
            {NAV[user.role].map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </main>
  );
}
