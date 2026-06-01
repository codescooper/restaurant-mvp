# PWA caisse — chargement hors-ligne & installabilité

**Date :** 2026-06-01
**Statut :** validé (design), en attente du plan d'implémentation
**Périmètre :** frontend uniquement (Vite 5 / React 18). Aucun changement backend.

## Contexte

La caisse dispose déjà d'une couche de données hors-ligne (commit `08c8cea`) :
`frontend/src/services/offline.ts` (Dexie) met en cache le menu et met en file
les commandes avec une clé `clientId` idempotente ; `useOfflineSync` rejoue la
file à la reconnexion. **Ce qui manque** : le *shell* applicatif (HTML/JS/CSS)
n'est pas mis en cache, donc sur un rechargement sans réseau l'app ne se charge
pas du tout. Cette spec ajoute un service worker (precache du shell) et un
manifest installable, sans toucher à la logique Dexie.

## Décisions de cadrage (validées)

1. **Périmètre offline = minimal / caisse uniquement.** L'app se charge
   hors-ligne ; la prise de commande fonctionne (menu Dexie + file). Les autres
   écrans (stats, historique, admin) affichent un état « hors-ligne » au lieu de
   planter. **Pas** de runtime-caching des réponses API.
2. **Mise à jour = bandeau « Recharger » (prompt).** Un nouveau déploiement ne
   s'active jamais automatiquement : il attend que l'utilisateur clique. Jamais
   d'interruption en pleine commande.
3. **Icône = générée** aux couleurs de la marque (gold `#D4AF37` sur fond
   `neutral-900` `#171717`, monogramme « R »), provisoire et remplaçable.
4. **Approche technique = `vite-plugin-pwa`** (Workbox), option retenue contre un
   SW manuel (réinvente le precache hashé + l'update-flow) et Workbox CLI
   (pipeline en deux temps, moins intégré).

## Architecture

Séparation des responsabilités :
- **Service worker (Workbox)** : « l'app se charge » — precache du shell buildé.
- **Dexie (existant, inchangé)** : « les données » — menu en cache + file de commandes.

### Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/vite.config.ts` | Ajout du plugin `VitePWA({ registerType: 'prompt', … })` |
| `frontend/package.json` | Ajout devDependency `vite-plugin-pwa` |
| `frontend/public/favicon.svg` | Favicon vectoriel (monogramme R gold) |
| `frontend/public/icon-192.png` | Icône PWA 192×192 |
| `frontend/public/icon-512.png` | Icône PWA 512×512 |
| `frontend/public/icon-maskable-512.png` | Icône maskable (zone sûre ~80 %) |
| `frontend/index.html` | Lien favicon + meta `theme-color` |
| `frontend/src/hooks/usePwaUpdate.ts` | Wrapper de `useRegisterSW` → `{ needRefresh, offlineReady, updateApp, close }` |
| `frontend/src/components/UpdateBanner.tsx` | Bandeau « Nouvelle version · [Recharger] » + toast « prête hors-ligne » |
| `frontend/src/components/OfflineNotice.tsx` | Message « hors-ligne » réutilisable pour les écrans hors périmètre |
| `frontend/src/hooks/usePwaUpdate.test.ts` | Test unitaire (mock `virtual:pwa-register/react`) |
| `frontend/src/components/UpdateBanner.test.tsx` | Test unitaire (rendu conditionnel + clic) |

Le `<UpdateBanner>` est monté une fois dans le layout racine de l'app.

### Configuration du plugin

```ts
VitePWA({
  registerType: 'prompt',
  injectRegister: 'auto',
  manifest: {
    name: 'Restoflow — Gestion de restaurant',
    short_name: 'Restoflow',
    lang: 'fr',
    display: 'standalone',
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
    // Pas de runtimeCaching : périmètre minimal, les données caisse viennent de Dexie.
  },
  devOptions: { enabled: false }, // pas de SW en dev (préserve le HMR)
})
```

## Flux de mise à jour

```
Deploy → SW télécharge le nouveau shell en fond → état "waiting" (pas d'activation)
   → useRegisterSW: needRefresh = true
   → <UpdateBanner> : « Nouvelle version disponible · [Recharger] »
   → clic Recharger → updateServiceWorker(true) → skipWaiting + reload
   → l'utilisateur choisit le moment ; aucune commande interrompue
```

`usePwaUpdate` encapsule `useRegisterSW({ onNeedRefresh, onOfflineReady })` et
expose `{ needRefresh, offlineReady, updateApp, close }`. `UpdateBanner` ne rend
le bandeau que si `needRefresh`, avec un bouton « Recharger » et une croix pour
masquer. Un toast discret et fermable « Prête à fonctionner hors-ligne »
s'affiche une fois quand `offlineReady`.

## Fallback hors-ligne (écrans hors périmètre)

- Le shell précaché garantit qu'aucun écran blanc n'apparaît hors-ligne.
- Les écrans qui dépendent d'appels API (stats, historique, admin) doivent
  afficher `<OfflineNotice>` quand `!online` (état déjà exposé par
  `useOfflineSync`) plutôt que de planter sur une requête échouée.
- **Pas** de gestion offline par écran au-delà de ce message (YAGNI).

## Icônes — génération

Source : un SVG (fond `#171717` arrondi, monogramme « R » en `#D4AF37`).
Décliné en PNG 192 / 512 / maskable-512 (zone de sécurité ~80 % pour les
launchers Android). Génération **ponctuelle** (script Node avec `sharp` si
disponible, sinon rendu canvas) ; les PNG résultants sont **commités** comme
assets statiques figés — pas de regénération à chaque build. Fichiers
provisoires et remplaçables par un vrai logo plus tard.

## Gestion d'erreurs / pièges

- SW actif uniquement en HTTPS/localhost (Vercel = HTTPS : OK).
- `navigateFallback: '/index.html'` pour que les routes SPA profondes (`/caisse`)
  se rechargent hors-ligne.
- **Aucune** mise en cache des réponses d'auth/API : on ne sert jamais une
  session ou des données périmées depuis le SW.
- `devOptions.enabled: false` : pas de SW en dev pour préserver le HMR Vite.

## Tests & vérification

- **Unitaire (vitest)** :
  - `usePwaUpdate` — mock de `virtual:pwa-register/react` ; vérifie que
    `needRefresh` propage l'état et que `updateApp` appelle
    `updateServiceWorker(true)`.
  - `UpdateBanner` — rien si `!needRefresh` ; bouton présent sinon ; clic
    déclenche `updateApp`.
- **Build** : `npm run build` produit `sw.js`, `manifest.webmanifest` et le
  precache manifest dans `dist/`.
- **Manuel** : `npm run preview` → DevTools › Application : SW actif, Manifest
  installable (icônes OK) ; mode offline → l'app se recharge, la caisse
  fonctionne ; nouvelle version déployée → bandeau « Recharger » apparaît.

## Hors périmètre (non fait)

- Runtime-caching des réponses API.
- Mutations hors-ligne autres que la prise de commande (stock, dépenses…).
- Gestion fine offline écran par écran (au-delà du message `OfflineNotice`).
- Notifications push.
- Icône définitive / logo de marque final.
