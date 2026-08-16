'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Arbitrary fixed key for the advisory lock below — any constant works, it just needs to be
// the same value every call so concurrent transactions actually contend on it.
const SIGN_UP_ADVISORY_LOCK_KEY = 72190441;

const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export interface SignUpResult {
  success: boolean;
  error?: string;
}

export async function signUp(formData: FormData): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: 'An account with that email already exists.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      // Advisory lock serializes concurrent sign-ups on this key, so two people signing up in
      // the same instant against a fresh database can't both read count() === 0 and both become
      // ADMIN — the second waits for the first's transaction to commit before it counts.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${SIGN_UP_ADVISORY_LOCK_KEY})`;

      // First user in the system becomes an admin so someone can create projects.
      const userCount = await tx.user.count();

      await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash,
          role: userCount === 0 ? 'ADMIN' : 'USER',
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { success: false, error: 'An account with that email already exists.' };
    }
    throw err;
  }

  return { success: true };
}
