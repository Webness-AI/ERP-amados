# Plan de Cierre de Objetivo - ERP AMADOS

Fecha: 15-05-2026

## 1. Estado actual resumido

El frontend ya tiene rutas operativas para:

- Dashboard
- Proyectos
- Stock
- Libro Diario
- Clientes
- Presupuestos
- Compras
- Produccion
- Caja y Bancos
- Gastos Fijos
- Configuraciones

Ademas, la compilacion actual del frontend esta pasando.

## 2. Brechas detectadas (lo que NO fue planteado o no esta completo)

### 2.1 Contabilidad operativa incompleta en frontend (brecha critica)

Situacion actual:

- La pantalla de Libro Diario muestra listado y reportes.
- No existe flujo UI para crear asiento manual.
- No existe flujo UI para revertir asiento.
- No existe vista de detalle de asiento.

Impacto:

- El backend ya soporta estas operaciones, pero el usuario final no puede ejecutarlas desde frontend.
- Se pierde capacidad de ajuste contable y correccion formal por reverso dentro del sistema.

### 2.2 Proyectos con placeholders funcionales (brecha alta)

Situacion actual:

- Vista Kanban y Gantt muestran mensaje "Disponible proximamente".
- El filtro por estado usa contador random y no dato real.
- El progreso (65%) y pagos pendientes ($450k) estan hardcodeados.
- Boton de acciones por fila no ejecuta flujo real.

Impacto:

- Riesgo de decisiones operativas sobre datos ficticios.
- El modulo no cumple el objetivo de trazabilidad real de punta a punta.

### 2.3 Navegacion y alcance funcional vs backend (brecha alta)

Situacion actual:

- Backend expone modulos de cobranzas y proveedores.
- Frontend no presenta modulos de Cobranzas ni Proveedores en navegacion.

Impacto:

- Parte del alcance ERP queda oculto o no usable.
- Inconsistencia entre capacidades backend y experiencia frontend.

### 2.4 Calidad de producto (brecha media)

Situacion actual:

- Falta ronda de QA responsive integral por modulo.
- Faltan pruebas de navegacion cruzada entre modulos.
- Existen copys y acentos inconsistentes en varias pantallas.

Impacto:

- Mayor probabilidad de regresiones visuales/funcionales en demo o uso real.

### 2.5 Seguridad y permisos en UX (brecha media)

Situacion actual:

- El backend controla roles, pero en frontend faltan guardas visuales finas por accion.
- Varias acciones sensibles deberian bloquearse/ocultarse por rol antes de llamar API.

Impacto:

- Mala experiencia de usuario (botones que fallan por permiso).
- Ruido operativo para perfiles sin privilegios.

## 3. Plan de accion recomendado por prioridad

## Fase A - Cierre contable real (prioridad P0)

Objetivo: completar Libro Diario como modulo operativo, no solo de consulta.

Entregables:

1. Formulario "Nuevo asiento manual" con lineas Debe/Haber y validacion de doble partida.
2. Accion "Revertir asiento" por fila y/o detalle, con motivo obligatorio.
3. Drawer/modal de detalle de asiento (lineas, origen, usuario, trazabilidad).
4. Bloqueo por rol en UI para acciones de escritura (solo ADMIN_GENERAL y ADMIN).

Criterio de cierre:

- Se puede crear, consultar detalle y revertir asientos desde frontend.

## Fase B - Cierre real de Proyectos (prioridad P0)

Objetivo: eliminar datos y comportamientos ficticios del modulo.

Entregables:

1. Reemplazar contadores random de tabs por conteos reales.
2. Reemplazar progreso y pagos mock por datos reales o ocultarlos hasta tener backend.
3. Implementar acciones reales por fila (ver detalle, editar estado, etc.).
4. Si Kanban/Gantt no entra, ocultar tabs en lugar de mostrar "proximamente".

Criterio de cierre:

- No quedan valores hardcodeados ni UI de demo en Proyectos.

## Fase C - Alineacion frontend-backend de modulos (prioridad P1)

Objetivo: cerrar gap de funcionalidad disponible pero no expuesta.

Entregables:

1. Definir si Proveedores y Cobranzas entran en MVP de este ciclo.
2. Si entran: agregar rutas, paginas y navegacion minima operativa.
3. Si no entran: documentar decision de alcance y backlog formal.

Criterio de cierre:

- Queda explicito que modulos son parte del MVP y cuales quedan fuera.

## Fase D - QA y hardening de UX (prioridad P1)

Objetivo: estabilizar para entrega.

Entregables:

1. QA responsive desktop/tablet/mobile en todos los modulos.
2. QA de navegacion cruzada (presupuesto -> proyecto, stock -> compras, etc.).
3. Normalizacion de copy (acentos, labels, tono, consistencia).
4. Estados loading/error/empty consistentes en toda la app.
5. Build final + checklist de regresion.

Criterio de cierre:

- Flujo completo sin placeholders, sin datos mock y sin errores de build.

## 4. Tareas concretas sugeridas (semana actual)

1. Implementar endpoints faltantes en capa API de contabilidad para:
   - crear asiento manual
   - obtener asiento por id
   - revertir asiento
2. Extender Libro Diario con:
   - boton Nuevo Asiento
   - modal de carga de lineas contables
   - accion Revertir con motivo
3. Limpiar Proyectos:
   - sacar random counters
   - quitar mensajes "proximamente"
   - dejar solo vista Tabla si no hay datos para otras vistas
4. Definir decision de alcance para Cobranzas y Proveedores (entra/no entra).
5. Correr QA responsive y build final.

## 5. Riesgos a controlar

1. Crear asientos manuales sin validacion de doble partida en frontend.
2. Mantener UI con datos ficticios que parezcan reales.
3. Exponer acciones prohibidas para roles sin permiso.
4. Cerrar MVP sin decision explicita sobre modulos backend no expuestos.

## 6. Definicion de "objetivo cumplido" en este proyecto

Se considera cumplido cuando:

1. No hay placeholders ni textos "proximamente" en modulos del alcance acordado.
2. El Libro Diario permite al menos consulta + alta manual + reverso.
3. Proyectos opera con datos reales, sin mocks visuales.
4. Navegacion y funcionalidades del frontend estan alineadas con el alcance decidido del backend.
5. QA responsive y build final pasan sin errores.

## 7. Decision de alcance aplicada (Fase C)

- Proveedores: entra en este ciclo con navegacion y pagina operativa minima.
- Cobranzas: entra en este ciclo con navegacion y pagina operativa minima.

Estado de implementacion:

- Rutas frontend agregadas para ambos modulos.
- Navegacion lateral actualizada con acceso directo.
- Lectura real y acciones basicas conectadas al backend.

## 8. Avance Fase D (QA y hardening)

Aplicado en este ciclo:

- Normalizacion de copy y acentos en modulos clave.
- Mejora de UX por permisos con mensajes de solo lectura.
- Hardening responsive en shell (sidebar/topbar movil).
- Navegacion cruzada operativa (Presupuestos -> Proyectos, Stock -> Compras).

Checklist tecnico:

- Ver archivo `QA_FASE_D_CHECKLIST.md` para estado de validaciones automaticas y pendientes manuales.
