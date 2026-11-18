"use client";

import { useState } from "react";
import { GameController } from "@phosphor-icons/react/dist/ssr";

type Item = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  is_invalid: boolean;
};

export default function VoteForm({
  action,
  roomId,
  categoryId,
  items,
  myVoteId,
  initialError,
}: {
  action: (formData: FormData) => Promise<void>;
  roomId: string;
  categoryId: string;
  items: Item[];
  myVoteId: string | null;
  initialError: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(myVoteId);
  const [error, setError] = useState<string | null>(initialError);

  function random() {
    const valid = items.filter((i) => !i.is_invalid);
    const pool = valid.length > 0 ? valid : items;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) setSelected(pick.id);
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const chosen = items.find((i) => i.id === selected);
        if (!chosen) {
          e.preventDefault();
          setError("Elegí un objeto para votar");
          return;
        }
        if (
          chosen.is_invalid &&
          !window.confirm(
            `"${chosen.title}" es inválido: vale 0 SIEMPRE, aunque sea el ganador real. ¿Votarlo igual?`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <label
              className={`flex cursor-pointer items-center gap-4 rounded-xl border p-3 transition-colors ${
                selected === item.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800"
              }`}
            >
              <input
                type="radio"
                name="itemId"
                value={item.id}
                checked={selected === item.id}
                onChange={() => setSelected(item.id)}
                className="h-4 w-4 shrink-0 accent-emerald-600"
              />
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-xl dark:border-zinc-700">
                  <GameController weight="fill" className="h-6 w-6 text-secondary" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {item.title}
                  {item.is_invalid && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-danger dark:bg-danger/20 dark:text-red-300">
                      inválido: vale 0
                    </span>
                  )}
                </span>
                {item.description && (
                  <p className="text-sm text-subtle">{item.description}</p>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {myVoteId ? "Cambiar voto" : "Guardar voto"}
        </button>
        <button
          type="button"
          onClick={random}
          className="rounded-lg border border-zinc-700 px-5 py-2.5 font-semibold transition-colors hover:bg-card-hover"
        >
          Aleatorio
        </button>
      </div>
    </form>
  );
}
