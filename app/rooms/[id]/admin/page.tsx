import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import {
  AddCategoryForm,
  AddItemForm,
  AiConfigForm,
  BulkForm,
  ItemRow,
  ActionButton,
} from "@/components/admin-forms";
import { deleteCategory } from "./actions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function AdminPanel({ roomId }: { roomId: string }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { rows: roomRows } = await pool.query<{ id: string; title: string; admin_user_id: string; ai_provider: string | null; ai_key: string | null; ai_model: string | null }>(
    "select id, title, admin_user_id, ai_provider, ai_key, ai_model from rooms where id = $1",
    [roomId]
  );
  const room = roomRows[0];
  if (!room) notFound();
  if (room.admin_user_id !== user.id) redirect(`/rooms/${roomId}`);

  const { rows: categories } = await pool.query<{ id: string; name: string }>(
    "select id, name from categories where room_id = $1 order by sort, name",
    [roomId]
  );
  const { rows: items } = await pool.query<{
    id: string;
    category_id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    is_invalid: boolean;
  }>(
    "select id, category_id, title, description, image_url, is_invalid from items where category_id in (select id from categories where room_id = $1) order by sort, title",
    [roomId]
  );

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8 px-6 pt-10 pb-24">
      <header>
        <Link href={`/rooms/${roomId}`} className="text-sm text-subtle transition-colors hover:text-body">
          ← Volver a la sala
        </Link>
        <h1 className="font-display text-2xl tracking-wide">Administrar: {room.title}</h1>
      </header>

      <AiConfigForm roomId={roomId} provider={room.ai_provider} hasKey={Boolean(room.ai_key)} model={room.ai_model} />

      <section className="flex flex-col gap-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Categorías</h2>
        <AddCategoryForm roomId={roomId} />

        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          return (
            <div key={cat.id} className="rounded-xl border border-zinc-800 bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">
                  {cat.name} <span className="text-sm font-normal text-subtle">({catItems.length})</span>
                </h3>
                <ActionButton
                  action={deleteCategory}
                  fields={{ roomId, categoryId: cat.id }}
                  label="Borrar categoría"
                  confirm={`¿Borrar la categoría "${cat.name}" y todos sus objetos?`}
                />
              </div>
              {catItems.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {catItems.map((item) => (
                    <ItemRow key={item.id} roomId={roomId} categoryId={cat.id} item={item} />
                  ))}
                </ul>
              )}
              <AddItemForm roomId={roomId} categoryId={cat.id} />
              <BulkForm roomId={roomId} categoryId={cat.id} />
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Suspense fallback={<p className="py-16 text-sm text-subtle">Cargando...</p>}>
        <AdminPanelInner params={params} />
      </Suspense>
    </div>
  );
}

async function AdminPanelInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <AdminPanel roomId={id} />;
}
