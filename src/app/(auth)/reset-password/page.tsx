import { Suspense } from 'react';
import { ORG_NAME } from '@/lib/site';
import { SetPasswordForm } from '../set-password/SetPasswordForm';

interface ResetPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
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

