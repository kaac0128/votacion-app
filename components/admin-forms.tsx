"use client";

import { useActionState, useState } from "react";
import {
  addCategory,
  addItem,
  bulkAddCategories,
  bulkAddItems,
  deleteCategory,
  deleteItem,
  generateDescription,
  saveAiConfig,
  type ActionState,
} from "@/app/rooms/[id]/admin/actions";
import { GearSix, ListPlus, Plus, Sparkle, Warning } from "@phosphor-icons/react/dist/ssr";

function Msg({ state }: { state: ActionState }) {
  return (
    <>
      {state?.error && (
        <p className="flex items-center gap-1.5 text-sm text-danger"><Warning weight="fill" className="h-4 w-4" />{state.error}</p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-400"><Sparkle weight="fill" className="h-4 w-4" />{state.ok}</p>
      )}
    </>
  );
}

const inputCls =
  "w-full rounded-lg border border-primary/40 bg-zinc-900/80 px-3 py-2 text-body outline-none transition-colors focus:border-primary";
const btnCls =
  "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50";
const smallBtnCls =
  "inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs text-body transition-colors hover:bg-card-hover disabled:opacity-50";

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
      {state?.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function AddCategoryForm({ roomId }: { roomId: string }) {
  const [state, action, pending] = useActionState(addCategory, null);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-start gap-2">
        <input type="hidden" name="roomId" value={roomId} />
        <input name="name" placeholder="Nueva categoría (ej: GOTY)" required minLength={2} maxLength={80} className={`${inputCls} max-w-xs`} />
        <button type="submit" disabled={pending} className={btnCls}>
          <Plus weight="bold" className="h-4 w-4" /> Agregar
        </button>
      </form>
      <BulkCategoriesForm roomId={roomId} />
      <Msg state={state} />
    </div>
  );
}

export function BulkCategoriesForm({ roomId }: { roomId: string }) {
  const [state, action, pending] = useActionState(bulkAddCategories, null);
  return (
    <details className="max-w-xl">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-subtle transition-colors hover:text-body">
        <ListPlus className="h-4 w-4" /> Cargar varias categorías de una (una por línea)
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-2.5">
        <input type="hidden" name="roomId" value={roomId} />
        <textarea
          name="names"
          placeholder={"Una categoría por línea:\nGOTY\nDirección de arte\nBanda sonora\nMejor indie"}
          rows={4}
          className={`${inputCls} font-body text-sm`}
        />
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "..." : "Crear todas"}
        </button>
      </form>
    </details>
  );
}

export function AddItemForm({ roomId, categoryId }: { roomId: string; categoryId: string }) {
  const [state, action, pending] = useActionState(addItem, null);
  return (
    <details className="mt-2">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-subtle transition-colors hover:text-body">
        <Plus className="h-4 w-4" /> Agregar objeto uno a uno
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-2.5">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <input name="title" placeholder="Título" required maxLength={80} className={inputCls} />
        <textarea name="description" placeholder="Descripción (opcional)" maxLength={500} rows={2} className={inputCls} />
        <input name="imageUrl" type="url" placeholder="URL de imagen (opcional)" className={inputCls} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="isInvalid" className="accent-danger" /> Inválido (vale 0 siempre)
        </label>
        <Msg state={state} />
        <button type="submit" disabled={pending} className={btnCls}>
          <Plus weight="bold" className="h-4 w-4" /> Agregar objeto
        </button>
      </form>
    </details>
  );
}

export function BulkForm({ roomId, categoryId }: { roomId: string; categoryId: string }) {
  const [state, action, pending] = useActionState(bulkAddItems, null);
  return (
    <details className="mt-2">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-subtle transition-colors hover:text-body">
        <ListPlus className="h-4 w-4" /> Carga masiva (pegar lista)
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-2.5">
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <textarea
          name="titles"
          placeholder={"Un título por línea:\nClair Obscur: Expedition 33\nSilksong\nHades II"}
          rows={5}
          className={`${inputCls} text-sm`}
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
  const [selected, setSelected] = useState(provider ?? "");
  const options = [
    { value: "", title: "Sin IA", desc: "Descripciones a mano" },
    { value: "gemini", title: "Gemini", desc: "Google AI, gratis" },
    { value: "openrouter", title: "OpenRouter", desc: "Multi-modelo" },
  ];
  return (
    <form action={action} className="flex w-full flex-col gap-4 rounded-xl border border-line/50 bg-card p-5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        <Sparkle weight="fill" className="h-4 w-4" /> IA para descripciones
      </h3>
      <input type="hidden" name="provider" value={selected} />
      <input type="hidden" name="roomId" value={roomId} />
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelected(opt.value)}
            className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
              selected === opt.value
                ? "border-primary bg-primary/20"
                : "border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <span className={`text-sm font-semibold ${selected === opt.value ? "text-secondary" : "text-body"}`}>
              {opt.title}
            </span>
            <span className="text-xs text-subtle">{opt.desc}</span>
          </button>
        ))}
      </div>
      {selected !== "" && (
        <div className="flex flex-col gap-2">
          <input
            name="key"
            type="password"
            placeholder={hasKey ? "•••••••• (guardada — dejar vacío para mantener)" : "API key"}
            className={inputCls}
          />
        </div>
      )}
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnCls}>
        <GearSix weight="fill" className="h-4 w-4" /> Guardar configuración
      </button>
      <p className="text-xs text-subtle">
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
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/50 bg-card/60 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {item.title}
          {item.is_invalid && (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-danger">
              <Warning weight="fill" className="h-3 w-3" /> inválido: vale 0
            </span>
          )}
        </span>
        {item.description ? (
          <p className="truncate text-sm text-subtle">{item.description}</p>
        ) : (
          <p className="text-xs text-zinc-600">sin descripción</p>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <ActionButton
          action={generateDescription}
          fields={{ roomId, itemId: item.id, categoryId }}
          label="Completar con IA"
        />
        <ActionButton
          action={deleteItem}
          fields={{ roomId, itemId: item.id, categoryId }}
          label="Eliminar"
          confirm={`¿Quitar "${item.title}" de esta categoría?`}
        />
      </span>
    </li>
  );
}
