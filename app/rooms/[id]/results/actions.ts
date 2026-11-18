"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";

export type ActionState = { error?: string; ok?: string } | null;

const MAX_ATTEMPTS = 4; // publicación original + 3 correcciones

export async function publishResult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const winnerItemId = String(formData.get("winnerItemId") ?? "");

  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const admin = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, user.id]);
  if (!admin.rows[0]) return { error: "Solo el admin puede hacer eso" };

  const own = await pool.query("select 1 from items where id = $1 and category_id = $2", [winnerItemId, categoryId]);
  if (!own.rows[0]) return { error: "Ese objeto no pertenece a la categoría" };

  const { rows: existing } = await pool.query<{ attempt: number }>(
    "select attempt from category_results where category_id = $1",
    [categoryId]
  );
  if (existing[0] && existing[0].attempt >= MAX_ATTEMPTS) {
    return { error: "Este resultado ya es FINAL (se agotaron las 3 correcciones)" };
  }

  const attempt = existing[0] ? existing[0].attempt + 1 : 1;
  await pool.query(
    `insert into category_results (category_id, winner_item_id, attempt, revealed, published_at)
     values ($1, $2, $3, false, now())
     on conflict (category_id) do update set winner_item_id = $2, attempt = $3, published_at = now()`,
    [categoryId, winnerItemId, attempt]
  );
  // la primera publicación cierra la votación de la sala
  await pool.query("update rooms set status = 'results' where id = $1 and status = 'open'", [roomId]);

  revalidatePath(`/rooms/${roomId}/results`);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/category/${categoryId}`);
  return { ok: attempt === 1 ? "Resultado publicado" : `Corrección ${attempt - 1}/3 publicada` };
}

export async function setFeedback(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const verdict = String(formData.get("verdict") ?? "");

  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const member = await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, user.id]);
  if (!member.rows[0]) return { error: "No sos parte de esta sala" };
  if (verdict !== "agree" && verdict !== "report") return { error: "Veredicto inválido" };

  const { rows: result } = await pool.query<{ attempt: number }>(
    "select attempt from category_results where category_id = $1",
    [categoryId]
  );
  if (!result[0]) return { error: "Todavía no hay resultado publicado" };
  if (result[0].attempt >= MAX_ATTEMPTS) return { error: "El resultado es final" };

  await pool.query(
    `insert into result_feedback (category_id, attempt, user_id, verdict)
     values ($1, $2, $3, $4)
     on conflict (category_id, attempt, user_id) do update set verdict = $4, created_at = now()`,
    [categoryId, result[0].attempt, user.id, verdict]
  );

  revalidatePath(`/rooms/${roomId}/category/${categoryId}`);
  revalidatePath(`/rooms/${roomId}/results`);
  return { ok: verdict === "agree" ? "De acuerdo registrado" : "Reporte registrado" };
}

// Cerrar la votación sin publicar todavía (útil cuando ya pasó la ceremonia)
export async function closeVoting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const admin = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, user.id]);
  if (!admin.rows[0]) return { error: "Solo el admin puede hacer eso" };
  await pool.query("update rooms set status = 'results' where id = $1 and status = 'open'", [roomId]);
  revalidatePath(`/rooms/${roomId}/results`);
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Votación cerrada" };
}

// Revelar el siguiente resultado oculto (estilo Kahoot)
export async function revealNext(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const admin = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, user.id]);
  if (!admin.rows[0]) return { error: "Solo el admin puede hacer eso" };

  const { rows: next } = await pool.query<{ category_id: string; name: string }>(
    `select r.category_id, c.name
       from category_results r
       join categories c on c.id = r.category_id
      where c.room_id = $1 and not r.revealed
      order by c.sort, c.name
      limit 1`,
    [roomId]
  );
  if (!next[0]) return { ok: "Todo está revelado 🎉" };

  await pool.query("update category_results set revealed = true where category_id = $1", [next[0].category_id]);
  revalidatePath(`/rooms/${roomId}/reveal`);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/category/${next[0].category_id}`);
  return { ok: `🎉 ${next[0].name} revelada` };
}

// Cerrar la sala definitivamente (historial)
export async function closeRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const admin = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, user.id]);
  if (!admin.rows[0]) return { error: "Solo el admin puede hacer eso" };
  await pool.query("update rooms set status = 'closed' where id = $1", [roomId]);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}/reveal`);
  revalidatePath("/");
  return { ok: "Sala cerrada" };
}

// Reabrir la votación (el admin decide, igual que el flujo de solicitud de la 6.1)
export async function reopenVoting(_prev: ActionState, formData: FormData): Promise<ActionState> {  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const admin = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, user.id]);
  if (!admin.rows[0]) return { error: "Solo el admin puede hacer eso" };
  const anyResult = await pool.query("select 1 from category_results r join categories c on c.id = r.category_id where c.room_id = $1 limit 1", [roomId]);
  if (anyResult.rows[0]) return { error: "Ya hay resultados publicados: no se puede reabrir" };
  await pool.query("update rooms set status = 'open', allow_vote_edit = true where id = $1", [roomId]);
  revalidatePath(`/rooms/${roomId}/results`);
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Votación reabierta para cambiar votos" };
}
