export function explainPrismaError(error: unknown): {
  title: string;
  detail: string;
  code: string | undefined;
} {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  if (/Environment variable not found: DIRECT_URL/i.test(message)) {
    return {
      title: "DIRECT_URL manquante",
      detail:
        "Dans Vercel → Settings → Environment Variables, ajoute DIRECT_URL (chaîne Neon « direct », sans -pooler). En attendant, l'app réutilise DATABASE_URL si elle est définie.",
      code,
    };
  }

  if (/Environment variable not found: DATABASE_URL/i.test(message)) {
    return {
      title: "DATABASE_URL manquante",
      detail:
        "Dans Vercel → Settings → Environment Variables, colle l'URI Neon pooled (hôte avec -pooler, sslmode=require) pour Production et Preview, puis Redeploy.",
      code,
    };
  }

  if (/does not exist/i.test(message) || code === "P2021" || code === "P2010") {
    return {
      title: "Tables Prisma absentes",
      detail:
        "Les migrations n'ont pas été appliquées sur Neon. Vérifie DATABASE_URL + DIRECT_URL puis relance un deploy (prisma migrate deploy tourne au build).",
      code,
    };
  }

  if (/Can't reach database|P1001|P1000|timeout|ENOTFOUND|ECONNREFUSED/i.test(message) || code === "P1001") {
    return {
      title: "Base Neon injoignable",
      detail:
        "Vérifie l'URI (pooled -pooler), sslmode=require, et que le projet Neon n'est pas suspendu. Vercel doit pouvoir joindre *.neon.tech.",
      code,
    };
  }

  return {
    title: "Erreur base de données",
    detail: message,
    code,
  };
}
