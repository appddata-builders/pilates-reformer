-- El aforo del estudio es de 10 lugares por clase, no 8.
--   psql "$DATABASE_URL" -f scripts/postgres-manual/12-aforo-10.sql
--
-- Sube el cupo de los horarios existentes y el máximo configurado del estudio,
-- y deja el default de la columna alineado con lib/db/schema.pg.ts.

BEGIN;

ALTER TABLE "schedule_slot"
  ALTER COLUMN "capacity" SET DEFAULT 10;

ALTER TABLE "studio_policy"
  ALTER COLUMN "max_capacity" SET DEFAULT 10;

-- Sólo sube los horarios que seguían en el 8 heredado del seed: si alguien ya
-- ajustó un cupo distinto a mano, se respeta.
UPDATE "schedule_slot"
  SET "capacity" = 10
  WHERE "capacity" = 8;

UPDATE "studio_policy"
  SET "max_capacity" = 10, "updated_at" = now()
  WHERE "id" = 'main' AND "max_capacity" = 8;

COMMIT;
