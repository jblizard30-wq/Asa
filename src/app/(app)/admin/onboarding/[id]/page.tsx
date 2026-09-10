import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { getOnboardingCase, getStaffUsersForAssigneePicker } from '@/lib/actions/onboarding';
import { OnboardingDetailClient } from '@/components/onboarding/OnboardingDetailClient';

export default async function OnboardingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isModuleEnabled('onboarding')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/my-tasks');
  }

  const [onboardingCase, staffUsers] = await Promise.all([
    getOnboardingCase(params.id),
    getStaffUsersForAssigneePicker(),
  ]);

  if (!onboardingCase) {
    notFound();
  }

  let inventoryItems: Array<{ id: string; name: string; onHandQty: number; unit: string }> = [];
  if (isModuleEnabled('inventory')) {
    inventoryItems = await prisma.inventoryItem.findMany({
      select: { id: true, name: true, onHandQty: true, unit: true },
      orderBy: { name: 'asc' },
    });
  }

  return (
    <OnboardingDetailClient
      onboardingCase={onboardingCase}
      inventoryItems={inventoryItems}
      staffUsers={staffUsers}
    />
  );
}

