import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const display = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Takvim · Kalender",
  description: "Zoom in deinen Kalender — Termine, Serien, Tags und Anhänge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="relative min-h-full bg-[#0c0b09] font-[family-name:var(--font-sans)] text-[#f4eee6]">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
        >
          <div
            className="absolute inset-0 scale-[1.08] bg-cover bg-center bg-no-repeat opacity-[0.055]"
            style={{ backgroundImage: "url(/images/americandragon.jpg)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0b09]/92 via-[#0c0b09]/88 to-[#0c0b09]/95" />
        </div>
        <div className="relative z-[1] flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
