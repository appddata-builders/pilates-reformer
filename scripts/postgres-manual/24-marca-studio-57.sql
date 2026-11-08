-- ---------------------------------------------------------------------------
-- 24 · Marca única: "Studio 57"
--
-- El nombre del estudio y el de las clases venían del seed de la plantilla
-- ("Pilates Studio" / "Pilates Reformer") y se veían en el panel: barra
-- lateral, horario, calendario, reservas y mensajes. Todo pasa a "Studio 57".
--
-- Idempotente: se puede correr varias veces.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "studio_policy" ALTER COLUMN "studio_name" SET DEFAULT 'Studio 57';

UPDATE "studio_policy"
  SET "studio_name" = 'Studio 57', "updated_at" = now()
  WHERE "studio_name" ILIKE '%pilates%';

UPDATE "studio_policy"
  SET "welcome_message" = replace(replace("welcome_message", 'Pilates Studio', 'Studio 57'), 'Pilates Reformer', 'Studio 57'),
      "birthday_message" = replace(replace("birthday_message", 'Pilates Studio', 'Studio 57'), 'Pilates Reformer', 'Studio 57')
  WHERE "welcome_message" ILIKE '%pilates%' OR "birthday_message" ILIKE '%pilates%';

UPDATE "schedule_slot"
  SET "class_name" = 'Studio 57'
  WHERE "class_name" ILIKE 'pilates reformer';

COMMIT;
