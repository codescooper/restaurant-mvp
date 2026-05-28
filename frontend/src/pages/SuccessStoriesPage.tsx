import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, ArrowRight, Calendar, Star, Users } from 'lucide-react';
import { publicArticleApi } from '../services/endpoints';
import { ArticleListItem } from '../types';

function formatDateFR(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function CoverFallback({ name }: { name: string | null }) {
  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?';
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold-400/20 via-neutral-900 to-black">
      <span className="text-3xl font-extrabold text-gold-400/60 select-none">{initials}</span>
    </div>
  );
}

function StoryCard({ article }: { article: ArticleListItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/success-stories/${article.slug}`}
      className="group flex flex-col bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden hover:border-gold-400/30 hover:shadow-lg hover:shadow-gold-400/5 transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Cover */}
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900 flex-shrink-0">
        {article.coverUrl && !imgError ? (
          <img
            src={article.coverUrl}
            alt={article.featuredName ?? article.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <CoverFallback name={article.featuredName} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {/* Gold badge top-right */}
        <div className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 bg-gold-400/20 border border-gold-400/40 rounded-full backdrop-blur-sm">
          <Star className="w-4 h-4 text-gold-400" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        {/* Featured name badge */}
        {article.featuredName && (
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-gold-400/70 flex-shrink-0" />
            <span className="text-gold-400 text-xs font-bold uppercase tracking-wide truncate">
              {article.featuredName}
            </span>
          </div>
        )}

        <h2 className="text-neutral-100 font-bold text-base leading-snug mb-2 group-hover:text-gold-300 transition-colors line-clamp-2">
          {article.title}
        </h2>

        {article.excerpt && (
          <p className="text-neutral-400 text-sm leading-relaxed line-clamp-3 mb-4 flex-1">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-neutral-800">
          {article.publishedAt ? (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              {formatDateFR(article.publishedAt)}
            </span>
          ) : (
            <span />
          )}
          <ArrowRight className="w-4 h-4 text-gold-400/60 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export default function SuccessStoriesPage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Success Stories — Restoflow';
    return () => { document.title = 'Restoflow'; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    publicArticleApi
      .list({ type: 'success_story' })
      .then(setArticles)
      .catch(() => setError('Impossible de charger les témoignages.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 bg-gold-400/10 ring-1 ring-gold-400/30 rounded-lg">
                <ChefHat className="w-5 h-5 text-gold-400" />
              </div>
              <span className="text-lg font-bold text-neutral-100 tracking-tight">Restoflow</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/blog" className="hidden sm:inline-flex text-sm text-neutral-400 hover:text-neutral-100 transition px-3 py-2 rounded-lg hover:bg-neutral-900">
                Blog
              </Link>
              <Link to="/login" className="hidden sm:inline-flex text-sm font-medium text-neutral-300 hover:text-neutral-100 transition px-3 py-2 rounded-lg hover:bg-neutral-900">
                Se connecter
              </Link>
              <Link to="/signup" className="inline-flex items-center gap-1.5 bg-gold-400 hover:bg-gold-300 text-black text-sm font-bold px-4 py-2 rounded-lg transition">
                Créer un restaurant
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgba(212,175,55,0.1),transparent)] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-gold-400/10 border border-gold-400/30 text-gold-400 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
            <Star className="w-3.5 h-3.5" />
            Témoignages
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-100 mb-4 leading-tight">
            Ils nous font <span className="text-gold-400">confiance</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Découvrez comment les restaurateurs africains transforment leur activité avec Restoflow.
          </p>
        </div>
      </section>

      {/* Stories grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20 text-neutral-400">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-20 text-neutral-500">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg">Les témoignages arrivent bientôt.</p>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </main>

      {/* Footer minimal */}
      <footer className="border-t border-neutral-800 py-8 px-4 text-center text-sm text-neutral-600">
        <Link to="/" className="hover:text-neutral-400 transition">← Retour à l'accueil</Link>
        <span className="mx-3">·</span>
        <Link to="/blog" className="hover:text-neutral-400 transition">Blog</Link>
      </footer>
    </div>
  );
}
