import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ContainerCommunicationTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Event Bus implementation
    files.push({
      path: 'src/communication/event-bus.ts',
      content: this.generateEventBus()
    });

    // Custom Events utility
    files.push({
      path: 'src/communication/custom-events.ts',
      content: this.generateCustomEvents()
    });

    // Broadcast Channel API
    files.push({
      path: 'src/communication/broadcast-channel.ts',
      content: this.generateBroadcastChannel()
    });

    // PostMessage communication
    files.push({
      path: 'src/communication/post-message.ts',
      content: this.generatePostMessage()
    });

    // Shared State (localStorage/sessionStorage)
    files.push({
      path: 'src/communication/shared-state.ts',
      content: this.generateSharedState()
    });

    // WebSocket communication
    files.push({
      path: 'src/communication/websocket-bridge.ts',
      content: this.generateWebSocketBridge()
    });

    // Server-Sent Events
    files.push({
      path: 'src/communication/sse-client.ts',
      content: this.generateSSEClient()
    });

    // Message Queue client (Redis Pub/Sub)
    files.push({
      path: 'src/communication/message-queue.ts',
      content: this.generateMessageQueue()
    });

    // Service Mesh communication
    files.push({
      path: 'src/communication/service-mesh.ts',
      content: this.generateServiceMesh()
    });

    // Docker Compose with message broker
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // Kubernetes ConfigMap for communication
    files.push({
      path: 'k8s/communication-config.yaml',
      content: this.generateK8sConfig()
    });

    // Types
    files.push({
      path: 'src/communication/types.ts',
      content: this.generateTypes()
    });

    // Index export
    files.push({
      path: 'src/communication/index.ts',
      content: this.generateIndex()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    return files;
  }

  private generateEventBus(): string {
    return `// Global Event Bus for Microfrontend Communication
// Works across containers via Custom Events + BroadcastChannel

import { CommunicationEvent, EventHandler, EventBusConfig } from './types';

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private config: EventBusConfig;
  private eventHistory: CommunicationEvent[] = [];
  private maxHistorySize = 100;

  constructor(config: EventBusConfig = {}) {
    this.config = {
      channelName: 'mf-event-bus',
      enableBroadcast: true,
      enableHistory: true,
      debug: false,
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    // Set up BroadcastChannel for cross-tab/cross-container communication
    if (this.config.enableBroadcast && typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(this.config.channelName!);
      this.broadcastChannel.onmessage = (event) => {
        this.handleBroadcastMessage(event.data);
      };
    }

    // Listen for custom events from other microfrontends
    window.addEventListener('mf-event', ((event: CustomEvent<CommunicationEvent>) => {
      this.handleIncomingEvent(event.detail);
    }) as EventListener);

    this.log('EventBus initialized');
  }

  // Emit event to all subscribers
  emit<T = unknown>(type: string, payload: T, options: { broadcast?: boolean; source?: string } = {}): void {
    const event: CommunicationEvent<T> = {
      type,
      payload,
      source: options.source || this.config.channelName || 'unknown',
      timestamp: Date.now(),
      id: this.generateId()
    };

    // Store in history
    if (this.config.enableHistory) {
      this.addToHistory(event);
    }

    // Notify local subscribers
    this.notifySubscribers(event);

    // Broadcast to other tabs/containers
    if (options.broadcast !== false && this.broadcastChannel) {
      this.broadcastChannel.postMessage(event);
    }

    // Dispatch as CustomEvent for iframe communication
    window.dispatchEvent(new CustomEvent('mf-event', { detail: event }));

    this.log('Event emitted:', type, payload);
  }

  // Subscribe to events
  on<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler as EventHandler);

    this.log('Subscribed to:', type);

    // Return unsubscribe function
    return () => this.off(type, handler);
  }

  // Subscribe to event once
  once<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    const wrappedHandler: EventHandler<T> = (event) => {
      handler(event);
      this.off(type, wrappedHandler);
    };

    return this.on(type, wrappedHandler);
  }

  // Unsubscribe from events
  off<T = unknown>(type: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }

    this.log('Unsubscribed from:', type);
  }

  // Subscribe to all events
  onAny(handler: EventHandler): () => void {
    return this.on('*', handler);
  }

  // Get event history
  getHistory(type?: string): CommunicationEvent[] {
    if (type) {
      return this.eventHistory.filter(e => e.type === type);
    }
    return [...this.eventHistory];
  }

  // Clear event history
  clearHistory(): void {
    this.eventHistory = [];
  }

  // Request-Response pattern
  async request<TRequest = unknown, TResponse = unknown>(
    type: string,
    payload: TRequest,
    timeout = 5000
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateId();
      const responseType = \`\${type}:response:\${requestId}\`;

      const timeoutId = setTimeout(() => {
        this.off(responseType, responseHandler);
        reject(new Error(\`Request timeout: \${type}\`));
      }, timeout);

      const responseHandler: EventHandler<TResponse> = (event) => {
        clearTimeout(timeoutId);
        this.off(responseType, responseHandler);
        resolve(event.payload);
      };

      this.on(responseType, responseHandler);
      this.emit(type, { ...payload as object, requestId }, { broadcast: true });
    });
  }

  // Respond to request
  respond<TRequest = unknown, TResponse = unknown>(
    type: string,
    handler: (payload: TRequest) => TResponse | Promise<TResponse>
  ): () => void {
    return this.on<TRequest & { requestId?: string }>(type, async (event) => {
      if (event.payload && (event.payload as any).requestId) {
        const { requestId, ...payload } = event.payload as any;
        try {
          const response = await handler(payload as TRequest);
          this.emit(\`\${type}:response:\${requestId}\`, response, {
            broadcast: true,
            source: event.source
          });
        } catch (error) {
          this.emit(\`\${type}:error:\${requestId}\`, { error: String(error) }, {
            broadcast: true
          });
        }
      }
    });
  }

  // Destroy the event bus
  destroy(): void {
    this.handlers.clear();
    this.eventHistory = [];

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.log('EventBus destroyed');
  }

  private handleBroadcastMessage(event: CommunicationEvent): void {
    this.handleIncomingEvent(event);
  }

  private handleIncomingEvent(event: CommunicationEvent): void {
    // Avoid infinite loops
    if (event.source === this.config.channelName) {
      return;
    }

    if (this.config.enableHistory) {
      this.addToHistory(event);
    }

    this.notifySubscribers(event);
  }

  private notifySubscribers(event: CommunicationEvent): void {
    // Notify specific type subscribers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }

    // Notify wildcard subscribers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Wildcard handler error:', error);
        }
      });
    }
  }

  private addToHistory(event: CommunicationEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private generateId(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[EventBus]', ...args);
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Factory function for custom instances
export function createEventBus(config?: EventBusConfig): EventBus {
  return new EventBus(config);
}

export default eventBus;
`;
  }

  private generateCustomEvents(): string {
    return `// Custom Events for Microfrontend Communication
// DOM-based event system for cross-component communication

import { CommunicationEvent } from './types';

// Event type constants
export const MF_EVENTS = {
  // Navigation
  NAVIGATE: 'mf:navigate',
  ROUTE_CHANGED: 'mf:route-changed',

  // Authentication
  AUTH_LOGIN: 'mf:auth:login',
  AUTH_LOGOUT: 'mf:auth:logout',
  AUTH_TOKEN_REFRESH: 'mf:auth:token-refresh',
  AUTH_STATE_CHANGED: 'mf:auth:state-changed',

  // User
  USER_UPDATED: 'mf:user:updated',
  USER_PREFERENCES_CHANGED: 'mf:user:preferences-changed',

  // Data
  DATA_UPDATED: 'mf:data:updated',
  DATA_INVALIDATE: 'mf:data:invalidate',
  DATA_SYNC: 'mf:data:sync',

  // UI
  THEME_CHANGED: 'mf:ui:theme-changed',
  LANGUAGE_CHANGED: 'mf:ui:language-changed',
  MODAL_OPEN: 'mf:ui:modal-open',
  MODAL_CLOSE: 'mf:ui:modal-close',
  TOAST_SHOW: 'mf:ui:toast-show',
  LOADING_START: 'mf:ui:loading-start',
  LOADING_END: 'mf:ui:loading-end',

  // Cart (e-commerce)
  CART_UPDATED: 'mf:cart:updated',
  CART_ITEM_ADDED: 'mf:cart:item-added',
  CART_ITEM_REMOVED: 'mf:cart:item-removed',

  // Error
  ERROR: 'mf:error',
  ERROR_BOUNDARY: 'mf:error:boundary',

  // Lifecycle
  MF_MOUNTED: 'mf:lifecycle:mounted',
  MF_UNMOUNTED: 'mf:lifecycle:unmounted',
  MF_READY: 'mf:lifecycle:ready'
} as const;

type EventType = typeof MF_EVENTS[keyof typeof MF_EVENTS];

// Emit custom event
export function emitEvent<T = unknown>(
  type: EventType | string,
  payload: T,
  target: EventTarget = window
): void {
  const event = new CustomEvent<CommunicationEvent<T>>(type, {
    detail: {
      type,
      payload,
      source: getMicrofrontendName(),
      timestamp: Date.now(),
      id: generateEventId()
    },
    bubbles: true,
    cancelable: true
  });

  target.dispatchEvent(event);
}

// Listen for custom event
export function onEvent<T = unknown>(
  type: EventType | string,
  handler: (event: CommunicationEvent<T>) => void,
  target: EventTarget = window
): () => void {
  const listener = ((e: CustomEvent<CommunicationEvent<T>>) => {
    handler(e.detail);
  }) as EventListener;

  target.addEventListener(type, listener);

  return () => target.removeEventListener(type, listener);
}

// Listen for event once
export function onceEvent<T = unknown>(
  type: EventType | string,
  handler: (event: CommunicationEvent<T>) => void,
  target: EventTarget = window
): () => void {
  const listener = ((e: CustomEvent<CommunicationEvent<T>>) => {
    handler(e.detail);
    target.removeEventListener(type, listener);
  }) as EventListener;

  target.addEventListener(type, listener);

  return () => target.removeEventListener(type, listener);
}

// Wait for event (Promise-based)
export function waitForEvent<T = unknown>(
  type: EventType | string,
  timeout = 10000,
  target: EventTarget = window
): Promise<CommunicationEvent<T>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(\`Timeout waiting for event: \${type}\`));
    }, timeout);

    onceEvent<T>(type, (event) => {
      clearTimeout(timeoutId);
      resolve(event);
    }, target);
  });
}

// Emit navigation event
export function navigate(path: string, state?: Record<string, unknown>): void {
  emitEvent(MF_EVENTS.NAVIGATE, { path, state });
}

// Emit auth events
export function emitAuthLogin(user: unknown): void {
  emitEvent(MF_EVENTS.AUTH_LOGIN, { user });
}

export function emitAuthLogout(): void {
  emitEvent(MF_EVENTS.AUTH_LOGOUT, {});
}

// Emit UI events
export function emitThemeChange(theme: 'light' | 'dark'): void {
  emitEvent(MF_EVENTS.THEME_CHANGED, { theme });
}

export function emitToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  emitEvent(MF_EVENTS.TOAST_SHOW, { message, type });
}

// Emit data events
export function emitDataUpdate(key: string, data: unknown): void {
  emitEvent(MF_EVENTS.DATA_UPDATED, { key, data });
}

export function emitDataInvalidate(keys: string[]): void {
  emitEvent(MF_EVENTS.DATA_INVALIDATE, { keys });
}

// Emit lifecycle events
export function emitMounted(name: string): void {
  emitEvent(MF_EVENTS.MF_MOUNTED, { name });
}

export function emitUnmounted(name: string): void {
  emitEvent(MF_EVENTS.MF_UNMOUNTED, { name });
}

export function emitReady(name: string): void {
  emitEvent(MF_EVENTS.MF_READY, { name });
}

// Helper functions
function getMicrofrontendName(): string {
  return (window as any).__MF_NAME__ || 'unknown';
}

function generateEventId(): string {
  return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
}

export default {
  emit: emitEvent,
  on: onEvent,
  once: onceEvent,
  waitFor: waitForEvent,
  MF_EVENTS
};
`;
  }

  private generateBroadcastChannel(): string {
    return `// BroadcastChannel API for Cross-Tab/Cross-Container Communication
// Enables communication between browser contexts sharing the same origin

import { CommunicationEvent, BroadcastChannelConfig } from './types';

class MicrofrontendBroadcastChannel {
  private channel: BroadcastChannel | null = null;
  private handlers: Map<string, Set<(event: CommunicationEvent) => void>> = new Map();
  private config: BroadcastChannelConfig;
  private isSupported: boolean;

  constructor(config: BroadcastChannelConfig = {}) {
    this.config = {
      channelName: 'mf-broadcast',
      onError: (error) => console.error('BroadcastChannel error:', error),
      ...config
    };

    this.isSupported = typeof BroadcastChannel !== 'undefined';

    if (this.isSupported) {
      this.initialize();
    } else {
      console.warn('BroadcastChannel not supported, falling back to localStorage events');
      this.initializeFallback();
    }
  }

  private initialize(): void {
    this.channel = new BroadcastChannel(this.config.channelName!);

    this.channel.onmessage = (event: MessageEvent<CommunicationEvent>) => {
      this.handleMessage(event.data);
    };

    this.channel.onmessageerror = (error) => {
      this.config.onError?.(error);
    };
  }

  private initializeFallback(): void {
    // Use localStorage events as fallback for older browsers
    window.addEventListener('storage', (event) => {
      if (event.key === this.config.channelName && event.newValue) {
        try {
          const data = JSON.parse(event.newValue) as CommunicationEvent;
          this.handleMessage(data);
        } catch (error) {
          this.config.onError?.(error);
        }
      }
    });
  }

  // Send message to all tabs/containers
  postMessage<T = unknown>(type: string, payload: T): void {
    const message: CommunicationEvent<T> = {
      type,
      payload,
      source: this.getSourceId(),
      timestamp: Date.now(),
      id: this.generateId()
    };

    if (this.channel) {
      this.channel.postMessage(message);
    } else {
      // Fallback to localStorage
      localStorage.setItem(this.config.channelName!, JSON.stringify(message));
      // Clean up immediately
      setTimeout(() => {
        localStorage.removeItem(this.config.channelName!);
      }, 100);
    }
  }

  // Subscribe to messages
  subscribe<T = unknown>(
    type: string,
    handler: (event: CommunicationEvent<T>) => void
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler as (event: CommunicationEvent) => void);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler as (event: CommunicationEvent) => void);
      }
    };
  }

  // Subscribe to all messages
  subscribeAll(handler: (event: CommunicationEvent) => void): () => void {
    return this.subscribe('*', handler);
  }

  // Close the channel
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.handlers.clear();
  }

  private handleMessage(event: CommunicationEvent): void {
    // Skip messages from self
    if (event.source === this.getSourceId()) {
      return;
    }

    // Notify type-specific handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          this.config.onError?.(error);
        }
      });
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          this.config.onError?.(error);
        }
      });
    }
  }

  private getSourceId(): string {
    // Unique identifier for this tab/container
    if (!(window as any).__MF_SOURCE_ID__) {
      (window as any).__MF_SOURCE_ID__ = \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
    }
    return (window as any).__MF_SOURCE_ID__;
  }

  private generateId(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  // Check if channel is supported
  get supported(): boolean {
    return this.isSupported;
  }
}

// Singleton instance
export const broadcastChannel = new MicrofrontendBroadcastChannel();

// Factory function
export function createBroadcastChannel(config?: BroadcastChannelConfig): MicrofrontendBroadcastChannel {
  return new MicrofrontendBroadcastChannel(config);
}

export default broadcastChannel;
`;
  }

  private generatePostMessage(): string {
    return `// PostMessage API for Cross-Origin Iframe Communication
// Enables secure communication between microfrontends in different iframes

import { CommunicationEvent, PostMessageConfig } from './types';

class PostMessageBridge {
  private handlers: Map<string, Set<(event: CommunicationEvent) => void>> = new Map();
  private config: PostMessageConfig;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(config: PostMessageConfig = {}) {
    this.config = {
      targetOrigin: '*',
      allowedOrigins: [],
      timeout: 5000,
      debug: false,
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  // Send message to parent window
  sendToParent<T = unknown>(type: string, payload: T): void {
    if (window.parent === window) {
      this.log('No parent window');
      return;
    }

    this.send(window.parent, type, payload);
  }

  // Send message to specific iframe
  sendToFrame<T = unknown>(frame: HTMLIFrameElement, type: string, payload: T): void {
    if (frame.contentWindow) {
      this.send(frame.contentWindow, type, payload);
    }
  }

  // Send message to all iframes
  broadcastToFrames<T = unknown>(type: string, payload: T): void {
    const frames = document.querySelectorAll('iframe');
    frames.forEach(frame => {
      if (frame.contentWindow) {
        this.send(frame.contentWindow, type, payload);
      }
    });
  }

  // Send message to specific window
  send<T = unknown>(target: Window, type: string, payload: T): void {
    const message: CommunicationEvent<T> = {
      type,
      payload,
      source: window.location.origin,
      timestamp: Date.now(),
      id: this.generateId()
    };

    target.postMessage(message, this.config.targetOrigin || '*');
    this.log('Sent:', type, payload);
  }

  // Request-Response pattern
  async request<TRequest = unknown, TResponse = unknown>(
    target: Window,
    type: string,
    payload: TRequest
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateId();

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(\`Request timeout: \${type}\`));
      }, this.config.timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.send(target, type, { ...payload as object, __requestId: requestId });
    });
  }

  // Respond to request
  respond<TResponse = unknown>(
    source: Window,
    requestId: string,
    response: TResponse
  ): void {
    this.send(source, '__response__', {
      __requestId: requestId,
      __response: response
    });
  }

  // Subscribe to messages
  on<T = unknown>(
    type: string,
    handler: (event: CommunicationEvent<T>, source: Window | null) => void
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const wrappedHandler = (event: CommunicationEvent) => {
      handler(event as CommunicationEvent<T>, event.source as unknown as Window);
    };

    this.handlers.get(type)!.add(wrappedHandler);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(wrappedHandler);
      }
    };
  }

  // Subscribe to all messages
  onAny(handler: (event: CommunicationEvent, source: Window | null) => void): () => void {
    return this.on('*', handler);
  }

  // Destroy the bridge
  destroy(): void {
    window.removeEventListener('message', this.handleMessage.bind(this));
    this.handlers.clear();
    this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingRequests.clear();
  }

  private handleMessage(event: MessageEvent): void {
    // Validate origin
    if (this.config.allowedOrigins && this.config.allowedOrigins.length > 0) {
      if (!this.config.allowedOrigins.includes(event.origin)) {
        this.log('Blocked message from:', event.origin);
        return;
      }
    }

    const data = event.data as CommunicationEvent;

    // Validate message format
    if (!data || typeof data.type !== 'string') {
      return;
    }

    this.log('Received:', data.type, data.payload);

    // Handle response messages
    if (data.type === '__response__' && data.payload) {
      const { __requestId, __response } = data.payload as any;
      const pending = this.pendingRequests.get(__requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(__response);
        this.pendingRequests.delete(__requestId);
      }
      return;
    }

    // Add source window reference
    const eventWithSource = {
      ...data,
      sourceWindow: event.source
    };

    // Notify handlers
    const handlers = this.handlers.get(data.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(eventWithSource);
        } catch (error) {
          console.error('PostMessage handler error:', error);
        }
      });
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(eventWithSource);
        } catch (error) {
          console.error('PostMessage wildcard handler error:', error);
        }
      });
    }
  }

  private generateId(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[PostMessage]', ...args);
    }
  }
}

// Singleton instance
export const postMessageBridge = new PostMessageBridge();

// Factory function
export function createPostMessageBridge(config?: PostMessageConfig): PostMessageBridge {
  return new PostMessageBridge(config);
}

export default postMessageBridge;
`;
  }

  private generateSharedState(): string {
    return `// Shared State Management for Microfrontends
// Uses localStorage/sessionStorage with synchronization

import { SharedStateConfig, StateChangeEvent } from './types';

class SharedState<T extends Record<string, unknown> = Record<string, unknown>> {
  private config: SharedStateConfig;
  private listeners: Map<string, Set<(value: unknown, oldValue: unknown) => void>> = new Map();
  private state: T;

  constructor(config: SharedStateConfig = {}) {
    this.config = {
      prefix: 'mf-state',
      storage: 'localStorage',
      syncInterval: 1000,
      ...config
    };

    this.state = this.loadState();
    this.initialize();
  }

  private initialize(): void {
    // Listen for storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith(this.config.prefix!)) {
        const key = event.key.replace(\`\${this.config.prefix}:\`, '');
        const newValue = event.newValue ? JSON.parse(event.newValue) : undefined;
        const oldValue = event.oldValue ? JSON.parse(event.oldValue) : undefined;

        this.state[key as keyof T] = newValue;
        this.notifyListeners(key, newValue, oldValue);
      }
    });

    // Periodic sync for sessionStorage (doesn't fire storage events)
    if (this.config.storage === 'sessionStorage' && this.config.syncInterval) {
      setInterval(() => this.syncState(), this.config.syncInterval);
    }
  }

  // Get value
  get<K extends keyof T>(key: K): T[K] | undefined {
    const storageKey = \`\${this.config.prefix}:\${String(key)}\`;
    const storage = this.getStorage();

    try {
      const value = storage.getItem(storageKey);
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  }

  // Set value
  set<K extends keyof T>(key: K, value: T[K]): void {
    const storageKey = \`\${this.config.prefix}:\${String(key)}\`;
    const storage = this.getStorage();
    const oldValue = this.state[key];

    try {
      storage.setItem(storageKey, JSON.stringify(value));
      this.state[key] = value;
      this.notifyListeners(String(key), value, oldValue);
    } catch (error) {
      console.error('SharedState set error:', error);
    }
  }

  // Remove value
  remove<K extends keyof T>(key: K): void {
    const storageKey = \`\${this.config.prefix}:\${String(key)}\`;
    const storage = this.getStorage();
    const oldValue = this.state[key];

    storage.removeItem(storageKey);
    delete this.state[key];
    this.notifyListeners(String(key), undefined, oldValue);
  }

  // Clear all shared state
  clear(): void {
    const storage = this.getStorage();
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(this.config.prefix!)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => storage.removeItem(key));
    this.state = {} as T;
  }

  // Subscribe to changes
  subscribe<K extends keyof T>(
    key: K,
    listener: (value: T[K] | undefined, oldValue: T[K] | undefined) => void
  ): () => void {
    const keyStr = String(key);

    if (!this.listeners.has(keyStr)) {
      this.listeners.set(keyStr, new Set());
    }

    this.listeners.get(keyStr)!.add(listener as (value: unknown, oldValue: unknown) => void);

    return () => {
      const listeners = this.listeners.get(keyStr);
      if (listeners) {
        listeners.delete(listener as (value: unknown, oldValue: unknown) => void);
      }
    };
  }

  // Subscribe to all changes
  subscribeAll(listener: (event: StateChangeEvent) => void): () => void {
    const wrappedListener = (value: unknown, oldValue: unknown, key?: string) => {
      listener({ key: key || '', value, oldValue });
    };

    return this.subscribe('*' as keyof T, wrappedListener as any);
  }

  // Get all state
  getAll(): T {
    return { ...this.state };
  }

  // Check if key exists
  has<K extends keyof T>(key: K): boolean {
    const storageKey = \`\${this.config.prefix}:\${String(key)}\`;
    return this.getStorage().getItem(storageKey) !== null;
  }

  private getStorage(): Storage {
    return this.config.storage === 'sessionStorage'
      ? sessionStorage
      : localStorage;
  }

  private loadState(): T {
    const storage = this.getStorage();
    const state: Record<string, unknown> = {};

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(this.config.prefix!)) {
        const stateKey = key.replace(\`\${this.config.prefix}:\`, '');
        try {
          state[stateKey] = JSON.parse(storage.getItem(key)!);
        } catch {
          // Ignore parse errors
        }
      }
    }

    return state as T;
  }

  private syncState(): void {
    const newState = this.loadState();

    Object.keys(newState).forEach(key => {
      if (JSON.stringify(this.state[key as keyof T]) !== JSON.stringify(newState[key as keyof T])) {
        const oldValue = this.state[key as keyof T];
        this.state[key as keyof T] = newState[key as keyof T];
        this.notifyListeners(key, newState[key as keyof T], oldValue);
      }
    });
  }

  private notifyListeners(key: string, value: unknown, oldValue: unknown): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(value, oldValue);
        } catch (error) {
          console.error('SharedState listener error:', error);
        }
      });
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => {
        try {
          (listener as (v: unknown, o: unknown, k: string) => void)(value, oldValue, key);
        } catch (error) {
          console.error('SharedState wildcard listener error:', error);
        }
      });
    }
  }
}

// Default instance
export const sharedState = new SharedState();

// Factory function
export function createSharedState<T extends Record<string, unknown>>(
  config?: SharedStateConfig
): SharedState<T> {
  return new SharedState<T>(config);
}

export default sharedState;
`;
  }

  private generateWebSocketBridge(): string {
    return `// WebSocket Bridge for Real-Time Communication
// Enables real-time updates across containers via WebSocket server

import { CommunicationEvent, WebSocketConfig } from './types';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

class WebSocketBridge {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private handlers: Map<string, Set<(event: CommunicationEvent) => void>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private state: ConnectionState = 'disconnected';
  private messageQueue: CommunicationEvent[] = [];

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    };
  }

  // Connect to WebSocket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === 'connected') {
        resolve();
        return;
      }

      this.state = 'connecting';

      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;

          // Send queued messages
          this.flushMessageQueue();

          // Start heartbeat
          this.startHeartbeat();

          // Authenticate if token provided
          if (this.config.authToken) {
            this.send('__auth__', { token: this.config.authToken });
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as CommunicationEvent;
            this.handleMessage(data);
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        };

        this.ws.onclose = () => {
          this.state = 'disconnected';
          this.stopHeartbeat();

          if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Send message
  send<T = unknown>(type: string, payload: T): void {
    const message: CommunicationEvent<T> = {
      type,
      payload,
      source: this.getSourceId(),
      timestamp: Date.now(),
      id: this.generateId()
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  // Subscribe to messages
  subscribe<T = unknown>(
    type: string,
    handler: (event: CommunicationEvent<T>) => void
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(handler as (event: CommunicationEvent) => void);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler as (event: CommunicationEvent) => void);
      }
    };
  }

  // Subscribe to all messages
  subscribeAll(handler: (event: CommunicationEvent) => void): () => void {
    return this.subscribe('*', handler);
  }

  // Join a room/channel
  joinRoom(room: string): void {
    this.send('__join__', { room });
  }

  // Leave a room/channel
  leaveRoom(room: string): void {
    this.send('__leave__', { room });
  }

  // Send to specific room
  sendToRoom<T = unknown>(room: string, type: string, payload: T): void {
    this.send('__room__', { room, type, payload });
  }

  // Disconnect
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.config.reconnect = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = 'disconnected';
    this.handlers.clear();
  }

  // Get connection state
  getState(): ConnectionState {
    return this.state;
  }

  // Check if connected
  isConnected(): boolean {
    return this.state === 'connected';
  }

  private handleMessage(event: CommunicationEvent): void {
    // Skip own messages
    if (event.source === this.getSourceId()) {
      return;
    }

    // Handle heartbeat response
    if (event.type === '__pong__') {
      return;
    }

    // Notify type-specific handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('WebSocket handler error:', error);
        }
      });
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('WebSocket wildcard handler error:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    this.reconnectAttempts++;

    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      console.log(\`WebSocket reconnecting (attempt \${this.reconnectAttempts})...\`);
      this.connect().catch(() => {
        // Will retry automatically
      });
    }, Math.min(delay, 30000));
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval) {
      this.heartbeatTimer = setInterval(() => {
        this.send('__ping__', { timestamp: Date.now() });
      }, this.config.heartbeatInterval);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private getSourceId(): string {
    if (!(window as any).__WS_SOURCE_ID__) {
      (window as any).__WS_SOURCE_ID__ = \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
    }
    return (window as any).__WS_SOURCE_ID__;
  }

  private generateId(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

// Factory function
export function createWebSocketBridge(config: WebSocketConfig): WebSocketBridge {
  return new WebSocketBridge(config);
}

export default WebSocketBridge;
`;
  }

  private generateSSEClient(): string {
    return `// Server-Sent Events Client for Unidirectional Real-Time Communication
// Ideal for receiving updates from server to microfrontends

import { CommunicationEvent, SSEConfig } from './types';

class SSEClient {
  private eventSource: EventSource | null = null;
  private config: SSEConfig;
  private handlers: Map<string, Set<(event: CommunicationEvent) => void>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: SSEConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      withCredentials: false,
      ...config
    };
  }

  // Connect to SSE endpoint
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = new URL(this.config.url);

    // Add query parameters
    if (this.config.params) {
      Object.entries(this.config.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    this.eventSource = new EventSource(url.toString(), {
      withCredentials: this.config.withCredentials
    });

    this.eventSource.onopen = () => {
      console.log('SSE connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
          this.scheduleReconnect();
        }
      }
    };

    // Listen for generic messages
    this.eventSource.onmessage = (event) => {
      this.handleMessage('message', event.data);
    };

    // Set up custom event listeners
    this.handlers.forEach((_, type) => {
      if (type !== '*' && type !== 'message') {
        this.addEventSourceListener(type);
      }
    });
  }

  // Subscribe to events
  subscribe<T = unknown>(
    type: string,
    handler: (event: CommunicationEvent<T>) => void
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());

      // Add listener to EventSource if connected
      if (this.eventSource && type !== '*' && type !== 'message') {
        this.addEventSourceListener(type);
      }
    }

    this.handlers.get(type)!.add(handler as (event: CommunicationEvent) => void);

    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler as (event: CommunicationEvent) => void);
      }
    };
  }

  // Subscribe to all events
  subscribeAll(handler: (event: CommunicationEvent) => void): () => void {
    return this.subscribe('*', handler);
  }

  // Disconnect
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  private addEventSourceListener(type: string): void {
    this.eventSource?.addEventListener(type, (event: MessageEvent) => {
      this.handleMessage(type, event.data);
    });
  }

  private handleMessage(type: string, data: string): void {
    let payload: unknown;

    try {
      payload = JSON.parse(data);
    } catch {
      payload = data;
    }

    const event: CommunicationEvent = {
      type,
      payload,
      source: 'server',
      timestamp: Date.now(),
      id: this.generateId()
    };

    // Notify type-specific handlers
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('SSE handler error:', error);
        }
      });
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('SSE wildcard handler error:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;

    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      console.log(\`SSE reconnecting (attempt \${this.reconnectAttempts})...\`);
      this.connect();
    }, Math.min(delay, 30000));
  }

  private generateId(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

// Factory function
export function createSSEClient(config: SSEConfig): SSEClient {
  return new SSEClient(config);
}

export default SSEClient;
`;
  }

  private generateMessageQueue(): string {
    return `// Message Queue Client for Backend Communication
// Connects frontend to Redis Pub/Sub or similar message brokers

import { CommunicationEvent, MessageQueueConfig } from './types';

class MessageQueueClient {
  private ws: WebSocket | null = null;
  private config: MessageQueueConfig;
  private subscriptions: Map<string, Set<(event: CommunicationEvent) => void>> = new Map();
  private connected = false;

  constructor(config: MessageQueueConfig) {
    this.config = {
      reconnect: true,
      reconnectInterval: 3000,
      ...config
    };
  }

  // Connect via WebSocket bridge to message queue
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.config.bridgeUrl || \`ws://\${window.location.host}/mq\`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;

        // Re-subscribe to channels
        this.subscriptions.forEach((_, channel) => {
          this.sendCommand('subscribe', { channel });
        });

        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('MQ message parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onclose = () => {
        this.connected = false;

        if (this.config.reconnect) {
          setTimeout(() => this.connect(), this.config.reconnectInterval);
        }
      };
    });
  }

  // Publish message to channel
  publish<T = unknown>(channel: string, payload: T): void {
    const message: CommunicationEvent<T> = {
      type: 'publish',
      payload: {
        channel,
        data: payload
      } as any,
      source: this.getSourceId(),
      timestamp: Date.now(),
      id: this.generateId()
    };

    this.sendCommand('publish', { channel, data: payload });
  }

  // Subscribe to channel
  subscribe<T = unknown>(
    channel: string,
    handler: (event: CommunicationEvent<T>) => void
  ): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());

      if (this.connected) {
        this.sendCommand('subscribe', { channel });
      }
    }

    this.subscriptions.get(channel)!.add(handler as (event: CommunicationEvent) => void);

    return () => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.delete(handler as (event: CommunicationEvent) => void);

        if (handlers.size === 0) {
          this.subscriptions.delete(channel);
          this.sendCommand('unsubscribe', { channel });
        }
      }
    };
  }

  // Subscribe to pattern
  psubscribe<T = unknown>(
    pattern: string,
    handler: (event: CommunicationEvent<T> & { channel: string }) => void
  ): () => void {
    const patternKey = \`pattern:\${pattern}\`;

    if (!this.subscriptions.has(patternKey)) {
      this.subscriptions.set(patternKey, new Set());

      if (this.connected) {
        this.sendCommand('psubscribe', { pattern });
      }
    }

    this.subscriptions.get(patternKey)!.add(handler as any);

    return () => {
      const handlers = this.subscriptions.get(patternKey);
      if (handlers) {
        handlers.delete(handler as any);

        if (handlers.size === 0) {
          this.subscriptions.delete(patternKey);
          this.sendCommand('punsubscribe', { pattern });
        }
      }
    };
  }

  // Disconnect
  disconnect(): void {
    if (this.ws) {
      this.config.reconnect = false;
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.connected = false;
  }

  // Check connection status
  isConnected(): boolean {
    return this.connected;
  }

  private handleMessage(message: any): void {
    const { type, channel, pattern, data } = message;

    if (type === 'message') {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        const event: CommunicationEvent = {
          type: channel,
          payload: data,
          source: 'mq',
          timestamp: Date.now(),
          id: this.generateId()
        };

        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error('MQ handler error:', error);
          }
        });
      }
    } else if (type === 'pmessage') {
      const patternKey = \`pattern:\${pattern}\`;
      const handlers = this.subscriptions.get(patternKey);
      if (handlers) {
        const event = {
          type: pattern,
          payload: data,
          source: 'mq',
          timestamp: Date.now(),
          id: this.generateId(),
          channel
        };

        handlers.forEach(handler => {
          try {
            (handler as any)(event);
          } catch (error) {
            console.error('MQ pattern handler error:', error);
          }
        });
      }
    }
  }

  private sendCommand(command: string, data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ command, ...data }));
    }
  }

  private getSourceId(): string {
    if (!(window as any).__MQ_SOURCE_ID__) {
      (window as any).__MQ_SOURCE_ID__ = \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
    }
    return (window as any).__MQ_SOURCE_ID__;
  }

  private generateId(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

// Factory function
export function createMessageQueueClient(config: MessageQueueConfig): MessageQueueClient {
  return new MessageQueueClient(config);
}

export default MessageQueueClient;
`;
  }

  private generateServiceMesh(): string {
    return `// Service Mesh Communication Utilities
// Helpers for Istio/Linkerd service mesh environments

import { ServiceMeshConfig, ServiceDiscoveryResult } from './types';

class ServiceMeshClient {
  private config: ServiceMeshConfig;
  private serviceCache: Map<string, ServiceDiscoveryResult> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor(config: ServiceMeshConfig = {}) {
    this.config = {
      meshType: 'istio',
      namespace: 'default',
      cacheTTL: 60000, // 1 minute
      retries: 3,
      timeout: 5000,
      ...config
    };
  }

  // Discover service endpoint
  async discoverService(serviceName: string): Promise<ServiceDiscoveryResult> {
    // Check cache
    const cached = this.serviceCache.get(serviceName);
    const expiry = this.cacheExpiry.get(serviceName);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Build service URL based on mesh type
    const result = this.buildServiceUrl(serviceName);

    // Cache result
    this.serviceCache.set(serviceName, result);
    this.cacheExpiry.set(serviceName, Date.now() + this.config.cacheTTL!);

    return result;
  }

  // Make request to service with retry and circuit breaker
  async request<T = unknown>(
    serviceName: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const service = await this.discoverService(serviceName);
    const url = \`\${service.url}\${path}\`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...this.getMeshHeaders(),
            ...options.headers
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors
        if ((error as any).name === 'AbortError') {
          throw new Error(\`Request timeout after \${this.config.timeout}ms\`);
        }

        if (attempt < this.config.retries!) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  // Get service health
  async getServiceHealth(serviceName: string): Promise<{
    healthy: boolean;
    latency: number;
    details?: Record<string, unknown>;
  }> {
    const service = await this.discoverService(serviceName);
    const startTime = Date.now();

    try {
      const response = await fetch(\`\${service.url}/health\`, {
        method: 'GET',
        headers: this.getMeshHeaders()
      });

      const latency = Date.now() - startTime;

      return {
        healthy: response.ok,
        latency,
        details: response.ok ? await response.json() : undefined
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - startTime
      };
    }
  }

  // List all services in namespace
  async listServices(): Promise<string[]> {
    // In a real implementation, this would query the service mesh API
    // For now, return cached services
    return Array.from(this.serviceCache.keys());
  }

  private buildServiceUrl(serviceName: string): ServiceDiscoveryResult {
    const { namespace, meshType } = this.config;

    // Kubernetes/Istio service DNS format
    let url: string;

    if (meshType === 'istio' || meshType === 'linkerd') {
      // Standard Kubernetes service DNS
      url = \`http://\${serviceName}.\${namespace}.svc.cluster.local\`;
    } else {
      // Default to localhost for development
      url = \`http://\${serviceName}\`;
    }

    return {
      name: serviceName,
      url,
      namespace: namespace!,
      meshType: meshType!
    };
  }

  private getMeshHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Istio distributed tracing headers
    if (this.config.meshType === 'istio') {
      // These would typically be propagated from incoming requests
      const traceId = this.getTraceId();
      if (traceId) {
        headers['x-request-id'] = traceId;
        headers['x-b3-traceid'] = traceId;
        headers['x-b3-spanid'] = this.generateSpanId();
        headers['x-b3-sampled'] = '1';
      }
    }

    // Linkerd headers
    if (this.config.meshType === 'linkerd') {
      headers['l5d-ctx-trace'] = this.getTraceId() || this.generateSpanId();
    }

    return headers;
  }

  private getTraceId(): string | null {
    // Try to get existing trace ID from window
    return (window as any).__TRACE_ID__ || null;
  }

  private generateSpanId(): string {
    return Math.random().toString(16).substr(2, 16);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export function createServiceMeshClient(config?: ServiceMeshConfig): ServiceMeshClient {
  return new ServiceMeshClient(config);
}

// Helper to set trace ID from incoming request
export function setTraceId(traceId: string): void {
  (window as any).__TRACE_ID__ = traceId;
}

export default ServiceMeshClient;
`;
  }

  private generateDockerCompose(): string {
    return `version: '3.8'

services:
  # Redis for Pub/Sub messaging
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - mf-network

  # WebSocket bridge for message queue
  mq-bridge:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./mq-bridge:/app
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=8080
    depends_on:
      - redis
    command: node server.js
    networks:
      - mf-network

  # SSE server for push updates
  sse-server:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./sse-server:/app
    ports:
      - "8081:8081"
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=8081
    depends_on:
      - redis
    command: node server.js
    networks:
      - mf-network

  # Host microfrontend
  host:
    build: ./host
    ports:
      - "3000:3000"
    environment:
      - MF_NAME=host
      - WS_URL=ws://localhost:8080
      - SSE_URL=http://localhost:8081/events
    networks:
      - mf-network

  # Header microfrontend
  mf-header:
    build: ./remotes/header
    ports:
      - "3001:3001"
    environment:
      - MF_NAME=header
      - WS_URL=ws://mq-bridge:8080
      - SSE_URL=http://sse-server:8081/events
    networks:
      - mf-network

  # Footer microfrontend
  mf-footer:
    build: ./remotes/footer
    ports:
      - "3002:3002"
    environment:
      - MF_NAME=footer
      - WS_URL=ws://mq-bridge:8080
      - SSE_URL=http://sse-server:8081/events
    networks:
      - mf-network

networks:
  mf-network:
    driver: bridge

volumes:
  redis-data:
`;
  }

  private generateK8sConfig(): string {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: mf-communication-config
  namespace: microfrontends
data:
  # Event bus configuration
  EVENT_BUS_CHANNEL: "mf-event-bus"

  # WebSocket bridge URL
  WS_BRIDGE_URL: "ws://mq-bridge.microfrontends.svc.cluster.local:8080"

  # SSE server URL
  SSE_SERVER_URL: "http://sse-server.microfrontends.svc.cluster.local:8081/events"

  # Redis URL for message queue
  REDIS_URL: "redis://redis.microfrontends.svc.cluster.local:6379"

  # Service mesh settings
  SERVICE_MESH_TYPE: "istio"
  SERVICE_MESH_NAMESPACE: "microfrontends"

---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: microfrontends
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: microfrontends
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: mq-bridge
  namespace: microfrontends
spec:
  selector:
    app: mq-bridge
  ports:
    - port: 8080
      targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mq-bridge
  namespace: microfrontends
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mq-bridge
  template:
    metadata:
      labels:
        app: mq-bridge
    spec:
      containers:
        - name: mq-bridge
          image: mq-bridge:latest
          ports:
            - containerPort: 8080
          env:
            - name: REDIS_URL
              valueFrom:
                configMapKeyRef:
                  name: mf-communication-config
                  key: REDIS_URL
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
`;
  }

  private generateTypes(): string {
    return `// Types for Container Communication

export interface CommunicationEvent<T = unknown> {
  type: string;
  payload: T;
  source: string;
  timestamp: number;
  id: string;
}

export type EventHandler<T = unknown> = (event: CommunicationEvent<T>) => void;

export interface EventBusConfig {
  channelName?: string;
  enableBroadcast?: boolean;
  enableHistory?: boolean;
  debug?: boolean;
}

export interface BroadcastChannelConfig {
  channelName?: string;
  onError?: (error: unknown) => void;
}

export interface PostMessageConfig {
  targetOrigin?: string;
  allowedOrigins?: string[];
  timeout?: number;
  debug?: boolean;
}

export interface SharedStateConfig {
  prefix?: string;
  storage?: 'localStorage' | 'sessionStorage';
  syncInterval?: number;
}

export interface StateChangeEvent {
  key: string;
  value: unknown;
  oldValue: unknown;
}

export interface WebSocketConfig {
  url: string;
  authToken?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface SSEConfig {
  url: string;
  params?: Record<string, string | number>;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  withCredentials?: boolean;
}

export interface MessageQueueConfig {
  bridgeUrl?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export interface ServiceMeshConfig {
  meshType?: 'istio' | 'linkerd' | 'none';
  namespace?: string;
  cacheTTL?: number;
  retries?: number;
  timeout?: number;
}

export interface ServiceDiscoveryResult {
  name: string;
  url: string;
  namespace: string;
  meshType: string;
}
`;
  }

  private generateIndex(): string {
    return `// Container Communication Module
// Export all communication utilities

export { eventBus, createEventBus } from './event-bus';
export { default as customEvents, MF_EVENTS, emitEvent, onEvent } from './custom-events';
export { broadcastChannel, createBroadcastChannel } from './broadcast-channel';
export { postMessageBridge, createPostMessageBridge } from './post-message';
export { sharedState, createSharedState } from './shared-state';
export { default as WebSocketBridge, createWebSocketBridge } from './websocket-bridge';
export { default as SSEClient, createSSEClient } from './sse-client';
export { default as MessageQueueClient, createMessageQueueClient } from './message-queue';
export { default as ServiceMeshClient, createServiceMeshClient, setTraceId } from './service-mesh';
export * from './types';
`;
  }

  protected generateReadme(): string {
    return `# Container-to-Container Frontend Communication

Communication patterns for microfrontend containers.

## Communication Methods

| Method | Use Case | Cross-Tab | Cross-Origin | Real-Time |
|--------|----------|-----------|--------------|-----------|
| Event Bus | General events | Yes | No | No |
| Custom Events | DOM-based | No | No | No |
| BroadcastChannel | Cross-tab | Yes | No | No |
| PostMessage | Iframes | No | Yes | No |
| Shared State | State sync | Yes | No | No |
| WebSocket | Real-time | Yes | Yes | Yes |
| SSE | Server push | Yes | Yes | Yes |
| Message Queue | Backend | Yes | Yes | Yes |

## Quick Start

### Event Bus (Recommended for most cases)

\`\`\`typescript
import { eventBus } from './communication';

// Emit event
eventBus.emit('user:login', { userId: '123' });

// Subscribe to event
const unsubscribe = eventBus.on('user:login', (event) => {
  console.log('User logged in:', event.payload);
});

// Request-Response pattern
const response = await eventBus.request('get:user', { id: '123' });
\`\`\`

### Custom Events

\`\`\`typescript
import { emitEvent, onEvent, MF_EVENTS } from './communication';

// Emit navigation event
emitEvent(MF_EVENTS.NAVIGATE, { path: '/dashboard' });

// Listen for auth events
onEvent(MF_EVENTS.AUTH_LOGIN, (event) => {
  console.log('User:', event.payload.user);
});
\`\`\`

### BroadcastChannel (Cross-Tab)

\`\`\`typescript
import { broadcastChannel } from './communication';

// Send to all tabs
broadcastChannel.postMessage('cart:updated', { items: 5 });

// Subscribe
broadcastChannel.subscribe('cart:updated', (event) => {
  updateCartBadge(event.payload.items);
});
\`\`\`

### PostMessage (Iframes)

\`\`\`typescript
import { postMessageBridge } from './communication';

// Send to parent
postMessageBridge.sendToParent('ready', { name: 'header-mf' });

// Send to iframe
const iframe = document.getElementById('footer-frame');
postMessageBridge.sendToFrame(iframe, 'theme:change', { theme: 'dark' });

// Request-Response
const data = await postMessageBridge.request(iframe.contentWindow, 'get:data', {});
\`\`\`

### Shared State

\`\`\`typescript
import { sharedState } from './communication';

// Set state
sharedState.set('user', { name: 'John', role: 'admin' });

// Get state
const user = sharedState.get('user');

// Subscribe to changes
sharedState.subscribe('user', (value, oldValue) => {
  console.log('User changed:', value);
});
\`\`\`

### WebSocket (Real-Time)

\`\`\`typescript
import { createWebSocketBridge } from './communication';

const ws = createWebSocketBridge({
  url: 'ws://localhost:8080',
  authToken: 'jwt-token'
});

await ws.connect();

// Join room
ws.joinRoom('dashboard');

// Send message
ws.send('notification', { message: 'Hello!' });

// Subscribe
ws.subscribe('notification', (event) => {
  showNotification(event.payload.message);
});
\`\`\`

### Server-Sent Events

\`\`\`typescript
import { createSSEClient } from './communication';

const sse = createSSEClient({
  url: '/api/events',
  params: { userId: '123' }
});

sse.connect();

sse.subscribe('update', (event) => {
  console.log('Update:', event.payload);
});
\`\`\`

## Docker Setup

\`\`\`bash
docker-compose up -d
\`\`\`

This starts:
- Redis for message queue
- WebSocket bridge on port 8080
- SSE server on port 8081

## Best Practices

1. **Use Event Bus** for general microfrontend communication
2. **Use Custom Events** for framework-agnostic DOM communication
3. **Use BroadcastChannel** for cross-tab state synchronization
4. **Use PostMessage** for iframe-based microfrontends
5. **Use WebSocket/SSE** for real-time server updates
6. **Use Message Queue** for reliable backend communication

## License

MIT
`;
  }
}
