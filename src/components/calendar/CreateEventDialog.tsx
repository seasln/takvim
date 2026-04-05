"use client";

import { addHours, format } from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { calBtnGhost, calBtnPrimary } from "@/lib/ui/calendar-button-classes";
import { DateTimePickerField } from "./DateTimePickerField";
import { EventColorField } from "./EventColorField";

const UI_CARD =
  "border border-[#2e2e36] bg-[#16161a] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_24px_rgba(0,0,0,0.45)]";

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
  const [color, setColor] = useState("#ff385c");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className={`w-full max-w-md rounded-none border border-[#2e2e36] bg-[#16161a] p-5 ${UI_CARD}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold tracking-[-0.03em] text-[#ececf1]">Neuer Termin</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-[#ececf1]">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-none border border-[#3f3f48] bg-[#0c0c0f] px-3 py-2 text-sm text-[#ececf1] outline-none transition hover:border-[#ff385c]/35 focus:border-[#ff385c] focus:ring-2 focus:ring-[#ff385c]/25"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateTimePickerField label="Start" value={start} onChange={setStart} />
            <DateTimePickerField label="Ende" value={end} onChange={setEnd} />
          </div>
          <EventColorField value={color} onChange={setColor} />
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#ececf1] transition hover:text-[#ff8fa3]">
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            Wöchentlich wiederholen
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={calBtnGhost}>
            Abbrechen
          </button>
          <button type="button" onClick={() => void submit()} className={calBtnPrimary}>
            Erstellen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
