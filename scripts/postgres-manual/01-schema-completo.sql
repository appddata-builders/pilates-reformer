-- PILATES REFORMER — PostgreSQL schema completo (17 tablas)
-- Espejo: lib/db/schema.pg.ts
-- Ejecutar en BD VACÍA. No usa drizzle-kit.
--
--   psql "$DATABASE_URL" -f scripts/postgres-manual/01-schema-completo.sql
--
-- Tablas: user, session, account, verification, plan, subscription, booking,
-- payment, sale_item, refund, reformer, schedule_slot, coach_payroll_period,
-- studio_kpi_snapshot, studio_policy, studio_event, notification, coupon

BEGIN;

CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp (3),
	"refresh_token_expires_at" timestamp (3),
	"scope" text,
	"password" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"schedule_slot_id" text NOT NULL,
	"booking_date" timestamp (3) NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"attended" boolean,
	"counted_as_attended" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp (3),
	"notes" text,
	"reformer_number" integer,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "coach_payroll_period" (
	"id" text PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"period_start" timestamp (3) NOT NULL,
	"period_end" timestamp (3) NOT NULL,
	"classes_count" integer DEFAULT 0 NOT NULL,
	"rate_per_class" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "coupon" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"discount_type" text DEFAULT 'percent' NOT NULL,
	"discount_value" double precision NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp (3),
	"valid_until" timestamp (3),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" text,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"method" text DEFAULT 'efectivo' NOT NULL,
	"status" text DEFAULT 'succeeded' NOT NULL,
	"concept" text,
	"collected_by" text,
	"is_negative" boolean DEFAULT false NOT NULL,
	"validated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan_type" text DEFAULT 'class_pack' NOT NULL,
	"days_per_week" integer DEFAULT 0 NOT NULL,
	"total_classes" integer,
	"price_mxn" double precision NOT NULL,
	"cost_per_class" double precision,
	"duration_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_add_on" boolean DEFAULT false NOT NULL,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reformer" (
	"id" text PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	CONSTRAINT "reformer_number_unique" UNIQUE("number")
);

CREATE TABLE IF NOT EXISTS "refund" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" text,
	"classes_total" integer NOT NULL,
	"classes_used" integer NOT NULL,
	"classes_refunded" integer NOT NULL,
	"cost_per_class" double precision NOT NULL,
	"total_paid" double precision NOT NULL,
	"refund_amount" double precision NOT NULL,
	"reason" text,
	"refund_date" timestamp (3) DEFAULT now() NOT NULL,
	"processed_by" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sale_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_date" timestamp (3) DEFAULT now() NOT NULL,
	"concept" text NOT NULL,
	"concept_type" text DEFAULT 'otro' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"method" text,
	"collected_by" text,
	"user_id" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"class_name" text NOT NULL,
	"instructor" text,
	"alternate_instructor" text,
	"schedule_mode" text DEFAULT 'fixed' NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"capacity" integer DEFAULT 10 NOT NULL,
	"class_type" text DEFAULT 'reformer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_slot_exception" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_slot_id" text NOT NULL,
	"exception_date" timestamp (3) NOT NULL,
	"reason" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "studio_event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" text DEFAULT 'general' NOT NULL,
	"start_date" timestamp (3) NOT NULL,
	"end_date" timestamp (3),
	"all_day" boolean DEFAULT false NOT NULL,
	"color" text,
	"related_user_id" text,
	"created_by" text,
	"visible_to" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "studio_kpi_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"period_label" text NOT NULL,
	"period_start" timestamp (3) NOT NULL,
	"period_end" timestamp (3) NOT NULL,
	"total_classes" integer DEFAULT 0 NOT NULL,
	"total_attendances" integer DEFAULT 0 NOT NULL,
	"occupancy_rate" double precision,
	"active_members" integer DEFAULT 0 NOT NULL,
	"renewals" integer DEFAULT 0 NOT NULL,
	"new_enrollments" integer DEFAULT 0 NOT NULL,
	"cancellations" integer DEFAULT 0 NOT NULL,
	"target_occupancy" double precision DEFAULT 0.85 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "studio_policy" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"studio_name" text DEFAULT 'Pilates Studio' NOT NULL,
	"logo_url" text,
	"max_capacity" integer DEFAULT 10 NOT NULL,
	"cancel_hours" integer DEFAULT 1 NOT NULL,
	"cancel_minutes" integer DEFAULT 90 NOT NULL,
	"alert_last_class_threshold" integer DEFAULT 2 NOT NULL,
	"alert_days_before_expiry" integer DEFAULT 3 NOT NULL,
	"welcome_message" text DEFAULT 'Bienvenid@ {{nombre}}.

Tu ID es: {{displayId}}

¡Nos vemos en el estudio!' NOT NULL,
	"birthday_message" text DEFAULT '¡Feliz cumpleaños {{nombre}}! El equipo de {{estudio}} te desea un día increíble.' NOT NULL,
	"late_cancel_penalty" boolean DEFAULT true NOT NULL,
	"no_show_penalty" boolean DEFAULT true NOT NULL,
	"max_bookings_per_day" integer DEFAULT 1 NOT NULL,
	"booking_window_days" integer DEFAULT 7 NOT NULL,
	"booking_window_minutes" integer DEFAULT 5 NOT NULL,
	"coach_rate_per_class" double precision DEFAULT 250 NOT NULL,
	"total_reformers" integer DEFAULT 8 NOT NULL,
	"cost_per_class_base" double precision DEFAULT 270 NOT NULL,
	"brand_color" text DEFAULT '#1b2d6e' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"nav_permissions" text,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" timestamp (3) DEFAULT now() NOT NULL,
	"end_date" timestamp (3) NOT NULL,
	"classes_remaining" integer,
	"days_used_this_week" integer DEFAULT 0 NOT NULL,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"discount_pct" double precision,
	"discount_reason" text,
	"billing_cycle" text DEFAULT 'mensual' NOT NULL,
	"cost_per_class" double precision,
	"paid_amount" double precision,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'alumno' NOT NULL,
	"phone" text,
	"display_id" text,
	"id_prefix" text DEFAULT 'ST' NOT NULL,
	"birthdate" text,
	"notes" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"welcome_shown" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_display_id_unique" UNIQUE("display_id")
);

CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp (3) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "booking" ADD CONSTRAINT "booking_schedule_slot_id_schedule_slot_id_fk" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slot"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "coach_payroll_period" ADD CONSTRAINT "coach_payroll_period_coach_id_user_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "refund" ADD CONSTRAINT "refund_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "refund" ADD CONSTRAINT "refund_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "refund" ADD CONSTRAINT "refund_processed_by_user_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "studio_event" ADD CONSTRAINT "studio_event_related_user_id_user_id_fk" FOREIGN KEY ("related_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "studio_event" ADD CONSTRAINT "studio_event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "schedule_slot_exception" ADD CONSTRAINT "schedule_slot_exception_schedule_slot_id_schedule_slot_id_fk" FOREIGN KEY ("schedule_slot_id") REFERENCES "public"."schedule_slot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "booking_userId_idx" ON "booking" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "booking_date_idx" ON "booking" USING btree ("booking_date");
CREATE INDEX IF NOT EXISTS "payment_userId_idx" ON "payment" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "schedule_slot_exception_slot_idx" ON "schedule_slot_exception" USING btree ("schedule_slot_id");
CREATE UNIQUE INDEX IF NOT EXISTS "schedule_slot_exception_slot_date_uidx" ON "schedule_slot_exception" USING btree ("schedule_slot_id","exception_date");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "subscription_userId_idx" ON "subscription" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");

COMMIT;
