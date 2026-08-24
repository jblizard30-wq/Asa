import { ORG_NAME } from '@/lib/site';
import { SetPasswordForm } from './SetPasswordForm';

interface SetPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  return <SetPasswordForm token={searchParams.token || ''} orgName={ORG_NAME} />;
}

