# PWA caisse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'app installable et chargeable hors-ligne (precache du shell) avec un bandeau de mise à jour non intrusif, sans toucher à la couche de données Dexie existante.

**Architecture:** `vite-plugin-pwa` (Workbox) génère le service worker (precache du bundle buildé) et le manifest. Un hook `usePwaUpdate` encapsule `useRegisterSW` ; un composant `UpdateBanner` monté à la racine affiche « Nouvelle version · Recharger » quand un nouveau SW est en attente (`registerType: 'prompt'`, pas de reload surprise). Un composant `OfflineNotice` sert de message générique pour les écrans hors périmètre.

**Tech Stack:** Vite 5, React 18, TypeScript (strict), vitest + @testing-library/react (jsdom), vite-plugin-pwa, sharp (génération d'icônes, ponctuelle).

**Spec :** `docs/superpowers/specs/2026-06-01-pwa-caisse-design.md`

**Note d'exécution :** toutes les commandes `npm` se lancent depuis `frontend/`. Sous PowerShell, préfixer par `cd frontend;` ou exécuter depuis ce dossier.

---

## Task 1 : Installer et configurer vite-plugin-pwa

**Files:**
- Modify: `frontend/package.json` (devDependencies)
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/vite-env.d.ts`

- [ ] **Step 1: Installer le plugin**

Run (depuis `frontend/`) :
```
npm install -D vite-plugin-pwa
```
Expected : `vite-plugin-pwa` ajouté dans `devDependencies` de `frontend/package.json`, pas d'erreur.

- [ ] **Step 2: Ajouter la référence de types du module virtuel**

Modifier `frontend/src/vite-env.d.ts` — ajouter la ligne de référence en tête (après la ligne `vite/client`) :

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 3: Configurer le plugin dans vite.config.ts**

Remplacer le contenu de `frontend/vite.config.ts` par :

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: 'Restoflow — Gestion de restaurant',
        short_name: 'Restoflow',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        theme_color: '#D4AF37',
        background_color: '#171717',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 4: Vérifier que le build génère le SW et le manifest**

Run (depuis `frontend/`) :
```
npm run build
```
Expected : build OK ; les fichiers `frontend/dist/sw.js` et `frontend/dist/manifest.webmanifest` existent.

Vérifier (PowerShell) :
```
Test-Path frontend/dist/sw.js, frontend/dist/manifest.webmanifest
```
Expected : `True` `True`.

> Note : le build échouera tant que les icônes PNG référencées dans le manifest n'existent pas pour le contrôle PWA assets. Si le build se plaint des icônes manquantes, c'est attendu — Task 2 les crée. On peut enchaîner Task 2 puis revenir lancer ce build. (Le manifest référence des icônes ; le build Vite ne bloque pas sur leur absence physique, mais le précache `globPatterns` ne les inclura pas tant qu'elles n'existent pas.)

- [ ] **Step 5: Commit**

```
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/vite-env.d.ts
git commit -m "feat(pwa): config vite-plugin-pwa (precache shell + manifest prompt)"
```

---

## Task 2 : Générer les icônes Restoflow + favicon

**Files:**
- Create: `frontend/scripts/generate-icons.mjs`
- Create: `frontend/public/icon.svg` (source)
- Create: `frontend/public/favicon.svg`
- Create (généré) : `frontend/public/icon-192.png`, `frontend/public/icon-512.png`, `frontend/public/icon-maskable-512.png`
- Modify: `frontend/index.html`
- Modify: `frontend/package.json` (devDependency `sharp`)

- [ ] **Step 1: Créer le SVG source de l'icône**

Créer `frontend/public/icon.svg` — fond gold plein (pour la version standard) avec monogramme « R » sombre :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#D4AF37"/>
  <text x="50%" y="50%" dy="0.06em" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-size="320" font-weight="700"
        fill="#171717">R</text>
</svg>
```

- [ ] **Step 2: Créer le favicon vectoriel**

Créer `frontend/public/favicon.svg` — version compacte (le « R » gold sur fond sombre, plus lisible en petit) :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#171717"/>
  <text x="50%" y="50%" dy="0.06em" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700"
        fill="#D4AF37">R</text>
</svg>
```

- [ ] **Step 3: Installer sharp (génération ponctuelle des PNG)**

Run (depuis `frontend/`) :
```
npm install -D sharp
```
Expected : `sharp` ajouté dans `devDependencies` (binaire prébuilt win32-x64).

- [ ] **Step 4: Créer le script de génération**

Créer `frontend/scripts/generate-icons.mjs` :

```js
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Icône standard : fond gold plein + R sombre (icon.svg).
const standard = readFileSync(join(root, 'icon.svg'));

// Icône maskable : même visuel mais avec marge de sécurité (~20%) car les
// launchers Android rognent les bords. On dessine l'icône réduite sur un fond gold.
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
     <rect width="512" height="512" fill="#D4AF37"/>
     <text x="50%" y="50%" dy="0.06em" text-anchor="middle" dominant-baseline="central"
           font-family="Georgia, 'Times New Roman', serif" font-size="230" font-weight="700"
           fill="#171717">R</text>
   </svg>`
);

await sharp(standard).resize(192, 192).png().toFile(join(root, 'icon-192.png'));
await sharp(standard).resize(512, 512).png().toFile(join(root, 'icon-512.png'));
await sharp(maskable).resize(512, 512).png().toFile(join(root, 'icon-maskable-512.png'));

console.log('Icônes générées : icon-192.png, icon-512.png, icon-maskable-512.png');
```

- [ ] **Step 5: Générer les PNG**

Run (depuis `frontend/`) :
```
node scripts/generate-icons.mjs
```
Expected : message « Icônes générées… » ; les 3 fichiers PNG existent dans `frontend/public/`.

Vérifier (PowerShell) :
```
Test-Path frontend/public/icon-192.png, frontend/public/icon-512.png, frontend/public/icon-maskable-512.png
```
Expected : `True` `True` `True`.

- [ ] **Step 6: Lier le favicon et le theme-color dans index.html**

Modifier `frontend/index.html` — ajouter dans `<head>` (après la balise `<title>`) :

```html
    <title>Restoflow — Gestion de restaurant tout-en-un</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <meta name="theme-color" content="#D4AF37" />
```

- [ ] **Step 7: Rebuild pour vérifier l'intégration des icônes**

Run (depuis `frontend/`) :
```
npm run build
```
Expected : build OK ; `frontend/dist/icon-192.png`, `frontend/dist/icon-512.png`, `frontend/dist/manifest.webmanifest` présents.

- [ ] **Step 8: Commit**

```
git add frontend/scripts/generate-icons.mjs frontend/public/icon.svg frontend/public/favicon.svg frontend/public/icon-192.png frontend/public/icon-512.png frontend/public/icon-maskable-512.png frontend/index.html frontend/package.json frontend/package-lock.json
git commit -m "feat(pwa): icônes Restoflow (gold) + favicon + theme-color"
```

---

## Task 3 : Hook usePwaUpdate (TDD)

**Files:**
- Create: `frontend/src/hooks/usePwaUpdate.ts`
- Test: `frontend/src/hooks/usePwaUpdate.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `frontend/src/hooks/usePwaUpdate.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Spy partagé exposé par le mock du module virtuel.
const updateServiceWorker = vi.fn();
const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();
let needRefreshValue = false;
let offlineReadyValue = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefreshValue, setNeedRefresh],
    offlineReady: [offlineReadyValue, setOfflineReady],
    updateServiceWorker,
  }),
}));

import { usePwaUpdate } from './usePwaUpdate';

describe('usePwaUpdate', () => {
  beforeEach(() => {
    updateServiceWorker.mockClear();
    setNeedRefresh.mockClear();
    setOfflineReady.mockClear();
    needRefreshValue = false;
    offlineReadyValue = false;
  });

  it('expose needRefresh = false par défaut', () => {
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(false);
  });

  it('propage needRefresh = true', () => {
    needRefreshValue = true;
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(true);
  });

  it('updateApp recharge en activant le nouveau SW', () => {
    const { result } = renderHook(() => usePwaUpdate());
    act(() => result.current.updateApp());
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('close réinitialise les deux états', () => {
    const { result } = renderHook(() => usePwaUpdate());
    act(() => result.current.close());
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(setOfflineReady).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run (depuis `frontend/`) :
```
npx vitest run src/hooks/usePwaUpdate.test.ts
```
Expected : FAIL — `usePwaUpdate` introuvable (le fichier d'implémentation n'existe pas).

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `frontend/src/hooks/usePwaUpdate.ts` :

```ts
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Encapsule l'enregistrement du service worker (vite-plugin-pwa).
 * - needRefresh : un nouveau SW est en attente (nouvelle version déployée).
 * - offlineReady : le SW a précaché le shell → l'app marche hors-ligne.
 * - updateApp : active le nouveau SW et recharge la page.
 * - close : masque les notifications (bandeau / toast).
 */
export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const updateApp = () => {
    void updateServiceWorker(true);
  };

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return { needRefresh, offlineReady, updateApp, close };
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run (depuis `frontend/`) :
```
npx vitest run src/hooks/usePwaUpdate.test.ts
```
Expected : PASS (4 tests).

- [ ] **Step 5: Commit**

```
git add frontend/src/hooks/usePwaUpdate.ts frontend/src/hooks/usePwaUpdate.test.ts
git commit -m "feat(pwa): hook usePwaUpdate (registre SW + update-flow)"
```

---

## Task 4 : Composant UpdateBanner + montage racine (TDD)

**Files:**
- Create: `frontend/src/components/UpdateBanner.tsx`
- Test: `frontend/src/components/UpdateBanner.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `frontend/src/components/UpdateBanner.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const updateApp = vi.fn();
const close = vi.fn();
let needRefresh = false;
let offlineReady = false;

vi.mock('../hooks/usePwaUpdate', () => ({
  usePwaUpdate: () => ({ needRefresh, offlineReady, updateApp, close }),
}));

import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  beforeEach(() => {
    updateApp.mockClear();
    close.mockClear();
    needRefresh = false;
    offlineReady = false;
  });

  it("n'affiche rien sans nouvelle version ni état offline", () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le bandeau quand une nouvelle version est prête', () => {
    needRefresh = true;
    render(<UpdateBanner />);
    expect(screen.getByText(/nouvelle version/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recharger/i })).toBeInTheDocument();
  });

  it('clic sur Recharger déclenche updateApp', () => {
    needRefresh = true;
    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: /recharger/i }));
    expect(updateApp).toHaveBeenCalledTimes(1);
  });

  it('affiche un toast hors-ligne prête (offlineReady) sans bouton Recharger', () => {
    offlineReady = true;
    render(<UpdateBanner />);
    expect(screen.getByText(/hors-ligne/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recharger/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run (depuis `frontend/`) :
```
npx vitest run src/components/UpdateBanner.test.tsx
```
Expected : FAIL — `UpdateBanner` introuvable.

- [ ] **Step 3: Écrire l'implémentation**

Créer `frontend/src/components/UpdateBanner.tsx` :

```tsx
import { usePwaUpdate } from '../hooks/usePwaUpdate';

/**
 * Notifications PWA, montées une seule fois à la racine de l'app :
 * - needRefresh : bandeau « Nouvelle version · Recharger » (l'utilisateur
 *   choisit le moment, aucune commande interrompue).
 * - offlineReady : toast discret « prête à fonctionner hors-ligne ».
 * Les deux sont fermables.
 */
export function UpdateBanner() {
  const { needRefresh, offlineReady, updateApp, close } = usePwaUpdate();

  if (needRefresh) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-neutral-900 border border-gold-400/60 px-4 py-3 text-sm text-neutral-100 shadow-lg"
      >
        <span>Nouvelle version disponible</span>
        <button
          onClick={updateApp}
          className="rounded-md bg-gold-400 px-3 py-1 font-medium text-neutral-900 hover:bg-gold-300"
        >
          Recharger
        </button>
        <button onClick={close} aria-label="Fermer" className="text-neutral-400 hover:text-neutral-200">
          ×
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-neutral-900 border border-neutral-700 px-4 py-3 text-sm text-neutral-300 shadow-lg"
      >
        <span>Prête à fonctionner hors-ligne</span>
        <button onClick={close} aria-label="Fermer" className="text-neutral-400 hover:text-neutral-200">
          ×
        </button>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run (depuis `frontend/`) :
```
npx vitest run src/components/UpdateBanner.test.tsx
```
Expected : PASS (4 tests).

- [ ] **Step 5: Monter le bandeau à la racine de l'app**

Modifier `frontend/src/App.tsx` — importer le composant et l'ajouter en sibling racine.

Ajouter l'import (après la ligne `import { Layout }`) :
```tsx
import { UpdateBanner } from './components/UpdateBanner';
```

Envelopper le retour de `App` dans un fragment pour inclure le bandeau. Remplacer :
```tsx
  return (
    <ErrorBoundary>
```
par :
```tsx
  return (
    <>
      <UpdateBanner />
      <ErrorBoundary>
```
et la fermeture correspondante — remplacer la dernière balise du JSX retourné :
```tsx
    </ErrorBoundary>
  );
}
```
par :
```tsx
    </ErrorBoundary>
    </>
  );
}
```

- [ ] **Step 6: Vérifier que le type-check passe (montage OK)**

Run (depuis `frontend/`) :
```
npm run type-check
```
Expected : aucune erreur TypeScript.

- [ ] **Step 7: Commit**

```
git add frontend/src/components/UpdateBanner.tsx frontend/src/components/UpdateBanner.test.tsx frontend/src/App.tsx
git commit -m "feat(pwa): bandeau de mise à jour monté à la racine"
```

---

## Task 5 : Composant OfflineNotice (TDD)

**Files:**
- Create: `frontend/src/components/OfflineNotice.tsx`
- Test: `frontend/src/components/OfflineNotice.test.tsx`

> Composant de message réutilisable pour les écrans hors périmètre (stats, historique, admin) lorsqu'ils sont consultés sans réseau. Le branchement écran-par-écran est volontairement hors périmètre (cf. spec) ; ce composant fournit le message standardisé prêt à l'emploi.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `frontend/src/components/OfflineNotice.test.tsx` :

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineNotice } from './OfflineNotice';

describe('OfflineNotice', () => {
  it('affiche le message hors-ligne par défaut', () => {
    render(<OfflineNotice />);
    expect(screen.getByText(/hors[- ]ligne/i)).toBeInTheDocument();
  });

  it('affiche un message personnalisé', () => {
    render(<OfflineNotice message="Les statistiques nécessitent une connexion." />);
    expect(screen.getByText('Les statistiques nécessitent une connexion.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run (depuis `frontend/`) :
```
npx vitest run src/components/OfflineNotice.test.tsx
```
Expected : FAIL — `OfflineNotice` introuvable.

- [ ] **Step 3: Écrire l'implémentation**

Créer `frontend/src/components/OfflineNotice.tsx` :

```tsx
/**
 * Message standardisé affiché quand un écran hors périmètre offline (stats,
 * historique, admin) est consulté sans réseau. À rendre quand `!online`.
 */
export function OfflineNotice({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-neutral-400">
      <p className="text-lg font-medium text-neutral-200">Hors-ligne</p>
      <p className="text-sm">
        {message ?? 'Cette page nécessite une connexion. Reconnectez-vous pour la consulter.'}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run (depuis `frontend/`) :
```
npx vitest run src/components/OfflineNotice.test.tsx
```
Expected : PASS (2 tests).

- [ ] **Step 5: Commit**

```
git add frontend/src/components/OfflineNotice.tsx frontend/src/components/OfflineNotice.test.tsx
git commit -m "feat(pwa): composant OfflineNotice (message écrans hors périmètre)"
```

---

## Task 6 : Vérification finale (suite complète + build)

**Files:** aucun (vérification).

- [ ] **Step 1: Lancer toute la suite de tests frontend**

Run (depuis `frontend/`) :
```
npm test
```
Expected : tous les tests verts, y compris les nouveaux (`usePwaUpdate`, `UpdateBanner`, `OfflineNotice`) et les existants (`offline`, etc.).

- [ ] **Step 2: Build de production complet**

Run (depuis `frontend/`) :
```
npm run build
```
Expected : `tsc` sans erreur puis build Vite OK ; présence de `frontend/dist/sw.js`, `frontend/dist/manifest.webmanifest`, et des 3 PNG d'icônes dans `dist/`.

- [ ] **Step 3: Vérification manuelle PWA (preview)**

Run (depuis `frontend/`) :
```
npm run preview
```
Puis dans le navigateur sur l'URL de preview, ouvrir DevTools › Application :
- **Service Workers** : un SW est activé (`sw.js`).
- **Manifest** : nom « Restoflow », icônes affichées, app installable.
- Cocher **Offline** dans l'onglet Network, recharger : l'app se charge ; la page caisse fonctionne (menu en cache Dexie).

Expected : SW actif, manifest installable, app chargée hors-ligne.

> Le bandeau « Recharger » ne peut se déclencher qu'après le déploiement effectif d'une nouvelle version (nouveau hash de SW). En local, on peut le simuler via DevTools › Application › Service Workers › « Update on reload » désactivé puis rebuild + reload, mais ce n'est pas requis pour valider l'implémentation (couvert par les tests unitaires).

- [ ] **Step 4: Commit éventuel**

Si la vérification a nécessité un ajustement (ex. correction de chemin d'icône), committer le correctif :
```
git add -A
git commit -m "fix(pwa): ajustements suite vérification preview"
```
Sinon, rien à committer.

---

## Notes de déploiement (post-merge)

- Aucune migration ni changement backend.
- Vercel sert déjà en HTTPS → le SW s'activera en prod.
- Au premier chargement post-déploiement, les utilisateurs déjà sur l'app verront le bandeau « Recharger » apparaître lors du déploiement *suivant* (le SW s'installe d'abord à cette visite-ci).
