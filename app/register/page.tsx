import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="mb-8 text-2xl font-bold">Crear cuenta</h1>
      <Suspense fallback={null}>
        <RegisterInner searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RegisterInner({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  return <AuthForm mode="register" redirectTo={c ? `/?c=${encodeURIComponent(c)}` : "/"} />;
}
