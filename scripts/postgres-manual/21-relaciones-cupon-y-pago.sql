-- ---------------------------------------------------------------------------
-- 21 · subscription.coupon_id y la FK de payment.booking_id
--
-- Correr ANTES de desplegar el código nuevo: el código lee coupon_id. Sólo
-- agrega, así que el código anterior sigue funcionando.
--
-- subscription.coupon_id   el cupón con el que se contrató. Sus usos ya no se
--                          llevan en coupon.used_count: se cuentan los usuarios
--                          con una suscripción que trae el cupón y cuyo cobro
--                          no se anuló (lib/coupons.ts). Las suscripciones de
--                          antes sólo guardaban el código en discount_reason
--                          ('cupon:CODIGO'); se ligan por ahí.
-- payment.booking_id       ya existía sin FK. Borrar un horario borra sus
--                          reservas (deleteSlotAction): el cobro se queda en
--                          el histórico de caja con booking_id en NULL.
--
-- Idempotente: se puede correr varias veces.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "coupon_id" text;

DO $$ BEGIN
 ALTER TABLE "subscription" ADD CONSTRAINT "subscription_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "subscription_coupon_id_idx" ON "subscription" USING btree ("coupon_id");

UPDATE "subscription" s
   SET coupon_id = c.id
  FROM "coupon" c
 WHERE s.coupon_id IS NULL
   AND s.discount_reason = 'cupon:' || c.code;

-- Un booking_id que ya no existe rompería la FK: se limpia antes.
UPDATE "payment" p
   SET booking_id = NULL
 WHERE p.booking_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "booking" b WHERE b.id = p.booking_id);

DO $$ BEGIN
 ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payment_booking_id_idx" ON "payment" USING btree ("booking_id");

COMMIT;
