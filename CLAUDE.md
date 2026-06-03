# Restoflow — Instructions projet

Application web full-stack de gestion de restaurant : **multi-tenant**, **temps réel** (Socket.io),
**hors-ligne** (PWA). Cible : restaurants de Côte d'Ivoire (FCFA, paie CNPS/ITS).
Backend Express/Prisma/PostgreSQL ; frontend React/Vite/Tailwind.

📖 Documentation de référence : [`docs/`](docs/README.md) — commencer par [`docs/BILAN.md`](docs/BILAN.md).

## Conventions

- **Commits conventionnels** : `feat(scope): …`, `fix(...)`, `docs(...)`. Brancher depuis `main`.
- **Montants en entiers FCFA** (jamais de centimes) ; quantités de stock en flottants 2 décimales.
- **Énumérations métier en français accentué** (rôles, statuts) — définies dans
  `backend/src/constants.ts`, validées par Zod. Ne pas désaccentuer.
- **Logique métier critique** (commandes, stock, paie) dans des **transactions Prisma**, testée
  (Vitest). Privilégier le **TDD**.
- Modèle de données : modifier `backend/prisma/schema.prisma` puis `npm run prisma:migrate`.
- Multi-tenant : toute entité opérationnelle porte `restaurantId` ; routes scopées via
  `authenticate → tenantContext → requireActiveRestaurant`.

## Documentation — à faire à la fin de toute tâche modifiant le code

C'est **obligatoire** et fait partie de « la tâche est terminée » :

1. Si le **schéma Prisma**, les **routes** (`backend/src/routes/index.ts`) ou les **scripts npm**
   ont changé → lancer **`node scripts/sync-docs.mjs`** (régénère les blocs `AUTO:*`).
2. Mettre à jour les fichiers **rédigés** concernés :
   - nouvelle fonctionnalité / comportement → [`docs/FONCTIONNALITES.md`](docs/FONCTIONNALITES.md) ;
   - changement d'architecture → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ;
   - changement d'installation/env/déploiement → [`docs/DEVELOPPEMENT.md`](docs/DEVELOPPEMENT.md) ;
   - avancement notable → [`docs/BILAN.md`](docs/BILAN.md) (sections Livré / En cours / À venir).
   - module dont l'usage change → mettre à jour son guide d'aide
     `frontend/src/help/guides/<module>.md` (centre d'aide `/aide`).
3. Ajouter une entrée dans [`CHANGELOG.md`](CHANGELOG.md) (section « Non publié »).
4. `git add docs/ CHANGELOG.md` avant le commit.

Détail du mécanisme : [`docs/MAINTENANCE-DOC.md`](docs/MAINTENANCE-DOC.md).
Ne jamais éditer à la main le contenu entre `<!-- AUTO:CLE:START -->` et `<!-- AUTO:CLE:END -->`.

## Tests

- Backend : `cd backend && npm test` (unitaires) ; `npm run test:integration` (base `.env.test`).
- Frontend : `cd frontend && npm test`.
