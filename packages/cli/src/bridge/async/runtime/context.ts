// Ambient message context: while a handler runs, anything it publishes inherits
// the correlation id, trace and causation of the message being handled.

import { AsyncLocalStorage } from 'async_hooks';

/** What is "current" while a message is being handled. */
export interface MessageContext {
  correlationId: string;
  /** traceparent of the span handling the message. */
  traceparent: string;
  /** id of the message being handled (becomes the causationId of anything it publishes). */
  messageId: string;
}

const storage = new AsyncLocalStorage<MessageContext>();

/** Run `fn` with `ctx` as the current message context. */
export function runWithContext<T>(ctx: MessageContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The context of the message currently being handled, if any. */
export function currentContext(): MessageContext | undefined {
  return storage.getStore();
}
