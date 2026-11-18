import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { tiebreakWinnerId } from "@/lib/tiebreak";
import LogoutButton from "@/components/logout-button";
import { CreateRoomForm, JoinRoomForm } from "@/components/room-forms";
import { ActionButton } from "@/components/admin-forms";
import { TiebreakStart, TiebreakPick } from "@/components/tiebreak";
import AutoRefresh from "@/components/auto-refresh";
import { requestReopen, supportReopen, adminReopen } from "./reopen/actions";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const STATUS_LABEL: Record<string, string> = {
  open: "🟢 Abierta",
  results: "🏆 Resultados",
  closed: "🔒 Cerrada",
};

async function RoomDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(id)) notFound();

  const user = await getUser();
  if (!user) redirect("/login");

  const { rows: roomRows } = await pool.query<{
    id: string;
    code: string;
    title: string;
    theme: string;
    status: string;
    deadline: Date | null;
    admin_user_id: string;
    allow_vote_edit: boolean;
  }>("select * from rooms where id = $1", [id]);
  const room = roomRows[0];
  if (!room) notFound();

  const isMember = await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [id, user.id]);
  if (!isMember.rows[0]) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">{room.title}</h1>
        <p className="text-zinc-500 dark:text-zinc-400">No sos parte de esta sala.</p>
        <Link href="/" className="underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const isAdmin = room.admin_user_id === user.id;

  const { rows: members } = await pool.query<{ name: string; avatar: string | null; is_admin: boolean }>(
    `select u.name, m.avatar, (u.id = $2) as is_admin
       from room_members m
       join users u on u.id = m.user_id
      where m.room_id = $1
      order by m.joined_at`,
    [id, room.admin_user_id]
  );

  // Totales de puntos (solo si hay resultados publicados)
  const { rows: totals } = await pool.query<{ name: string; user_id: string; pts: string; is_admin: boolean }>(
    `select u.name, m.user_id,
            coalesce(sum(case when r.winner_item_id = v.item_id and not w.is_invalid then 10 else 0 end), 0) as pts,
            (m.user_id = (select admin_user_id from rooms where id = $1)) as is_admin
       from room_members m
       join users u on u.id = m.user_id
       left join votes v on v.user_id = m.user_id
       left join categories c on c.id = v.category_id and c.room_id = m.room_id
       left join category_results r on r.category_id = c.id and r.revealed
       left join items w on w.id = r.winner_item_id
      where m.room_id = $1
      group by u.name, m.user_id
      order by pts desc, u.name`,
    [room.id]
  );
  const anyPublished = (await pool.query("select 1 from category_results r join categories c on c.id = r.category_id where c.room_id = $1 and r.revealed limit 1", [room.id])).rows.length > 0;

  const votingOpen = room.status === "open" && (room.deadline === null || new Date() < new Date(room.deadline) || room.allow_vote_edit);
  const roomClosed = !votingOpen;

  const { rows: categories } = await pool.query<{ id: string; name: string; item_count: number }>(
    `select c.id, c.name, count(i.id) as item_count
       from categories c
       left join items i on i.category_id = c.id
      where c.room_id = $1
      group by c.id, c.name, c.sort
      order by c.sort, c.name`,
    [id]
  );

  // ===== Podio, desempate y reapertura =====
  const players = totals.filter((t) => !t.is_admin).map((t) => ({ ...t, pts: Number(t.pts) }));
  const maxPts = Math.max(0, ...players.map((p) => p.pts));
  const top = maxPts > 0 ? players.filter((p) => p.pts === maxPts) : [];
  const rest = players.filter((p) => p.pts !== maxPts).sort((a, b) => b.pts - a.pts);

  let champions: string[] = [];
  let tiebreakNeeded = false;
  if (top.length === 1) champions = [top[0].user_id];
  else if (top.length === 2) champions = top.map((p) => p.user_id);
  else if (top.length > 2) {
    const winnerId = await tiebreakWinnerId(pool.query.bind(pool), room.id);
    if (winnerId) champions = [winnerId];
    else tiebreakNeeded = true;
  }

  // rondas del desempate (para la UI)
  const { rows: tbRounds } = await pool.query<{ id: string; round: number; participants: string[] }>(
    "select id, round, participants from tiebreak_rounds where room_id = $1 order by round",
    [room.id]
  );
  const nameOf = (uid: string) => totals.find((t) => t.user_id === uid)?.name ?? "?";
  const currentTb = tbRounds[tbRounds.length - 1] ?? null;
  const currentTbPicks = currentTb
    ? (await pool.query<{ user_id: string; pick: string }>(
        "select user_id, pick from tiebreak_picks where round_id = $1",
        [currentTb.id]
      )).rows
    : [];
  const iPendingPick = Boolean(currentTb && currentTb.participants.includes(user.id) && !currentTbPicks.some((p) => p.user_id === user.id));

  const participantsCount = totals.length;

  // solicitud de reapertura
  const { rows: reopenRows } = await pool.query<{ requester_id: string; supports: string; i_support: boolean; i_requested: boolean }>(
    `select rr.requester_id,
            count(rs.user_id)::text as supports,
            bool_or(rs.user_id = $2) as i_support,
            bool_or(rr.requester_id = $2) as i_requested
       from reopen_requests rr
       left join reopen_supports rs on rs.request_id = rr.id
      where rr.room_id = $1
      group by rr.requester_id`,
    [room.id, user.id]
  );
  const reopen = reopenRows[0] ?? null;
  const reopenSupportNeeded = Math.ceil((participantsCount - 1) / 2);
  const reopenReady = reopen ? Number(reopen.supports) >= reopenSupportNeeded : false;
  const reopenVisible = !anyPublished && !votingOpen;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8 px-6 pt-10 pb-24">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-400 hover:underline dark:text-zinc-500">
          ← Volver
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-3xl font-bold">{room.title}</h1>
          <span className="text-sm">{STATUS_LABEL[room.status] ?? room.status}</span>
        </div>
        {room.theme && <p className="text-zinc-500 dark:text-zinc-400">{room.theme}</p>}
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          {room.deadline
            ? `Vota hasta: ${new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(room.deadline)}`
            : "Sin fecha límite"}
        </p>
        {isAdmin && (
          <p className="text-sm">
            Código de la sala:{" "}
            <span className="rounded bg-zinc-100 px-2 py-1 font-mono font-bold tracking-widest dark:bg-zinc-800">
              {room.code}
            </span>{" "}
            <span className="text-zinc-400 dark:text-zinc-500">(compartilo con tus amigos)</span>
          </p>
        )}
        {isAdmin && (
          <Link
            href={`/rooms/${room.id}/results`}
            className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            🏆 Cargar resultados
          </Link>
        )}
      </header>

      {champions.length > 0 && (
        <section className="fade-up rounded-xl border-2 border-amber-400 bg-amber-50 p-6 text-center dark:bg-amber-900/20 dark:border-amber-600">
          <p className="text-sm uppercase tracking-wide text-amber-700 dark:text-amber-400">
            {anyPublished ? "Clasificación en vivo" : "Podio"}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
            {champions.map((cid) => (
              <span key={cid} className="flex flex-col items-center">
                <span className="crown-anim text-4xl">👑</span>
                <span className="text-lg font-bold">{nameOf(cid)}</span>
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  🥇 {players.find((p) => p.user_id === cid)?.pts} pts
                </span>
              </span>
            ))}
          </div>
          {rest.slice(0, 4).length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
              {rest.slice(0, 4).map((p, i) => (
                <span key={p.user_id}>
                  {i === 0 ? "🥈" : i === 1 ? "🥉" : "🏅"} {p.name} · {p.pts} pts
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {tiebreakNeeded && (
        <section className="rounded-xl border border-red-300 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
          <h2 className="font-bold">⚔️ Empate de {top.length} en {maxPts} pts: ¡desempate!</h2>
          {!currentTb && isAdmin ? (
            <div className="mt-3">
              <TiebreakStart roomId={room.id} participants={top.map((p) => p.user_id)} />
            </div>
          ) : !currentTb ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">El admin debe iniciar el desempate.</p>
          ) : null}
        </section>
      )}

      {currentTb && (
        <section className="rounded-xl border border-zinc-300 p-4 text-center dark:border-zinc-700">
          <h2 className="font-bold">🪨 Ronda {currentTb.round}</h2>
          {iPendingPick ? (
            <div className="mt-3">
              <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">Elegí en secreto (los demás no ven tu jugada):</p>
              <TiebreakPick roomId={room.id} roundId={currentTb.id} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Elecciones: {currentTbPicks.length}/{currentTb.participants.length}
              {iPendingPick === false && currentTb.participants.includes(user.id) && " (ya votaste esta ronda)"}
            </p>
          )}
          {tbRounds.length > 1 && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              {tbRounds.slice(0, -1).map((r) => `Ronda ${r.round}: siguió ${r.participants.length}`).join(" · ")}
            </p>
          )}
        </section>
      )}

      {reopenVisible && (
        <section className="rounded-xl border border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="font-bold">🔓 Reapertura de votos</h2>
          {!reopen ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                ¿Te arrepentiste de algún voto? Pedí reabrir y si la mitad o más apoya, el admin la habilita.
              </p>
              {!isAdmin && <ActionButton action={requestReopen} fields={{ roomId: room.id }} label="Solicitar reapertura" />}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span>
                <b>{nameOf(reopen.requester_id)}</b> pidió reabrir · apoyos {reopen.supports}/{reopenSupportNeeded}
                {reopenReady && " ✅"}
              </span>
              {!reopen.i_requested && !reopen.i_support && !isAdmin && (
                <ActionButton action={supportReopen} fields={{ roomId: room.id }} label="Apoyar" />
              )}
              {isAdmin && (
                <ActionButton
                  action={adminReopen}
                  fields={{ roomId: room.id }}
                  label={reopenReady ? "Reabrir votación (solicitud aprobada)" : "Reabrir de todos modos"}
                />
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Participantes ({members.length})
        </h2>
        <ul className="flex flex-wrap gap-4">
          {members.map((m) => (
            <li key={m.name} className="flex flex-col items-center gap-1 text-center">
              {m.avatar?.startsWith("url:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatar.slice(4)}
                  alt={m.name}
                  className="h-14 w-14 rounded-full border-2 border-zinc-300 object-cover dark:border-zinc-700"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-zinc-300 text-lg font-bold dark:border-zinc-700">
                  {initials(m.name)}
                </span>
              )}
              <span className="text-sm">
                {m.is_admin && "👑 "}
                {m.name}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Puntos
        </h2>
        {!anyPublished ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Los puntos aparecen cuando el admin publique resultados.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {totals.map((t) => (
              <li key={t.user_id} className="flex justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span>
                  {t.is_admin && "👑 "}
                  {t.name}
                </span>
                <span className="font-bold">{t.pts} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Categorías
        </h2>
        {categories.length === 0 ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            {isAdmin
              ? "Todavía no creaste categorías (Épica 3)."
              : "El admin todavía no cargó categorías."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/rooms/${room.id}/category/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">
                    {c.item_count} nominados →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <AutoRefresh />
      <Suspense fallback={<p className="py-16 text-sm text-zinc-400">Cargando sala...</p>}>
        <RoomDetail params={params} />
      </Suspense>
    </div>
  );
}
