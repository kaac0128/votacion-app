import type { Metadata } from "next";
import { Chakra_Petch, Russo_One } from "next/font/google";
import "./globals.css";

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const russo = Russo_One({
  variable: "--font-russo",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "La Corona — votación y apuesta entre amigos",
  description: "Votá los premios con tus amigos, apostá y coroná al ganador con la coronita animada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${chakra.variable} ${russo.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
