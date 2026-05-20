import sanitizeHtml from 'sanitize-html';

// Supprime tout HTML/script des chaines (§14.6).
export function sanitize(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

// Nettoie recursivement les chaines d'un objet (utilise par un middleware global).
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitize(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}
