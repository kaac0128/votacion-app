export const instant = false;

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ActionButton } from "@/components/admin-forms";
import ResultForm from "@/components/result-form";
import { closeVoting, reopenVoting, revealNext } from "./actions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ATTEMPTS = 4;
const reportsNeeded = (participants: number) => Math.ceil(participants / 2);

async function ResultsPanel({ roomId }: { roomId: string }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { rows: roomRows } = await pool.query<{ title: string; admin_user_id: string; status: string }>(
    "select title, admin_user_id, status from rooms where id = $1",
    [roomId]
  );
  const room = roomRows[0];
  if (!room) notFound();
  if (room.admin_user_id !== user.id) redirect(`/rooms/${roomId}`);

  const { rows: participantsRows } = await pool.query<{ n: number }>(
    "select count(*) as n from room_members where room_id = $1 and user_id <> $2",
    [roomId, room.admin_user_id]
  );
  const participants = participantsRows[0].n;

  const { rows: categories } = await pool.query<{ id: string; name: string }>(
    "select id, name from categories where room_id = $1 order by sort, name",
    [roomId]
  );
  const { rows: items } = await pool.query<{ id: string; category_id: string; title: string; is_invalid: boolean }>(
    `select i.id, ic.category_id, i.title, i.is_invalid
       from items i
       join item_categories ic on ic.item_id = i.id
      where ic.category_id in (select id from categories where room_id = $1)
      order by ic.sort, i.title`,
    [roomId]
  );
  const { rows: results } = await pool.query<{ category_id: string; winner_item_id: string; attempt: number; revealed: boolean }>(
    "select category_id, winner_item_id, attempt, revealed from category_results where category_id in (select id from categories where room_id = $1)",
    [roomId]
  );
  const { rows: feedback } = await pool.query<{ category_id: string; attempt: number; verdict: string; n: string }>(
    "select category_id, attempt, verdict, count(*) as n from result_feedback where category_id in (select id from categories where room_id = $1) group by category_id, attempt, verdict",
    [roomId]
  );

  return (
    <div className="flex w-full max-w-5xl flex-col gap-10 px-8 pt-12 pb-32">
      <header>
        <Link href={`/rooms/${roomId}`} className="text-sm text-subtle transition-colors hover:text-body">
          ← Volver a la sala
        </Link>
        <h1 className="text-2xl font-bold">🏆 Resultados: {room.title}</h1>
        <p className="text-sm text-subtle">
          {participants} participantes · se necesita {reportsNeeded(participants)} reporte(s) para forzar una corrección · máx 3 correcciones por categoría
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        {room.status === "open" ? (
          <ActionButton action={closeVoting} fields={{ roomId }} label="🔒 Cerrar votación ahora" confirm="¿Cerrar la votación? Nadie podrá votar más." />
        ) : (
          <ActionButton action={reopenVoting} fields={{ roomId }} label="🔓 Reabrir votación" confirm="¿Reabrir la votación para que puedan cambiar sus votos?" />
        )}
        <ActionButton action={revealNext} fields={{ roomId }} label="🎬 Revelar siguiente" />
        <Link
          href={`/rooms/${roomId}/reveal`}
          className="self-center text-sm underline text-subtle"
        >
          🎬 Ir a la pantalla de revelación en vivo
        </Link>
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-subtle">No hay categorías cargadas todavía.</p>
      )}

      <ul className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          const result = results.find((r) => r.category_id === cat.id);
          const attempt = result?.attempt ?? 0;
          const final = attempt >= MAX_ATTEMPTS;
          const reports = feedback.find((f) => f.category_id === cat.id && f.attempt === attempt && f.verdict === "report")?.n ?? "0";
          const agrees = feedback.find((f) => f.category_id === cat.id && f.attempt === attempt && f.verdict === "agree")?.n ?? "0";
          const dispute = Number(reports) >= reportsNeeded(participants);
          return (
            <li key={cat.id} className="rounded-xl border border-line/50 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{cat.name}</h3>
                <span className="text-xs">
                  {!result ? (
                    <span className="text-subtle">sin publicar</span>
                  ) : final ? (
                    <span className="rounded bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">FINAL</span>
                  ) : dispute ? (
                    <span className="rounded bg-red-500/10 px-2 py-0.5 text-danger">
                      EN DISPUTA ({reports}/{reportsNeeded(participants)}) — corrige y republica
                    </span>
                  ) : (
                    <span className="text-subtle">
                      {result.revealed ? "revelada · " : "oculta · "}
                      publicación {attempt} · de acuerdo {agrees} · reportes {reports}
                    </span>
                  )}
                </span>
              </div>
              {result && (
                <p className="mt-1 text-sm text-subtle">
                  Ganador publicado: <b>{items.find((i) => i.id === result.winner_item_id)?.title ?? "?"}</b>
                </p>
              )}
              {catItems.length > 0 && !final && (
                <ResultForm
                  key={attempt}
                  roomId={roomId}
                  categoryId={cat.id}
                  items={catItems}
                  currentWinnerId={result?.winner_item_id ?? null}
                  isCorrection={attempt > 0}
                />
              )}
              {catItems.length === 0 && <p className="mt-2 text-sm text-subtle">Sin objetos.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Suspense fallback={<p className="py-16 text-sm text-subtle">Cargando resultados...</p>}>
        <ResultsInner params={params} />
      </Suspense>
    </div>
  );
}

async function ResultsInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <ResultsPanel roomId={id} />;
}
