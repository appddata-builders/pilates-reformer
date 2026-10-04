-- ---------------------------------------------------------------------------
-- 19 · Todo es Cognito
--
-- Las contraseñas, la identidad y la sesión viven en Cognito (igual que
-- refautomex). better-auth y los IDs de usuario ST salen del proyecto:
--
-- user.cognito_id          `sub` del usuario en el user pool, obligatorio. Se
--                          guarda al dar de alta la cuenta y la sesión se
--                          busca por él (como usuario.cognitoid en refautomex).
-- user.sessions_revoked_at los ID tokens emitidos antes ya no abren sesión:
--                          es el "cerrar todas las sesiones" al inhabilitar
--                          o cambiar la contraseña.
--
-- Los usuarios creados antes no tienen cuenta en Cognito: se borran con lo que
-- depende de ellos (suscripciones, reservas, pagos, notificaciones, nómina de
-- coaches). Planes, horarios, reformers, cupones y configuración se quedan.
-- Después se crea la cuenta root con scripts/cognito-user.ts.
--
-- Idempotente: corrido de nuevo no borra nada, porque ya no puede haber
-- usuarios sin cognito_id.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "cognito_id" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "sessions_revoked_at" timestamp (3);

CREATE TEMP TABLE pre_cognito_user ON COMMIT DROP AS
  SELECT id FROM "user" WHERE cognito_id IS NULL;

-- Explícito y en orden, sin depender de que las FK tengan ON DELETE CASCADE.
DELETE FROM "payment"      WHERE user_id IN (SELECT id FROM pre_cognito_user);
DELETE FROM "booking"      WHERE user_id IN (SELECT id FROM pre_cognito_user);
DELETE FROM "subscription" WHERE user_id IN (SELECT id FROM pre_cognito_user);
DELETE FROM "notification" WHERE user_id IN (SELECT id FROM pre_cognito_user);
DELETE FROM "coach_payroll_period" WHERE coach_id IN (SELECT id FROM pre_cognito_user);
DELETE FROM "studio_event" WHERE related_user_id IN (SELECT id FROM pre_cognito_user);
UPDATE "studio_event" SET created_by = NULL WHERE created_by IN (SELECT id FROM pre_cognito_user);
UPDATE "sale_item"    SET user_id = NULL    WHERE user_id IN (SELECT id FROM pre_cognito_user);

DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "verification";

DELETE FROM "user" WHERE id IN (SELECT id FROM pre_cognito_user);

ALTER TABLE "user" DROP COLUMN IF EXISTS "display_id";
ALTER TABLE "user" DROP COLUMN IF EXISTS "id_prefix";

ALTER TABLE "user" ALTER COLUMN "cognito_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_cognito_id_unique"
    ON "user" USING btree ("cognito_id");

COMMIT;
