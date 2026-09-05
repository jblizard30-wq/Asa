/**
 * The three health ratios from the XP Skills financial calculator. Derived on
 * read rather than stored, so changing a formula never leaves stale numbers in
 * the database.
 */
export interface RatioInput {
  unrestrictedCash: number;
  annualRevenue: number;
  annualExpense: number;
  programExpense: number;
  personnelCost: number;
}

export interface Ratio {
  label: string;
  value: number;
  display: string;
  /** Rule-of-thumb bands used by the source app's elder memo. */
  status: 'healthy' | 'watch' | 'concern';
  hint: string;
}

/** Share of total spending that reaches programs rather than overhead. */
export function programEfficiency(i: RatioInput): Ratio {
  const value = i.annualExpense > 0 ? (i.programExpense / i.annualExpense) * 100 : 0;
  return {
    label: 'Program efficiency',
    value,
    display: `${value.toFixed(1)}%`,
    status: value >= 65 ? 'healthy' : value >= 50 ? 'watch' : 'concern',
    hint: '65%+ of spending reaching programs is the common benchmark.',
  };
}

/** How many months the church could operate on unrestricted cash alone. */
export function monthsOfReserve(i: RatioInput): Ratio {
  const monthlyBurn = i.annualExpense / 12;
  const value = monthlyBurn > 0 ? i.unrestrictedCash / monthlyBurn : 0;
  return {
    label: 'Months of reserve',
    value,
    display: `${value.toFixed(1)} mo`,
    status: value >= 3 ? 'healthy' : value >= 1.5 ? 'watch' : 'concern',
    hint: 'Three months of unrestricted operating cash is the usual floor.',
  };
}

/** Personnel cost as a share of revenue. */
export function personnelCostRatio(i: RatioInput): Ratio {
  const value = i.annualRevenue > 0 ? (i.personnelCost / i.annualRevenue) * 100 : 0;
  return {
    label: 'Personnel cost',
    value,
    display: `${value.toFixed(1)}%`,
    status: value <= 55 ? 'healthy' : value <= 65 ? 'watch' : 'concern',
    hint: 'Staffing above ~55% of revenue squeezes everything else.',
  };
}

export function allRatios(i: RatioInput): Ratio[] {
  return [programEfficiency(i), monthsOfReserve(i), personnelCostRatio(i)];
}
