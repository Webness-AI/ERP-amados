# Plan MVP Frontend - Modulos Secundarios

## Objetivo

Cerrar el frontend MVP de las secciones Libro Diario, Clientes, Presupuestos, Compras, Produccion, Caja y Bancos, Gastos Fijos y Configuraciones con un criterio operativo realista:

- listar datos reales desde backend
- permitir filtros y paginacion donde ya existen endpoints
- habilitar las acciones criticas del negocio que ya estan soportadas
- mantener consistencia visual con el shell y el diseño pactado
- evitar placeholders engañosos o acciones mudas

Este plan asume que el backend actual es la fuente de verdad y que no se agregaran endpoints nuevos en esta fase, salvo que durante la implementacion aparezca un bloqueo real.

---

## Alcance MVP por modulo

### 1. Libro Diario

MVP esperado:

- listado paginado de asientos
- filtros por rango de fechas y criterios disponibles en backend
- resumen superior con totales o indicadores contables simples
- vista de detalle del asiento
- accion de revertir asiento solo si el rol y el endpoint lo permiten
- acceso a reportes principales ya disponibles: balance de comprobacion, estado de resultados y balance general

Backend disponible:

- GET /api/v1/accounting/journal-entries
- GET /api/v1/accounting/journal-entries/:id
- POST /api/v1/accounting/journal-entries
- POST /api/v1/accounting/journal-entries/:id/reverse
- GET /api/v1/accounting/reports/trial-balance
- GET /api/v1/accounting/reports/income-statement
- GET /api/v1/accounting/reports/balance-sheet

Fuera de MVP:

- editor contable complejo con validaciones avanzadas tipo ERP full
- exportaciones avanzadas

### 2. Clientes

MVP esperado:

- listado paginado con busqueda
- alta de cliente
- edicion de cliente
- baja logica con confirmacion
- vista rapida o drawer de detalle

Backend disponible:

- GET /api/v1/clients
- GET /api/v1/clients/:id
- POST /api/v1/clients
- PATCH /api/v1/clients/:id
- DELETE /api/v1/clients/:id

Fuera de MVP:

- scoring, historial avanzado, timeline comercial o CRM profundo

### 3. Presupuestos

MVP esperado:

- listado paginado con filtros de estado
- detalle del presupuesto
- alta de presupuesto
- cambio de estado
- revision de presupuesto
- baja logica
- CTA visible para convertir el flujo hacia proyecto cuando corresponda

Backend disponible:

- GET /api/v1/budgets
- GET /api/v1/budgets/:id
- POST /api/v1/budgets
- POST /api/v1/budgets/:id/revisions
- PATCH /api/v1/budgets/:id/status
- DELETE /api/v1/budgets/:id

Fuera de MVP:

- constructor visual muy complejo de items
- versionado grafico comparativo entre revisiones

### 4. Compras

MVP esperado:

- listado paginado con filtros de estado
- detalle de compra
- alta de compra
- cambio de estado
- recepcion de compra
- baja logica
- integracion basica con sugerencias desde Stock cuando aplique

Backend disponible:

- GET /api/v1/purchases
- GET /api/v1/purchases/:id
- POST /api/v1/purchases
- PATCH /api/v1/purchases/:id/status
- POST /api/v1/purchases/:id/receive
- DELETE /api/v1/purchases/:id

Fuera de MVP:

- conciliacion avanzada con proveedores
- flujo multi-etapa de aprobacion

### 5. Produccion

MVP esperado:

- listado paginado de ordenes de produccion
- filtros por estado y proyecto si el backend lo soporta
- alta de orden
- edicion basica
- cambio de estado
- baja logica
- vista tabla como ancla MVP; kanban solo si queda tiempo y soporte real

Backend disponible:

- GET /api/v1/production-orders
- GET /api/v1/production-orders/:id
- POST /api/v1/production-orders
- PATCH /api/v1/production-orders/:id
- PATCH /api/v1/production-orders/:id/status
- DELETE /api/v1/production-orders/:id

Fuera de MVP:

- tablero de planta en tiempo real
- gantt o asignacion avanzada por operario

### 6. Caja y Bancos

MVP esperado:

- listado paginado de movimientos
- filtros por origen, direccion y medio de pago
- KPIs superiores de ingresos, egresos y saldo visible del periodo filtrado
- detalle del movimiento
- alta de movimiento manual

Backend disponible:

- GET /api/v1/cash/movements
- GET /api/v1/cash/movements/:id
- POST /api/v1/cash/movements

Fuera de MVP:

- conciliacion bancaria
- multiples cuentas bancarias con saldo consolidado por entidad si no existe endpoint dedicado

### 7. Gastos Fijos

MVP esperado:

- listado paginado con alertas visibles
- detalle del gasto
- alta de gasto fijo
- edicion
- registrar pago
- refrescar alertas
- baja logica

Backend disponible:

- GET /api/v1/fixed-expenses
- GET /api/v1/fixed-expenses/:id
- POST /api/v1/fixed-expenses
- PATCH /api/v1/fixed-expenses/:id
- POST /api/v1/fixed-expenses/:id/pay
- POST /api/v1/fixed-expenses/refresh-alerts
- DELETE /api/v1/fixed-expenses/:id

Fuera de MVP:

- automatizacion avanzada de vencimientos y calendario completo

### 8. Configuraciones

MVP esperado:

- gestion de usuarios
- gestion de roles y estado del usuario
- reseteo de password
- gestion basica del plan de cuentas
- ajustes UI locales no persistidos en backend, si hacen falta, guardados en localStorage

Backend disponible para sostener este MVP:

- GET /api/v1/users
- GET /api/v1/users/:id
- POST /api/v1/users
- PATCH /api/v1/users/:id
- PATCH /api/v1/users/:id/role
- PATCH /api/v1/users/:id/status
- PATCH /api/v1/users/:id/password
- DELETE /api/v1/users/:id
- GET /api/v1/accounts
- GET /api/v1/accounts/:id
- POST /api/v1/accounts
- PATCH /api/v1/accounts/:id
- DELETE /api/v1/accounts/:id

Nota importante:

- no existe un endpoint dedicado de settings en backend
- el MVP de Configuraciones debe cerrarse sobre usuarios, roles, cuentas contables y preferencias UI locales

Fuera de MVP:

- auditoria avanzada
- parametrizacion global profunda del ERP

---

## Etapas globales de implementacion

## Etapa 0 - Fundacion compartida

Objetivo:

dejar lista la base comun para no repetir trabajo modulo por modulo.

Tareas:

1. Definir componentes reutilizables para tablas densas, filtros, drawers, modales y estados vacio/error/loading.
2. Extender la capa API tipada en frontend/src/services/erp-api.ts para los ocho modulos.
3. Crear helpers comunes de formato para moneda, fecha, estados y etiquetas.
4. Definir convenciones de filtros en URL para listados: page, limit, search, status, from, to, source, direction.
5. Dejar una base de formularios consistente con feedback de error y disabled state.

Entregable:

- base tecnica y visual lista para implementar pantallas sin volver a inventar patrones.

## Etapa 1 - Pantallas de lectura primero

Objetivo:

reemplazar placeholders por vistas reales de consulta en las ocho secciones.

Tareas:

1. Crear una pagina por modulo en frontend/src/pages.
2. Conectar cada pagina a sus endpoints GET reales.
3. Agregar cabecera con titulo, descripcion, filtros y tabla/listado.
4. Agregar estados loading, error y vacio.
5. Sincronizar paginacion y filtros con query params.

Entregable:

- todas las secciones navegan a una vista real, aunque algunas acciones de escritura todavia no esten habilitadas.

## Etapa 2 - Acciones criticas de negocio

Objetivo:

habilitar las acciones minimas que convierten las pantallas en operativas.

Tareas:

1. Clientes: crear, editar, eliminar.
2. Presupuestos: crear, revisar, cambiar estado.
3. Compras: crear, cambiar estado, recibir compra.
4. Produccion: crear, editar, cambiar estado.
5. Caja y Bancos: crear movimiento manual.
6. Gastos Fijos: crear, editar, pagar, refrescar alertas.
7. Configuraciones: crear usuario, cambiar rol, cambiar estado, resetear password, alta y edicion de cuentas.
8. Libro Diario: crear asiento manual y revertir cuando aplique.

Entregable:

- MVP ya operable para roles Admin y Admin General en los casos cubiertos por backend.

## Etapa 3 - Pulido de UX y cierre MVP

Objetivo:

cerrar coherencia visual, feedback y navegacion entre modulos.

Tareas:

1. Conectar CTAs cruzados entre modulos, por ejemplo Stock hacia Compras o Presupuestos hacia Proyectos.
2. Reemplazar acciones mudas por modales, drawers o navegacion real.
3. Estandarizar copy, acentos, chips de estado y botones.
4. Ajustar responsive en desktop, tablet y mobile.
5. Ejecutar build final y validar errores del workspace.

Entregable:

- cierre MVP consistente y presentable del frontend.

---

## Plan paso por paso por seccion

## Libro Diario

### Fase A - Lectura

1. Relevar filtros reales de listJournalEntries.
2. Extender erp-api.ts con listJournalEntries, getJournalEntryById y reportes.
3. Completar la pagina con KPI superior, filtros de fecha y tabla paginada.
4. Agregar drawer o panel lateral de detalle del asiento.

### Fase B - Operacion

1. Crear modal para asiento manual.
2. Agregar accion de reversa por fila o en detalle.
3. Agregar tabs o subbloques para reportes contables basicos.

### Criterio de cierre

- listar, ver detalle, crear y revertir funciona sin salir del modulo.

## Clientes

### Fase A - Lectura

1. Extender erp-api.ts con listClients y getClientById.
2. Crear tabla con nombre, contacto, identificacion, telefono, email y estado si existe.
3. Agregar busqueda y paginacion.

### Fase B - Operacion

1. Modal o drawer de alta.
2. Modal o drawer de edicion.
3. Confirmacion de baja logica.

### Criterio de cierre

- el usuario puede consultar y mantener clientes desde la misma pantalla.

## Presupuestos

### Fase A - Lectura

1. Extender erp-api.ts con listBudgets y getBudgetById.
2. Crear tablero con tabs de estado y tabla de presupuestos.
3. Mostrar cliente, monto, estado, fecha y version actual.

### Fase B - Operacion

1. Formulario de alta.
2. Accion de revision.
3. Accion de cambio de estado.
4. Accion de eliminacion logica.

### Fase C - Flujo comercial

1. Agregar CTA visible hacia proyecto cuando el estado lo permita.
2. Si no existe integracion directa en frontend, dejar accion claramente etiquetada como navegar a Proyectos.

### Criterio de cierre

- el presupuesto tiene ciclo minimo de alta, revision y cambio de estado.

## Compras

### Fase A - Lectura

1. Extender erp-api.ts con listPurchases y getPurchaseById.
2. Crear tabla con proveedor, fecha, monto, estado y recepcion.
3. Agregar filtros de estado y paginacion.

### Fase B - Operacion

1. Formulario de alta de compra.
2. Cambio de estado.
3. Recepcion de compra desde modal o drawer.
4. Baja logica con confirmacion.

### Fase C - Integracion con stock

1. Reutilizar las sugerencias de compra ya visibles desde Stock.
2. Resolver un CTA que abra Compras con contexto o formulario prellenado si el tiempo alcanza.

### Criterio de cierre

- el usuario puede cargar una compra y marcar su recepcion.

## Produccion

### Fase A - Lectura

1. Extender erp-api.ts con listProductionOrders y getProductionOrderById.
2. Crear vista tabla con proyecto, responsable si existe, estado, fechas y observaciones.
3. Agregar filtros por estado y paginacion.

### Fase B - Operacion

1. Formulario de alta.
2. Edicion basica.
3. Cambio de estado.
4. Baja logica.

### Fase C - Pulido

1. Solo si queda tiempo, agregar vista tablero simple por estado.
2. Si no queda tiempo, no introducir Kanban para este MVP.

### Criterio de cierre

- gestion completa de ordenes en formato tabla con cambio de estado.

## Caja y Bancos

### Fase A - Lectura

1. Extender erp-api.ts con listCashMovements y getCashMovementById.
2. Crear KPI superior para ingresos, egresos y neto del periodo visible.
3. Crear tabla con fecha, origen, direccion, medio de pago, monto y nota.
4. Agregar filtros de origen, direccion y fecha.

### Fase B - Operacion

1. Crear modal para movimiento manual.
2. Validar feedback post-creacion y refresco del listado.

### Criterio de cierre

- consultar y registrar movimientos manuales desde una sola pantalla.

## Gastos Fijos

### Fase A - Lectura

1. Extender erp-api.ts con listFixedExpenses y getFixedExpenseById.
2. Crear KPI de vencimientos, gastos activos y alertas.
3. Crear tabla con nombre, periodicidad, proximo vencimiento, importe y estado.
4. Agregar filtros y paginacion.

### Fase B - Operacion

1. Formulario de alta.
2. Edicion.
3. Accion pagar gasto.
4. Accion refrescar alertas.
5. Baja logica.

### Criterio de cierre

- el usuario puede administrar el catalogo de gastos y registrar su pago.

## Configuraciones

### Fase A - Estructura de modulo

1. Dividir la pagina en dos tabs internas: Usuarios y Plan de Cuentas.
2. Dejar un tercer bloque optativo de Preferencias UI si hace falta, sin depender de backend.

### Fase B - Usuarios

1. Extender erp-api.ts con listUsers, getUserById, createUser, updateUser, updateUserRole, updateUserStatus, resetUserPassword y deleteUser.
2. Crear tabla de usuarios con rol y estado.
3. Agregar formularios de alta y edicion.
4. Agregar acciones de rol, estado y reset de password.

### Fase C - Plan de Cuentas

1. Extender erp-api.ts con listAccounts, getAccountById, createAccount, updateAccount y deleteAccount.
2. Crear tabla del plan de cuentas.
3. Agregar alta, edicion y baja.

### Criterio de cierre

- Configuraciones deja de ser una pantalla vacia y pasa a cubrir administracion real para Admin General.

---

## Orden recomendado de ejecucion

1. Libro Diario
2. Clientes
3. Presupuestos
4. Compras
5. Produccion
6. Caja y Bancos
7. Gastos Fijos
8. Configuraciones

Motivo:

- Libro Diario ya tiene una base en frontend y backend fuerte.
- Clientes y Presupuestos destraban gran parte del flujo comercial.
- Compras y Produccion conectan mejor con Stock y Projects ya existentes.
- Caja y Gastos Fijos consolidan la capa operativa financiera.
- Configuraciones se deja al final porque su alcance MVP depende de usuarios y cuentas, no de un endpoint settings dedicado.

---

## Checklist de tareas transversales

1. Crear paginas reales en lugar de PlaceholderPage para los ocho modulos.
2. Extender frontend/src/services/erp-api.ts modulo por modulo.
3. Mantener paginacion y filtros sincronizados con URL.
4. Usar estados loading, error y vacio consistentes.
5. No dejar botones principales sin accion.
6. No dejar textos tipo en construccion, disponible proximamente o demo.
7. Validar roles visibles: Configuraciones debe respetar Admin General.
8. Verificar responsive tablet y mobile en cada modulo.
9. Ejecutar npm run build al cierre de cada bloque grande.

---

## Criterio de cierre MVP del bloque completo

El bloque se considera cerrado cuando:

1. las ocho rutas tienen pantalla real y no placeholder generico
2. cada modulo consume al menos sus endpoints GET principales
3. cada modulo soporta al menos una accion operativa critica real cuando el backend ya la ofrece
4. el frontend mantiene consistencia visual con el shell y los modulos ancla ya construidos
5. no quedan textos ficticios, acciones mudas ni KPIs inventados
6. el build final del frontend compila sin errores

---

## Riesgos y decisiones

1. Configuraciones no debe esperar un endpoint settings porque hoy no existe; el MVP se apoya en users y accounts.
2. Si algun schema backend obliga formularios demasiado complejos, el MVP debe priorizar alta simple y edicion basica.
3. Si una accion de negocio no entra completa, se navega al modulo correcto con contexto antes que dejar un boton sin efecto.
4. Si un modulo necesita vista avanzada tipo tablero, solo entra despues de cerrar la vista tabla operativa.
