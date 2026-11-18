import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">🕹️</p>
      <h2 className="text-xl font-bold">Game Over — página no encontrada</h2>
      <p className="text-sm text-zinc-400">Esta pantalla no existe (o la sala ya no está).</p>
      <Link href="/" className="rounded-lg bg-zinc-100 px-5 py-2 font-medium text-zinc-900 hover:bg-white">
        Volver al inicio
      </Link>
    </div>
  );
}
