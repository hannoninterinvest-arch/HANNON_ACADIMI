-- Migration additive : organisations, sessions commerciales, commandes, tarifs.
-- Aucune table ni colonne existante n'est supprimée.

CREATE TYPE "public"."TypeOrganisation" AS ENUM ('ENTREPRISE', 'ORGANISME_PUBLIC');
CREATE TYPE "public"."RoleAppartenance" AS ENUM ('RESPONSABLE', 'APPRENANT');
CREATE TYPE "public"."StatutOuvertureSession" AS ENUM ('OUVERTE', 'FERMEE', 'COMPLETE', 'ANNULEE');
CREATE TYPE "public"."StatutCommande" AS ENUM ('EN_ATTENTE', 'PAYEE', 'ECHOUEE', 'ANNULEE', 'REMBOURSEE');
CREATE TYPE "public"."ProfilTarif" AS ENUM ('B2C', 'B2B', 'B2G');
CREATE TYPE "public"."TypeRemise" AS ENUM ('POURCENTAGE', 'MONTANT_FIXE');
CREATE TYPE "public"."StatutReservation" AS ENUM ('ACTIVE', 'CONFIRMEE', 'LIBEREE', 'EXPIREE');
CREATE TYPE "public"."TypeAcheteur" AS ENUM ('PARTICULIER', 'ORGANISATION');
CREATE TYPE "public"."StatutDemande" AS ENUM ('NOUVELLE', 'EN_COURS', 'PROPOSITION_ENVOYEE', 'CLOTUREE');

ALTER TABLE "public"."Societe" ADD COLUMN "type" "public"."TypeOrganisation" NOT NULL DEFAULT 'ENTREPRISE';
ALTER TABLE "public"."Societe" ADD COLUMN "telephone" TEXT;

ALTER TABLE "public"."Session" ALTER COLUMN "emploiDuTempsId" DROP NOT NULL;
ALTER TABLE "public"."Session" ADD COLUMN "coursId" TEXT;
ALTER TABLE "public"."Session" ADD COLUMN "formateurId" TEXT;
ALTER TABLE "public"."Session" ADD COLUMN "dateFin" TIMESTAMP(3);
ALTER TABLE "public"."Session" ADD COLUMN "fuseauHoraire" TEXT NOT NULL DEFAULT 'Europe/Paris';
ALTER TABLE "public"."Session" ADD COLUMN "capaciteMax" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "public"."Session" ADD COLUMN "statutInscription" "public"."StatutOuvertureSession" NOT NULL DEFAULT 'FERMEE';
ALTER TABLE "public"."Session" ADD COLUMN "lienZoomManuel" TEXT;

CREATE INDEX "Session_coursId_idx" ON "public"."Session"("coursId");
CREATE INDEX "Session_statutInscription_idx" ON "public"."Session"("statutInscription");

ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_formateurId_fkey" FOREIGN KEY ("formateurId") REFERENCES "public"."Formateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."Appartenance" (
    "id" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "role" "public"."RoleAppartenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appartenance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Appartenance_compteId_societeId_key" ON "public"."Appartenance"("compteId", "societeId");
CREATE INDEX "Appartenance_societeId_role_idx" ON "public"."Appartenance"("societeId", "role");

CREATE TABLE "public"."Invitation" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "accepteeLe" TIMESTAMP(3),
    "compteExistantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_jetonHash_key" ON "public"."Invitation"("jetonHash");
CREATE INDEX "Invitation_societeId_email_idx" ON "public"."Invitation"("societeId", "email");

CREATE TABLE "public"."TarifFormation" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "prixB2cCentimes" INTEGER NOT NULL,
    "prixOrganisationCentimes" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TarifFormation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TarifFormation_coursId_key" ON "public"."TarifFormation"("coursId");

CREATE TABLE "public"."RegleRemise" (
    "id" TEXT NOT NULL,
    "tarifId" TEXT NOT NULL,
    "seuilQuantite" INTEGER NOT NULL DEFAULT 10,
    "typeRemise" "public"."TypeRemise" NOT NULL,
    "valeur" INTEGER NOT NULL,
    "profils" "public"."ProfilTarif"[],
    "actif" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RegleRemise_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegleRemise_tarifId_idx" ON "public"."RegleRemise"("tarifId");

CREATE TABLE "public"."Commande" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "societeId" TEXT,
    "coursId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaireCentimes" INTEGER NOT NULL,
    "remiseUnitaireCentimes" INTEGER NOT NULL,
    "totalCentimes" INTEGER NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "statut" "public"."StatutCommande" NOT NULL DEFAULT 'EN_ATTENTE',
    "typeAcheteur" "public"."TypeAcheteur" NOT NULL,
    "profilTarif" "public"."ProfilTarif" NOT NULL,
    "seuilApplique" INTEGER,
    "typeRemiseApplique" "public"."TypeRemise",
    "valeurRemiseAppliquee" INTEGER,
    "libelleRemise" TEXT,
    "fournisseurPaiement" TEXT NOT NULL,
    "referenceFournisseur" TEXT,
    "payeeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Commande_reference_key" ON "public"."Commande"("reference");
CREATE UNIQUE INDEX "Commande_referenceFournisseur_key" ON "public"."Commande"("referenceFournisseur");
CREATE INDEX "Commande_sessionId_statut_idx" ON "public"."Commande"("sessionId", "statut");
CREATE INDEX "Commande_societeId_sessionId_idx" ON "public"."Commande"("societeId", "sessionId");
CREATE INDEX "Commande_compteId_idx" ON "public"."Commande"("compteId");

CREATE TABLE "public"."ReservationPlaces" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "statut" "public"."StatutReservation" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationPlaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationPlaces_commandeId_key" ON "public"."ReservationPlaces"("commandeId");
CREATE INDEX "ReservationPlaces_sessionId_statut_expireLe_idx" ON "public"."ReservationPlaces"("sessionId", "statut", "expireLe");

CREATE TABLE "public"."Affectation" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Affectation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Affectation_sessionId_compteId_key" ON "public"."Affectation"("sessionId", "compteId");
CREATE INDEX "Affectation_commandeId_idx" ON "public"."Affectation"("commandeId");
CREATE INDEX "Affectation_societeId_sessionId_idx" ON "public"."Affectation"("societeId", "sessionId");

CREATE TABLE "public"."DemandeFormation" (
    "id" TEXT NOT NULL,
    "societeId" TEXT,
    "organisationNom" TEXT NOT NULL,
    "contactNom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "coursId" TEXT,
    "sujetPersonnalise" TEXT,
    "nbParticipants" INTEGER NOT NULL,
    "periodeSouhaitee" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" "public"."StatutDemande" NOT NULL DEFAULT 'NOUVELLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DemandeFormation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemandeFormation_statut_idx" ON "public"."DemandeFormation"("statut");

CREATE TABLE "public"."RessourceCours" (
    "id" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "nomFichier" TEXT NOT NULL,
    "cheminStockage" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RessourceCours_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RessourceCours_coursId_idx" ON "public"."RessourceCours"("coursId");

CREATE TABLE "public"."Certificat" (
    "id" TEXT NOT NULL,
    "compteId" TEXT NOT NULL,
    "coursId" TEXT NOT NULL,
    "sessionId" TEXT,
    "titre" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "cheminStockage" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "emisLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Certificat_compteId_idx" ON "public"."Certificat"("compteId");
CREATE INDEX "Certificat_coursId_idx" ON "public"."Certificat"("coursId");

ALTER TABLE "public"."Appartenance" ADD CONSTRAINT "Appartenance_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "public"."Compte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Appartenance" ADD CONSTRAINT "Appartenance_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TarifFormation" ADD CONSTRAINT "TarifFormation_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RegleRemise" ADD CONSTRAINT "RegleRemise_tarifId_fkey" FOREIGN KEY ("tarifId") REFERENCES "public"."TarifFormation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Commande" ADD CONSTRAINT "Commande_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "public"."Compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Commande" ADD CONSTRAINT "Commande_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Commande" ADD CONSTRAINT "Commande_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Commande" ADD CONSTRAINT "Commande_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ReservationPlaces" ADD CONSTRAINT "ReservationPlaces_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ReservationPlaces" ADD CONSTRAINT "ReservationPlaces_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "public"."Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Affectation" ADD CONSTRAINT "Affectation_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "public"."Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Affectation" ADD CONSTRAINT "Affectation_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Affectation" ADD CONSTRAINT "Affectation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Affectation" ADD CONSTRAINT "Affectation_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "public"."Compte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."DemandeFormation" ADD CONSTRAINT "DemandeFormation_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "public"."Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."DemandeFormation" ADD CONSTRAINT "DemandeFormation_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."RessourceCours" ADD CONSTRAINT "RessourceCours_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Certificat" ADD CONSTRAINT "Certificat_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "public"."Compte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Certificat" ADD CONSTRAINT "Certificat_coursId_fkey" FOREIGN KEY ("coursId") REFERENCES "public"."Cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Certificat" ADD CONSTRAINT "Certificat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
