import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formaterCreneau } from "@/lib/format";
import { libelleCandidature, peutCreerGroupe, peutOuvrirPaiement } from "@/lib/groupes";
import { Banniere } from "@/app/components/Banniere";
import {
  actionAdminEffectif,
  actionConfirmerEspeces,
  actionContacterCandidat,
  actionCreerGroupe,
  actionEnregistrerGroupe,
  actionOuvrirPaiement,
  actionSupprimerGroupe,
} from "@/lib/actions/groupes";

export const dynamic = "force-dynamic";

function champ(date: Date | null, format: string): string {
  if (!date) {
    return "";
  }
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone("Europe/Paris").toFormat(format);
}

function details(compte: {
  nom: string;
  email: string;
  etudiant: { telephone: string | null; niveauEtude: string | null; ville: string | null } | null;
}): string {
  return [compte.email, compte.etudiant?.telephone, compte.etudiant?.niveauEtude, compte.etudiant?.ville]
    .filter(Boolean)
    .join(" · ");
}

export default async function GroupesFormation({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const [cours, formateurs] = await Promise.all([
    prisma.cours.findUnique({
      where: { id: params.id },
      include: {
        tarif: true,
        candidatures: {
          include: { compte: { include: { etudiant: true } } },
          orderBy: { createdAt: "asc" },
        },
        groupes: {
          include: {
            formateur: true,
            candidatures: { include: { compte: { include: { etudiant: true } } }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.formateur.findMany({ orderBy: { nom: "asc" } }),
  ]);
  if (!cours) {
    notFound();
  }
  const disponibles = cours.candidatures.filter(
    (candidature) => !candidature.groupeId && (candidature.statut === "EN_ATTENTE" || candidature.statut === "CONTACTE"),
  );
  const peutCreer = peutCreerGroupe(disponibles.length, cours.effectifMinimal);

  return (
    <>
      <p>
        <Link href="/espace/admin/formations">Formations</Link>
      </p>
      <h1>{cours.titre}</h1>
      <p className="lead">
        Les personnes remplissent le formulaire. Vous les contactez, puis vous créez un groupe dès que le minimum est
        atteint. Vous choisissez les participants et vous ajoutez la date, l’horaire et le lien Zoom. Le paiement en
        ligne se confirme seul. Le paiement en espèces se confirme ici.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <form className="stack card" action={actionAdminEffectif}>
        <input type="hidden" name="coursId" value={cours.id} />
        <label>
          Nombre minimal pour créer un groupe
          <input type="number" name="effectifMinimal" min={1} max={500} defaultValue={cours.effectifMinimal} required />
        </label>
        <p className="muted">
          {disponibles.length} personne{disponibles.length > 1 ? "s" : ""} en attente d’un groupe.
          {cours.tarif ? "" : " Publiez un tarif avant d’ouvrir le paiement."}
        </p>
        <button type="submit">Enregistrer le minimum</button>
      </form>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Demandes reçues</h2>
        {disponibles.length === 0 ? (
          <p className="muted">Aucune personne n’attend un groupe.</p>
        ) : (
          disponibles.map((candidature) => (
            <div className="personne-ligne" key={candidature.id}>
              <div>
                <strong>{candidature.compte.nom}</strong>
                <p className="muted">{details(candidature.compte)}</p>
                {candidature.message ? <p>{candidature.message}</p> : null}
                <p className="tag">{libelleCandidature(candidature.statut)}</p>
              </div>
              {candidature.statut === "EN_ATTENTE" ? (
                <form action={actionContacterCandidat}>
                  <input type="hidden" name="candidatureId" value={candidature.id} />
                  <button type="submit" className="btn-secondary">
                    Marquer contacté
                  </button>
                </form>
              ) : null}
            </div>
          ))
        )}
      </section>

      <form className="stack card" action={actionCreerGroupe} style={{ marginTop: "1rem" }}>
        <h2>Nouveau groupe</h2>
        <input type="hidden" name="coursId" value={cours.id} />
        <label>
          Nom
          <input name="nom" placeholder={`Groupe ${cours.groupes.length + 1}`} />
        </label>
        <button type="submit" disabled={!peutCreer}>
          Créer le groupe
        </button>
        {peutCreer ? null : (
          <p className="muted">
            Il faut au moins {cours.effectifMinimal} demande{cours.effectifMinimal > 1 ? "s" : ""} encore sans groupe.
          </p>
        )}
      </form>

      {cours.groupes.map((groupe) => {
        const personnes = groupe.candidatures.filter((candidature) => candidature.statut === "DANS_GROUPE" || candidature.statut === "PAYEE");
        const ouvrir = peutOuvrirPaiement(personnes.length, groupe.effectifMinimal, groupe.paiementOuvert);
        const choix = [
          ...groupe.candidatures,
          ...disponibles.filter((candidature) => !groupe.candidatures.some((retenue) => retenue.id === candidature.id)),
        ];
        return (
          <article className="card" key={groupe.id} style={{ marginTop: "1rem" }}>
            <h2>{groupe.nom}</h2>
            <p className="tag">
              {personnes.length} / {groupe.effectifMinimal} minimum
              {groupe.paiementOuvert ? " · paiement ouvert" : " · paiement fermé"}
            </p>
            <form className="stack" action={actionEnregistrerGroupe}>
              <input type="hidden" name="groupeId" value={groupe.id} />
              <label>
                Nom
                <input name="nom" defaultValue={groupe.nom} required />
              </label>
              <label>
                Horaire
                <input name="horaire" defaultValue={groupe.horaire ?? ""} placeholder="Mardi, 14h–17h" />
              </label>
              <div className="form-row">
                <label>
                  Date
                  <input type="date" name="jour" defaultValue={champ(groupe.dateDebut, "yyyy-MM-dd")} />
                </label>
                <label>
                  Début
                  <input type="time" name="heureDebut" defaultValue={champ(groupe.dateDebut, "HH:mm")} />
                </label>
                <label>
                  Fin
                  <input type="time" name="heureFin" defaultValue={champ(groupe.dateFin, "HH:mm")} />
                </label>
              </div>
              <label>
                Formateur
                <select name="formateurId" defaultValue={groupe.formateurId ?? ""}>
                  <option value="">Annoncé plus tard</option>
                  {formateurs.map((formateur) => (
                    <option key={formateur.id} value={formateur.id}>
                      {formateur.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lien Zoom
                <input name="lienZoom" defaultValue={groupe.lienZoom ?? ""} placeholder="https://zoom.us/j/…" />
              </label>
              <label>
                Code de réunion
                <input name="codeReunion" defaultValue={groupe.codeReunion ?? ""} />
              </label>
              <fieldset>
                <legend>Personnes du groupe</legend>
                {choix.length === 0 ? <p className="muted">Aucune demande à placer.</p> : null}
                {choix.map((candidature) => (
                  <label className="check" key={candidature.id}>
                    {candidature.statut === "PAYEE" ? <input type="hidden" name="membreId" value={candidature.compteId} /> : null}
                    <input
                      type="checkbox"
                      name={candidature.statut === "PAYEE" ? undefined : "membreId"}
                      value={candidature.compteId}
                      defaultChecked={candidature.groupeId === groupe.id}
                      disabled={candidature.statut === "PAYEE"}
                    />
                    <span>
                      {candidature.compte.nom} · {libelleCandidature(candidature.statut)}
                      <br />
                      <span className="muted">{details(candidature.compte)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button type="submit">Enregistrer le groupe</button>
            </form>
            {groupe.paiementOuvert ? null : (
              <form action={actionOuvrirPaiement} style={{ marginTop: "0.8rem" }}>
                <input type="hidden" name="groupeId" value={groupe.id} />
                <button type="submit" disabled={!ouvrir}>
                  Ouvrir le paiement
                </button>
                {ouvrir ? (
                  <p className="muted">Les personnes du groupe pourront payer en ligne. Vous pourrez confirmer un paiement en espèces.</p>
                ) : (
                  <p className="muted">Sélectionnez au moins {groupe.effectifMinimal} personnes et enregistrez la date avant d’ouvrir le paiement.</p>
                )}
              </form>
            )}
            {personnes.length > 0 ? (
              <div style={{ marginTop: "0.8rem" }}>
                <h3>Confirmations</h3>
                {personnes.map((candidature) => (
                  <div className="personne-ligne" key={candidature.id}>
                    <div>
                      <strong>{candidature.compte.nom}</strong>
                      <p className="muted">{libelleCandidature(candidature.statut)}</p>
                    </div>
                    {groupe.paiementOuvert && candidature.statut === "DANS_GROUPE" ? (
                      <form action={actionConfirmerEspeces}>
                        <input type="hidden" name="candidatureId" value={candidature.id} />
                        <button type="submit">Confirmer le paiement en espèces</button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {groupe.dateDebut ? (
              <p className="muted">{formaterCreneau(groupe.dateDebut, "Europe/Paris")}</p>
            ) : null}
            {groupe.paiementOuvert ? null : (
              <form action={actionSupprimerGroupe}>
                <input type="hidden" name="groupeId" value={groupe.id} />
                <label className="check">
                  <input type="checkbox" name="confirmer" required /> Confirmer la suppression du groupe
                </label>
                <button type="submit" className="btn-secondary">
                  Supprimer le groupe
                </button>
              </form>
            )}
          </article>
        );
      })}
    </>
  );
}
