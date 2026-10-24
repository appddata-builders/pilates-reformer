-- ---------------------------------------------------------------------------
-- 23 · La copia de hydrate en la base del estudio
--
-- hydrate vive en la base de appddata y el sitio la lee con
-- APPSTRACT_DATABASE_URL (lib/hydrate/db.ts). La que está en esta base la creó
-- drizzle-kit desde lib/db/schema.pg.ts, de donde ya salió, y el código nuevo
-- no la lee.
--
-- Antes de correrlo:
--   1. Confirmar que el secret pilates-reformer-secrets trae
--      APPSTRACT_DATABASE_URL. Sin ella el sitio se queda con los textos de
--      lib/hydrate/fallback.pilates-reformer.json.
--   2. Si esta copia tiene textos editados que no estén en appddata, pasarlos
--      allá primero (node scripts/seed-hydrate.mjs siembra desde el JSON).
--
-- Idempotente: se puede correr varias veces.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS "hydrate";

COMMIT;
