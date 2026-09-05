import { Suspense } from 'react';
import { ORG_NAME } from '@/lib/site';
import { SetPasswordForm } from './SetPasswordForm';

interface SetPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm
        token={searchParams.token || ''}
        initialToken={searchParams.token || ''}
        orgName={ORG_NAME}
      />
    </Suspense>
  );
}

