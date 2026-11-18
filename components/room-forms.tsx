"use client";

import { useActionState } from "react";
import { createRoom, joinRoom, type ActionState } from "@/app/rooms/actions";
import { Crown, Ticket } from "@phosphor-icons/react/dist/ssr";

function ErrorMsg({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return <p className="text-sm text-danger">{state.error}</p>;
}

const inputCls =
  "w-full rounded-lg border border-primary/40 bg-zinc-900/80 px-3 py-2 outline-none transition-colors focus:border-primary";

export function JoinRoomForm() {
  const [state, action, pending] = useActionState(joinRoom, null);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-line/50 bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide text-secondary">
        <Ticket weight="fill" className="h-4 w-4" /> Entrar con código
      </h2>
      <input
        name="code"
        placeholder="ABC123"
        required
        maxLength={6}
        className="w-full rounded-lg border border-primary/40 bg-zinc-900/80 px-3 py-2 text-center text-xl font-mono uppercase tracking-widest outline-none transition-colors focus:border-primary"
      />
      <ErrorMsg state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "..." : "Entrar a la sala"}
      </button>
    </form>
  );
}

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoom, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const form = e.currentTarget;
        const input = form.elements.namedItem("deadline") as HTMLInputElement | null;
        const hidden = form.elements.namedItem("deadline_iso") as HTMLInputElement | null;
        if (input && hidden && input.value) {
          hidden.value = new Date(input.value).toISOString();
        } else if (hidden) {
          hidden.value = "";
        }
      }}
      className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-line/50 bg-card p-4"
    >
      <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide text-secondary">
        <Crown weight="fill" className="h-4 w-4" /> Crear sala
      </h2>
      <input type="hidden" name="deadline_iso" />
      <div>
        <label htmlFor="room-title" className="mb-1 block text-sm">Título</label>
        <input
          id="room-title"
          name="title"
          placeholder="GOTY 2026"
          required
          minLength={3}
          maxLength={60}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="room-theme" className="mb-1 block text-sm">Tema (contexto)</label>
        <input
          id="room-theme"
          name="theme"
          placeholder="Game Awards 2026"
          maxLength={200}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="room-deadline" className="mb-1 block text-sm">Fecha límite de votación (opcional)</label>
        <input
          id="room-deadline"
          name="deadline"
          type="datetime-local"
          className={`${inputCls} text-body`}
        />
      </div>
      <ErrorMsg state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "..." : "Crear sala"}
      </button>
    </form>
  );
}
