import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';
import { listOnboardingCases } from '@/lib/actions/onboarding';
import { OnboardingRosterClient } from '@/components/onboarding/OnboardingRosterClient';

export default async function AdminOnboardingPage() {
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

  const cases = await listOnboardingCases();

  return <OnboardingRosterClient cases={cases} />;
}

