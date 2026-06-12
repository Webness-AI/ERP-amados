# Plan de Accion: Relacion entre Presupuestos y Stock

## 1. Objetivo

Definir e implementar la relacion funcional entre el modulo de Presupuestos y el modulo de Stock para que, durante la creacion de un presupuesto:

- se muestren los materiales existentes con su precio vigente,
- se carguen cantidades por material,
- se calcule automaticamente el costo total de materiales,
- y se completen los costos/complementos comerciales del presupuesto:
  - envio,
  - embalaje,
  - comision del vendedor,
  - gasto de mano de obra,
  - cuota horaria,
  - porcentaje de ganancia.

Este plan respeta el flujo definido en [flujo_presupuesto_cliente_proyecto.md](flujo_presupuesto_cliente_proyecto.md): primero se crea el presupuesto desde una consulta/prospecto, y recien al aceptar se convierte en cliente y se crea proyecto.

## 2. Alcance funcional

### Incluye

- Integracion Presupuestos <- Stock para lectura de materiales y precios.
- Formulario de presupuesto con:
  - listado de materiales,
  - input de cantidad por cada material,
  - subtotal por material,
  - total de materiales.
- Seccion de costos adicionales y margen:
  - envio,
  - embalaje,
  - comision vendedor,
  - mano de obra,
  - cuota horaria,
  - porcentaje de ganancia.
- Recalculo en tiempo real del precio final.
- Persistencia completa de los valores calculados y de entrada.

### No incluye (en esta fase)

- Descuento automatico por rechazo (se mantiene como regla separada ya existente).
- Reserva/descuento de stock fisico al momento de presupuestar.
- Cambios contables automáticos extra fuera del flujo actual.

## 3. Definicion de datos

## 3.1 Presupuesto (campos nuevos o normalizados)

Agregar o validar en la entidad de presupuesto:

- materials[]
  - materialId
  - materialName (snapshot)
  - unit (snapshot)
  - unitPrice (snapshot)
  - quantity
  - lineTotal = quantity * unitPrice
- materialsTotal
- shippingCost
- packagingCost
- sellerCommission
- laborCost
- hourlyRate
- profitPercentage
- subtotalBeforeProfit
- profitAmount
- finalPrice

Nota: guardar snapshots de nombre/precio/unidad evita romper historico cuando cambia el material en stock.

## 3.2 Material de Stock

Verificar que el material exponga al menos:

- id
- name
- unit
- unitPrice vigente
- estado activo

## 4. Reglas de calculo

## 4.1 Materiales

Por cada material:

- lineTotal = quantity * unitPrice

Total materiales:

- materialsTotal = suma(lineTotal de todos los materiales)

## 4.2 Mano de obra y cuota horaria

Se acepta carga directa de:

- laborCost (monto manual), y/o
- hourlyRate (cuota horaria)

Regla operativa recomendada para esta fase:

- Si se ingresa laborCost, se usa ese valor.
- Si no se ingresa laborCost y existe hourlyRate con horas del presupuesto, entonces:
  - laborCost = hourlyRate * laborHours
- Si ambos existen, prevalece laborCost y se muestra aviso visual "mano de obra manual aplicada".

## 4.3 Subtotal previo a ganancia

- subtotalBeforeProfit = materialsTotal + shippingCost + packagingCost + sellerCommission + laborCost

## 4.4 Ganancia y precio final

- profitAmount = subtotalBeforeProfit * (profitPercentage / 100)
- finalPrice = subtotalBeforeProfit + profitAmount

## 4.5 Redondeo

- Redondear a 2 decimales en cada total monetario persistido.

## 5. Backend: plan de implementacion

## 5.1 Schemas y validaciones (Zod)

Actualizar schemas de Presupuestos:

- create/revise budget input con campos nuevos.
- Validaciones:
  - quantity >= 0
  - unitPrice >= 0
  - shippingCost, packagingCost, sellerCommission, laborCost, hourlyRate >= 0
  - profitPercentage >= 0
- Normalizacion de opcionales a 0 cuando aplique para calculos.

## 5.2 Servicio de Presupuestos

- Crear funcion pura de calculo (ejemplo: computeBudgetTotals).
- Recalcular siempre en backend para no confiar en valores del frontend.
- Persistir:
  - lineTotal por material,
  - materialsTotal,
  - subtotalBeforeProfit,
  - profitAmount,
  - finalPrice.
- Si hay sugerencia de costo desde stock (precio vigente), aplicarla por defecto al crear lineas.

## 5.3 Integracion con modulo Stock

- Endpoint de lectura para selector de materiales (si no existe):
  - GET /stock/materials?isActive=true
- El modulo Presupuestos debe consumir solo materiales activos.

## 5.4 Compatibilidad y migracion

- Mantener compatibilidad con presupuestos previos sin campos nuevos.
- Agregar defaults en lecturas para evitar errores de UI en registros antiguos.

## 6. Frontend: plan de implementacion

## 6.1 Formulario de creacion de presupuesto

Nueva estructura visual en el popup:

- Seccion A: Datos generales del presupuesto.
- Seccion B: Materiales (relacion con Stock).
- Seccion C: Costos adicionales y margen.
- Seccion D: Resumen de calculo.

## 6.2 Seccion Materiales

Componentes requeridos:

- Tabla/lista de materiales disponibles con:
  - nombre,
  - unidad,
  - precio unitario,
  - input cantidad,
  - subtotal de linea.
- Buscador por nombre de material.
- Posibilidad de agregar/quitar filas seleccionadas.

Comportamiento:

- Al cambiar cantidad, recalcular subtotal de linea y materialsTotal.
- Mostrar materialsTotal en tiempo real.

## 6.3 Seccion de costos y ganancia

Inputs numéricos para:

- shippingCost
- packagingCost
- sellerCommission
- laborCost
- hourlyRate
- profitPercentage

Comportamiento:

- Recalcular subtotalBeforeProfit, profitAmount y finalPrice en cada cambio.
- Validar no negativos y formato monetario.

## 6.4 Resumen final

Mostrar bloque resumen fijo con:

- Total materiales
- Envio
- Embalaje
- Comision vendedor
- Mano de obra
- Subtotal previo a ganancia
- Ganancia (%) y monto
- Precio final

## 7. API y contrato de datos

## 7.1 Request de creacion/revision de presupuesto

Enviar:

- materials[] con materialId, quantity, unitPrice (snapshot al crear)
- shippingCost
- packagingCost
- sellerCommission
- laborCost
- hourlyRate
- profitPercentage

## 7.2 Response esperada

Recibir calculado desde backend:

- materialsTotal
- subtotalBeforeProfit
- profitAmount
- finalPrice
- lineTotal por cada material

## 8. UX y validaciones clave

- Si no hay materiales seleccionados, permitir guardar borrador segun regla de negocio o bloquear con mensaje claro (definir criterio final).
- Si quantity = 0, linea no suma costo.
- Campos monetarios con mascara simple y separador consistente.
- Alertas de validacion en linea (sin esperar submit).
- Mantener confirmacion antes de cerrar popup si hay cambios sin guardar.

## 9. Pruebas

## 9.1 Backend

- Unit tests para computeBudgetTotals:
  - caso base con 2 materiales,
  - valores cero,
  - profitPercentage alto,
  - combinacion laborCost vs hourlyRate.
- Tests de validacion schema create/revise.

## 9.2 Frontend

- Test de formulario:
  - render de materiales,
  - recalculo por cambio de cantidad,
  - recalculo por costos adicionales,
  - submit con payload correcto.

## 9.3 Integracion

- Flujo completo:
  - crear presupuesto con materiales de stock,
  - verificar totales persistidos,
  - aceptar presupuesto,
  - verificar conversion a cliente y creacion de proyecto sin perder trazabilidad.

## 10. Plan por fases (ejecucion)

Fase 1 - Modelo y backend

- Extender schemas.
- Implementar computeBudgetTotals.
- Persistir nuevos campos.
- Exponer/confirmar endpoint de materiales activos.

Fase 2 - UI de formulario

- Construir seccion materiales con cantidades y subtotales.
- Construir seccion costos y margen.
- Implementar resumen en vivo.

Fase 3 - Integracion y QA

- Conectar UI con API.
- Ajustar errores de contrato.
- Ejecutar pruebas de regresion del flujo Presupuesto -> Cliente -> Proyecto.

Fase 4 - Endurecimiento

- Mejorar mensajes de validacion.
- Revisar performance en listas largas de materiales.
- Documentar contrato final en API y manual funcional.

## 11. Criterios de aceptacion

Se considera completo cuando:

- El formulario muestra materiales de stock con precio unitario.
- Se pueden cargar cantidades por material.
- El sistema calcula materialsTotal correctamente.
- Se pueden ingresar envio, embalaje, comision, mano de obra, cuota horaria y porcentaje de ganancia.
- El sistema recalcula subtotal, ganancia y precio final en vivo y en backend.
- Los valores quedan guardados en el presupuesto.
- El flujo de aceptacion mantiene la conversion correcta a Cliente y creacion de Proyecto.
