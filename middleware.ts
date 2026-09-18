import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.CRON_SECRET || "hannon-dev-secret";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("hannon_session")?.value;
  if (!token) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  try {
    await jwtVerify(token, secretKey());
    return NextResponse.next();
  } catch {
    const login = new URL("/connexion", request.url);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ["/espace/:path*"],
};
