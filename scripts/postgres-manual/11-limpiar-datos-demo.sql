-- Deja la BD lista para operación real: borra los datos de demostración y los
-- planes que Studio 57 no ofrece, conservando usuarios reales, configuración,
-- reformers, horarios y los planes de Clase Muestra / Equilibrio / Vitalidad.
--   psql "$DATABASE_URL" -f scripts/postgres-manual/11-limpiar-datos-demo.sql
--
-- Requiere haber aplicado antes 10-planes-studio57-y-horarios.sql.
-- ATENCIÓN: es destructivo e irreversible. Hacer respaldo antes de correrlo.

BEGIN;

-- Usuarios sembrados por 03-seed-fake.sql.
CREATE TEMP TABLE demo_user ON COMMIT DROP AS
  SELECT id FROM "user" WHERE email LIKE '%@demo.pilates.mx';

-- Planes que dejan de existir: todo lo que no sea Clase Muestra, Equilibrio ni Vitalidad.
CREATE TEMP TABLE doomed_plan ON COMMIT DROP AS
  SELECT id FROM "plan" WHERE id NOT IN (
    'plan-apertura',
    'plan-equilibrio-semanal',
    'plan-equilibrio-quincenal',
    'plan-equilibrio-mensual',
    'plan-vitalidad-semanal',
    'plan-vitalidad-quincenal',
    'plan-vitalidad-mensual'
  );

-- Suscripciones que se van: las de usuarios demo y las de cualquier usuario
-- que apunte a un plan que dejará de existir.
CREATE TEMP TABLE doomed_subscription ON COMMIT DROP AS
  SELECT id FROM "subscription"
  WHERE user_id IN (SELECT id FROM demo_user)
     OR plan_id IN (SELECT id FROM doomed_plan);

-- ── 1. Dependencias de esas suscripciones y de los usuarios demo ─────────────

DELETE FROM "refund"
  WHERE subscription_id IN (SELECT id FROM doomed_subscription)
     OR user_id IN (SELECT id FROM demo_user)
     OR processed_by IN (SELECT id FROM demo_user);

DELETE FROM "payment"
  WHERE subscription_id IN (SELECT id FROM doomed_subscription)
     OR user_id IN (SELECT id FROM demo_user);

DELETE FROM "sale_item" WHERE user_id IN (SELECT id FROM demo_user);

DELETE FROM "booking" WHERE user_id IN (SELECT id FROM demo_user);

DELETE FROM "subscription" WHERE id IN (SELECT id FROM doomed_subscription);

-- ── 2. Actividad de demostración sin dueño individual ────────────────────────

DELETE FROM "notification" WHERE user_id IN (SELECT id FROM demo_user);
DELETE FROM "studio_event"
  WHERE related_user_id IN (SELECT id FROM demo_user)
     OR created_by IN (SELECT id FROM demo_user);
DELETE FROM "coach_payroll_period" WHERE coach_id IN (SELECT id FROM demo_user);
DELETE FROM "studio_kpi_snapshot";

-- ── 3. Usuarios demo ─────────────────────────────────────────────────────────

DELETE FROM "session" WHERE user_id IN (SELECT id FROM demo_user);
DELETE FROM "account" WHERE user_id IN (SELECT id FROM demo_user);
DELETE FROM "user" WHERE id IN (SELECT id FROM demo_user);

-- ── 4. Planes que Studio 57 no ofrece ────────────────────────────────────────

DELETE FROM "plan" WHERE id IN (SELECT id FROM doomed_plan);

COMMIT;
