import { PrismaClient } from "@prisma/client";
import { seedIfEmpty } from "../lib/seed";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const result = await seedIfEmpty(prisma);
  console.info("Seed", result);
}

main()
  .catch((error: unknown) => {
    console.error("Seed échoué", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
