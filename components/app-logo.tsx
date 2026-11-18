import { GameController } from "@phosphor-icons/react/dist/ssr";

export default function AppLogo({ size = "big" }: { size?: "big" | "small" }) {
  const big = size === "big";
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-[0_0_48px_rgba(124,58,237,0.6)] ${
          big ? "h-20 w-20" : "h-12 w-12"
        }`}
      >
        <GameController weight="fill" className={big ? "h-10 w-10 text-white" : "h-7 w-7 text-white"} />
      </span>
      <h1 className={`font-display tracking-wide ${big ? "text-3xl" : "text-xl"}`}>
        La Corona
      </h1>
      {big && (
        <p className="text-sm text-subtle">Votá, apostá y coroná al ganador</p>
      )}
    </div>
  );
}
