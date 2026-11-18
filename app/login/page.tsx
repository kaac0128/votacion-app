import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="mb-8 text-2xl font-bold">Entrar</h1>
      <Suspense fallback={null}>
        <LoginInner searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginInner({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return <AuthForm mode="login" redirectTo={c ? `/?c=${encodeURIComponent(c)}` : "/"} />;
}
