import { Decimal } from '@prisma/client/runtime/library';

export interface BudgetItemInput {
  cost?: number | Decimal | string | null;
  costCadence?: 'ONE_TIME' | 'MONTHLY' | null;
}

export interface BudgetSummary {
  capexTotal: number;
  monthlyOpexTotal: number;
  annualOpexTotal: number;
  firstYearTotal: number;
  formattedCapex: string;
  formattedMonthlyOpex: string;
  formattedAnnualOpex: string;
  formattedFirstYearTotal: string;
}

/**
 * Formats a numeric dollar amount into a standard USD currency string ($1,234 or $1,234.50 if cents present).
 */
export function formatMoney(amount: number): string {
  if (!isFinite(amount)) return '$0';
  const hasDecimals = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
}

/**
 * Safely parses any Prisma Decimal, number, or string to a JS floating number.
 */
export function parseNumericCost(val: number | Decimal | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === 'object' && 'toNumber' in val && typeof (val as any).toNumber === 'function') {
    return (val as any).toNumber();
  }
  return Number(val) || 0;
}

/**
 * Pure helper that computes the Onboarding budget breakdown across a set of items,
 * strictly keeping One-Time Capex and Monthly Opex separated while providing
 * annualized totals.
 */
export function calculateOnboardingBudget(items: BudgetItemInput[]): BudgetSummary {
  let capexTotal = 0;
  let monthlyOpexTotal = 0;

  for (const item of items) {
    const cost = parseNumericCost(item.cost);
    if (cost <= 0) continue;

    if (item.costCadence === 'MONTHLY') {
      monthlyOpexTotal += cost;
    } else {
      // ONE_TIME or default
      capexTotal += cost;
    }
  }

  const annualOpexTotal = monthlyOpexTotal * 12;
  const firstYearTotal = capexTotal + annualOpexTotal;

  return {
    capexTotal,
    monthlyOpexTotal,
    annualOpexTotal,
    firstYearTotal,
    formattedCapex: formatMoney(capexTotal),
    formattedMonthlyOpex: `${formatMoney(monthlyOpexTotal)}/mo`,
    formattedAnnualOpex: `${formatMoney(annualOpexTotal)}/yr`,
    formattedFirstYearTotal: formatMoney(firstYearTotal),
  };
}

