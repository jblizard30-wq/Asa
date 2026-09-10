import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';
import { getOnboardingBlueprints } from '@/lib/actions/onboarding';
import { OnboardingBlueprintsClient } from '@/components/onboarding/OnboardingBlueprintsClient';

export default async function OnboardingBlueprintsPage() {
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

  const blueprintsData = await getOnboardingBlueprints();

  const blueprints = blueprintsData.map((b) => ({
    id: b.id,
    role: b.role,
    description: b.description,
    items: b.items.map((i) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      description: i.description,
      docTemplateUrl: i.docTemplateUrl,
      estimatedCost: i.estimatedCost ? Number(i.estimatedCost) : null,
      costCadence: i.costCadence,
      provisioningType: i.provisioningType,
      sortOrder: i.sortOrder,
    })),
  }));

  return <OnboardingBlueprintsClient blueprints={blueprints} />;
}

