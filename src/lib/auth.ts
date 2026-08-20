import { type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifySupportToken } from '@/lib/supportLogin';

// One-off HQ "log in as admin" sign-in: verifies the signed token, atomically
// claims its jti (the unique constraint IS the single-use guard — no
// check-then-act race), then upserts the vendor-admin user. Returns null on
// any failure so it falls through to a normal "invalid credentials" error.
export async function authorizeSupportToken(token: string) {
  const secret = process.env.HQ_SUPPORT_SECRET;
  if (!secret) return null;

  const payload = verifySupportToken(token, secret);
  if (!payload || payload.role !== 'ADMIN') return null;

  try {
    await prisma.supportLoginToken.create({ data: { jti: payload.jti } });
  } catch {
    return null; // jti already used (or a transient error) — reject either way
  }

  const email = payload.email.toLowerCase().trim();
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Support Admin',
      // Random, never-issued password — this user only ever signs in via a
      // fresh signed token, never via this hash.
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      role: 'ADMIN',
    },
  });

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export const authOptions: AuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        supportToken: { label: 'Support Token', type: 'text' },
      },
      async authorize(credentials) {
        if (credentials?.supportToken) {
          return authorizeSupportToken(credentials.supportToken);
        }

        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
