"use client";

import { useActionState } from "react";
import {
  addCategory,
  addItem,
  bulkAddItems,
  deleteCategory,
  deleteItem,
  generateDescription,
  saveAiConfig,
  type ActionState,
} from "@/app/rooms/[id]/admin/actions";

function Msg({ state }: { state: ActionState }) {
  return (
    <>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-500">{state.ok}</p>}
    </>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";
const btnCls =
  "rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const smallBtnCls =
  "rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function ActionButton({
  action,
  fields,
  label,
  confirm,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={smallBtnCls} title={label}>
        {pending ? "..." : label}
      </button>
      {state?.error && <span className="ml-2 text-xs text-red-500">{state.error}</span>}
    </form>
  );
}

export function AddCategoryForm({ roomId }: { roomId: string }) {
  const [state, action, pending] = useActionState(addCategory, null);
  return (
    <form action={action} className="flex items-start gap-2">
      <input type="hidden" name="roomId" value={roomId} />
      <input name="name" placeholder="Nueva categoría (ej: GOTY)" required minLength={2} maxLength={40} className={inputCls} />
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "..." : "Agregar"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function AddItemForm({ roomId, categoryId }: { roomId: string; categoryId: string }) {
  const [state, action, pending] = useActionState(addItem, null);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        + Agregar objeto uno a uno
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <input name="title" placeholder="Título" required maxLength={80} className={inputCls} />
        <textarea name="description" placeholder="Descripción (opcional)" maxLength={500} rows={2} className={inputCls} />
        <input name="imageUrl" type="url" placeholder="URL de imagen (opcional)" className={inputCls} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isInvalid" /> Inválido (vale 0 siempre)
        </label>
        <Msg state={state} />
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "..." : "Agregar objeto"}
        </button>
      </form>
    </details>
  );
}

export function BulkForm({ roomId, categoryId }: { roomId: string; categoryId: string }) {
  const [state, action, pending] = useActionState(bulkAddItems, null);
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        + Carga masiva (pegar lista)
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <textarea
          name="titles"
          placeholder={"Un título por línea:\nClair Obscur: Expedition 33\nSilksong\nHades II"}
          rows={5}
          className={`${inputCls} font-mono text-sm`}
        />
        <Msg state={state} />
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "..." : "Cargar y seguir con el carrusel"}
        </button>
      </form>
    </details>
  );
}

export function AiConfigForm({
  roomId,
  provider,
  hasKey,
  model,
}: {
  roomId: string;
  provider: string | null;
  hasKey: boolean;
  model: string | null;
}) {
  const [state, action, pending] = useActionState(saveAiConfig, null);
  return (
    <form action={action} className="flex w-full max-w-xl flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-semibold">🤖 IA para descripciones</h3>
      <div className="flex flex-wrap gap-2">
        <select name="provider" defaultValue={provider ?? ""} className={inputCls}>
          <option value="">Sin IA</option>
          <option value="gemini">Google Gemini</option>
          <option value="openrouter">OpenRouter</option>
        </select>
        <input
          name="key"
          type="password"
          placeholder={hasKey ? "•••••••• (guardada — dejar vacío para mantener)" : "API key"}
          className={inputCls}
        />
        <input name="model" placeholder="Modelo (opcional)" defaultValue={model ?? ""} className={inputCls} />
      </div>
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "..." : "Guardar configuración"}
      </button>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        La clave se guarda en la base de datos y solo se usa desde el servidor. Nunca viaja al navegador.
      </p>
    </form>
  );
}

export function ItemRow({
  roomId,
  categoryId,
  item,
}: {
  roomId: string;
  categoryId: string;
  item: { id: string; title: string; description: string | null; image_url: string | null; is_invalid: boolean };
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <span className="min-w-0 flex-1">
        <span className="font-medium">
          {item.title}
          {item.is_invalid && (
            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">
              inválido = 0
            </span>
          )}
        </span>
        {item.description && (
          <p className="truncate text-sm text-zinc-400 dark:text-zinc-500">{item.description}</p>
        )}
        {!item.description && <p className="text-xs text-zinc-400 dark:text-zinc-500">sin descripción</p>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <ActionButton
          action={generateDescription}
          fields={{ roomId, itemId: item.id, categoryId }}
          label="🤖 Descripción"
        />
        <ActionButton
          action={deleteItem}
          fields={{ roomId, itemId: item.id }}
          label="✕"
          confirm={`¿Eliminar "${item.title}"?`}
        />
      </span>
    </li>
  );
}
