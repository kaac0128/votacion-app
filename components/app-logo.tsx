export default function AppLogo({ size = "big" }: { size?: "big" | "small" }) {
  const big = size === "big";
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-600 to-violet-600 shadow-[0_0_40px_rgba(168,85,247,0.5)] ${
          big ? "h-20 w-20 text-5xl" : "h-12 w-12 text-2xl"
        }`}
      >
        🎮
      </span>
      <h1 className={`font-bold tracking-tight ${big ? "text-3xl" : "text-xl"}`}>
        La Corona
      </h1>
      {big && (
        <p className="text-sm text-zinc-400 dark:text-zinc-400">
          Votá, apostá y coroná al ganador 🏆
        </p>
      )}
    </div>
  );
}
