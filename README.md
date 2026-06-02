# Backend - Cabaña El Simbol

Backend profesional base para autenticacion con `Node.js`, `Express` y `MySQL`.

## Estructura

```txt
backend/
  database/
    railway_full_schema.sql
    README.md
  src/
    config/
    controllers/
    routes/
    services/
    models/
    middlewares/
    utils/
    validations/
    constants/
    app.js
    server.js
  .env
  .env.example
  package.json
```

## Requisitos

- Node.js 18+
- MySQL 8+

## Configuracion

1. Copiar variables de entorno:

```bash
cp .env.example .env
```

2. Ajustar credenciales de MySQL en `.env`.
3. Ejecutar en MySQL Workbench el script único `database/railway_full_schema.sql` (ver `database/README.md`). La base se llama **`railway`** y debe coincidir con `DB_NAME` en `.env`.

## Scripts

- `npm run dev`: desarrollo con nodemon
- `npm start`: produccion
- `npm run check`: chequeo de sintaxis de arranque

## Endpoints base

- `GET /api/health`
- `POST /api/auth/register` (solo si `ALLOW_PUBLIC_REGISTER=true`; siempre crea rol `user`)
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout` (requiere access token)
- `GET /api/auth/me` (requiere access token)
- `GET /api/admin/ping` (requiere rol `admin`)

### Cerdas / planillas productivas (requieren access token)

- `GET /api/sows` — listado resumido. Query opcional: `?number=` (búsqueda parcial por Nº).
- `GET /api/sows/:sowId` — planilla completa con ciclos.
- `POST /api/sows` — crear planilla (cuerpo: `number`, fechas, `breed`, `cycles` opcional).
- `PUT /api/sows/:sowId` — reemplazar cabecera y ciclos (el `id` del cuerpo debe coincidir con la ruta).

## Notas de seguridad incluidas

- Hash de password con `bcryptjs`
- Hash de refresh token almacenado en DB
- `helmet`, `cors`, rate limit global y en `/auth`
- Validaciones con `zod`
- Middleware central de errores (mensajes genéricos en producción)
- Registro público deshabilitado por defecto (`ALLOW_PUBLIC_REGISTER=false`)
- En producción: secretos JWT obligatorios y `FRONTEND_URL` requerido
