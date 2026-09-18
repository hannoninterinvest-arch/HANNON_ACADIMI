import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireRole("ADMIN");
  const [formateurs, cours, etudiants, societes, licencesLibres, licencesOccupees] =
    await Promise.all([
      prisma.formateur.count(),
      prisma.cours.count(),
      prisma.etudiant.count(),
      prisma.societe.count(),
      prisma.licenceZoom.count({ where: { statut: "LIBRE" } }),
      prisma.licenceZoom.count({ where: { statut: "OCCUPE" } }),
    ]);

  return (
    <>
      <h1>Administration</h1>
      <p className="lead">Pilotage des formateurs, formations, étudiants et licences Zoom Pro.</p>
      <div className="grid two">
        <section className="card">
          <h2>Métier</h2>
          <p>Formateurs : {formateurs}</p>
          <p>Formations : {cours}</p>
          <p>Étudiants : {etudiants}</p>
          <p>Sociétés : {societes}</p>
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
