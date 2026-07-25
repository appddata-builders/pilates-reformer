import { relations } from "drizzle-orm"
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("alumno"),
  phone: text("phone"),
  displayId: text("display_id").unique(),
  idPrefix: text("id_prefix").notNull().default("ST"),
  birthdate: text("birthdate"),
  notes: text("notes"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  welcomeShown: integer("welcome_shown", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()).$onUpdate(() => new Date()),
})

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
      .$defaultFn(() => new Date()).$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
)

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
      .$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
)

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
      .$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
)

export const plan = sqliteTable("plan", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  planType: text("plan_type").notNull().default("class_pack"),
  daysPerWeek: integer("days_per_week").notNull().default(0),
  totalClasses: integer("total_classes"),
  priceMxn: real("price_mxn").notNull(),
  costPerClass: real("cost_per_class"),
  durationDays: integer("duration_days").notNull().default(30),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  isAddOn: integer("is_add_on", { mode: "boolean" }).notNull().default(false),
  isUnlimited: integer("is_unlimited", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const reformer = sqliteTable("reformer", {
  id: text("id").primaryKey(),
  number: integer("number").notNull().unique(),
  name: text("name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
})

export const scheduleSlot = sqliteTable("schedule_slot", {
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
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const scheduleSlotException = sqliteTable(
  "schedule_slot_exception",
  {
    id: text("id").primaryKey(),
    scheduleSlotId: text("schedule_slot_id")
      .notNull()
      .references(() => scheduleSlot.id, { onDelete: "cascade" }),
    exceptionDate: integer("exception_date", { mode: "timestamp_ms" }).notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("schedule_slot_exception_slot_idx").on(t.scheduleSlotId),
    uniqueIndex("schedule_slot_exception_slot_date_uidx").on(t.scheduleSlotId, t.exceptionDate),
  ],
)

export const subscription = sqliteTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => plan.id),
    status: text("status").notNull().default("active"),
    startDate: integer("start_date", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    endDate: integer("end_date", { mode: "timestamp_ms" }).notNull(),
    classesRemaining: integer("classes_remaining"),
    daysUsedThisWeek: integer("days_used_this_week").notNull().default(0),
    isUnlimited: integer("is_unlimited", { mode: "boolean" }).notNull().default(false),
    discountPct: real("discount_pct"),
    discountReason: text("discount_reason"),
    billingCycle: text("billing_cycle").notNull().default("mensual"),
    costPerClass: real("cost_per_class"),
    paidAmount: real("paid_amount"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("subscription_userId_idx").on(t.userId)],
)

export const booking = sqliteTable(
  "booking",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    scheduleSlotId: text("schedule_slot_id").notNull().references(() => scheduleSlot.id),
    bookingDate: integer("booking_date", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("confirmed"),
    attended: integer("attended", { mode: "boolean" }),
    countedAsAttended: integer("counted_as_attended", { mode: "boolean" }).notNull().default(false),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    reformerNumber: integer("reformer_number"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("booking_userId_idx").on(t.userId),
    index("booking_date_idx").on(t.bookingDate),
  ],
)

export const payment = sqliteTable(
  "payment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscription.id),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("MXN"),
    method: text("method").notNull().default("efectivo"),
    status: text("status").notNull().default("succeeded"),
    concept: text("concept"),
    collectedBy: text("collected_by"),
    isNegative: integer("is_negative", { mode: "boolean" }).notNull().default(false),
    validated: integer("validated", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("payment_userId_idx").on(t.userId)],
)

export const saleItem = sqliteTable("sale_item", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleDate: integer("sale_date", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  concept: text("concept").notNull(),
  conceptType: text("concept_type").notNull().default("otro"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  totalAmount: real("total_amount").notNull(),
  method: text("method"),
  collectedBy: text("collected_by"),
  userId: text("user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const refund = sqliteTable("refund", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  subscriptionId: text("subscription_id").references(() => subscription.id),
  classesTotal: integer("classes_total").notNull(),
  classesUsed: integer("classes_used").notNull(),
  classesRefunded: integer("classes_refunded").notNull(),
  costPerClass: real("cost_per_class").notNull(),
  totalPaid: real("total_paid").notNull(),
  refundAmount: real("refund_amount").notNull(),
  reason: text("reason"),
  refundDate: integer("refund_date", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  processedBy: text("processed_by").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const coachPayrollPeriod = sqliteTable("coach_payroll_period", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  coachId: text("coach_id").notNull().references(() => user.id),
  periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
  classesCount: integer("classes_count").notNull().default(0),
  ratePerClass: real("rate_per_class").notNull(),
  totalAmount: real("total_amount").notNull(),
  isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const studioKpiSnapshot = sqliteTable("studio_kpi_snapshot", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  periodLabel: text("period_label").notNull(),
  periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
  totalClasses: integer("total_classes").notNull().default(0),
  totalAttendances: integer("total_attendances").notNull().default(0),
  occupancyRate: real("occupancy_rate"),
  activeMembers: integer("active_members").notNull().default(0),
  renewals: integer("renewals").notNull().default(0),
  newEnrollments: integer("new_enrollments").notNull().default(0),
  cancellations: integer("cancellations").notNull().default(0),
  targetOccupancy: real("target_occupancy").notNull().default(0.85),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const coupon = sqliteTable("coupon", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull().default("percent"),
  discountValue: real("discount_value").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: integer("valid_from", { mode: "timestamp_ms" }),
  validUntil: integer("valid_until", { mode: "timestamp_ms" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const studioPolicy = sqliteTable("studio_policy", {
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
  lateCancelPenalty: integer("late_cancel_penalty", { mode: "boolean" }).notNull().default(true),
  noShowPenalty: integer("no_show_penalty", { mode: "boolean" }).notNull().default(true),
  maxBookingsPerDay: integer("max_bookings_per_day").notNull().default(1),
  bookingWindowDays: integer("booking_window_days").notNull().default(7),
  bookingWindowMinutes: integer("booking_window_minutes").notNull().default(5),
  coachRatePerClass: real("coach_rate_per_class").notNull().default(250),
  totalReformers: integer("total_reformers").notNull().default(8),
  costPerClassBase: real("cost_per_class_base").notNull().default(270),
  brandColor: text("brand_color").notNull().default("#1b2d6e"),
  maintenanceMode: integer("maintenance_mode", { mode: "boolean" }).notNull().default(false),
  navPermissions: text("nav_permissions"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
    .$defaultFn(() => new Date()).$onUpdate(() => new Date()),
})

export const studioEvent = sqliteTable("studio_event", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("general"),
  startDate: integer("start_date", { mode: "timestamp_ms" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp_ms" }),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  color: text("color"),
  relatedUserId: text("related_user_id").references(() => user.id, { onDelete: "cascade" }),
  createdBy: text("created_by").references(() => user.id),
  visibleTo: text("visible_to").notNull().default("admin"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const notification = sqliteTable("notification", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
})

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  subscriptions: many(subscription),
  bookings: many(booking),
  payments: many(payment),
  notifications: many(notification),
  studioEvents: many(studioEvent, { relationName: "relatedEvents" }),
  refunds: many(refund),
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
  refunds: many(refund),
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

export const refundRelations = relations(refund, ({ one }) => ({
  user: one(user, { fields: [refund.userId], references: [user.id] }),
  subscription: one(subscription, { fields: [refund.subscriptionId], references: [subscription.id] }),
  processor: one(user, { fields: [refund.processedBy], references: [user.id], relationName: "refundProcessor" }),
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
