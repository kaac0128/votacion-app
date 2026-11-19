"use client";

import { useState, useEffect } from "react";
import { CaretLeft, CaretRight, GearSix, Play } from "@phosphor-icons/react/dist/ssr";

// Grilla paginada de categorías (10 por página) + panel de la categoría seleccionada.
// Los paneles llegan server-renderizados con sus formularios.
export default function AdminCategoryBrowser({
  categories,
  panels,
}: {
  categories: { id: string; name: string; count: number }[];
  panels: React.ReactNode[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [categories.length]);

  const perPage = 10;
  const pages = Math.ceil(categories.length / perPage);
  const visible = categories.slice(page * perPage, (page * perPage) + perPage);
  const selectedIndex = selected ? categories.findIndex((c) => c.id === selected) : -1;

  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-body transition-colors hover:bg-card-hover disabled:opacity-30";

  return (
    <div className="flex flex-col gap-8">
      {categories.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {visible.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelected(selected === cat.id ? null : cat.id)}
                className={`flex h-24 flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-colors ${
                  selected === cat.id
                    ? "border-primary bg-primary/20"
                    : "border-zinc-800 bg-card hover:border-zinc-700"
                }`}
              >
                <span className="line-clamp-2 text-sm font-medium leading-tight text-body">{cat.name}</span>
                <span className="text-xs text-subtle">{cat.count} nominados</span>
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0} className={btn} aria-label="Página anterior">
                <CaretLeft weight="bold" className="h-4 w-4" />
              </button>
              <span className="text-sm text-subtle">
                {page + 1} / {pages}
              </span>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page === pages - 1} className={btn} aria-label="Página siguiente">
                <CaretRight weight="bold" className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-subtle">Todavía no hay categorías. Crealas arriba (una a una o pegando una lista).</p>
      )}

      {selectedIndex >= 0 && panels[selectedIndex] ? (
        panels[selectedIndex]
      ) : categories.length > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-subtle">
          <GearSix className="h-4 w-4" /> Elegí una categoría de la grilla para administrarla
        </div>
      ) : null}
    </div>
  );
}
