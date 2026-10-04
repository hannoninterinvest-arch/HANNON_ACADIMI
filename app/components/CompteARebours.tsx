"use client";

import { useEffect, useState } from "react";

export function CompteARebours({ debutIso, finIso }: { debutIso: string; finIso: string | null }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const debut = new Date(debutIso).getTime();
  const fin = finIso ? new Date(finIso).getTime() : null;
  if (fin && maintenant >= fin) {
    return <p className="countdown done">Réunion terminée</p>;
  }
  if (maintenant >= debut) {
    return <p className="countdown live">La réunion a commencé</p>;
  }

  const reste = debut - maintenant;
  const jours = Math.floor(reste / 86_400_000);
  const heures = Math.floor((reste % 86_400_000) / 3_600_000);
  const minutes = Math.floor((reste % 3_600_000) / 60_000);
  const secondes = Math.floor((reste % 60_000) / 1000);

  return (
    <p className="countdown" aria-live="polite">
      <span>Temps restant</span>
      <strong>
        {jours}j {heures}h {String(minutes).padStart(2, "0")}min {String(secondes).padStart(2, "0")}s
      </strong>
    </p>
  );
}
