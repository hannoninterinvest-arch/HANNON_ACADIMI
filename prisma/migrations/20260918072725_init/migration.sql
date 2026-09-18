-- CreateEnum
CREATE TYPE "public"."JourSemaine" AS ENUM ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE');

-- CreateEnum
CREATE TYPE "public"."StatutSession" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "public"."StatutLicence" AS ENUM ('LIBRE', 'OCCUPE');

-- CreateTable
CREATE TABLE "public"."Formateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Formateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cours" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Etudiant" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Etudiant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inscription" (
    "id" TEXT NOT NULL,
    "etudiantId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmploiDuTemps" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "formateurId" TEXT NOT NULL,
    "jourSemaine" "public"."JourSemaine" NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "dateDebutPeriode" DATE NOT NULL,
    "dateFinPeriode" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploiDuTemps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "emploiDuTempsId" TEXT NOT NULL,
    "dateReelle" TIMESTAMP(3) NOT NULL,
    "zoomMeetingId" TEXT,
    "joinUrl" TEXT,
    "hostKey" TEXT,
    "statut" "public"."StatutSession" NOT NULL DEFAULT 'PLANIFIEE',
    "licenceZoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LicenceZoom" (
    "id" TEXT NOT NULL,
    "compteEmail" TEXT NOT NULL,
    "zoomUserId" TEXT NOT NULL,
    "statut" "public"."StatutLicence" NOT NULL DEFAULT 'LIBRE',
    "hostKey" TEXT,
    "sessionIdEnCours" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenceZoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Formateur_email_key" ON "public"."Formateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Etudiant_email_key" ON "public"."Etudiant"("email");

-- CreateIndex
CREATE INDEX "Inscription_coursId_idx" ON "public"."Inscription"("coursId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_etudiantId_coursId_key" ON "public"."Inscription"("etudiantId", "coursId");

-- CreateIndex
CREATE INDEX "EmploiDuTemps_formateurId_idx" ON "public"."EmploiDuTemps"("formateurId");

-- CreateIndex
CREATE INDEX "EmploiDuTemps_coursId_idx" ON "public"."EmploiDuTemps"("coursId");

-- CreateIndex
CREATE INDEX "Session_statut_idx" ON "public"."Session"("statut");

-- CreateIndex
CREATE INDEX "Session_dateReelle_idx" ON "public"."Session"("dateReelle");

-- CreateIndex
CREATE INDEX "Session_zoomMeetingId_idx" ON "public"."Session"("zoomMeetingId");

-- CreateIndex
CREATE INDEX "Session_licenceZoomId_idx" ON "public"."Session"("licenceZoomId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_emploiDuTempsId_dateReelle_key" ON "public"."Session"("emploiDuTempsId", "dateReelle");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceZoom_compteEmail_key" ON "public"."LicenceZoom"("compteEmail");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceZoom_zoomUserId_key" ON "public"."LicenceZoom"("zoomUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LicenceZoom_sessionIdEnCours_key" ON "public"."LicenceZoom"("sessionIdEnCours");

-- CreateIndex
CREATE INDEX "LicenceZoom_statut_idx" ON "public"."LicenceZoom"("statut");

-- AddForeignKey
ALTER TABLE "public"."Inscription" ADD CONSTRAINT "Inscription_etudiantId_fkey" FOREIGN KEY ("etudiantId") REFERENCES "public"."Etudiant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inscription" ADD CONSTRAINT "Inscription_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmploiDuTemps" ADD CONSTRAINT "EmploiDuTemps_formateurId_fkey" FOREIGN KEY ("formateurId") REFERENCES "public"."Formateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_emploiDuTempsId_fkey" FOREIGN KEY ("emploiDuTempsId") REFERENCES "public"."EmploiDuTemps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_licenceZoomId_fkey" FOREIGN KEY ("licenceZoomId") REFERENCES "public"."LicenceZoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LicenceZoom" ADD CONSTRAINT "LicenceZoom_sessionIdEnCours_fkey" FOREIGN KEY ("sessionIdEnCours") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
