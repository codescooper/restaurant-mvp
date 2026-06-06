import { describe, it, expect } from 'vitest';
import { computeAllocation, DemandSignal, AllocationInput } from '../services/budget-engine.service';

const W = { purchases: 1, rotation: 0.5, threshold: 0.3 };

function signal(p: Partial<DemandSignal> & { stockItemId: number; label: string }): DemandSignal {
  return {
    unit: 'kg',
    unitPrice: null,
    poste: 'Cuisine',
    purchaseSpend: 0,
    rotationSpend: 0,
    replenishSpend: 0,
    ...p,
  };
}

// Somme de tous les montants de lignes + postes sans ligne (réserve), pour vérifier
// l'égalité exacte avec le budget cible (aucune fuite d'arrondi).
function totalOfPostes(proposal: ReturnType<typeof computeAllocation>): number {
  return proposal.sections
    .flatMap((s) => s.postes)
    .reduce((sum, p) => sum + p.plannedAmount, 0);
}

describe('computeAllocation — réserve et budget d’exploitation', () => {
  const input: AllocationInput = {
    targetTotal: 1_000_000,
    reservePercent: 20,
    weights: W,
    signals: [
      signal({ stockItemId: 1, label: 'Poulet', poste: 'Cuisine', purchaseSpend: 600_000 }),
      signal({ stockItemId: 2, label: 'Bière', poste: 'Bières', purchaseSpend: 200_000 }),
    ],
  };
  const r = computeAllocation(input);

  it('réserve = 20 % du budget global', () => {
    expect(r.reserveAmount).toBe(200_000);
    expect(r.operatingTotal).toBe(800_000);
  });

  it('la réserve stratégique apparaît comme une section dédiée', () => {
    const reserve = r.sections.find((s) => s.name === 'Réserve stratégique');
    expect(reserve?.postes[0].plannedAmount).toBe(200_000);
  });

  it('la somme de tous les postes = budget cible (réserve incluse)', () => {
    expect(totalOfPostes(r)).toBe(1_000_000);
  });
});

describe('computeAllocation — répartition proportionnelle', () => {
  // Avec poids rotation/threshold à 0, la répartition suit la dépense d’achat.
  const r = computeAllocation({
    targetTotal: 1_000_000,
    reservePercent: 20,
    weights: { purchases: 1, rotation: 0, threshold: 0 },
    signals: [
      signal({ stockItemId: 1, label: 'Poulet', poste: 'Cuisine', purchaseSpend: 600_000 }),
      signal({ stockItemId: 2, label: 'Bière', poste: 'Bières', purchaseSpend: 200_000 }),
    ],
  });

  it('répartit 800 000 dans le rapport 3:1 → 600 000 / 200 000', () => {
    const cuisine = r.sections.flatMap((s) => s.postes).find((p) => p.name === 'Cuisine');
    const bieres = r.sections.flatMap((s) => s.postes).find((p) => p.name === 'Bières');
    expect(cuisine?.plannedAmount).toBe(600_000);
    expect(bieres?.plannedAmount).toBe(200_000);
  });

  it('classe « Bières » sous la section « Boissons »', () => {
    const boissons = r.sections.find((s) => s.name === 'Boissons');
    expect(boissons?.postes.some((p) => p.name === 'Bières')).toBe(true);
  });
});

describe('computeAllocation — pas de fuite d’arrondi sur des montants indivisibles', () => {
  const r = computeAllocation({
    targetTotal: 1_000_000,
    reservePercent: 0,
    weights: { purchases: 1, rotation: 0, threshold: 0 },
    // trois parts incommensurables
    signals: [
      signal({ stockItemId: 1, label: 'A', poste: 'Cuisine', purchaseSpend: 1 }),
      signal({ stockItemId: 2, label: 'B', poste: 'Épicerie et Condiments', purchaseSpend: 1 }),
      signal({ stockItemId: 3, label: 'C', poste: 'Entretien', purchaseSpend: 1 }),
    ],
  });

  it('la somme des lignes vaut exactement le budget d’exploitation', () => {
    const lines = r.sections.flatMap((s) => s.postes).flatMap((p) => p.lines);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(1_000_000);
    expect(totalOfPostes(r)).toBe(1_000_000);
  });
});

describe('computeAllocation — repli modèle manuel (resto sans données)', () => {
  const r = computeAllocation({
    targetTotal: 800_000,
    reservePercent: 0,
    weights: W,
    signals: [], // aucun signal
  });

  it('signale l’usage du modèle de repli', () => {
    expect(r.usedFallback).toBe(true);
  });

  it('répartit le budget également sur les postes du modèle (somme exacte)', () => {
    expect(totalOfPostes(r)).toBe(800_000);
    // tous les postes du modèle sont présents
    const names = r.sections.flatMap((s) => s.postes).map((p) => p.name);
    expect(names).toContain('Cuisine');
    expect(names).toContain('Vins et Spiritueux');
  });
});

describe('computeAllocation — provenance des lignes (source)', () => {
  const r = computeAllocation({
    targetTotal: 1_000_000,
    reservePercent: 0,
    weights: W,
    signals: [
      signal({ stockItemId: 1, label: 'Historique', poste: 'Cuisine', purchaseSpend: 100_000 }),
      signal({ stockItemId: 2, label: 'Rotation', poste: 'Cuisine', rotationSpend: 100_000 }),
      signal({ stockItemId: 3, label: 'Seuil', poste: 'Cuisine', replenishSpend: 100_000 }),
    ],
  });
  const lines = r.sections.flatMap((s) => s.postes).flatMap((p) => p.lines);

  it('étiquette chaque ligne selon sa composante dominante', () => {
    expect(lines.find((l) => l.label === 'Historique')?.source).toBe('historique');
    expect(lines.find((l) => l.label === 'Rotation')?.source).toBe('rotation');
    expect(lines.find((l) => l.label === 'Seuil')?.source).toBe('seuil');
  });
});

describe('computeAllocation — suggestions de postes non anticipés', () => {
  it('suggère les postes pertinents absents du plan', () => {
    const r = computeAllocation({
      targetTotal: 500_000,
      reservePercent: 10,
      weights: W,
      signals: [signal({ stockItemId: 1, label: 'Poulet', poste: 'Cuisine', purchaseSpend: 100_000 })],
    });
    const postesSuggérés = r.suggestions.map((s) => s.poste);
    expect(postesSuggérés).toContain('Gaz de cuisine');
    expect(postesSuggérés).toContain('Maintenance équipement');
  });

  it('ne suggère pas un poste déjà présent dans le plan', () => {
    const r = computeAllocation({
      targetTotal: 500_000,
      reservePercent: 0,
      weights: W,
      signals: [signal({ stockItemId: 1, label: 'Bouteille de gaz', poste: 'Gaz de cuisine', purchaseSpend: 50_000 })],
    });
    expect(r.suggestions.map((s) => s.poste)).not.toContain('Gaz de cuisine');
  });

  it('classe un poste hors modèle sous « Autres dépenses »', () => {
    const r = computeAllocation({
      targetTotal: 500_000,
      reservePercent: 0,
      weights: W,
      signals: [signal({ stockItemId: 1, label: 'Bouteille de gaz', poste: 'Gaz de cuisine', purchaseSpend: 50_000 })],
    });
    const autres = r.sections.find((s) => s.name === 'Autres dépenses');
    expect(autres?.postes.some((p) => p.name === 'Gaz de cuisine')).toBe(true);
  });
});
