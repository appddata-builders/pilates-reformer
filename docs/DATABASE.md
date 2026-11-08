# Base de datos — Studio 57

## PostgreSQL remoto (producción / staging)

Servidor DataGrip / JDBC:

| Campo    | Valor              |
|----------|--------------------|
| Host     | `159.203.90.92`    |
| Puerto   | `5432`             |
| Base     | `pilates`          |
| Usuario  | `postgres`         |

### 1. Configurar `.env.local`

Copia `.env.example` a `.env.local` y sustituye `TU_PASSWORD_AQUI` por la contraseña real de `postgres` en las dos variables:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`

Ejemplo:

```
DATABASE_URL=postgresql://postgres:mi_clave@159.203.90.92:5432/pilates
```

No definas `DB_DRIVER=sqlite` si quieres usar PostgreSQL (es solo para desarrollo offline).

### 2. Crear tablas (BD vacía)

```bash
npm run db:pg:schema
```

O desde DataGrip / psql: ejecutar `scripts/postgres-manual/01-schema-completo.sql`.

### 3. Datos de prueba (opcional)

```bash
npm run db:pg:seed
```

### 4. Verificar conexión

```bash
npm run db:pg:check
```

### 5. Vaciar datos (solo pruebas)

El script `npm run db:pg:reset` borra **todos los datos** y deja el esquema. Está bloqueado contra producción.

Requiere ambas variables y que `DB_RESET_CONFIRM` sea el nombre exacto de la base en `DATABASE_URL`:

```bash
ALLOW_DB_RESET=1 DB_RESET_CONFIRM=pilates_demo npm run db:pg:reset
```

Para vaciar y volver a cargar el seed de demo:

```bash
ALLOW_DB_RESET=1 DB_RESET_CONFIRM=pilates_demo npm run db:pg:reset -- --seed
```

No se puede usar contra la base `pilates` ni contra hosts de producción salvo que el nombre de BD termine en `_test`, `_demo`, `_staging` o `_dev`.

SQLite local:

```bash
ALLOW_DB_RESET=1 DB_RESET_CONFIRM=local.db npm run db:reset:local
npm run db:push:local
```

### 6. Arrancar la app

```bash
npm run dev
```

## Usuarios demo (después del seed)

| Email | Contraseña |
|-------|------------|
| operador@demo.pilates.mx | demo-root-99 |
| ricardo.mendez@demo.pilates.mx | demo-admin-99 |
| elena.morales@demo.pilates.mx | demo-coach-99 |
| irene.salazar@demo.pilates.mx | demo-alumno-99 |

## SQLite local (sin servidor)

En `.env.local`:

```
DB_DRIVER=sqlite
```

```bash
npm run db:push:local
npm run dev
```

## Esquema Drizzle

- PostgreSQL: `lib/db/schema.pg.ts` (espejo de `scripts/postgres-manual/01-schema-completo.sql`)
- SQLite: `lib/db/schema.sqlite.ts`
