"use client";

import { useState } from "react";

export function MenuPrincipal({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        className="nav-burger"
        aria-expanded={ouvert}
        aria-controls="nav-principale"
        onClick={() => setOuvert((valeur) => !valeur)}
      >
        <span className="sr-only">{ouvert ? "Fermer le menu" : "Ouvrir le menu"}</span>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <nav
        id="nav-principale"
        aria-label="Navigation principale"
        className={ouvert ? "open" : undefined}
        onClick={(event) => {
          const cible = event.target as HTMLElement;
          if (cible.closest("a")) {
            setOuvert(false);
          }
        }}
      >
        {children}
      </nav>
    </>
  );
}
