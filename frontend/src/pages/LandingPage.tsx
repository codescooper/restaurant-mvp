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
} from 'lucide-react';
import { AWEMA_CONTACT } from '../utils/contact';

/* ─── Nav ─── */
function TopNav() {
  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
    <section className="relative pt-24 pb-20 sm:pt-32 sm:pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Extra radial for hero */}
      <div className="absolute inset-0 bg-[radial-gradient(60rem_50rem_at_50%_-5%,rgba(212,175,55,0.10),transparent)] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-gold-400/10 border border-gold-400/25 text-gold-400 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-8">
          <Zap className="w-3.5 h-3.5" />
          Plateforme pensée pour l'Afrique de l'Ouest
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-neutral-100 leading-tight tracking-tight mb-6">
          Pilotez votre restaurant,{' '}
          <span className="text-gold-400">de la cuisine à la caisse.</span>
        </h1>

        <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Restoflow est la solution tout-en-un pour gérer votre restaurant : menu, stock, salle,
          cuisine, caisse et rapports — en FCFA, en français, sur tous vos appareils.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-black font-bold px-7 py-3.5 rounded-xl text-base transition shadow-lg shadow-gold-400/20"
          >
            <ChefHat className="w-5 h-5" />
            Créer mon restaurant
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-neutral-100 font-medium px-7 py-3.5 rounded-xl text-base transition"
          >
            Voir une démo / Se connecter
          </Link>
        </div>

        {/* Reassurance */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
          {['Sans engagement', 'Activation rapide', 'Support WhatsApp'].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-gold-400/70" />
              {item}
            </span>
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
    description: 'Plan de salle interactif, suivi des tables, réservations et gestion de l\'occupation.',
  },
  {
    icon: ChefHat,
    title: 'Cuisine / KDS',
    description: 'Tableau de bord cuisine (KDS) : les commandes arrivent en direct, le chef valide ticket par ticket.',
  },
  {
    icon: BarChart3,
    title: 'Rapports & trésorerie',
    description: 'Chiffre d\'affaires, dépenses, balance de trésorerie et statistiques détaillées par période.',
  },
  {
    icon: Users,
    title: 'Équipe & rôles',
    description: 'Invitez propriétaire, caissier, serveur, cuisinier — chacun voit uniquement son espace.',
  },
] as const;

function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
            Tout ce dont votre restaurant a besoin
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Une seule plateforme. Toutes les fonctionnalités. Zéro complexité inutile.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-6 hover:border-neutral-700 hover:ring-gold-400/10 transition"
            >
              <div className="inline-flex items-center justify-center w-11 h-11 bg-gold-400/10 ring-1 ring-gold-400/20 rounded-xl mb-4">
                <Icon className="w-5 h-5 text-gold-400" />
              </div>
              <h3 className="text-neutral-100 font-semibold text-base mb-2">{title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
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
    description: 'Ajoutez votre menu, vos tables, vos catégories. Testez librement — aucune donnée n\'est définitive.',
  },
  {
    num: '03',
    title: 'La plateforme active votre restaurant',
    description: 'L\'équipe Restoflow valide votre établissement. Vous recevez une confirmation et passez en mode production.',
  },
  {
    num: '04',
    title: 'Invitez votre équipe et lancez !',
    description: 'Partagez le lien d\'invitation par WhatsApp. Caissiers, serveurs, cuisiniers rejoignent en un clic.',
  },
] as const;

function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-neutral-950/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-neutral-400 text-lg">
            De l'inscription à l'ouverture de votre caisse en 4 étapes simples.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {STEPS.map(({ num, title, description }) => (
            <div
              key={num}
              className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-6 flex gap-5"
            >
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/25 text-gold-400 font-bold text-sm">
                  {num}
                </span>
              </div>
              <div>
                <h3 className="text-neutral-100 font-semibold mb-1.5">{title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA finale ─── */
function CtaBanner() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative bg-neutral-950 border border-gold-400/20 ring-1 ring-gold-400/10 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
          {/* Gold glow */}
          <div className="absolute inset-0 bg-[radial-gradient(40rem_30rem_at_50%_0%,rgba(212,175,55,0.08),transparent)] pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-2xl mb-6">
              <Shield className="w-7 h-7 text-gold-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-4">
              Prêt à démarrer ?
            </h2>
            <p className="text-neutral-400 text-lg mb-8 max-w-xl mx-auto">
              Rejoignez les restaurateurs qui font confiance à Restoflow pour gérer leur activité au quotidien.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-black font-bold px-8 py-4 rounded-xl text-base transition shadow-lg shadow-gold-400/20"
            >
              <ChefHat className="w-5 h-5" />
              Créer mon restaurant — gratuitement
            </Link>
            <p className="mt-4 text-sm text-neutral-500">Sans engagement · Activation rapide · Support WhatsApp</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-neutral-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gold-400/10 ring-1 ring-gold-400/30 rounded-lg">
                <ChefHat className="w-4 h-4 text-gold-400" />
              </div>
              <span className="text-base font-bold text-neutral-100">Restoflow</span>
            </div>
            <p className="text-sm text-neutral-500">Gérez votre restaurant, simplement.</p>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">Contact</p>
            <a
              href={AWEMA_CONTACT.whatsappUrl('Bonjour, je souhaite en savoir plus sur Restoflow.')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp {AWEMA_CONTACT.whatsappPhone}
            </a>
            <a
              href={AWEMA_CONTACT.mailtoUrl('Restoflow — demande d\'information')}
              className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition"
            >
              <Mail className="w-4 h-4" />
              {AWEMA_CONTACT.email}
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800 text-center text-xs text-neutral-600">
          © 2026 Restoflow — propulsé par{' '}
          <a
            href={AWEMA_CONTACT.whatsappUrl('Bonjour AwemA, je voudrais en savoir plus sur vos services.')}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-500 hover:text-neutral-300 transition"
          >
            AwemA
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black bg-[radial-gradient(50rem_40rem_at_50%_-10%,rgba(212,175,55,0.12),transparent)] text-neutral-100">
      <TopNav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
