export const instant = false;

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
import {
  ArrowLeft,
  CheckCircle,
  Crown,
  Door,
  GearSix,
  Lightning,
  LockSimple,
  Medal,
  Play,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const STATUS_BADGE: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  open: { icon: <Lightning weight="fill" className="h-4 w-4" />, label: "Abierta", cls: "text-emerald-400" },
  results: { icon: <Trophy weight="fill" className="h-4 w-4" />, label: "Resultados", cls: "text-zinc-100" },
  closed: { icon: <LockSimple weight="fill" className="h-4 w-4" />, label: "Cerrada", cls: "text-subtle" },
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-5 flex items-center gap-2 border-b border-line/50 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
      {icon}
      {children}
    </h2>
  );
}

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
        <p className="text-subtle">No sos parte de esta sala.</p>
        <Link href="/" className="text-secondary underline">
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

  // Totales de puntos (solo si hay resultados revelados)
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

  const badge = STATUS_BADGE[room.status];

  return (
    <div className="flex w-full max-w-6xl flex-col gap-10 px-8 pt-12 pb-32">
      <header className="flex flex-col gap-3">
        <Link href="/" className="flex items-center gap-1 text-sm text-subtle transition-colors hover:text-body">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl tracking-wide">{room.title}</h1>
          <span className={`flex items-center gap-1.5 rounded-full border border-line/50 bg-card px-3 py-1 text-sm ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
        </div>
        {room.theme && <p className="text-secondary">{room.theme}</p>}
        <p className="text-sm text-subtle">
          {room.deadline
            ? `Vota hasta: ${new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(room.deadline)}`
            : "Sin fecha límite"}
        </p>
        {isAdmin && (
          <p className="text-sm">
            Código de la sala:{" "}
            <span className="rounded border border-primary/40 bg-primary/20 px-2 py-1 font-mono font-bold tracking-widest text-secondary">
              {room.code}
            </span>{" "}
            <span className="text-subtle">(compartilo con tus amigos)</span>
          </p>
        )}
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/rooms/${room.id}/admin`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <GearSix weight="fill" className="h-4 w-4" /> Administrar sala
            </Link>
            <Link
              href={`/rooms/${room.id}/results`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-rose-500"
            >
              <Trophy weight="fill" className="h-4 w-4" /> Cargar resultados
            </Link>
          </div>
        )}
      </header>

      {champions.length > 0 && (
        <section className="fade-up rounded-xl border border-line/50 bg-card p-6 text-center">
          <p className="text-xs uppercase tracking-widest text-amber-400">
            {anyPublished ? "Clasificación en vivo" : "Podio"}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
            {champions.map((cid) => (
              <span key={cid} className="flex flex-col items-center">
                <Crown weight="fill" className="crown-anim h-10 w-10" />
                <span className="font-display text-lg tracking-wide">{nameOf(cid)}</span>
                <span className="text-sm text-amber-400">
                  {players.find((p) => p.user_id === cid)?.pts} pts
                </span>
              </span>
            ))}
          </div>
          {rest.slice(0, 4).length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm text-body">
              {rest.slice(0, 4).map((p, i) => (
                <span key={p.user_id} className="flex items-center gap-1">
                  <Medal weight="fill" className={`h-4 w-4 ${i === 0 ? "text-zinc-300" : i === 1 ? "text-amber-700" : "text-subtle"}`} />
                  {p.name} · {p.pts} pts
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {tiebreakNeeded && (
        <section className="rounded-xl border border-red-500/30 bg-danger/10 p-4 text-center">
          <h2 className="flex items-center justify-center gap-2 font-bold">
            <Lightning weight="fill" className="h-5 w-5 text-zinc-100" />
            Empate de {top.length} en {maxPts} pts: ¡desempate!
          </h2>
          {!currentTb && isAdmin ? (
            <div className="mt-3">
              <TiebreakStart roomId={room.id} participants={top.map((p) => p.user_id)} />
            </div>
          ) : !currentTb ? (
            <p className="mt-2 text-sm text-subtle">El admin debe iniciar el desempate.</p>
          ) : null}
        </section>
      )}

      {currentTb && (
        <section className="rounded-xl border border-line/50 bg-card p-4 text-center">
          <h2 className="font-display tracking-wide">Ronda {currentTb.round}</h2>
          {iPendingPick ? (
            <div className="mt-3">
              <p className="mb-2 text-sm text-subtle">Elegí en secreto (los demás no ven tu jugada):</p>
              <TiebreakPick roomId={room.id} roundId={currentTb.id} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-subtle">
              Elecciones: {currentTbPicks.length}/{currentTb.participants.length}
              {currentTb.participants.includes(user.id) && " (ya votaste esta ronda)"}
            </p>
          )}
          {tbRounds.length > 1 && (
            <p className="mt-2 text-xs text-subtle">
              {tbRounds.slice(0, -1).map((r) => `Ronda ${r.round}: siguió ${r.participants.length}`).join(" · ")}
            </p>
          )}
        </section>
      )}

      {reopenVisible && (
        <section className="rounded-xl border border-line/50 bg-card p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <Door className="h-5 w-5 text-secondary" /> Reapertura de votos
          </h2>
          {!reopen ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-subtle">
                ¿Te arrepentiste de algún voto? Pedí reabrir y si la mitad o más apoya, el admin la habilita.
              </p>
              {!isAdmin && <ActionButton action={requestReopen} fields={{ roomId: room.id }} label="Solicitar reapertura" />}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span>
                <b>{nameOf(reopen.requester_id)}</b> pidió reabrir · apoyos {reopen.supports}/{reopenSupportNeeded}
                {reopenReady && (
                  <span className="ml-1 inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle weight="fill" className="h-4 w-4" /> solicitud aprobada
                  </span>
                )}
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

      <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex flex-col gap-10">
          <section>
            <SectionTitle icon={<Trophy weight="fill" className="h-4 w-4" />}>Puntos</SectionTitle>
            {!anyPublished ? (
              <p className="text-sm text-subtle">Los puntos aparecen cuando el admin publique resultados.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {totals.map((t) => (
                  <li key={t.user_id} className="flex items-center justify-between rounded-lg border border-line/50 bg-card px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {t.is_admin && <Crown weight="fill" className="h-3.5 w-3.5 text-amber-400" />}
                      {t.name}
                    </span>
                    <span className="font-bold text-secondary">{t.pts} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle icon={<Play weight="fill" className="h-4 w-4" />}>Categorías</SectionTitle>
            {categories.length === 0 ? (
              <p className="text-sm text-subtle">
                {isAdmin
                  ? "Todavía no creaste categorías. Entrá a Administrar sala para cargarlas."
                  : "El admin todavía no cargó categorías."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/rooms/${room.id}/category/${c.id}`}
                      className="flex items-center justify-between rounded-xl border border-line/50 bg-card px-5 py-4 transition-colors hover:border-primary"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm text-subtle">{c.item_count} nominados →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-10">
          <section>
            <SectionTitle icon={<UsersThree weight="fill" className="h-4 w-4" />}>
              Participantes ({members.length})
            </SectionTitle>
            <ul className="flex flex-wrap gap-5">
              {members.map((m) => (
                <li key={m.name} className="flex flex-col items-center gap-1 text-center">
                  {m.avatar?.startsWith("url:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar.slice(4)}
                      alt={m.name}
                      className="h-16 w-16 rounded-full border-2 border-primary/40 object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/40 bg-card text-lg font-bold text-secondary">
                      {initials(m.name)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-sm">
                    {m.is_admin && <Crown weight="fill" className="h-3.5 w-3.5 text-amber-400" />}
                    {m.name}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <AutoRefresh />
      <Suspense fallback={<p className="py-16 text-sm text-subtle">Cargando sala...</p>}>
        <RoomDetail params={params} />
      </Suspense>
    </div>
  );
}
