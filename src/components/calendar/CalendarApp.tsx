"use client";

import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { btnDangerGhost, btnGhost, btnPrimary, btnPrimarySm } from "@/lib/ui/button-classes";
import {
  bandToZoomPercent,
  snapAnchorForBand,
  stepZoomBand,
  zoomBadgeClassName,
  type ZoomBand,
} from "@/lib/calendar-zoom/levels";
import {
  countByDayKey,
  eventsForCalendarDay,
  eventIntersectsCalendarDay,
  resolveEventColor,
} from "@/lib/calendar/event-days";
import { UploadButton } from "@/lib/uploadthing/components";
import type { CalendarEventDTO } from "@/types/calendar";
import { CreateEventDialog } from "./CreateEventDialog";

export function CalendarApp() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState(() => new Date());
  const [band, setBand] = useState<ZoomBand>("year");
  const [signingOut, setSigningOut] = useState(false);
  const hoverFocusRef = useRef<Date | null>(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const pinchRef = useRef<{ dist: number } | null>(null);

  const zoomFiner = useCallback(() => {
    setBand((b) => {
      const next = stepZoomBand(b, 1);
      if (!next) return b;
      const focus = hoverFocusRef.current ?? anchorRef.current;
      setAnchor(snapAnchorForBand(focus, next));
      return next;
    });
  }, []);

  const zoomCoarser = useCallback(() => {
    setBand((b) => {
      const prev = stepZoomBand(b, -1);
      if (!prev) return b;
      const focus = hoverFocusRef.current ?? anchorRef.current;
      setAnchor(snapAnchorForBand(focus, prev));
      return prev;
    });
  }, []);

  const zoomFinerFrom = useCallback((focus: Date) => {
    setBand((b) => {
      const next = stepZoomBand(b, 1);
      if (!next) return b;
      setAnchor(snapAnchorForBand(focus, next));
      return next;
    });
  }, []);
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CalendarEventDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pan, setPan] = useState(0);
  const panStart = useRef<{ x: number; active: boolean }>({ x: 0, active: false });

  /**
   * Jahr(es) für den API-Zeitraum: Anker-Jahr und aktuelles Jahr — damit „Steht bevor“
   * den laufenden Monat füllen kann, auch wenn der Kalender woanders steht.
   */
  const fetchYearSpan = useMemo(() => {
    const yNow = new Date().getFullYear();
    const yAnchor = anchor.getFullYear();
    return { min: Math.min(yAnchor, yNow), max: Math.max(yAnchor, yNow) };
  }, [anchor]);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const prevFetchedSpan = useRef<{ min: number; max: number } | null>(null);

  const load = useCallback(async () => {
    const spanChanged =
      prevFetchedSpan.current !== null &&
      (prevFetchedSpan.current.min !== fetchYearSpan.min ||
        prevFetchedSpan.current.max !== fetchYearSpan.max);
    const firstLoad = eventsRef.current.length === 0;
    if (spanChanged) {
      setEvents([]);
    }
    if (firstLoad || spanChanged) setLoading(true);

    try {
      const from = startOfYear(new Date(fetchYearSpan.min, 0, 1));
      const to = endOfYear(new Date(fetchYearSpan.max, 0, 1));
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/events?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { events: CalendarEventDTO[] };
      setEvents(data.events);
      prevFetchedSpan.current = { ...fetchYearSpan };
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [fetchYearSpan]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomFiner();
    else zoomCoarser();
  };

  const onTouchStartCapture = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      pinchRef.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    }
  };

  const onTouchMoveCapture = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    const [a, b] = [e.touches[0]!, e.touches[1]!];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const r = pinchRef.current.dist > 0 ? dist / pinchRef.current.dist : 1;
    if (r > 1.14) {
      zoomFiner();
      pinchRef.current = { dist };
    } else if (r < 0.87) {
      zoomCoarser();
      pinchRef.current = { dist };
    }
  };

  const onTouchEndCapture = () => {
    pinchRef.current = null;
  };

  const navigate = (dir: -1 | 1) => {
    switch (band) {
      case "year":
        setAnchor((a) => new Date(a.getFullYear() + dir, a.getMonth(), 15));
        break;
      case "month":
        setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
        break;
      case "day":
        setAnchor((a) => addDays(a, dir));
        break;
    }
  };

  const dayCounts = useMemo(() => countByDayKey(events), [events]);

  /** Termine im laufenden Kalendermonat (heute), nicht abhängig vom Kalender-Anker. */
  const monthAgenda = useMemo(() => {
    const now = new Date();
    const m0 = startOfMonth(now);
    const m1 = endOfMonth(now);
    return events
      .filter((e) => {
        const a = parseISO(e.startAt);
        const b = parseISO(e.endAt);
        return a <= m1 && b >= m0;
      })
      .sort((x, y) => +parseISO(x.startAt) - +parseISO(y.startAt));
  }, [events]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0c0b09] text-[#f4eee6]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2622] px-4 py-3">
        <div>
          <button
            type="button"
            onClick={() => {
              void load();
              router.refresh();
            }}
            className="group rounded-md text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0a046]/40"
            title="Aktualisieren"
          >
            <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[#f0a046] transition group-hover:text-[#f5b45a] sm:text-3xl">
              Takvim
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimarySm}>
            + Termin
          </button>
          <span className={zoomBadgeClassName(band)}>
            Zoom {bandToZoomPercent(band)}%
          </span>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className={btnDangerGhost}
          >
            {signingOut ? "…" : "Abmelden"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-[#2a2622] p-3 md:w-60 md:border-b-0 md:border-r md:pr-2">
          <p className="mb-2 border-b border-[#2a2622]/80 pb-2 text-[11px] font-medium uppercase tracking-wide text-[#a0988c]">
            Steht bevor
          </p>
          <p className="mb-2 text-[10px] leading-snug text-[#6b645c]">
            {format(new Date(), "MMMM yyyy", { locale: de })}
          </p>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5 text-xs md:max-h-[min(28rem,calc(100vh-8rem))]">
            {monthAgenda.length === 0 ? (
              <li className="rounded-lg border border-[#2a2622]/60 bg-[#141210]/50 px-2 py-3 text-center text-[11px] text-[#6b645c]">
                Keine Termine im laufenden Monat
              </li>
            ) : (
              monthAgenda.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className="flex w-full gap-2 rounded-lg border border-[#2a2622]/70 bg-[#161412]/90 px-2 py-2 text-left transition hover:border-[#f0a046]/35 hover:bg-[#1c1916]"
                  >
                    <span
                      className="mt-0.5 w-1 shrink-0 rounded-full"
                      style={{ background: resolveEventColor(e) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[#e8dfd3]">{e.title}</span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-[#8a8278]">
                        {format(parseISO(e.startAt), "EEE, d. MMM · HH:mm", { locale: de })}
                        {e.allDay ? " · ganztägig" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <div
          ref={containerRef}
          className="relative min-h-[420px] flex-1 touch-none overflow-hidden outline-none"
          tabIndex={0}
          onWheel={handleWheel}
          onTouchStartCapture={onTouchStartCapture}
          onTouchMoveCapture={onTouchMoveCapture}
          onTouchEndCapture={onTouchEndCapture}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            panStart.current = { x: e.clientX - pan, active: true };
          }}
          onPointerMove={(e) => {
            if (!panStart.current.active) return;
            setPan(e.clientX - panStart.current.x);
          }}
          onPointerUp={() => {
            panStart.current.active = false;
            const threshold = 80;
            if (pan > threshold) {
              navigate(-1);
              setPan(0);
            } else if (pan < -threshold) {
              navigate(1);
              setPan(0);
            } else setPan(0);
          }}
          onPointerLeave={() => {
            panStart.current.active = false;
            setPan(0);
          }}
        >
          <motion.div
            animate={{ x: pan * 0.15 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="h-full p-4"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={band + format(anchor, "yyyy-MM-dd")}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.012 }}
                transition={{ duration: 0.22 }}
                className="h-full"
              >
                {loading && events.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#8a8278]">
                    Lade…
                  </div>
                ) : (
                  <BandView
                    band={band}
                    anchor={anchor}
                    events={events}
                    dayCounts={dayCounts}
                    onHoverDate={(d) => {
                      hoverFocusRef.current = d;
                    }}
                    onZoomFinerFrom={zoomFinerFrom}
                    onSelect={setSelected}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {createOpen && (
          <CreateEventDialog
            anchor={anchor}
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={() => void load()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <EventSheet
            event={selected}
            onClose={() => setSelected(null)}
            onSaved={() => {
              void load();
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type WeekBarSeg = {
  id: string;
  event: CalendarEventDTO;
  startCol: number;
  span: number;
  color: string;
  title: string;
};

/** Aufeinanderfolgende Spalten desselben Termins in einer Woche → ein Balken-Segment. */
function computeWeekBarSegments(
  events: CalendarEventDTO[],
  weekDays: Date[],
  idPrefix: string,
): WeekBarSeg[] {
  const raw: WeekBarSeg[] = [];
  for (const e of events) {
    const activeCols: number[] = [];
    weekDays.forEach((d, col) => {
      if (eventIntersectsCalendarDay(e, d)) activeCols.push(col);
    });
    if (activeCols.length === 0) continue;
    let i = 0;
    let runIdx = 0;
    while (i < activeCols.length) {
      const runStart = activeCols[i]!;
      let runEnd = runStart;
      let j = i + 1;
      while (j < activeCols.length && activeCols[j] === runEnd + 1) {
        runEnd = activeCols[j]!;
        j++;
      }
      raw.push({
        id: `${idPrefix}-${e.id}-c${runStart}-r${runIdx++}`,
        event: e,
        startCol: runStart,
        span: runEnd - runStart + 1,
        color: resolveEventColor(e),
        title: e.title,
      });
      i = j;
    }
  }
  return raw;
}

function packBarLanes(segments: WeekBarSeg[]): WeekBarSeg[][] {
  const sorted = [...segments].sort((a, b) => a.startCol - b.startCol || b.span - a.span);
  const lanes: WeekBarSeg[][] = [];
  const laneMaxEnd: number[] = [];
  for (const s of sorted) {
    const endCol = s.startCol + s.span - 1;
    let L = 0;
    while (L < laneMaxEnd.length && laneMaxEnd[L]! >= s.startCol) L++;
    if (L === laneMaxEnd.length) {
      laneMaxEnd.push(endCol);
      lanes.push([s]);
    } else {
      laneMaxEnd[L] = Math.max(laneMaxEnd[L]!, endCol);
      lanes[L]!.push(s);
    }
  }
  return lanes;
}

function SpanningEventBar({
  seg,
  onSelect,
  compact = false,
}: {
  seg: WeekBarSeg;
  onSelect: (e: CalendarEventDTO) => void;
  /** Kompakte Zeilenhöhe für Monatsgitter (ohne Scroll). */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      style={{
        gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
        background: seg.color,
      }}
      title={seg.title}
      onClick={(ev) => {
        ev.stopPropagation();
        onSelect(seg.event);
      }}
      className={
        compact
          ? "flex h-5 max-h-5 min-h-0 items-center overflow-hidden rounded-full border border-white/15 px-1.5 text-left text-[8px] font-medium leading-none text-white shadow-sm sm:h-[22px] sm:max-h-[22px] sm:text-[9px]"
          : "flex h-7 max-h-7 min-h-0 items-center overflow-hidden rounded-full border border-white/20 px-2.5 text-left text-[10px] font-semibold leading-tight text-white shadow-md sm:h-8 sm:max-h-8 sm:text-[11px]"
      }
    >
      <span className="truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{seg.title}</span>
    </button>
  );
}

/** Mini-Jahresansicht: Tageskacheln, darunter durchgehende Kapsel-Balken über mehrere Tage. */
function YearMiniMonthGrid({
  monthStart,
  days,
  events,
  dayCounts,
  onHoverDate,
  onZoomFinerFrom,
}: {
  monthStart: Date;
  days: Date[];
  events: CalendarEventDTO[];
  dayCounts: Map<string, number>;
  onHoverDate: (d: Date) => void;
  onZoomFinerFrom: (d: Date) => void;
}) {
  const rows = chunk(days.slice(0, 35), 7);
  const yk = format(monthStart, "yyyy-MM");
  return (
    <div className="mt-2 flex flex-col gap-1">
      {rows.map((weekDays, rowIdx) => {
        const segs = computeWeekBarSegments(events, weekDays, `y-${yk}-r${rowIdx}`);
        const lanes = packBarLanes(segs);
        return (
          <div key={rowIdx} className="flex flex-col gap-px">
            <div className="grid grid-cols-7 gap-px">
              {weekDays.map((d) => {
                const c = dayCounts.get(format(d, "yyyy-MM-dd")) ?? 0;
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    title={`${format(d, "EEEE, d. MMMM yyyy", { locale: de })}: ${c} Termin${c === 1 ? "" : "e"}`}
                    onPointerEnter={() => onHoverDate(d)}
                    onPointerDown={() => onHoverDate(d)}
                    onClick={() => onZoomFinerFrom(d)}
                    className="flex aspect-square flex-col items-center justify-center rounded-[3px] bg-[#1f1c19] px-0.5 text-center tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-[#252220] hover:ring-1 hover:ring-[#f0a046]/45"
                  >
                    <span className="font-[family-name:var(--font-sans)] text-[9px] font-light leading-none tracking-tight text-[#d8cfc4] antialiased sm:text-[10px]">
                      {format(d, "d")}
                    </span>
                  </button>
                );
              })}
            </div>
            {lanes.length > 0 ? (
              <div className="flex flex-col gap-px">
                {lanes.map((lane, li) => (
                  <div key={li} className="grid grid-cols-7 gap-px" style={{ minHeight: 7 }}>
                    {lane.map((seg) => (
                      <div
                        key={seg.id}
                        className="h-1.5 min-h-0 self-center rounded-full border border-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                        style={{
                          gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                          background: seg.color,
                        }}
                        title={seg.title}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BandView({
  band,
  anchor,
  events,
  dayCounts,
  onHoverDate,
  onZoomFinerFrom,
  onSelect,
}: {
  band: ZoomBand;
  anchor: Date;
  events: CalendarEventDTO[];
  dayCounts: Map<string, number>;
  onHoverDate: (d: Date | null) => void;
  onZoomFinerFrom: (focus: Date) => void;
  onSelect: (e: CalendarEventDTO) => void;
}) {
  if (band === "year") {
    const months = eachMonthOfInterval({
      start: startOfYear(anchor),
      end: endOfYear(anchor),
    });
    return (
      <div className="grid h-full grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {months.map((m) => {
          const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) });
          return (
            <div
              key={m.toISOString()}
              className="flex flex-col rounded-lg border border-[#2a2622] bg-[#141210]/80 p-2 transition hover:border-[#f0a046]/40"
              onPointerEnter={() => onHoverDate(startOfMonth(m))}
              onPointerDown={() => onHoverDate(startOfMonth(m))}
            >
              <button
                type="button"
                onClick={() => onZoomFinerFrom(startOfMonth(m))}
                className="flex flex-col text-left"
              >
                <span className="text-xs font-medium text-[#f0a046]">
                  {format(m, "MMM", { locale: de })}
                </span>
                <span className="text-[10px] font-medium text-[#8a8278]">{format(m, "yyyy")}</span>
              </button>
              <YearMiniMonthGrid
                monthStart={m}
                days={days}
                events={events}
                dayCounts={dayCounts}
                onHoverDate={(d) => onHoverDate(d)}
                onZoomFinerFrom={onZoomFinerFrom}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (band === "month") {
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    const gridStart = startOfWeek(start, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const weeks = chunk(days, 7);
    const mk = format(anchor, "yyyy-MM");
    return (
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden pr-0.5"
        onPointerLeave={() => onHoverDate(null)}
      >
        <h2 className="mb-1 shrink-0 font-[family-name:var(--font-display)] text-base text-[#f4eee6] sm:text-lg">
          <span className="text-[#f4eee6]">{format(anchor, "MMMM", { locale: de })}</span>
          <span className="ml-1.5 text-sm font-normal text-[#c4bbb0] sm:text-base">
            {format(anchor, "yyyy")}
          </span>
        </h2>
        <div className="mb-1 grid shrink-0 grid-cols-7 gap-0.5 pb-0.5 text-center text-[8px] font-medium uppercase leading-none text-[#7a7268] sm:text-[9px]">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div
          className="grid min-h-0 flex-1 gap-1"
          style={{
            gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.map((weekDays, wi) => {
            const segs = computeWeekBarSegments(events, weekDays, `m-${mk}-w${wi}`);
            const lanes = packBarLanes(segs);
            return (
              <div
                key={wi}
                className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#2a2622]/70 bg-[#141210]/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="grid shrink-0 grid-cols-7 gap-0.5">
                  {weekDays.map((d) => {
                    const inM = isSameMonth(d, anchor);
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onPointerEnter={() => onHoverDate(startOfDay(d))}
                        onPointerDown={() => onHoverDate(startOfDay(d))}
                        onClick={() => onZoomFinerFrom(d)}
                        className={`flex h-7 max-h-7 min-h-0 flex-col items-center justify-center rounded-md border px-0 py-0.5 text-center tabular-nums transition hover:border-[#f0a046]/45 sm:h-8 sm:max-h-8 ${
                          inM
                            ? "border-[#2a2622] bg-[#1a1816]/90"
                            : "border-transparent bg-transparent opacity-45"
                        }`}
                      >
                        <span
                          className={`font-[family-name:var(--font-sans)] text-[11px] font-light leading-none tracking-tight sm:text-xs ${inM ? "text-[#f2ebe3]" : "text-[#90887e]"}`}
                        >
                          {format(d, "d")}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {lanes.length > 0 ? (
                  <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden border-t border-[#2a2622]/40 pt-1">
                    {lanes.map((lane, li) => (
                      <div
                        key={li}
                        className="grid min-h-0 shrink-0 grid-cols-7 gap-0.5"
                        style={{ minHeight: 20 }}
                      >
                        {lane.map((seg) => (
                          <SpanningEventBar key={seg.id} seg={seg} onSelect={onSelect} compact />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* Tag (100 %) */
  const dayEvents = eventsForCalendarDay(events, anchor);

  return (
    <div className="flex h-full flex-col" onPointerEnter={() => onHoverDate(startOfDay(anchor))}>
      <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg text-[#f4eee6]">
        {format(anchor, "EEEE, d. MMMM yyyy", { locale: de })}
      </h2>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {dayEvents.length === 0 ? (
          <p className="text-sm text-[#7a7268]">Keine Termine an diesem Tag.</p>
        ) : (
          dayEvents.map((e) => (
            <DayEventRow key={e.id} event={e} detailed onOpen={() => onSelect(e)} />
          ))
        )}
      </div>
    </div>
  );
}

function DayEventRow({
  event,
  detailed,
  onOpen,
}: {
  event: CalendarEventDTO;
  detailed: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-lg border border-[#2a2622] bg-[#141210] p-3 text-left transition hover:border-[#f0a046]/35"
    >
      <div
        className="mt-0.5 h-10 w-1 shrink-0 rounded-full"
        style={{ background: resolveEventColor(event) }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#f4eee6]">{event.title}</p>
        <p className="text-xs text-[#9a928a]">
          {format(parseISO(event.startAt), "HH:mm")} – {format(parseISO(event.endAt), "HH:mm")}
          {event.isExpandedInstance && " · Serie"}
        </p>
        {detailed && event.description && (
          <p className="mt-1 line-clamp-3 text-xs text-[#b5ada4]">{event.description}</p>
        )}
      </div>
    </button>
  );
}

function EventSheet({
  event,
  onClose,
  onSaved,
}: {
  event: CalendarEventDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const realId = event.isExpandedInstance ? event.masterId! : event.id;
  const [title, setTitle] = useState(event.title);
  const [del, setDel] = useState(false);

  const save = async () => {
    if (event.isExpandedInstance) {
      alert("Serientermine hier nur über den Master bearbeitbar.");
      return;
    }
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) onSaved();
  };

  const remove = async () => {
    if (event.isExpandedInstance) return;
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) onSaved();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-[#2a2622] bg-[#141210] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-lg text-[#f0a046]">Termin</h3>
          <button type="button" onClick={onClose} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
            Schließen
          </button>
        </div>
        <label className="block text-xs text-[#7a7268]">Titel</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={event.isExpandedInstance}
          className="mt-1 w-full rounded-lg border border-[#2a2622] bg-[#0c0b09] px-3 py-2 text-sm text-[#f4eee6] disabled:opacity-50"
        />
        <p className="mt-3 text-xs text-[#8a8278]">
          {format(parseISO(event.startAt), "Pp", { locale: de })} →{" "}
          {format(parseISO(event.endAt), "Pp", { locale: de })}
        </p>
        {!event.isExpandedInstance && (
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-[#7a7268]">Anhänge</p>
            <UploadButton
              endpoint="eventAttachment"
              onClientUploadComplete={async (res) => {
                for (const f of res) {
                  await fetch("/api/attachments", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      eventId: realId,
                      fileKey: f.key,
                      url: f.url,
                      name: f.name,
                    }),
                  });
                }
                onSaved();
              }}
            />
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {!event.isExpandedInstance && (
            <>
              <button type="button" onClick={() => void save()} className={btnPrimary}>
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setDel(true)}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#7a3333] px-4 py-2 text-sm text-[#f0a0a0] transition hover:bg-[#2a1818] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0a0a0]/50"
              >
                Löschen
              </button>
            </>
          )}
        </div>
        {del && (
          <div className="mt-4 rounded-lg border border-[#5c2a2a] bg-[#1f1414] p-3 text-sm">
            <p className="text-[#f0a0a0]">Wirklich löschen?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void remove()}
                className="cursor-pointer rounded-md bg-[#7a2222] px-3 py-1 text-xs text-white transition hover:bg-[#922a2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => setDel(false)}
                className="cursor-pointer rounded-md border border-[#2a2622] px-3 py-1 text-xs transition hover:bg-[#1f1c19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                Nein
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
