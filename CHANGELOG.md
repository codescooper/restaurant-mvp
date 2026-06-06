# Changelog — Restoflow

Toutes les évolutions notables du projet. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/).
Ajouter une entrée **à chaque modification ou ajout de fonctionnalité** (voir
[docs/MAINTENANCE-DOC.md](docs/MAINTENANCE-DOC.md)).

## [Non publié]

### Ajouté
- Documentation de référence dans `docs/` (bilan, architecture, fonctionnalités, modèle de données,
  API, guide dev) + générateur `scripts/sync-docs.mjs` et hook git de fraîcheur de la doc.
- Centre d'aide utilisateur intégré (`/aide`) : 13 guides Markdown versionnés, filtrés par rôle,
  avec recherche et liens profonds ; validation du manifeste par `sync-docs.mjs`.
- **Module Budget d'approvisionnement** (`/budget`, propriétaire/administrateur) : génération
  automatique d'une proposition de budget (répartition d'un budget cible + réserve stratégique) à
  partir de l'historique d'achats, de la rotation des ventes et des seuils de stock ; moteur de
  calcul **déterministe** (testé Vitest) + **couche IA Claude optionnelle** (suggestions de postes
  non anticipés + conclusion rédigée, dégradation propre sans `ANTHROPIC_API_KEY`). Sauvegarde des
  propositions (tables `Budget`/`BudgetSection`/`BudgetPoste`/`BudgetLine`), suivi budget vs achats
  réels, export PDF/CSV. Nouveau champ `StockItem.budgetCategory` pour le regroupement par poste.

## Historique (jalons, d'après l'historique git)

- **2026-06-02** — Spec + plan CI GitHub Actions (tests front + back, sans blocage). *(docs)*
- **2026-06-01** — PWA caisse : shell offline, installabilité, hook `usePwaUpdate`, bandeau de mise
  à jour, icônes Restoflow, idempotence de la synchro hors-ligne.
- **2026-05-30** — Spec + plan facturation & abonnements (Mobile Money / CinetPay). *(docs)*
- **2026-05-29** — Paramètres centralisés ; nom + logo du resto sur le ticket ; largeur ticket 58/80 mm.
- **2026-05-29** — Module Paie & CNPS : fiche employé, cotisations ajustables, bulletins,
  déclaration DISA, date de naissance employé.
- **2026-05-28** — Branding par restaurant (P2b), articles/blog & success stories, page publique
  `/r/:slug`, paiements mixtes (`OrderPayment`), demandes de catalogue.
- **2026-05-27** — Onboarding (P2a) : inscription publique, invitations, super-admin, mode simulation.
- **2026-05-26** — Socle multi-tenant (restaurants, memberships, contexte tenant).
- **≤ 2026-05-24** — Socle MVP : caisse, cuisine (KDS), salle/service, stock, réservations
  (acompte/remboursement), promotions, dépenses, employés, dashboard.
