export type CalendarEventDTO = {
  id: string;
  masterId?: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timeZone: string | null;
  color: string;
  tagIds: string[];
  reminders: { id: string; offsetMinutes: number }[];
  isExpandedInstance: boolean;
};
