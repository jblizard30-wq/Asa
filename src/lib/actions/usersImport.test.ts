import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCsvRecords, parseAndPreviewUsersCsv, importUsersCsv } from './users';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'admin-1', role: 'ADMIN', name: 'Pastor Dan', email: 'pastor.dan@example.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  users: [
    { id: 'user-existing', name: 'Existing Person', email: 'existing@example.org', role: 'USER', passwordHash: 'hash' },
  ] as any[],
  sentEmails: [] as any[],
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInviteEmail: vi.fn(async (...args: any[]) => {
    mockState.sentEmails.push(args);
  }),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('@/lib/site', () => ({
  getBaseUrl: vi.fn(() => 'https://cpcana.vercel.app'),
}));

vi.mock('@/lib/authTokens', () => ({
  generateAuthToken: vi.fn(() => 'mock-jwt-token-7days'),
  verifyAuthToken: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      user: {
        findMany: vi.fn(async ({ where }: any) => {
          if (where?.email?.in) {
            const inList: string[] = where.email.in;
            return mockState.users.filter((u) => inList.includes(u.email));
          }
          return mockState.users;
        }),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `user-${mockState.users.length + 1}`, ...data };
          mockState.users.push(row);
          return row;
        }),
      },
    },
  };
});

describe('User CSV Import', () => {
  beforeEach(() => {
    mockState.session = {
      user: { id: 'admin-1', role: 'ADMIN', name: 'Pastor Dan', email: 'pastor.dan@example.org' },
    };
    mockState.users = [
      { id: 'user-existing', name: 'Existing Person', email: 'existing@example.org', role: 'USER', passwordHash: 'hash' },
    ];
    mockState.sentEmails = [];
  });

  describe('parseCsvRecords', () => {
    it('correctly splits simple comma-delimited lines', () => {
      const csv = 'Name,Email,Role\nAlice,alice@example.com,USER\nBob,bob@example.com,MANAGER';
      const records = parseCsvRecords(csv);
      expect(records).toHaveLength(3);
      expect(records[0]).toEqual(['Name', 'Email', 'Role']);
      expect(records[1]).toEqual(['Alice', 'alice@example.com', 'USER']);
      expect(records[2]).toEqual(['Bob', 'bob@example.com', 'MANAGER']);
    });

    it('handles quoted fields with commas and double quotes', () => {
      const csv = '"Smith, John",john@example.com,"USER"\n"Jane ""JJ"" Doe",jane@example.com,ADMIN';
      const records = parseCsvRecords(csv);
      expect(records[0]).toEqual(['Smith, John', 'john@example.com', 'USER']);
      expect(records[1]).toEqual(['Jane "JJ" Doe', 'jane@example.com', 'ADMIN']);
    });
  });

  describe('parseAndPreviewUsersCsv', () => {
    it('parses valid header and data rows with valid statuses', async () => {
      const csv = `Full Name,Email Address,Role
Sarah Connor,sarah@example.com,MANAGER
John Connor,john@example.com,USER`;

      const preview = await parseAndPreviewUsersCsv(csv);
      expect(preview.totalRows).toBe(2);
      expect(preview.validCount).toBe(2);
      expect(preview.invalidCount).toBe(0);
      expect(preview.existingCount).toBe(0);
      expect(preview.rows[0].status).toBe('valid');
      expect(preview.rows[0].name).toBe('Sarah Connor');
      expect(preview.rows[0].email).toBe('sarah@example.com');
      expect(preview.rows[0].role).toBe('MANAGER');
      expect(preview.rows[1].role).toBe('USER');
    });

    it('identifies existing accounts in the database', async () => {
      const csv = `Name,Email,Role
Existing Person,existing@example.org,USER
New Person,new@example.org,USER`;

      const preview = await parseAndPreviewUsersCsv(csv);
      expect(preview.totalRows).toBe(2);
      expect(preview.validCount).toBe(1);
      expect(preview.existingCount).toBe(1);
      expect(preview.rows[0].status).toBe('already_exists');
      expect(preview.rows[0].error).toContain('already exists');
      expect(preview.rows[1].status).toBe('valid');
    });

    it('identifies duplicate emails within the CSV file', async () => {
      const csv = `Name,Email,Role
First Entry,dup@example.com,USER
Second Entry,dup@example.com,MANAGER`;

      const preview = await parseAndPreviewUsersCsv(csv);
      expect(preview.totalRows).toBe(2);
      expect(preview.validCount).toBe(1);
      expect(preview.duplicateCount).toBe(1);
      expect(preview.rows[0].status).toBe('valid');
      expect(preview.rows[1].status).toBe('duplicate_in_file');
      expect(preview.rows[1].error).toContain('Duplicate email');
    });

    it('flags invalid rows for missing name or bad email or invalid role', async () => {
      const csv = `Name,Email,Role
,missingname@example.com,USER
Valid Name,not-an-email,USER
Another Name,good@example.com,SUPERADMIN`;

      const preview = await parseAndPreviewUsersCsv(csv);
      expect(preview.totalRows).toBe(3);
      expect(preview.validCount).toBe(0);
      expect(preview.invalidCount).toBe(3);
      expect(preview.rows[0].error).toContain('Name is required');
      expect(preview.rows[1].error).toContain('Valid email address');
      expect(preview.rows[2].error).toContain('Invalid role');
    });

    it('handles password column validation', async () => {
      const csv = `Name,Email,Role,Password
Short Pass,short@example.com,USER,123
Good Pass,good@example.com,USER,strongpass123`;

      const preview = await parseAndPreviewUsersCsv(csv);
      expect(preview.rows[0].status).toBe('invalid');
      expect(preview.rows[0].error).toContain('at least 8 characters');
      expect(preview.rows[1].status).toBe('valid');
    });
  });

  describe('importUsersCsv', () => {
    it('creates new users in the database and returns invite URLs', async () => {
      const input = {
        rows: [
          { name: 'Alice Walker', email: 'alice@example.com', role: 'MANAGER' as const },
          { name: 'Bob Stone', email: 'bob@example.com', role: 'USER' as const, password: 'password1234' },
        ],
        sendInvites: true,
      };

      const result = await importUsersCsv(input);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].email).toBe('alice@example.com');
      expect(result.results[0].inviteUrl).toContain('mock-jwt-token-7days');
      expect(result.results[0].temporaryPassword).toBeDefined();
      expect(result.results[1].temporaryPassword).toBeUndefined();

      expect(mockState.sentEmails).toHaveLength(2);
      expect(mockState.users.some((u) => u.email === 'alice@example.com')).toBe(true);
      expect(mockState.users.some((u) => u.email === 'bob@example.com')).toBe(true);
    });

    it('skips existing users safely during import', async () => {
      const input = {
        rows: [
          { name: 'Existing Person', email: 'existing@example.org', role: 'USER' as const },
          { name: 'Brand New', email: 'brandnew@example.com', role: 'USER' as const },
        ],
        sendInvites: false,
      };

      const result = await importUsersCsv(input);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].email).toBe('brandnew@example.com');
    });
  });
});
