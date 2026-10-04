import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Banniere } from "@/app/components/Banniere";
import { actionAdminDemande } from "@/lib/actions/adminCatalogue";

export const dynamic = "force-dynamic";

const LIBELLES = {
  NOUVELLE: "Nouvelle",
  EN_COURS: "En cours de contact",
  PROPOSITION_ENVOYEE: "Proposition envoyée",
  CLOTUREE: "Clôturée",
} as const;

export default async function AdminDemandes({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const demandes = await prisma.demandeFormation.findMany({
    include: { cours: true, societe: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <h1>Demandes de formation</h1>
      <p className="lead">Une demande n’est pas une commande et ne bloque aucune place.</p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      {demandes.length === 0 ? (
        <div className="empty">Aucune demande reçue.</div>
      ) : (
        <div className="grid">
          {demandes.map((demande) => (
            <article className="card" key={demande.id}>
              <h2>{demande.organisationNom}</h2>
              <p>
                {demande.contactNom} · {demande.email} · {demande.telephone}
              </p>
              <p>
                {demande.cours?.titre ?? demande.sujetPersonnalise} · {demande.nbParticipants} participants ·{" "}
                {demande.periodeSouhaitee}
              </p>
              <p>{demande.message}</p>
              <p className="tag">{LIBELLES[demande.statut]}</p>
              <form className="stack" action={actionAdminDemande}>
                <input type="hidden" name="id" value={demande.id} />
                <label>
                  Statut
                  <select name="statut" defaultValue={demande.statut}>
                    <option value="NOUVELLE">Nouvelle</option>
                    <option value="EN_COURS">En cours de contact</option>
                    <option value="PROPOSITION_ENVOYEE">Proposition envoyée</option>
                    <option value="CLOTUREE">Clôturée</option>
                  </select>
                </label>
                <button type="submit">Mettre à jour</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
