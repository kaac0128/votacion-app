"use client";

import { useActionState } from "react";
import { createRoom, joinRoom, type ActionState } from "@/app/rooms/actions";

function ErrorMsg({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return <p className="text-sm text-red-500">{state.error}</p>;
}

export function JoinRoomForm() {
  const [state, action, pending] = useActionState(joinRoom, null);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">Entrar con código</h2>
      <input
        name="code"
        placeholder="ABC123"
        required
        maxLength={6}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-xl font-mono uppercase tracking-widest outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
      />
      <ErrorMsg state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
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
      className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="font-semibold">Crear sala</h2>
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
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </div>
      <div>
        <label htmlFor="room-theme" className="mb-1 block text-sm">Tema (contexto)</label>
        <input
          id="tz-theme"
          name="theme"
          placeholder="Game Awards 2026"
          maxLength={200}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </div>
      <div>
        <label htmlFor="room-deadline" className="mb-1 block text-sm">Fecha límite de votación (opcional)</label>
        <input
          id="room-deadline"
          name="deadline"
          type="datetime-local"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
      </div>
      <ErrorMsg state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "..." : "Crear sala"}
      </button>
    </form>
  );
}
