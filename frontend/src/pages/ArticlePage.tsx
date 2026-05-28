import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ChefHat, ArrowLeft, Calendar, User, Users, Star, BookOpen } from 'lucide-react';
import { publicArticleApi } from '../services/endpoints';
import { Article } from '../types';
import { renderMarkdown } from '../utils/markdown';

function formatDateFR(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const isBlog = location.pathname.startsWith('/blog');

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    publicArticleApi
      .getBySlug(slug)
      .then((a) => {
        setArticle(a);
        document.title = `${a.title} — Restoflow`;
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 404) {
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));

    return () => { document.title = 'Restoflow'; };
  }, [slug]);

  const backPath = isBlog ? '/blog' : '/success-stories';
  const backLabel = isBlog ? '← Journal' : '← Success Stories';

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center gap-6 px-4">
        <div className="flex items-center justify-center w-16 h-16 bg-gold-400/10 ring-1 ring-gold-400/20 rounded-2xl">
          <BookOpen className="w-8 h-8 text-gold-400/50" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-100">Article introuvable</h1>
        <p className="text-neutral-400 text-center max-w-xs">
          Cet article n'existe pas ou n'est pas encore publié.
        </p>
        <Link
          to={backPath}
          className="inline-flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-black font-bold px-5 py-2.5 rounded-xl transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {isBlog ? 'Retour au journal' : 'Retour aux témoignages'}
        </Link>
      </div>
    );
  }

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
              <Link
                to={backPath}
                className="hidden sm:inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition px-3 py-2 rounded-lg hover:bg-neutral-900"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
              </Link>
              <Link to="/signup" className="inline-flex items-center gap-1.5 bg-gold-400 hover:bg-gold-300 text-black text-sm font-bold px-4 py-2 rounded-lg transition">
                Créer un restaurant
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Cover hero */}
      {article.coverUrl && !imgError && (
        <div className="relative w-full h-64 sm:h-80 md:h-[420px] overflow-hidden bg-neutral-900">
          <img
            src={article.coverUrl}
            alt={article.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>
      )}

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        {/* Type badge */}
        <div className="pt-10 mb-4">
          {article.type === 'success_story' ? (
            <span className="inline-flex items-center gap-1.5 bg-gold-400/10 border border-gold-400/30 text-gold-400 text-xs font-bold px-3 py-1 rounded-full">
              <Star className="w-3 h-3" />
              Success Story
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs font-bold px-3 py-1 rounded-full">
              <BookOpen className="w-3 h-3" />
              Blog
            </span>
          )}
          {article.category && (
            <span className="ml-2 inline-flex items-center gap-1 bg-neutral-900 border border-neutral-700 text-neutral-400 text-xs px-2.5 py-1 rounded-full">
              {article.category}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-100 leading-tight mb-6">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 pb-6 mb-8 border-b border-neutral-800">
          {article.featuredName && (
            <span className="flex items-center gap-1.5 text-gold-400 font-semibold">
              <Users className="w-4 h-4" />
              {article.featuredName}
            </span>
          )}
          {article.authorName && (
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {article.authorName}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDateFR(article.publishedAt)}
            </span>
          )}
        </div>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-lg text-neutral-300 leading-relaxed mb-8 pl-4 border-l-2 border-gold-400/40 italic">
            {article.excerpt}
          </p>
        )}

        {/* Markdown content */}
        <div className="prose-restoflow">
          {renderMarkdown(article.content)}
        </div>

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-gold-400 hover:text-gold-300 font-medium transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {isBlog ? 'Retour au Journal Restoflow' : 'Retour aux Success Stories'}
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8 px-4 text-center text-sm text-neutral-600">
        <Link to="/" className="hover:text-neutral-400 transition">← Retour à l'accueil</Link>
        <span className="mx-3">·</span>
        <Link to="/blog" className="hover:text-neutral-400 transition">Blog</Link>
        <span className="mx-3">·</span>
        <Link to="/success-stories" className="hover:text-neutral-400 transition">Success Stories</Link>
      </footer>
    </div>
  );
}
