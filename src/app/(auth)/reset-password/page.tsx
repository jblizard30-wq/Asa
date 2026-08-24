import { ORG_NAME } from '@/lib/site';
import { SetPasswordForm } from '../set-password/SetPasswordForm';

interface ResetPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  return <SetPasswordForm token={searchParams.token || ''} orgName={ORG_NAME} />;
}

