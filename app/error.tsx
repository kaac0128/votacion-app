"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🎮💥</p>
      <h2 className="text-xl font-bold">Se trabó la partida</h2>
      <p className="max-w-md text-sm text-zinc-400">
        Algo falló inesperadamente. Probá de nuevo; si sigue roto, avisale al admin de la sala.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-zinc-100 px-5 py-2 font-medium text-zinc-900 hover:bg-white"
      >
        Reintentar
      </button>
      <p className="text-xs text-zinc-600">{error.message}</p>
    </div>
  );
}
