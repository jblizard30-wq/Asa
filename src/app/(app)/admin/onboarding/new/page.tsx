import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';
import { getOnboardingBlueprints } from '@/lib/actions/onboarding';
import { NewOnboardingWizardClient } from '@/components/onboarding/NewOnboardingWizardClient';

export default async function NewOnboardingPage() {
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
    })),
  }));

  return <NewOnboardingWizardClient blueprints={blueprints} />;
}

