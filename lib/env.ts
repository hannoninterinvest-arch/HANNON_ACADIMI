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

export type PaymentMode = "test" | "stripe";

export function getPaymentMode(): PaymentMode {
  const raw = read("PAYMENT_MODE") ?? "test";
  if (raw === "test" || raw === "stripe") {
    return raw;
  }
  throw new EnvError("PAYMENT_MODE", "Valeurs acceptées : test (simulateur) ou stripe.");
}

export function getReservationTtlMs(): number {
  const raw = read("RESERVATION_TTL_MINUTES");
  const minutes = raw ? Number.parseInt(raw, 10) : 30;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
    throw new EnvError(
      "RESERVATION_TTL_MINUTES",
      "Durée de réservation temporaire des places, entier entre 5 et 120 minutes.",
    );
  }
  return minutes * 60 * 1000;
}

export function getPaymentWebhookSecret(): string {
  const value = read("PAYMENT_WEBHOOK_SECRET");
  if (value) {
    return value;
  }
  if (getPaymentMode() === "test" && process.env.NODE_ENV !== "production") {
    return "hannon-paiement-test-dev";
  }
  throw new EnvError(
    "PAYMENT_WEBHOOK_SECRET",
    "Secret HMAC des webhooks de paiement. Générer avec `openssl rand -hex 32`.",
  );
}

export function getStripeSecretKey(): string {
  return requireValue(
    "STRIPE_SECRET_KEY",
    "Stripe Dashboard > Developers > API keys. Utiliser une clé sk_test_… en mode test.",
  );
}

export function getStripeWebhookSecret(): string {
  return requireValue(
    "STRIPE_WEBHOOK_SECRET",
    "Stripe Dashboard > Developers > Webhooks > signing secret (whsec_…).",
  );
}

export function stripeEstEnModeTest(): boolean {
  return (read("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_");
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
  if (!read("AUTH_SECRET")) missing.push("AUTH_SECRET");
  if (read("PAYMENT_MODE") === "stripe") {
    if (!read("STRIPE_SECRET_KEY")) missing.push("STRIPE_SECRET_KEY");
    if (!read("STRIPE_WEBHOOK_SECRET")) missing.push("STRIPE_WEBHOOK_SECRET");
  }
  if (process.env.NODE_ENV === "production" && !read("PAYMENT_WEBHOOK_SECRET")) {
    missing.push("PAYMENT_WEBHOOK_SECRET");
  }
  return missing;
}
