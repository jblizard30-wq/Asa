/**
 * Seeds (or repairs) a single ADMIN user and nothing else.
 *
 * Deliberately separate from prisma/seed.ts, which also creates demo users,
 * teams, and sample tasks — fixtures you do not want in a real deployment.
 * Password comes from ADMIN_PASSWORD so no credential is ever committed.
 *
 * Usage:
 *   ADMIN_EMAIL=you@church.org ADMIN_NAME="Your Name" \
 *   ADMIN_PASSWORD="..." DATABASE_URL="..." npx tsx prisma/seed-admin.ts
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const name = process.env.ADMIN_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !name || !password) {
    throw new Error('ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD are all required.');
  }
  // NextAuth's authorize() looks the user up by lowercased email, so storing a
  // mixed-case address here would create an account that can never sign in.
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.ADMIN, name },
    create: { email, name, passwordHash, role: Role.ADMIN },
  });

  console.log(`Seeded ADMIN ${user.email} (id ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
