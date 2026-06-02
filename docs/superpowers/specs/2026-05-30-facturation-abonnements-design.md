# Design — Facturation & Abonnements (monétisation Restoflow)

> Date : 2026-05-30
> Statut : validé (brainstorming) — prêt pour planification
> Branche de travail : `feat/facturation-abonnements` (isolée, travail concurrent en cours sur une autre branche)
> Application concernée : Restoflow (backend Express/Prisma/Postgres, frontend React/Vite, temps réel Socket.io)

## 1. Objectif

Doter la plateforme multi-tenant Restoflow d'un système de **facturation par abonnement** permettant de **monétiser** l'accès au logiciel :

- chaque **restaurant** souscrit à un **palier** (plan) tarifé en **FCFA (XOF)** ;
- l'encaissement se fait par **Mobile Money** via un agrégateur (**CinetPay**), avec confirmation par **webhook** ;
- le recouvrement est **« soft »** : sur impayé on **relance** (bannières + rappels) mais on **ne coupe jamais l'accès automatiquement** ; seule la suspension manuelle par le super-admin existe déjà (`Restaurant.status='suspended'`) ;
- le super-admin pilote les plans, les abonnements et les paiements (y compris **marquage manuel** d'un paiement hors-ligne) ;
- le palier haut **valorise le différenciateur unique** : le module **Paie & CNPS**.

## 2. Décisions de cadrage (validées)

| Sujet | Décision | Alternatives écartées |
|---|---|---|
| **Entité facturée** | **Par restaurant** (un proprio multi-restos paie un abonnement par resto) | Par compte propriétaire (incompatible avec l'isolation actuelle par `restaurantId`) |
| **Modèle tarifaire** | **3 paliers** (Essentiel / Pro / Business) | Forfait unique (laisse de l'argent sur la table) ; par module (metering complexe) ; freemium (3 restos prod déjà à monétiser) |
| **Encaissement** | **Mobile Money automatisé via CinetPay** (Orange/MTN/Moov/Wave + carte), confirmation par webhook | Stripe (faible pénétration carte en CI) ; manuel pur (pas de recouvrement scalable) |
| **Récurrence** | **Facture par cycle + lien de paiement à valider** par le proprio (push Mobile Money). **Pas** de prélèvement automatique silencieux | « Card-on-file » auto-débit (non supporté par les agrégateurs Mobile Money) |
| **Recouvrement** | **Soft** : `Subscription.status='past_due'` + bannière de rappel ; **`Restaurant.status` jamais modifié automatiquement** | Suspension automatique sur échéance |
| **Gating des modules premium** | **Reporté en phase 2** (soft d'abord) — minimise les conflits avec le code en cours sur l'autre branche | Gating dur dès la phase 1 |
| **Devise** | **XOF (FCFA)** | — |
| **Remise annuelle** | **~15 %** sur l'engagement annuel | — |

## 3. Tarification (paliers)

Benchmark marché CI (FCFA/mois) : Treka Manager 7 900 / 15 998 / 35 000 ; MenuPro 9 900 / 25 000. Le marché segmente par *établissements + comptes + modules*, avec remise annuelle 10–35 %.

| Palier | Prix indicatif /mois | Contenu | Limite comptes |
|---|---|---|---|
| **Essentiel** | ~9 000 FCFA | Caisse, KDS, stock, salle/service, stats de base | ~3 |
| **Pro** ⭐ | ~18 000 FCFA | + paiement mixte, page publique `/r/:slug` + commande WhatsApp, exports, stats avancées | ~8 |
| **Business** | ~32 000 FCFA | + module **Paie & CNPS** (bulletins, DISA), Annuaire/référencement, support prioritaire | ~8+ |

> Les prix et limites exacts sont **paramétrables en base** (table `SubscriptionPlan`) et **non figés dans le code** : le super-admin peut les ajuster sans déploiement. Les valeurs ci-dessus sont les **défauts du seed**.

## 4. Architecture — modèle de données

4 nouvelles entités. Les 3 entités liées à un restaurant portent `restaurantId` et passent par l'**isolation Prisma existante (stratégie A)**. `SubscriptionPlan` est un **catalogue global** (non-tenant) géré par le super-admin via le client non-scopé.

```
SubscriptionPlan            (global, géré super-admin)
  id, code (unique: 'essentiel'|'pro'|'business'), name,
  priceMonthly (Int, FCFA), priceYearly (Int, FCFA),
  maxUsers (Int?), features (Json — drapeaux modules: paie_cnps, annuaire, ...),
  isActive (Boolean), sortOrder (Int), createdAt, updatedAt

Subscription                (tenant — 1 par restaurant)
  id, restaurantId (unique), planId,
  status: 'trialing' | 'active' | 'past_due' | 'canceled',
  billingCycle: 'monthly' | 'yearly',
  currentPeriodStart, currentPeriodEnd,
  trialEndsAt (DateTime?), canceledAt (DateTime?),
  createdAt, updatedAt
  @@unique([restaurantId])

SubscriptionInvoice         (tenant)
  id, restaurantId, subscriptionId,
  amount (Int, FCFA), currency ('XOF'),
  periodStart, periodEnd, dueDate,
  status: 'pending' | 'paid' | 'void',
  issuedAt, paidAt (DateTime?), createdAt
  @@index([restaurantId, status])

SubscriptionPayment         (tenant — tentatives/règlements)
  id, restaurantId, invoiceId,
  provider: 'cinetpay' | 'manual',
  providerTxId (String?, unique nullable), method (String?: 'orange_money'|'mtn'|'moov'|'wave'|'card'|'cash'),
  amount (Int), status: 'initiated' | 'succeeded' | 'failed',
  rawPayload (Json?), recordedBy (Int? — super-admin si manuel),
  createdAt, updatedAt
  @@index([restaurantId]) @@index([invoiceId])
```

**Conventions respectées** (cf. schéma existant) : valeurs catégorielles en `String`/`VarChar`, `@map` snake_case, montants entiers en FCFA (pas de centimes), index `[restaurantId, status]`, relations vers `Restaurant` ajoutées dans le bloc `Restaurant {}`.

**Distinction importante** : ces entités sont **la facturation plateforme** (Restoflow → restaurant) et n'ont **aucun rapport** avec `OrderPayment` (paiement client → restaurant en caisse). Nommage explicite `Subscription*` pour éviter toute confusion.

## 5. Flux d'encaissement (CinetPay)

### 5.1 Cycle nominal

1. **Génération de facture** : à l'approche de `currentPeriodEnd`, création d'une `SubscriptionInvoice` (`status='pending'`, `dueDate`). **Phase 1** : génération **à la demande / au login** du proprio (calcul paresseux). **Phase 2** : bascule vers un **cron planifié** (cf. §12).
2. **Initiation paiement** : le proprio ouvre l'onglet « Abonnement » et clique *Payer* → backend appelle l'**API CinetPay** (`/payment` init) avec `transaction_id`, `amount`, `currency='XOF'`, `notify_url`, `return_url` → crée une `SubscriptionPayment` (`status='initiated'`) → renvoie l'URL de paiement CinetPay.
3. **Paiement** : le proprio règle en Mobile Money (validation du push sur son téléphone) sur la page hébergée CinetPay.
4. **Confirmation webhook** : CinetPay appelle `POST /api/billing/webhook/cinetpay` (`notify_url`). Le backend **re-vérifie le statut** via l'API CinetPay (`/payment/check`, source de vérité — jamais se fier au seul payload), puis :
   - `SubscriptionPayment.status='succeeded'`, `providerTxId` renseigné, `rawPayload` stocké ;
   - `SubscriptionInvoice.status='paid'`, `paidAt` ;
   - `Subscription` : `currentPeriodEnd` prolongé d'un cycle, `status='active'`.
5. **Idempotence** : le webhook peut arriver plusieurs fois → traitement **idempotent** sur `providerTxId` / `transaction_id`.

### 5.2 Paiement manuel (super-admin)

Le super-admin enregistre un règlement reçu hors-ligne (Mobile Money direct, cash, virement) : crée une `SubscriptionPayment` (`provider='manual'`, `recordedBy`), passe la facture en `paid`, prolonge l'abonnement. Mêmes effets que 5.1.4.

### 5.3 Essai & impayé (soft)

- À la **première souscription** : `status='trialing'`, `trialEndsAt` (ex. +14 j, paramétrable). Pendant l'essai, accès complet.
- **Échéance non réglée** : `Subscription.status='past_due'` → **bannière de rappel** dans l'app (proprio/admin) + relance affichée dans la console super-admin. **`Restaurant.status` reste inchangé.**
- **Suspension** : uniquement **manuelle** par le super-admin (mécanisme existant), si nécessaire.

## 6. API (endpoints)

**Côté restaurant (proprio/administrateur, scoping tenant)**
- `GET /api/billing/subscription` → abonnement courant + plan + prochaine échéance.
- `GET /api/billing/invoices` → historique des factures du restaurant.
- `GET /api/billing/plans` → catalogue des plans actifs (pour changer de palier).
- `POST /api/billing/invoices/:id/pay` → initie un paiement CinetPay, renvoie l'URL.
- `POST /api/billing/subscription/change-plan` → demande de changement de palier (applicable au prochain cycle).

**Webhook (public, signature/vérification CinetPay)**
- `POST /api/billing/webhook/cinetpay` → confirmation de paiement (re-check côté serveur, idempotent).

**Super-admin (`isSuperAdmin`, client non-scopé)**
- `GET /api/admin/billing/subscriptions` → tous les abonnements (filtres status).
- `GET /api/admin/billing/plans` / `POST` / `PUT /:id` → CRUD catalogue de plans.
- `POST /api/admin/billing/subscriptions/:id/record-payment` → paiement manuel.
- `POST /api/admin/billing/subscriptions/:id/set-plan` → forcer un plan.

## 7. Surfaces front

- **Onglet « Abonnement »** (proprio/administrateur) : plan actuel + cycle, prochaine échéance, **bouton Payer**, historique des factures (statut, montant, date), changement de palier. **Bannière de rappel** globale si `past_due`.
- **Section « Facturation »** dans la console super-admin : liste des abonnements (resto, plan, statut, échéance), gestion du catalogue de plans, **enregistrer un paiement manuel**, relancer.

## 8. Configuration & variables d'environnement

Nouvelles variables backend :
- `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY` (vérification webhook).
- `BILLING_TRIAL_DAYS` (défaut 14).
- `APP_BASE_URL` (déjà identifié comme manquant en prod) — utilisé pour `return_url`/liens.

Pas de nouvelle topologie de déploiement (Railway back + Postgres, Vercel front).

## 9. Migration & seed

- Migration Prisma : 4 tables + relations + index + colonnes `restaurantId`. **Aucune modification destructive** des tables existantes.
- Seed des **3 plans par défaut** (Essentiel/Pro/Business) avec prix et `features`.
- **Backfill** : créer une `Subscription` pour les **restaurants actifs existants** (3 en prod) en `trialing` (ou plan offert défini avec le métier), pour ne couper personne.

## 10. Tests & critères de succès

**Tests :**
- **Isolation** : un restaurant ne voit jamais les `Subscription`/`Invoice`/`Payment` d'un autre (suite d'isolation existante étendue aux 3 tables tenant).
- **Flux paiement** : init → webhook `succeeded` → facture `paid` + période prolongée ; webhook **idempotent** (rejouer ne double pas) ; webhook avec re-check échoué → pas de validation.
- **Paiement manuel** : super-admin marque payé → mêmes effets ; non-super-admin interdit (403).
- **Soft enforcement** : facture échue → `past_due` ; **`Restaurant.status` inchangé** (test explicite anti-régression).
- **Plans** : CRUD super-admin, validation des montants/`features` ; changement de palier appliqué au prochain cycle.

**Critères de succès :**
- Un restaurant peut consulter son abonnement, payer une facture en Mobile Money et voir sa période prolongée automatiquement après confirmation CinetPay.
- Le super-admin peut créer/ajuster des plans, voir tous les abonnements et enregistrer un paiement manuel.
- Sur impayé, aucun accès n'est coupé automatiquement ; seules des relances s'affichent.
- Aucune fuite de données de facturation entre restaurants.

## 11. Risques & parades

| Risque | Parade |
|---|---|
| Webhook usurpé / payload non fiable | **Re-check serveur** via API CinetPay + vérification de signature ; jamais valider sur le seul payload |
| Webhook rejoué (double crédit) | Traitement **idempotent** sur `transaction_id`/`providerTxId` |
| Conflits avec le travail concurrent (autre branche) | Tables **nouvelles** + endpoints **isolés** ; **gating reporté en phase 2** ; pas de refactor de l'existant |
| Pas d'auto-débit Mobile Money | Modèle **facture + lien à valider** + relances ; assumé par le choix « soft » |
| Restos existants coupés par erreur | Backfill en `trialing`/plan offert ; `Restaurant.status` jamais touché automatiquement |
| Frais CinetPay (1,5–3,5 %) sur petits montants | Négligeable aux prix paliers (≤ ~1 100 FCFA sur 32 000) ; pris en compte dans le pricing |

## 12. Hors périmètre (phase 2+)

- **Gating dur** des modules premium selon le plan (ex. Paie/CNPS réservé Business) — soft d'abord.
- Génération automatique des factures par **cron planifié** (phase 1 peut générer à la demande / au login) si non couvert.
- Relances **par email/WhatsApp automatiques** (dépend de l'envoi d'emails, lui-même hors périmètre actuel).
- Proration fine lors d'un changement de palier en cours de cycle.
- Multi-devise, facturation par compte propriétaire, codes promo/coupons.

## 13. Découpage indicatif (pour le plan d'implémentation)

1. **Schéma & migration** : 4 tables + relations + seed des plans + backfill restos actifs.
2. **Service & API restaurant** : lecture abonnement/factures/plans (scoping tenant + tests d'isolation).
3. **Intégration CinetPay** : init paiement + webhook idempotent + re-check (tests).
4. **API & console super-admin** : CRUD plans, liste abonnements, paiement manuel.
5. **Front** : onglet Abonnement (proprio) + bannière `past_due` + section Facturation (super-admin).
6. **Soft enforcement** : transitions de statut (`trialing`/`active`/`past_due`) sans toucher `Restaurant.status`.
