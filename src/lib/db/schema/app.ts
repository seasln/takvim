import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

/** Schnelle Aufgabenliste (Jahresansicht) — kein Kalenderbezug. */
export const scratchTodo = pgTable(
  "scratch_todo",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: boolean("done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("scratch_todo_user_sort_idx").on(t.userId, t.sortOrder)],
);

export const eventFrequencyEnum = pgEnum("event_frequency", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "CUSTOM",
]);

export const exceptionTypeEnum = pgEnum("exception_type", [
  "CANCELLED",
  "MODIFIED",
  "MOVED",
]);

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("tag_user_name_uidx").on(t.userId, t.name), index("tag_user_idx").on(t.userId)],
);

export const recurrenceRule = pgTable(
  "recurrence_rule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    frequency: eventFrequencyEnum("frequency").notNull(),
    interval: integer("interval").notNull().default(1),
    byWeekday: jsonb("by_weekday").$type<number[] | null>(),
    byMonthDay: smallint("by_month_day"),
    until: timestamp("until", { withTimezone: true }),
    count: integer("count"),
    customRRule: text("custom_rrule"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("recurrence_rule_user_idx").on(t.userId)],
);

export const calendarEvent = pgTable(
  "calendar_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    timeZone: text("time_zone"),
    color: text("color").notNull().default("#6366f1"),
    recurrenceRuleId: uuid("recurrence_rule_id").references(() => recurrenceRule.id, {
      onDelete: "set null",
    }),
    isRecurrenceMaster: boolean("is_recurrence_master").notNull().default(false),
    masterEventId: uuid("master_event_id").references((): AnyPgColumn => calendarEvent.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("calendar_event_user_start_idx").on(t.userId, t.startAt),
    index("calendar_event_user_end_idx").on(t.userId, t.endAt),
    index("calendar_event_master_idx").on(t.masterEventId),
  ],
);

export const eventOccurrenceException = pgTable(
  "event_occurrence_exception",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    masterEventId: uuid("master_event_id")
      .notNull()
      .references(() => calendarEvent.id, { onDelete: "cascade" }),
    originalStartAt: timestamp("original_start_at", { withTimezone: true }).notNull(),
    type: exceptionTypeEnum("type").notNull(),
    replacementEventId: uuid("replacement_event_id").references(() => calendarEvent.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("event_exception_master_original_uidx").on(t.masterEventId, t.originalStartAt),
    index("event_exception_user_idx").on(t.userId),
  ],
);

export const eventTag = pgTable(
  "event_tag",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvent.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.tagId] })],
);

export const reminder = pgTable(
  "reminder",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvent.id, { onDelete: "cascade" }),
    offsetMinutes: integer("offset_minutes").notNull(),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reminder_user_event_idx").on(t.userId, t.eventId)],
);

export const eventAttachment = pgTable(
  "event_attachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvent.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    url: text("url").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("event_attachment_event_idx").on(t.eventId), index("event_attachment_user_idx").on(t.userId)],
);

export const scratchTodoRelations = relations(scratchTodo, ({ one }) => ({
  user: one(user, { fields: [scratchTodo.userId], references: [user.id] }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  eventTags: many(eventTag),
}));

export const recurrenceRuleRelations = relations(recurrenceRule, ({ one, many }) => ({
  user: one(user, { fields: [recurrenceRule.userId], references: [user.id] }),
  events: many(calendarEvent),
}));

export const calendarEventRelations = relations(calendarEvent, ({ one, many }) => ({
  user: one(user, { fields: [calendarEvent.userId], references: [user.id] }),
  recurrenceRule: one(recurrenceRule, {
    fields: [calendarEvent.recurrenceRuleId],
    references: [recurrenceRule.id],
  }),
  eventTags: many(eventTag),
  reminders: many(reminder),
  attachments: many(eventAttachment),
}));

export const eventTagRelations = relations(eventTag, ({ one }) => ({
  event: one(calendarEvent, { fields: [eventTag.eventId], references: [calendarEvent.id] }),
  tag: one(tag, { fields: [eventTag.tagId], references: [tag.id] }),
}));

export const reminderRelations = relations(reminder, ({ one }) => ({
  event: one(calendarEvent, { fields: [reminder.eventId], references: [calendarEvent.id] }),
}));

export const eventAttachmentRelations = relations(eventAttachment, ({ one }) => ({
  event: one(calendarEvent, { fields: [eventAttachment.eventId], references: [calendarEvent.id] }),
}));

export const eventOccurrenceExceptionRelations = relations(
  eventOccurrenceException,
  ({ one }) => ({
    master: one(calendarEvent, {
      fields: [eventOccurrenceException.masterEventId],
      references: [calendarEvent.id],
    }),
    replacement: one(calendarEvent, {
      fields: [eventOccurrenceException.replacementEventId],
      references: [calendarEvent.id],
    }),
  }),
);
