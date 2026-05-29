import { describe, it, expect } from 'vitest';
import {
  computePayslip,
  computeIts,
  mergePayrollConfig,
  monthsWorkedInYear,
  buildDisaRows,
  DisaEmployeeInput,
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

  it('fournit un n° employeur CNPS par défaut vide, surchargeable', () => {
    expect(mergePayrollConfig(null).employerCnpsNumber).toBe('');
    expect(mergePayrollConfig({ employerCnpsNumber: 'EMP-99' }).employerCnpsNumber).toBe('EMP-99');
  });
});

describe('monthsWorkedInYear', () => {
  it('année complète (embauché avant, toujours en poste) = 12', () => {
    expect(monthsWorkedInYear(2026, new Date('2020-01-01'), null)).toBe(12);
  });
  it('embauché en cours d’année (15/04/2026) = avril→déc = 9', () => {
    expect(monthsWorkedInYear(2026, new Date('2026-04-15'), null)).toBe(9);
  });
  it('parti en cours d’année (30/06/2026) = janv→juin = 6', () => {
    expect(monthsWorkedInYear(2026, new Date('2020-01-01'), new Date('2026-06-30'))).toBe(6);
  });
  it('parti avant l’année = 0', () => {
    expect(monthsWorkedInYear(2026, new Date('2019-01-01'), new Date('2025-12-31'))).toBe(0);
  });
  it('embauché après l’année = 0', () => {
    expect(monthsWorkedInYear(2026, new Date('2027-01-01'), null)).toBe(0);
  });
});

describe('buildDisaRows', () => {
  const emps: DisaEmployeeInput[] = [
    { cnpsNumber: 'CI-1', lastName: 'Koné', firstName: 'Awa', birthDate: new Date('1990-05-01'), hireDate: new Date('2020-01-01'), endDate: null, salary: 200_000, salaryPeriod: 'mensuel' },
    { cnpsNumber: 'CI-2', lastName: 'Parti', firstName: 'Avant', birthDate: null, hireDate: new Date('2019-01-01'), endDate: new Date('2025-06-30'), salary: 150_000, salaryPeriod: 'mensuel' },
  ];
  it('exclut les employés n’ayant pas travaillé dans l’année', () => {
    const rows = buildDisaRows(2026, emps);
    expect(rows).toHaveLength(1);
    expect(rows[0].lastName).toBe('Koné');
  });
  it('assiette annuelle = brut mensuel × mois travaillés', () => {
    const rows = buildDisaRows(2026, emps);
    expect(rows[0].monthsWorked).toBe(12);
    expect(rows[0].annualGross).toBe(2_400_000); // 200000 × 12
  });
});
