import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { HelpCircle, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { HELP_GUIDES, type HelpGuide } from '../help/manifest';
import { renderMarkdown } from '../utils/markdown';

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function HelpPage() {
  const { currentUser, currentRole } = useAuth();
  const { guideId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const visible = useMemo<HelpGuide[]>(
    () =>
      HELP_GUIDES.filter(
        (g) => currentUser?.isSuperAdmin || (currentRole && g.roles.includes(currentRole))
      ),
    [currentUser, currentRole]
  );

  const filtered = useMemo<HelpGuide[]>(() => {
    const q = normalize(query.trim());
    if (!q) return visible;
    return visible.filter(
      (g) => normalize(g.title).includes(q) || g.keywords.some((k) => normalize(k).includes(q))
    );
  }, [visible, query]);

  const active: HelpGuide | null = visible.find((g) => g.id === guideId) ?? visible[0] ?? null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-100 mb-6">
        <HelpCircle className="w-7 h-7 text-amber-400" /> Centre d'aide
      </h1>

      {!active ? (
        <p className="text-neutral-400">Aucun guide disponible.</p>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <aside className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un guide…"
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg pl-9 pr-3 py-2 text-sm"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="text-neutral-500 text-sm px-1">Aucun guide ne correspond.</p>
            ) : (
              <nav aria-label="Guides d'aide" className="space-y-1">
                {filtered.map((g) => {
                  const Icon = (Icons as Record<string, any>)[g.icon] ?? HelpCircle;
                  const isActive = g.id === active.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => navigate(`/aide/${g.id}`)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                        isActive ? 'bg-amber-500 text-black font-medium' : 'text-neutral-300 hover:bg-neutral-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" /> {g.title}
                    </button>
                  );
                })}
              </nav>
            )}
          </aside>

          <article className="min-w-0">
            <div className="space-y-3 text-neutral-300 leading-relaxed">
              {renderMarkdown(active.content)}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
