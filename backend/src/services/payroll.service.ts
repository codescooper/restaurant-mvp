import {
  PayrollConfig,
  ContributionRate,
  DEFAULT_PAYROLL_CONFIG,
  SETTING_PAYROLL_CONFIG,
} from '../constants';
import { getSetting, setSetting } from './settings.service';

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres de paie (CNPS / ITS) — éditables par restaurant.
// Stockés en JSON dans app_settings (clé payroll.config), fusionnés sur les défauts
// afin qu'un réglage partiel ou un ancien format reste valide.
// ─────────────────────────────────────────────────────────────────────────────

// Normalise une cotisation en tolérant les champs manquants (repli sur le défaut).
function mergeRate(stored: unknown, fallback: ContributionRate): ContributionRate {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  const ceil =
    s.ceiling === null ? null : typeof s.ceiling === 'number' && Number.isFinite(s.ceiling) ? s.ceiling : fallback.ceiling;
  return {
    employee: num(s.employee, fallback.employee),
    employer: num(s.employer, fallback.employer),
    ceiling: ceil,
  };
}

// Fusionne une config (potentiellement partielle / JSON brut) sur DEFAULT_PAYROLL_CONFIG.
export function mergePayrollConfig(stored: unknown): PayrollConfig {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const d = DEFAULT_PAYROLL_CONFIG;
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);

  const itsRaw = (s.its && typeof s.its === 'object' ? s.its : {}) as Record<string, unknown>;
  const brackets = Array.isArray(itsRaw.brackets) && itsRaw.brackets.length > 0
    ? itsRaw.brackets
        .map((b) => {
          const bo = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
          const upTo = bo.upTo === null ? null : typeof bo.upTo === 'number' ? bo.upTo : null;
          const rate = num(bo.rate, 0);
          return { upTo, rate };
        })
        // tri par borne haute croissante (la tranche supérieure upTo=null en dernier)
        .sort((a, b) => (a.upTo == null ? 1 : b.upTo == null ? -1 : a.upTo - b.upTo))
    : d.its.brackets;

  return {
    retraite: mergeRate(s.retraite, d.retraite),
    prestationsFamiliales: mergeRate(s.prestationsFamiliales, d.prestationsFamiliales),
    maternite: mergeRate(s.maternite, d.maternite),
    accidentTravail: mergeRate(s.accidentTravail, d.accidentTravail),
    cmuEmployee: num(s.cmuEmployee, d.cmuEmployee),
    cmuEmployer: num(s.cmuEmployer, d.cmuEmployer),
    employerCnpsNumber: typeof s.employerCnpsNumber === 'string' ? s.employerCnpsNumber : d.employerCnpsNumber,
    its: {
      enabled: typeof itsRaw.enabled === 'boolean' ? itsRaw.enabled : d.its.enabled,
      brackets,
    },
  };
}

export async function getPayrollConfig(): Promise<PayrollConfig> {
  const raw = await getSetting(SETTING_PAYROLL_CONFIG);
  if (!raw) return mergePayrollConfig(null);
  try {
    return mergePayrollConfig(JSON.parse(raw));
  } catch {
    return mergePayrollConfig(null);
  }
}

// Remplace la config (après fusion sur les défauts) et renvoie la version normalisée.
export async function setPayrollConfig(input: unknown): Promise<PayrollConfig> {
  const merged = mergePayrollConfig(input);
  await setSetting(SETTING_PAYROLL_CONFIG, JSON.stringify(merged), 'Paramètres de paie (CNPS / ITS)');
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcul du bulletin de paie — FONCTION PURE (testable sans DB).
// ─────────────────────────────────────────────────────────────────────────────

export interface PayslipLine {
  key: string;
  label: string;
  base: number; // base de calcul (FCFA) ; 0 pour un forfait
  rate: number; // % appliqué ; 0 pour un forfait
  amount: number; // montant (FCFA, arrondi)
}

export interface PayslipResult {
  grossSalary: number;
  employeeLines: PayslipLine[]; // retenues salariales (cotisations) hors ITS
  its: number; // impôt sur salaire retenu (0 si désactivé)
  employerLines: PayslipLine[]; // charges patronales
  totalEmployee: number; // total des retenues salariales (cotisations + ITS)
  totalEmployer: number; // total des charges patronales
  netSalary: number; // net à payer = brut − retenues salariales
  employerCost: number; // coût total employeur = brut + charges patronales
}

// Cotisation sur base plafonnée. side = 'employee' (retenue) ou 'employer' (charge).
function rateLine(
  key: string,
  label: string,
  gross: number,
  rate: ContributionRate,
  side: 'employee' | 'employer'
): PayslipLine | null {
  const pct = side === 'employee' ? rate.employee : rate.employer;
  if (pct <= 0) return null;
  const base = rate.ceiling != null ? Math.min(gross, rate.ceiling) : gross;
  const amount = Math.round((base * pct) / 100);
  if (amount <= 0) return null;
  return { key, label, base, rate: pct, amount };
}

// ITS progressif sur le salaire brut mensuel (sans crédit familial pour l'instant).
export function computeIts(gross: number, brackets: PayrollConfig['its']['brackets']): number {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    const cap = b.upTo == null ? gross : Math.min(gross, b.upTo);
    if (cap > prev) {
      tax += ((cap - prev) * b.rate) / 100;
      prev = cap;
    }
    if (b.upTo != null && gross <= b.upTo) break;
  }
  return Math.round(tax);
}

// Calcule un bulletin pour un salaire brut mensuel donné et une config.
export function computePayslip(grossSalary: number, config: PayrollConfig): PayslipResult {
  const gross = Math.max(0, Math.round(grossSalary));

  // Pas de rémunération → bulletin nul (aucune cotisation ni forfait ne s'applique).
  if (gross === 0) {
    return {
      grossSalary: 0,
      employeeLines: [],
      its: 0,
      employerLines: [],
      totalEmployee: 0,
      totalEmployer: 0,
      netSalary: 0,
      employerCost: 0,
    };
  }

  const employeeLines: PayslipLine[] = [];
  const employerLines: PayslipLine[] = [];

  const branches: { key: string; label: string; rate: ContributionRate }[] = [
    { key: 'retraite', label: 'Retraite / Pension CNPS', rate: config.retraite },
    { key: 'prestationsFamiliales', label: 'Prestations familiales', rate: config.prestationsFamiliales },
    { key: 'maternite', label: 'Assurance maternité', rate: config.maternite },
    { key: 'accidentTravail', label: 'Accident du travail', rate: config.accidentTravail },
  ];
  for (const br of branches) {
    const emp = rateLine(br.key, br.label, gross, br.rate, 'employee');
    if (emp) employeeLines.push(emp);
    const er = rateLine(br.key, br.label, gross, br.rate, 'employer');
    if (er) employerLines.push(er);
  }

  // CMU : forfait fixe (par personne), part salariale et patronale.
  if (config.cmuEmployee > 0) {
    employeeLines.push({ key: 'cmu', label: 'CMU', base: 0, rate: 0, amount: Math.round(config.cmuEmployee) });
  }
  if (config.cmuEmployer > 0) {
    employerLines.push({ key: 'cmu', label: 'CMU', base: 0, rate: 0, amount: Math.round(config.cmuEmployer) });
  }

  const its = config.its.enabled ? computeIts(gross, config.its.brackets) : 0;

  const sumEmployeeContrib = employeeLines.reduce((s, l) => s + l.amount, 0);
  const totalEmployee = sumEmployeeContrib + its;
  const totalEmployer = employerLines.reduce((s, l) => s + l.amount, 0);

  return {
    grossSalary: gross,
    employeeLines,
    its,
    employerLines,
    totalEmployee,
    totalEmployer,
    // Plancher à 0 : une config aberrante (retenues > brut) ne doit jamais produire un net négatif.
    netSalary: Math.max(0, gross - totalEmployee),
    employerCost: gross + totalEmployer,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISA — Déclaration Individuelle des Salaires Annuels (CNPS).
// ─────────────────────────────────────────────────────────────────────────────

// Nombre de mois travaillés dans l'année civile `year` (0..12) d'après embauche/départ.
export function monthsWorkedInYear(year: number, hireDate: Date | null, endDate: Date | null): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const start = hireDate && hireDate > yearStart ? hireDate : yearStart;
  const end = endDate && endDate < yearEnd ? endDate : yearEnd;
  if (start > end) return 0; // embauché après l'année ou parti avant
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(0, Math.min(12, months));
}

export interface DisaEmployeeInput {
  cnpsNumber: string | null;
  lastName: string;
  firstName: string;
  birthDate: Date | null;
  hireDate: Date | null;
  endDate: Date | null;
  salary: number | null;
  salaryPeriod: string | null;
}

export interface DisaRow {
  cnpsNumber: string;
  lastName: string;
  firstName: string;
  birthDate: Date | null;
  hireDate: Date | null;
  endDate: Date | null;
  salaryPeriod: string | null;
  monthsWorked: number;
  annualGross: number; // assiette annuelle ≈ brut mensuel × mois travaillés
}

// Construit les lignes DISA pour une année : un employé par ligne, uniquement ceux
// ayant travaillé au moins un mois dans l'année (mois travaillés > 0).
export function buildDisaRows(year: number, employees: DisaEmployeeInput[]): DisaRow[] {
  const rows: DisaRow[] = [];
  for (const e of employees) {
    const monthsWorked = monthsWorkedInYear(year, e.hireDate, e.endDate);
    if (monthsWorked <= 0) continue;
    const monthly = e.salary ?? 0;
    rows.push({
      cnpsNumber: e.cnpsNumber ?? '',
      lastName: e.lastName,
      firstName: e.firstName,
      birthDate: e.birthDate,
      hireDate: e.hireDate,
      endDate: e.endDate,
      salaryPeriod: e.salaryPeriod,
      monthsWorked,
      annualGross: monthly * monthsWorked,
    });
  }
  return rows;
}
