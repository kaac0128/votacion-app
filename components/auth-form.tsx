"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Warning } from "@phosphor-icons/react/dist/ssr";

export default function AuthForm({ mode, redirectTo = "/" }: { mode: "login" | "register"; redirectTo?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { error?: string });
      setError(data.error ?? "Algo salió mal");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-line/40 bg-card p-6">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Nombre
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={20}
          autoComplete="username"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 outline-none transition-colors focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={4}
          maxLength={72}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 outline-none transition-colors focus:border-primary"
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-danger"><Warning weight="fill" className="h-4 w-4" />{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {busy ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
      </button>
      <p className="text-center text-sm text-subtle">
        {mode === "login" ? (
          <>
            ¿No tenés cuenta?{" "}
            <Link href="/register" className="text-secondary underline transition-colors hover:text-body">
              Registrate
            </Link>
          </>
        ) : (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-secondary underline transition-colors hover:text-body">
              Entrá
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
