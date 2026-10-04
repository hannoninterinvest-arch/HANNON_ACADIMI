import { messageErreur } from "@/lib/commerce/messages";

const OK: Record<string, string> = {
  "1": "Opération enregistrée.",
  affectation: "L’employé est inscrit sur une place déjà achetée.",
  desaffectation: "La place est revenue dans votre lot. Elle n’est pas remise en vente.",
  invitation: "Invitation envoyée. Le collaborateur définira son mot de passe.",
  rattachement: "Un rattachement sécurisé a été proposé au compte existant.",
  csv: "Import traité. Les invitations ont été créées.",
  achat: "Paiement confirmé.",
  maj: "Session mise à jour.",
  ressource: "Ressource ajoutée.",
  certificat: "Certificat attribué.",
  rembourse: "Commande remboursée. Les accès liés ont été retirés.",
};

export function Banniere({
  erreur,
  ok,
}: {
  erreur?: string;
  ok?: string;
}) {
  const message = messageErreur(erreur);
  const succes = ok ? OK[ok] ?? "C’est enregistré." : null;
  return (
    <>
      {message ? (
        <p className="alert err" role="alert">
          {message}
        </p>
      ) : null}
      {succes ? (
        <p className="alert ok" role="status">
          {succes}
        </p>
      ) : null}
    </>
  );
}
