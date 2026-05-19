# ERP AMADOS

Backend ERP/CRM operativo-financiero para Amado's, construido con Node.js, TypeScript, Express y MongoDB.

Este proyecto implementa una arquitectura Modular Monolith con comunicación por eventos internos, donde la operación comercial, stock, compras, cobranzas y gastos impactan en un núcleo contable centralizado.

## Estado actual

- Backend funcional por módulos, con API en /api/v1
- Autenticación JWT con refresh token
- Libro diario con asientos automáticos por eventos
- Dashboard con KPIs y scheduler interno de alertas

## Stack tecnológico

- Backend: Node.js + TypeScript + Express
- Base de datos: MongoDB + Mongoose
- Validación: Zod
- Seguridad: JWT, Helmet, CORS
- Logging HTTP: Morgan

## Estructura del repositorio

- backend: código del servidor y API
- proyecto.md: definición funcional y técnica del ERP
- readme.md: este documento

## Arquitectura del backend

Cada módulo sigue una estructura similar:

- model: esquema y tipos de dominio en MongoDB
- schemas: validaciones de entrada con Zod
- service: lógica de negocio
- routes: endpoints HTTP

Módulos principales disponibles:

- auth
- users
- clients
- budgets
- projects
- stock
- suppliers
- purchases
- production-orders
- cash
- collections
- fixed-expenses
- accounts
- accounting
- dashboard
- health

## Flujo de arranque

Al iniciar el servidor se ejecuta:

1. Conexión a MongoDB
2. Bootstrap de plan de cuentas por defecto (si faltan cuentas)
3. Registro de handlers contables de eventos
4. Inicio del scheduler interno de alertas de dashboard
5. Exposición del servidor HTTP

## Requisitos previos

- Node.js 20 o superior recomendado
- npm
- MongoDB accesible

## Configuración

El backend lee variables desde backend/.env.

Variables soportadas (actuales):

- PORT
- MONGO_URI
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- JWT_ACCESS_EXPIRES_IN
- JWT_REFRESH_EXPIRES_IN
- BCRYPT_SALT_ROUNDS
- CORS_ORIGIN
- DASHBOARD_ALERTS_SCHEDULER_ENABLED
- DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES
- DASHBOARD_ALERTS_RUN_ON_STARTUP

Compatibilidad legacy incluida:

- MONGODB_URI se mapea a MONGO_URI
- JWT_SECRET se mapea a JWT_ACCESS_SECRET y JWT_REFRESH_SECRET
- JWT_EXPIRES_IN se mapea a JWT_ACCESS_EXPIRES_IN y JWT_REFRESH_EXPIRES_IN

## Instalación y ejecución

Desde la carpeta backend:

1. Instalar dependencias
   npm install

2. Ejecutar en desarrollo
   npm run dev

3. Compilar
   npm run build

4. Ejecutar build compilado
   npm run start

5. Validación estática
   npm run typecheck
   npm run lint

## URL base y healthcheck

- Base API: http://localhost:3000/api/v1 (o el PORT configurado)
- Health: GET /api/v1/health

## Autenticación y uso básico

Endpoints de autenticación:

- POST /api/v1/auth/bootstrap-admin
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET /api/v1/auth/me

Flujo recomendado:

1. Bootstrap inicial de admin (solo primera vez)
2. Login para obtener accessToken
3. Enviar Authorization: Bearer <accessToken> en endpoints protegidos
4. Refrescar sesión con /auth/refresh cuando corresponda

Roles disponibles:

- ADMIN_GENERAL
- ADMIN
- USER

## Dashboard y scheduler

Endpoints clave:

- GET /api/v1/dashboard/overview
- GET /api/v1/dashboard/alerts
- POST /api/v1/dashboard/alerts/refresh
- GET /api/v1/dashboard/alerts/scheduler-status

El scheduler interno puede ejecutarse automáticamente según las variables:

- DASHBOARD_ALERTS_SCHEDULER_ENABLED
- DASHBOARD_ALERTS_REFRESH_EVERY_MINUTES
- DASHBOARD_ALERTS_RUN_ON_STARTUP

## Endpoints funcionales por módulo

Rutas principales montadas en app:

- /api/v1/auth
- /api/v1/users
- /api/v1/clients
- /api/v1/budgets
- /api/v1/projects
- /api/v1/stock
- /api/v1/suppliers
- /api/v1/purchases
- /api/v1/production-orders
- /api/v1/cash
- /api/v1/collections
- /api/v1/fixed-expenses
- /api/v1/accounts
- /api/v1/accounting
- /api/v1/dashboard

## Contabilidad y eventos

El módulo de accounting escucha eventos de dominio y genera asientos en libro diario.

Eventos contables actualmente integrados incluyen:

- presupuesto_aprobado
- compra_recibida
- pago_recibido
- gasto_pagado
- cmv_registrado
- proyecto_finalizado

Los asientos se crean con principio de doble partida y soporte de reversos.

## Scripts disponibles

En backend/package.json:

- npm run dev
- npm run build
- npm run start
- npm run typecheck
- npm run lint
- npm run test (pendiente de implementación)

## Solución de problemas comunes

1. Error de conexión a MongoDB
   Revisar MONGO_URI o MONGODB_URI en backend/.env

2. Error de JWT
   Revisar JWT_ACCESS_SECRET y JWT_REFRESH_SECRET (o JWT_SECRET legacy)

3. CORS bloqueando frontend
   Ajustar CORS_ORIGIN en backend/.env

4. Scheduler no corre
   Verificar DASHBOARD_ALERTS_SCHEDULER_ENABLED y revisar logs de arranque

## Próximos pasos sugeridos

- Implementar suite de tests automatizados
- Publicar documentación OpenAPI
- Añadir runbook operativo de despliegue y recuperación

## Deploy en Render (backend)

1. Crear el servicio en Render usando el archivo render.yaml del repositorio.
2. Configurar los secretos requeridos: MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN.
3. Lanzar el deploy (autoDeploy habilitado para próximos cambios).
4. Verificar salud en GET /api/v1/health.
