/**
 * Dunkles, transparentes Glas: starker Blur, wenig Deckkraft, heller Rand.
 */
export function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/[0.12]",
        "bg-gradient-to-b from-[#0c0b09]/42 via-[#0c0a08]/32 to-[#0c0b09]/[0.07]",
        "shadow-[0_12px_48px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]",
        "backdrop-blur-[36px] backdrop-saturate-150",
        "px-7 py-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent to-35%"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.05]"
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
