import { notFound } from 'next/navigation';
import { getTaskForGuest } from '@/lib/actions/guestAccess';
import { GuestTaskView } from '@/components/GuestTaskView';

export default async function GuestTaskPage({ params }: { params: { token: string } }) {
  const result = await getTaskForGuest(params.token);
  if (!result) notFound();

  return (
    <GuestTaskView
      token={params.token}
      task={result.task}
      comments={result.comments}
      canComment={result.canComment}
    />
  );
}
