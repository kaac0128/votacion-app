"use client";

import { useActionState } from "react";
import { publishResult, type ActionState } from "@/app/rooms/[id]/results/actions";

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 outline-none transition-colors focus:border-primary";
const btnCls =
  "rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50";

type Item = { id: string; title: string; is_invalid: boolean };

export default function ResultForm({
  roomId,
  categoryId,
  items,
  currentWinnerId,
  isCorrection,
}: {
  roomId: string;
  categoryId: string;
  items: Item[];
  currentWinnerId: string | null;
  isCorrection: boolean;
}) {
  const [state, action, pending] = useActionState(publishResult, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(isCorrection ? "¿Publicar la corrección? Los participantes van a volver a opinar." : "¿Publicar el resultado? La votación de la sala se cierra.")) {
          e.preventDefault();
        }
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <select name="winnerItemId" defaultValue={currentWinnerId ?? ""} required className={inputCls}>
        <option value="" disabled>
          ¿Quién ganó en la realidad?
        </option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.title}
            {i.is_invalid ? " (inválido: todos 0)" : ""}
          </option>
        ))}
      </select>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}
      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "..." : isCorrection ? "Publicar corrección" : "Publicar resultado"}
      </button>
    </form>
  );
}
