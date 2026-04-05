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
import { UploadDropzone } from "@/lib/uploadthing/components";
import type { CalendarEventDTO } from "@/types/calendar";
import { CreateEventDialog } from "./CreateEventDialog";
import { DateTimePickerField } from "./DateTimePickerField";
import { EventColorField } from "./EventColorField";

type ScratchTodoRow = { id: string; text: string; done: boolean; createdAt: string };

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

  /** Jahresansicht: nur bei Klick auf eine Tageszelle — nicht bei Mausrad/Pinch (die nutzen zoomFiner). */
  const openDayFromYearView = useCallback((focus: Date) => {
    setAnchor(snapAnchorForBand(focus, "day"));
    setBand("day");
  }, []);
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CalendarEventDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pan, setPan] = useState(0);
  const panStart = useRef<{ x: number; active: boolean }>({ x: 0, active: false });

  const [scratchTodos, setScratchTodos] = useState<ScratchTodoRow[]>([]);
  const [todoDraft, setTodoDraft] = useState("");
  const [todosLoading, setTodosLoading] = useState(false);

  const loadTodos = useCallback(async () => {
    setTodosLoading(true);
    try {
      const r = await fetch("/api/todos", { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as { todos?: ScratchTodoRow[] };
      setScratchTodos(d.todos ?? []);
    } finally {
      setTodosLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  const addScratchTodo = async () => {
    const t = todoDraft.trim();
    if (!t) return;
    const r = await fetch("/api/todos", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    if (r.ok) {
      setTodoDraft("");
      void loadTodos();
    }
  };

  const toggleScratchTodo = async (id: string, done: boolean) => {
    const r = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !done }),
    });
    if (r.ok) void loadTodos();
  };

  const removeScratchTodo = async (id: string) => {
    const r = await fetch(`/api/todos/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) void loadTodos();
  };

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
            className={`flex h-full min-h-0 flex-col p-2 sm:p-3 ${band === "year" ? "overflow-hidden" : ""}`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={band + format(anchor, "yyyy-MM-dd")}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.012 }}
                transition={{ duration: 0.22 }}
                className={`min-h-0 w-full ${band === "year" ? "flex flex-1 flex-col overflow-hidden" : "h-full"}`}
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
                    onOpenDayFromYearView={openDayFromYearView}
                    onSelect={setSelected}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {band === "year" ? (
          <aside className="relative hidden w-full shrink-0 border-t border-[#2a2622] md:block md:w-[17rem] md:border-t-0 md:border-l md:border-[#2a2622] md:bg-[#0c0b09]/40 md:pl-3 md:pr-2 md:pt-3">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-px md:block"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(240,160,70,0.12) 20%, rgba(240,160,70,0.18) 50%, rgba(240,160,70,0.12) 80%, transparent 100%)",
              }}
              aria-hidden
            />
            <div className="relative rounded-xl border border-[#2a2622]/80 bg-gradient-to-b from-[#181512]/95 via-[#12100e] to-[#0e0c0a] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_-20px_rgba(0,0,0,0.75)]">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#2a2622]/60 pb-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#a0988c]">To-Do</p>
                <span className="rounded-full border border-[#f0a046]/25 bg-[#f0a046]/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#f0c078]">
                  {scratchTodos.filter((x) => !x.done).length} offen
                </span>
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  value={todoDraft}
                  onChange={(e) => setTodoDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addScratchTodo();
                    }
                  }}
                  placeholder="Neue Aufgabe …"
                  disabled={todosLoading}
                  className="min-w-0 flex-1 rounded-full border border-[#2a2622] bg-[#0c0b09]/90 px-3 py-2 text-xs text-[#e8dfd3] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-[#4a4540] outline-none transition focus:border-[#f0a046]/45 focus:ring-1 focus:ring-[#f0a046]/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void addScratchTodo()}
                  disabled={todosLoading || !todoDraft.trim()}
                  className={`${btnPrimarySm} shrink-0 rounded-full !px-3`}
                  title="Hinzufügen"
                >
                  +
                </button>
              </div>
              <ul className="max-h-40 space-y-2 overflow-y-auto pr-0.5 text-xs md:max-h-[min(28rem,calc(100vh-9rem))]">
                {todosLoading && scratchTodos.length === 0 ? (
                  <li className="rounded-xl border border-[#2a2622]/50 bg-[#141210]/40 px-3 py-4 text-center text-[11px] text-[#6b645c]">
                    Lade…
                  </li>
                ) : scratchTodos.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-[#2a2622]/70 bg-[#0c0b09]/50 px-3 py-6 text-center text-[11px] leading-relaxed text-[#6b645c]">
                    Noch nichts auf der Liste — oben eintragen.
                  </li>
                ) : (
                  scratchTodos.map((t) => (
                    <li key={t.id}>
                      <div
                        className={`group relative overflow-hidden rounded-xl border px-2.5 py-2.5 transition ${
                          t.done
                            ? "border-[#2a2622]/50 bg-[#10100e]/80 opacity-80"
                            : "border-[#2a2622]/70 bg-[#161412]/90 shadow-[0_0_0_1px_rgba(240,160,70,0.06)] hover:border-[#f0a046]/30 hover:shadow-[0_4px_20px_-12px_rgba(240,160,70,0.25)]"
                        }`}
                      >
                        <div
                          className={`absolute inset-y-1 left-0 w-0.5 rounded-full transition ${
                            t.done ? "bg-[#4a4540]" : "bg-gradient-to-b from-[#f5b45a] to-[#c9781a]"
                          }`}
                          aria-hidden
                        />
                        <div className="flex items-start gap-2 pl-1.5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={t.done}
                            onClick={() => void toggleScratchTodo(t.id, t.done)}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              t.done
                                ? "border-[#f0a046]/50 bg-[#f0a046]/20 text-[#f0a046]"
                                : "border-[#5c564e] bg-[#0c0b09] hover:border-[#f0a046]/45"
                            }`}
                          >
                            {t.done ? (
                              <span className="text-[10px] font-bold leading-none" aria-hidden>
                                ✓
                              </span>
                            ) : null}
                          </button>
                          <div className="min-w-0 flex-1 text-left">
                            <span
                              className={`block text-[13px] leading-snug ${
                                t.done
                                  ? "text-[#6b645c] line-through decoration-[#5c564e]"
                                  : "font-medium text-[#e8dfd3]"
                              }`}
                            >
                              {t.text}
                            </span>
                            <span className="mt-1 block text-[10px] tracking-wide text-[#5c564e]">
                              {format(parseISO(t.createdAt), "d. MMM · HH:mm", { locale: de })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeScratchTodo(t.id)}
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] text-[#5c564e] opacity-60 transition hover:bg-[#2a1818] hover:text-[#f0a0a0] md:opacity-0 md:group-hover:opacity-100"
                            aria-label="Entfernen"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
        ) : null}
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
            reloadCalendar={() => void load()}
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

/** Mini-Jahresansicht: Tageskacheln + Termin-Balken. `fill`: füllt verfügbare Höhe (Jahresgitter ohne Scroll). */
function YearMiniMonthGrid({
  monthStart,
  days,
  events,
  dayCounts,
  onHoverDate,
  onYearDayClick,
  fill = false,
}: {
  monthStart: Date;
  days: Date[];
  events: CalendarEventDTO[];
  dayCounts: Map<string, number>;
  onHoverDate: (d: Date) => void;
  onYearDayClick: (d: Date) => void;
  fill?: boolean;
}) {
  const rows = chunk(days.slice(0, 35), 7);
  const yk = format(monthStart, "yyyy-MM");
  const dayText = fill
    ? "font-[family-name:var(--font-sans)] font-light leading-none tracking-tight text-[#d8cfc4] antialiased text-[length:clamp(6px,1.15vmin,11px)]"
    : "font-[family-name:var(--font-sans)] text-[9px] font-light leading-none tracking-tight text-[#d8cfc4] antialiased sm:text-[10px]";

  const wrapCls = fill
    ? "mt-0.5 flex min-h-0 flex-1 flex-col gap-[3px] overflow-hidden pt-0.5"
    : "mt-2 flex flex-col gap-1";

  return (
    <div className={wrapCls}>
      {rows.map((weekDays, rowIdx) => {
        const segs = computeWeekBarSegments(events, weekDays, `y-${yk}-r${rowIdx}`);
        const lanes = packBarLanes(segs);
        return (
          <div
            key={rowIdx}
            className={
              fill
                ? "flex min-h-0 min-w-0 flex-1 flex-col gap-[2px] overflow-hidden"
                : "flex flex-col gap-px"
            }
          >
            <div
              className={
                fill
                  ? "grid min-h-0 flex-[1] grid-cols-7 gap-px"
                  : "grid grid-cols-7 gap-px"
              }
            >
              {weekDays.map((d) => {
                const c = dayCounts.get(format(d, "yyyy-MM-dd")) ?? 0;
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    title={`${format(d, "EEEE, d. MMMM yyyy", { locale: de })}: ${c} Termin${c === 1 ? "" : "e"}`}
                    onPointerEnter={() => onHoverDate(d)}
                    onPointerDown={() => onHoverDate(d)}
                    onClick={() => onYearDayClick(startOfDay(d))}
                    className={
                      fill
                        ? "flex h-full min-h-0 min-w-0 items-center justify-center rounded-[2px] bg-[#1f1c19] text-center tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-[#252220] hover:ring-1 hover:ring-[#f0a046]/40"
                        : "flex aspect-square flex-col items-center justify-center rounded-[3px] bg-[#1f1c19] px-0.5 text-center tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-[#252220] hover:ring-1 hover:ring-[#f0a046]/45"
                    }
                  >
                    <span className={dayText}>{format(d, "d")}</span>
                  </button>
                );
              })}
            </div>
            {lanes.length > 0 ? (
              <div
                className={
                  fill
                    ? "flex min-h-0 shrink-0 flex-col justify-end gap-px"
                    : "flex flex-col gap-px"
                }
              >
                {lanes.map((lane, li) => (
                  <div
                    key={li}
                    className="grid grid-cols-7 gap-px"
                    style={
                      fill
                        ? { height: "clamp(3px, 0.5vmin, 7px)", minHeight: 3 }
                        : { minHeight: 7 }
                    }
                  >
                    {lane.map((seg) => (
                      <div
                        key={seg.id}
                        className={
                          fill
                            ? "min-h-0 self-center rounded-full border border-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                            : "h-1.5 min-h-0 self-center rounded-full border border-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                        }
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
  onOpenDayFromYearView,
  onSelect,
}: {
  band: ZoomBand;
  anchor: Date;
  events: CalendarEventDTO[];
  dayCounts: Map<string, number>;
  onHoverDate: (d: Date | null) => void;
  onZoomFinerFrom: (focus: Date) => void;
  onOpenDayFromYearView: (focus: Date) => void;
  onSelect: (e: CalendarEventDTO) => void;
}) {
  if (band === "year") {
    const months = eachMonthOfInterval({
      start: startOfYear(anchor),
      end: endOfYear(anchor),
    });
    return (
      <div
        className="grid h-full min-h-0 min-w-0 w-full gap-2 sm:gap-2.5 md:gap-3 [grid-template-columns:repeat(2,minmax(0,1fr))] [grid-template-rows:repeat(6,minmax(0,1fr))] md:[grid-template-columns:repeat(4,minmax(0,1fr))] md:[grid-template-rows:repeat(3,minmax(0,1fr))]"
      >
        {months.map((m) => {
          const days = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) });
          return (
            <div
              key={m.toISOString()}
              className="flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#2a2622]/90 bg-gradient-to-b from-[#1a1816]/95 to-[#141210]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#f0a046]/35 md:p-1.5"
              onPointerEnter={() => onHoverDate(startOfMonth(m))}
              onPointerDown={() => onHoverDate(startOfMonth(m))}
            >
              <button
                type="button"
                onClick={() => onZoomFinerFrom(startOfMonth(m))}
                className="mb-0.5 shrink-0 text-left"
              >
                <span className="text-[length:clamp(9px,1.45vmin,12px)] font-medium text-[#f0a046]">
                  {format(m, "MMM", { locale: de })}{" "}
                  <span className="text-[#8a8278]">{format(m, "yyyy")}</span>
                </span>
              </button>
              <YearMiniMonthGrid
                monthStart={m}
                days={days}
                events={events}
                dayCounts={dayCounts}
                onHoverDate={(d) => onHoverDate(d)}
                onYearDayClick={onOpenDayFromYearView}
                fill
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

function toDatetimeLocalValue(iso: string): string {
  const d = parseISO(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

type SheetAttachment = {
  id: string;
  url: string;
  name: string;
  mimeType: string | null;
  createdAt: string;
};

function EventSheet({
  event,
  reloadCalendar,
  onClose,
  onSaved,
}: {
  event: CalendarEventDTO;
  reloadCalendar: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const realId = event.isExpandedInstance ? event.masterId! : event.id;
  const [title, setTitle] = useState(event.title);
  const [startStr, setStartStr] = useState(() => toDatetimeLocalValue(event.startAt));
  const [endStr, setEndStr] = useState(() => toDatetimeLocalValue(event.endAt));
  const [color, setColor] = useState(() => resolveEventColor(event));
  const [del, setDel] = useState(false);
  const [attachments, setAttachments] = useState<SheetAttachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  useEffect(() => {
    setTitle(event.title);
    setStartStr(toDatetimeLocalValue(event.startAt));
    setEndStr(toDatetimeLocalValue(event.endAt));
    setColor(resolveEventColor(event));
    setDel(false);
  }, [
    event.id,
    event.title,
    event.startAt,
    event.endAt,
    event.color,
    event.isExpandedInstance,
  ]);

  const fetchAttachments = useCallback(async () => {
    setAttLoading(true);
    try {
      const r = await fetch(`/api/attachments?eventId=${encodeURIComponent(realId)}`, {
        credentials: "include",
      });
      if (!r.ok) return;
      const d = (await r.json()) as { attachments?: SheetAttachment[] };
      setAttachments(d.attachments ?? []);
    } finally {
      setAttLoading(false);
    }
  }, [realId]);

  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments]);

  const save = async () => {
    if (event.isExpandedInstance) {
      alert("Serientermine hier nur über den Master bearbeitbar.");
      return;
    }
    const startAt = new Date(startStr);
    const endAt = new Date(endStr);
    if (Number.isNaN(+startAt) || Number.isNaN(+endAt)) {
      alert("Ungültiges Datum oder Uhrzeit.");
      return;
    }
    if (endAt <= startAt) {
      alert("Ende muss nach dem Start liegen.");
      return;
    }
    let hex = color.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) hex = resolveEventColor(event);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || "Ohne Titel",
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        color: hex,
      }),
    });
    if (res.ok) {
      onSaved();
      return;
    }
    if (res.status === 409) {
      alert(
        "Dieser Termin ist eine Serie (Master). Verschieben und einige Änderungen sind dafür noch nicht freigeschaltet.",
      );
      return;
    }
    let msg = "Speichern fehlgeschlagen.";
    try {
      const err = (await res.json()) as { error?: unknown };
      if (typeof err.error === "string") msg = err.error;
    } catch {
      /* ignore */
    }
    alert(msg);
  };

  const remove = async () => {
    if (event.isExpandedInstance) return;
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) onSaved();
  };

  const disabled = event.isExpandedInstance;
  const inputCls =
    "mt-1 w-full rounded-lg border border-[#2a2622] bg-[#0c0b09] px-3 py-2 text-sm text-[#f4eee6] disabled:opacity-50";

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
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#7a7268]">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disabled}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateTimePickerField
              label="Start"
              value={startStr}
              onChange={setStartStr}
              disabled={disabled}
            />
            <DateTimePickerField
              label="Ende"
              value={endStr}
              onChange={setEndStr}
              disabled={disabled}
            />
          </div>
          <EventColorField value={color} onChange={setColor} disabled={disabled} />
        </div>

        <div className="mt-5 border-t border-[#2a2622]/80 pt-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[#7a7268]">Dateien</p>
          <p className="mb-3 text-[11px] leading-snug text-[#6b645c]">
            Vorhandene Anhänge und neue Uploads (ziehen oder klicken). Der Kalender aktualisiert sich nach dem
            Upload.
          </p>
          {attLoading && attachments.length === 0 ? (
            <p className="text-xs text-[#8a8278]">Lade Anhänge…</p>
          ) : attachments.length > 0 ? (
            <ul className="mb-3 space-y-1.5 rounded-lg border border-[#2a2622]/70 bg-[#0c0b09]/80 p-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md px-1 py-1 text-xs text-[#c4bbb0] transition hover:bg-[#1a1816] hover:text-[#f0a046]"
                  >
                    <span className="truncate font-medium text-[#e8dfd3]">{a.name}</span>
                    {a.mimeType?.startsWith("image/") ? (
                      <span className="shrink-0 text-[10px] text-[#6b645c]">Bild</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-[#6b645c]">Noch keine Dateien.</p>
          )}
          {!disabled ? (
            <UploadDropzone
              endpoint="eventAttachment"
              appearance={{
                container:
                  "group flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#3d3830] bg-[#0c0b09]/90 px-4 py-5 transition hover:border-[#f0a046]/55 hover:bg-[#12100e]",
                label: "text-sm font-medium text-[#c4bbb0] group-hover:text-[#e8dfd3]",
                allowedContent: "text-[11px] text-[#6b645c]",
                button:
                  "rounded-lg border border-[#2a2622] bg-[#1a1816] px-3 py-1.5 text-xs font-medium text-[#f0a046] transition hover:bg-[#252220]",
              }}
              content={{
                label: "Dateien hierher ziehen",
                allowedContent: "Bilder bis 8 MB, PDF & Dateien bis 16 MB",
                button: "Dateien wählen",
              }}
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
                await fetchAttachments();
                reloadCalendar();
              }}
            />
          ) : (
            <p className="text-xs text-[#7a7268]">Anhänge zur Serie am Serien-Termin bearbeiten.</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {!disabled && (
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
