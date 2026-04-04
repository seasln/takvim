CREATE TYPE "public"."event_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."exception_type" AS ENUM('CANCELLED', 'MODIFIED', 'MOVED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"time_zone" text,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"recurrence_rule_id" uuid,
	"is_recurrence_master" boolean DEFAULT false NOT NULL,
	"master_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_occurrence_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"master_event_id" uuid NOT NULL,
	"original_start_at" timestamp with time zone NOT NULL,
	"type" "exception_type" NOT NULL,
	"replacement_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tag" (
	"event_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "event_tag_event_id_tag_id_pk" PRIMARY KEY("event_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "recurrence_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"frequency" "event_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_weekday" jsonb,
	"by_month_day" smallint,
	"until" timestamp with time zone,
	"count" integer,
	"custom_rrule" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"offset_minutes" integer NOT NULL,
	"snoozed_until" timestamp with time zone,
	"last_fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_recurrence_rule_id_recurrence_rule_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_master_event_id_calendar_event_id_fk" FOREIGN KEY ("master_event_id") REFERENCES "public"."calendar_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachment" ADD CONSTRAINT "event_attachment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attachment" ADD CONSTRAINT "event_attachment_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_exception" ADD CONSTRAINT "event_occurrence_exception_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_exception" ADD CONSTRAINT "event_occurrence_exception_master_event_id_calendar_event_id_fk" FOREIGN KEY ("master_event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_exception" ADD CONSTRAINT "event_occurrence_exception_replacement_event_id_calendar_event_id_fk" FOREIGN KEY ("replacement_event_id") REFERENCES "public"."calendar_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tag" ADD CONSTRAINT "event_tag_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tag" ADD CONSTRAINT "event_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rule" ADD CONSTRAINT "recurrence_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_event_id_calendar_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "calendar_event_user_start_idx" ON "calendar_event" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "calendar_event_user_end_idx" ON "calendar_event" USING btree ("user_id","end_at");--> statement-breakpoint
CREATE INDEX "calendar_event_master_idx" ON "calendar_event" USING btree ("master_event_id");--> statement-breakpoint
CREATE INDEX "event_attachment_event_idx" ON "event_attachment" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_attachment_user_idx" ON "event_attachment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_exception_master_original_uidx" ON "event_occurrence_exception" USING btree ("master_event_id","original_start_at");--> statement-breakpoint
CREATE INDEX "event_exception_user_idx" ON "event_occurrence_exception" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurrence_rule_user_idx" ON "recurrence_rule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminder_user_event_idx" ON "reminder" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_user_name_uidx" ON "tag" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "tag_user_idx" ON "tag" USING btree ("user_id");