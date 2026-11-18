"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";

export type ActionState = { error?: string; ok?: string } | null;

// Umbral de apoyo: >=50% de los demás participantes (sin contar admin ni al que pide)
export async function reopenSupportNeeded(roomId: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `select count(*) as n from room_members
      where room_id = $1
        and user_id <> (select admin_user_id from rooms where id = $1)`,
    [roomId]
  );
  return Math.ceil((Number(rows[0].n) - 1) / 2); // -1: el que pide no se auto-apoya
}

export async function requestReopen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (await isAdmin(roomId, user.id)) return { error: "El admin puede reabrir directamente desde Resultados" };

  const member = await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, user.id]);
  if (!member.rows[0]) return { error: "No sos parte de esta sala" };

  const { rows: anyResult } = await pool.query(
    "select 1 from category_results r join categories c on c.id = r.category_id where c.room_id = $1 limit 1",
    [roomId]
  );
  if (anyResult[0]) return { error: "Ya hay resultados: no se puede reabrir" };

  const { rows: existing } = await pool.query("select 1 from reopen_requests where room_id = $1", [roomId]);
  if (existing[0]) return { error: "Ya hay una solicitud de reapertura en curso" };

  await pool.query(
    "insert into reopen_requests (room_id, requester_id) values ($1, $2) on conflict (room_id, requester_id) do nothing",
    [roomId, user.id]
  );
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Solicitud enviada: esperando apoyos" };
}

export async function supportReopen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  const { rows: req } = await pool.query<{ id: string; requester_id: string }>(
    "select id, requester_id from reopen_requests where room_id = $1",
    [roomId]
  );
  if (!req[0]) return { error: "No hay solicitud abierta" };
  if (req[0].requester_id === user.id) return { error: "No podés apoyar tu propia solicitud" };

  const member = await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, user.id]);
  if (!member.rows[0]) return { error: "No sos parte de esta sala" };

  await pool.query(
    "insert into reopen_supports (request_id, user_id) values ($1, $2) on conflict do nothing",
    [req[0].id, user.id]
  );
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Apoyo registrado" };
}

export async function adminReopen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!(await isAdmin(roomId, user.id))) return { error: "Solo el admin puede reabrir" };

  const { rows: anyResult } = await pool.query(
    "select 1 from category_results r join categories c on c.id = r.category_id where c.room_id = $1 limit 1",
    [roomId]
  );
  if (anyResult[0]) return { error: "Ya hay resultados: no se puede reabrir" };

  await pool.query("update rooms set allow_vote_edit = true where id = $1", [roomId]);
  // la solicitud queda resuelta
  await pool.query("delete from reopen_requests where room_id = $1", [roomId]);
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Votación reabierta para todos" };
}

async function isAdmin(roomId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, userId]);
  return Boolean(rows[0]);
}
