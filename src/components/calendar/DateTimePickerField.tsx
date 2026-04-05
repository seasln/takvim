"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const UI_CARD =
  "border border-[#2e2e36] bg-[#16161a] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_28px_rgba(0,0,0,0.55)]";

function parseLocalValue(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toLocalValue(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

const triggerBase =
  "mt-1 flex w-full items-center justify-between gap-2 rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-3 py-2.5 text-left text-sm font-semibold text-[#ececf1] transition hover:border-[#ff385c]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c]/50 disabled:cursor-not-allowed disabled:opacity-50";

export function DateTimePickerField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseLocalValue(value);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

  useEffect(() => {
    if (open) setViewMonth(startOfMonth(parseLocalValue(value)));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const setTime = (h: number, m: number) => {
    const d = parseLocalValue(value);
    d.setHours(h, m, 0, 0);
    onChange(toLocalValue(d));
  };

  const pickDay = (day: Date) => {
    const d = parseLocalValue(value);
    d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(toLocalValue(d));
  };

  const goToday = () => {
    const now = new Date();
    const d = parseLocalValue(value);
    d.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    onChange(toLocalValue(d));
    setViewMonth(startOfMonth(now));
  };

  const hour = format(selected, "HH");
  const minute = format(selected, "mm");

  return (
    <div ref={rootRef} className="relative">
      <label className="text-xs font-semibold text-[#ececf1]">{label}</label>
      <button
        type="button"
        disabled={disabled}
        className={triggerBase}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="min-w-0 truncate tabular-nums">
          {format(selected, "EEE, d. MMMM yyyy · HH:mm", { locale: de })}
        </span>
        <span className="shrink-0 text-[10px] text-[#9b9ba8]" aria-hidden>
          ▾
        </span>
      </button>

      {open && !disabled ? (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute left-0 top-full z-[60] mt-2 w-[min(calc(100vw-2rem),19rem)] rounded-none p-3 ${UI_CARD}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[#2e2e36] bg-[#1a1a1f] text-sm font-bold text-[#ececf1] transition hover:border-[#ff385c]/45 hover:bg-[#252530]"
              aria-label="Vorheriger Monat"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
            >
              ‹
            </button>
            <span className="min-w-0 truncate text-center text-xs font-semibold capitalize text-[#ececf1]">
              {format(viewMonth, "MMMM yyyy", { locale: de })}
            </span>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[#2e2e36] bg-[#1a1a1f] text-sm font-bold text-[#ececf1] transition hover:border-[#ff385c]/45 hover:bg-[#252530]"
              aria-label="Nächster Monat"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-px text-center text-[9px] font-semibold uppercase tracking-wide text-[#9b9ba8]">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <span key={d} className="py-0.5">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map((d) => {
              const inMonth = isSameMonth(d, viewMonth);
              const sel = isSameDay(d, selected);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pickDay(d)}
                  className={[
                    "flex aspect-square min-h-[1.75rem] items-center justify-center rounded-none border text-[11px] font-semibold tabular-nums transition",
                    inMonth
                      ? "border-[#2e2e36] bg-[#141418] text-[#ececf1] hover:border-[#ff385c]/45 hover:bg-[#252530]"
                      : "border-[#1f1f24] bg-[#0e0e11] text-[#6b6b78] hover:border-[#3f3f48] hover:bg-[#16161a]",
                    sel ? "border-[#ff385c] bg-[#ff385c] font-bold text-white hover:bg-[#ff5a7a]" : "",
                  ].join(" ")}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-[#2e2e36] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9b9ba8]">
              Zeit
            </span>
            <select
              value={hour}
              className="min-w-0 flex-1 rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-2 py-1.5 text-xs font-semibold text-[#ececf1] outline-none transition hover:border-[#ff385c]/35 focus:border-[#ff385c]"
              aria-label="Stunde"
              onChange={(e) => setTime(Number(e.target.value), selected.getMinutes())}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-[#9b9ba8]">:</span>
            <select
              value={minute}
              className="min-w-0 flex-1 rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-2 py-1.5 text-xs font-semibold text-[#ececf1] outline-none transition hover:border-[#ff385c]/35 focus:border-[#ff385c]"
              aria-label="Minute"
              onChange={(e) => setTime(selected.getHours(), Number(e.target.value))}
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex justify-end border-t border-[#2e2e36] pt-2">
            <button
              type="button"
              onClick={goToday}
              className="text-[11px] font-semibold text-[#ff7a92] underline-offset-2 transition hover:text-[#ff8fa3] hover:underline"
            >
              Heute
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
