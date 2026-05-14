import { EventEmitter } from "node:events";

import type { DomainEvent, DomainEventName } from "./domain-events";

type DomainEventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

class InProcessEventBus {
  private readonly emitter = new EventEmitter();

  publish<TPayload>(event: DomainEvent<TPayload>): void {
    this.emitter.emit(event.name, event);
  }

  subscribe<TPayload>(
    eventName: DomainEventName,
    handler: DomainEventHandler<TPayload>,
  ): void {
    this.emitter.on(eventName, handler);
  }
}

export const eventBus = new InProcessEventBus();
