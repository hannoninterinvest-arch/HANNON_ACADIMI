"use client";

import { useState, useTransition } from "react";
import { formatEuros } from "@/lib/format";
import type { Devis } from "@/lib/commerce/tarifs";
import { messageErreur } from "@/lib/commerce/messages";

export function FormulaireAchat({
  sessionId,
  retour,
  profil,
  places,
  devisInitial,
  calculer,
  acheter,
}: {
  sessionId: string;
  retour: string;
  profil: "B2C" | "B2B" | "B2G";
  places: number;
  devisInitial: Devis;
  calculer: (sessionId: string, quantite: number) => Promise<Devis | { erreur: string }>;
  acheter: (formData: FormData) => Promise<void>;
}) {
  const [quantite, setQuantite] = useState(devisInitial.quantite);
  const [devis, setDevis] = useState(devisInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changer(valeur: number) {
    const suivante = profil === "B2C" ? 1 : Math.max(1, valeur);
    setQuantite(suivante);
    startTransition(async () => {
      const resultat = await calculer(sessionId, suivante);
      if ("erreur" in resultat) {
        setErreur(messageErreur(resultat.erreur));
        return;
      }
      setDevis(resultat);
      setErreur(null);
    });
  }

  return (
    <form className="stack" action={acheter}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="retour" value={retour} />
      {profil === "B2C" ? (
        <input type="hidden" name="quantite" value="1" />
      ) : (
        <label>
          Nombre de places
          <input
            type="number"
            name="quantite"
            min={1}
            max={Math.max(places, 1)}
            value={quantite}
            onChange={(event) => changer(Number.parseInt(event.target.value || "1", 10))}
            required
          />
        </label>
      )}
      <div className="quote" aria-live="polite">
        <p>
          Prix par place : <strong>{formatEuros(devis.prixUnitaireNetCentimes)}</strong>
          {devis.remiseAppliquee ? ` (base ${formatEuros(devis.prixUnitaireCentimes)})` : ""}
        </p>
        <p>Remise : {devis.remiseAppliquee ? formatEuros(devis.remiseTotaleCentimes) : "aucune"}</p>
        <p>
          Total : <strong>{formatEuros(devis.totalCentimes)}</strong>
        </p>
        <p className="muted">{pending ? "Calcul en cours…" : devis.libelle}</p>
      </div>
      {erreur ? <p className="missing">{erreur}</p> : null}
      <button type="submit" disabled={places < 1 || pending}>
        {places < 1 ? "Session complète" : "Continuer vers le paiement"}
      </button>
    </form>
  );
}
