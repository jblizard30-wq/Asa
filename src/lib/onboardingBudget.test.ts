import { describe, it, expect } from 'vitest';
import { calculateOnboardingBudget, formatMoney, parseNumericCost } from './onboardingBudget';

describe('onboardingBudget helper', () => {
  it('formats whole dollar amounts without cents and decimal amounts with cents', () => {
    expect(formatMoney(1200)).toBe('$1,200');
    expect(formatMoney(1200.50)).toBe('$1,200.50');
    expect(formatMoney(0)).toBe('$0');
  });

  it('safely parses numeric, string, null, and object inputs', () => {
    expect(parseNumericCost(150)).toBe(150);
    expect(parseNumericCost('299.99')).toBe(299.99);
    expect(parseNumericCost(null)).toBe(0);
    expect(parseNumericCost(undefined)).toBe(0);
    expect(parseNumericCost({ toNumber: () => 45 } as any)).toBe(45);
  });

  it('separates ONE_TIME Capex and MONTHLY Opex cleanly', () => {
    const items = [
      { cost: 2499, costCadence: 'ONE_TIME' as const }, // MacBook Pro
      { cost: 800, costCadence: 'ONE_TIME' as const },  // Standing Desk
      { cost: 12, costCadence: 'MONTHLY' as const },    // Google Workspace
      { cost: 15, costCadence: 'MONTHLY' as const },    // Slack Pro
      { cost: null, costCadence: 'ONE_TIME' as const }, // Paperwork (no cost)
    ];

    const budget = calculateOnboardingBudget(items);

    expect(budget.capexTotal).toBe(3299);
    expect(budget.monthlyOpexTotal).toBe(27);
    expect(budget.annualOpexTotal).toBe(324);
    expect(budget.firstYearTotal).toBe(3623);

    expect(budget.formattedCapex).toBe('$3,299');
    expect(budget.formattedMonthlyOpex).toBe('$27/mo');
    expect(budget.formattedAnnualOpex).toBe('$324/yr');
    expect(budget.formattedFirstYearTotal).toBe('$3,623');
  });

  it('handles empty or zero-cost items without errors', () => {
    const budget = calculateOnboardingBudget([]);
    expect(budget.capexTotal).toBe(0);
    expect(budget.monthlyOpexTotal).toBe(0);
    expect(budget.formattedCapex).toBe('$0');
    expect(budget.formattedMonthlyOpex).toBe('$0/mo');
  });
});

