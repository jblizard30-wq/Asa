'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { instantiatePlaybook, getMinistryPlaybook, listMinistryPlaybooks } from '@/lib/ministryPlaybooks';

export async function getPlaybooksList() {
  return listMinistryPlaybooks();
}

export async function instantiatePlaybookAction(
  playbookId: string,
  startDateStr: string,
  customProjectName?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: 'You must be signed in to create a project.' };
  }

  const playbook = getMinistryPlaybook(playbookId);
  if (!playbook) {
    return { success: false, error: 'Playbook template not found.' };
  }

  const result = await instantiatePlaybook(playbookId, startDateStr, {
    projectName: customProjectName,
    userId: session.user.id,
  });

  return result;
}

