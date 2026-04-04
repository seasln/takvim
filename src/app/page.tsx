import Link from "next/link";
import { GlassCard } from "@/components/marketing/GlassCard";
import { HeroDragonShell } from "@/components/marketing/HeroDragonShell";
import { btnGhost, btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { glassAccent, glassBody, glassTitleHero } from "@/lib/ui/glass-marketing";

export default function Home() {
  return (
    <HeroDragonShell>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <GlassCard className="max-w-xl text-center !px-8 !py-10 sm:!px-12 sm:!py-12">
          <p className={glassAccent}>Takvim</p>
          <h1 className={`mt-4 ${glassTitleHero}`}>Zoom in deinen Tag</h1>
          <p className={`mt-6 ${glassBody}`}>
            Hör auf, planlos zu sein. Zoom in deinen Kalender und organisier dich!
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className={btnPrimary}>
              Anmelden
            </Link>
            <Link href="/register" className={btnSecondary}>
              Registrieren
            </Link>
            <Link href="/calendar" className={btnGhost}>
              Zum Kalender
            </Link>
          </div>
        </GlassCard>
      </div>
    </HeroDragonShell>
  );
}
