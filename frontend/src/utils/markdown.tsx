/**
 * renderMarkdown — parseur markdown maison, sans dangerouslySetInnerHTML.
 *
 * Sécurité : les caractères HTML spéciaux (<, >, &, ", ') sont échappés AVANT
 * tout traitement, donc aucune injection HTML n'est possible. Le contenu est
 * émis en JSX pur (React.createElement), jamais en HTML brut.
 *
 * Subset supporté :
 *   # / ## / ### titres
 *   **gras** / *italique*
 *   [texte](url) — liens uniquement http:// ou https://, target _blank
 *   - item   listes non-ordonnées
 *   Paragraphes séparés par lignes vides
 *   Sauts de ligne simples (↩ → <br />)
 */

import React from 'react';

// ─── Échappement HTML ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Inline styles (gras, italique, liens) ───────────────────────────────────

type InlineNode = string | React.ReactElement;

function parseInline(raw: string, keyPrefix: string): InlineNode[] {
  // Pattern global : **gras** | *italique* | [txt](url)
  const RE = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;
  const nodes: InlineNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = RE.exec(raw)) !== null) {
    // Texte avant le match
    if (m.index > last) {
      nodes.push(escapeHtml(raw.slice(last, m.index)));
    }

    if (m[0].startsWith('**')) {
      // Gras
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx}`} className="font-bold text-neutral-100">
          {escapeHtml(m[2])}
        </strong>
      );
    } else if (m[0].startsWith('*')) {
      // Italique
      nodes.push(
        <em key={`${keyPrefix}-i-${idx}`} className="italic text-neutral-200">
          {escapeHtml(m[3])}
        </em>
      );
    } else {
      // Lien
      const href = m[5];
      nodes.push(
        <a
          key={`${keyPrefix}-a-${idx}`}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors"
        >
          {escapeHtml(m[4])}
        </a>
      );
    }

    last = m.index + m[0].length;
    idx++;
  }

  // Texte restant
  if (last < raw.length) {
    nodes.push(escapeHtml(raw.slice(last)));
  }

  return nodes;
}

// ─── Rendu d'une ligne avec sauts de ligne ────────────────────────────────────

function renderLineWithBreaks(line: string, keyPrefix: string): React.ReactNode {
  // On split sur les double-espaces + \n ou simplement sur \n (sauts forcés)
  const parts = line.split(/  \n|\n/);
  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    result.push(...parseInline(part, `${keyPrefix}-${i}`));
    if (i < parts.length - 1) {
      result.push(<br key={`${keyPrefix}-br-${i}`} />);
    }
  });
  return result;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function renderMarkdown(md: string): React.ReactNode {
  // Normalise les fins de ligne
  const text = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Découpe en blocs séparés par lignes vides
  const blocks = text.split(/\n{2,}/);
  const elements: React.ReactNode[] = [];

  blocks.forEach((block, blockIdx) => {
    const lines = block.split('\n').filter((l) => l.trim() !== '' || block.trim() !== '');
    if (lines.length === 0) return;

    const firstLine = lines[0];

    // ─ Titre ###
    if (/^### /.test(firstLine)) {
      elements.push(
        <h3
          key={`h3-${blockIdx}`}
          className="text-lg font-bold text-gold-300 mt-6 mb-2 leading-snug"
        >
          {parseInline(firstLine.slice(4), `h3-${blockIdx}`)}
        </h3>
      );
      if (lines.length > 1) {
        elements.push(
          <p key={`h3p-${blockIdx}`} className="text-neutral-300 leading-relaxed mb-4">
            {lines.slice(1).map((l, li) => (
              <React.Fragment key={li}>
                {renderLineWithBreaks(l, `h3p-${blockIdx}-${li}`)}
                {li < lines.length - 2 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      }
      return;
    }

    // ─ Titre ##
    if (/^## /.test(firstLine)) {
      elements.push(
        <h2
          key={`h2-${blockIdx}`}
          className="text-xl font-bold text-gold-400 mt-8 mb-3 leading-snug border-b border-neutral-800 pb-2"
        >
          {parseInline(firstLine.slice(3), `h2-${blockIdx}`)}
        </h2>
      );
      if (lines.length > 1) {
        elements.push(
          <p key={`h2p-${blockIdx}`} className="text-neutral-300 leading-relaxed mb-4">
            {lines.slice(1).map((l, li) => (
              <React.Fragment key={li}>
                {renderLineWithBreaks(l, `h2p-${blockIdx}-${li}`)}
                {li < lines.length - 2 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      }
      return;
    }

    // ─ Titre #
    if (/^# /.test(firstLine)) {
      elements.push(
        <h1
          key={`h1-${blockIdx}`}
          className="text-2xl sm:text-3xl font-extrabold text-neutral-100 mt-8 mb-4 leading-tight"
        >
          {parseInline(firstLine.slice(2), `h1-${blockIdx}`)}
        </h1>
      );
      if (lines.length > 1) {
        elements.push(
          <p key={`h1p-${blockIdx}`} className="text-neutral-300 leading-relaxed mb-4">
            {lines.slice(1).map((l, li) => (
              <React.Fragment key={li}>
                {renderLineWithBreaks(l, `h1p-${blockIdx}-${li}`)}
                {li < lines.length - 2 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      }
      return;
    }

    // ─ Liste non-ordonnée (toutes les lignes commencent par "- ")
    if (lines.every((l) => /^- /.test(l))) {
      elements.push(
        <ul
          key={`ul-${blockIdx}`}
          className="list-none space-y-1.5 mb-4 pl-4"
        >
          {lines.map((l, li) => (
            <li key={li} className="flex items-start gap-2 text-neutral-300 leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gold-400/70" />
              <span>{parseInline(l.slice(2), `ul-${blockIdx}-${li}`)}</span>
            </li>
          ))}
        </ul>
      );
      return;
    }

    // ─ Liste mixte (quelques lignes commencent par "- ")
    if (lines.some((l) => /^- /.test(l))) {
      const listItems = lines.filter((l) => /^- /.test(l));
      const rest = lines.filter((l) => !/^- /.test(l));
      if (rest.length > 0) {
        elements.push(
          <p key={`mp-${blockIdx}`} className="text-neutral-300 leading-relaxed mb-3">
            {rest.map((l, li) => (
              <React.Fragment key={li}>
                {renderLineWithBreaks(l, `mp-${blockIdx}-${li}`)}
                {li < rest.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      }
      elements.push(
        <ul key={`mul-${blockIdx}`} className="list-none space-y-1.5 mb-4 pl-4">
          {listItems.map((l, li) => (
            <li key={li} className="flex items-start gap-2 text-neutral-300 leading-relaxed">
              <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gold-400/70" />
              <span>{parseInline(l.slice(2), `mul-${blockIdx}-${li}`)}</span>
            </li>
          ))}
        </ul>
      );
      return;
    }

    // ─ Paragraphe
    elements.push(
      <p key={`p-${blockIdx}`} className="text-neutral-300 leading-relaxed mb-4">
        {lines.map((l, li) => (
          <React.Fragment key={li}>
            {renderLineWithBreaks(l, `p-${blockIdx}-${li}`)}
            {li < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });

  return <>{elements}</>;
}
