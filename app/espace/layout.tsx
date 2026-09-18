import Link from "next/link";
import { requireUser, LIBELLES_ROLE } from "@/lib/auth";
import type { RoleCompte } from "@prisma/client";

const NAV: Record<RoleCompte, Array<{ href: string; label: string }>> = {
  ADMIN: [
    { href: "/espace/admin", label: "Vue d’ensemble" },
    { href: "/espace/admin/formateurs", label: "Formateurs" },
    { href: "/espace/admin/formations", label: "Formations" },
    { href: "/espace/admin/emploi-du-temps", label: "Emploi du temps" },
    { href: "/espace/admin/etudiants", label: "Étudiants" },
    { href: "/espace/admin/societes", label: "Sociétés" },
    { href: "/espace/admin/zoom", label: "Pool Zoom" },
  ],
  FORMATEUR: [{ href: "/espace/formateur", label: "Mes séances" }],
  ETUDIANT_B2C: [{ href: "/espace/etudiant", label: "Mes formations" }],
  SOCIETE: [{ href: "/espace/societe", label: "Places & employés" }],
  EMPLOYE: [{ href: "/espace/employe", label: "Mes formations" }],
};

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <main>
      <div className="espace">
        <aside className="side">
          <div className="who">
            {user.nom}
            <br />
            {LIBELLES_ROLE[user.role]}
          </div>
          {NAV[user.role].map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </aside>
        <div>{children}</div>
      </div>
    </main>
  );
}
