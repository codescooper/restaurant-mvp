# Maintenir la documentation à jour

Cette documentation est conçue pour **rester synchronisée avec le code à chaque modification ou
ajout de fonctionnalité**. Le mécanisme combine trois niveaux : génération automatique, garde-fou
git, et règles pour l'assistant.

## 1. Deux types de contenu

| Type | Exemples | Mise à jour |
| --- | --- | --- |
| **Généré** (source de vérité = le code) | modèles de données, migrations, groupes de routes API, scripts npm, indicateurs du bilan | **Automatique** via `scripts/sync-docs.mjs` |
| **Rédigé** (narratif, décisions) | bilan, architecture, fonctionnalités, guide dev | **Manuel** (par l'humain ou l'assistant) lors du changement |

Les blocs générés sont délimités dans le Markdown par des balises :

```html
<!-- AUTO:CLE:START -->
… contenu régénéré, ne pas éditer …
<!-- AUTO:CLE:END -->
```

Tout ce qui est **hors** de ces balises est rédigé à la main et n'est jamais écrasé.

## 2. Le générateur : `scripts/sync-docs.mjs`

Script Node (aucune dépendance, Node ≥ 18). Il lit le code et réécrit les blocs `AUTO:*` :

| Bloc | Source | Fichier cible |
| --- | --- | --- |
| `AUTO:MODELS` | `backend/prisma/schema.prisma` | `docs/MODELE-DONNEES.md` |
| `AUTO:MIGRATIONS` | `backend/prisma/migrations/` | `docs/MODELE-DONNEES.md` |
| `AUTO:ROUTES` | `backend/src/routes/index.ts` | `docs/API.md` |
| `AUTO:SCRIPTS` | `backend/` & `frontend/package.json` | `docs/API.md` |
| `AUTO:STATS` | comptages (modèles, migrations, routes, contrôleurs, services, pages) | `docs/BILAN.md` |

**Commandes :**

```bash
node scripts/sync-docs.mjs            # régénère les blocs AUTO:* dans docs/
node scripts/sync-docs.mjs --check    # n'écrit rien ; sort en erreur (1) si la doc est obsolète
```

Pour étendre la génération : ajouter un collecteur + un rendu dans le script, poser de nouvelles
balises `<!-- AUTO:CLE:START/END -->` dans le fichier cible, puis relancer.

## 3. Garde-fou git (pré-commit)

Un hook bloque tout commit dont la documentation générée serait périmée.

Le hook est versionné dans `.githooks/pre-commit`. **À activer une fois par clone** :

```bash
git config core.hooksPath .githooks
```

À chaque commit, il lance `node scripts/sync-docs.mjs --check`. Si la doc est obsolète, le commit
échoue avec le rappel de lancer `node scripts/sync-docs.mjs` puis `git add docs/`.

> Le hook se déclenche surtout après une modif du schéma, des routes ou des scripts npm. Pour les
> changements narratifs (nouvelle fonctionnalité décrite en prose), c'est la règle §4 qui s'applique.

## 4. Règle pour l'assistant (Claude Code)

`CLAUDE.md` (racine) contient une section **« Documentation »** qui impose, à la fin de toute tâche
modifiant le code, de :

1. lancer `node scripts/sync-docs.mjs` si le schéma, les routes ou les scripts ont changé ;
2. mettre à jour les fichiers narratifs concernés (`BILAN.md`, `FONCTIONNALITES.md`,
   `ARCHITECTURE.md`, `DEVELOPPEMENT.md`) ;
3. ajouter une entrée au `CHANGELOG.md`.

C'est ce qui assure la mise à jour du contenu **rédigé**, que le générateur ne peut pas deviner.

## 5. Checklist « j'ai ajouté/modifié une fonctionnalité »

- [ ] Schéma Prisma modifié ? → migration créée **et** `node scripts/sync-docs.mjs`.
- [ ] Nouveau groupe de routes ou script npm ? → `node scripts/sync-docs.mjs`.
- [ ] Nouvelle fonctionnalité / changement de comportement ? → mettre à jour `FONCTIONNALITES.md`
      (et `ARCHITECTURE.md` si l'architecture change).
- [ ] Avancement notable ? → mettre à jour `BILAN.md` (sections 3/4/5).
- [ ] **Toujours** : entrée dans `CHANGELOG.md`.
- [ ] `git add docs/ CHANGELOG.md` avant le commit.
