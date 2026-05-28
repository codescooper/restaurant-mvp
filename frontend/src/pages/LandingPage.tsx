import { Link } from 'react-router-dom';
import {
  ChefHat,
  Banknote,
  UtensilsCrossed,
  LayoutGrid,
  BarChart3,
  Users,
  MessageCircle,
  Mail,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Star,
  Clock,
  Smartphone,
} from 'lucide-react';
import { AWEMA_CONTACT } from '../utils/contact';

/* ─── Helpers ─── */
const UNSPLASH_BASE = 'https://images.unsplash.com/photo-';

function unsplashUrl(id: string, width = 800, quality = 80) {
  return `${UNSPLASH_BASE}${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

/* ─── Photo IDs — all verified 200 ─── */
const PHOTOS = {
  hero:            '1703793578040-07e1778b6b2c', // dimly lit restaurant interior
  heroPeople:      '1687723547516-308ac9cefba9', // restaurant with guests
  ambianceOrange:  '1701722952679-beffce26d77a', // warm restaurant interior
  tableSet:        '1744776411221-702f2848b0b2', // set table for dinner
  restaurantLight: '1744776411255-3c427c203685', // decorative lights & greenery
  foodJollof:      '1664993101841-036f189719b6', // jollof rice
  foodGrilled:     '1555939594-58d7cb561ad1',    // grilled meat & veg
  foodOkra:        '1665332561290-cc6757172890', // African okra soup
  chefPreparing:   '1488992783499-418eb1f62d08', // chef cooking
  chefPlating:     '1663530761401-15eefb544889', // chef plating
} as const;

/* ─── Nav ─── */
function TopNav() {
  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 bg-gold-400/10 ring-1 ring-gold-400/30 rounded-lg">
              <ChefHat className="w-5 h-5 text-gold-400" />
            </div>
            <span className="text-lg font-bold text-neutral-100 tracking-tight">Restoflow</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:inline-flex text-sm font-medium text-neutral-300 hover:text-neutral-100 transition px-3 py-2 rounded-lg hover:bg-neutral-900"
            >
              Se connecter
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 bg-gold-400 hover:bg-gold-300 text-black text-sm font-bold px-4 py-2 rounded-lg transition"
            >
              Créer un restaurant
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background photo */}
      <div className="absolute inset-0 bg-neutral-900">
        <img
          src={unsplashUrl(PHOTOS.hero, 1600, 80)}
          alt="Restaurant ambiance"
          className="w-full h-full object-cover object-center opacity-50"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        {/* Gold glow from top */}
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_30%_-10%,rgba(212,175,55,0.15),transparent)] pointer-events-none" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-gold-400/10 border border-gold-400/30 text-gold-400 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-8 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" />
            Plateforme pensée pour l'Afrique de l'Ouest
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-neutral-100 leading-tight tracking-tight mb-6">
            Pilotez votre restaurant,{' '}
            <span className="text-gold-400">de la cuisine à la caisse.</span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-300 mb-10 leading-relaxed">
            Restoflow est la solution tout-en-un pour gérer votre restaurant : menu, stock, salle,
            cuisine, caisse et rapports — en FCFA, en français, sur tous vos appareils.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-black font-bold px-7 py-4 rounded-xl text-base transition shadow-xl shadow-gold-400/25 hover:shadow-gold-400/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ChefHat className="w-5 h-5" />
              Créer mon restaurant
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border border-neutral-600 hover:border-neutral-400 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-neutral-200 hover:text-neutral-100 font-medium px-7 py-4 rounded-xl text-base transition"
            >
              Voir une démo / Se connecter
            </Link>
          </div>

          {/* Reassurance */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-400">
            {['Sans engagement', 'Activation rapide', 'Support WhatsApp'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-gold-400/70 flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade to black */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </section>
  );
}

/* ─── Trust Stats ─── */
const STATS = [
  { icon: Zap,        label: 'Tout-en-un',         sub: 'Caisse · Menu · Cuisine · Rapports' },
  { icon: Banknote,   label: 'En FCFA',             sub: 'Conçu pour l\'Afrique de l\'Ouest' },
  { icon: MessageCircle, label: 'Support WhatsApp', sub: 'Réponse rapide, en français' },
  { icon: Shield,     label: 'Sans engagement',     sub: 'Aucune carte bancaire requise' },
] as const;

function TrustBand() {
  return (
    <section className="py-10 bg-neutral-950 border-y border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-gold-400/10 ring-1 ring-gold-400/20 rounded-xl mt-0.5">
                <Icon className="w-5 h-5 text-gold-400" />
              </div>
              <div>
                <p className="text-neutral-100 font-semibold text-sm leading-tight">{label}</p>
                <p className="text-neutral-500 text-xs mt-0.5 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Fonctionnalités ─── */
const FEATURES = [
  {
    icon: Banknote,
    title: 'Caisse & encaissement',
    description: 'Commandes rapides, paiements en FCFA, tickets de caisse, gestion des acomptes et remboursements.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Menu & stock',
    description: 'Créez votre carte, gérez les catégories, les variantes et surveillez votre stock en temps réel.',
  },
  {
    icon: LayoutGrid,
    title: 'Salle & tables',
    description: "Plan de salle interactif, suivi des tables, réservations et gestion de l'occupation.",
  },
  {
    icon: ChefHat,
    title: 'Cuisine / KDS',
    description: 'Tableau de bord cuisine (KDS) : les commandes arrivent en direct, le chef valide ticket par ticket.',
  },
  {
    icon: BarChart3,
    title: 'Rapports & trésorerie',
    description: "Chiffre d'affaires, dépenses, balance de trésorerie et statistiques détaillées par période.",
  },
  {
    icon: Users,
    title: 'Équipe & rôles',
    description: 'Invitez propriétaire, caissier, serveur, cuisinier — chacun voit uniquement son espace.',
  },
] as const;

function Features() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gold-400/10 border border-gold-400/25 text-gold-400 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
            <Star className="w-3.5 h-3.5" />
            Fonctionnalités
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
            Tout ce dont votre restaurant a besoin
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Une seule plateforme. Toutes les fonctionnalités. Zéro complexité inutile.
          </p>
        </div>

        {/* Grid with a side photo accent on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Feature cards — 2×3 on the left 3 cols */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-6
                           hover:border-gold-400/30 hover:ring-gold-400/10 hover:bg-neutral-950/90 transition-all duration-300
                           hover:-translate-y-0.5"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 bg-gold-400/10 ring-1 ring-gold-400/20 rounded-xl mb-4
                                group-hover:bg-gold-400/15 transition-colors">
                  <Icon className="w-5 h-5 text-gold-400" />
                </div>
                <h3 className="text-neutral-100 font-semibold text-base mb-2">{title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          {/* Side photos stack — right 2 cols */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Photo 1 */}
            <div className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[4/3] group">
              <img
                src={unsplashUrl(PHOTOS.chefPlating, 800, 80)}
                alt="Chef en train de dresser une assiette"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white/90 text-sm font-semibold">Cuisine en temps réel</p>
                <p className="text-white/60 text-xs mt-0.5">KDS : vos commandes arrivent directement en cuisine</p>
              </div>
            </div>

            {/* Photo 2 */}
            <div className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-[4/3] group">
              <img
                src={unsplashUrl(PHOTOS.tableSet, 800, 80)}
                alt="Table dressée pour le service"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white/90 text-sm font-semibold">Salle & réservations</p>
                <p className="text-white/60 text-xs mt-0.5">Plan interactif, suivi des tables en direct</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Galerie immersive ─── */
function Gallery() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-neutral-950/60">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gold-400/10 border border-gold-400/25 text-gold-400 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
            <ChefHat className="w-3.5 h-3.5" />
            L'expérience
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
            L'excellence à chaque service
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            De la cuisine à la salle, Restoflow vous accompagne pour offrir une expérience irréprochable.
          </p>
        </div>

        {/* Masonry-style 3-panel grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

          {/* Large left panel */}
          <div className="md:col-span-2 relative rounded-3xl overflow-hidden bg-neutral-900 min-h-[320px] md:min-h-[480px] group">
            <img
              src={unsplashUrl(PHOTOS.heroPeople, 1200, 80)}
              alt="Salle de restaurant animée"
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="inline-flex items-center gap-1.5 bg-gold-400/20 border border-gold-400/30 text-gold-400 text-xs font-bold px-2.5 py-1 rounded-full mb-3 backdrop-blur-sm">
                <Star className="w-3 h-3" />
                Expérience client
              </div>
              <h3 className="text-white text-xl font-bold mb-1.5 leading-tight">
                Une salle bien gérée, des clients fidèles
              </h3>
              <p className="text-white/70 text-sm leading-relaxed">
                Plan de salle visuel, réservations, suivi d'occupation — tout sous contrôle,
                en temps réel, depuis n'importe quel appareil.
              </p>
            </div>
          </div>

          {/* Right column — 2 panels stacked */}
          <div className="flex flex-col gap-4 md:gap-6">

            {/* Panel: food */}
            <div className="relative rounded-3xl overflow-hidden bg-neutral-900 min-h-[220px] md:min-h-0 flex-1 group">
              <img
                src={unsplashUrl(PHOTOS.foodJollof, 800, 80)}
                alt="Plat africain savoureux"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white text-base font-bold mb-1">Votre menu, digitalisé</h3>
                <p className="text-white/65 text-xs leading-snug">
                  Plats, variantes, catégories — modifiez votre carte en temps réel.
                </p>
              </div>
            </div>

            {/* Panel: chef */}
            <div className="relative rounded-3xl overflow-hidden bg-neutral-900 min-h-[220px] md:min-h-0 flex-1 group">
              <img
                src={unsplashUrl(PHOTOS.chefPreparing, 800, 80)}
                alt="Chef en cuisine"
                loading="lazy"
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white text-base font-bold mb-1">Le chef, toujours informé</h3>
                <p className="text-white/65 text-xs leading-snug">
                  KDS : commandes en direct, validation ticket par ticket.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Second row — 3 equal photos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-6">
          {[
            { id: PHOTOS.foodGrilled,     title: 'Grillades & saveurs',   sub: 'Valorisez vos spécialités avec un menu digital soigné.' },
            { id: PHOTOS.ambianceOrange,  title: 'Ambiance & chaleur',    sub: 'Un suivi salle qui préserve l\'expérience de vos convives.' },
            { id: PHOTOS.restaurantLight, title: 'Décor & élégance',      sub: 'Gérez réservations et occupation sans perdre en hospitalité.' },
          ].map(({ id, title, sub }) => (
            <div key={id} className="relative rounded-2xl overflow-hidden bg-neutral-900 min-h-[200px] group">
              <img
                src={unsplashUrl(id, 800, 80)}
                alt={title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white/95 text-sm font-semibold">{title}</p>
                <p className="text-white/55 text-xs mt-0.5 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Comment ça marche ─── */
const STEPS = [
  {
    num: '01',
    title: 'Créez votre restaurant',
    description: 'Inscription gratuite en moins de 2 minutes. Aucune carte bancaire requise. Vous entrez en mode préparation.',
  },
  {
    num: '02',
    title: 'Configurez en mode préparation',
    description: "Ajoutez votre menu, vos tables, vos catégories. Testez librement — aucune donnée n'est définitive.",
  },
  {
    num: '03',
    title: 'La plateforme active votre restaurant',
    description: "L'équipe Restoflow valide votre établissement. Vous recevez une confirmation et passez en mode production.",
  },
  {
    num: '04',
    title: 'Invitez votre équipe et lancez !',
    description: 'Partagez le lien d\'invitation par WhatsApp. Caissiers, serveurs, cuisiniers rejoignent en un clic.',
  },
] as const;

function HowItWorks() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text side */}
          <div>
            <div className="inline-flex items-center gap-2 bg-gold-400/10 border border-gold-400/25 text-gold-400 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
              <Clock className="w-3.5 h-3.5" />
              Démarrage
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-neutral-400 text-lg mb-10">
              De l'inscription à l'ouverture de votre caisse en 4 étapes simples.
            </p>

            <div className="flex flex-col gap-5">
              {STEPS.map(({ num, title, description }, idx) => (
                <div
                  key={num}
                  className="flex gap-5 group"
                >
                  {/* Step number + connector */}
                  <div className="flex flex-col items-center">
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl
                                     bg-gold-400/10 border border-gold-400/30 text-gold-400 font-bold text-sm
                                     group-hover:bg-gold-400/20 transition-colors">
                      {num}
                    </span>
                    {idx < STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-neutral-800 mt-2 min-h-[20px]" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-5">
                    <h3 className="text-neutral-100 font-semibold mb-1.5">{title}</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Photo side */}
          <div className="relative">
            <div className="relative rounded-3xl overflow-hidden bg-neutral-900 aspect-[3/4] group">
              <img
                src={unsplashUrl(PHOTOS.foodOkra, 800, 80)}
                alt="Plats africains signature"
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
            {/* Floating card */}
            <div className="absolute bottom-6 left-6 right-6 bg-black/80 backdrop-blur-md border border-neutral-700 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-neutral-100 text-sm font-semibold">Activé en quelques minutes</p>
                  <p className="text-neutral-400 text-xs">Aucune installation requise — fonctionne sur mobile, tablette, PC.</p>
                </div>
              </div>
            </div>
            {/* Decorative gold blur */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gold-400/10 rounded-full blur-2xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── CTA finale ─── */
function CtaBanner() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-neutral-950/60">
      <div className="max-w-6xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background photo */}
          <div className="absolute inset-0 bg-neutral-900">
            <img
              src={unsplashUrl(PHOTOS.ambianceOrange, 1600, 80)}
              alt="Restaurant premium"
              loading="lazy"
              className="w-full h-full object-cover opacity-30"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/95 via-black/80 to-black/70" />
            {/* Gold glow */}
            <div className="absolute inset-0 bg-[radial-gradient(40rem_30rem_at_50%_0%,rgba(212,175,55,0.12),transparent)] pointer-events-none" />
            {/* Gold border glow */}
            <div className="absolute inset-0 ring-1 ring-gold-400/20 rounded-3xl pointer-events-none" />
          </div>

          {/* Content */}
          <div className="relative px-8 py-16 sm:px-14 sm:py-20 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-2xl mb-6">
              <Shield className="w-7 h-7 text-gold-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
              Prêt à démarrer ?
            </h2>
            <p className="text-neutral-300 text-lg mb-8 max-w-xl mx-auto">
              Rejoignez les restaurateurs qui font confiance à Restoflow pour gérer leur activité au quotidien.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-black font-bold px-9 py-4 rounded-xl text-base
                         transition shadow-xl shadow-gold-400/25 hover:shadow-gold-400/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ChefHat className="w-5 h-5" />
              Créer mon restaurant — gratuitement
            </Link>
            <p className="mt-5 text-sm text-neutral-500">
              Sans engagement · Activation rapide · Support WhatsApp
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-neutral-800 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div className="sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-9 h-9 bg-gold-400/10 ring-1 ring-gold-400/30 rounded-lg">
                <ChefHat className="w-5 h-5 text-gold-400" />
              </div>
              <span className="text-base font-bold text-neutral-100">Restoflow</span>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">
              La plateforme de gestion restaurant tout-en-un, pensée pour l'Afrique de l'Ouest.
              En FCFA, en français, sur tous vos appareils.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Plateforme</p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: 'Créer un restaurant', to: '/signup' },
                { label: 'Se connecter', to: '/login' },
              ].map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-neutral-400 hover:text-neutral-100 transition">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Contact</p>
            <div className="flex flex-col gap-3">
              <a
                href={AWEMA_CONTACT.whatsappUrl('Bonjour, je souhaite en savoir plus sur Restoflow.')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                WhatsApp {AWEMA_CONTACT.whatsappPhone}
              </a>
              <a
                href={AWEMA_CONTACT.mailtoUrl("Restoflow — demande d'information")}
                className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                {AWEMA_CONTACT.email}
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-neutral-600">
            © 2026 Restoflow — propulsé par{' '}
            <a
              href={AWEMA_CONTACT.whatsappUrl('Bonjour AwemA, je voudrais en savoir plus sur vos services.')}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-500 hover:text-neutral-300 transition"
            >
              AwemA
            </a>
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-700">Fait avec soin pour les restaurateurs africains</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <TopNav />
      <main>
        <Hero />
        <TrustBand />
        <Features />
        <Gallery />
        <HowItWorks />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
