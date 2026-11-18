export const instant = false;

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { getUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import LogoutButton from "@/components/logout-button";
import { CreateRoomForm, JoinRoomForm } from "@/components/room-forms";
import {
  ArrowRight,
  CheckCircle,
  Crown,
  Door,
  Lightning,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";

const STATUS_BADGE: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  open: { icon: <Lightning weight="fill" className="h-3 w-3" />, label: "Abierta", cls: "text-emerald-400" },
  results: { icon: <Trophy weight="fill" className="h-3 w-3" />, label: "Resultados", cls: "text-accent" },
  closed: { icon: <Door weight="fill" className="h-3 w-3" />, label: "Cerrada", cls: "text-subtle" },
};

function formatDate(d: Date | null): string {
  if (!d) return "sin fecha límite";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

async function RoomsArea({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const user = await getUser();
  if (!user) {
    return (
      <>
        {c && (
          <p className="text-sm text-subtle">
            Te invitaron a una sala con el código <b className="text-secondary">{c}</b>.{" "}
            <Link href={`/login?c=${encodeURIComponent(c)}`} className="text-secondary underline">
              Entrá
            </Link>{" "}
            o{" "}
            <Link href={`/register?c=${encodeURIComponent(c)}`} className="text-secondary underline">
              registrate
            </Link>{" "}
            para unirte.
          </p>
        )}
        <p className="text-lg text-subtle">Votá, apostá y coroná al ganador.</p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold transition-colors hover:bg-card-hover"
          >
            Crear cuenta
          </Link>
        </div>
      </>
    );
  }

  // entrada por link compartible ?c=CODIGO
  if (c) {
    if (!/^[A-Z2-9]{6}$/.test(c.toUpperCase())) {
      return <p className="text-danger">Ese código no parece válido.</p>;
    }
    const { rows: found } = await pool.query<{ id: string }>("select id from rooms where code = $1", [c.toUpperCase()]);
    if (found[0]) {
      await pool.query(
        "insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing",
        [found[0].id, user.id]
      );
      redirect(`/rooms/${found[0].id}`);
    }
    return <p className="text-danger">No existe una sala con el código {c.toUpperCase()}.</p>;
  }

  const { rows } = await pool.query<{ id: string; title: string; status: string; deadline: Date | null; is_admin: boolean }>(
    `select r.id, r.title, r.status, r.deadline, (r.admin_user_id = $1) as is_admin
       from rooms r
       join room_members m on m.room_id = r.id
      where m.user_id = $1
      order by (r.status = 'closed'), r.created_at desc`,
    [user.id]
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_340px] lg:items-start">
      <section className="flex flex-col gap-5">
        <h2 className="border-b border-line/50 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Mis salas ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-subtle">
            Todavía no estás en ninguna sala. Creá una o entrá con un código.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((room) => {
              const badge = STATUS_BADGE[room.status];
              return (
                <li key={room.id}>
                  <Link
                    href={`/rooms/${room.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-card px-5 py-4 transition-colors hover:border-primary"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2 font-semibold">
                        {room.is_admin && (
                          <span title="Sos el admin" className="flex shrink-0">
                            <Crown weight="fill" className="h-4 w-4 text-amber-400" />
                          </span>
                        )}
                        {room.title}
                      </span>
                      <span className="text-xs text-subtle">{formatDate(room.deadline)}</span>
                    </span>
                    <span className={`flex shrink-0 items-center gap-1.5 rounded-full border border-line/50 px-3 py-1.5 text-xs ${badge?.cls ?? ""}`}>
                      {badge?.icon} {badge?.label ?? room.status}
                      <ArrowRight weight="bold" className="h-3 w-3" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-8">
        <div className="flex items-center justify-between lg:hidden">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Acciones</h2>
        </div>
        <CreateRoomForm />
        <JoinRoomForm />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-card px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <CheckCircle weight="fill" className="h-4 w-4 text-emerald-400" />
            {user.name}
          </span>
          <LogoutButton />
        </div>
      </aside>
    </div>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <div className="flex w-full max-w-6xl flex-1 flex-col gap-10 self-center px-6 pt-10 pb-24 sm:px-8">
      <AppLogo />
      <Suspense fallback={<p className="text-sm text-subtle">Cargando...</p>}>
        <RoomsArea searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
