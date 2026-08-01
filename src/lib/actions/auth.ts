'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

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

  // First user in the system becomes an admin so someone can create projects.
  const userCount = await prisma.user.count();

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: userCount === 0 ? 'ADMIN' : 'STAFF',
    },
  });

  return { success: true };
}
