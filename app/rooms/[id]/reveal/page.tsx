import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ActionButton } from "@/components/admin-forms";
import AutoRefresh from "@/components/auto-refresh";
import { revealNext, closeRoom } from "../results/actions";
import { CheckCircle, EyeSlash } from "@phosphor-icons/react/dist/ssr";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function RevealScreen({ roomId }: { roomId: string }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { rows: roomRows } = await pool.query<{ title: string; admin_user_id: string }>(
    "select title, admin_user_id from rooms where id = $1",
    [roomId]
  );
  const room = roomRows[0];
  if (!room) notFound();
  if (room.admin_user_id !== user.id) redirect(`/rooms/${roomId}`);

  const { rows: results } = await pool.query<{ category_id: string; name: string; revealed: boolean; attempt: number; winner_title: string | null }>(
    `select r.category_id, c.name, r.revealed, r.attempt, w.title as winner_title
       from category_results r
       join categories c on c.id = r.category_id
       left join items w on w.id = r.winner_item_id
      where c.room_id = $1
      order by c.sort, c.name`,
    [roomId]
  );
  const unrevealed = results.filter((r) => !r.revealed).length;

  // puntajes SOLO de categorías ya reveladas
  const { rows: totals } = await pool.query<{ name: string; user_id: string; pts: string; is_admin: boolean }>(
    `select u.name, m.user_id,
            coalesce(sum(case when r.winner_item_id = v.item_id and not w.is_invalid then 10 else 0 end), 0) as pts,
            (m.user_id = $2) as is_admin
       from room_members m
       join users u on u.id = m.user_id
       left join votes v on v.user_id = m.user_id
       left join categories c on c.id = v.category_id and c.room_id = m.room_id
       left join category_results r on r.category_id = c.id and r.revealed
       left join items w on w.id = r.winner_item_id
      where m.room_id = $1 and m.user_id <> $2
      group by u.name, m.user_id
      order by pts desc, u.name`,
    [roomId, room.admin_user_id]
  );

  const maxPts = Math.max(0, ...totals.map((t) => Number(t.pts)));
  const canClose = (await pool.query<{ status: string }>("select status from rooms where id = $1", [roomId])).rows[0]?.status === "results";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8 px-6 pt-10 pb-24">
      <AutoRefresh />
      <header>
        <Link href={`/rooms/${roomId}/results`} className="text-sm text-subtle transition-colors hover:text-body">
          ← Volver a resultados
        </Link>
        <h1 className="text-2xl font-bold">🎬 Revelación en vivo: {room.title}</h1>
        <p className="text-sm text-subtle">
          {unrevealed === 0
            ? "🎉 Todas las categorías están reveladas"
            : `Quedan ${unrevealed} categoría(s) por revelar · los jugadores ven los puntos en vivo`}
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        {unrevealed > 0 && (
          <ActionButton
            action={revealNext}
            fields={{ roomId }}
            label="🎬 Revelar siguiente categoría"
          />
        )}
        {unrevealed === 0 && canClose && (
          <ActionButton action={closeRoom} fields={{ roomId }} label="🔒 Cerrar sala y guardar en el historial" />
        )}
      </div>

      <section className="rounded-xl border border-zinc-800 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          Marcador en vivo
        </h2>
        <ul className="flex flex-col gap-2">
          {totals.map((t, i) => {
            const pts = Number(t.pts);
            const pct = maxPts > 0 ? Math.round((pts / maxPts) * 100) : 0;
            return (
              <li key={t.user_id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {i === 0 && pts > 0 && <span className="crown-anim mr-1">👑</span>}
                    {t.name}
                  </span>
                  <span className="font-bold">{pts} pts</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          Categorías
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {results.map((r) => (
            <li key={r.category_id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-card/60 px-3 py-2">
              <span>{r.name}</span>
              <span>
                {r.revealed ? (
                  <><CheckCircle weight="fill" className="h-4 w-4 text-emerald-400" /> revelada: <b>{r.winner_title}</b></>
                ) : (
                  <><EyeSlash className="h-4 w-4" /> oculta</>
                )}
              </span>
            </li>
          ))}
          {results.length === 0 && (
            <li className="text-subtle">
              Todavía no hay resultados publicados (cargalos desde Resultados).
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

export default function RevealPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Suspense fallback={<p className="py-16 text-sm text-subtle">Cargando revelación...</p>}>
        <RevealInner params={params} />
      </Suspense>
    </div>
  );
}

async function RevealInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <RevealScreen roomId={id} />;
}
