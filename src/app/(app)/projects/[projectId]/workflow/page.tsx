import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBranchMapData, getWorkflowOptionsForProject } from '@/lib/actions/workflows';
import { WorkflowBranchMap } from '@/components/WorkflowBranchMap';

export default async function ProjectWorkflowPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { members: true },
  });
  if (!project) notFound();

  const isMember = project.members.some((m) => m.userId === session.user.id);
  if (!isMember && session.user.role !== 'ADMIN') {
    redirect('/projects');
  }

  const [branchMap, workflowOptions] = await Promise.all([
    getBranchMapData(project.id),
    getWorkflowOptionsForProject(project.id),
  ]);
  if (!branchMap) notFound();

  return <WorkflowBranchMap projectId={project.id} data={branchMap} workflowOptions={workflowOptions} />;
}
