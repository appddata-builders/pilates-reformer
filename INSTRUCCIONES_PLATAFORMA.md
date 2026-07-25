# Guía de acceso — Pilates Reformer (Appstract)

**Versión:** Demostración · datos fake de `scripts/postgres-manual/03-seed-fake.sql` (mayo 2026)

---

## Bienvenida

Esta guía explica cómo entrar y explorar el **sistema de gestión** con los datos de prueba actuales del proyecto **@appstract/pilates-reformer**.

Pueden hacer clic, crear cambios de prueba y salir cuando gusten. Es reversible: los datos viven en la base de datos de demo, no en producción real.

> El **landing** (`/`) muestra la marca **Studio 57 · Pilates reformer** (demo de producto Appstract).  
> Tras cargar el seed, el **dashboard** usa el nombre de estudio **Pilates Studio** (configuración en `studio_policy`).

---

## Cómo entrar al sistema

### Desarrollo local

1. Abran Chrome, Safari o Edge.
2. Vayan a **http://localhost:3000**
3. Entren al panel: **http://localhost:3000/login**
4. Escriban **correo** y **contraseña** de las tablas de abajo.
5. Pulsen **Entrar** → los lleva al **Dashboard**.

### Producción / staging (PostgreSQL)

Si el equipo desplegó la app en internet, usen la URL que les compartieron (misma ruta `/login`).

Servidor de base de datos de referencia (ver `docs/DATABASE.md`):

| Campo   | Valor           |
|---------|-----------------|
| Host    | `159.203.90.92` |
| Puerto  | `5432`          |
| Base    | `pilates`       |
| Usuario | `postgres`      |

**Cargar datos fake (una vez, con `.env.local` configurado):**

```bash
npm run db:pg:schema   # solo si la BD está vacía
npm run db:pg:seed
npm run db:pg:check
npm run dev
```

> Si ya estaban logueados con otra cuenta, usen **Cerrar sesión** en el menú superior antes de probar otro perfil.

---

## Cuentas de prueba

Todas las contraseñas son **solo para demostración**. No las usen en la vida real ni las compartan fuera del equipo.

### Operador (acceso total — root)

| Nombre en pantalla | Correo | Contraseña |
|-------------------|--------|------------|
| Operador Sistema | `operador@demo.pilates.mx` | `demo-root-99` |

### Administración (recomendado para explorar el estudio)

| Nombre | Correo | Contraseña | Teléfono demo |
|--------|--------|------------|---------------|
| Ricardo Méndez | `ricardo.mendez@demo.pilates.mx` | `demo-admin-99` | 5588001101 |
| Patricia Núñez | `patricia.nunez@demo.pilates.mx` | `demo-admin-99` | 5588001102 |

### Coaches (vista de instructora)

| Nombre | Correo | Contraseña | Teléfono demo |
|--------|--------|------------|---------------|
| Elena Morales | `elena.morales@demo.pilates.mx` | `demo-coach-99` | 5588002201 |
| Lucía Paredes | `lucia.paredes@demo.pilates.mx` | `demo-coach-99` | 5588002202 |

### Alumnas (clientas — todas usan la misma contraseña)

| Nombre | Correo | ID en sistema | Contraseña |
|--------|--------|---------------|------------|
| Irene Salazar | `irene.salazar@demo.pilates.mx` | **ST1001** | `demo-alumno-99` |
| Beatriz Montiel | `beatriz.montiel@demo.pilates.mx` | **ST1002** | `demo-alumno-99` |
| Luciana Fajardo | `luciana.fajardo@demo.pilates.mx` | **ST1003** | `demo-alumno-99` |
| Greta Ibáñez | `greta.ibanez@demo.pilates.mx` | **ST1004** | `demo-alumno-99` |
| Helena Duarte | `helena.duarte@demo.pilates.mx` | **ST1005** | `demo-alumno-99` |
| Rebeca Toscano | `rebeca.toscano@demo.pilates.mx` | **ST1006** | `demo-alumno-99` |
| Alma Delgado | `alma.delgado@demo.pilates.mx` | **ST1007** | `demo-alumno-99` |
| Jimena Solís | `jimena.solis@demo.pilates.mx` | **ST1008** | `demo-alumno-99` |

> Prefijo de folios: **ST** (ej. ST1001).

---

## Configuración del estudio (seed)

| Campo | Valor demo |
|-------|------------|
| Nombre | Pilates Studio |
| Color de marca | `#1b2d6e` |
| Aforo máximo por clase | 8 |
| Horas para cancelar | 12 |
| Alerta última clase | 2 clases restantes |
| Alerta vencimiento | 3 días antes |

---

## Planes cargados en la demo

| Plan | Tipo | Clases | Vigencia | Precio (MXN) |
|------|------|--------|----------|--------------|
| Clase Muestra | Paquete | 1 | 30 días | $0 |
| Plan Equilibrio Semanal | Mensual | 3 por semana | 7 días | $400 |
| Plan Equilibrio Quincenal | Mensual | 3 por semana | 15 días | $700 |
| Plan Equilibrio Mensual | Mensual | 3 por semana | 30 días | $1,350 |
| Plan Vitalidad Semanal | Mensual | 5 por semana | 7 días | $650 |
| Plan Vitalidad Quincenal | Mensual | 5 por semana | 15 días | $1,150 |
| Plan Vitalidad Mensual | Mensual | 5 por semana | 30 días | $2,200 |

**Equilibrio** se practica Lunes, Miércoles y Viernes · Martes, Jueves y Sábado;
**Vitalidad**, de lunes a viernes.

Cada frecuencia de cobro es un plan propio en la BD. En la landing, Equilibrio y
Vitalidad se muestran como **una sola tarjeta con foto** donde se elige la
frecuencia (Semanal · Quincenal · Mensual) — al cambiarla se recalculan las clases
incluidas y **Adquirir Plan** lleva a esa frecuencia. La **Clase Muestra** va
aparte, en una barra sin foto justo debajo de las tarjetas.

---

## Suscripciones de ejemplo (alumnas)

| Alumna | ID | Plan activo | Notas demo |
|--------|-----|-------------|------------|
| Irene Salazar | ST1001 | Plan Equilibrio Mensual | 1 día usado esta semana |
| Beatriz Montiel | ST1002 | Plan Vitalidad Quincenal | Cobro quincenal en efectivo |
| Luciana Fajardo | ST1003 | Plan Vitalidad Mensual | 10% descuento demo |
| Greta Ibáñez | ST1004 | Plan Equilibrio Quincenal | 2 días usados esta semana |
| Helena Duarte | ST1005 | Clase Muestra | 0 clases (muestra ya tomada) |
| Rebeca Toscano | ST1006 | Plan Vitalidad Semanal | Renovación semanal |
| Alma Delgado | ST1007 | Plan Equilibrio Mensual (cancelada) | Membresía cancelada + devolución demo |
| Jimena Solís | ST1008 | Plan Equilibrio Semanal | Plan vencido (alertas de vencimiento) |

---

## Horarios de clase (seed)

Coaches en turnos: **Elena Morales** y **Lucía Paredes**. Clase: **Pilates Reformer**, capacidad **8**.

Parrilla completa de **lunes a sábado** (48 horarios), en los dos turnos del estudio:

| Turno Matutino | Turno Vespertino |
|----------------|------------------|
| 07:00–08:00 | 17:00–18:00 |
| 08:00–09:00 | 18:00–19:00 |
| 09:00–10:00 | 19:00–20:00 |
| 10:00–11:00 | 20:00–21:00 |

Matutino a cargo de **Elena Morales** y vespertino de **Lucía Paredes**; el sábado
08:00–09:00 queda en modo **dual** (Elena + Lucía).

**Reformers:** 8 máquinas activas (Reformer 1–8; la 3 tiene nota de mantenimiento reciente).

---

## Reservas, pagos y extras de demo

- **7 reservas** de ejemplo (asistidas, no asistidas, canceladas y una futura).
- **Pagos:** inscripciones por transferencia/efectivo; dos egresos (limpieza −$500, DHL −$370).
- **Ventas:** calcetas antiderrapantes, clase privada 1:1.
- **Devolución:** Alma Delgado — 3 clases reembolsadas ($337.50).
- **Nómina coaches:** Elena pagada; Lucía pendiente (mayo 2026).
- **KPIs:** snapshots Enero–Marzo 2026.
- **Eventos:** taller movilidad de cadera; cumpleaños Irene Salazar.
- **Notificaciones:** plan por vencer (Helena), cumpleaños (Luciana), última clase (Helena).

---

## Qué pueden probar por rol

### Con **admin** (`ricardo.mendez@demo.pilates.mx` o `patricia.nunez@demo.pilates.mx`)

| Sección del menú | Qué verán |
|------------------|-----------|
| **Dashboard** | Resumen, métricas y gráfica de reservas |
| **Usuarios** | Lista con IDs ST1001…ST1008 y detalle por alumna |
| **Clases** | Horarios y tipos (Reformer) |
| **Reservas** | Citas de la semana de demostración |
| **Pagos** | Cobros y egresos de ejemplo |
| **Suscripciones** | Membresías ligadas a las alumnas del seed |
| **Planes** | Tabla de planes de la sección anterior |
| **Coaches** | Elena y Lucía |
| **Calendario** | Vista de calendario (FullCalendar) |
| **Reportes** | Métricas y aforo |
| **Devoluciones** | Devolución de Alma Delgado |
| **Histórico** | Actividad pasada |
| **Configuración** | Nombre **Pilates Studio**, capacidad, políticas |

### Con **root** (`operador@demo.pilates.mx`)

Mismo menú que administración, con permisos de operador del sistema.

### Con **coach** (`elena.morales@demo.pilates.mx` o `lucia.paredes@demo.pilates.mx`)

- **Dashboard**
- **Mi Horario**
- **Reservas**
- **Calendario**
- **Asistencia**
- **Histórico**

### Con **alumna** (por ejemplo `irene.salazar@demo.pilates.mx`)

Experiencia de clienta: perfil, reservas y plan **Equilibrio Mensual** asignado en la demo.

---

## Landing Appstract (`/`)

Fuera del login, el landing de producto incluye:

- Hero con **Continuar configuración** y **horario semanal** (grilla Lun–Sáb, burbuja inscritos/aforo).
- Planes **Studio 57** (Equilibrio y Vitalidad con selector de frecuencia, más la Clase Muestra) — se leen de la tabla `plan`, con botón **Adquirir Plan**.
- Sección **Horarios** (bloques matutino / vespertino).
- Sección **Agenda** (reserva rápida por bloques).
- Cobros, membresías y contacto de demostración.

---

## Sobre los nombres y los datos

- **Ricardo, Patricia, Elena, Lucía, Irene, Beatriz…** son personas **inventadas** para la demo.
- **Planes y precios** son los de **Studio 57**: el landing los lee de la misma tabla `plan` que administra el estudio, así que cualquier cambio desde **Dashboard → Planes** se refleja en la vitrina pública.
- Los códigos **ST1001–ST1008** muestran cómo se verán los folios cuando el estudio use datos reales.

---

## Si algo no funciona

- Verifiquen el correo **tal cual** (minúsculas, dominio `@demo.pilates.mx`).
- Sin seed no hay usuarios: ejecuten `npm run db:pg:seed` (PostgreSQL) o `npm run db:push:local` (SQLite local con `DB_DRIVER=sqlite`).
- Prueben otra pestaña o **Cerrar sesión** antes de cambiar de rol.
- Conexión PostgreSQL: `npm run db:pg:check` y revisar `.env.local` (ver `docs/DATABASE.md`).

---

*Documento generado para la demo @appstract/pilates-reformer. Datos alineados con `scripts/postgres-manual/03-seed-fake.sql`.*
