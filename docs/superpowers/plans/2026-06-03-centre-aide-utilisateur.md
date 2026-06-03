# Centre d'aide utilisateur — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un centre d'aide `/aide` dans le frontend, listant des guides Markdown versionnés, filtrés par rôle, avec recherche et liens profonds.

**Architecture:** 100 % frontend, aucun backend. Guides en fichiers `.md` importés via `?raw`, déclarés dans un manifeste typé. La page `HelpPage` filtre par `currentRole`, applique une recherche client, et rend le Markdown avec le parseur maison sûr `renderMarkdown`. Le générateur de doc `sync-docs.mjs` valide le manifeste et publie la liste des guides.

**Tech Stack:** React 18 + TypeScript, React Router 6, Vite (`?raw`), lucide-react, Vitest + @testing-library/react. Aucune nouvelle dépendance.

**Référence spec :** `docs/superpowers/specs/2026-06-03-centre-aide-utilisateur-design.md`

---

## Structure des fichiers

| Fichier | Rôle | Action |
| --- | --- | --- |
| `frontend/src/help/guides/*.md` (12) | Contenu des guides | Créer |
| `frontend/src/help/manifest.ts` | Types + liste ordonnée `HELP_GUIDES` | Créer |
| `frontend/src/help/manifest.test.ts` | Invariants du manifeste | Créer |
| `frontend/src/pages/HelpPage.tsx` | Écran `/aide` | Créer |
| `frontend/src/pages/HelpPage.test.tsx` | Tests (rôle, recherche, lien profond, sécurité) | Créer |
| `frontend/src/App.tsx` | Routes `/aide` et `/aide/:guideId` | Modifier |
| `frontend/src/components/Navigation.tsx` | Entrée « Aide » | Modifier |
| `scripts/sync-docs.mjs` | Validation + bloc `AUTO:HELP` | Modifier |
| `docs/FONCTIONNALITES.md` | Section + balises `AUTO:HELP` | Modifier |
| `CLAUDE.md` | Checklist doc | Modifier |
| `CHANGELOG.md` | Entrée | Modifier |

**Pré-requis :** travailler sur la branche `feat/centre-aide-utilisateur` (déjà créée).

---

## Task 1 : Contenu des guides Markdown

**Files:**
- Create: `frontend/src/help/guides/premiers-pas.md`, `caisse.md`, `salle-service.md`, `cuisine.md`, `menu-plats.md`, `stock-inventaire.md`, `employes-depenses-fournisseurs.md`, `paie-cnps.md`, `promotions.md`, `dashboard.md`, `parametres-equipe.md`, `hors-ligne-pwa.md`

Chaque guide est rédigé en **français, orienté tâches**, en utilisant uniquement le subset Markdown supporté par `renderMarkdown` : `#`/`##`/`###`, `**gras**`, `*italique*`, listes `- `, liens `[txt](https://…)`, paragraphes. **Pas de tableaux, pas de code, pas d'images** (non supportés par le parseur).

- [ ] **Step 1 : Écrire `caisse.md` (modèle de référence — à reproduire pour les autres)**

```markdown
# Encaisser à la caisse

L'écran **Caisse** sert à prendre une commande et à l'encaisser immédiatement.

## Prendre une commande

- Filtrez le menu par catégorie ou cherchez un plat par son nom.
- Cliquez sur un plat pour l'ajouter au panier ; ajustez les quantités dans le panier.
- Pour un plat à prix libre, saisissez le montant (dans les bornes min/max définies).

## Appliquer une réduction

- Choisissez une réduction en **pourcentage** ou en **montant**.
- La réduction est plafonnée par le réglage *plafond de réduction* (voir le guide Paramètres).
- Au-delà du plafond, le code PIN du responsable peut être demandé.

## Encaisser

- Sélectionnez le mode de paiement : **espèces**, **mobile money** ou **carte**.
- En espèces, saisissez le montant reçu : la **monnaie à rendre** est calculée.
- Un **paiement mixte** permet de répartir le total sur plusieurs modes.
- Validez : le **reçu** s'affiche et peut être imprimé (format 58 ou 80 mm).

## Bon à savoir

- Le **stock est décrémenté automatiquement** dès la création de la commande.
- La commande part en cuisine en temps réel.
- Hors-ligne, la commande est mise en file et synchronisée à la reconnexion (voir le guide Mode hors-ligne).
```

- [ ] **Step 2 : Écrire les 11 autres guides** en suivant ces plans (titres `#`/`##` + listes concrètes) :

  - **`premiers-pas.md`** — `# Premiers pas` ; ## Se connecter et choisir son restaurant ; ## Comprendre son rôle (ce que chaque rôle peut faire) ; ## La barre de navigation ; ## Où trouver de l'aide (cet écran). 
  - **`salle-service.md`** — `# Salle, tables & réservations` ; ## Le plan de salle (états libre/occupée/addition demandée/réservée) ; ## Ouvrir une commande sur une table ; ## Demander l'addition / encaisser à la caisse ; ## Réservations (créer, durée, pré-commande, acompte, remboursement).
  - **`cuisine.md`** — `# Écran cuisine (KDS)` ; ## Recevoir les commandes (temps réel, alerte sonore) ; ## Faire avancer une commande (commandée → en cours → prête) ; ## Lire le temps écoulé.
  - **`menu-plats.md`** — `# Menu, plats & variantes` ; ## Créer / modifier un plat (prix fixe ou prix libre min/max, catégorie, photo, temps de préparation) ; ## Variantes d'un plat ; ## Recette (ingrédients de stock consommés) ; ## Activer / désactiver un plat.
  - **`stock-inventaire.md`** — `# Stock & inventaire` ; ## Articles de stock (unité, coût unitaire, seuil d'alerte) ; ## Mouvements de stock ; ## Décrément automatique à la vente ; ## Alertes de seuil ; ## Inventaire physique (comptage vs système, écarts).
  - **`employes-depenses-fournisseurs.md`** — `# Employés, dépenses & fournisseurs` ; ## Fiche employé ; ## Saisir une dépense (catégorie, mode de paiement) ; ## Fournisseurs et achats (suivi des paiements).
  - **`paie-cnps.md`** — `# Paie & CNPS` ; ## Configurer les taux (retraite, prestations familiales, accident du travail, CMU — ajustables) ; ## Générer un bulletin de paie ; ## Déclaration DISA (export CNPS) ; ## Note sur l'ITS (désactivé par défaut, barème à confirmer).
  - **`promotions.md`** — `# Promotions & coupons` ; ## Happy hours ; ## Coupons (pourcentage ou montant) ; ## Application en caisse.
  - **`dashboard.md`** — `# Tableau de bord & exports` ; ## Lire les KPIs ; ## Ventes par heure, top plats, modes de paiement ; ## Exporter en PDF / CSV.
  - **`parametres-equipe.md`** — `# Paramètres & gestion de l'équipe` ; ## Réglages (nom du restaurant, PIN responsable, plafond de réduction, largeur du ticket 58/80 mm) ; ## Aperçu / impression du ticket ; ## Inviter un membre (rôles) ; ## Gérer les membres et leurs accès.
  - **`hors-ligne-pwa.md`** — `# Mode hors-ligne & installation` ; ## Installer l'application (PWA) ; ## Travailler hors-ligne (caisse) ; ## Synchronisation à la reconnexion ; ## Mises à jour (bandeau de mise à jour).

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/help/guides/
git commit -m "docs(aide): contenu des 12 guides utilisateur (markdown)"
```

---

## Task 2 : Manifeste typé + tests d'invariants

**Files:**
- Create: `frontend/src/help/manifest.ts`
- Test: `frontend/src/help/manifest.test.ts`

- [ ] **Step 1 : Écrire le test d'invariants (échoue d'abord)**

`frontend/src/help/manifest.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { HELP_GUIDES } from './manifest';
import type { Role } from '../types';

describe('manifest des guides', () => {
  it('a des identifiants uniques', () => {
    const ids = HELP_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a un contenu non vide pour chaque guide', () => {
    for (const g of HELP_GUIDES) {
      expect(g.content.trim().length, `guide ${g.id}`).toBeGreaterThan(0);
      expect(g.title.trim().length, `titre ${g.id}`).toBeGreaterThan(0);
      expect(g.roles.length, `rôles ${g.id}`).toBeGreaterThan(0);
    }
  });

  it('expose au moins un guide à chaque rôle', () => {
    const roles: Role[] = ['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur'];
    for (const role of roles) {
      const visible = HELP_GUIDES.filter((g) => g.roles.includes(role));
      expect(visible.length, `rôle ${role}`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run: `cd frontend && npx vitest run src/help/manifest.test.ts`
Expected: FAIL (le module `./manifest` n'existe pas encore).

- [ ] **Step 3 : Écrire `frontend/src/help/manifest.ts`**

```ts
import type { Role } from '../types';
import premiersPas from './guides/premiers-pas.md?raw';
import caisse from './guides/caisse.md?raw';
import salleService from './guides/salle-service.md?raw';
import cuisine from './guides/cuisine.md?raw';
import menuPlats from './guides/menu-plats.md?raw';
import stockInventaire from './guides/stock-inventaire.md?raw';
import employesDepensesFournisseurs from './guides/employes-depenses-fournisseurs.md?raw';
import paieCnps from './guides/paie-cnps.md?raw';
import promotions from './guides/promotions.md?raw';
import dashboard from './guides/dashboard.md?raw';
import parametresEquipe from './guides/parametres-equipe.md?raw';
import horsLignePwa from './guides/hors-ligne-pwa.md?raw';

export interface HelpGuide {
  id: string;
  title: string;
  icon: string; // nom d'icône lucide-react
  keywords: string[];
  roles: Role[];
  content: string;
}

const ALL: Role[] = ['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur'];
const GESTION: Role[] = ['propriétaire', 'administrateur'];

// L'ordre du tableau = l'ordre d'affichage dans la liste.
export const HELP_GUIDES: HelpGuide[] = [
  { id: 'premiers-pas', title: 'Premiers pas', icon: 'Rocket', keywords: ['début', 'connexion', 'rôle', 'navigation'], roles: ALL, content: premiersPas },
  { id: 'caisse', title: 'Encaisser à la caisse', icon: 'ShoppingCart', keywords: ['paiement', 'espèces', 'mobile money', 'carte', 'reçu', 'réduction'], roles: ['propriétaire', 'administrateur', 'caissier', 'serveur'], content: caisse },
  { id: 'salle-service', title: 'Salle, tables & réservations', icon: 'LayoutGrid', keywords: ['table', 'réservation', 'addition', 'acompte', 'service'], roles: ['propriétaire', 'administrateur', 'caissier', 'serveur'], content: salleService },
  { id: 'cuisine', title: 'Écran cuisine (KDS)', icon: 'ChefHat', keywords: ['cuisine', 'kds', 'préparation', 'commande'], roles: ['propriétaire', 'administrateur', 'cuisinier'], content: cuisine },
  { id: 'menu-plats', title: 'Menu, plats & variantes', icon: 'UtensilsCrossed', keywords: ['plat', 'menu', 'variante', 'recette', 'prix'], roles: GESTION, content: menuPlats },
  { id: 'stock-inventaire', title: 'Stock & inventaire', icon: 'Package', keywords: ['stock', 'inventaire', 'seuil', 'mouvement', 'ingrédient'], roles: GESTION, content: stockInventaire },
  { id: 'employes-depenses-fournisseurs', title: 'Employés, dépenses & fournisseurs', icon: 'Users', keywords: ['employé', 'dépense', 'fournisseur', 'achat'], roles: GESTION, content: employesDepensesFournisseurs },
  { id: 'paie-cnps', title: 'Paie & CNPS', icon: 'Banknote', keywords: ['paie', 'cnps', 'bulletin', 'disa', 'cotisation', 'its'], roles: GESTION, content: paieCnps },
  { id: 'promotions', title: 'Promotions & coupons', icon: 'Tag', keywords: ['promotion', 'coupon', 'happy hour', 'remise'], roles: GESTION, content: promotions },
  { id: 'dashboard', title: 'Tableau de bord & exports', icon: 'BarChart3', keywords: ['statistiques', 'kpi', 'export', 'pdf', 'csv', 'ventes'], roles: ['propriétaire', 'administrateur', 'caissier'], content: dashboard },
  { id: 'parametres-equipe', title: 'Paramètres & gestion de l\'équipe', icon: 'Settings', keywords: ['paramètres', 'pin', 'ticket', 'invitation', 'équipe', 'membre'], roles: GESTION, content: parametresEquipe },
  { id: 'hors-ligne-pwa', title: 'Mode hors-ligne & installation', icon: 'WifiOff', keywords: ['hors-ligne', 'offline', 'installer', 'pwa', 'synchronisation'], roles: ALL, content: horsLignePwa },
];
```

- [ ] **Step 4 : Lancer le test pour vérifier le succès**

Run: `cd frontend && npx vitest run src/help/manifest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/help/manifest.ts frontend/src/help/manifest.test.ts
git commit -m "feat(aide): manifeste des guides (typé, filtré par rôle) + tests d'invariants"
```

---

## Task 3 : Page HelpPage + tests

**Files:**
- Create: `frontend/src/pages/HelpPage.tsx`
- Test: `frontend/src/pages/HelpPage.test.tsx`

- [ ] **Step 1 : Écrire les tests (échouent d'abord)**

`frontend/src/pages/HelpPage.test.tsx` :

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Auth mockée, réglable par test via authRef.current
const { authRef } = vi.hoisted(() => ({ authRef: { current: {} as any } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authRef.current }));

import HelpPage from './HelpPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/aide" element={<HelpPage />} />
        <Route path="/aide/:guideId" element={<HelpPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('HelpPage', () => {
  beforeEach(() => {
    authRef.current = { currentUser: { isSuperAdmin: false }, currentRole: 'cuisinier' };
  });

  it('filtre les guides selon le rôle (cuisinier)', () => {
    renderAt('/aide');
    expect(screen.getByText('Écran cuisine (KDS)')).toBeInTheDocument();
    expect(screen.getByText('Premiers pas')).toBeInTheDocument();
    expect(screen.queryByText('Encaisser à la caisse')).not.toBeInTheDocument();
    expect(screen.queryByText('Paie & CNPS')).not.toBeInTheDocument();
  });

  it('montre tous les guides au super-admin', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'cuisinier' };
    renderAt('/aide');
    expect(screen.getByText('Encaisser à la caisse')).toBeInTheDocument();
    expect(screen.getByText('Paie & CNPS')).toBeInTheDocument();
  });

  it('filtre par recherche et affiche un message si aucun résultat', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'propriétaire' };
    renderAt('/aide');
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: 'cnps' } });
    expect(screen.getByText('Paie & CNPS')).toBeInTheDocument();
    expect(screen.queryByText('Premiers pas')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: 'zzzzz' } });
    expect(screen.getByText(/aucun guide/i)).toBeInTheDocument();
  });

  it('ouvre le guide via un lien profond', () => {
    authRef.current = { currentUser: { isSuperAdmin: true }, currentRole: 'propriétaire' };
    renderAt('/aide/caisse');
    expect(screen.getByRole('heading', { name: 'Encaisser à la caisse' })).toBeInTheDocument();
  });

  it('replie sur le premier guide visible si l\'id est inconnu', () => {
    renderAt('/aide/inexistant');
    // rôle cuisinier → premier guide visible = Premiers pas
    expect(screen.getByRole('heading', { name: 'Premiers pas' })).toBeInTheDocument();
  });

  it('échappe le HTML du contenu (sécurité)', () => {
    const { container } = render(<div>{renderMarkdown('Bonjour <script>alert(1)</script>')}</div>);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>');
  });
});
```

> Le dernier test importe `renderMarkdown` : ajouter en tête du fichier de test
> `import { renderMarkdown } from '../utils/markdown';`.

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `cd frontend && npx vitest run src/pages/HelpPage.test.tsx`
Expected: FAIL (HelpPage n'existe pas).

- [ ] **Step 3 : Écrire `frontend/src/pages/HelpPage.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { HelpCircle, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { HELP_GUIDES, type HelpGuide } from '../help/manifest';
import { renderMarkdown } from '../utils/markdown';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function HelpPage() {
  const { currentUser, currentRole } = useAuth();
  const { guideId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const visible = useMemo<HelpGuide[]>(
    () =>
      HELP_GUIDES.filter(
        (g) => currentUser?.isSuperAdmin || (currentRole && g.roles.includes(currentRole))
      ),
    [currentUser, currentRole]
  );

  const filtered = useMemo<HelpGuide[]>(() => {
    const q = normalize(query.trim());
    if (!q) return visible;
    return visible.filter(
      (g) => normalize(g.title).includes(q) || g.keywords.some((k) => normalize(k).includes(q))
    );
  }, [visible, query]);

  const active: HelpGuide | null =
    visible.find((g) => g.id === guideId) ?? visible[0] ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-100 mb-6">
        <HelpCircle className="w-7 h-7 text-amber-400" /> Centre d'aide
      </h1>

      {!active ? (
        <p className="text-neutral-400">Aucun guide disponible.</p>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un guide…"
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg pl-9 pr-3 py-2 text-sm"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="text-neutral-500 text-sm px-1">Aucun guide ne correspond.</p>
            ) : (
              <nav className="space-y-1">
                {filtered.map((g) => {
                  const Icon = (Icons as Record<string, any>)[g.icon] ?? HelpCircle;
                  const isActive = g.id === active.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => navigate(`/aide/${g.id}`)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                        isActive ? 'bg-amber-500 text-black font-medium' : 'text-neutral-300 hover:bg-neutral-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" /> {g.title}
                    </button>
                  );
                })}
              </nav>
            )}
          </aside>

          <article className="min-w-0">
            <h2 className="text-xl font-bold text-neutral-100 mb-4">{active.title}</h2>
            <div className="space-y-3 text-neutral-300 leading-relaxed">
              {renderMarkdown(active.content)}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
```

> Note : `renderMarkdown` rend déjà le `# Titre` du fichier comme un `<h1>`. Pour éviter le doublon avec le `<h2>` du composant, **commencer chaque fichier guide par le `# Titre`** (déjà prévu en Task 1) ; le test cible le `<h1>` rendu par `renderMarkdown` via `getByRole('heading', { name })`. Le `<h2>` reprend `active.title` (identique) pour l'en-tête visuel — les deux headings portent le même nom, `getByRole` renvoie le premier. C'est acceptable. Si un test échoue pour cause d'ambiguïté, utiliser `screen.getAllByRole('heading', { name }).length` ≥ 1.

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run: `cd frontend && npx vitest run src/pages/HelpPage.test.tsx`
Expected: PASS (5 tests). Si un test échoue sur l'ambiguïté de heading, ajuster l'assertion comme indiqué dans la note ci-dessus, puis relancer.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/pages/HelpPage.tsx frontend/src/pages/HelpPage.test.tsx
git commit -m "feat(aide): page Centre d'aide (liste filtrée par rôle, recherche, lien profond)"
```

---

## Task 4 : Routage + entrée de navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navigation.tsx`

- [ ] **Step 1 : Déclarer le lazy-import dans `App.tsx`**

Après la ligne `const PublicRestaurantPage = lazy(() => import('./pages/PublicRestaurantPage'));`, ajouter :

```tsx
const HelpPage = lazy(() => import('./pages/HelpPage'));
```

- [ ] **Step 2 : Ajouter les routes dans `App.tsx`**

Juste avant la route `/dashboard` (ou à côté des autres routes protégées), ajouter :

```tsx
<Route
  path="/aide"
  element={
    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur']}>
      <Layout><HelpPage /></Layout>
    </ProtectedRoute>
  }
/>
<Route
  path="/aide/:guideId"
  element={
    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur']}>
      <Layout><HelpPage /></Layout>
    </ProtectedRoute>
  }
/>
```

> Vérifier le motif d'enveloppe (`<Layout>…</Layout>`) utilisé par les routes voisines comme `/dashboard` dans `App.tsx` et le reproduire à l'identique (présence ou absence de `Layout`).

- [ ] **Step 3 : Ajouter l'entrée « Aide » dans `Navigation.tsx`**

Dans la liste d'imports d'icônes `lucide-react` en haut du fichier, ajouter `HelpCircle`. Puis, juste après le bloc `if/else if` qui remplit `routes` (après la ligne `}` qui suit `cuisinier`, vers la ligne 62), ajouter pour **tous** les rôles :

```tsx
routes.push({ path: '/aide', label: 'Aide', icon: HelpCircle });
```

Ainsi l'entrée apparaît dans le menu desktop **et** mobile (les deux itèrent sur `routes`).

- [ ] **Step 4 : Vérifier le build et le type-check**

Run: `cd frontend && npm run type-check`
Expected: PASS (aucune erreur TypeScript).

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navigation.tsx
git commit -m "feat(aide): route /aide + entrée de navigation (tous rôles)"
```

---

## Task 5 : Génération de doc — validation du manifeste + bloc AUTO:HELP

**Files:**
- Modify: `scripts/sync-docs.mjs`
- Modify: `docs/FONCTIONNALITES.md`

- [ ] **Step 1 : Ajouter les balises `AUTO:HELP` dans `docs/FONCTIONNALITES.md`**

À la fin du fichier, ajouter une nouvelle section :

```markdown
## 5. Aide en application

Guides du centre d'aide intégré (`/aide`). **Liste générée automatiquement** depuis
`frontend/src/help/manifest.ts` — ne pas éditer à la main.

<!-- AUTO:HELP:START -->
<!-- AUTO:HELP:END -->
```

- [ ] **Step 2 : Ajouter le collecteur dans `scripts/sync-docs.mjs`**

Après la fonction `parseRoutes()`, ajouter :

```js
/** Guides d'aide : { id, title, roles[] } + erreurs de fichiers manquants/vides. */
function parseHelpGuides() {
  const manifestPath = 'frontend/src/help/manifest.ts';
  if (!exists(manifestPath)) return { guides: [], errors: [] };
  const src = read(manifestPath);

  // Carte identifiant importé -> chemin du fichier .md
  const importMap = {};
  const impRe = /import\s+(\w+)\s+from\s+'(\.\/guides\/[^']+\.md)\?raw';/g;
  let im;
  while ((im = impRe.exec(src))) importMap[im[1]] = 'frontend/src/help/' + im[2].slice(2);

  const guides = [];
  const errors = [];
  const entryRe = /id:\s*'([^']+)'[\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?roles:\s*(\w+|\[[^\]]*\])[\s\S]*?content:\s*(\w+)\s*,/g;
  let e;
  while ((e = entryRe.exec(src))) {
    const id = e[1];
    const title = e[2].replace(/\\'/g, "'");
    const rolesToken = e[3];
    const contentId = e[4];
    // Rôles : alias ALL/GESTION ou tableau littéral
    let roles;
    if (rolesToken === 'ALL') roles = ['tous'];
    else if (rolesToken === 'GESTION') roles = ['propriétaire', 'administrateur'];
    else roles = (rolesToken.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
    guides.push({ id, title, roles });
    // Validation du fichier de contenu
    const file = importMap[contentId];
    if (!file) errors.push(`guide ${id} : import '${contentId}' introuvable`);
    else if (!exists(file)) errors.push(`guide ${id} : fichier manquant ${file}`);
    else if (read(file).trim().length === 0) errors.push(`guide ${id} : fichier vide ${file}`);
  }
  return { guides, errors };
}

function renderHelp(guides) {
  const lines = [
    `> ${guides.length} guides disponibles dans le centre d'aide (\`/aide\`).\n`,
    '| Guide | Titre | Rôles |',
    '| --- | --- | --- |',
  ];
  for (const g of guides) lines.push(`| \`${g.id}\` | ${g.title} | ${g.roles.join(', ')} |`);
  return lines.join('\n');
}
```

- [ ] **Step 3 : Brancher la validation et la génération dans le corps du script**

Après la ligne `const frontendScripts = pkgScripts('frontend/package.json');`, ajouter :

```js
const { guides: helpGuides, errors: helpErrors } = parseHelpGuides();
if (helpErrors.length) {
  console.error('✗ Manifeste des guides invalide :');
  for (const er of helpErrors) console.error('  - ' + er);
  process.exit(1);
}
```

Puis, après le bloc qui régénère `docs/BILAN.md` (la ligne `changed = applyToFile('docs/BILAN.md', …) || changed;`), ajouter :

```js
changed = applyToFile('docs/FONCTIONNALITES.md', [['HELP', renderHelp(helpGuides)]]) || changed;
```

- [ ] **Step 4 : Lancer la génération puis le check**

Run: `node scripts/sync-docs.mjs`
Expected: `✓ docs/FONCTIONNALITES.md régénéré` (le bloc AUTO:HELP liste les 12 guides).

Run: `node scripts/sync-docs.mjs --check`
Expected: `Documentation déjà à jour.` (exit 0).

- [ ] **Step 5 : Commit**

```bash
git add scripts/sync-docs.mjs docs/FONCTIONNALITES.md
git commit -m "docs(aide): sync-docs valide le manifeste et publie la liste des guides (AUTO:HELP)"
```

---

## Task 6 : Gouvernance (CLAUDE.md, CHANGELOG) + vérification finale

**Files:**
- Modify: `CLAUDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1 : Compléter la checklist dans `CLAUDE.md`**

Dans la section « Documentation », au point 2 (fichiers rédigés à mettre à jour), ajouter une puce :

```markdown
   - module dont l'usage change → mettre à jour son guide d'aide
     `frontend/src/help/guides/<module>.md` (centre d'aide `/aide`).
```

- [ ] **Step 2 : Ajouter l'entrée au `CHANGELOG.md`**

Sous `## [Non publié]` → `### Ajouté`, ajouter :

```markdown
- Centre d'aide utilisateur intégré (`/aide`) : 12 guides Markdown versionnés, filtrés par rôle,
  avec recherche et liens profonds ; validation du manifeste par `sync-docs.mjs`.
```

- [ ] **Step 3 : Vérification globale**

```bash
cd frontend && npm run type-check && npx vitest run src/help src/pages/HelpPage.test.tsx
```
Expected: type-check PASS ; tests PASS (manifeste + HelpPage).

```bash
cd .. && node scripts/sync-docs.mjs --check
```
Expected: `Documentation déjà à jour.` (exit 0).

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "docs(aide): gouvernance doc (checklist guides) + changelog"
```

---

## Critères d'acceptation (rappel spec)

- [ ] Entrée « Aide » visible pour tout utilisateur connecté ; `/aide` accessible.
- [ ] Liste filtrée par rôle ; super-admin voit tout ; liens profonds `/aide/:guideId` OK.
- [ ] Recherche fonctionnelle ; message si aucun résultat.
- [ ] Contenu rendu via `renderMarkdown` (titres, gras, listes, liens) ; fonctionne hors-ligne.
- [ ] `node scripts/sync-docs.mjs --check` passe ; `docs/FONCTIONNALITES.md` liste les guides.
- [ ] Tests Vitest verts (rôle, recherche, lien profond, manifeste).
