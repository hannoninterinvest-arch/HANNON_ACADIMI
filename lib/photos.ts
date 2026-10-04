import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function enregistrerPhotoFormation(fichier: File): Promise<string> {
  const extension = EXTENSIONS[fichier.type];
  if (!extension) {
    throw new Error("PHOTO");
  }
  if (fichier.size > 5 * 1024 * 1024) {
    throw new Error("PHOTO");
  }
  const nom = `${randomBytes(16).toString("hex")}.${extension}`;
  const dossier = path.join(process.cwd(), "public", "uploads", "formations");
  await mkdir(dossier, { recursive: true });
  await writeFile(path.join(dossier, nom), Buffer.from(await fichier.arrayBuffer()));
  return `/uploads/formations/${nom}`;
}
