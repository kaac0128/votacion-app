"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { generateAiDescription } from "@/lib/ai";

export type ActionState = { error?: string; ok?: string } | null;

async function requireAdmin(roomId: string): Promise<{ room: { theme: string; ai_provider: string | null; ai_key: string | null; ai_model: string | null } }> {
  const user = await getUser();
  if (!user) throw new Error("No autenticado");
  const { rows } = await pool.query(
    "select theme, ai_provider, ai_key, ai_model from rooms where id = $1 and admin_user_id = $2",
    [roomId, user.id]
  );
  if (!rows[0]) throw new Error("Solo el admin puede hacer eso");
  return { room: rows[0] };
}

function roomPath(roomId: string): string {
  return `/rooms/${roomId}`;
}

// ---- IA ----

export async function saveAiConfig(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  try {
    await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  const provider = String(formData.get("provider") ?? "");
  const key = String(formData.get("key") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (provider && provider !== "gemini" && provider !== "openrouter") {
    return { error: "Proveedor inválido" };
  }
  if (key && key.length > 300) return { error: "Clave demasiado larga" };
  await pool.query(
    `update rooms set
       ai_provider = $2,
       ai_key = case when $3::text = '' then ai_key else $3 end,
       ai_model = $4
     where id = $1`,
    [roomId, provider || null, key, model || null]
  );
  revalidatePath(roomPath(roomId) + "/admin");
  return { ok: key ? "Configuración guardada" : "Configuración guardada (clave anterior mantenida)" };
}

export async function generateDescription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  let admin;
  try {
    admin = await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  if (!admin.room.ai_provider || !admin.room.ai_key) {
    return { error: "Primero configurá la clave de IA" };
  }
  const { rows } = await pool.query<{ title: string; category: string }>(
    `select i.title, c.name as category
       from items i join categories c on c.id = i.category_id
      where i.id = $1 and c.room_id = $2`,
    [itemId, roomId]
  );
  if (!rows[0]) return { error: "Objeto no encontrado" };
  try {
    const description = await generateAiDescription({
      provider: admin.room.ai_provider as "gemini" | "openrouter",
      key: admin.room.ai_key,
      model: admin.room.ai_model,
      theme: admin.room.theme,
      category: rows[0].category,
      title: rows[0].title,
    });
    await pool.query("update items set description = $2 where id = $1", [itemId, description]);
    revalidatePath(roomPath(roomId) + "/admin");
    revalidatePath(`${roomPath(roomId)}/bulk/${formData.get("categoryId") ?? ""}`);
    return { ok: "Descripción generada" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error de IA" };
  }
}

// ---- Categorías ----

export async function addCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  try {
    await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 40) return { error: "Nombre de 2 a 40 caracteres" };
  try {
    await pool.query(
      "insert into categories (room_id, name, sort) select $1, $2, coalesce(max(sort), 0) + 1 from categories where room_id = $1",
      [roomId, name]
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return { error: "Ya existe esa categoría" };
    throw e;
  }
  revalidatePath(roomPath(roomId) + "/admin");
  revalidatePath(roomPath(roomId));
  return { ok: `Categoría "${name}" creada` };
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  await pool.query("delete from categories where id = $1 and room_id = $2", [categoryId, roomId]);
  revalidatePath(roomPath(roomId) + "/admin");
  revalidatePath(roomPath(roomId));
  return null;
}

// ---- Objetos ----

export async function addItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const isInvalid = formData.get("isInvalid") === "on";
  if (title.length < 1 || title.length > 80) return { error: "Título de 1 a 80 caracteres" };
  if (description.length > 500) return { error: "Descripción demasiado larga" };
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) return { error: "La URL de imagen debe empezar con http(s)://" };
  const { rows } = await pool.query<{ sort: number }>(
    "select coalesce(max(sort), 0) + 1 as sort from items where category_id = $1",
    [categoryId]
  );
  // valida que la categoría sea de esta sala
  const own = await pool.query("select 1 from categories where id = $1 and room_id = $2", [categoryId, roomId]);
  if (!own.rows[0]) return { error: "Categoría no encontrada" };
  await pool.query(
    "insert into items (category_id, title, description, image_url, is_invalid, sort) values ($1, $2, $3, $4, $5, $6)",
    [categoryId, title, description || null, imageUrl || null, isInvalid, rows[0].sort]
  );
  revalidatePath(roomPath(roomId) + "/admin");
  revalidatePath(roomPath(roomId));
  return { ok: `"${title}" agregado` };
}

export async function deleteItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  try {
    await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  await pool.query(
    "delete from items where id = $1 and category_id in (select id from categories where room_id = $2)",
    [itemId, roomId]
  );
  revalidatePath(roomPath(roomId) + "/admin");
  revalidatePath(roomPath(roomId));
  return null;
}

// ---- Carga masiva ----

export async function bulkAddItems(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const roomId = String(formData.get("roomId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await requireAdmin(roomId);
  } catch {
    return { error: "Solo el admin puede hacer eso" };
  }
  const own = await pool.query("select 1 from categories where id = $1 and room_id = $2", [categoryId, roomId]);
  if (!own.rows[0]) return { error: "Categoría no encontrada" };

  const titles = [...new Set(
    String(formData.get("titles") ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  )].slice(0, 50);
  if (titles.length === 0) return { error: "Pegá al menos un título (uno por línea)" };

  const { rows: last } = await pool.query<{ sort: number }>(
    "select coalesce(max(sort), 0) as sort from items where category_id = $1",
    [categoryId]
  );
  const values = titles.map((t, i) => `($1, $${2 + i * 2}, $${3 + i * 2}, ${last[0].sort + i + 1})`);
  const params = [categoryId, ...titles.flatMap((t) => [t.slice(0, 80), null])];
  await pool.query(
    `insert into items (category_id, title, description, sort) values ${values.join(", ")}`,
    params
  );
  revalidatePath(roomPath(roomId) + "/admin");
  redirect(`${roomPath(roomId)}/bulk/${categoryId}`);
}

// Acción del carrusel: se usa en <form> de servidor (sin prev). intent = save | skip
export async function saveBulkItem(formData: FormData): Promise<void> {
  const roomId = String(formData.get("roomId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  await requireAdmin(roomId);
  const title = String(formData.get("title") ?? "").trim().slice(0, 80) || "Sin título";
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const isInvalid = formData.get("isInvalid") === "on";
  // '' marca "revisado" en el carrusel; NULL marca pendiente. Por eso no se coerciona a null.
  await pool.query(
    `update items set title = $2, description = $3, image_url = $4, is_invalid = $5
      where id = $1 and category_id in (select id from categories where room_id = $6)`,
    [itemId, title, description, imageUrl || null, isInvalid, roomId]
  );
  revalidatePath(`${roomPath(roomId)}/bulk/${formData.get("categoryId") ?? ""}`);
  redirect(`${roomPath(roomId)}/bulk/${formData.get("categoryId") ?? ""}`);
}
