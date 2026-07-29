import { relations } from "drizzle-orm"
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("alumno"),
  phone: text("phone"),
  displayId: text("display_id").unique(),
  idPrefix: text("id_prefix").notNull().default("ST"),
  birthdate: text("birthdate"),
  notes: text("notes"),
  enabled: boolean("enabled").notNull().default(true),
  welcomeShown: boolean("welcome_shown").notNull().default(false),
  // Clase muestra: se redime una sola vez por cuenta y no genera cobro.
  trialClassUsedAt: timestamp("trial_class_used_at", { precision: 3, mode: "date" }),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { precision: 3, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { precision: 3, mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
)

export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  planType: text("plan_type").notNull().default("class_pack"),
  daysPerWeek: integer("days_per_week").notNull().default(0),
  totalClasses: integer("total_classes"),
  priceMxn: doublePrecision("price_mxn").notNull(),
  costPerClass: doublePrecision("cost_per_class"),
  durationDays: integer("duration_days").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true),
  isAddOn: boolean("is_add_on").notNull().default(false),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const reformer = pgTable("reformer", {
  id: text("id").primaryKey(),
  number: integer("number").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
})

export const scheduleSlot = pgTable("schedule_slot", {
  id: text("id").primaryKey(),
  className: text("class_name").notNull(),
  instructor: text("instructor"),
  alternateInstructor: text("alternate_instructor"),
  scheduleMode: text("schedule_mode").notNull().default("fixed"),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  capacity: integer("capacity").notNull().default(10),
  classType: text("class_type").notNull().default("reformer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const scheduleSlotException = pgTable(
  "schedule_slot_exception",
  {
    id: text("id").primaryKey(),
    scheduleSlotId: text("schedule_slot_id")
      .notNull()
      .references(() => scheduleSlot.id, { onDelete: "cascade" }),
    exceptionDate: timestamp("exception_date", { precision: 3, mode: "date" }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("schedule_slot_exception_slot_idx").on(t.scheduleSlotId),
    uniqueIndex("schedule_slot_exception_slot_date_uidx").on(t.scheduleSlotId, t.exceptionDate),
  ],
)

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => plan.id),
    status: text("status").notNull().default("active"),
    startDate: timestamp("start_date", { precision: 3, mode: "date" }).notNull().defaultNow(),
    endDate: timestamp("end_date", { precision: 3, mode: "date" }).notNull(),
    classesRemaining: integer("classes_remaining"),
    daysUsedThisWeek: integer("days_used_this_week").notNull().default(0),
    isUnlimited: boolean("is_unlimited").notNull().default(false),
    discountPct: doublePrecision("discount_pct"),
    discountReason: text("discount_reason"),
    billingCycle: text("billing_cycle").notNull().default("mensual"),
    costPerClass: doublePrecision("cost_per_class"),
    paidAmount: doublePrecision("paid_amount"),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("subscription_userId_idx").on(t.userId)],
)

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    scheduleSlotId: text("schedule_slot_id").notNull().references(() => scheduleSlot.id),
    bookingDate: timestamp("booking_date", { precision: 3, mode: "date" }).notNull(),
    status: text("status").notNull().default("confirmed"),
    attended: boolean("attended"),
    countedAsAttended: boolean("counted_as_attended").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { precision: 3, mode: "date" }),
    notes: text("notes"),
    reformerNumber: integer("reformer_number"),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("booking_userId_idx").on(t.userId),
    index("booking_date_idx").on(t.bookingDate),
  ],
)

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscription.id),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull().default("MXN"),
    method: text("method").notNull().default("efectivo"),
    status: text("status").notNull().default("succeeded"),
    concept: text("concept"),
    collectedBy: text("collected_by"),
    isNegative: boolean("is_negative").notNull().default(false),
    validated: boolean("validated").notNull().default(false),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("payment_userId_idx").on(t.userId)],
)

export const saleItem = pgTable("sale_item", {
  id: text("id").primaryKey(),
  saleDate: timestamp("sale_date", { precision: 3, mode: "date" }).notNull().defaultNow(),
  concept: text("concept").notNull(),
  conceptType: text("concept_type").notNull().default("otro"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: doublePrecision("unit_price").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  method: text("method"),
  collectedBy: text("collected_by"),
  userId: text("user_id").references(() => user.id),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const coachPayrollPeriod = pgTable("coach_payroll_period", {
  id: text("id").primaryKey(),
  coachId: text("coach_id").notNull().references(() => user.id),
  periodStart: timestamp("period_start", { precision: 3, mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { precision: 3, mode: "date" }).notNull(),
  classesCount: integer("classes_count").notNull().default(0),
  ratePerClass: doublePrecision("rate_per_class").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  isPaid: boolean("is_paid").notNull().default(false),
  paidAt: timestamp("paid_at", { precision: 3, mode: "date" }),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const studioKpiSnapshot = pgTable("studio_kpi_snapshot", {
  id: text("id").primaryKey(),
  periodLabel: text("period_label").notNull(),
  periodStart: timestamp("period_start", { precision: 3, mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { precision: 3, mode: "date" }).notNull(),
  totalClasses: integer("total_classes").notNull().default(0),
  totalAttendances: integer("total_attendances").notNull().default(0),
  occupancyRate: doublePrecision("occupancy_rate"),
  activeMembers: integer("active_members").notNull().default(0),
  renewals: integer("renewals").notNull().default(0),
  newEnrollments: integer("new_enrollments").notNull().default(0),
  cancellations: integer("cancellations").notNull().default(0),
  targetOccupancy: doublePrecision("target_occupancy").notNull().default(0.85),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const coupon = pgTable("coupon", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull().default("percent"),
  discountValue: doublePrecision("discount_value").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: timestamp("valid_from", { precision: 3, mode: "date" }),
  validUntil: timestamp("valid_until", { precision: 3, mode: "date" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const studioPolicy = pgTable("studio_policy", {
  id: text("id").primaryKey().default("main"),
  studioName: text("studio_name").notNull().default("Pilates Studio"),
  logoUrl: text("logo_url"),
  maxCapacity: integer("max_capacity").notNull().default(10),
  cancelHours: integer("cancel_hours").notNull().default(1),
  cancelMinutes: integer("cancel_minutes").notNull().default(90),
  alertLastClassThreshold: integer("alert_last_class_threshold").notNull().default(2),
  alertDaysBeforeExpiry: integer("alert_days_before_expiry").notNull().default(3),
  welcomeMessage: text("welcome_message").notNull().default(
    "Bienvenid@ {{nombre}}.\n\nTu ID es: {{displayId}}\n\n¡Nos vemos en el estudio!",
  ),
  birthdayMessage: text("birthday_message").notNull().default(
    "¡Feliz cumpleaños {{nombre}}! El equipo de {{estudio}} te desea un día increíble.",
  ),
  lateCancelPenalty: boolean("late_cancel_penalty").notNull().default(true),
  noShowPenalty: boolean("no_show_penalty").notNull().default(true),
  maxBookingsPerDay: integer("max_bookings_per_day").notNull().default(1),
  bookingWindowDays: integer("booking_window_days").notNull().default(7),
  bookingWindowMinutes: integer("booking_window_minutes").notNull().default(5),
  coachRatePerClass: doublePrecision("coach_rate_per_class").notNull().default(250),
  totalReformers: integer("total_reformers").notNull().default(8),
  costPerClassBase: doublePrecision("cost_per_class_base").notNull().default(270),
  brandColor: text("brand_color").notNull().default("#1b2d6e"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  navPermissions: text("nav_permissions"),
  updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const studioEvent = pgTable("studio_event", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("general"),
  startDate: timestamp("start_date", { precision: 3, mode: "date" }).notNull(),
  endDate: timestamp("end_date", { precision: 3, mode: "date" }),
  allDay: boolean("all_day").notNull().default(false),
  color: text("color"),
  relatedUserId: text("related_user_id").references(() => user.id, { onDelete: "cascade" }),
  createdBy: text("created_by").references(() => user.id),
  visibleTo: text("visible_to").notNull().default("admin"),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const notification = pgTable("notification", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
})

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  subscriptions: many(subscription),
  bookings: many(booking),
  payments: many(payment),
  notifications: many(notification),
  studioEvents: many(studioEvent, { relationName: "relatedEvents" }),
  sales: many(saleItem),
  payrollPeriods: many(coachPayrollPeriod),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const planRelations = relations(plan, ({ many }) => ({
  subscriptions: many(subscription),
}))

export const reformerRelations = relations(reformer, ({ many }) => ({
  bookings: many(booking),
}))

export const scheduleSlotRelations = relations(scheduleSlot, ({ many }) => ({
  bookings: many(booking),
  exceptions: many(scheduleSlotException),
}))

export const scheduleSlotExceptionRelations = relations(scheduleSlotException, ({ one }) => ({
  scheduleSlot: one(scheduleSlot, {
    fields: [scheduleSlotException.scheduleSlotId],
    references: [scheduleSlot.id],
  }),
}))

export const subscriptionRelations = relations(subscription, ({ one, many }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
  plan: one(plan, { fields: [subscription.planId], references: [plan.id] }),
  payments: many(payment),
}))

export const bookingRelations = relations(booking, ({ one }) => ({
  user: one(user, { fields: [booking.userId], references: [user.id] }),
  scheduleSlot: one(scheduleSlot, { fields: [booking.scheduleSlotId], references: [scheduleSlot.id] }),
}))

export const paymentRelations = relations(payment, ({ one }) => ({
  user: one(user, { fields: [payment.userId], references: [user.id] }),
  subscription: one(subscription, { fields: [payment.subscriptionId], references: [subscription.id] }),
}))

export const saleItemRelations = relations(saleItem, ({ one }) => ({
  user: one(user, { fields: [saleItem.userId], references: [user.id] }),
}))

export const coachPayrollRelations = relations(coachPayrollPeriod, ({ one }) => ({
  coach: one(user, { fields: [coachPayrollPeriod.coachId], references: [user.id] }),
}))

export const studioEventRelations = relations(studioEvent, ({ one }) => ({
  relatedUser: one(user, {
    fields: [studioEvent.relatedUserId],
    references: [user.id],
    relationName: "relatedEvents",
  }),
  creator: one(user, { fields: [studioEvent.createdBy], references: [user.id] }),
}))

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, { fields: [notification.userId], references: [user.id] }),
}))
