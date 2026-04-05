import { startOfDay, startOfMonth } from "date-fns";

/** Drei Zoom-Stufen: Jahr → Monat → Tag (kein leerer Zwischen-/Feinschritt). */
export type ZoomBand = "year" | "month" | "day";

export const ZOOM_BAND_ORDER: readonly ZoomBand[] = ["year", "month", "day"] as const;

export function stepZoomBand(band: ZoomBand, delta: -1 | 1): ZoomBand | null {
  const i = ZOOM_BAND_ORDER.indexOf(band);
  const n = i + delta;
  if (n < 0 || n >= ZOOM_BAND_ORDER.length) return null;
  return ZOOM_BAND_ORDER[n]!;
}

/** Anzeige: 0 % · 50 % · 100 % (Jahr · Monat · Tag). */
export function bandToZoomPercent(band: ZoomBand): 0 | 50 | 100 {
  switch (band) {
    case "year":
      return 0;
    case "month":
      return 50;
    case "day":
      return 100;
  }
}

/** Zoom-Badge — dunkel, scharfe Kanten, Hover-Hervorhebung. */
export function zoomBadgeClassName(band: ZoomBand): string {
  const base =
    "rounded-none border px-3 py-1 text-xs font-semibold tabular-nums transition hover:border-[#ff385c]/45 hover:bg-[#222228]";
  switch (band) {
    case "year":
      return `${base} border-[#2e2e36] bg-[#16161a] text-[#9b9ba8] hover:text-[#ececf1]`;
    case "month":
      return `${base} border-[#2e2e36] bg-[#16161a] text-[#ececf1] hover:text-[#ff8fa3]`;
    case "day":
      return `${base} border-[#ff385c]/55 bg-[#2a151c] text-[#ff8fa3] hover:border-[#ff385c] hover:bg-[#331a22] hover:shadow-[0_0_12px_rgba(255,56,92,0.2)]`;
  }
}

/** Anker für die Ziel-Stufe aus Fokus-Datum (Hover / letzte Zelle). */
export function snapAnchorForBand(focus: Date, targetBand: ZoomBand): Date {
  switch (targetBand) {
    case "year":
      return new Date(focus.getFullYear(), 5, 15);
    case "month":
      return startOfMonth(focus);
    case "day":
      return startOfDay(focus);
  }
}

/** @deprecated Nur für Legacy; UI nutzt stepZoomBand. */
export function zoomToBand(z: number): ZoomBand {
  const x = Math.min(1, Math.max(0, z));
  if (x < 0.34) return "year";
  if (x < 0.67) return "month";
  return "day";
}

export function bandLabel(b: ZoomBand): string {
  switch (b) {
    case "year":
      return "Jahr";
    case "month":
      return "Monat";
    case "day":
      return "Tag";
  }
}
