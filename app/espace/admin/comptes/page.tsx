import { requireRole, libelleRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Banniere } from "@/app/components/Banniere";
import { ChampsProfil } from "@/app/components/ChampsProfil";
import {
  actionAdminCompteCreer,
  actionAdminCompteModifier,
  actionAdminCompteSupprimer,
  actionAdminSocieteCreer,
  actionAdminSocieteSupprimer,
} from "@/lib/actions/adminStudio";

export const dynamic = "force-dynamic";

export default async function AdminComptes({
  searchParams,
}: {
  searchParams: { ok?: string; erreur?: string };
}) {
  await requireRole("ADMIN");
  const [comptes, societes] = await Promise.all([
    prisma.compte.findMany({
      include: { societe: true },
      orderBy: { nom: "asc" },
    }),
    prisma.societe.findMany({
      include: { _count: { select: { comptes: true, commandes: true } } },
      orderBy: { nom: "asc" },
    }),
  ]);

  return (
    <>
      <h1>Comptes</h1>
      <p className="lead">
        Créez un particulier, un autre administrateur ou une organisation. Le public ne peut ouvrir qu’un compte
        individuel.
      </p>
      <Banniere erreur={searchParams.erreur} ok={searchParams.ok} />
      <form className="stack card" action={actionAdminCompteCreer}>
        <h2>Nouveau particulier</h2>
        <input type="hidden" name="role" value="ETUDIANT_B2C" />
        <ChampsProfil />
        <div className="form-row">
          <label>
            E-mail
            <input type="email" name="email" required />
          </label>
          <label>
            Mot de passe
            <input type="password" name="motDePasse" minLength={8} required />
          </label>
        </div>
        <button type="submit">Créer le compte particulier</button>
      </form>
      <div className="grid two" style={{ marginTop: "1rem" }}>
        <form className="stack card" action={actionAdminCompteCreer}>
          <h2>Autre administrateur</h2>
          <input type="hidden" name="role" value="ADMIN" />
          <label>
            Nom
            <input name="nom" required />
          </label>
          <label>
            E-mail
            <input type="email" name="email" required />
          </label>
          <label>
            Mot de passe
            <input type="password" name="motDePasse" minLength={8} required />
          </label>
          <button type="submit">Créer l’administrateur</button>
        </form>
        <form className="stack card" action={actionAdminSocieteCreer}>
          <h2>Organisation</h2>
          <label>
            Nom de l’organisation
            <input name="nomSociete" required />
          </label>
          <label>
            Type
            <select name="typeOrganisation" defaultValue="ENTREPRISE">
              <option value="ENTREPRISE">Entreprise</option>
              <option value="ORGANISME_PUBLIC">Organisme public</option>
            </select>
          </label>
          <label>
            Responsable
            <input name="nom" required />
          </label>
          <label>
            E-mail du responsable
            <input type="email" name="email" required />
          </label>
          <label>
            Téléphone
            <input name="telephone" />
          </label>
          <label>
            Mot de passe
            <input type="password" name="motDePasse" minLength={8} required />
          </label>
          <button type="submit">Créer l’organisation</button>
        </form>
      </div>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Comptes</h2>
        <div className="grid">
          {comptes.map((compte) => (
            <form className="stack" action={actionAdminCompteModifier} key={compte.id}>
              <input type="hidden" name="compteId" value={compte.id} />
              <p className="tag">{libelleRole(compte.role, compte.societe?.type)}{compte.societe ? ` · ${compte.societe.nom}` : ""}</p>
              <div className="form-row">
                <label>
                  Nom
                  <input name="nom" defaultValue={compte.nom} required />
                </label>
                <label>
                  E-mail
                  <input type="email" name="email" defaultValue={compte.email} required />
                </label>
              </div>
              <label>
                Nouveau mot de passe
                <input type="password" name="motDePasse" minLength={8} placeholder="Laisser vide pour conserver" />
              </label>
              <button type="submit">Mettre à jour</button>
            </form>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Supprimer un compte</h2>
        <form className="stack" action={actionAdminCompteSupprimer}>
          <label>
            Compte
            <select name="compteId" required>
              {comptes.map((compte) => (
                <option key={compte.id} value={compte.id}>
                  {compte.nom} · {compte.email}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" name="confirmer" required /> Confirmer la suppression
          </label>
          <button type="submit" className="btn-secondary">
            Supprimer le compte
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Organisations</h2>
        {societes.length === 0 ? (
          <p>Aucune organisation.</p>
        ) : (
          societes.map((societe) => (
            <form key={societe.id} action={actionAdminSocieteSupprimer} className="stack" style={{ marginTop: "0.8rem" }}>
              <p>
                <strong>{societe.nom}</strong> · {societe.email} · {societe._count.comptes} compte(s) ·{" "}
                {societe._count.commandes} achat(s)
              </p>
              <input type="hidden" name="societeId" value={societe.id} />
              <label className="check">
                <input type="checkbox" name="confirmer" required /> Confirmer la suppression
              </label>
              <button type="submit" className="btn-secondary">
                Supprimer {societe.nom}
              </button>
            </form>
          ))
        )}
      </section>
    </>
  );
}
