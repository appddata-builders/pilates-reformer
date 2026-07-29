-- Baja del módulo de devoluciones.
--   psql "$DATABASE_URL" -f scripts/postgres-manual/15-quitar-devoluciones.sql
--
-- OPCIONAL y DESTRUCTIVO: borra la tabla `refund` y todo su histórico. La app ya
-- no la usa (se quitó del esquema y del dashboard), así que dejarla no rompe
-- nada; esto es sólo limpieza.
--
-- Si quieres conservar el histórico, corre antes:
--   CREATE TABLE refund_respaldo AS SELECT * FROM refund;

BEGIN;

DROP TABLE IF EXISTS "refund";

COMMIT;
