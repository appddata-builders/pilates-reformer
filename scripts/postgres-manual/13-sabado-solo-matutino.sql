-- Los sábados el estudio sólo abre el turno matutino (07–11).
--   psql "$DATABASE_URL" -f scripts/postgres-manual/13-sabado-solo-matutino.sql
--
-- Borra los bloques vespertinos del sábado. Si alguno ya tuviera reservas se
-- desactiva en vez de borrarse, para no perder el historial.

BEGIN;

UPDATE "schedule_slot"
  SET "is_active" = false
  WHERE "day_of_week" = 6
    AND "start_time" >= '12:00'
    AND "id" IN (SELECT DISTINCT "schedule_slot_id" FROM "booking");

DELETE FROM "schedule_slot"
  WHERE "day_of_week" = 6
    AND "start_time" >= '12:00'
    AND "id" NOT IN (SELECT DISTINCT "schedule_slot_id" FROM "booking");

COMMIT;
