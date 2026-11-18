import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { getUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import LogoutButton from "@/components/logout-button";
import { CreateRoomForm, JoinRoomForm } from "@/components/room-forms";

const STATUS_LABEL: Record<string, string> = {
  open: "🟢 Abierta",
  results: "🏆 Resultados",
  closed: "🔒 Cerrada",
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Te invitaron a una sala con el código <b>{c}</b>.{" "}
            <Link href={`/login?c=${encodeURIComponent(c)}`} className="underline">
              Entrá
            </Link>{" "}
            o{" "}
            <Link href={`/register?c=${encodeURIComponent(c)}`} className="underline">
              registrate
            </Link>{" "}
            para unirte.
          </p>
        )}
        <p className="text-lg text-zinc-500 dark:text-zinc-400">Votá, apostá y coroná al ganador.</p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-zinc-300 px-5 py-2 font-medium dark:border-zinc-700"
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
      return <p className="text-red-500">Ese código no parece válido.</p>;
    }
    const { rows: found } = await pool.query<{ id: string }>("select id from rooms where code = $1", [c.toUpperCase()]);
    if (found[0]) {
      await pool.query(
        "insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing",
        [found[0].id, user.id]
      );
      redirect(`/rooms/${found[0].id}`);
    }
    return <p className="text-red-500">No existe una sala con el código {c.toUpperCase()}.</p>;
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
      <p className="text-lg text-zinc-500 dark:text-zinc-400">
        Hola, <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</span>
      </p>

      <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        <CreateRoomForm />
        <JoinRoomForm />
      </div>

      <div className="w-full max-w-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Mis salas
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Todavía no estás en ninguna sala. Creá una o entrá con un código.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/rooms/${room.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
                >
                  <span className="flex flex-col text-left">
                    <span className="font-semibold">
                      {room.is_admin && <span title="Sos el admin">👑 </span>}
                      {room.title}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{formatDate(room.deadline)}</span>
                  </span>
                  <span className="text-xs whitespace-nowrap">{STATUS_LABEL[room.status] ?? room.status}</span>
                </Link>
              </li>
            ))}
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
      <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
        <RoomsArea searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
