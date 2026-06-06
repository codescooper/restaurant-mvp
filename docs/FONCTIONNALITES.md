# Fonctionnalités — Restoflow

## 1. Rôles & accès

| Rôle | Écrans accessibles |
| --- | --- |
| **Propriétaire** | Tout (Dashboard, Admin/Gestion, Caisse, Salle, Service, Cuisine) |
| **Administrateur** | Dashboard, Admin/Gestion, Caisse, Salle, Service, Cuisine |
| **Caissier** | Caisse, Salle, Service, Dashboard |
| **Serveur** | Caisse, Salle, Service |
| **Cuisinier** | Cuisine (KDS) |
| **Super-admin** | Console plateforme (`/super-admin`) : restaurants, contenu, demandes de catalogue |

Le contrôle d'accès est appliqué côté backend (par route) **et** côté frontend
(`ProtectedRoute` + `allowedRoles`).

## 2. Parcours d'une commande

```
Caisse / Serveur  →  Cuisine                →  Service          →  Caisse
(prise + envoi)      (Commencer → Terminer)    (Marquer servie)    (encaisser l'addition)
   commandée      →   en_cours → prête      →   servie          →   payée → table libérée
```

Le **stock est décrémenté automatiquement** dès la création de la commande, et chaque étape est
diffusée en **temps réel** (WebSocket).

## 3. Modules

### Caisse (POS) — `/caisse`
Menu filtrable, panier, réductions (% ou montant, plafonnées par réglage), paiements **espèces /
mobile money / carte**, **paiements mixtes** (`OrderPayment`), pourboires, **reçu imprimable**
thermique configurable **58/80 mm** (nom + logo du resto, rendu noir & blanc lisible).
Fonctionne **hors-ligne** (cache menu + file de synchro).

### Cuisine (KDS) — `/cuisine`
Réception des commandes en temps réel, statuts séquentiels (commandée → en cours → prête), temps
écoulé par ticket, **alerte sonore** à l'arrivée.

### Salle & Service — `/salle`, `/service`
Plan de salle (tables : libre / occupée / addition demandée / réservée), commande rattachée à une
table, **réservations** avec durée, **pré-commande**, **acompte** (encaissement, règlement,
remboursement), **addition différée** réglée à la caisse.

### Stock & Inventaire
Articles de stock avec **coût unitaire**, **recettes** par plat et par **variante** de plat,
décrément automatique à la vente, **alertes de seuil**, historique des **mouvements**,
**inventaire physique** (comptage vs système, lignes d'écart).

### Achats & Fournisseurs
Fiches **fournisseurs**, **achats** avec suivi des paiements, mise à jour du coût unitaire du stock.

### Budget d'approvisionnement — `/budget`
Génère une **proposition de budget d'approvisionnement** : on saisit un **budget cible** et un
**% de réserve stratégique**, le programme **répartit** le budget d'exploitation entre les postes
(Cuisine, Épicerie, Emballages, Entretien, Bières, Softs, Vins & Spiritueux…) à partir de trois
signaux — **historique d'achats**, **rotation des ventes** (recettes × commandes) et **stock sous
seuil** — puis **suggère les postes non anticipés** (gaz, eau/électricité, transport, maintenance).
Moteur de calcul **déterministe** (testé), avec une **couche IA Claude optionnelle** qui enrichit
les suggestions et rédige la conclusion (désactivée proprement sans `ANTHROPIC_API_KEY`).
Propositions **sauvegardées et rééditables**, **suivi budget vs achats réels** par poste, **export
PDF/CSV**. Le regroupement par poste s'appuie sur le champ `budgetCategory` de chaque article de stock.
Réservé au **propriétaire / administrateur**.

### Paie & CNPS
Fiche **employé** (situation matrimoniale, date de naissance), **cotisations ajustables**
(retraite, prestations familiales, maternité, accident du travail, CMU), **bulletins de paie**,
**barème ITS** (désactivé par défaut, à confirmer DGI), **déclaration DISA** (export CNPS).
Barèmes par défaut : voir mémoire `cnps-its-rates-ci`.

### Dépenses & Promotions
**Dépenses** d'exploitation hors stock (par catégorie). **Promotions** : happy hours et
**coupons** (% ou montant).

### Dashboard & Statistiques — `/dashboard`
KPIs, ventes par heure, top plats, répartition des modes de paiement, **exports PDF / CSV**.

### Plateforme & contenu
- **Onboarding (P2a)** : inscription publique, **invitations** d'équipe (`/invite/:token`),
  **mode simulation**, console **super-admin**.
- **Branding (P2b)** : couleurs (primaire/accent/fond), logo, couverture, fond, WhatsApp —
  stockés en *data URL* dans `app_settings`.
- **Contenu** : articles / blog (`/blog`, `/blog/:slug`) et **success stories**
  (`/success-stories`).
- **Page publique restaurant** : `/r/:slug`.
- **Annuaire / catalog-requests** : demandes de référencement sur plateformes de livraison.

### Paramètres
Onglet centralisé : **PIN manager**, **plafond de réduction**, **nom du restaurant**,
**largeur du ticket** (58/80 mm), aperçu et impression du ticket.

## 4. États de restaurant / membre
Écrans dédiés lorsque l'accès est restreint : `/suspended`, `/rejected`, `/pending-member`,
`/unauthorized` — pilotés par le statut du restaurant et du `Membership`.

## 5. Aide en application

Guides du centre d'aide intégré (`/aide`). **Liste générée automatiquement** depuis
`frontend/src/help/manifest.ts` — ne pas éditer à la main.

<!-- AUTO:HELP:START -->
> 13 guides disponibles dans le centre d'aide (`/aide`).

| Guide | Titre | Rôles |
| --- | --- | --- |
| `premiers-pas` | Premiers pas | tous |
| `caisse` | Encaisser à la caisse | propriétaire, administrateur, caissier, serveur |
| `salle-service` | Salle, tables & réservations | propriétaire, administrateur, caissier, serveur |
| `cuisine` | Écran cuisine (KDS) | propriétaire, administrateur, cuisinier |
| `menu-plats` | Menu, plats & variantes | propriétaire, administrateur |
| `stock-inventaire` | Stock & inventaire | propriétaire, administrateur |
| `employes-depenses-fournisseurs` | Employés, dépenses & fournisseurs | propriétaire, administrateur |
| `paie-cnps` | Paie & CNPS | propriétaire, administrateur |
| `budget-approvisionnement` | Budget d'approvisionnement | propriétaire, administrateur |
| `promotions` | Promotions & coupons | propriétaire, administrateur |
| `dashboard` | Tableau de bord & exports | propriétaire, administrateur, caissier |
| `parametres-equipe` | Paramètres & gestion de l'équipe | propriétaire, administrateur |
| `hors-ligne-pwa` | Mode hors-ligne & installation | tous |
<!-- AUTO:HELP:END -->
