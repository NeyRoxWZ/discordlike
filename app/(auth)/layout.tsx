interface Props {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full rounded-lg bg-bg-secondary p-6 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
