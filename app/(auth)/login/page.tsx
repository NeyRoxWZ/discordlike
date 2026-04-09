import { LoginForm } from '@/components/auth/LoginForm';

interface Props {
  searchParams: { next?: string };
}

export default function LoginPage({ searchParams }: Props) {
  return <LoginForm nextPath={searchParams.next} />;
}
