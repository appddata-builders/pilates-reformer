-- ---------------------------------------------------------------------------
-- 20 · booking.trial_class
--
-- Marca la reserva que usó la clase muestra. Al cancelarla, la cortesía
-- regresa (user.trial_class_used_at vuelve a NULL) para usarla en otra fecha.
--
-- Las reservas de antes no lo guardaban: se marca la reserva confirmada sin
-- cobro que se creó junto con la redención (mismo minuto).
--
-- Idempotente: se puede correr varias veces.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "trial_class" boolean DEFAULT false NOT NULL;

UPDATE "booking" b
   SET trial_class = true
  FROM "user" u
 WHERE b.user_id = u.id
   AND u.trial_class_used_at IS NOT NULL
   AND b.trial_class = false
   AND abs(extract(epoch FROM (u.trial_class_used_at - b.created_at))) < 60
   AND NOT EXISTS (SELECT 1 FROM "payment" p WHERE p.booking_id = b.id);

COMMIT;
