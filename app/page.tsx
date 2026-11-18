import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { getUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import LogoutButton from "@/components/logout-button";
import { CreateRoomForm, JoinRoomForm } from "@/components/room-forms";
import {
  Crown,
  Door,
  Lightning,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";

const STATUS_BADGE: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  open: { icon: <Lightning weight="fill" className="h-3 w-3" />, label: "Abierta", cls: "text-emerald-400" },
  results: { icon: <Trophy weight="fill" className="h-3 w-3" />, label: "Resultados", cls: "text-zinc-100" },
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
            className="rounded-lg bg-zinc-100 px-5 py-2.5 font-semibold text-zinc-900 transition-colors hover:bg-white"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-primary/40 px-5 py-2.5 font-semibold transition-colors hover:bg-card-hover"
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
    <div className="flex w-full max-w-4xl flex-col items-center gap-6">
      <p className="text-lg text-subtle">
        Hola, <span className="font-semibold text-body">{user.name}</span>
      </p>

      <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        <CreateRoomForm />
        <JoinRoomForm />
      </div>

      <div className="w-full max-w-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-secondary">Mis salas</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-subtle">
            Todavía no estás en ninguna sala. Creá una o entrá con un código.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((room) => {
              const badge = STATUS_BADGE[room.status];
              return (
                <li key={room.id}>
                  <Link
                    href={`/rooms/${room.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line/50 bg-card px-4 py-3 transition-all hover:border-primary "
                  >
                    <span className="flex flex-col text-left">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {room.is_admin && <span title="Sos el admin"><Crown weight="fill" className="h-4 w-4 text-amber-400" /></span>}
                        {room.title}
                      </span>
                      <span className="text-xs text-subtle">{formatDate(room.deadline)}</span>
                    </span>
                    <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${badge?.cls ?? ""}`}>
                      {badge?.icon} {badge?.label ?? room.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <LogoutButton />
    </div>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pt-16 pb-24 text-center">
      <AppLogo />
      <Suspense fallback={<p className="text-sm text-subtle">Cargando...</p>}>
        <RoomsArea searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
