import { PrismaClient } from "@prisma/client";

/**
 * Prisma exige DIRECT_URL dès que le champ est déclaré dans schema.prisma,
 * même pour les requêtes runtime. Sur Vercel on n'a parfois que DATABASE_URL.
 */
function ensurePrismaEnv(): void {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  if (databaseUrl && !directUrl) {
    process.env.DIRECT_URL = databaseUrl;
  }
}

ensurePrismaEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
