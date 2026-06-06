# Budget d'approvisionnement

Le module **Budget** vous aide à préparer un budget d'achats (cuisine, boissons, charges)
et à le **comparer ensuite à vos achats réels**. Accès réservé au **propriétaire** et à
l'**administrateur**, depuis l'onglet **Budget**.

## Créer une proposition automatiquement

1. Cliquez sur **Nouvelle proposition**.
2. Renseignez le **titre**, la **période** (ex. « Juin 2026 »), le **budget cible** (en FCFA)
   et le **% de réserve stratégique** (20 % par défaut).
3. Choisissez les **bases de calcul** :
   - **Historique d'achats** — ce que vous achetez réellement (le signal principal) ;
   - **Rotation des ventes** — les produits à forte rotation déduits des commandes ;
   - **Stock sous seuil** — les articles à réapprovisionner en priorité ;
   - **Enrichir avec l'IA** *(si configurée)* — ajoute des suggestions de postes et rédige une conclusion.
4. Cliquez sur **Générer la proposition**.

Le programme répartit le **budget d'exploitation** (cible − réserve) entre les postes
(Cuisine, Épicerie, Emballages, Entretien, Bières, Softs, Vins & Spiritueux…), met de côté la
**réserve stratégique**, et propose des **postes souvent oubliés** (gaz, eau/électricité,
transport, maintenance).

> Astuce : pour qu'un article pèse dans le bon poste, renseignez sa **catégorie budgétaire**
> dans la fiche stock. Les articles sans catégorie sont regroupés sous « Divers ».

## Ajuster puis enregistrer

La proposition s'ouvre dans un **éditeur** : vous pouvez modifier les montants des lignes et des
postes, renommer/ajouter/supprimer des postes et des sections, ajouter un poste suggéré d'un clic,
et rédiger la **conclusion**. Le **total réparti** et l'**écart avec la cible** s'affichent en haut.
Cliquez sur **Enregistrer** pour conserver le budget.

## Exporter

Depuis la liste ou l'éditeur, exportez la proposition en **PDF** (mise en page type
« Proposition de budget d'approvisionnement ») ou en **CSV** (tableur).

## Suivre le budget vs le réel

Indiquez une **période de début et de fin** lors de la génération pour activer le suivi.
Le bouton **Suivi** (icône graphique) compare, poste par poste, le **prévu** au **réel**
(somme des achats fournisseurs de la période, regroupés par catégorie budgétaire des articles).
L'**écart** est vert lorsque vous restez sous le budget, rouge en cas de dépassement.

## Sans connexion IA

L'enrichissement par l'IA est **optionnel** : sans clé `ANTHROPIC_API_KEY` configurée côté serveur,
le module reste **entièrement fonctionnel** — la répartition et les suggestions proviennent alors
uniquement du moteur de calcul (déterministe).
