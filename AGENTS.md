# Guía para Agentes de IA - ERP Amados

**Descripción rápida**: Monolith modular con arquitectura dirigida por eventos. Backend API (Node/TypeScript/Express/MongoDB) + Frontend (React/Vite). Cada módulo de negocio (proyectos, stock, contabilidad) publica eventos que se procesan centralmente.

## 📋 Comandos Clave

### Backend
```bash
cd backend
npm run dev          # Hot-reload dev server (Puerto 4000)
npm run build        # TypeScript → dist/
npm run lint         # ESLint check
npm run typecheck    # TypeScript sin emitir
```

### Frontend
```bash
cd frontend
npm run dev          # Vite dev server (Puerto 5173)
npm run build        # Build optimizado
npm run lint         # ESLint check
npm run preview      # Preview local del build
```

## 🏗️ Estructura & Stack

| Capa | Tecnología | Patrón |
|------|-----------|--------|
| **Frontend** | React 19 + React Router v6 + Vite + Sass | Page-per-module, Context API para Auth |
| **Backend API** | Express 5.2 + TypeScript (ES2022, strict) | Modular routes, Service layer, Zod validation |
| **Base de datos** | MongoDB 9.6 (Mongoose) | Append-only journals, Soft delete (isActive), Auditable |
| **Auth** | JWT (access/refresh) + Bcrypt | Cookies para refresh, Auto-refresh en 401 |
| **Inter-módulos** | EventBus interno pub/sub | Accounting escucha eventos de otros módulos |

**Validación de entrada**: Zod schemas por operación (create, update, list). TypeScript `inferType` para tipos.

## 🔑 Convenciones de Código

### Nombrado
- **Models/Types**: `PascalCase` → `Project`, `JournalEntry`, `AuthUser`
- **Constantes**: `UPPER_SNAKE_CASE` → `PROJECT_STATUSES`, `ROLES`
- **Funciones/métodos**: `camelCase` → `createProject()`, `listProjects()`
- **Componentes React**: `PascalCase.tsx` → `ProjectsPage.tsx`

### TypeScript
- **Strict mode** activado: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Target**: ES2022
- Todos los archivos `.ts` o `.tsx` en `backend/src/**` y `frontend/src/**`

### Error Handling
```typescript
// Backend: Usa el patrón IIFE con .catch(next)
(async () => {
  const result = await service.doSomething();
  res.json(result);
}).catch(next);  // Propaga a error-handler.middleware.ts

// El middleware convierte a AppError con statusCode
```

### Auditoría
Todos los modelos incluyen:
- `createdBy`, `updatedBy` (usuarioId)
- `createdAt`, `updatedAt` (timestamps)
- `deletedAt` (soft delete)
- `isActive` (bool, para queryear activos)

## 🎯 Patrones del Dominio

### Ciclo de Vida: Proyecto
Estados: `CONSULTA` → `PRESUPUESTADO` → `APROBADO` → `CONTRATADO` → `EN_EJECUCIÓN` → `PAUSADO` → `REANUDADO` → `FACTURADO` → `FINALIZADO`

**Trigger de eventos**:
1. Presupuesto aprobado → Evento `presupuesto_aprobado`
2. Accounting escucha → Crea asiento en JournalEntry (append-only)
3. Compra recibida → Stock ingresa materiales + evento `compra_recibida`

### EventBus Interno
```typescript
// Publicar evento (desde cualquier módulo)
await eventBus.publish({
  type: 'presupuesto_aprobado',
  aggregateId: budgetId,
  data: { presupuestoId, monto, ... }
});

// Escuchar (módulo accounting)
eventBus.subscribe('presupuesto_aprobado', async (event) => {
  // → Crear JournalEntry automática
});
```

### Respuesta API Estándar
```json
{ "ok": true, "data": { ...resultado } }
{ "ok": false, "error": "Mensaje de error", "statusCode": 400 }
```

### HTTP Client (Frontend)
[src/services/http.ts](src/services/http.ts): Axios interceptor que:
- Detecta 401 (token expirado)
- Auto-llama a `/api/v1/auth/refresh`
- Reintenta request original con token nuevo
- Excluye auth endpoints de reintentos infinitos

## ⚙️ Configuración & Variables de Entorno

### Backend: `backend/.env`
```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/erp_amados
JWT_ACCESS_SECRET=change-me-access-secret-min-16
JWT_REFRESH_SECRET=change-me-refresh-secret-min-16
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
DASHBOARD_ALERTS_SCHEDULER_ENABLED=true
DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES=15
```

### Frontend: `frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

**Bootstrap automático**: Base de datos, plan de cuentas, event handlers, scheduler.

## 📁 Rutas API Principales

```
POST   /api/v1/auth/bootstrap-admin       (primer usuario)
POST   /api/v1/auth/login                 ({ email, password })
POST   /api/v1/auth/refresh               (con refresh cookie)
GET    /api/v1/auth/logout

POST   /api/v1/projects                   (crear)
GET    /api/v1/projects?page=1            (listar + paginación)
GET    /api/v1/projects/:id               (detalle)
PATCH  /api/v1/projects/:id/status        ({ status, reason })

GET    /api/v1/accounting/journal         (asientos contables)
GET    /api/v1/accounting/accounts        (plan de cuentas)

GET    /api/v1/dashboard/alerts           (KPIs + alertas)
```

## 🔄 Flujo de Desarrollo Común

### Agregar un nuevo módulo
1. Crear `backend/src/modules/nombre-modulo/`
   - `nombre-modulo.model.ts` (Mongoose schema)
   - `nombre-modulo.schemas.ts` (Zod para input)
   - `nombre-modulo.service.ts` (lógica de negocio)
   - `nombre-modulo.routes.ts` (endpoints)
   - `nombre-modulo-event-handlers.ts` (si escucha eventos)
2. Registrar routes en `backend/src/app.ts`
3. Si emite eventos, publicar en service vía `eventBus`

### Agregar página frontend
1. Crear `frontend/src/pages/NombrePage.tsx` (componente)
2. Agregar ruta en `frontend/src/app/router.tsx`
3. Importar en menú/navegación (`AppShell.tsx`)
4. Usar servicio API: `frontend/src/services/erp-api.ts`

### Hacer cambios en auth
- Backend: `backend/src/modules/auth/` + `backend/src/core/auth/`
- Frontend: `frontend/src/auth/` (AuthContext, useAuth hook)
- **Importante**: Refresh token va en cookie (httpOnly en prod)

## 🚨 Puntos Críticos

- **Contabilidad**: Module accounting es append-only (no editar/eliminar asientos existentes)
- **Soft deletes**: Siempre usar `isActive=false` en lugar de borrar
- **Timestamps**: `createdAt/updatedAt` se manejan automáticamente
- **JWT expirado**: Frontend auto-renueva; backend rechaza con 401
- **MongoDB**: Asegurar que está corriendo localmente o via MONGO_URI

## 📚 Documentación Adicional

- [readme.md](readme.md) - Descripción general y setup
- [proyecto.md](proyecto.md) - Especificación funcional y técnica detallada
- Backend: [backend/src/config/env.ts](backend/src/config/env.ts) - Env parsing
- Frontend: [frontend/src/services/http.ts](frontend/src/services/http.ts) - HTTP client + interceptor

## 💡 Cómo Ayudar a los Agentes

Cuando encuentres un bug o necesites feature:
1. **Describe el flujo**: Qué módulos están involucrados, qué eventos se disparan
2. **Especifica el cambio**: Cuál exactamente es el endpoint/componente/handler que cambia
3. **Menciona auditoría/eventos**: Si afecta historial o flujo entre módulos
4. **Verifica env**: Asegura que las variables necesarias están en .env

---

**Última actualización**: May 2026  
**Mantenedor**: Equipo ERP Amados
