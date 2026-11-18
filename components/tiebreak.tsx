"use client";

import { useActionState } from "react";
import { startTiebreak, submitPick, type ActionState } from "@/app/rooms/[id]/tiebreak/actions";
import { HandFist, HandPalm, HandPeace } from "@phosphor-icons/react/dist/ssr";

const btn =
  "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-primary/40 bg-card text-body transition-all hover:border-primary hover:text-secondary  disabled:opacity-50";

function Msg({ state }: { state: ActionState }) {
  return (
    <>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "..." : "Iniciar desempate"}
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
      <button type="submit" name="pick" value="rock" disabled={pending} className={btn} title="Piedra">
        <HandFist weight="fill" className="h-6 w-6" />
        <span className="text-xs">Piedra</span>
      </button>
      <button type="submit" name="pick" value="paper" disabled={pending} className={btn} title="Papel">
        <HandPalm weight="fill" className="h-6 w-6" />
        <span className="text-xs">Papel</span>
      </button>
      <button type="submit" name="pick" value="scissors" disabled={pending} className={btn} title="Tijera">
        <HandPeace weight="fill" className="h-6 w-6" />
        <span className="text-xs">Tijera</span>
      </button>
      <Msg state={state} />
    </form>
  );
}
