# API & scripts — Restoflow

L'API REST est servie sous le préfixe **`/api`** (Express). Réponses normalisées :
`{ success: true, data }` ou `{ success: false, error: { code, message } }`.
Le temps réel passe par **Socket.io** (mêmes origines, rooms par rôle).

> **Les tableaux ci-dessous sont générés automatiquement** par `node scripts/sync-docs.mjs`
> depuis `backend/src/routes/index.ts` et les `package.json`. Ne les éditez pas à la main.

## 1. Groupes de routes

<!-- AUTO:ROUTES:START -->
> 22 groupes de routes montés sous `/api` (voir `backend/src/routes/index.ts`).
> Les routes « multi-tenant » passent par `authenticate → tenantContext → requireActiveRestaurant`.

| Préfixe | Portée |
| --- | --- |
| `/api/auth` | Public (authentification) |
| `/api/public` | Public |
| `/api/admin` | Super-admin |
| `/api/stock` | Authentifié + multi-tenant |
| `/api/dishes` | Authentifié + multi-tenant |
| `/api/users` | Authentifié + multi-tenant |
| `/api/orders` | Authentifié + multi-tenant |
| `/api/tables` | Authentifié + multi-tenant |
| `/api/stats` | Authentifié + multi-tenant |
| `/api/notifications` | Authentifié + multi-tenant |
| `/api/sync` | Authentifié + multi-tenant |
| `/api/cash` | Authentifié + multi-tenant |
| `/api/audit` | Authentifié + multi-tenant |
| `/api/suppliers` | Authentifié + multi-tenant |
| `/api/employees` | Authentifié + multi-tenant |
| `/api/payroll` | Authentifié + multi-tenant |
| `/api/expenses` | Authentifié + multi-tenant |
| `/api/inventory` | Authentifié + multi-tenant |
| `/api/promotions` | Authentifié + multi-tenant |
| `/api/settings` | Authentifié + multi-tenant |
| `/api/invitations` | Public |
| `/api/catalog-requests` | Public |
<!-- AUTO:ROUTES:END -->

`GET /api/health` renvoie l'état du service. Une route inconnue sous `/api` renvoie un 404 normalisé.

## 2. Conventions

- **Authentification** : header `Authorization: Bearer <accessToken>` ; refresh via `/api/auth`.
- **Multi-tenant** : le restaurant actif est porté par le JWT ; les routes « multi-tenant »
  exigent un restaurant actif (`requireActiveRestaurant`).
- **Validation** : schémas **Zod** (`backend/src/validators/`). Erreurs gérées par `errorHandler`.
- **Exports** : PDF (pdfkit) et CSV pour le dashboard et la paie (DISA).

## 3. Scripts npm

<!-- AUTO:SCRIPTS:START -->
**Backend (`cd backend`)**

| Script | Commande |
| --- | --- |
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | `tsc` |
| `npm run start` | `node dist/server.js` |
| `npm run prisma:generate` | `prisma generate` |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` |
| `npm run prisma:studio` | `prisma studio` |
| `npm run seed` | `tsx prisma/seed.ts` |
| `npm run create-superadmin` | `tsx prisma/create-superadmin.ts` |
| `npm run create-demo-restaurant` | `tsx prisma/create-demo-restaurant.ts` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run test:integration` | `dotenv -e .env.test -- vitest run --config vitest.integration.config.ts` |
| `npm run test:integration:setup` | `dotenv -e .env.test -- prisma migrate deploy` |
| `npm run type-check` | `tsc --noEmit` |

**Frontend (`cd frontend`)**

| Script | Commande |
| --- | --- |
| `npm run dev` | `vite` |
| `npm run build` | `tsc && vite build` |
| `npm run preview` | `vite preview` |
| `npm run lint` | `eslint . --ext ts,tsx` |
| `npm run type-check` | `tsc --noEmit` |
| `npm run test` | `vitest run` |
<!-- AUTO:SCRIPTS:END -->
