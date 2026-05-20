# 🍽️ Restaurant Pilote

> Application web full-stack de gestion de restaurant : **caisse**, **cuisine (KDS)**, **stock**, **statistiques** et **service à table**, en temps réel.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socketdotio&logoColor=white)

---

## ✨ Aperçu

Application pensée pour un restaurant : prise de commande, envoi automatique en cuisine,
suivi en temps réel, décrément automatique du stock, encaissement (immédiat ou différé),
service à table et tableau de bord des ventes. Fonctionne aussi **hors-ligne** (les commandes
sont mises en file et synchronisées à la reconnexion).

## 🚀 Fonctionnalités

- 🔐 **Authentification** par rôle (JWT access + refresh, mots de passe hachés bcrypt, rate-limiting)
- 🧾 **Caisse** : menu filtrable, panier, réductions (montant / %), paiement (espèces, mobile money, carte), **reçu imprimable**
- 👨‍🍳 **Cuisine (KDS)** : réception temps réel, statuts séquentiels (commandée → en cours → prête), temps écoulé, **alerte sonore**
- 🍽️ **Service à table** : plan de **salle** (tables libres/occupées), commande rattachée à une table, **paiement immédiat ou différé**, règlement de l'addition à la caisse
- 📦 **Stock** : recettes par plat, **décrément automatique** à chaque vente, **alertes de seuil**, historique des mouvements
- 📊 **Dashboard** : KPIs, ventes par heure, top plats, modes de paiement, **export PDF / CSV**
- ⚡ **Temps réel** : WebSocket (Socket.io) avec *rooms* par rôle
- 📴 **Hors-ligne** : cache du menu (IndexedDB / Dexie) + file de synchronisation
- 📱 **Responsive** : desktop, tablette, smartphone

## 👥 Rôles & interfaces

| Rôle           | Accès                                                        |
| -------------- | ----------------------------------------------------------- |
| Administrateur | Dashboard, Gestion (stock/menu/users), Caisse, Salle, Service, Cuisine |
| Caissier       | Caisse, Salle, Service, Statistiques                        |
| Serveur        | Salle (prise de commande à table, service)                  |
| Cuisinier      | Cuisine (KDS)                                               |

## 🛠️ Stack technique

| Côté        | Technologies                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| **Frontend**| React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, socket.io-client, Dexie |
| **Backend** | Node.js, Express, TypeScript, Socket.io, JWT, bcrypt, Zod, Prisma           |
| **Base**    | PostgreSQL 15 (Docker en local, ou Neon/Supabase en ligne)                  |
| **Tests**   | Vitest, Supertest                                                           |

## 📦 Prérequis

- [Node.js](https://nodejs.org) 18+ (testé avec Node 22)
- Une base **PostgreSQL** : [Docker Desktop](https://www.docker.com/products/docker-desktop/) en local, ou un service gratuit ([Neon](https://neon.tech) recommandé, sans carte bancaire)

## 🚀 Démarrage rapide

### 1. Base de données

**Option A — Docker (local)** depuis la racine :

```bash
docker compose up -d
```

PostgreSQL démarre sur `localhost:5432` (base `restaurant_db`, user/mdp `restaurant`).

**Option B — Neon (en ligne, gratuit)** : crée un projet sur [neon.tech](https://neon.tech) et mets la
*connection string* (connexion **directe**, sans `-pooler`) dans `backend/.env` → `DATABASE_URL`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # puis renseigne DATABASE_URL et les secrets JWT
npm install
npm run prisma:migrate    # crée les tables
npm run seed              # données de démonstration
npm run dev               # API + WebSocket sur http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Ouvre **http://localhost:5173** 🎉

## 👤 Comptes de démonstration

| Rôle           | Identifiant | Mot de passe |
| -------------- | ----------- | ------------ |
| Administrateur | `admin`     | `admin123`   |
| Caissier       | `caisse1`   | `caisse123`  |
| Cuisinier      | `chef1`     | `chef123`    |
| Serveur        | `serveur1`  | `serveur123` |

## 🔄 Cycle de vie d'une commande

```
Caisse / Serveur  →  Cuisine            →  Service           →  Caisse
(prise + envoi)      (Commencer →           (Marquer servie)     (encaisser
                      Terminer = prête)                           l'addition)
   commandée      →   en_cours → prête   →   servie           →   payée → table libérée
```

Le **stock est décrémenté automatiquement** dès la création de la commande, et toutes les étapes
sont diffusées en **temps réel** via WebSocket.

## 📁 Architecture

```
.
├── docker-compose.yml          # PostgreSQL (dev)
├── backend/
│   ├── prisma/                 # schema.prisma + migrations + seed.ts
│   └── src/
│       ├── config/             # env, client Prisma
│       ├── controllers/        # contrôleurs HTTP
│       ├── routes/             # routes Express (+ permissions par rôle)
│       ├── services/           # logique métier (transactions, stock, stats, tables…)
│       ├── middlewares/        # auth, validation, rate-limit, erreurs
│       ├── validators/         # schémas Zod
│       ├── websocket/          # Socket.io (rooms par rôle)
│       └── utils/
└── frontend/
    └── src/
        ├── contexts/           # Auth, WebSocket, Notifications
        ├── components/         # Layout, Navigation, ProtectedRoute…
        ├── pages/              # Login, Caisse, Cuisine, Admin, Dashboard, Salle, Service
        ├── services/           # api (axios), socket, endpoints, offline (Dexie)
        ├── hooks/              # useClock, useOfflineSync
        └── utils/
```

## 🔐 Variables d'environnement

<details>
<summary><code>backend/.env</code></summary>

```
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://restaurant:restaurant@localhost:5432/restaurant_db?schema=public"
JWT_SECRET=...
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```
</details>

<details>
<summary><code>frontend/.env</code></summary>

```
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_APP_NAME=Restaurant Pilote
```
</details>

> ⚠️ Les fichiers `.env` (qui contiennent des secrets) sont **ignorés par git**. Seuls les `.env.example` sont versionnés.

## 🧪 Scripts & tests

**Backend** (`cd backend`)

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur de développement (tsx watch) |
| `npm run build` / `npm start` | Build + exécution production |
| `npm run prisma:migrate` | Migrations |
| `npm run prisma:studio` | Explorateur de base Prisma |
| `npm run seed` | Données de démonstration |
| `npm test` | Tests (logique métier + smoke API) |

**Frontend** (`cd frontend`)

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur Vite |
| `npm run build` | Build production |
| `npm test` | Tests |

## 📝 Notes d'implémentation

- Logique métier (numéro de commande `YYYYMMDD-NNN`, décrément de stock, transitions de statut)
  implémentée en **TypeScript dans des transactions Prisma** — source de vérité unique et testable.
- Montants en **entiers (FCFA, sans centimes)** ; quantités de stock en flottants arrondis à 2 décimales.
- Auth par **Bearer token** (header `Authorization`) → pas de CSRF (non applicable) ; sécurité assurée
  par `helmet`, CORS strict, rate-limiting et sanitization des entrées.

## 🚢 Déploiement

Pour la production : héberger PostgreSQL sur un service gratuit (ex. **Neon**), déployer le **backend**
sur Render/Railway et le **frontend** sur Vercel/Netlify. Renseigner les variables d'environnement
correspondantes (`DATABASE_URL`, secrets JWT, `CORS_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`).

---

<p align="center">Construit avec ❤️ — MVP de gestion de restaurant.</p>
