import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

/**
 * `hydrate` de la base `appddata`. Vive aparte de lib/db/schema.pg.ts a
 * proposito: esa es la base propia y drizzle-kit crearia ahi una copia que
 * nadie lee. La tabla la posee y la migra appddata (ver ./db.ts).
 */
export const hydrate = pgTable(
  "hydrate",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    contentKey: text("content_key").notNull(),
    contentValue: text("content_value").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("hydrate_project_slug_idx").on(t.projectSlug),
    uniqueIndex("hydrate_project_slug_content_key_uidx").on(t.projectSlug, t.contentKey),
  ],
)
