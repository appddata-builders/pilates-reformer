-- Clase individual sin pago previo (una vez por cuenta).
--   psql "$DATABASE_URL" -f scripts/postgres-manual/14-clase-individual.sql
--
-- `individual_class_used_at` marca la única clase suelta que una cuenta puede
-- apartar sin pagar en el momento. En NULL significa que sigue disponible.
--
-- OBLIGATORIO: lib/db/schema.pg.ts ya declara esta columna, así que mientras no
-- exista en la base, cualquier consulta sobre "user" (incluida la sesión de
-- better-auth) falla y la app responde Internal Server Error.

BEGIN;

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "individual_class_used_at" timestamp(3);

COMMIT;
