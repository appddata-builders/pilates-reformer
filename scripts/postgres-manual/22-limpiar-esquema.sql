-- ---------------------------------------------------------------------------
-- 22 · Tablas y columnas que nada usa
--
-- Correr DESPUÉS de desplegar el código nuevo: el anterior todavía las lee.
--
-- reformer, booking.reformer_number   ningún código los leía ni los escribía;
--                                     el cupo vive en schedule_slot.capacity.
-- studio_kpi_snapshot                 nadie generaba snapshots; Reportes
--                                     calcula todo en vivo.
-- coupon.used_count                   los usos se cuentan desde las
--                                     suscripciones (21-relaciones-cupon-y-pago).
-- studio_policy:
--   cancel_hours                      duplicaba cancel_minutes.
--   coach_rate_per_class,
--   cost_per_class_base               ni pantalla ni código.
--   total_reformers                   Reportes ya suma el cupo de cada horario.
--   max_capacity, max_bookings_per_day,
--   booking_window_days, late_cancel_penalty,
--   no_show_penalty, brand_color,
--   maintenance_mode                  se guardaban en Configuración, pero
--                                     ninguna regla los aplicaba.
--
-- Idempotente: se puede correr varias veces.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TABLE IF EXISTS "reformer";
DROP TABLE IF EXISTS "studio_kpi_snapshot";

ALTER TABLE "booking" DROP COLUMN IF EXISTS "reformer_number";

ALTER TABLE "coupon" DROP COLUMN IF EXISTS "used_count";

ALTER TABLE "studio_policy"
  DROP COLUMN IF EXISTS "cancel_hours",
  DROP COLUMN IF EXISTS "coach_rate_per_class",
  DROP COLUMN IF EXISTS "cost_per_class_base",
  DROP COLUMN IF EXISTS "total_reformers",
  DROP COLUMN IF EXISTS "max_capacity",
  DROP COLUMN IF EXISTS "max_bookings_per_day",
  DROP COLUMN IF EXISTS "booking_window_days",
  DROP COLUMN IF EXISTS "late_cancel_penalty",
  DROP COLUMN IF EXISTS "no_show_penalty",
  DROP COLUMN IF EXISTS "brand_color",
  DROP COLUMN IF EXISTS "maintenance_mode";

COMMIT;
