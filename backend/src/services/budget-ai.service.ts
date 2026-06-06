// ─────────────────────────────────────────────────────────────────────────────
// Couche IA OPTIONNELLE du module Budget (hybride). Enrichit une proposition
// déterministe avec des suggestions de postes non anticipés et une conclusion
// rédigée, via l'API Claude. Entièrement facultative et non bloquante :
//   • sans ANTHROPIC_API_KEY → renvoie null (le module reste 100 % heuristique) ;
//   • toute erreur API est capturée → renvoie null.
// Le moteur déterministe reste la SOURCE DE VÉRITÉ des chiffres ; l'IA n'ajoute
// que du qualitatif (texte). (cf. claude-api : modèle claude-opus-4-8)
// ─────────────────────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk';

export interface AiEnrichmentInput {
  restaurantName: string;
  targetTotal: number;
  reserveAmount: number;
  operatingTotal: number;
  postes: { name: string; planned: number }[];
  existingPostes: string[];
}

export interface AiEnrichment {
  suggestions: { poste: string; reason: string }[];
  conclusion: string;
}

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Extrait le premier objet JSON d'une réponse texte (du premier « { » au dernier « } »).
function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export async function enrichBudget(input: AiEnrichmentInput): Promise<AiEnrichment | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();

    const system =
      "Tu es un expert en gestion financière de restaurants en Côte d'Ivoire (montants en FCFA, entiers). " +
      "On te fournit une proposition de budget d'approvisionnement déjà chiffrée (ne recalcule PAS les montants). " +
      'Ta mission : (1) proposer des POSTES DE DÉPENSE pertinents qui ne figurent pas encore dans le plan ' +
      "(gaz, eau/électricité, transport, maintenance, nettoyage, communication, imprévus, etc. selon le contexte) ; " +
      '(2) rédiger une CONCLUSION concise (3 à 5 phrases) justifiant la répartition et la réserve stratégique. ' +
      'Réponds STRICTEMENT en JSON, sans texte autour, au format : ' +
      '{"suggestions":[{"poste":"...","reason":"..."}],"conclusion":"..."}';

    const user = JSON.stringify(input);

    const resp = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = resp.content.find((b) => b.type === 'text') as { text?: string } | undefined;
    const json = extractJson(textBlock?.text ?? '');
    if (!json) return null;

    const parsed = JSON.parse(json) as { suggestions?: unknown; conclusion?: unknown };
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s): s is { poste: string; reason?: string } => !!s && typeof (s as { poste?: unknown }).poste === 'string')
          .slice(0, 10)
          .map((s) => ({ poste: String(s.poste).slice(0, 80), reason: String(s.reason ?? '').slice(0, 300) }))
      : [];
    const conclusion = typeof parsed.conclusion === 'string' ? parsed.conclusion.slice(0, 3000) : '';

    return { suggestions, conclusion };
  } catch {
    // Couche optionnelle : on n'échoue jamais la génération à cause de l'IA.
    return null;
  }
}
