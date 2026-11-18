"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refresco periódico del server component: "tiempo real" barato y suficiente
// para 4 personas. (Supabase Realtime postgrest_changes queda bloqueado por el
// RLS deny-all; el polling cada 4s da la misma experiencia sin infra extra.)
export default function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}
