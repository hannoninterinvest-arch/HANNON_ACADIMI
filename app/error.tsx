"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1>Hannon Acadimi</h1>
      <p className="lead">Une erreur serveur a interrompu le rendu de cette page.</p>
      <section className="card">
        <h2>{error.name || "Erreur"}</h2>
        <p className="missing">{error.message}</p>
        {error.digest ? (
          <p>
            Digest : <code>{error.digest}</code>
          </p>
        ) : null}
        <p>
          Causes fréquentes sur Vercel : <code>DATABASE_URL</code> / <code>DIRECT_URL</code> Neon
          manquantes, ou migrations Prisma non appliquées.
        </p>
        <button type="button" onClick={() => reset()}>
          Réessayer
        </button>
      </section>
    </main>
  );
}
