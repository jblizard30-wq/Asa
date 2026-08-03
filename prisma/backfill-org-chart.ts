import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-time (idempotent) backfill for the org chart's `User.managerId`.
 * For each user with no manager set, looks at the Team(s) they belong to: if every
 * team they're on agrees on a single manager (and it isn't the user themselves),
 * that manager becomes their initial "reports to". Ambiguous or manager-less cases
 * are left unassigned for an admin to set by hand on the Org Chart page.
 */
async function main() {
  console.log('Backfilling org chart managers from team data...');

  const users = await prisma.user.findMany({
    where: { managerId: null },
    include: { teamMemberships: { include: { team: true } } },
  });

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const managerIds = new Set(
      user.teamMemberships
        .map((m) => m.team.managerId)
        .filter((id): id is string => Boolean(id) && id !== user.id),
    );

    if (managerIds.size !== 1) {
      skipped += 1;
      continue;
    }

    const [managerId] = managerIds;
    await prisma.user.update({ where: { id: user.id }, data: { managerId } });
    updated += 1;
    console.log(`  ${user.name} -> reports to ${managerId}`);
  }

  console.log(`Done. Assigned ${updated} manager(s), left ${skipped} unassigned.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
