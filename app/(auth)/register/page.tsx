import { RegisterForm } from '@/components/auth/RegisterForm';

interface Props {
  searchParams: { next?: string };
}

export default function RegisterPage({ searchParams }: Props) {
  return <RegisterForm nextPath={searchParams.next} />;
}
