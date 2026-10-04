import { createHmac, timingSafeEqual } from "node:crypto";

export function signerCorps(secret: string, corps: string): string {
  return createHmac("sha256", secret).update(corps).digest("hex");
}

export function verifierSignatureHannon(
  secret: string,
  corps: string,
  signature: string | null,
): boolean {
  if (!signature) {
    return false;
  }
  const attendu = signerCorps(secret, corps);
  const gauche = Buffer.from(signature);
  const droite = Buffer.from(attendu);
  if (gauche.length !== droite.length) {
    return false;
  }
  return timingSafeEqual(gauche, droite);
}

export function verifierSignatureStripe(
  secret: string,
  corps: string,
  entete: string | null,
  maintenantMs: number = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!entete) {
    return false;
  }
  const parties = new Map<string, string[]>();
  for (const morceau of entete.split(",")) {
    const [cle, valeur] = morceau.split("=");
    if (!cle || !valeur) {
      continue;
    }
    const liste = parties.get(cle) ?? [];
    liste.push(valeur);
    parties.set(cle, liste);
  }
  const timestamp = parties.get("t")?.[0];
  const signatures = parties.get("v1") ?? [];
  if (!timestamp || signatures.length === 0) {
    return false;
  }
  const temps = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(temps) || Math.abs(maintenantMs / 1000 - temps) > toleranceSec) {
    return false;
  }
  const attendu = createHmac("sha256", secret).update(`${timestamp}.${corps}`).digest("hex");
  const droite = Buffer.from(attendu);
  return signatures.some((signature) => {
    const gauche = Buffer.from(signature);
    return gauche.length === droite.length && timingSafeEqual(gauche, droite);
  });
}
