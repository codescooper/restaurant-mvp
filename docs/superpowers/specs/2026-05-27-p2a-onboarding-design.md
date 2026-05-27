# Design — P2a Onboarding & invitations

> Date : 2026-05-27
> Statut : validé (brainstorming) — prêt pour planification
> S'appuie sur : `docs/superpowers/specs/2026-05-25-plateforme-multitenant-design.md` (P1 multi-tenant en prod).
> Identité visuelle retenue : **hybride Maison Sahel (page publique, P2c) + Operator (admin/interne, P2a/P2b)** — accent + logo du resto font le pont entre les deux mondes. P2a utilisera la direction Operator pour signup, pending, super-admin console, invite.

## 1. Vision & découpage

La plateforme prend des inscriptions publiques de propriétaires. Chaque nouveau restaurant entre en **mode préparation** (statut `pending`) : le proprio a accès complet à l'admin pour monter son resto (plats, tables, équipe, stocks) ET à un **mode simulation** sur les pages opérationnelles (Caisse, Cuisine, Salle, Service) pour expérimenter. Un super-admin (vous, AwemA) valide chaque inscription via une console — **activation** déclenche le **reset des données de simulation** et la restauration des stocks aux valeurs préparées, livrant un restaurant prêt pour sa première journée. Une fois `active`, le proprio invite son équipe via des **liens d'invitation** partagés sur WhatsApp/SMS (acceptation **login-first** pour les emails déjà connus).

La P2 se découpe en 3 sous-projets séquentiels :
- **P2a** *(ce spec)* : onboarding (signup → pending → super-admin → active) + simulation + invitations + écrans statut.
- **P2b** : personnalisation (couleur, logo, cover, background via Cloudinary) — appliquée à l'app interne ET à la page publique.
- **P2c** : page publique `/r/:slug` (hero, menu, disponibilité plats + tables).

## 2. Décisions de cadrage (validées)

| Sujet | Décision | Alternatives écartées |
|---|---|---|
| **Slug** | Auto-généré du nom de resto + suffixe numérique anti-collision ; personnalisable plus tard via admin (P2b ou plus tard) | Saisi par le proprio à l'inscription (friction inutile) |
| **Accès en `pending`** | Gestion + opérationnel **en simulation** ; reset transactionnel à l'activation + restauration des stocks au baseline | Gestion seule (pas de simulation possible) ; tout sans reset (pollution des données) |
| **Rôles invitables** | Tous sauf `propriétaire` (administrateur, caissier, cuisinier, serveur). Le propriétaire reste unique, créé à l'inscription. | Co-propriété (reportée si demandée) |
| **Expiration invitation** | 7 jours fixe ; révocation manuelle à tout moment | 30 jours (trop laxiste) ; configurable (friction) |
| **Acceptation invitation pour email déjà connu** | Login-first : challenge mot de passe avant d'ajouter le Membership | Ajout direct (risque liens fuités) ; email de confirmation (P4) |
| **Cycle de vie super-admin** | `pending → active` ou `rejected` (avec raison) ; `active ↔ suspended` (avec raison) ; pas de hard-delete v1 | Activate/suspend seul (refus implicite invisible) ; + hard-delete (risque cascade) |
| **Anti-spam signup** | Rate limit 3/h par IP via `rateLimit.ts` existant | hCaptcha (P4 si besoin) ; rien (DB encombrée) |
| **Contact AwemA** sur écrans bloquants | WhatsApp `+225 07 07 14 59 59` (message pré-rempli) + email `webmarketingagence@gmail.com` ; stocké en constante frontend | Configurable en env (overkill v1) |

## 3. Modèle de données

### Nouvelles entités

```prisma
model Invitation {
  id            Int       @id @default(autoincrement())
  restaurantId  Int       @map("restaurant_id")
  email         String    @db.VarChar(190)
  role          String    @db.VarChar(20)
  token         String    @unique @db.VarChar(64)
  status        String    @default("pending") @db.VarChar(20)   // 'pending'|'accepted'|'revoked'|'expired'
  expiresAt     DateTime  @map("expires_at")
  createdBy     Int?      @map("created_by")
  acceptedAt    DateTime? @map("accepted_at")
  revokedAt     DateTime? @map("revoked_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Restrict)
  creator    User?      @relation("InvitationCreator", fields: [createdBy], references: [id])

  @@index([restaurantId, status], map: "idx_invitations_restaurant_status")
  @@index([email, status], map: "idx_invitations_email_status")
  @@map("invitations")
}
```

### Ajouts sur entités existantes

- `Restaurant.activatedAt DateTime?` — horodatage d'activation.
- `Restaurant.rejectedReason String?` `@db.Text` + `Restaurant.rejectedAt DateTime?`.
- `Restaurant.suspendedReason String?` `@db.Text` + `Restaurant.suspendedAt DateTime?`.
- `StockItem.baselineQuantity Float?` — quantité « préparée » par le proprio. Mise à jour à chaque édition manuelle ; **non** modifiée par les décréments de commande.
- Relation inverse `Restaurant.invitations Invitation[]`.

### Statuts `Restaurant.status` (élargi)

- `pending` : nouveau, en préparation. Accès admin + opérationnel en simulation. Pas accessible publiquement (P2c).
- `active` : opérationnel. Tous les rôles accèdent normalement. Page publique exposée (P2c).
- `suspended` : suspendu par super-admin. Membres bloqués sur écran statut.
- `rejected` : refusé à l'inscription. Le proprio voit l'écran refus + contact AwemA.

## 4. API

### Endpoints publics (no auth, no tenant context)

- `POST /api/auth/signup`
  - Body : `{ email, password, displayName, restaurantName }`.
  - Validation Zod : email valide, mot de passe ≥6, displayName non vide, restaurantName 1-120 chars.
  - Rate limit : **3 / heure / IP** via `rateLimit.ts`.
  - Crée `User` (email unique global ; rejet 409 si email pris), `Restaurant` (status=pending, slug auto, activatedAt=null), `Membership` (role=propriétaire, isActive=true).
  - Slug : `slugify(restaurantName)` (kebab-case, accents enlevés, max 60 chars) ; en cas de collision, suffixe `-2`, `-3`…
  - Renvoie `{ user, accessToken, refreshToken, memberships }` (auto-login, scope = le nouveau resto).

- `GET /api/public/invitations/:token`
  - Vérifie token existant. Si `expiresAt < now` et status='pending' → marque `expired` lazy.
  - Renvoie `{ restaurantName, role, email, status, expiresAt, emailExists: boolean }`. Pas de détails sensibles (pas d'IDs internes).
  - Status non-`pending` → la page affiche le message correspondant (expiré, déjà accepté, révoqué).

- `POST /api/public/invitations/:token/accept`
  - Variante **email inconnu** : body `{ password, displayName }` → crée `User` + `Membership` (role de l'invitation) → token.status = `accepted` + `acceptedAt`.
  - Variante **email connu** : body `{ password }` (login-first) → vérifie bcrypt → ajoute `Membership` à ce User → token.status = `accepted`.
  - Renvoie `{ user, accessToken, refreshToken, memberships }` (auto-login scopé sur le resto invitant).

### Endpoints tenant authentifiés (proprio + admin)

- `GET /api/invitations` — liste des invitations du resto courant (toutes statuts ; on filtre côté front sur `status='pending'` pour la liste active).
- `POST /api/invitations` — body `{ email, role }` (role ∈ `administrateur`|`caissier`|`cuisinier`|`serveur`). 409 si invitation `pending` existe déjà pour cet email. Génère `token` (random 32 bytes hex), `expiresAt = now + 7j`. Renvoie l'invitation + URL complète (utilise `APP_BASE_URL` env).
- `DELETE /api/invitations/:id` — status=revoked + revokedAt.

### Endpoints super-admin (`isSuperAdmin` requis, pas de tenant context)

Préfixe `/api/admin/*`. Toutes les routes utilisent `basePrisma` (pas de scope tenant).

- `GET /api/admin/restaurants` — liste tous avec : `id, name, slug, status, createdAt, activatedAt, rejectedAt, suspendedAt, rejectedReason, suspendedReason, ownerEmail, ownerName, counts: { dishes, tables, members, invitations }`. Trié par `createdAt desc`. Query param `?status=pending` pour filtrer.
- `POST /api/admin/restaurants/:id/activate` — déclenche le **reset de simulation** (§5) + status=active + activatedAt=now. Renvoie `{ status, deletedCounts: { orders, stockMovements, cashSessions, reservations, notifications, auditLogs } }` pour le récap UI.
- `POST /api/admin/restaurants/:id/suspend` — body `{ reason? }`. status=suspended + suspendedAt + suspendedReason.
- `POST /api/admin/restaurants/:id/reactivate` — depuis `suspended` ou `rejected` → status=active. Pas de reset (les données restent).
- `POST /api/admin/restaurants/:id/reject` — body `{ reason? }`. status=rejected + rejectedAt + rejectedReason. Réservé aux restos en `pending`.

### Modifications endpoints existants

- `/api/auth/me` (déjà existant) renvoie en plus `currentRestaurant: { id, name, slug, status }` pour que le front sache afficher le bandeau pending / l'écran bloquant.
- Middleware **`requireActiveRestaurant`** : nouveau middleware qui, sur les routes opérationnelles (Caisse, Cuisine, Salle, Service), accepte `active` ET `pending` (mode simulation). Les autres routes Gestion acceptent `pending` aussi. **Seuls les écrans `suspended`/`rejected` bloquent vraiment.**

## 5. Logique d'activation (le morceau critique)

### Capture du baseline stock (en cours de pending)

Toute modification manuelle de `StockItem.quantity` met à jour `baselineQuantity` à la nouvelle valeur :

- `stock.service.createStockItem` : `data.baselineQuantity = data.quantity` à la création.
- `stock.service.updateStockItem` : si `data.quantity` est changé, ajouter `baselineQuantity = data.quantity` au update.
- `stock.service.addQuantity(id, qty)` : après l'incrément, set `baselineQuantity = nouveauTotal`.
- `stock.service.recordLoss(id, qty, ...)` : après le décrément, set `baselineQuantity = nouveauTotal`.
- `order.service.createOrder` (décrément stock commande) : **NE modifie PAS** `baselineQuantity`.

### Reset à l'activation

```typescript
// services/admin.service.ts (nouveau)
export async function activateRestaurant(restaurantId: number) {
  return await basePrisma.$transaction(async (tx) => {
    const counts = {
      orders: await tx.order.count({ where: { restaurantId } }),
      stockMovements: await tx.stockMovement.count({ where: { restaurantId } }),
      cashSessions: await tx.cashSession.count({ where: { restaurantId } }),
      reservations: await tx.reservation.count({ where: { restaurantId } }),
      notifications: await tx.notification.count({ where: { restaurantId } }),
      auditLogs: await tx.auditLog.count({ where: { restaurantId } }),
    };
    // Ordre FK : notificationRead → notification, orderItem (cascade Order),
    // stockMovement → standalone, cashSession → standalone, reservationItem (cascade Reservation),
    // auditLog → standalone.
    await tx.notificationRead.deleteMany({
      where: { notification: { restaurantId } },
    });
    await tx.notification.deleteMany({ where: { restaurantId } });
    await tx.stockMovement.deleteMany({ where: { restaurantId } });
    await tx.order.deleteMany({ where: { restaurantId } }); // cascade OrderItem
    await tx.cashSession.deleteMany({ where: { restaurantId } });
    await tx.reservation.deleteMany({ where: { restaurantId } }); // cascade ReservationItem
    await tx.auditLog.deleteMany({ where: { restaurantId } });
    // Restauration stocks
    await tx.$executeRaw`
      UPDATE stock_items
      SET quantity = COALESCE(baseline_quantity, quantity), baseline_quantity = NULL
      WHERE restaurant_id = ${restaurantId}
    `;
    // Activation
    await tx.restaurant.update({
      where: { id: restaurantId },
      data: { status: "active", activatedAt: new Date() },
    });
    return counts;
  });
}
```

L'UI super-admin affiche un récap avant confirmation : *« 12 commandes test, 3 sessions de caisse, 24 mouvements de stock, 8 notifications, 2 réservations test, 47 entrées d'audit seront supprimées. Stock restauré aux valeurs préparées. Continuer ? »*

## 6. Frontend — pages, écrans, garde-fous

### Pages publiques

- **`/signup`** — formulaire 4 champs (email, password, nom, nom du resto) + lien retour login. Direction Operator (sombre, dense, accent teal). Submit → auto-login + redirect vers la racine (le front voit `status: 'pending'` → mode préparation).

- **`/invite/:token`** — appel `GET /api/public/invitations/:token` au mount.
  - Status `pending`, `emailExists: false` → formulaire (password + displayName) + bouton « Accepter et rejoindre ».
  - Status `pending`, `emailExists: true` → message « Vous êtes invité à rejoindre *Chez Fatou* en tant que *serveur*. Connectez-vous pour accepter. » + champ password seul + bouton.
  - Status `expired` → message + lien « Demandez un nouveau lien au propriétaire » + lien `/signup`.
  - Status `revoked` ou `accepted` → message clair + bouton « Aller à la connexion ».

### Garde-fous routing (frontend)

Modification du `ProtectedRoute` :
- `loading` → spinner.
- `!isAuthenticated` → `/`.
- `!hasActiveRestaurant` → `/select-restaurant`.
- `currentRestaurant.status === 'suspended'` → `/suspended`.
- `currentRestaurant.status === 'rejected'` → `/rejected`.
- `currentRestaurant.status === 'pending'` :
  - si rôle propriétaire → autoriser Gestion + opérationnel **avec bandeau simulation**.
  - si autre rôle → `/pending-member` (« Votre restaurant est en préparation, contactez le propriétaire »).
- `currentRestaurant.status === 'active'` + `currentRole` autorisé → enfants.

### Nouveaux composants

- **`/suspended`** et **`/rejected`** — carte centrée Operator avec : icône statut, titre, raison (si saisie), bouton WhatsApp AwemA (URL `wa.me/2250707145959?text=...` avec message contextualisé : *« Bonjour AwemA, je vous contacte au sujet du refus/de la suspension de mon restaurant [Nom]. »*), bouton email, bouton Déconnexion.
- **`/pending-member`** — variante pour membres non-proprio.
- **Bandeau simulation** (composant `<SimulationBanner />`) — affiché en haut des pages opérationnelles quand `currentRestaurant.status === 'pending'` : *« 🧪 Mode préparation — vos commandes test seront effacées à l'activation. »* Avec lien « En savoir plus ».
- **`/admin`** — table responsive, filtres par status, lignes avec badges status + actions contextuelles. Modale de confirmation avant chaque action destructive (activate, suspend, reject) avec récap des conséquences.

### Onglet « Membres » dans Gestion

Refonte de la section utilisateurs existante (`AdminPage` users tab) :
- Liste des memberships actifs (colonnes : Nom, Email, Rôle, Actif, Dernière connexion).
- Section « Invitations en attente » (collapsible) avec : Email, Rôle, Expiration, **bouton « 📋 Copier le lien »** + **bouton WhatsApp** (ouvre WhatsApp avec lien pré-rempli), **bouton « Révoquer »**.
- Bouton **« Inviter un membre »** → modale (email + rôle parmi admin/caissier/cuisinier/serveur). Submit → invitation créée → toast avec le lien + bouton « Copier » et « Envoyer via WhatsApp ».

### Constantes frontend (contact AwemA)

`frontend/src/utils/contact.ts` :
```ts
export const AWEMA_CONTACT = {
  whatsapp: '+2250707145959',
  email: 'webmarketingagence@gmail.com',
  whatsappUrl: (message: string) =>
    `https://wa.me/2250707145959?text=${encodeURIComponent(message)}`,
};
```

## 7. Tests & critères de succès

### Tests unitaires/logique
- `slugify(name)` : cas accents, espaces, caractères spéciaux, longueur.
- Génération token invitation : 32 bytes hex, unique.
- Refinement Zod `signupSchema` : tous les champs valides.

### Tests d'intégration
- **Signup** : 1ère inscription → resto pending + Membership propriétaire ; 2ᵉ inscription même email → 409 ; 4ᵉ inscription depuis même IP en 1h → 429.
- **Activation reset** : créer un resto pending + 3 plats + 1 stock (50kg) + 2 commandes simulation (consommant 5kg) → activation → vérifier : 0 orders, stock = 50 (baseline restauré), status=active.
- **Suspend/reactivate** : suspend → status suspended ; reactivate → status active, données préservées.
- **Reject** : pending → reject avec raison → status=rejected + reason persistée.
- **Invitation lifecycle** : 
  - Créer invitation → token + URL + status pending.
  - GET token → infos publiques + emailExists boolean.
  - Accept (new email) → User + Membership créés + accepted.
  - Accept (existing email, bon password) → Membership créé.
  - Accept (existing email, mauvais password) → 401.
  - Accept token expiré → 410 + lazy mark expired.
  - Accept token révoqué → 410.
  - Re-utiliser token accepté → 410.
- **Isolation super-admin** : un proprio ne peut pas appeler `/api/admin/*` → 403 ; super-admin sans restaurantId scope peut lister tous les restos.

### Critères de succès

- Backend `tsc --noEmit` clean, `npm test` + `npm run test:integration` verts (couvrant nouveaux scénarios).
- Frontend `tsc --noEmit` clean, `npm run build` OK.
- Smoke manuel : inscription nouvelle → bandeau préparation → simulation Caisse → super-admin active → bandeau disparaît, commandes test effacées, stock restauré.
- Smoke invitation : créer invitation → ouvrir lien dans nav privée → accepter (new email) → connecté sur le nouveau resto ; idem pour existing email avec login.

## 8. Risques & points de vigilance

- **Activation irréversible** : le reset supprime des données. UI super-admin doit afficher un récap clair AVANT confirmation. Pas de "undo".
- **Baseline absent à la création de stock** : si un stockItem est créé avec quantity=0 et baselineQuantity reste null, le reset ne touchera pas ce row (`COALESCE` garde quantity actuelle). Vérifier que `createStockItem` set bien `baselineQuantity = quantity` (même si 0).
- **Rate limit signup** : par IP, contournable via VPN ; super-admin reste filtre principal. hCaptcha possible si besoin.
- **WhatsApp deep link** : `wa.me` ouvre WhatsApp Web ou app mobile. Sur desktop sans WA installé, fallback sur l'email.
- **Race d'expiration** : si un user clique un lien à l'instant où expiresAt passe, le check côté GET retourne `expired` puis accept renvoie 410. Pas de bug, juste cohérent.
- **`Restaurant.status='rejected'` vs `'pending'`** : un proprio refusé peut-il se réinscrire avec le même email ? Oui (le User existe déjà, on lui ajoute juste un nouveau Restaurant pending). Acceptable.

## 9. Hors périmètre P2a (à venir)

- **P2b** : personnalisation (couleur, logo, cover, background via Cloudinary). Affecte interne + page publique.
- **P2c** : page publique `/r/:slug` (hero, menu, dispo plats, vue salle).
- **P4** : envoi d'emails auto (notification activation, invitations email), facturation, sous-domaines.
- Pas de notification temps réel des nouvelles inscriptions au super-admin (juste consultation du tableau ; badge count optionnel).
