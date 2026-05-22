# Flujo Comercial: Presupuesto -> Cliente -> Proyecto

## Objetivo

Este documento define el flujo comercial y operativo que debe seguir el sistema para presupuestos, conversion de consultas en clientes y posterior creacion de proyectos.

La regla central es esta:

- Un presupuesto **no requiere** un cliente previo.
- Una consulta puede transformarse en cliente **solo cuando acepta el presupuesto**.
- El flujo operativo correcto es: **Presupuesto -> Cliente -> Proyecto**.

## Concepto de negocio

1. Primero se arma un presupuesto para una consulta o posible venta.
2. Si la persona acepta y realiza la seña, pasa a ser Cliente.
3. A partir de la aceptacion, se crea un nuevo Proyecto.
4. El presupuesto queda guardado con estado pendiente, aceptado o rechazado.

## Reglas de presupuesto

### 1. El presupuesto no depende de un cliente previo

- El presupuesto se puede crear desde una consulta.
- No debe exigirse un `clientId` obligatorio al momento de presupuestar.
- El titular puede existir como nombre de contacto o prospecto, pero no como cliente formal todavia.

### 2. Base de calculo del presupuesto

El precio del presupuesto se calcula en este orden:

#### a. Materiales

- El presupuesto se arma a partir de la suma de materiales necesarios.
- Cada material proviene del modulo de Inventario.
- Cada linea debe permitir:
  - seleccionar material
  - ver precio por unidad
  - ingresar cantidad
- El subtotal de materiales se calcula como:

  `cantidad x precio_unitario`

#### b. Costo fijo por hora

- Deben tomarse los gastos fijos cargados en el modulo Gastos Fijos.
- La suma total mensual de gastos fijos se divide por:
  - 26 dias laborales
  - 8 horas por dia
- Eso da el costo fijo por hora.
- El presupuesto debe permitir ingresar la cantidad de horas laborales requeridas.
- El costo laboral se calcula como:

  `costo_fijo_por_hora x horas_requeridas`

#### c. Comision y bono

Sobre el costo parcial del proyecto deben agregarse:

- Comision del vendedor: **13%**
- Bono del empleado: **10%**

#### d. Envio

- Debe existir un campo para ingresar el costo de envio.
- Se suma al total del proyecto antes del margen final.

### 3. Margen final

Una vez sumados:

- materiales
- horas laborales
- comision
- bono
- envio

se obtiene el **costo del proyecto**.

A ese costo se le agrega el margen final segun tipo de trabajo:

- **40%** para trabajos comunes
- **55%** para amoblamientos de cocina

Eso da el **precio final del presupuesto**.

## Ciclo de aceptacion / rechazo

### Si el presupuesto es aceptado

- El nombre del titular pasa a ser Cliente.
- Se registra la conversion formal de consulta a cliente.
- Se crea el Proyecto correspondiente.
- El presupuesto queda como aceptado y enlazado al nuevo cliente/proyecto.

### Si el presupuesto es rechazado

- Se ofrece automaticamente un descuento del **10%**.
- Si aun asi sigue rechazado, el presupuesto se da por eliminado.
- Debe quedar trazabilidad del rechazo y del intento de descuento.

## Estructura de datos recomendada

### Presupuesto

Debe guardar al menos:

- titular o prospecto
- fecha
- materiales y cantidades
- subtotal de materiales
- horas laborales
- costo fijo por hora
- comision vendedor
- bono empleado
- envio
- costo del proyecto
- margen aplicado
- precio final
- estado del presupuesto
- observaciones

### Cliente

Debe existir solo cuando la consulta acepta el presupuesto.

- nombre titular
- datos de contacto
- relacion con el presupuesto aceptado
- relacion con el proyecto creado

### Proyecto

Se crea a partir del presupuesto aceptado y debe conservar la trazabilidad de origen.

- presupuesto origen
- cliente asociado
- materiales requeridos
- horas estimadas
- margen y valores de origen
- estado del proyecto

## Regla operativa clave

El presupuesto no es una entidad dependiente del cliente.

Es una entidad previa que representa una oportunidad comercial. Solo cuando la persona acepta, paga la seña y confirma el trabajo, se convierte formalmente en Cliente y de ahi nace el Proyecto.

## Impacto en el sistema

Este flujo afecta directamente:

- Ventas
- Clientes
- Proyectos
- Inventario
- Gastos Fijos
- Contabilidad
- Cobranzas

## Intencion para planes futuros

Usar este documento como referencia unica para:

- formularios de presupuesto
- calculo de precio final
- conversion de prospecto a cliente
- creacion automatica de proyecto
- reglas de rechazo y descuento
- trazabilidad contable y operativa

## Resumen corto del flujo

1. Se crea un presupuesto desde una consulta.
2. El presupuesto se calcula con materiales, horas, gastos fijos, comision, bono y envio.
3. Se aplica margen final.
4. Si acepta, la consulta pasa a Cliente.
5. Se crea el Proyecto.
6. Si rechaza, se ofrece 10% de descuento.
7. Si sigue rechazado, se elimina el presupuesto.
