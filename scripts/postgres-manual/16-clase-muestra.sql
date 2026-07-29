-- Clase muestra: una sola vez por cuenta, sin costo.
--   psql "$DATABASE_URL" -f scripts/postgres-manual/16-clase-muestra.sql
--
-- OBLIGATORIO: lib/db/schema.pg.ts ya declara `trial_class_used_at`. Mientras no
-- exista, cualquier consulta sobre "user" (incluida la sesión de better-auth)
-- falla y la app responde Internal Server Error.
--
-- Reemplaza a `individual_class_used_at`, que limitaba la clase individual a una
-- por cuenta. Ese límite se eliminó: ahora la alumna reserva siempre que haya
-- lugar y cada clase sin plan genera un adeudo que el estudio regulariza.

BEGIN;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "trial_class_used_at" timestamp(3);

-- Conserva el dato de quien ya había gastado su clase sin pago previo.
UPDATE "user"
SET "trial_class_used_at" = "individual_class_used_at"
WHERE "individual_class_used_at" IS NOT NULL
  AND "trial_class_used_at" IS NULL;

ALTER TABLE "user" DROP COLUMN IF EXISTS "individual_class_used_at";

COMMIT;
