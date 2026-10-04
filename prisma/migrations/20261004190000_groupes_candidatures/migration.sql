ALTER TABLE "Cours" ADD COLUMN "effectifMinimal" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "StatutCandidature" AS ENUM ('EN_ATTENTE', 'CONTACTE', 'DANS_GROUPE', 'PAYEE', 'ANNULEE');

CREATE TABLE "Groupe" (
  "id" TEXT NOT NULL,
  "coursId" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "effectifMinimal" INTEGER NOT NULL,
  "horaire" TEXT,
  "dateDebut" TIMESTAMP(3),
  "dateFin" TIMESTAMP(3),
  "lienZoom" TEXT,
  "codeReunion" TEXT,
  "formateurId" TEXT,
  "sessionId" TEXT,
  "paiementOuvert" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Groupe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Groupe_sessionId_key" ON "Groupe"("sessionId");
CREATE INDEX "Groupe_coursId_idx" ON "Groupe"("coursId");

ALTER TABLE "Groupe" ADD CONSTRAINT "Groupe_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Groupe" ADD CONSTRAINT "Groupe_formateurId_fkey" FOREIGN KEY ("formateurId") REFERENCES "Formateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Groupe" ADD CONSTRAINT "Groupe_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Candidature" (
  "id" TEXT NOT NULL,
  "coursId" TEXT NOT NULL,
  "compteId" TEXT NOT NULL,
  "message" TEXT,
  "statut" "StatutCandidature" NOT NULL DEFAULT 'EN_ATTENTE',
  "groupeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Candidature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Candidature_coursId_compteId_key" ON "Candidature"("coursId", "compteId");
CREATE INDEX "Candidature_groupeId_idx" ON "Candidature"("groupeId");
CREATE INDEX "Candidature_compteId_idx" ON "Candidature"("compteId");

ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "Compte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
