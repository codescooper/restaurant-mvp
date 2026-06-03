# Spec — Centre d'aide utilisateur intégré

> Date : 2026-06-03
> Objectif : rendre les utilisateurs **autonomes** grâce à une aide accessible
> directement dans l'application, par module et adaptée à leur rôle.

## 1. Objectif & périmètre

Ajouter un **centre d'aide dédié** à Restoflow : une page `/aide` listant des **guides
d'utilisation** (un par domaine fonctionnel), **filtrés selon le rôle** de l'utilisateur connecté,
avec un champ de recherche simple et des liens profonds vers chaque guide.

Le contenu est rédigé en **Markdown versionné** (livré avec le frontend), rendu avec le parseur
maison sûr déjà présent (`frontend/src/utils/markdown.tsx`, fonction `renderMarkdown`). **Aucune
nouvelle dépendance, aucun changement backend.**

### Décisions actées (brainstorming)

- **Format** : centre d'aide dédié `/aide` (pas d'aide contextuelle par bouton « ? » pour cette v1).
- **Audience** : contenu **filtré par rôle**.
- **Stockage du contenu** : **Markdown versionné dans le code** (pas d'édition en ligne).

### Hors périmètre (YAGNI)

Édition en ligne du contenu, multilingue, captures d'écran / vidéos, recherche plein texte,
versioning du contenu d'aide, aide contextuelle écran par écran.

## 2. Architecture

Tout est **frontend**. Aucun appel réseau (le contenu est embarqué au build).

```
frontend/src/
  help/
    guides/                 # un fichier .md par guide (contenu rédigé)
      premiers-pas.md
      caisse.md
      salle-service.md
      cuisine.md
      menu-plats.md
      stock-inventaire.md
      employes-depenses-fournisseurs.md
      paie-cnps.md
      promotions.md
      dashboard.md
      parametres-equipe.md
      hors-ligne-pwa.md
    manifest.ts             # liste ordonnée des guides + métadonnées
  pages/
    HelpPage.tsx            # écran /aide (liste + recherche + rendu)
```

### 2.1 Manifeste — `frontend/src/help/manifest.ts`

Chaque guide est importé en brut via la syntaxe Vite `?raw` et déclaré ainsi :

```ts
import type { Role } from '../types'; // type déjà exporté par frontend/src/types/index.ts
import premiersPas from './guides/premiers-pas.md?raw';
// …

export interface HelpGuide {
  id: string;          // identifiant d'URL (kebab-case), unique
  title: string;       // titre affiché
  icon: string;        // nom d'icône lucide-react (ex. 'ShoppingCart')
  keywords: string[];  // mots-clés pour la recherche
  roles: Role[];       // rôles autorisés à voir ce guide
  content: string;     // Markdown brut
}

export const HELP_GUIDES: HelpGuide[] = [ /* ordre = ordre d'affichage */ ];
```

`Role` est le type déjà exporté par `frontend/src/types/index.ts` (`propriétaire | administrateur
| caissier | cuisinier | serveur`). Le **super-admin** voit tous les guides.

> Note technique : déclarer `declare module '*.md?raw'` (ou s'appuyer sur les types Vite client)
> pour que TypeScript accepte l'import `?raw`.

### 2.2 Couverture & matrice rôles

| Guide (`id`) | Titre | Rôles |
| --- | --- | --- |
| `premiers-pas` | Premiers pas | tous |
| `caisse` | Encaisser à la caisse | propriétaire, administrateur, caissier, serveur |
| `salle-service` | Salle, tables & réservations | propriétaire, administrateur, caissier, serveur |
| `cuisine` | Écran cuisine (KDS) | propriétaire, administrateur, cuisinier |
| `menu-plats` | Menu, plats & variantes | propriétaire, administrateur |
| `stock-inventaire` | Stock & inventaire | propriétaire, administrateur |
| `employes-depenses-fournisseurs` | Employés, dépenses & fournisseurs | propriétaire, administrateur |
| `paie-cnps` | Paie & CNPS (bulletins, DISA) | propriétaire, administrateur |
| `promotions` | Promotions & coupons | propriétaire, administrateur |
| `dashboard` | Tableau de bord & exports | propriétaire, administrateur, caissier |
| `parametres-equipe` | Paramètres & gestion de l'équipe | propriétaire, administrateur |
| `hors-ligne-pwa` | Mode hors-ligne & installation | tous |

« tous » = les cinq rôles (+ super-admin). Le filtrage retient un guide si
`guide.roles.includes(currentRole)` ou si l'utilisateur est super-admin.

### 2.3 Page — `frontend/src/pages/HelpPage.tsx`

Layout deux colonnes (responsive : la liste passe au-dessus du contenu sur mobile), thème sombre
cohérent avec l'app (gold sur fond sombre) :

- **Colonne gauche** : champ de recherche + liste des guides **visibles pour le rôle courant**.
  Chaque entrée = icône + titre ; l'entrée active est mise en évidence.
- **Colonne droite** : titre du guide + contenu rendu par `renderMarkdown(guide.content)`.
- **Recherche** : filtre client insensible à la casse/aux accents sur `title` + `keywords`.
  Si aucun résultat → message « Aucun guide ne correspond ».
- **Sélection** : `/aide` affiche le premier guide visible ; `/aide/:guideId` ouvre le guide
  correspondant. Si `:guideId` est inconnu **ou non autorisé pour le rôle**, repli sur le premier
  guide visible (pas d'erreur dure).

### 2.4 Routage & navigation

- `frontend/src/App.tsx` : ajouter
  `<Route path="/aide" element={<ProtectedRoute allowedRoles={[…les 5 rôles]}><HelpPage/></ProtectedRoute>} />`
  et la variante `/aide/:guideId`. Lazy-loading comme les autres pages.
- `frontend/src/components/Navigation.tsx` : entrée « ❓ Aide » → `/aide`, visible pour tout
  utilisateur authentifié (tous rôles).

## 3. Flux de données

1. Au build, Vite inline le contenu des `.md` dans le bundle via `?raw`.
2. `HelpPage` lit `currentRole` depuis `AuthContext`, calcule la liste visible, applique le filtre
   de recherche, sélectionne le guide (param d'URL ou premier visible), puis `renderMarkdown`.
3. Aucun appel réseau, fonctionne donc **hors-ligne** (cohérent avec la PWA caisse).

## 4. Gestion des erreurs / cas limites

- `:guideId` inconnu ou interdit → repli silencieux sur le premier guide visible.
- Rôle sans aucun guide (ne devrait pas arriver, `premiers-pas` + `hors-ligne-pwa` sont « tous ») →
  message neutre « Aucun guide disponible ».
- Recherche sans résultat → message d'invite, le panneau de contenu reste sur le dernier guide.
- Le rendu Markdown échappe déjà tout HTML (sécurité assurée par `renderMarkdown`).

## 5. Mise à jour automatique (lien avec l'existant)

Réutilise le dispositif documenté dans `docs/MAINTENANCE-DOC.md` :

1. **`scripts/sync-docs.mjs` étendu** :
   - **Validation** : pour chaque entrée du manifeste, vérifier que le fichier `.md` référencé
     existe et est non vide ; `--check` échoue sinon (le hook pré-commit bloque alors le commit).
   - **Génération** : écrire la liste des guides (id, titre, rôles) dans un bloc
     `<!-- AUTO:HELP:START -->…<!-- AUTO:HELP:END -->` ajouté à `docs/FONCTIONNALITES.md`.
   - Lecture du manifeste : parser `frontend/src/help/manifest.ts` par expressions régulières
     (mêmes principes que le parsing des routes), **sans** exécuter de TypeScript.
2. **`CLAUDE.md`** : ajouter à la checklist « Documentation » → « si un module évolue, mettre à jour
   son guide `frontend/src/help/guides/<module>.md` ».

## 6. Tests (Vitest + Testing Library)

- **Filtrage par rôle** : monté avec un `currentRole` = `cuisinier` → seuls `cuisine`,
  `premiers-pas`, `hors-ligne-pwa` apparaissent ; `caisse`/`paie-cnps` absents.
- **Super-admin** : voit tous les guides.
- **Recherche** : saisir un mot-clé filtre la liste ; un terme absent affiche le message vide.
- **Lien profond** : `/aide/caisse` ouvre le guide Caisse ; `/aide/inexistant` et un guide interdit
  au rôle replient sur le premier guide visible.
- **Manifeste** : chaque entrée a un `content` non vide et un `id` unique.
- **Sécurité du rendu** : un guide contenant `<script>` est rendu échappé (déjà couvert par
  `renderMarkdown`, test de non-régression léger).

## 7. Critères d'acceptation

- [ ] Un utilisateur connecté voit une entrée « Aide » et accède à `/aide`.
- [ ] La liste des guides correspond à son rôle ; le super-admin voit tout.
- [ ] La recherche filtre la liste ; les liens profonds `/aide/:guideId` fonctionnent.
- [ ] Le contenu s'affiche correctement (titres, gras, listes, liens) via `renderMarkdown`.
- [ ] Fonctionne hors-ligne (aucun appel réseau).
- [ ] `node scripts/sync-docs.mjs --check` passe ; `docs/FONCTIONNALITES.md` liste les guides
      dans le bloc `AUTO:HELP`.
- [ ] Tests Vitest verts (rôle, recherche, lien profond, manifeste).
