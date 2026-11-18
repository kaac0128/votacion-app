import { Suspense } from "react";
import AppLogo from "@/components/app-logo";
import AuthForm from "@/components/auth-form";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pt-16 pb-24">
      <AppLogo />
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
