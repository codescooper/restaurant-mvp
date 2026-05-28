import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChefHat, ArrowRight, Calendar, User, BookOpen, Tag } from 'lucide-react';
import { publicArticleApi } from '../services/endpoints';
import { ArticleListItem } from '../types';

const CATEGORIES = [
  { value: '', label: 'Toutes' },
  { value: 'gestion', label: 'Gestion' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'strategie', label: 'Stratégie' },
  { value: 'cuisine-africaine', label: 'Cuisine africaine' },
  { value: 'conseils', label: 'Conseils' },
];

function formatDateFR(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function CoverFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-black">
      <div className="flex flex-col items-center gap-2 opacity-40">
        <BookOpen className="w-10 h-10 text-gold-400" />
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: ArticleListItem }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/blog/${article.slug}`}
      className="group flex flex-col bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden hover:border-gold-400/30 hover:shadow-lg hover:shadow-gold-400/5 transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Cover */}
      <div className="relative aspect-[16/9] overflow-hidden bg-neutral-900 flex-shrink-0">
        {article.coverUrl && !imgError ? (
          <img
            src={article.coverUrl}
            alt={article.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <CoverFallback />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {article.category && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-black/70 backdrop-blur-sm border border-gold-400/30 text-gold-400 text-xs font-semibold px-2.5 py-1 rounded-full">
            <Tag className="w-3 h-3" />
            {article.category}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <h2 className="text-neutral-100 font-bold text-base leading-snug mb-2 group-hover:text-gold-300 transition-colors line-clamp-2">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="text-neutral-400 text-sm leading-relaxed line-clamp-3 mb-4 flex-1">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap gap-y-1">
            {article.authorName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 flex-shrink-0" />
                {article.authorName}
              </span>
            )}
            {article.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                {formatDateFR(article.publishedAt)}
              </span>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-gold-400/60 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export default function BlogListPage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Le Journal Restoflow';
    return () => { document.title = 'Restoflow'; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    publicArticleApi
      .list({ type: 'blog', ...(category ? { category } : {}) })
      .then(setArticles)
      .catch(() => setError('Impossible de charger les articles.'))
      .finally(() => setLoading(false));
  }, [category]);

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
              <Link to="/success-stories" className="hidden sm:inline-flex text-sm text-neutral-400 hover:text-neutral-100 transition px-3 py-2 rounded-lg hover:bg-neutral-900">
                Success Stories
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
            <BookOpen className="w-3.5 h-3.5" />
            Blog
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-100 mb-4 leading-tight">
            Le Journal <span className="text-gold-400">Restoflow</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Conseils, stratégies et inspirations pour les restaurateurs d'Afrique de l'Ouest.
          </p>
        </div>
      </section>

      {/* Category filters */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                category === cat.value
                  ? 'bg-gold-400 text-black border-gold-400'
                  : 'bg-neutral-950 text-neutral-300 border-neutral-700 hover:border-gold-400/40 hover:text-neutral-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Articles grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20 text-neutral-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-20 text-neutral-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg">Aucun article dans cette catégorie pour le moment.</p>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </main>

      {/* Footer minimal */}
      <footer className="border-t border-neutral-800 py-8 px-4 text-center text-sm text-neutral-600">
        <Link to="/" className="hover:text-neutral-400 transition">← Retour à l'accueil</Link>
        <span className="mx-3">·</span>
        <Link to="/success-stories" className="hover:text-neutral-400 transition">Success Stories</Link>
      </footer>
    </div>
  );
}
