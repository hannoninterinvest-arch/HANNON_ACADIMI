import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const RACINE = path.resolve(process.cwd(), "storage", "prive");

function cheminAbsolu(relatif: string): string {
  const absolu = path.resolve(RACINE, relatif);
  if (absolu !== RACINE && !absolu.startsWith(`${RACINE}${path.sep}`)) {
    throw new Error("CHEMIN_INTERDIT");
  }
  return absolu;
}

export async function enregistrerDocument(
  dossier: "certificats" | "ressources",
  fichier: File,
): Promise<{ chemin: string; nom: string; typeMime: string }> {
  if (fichier.size <= 0 || fichier.size > 8 * 1024 * 1024) {
    throw new Error("FICHIER_TROP_VOLUMINEUX");
  }
  const nom = fichier.name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "document";
  const relatif = path.join(dossier, `${randomBytes(16).toString("hex")}-${nom}`);
  const absolu = cheminAbsolu(relatif);
  await mkdir(path.dirname(absolu), { recursive: true });
  await writeFile(absolu, Buffer.from(await fichier.arrayBuffer()));
  return { chemin: relatif, nom, typeMime: fichier.type || "application/octet-stream" };
}

export async function lireDocument(relatif: string): Promise<Buffer> {
  return readFile(cheminAbsolu(relatif));
}
