import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireRole("ADMIN");
  const [formateurs, cours, etudiants, societes, licencesLibres, licencesOccupees, commandes, demandes] =
    await Promise.all([
      prisma.formateur.count(),
      prisma.cours.count(),
      prisma.etudiant.count(),
      prisma.societe.count(),
      prisma.licenceZoom.count({ where: { statut: "LIBRE" } }),
      prisma.licenceZoom.count({ where: { statut: "OCCUPE" } }),
      prisma.commande.count(),
      prisma.demandeFormation.count({ where: { statut: "NOUVELLE" } }),
    ]);

  return (
    <>
      <h1>Administration</h1>
      <p className="lead">Sessions, tarifs, commandes, demandes et licences Zoom.</p>
      <div className="stat-grid four">
        <div className="stat"><span>Formations</span><strong>{cours}</strong></div>
        <div className="stat"><span>Organisations</span><strong>{societes}</strong></div>
        <div className="stat"><span>Commandes</span><strong>{commandes}</strong></div>
        <div className="stat"><span>Demandes nouvelles</span><strong>{demandes}</strong></div>
      </div>
      <div className="grid two" style={{ marginTop: "1rem" }}>
        <section className="card">
          <h2>Métier</h2>
          <p>Formateurs : {formateurs}</p>
          <p>Apprenants : {etudiants}</p>
          <p><Link href="/espace/admin/formations">Créer une formation, une date et un lien</Link></p>
          <p><Link href="/espace/admin/comptes">Créer un particulier, un admin ou une organisation</Link></p>
          <p><Link href="/espace/admin/commandes">Voir les achats</Link></p>
          <p><Link href="/espace/admin/sessions">Gérer les sessions et les liens Zoom</Link></p>
          <p><Link href="/espace/admin/tarifs">Configurer les tarifs</Link></p>
          <p><Link href="/espace/admin/demandes">Traiter les demandes</Link></p>
        </section>
        <section className="card">
          <h2>Pool Zoom (séances simultanées)</h2>
          <p>
            Libres (pas en meeting) : <span className="badge">{licencesLibres}</span>
          </p>
          <p>
            Occupés : <span className="badge warn">{licencesOccupees}</span>
          </p>
          <p>
            <Link href="/espace/admin/zoom">Gérer les comptes Zoom Pro</Link>
          </p>
        </section>
      </div>
    </>
  );
}
