"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <main>
          <h1>Hannon Acadimi</h1>
          <p>Erreur serveur : {error.message}</p>
          {error.digest ? <p>Digest : {error.digest}</p> : null}
          <button type="button" onClick={() => reset()}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
