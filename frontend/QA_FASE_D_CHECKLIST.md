# QA Fase D - Cierre de UX y Estabilidad

Fecha: 15-05-2026

## 1. Validacion tecnica automatica

- [x] Type-check y build final exitosos (`npm run build`).
- [x] Rutas principales cargadas en router sin placeholders activos.
- [x] Navegacion lateral con acceso a todos los modulos del alcance MVP.

## 2. Normalizacion de copy y consistencia visual

- [x] Correccion de acentos y etiquetas en Auth, Login, Proyectos, Produccion, Compras, Clientes, Caja y Bancos, Gastos Fijos, Presupuestos.
- [x] Mensajes de solo lectura visibles para roles sin permisos en modulos sensibles.
- [x] Mensajes loading/error/empty consistentes en tablas principales.

## 3. Navegacion cruzada funcional

- [x] Presupuestos -> Proyectos (boton "Ir a proyectos").
- [x] Stock -> Compras (botones "Generar Lista de Compra" e "Ingreso de mercaderia").
- [x] Topbar -> Compras (accion "Generar lista de compra").

## 4. Responsive hardening

- [x] Sidebar en movil con navegacion horizontal desplazable.
- [x] Topbar en movil con acciones en wrap y usuario sin desbordes.
- [x] QA visual manual en 3 breakpoints por modulo critico.

## 5. Pendientes de cierre manual

- [x] Verificar flujo completo desktop/tablet/mobile en: Proyectos, Stock, Compras, Presupuestos, Cobranzas, Proveedores, Configuraciones.
- [ ] Verificar navegacion cruzada con backend activo y sesion ADMIN/USER. (validado en ADMIN_GENERAL; falta USER)
- [ ] Ejecutar smoke test de acciones de escritura por rol (ADMIN_GENERAL, ADMIN, USER).

Hallazgos durante QA manual:

- Se detecto warning de React por key en tabla de Configuraciones y se corrigio en `SettingsPage`.

## 6. Criterio de salida Fase D

Se considera cerrada cuando los pendientes manuales de seccion 5 esten marcados y no haya regresiones de build ni de navegacion.
