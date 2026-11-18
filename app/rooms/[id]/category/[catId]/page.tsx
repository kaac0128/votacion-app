import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import VoteForm from "@/components/vote-form";
import { ActionButton } from "@/components/admin-forms";
import { setFeedback } from "@/app/rooms/[id]/results/actions";
import { voteItem } from "./actions";
import AutoRefresh from "@/components/auto-refresh";
import { CheckCircle, Trophy, X } from "@phosphor-icons/react/dist/ssr";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

async function CategoryVote({
  roomId,
  categoryId,
  err,
}: {
  roomId: string;
  categoryId: string;
  err: string | null;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { rows: roomRows } = await pool.query<{ id: string; title: string; status: string; deadline: Date | null; allow_vote_edit: boolean }>(
    "select id, title, status, deadline, allow_vote_edit from rooms where id = $1",
    [roomId]
  );
  const room = roomRows[0];
  if (!room) notFound();

  const member = await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, user.id]);
  if (!member.rows[0]) redirect(`/rooms/${roomId}`);

  const { rows: catRows } = await pool.query<{ name: string }>(
    "select name from categories where id = $1 and room_id = $2",
    [categoryId, roomId]
  );
  if (!catRows[0]) notFound();

  const { rows: items } = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    is_invalid: boolean;
  }>(
    "select id, title, description, image_url, is_invalid from items where category_id = $1 order by sort, title",
    [categoryId]
  );

  const { rows: myVoteRows } = await pool.query<{ item_id: string }>(
    "select item_id from votes where user_id = $1 and category_id = $2",
    [user.id, categoryId]
  );
  const myVoteId = myVoteRows[0]?.item_id ?? null;

  // Transparencia: los votos ajenos se ven solo después de votar esta categoría
  let others: { name: string; title: string }[] = [];
  if (myVoteId) {
    const { rows } = await pool.query<{ name: string; title: string }>(
      `select u.name, i.title
         from votes v
         join users u on u.id = v.user_id
         join items i on i.id = v.item_id
        where v.category_id = $1`,
      [categoryId]
    );
    others = rows;
  }

  // Resultado publicado (si existe) + mi veredicto + estado de disputa
  const { rows: resultRows } = await pool.query<{ winner_item_id: string; attempt: number; revealed: boolean; winner_title: string; winner_invalid: boolean }>(
    `select r.winner_item_id, r.attempt, r.revealed, i.title as winner_title, i.is_invalid as winner_invalid
       from category_results r join items i on i.id = r.winner_item_id
      where r.category_id = $1`,
    [categoryId]
  );
  const result = resultRows[0]?.revealed ? resultRows[0] : null;
  const resultHidden = Boolean(resultRows[0] && !resultRows[0].revealed);

  let myVerdict: string | null = null;
  let reports = 0;
  let agrees = 0;
  let participants = 0;
  if (result) {
    const { rows: fb } = await pool.query<{ verdict: string }>(
      "select verdict from result_feedback where category_id = $1 and attempt = $2 and user_id = $3",
      [categoryId, result.attempt, user.id]
    );
    myVerdict = fb[0]?.verdict ?? null;
    const { rows: counts } = await pool.query<{ verdict: string; n: string }>(
      "select verdict, count(*) as n from result_feedback where category_id = $1 and attempt = $2 group by verdict",
      [categoryId, result.attempt]
    );
    reports = Number(counts.find((c) => c.verdict === "report")?.n ?? 0);
    agrees = Number(counts.find((c) => c.verdict === "agree")?.n ?? 0);
    const { rows: p } = await pool.query<{ n: string }>(
      `select count(*) as n from room_members where room_id = $1 and user_id <> (select admin_user_id from rooms where id = $1)`,
      [roomId]
    );
    participants = Number(p[0].n);
  }

  const votingOpen = room.status === "open" && (room.deadline === null || new Date() < new Date(room.deadline) || room.allow_vote_edit);
  const closed = !votingOpen;
  const MAX_ATTEMPTS = 4;
  const resultFinal = result?.attempt ? result.attempt >= MAX_ATTEMPTS : false;
  const inDispute = result ? reports >= Math.ceil(participants / 2) : false;

  const errMessage =
    err === "closed" ? "La votación está cerrada: no se puede guardar el voto." :
    err === "invalid" ? "Ese objeto no pertenece a esta categoría." : null;
  const myPick = items.find((i) => i.id === myVoteId);
  return (
    <div className="flex w-full max-w-xl flex-col gap-6 px-6 pt-10 pb-24">
      <header>
        <Link href={`/rooms/${roomId}`} className="text-sm text-subtle transition-colors hover:text-body">
          ← {room.title}
        </Link>
        <h1 className="text-2xl font-bold">🗳 {catRows[0].name}</h1>
        <p className="text-sm text-subtle">
          {closed
            ? "Votación cerrada"
            : room.deadline
              ? `Podés cambiar tu voto hasta ${formatDate(room.deadline)}`
              : "Podés cambiar tu voto hasta que el admin cierre la sala"}
        </p>
      </header>

      {closed ? (
        resultHidden ? (
          <div className="rounded-xl border border-zinc-800 bg-card p-6 text-center">
            <p className="text-lg font-semibold">El resultado ya está cargado</p>
            <p className="mt-1 text-sm text-subtle">
              El admin lo va a revelar en vivo. Podés seguir la revelación desde la sala.
            </p>
          </div>
        ) : result ? (
          <section className="flex flex-col gap-3 rounded-xl border border-emerald-300 p-4 dark:border-emerald-800">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy weight="fill" className="h-5 w-5 text-accent" /> Resultado: {result.winner_title}</h2>
            {myVoteId && (
              <p className="text-sm">
                Tu elección: <b>{myPick?.title ?? "—"}</b> →{" "}
                {!result.winner_invalid && myVoteId === result.winner_item_id ? (
                  <span className="flex items-center gap-1 text-emerald-400"><CheckCircle weight="fill" className="h-4 w-4" /> +10 puntos</span>
                ) : (
                  <span className="flex items-center gap-1 text-danger"><X weight="fill" className="h-4 w-4" /> 0 puntos</span>
                )}
              </p>
            )}
            <p className="text-sm text-subtle">
              {resultFinal ? (
                "Resultado FINAL (se agotaron las 3 correcciones)"
              ) : inDispute ? (
                "EN DISPUTA: el admin debe corregir el resultado"
              ) : (
                `Publicación ${result.attempt} · 👍 ${agrees} de acuerdo · 🚩 ${reports} reportes (se necesitan ${Math.ceil(participants / 2)})`
              )}
            </p>
            {!resultFinal && (
              <div className="flex flex-wrap gap-3">
                <ActionButton
                  action={setFeedback}
                  fields={{ roomId, categoryId, verdict: "agree" }}
                  label={myVerdict === "agree" ? "👍 Estás de acuerdo" : "👍 De acuerdo"}
                />
                <ActionButton
                  action={setFeedback}
                  fields={{ roomId, categoryId, verdict: "report" }}
                  label={myVerdict === "report" ? "🚩 Ya reportaste" : "🚩 Reportar"}
                />
              </div>
            )}
            {others.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-subtle">
                  Lo que votaron todos
                </h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {others.map((o) => (
                    <li key={o.name} className="text-body">
                      <b>{o.name}</b> → {o.title}
                      {result && o.title === result.winner_title && <CheckCircle weight="fill" className="inline h-4 w-4 text-emerald-400" />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : myVoteId ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-subtle">Tu voto quedó guardado y no se puede cambiar.</p>
            {others.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-subtle">
                  Lo que votaron todos
                </h2>
                <ul className="flex flex-col gap-1 text-sm">
                  {others.map((o) => (
                    <li key={o.name} className="text-body">
                      <b>{o.name}</b> → {o.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-subtle">No llegaste a votar en esta categoría.</p>
        )
      ) : (
        <>
          <VoteForm
            action={voteItem}
            roomId={roomId}
            categoryId={categoryId}
            items={items}
            myVoteId={myVoteId}
            initialError={errMessage}
          />
          {myVoteId && others.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-subtle">
                Ya votaron
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {others.map((o) => (
                  <li key={o.name} className="text-body">
                    <b>{o.name}</b> → {o.title}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-subtle">
                Podés cambiar tu voto hasta el cierre.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <AutoRefresh />
      <Suspense fallback={<p className="py-16 text-sm text-subtle">Cargando votación...</p>}>
        <CategoryInner params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryInner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { id, catId } = await params;
  const { err } = await searchParams;
  if (!uuid.test(id) || !uuid.test(catId)) notFound();
  return <CategoryVote roomId={id} categoryId={catId} err={err ?? null} />;
}
