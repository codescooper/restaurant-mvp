import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  X,
  BookOpen,
  Star,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';
import { adminArticleApi } from '../../services/endpoints';
import { Article, ArticleType } from '../../types';
import { getApiError } from '../../services/api';
import { compressImage } from '../../utils/image';
import { renderMarkdown } from '../../utils/markdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleFormData {
  type: ArticleType;
  title: string;
  category: string;
  featuredName: string;
  authorName: string;
  excerpt: string;
  coverUrl: string;
  content: string;
}

const EMPTY_FORM: ArticleFormData = {
  type: 'blog',
  title: '',
  category: '',
  featuredName: '',
  authorName: '',
  excerpt: '',
  coverUrl: '',
  content: '',
};

const BLOG_CATEGORIES = [
  { value: '', label: '— Aucune —' },
  { value: 'gestion', label: 'Gestion' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'strategie', label: 'Stratégie' },
  { value: 'cuisine-africaine', label: 'Cuisine africaine' },
  { value: 'conseils', label: 'Conseils' },
];

// ─── Badges ──────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ArticleType }) {
  if (type === 'success_story') {
    return (
      <span className="inline-flex items-center gap-1 bg-gold-400/10 border border-gold-400/25 text-gold-400 text-xs font-semibold px-2 py-0.5 rounded-full">
        <Star className="w-3 h-3" /> Success
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs font-semibold px-2 py-0.5 rounded-full">
      <BookOpen className="w-3 h-3" /> Blog
    </span>
  );
}

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-full">
        <Eye className="w-3 h-3" /> Publié
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full">
      <EyeOff className="w-3 h-3" /> Brouillon
    </span>
  );
}

// ─── Cover input ─────────────────────────────────────────────────────────────

function CoverInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImage(file, 1280, 0.7);
      onChange(dataUrl);
    } catch {
      // ignore
    } finally {
      setCompressing(false);
    }
    // reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition ${
            mode === 'url'
              ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
              : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600'
          }`}
        >
          URL (Unsplash…)
        </button>
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition ${
            mode === 'file'
              ? 'bg-gold-400/10 border-gold-400/30 text-gold-400'
              : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600'
          }`}
        >
          Upload fichier
        </button>
      </div>

      {mode === 'url' ? (
        <input
          type="text"
          placeholder="https://images.unsplash.com/…"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-gold-400/50"
        />
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="block w-full text-sm text-neutral-400
              file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-700
              file:text-xs file:font-medium file:bg-neutral-900 file:text-neutral-300
              hover:file:bg-neutral-800 cursor-pointer"
          />
          {compressing && (
            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Compression…
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      {value && (
        <div className="relative mt-1">
          <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800">
            <img
              src={value}
              alt="Aperçu cover"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-black/70 rounded-full text-neutral-300 hover:text-white transition"
            aria-label="Supprimer la cover"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {!value && (
        <div className="w-full aspect-[16/9] rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-neutral-700" />
        </div>
      )}
    </div>
  );
}

// ─── Article Editor Modal ─────────────────────────────────────────────────────

function ArticleEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Article | null;
  onClose: () => void;
  onSaved: (a: Article) => void;
}) {
  const [form, setForm] = useState<ArticleFormData>(() =>
    initial
      ? {
          type: initial.type,
          title: initial.title,
          category: initial.category ?? '',
          featuredName: initial.featuredName ?? '',
          authorName: initial.authorName ?? '',
          excerpt: initial.excerpt ?? '',
          coverUrl: initial.coverUrl ?? '',
          content: initial.content,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const set = <K extends keyof ArticleFormData>(k: K, v: ArticleFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const buildPayload = (status: 'draft' | 'published') => ({
    type: form.type,
    title: form.title.trim(),
    content: form.content,
    excerpt: form.excerpt.trim() || undefined,
    coverUrl: form.coverUrl.trim() || undefined,
    category: form.category.trim() || undefined,
    authorName: form.authorName.trim() || undefined,
    featuredName: form.featuredName.trim() || undefined,
    status,
  });

  const handleSave = async (status: 'draft' | 'published') => {
    if (!form.title.trim()) { setError('Le titre est requis.'); return; }
    if (!form.content.trim()) { setError('Le contenu est requis.'); return; }
    setSaving(true);
    setError('');
    try {
      let saved: Article;
      if (initial) {
        saved = await adminArticleApi.update(initial.id, buildPayload(status));
      } else {
        saved = await adminArticleApi.create(buildPayload(status));
      }
      onSaved(saved);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-3xl my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-100">
            {initial ? 'Éditer l\'article' : 'Nouvel article'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-lg px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Type
            </label>
            <div className="relative">
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value as ArticleType)}
                className="w-full appearance-none bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-gold-400/50 pr-8"
              >
                <option value="blog">Article de blog</option>
                <option value="success_story">Success Story</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Titre <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Titre de l'article"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-gold-400/50"
            />
          </div>

          {/* Category (blog) / Featured name (success_story) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {form.type === 'blog' ? (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Catégorie
                </label>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    className="w-full appearance-none bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-gold-400/50 pr-8"
                  >
                    {BLOG_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Nom mis en avant (resto / personne)
                </label>
                <input
                  type="text"
                  value={form.featuredName}
                  onChange={(e) => set('featuredName', e.target.value)}
                  placeholder="Ex. Restaurant Chez Kofi"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-gold-400/50"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Auteur
              </label>
              <input
                type="text"
                value={form.authorName}
                onChange={(e) => set('authorName', e.target.value)}
                placeholder="Ex. Équipe Restoflow"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-gold-400/50"
              />
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Résumé court (excerpt)
            </label>
            <textarea
              value={form.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
              rows={2}
              placeholder="Une phrase ou deux qui accrochent le lecteur…"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-gold-400/50 resize-none"
            />
          </div>

          {/* Cover */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Image de couverture
            </label>
            <CoverInput value={form.coverUrl} onChange={(v) => set('coverUrl', v)} />
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Contenu (Markdown) <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs text-gold-400/70 hover:text-gold-400 transition flex items-center gap-1"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? 'Masquer aperçu' : 'Aperçu live'}
              </button>
            </div>

            {/* Markdown cheat sheet */}
            <p className="text-xs text-neutral-600 mb-2 font-mono leading-relaxed">
              # Titre &nbsp; ## Sous-titre &nbsp; **gras** &nbsp; *italique* &nbsp; - élément de liste &nbsp; [texte](https://url)
            </p>

            <div className={`grid gap-4 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              <textarea
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                rows={14}
                placeholder="Rédigez votre article en Markdown…"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-gold-400/50 resize-y font-mono leading-relaxed"
              />
              {showPreview && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 overflow-y-auto max-h-80 text-sm">
                  {form.content.trim()
                    ? renderMarkdown(form.content)
                    : <p className="text-neutral-600 italic">L'aperçu s'affiche ici…</p>
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:text-neutral-200 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="px-4 py-2 rounded-xl text-sm border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Enregistrer en brouillon'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('published')}
            className="px-5 py-2 rounded-xl text-sm bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Enregistrer et publier'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Content Manager ─────────────────────────────────────────────────────────

export default function ContentManager() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Article | null | 'new'>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    adminArticleApi
      .list()
      .then(setArticles)
      .catch((e) => setError(getApiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleToggleStatus = async (a: Article) => {
    setBusyId(a.id);
    const newStatus = a.status === 'published' ? 'draft' : 'published';
    try {
      const updated = await adminArticleApi.setStatus(a.id, newStatus);
      setArticles((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    setBusyId(deleteId);
    try {
      await adminArticleApi.remove(deleteId);
      setArticles((prev) => prev.filter((a) => a.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = (saved: Article) => {
    setArticles((prev) => {
      const exists = prev.find((a) => a.id === saved.id);
      if (exists) return prev.map((a) => (a.id === saved.id ? saved : a));
      return [saved, ...prev];
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-100">Gestion du contenu</h2>
          <p className="text-xs text-neutral-500">Blog & Success Stories</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1.5 bg-gold-400 hover:bg-gold-300 text-black text-sm font-bold px-4 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Nouvel article
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-lg px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-500 border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Titre</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Statut</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-neutral-600">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td>
              </tr>
            )}
            {!loading && articles.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-neutral-600 text-sm">
                  Aucun article. Créez le premier !
                </td>
              </tr>
            )}
            {!loading && articles.map((a) => (
              <tr key={a.id} className="border-b border-neutral-900 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-100 line-clamp-1">{a.title}</div>
                  <div className="text-xs text-neutral-600 mt-0.5 line-clamp-1">/{a.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={a.type} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500 hidden sm:table-cell">
                  {a.publishedAt
                    ? new Date(a.publishedAt).toLocaleDateString('fr-FR')
                    : new Date(a.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    {/* Toggle status */}
                    <button
                      disabled={busyId === a.id}
                      onClick={() => handleToggleStatus(a)}
                      title={a.status === 'published' ? 'Dépublier' : 'Publier'}
                      className={`p-1.5 rounded-lg border text-xs transition ${
                        a.status === 'published'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
                      } disabled:opacity-50`}
                    >
                      {busyId === a.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : a.status === 'published' ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => setEditing(a)}
                      className="p-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 transition"
                      title="Éditer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className="p-1.5 rounded-lg border border-rose-500/20 text-rose-400/70 hover:text-rose-400 hover:border-rose-500/40 transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor modal */}
      {editing !== null && (
        <ArticleEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-neutral-100 mb-2">Supprimer cet article ?</h3>
            <p className="text-sm text-neutral-400 mb-5">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-200 transition"
              >
                Annuler
              </button>
              <button
                disabled={busyId !== null}
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-50"
              >
                {busyId !== null ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
