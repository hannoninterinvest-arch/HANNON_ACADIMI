import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
