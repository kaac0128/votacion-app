import { Suspense } from "react";
import AppLogo from "@/components/app-logo";
import AuthForm from "@/components/auth-form";

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-16 pb-24">
      <AppLogo />
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
