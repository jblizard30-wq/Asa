import { prisma } from '../src/lib/prisma';
import { populateDemoData } from '../src/lib/demoData';

async function main() {
  console.log('Populating comprehensive church demo workflows and sample tasks for staff demonstration...');
  const result = await populateDemoData();
  console.log(`Successfully verified/created ${result.workflowsCount} workflows and ${result.projectsCreatedCount} interactive projects!`);
  console.log('Demo ready at http://localhost:3000 (or production https://cpcana.vercel.app)');
}

main()
  .catch((e) => {
    console.error('Failed to seed demo data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
