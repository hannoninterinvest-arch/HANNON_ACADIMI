export class EnvError extends Error {
  public readonly variable: string;

  constructor(variable: string, detail: string) {
    super(`Variable d'environnement manquante ou invalide : ${variable}. ${detail}`);
    this.name = "EnvError";
    this.variable = variable;
  }
}

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function requireValue(name: string, ouLaTrouver: string): string {
  const value = read(name);
  if (!value) {
    throw new EnvError(name, ouLaTrouver);
  }
  return value;
}

export function getDatabaseUrl(): string {
  return requireValue(
    "DATABASE_URL",
    "Neon Console > Connect > chaîne pooled (hôte -pooler).",
  );
}

export function getCronSecret(): string {
  return requireValue(
    "CRON_SECRET",
    "Générer avec `openssl rand -hex 32` et copier dans .env.",
  );
}

export function getAppTimezone(): string {
  return read("APP_TIMEZONE") ?? "Europe/Paris";
}

export function getSessionHorizonJours(): number {
  const raw = read("SESSION_HORIZON_JOURS");
  const parsed = raw ? Number.parseInt(raw, 10) : 14;
  if (!Number.isFinite(parsed) || parsed < 7 || parsed > 14) {
    throw new EnvError(
      "SESSION_HORIZON_JOURS",
      "Doit être un entier entre 7 et 14 (fenêtre glissante de création Zoom).",
    );
  }
  return parsed;
}

export function getAppUrl(): string {
  return read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
}

export type ZoomEnv = {
  accountId: string;
  clientId: string;
  clientSecret: string;
};

export function getZoomEnv(): ZoomEnv {
  return {
    accountId: requireValue(
      "ZOOM_ACCOUNT_ID",
      "Zoom Marketplace > ton app Server-to-Server OAuth > App Credentials > Account ID.",
    ),
    clientId: requireValue(
      "ZOOM_CLIENT_ID",
      "Zoom Marketplace > ton app Server-to-Server OAuth > App Credentials > Client ID.",
    ),
    clientSecret: requireValue(
      "ZOOM_CLIENT_SECRET",
      "Zoom Marketplace > ton app Server-to-Server OAuth > App Credentials > Client Secret.",
    ),
  };
}

export function hasZoomCredentials(): boolean {
  return Boolean(read("ZOOM_ACCOUNT_ID") && read("ZOOM_CLIENT_ID") && read("ZOOM_CLIENT_SECRET"));
}

export function getZoomWebhookSecret(): string {
  return requireValue(
    "ZOOM_WEBHOOK_SECRET_TOKEN",
    "Zoom Marketplace > ton app > Feature > Event Subscriptions > Secret Token.",
  );
}

export function hasZoomWebhookSecret(): boolean {
  return Boolean(read("ZOOM_WEBHOOK_SECRET_TOKEN"));
}

export type EmailEnv = {
  apiKey: string;
  from: string;
  alertEmail: string | undefined;
};

export function getEmailEnv(): EmailEnv {
  return {
    apiKey: requireValue(
      "RESEND_API_KEY",
      "Resend dashboard > API Keys (https://resend.com/api-keys).",
    ),
    from: requireValue(
      "RESEND_FROM_EMAIL",
      'Resend > Domains, format `"Nom <email@domaine>"`.',
    ),
    alertEmail: read("ALERT_EMAIL"),
  };
}

export function hasEmailCredentials(): boolean {
  return Boolean(read("RESEND_API_KEY") && read("RESEND_FROM_EMAIL"));
}

export function describeMissingSecrets(): string[] {
  const missing: string[] = [];
  if (!read("DATABASE_URL")) missing.push("DATABASE_URL");
  if (!read("DIRECT_URL")) missing.push("DIRECT_URL");
  if (!read("CRON_SECRET")) missing.push("CRON_SECRET");
  if (!hasZoomCredentials()) {
    missing.push("ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET");
  }
  if (!hasZoomWebhookSecret()) missing.push("ZOOM_WEBHOOK_SECRET_TOKEN");
  if (!read("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  if (!read("RESEND_FROM_EMAIL")) missing.push("RESEND_FROM_EMAIL");
  return missing;
}
