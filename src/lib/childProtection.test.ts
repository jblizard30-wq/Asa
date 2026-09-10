import { describe, it, expect } from 'vitest';
import {
  computeMinistrySafeExpiry,
  computeBackgroundCheckExpiry,
  computeRecordStatus,
  RENEWAL_WARNING_DAYS,
} from './childProtection';

describe('Child Protection Renewal & Compliance Calculations', () => {
  it('adds exactly 3 years for MinistrySafe renewal', () => {
    const completedAt = new Date('2024-05-15T00:00:00.000Z');
    const expiry = computeMinistrySafeExpiry(completedAt);
    expect(expiry.getUTCFullYear()).toBe(2027);
    expect(expiry.getUTCMonth()).toBe(4); // May is index 4
    expect(expiry.getUTCDate()).toBe(15);
  });

  it('adds exactly 5 years for Background Check renewal', () => {
    const completedAt = new Date('2023-11-20T00:00:00.000Z');
    const expiry = computeBackgroundCheckExpiry(completedAt);
    expect(expiry.getUTCFullYear()).toBe(2028);
    expect(expiry.getUTCMonth()).toBe(10); // Nov is index 10
    expect(expiry.getUTCDate()).toBe(20);
  });

  it('marks record as INCOMPLETE if DocuSign is not signed', () => {
    const result = computeRecordStatus({
      docusignSigned: false,
      ministrySafeCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
      backgroundCheckCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(result.status).toBe('INCOMPLETE');
  });

  it('marks record as INCOMPLETE if MinistrySafe or Background check is missing', () => {
    const result1 = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: null,
      backgroundCheckCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(result1.status).toBe('INCOMPLETE');

    const result2 = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
      backgroundCheckCompletedAt: null,
    });
    expect(result2.status).toBe('INCOMPLETE');
  });

  it('marks record as COMPLIANT when all are done and well before 45-day renewal window', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const msDate = new Date('2025-09-10T00:00:00.000Z');
    const bgDate = new Date('2025-09-10T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('COMPLIANT');
    expect(result.daysUntilMinistrySafeExpires).toBeGreaterThan(RENEWAL_WARNING_DAYS);
    expect(result.daysUntilBackgroundCheckExpires).toBeGreaterThan(RENEWAL_WARNING_DAYS);
  });

  it('marks record as EXPIRING_SOON when within 45 days of MinistrySafe renewal', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    // MinistrySafe completed on 2023-10-15 -> expires 2026-10-15 (35 days from now)
    const msDate = new Date('2023-10-15T00:00:00.000Z');
    const bgDate = new Date('2025-01-01T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('EXPIRING_SOON');
    expect(result.daysUntilMinistrySafeExpires).toBe(35);
    expect(result.daysUntilNextRenewal).toBe(35);
  });

  it('marks record as EXPIRING_SOON when within 45 days of Background Check renewal', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const msDate = new Date('2025-01-01T00:00:00.000Z');
    // BG Check completed 2021-09-30 -> expires 2026-09-30 (20 days from now)
    const bgDate = new Date('2021-09-30T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('EXPIRING_SOON');
    expect(result.daysUntilBackgroundCheckExpires).toBe(20);
    expect(result.daysUntilNextRenewal).toBe(20);
  });

  it('marks record as EXPIRED when past renewal date', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    // MinistrySafe completed 2023-08-01 -> expired 2026-08-01
    const msDate = new Date('2023-08-01T00:00:00.000Z');
    const bgDate = new Date('2024-01-01T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('EXPIRED');
    expect(result.daysUntilMinistrySafeExpires).toBeLessThan(0);
  });
});
