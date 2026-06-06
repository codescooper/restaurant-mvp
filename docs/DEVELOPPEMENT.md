# Guide de développement — Restoflow

## 1. Prérequis

- **Node.js 18+** (testé jusqu'à Node 22).
- **PostgreSQL** : Docker en local, cluster PostgreSQL dédié, ou service en ligne (Neon/Supabase).

> ⚠️ En local sur ce poste, la base tourne sur un **cluster PG18 dédié, port `5433`** (le 5432 est
> occupé/inaccessible, pas de Docker) — voir mémoire `local-db-dedicated-cluster`. Adaptez
> `DATABASE_URL` en conséquence.

## 2. Installation

```bash
# 1. Base de données (option Docker)
docker compose up -d           # PostgreSQL sur localhost:5432

# 2. Backend
cd backend
cp .env.example .env           # renseigner DATABASE_URL + secrets JWT
npm install
npm run prisma:migrate         # crée/maj les tables
npm run seed                   # données de démonstration
npm run dev                    # API + WebSocket sur http://localhost:3000

# 3. Frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev                    # http://localhost:5173
```

Comptes de démonstration : voir le `README.md` racine.

## 3. Variables d'environnement

**`backend/.env`**

```
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://restaurant:restaurant@localhost:5432/restaurant_db?schema=public"
JWT_SECRET=...
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
# APP_BASE_URL=...        # liens d'invitation/partage (à finaliser en prod)
# ANTHROPIC_API_KEY=...   # OPTIONNEL : enrichissement IA du module Budget (suggestions + conclusion).
#                         # Absente → le module Budget reste 100 % fonctionnel (moteur déterministe seul).
```

> Le module **Budget** ajoute la dépendance `@anthropic-ai/sdk` (déjà dans `backend/package.json`).
> Sans `ANTHROPIC_API_KEY`, aucun appel réseau n'est fait et la génération reste entièrement locale.

**`frontend/.env`**

```
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_APP_NAME=Restoflow
```

Les `.env` sont **ignorés par git** ; seuls les `.env.example` sont versionnés.

## 4. Scripts

Liste exhaustive et à jour : [API.md → Scripts npm](API.md#3-scripts-npm).

Essentiels :

| Commande | Effet |
| --- | --- |
| `cd backend && npm run dev` | API + WebSocket en watch |
| `cd backend && npm test` | Tests unitaires (Vitest) |
| `cd backend && npm run test:integration` | Tests d'intégration (base `.env.test`) |
| `cd backend && npm run prisma:studio` | Explorateur de base Prisma |
| `cd backend && npm run create-superadmin` | Crée un super-admin |
| `cd frontend && npm run dev` | Serveur Vite |
| `cd frontend && npm test` | Tests front (Vitest + Testing Library) |
| `cd frontend && npm run build` | Build production (type-check + Vite) |
| `node scripts/sync-docs.mjs` | Régénère la doc auto (modèles, migrations, routes, scripts) |

## 5. Tests

- **Backend** : Vitest (`src/__tests__/`), Supertest pour le smoke API ; intégration via base
  dédiée (`.env.test`, `vitest.integration.config.ts`).
- **Frontend** : Vitest + @testing-library/react (jsdom), incluant les helpers d'auth et le mode
  offline. E2E Playwright smoke (`smoke.mjs`) pour le reload propriétaires (cf. fix JWT UTF-8).

## 6. Base de données : migrations

- Modifier `backend/prisma/schema.prisma`, puis `npm run prisma:migrate` (crée une migration).
- En production : `npm run prisma:deploy` (applique les migrations en attente).
- **Après toute migration**, régénérer la doc : `node scripts/sync-docs.mjs`.

## 7. Déploiement (production)

- **Backend + PostgreSQL** : **Railway**.
- **Frontend** : **Vercel**.
- **Seed prod** : manuel via `DATABASE_PUBLIC_URL` (voir mémoire `deployment-topology`).
- Renseigner les variables : `DATABASE_URL`, secrets JWT, `CORS_ORIGIN`, `APP_BASE_URL`,
  `VITE_API_URL`, `VITE_WS_URL`.

## 8. Workflow de contribution

1. Brancher depuis `main` (`feat/...`, `docs/...`, `fix/...`).
2. Développer en **TDD** quand c'est pertinent (logique métier critique : commandes, stock, paie).
3. **Commits conventionnels** (`feat(...)`, `fix(...)`, `docs(...)`).
4. **Mettre à jour la documentation** (voir [MAINTENANCE-DOC.md](MAINTENANCE-DOC.md)).
5. Spec + plan des grosses fonctionnalités dans `docs/superpowers/`.
