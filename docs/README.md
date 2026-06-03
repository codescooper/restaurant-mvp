# Documentation — Restoflow

Documentation complète de **Restoflow**, application web full-stack de gestion de restaurant
(caisse, cuisine, salle/service, stock, paie, statistiques) multi-tenant et temps réel.

> Le `README.md` à la racine du dépôt reste le point d'entrée « démarrage rapide ».
> Le présent dossier `docs/` contient la documentation de référence détaillée.

## Sommaire

| Document | Contenu |
| --- | --- |
| [BILAN.md](BILAN.md) | **Bilan du projet** : état d'avancement, modules livrés, en cours, à venir |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture technique : stack, multi-tenant, auth, temps réel, hors-ligne |
| [FONCTIONNALITES.md](FONCTIONNALITES.md) | Fonctionnalités par module, rôles et parcours utilisateurs |
| [MODELE-DONNEES.md](MODELE-DONNEES.md) | Modèle de données (modèles Prisma) et historique des migrations |
| [API.md](API.md) | Surface de l'API REST (groupes de routes) et scripts npm |
| [DEVELOPPEMENT.md](DEVELOPPEMENT.md) | Guide de développement : installation, env, tests, déploiement |
| [MAINTENANCE-DOC.md](MAINTENANCE-DOC.md) | **Comment cette documentation se met à jour** à chaque évolution |

## Specs & plans

Les documents de conception (specs) et plans d'implémentation par fonctionnalité vivent dans
[`docs/superpowers/`](superpowers/) (`specs/`, `plans/`, `rapports/`). Ils constituent l'historique
décisionnel ; la documentation de référence ci-dessus en est la synthèse à jour.

## Mise à jour

Certaines sections (modèles, migrations, routes, scripts) sont **générées automatiquement**
depuis le code. Pour les rafraîchir après une modification :

```bash
node scripts/sync-docs.mjs
```

Voir [MAINTENANCE-DOC.md](MAINTENANCE-DOC.md) pour le détail du mécanisme.
