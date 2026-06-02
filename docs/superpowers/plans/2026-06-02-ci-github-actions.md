# CI GitHub Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un workflow GitHub Actions qui exécute, à chaque push sur `main` et chaque pull request, les tests frontend (type-check + vitest) et backend (unit + intégration sur un Postgres éphémère), sans bloquer le déploiement.

**Architecture:** Un seul fichier `.github/workflows/ci.yml` avec deux jobs parallèles (`frontend`, `backend`). Le job backend démarre un service container Postgres 18 mappé sur le port 5433 pour que le `DATABASE_URL` de `.env.test.example` fonctionne sans modification. Aucun secret GitHub requis (base éphémère, secrets JWT de test factices).

**Tech Stack:** GitHub Actions, Node 20, npm ci, vitest, Prisma (migrate deploy), PostgreSQL 18 (service container).

**Spec :** `docs/superpowers/specs/2026-06-01-ci-design.md`

**Notes d'exécution :**
- OS local : Windows. Utiliser **PowerShell** pour git/npm (le shell Bash n'a pas git). Chemins absolus recommandés (le cwd PowerShell peut persister entre commandes).
- Repo root : `C:\Users\USER\Documents\restaurant-mvp`.
- Le job backend est reproductible localement : un cluster PostgreSQL 18 tourne sur le port **5433**, et `backend/.env.test` existe déjà (git-ignoré) pointant sur `restaurant_test`.
- Ce travail est un ajout d'infra : pas de code applicatif modifié, pas de tests unitaires nouveaux à écrire. La « vérification » remplace le cycle TDD : on prouve la suite verte localement (Task 1), on écrit le workflow (Task 2), on observe le run réel dans Actions (Task 3).

---

## Task 1 : Établir la baseline verte localement (équivalent CI)

**But :** garantir que les commandes exactes que la CI lancera passent au vert sur la machine, AVANT d'écrire le YAML. Aucun fichier créé/modifié — vérification pure.

**Files:** aucun (vérification).

- [ ] **Step 1: Vérifier le frontend (type-check + tests)**

Run (PowerShell, depuis le repo root) :
```
cd C:\Users\USER\Documents\restaurant-mvp\frontend; npm ci; npm run type-check; npm test
```
Expected : `npm ci` OK, `type-check` sans erreur, vitest **53 tests passed** (8 fichiers).

Si un test échoue : STOP et signaler — la CI ne doit inclure que du vert. Ne pas continuer.

- [ ] **Step 2: Préparer la base de test backend (migrations)**

Le service Postgres de la CI réplique le cluster local (port 5433, user/pass `restaurant`, base `restaurant_test`). En local, `backend/.env.test` pointe déjà dessus.

Run (PowerShell) :
```
cd C:\Users\USER\Documents\restaurant-mvp\backend; npm ci; npx prisma generate; npm run test:integration:setup
```
Expected : `prisma migrate deploy` applique toutes les migrations sur `restaurant_test` (« All migrations have been successfully applied » ou « No pending migrations »).

Si la base `restaurant_test` n'existe pas (erreur de connexion P1003/P1001) : la créer dans le cluster local puis relancer —
```
psql -p 5433 -U restaurant -d postgres -c "CREATE DATABASE restaurant_test;"
```
(puis relancer `npm run test:integration:setup`). Si Postgres n'est pas joignable du tout, STOP et signaler.

- [ ] **Step 3: Vérifier le backend (unit + intégration)**

Run (PowerShell) :
```
cd C:\Users\USER\Documents\restaurant-mvp\backend; npm test; npm run test:integration
```
Expected : suite unit verte (`api.test.ts`, `logic.test.ts`, `payroll.test.ts`) PUIS suite intégration verte (`src/__tests__/integration/**`). Zéro échec sur les deux.

Si un test échoue : STOP et signaler avant d'écrire le workflow.

- [ ] **Step 4: Pas de commit**

Cette tâche ne modifie aucun fichier. Noter les résultats (nombre de tests verts par suite) pour le rapport. Passer à la Task 2.

---

## Task 2 : Créer le workflow CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Créer le fichier workflow**

Créer `C:\Users\USER\Documents\restaurant-mvp\.github\workflows\ci.yml` avec EXACTEMENT ce contenu :

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run type-check
      - run: npm test

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_USER: restaurant
          POSTGRES_PASSWORD: restaurant
          POSTGRES_DB: restaurant_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U restaurant"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: cp .env.test.example .env.test
      - run: npm run test:integration:setup
      - run: npm test
      - run: npm run test:integration
```

- [ ] **Step 2: Vérifier que le YAML est bien formé**

Le YAML ne peut pas être « testé » comme du code, mais on confirme qu'il parse. Run (PowerShell, repo root) — utilise PowerShell pour valider la syntaxe YAML :
```
cd C:\Users\USER\Documents\restaurant-mvp; powershell -Command "Get-Content .github/workflows/ci.yml -Raw | Out-Null; if ($LASTEXITCODE -ne 0) { exit 1 } ; Write-Output 'file readable'"
```
Puis vérifier visuellement l'indentation (2 espaces, pas de tabs) et que les deux jobs `frontend` et `backend` sont présents.

Run pour confirmer l'absence de tabulations :
```
cd C:\Users\USER\Documents\restaurant-mvp; if (Select-String -Path .github/workflows/ci.yml -Pattern "`t" -Quiet) { Write-Output 'TABS FOUND - FIX' } else { Write-Output 'no tabs OK' }
```
Expected : `no tabs OK`.

- [ ] **Step 3: Commit**

Run (PowerShell, repo root) :
```
cd C:\Users\USER\Documents\restaurant-mvp; git add .github/workflows/ci.yml; git commit -m "ci: workflow GitHub Actions (frontend + backend avec Postgres)"
```
Expected : commit créé sur la branche de travail.

---

## Task 3 : Déclencher et vérifier le run dans GitHub Actions

**But :** prouver que le workflow s'exécute réellement et passe au vert dans GitHub Actions. La validation réelle ne peut se faire que côté GitHub (un workflow ne s'exécute pas en local).

**Files:** aucun (vérification + déclenchement).

**Prérequis :** le CLI `gh` (GitHub CLI) doit être authentifié. Vérifier avec `gh auth status`. S'il ne l'est pas, STOP et demander à l'utilisateur de lancer `gh auth login` (commande interactive — il peut la lancer lui-même via `! gh auth login`).

- [ ] **Step 1: Pousser la branche de travail**

Run (PowerShell, repo root) — remplacer `<branche>` par la branche de feature courante (ex. `feat/ci-actions`) :
```
cd C:\Users\USER\Documents\restaurant-mvp; git push -u origin <branche>
```
Expected : branche poussée sur origin.

- [ ] **Step 2: Ouvrir une PR pour déclencher le run `pull_request`**

Le déclencheur `pull_request` fait tourner la CI sur la branche. Run (PowerShell) :
```
gh pr create --base main --head <branche> --title "ci: workflow GitHub Actions" --body "Ajoute la CI (tests front + back). Premier run de validation du workflow."
```
Expected : URL de la PR affichée. (Cette PR sert aussi de première démonstration du badge ✓ ; le flux de l'utilisateur reste le push direct — voir spec, option 1.)

- [ ] **Step 3: Observer le run jusqu'au bout**

Run (PowerShell) :
```
gh run list --branch <branche> --limit 1
gh run watch
```
(Si `gh run watch` demande quel run, sélectionner le plus récent pour la branche. Alternative non interactive : `gh run watch $(gh run list --branch <branche> --limit 1 --json databaseId --jq '.[0].databaseId')`.)

Expected : les deux jobs `frontend` et `backend` terminent en **success** (✓). Le job backend doit montrer Postgres démarré (health check), `prisma migrate deploy` appliqué, puis les deux suites de tests vertes.

- [ ] **Step 4: En cas d'échec d'un job**

Lire les logs du job échoué :
```
gh run view --log-failed
```
Diagnostiquer (causes probables : version d'`actions/*` indisponible, image `postgres:18` indisponible → repli `postgres:16`, base non prête → augmenter `--health-retries`, divergence lockfile → `npm ci` échoue). Corriger `ci.yml`, committer le correctif (`git commit -m "ci: corrige <cause>"`), pousser (`git push`), et relancer l'observation (Step 3). Répéter jusqu'au vert.

- [ ] **Step 5: Confirmer le vert et rapporter**

Quand les deux jobs sont verts, rapporter l'URL du run réussi et l'URL de la PR. La finalisation (merge de la PR / de la branche dans `main`) sera gérée par le skill `finishing-a-development-branch`. Après merge, le déclencheur `push: [main]` relancera automatiquement la CI sur `main`.

---

## Notes post-implémentation

- Aucune variable de secret à configurer dans GitHub (base éphémère + JWT de test factices).
- Pour durcir plus tard (option 2/3 de la spec) : activer la protection de branche dans *Settings → Branches* et marquer les jobs `frontend`/`backend` comme checks requis — aucune modification du workflow nécessaire.
- Node est fixé à `'20'` dans les deux jobs ; pour changer de version, éditer les deux occurrences de `node-version`.
