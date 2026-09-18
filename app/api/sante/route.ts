import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { describeMissingSecrets } from "@/lib/env";
import { explainPrismaError } from "@/lib/prismaErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const missing = describeMissingSecrets();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, missing });
  } catch (error) {
    const explained = explainPrismaError(error);
    return NextResponse.json(
      {
        ok: false,
        missing,
        error: explained,
      },
      { status: 503 },
    );
  }
}
