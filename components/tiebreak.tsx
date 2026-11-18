"use client";

import { useActionState } from "react";
import { startTiebreak, submitPick, type ActionState } from "@/app/rooms/[id]/tiebreak/actions";

const btn = "rounded-xl border-2 border-zinc-300 px-6 py-3 text-2xl hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

function Msg({ state }: { state: ActionState }) {
  return (
    <>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-500">{state.ok}</p>}
    </>
  );
}

export function TiebreakStart({ roomId, participants }: { roomId: string; participants: string[] }) {
  const [state, action, pending] = useActionState(startTiebreak, null);
  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <input type="hidden" name="roomId" value={roomId} />
      {participants.map((p) => (
        <input key={p} type="hidden" name="participants" value={p} />
      ))}
      <button type="submit" disabled={pending} className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "..." : "🪨 Iniciar desempate"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function TiebreakPick({ roomId, roundId }: { roomId: string; roundId: string }) {
  const [state, action, pending] = useActionState(submitPick, null);
  return (
    <form action={action} className="flex flex-wrap items-center justify-center gap-3">
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="roundId" value={roundId} />
      <button type="submit" name="pick" value="rock" disabled={pending} className={btn} title="Piedra">🪨</button>
      <button type="submit" name="pick" value="paper" disabled={pending} className={btn} title="Papel">📄</button>
      <button type="submit" name="pick" value="scissors" disabled={pending} className={btn} title="Tijera">✂️</button>
      <Msg state={state} />
    </form>
  );
}
