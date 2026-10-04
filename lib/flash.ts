import { cookies } from "next/headers";

const COOKIE = "hannon_flash";

export async function poserFlash(valeur: unknown): Promise<void> {
  cookies().set(COOKIE, JSON.stringify(valeur), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 180,
  });
}

export async function lireFlash<T>(): Promise<T | null> {
  const brut = cookies().get(COOKIE)?.value;
  if (!brut) {
    return null;
  }
  cookies().delete(COOKIE);
  try {
    return JSON.parse(brut) as T;
  } catch {
    return null;
  }
}
