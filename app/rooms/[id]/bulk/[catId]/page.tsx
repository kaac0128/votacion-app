import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ActionButton } from "@/components/admin-forms";
import { generateDescription, saveBulkItem } from "../../admin/actions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";
const btnCls =
  "rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

async function Carousel({ roomId, categoryId }: { roomId: string; categoryId: string }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { rows: roomRows } = await pool.query<{ admin_user_id: string }>(
    "select admin_user_id from rooms where id = $1",
    [roomId]
  );
  if (!roomRows[0]) notFound();
  if (roomRows[0].admin_user_id !== user.id) redirect(`/rooms/${roomId}`);

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

  const pending = items.filter((i) => i.description === null);
  const current = pending[0];

  if (!current) {
    redirect(`/rooms/${roomId}`);
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header>
        <Link href={`/rooms/${roomId}/admin`} className="text-sm text-zinc-400 hover:underline dark:text-zinc-500">
          ← Volver al panel
        </Link>
        <h1 className="text-2xl font-bold">🃏 Carrusel: {catRows[0].name}</h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Objeto {items.length - pending.length + 1} de {items.length} — quedan {pending.length} sin describir
        </p>
      </header>

      <form action={saveBulkItem} className="flex flex-col gap-3">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="itemId" value={current.id} />
        <div>
          <label htmlFor="bulk-title" className="mb-1 block text-sm font-medium">Título</label>
          <input id="bulk-title" name="title" defaultValue={current.title} required maxLength={80} className={inputCls} />
        </div>
        <div>
          <label htmlFor="bulk-desc" className="mb-1 block text-sm font-medium">Descripción</label>
          <textarea
            id="bulk-desc"
            name="description"
            defaultValue={current.description ?? ""}
            maxLength={500}
            rows={4}
            placeholder="Breve descripción gamer (podés generarla con IA)"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="bulk-img" className="mb-1 block text-sm font-medium">URL de imagen (opcional)</label>
          <input id="bulk-img" name="imageUrl" type="url" defaultValue={current.image_url ?? ""} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isInvalid" defaultChecked={current.is_invalid} /> Inválido (vale 0 siempre)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" name="intent" value="save" className={btnCls}>
            ✔ Guardar y seguir
          </button>
          <button
            type="submit"
            name="intent"
            value="skip"
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
          >
            ⏭ Saltar
          </button>
          <ActionButton
            action={generateDescription}
            fields={{ roomId, itemId: current.id, categoryId }}
            label="🤖 Generar con IA"
          />
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Saltar guarda lo cargado hasta ahora y pasa al siguiente. Podés regenerar descripciones después desde el panel.
        </p>
      </form>
    </div>
  );
}

export default function BulkPage({ params }: { params: Promise<{ id: string; catId: string }> }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Suspense fallback={<p className="py-16 text-sm text-zinc-400">Cargando carrusel...</p>}>
        <CarouselInner params={params} />
      </Suspense>
    </div>
  );
}

async function CarouselInner({ params }: { params: Promise<{ id: string; catId: string }> }) {
  const { id, catId } = await params;
  if (!uuid.test(id) || !uuid.test(catId)) notFound();
  return <Carousel roomId={id} categoryId={catId} />;
}
