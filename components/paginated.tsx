"use client";

import { useState, Children, useEffect } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

// Pagina los hijos que le pases (10 por página por defecto).
// El contenedor usa la clase que le mandes para adaptarse a cada vista.
export default function Paginated({
  perPage = 10,
  className,
  children,
}: {
  perPage?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const items = Children.toArray(children);
  const pages = Math.ceil(items.length / perPage);

  useEffect(() => {
    setPage(0);
  }, [children]);

  if (pages <= 1) return <div className={className}>{items}</div>;

  const visible = items.slice(page * perPage, (page + 1) * perPage);
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-body transition-colors hover:bg-card-hover disabled:opacity-30";

  return (
    <div className="flex flex-col gap-4">
      <div className={className}>{visible}</div>
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
    </div>
  );
}
