export const DOMAIN_EVENTS = {
  PRESUPUESTO_APROBADO: "presupuesto_aprobado",
  MATERIAL_RESERVADO: "material_reservado",
  MATERIAL_ASIGNADO_A_PROYECTO: "material_asignado_a_proyecto",
  STOCK_BAJO_DETECTADO: "stock_bajo_detectado",
  LISTA_COMPRA_GENERADA: "lista_compra_generada",
  COMPRA_RECIBIDA: "compra_recibida",
  VENTA_CONFIRMADA: "venta_confirmada",
  CMV_REGISTRADO: "cmv_registrado",
  PAGO_RECIBIDO: "pago_recibido",
  GASTO_FIJO_PROGRAMADO: "gasto_fijo_programado",
  GASTO_PAGADO: "gasto_pagado",
  VENCIMIENTO_PROXIMO_DETECTADO: "vencimiento_proximo_detectado",
  VENCIMIENTO_VENCIDO_DETECTADO: "vencimiento_vencido_detectado",
  PROYECTO_FINALIZADO: "proyecto_finalizado",
} as const;

export type DomainEventName =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export type DomainEvent<TPayload = Record<string, unknown>> = {
  name: DomainEventName;
  payload: TPayload;
  occurredAt: string;
  actorId?: string;
  correlationId?: string;
};
