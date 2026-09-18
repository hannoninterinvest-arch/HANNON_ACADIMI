-- CreateEnum
CREATE TYPE "public"."RoleCompte" AS ENUM ('ADMIN', 'FORMATEUR', 'ETUDIANT_B2C', 'SOCIETE', 'EMPLOYE');

-- AlterTable
ALTER TABLE "public"."Cours" ADD COLUMN     "ouvertB2c" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."Compte" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "public"."RoleCompte" NOT NULL,
    "societeId" TEXT,
    "formateurId" TEXT,
    "etudiantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Societe" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Societe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AchatPlaces" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "nbPlaces" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchatPlaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Compte_email_key" ON "public"."Compte"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Compte_formateurId_key" ON "public"."Compte"("formateurId");

-- CreateIndex
CREATE UNIQUE INDEX "Compte_etudiantId_key" ON "public"."Compte"("etudiantId");

-- CreateIndex
CREATE INDEX "Compte_role_idx" ON "public"."Compte"("role");

-- CreateIndex
CREATE INDEX "Compte_societeId_idx" ON "public"."Compte"("societeId");

-- CreateIndex
CREATE UNIQUE INDEX "Societe_email_key" ON "public"."Societe"("email");

-- CreateIndex
CREATE INDEX "AchatPlaces_societeId_idx" ON "public"."AchatPlaces"("societeId");

-- CreateIndex
CREATE INDEX "AchatPlaces_coursId_idx" ON "public"."AchatPlaces"("coursId");

-- AddForeignKey
ALTER TABLE "public"."Compte" ADD CONSTRAINT "Compte_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Compte" ADD CONSTRAINT "Compte_formateurId_fkey" FOREIGN KEY ("formateurId") REFERENCES "public"."Formateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Compte" ADD CONSTRAINT "Compte_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "public"."Etudiant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AchatPlaces" ADD CONSTRAINT "AchatPlaces_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AchatPlaces" ADD CONSTRAINT "AchatPlaces_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
