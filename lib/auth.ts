import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RoleCompte } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  nom: string;
  role: RoleCompte;
  societeId: string | null;
  formateurId: string | null;
  etudiantId: string | null;
};

const COOKIE = "hannon_session";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET || "hannon-dev-secret";
  return new TextEncoder().encode(secret);
}

export async function creerCookieSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function lireSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.email !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return {
      id: String(payload.sub ?? payload.id ?? ""),
      email: payload.email,
      nom: String(payload.nom ?? ""),
      role: payload.role as RoleCompte,
      societeId: typeof payload.societeId === "string" ? payload.societeId : null,
      formateurId: typeof payload.formateurId === "string" ? payload.formateurId : null,
      etudiantId: typeof payload.etudiantId === "string" ? payload.etudiantId : null,
    };
  } catch {
    return null;
  }
}

export async function supprimerCookieSession(): Promise<void> {
  cookies().delete(COOKIE);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await lireSession();
  if (!session) {
    redirect("/connexion");
  }
  return session;
}

export async function requireRole(...roles: RoleCompte[]): Promise<SessionUser> {
  const session = await requireUser();
  if (!roles.includes(session.role)) {
    redirect("/espace");
  }
  return session;
}

export const LIBELLES_ROLE: Record<RoleCompte, string> = {
  ADMIN: "Administrateur",
  FORMATEUR: "Formateur",
  ETUDIANT_B2C: "Étudiant (B2C)",
  SOCIETE: "Société (B2B)",
  EMPLOYE: "Employé",
};

export function cheminEspace(role: RoleCompte): string {
  switch (role) {
    case "ADMIN":
      return "/espace/admin";
    case "FORMATEUR":
      return "/espace/formateur";
    case "ETUDIANT_B2C":
      return "/espace/etudiant";
    case "SOCIETE":
      return "/espace/societe";
    case "EMPLOYE":
      return "/espace/employe";
  }
}
