"use client";

import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
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
import {
  calBtnDangerGhost,
  calBtnGhost,
  calBtnPrimary,
  calBtnPrimarySm,
} from "@/lib/ui/calendar-button-classes";
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

const ZOOM_TRANSITION = { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const };

/** Dunkelmodus: Karten + einheitlicher Hover */
const UI_CARD =
  "border border-[#2e2e36] bg-[#16161a] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_24px_rgba(0,0,0,0.45)]";
const UI_HOVER =
  "transition-[background-color,border-color,box-shadow,color] duration-150 hover:bg-[#222228] hover:border-[#ff385c]/40 hover:shadow-[0_0_0_1px_rgba(255,56,92,0.2),0_4px_20px_rgba(255,56,92,0.08)]";
const DAY_CELL =
  "rounded-none border border-[#2e2e36] bg-[#141418] text-center tabular-nums transition-[background-color,border-color,color] duration-150 hover:border-[#ff385c]/45 hover:bg-[#252530] hover:text-[#f4f4f8]";

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
  const [todoSaveError, setTodoSaveError] = useState<string | null>(null);

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
    setTodoSaveError(null);
    try {
      const r = await fetch("/api/todos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (r.ok) {
        setTodoDraft("");
        void loadTodos();
        return;
      }
      let msg = `Speichern fehlgeschlagen (${r.status})`;
      try {
        const errBody = (await r.json()) as {
          error?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
        };
        const flat = errBody.error;
        const fe = flat?.formErrors?.filter(Boolean);
        if (fe?.length) msg = fe.join(" ");
        else {
          const first = flat?.fieldErrors && Object.values(flat.fieldErrors).flat().find(Boolean);
          if (first) msg = String(first);
        }
      } catch {
        /* ignore */
      }
      setTodoSaveError(msg);
    } catch {
      setTodoSaveError("Netzwerkfehler — bitte erneut versuchen.");
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#0c0c0f] text-[#ececf1]">
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-[#2e2e36] bg-[#121215] px-4 py-3">
        <div className="min-w-0 justify-self-start">
          <button
            type="button"
            onClick={() => {
              void load();
              router.refresh();
            }}
            className="group rounded-none px-1 py-0.5 text-left transition hover:bg-[#222228] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c]/50"
            title="Aktualisieren"
          >
            <span className="text-2xl font-bold tracking-[-0.03em] text-[#ff5a7a] transition group-hover:text-[#ff8fa3] sm:text-3xl">
              Takvim
            </span>
          </button>
        </div>
        <p
          className="pointer-events-none shrink-0 justify-self-center text-lg font-semibold tabular-nums tracking-[-0.02em] text-[#9b9ba8] sm:text-xl"
          aria-live="polite"
        >
          {format(anchor, "yyyy")}
        </p>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 justify-self-end">
          <button type="button" onClick={() => setCreateOpen(true)} className={calBtnPrimarySm}>
            + Termin
          </button>
          <span className={zoomBadgeClassName(band)}>
            Zoom {bandToZoomPercent(band)}%
          </span>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className={calBtnDangerGhost}
          >
            {signingOut ? "…" : "Abmelden"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-[#2e2e36] bg-[#121215] p-3 md:w-60 md:border-b-0 md:border-r md:pr-2">
          <p className="mb-2 border-b border-[#2e2e36] pb-2 text-[11px] font-semibold uppercase tracking-[0.32px] text-[#ececf1]">
            Steht bevor
          </p>
          <p className="mb-2 text-[13px] font-medium leading-snug text-[#9b9ba8]">
            {format(new Date(), "MMMM", { locale: de })}
          </p>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5 text-xs md:max-h-[min(28rem,calc(100vh-8rem))]">
            {monthAgenda.length === 0 ? (
              <li
                className={`rounded-none border border-[#2e2e36] bg-[#16161a] px-2 py-3 text-center text-[11px] text-[#9b9ba8] ${UI_CARD}`}
              >
                Keine Termine im laufenden Monat
              </li>
            ) : (
              monthAgenda.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className={`flex w-full gap-2 rounded-none border border-[#2e2e36] bg-[#16161a] px-2 py-2 text-left ${UI_CARD} ${UI_HOVER}`}
                  >
                    <span
                      className="mt-0.5 w-1 shrink-0 rounded-full"
                      style={{ background: resolveEventColor(e) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#ececf1]">{e.title}</span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-[#9b9ba8]">
                        {format(parseISO(e.startAt), "EEE, d. MMMM · HH:mm", { locale: de })}
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
          className="relative min-h-[420px] flex-1 touch-none overflow-hidden bg-[#0c0c0f] outline-none"
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
            <div className="relative min-h-0 w-full flex-1">
              <AnimatePresence initial={false} mode="sync">
                <motion.div
                  key={band + format(anchor, "yyyy-MM-dd")}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.012 }}
                  transition={ZOOM_TRANSITION}
                  className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-[#0c0c0f]"
                >
                  {loading && events.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm font-medium text-[#9b9ba8]">
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
            </div>
          </motion.div>
        </div>

        <div className="relative hidden w-[17rem] max-w-[17rem] shrink-0 overflow-hidden md:block">
          <aside className="relative w-[17rem] shrink-0 border-t border-[#2e2e36] bg-[#121215] md:border-t-0 md:border-l md:border-[#2e2e36] md:pl-3 md:pr-2 md:pt-3">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-px md:block"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(255,56,92,0.12) 20%, rgba(255,56,92,0.2) 50%, rgba(255,56,92,0.12) 80%, transparent 100%)",
              }}
              aria-hidden
            />
            <div className={`relative rounded-none border border-[#2e2e36] bg-[#16161a] p-3 ${UI_CARD}`}>
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#2e2e36] pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32px] text-[#ececf1]">To-Do</p>
                <span className="rounded-none border border-[#ff385c]/35 bg-[#2a151c] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#ff7a92]">
                  {scratchTodos.filter((x) => !x.done).length} offen
                </span>
              </div>
              <div className="mb-3 flex gap-2">
                <input
                  value={todoDraft}
                  onChange={(e) => {
                    setTodoDraft(e.target.value);
                    setTodoSaveError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addScratchTodo();
                    }
                  }}
                  placeholder="Neue Aufgabe …"
                  disabled={todosLoading}
                  className="min-w-0 flex-1 rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-3 py-2 text-xs text-[#ececf1] placeholder:text-[#6b6b78] outline-none transition hover:border-[#ff385c]/35 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/25 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void addScratchTodo()}
                  disabled={todosLoading || !todoDraft.trim()}
                  className={`${calBtnPrimarySm} shrink-0 !h-9 !w-9 !min-w-9 !rounded-none !p-0 !text-lg leading-none`}
                  title="Hinzufügen"
                >
                  +
                </button>
              </div>
              {todoSaveError ? (
                <p className="mb-2 text-[10px] font-medium leading-snug text-[#ff7b7b]" role="alert">
                  {todoSaveError}
                </p>
              ) : null}
              <ul className="max-h-40 space-y-2 overflow-y-auto pr-0.5 text-xs md:max-h-[min(28rem,calc(100vh-9rem))]">
                {todosLoading && scratchTodos.length === 0 ? (
                  <li className="rounded-none border border-[#2e2e36] bg-[#16161a] px-3 py-4 text-center text-[11px] text-[#9b9ba8]">
                    Lade…
                  </li>
                ) : scratchTodos.length === 0 ? (
                  <li className="rounded-none border border-dashed border-[#3f3f48] bg-[#121215] px-3 py-6 text-center text-[11px] leading-relaxed text-[#9b9ba8]">
                    Noch nichts auf der Liste — oben eintragen.
                  </li>
                ) : (
                  scratchTodos.map((t) => (
                    <li key={t.id}>
                      <div
                        className={`group relative overflow-hidden rounded-none border px-2.5 py-2.5 transition ${UI_CARD} ${
                          t.done
                            ? "border-[#2e2e36] bg-[#121215] opacity-80"
                            : `border-[#2e2e36] bg-[#16161a] ${UI_HOVER}`
                        }`}
                      >
                        <div
                          className={`absolute inset-y-1 left-0 w-0.5 rounded-full transition ${
                            t.done ? "bg-[#5c5c68]" : "bg-[#ff385c]"
                          }`}
                          aria-hidden
                        />
                        <div className="flex items-start gap-2 pl-1.5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={t.done}
                            onClick={() => void toggleScratchTodo(t.id, t.done)}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-none border transition hover:border-[#ff385c] ${
                              t.done
                                ? "border-[#ff385c] bg-[#ff385c] text-white"
                                : "border-[#3f3f48] bg-[#0c0c0f]"
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
                                  ? "text-[#9b9ba8] line-through decoration-[#5c5c68]"
                                  : "font-semibold text-[#ececf1]"
                              }`}
                            >
                              {t.text}
                            </span>
                            <span className="mt-1 block text-[10px] tracking-wide text-[#9b9ba8]">
                              {format(parseISO(t.createdAt), "d. MMMM · HH:mm", { locale: de })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void removeScratchTodo(t.id)}
                            className="shrink-0 rounded-none px-1.5 py-0.5 text-[12px] text-[#9b9ba8] opacity-80 transition hover:bg-[#2a1818] hover:text-[#ff8f8f] md:opacity-0 md:group-hover:opacity-100"
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
    ? "font-medium leading-none tracking-tight text-[#9b9ba8] antialiased text-[length:clamp(6px,1.15vmin,11px)] transition-colors duration-150 ease-out group-hover:text-[#ececf1]"
    : "text-[9px] font-medium leading-none tracking-tight text-[#9b9ba8] antialiased transition-colors duration-150 ease-out group-hover:text-[#ececf1] sm:text-[10px]";

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
                    className={`group flex items-center justify-center ${DAY_CELL} ${
                      fill
                        ? "h-full min-h-0 min-w-0"
                        : "aspect-square flex-col px-0.5"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff385c]/35`}
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
                            ? "min-h-0 self-center rounded-full border border-black/10 shadow-sm"
                            : "h-1.5 min-h-0 self-center rounded-full border border-black/10 shadow-sm"
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
              className={`flex min-h-0 h-full min-w-0 flex-col overflow-hidden rounded-none border border-[#2e2e36] bg-[#16161a] p-1 transition-colors duration-150 md:p-1.5 ${UI_CARD} hover:border-[#ff385c]/35 hover:bg-[#1c1c22]`}
              onPointerEnter={() => onHoverDate(startOfMonth(m))}
              onPointerDown={() => onHoverDate(startOfMonth(m))}
            >
              <button
                type="button"
                onClick={() => onZoomFinerFrom(startOfMonth(m))}
                className="mb-0.5 shrink-0 rounded-none px-0.5 py-0.5 text-left transition hover:bg-[#222228]"
              >
                <span className="line-clamp-2 min-w-0 text-left text-[length:clamp(8px,1.35vmin,11px)] font-semibold leading-snug tracking-[-0.02em] text-[#ececf1] transition-colors hover:text-[#ff8fa3]">
                  {format(m, "MMMM", { locale: de })}
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
    const today = startOfDay(new Date());
    /** Muss mit Tageszeile und Termin-Balken identisch sein — sonst verschieben sich die Spalten. */
    const monthColGap = "gap-1";

    return (
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden pr-0.5"
        onPointerLeave={() => onHoverDate(null)}
      >
        <div className="mb-2 flex shrink-0 items-baseline gap-3 border-b border-[#2e2e36] pb-2">
          <h2 className="text-base font-bold tracking-[-0.03em] text-[#ececf1] sm:text-lg">
            {format(anchor, "MMMM", { locale: de })}
          </h2>
          <div
            className="hidden min-w-[2rem] flex-1 sm:block"
            style={{
              height: 2,
              background: "linear-gradient(90deg, rgba(255,56,92,0.45) 0%, rgba(255,56,92,0.12) 45%, transparent 100%)",
              borderRadius: 0,
            }}
            aria-hidden
          />
        </div>
        <div className={`mb-2 grid shrink-0 grid-cols-7 ${monthColGap} pb-0.5`}>
          {["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."].map((d, i) => (
            <div
              key={d}
              className={`rounded-none border border-[#2e2e36] bg-[#1a1a1f] py-1.5 text-center text-[8px] font-semibold uppercase leading-none tracking-wide text-[#ececf1] transition hover:bg-[#252530] sm:text-[9px] ${
                i >= 5 ? "bg-[#16161a] text-[#9b9ba8]" : ""
              }`}
            >
              {d}
            </div>
          ))}
        </div>
        <div
          className="grid min-h-0 flex-1 gap-2 sm:gap-2.5"
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
                className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-none border border-[#2e2e36] bg-[#16161a] p-1.5 ${UI_CARD} ${UI_HOVER}`}
              >
                <div className={`grid shrink-0 grid-cols-7 ${monthColGap}`}>
                  {weekDays.map((d, di) => {
                    const inM = isSameMonth(d, anchor);
                    const isToday = inM && isSameDay(startOfDay(d), today);
                    const weekend = di >= 5;
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onPointerEnter={() => onHoverDate(startOfDay(d))}
                        onPointerDown={() => onHoverDate(startOfDay(d))}
                        onClick={() => onZoomFinerFrom(d)}
                        className={`flex h-8 max-h-8 min-h-0 flex-col items-center justify-center rounded-none border text-center tabular-nums sm:h-9 sm:max-h-9 ${DAY_CELL} ${
                          inM
                            ? weekend
                              ? "border-[#2e2e36] bg-[#141418]"
                              : "border-[#2e2e36] bg-[#18181c]"
                            : "border-[#1f1f24] bg-[#0e0e11] opacity-55 hover:opacity-90"
                        } ${isToday ? "ring-2 ring-inset ring-[#ff385c]/60" : ""} `}
                      >
                        <span
                          className={`text-[11px] font-semibold leading-none tracking-tight sm:text-xs ${inM ? (isToday ? "text-[#ff7a92]" : "text-[#ececf1]") : "text-[#6b6b78]"}`}
                        >
                          {format(d, "d")}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {lanes.length > 0 ? (
                  <div className="mt-1 flex min-h-0 shrink-0 flex-col gap-px overflow-hidden">
                    {lanes.map((lane, li) => (
                      <div
                        key={li}
                        className={`grid min-h-0 shrink-0 grid-cols-7 items-center ${monthColGap}`}
                        style={{ minHeight: 11 }}
                      >
                        {lane.map((seg) => (
                          <button
                            key={seg.id}
                            type="button"
                            aria-label={seg.title}
                            title={seg.title}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onSelect(seg.event);
                            }}
                            className="min-h-0 w-full max-w-full justify-self-stretch rounded-none border border-white/10 outline-none transition hover:brightness-110 hover:ring-1 hover:ring-[#ff385c]/40 focus-visible:ring-2 focus-visible:ring-[#ff385c]/45"
                            style={{
                              gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                              height: "clamp(3px, 0.65vmin, 6px)",
                              minHeight: 3,
                              background: seg.color,
                            }}
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
      </div>
    );
  }

  /* Tag (100 %) */
  const dayEvents = eventsForCalendarDay(events, anchor);

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#0c0c0f]"
      onPointerEnter={() => onHoverDate(startOfDay(anchor))}
    >
      <h2 className="mb-2 shrink-0 text-lg font-bold tracking-[-0.03em] text-[#ececf1]">
        {format(anchor, "EEEE, d. MMMM", { locale: de })}
      </h2>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {dayEvents.length === 0 ? (
          <p className="text-sm font-medium text-[#9b9ba8]">Keine Termine an diesem Tag.</p>
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
      className={`flex w-full items-start gap-3 rounded-none border border-[#2e2e36] bg-[#16161a] p-3 text-left ${UI_CARD} ${UI_HOVER}`}
    >
      <div
        className="mt-0.5 h-10 w-1 shrink-0 rounded-full"
        style={{ background: resolveEventColor(event) }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#ececf1]">{event.title}</p>
        <p className="text-xs font-medium text-[#9b9ba8]">
          {format(parseISO(event.startAt), "HH:mm")} – {format(parseISO(event.endAt), "HH:mm")}
          {event.isExpandedInstance && " · Serie"}
        </p>
        {detailed && event.description && (
          <p className="mt-1 line-clamp-3 text-xs text-[#9b9ba8]">{event.description}</p>
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
  const inputCls = `mt-1 w-full rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-3 py-2 text-sm text-[#ececf1] outline-none transition hover:border-[#ff385c]/35 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/25 disabled:opacity-50`;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className={`max-h-[90vh] w-full max-w-lg overflow-auto rounded-none border border-[#2e2e36] bg-[#16161a] p-5 ${UI_CARD}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold tracking-[-0.03em] text-[#ececf1]">Termin</h3>
          <button type="button" onClick={onClose} className={`${calBtnGhost} !px-2 !py-1 !text-xs`}>
            Schließen
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#ececf1]">Titel</label>
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

        <div className="mt-5 border-t border-[#2e2e36] pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#ececf1]">Dateien</p>
          <p className="mb-3 text-[11px] leading-snug text-[#9b9ba8]">
            Vorhandene Anhänge und neue Uploads (ziehen oder klicken). Der Kalender aktualisiert sich nach dem
            Upload.
          </p>
          {attLoading && attachments.length === 0 ? (
            <p className="text-xs font-medium text-[#9b9ba8]">Lade Anhänge…</p>
          ) : attachments.length > 0 ? (
            <ul className="mb-3 space-y-1.5 rounded-none border border-[#2e2e36] bg-[#121215] p-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-none px-1 py-1 text-xs text-[#9b9ba8] transition hover:bg-[#222228] hover:text-[#ff8fa3]"
                  >
                    <span className="truncate font-semibold text-[#ececf1]">{a.name}</span>
                    {a.mimeType?.startsWith("image/") ? (
                      <span className="shrink-0 text-[10px] text-[#6b6b78]">Bild</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-[#9b9ba8]">Noch keine Dateien.</p>
          )}
          {!disabled ? (
            <UploadDropzone
              endpoint="eventAttachment"
              appearance={{
                container:
                  "group flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed border-[#3f3f48] bg-[#121215] px-4 py-5 transition hover:border-[#ff385c]/55 hover:bg-[#1f1418]",
                label: "text-sm font-semibold text-[#ececf1] group-hover:text-[#ff8fa3]",
                allowedContent: "text-[11px] text-[#9b9ba8]",
                button:
                  "rounded-none border border-[#2e2e36] bg-[#16161a] px-3 py-1.5 text-xs font-semibold text-[#ff7a92] transition hover:border-[#ff385c]/50 hover:bg-[#222228]",
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
            <p className="text-xs text-[#9b9ba8]">Anhänge zur Serie am Serien-Termin bearbeiten.</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {!disabled && (
            <>
              <button type="button" onClick={() => void save()} className={calBtnPrimary}>
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setDel(true)}
                className="inline-flex cursor-pointer items-center justify-center rounded-none border border-[#ff6b6b]/40 bg-[#16161a] px-4 py-2 text-sm font-semibold text-[#ff8f8f] transition hover:bg-[#2a1818] hover:border-[#ff6b6b]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b6b]/50"
              >
                Löschen
              </button>
            </>
          )}
        </div>
        {del && (
          <div className="mt-4 rounded-none border border-[#5c2a2a] bg-[#1f1414] p-3 text-sm">
            <p className="font-semibold text-[#ff8f8f]">Wirklich löschen?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void remove()}
                className="cursor-pointer rounded-none bg-[#c13515] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#e04530] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ff385c]"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => setDel(false)}
                className="cursor-pointer rounded-none border border-[#3f3f48] bg-[#16161a] px-3 py-1.5 text-xs font-semibold text-[#ececf1] transition hover:border-[#ff385c]/40 hover:bg-[#222228] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
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
