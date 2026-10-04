import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { lireSession } from "@/lib/auth";
import { hasherJetonInvitation } from "@/lib/invitations";
import { actionAccepterInvitation } from "@/lib/actions/organisation";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { erreur?: string };
}) {
  const invitation = await prisma.invitation.findUnique({
    where: { jetonHash: hasherJetonInvitation(params.token) },
    include: { societe: true },
  });
  const expiree = !invitation || invitation.accepteeLe || invitation.expireLe.getTime() < Date.now();
  const session = await lireSession();

  return (
    <main>
      <p className="eyebrow">Invitation</p>
      <h1>Rejoindre une organisation</h1>
      {expiree || !invitation ? (
        <div className="empty">
          <p>Cette invitation est invalide, déjà utilisée ou expirée.</p>
          <Link href="/connexion">Aller à la connexion</Link>
        </div>
      ) : (
        <>
          <p className="lead">
            {invitation.societe.nom} vous invite à accéder à ses formations.{" "}
            {invitation.compteExistantId
              ? "Un compte existe déjà avec cette adresse : confirmez le rattachement, aucun doublon ne sera créé."
              : "Choisissez un mot de passe pour ouvrir votre accès."}
          </p>
          {searchParams.erreur === "compte" ? (
            <p className="alert err">Connectez-vous avec l’adresse invitée pour confirmer le rattachement.</p>
          ) : null}
          {searchParams.erreur === "champs" ? (
            <p className="alert err">Le mot de passe doit contenir au moins 8 caractères.</p>
          ) : null}
          {searchParams.erreur === "email" ? (
            <p className="alert err">Cette adresse a déjà un compte. Utilisez le lien de rattachement.</p>
          ) : null}
          {invitation.compteExistantId ? (
            session?.id === invitation.compteExistantId ? (
              <form className="stack card" action={actionAccepterInvitation}>
                <input type="hidden" name="jeton" value={params.token} />
                <p>
                  Confirmer le rattachement de <strong>{session.email}</strong> à {invitation.societe.nom}. Vos achats
                  personnels restent sur ce compte.
                </p>
                <button type="submit">Rattacher mon compte</button>
              </form>
            ) : (
              <p>
                <Link className="btn" href={`/connexion?next=/invitation/${params.token}`}>
                  Se connecter pour confirmer
                </Link>
              </p>
            )
          ) : (
            <form className="stack card" action={actionAccepterInvitation}>
              <input type="hidden" name="jeton" value={params.token} />
              <label>
                Nom
                <input name="nom" defaultValue={invitation.nom} required />
              </label>
              <label>
                E-mail
                <input value={invitation.email} readOnly />
              </label>
              <label>
                Mot de passe
                <input type="password" name="motDePasse" minLength={8} required autoComplete="new-password" />
              </label>
              <button type="submit">Créer mon accès</button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
