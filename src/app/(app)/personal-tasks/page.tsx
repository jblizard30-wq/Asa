import { redirect } from 'next/navigation';
import { getOrCreatePersonalProject } from '@/lib/actions/projects';

export default async function PersonalTasksPage() {
  const projectId = await getOrCreatePersonalProject();
  redirect(`/projects/${projectId}`);
}
