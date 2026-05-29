-- Paie & CNPS / DISA : date de naissance de l'employé (requise pour la Déclaration
-- Individuelle des Salaires Annuels CNPS).

ALTER TABLE "employees" ADD COLUMN "birth_date" TIMESTAMP(3);
