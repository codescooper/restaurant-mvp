# Bilan du projet — Restoflow

> Synthèse de l'état d'avancement. Date de référence : **3 juin 2026**.
> Les indicateurs chiffrés ci-dessous sont régénérés automatiquement depuis le code.

## 1. Vue d'ensemble

**Restoflow** est une application SaaS de gestion de restaurant, **multi-tenant** (plusieurs
restaurants sur une même instance), **temps réel** (WebSocket) et **hors-ligne** (PWA + file de
synchronisation). Elle couvre l'exploitation quotidienne (caisse, cuisine, salle/service, stock),
la gestion (menu, employés, paie CNPS, dépenses, fournisseurs, inventaire), le pilotage
(dashboard, exports) et la plateforme (onboarding, super-admin, contenu, personnalisation).

Cible métier : restaurants de **Côte d'Ivoire** (montants en FCFA, paie conforme CNPS/ITS).

## 2. Indicateurs

<!-- AUTO:STATS:START -->
| Indicateur | Valeur |
| --- | --- |
| Modèles de données (Prisma) | 35 |
| Migrations appliquées | 28 |
| Groupes de routes API | 23 |
| Contrôleurs backend | 25 |
| Services backend | 28 |
| Pages frontend (.tsx) | 36 |
<!-- AUTO:STATS:END -->

## 3. Modules livrés ✅

| Module | Description |
| --- | --- |
| **Socle multi-tenant** | Restaurants isolés, `Membership` (user × restaurant × rôle), contexte tenant injecté par middleware |
| **Authentification** | JWT access + refresh, bcrypt, rate-limiting, 5 rôles (propriétaire, administrateur, caissier, cuisinier, serveur) |
| **Onboarding (P2a)** | Inscription publique, invitations d'équipe, console super-admin, mode simulation |
| **Caisse (POS)** | Menu filtrable, panier, réductions (%/montant), paiements (espèces, mobile money, carte), paiements mixtes, reçu imprimable thermique 58/80 mm |
| **Cuisine (KDS)** | Réception temps réel, statuts séquentiels, temps écoulé, alerte sonore |
| **Salle & Service** | Plan de salle, tables, réservations (pré-commande, acompte, remboursement), addition différée |
| **Stock** | Recettes par plat (+ variantes), décrément automatique, alertes de seuil, mouvements, inventaire physique |
| **Achats & Fournisseurs** | Fournisseurs, achats, suivi des paiements, coût unitaire du stock |
| **Budget d'approvisionnement** | Répartition assistée d'un budget cible (+ réserve) via historique d'achats / rotation / seuils ; moteur déterministe + couche IA Claude optionnelle ; sauvegarde, suivi budget vs réel, export PDF/CSV |
| **Paie & CNPS** | Fiche employé, cotisations ajustables (retraite, prest. familiales, accident, CMU), bulletins, déclaration DISA |
| **Dépenses** | Charges d'exploitation hors stock, par catégorie |
| **Promotions** | Happy hours, coupons (% / montant) |
| **Dashboard** | KPIs, ventes par heure, top plats, modes de paiement, exports PDF/CSV |
| **Temps réel** | Socket.io, rooms par rôle |
| **Hors-ligne (PWA caisse)** | Shell offline, cache menu (IndexedDB/Dexie), file de synchronisation idempotente, installabilité, bandeau de mise à jour |
| **Plateforme / Contenu** | Branding par restaurant (couleurs, logo, couverture), articles/blog & success stories, page publique restaurant `/r/:slug`, annuaire/catalog-requests |
| **Paramètres** | Onglet centralisé (PIN manager, plafond de réduction, nom du resto, largeur ticket, aperçu/impression) |

## 4. En cours / cadré (specs & plans rédigés)

| Sujet | État | Référence |
| --- | --- | --- |
| **Facturation & abonnements** | Spec + plan rédigés (backend TDD + cadrage frontend), via Mobile Money / CinetPay | `docs/superpowers/specs/2026-05-30-facturation-abonnements-design.md` |
| **CI GitHub Actions** | Spec + plan rédigés (tests front + back, sans blocage) — workflow non encore créé | `docs/superpowers/plans/2026-06-02-ci-github-actions.md` |

## 5. À venir / pistes

- Module CNPS étendu (suite de la paie) et confirmation du barème ITS (DGI).
- Intégrations plateformes de livraison (Yango, Glovo, Uber Eats) via les *catalog-requests*.
- Variable d'environnement `APP_BASE_URL` à finaliser côté prod (liens d'invitation/partage).

## 6. Déploiement (production)

- **Backend + PostgreSQL** : Railway.
- **Frontend** : Vercel.
- **Données** : seed manuel via `DATABASE_PUBLIC_URL`.
- État prod : 3 restaurants (La Table d'Or, Yeble, Bistrot Démo) + super-admin.

Détails dans [DEVELOPPEMENT.md](DEVELOPPEMENT.md).

## 7. Dette & points d'attention

- **CI absente** : pas encore de `.github/workflows/` (cadré, non implémenté). Les tests existent
  (Vitest front + back, intégration) mais ne tournent pas automatiquement.
- **Barème ITS** désactivé par défaut (à confirmer avec la DGI) — voir `backend/src/constants.ts`.
- **Branding** stocké en *data URL* en base (pas de stockage objet type Cloudinary) — simple mais
  alourdit les lignes `app_settings`.
