import { ORG_NAME } from '@/lib/site';
import { SignInForm } from './SignInForm';

export default function SignInPage() {
  return <SignInForm orgName={ORG_NAME} />;
}
