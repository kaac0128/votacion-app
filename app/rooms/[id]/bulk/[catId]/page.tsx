export const instant = false;

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { ActionButton } from "@/components/admin-forms";
import { generateDescription, saveBulkItem } from "../../admin/actions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inputCls =
  "w-full rounded-lg border border-primary/40 bg-zinc-900/80 px-3 py-2 outline-none transition-colors focus:border-primary";
const btnCls =
  "rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50";

async function Carousel({ roomId, categoryId, msg }: { roomId: string; categoryId: string; msg: string | null }) {
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
    `select i.id, i.title, i.description, i.image_url, i.is_invalid
       from items i
       join item_categories ic on ic.item_id = i.id
      where ic.category_id = $1
      order by ic.sort, i.title`,
    [categoryId]
  );

  const pending = items.filter((i) => i.description === null);
  const current = pending[0];

  if (!current) {
    redirect(`/rooms/${roomId}`);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8 px-8 pt-12 pb-32">
      <header>
        <Link href={`/rooms/${roomId}/admin`} className="text-sm text-subtle transition-colors hover:text-body">
          ← Volver al panel
        </Link>
        <h1 className="font-display text-2xl tracking-wide">Carrusel: {catRows[0].name}</h1>
      {msg && (
        <p className="rounded-lg border border-zinc-800 bg-card px-4 py-2 text-sm text-secondary">{msg}</p>
      )}
      {msg && (
        <p className="rounded-lg border border-zinc-800 bg-card px-4 py-2 text-sm text-secondary">{msg}</p>
      )}
        <p className="text-sm text-subtle">
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
            Guardar y seguir
          </button>
          <button
            type="submit"
            name="intent"
            value="skip"
            className="rounded-lg border border-primary/40 px-4 py-2 font-semibold transition-colors hover:bg-card-hover"
          >
            Saltar
          </button>
          <ActionButton
            action={generateDescription}
            fields={{ roomId, itemId: current.id, categoryId }}
            label="Generar con IA"
          />
        </div>
        <p className="text-xs text-subtle">
          Saltar guarda lo cargado hasta ahora y pasa al siguiente. Podés regenerar descripciones después desde el panel.
        </p>
      </form>
    </div>
  );
}

export default function BulkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Suspense fallback={<p className="py-16 text-sm text-subtle">Cargando carrusel...</p>}>
        <CarouselInner params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CarouselInner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const { id, catId } = await params;
  const { msg } = await searchParams;
  if (!uuid.test(id) || !uuid.test(catId)) notFound();
  return <Carousel roomId={id} categoryId={catId} msg={msg ?? null} />;
}
