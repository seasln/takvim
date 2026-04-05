"use client";

import { addHours, format } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary } from "@/lib/ui/button-classes";
import { DateTimePickerField } from "./DateTimePickerField";
import { EventColorField } from "./EventColorField";

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
  const [weekly, setWeekly] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStart(format(anchor, "yyyy-MM-dd'T'HH:mm"));
    setEnd(format(addHours(anchor, 1), "yyyy-MM-dd'T'HH:mm"));
  }, [open, anchor]);

  const submit = async () => {
    const body = {
      title: title.trim() || "Ohne Titel",
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      color,
      tagIds: [] as string[],
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
              className="mt-1 w-full rounded-lg border border-[#2a2622] bg-[#0c0b09] px-3 py-2 text-sm text-[#e8dfd3]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateTimePickerField label="Start" value={start} onChange={setStart} />
            <DateTimePickerField label="Ende" value={end} onChange={setEnd} />
          </div>
          <EventColorField value={color} onChange={setColor} />
          <label className="flex items-center gap-2 text-sm text-[#c4bbb0]">
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            Wöchentlich wiederholen
          </label>
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
