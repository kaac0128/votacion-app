"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

function newCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export type ActionState = { error: string } | null;

export async function createRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  const title = String(formData.get("title") ?? "").trim();
  const theme = String(formData.get("theme") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim(); // ya viene ISO con timezone (lo convierte el cliente)

  if (title.length < 3 || title.length > 60) return { error: "Título de 3 a 60 caracteres" };
  if (theme.length > 200) return { error: "El tema no puede superar 200 caracteres" };
  if (deadline) {
    const d = new Date(deadline);
    if (isNaN(d.getTime()) || d.getTime() < Date.now()) return { error: "La fecha límite debe ser en el futuro" };
  }

  let roomId: string | null = null;
  for (let attempt = 0; attempt < 5 && !roomId; attempt++) {
    try {
      const { rows } = await pool.query(
        "insert into rooms (code, title, theme, deadline, admin_user_id) values ($1, $2, $3, $4, $5) returning id",
        [newCode(), title, theme, deadline || null, user.id]
      );
      await pool.query(
        "insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing",
        [rows[0].id, user.id]
      );
      roomId = rows[0].id;
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") {
        console.error(e);
        return { error: "No se pudo crear la sala" };
      }
      // colisión de código: reintenta con otro código
    }
  }
  if (!roomId) return { error: "No se pudo crear la sala" };

  revalidatePath("/");
  redirect(`/rooms/${roomId}`);
}

export async function joinRoom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "No autenticado" };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return { error: "Código inválido" };

  const { rows } = await pool.query("select id from rooms where code = $1", [code]);
  if (!rows[0]) return { error: "No existe una sala con ese código" };

  await pool.query(
    "insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing",
    [rows[0].id, user.id]
  );

  revalidatePath("/");
  redirect(`/rooms/${rows[0].id}`);
}
