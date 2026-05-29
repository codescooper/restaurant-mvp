-- Paie & CNPS M1 : champs employé pour la déclaration CNPS + calcul de bulletin.
-- n° CNPS (matricule assuré social), situation matrimoniale et nombre d'enfants à charge
-- (ces deux derniers servent au crédit d'impôt familial ITS, optionnel).

ALTER TABLE "employees" ADD COLUMN "cnps_number" VARCHAR(30);
ALTER TABLE "employees" ADD COLUMN "marital_status" VARCHAR(20);
ALTER TABLE "employees" ADD COLUMN "dependent_children" INTEGER;
