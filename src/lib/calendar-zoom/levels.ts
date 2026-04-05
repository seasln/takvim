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

/** Farbe der Zoom-Badge: grün → orange → rot. */
export function zoomBadgeClassName(band: ZoomBand): string {
  const base = "rounded-full border px-3 py-1 text-xs font-medium";
  switch (band) {
    case "year":
      return `${base} border-emerald-800/55 bg-emerald-950/50 text-emerald-300`;
    case "month":
      return `${base} border-amber-800/55 bg-amber-950/50 text-amber-300`;
    case "day":
      return `${base} border-red-800/55 bg-red-950/50 text-red-300`;
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
