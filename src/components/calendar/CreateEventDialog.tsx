"use client";

import { addHours, format } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary } from "@/lib/ui/button-classes";

type Tag = { id: string; name: string; color: string | null };

export function CreateEventDialog({
  anchor,
  open,
  onClose,
  onCreated,
}: {
  anchor: Date;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(() => format(anchor, "yyyy-MM-dd'T'HH:mm"));
  const [end, setEnd] = useState(() => format(addHours(anchor, 1), "yyyy-MM-dd'T'HH:mm"));
  const [color, setColor] = useState("#6366f1");
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [weekly, setWeekly] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStart(format(anchor, "yyyy-MM-dd'T'HH:mm"));
    setEnd(format(addHours(anchor, 1), "yyyy-MM-dd'T'HH:mm"));
    void fetch("/api/tags", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { tags: Tag[] }) => setTags(d.tags ?? []))
      .catch(() => setTags([]));
  }, [open, anchor]);

  const toggleTag = (id: string) => {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    const body = {
      title: title.trim() || "Ohne Titel",
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      color,
      tagIds,
      recurrence: weekly
        ? { frequency: "WEEKLY" as const, interval: 1 }
        : undefined,
    };
    const res = await fetch("/api/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setTitle("");
      setWeekly(false);
      setTagIds([]);
      onCreated();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-[#2a2622] bg-[#141210] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-display)] text-lg text-[#f0a046]">
          Neuer Termin
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-[#7a7268]">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2a2622] bg-[#0c0b09] px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[#7a7268]">Start</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2a2622] bg-[#0c0b09] px-2 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-[#7a7268]">Ende</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2a2622] bg-[#0c0b09] px-2 py-2 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#7a7268]">Farbe</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 h-10 w-full cursor-pointer rounded border border-[#2a2622] bg-transparent"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#c4bbb0]">
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            Wöchentlich wiederholen
          </label>
          <div>
            <p className="text-xs text-[#7a7268]">Tags</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`cursor-pointer rounded-full px-2 py-0.5 text-[11px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f0a046]/60 ${
                    tagIds.includes(t.id)
                      ? "bg-[#f0a046]/25 text-[#f0a046]"
                      : "bg-[#1f1c19] text-[#9a928a]"
                  }`}
                  style={t.color ? { border: `1px solid ${t.color}` } : undefined}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Abbrechen
          </button>
          <button type="button" onClick={() => void submit()} className={btnPrimary}>
            Erstellen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
