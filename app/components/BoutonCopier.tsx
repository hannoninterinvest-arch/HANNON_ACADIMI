"use client";

import { useState } from "react";

export function BoutonCopier({ valeur }: { valeur: string }) {
  const [copie, setCopie] = useState(false);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valeur);
        } catch {
          const zone = document.createElement("textarea");
          zone.value = valeur;
          document.body.appendChild(zone);
          zone.select();
          document.execCommand("copy");
          zone.remove();
        }
        setCopie(true);
        window.setTimeout(() => setCopie(false), 2000);
      }}
    >
      {copie ? "Code copié" : `Copier le code ${valeur}`}
    </button>
  );
}
