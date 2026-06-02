# Base de datos — Cabaña El Simbol

Los archivos `*.sql` de esta carpeta **no se suben a Git** (están en `.gitignore`). Conservá una copia local o en un lugar seguro para deploy en Railway.

Un solo script crea la base **`railway`** con todas las tablas y datos iniciales.

## Instalación desde cero

1. En **MySQL Workbench** (o cliente SQL con permisos `CREATE` / `DROP`), ejecutá el archivo completo:

   **`railway_full_schema.sql`**

2. En **`backend/.env`** (y en Railway / producción) configurá:

   ```env
   DB_NAME=railway
   ```

   El resto de variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`) según tu entorno.

3. Reiniciá el backend: `npm run dev`

## Contenido del script

- Usuarios y autenticación
- Cerdas y ciclos productivos
- Vacunación (filas por ciclo + catálogo de protocolo)
- Planilla y catálogo de alimentación
- Inventario de alimentos e ingredientes + fórmulas
- Cierre de mes
- Plantel de engorde (planilla y movimientos)

## Usuario inicial

| Usuario | Contraseña | Rol   |
|---------|------------|-------|
| `admin` | `123123`   | admin |

Solo para desarrollo: cambiá la contraseña en producción.

## Railway (hosting)

Guía completa de deploy: **[../DEPLOY.md](../DEPLOY.md)**

Si la base `railway` ya existe en el panel y **no** tenés permiso para `DROP DATABASE`, comentá las dos primeras líneas del script (`DROP` y `CREATE`) y ejecutá desde `USE railway;` sobre la base vacía que creaste en Railway.

**Post-instalación en producción:** cambiá la contraseña de `admin` con `npm run set-admin-password -- "TuClaveSegura"` (variables `DB_*` o `MYSQL*` apuntando a Railway).

## Nota

El backend **no** crea tablas automáticamente: la estructura la define este script SQL.
