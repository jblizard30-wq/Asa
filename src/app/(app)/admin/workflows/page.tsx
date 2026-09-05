import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkflowsForAdmin, getTeamsForWorkflowPicker } from '@/lib/actions/workflows';
import { getEligibleWorkflowUsers, getEligibleWorkflowProjects } from '@/lib/workflows/workflowSettings';
import { WorkflowsManager } from '@/components/WorkflowsManager';

export default async function AdminWorkflowsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');
  if (session.user.role !== 'ADMIN') redirect('/my-tasks');

  const [workflows, teams, users, projects] = await Promise.all([
    getWorkflowsForAdmin(),
    getTeamsForWorkflowPicker(),
    getEligibleWorkflowUsers(),
    getEligibleWorkflowProjects(),
  ]);

  return <WorkflowsManager workflows={workflows} teams={teams} users={users} projects={projects} />;
}
