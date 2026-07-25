-- PILATES REFORMER — datos fake (17 tablas) en PostgreSQL
-- Requiere schema: 01-schema-completo.sql
--
--   psql "$DATABASE_URL" -f scripts/postgres-manual/03-seed-fake.sql
--
-- Login (usuarios de prueba, no producción):
--   operador@demo.pilates.mx / demo-root-99
--   ricardo.mendez@demo.pilates.mx / demo-admin-99
--   patricia.nunez@demo.pilates.mx / demo-admin-99
--   elena.morales@demo.pilates.mx / demo-coach-99
--   lucia.paredes@demo.pilates.mx / demo-coach-99
--   irene.salazar@demo.pilates.mx / demo-alumno-99  (resto alumnos: mismo pass)

BEGIN;

-- ── 1. user ───────────────────────────────────────────────────────────────────

INSERT INTO "user" ("id","name","email","email_verified","role","phone","display_id","id_prefix","birthdate","notes","enabled","welcome_shown","created_at","updated_at") VALUES
('user-root-demo','Operador Sistema','operador@demo.pilates.mx',true,'root',NULL,NULL,'ST',NULL,NULL,true,true,now(),now()),
('user-admin-demo-1','Ricardo Méndez','ricardo.mendez@demo.pilates.mx',true,'admin','5588001101',NULL,'ST',NULL,NULL,true,true,now(),now()),
('user-admin-demo-2','Patricia Núñez','patricia.nunez@demo.pilates.mx',true,'admin','5588001102',NULL,'ST',NULL,NULL,true,true,now(),now()),
('user-coach-demo-1','Elena Morales','elena.morales@demo.pilates.mx',true,'coach','5588002201',NULL,'ST',NULL,NULL,true,true,now(),now()),
('user-coach-demo-2','Lucía Paredes','lucia.paredes@demo.pilates.mx',true,'coach','5588002202',NULL,'ST',NULL,NULL,true,true,now(),now()),
('user-alum-demo-1','Irene Salazar','irene.salazar@demo.pilates.mx',true,'alumno','5588113301','ST1001','ST','1991-04-12',NULL,true,false,now(),now()),
('user-alum-demo-2','Beatriz Montiel','beatriz.montiel@demo.pilates.mx',true,'alumno','5588113302','ST1002','ST','1987-09-03',NULL,true,false,now(),now()),
('user-alum-demo-3','Luciana Fajardo','luciana.fajardo@demo.pilates.mx',true,'alumno','5588113303','ST1003','ST','1995-01-28',NULL,true,false,now(),now()),
('user-alum-demo-4','Greta Ibáñez','greta.ibanez@demo.pilates.mx',true,'alumno','5588113304','ST1004','ST','1983-11-07',NULL,true,false,now(),now()),
('user-alum-demo-5','Helena Duarte','helena.duarte@demo.pilates.mx',true,'alumno','5588113305','ST1005','ST','1996-08-19',NULL,true,false,now(),now()),
('user-alum-demo-6','Rebeca Toscano','rebeca.toscano@demo.pilates.mx',true,'alumno','5588113306','ST1006','ST','1990-12-01',NULL,true,false,now(),now()),
('user-alum-demo-7','Alma Delgado','alma.delgado@demo.pilates.mx',true,'alumno','5588113307','ST1007','ST','1989-06-25',NULL,true,false,now(),now()),
('user-alum-demo-8','Jimena Solís','jimena.solis@demo.pilates.mx',true,'alumno','5588113308','ST1008','ST','1994-02-14',NULL,true,false,now(),now())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "role" = EXCLUDED."role",
  "display_id" = EXCLUDED."display_id",
  "updated_at" = now();

-- ── 2. account (credential / better-auth scrypt) ─────────────────────────────

INSERT INTO "account" ("id","account_id","provider_id","user_id","password","created_at","updated_at") VALUES
('acc-root-demo','user-root-demo','credential','user-root-demo','cd166214b41e75a2e92d1624caf7afcd:7678dffee3e182813f5b1dc3a037e2a96475283eb01f675818704aba14e82b98722b5de6548dd0d04363df53d9aa72a3b3339afd304745ecbb499f76dca4a864',now(),now()),
('acc-admin-demo-1','user-admin-demo-1','credential','user-admin-demo-1','3874af1bf6fd9566ae729d0d2db59b79:2eaf9fbd118bd5c83a826b05c571f01561d0b371e6b249b0d47b3fa0a11da48f1a236cce8c4e901c5e4ee004c0059588e78bc961c6c1ebf06829955cc2b3630f',now(),now()),
('acc-admin-demo-2','user-admin-demo-2','credential','user-admin-demo-2','3874af1bf6fd9566ae729d0d2db59b79:2eaf9fbd118bd5c83a826b05c571f01561d0b371e6b249b0d47b3fa0a11da48f1a236cce8c4e901c5e4ee004c0059588e78bc961c6c1ebf06829955cc2b3630f',now(),now()),
('acc-coach-demo-1','user-coach-demo-1','credential','user-coach-demo-1','afa4f035bc929e536360ca19ba3a52cf:f74ab849cb03cdf9449a7a54086183d343dce7280e16354868c14ef294f80c275bdaac26cf2a4f19d2f0f85ce965c4c8735233fefd4dc3004e40fa534378ec2c',now(),now()),
('acc-coach-demo-2','user-coach-demo-2','credential','user-coach-demo-2','afa4f035bc929e536360ca19ba3a52cf:f74ab849cb03cdf9449a7a54086183d343dce7280e16354868c14ef294f80c275bdaac26cf2a4f19d2f0f85ce965c4c8735233fefd4dc3004e40fa534378ec2c',now(),now()),
('acc-alum-demo-1','user-alum-demo-1','credential','user-alum-demo-1','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-2','user-alum-demo-2','credential','user-alum-demo-2','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-3','user-alum-demo-3','credential','user-alum-demo-3','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-4','user-alum-demo-4','credential','user-alum-demo-4','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-5','user-alum-demo-5','credential','user-alum-demo-5','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-6','user-alum-demo-6','credential','user-alum-demo-6','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-7','user-alum-demo-7','credential','user-alum-demo-7','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now()),
('acc-alum-demo-8','user-alum-demo-8','credential','user-alum-demo-8','3c65d26e5e7ced6bf4a2ca5b74c71a19:77b24f9cd937e64bae4541a4f586012982a2897bbc7f0007c19f0970af6512c1648fb8fabf51d7b310263c45a16d7c01f9afac90a699d1214d41e9461e4fdc66',now(),now())
ON CONFLICT ("id") DO UPDATE SET "password" = EXCLUDED."password", "updated_at" = now();

-- ── 3. studio_policy ──────────────────────────────────────────────────────────

INSERT INTO "studio_policy" ("id","studio_name","brand_color","max_capacity","cancel_hours","cancel_minutes","alert_last_class_threshold","alert_days_before_expiry","maintenance_mode","updated_at")
VALUES ('main','Pilates Studio','#1b2d6e',10,1,90,2,3,false,now())
ON CONFLICT ("id") DO UPDATE SET "studio_name" = EXCLUDED."studio_name", "updated_at" = now();

-- ── 4. plan ───────────────────────────────────────────────────────────────────

-- Los únicos planes de Studio 57: Clase Muestra y las tres frecuencias de cobro
-- de Equilibrio y Vitalidad (semanal = 7 días, quincenal = 15, mensual = 30).
INSERT INTO "plan" ("id","name","plan_type","days_per_week","total_classes","price_mxn","cost_per_class","duration_days","is_active","is_public","is_add_on","is_unlimited","created_at") VALUES
('plan-apertura','Clase Muestra','class_pack',0,1,0,0,30,true,true,false,false,now()),
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
  "price_mxn" = EXCLUDED."price_mxn",
  "duration_days" = EXCLUDED."duration_days",
  "is_public" = EXCLUDED."is_public",
  "total_classes" = EXCLUDED."total_classes";

-- ── 5. reformer ───────────────────────────────────────────────────────────────

INSERT INTO "reformer" ("id","number","name","is_active","notes") VALUES
('reformer-r1',1,'Reformer 1',true,NULL),
('reformer-r2',2,'Reformer 2',true,NULL),
('reformer-r3',3,'Reformer 3',true,'Mantenimiento reciente'),
('reformer-r4',4,'Reformer 4',true,NULL),
('reformer-r5',5,'Reformer 5',true,NULL),
('reformer-r6',6,'Reformer 6',true,NULL),
('reformer-r7',7,'Reformer 7',true,NULL),
('reformer-r8',8,'Reformer 8',true,NULL)
ON CONFLICT ("id") DO NOTHING;

-- ── 6. schedule_slot ──────────────────────────────────────────────────────────

-- Parrilla oficial del estudio: turno matutino 07–11 y vespertino 17–21,
-- de lunes a sábado (id = slot-d<día>-t<hora>).
INSERT INTO "schedule_slot" ("id","class_name","instructor","alternate_instructor","schedule_mode","day_of_week","start_time","end_time","capacity","class_type","is_active","created_at")
SELECT
  'slot-d' || d.day_of_week || '-t' || replace(t.start_time, ':', ''),
  'Pilates Reformer',
  CASE WHEN t.start_time < '12:00' THEN 'Elena Morales' ELSE 'Lucía Paredes' END,
  CASE WHEN d.day_of_week = 6 AND t.start_time = '08:00' THEN 'Lucía Paredes' END,
  CASE WHEN d.day_of_week = 6 AND t.start_time = '08:00' THEN 'dual' ELSE 'fixed' END,
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
ON CONFLICT ("id") DO UPDATE SET "instructor" = EXCLUDED."instructor", "is_active" = true;

-- ── 7. subscription ───────────────────────────────────────────────────────────

INSERT INTO "subscription" ("id","user_id","plan_id","status","start_date","end_date","classes_remaining","days_used_this_week","is_unlimited","discount_pct","discount_reason","billing_cycle","cost_per_class","paid_amount","created_at") VALUES
('sub-za1001','user-alum-demo-1','plan-equilibrio-mensual','active',now() - interval '10 days',now() + interval '20 days',NULL,1,false,NULL,NULL,'mensual',112.5,1350,now()),
('sub-za1002','user-alum-demo-2','plan-vitalidad-quincenal','active',now() - interval '5 days',now() + interval '10 days',NULL,0,false,NULL,NULL,'quincenal',115,1150,now()),
('sub-za1003','user-alum-demo-3','plan-vitalidad-mensual','active',now() - interval '15 days',now() + interval '15 days',NULL,2,false,0.10,'evento_especial','mensual',99,1980,now()),
('sub-za1004','user-alum-demo-4','plan-equilibrio-quincenal','active',now() - interval '3 days',now() + interval '12 days',NULL,2,false,NULL,NULL,'quincenal',116.67,700,now()),
('sub-za1005','user-alum-demo-5','plan-apertura','active',now() - interval '20 days',now() + interval '10 days',0,0,false,NULL,NULL,'efectivo',0,0,now()),
('sub-za1006','user-alum-demo-6','plan-vitalidad-semanal','active',now() - interval '3 days',now() + interval '4 days',NULL,1,false,NULL,NULL,'semanal',130,650,now()),
('sub-za1007','user-alum-demo-7','plan-equilibrio-mensual','cancelled',now() - interval '40 days',now() - interval '10 days',0,0,false,NULL,NULL,'mensual',112.5,1350,now()),
('sub-expired-demo','user-alum-demo-8','plan-equilibrio-semanal','active',now() - interval '45 days',now() - interval '5 days',NULL,0,false,NULL,NULL,'semanal',133.33,400,now())
ON CONFLICT ("id") DO UPDATE SET
  "end_date" = EXCLUDED."end_date",
  "classes_remaining" = EXCLUDED."classes_remaining",
  "status" = EXCLUDED."status";

-- ── 8. payment ────────────────────────────────────────────────────────────────

INSERT INTO "payment" ("id","user_id","subscription_id","amount","currency","method","status","concept","collected_by","is_negative","created_at") VALUES
('pay-za1001','user-alum-demo-1','sub-za1001',1350,'MXN','transferencia','succeeded','Inscripción: Plan Equilibrio Mensual','Patricia',false,now() - interval '10 days'),
('pay-za1002','user-alum-demo-2','sub-za1002',1150,'MXN','efectivo','succeeded','Inscripción: Plan Vitalidad Quincenal','Lucía',false,now() - interval '5 days'),
('pay-za1003','user-alum-demo-3','sub-za1003',1980,'MXN','transferencia','succeeded','Inscripción: Plan Vitalidad Mensual (10% desc.)','Ricardo',false,now() - interval '15 days'),
('pay-za1004','user-alum-demo-4','sub-za1004',700,'MXN','transferencia','succeeded','Inscripción: Plan Equilibrio Quincenal','Patricia',false,now() - interval '3 days'),
('pay-za1005','user-alum-demo-5','sub-za1005',0,'MXN','efectivo','succeeded','Clase Muestra','Elena',false,now() - interval '20 days'),
('pay-za1006','user-alum-demo-6','sub-za1006',650,'MXN','transferencia','succeeded','Plan Vitalidad Semanal','Ricardo',false,now() - interval '3 days'),
('pay-expired-demo','user-alum-demo-8','sub-expired-demo',400,'MXN','efectivo','succeeded','Plan Equilibrio Semanal (vencido demo)','Lucía',false,now() - interval '45 days'),
('pay-egreso-limpieza','user-admin-demo-1',NULL,-500,'MXN','efectivo','succeeded','Limpieza profunda estudio','Patricia',true,now()),
('pay-egreso-dhl','user-admin-demo-1',NULL,-370,'MXN','transferencia','succeeded','Envío DHL insumos','Ricardo',true,now())
ON CONFLICT ("id") DO UPDATE SET "amount" = EXCLUDED."amount";

-- ── 9. booking ────────────────────────────────────────────────────────────────

INSERT INTO "booking" ("id","user_id","schedule_slot_id","booking_date","status","attended","counted_as_attended","cancelled_at","notes","reformer_number","created_at") VALUES
('booking-fake-001','user-alum-demo-1','slot-d1-t0700',(current_date - 7) + time '12:00','confirmed',true,true,NULL,'Primera clase',1,now()),
('booking-fake-002','user-alum-demo-2','slot-d2-t0700',(current_date - 5) + time '12:00','confirmed',true,true,NULL,NULL,2,now()),
('booking-fake-003','user-alum-demo-3','slot-d3-t1000',(current_date - 3) + time '12:00','confirmed',false,false,NULL,'No asistió',3,now()),
('booking-fake-004','user-alum-demo-4','slot-d4-t1700',(current_date - 2) + time '12:00','confirmed',true,true,NULL,NULL,4,now()),
('booking-fake-005','user-alum-demo-5','slot-d5-t1900',(current_date - 1) + time '12:00','cancelled',NULL,false,now(),'Canceló tarde',NULL,now()),
('booking-fake-006','user-alum-demo-6','slot-d6-t0800',(current_date - 4) + time '12:00','confirmed',true,true,NULL,NULL,5,now()),
('booking-fake-007','user-alum-demo-1','slot-d1-t1900',(current_date + 2) + time '12:00','confirmed',NULL,false,NULL,'Reserva futura',6,now())
ON CONFLICT ("id") DO NOTHING;

-- ── 10. sale_item ─────────────────────────────────────────────────────────────

INSERT INTO "sale_item" ("id","sale_date","concept","concept_type","quantity","unit_price","total_amount","method","collected_by","user_id","created_at") VALUES
('sale-fake-calcetas',now() - interval '2 days','Calcetas antiderrapantes','calcetas',2,120,240,'efectivo','Elena','user-alum-demo-1',now()),
('sale-fake-privada',now() - interval '2 days','Clase privada 1:1','clase_privada',1,500,500,'transferencia','Lucía','user-alum-demo-2',now())
ON CONFLICT ("id") DO NOTHING;

-- ── 11. refund ────────────────────────────────────────────────────────────────

INSERT INTO "refund" ("id","user_id","subscription_id","classes_total","classes_used","classes_refunded","cost_per_class","total_paid","refund_amount","reason","refund_date","processed_by","created_at") VALUES
('refund-fake-001','user-alum-demo-7','sub-za1007',12,9,3,112.5,1350,337.5,'Baja anticipada — 3 clases sin usar',now(),'user-admin-demo-1',now())
ON CONFLICT ("id") DO NOTHING;

-- ── 12. coach_payroll_period ──────────────────────────────────────────────────

INSERT INTO "coach_payroll_period" ("id","coach_id","period_start","period_end","classes_count","rate_per_class","total_amount","is_paid","paid_at","created_at") VALUES
('payroll-coach-demo-1','user-coach-demo-1','2026-05-01','2026-05-31',18,250,4500,true,now(),now()),
('payroll-coach-demo-2','user-coach-demo-2','2026-05-01','2026-05-31',22,250,5500,false,NULL,now())
ON CONFLICT ("id") DO NOTHING;

-- ── 13. studio_kpi_snapshot ───────────────────────────────────────────────────

INSERT INTO "studio_kpi_snapshot" ("id","period_label","period_start","period_end","total_classes","total_attendances","occupancy_rate","active_members","renewals","new_enrollments","cancellations","target_occupancy","created_at") VALUES
('kpi-2026-01','Enero 2026','2026-01-01','2026-01-31',120,98,0.82,42,8,5,2,0.85,now()),
('kpi-2026-02','Febrero 2026','2026-02-01','2026-02-28',128,105,0.84,45,10,6,1,0.85,now()),
('kpi-2026-03','Marzo 2026','2026-03-01','2026-03-31',132,110,0.86,48,12,7,3,0.85,now())
ON CONFLICT ("id") DO NOTHING;

-- ── 14. studio_event ──────────────────────────────────────────────────────────

INSERT INTO "studio_event" ("id","title","description","event_type","start_date","end_date","all_day","color","related_user_id","created_by","visible_to","created_at") VALUES
('event-fake-taller','Taller movilidad de cadera','Sesión especial sábado','workshop',now() + interval '7 days',NULL,false,'#0D4714',NULL,'user-admin-demo-1','admin',now()),
('event-fake-cumple','Cumpleaños Irene Salazar','Recordatorio equipo','birthday',now() + interval '2 days',now() + interval '2 days',true,'#3b82f6','user-alum-demo-1','user-admin-demo-2','admin',now())
ON CONFLICT ("id") DO NOTHING;

-- ── 15. notification ──────────────────────────────────────────────────────────

INSERT INTO "notification" ("id","user_id","type","title","body","is_read","created_at") VALUES
('notif-fake-expiry','user-alum-demo-5','plan_expiry','Plan por vencer','Tu plan vence en 3 días. Renueva para seguir reservando.',false,now()),
('notif-fake-birthday','user-alum-demo-3','birthday','¡Feliz cumpleaños!','El estudio te desea un excelente día.',true,now()),
('notif-fake-last-class','user-alum-demo-5','last_class','Última clase del paquete','Te queda 1 clase en tu plan actual.',false,now())
ON CONFLICT ("id") DO NOTHING;

-- ── 16. verification ───────────────────────────────────────────────────────────

INSERT INTO "verification" ("id","identifier","value","expires_at","created_at","updated_at") VALUES
('verification-fake-demo','luciana.fajardo@demo.pilates.mx','000000',now() + interval '24 hours',now(),now())
ON CONFLICT ("id") DO UPDATE SET "expires_at" = EXCLUDED."expires_at";

-- ── 17. session (demo; no usar para login real) ───────────────────────────────

INSERT INTO "session" ("id","expires_at","token","created_at","updated_at","ip_address","user_agent","user_id") VALUES
('session-fake-admin',now() + interval '7 days','fake-demo-token-admin-not-for-login',now(),now(),'127.0.0.1','postgres-manual-seed','user-admin-demo-1')
ON CONFLICT ("id") DO UPDATE SET "expires_at" = EXCLUDED."expires_at";

COMMIT;

-- Resumen
SELECT 'user' AS tabla, count(*)::int AS filas FROM "user"
UNION ALL SELECT 'account', count(*) FROM "account"
UNION ALL SELECT 'verification', count(*) FROM "verification"
UNION ALL SELECT 'plan', count(*) FROM "plan"
UNION ALL SELECT 'reformer', count(*) FROM "reformer"
UNION ALL SELECT 'schedule_slot', count(*) FROM "schedule_slot"
UNION ALL SELECT 'subscription', count(*) FROM "subscription"
UNION ALL SELECT 'booking', count(*) FROM "booking"
UNION ALL SELECT 'payment', count(*) FROM "payment"
UNION ALL SELECT 'sale_item', count(*) FROM "sale_item"
UNION ALL SELECT 'refund', count(*) FROM "refund"
UNION ALL SELECT 'coach_payroll_period', count(*) FROM "coach_payroll_period"
UNION ALL SELECT 'studio_kpi_snapshot', count(*) FROM "studio_kpi_snapshot"
UNION ALL SELECT 'studio_policy', count(*) FROM "studio_policy"
UNION ALL SELECT 'studio_event', count(*) FROM "studio_event"
UNION ALL SELECT 'notification', count(*) FROM "notification"
UNION ALL SELECT 'session', count(*) FROM "session"
ORDER BY tabla;

