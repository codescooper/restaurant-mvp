import { describe, it, expect } from 'vitest';
import {
  computePayslip,
  computeIts,
  mergePayrollConfig,
} from '../services/payroll.service';
import { DEFAULT_PAYROLL_CONFIG, PayrollConfig } from '../constants';

const cfg = DEFAULT_PAYROLL_CONFIG;

describe('computePayslip — config par défaut, salaire sous les plafonds', () => {
  const r = computePayslip(200_000, cfg);

  it('retient la retraite salariale 6,3 % + CMU forfait', () => {
    const retraite = r.employeeLines.find((l) => l.key === 'retraite');
    expect(retraite?.amount).toBe(12_600); // 200000 * 6.3%
    const cmu = r.employeeLines.find((l) => l.key === 'cmu');
    expect(cmu?.amount).toBe(500);
  });

  it('ne crée pas de ligne salariale pour les cotisations 100 % patronales', () => {
    expect(r.employeeLines.find((l) => l.key === 'prestationsFamiliales')).toBeUndefined();
    expect(r.employeeLines.find((l) => l.key === 'accidentTravail')).toBeUndefined();
  });

  it('total retenues salariales = 13 100 et net = 186 900 (ITS désactivé)', () => {
    expect(r.its).toBe(0);
    expect(r.totalEmployee).toBe(13_100);
    expect(r.netSalary).toBe(186_900);
  });

  it('charges patronales plafonnées à 70 000 sauf retraite', () => {
    const find = (k: string) => r.employerLines.find((l) => l.key === k)?.amount;
    expect(find('retraite')).toBe(15_400); // 200000 * 7.7%
    expect(find('prestationsFamiliales')).toBe(3_500); // 70000 * 5%
    expect(find('maternite')).toBe(525); // 70000 * 0.75%
    expect(find('accidentTravail')).toBe(1_400); // 70000 * 2%
    expect(find('cmu')).toBe(500);
    expect(r.totalEmployer).toBe(21_325);
    expect(r.employerCost).toBe(221_325); // brut + charges
  });
});

describe('computePayslip — plafond retraite (45×SMIG)', () => {
  it('plafonne la base retraite à 3 375 000', () => {
    const r = computePayslip(4_000_000, cfg);
    const retraiteEmp = r.employeeLines.find((l) => l.key === 'retraite');
    expect(retraiteEmp?.base).toBe(3_375_000);
    expect(retraiteEmp?.amount).toBe(212_625); // 3 375 000 * 6.3%
    const retraiteEr = r.employerLines.find((l) => l.key === 'retraite');
    expect(retraiteEr?.amount).toBe(259_875); // 3 375 000 * 7.7%
  });
});

describe('computePayslip — CMU même à bas salaire', () => {
  it('applique le forfait CMU salarié + patronal', () => {
    const r = computePayslip(50_000, cfg);
    expect(r.employeeLines.find((l) => l.key === 'cmu')?.amount).toBe(500);
    expect(r.employerLines.find((l) => l.key === 'cmu')?.amount).toBe(500);
  });
});

describe('computeIts — barème progressif par défaut', () => {
  const brackets = cfg.its.brackets;
  it('0 sous la première tranche (≤ 75 000)', () => {
    expect(computeIts(50_000, brackets)).toBe(0);
    expect(computeIts(75_000, brackets)).toBe(0);
  });
  it('300 000 → 39 000 (16 % puis 21 %)', () => {
    // (240000-75000)*16% + (300000-240000)*21% = 26400 + 12600
    expect(computeIts(300_000, brackets)).toBe(39_000);
  });
  it('1 000 000 → tranches jusqu’à 24 %', () => {
    // 165000*16% + 560000*21% + 200000*24% = 26400 + 117600 + 48000
    expect(computeIts(1_000_000, brackets)).toBe(192_000);
  });
});

describe('computePayslip — ITS activé', () => {
  it('retient l’ITS en plus des cotisations quand activé', () => {
    const withIts: PayrollConfig = { ...cfg, its: { ...cfg.its, enabled: true } };
    const r = computePayslip(300_000, withIts);
    expect(r.its).toBe(39_000);
    // retraite 300000*6.3% = 18900 ; + CMU 500 ; + ITS 39000
    expect(r.totalEmployee).toBe(18_900 + 500 + 39_000);
    expect(r.netSalary).toBe(300_000 - (18_900 + 500 + 39_000));
  });
});

describe('computePayslip — robustesse', () => {
  it('salaire négatif ramené à 0', () => {
    const r = computePayslip(-5000, cfg);
    expect(r.grossSalary).toBe(0);
    expect(r.netSalary).toBe(0);
    expect(r.totalEmployee).toBe(0);
  });
});

describe('mergePayrollConfig', () => {
  it('null / vide → défauts complets', () => {
    expect(mergePayrollConfig(null)).toEqual(cfg);
    expect(mergePayrollConfig({})).toEqual(cfg);
  });

  it('fusionne un réglage partiel (accident sectoriel 5 %)', () => {
    const merged = mergePayrollConfig({ accidentTravail: { employer: 5 } });
    expect(merged.accidentTravail.employer).toBe(5);
    expect(merged.accidentTravail.ceiling).toBe(70_000); // repli défaut
    expect(merged.retraite).toEqual(cfg.retraite); // intact
  });

  it('préserve un plafond null explicite', () => {
    const merged = mergePayrollConfig({ retraite: { employee: 6.3, employer: 7.7, ceiling: null } });
    expect(merged.retraite.ceiling).toBeNull();
  });

  it('trie les tranches ITS et tolère un barème custom', () => {
    const merged = mergePayrollConfig({
      its: { enabled: true, brackets: [{ upTo: null, rate: 30 }, { upTo: 100_000, rate: 10 }] },
    });
    expect(merged.its.enabled).toBe(true);
    expect(merged.its.brackets[0].upTo).toBe(100_000);
    expect(merged.its.brackets[1].upTo).toBeNull();
  });
});
