"use client";

import { useEffect, useState } from "react";

const SWATCHES = [
  "#ff385c",
  "#e00b41",
  "#ececf1",
  "#428bff",
  "#460479",
  "#92174d",
  "#22c55e",
  "#6366f1",
  "#9b9ba8",
  "#3f3f48",
  "#2e2e36",
  "#16161a",
] as const;

function normalizeHex(input: string): string | null {
  const raw = input.replace(/#/g, "").replace(/[^0-9A-Fa-f]/g, "");
  if (raw.length !== 6) return null;
  return `#${raw.toLowerCase()}`;
}

export function EventColorField({
  label = "Farbe",
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(() => value.replace(/^#/, ""));
  useEffect(() => {
    setDraft(value.replace(/^#/, ""));
  }, [value]);

  const applyDraft = () => {
    const n = normalizeHex(draft);
    if (n) onChange(n);
    else setDraft(value.replace(/^#/, ""));
  };

  return (
    <div>
      <label className="text-xs font-semibold text-[#ececf1]">{label}</label>
      <div
        className={`mt-2 rounded-none border border-[#2e2e36] bg-[#121215] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${disabled ? "opacity-50" : ""}`}
      >
        <div className="grid grid-cols-7 gap-2 sm:grid-cols-7">
          {SWATCHES.map((hex) => {
            const active = value.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                disabled={disabled}
                title={hex}
                aria-label={`Farbe ${hex}`}
                onClick={() => onChange(hex)}
                className={[
                  "relative h-8 w-full rounded-none border-2 transition hover:border-[#ff385c]/55 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff385c]",
                  active
                    ? "border-[#ff385c] shadow-[0_0_0_2px_rgba(255,56,92,0.35)]"
                    : "border-[#2e2e36] hover:bg-[#222228]",
                ].join(" ")}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-semibold text-[#9b9ba8]">#</span>
          <input
            type="text"
            value={draft}
            disabled={disabled}
            maxLength={6}
            placeholder="rrggbb"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-2 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-[#ececf1] outline-none placeholder:text-[#6b6b78] transition hover:border-[#ff385c]/35 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/25 disabled:cursor-not-allowed"
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9A-Fa-f]/gi, "").slice(0, 6))}
            onBlur={() => applyDraft()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyDraft();
              }
            }}
          />
          <div
            className="h-9 w-10 shrink-0 rounded-none border border-[#2e2e36] shadow-inner"
            style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/i.test(value) ? value : "#ff385c" }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
