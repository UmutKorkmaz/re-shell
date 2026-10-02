import type { Role } from './auth.js';
import type { PolicySnapshot } from './policy.js';

/**
 * In-process tenant event bus. It carries two kinds of events:
 *
 *  - FORWARDED events that the SSE endpoint (`GET /tenants/:id/events`) sends to
 *    connected clients and workers: policy changes, new workspaces, job status.
 *  - INTERNAL events consumed by the server itself: a membership change (so open
 *    streams of a removed/demoted user are closed) and "a job was queued" (so
 *    long-polling workers wake up immediately).
 *
 * The bus is single-process by design (see docs/control-plane.md, "Remaining
 * limits"): horizontal scale-out would need a shared broker behind this same
 * interface.
 */

export interface PolicyUpdatedEvent {
  type: 'policy.updated';
  tenantId: string;
  /** What the admin changed. The full resulting state is always in `policy`. */
  change: { scope: 'tenant' | 'workspace'; workspaceId?: string };
  policy: PolicySnapshot;
  updatedBy: string;
}

export interface WorkspaceCreatedEvent {
  type: 'workspace.created';
  tenantId: string;
  workspace: { id: string; name: string; allowedCommandIds: string[] };
  createdBy: string;
}

export interface JobUpdatedEvent {
  type: 'job.updated';
  tenantId: string;
  job: {
    id: string;
    workspaceId: string;
    commandId: string;
    status: string;
    exitCode: number | null;
  };
}

/** INTERNAL: a membership was created, changed or removed (`role` null = removed). */
export interface MemberChangedEvent {
  type: 'member.changed';
  tenantId: string;
  userId: string;
  role: Role | null;
}

/** INTERNAL: a job entered the queue for this tenant. */
export interface JobQueuedEvent {
  type: 'job.queued';
  tenantId: string;
  jobId: string;
}

export type TenantEvent =
  | PolicyUpdatedEvent
  | WorkspaceCreatedEvent
  | JobUpdatedEvent
  | MemberChangedEvent
  | JobQueuedEvent;

export type ForwardedTenantEvent = PolicyUpdatedEvent | WorkspaceCreatedEvent | JobUpdatedEvent;

const FORWARDED_TYPES: ReadonlySet<TenantEvent['type']> = new Set([
  'policy.updated',
  'workspace.created',
  'job.updated',
]);

/** True for events that may be sent to SSE subscribers. */
export function isForwardedEvent(event: TenantEvent): event is ForwardedTenantEvent {
  return FORWARDED_TYPES.has(event.type);
}

export interface EventPublisher {
  publish(event: TenantEvent): void;
}

export type TenantEventListener = (event: TenantEvent) => void;

export class EventBus implements EventPublisher {
  private readonly listeners = new Map<string, Set<TenantEventListener>>();

  /** Subscribe to one tenant's events. Returns the unsubscribe function. */
  subscribe(tenantId: string, listener: TenantEventListener): () => void {
    let set = this.listeners.get(tenantId);
    if (!set) {
      set = new Set();
      this.listeners.set(tenantId, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(tenantId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(tenantId);
      }
    };
  }

  /** Deliver to every subscriber of the event's tenant. A throwing listener never blocks the rest. */
  publish(event: TenantEvent): void {
    const set = this.listeners.get(event.tenantId);
    if (!set) return;
    for (const listener of Array.from(set)) {
      try {
        listener(event);
      } catch {
        // Listener faults are isolated; the publisher must never fail because a
        // subscriber (e.g. a half-closed socket) threw.
      }
    }
  }

  /** Number of live subscribers for a tenant (test/diagnostic helper). */
  subscriberCount(tenantId: string): number {
    return this.listeners.get(tenantId)?.size ?? 0;
  }
}
