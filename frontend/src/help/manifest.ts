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
  { id: 'promotions', title: 'Promotions & coupons', icon: 'Tag', keywords: ['promotion', 'coupon', 'happy hour', 'réduction'], roles: GESTION, content: promotions },
  { id: 'dashboard', title: 'Tableau de bord & exports', icon: 'BarChart3', keywords: ['statistiques', 'kpi', 'export', 'pdf', 'csv', 'ventes'], roles: ['propriétaire', 'administrateur', 'caissier'], content: dashboard },
  { id: 'parametres-equipe', title: 'Paramètres & gestion de l\'équipe', icon: 'Settings', keywords: ['paramètres', 'pin', 'ticket', 'invitation', 'équipe', 'membre'], roles: GESTION, content: parametresEquipe },
  { id: 'hors-ligne-pwa', title: 'Mode hors-ligne & installation', icon: 'WifiOff', keywords: ['hors-ligne', 'offline', 'installer', 'pwa', 'synchronisation'], roles: ALL, content: horsLignePwa },
];
