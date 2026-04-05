"use client";

import { useEffect, useState } from "react";

const SWATCHES = [
  "#f0a046",
  "#f5b45a",
  "#6366f1",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#eab308",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#78716c",
  "#e8dfd3",
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
      <label className="text-xs text-[#7a7268]">{label}</label>
      <div
        className={`mt-2 rounded-xl border border-[#2a2622] bg-[#0c0b09]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${disabled ? "opacity-50" : ""}`}
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
                  "relative h-8 w-full rounded-lg border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0a046]/55",
                  active ? "border-[#f0a046] shadow-[0_0_0_1px_rgba(240,160,70,0.35)]" : "border-transparent hover:border-white/20",
                ].join(" ")}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-[#6b645c]">#</span>
          <input
            type="text"
            value={draft}
            disabled={disabled}
            maxLength={6}
            placeholder="rrggbb"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-[#2a2622] bg-[#141210] px-2 py-1.5 font-mono text-xs uppercase tracking-wide text-[#e8dfd3] outline-none placeholder:text-[#4a4540] focus:border-[#f0a046]/45 disabled:cursor-not-allowed"
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
            className="h-9 w-10 shrink-0 rounded-lg border border-[#2a2622] shadow-inner"
            style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/i.test(value) ? value : "#6366f1" }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
