"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Se usa en <form> de servidor (firma sin prev). El trigger de la DB es la
// última barrera del deadline; acá lo traducimos a un mensaje amigable.
export async function voteItem(formData: FormData): Promise<void> {
  const roomId = String(formData.get("roomId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const back = `/rooms/${roomId}/category/${categoryId}`;

  const user = await getUser();
  if (!user) redirect("/login");

  const member = await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [
    roomId,
    user.id,
  ]);
  if (!member.rows[0]) redirect(`/rooms/${roomId}`);

  const own = await pool.query("select 1 from items where id = $1 and category_id = $2", [itemId, categoryId]);
  if (!own.rows[0]) redirect(`${back}?err=invalid`);

  try {
    await pool.query(
      `insert into votes (user_id, category_id, item_id) values ($1, $2, $3)
       on conflict (user_id, category_id) do update set item_id = $3, updated_at = now()`,
      [user.id, categoryId, itemId]
    );
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes("voting is closed")) redirect(`${back}?err=closed`);
    throw e;
  }

  revalidatePath(back);
  redirect(back);
}
