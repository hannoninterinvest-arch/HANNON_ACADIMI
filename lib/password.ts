import bcrypt from "bcryptjs";

export async function hasherMotDePasse(clair: string): Promise<string> {
  return bcrypt.hash(clair, 10);
}

export async function verifierMotDePasse(clair: string, hash: string): Promise<boolean> {
  return bcrypt.compare(clair, hash);
}
