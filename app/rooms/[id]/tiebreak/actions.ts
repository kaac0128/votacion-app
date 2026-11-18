"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { roundSurvivors } from "@/lib/tiebreak";

export type ActionState = { error?: string; ok?: string } | null;

export async function startTiebreak(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const participants = formData.getAll("participants").map(String);
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  const admin = await pool.query("select 1 from rooms where id = $1 and admin_user_id = $2", [roomId, user.id]);
  if (!admin.rows[0]) return { error: "Solo el admin puede iniciar el desempate" };
  if (participants.length < 3) return { error: "El desempate es para 3 o más empatados" };

  const { rows: existing } = await pool.query(
    "select 1 from tiebreak_rounds where room_id = $1",
    [roomId]
  );
  if (existing[0]) return { error: "Ya hay un desempate en curso" };

  await pool.query(
    "insert into tiebreak_rounds (room_id, round, participants) values ($1, 1, $2)",
    [roomId, participants]
  );
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Desempate iniciado: ¡que elijan!" };
}

export async function submitPick(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const roundId = String(formData.get("roundId") ?? "");
  const pick = String(formData.get("pick") ?? "");
  const user = await getUser();
  if (!user) return { error: "No autenticado" };
  if (!["rock", "paper", "scissors"].includes(pick)) return { error: "Elección inválida" };

  const { rows: rounds } = await pool.query<{ round: number; participants: string[] }>(
    "select round, participants from tiebreak_rounds where id = $1 and room_id = $2",
    [roundId, roomId]
  );
  const current = rounds[0];
  if (!current) return { error: "Ronda no encontrada" };
  if (!current.participants.includes(user.id)) return { error: "No jugás esta ronda" };

  await pool.query(
    "insert into tiebreak_picks (round_id, user_id, pick) values ($1, $2, $3) on conflict (round_id, user_id) do update set pick = $3",
    [roundId, user.id, pick]
  );

  const { rows: picks } = await pool.query<{ user_id: string; pick: string }>(
    "select user_id, pick from tiebreak_picks where round_id = $1",
    [roundId]
  );

  if (picks.length < current.participants.length) {
    revalidatePath(`/rooms/${roomId}`);
    return { ok: "Elección enviada (secreta hasta que elijan todos)" };
  }

  const survivors = roundSurvivors(picks);
  if (survivors.length === 1) {
    revalidatePath(`/rooms/${roomId}`);
    return { ok: "¡Desempate terminado!" };
  }

  // nueva ronda con los sobrevivientes
  await pool.query(
    "insert into tiebreak_rounds (room_id, round, participants) values ($1, $2, $3)",
    [roomId, current.round + 1, survivors]
  );
  revalidatePath(`/rooms/${roomId}`);
  return { ok: "Ronda repetida: pasaron todos / ciclo" };
}
