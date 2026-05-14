Documentación Técnica Actualizada - ERP/CRM Operativo para Amado's

Este documento resume la arquitectura conceptual, contable y operativa del sistema ERP/CRM diseñado para Amado's. El sistema se basa en una arquitectura modular impulsada por eventos, donde todas las operaciones convergen en un núcleo contable centralizado.

Objetivo General del Sistema
• Centralizar operación comercial, stock, compras, producción, gastos fijos y contabilidad.
• Automatizar procesos operativos y financieros.
• Mantener trazabilidad absoluta de materiales, dinero y movimientos.
• Permitir crecimiento y escalabilidad sin destruir la arquitectura.
• Transformar la lógica operativa de Amado's en un sistema digital integrado.

Stack Tecnológico
• Frontend: React + TypeScript + SCSS + Vite
• Backend: Node.js + TypeScript + Express
• Base de datos: MongoDB
• Autenticación: JWT + Refresh Tokens
• Arquitectura: Modular Monolith + Event Driven + DDD parcial

Concepto Central de la Arquitectura
• Absolutamente todo lo que sucede en el sistema converge en el Libro Diario.
• Los módulos operativos generan eventos económicos.
• El módulo contable interpreta dichos eventos y genera asientos automáticamente.
• El Costo de Mercadería Vendida (CMV) se registra automáticamente desde movimientos de stock asociados a ventas y proyectos.
• Libro Mayor, Estado de Resultados, Estado Contable y Balances/Resúmenes son derivados automáticos.
• El sistema debe funcionar como un ERP financiero-operativo real.

Roles del Sistema
• Admin General: gestión total del sistema, usuarios, roles, configuraciones y plan de cuentas.
• Admin: gestión operativa de clientes, stock, compras, producción, gastos, caja y libro diario.
• Usuario: acceso únicamente de lectura.

Principios Arquitectónicos
• Single Source of Truth: cada dato existe una sola vez.
• Los módulos no deben duplicar lógica.
• La lógica crítica vive en backend.
• El frontend no toma decisiones contables ni operativas.
• El libro diario es append-only e inmutable.
• Los resultados financieros se calculan a partir de movimientos históricos.

Arquitectura Modular
• El sistema será un Modular Monolith.
• Cada módulo tendrá responsabilidades claras.
• Los módulos se comunicarán mediante eventos.
• La arquitectura evitará dependencias cruzadas caóticas.

Módulos Principales
• Auth
• Usuarios y Roles
• Clientes
• Presupuestos
• Proyectos
• Stock
• Compras
• Proveedores
• Producción
• Gastos Fijos
• Caja y Bancos
• Contabilidad
• Dashboard Gerencial
• Configuraciones

Modelo Operativo General
• Cliente puede tener múltiples proyectos.
• Presupuesto y Proyecto son entidades separadas.
• Proyecto contiene materiales necesarios, estados y fechas.
• Stock funciona mediante movimientos y reservas.
• Las reservas y asignaciones de materiales se vinculan directamente a proyectos.
• Los faltantes generan necesidades automáticas de compra.
• Las compras generan ingresos automáticos de stock.
• Toda venta y todo gasto generan asientos contables automáticos.
• Todo consumo de stock imputable a venta/proyecto genera CMV automático.

Estados de Proyecto
• Consulta
• Presupuestado
• Aprobado
• Comprado
• Producción
• Instalación
• Pausado
• Finalizado
• Cancelado

Estados de Cobranza
• Pendiente
• Señado
• Parcial
• Cobrado
• Vencido

Eventos del Sistema
• presupuesto_aprobado
• material_reservado
• material_asignado_a_proyecto
• stock_bajo_detectado
• lista_compra_generada
• compra_recibida
• venta_confirmada
• cmv_registrado
• pago_recibido
• gasto_fijo_programado
• gasto_pagado
• vencimiento_proximo_detectado
• vencimiento_vencido_detectado
• proyecto_finalizado

Flujo Principal Operativo
• Consulta
• Presupuesto
• Aprobación
• Reserva y asignación de stock
• Detección de faltantes
• Generación de lista de compra con presupuesto estimativo
• Compra
• Ingreso de materiales
• Producción
• Instalación
• Venta y cobro
• Registro de CMV
• Generación automática de asiento contable

Diseño del Stock
• El stock no se modifica manualmente.
• Todo movimiento genera trazabilidad.
• Movimientos posibles: ingreso, reserva, consumo, ajuste y devolución.
• Las reservas se vinculan directamente con proyectos.
• Las categorías base de materiales son: Madera, Herrajes y Otros.
• Debe existir vista de materiales por comprar basada en faltantes reales.
• La alerta de stock bajo debe mostrar pop-up con lista armada de materiales y presupuesto estimativo a gastar.

Clientes y Cobranzas Operativas
• Debe existir seguimiento de señas pendientes por cliente y por proyecto.
• Debe existir seguimiento de montos por cobrar y mano de obra pendiente.
• Cada proyecto debe almacenar fecha de entrega y generar pop-ups de aviso por proximidad o atraso.
• Debe existir historial de pagos y cobros con trazabilidad completa.

Producción
• Órdenes de producción vinculadas a proyectos.
• Estados de producción: Pendiente, Corte, Armado, Instalación y Finalizado.
• Priorización y responsables por tarea.

Gastos Fijos
• Módulo específico para gastos recurrentes operativos y administrativos.
• Cada gasto fijo debe tener calendario de vencimiento.
• Deben existir pop-ups de aviso para próximos vencimientos y vencidos.
• Los gastos fijos pagados impactan automáticamente en Libro Diario.

Caja y Bancos
• Caja separada de contabilidad.
• Todos los movimientos financieros deben registrarse.
• Los pagos permiten seleccionar forma de cobro/pago.
• Caja y Bancos actúan como contrapartidas contables.

Núcleo Contable
• El módulo contable escucha eventos económicos.
• Los eventos generan automáticamente asientos contables.
• Los asientos son inmutables.
• Las correcciones deben realizarse mediante asientos reversos.
• Cada asiento debe almacenar origen, entidad origen y trazabilidad.

Plan de Cuentas
• El sistema debe permitir crear y editar cuentas contables.
• Las cuentas estarán organizadas jerárquicamente.
• Ejemplos mínimos: Caja, Banco, Ventas, Anticipos Clientes, Stock, CMV, Proveedores, Publicidad, Gastos Fijos, Mano de Obra Pendiente.
• Las cuentas se utilizarán automáticamente para generar asientos.

Libro Diario
• Todos los módulos convergen en Libro Diario.
• Cada operación económica genera un asiento.
• Los asientos poseen fecha, origen, usuario y líneas contables.
• El libro diario es la fuente financiera absoluta del sistema.

Cadena de Reportes Contables
• Libro Diario -> Libro Mayor.
• Libro Mayor -> Estado de Resultados.
• Estado de Resultados -> Estado Contable.
• Estado Contable -> Balances y Resúmenes.
• Los reportes deben incluir filtros, comparativos y visualización gerencial.

Auditoría y Seguridad
• Todo registro debe almacenar createdBy y updatedBy.
• Debe existir trazabilidad histórica.
• No deben eliminarse registros críticos físicamente.
• Implementar soft delete para entidades sensibles.

Plan de Desarrollo
• Etapa 0: diseño funcional y modelado del negocio.
• Etapa 1: arquitectura base.
• Etapa 2: autenticación y roles.
• Etapa 3: clientes, proyectos y cobranzas operativas.
• Etapa 4: motor de stock con categorías y trazabilidad.
• Etapa 5: reservas, asignaciones y faltantes automáticos.
• Etapa 6: compras y proveedores.
• Etapa 7: producción.
• Etapa 8: caja, cobranzas e historial de pagos/cobros.
• Etapa 9: gastos fijos, calendario y alertas.
• Etapa 10: motor contable, CMV y libro diario automático.
• Etapa 11: libro mayor, estado de resultados, estado contable y balances.
• Etapa 12: dashboards, KPIs y automatizaciones de escalabilidad.

Recomendaciones Estratégicas
• Diseñar completamente los flujos antes de programar.
• Evitar microservicios en etapas iniciales.
• Priorizar coherencia de datos antes que automatizaciones.
• No guardar resultados calculables.
• Pensar el sistema como una plataforma operativa y financiera completa.
