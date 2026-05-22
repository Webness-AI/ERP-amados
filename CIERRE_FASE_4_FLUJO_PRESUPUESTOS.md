# Cierre Fase 4 - Flujo Comercial Presupuestos

Fecha: 2026-05-22
Estado final de iniciativa: CERRADA

## Alcance cerrado

- Modulo Presupuestos (frontend) alineado con flujo comercial backend.
- Acciones criticas cubiertas: aceptar, aceptar con descuento, rechazar, recálculo y auditoría.
- Persistencia de detalle por presupuesto desde API para evitar dependencia de estado efímero en UI.

## Gate formal (PASS/FAIL)

1. Persistencia visual de conversion tras recarga: PASS
- Evidencia: detalle usa `GET /budgets/:id` al seleccionar presupuesto.
- Resultado: cliente/proyecto permanecen visibles despues de refresh.
- Nota de contrato: `collectionId` no viene en detalle de presupuesto; se muestra fallback explicito en UI.

2. Modales y reglas de estado consistentes: PASS
- Evidencia: aceptar, aceptar con descuento y rechazar operan por modal.
- Resultado: acciones invalidas bloqueadas por estado (APPROVED/CANCELED/REJECTED segun caso).

3. Lint focalizado: PASS
- Comando: `npx eslint src/pages/BudgetsPage.tsx src/services/erp-api.ts`
- Resultado: sin errores.

4. Build frontend: PASS
- Comando: `npm run build`
- Resultado: compilacion exitosa.
- Observacion no bloqueante: warning de chunk grande de Vite.

5. QA funcional ruta directa: PASS
- Flujo: crear presupuesto -> SENT -> accept.
- Evidencia: `DIRECT_OK=true`, `DIRECT_STATUS=APPROVED`, `projectId` y `collectionId` generados.

6. QA funcional ruta con descuento: PASS
- Flujo: crear presupuesto -> SENT -> reject -> accept-with-discount.
- Evidencia: primer rechazo en `REJECTED` con `discountedTotal`; aceptacion final en `APPROVED` con `projectId` y `collectionId`.

7. QA trazabilidad pricing: PASS
- Flujo: recalculate -> apply -> audit-trail.
- Evidencia: `RECALC_OK=true`, `APPLY_RECALC_OK=true`, `AUDIT_OK=true`, `AUDIT_COUNT=3`.

## Decisión de cierre

- Todos los criterios del gate de Fase 4 estan en PASS.
- Se declara cierre de la iniciativa de flujo comercial de Presupuestos.
- Cualquier mejora adicional pasa a backlog y queda fuera de este alcance.

## Backlog post-cierre (fuera de alcance actual)

1. Exponer `collectionId` en `GET /budgets/:id` para eliminar fallback de UI.
2. Reducir tamaño de bundle principal (warning de chunk > 500KB).