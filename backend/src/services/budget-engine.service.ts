// ─────────────────────────────────────────────────────────────────────────────
// Moteur de répartition du budget d'approvisionnement (PUR, testable sans DB).
//
// À partir d'un budget cible, d'un % de réserve et de signaux par article
// (dépense d'achat historique, rotation des ventes, réappro sous seuil), répartit
// le budget d'exploitation entre les postes/lignes, ajoute la réserve stratégique
// et propose des suggestions de postes non anticipés.
//
// Tous les montants sont des entiers FCFA. La répartition est déterministe :
// même entrée ⇒ même sortie (les arrondis résiduels vont à la plus grosse ligne).
// ─────────────────────────────────────────────────────────────────────────────
import {
  BudgetTemplateSection,
  BudgetLineSource,
  BUDGET_DEFAULT_POSTE,
  SUGGESTED_EXTRA_POSTES,
  DEFAULT_BUDGET_TEMPLATE,
} from '../constants';

// Signal de demande pour un article de stock. Les trois composantes sont
// exprimées en FCFA-équivalent mensuel pour être additionnées avec leurs poids.
export interface DemandSignal {
  stockItemId: number;
  label: string;
  unit: string | null;
  unitPrice: number | null;
  poste: string; // catégorie budgétaire de l'article (ou « Divers »)
  purchaseSpend: number; // dépense d'achat mensuelle moyenne (FCFA)
  rotationSpend: number; // valeur de consommation mensuelle estimée (FCFA)
  replenishSpend: number; // réappro estimée si sous le seuil d'alerte, sinon 0 (FCFA)
}

export interface AllocationInput {
  targetTotal: number;
  reservePercent: number; // 0..100
  weights: { purchases: number; rotation: number; threshold: number };
  signals: DemandSignal[];
  template?: BudgetTemplateSection[];
}

export interface ProposalLine {
  label: string;
  stockItemId: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  source: BudgetLineSource;
}
export interface ProposalPoste {
  name: string;
  plannedAmount: number;
  lines: ProposalLine[];
}
export interface ProposalSection {
  name: string;
  postes: ProposalPoste[];
}
export interface BudgetSuggestion {
  poste: string;
  reason: string;
}
export interface BudgetProposal {
  targetTotal: number;
  reserveAmount: number;
  operatingTotal: number;
  sections: ProposalSection[];
  suggestions: BudgetSuggestion[];
  usedFallback: boolean; // true = aucune donnée → modèle manuel
}

const SECTION_RESERVE = 'Réserve stratégique';
const SECTION_OTHER = 'Autres dépenses';

// Composante dominante d'un signal → source de la ligne (pour tracer la provenance).
function dominantSource(
  s: DemandSignal,
  w: AllocationInput['weights']
): BudgetLineSource {
  const p = w.purchases * s.purchaseSpend;
  const r = w.rotation * s.rotationSpend;
  const t = w.threshold * s.replenishSpend;
  if (t >= p && t >= r && t > 0) return 'seuil';
  if (r >= p && r > 0) return 'rotation';
  if (p > 0) return 'historique';
  return 'manuel';
}

function scoreOf(s: DemandSignal, w: AllocationInput['weights']): number {
  return w.purchases * s.purchaseSpend + w.rotation * s.rotationSpend + w.threshold * s.replenishSpend;
}

// Associe chaque poste à sa section d'après le modèle ; postes inconnus → « Autres dépenses ».
function buildPosteToSection(template: BudgetTemplateSection[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const sec of template) for (const poste of sec.postes) map.set(poste, sec.name);
  return map;
}

// Répartit `total` proportionnellement aux `weights` en entiers, le reste d'arrondi
// allant à l'indice de plus gros poids (répartition déterministe, somme exacte).
function distributeIntegers(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((wt) => (wt / sum) * total);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  // Distribue le reste aux plus grosses parties fractionnaires (déterministe).
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] += 1;
    remainder -= 1;
  }
  return floored;
}

export function computeAllocation(input: AllocationInput): BudgetProposal {
  const template = input.template ?? DEFAULT_BUDGET_TEMPLATE;
  const reservePercent = Math.min(100, Math.max(0, input.reservePercent));
  const reserveAmount = Math.round((input.targetTotal * reservePercent) / 100);
  const operatingTotal = Math.max(0, input.targetTotal - reserveAmount);

  const posteToSection = buildPosteToSection(template);
  const sectionNames = template.map((s) => s.name);

  // Conserve toute la structure du modèle (postes vides inclus) pour l'édition.
  const postes = new Map<string, ProposalPoste>();
  const sectionOf = new Map<string, string>();
  const ensurePoste = (name: string, section: string) => {
    if (!postes.has(name)) postes.set(name, { name, plannedAmount: 0, lines: [] });
    if (!sectionOf.has(name)) sectionOf.set(name, section);
  };
  for (const sec of template) for (const p of sec.postes) ensurePoste(p, sec.name);

  const scored = input.signals
    .map((s) => ({ s, score: scoreOf(s, input.weights) }))
    .filter((x) => x.score > 0);
  const totalScore = scored.reduce((a, x) => a + x.score, 0);
  const usedFallback = totalScore <= 0;

  if (usedFallback) {
    // Aucun signal exploitable : modèle manuel, budget réparti également entre les postes.
    const operatingPostes = [...postes.values()];
    const shares = distributeIntegers(operatingTotal, operatingPostes.map(() => 1));
    operatingPostes.forEach((p, i) => {
      p.plannedAmount = shares[i];
    });
  } else {
    // Répartition proportionnelle aux scores (somme exacte = operatingTotal).
    const amounts = distributeIntegers(operatingTotal, scored.map((x) => x.score));
    scored.forEach(({ s }, i) => {
      const amount = amounts[i];
      if (amount <= 0) return;
      const posteName = s.poste?.trim() || BUDGET_DEFAULT_POSTE;
      const section = posteToSection.get(posteName) ?? SECTION_OTHER;
      ensurePoste(posteName, section);
      const poste = postes.get(posteName)!;
      poste.plannedAmount += amount;
      poste.lines.push({
        label: s.label,
        stockItemId: s.stockItemId,
        unit: s.unit,
        unitPrice: s.unitPrice,
        amount,
        source: dominantSource(s, input.weights),
      });
    });
    // Tri des lignes par montant décroissant dans chaque poste.
    for (const p of postes.values()) p.lines.sort((a, b) => b.amount - a.amount);
  }

  // Regroupement en sections (ordre du modèle, puis « Autres dépenses »).
  const orderedSectionNames = [...sectionNames];
  for (const name of sectionOf.values()) {
    if (!orderedSectionNames.includes(name)) orderedSectionNames.push(name);
  }
  const sections: ProposalSection[] = [];
  for (const secName of orderedSectionNames) {
    const secPostes = [...postes.values()].filter((p) => sectionOf.get(p.name) === secName);
    if (secPostes.length) sections.push({ name: secName, postes: secPostes });
  }

  // Réserve stratégique : section dédiée d'un seul poste.
  if (reserveAmount > 0) {
    sections.push({
      name: SECTION_RESERVE,
      postes: [{ name: SECTION_RESERVE, plannedAmount: reserveAmount, lines: [] }],
    });
  }

  // Suggestions : postes pertinents souvent oubliés et absents du plan.
  const presentPostes = new Set([...postes.keys()].map((n) => n.toLowerCase()));
  const suggestions: BudgetSuggestion[] = [];
  for (const extra of SUGGESTED_EXTRA_POSTES) {
    if (!presentPostes.has(extra.toLowerCase())) {
      suggestions.push({
        poste: extra,
        reason: `Poste de dépense fréquent non prévu dans cette proposition — pensez à le budgéter.`,
      });
    }
  }

  return { targetTotal: input.targetTotal, reserveAmount, operatingTotal, sections, suggestions, usedFallback };
}
