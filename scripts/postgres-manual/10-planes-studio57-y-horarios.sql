-- Planes Studio 57 (Equilibrio / Vitalidad + Clase Muestra) y horarios oficiales
-- del estudio en una BD PostgreSQL ya existente.
--   psql "$DATABASE_URL" -f scripts/postgres-manual/10-planes-studio57-y-horarios.sql
--
-- Cada frecuencia de cobro es una fila propia (semanal = 7 días, quincenal = 15,
-- mensual = 30). La landing las agrupa en una sola tarjeta por plan.

BEGIN;

-- ── 1. Clase de Apertura pasa a llamarse Clase Muestra ────────────────────────

UPDATE "plan"
  SET "name" = 'Clase Muestra'
  WHERE "id" = 'plan-apertura';

-- ── 2. Plan Equilibrio (3 clases/semana) y Plan Vitalidad (5 clases/semana) ───

INSERT INTO "plan" ("id","name","plan_type","days_per_week","total_classes","price_mxn","cost_per_class","duration_days","is_active","is_public","is_add_on","is_unlimited","created_at") VALUES
('plan-individual','Clase Individual','class_pack',0,1,140,140,30,true,true,false,false,now()),
('plan-equilibrio-semanal','Plan Equilibrio Semanal','monthly',3,NULL,400,133.33,7,true,true,false,false,now()),
('plan-equilibrio-quincenal','Plan Equilibrio Quincenal','monthly',3,NULL,700,116.67,15,true,true,false,false,now()),
('plan-equilibrio-mensual','Plan Equilibrio Mensual','monthly',3,NULL,1350,112.5,30,true,true,false,false,now()),
('plan-vitalidad-semanal','Plan Vitalidad Semanal','monthly',5,NULL,650,130,7,true,true,false,false,now()),
('plan-vitalidad-quincenal','Plan Vitalidad Quincenal','monthly',5,NULL,1150,115,15,true,true,false,false,now()),
('plan-vitalidad-mensual','Plan Vitalidad Mensual','monthly',5,NULL,2200,110,30,true,true,false,false,now())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "plan_type" = EXCLUDED."plan_type",
  "days_per_week" = EXCLUDED."days_per_week",
  "total_classes" = EXCLUDED."total_classes",
  "price_mxn" = EXCLUDED."price_mxn",
  "cost_per_class" = EXCLUDED."cost_per_class",
  "duration_days" = EXCLUDED."duration_days",
  "is_active" = true,
  "is_public" = true;

-- ── 3. La vitrina pública sólo muestra Clase Muestra, Equilibrio y Vitalidad ──

-- El resto queda oculto, no desactivado: siguen disponibles en el panel y las
-- suscripciones vigentes que los usan no se ven afectadas.
UPDATE "plan"
  SET "is_public" = false
  WHERE "id" NOT IN (
    'plan-apertura',
    'plan-individual',
    'plan-equilibrio-semanal',
    'plan-equilibrio-quincenal',
    'plan-equilibrio-mensual',
    'plan-vitalidad-semanal',
    'plan-vitalidad-quincenal',
    'plan-vitalidad-mensual'
  );

UPDATE "plan"
  SET "is_public" = true
  WHERE "id" IN (
    'plan-apertura',
    'plan-individual',
    'plan-equilibrio-semanal',
    'plan-equilibrio-quincenal',
    'plan-equilibrio-mensual',
    'plan-vitalidad-semanal',
    'plan-vitalidad-quincenal',
    'plan-vitalidad-mensual'
  );

-- ── 4. Horarios del estudio: matutino 07–11 y vespertino 17–21, Lun a Sáb ─────

-- Los horarios fuera de la parrilla oficial se ocultan (no se borran: pueden
-- tener reservas históricas asociadas).
UPDATE "schedule_slot"
  SET "is_active" = false
  WHERE "day_of_week" NOT BETWEEN 1 AND 6
     OR "start_time" NOT IN ('07:00','08:00','09:00','10:00','17:00','18:00','19:00','20:00');

INSERT INTO "schedule_slot" ("id","class_name","instructor","alternate_instructor","schedule_mode","day_of_week","start_time","end_time","capacity","class_type","is_active","created_at")
SELECT
  'slot-d' || d.day_of_week || '-t' || replace(t.start_time, ':', ''),
  'Pilates Reformer',
  CASE WHEN t.start_time < '12:00' THEN 'Elena Morales' ELSE 'Lucía Paredes' END,
  NULL,
  'fixed',
  d.day_of_week,
  t.start_time,
  t.end_time,
  10,
  'reformer',
  true,
  now()
FROM (VALUES (1),(2),(3),(4),(5),(6)) AS d(day_of_week)
CROSS JOIN (VALUES
  ('07:00','08:00'),
  ('08:00','09:00'),
  ('09:00','10:00'),
  ('10:00','11:00'),
  ('17:00','18:00'),
  ('18:00','19:00'),
  ('19:00','20:00'),
  ('20:00','21:00')
) AS t(start_time, end_time)
ON CONFLICT ("id") DO UPDATE SET
  "class_name" = EXCLUDED."class_name",
  "day_of_week" = EXCLUDED."day_of_week",
  "start_time" = EXCLUDED."start_time",
  "end_time" = EXCLUDED."end_time",
  "is_active" = true;

COMMIT;
