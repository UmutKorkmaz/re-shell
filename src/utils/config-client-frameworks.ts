/**
 * Framework-Specific Configuration Client SDKs
 * Provides type definitions and utilities for React, Vue, Angular, and Svelte
 * for shared configuration management with hot-reload
 */

import type { ConfigClient, ConfigChangeEvent } from './shared-config';

// ============================================================================
// React Hooks (TypeScript definitions)
// ============================================================================

export interface UseConfigReturn {
  config: Record<string, unknown>;
  loading: boolean;
  get: <T = unknown>(key: string) => T;
  set: (key: string, value: unknown) => void;
  setMany: (values: Record<string, unknown>) => void;
  refresh: () => void;
  reset: () => void;
  has: (key: string) => boolean;
  validate: () => void;
}

/**
 * React hook for configuration management
 * Usage:
 * ```tsx
 * import { useConfig } from '@re-shell/config-client';
 * import { createConfigClient } from '@re-shell/config-client';
 *
 * const client = createConfigClient('ws://localhost:3001');
 *
 * function App() {
 *   const { config, get, set } = useConfig(client);
 *   const theme = get('theme');
 *   return <div>{theme}</div>;
 * }
 * ```
 */
export function generateReactHook(): string {
  return `
import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import type { ConfigClient } from '@re-shell/shared-config';

interface ConfigContextValue {
  config: Record<string, unknown>;
  loading: boolean;
  get: <T = unknown>(key: string) => T;
  set: (key: string, value: unknown) => void;
  setMany: (values: Record<string, unknown>) => void;
  refresh: () => void;
  reset: () => void;
  has: (key: string) => boolean;
  validate: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ client, children }: { client: ConfigClient; children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = client.onChange((event) => {
      setConfig((prev) => ({
        ...prev,
        [event.key]: event.newValue,
      }));
    });

    client.connect()
      .then(() => {
        setConfig(client.getAll());
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to connect to config server:', error);
        setLoading(false);
      });

    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [client]);

  const get = useCallback(<T = unknown>(key: string): T => {
    return config[key] as T;
  }, [config]);

  const set = useCallback((key: string, value: unknown) => {
    client.set(key, value);
  }, [client]);

  const setMany = useCallback((values: Record<string, unknown>) => {
    client.setMany(values);
  }, [client]);

  const refresh = useCallback(() => {
    client.refresh();
    setConfig(client.getAll());
  }, [client]);

  const reset = useCallback(() => {
    client.reset();
  }, [client]);

  const has = useCallback((key: string) => {
    return key in config;
  }, [config]);

  const validate = useCallback(() => {
    client.validate();
  }, [client]);

  const value: ConfigContextValue = {
    config,
    loading,
    get,
    set,
    setMany,
    refresh,
    reset,
    has,
    validate,
  };

  return React.createElement(ConfigContext.Provider, { value }, children);
}

export function useConfig(client?: ConfigClient): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (context) {
    return context;
  }
  if (!client) {
    throw new Error('useConfig must be used within a ConfigProvider or with a client argument');
  }

  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = client.onChange((event) => {
      setConfig((prev) => ({
        ...prev,
        [event.key]: event.newValue,
      }));
    });

    client.connect()
      .then(() => {
        setConfig(client.getAll());
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to connect to config server:', error);
        setLoading(false);
      });

    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [client]);

  const get = useCallback(<T = unknown>(key: string): T => {
    return config[key] as T;
  }, [config]);

  const set = useCallback((key: string, value: unknown) => {
    client.set(key, value);
  }, [client]);

  const setMany = useCallback((values: Record<string, unknown>) => {
    client.setMany(values);
  }, [client]);

  const refresh = useCallback(() => {
    client.refresh();
    setConfig(client.getAll());
  }, [client]);

  const reset = useCallback(() => {
    client.reset();
  }, [client]);

  const has = useCallback((key: string) => {
    return key in config;
  }, [config]);

  const validate = useCallback(() => {
    client.validate();
  }, [client]);

  return {
    config,
    loading,
    get,
    set,
    setMany,
    refresh,
    reset,
    has,
    validate,
  };
}
`;
}

// ============================================================================
// Vue Composables (TypeScript definitions)
// ============================================================================

export interface UseConfigVueReturn {
  config: Readonly<Record<string, unknown>>;
  loading: { value: boolean };
  get: <T = unknown>(key: string) => T;
  set: (key: string, value: unknown) => void;
  setMany: (values: Record<string, unknown>) => void;
  refresh: () => void;
  reset: () => void;
  has: (key: string) => boolean;
  validate: () => void;
}

/**
 * Vue composable for configuration management
 * Usage:
 * ```vue
 * <script setup lang="ts">
 * import { useConfig } from '@re-shell/config-client';
 * import { createConfigClient } from '@re-shell/config-client';
 *
 * const client = createConfigClient('ws://localhost:3001');
 * const { config, get, set } = useConfig(client);
 * const theme = get('theme');
 * </script>
 * ```
 */
export function generateVueComposable(): string {
  return `
import { ref, reactive, onUnmounted, readonly, type Ref } from 'vue';
import type { ConfigClient } from '@re-shell/shared-config';

export function useConfig(client: ConfigClient) {
  const config = reactive<Record<string, unknown>>({});
  const loading = ref(true);

  const unsubscribe = client.onChange((event) => {
    config[event.key] = event.newValue;
  });

  client.connect()
    .then(() => {
      Object.assign(config, client.getAll());
      loading.value = false;
    })
    .catch((error) => {
      console.error('Failed to connect to config server:', error);
      loading.value = false;
    });

  onUnmounted(() => {
    unsubscribe();
    client.disconnect();
  });

  const get = <T = unknown>(key: string): T => {
    return config[key] as T;
  };

  const set = (key: string, value: unknown) => {
    client.set(key, value);
  };

  const setMany = (values: Record<string, unknown>) => {
    client.setMany(values);
  };

  const refresh = () => {
    client.refresh();
    Object.assign(config, client.getAll());
  };

  const reset = () => {
    client.reset();
  };

  const has = (key: string): boolean => {
    return key in config;
  };

  const validate = () => {
    client.validate();
  };

  return {
    config: readonly(config),
    loading,
    get,
    set,
    setMany,
    refresh,
    reset,
    has,
    validate,
  };
}
`;
}

// ============================================================================
// Angular Service (TypeScript definitions)
// ============================================================================

/**
 * Angular service for configuration management
 * Usage:
 * ```typescript
 * import { Injectable } from '@angular/core';
 * import { ConfigService } from '@re-shell/config-client';
 *
 * @Component({
 *   selector: 'app-root',
 *   template: \`<div>{{ theme }}</div>\`,
 * })
 * export class AppComponent {
 *   theme = this.configService.get('theme');
 *   constructor(private configService: ConfigService) {}
 * }
 * ```
 */
export function generateAngularService(): string {
  return `
import { Injectable, NgZone, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { ConfigClient } from '@re-shell/shared-config';

@Injectable({
  providedIn: 'root',
})
export class ConfigService implements OnDestroy, OnInit {
  private configSubject = new BehaviorSubject<Record<string, unknown>>({});
  private loadingSubject = new BehaviorSubject<boolean>(true);
  public config$ = this.configSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private client: ConfigClient,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.client.onChange((event) => {
      this.ngZone.run(() => {
        const current = this.configSubject.value;
        this.configSubject.next({
          ...current,
          [event.key]: event.newValue,
        });
      });
    });

    this.client.connect()
      .then(() => {
        this.ngZone.run(() => {
          this.configSubject.next(this.client.getAll());
          this.loadingSubject.next(false);
        });
      })
      .catch((error) => {
        console.error('Failed to connect to config server:', error);
        this.ngZone.run(() => {
          this.loadingSubject.next(false);
        });
      });
  }

  ngOnDestroy(): void {
    this.client.disconnect();
  }

  get<T = unknown>(key: string): T {
    return this.configSubject.value[key] as T;
  }

  set(key: string, value: unknown): void {
    this.client.set(key, value);
  }

  setMany(values: Record<string, unknown>): void {
    this.client.setMany(values);
  }

  refresh(): void {
    this.client.refresh();
    this.configSubject.next(this.client.getAll());
  }

  reset(): void {
    this.client.reset();
  }

  has(key: string): boolean {
    return key in this.configSubject.value;
  }

  validate(): void {
    this.client.validate();
  }

  getConfig(): Observable<Record<string, unknown>> {
    return this.config$;
  }

  getLoading(): Observable<boolean> {
    return this.loading$;
  }
}
`;
}

// ============================================================================
// Svelte Stores (TypeScript definitions)
// ============================================================================

/**
 * Svelte store for configuration management
 * Usage:
 * ```svelte
 * <script lang="ts">
 * import { createConfigStore } from '@re-shell/config-client';
 * import { createConfigClient } from '@re-shell/config-client';
 *
 * const client = createConfigClient('ws://localhost:3001');
 * const config = createConfigStore(client);
 *
 * const theme = config.get('theme');
 * </script>
 *
 * <div>{$theme}</div>
 * ```
 */
export function generateSvelteStore(): string {
  return `
import { writable, derived, readonly } from 'svelte/store';
import type { ConfigClient } from '@re-shell/shared-config';

export interface ConfigStore {
  subscribe: (callback: (value: Record<string, unknown>) => void) => () => void;
  get: <T = unknown>(key: string) => T;
  set: (key: string, value: unknown) => void;
  setMany: (values: Record<string, unknown>) => void;
  refresh: () => void;
  reset: () => void;
  has: (key: string) => boolean;
  validate: () => void;
}

export function createConfigStore(client: ConfigClient): ConfigStore {
  const { subscribe, set, update } = writable<Record<string, unknown>>({});
  const loading = writable(true);

  // Subscribe to config changes
  const unsubscribe = client.onChange((event) => {
    update((config) => ({
      ...config,
      [event.key]: event.newValue,
    }));
  });

  // Connect to server
  client.connect()
    .then(() => {
      set(client.getAll());
      loading.set(false);
    })
    .catch((error) => {
      console.error('Failed to connect to config server:', error);
      loading.set(false);
    });

  // Store methods
  const get = <T = unknown>(key: string): T => {
    let value: T;
    const unsubscribe = subscribe((config) => {
      value = config[key] as T;
    })();
    unsubscribe();
    return value!;
  };

  const setKey = (key: string, value: unknown) => {
    client.set(key, value);
  };

  const setMany = (values: Record<string, unknown>) => {
    client.setMany(values);
  };

  const refresh = () => {
    client.refresh();
    set(client.getAll());
  };

  const reset = () => {
    client.reset();
  };

  const has = (key: string): boolean => {
    let exists = false;
    const unsubscribe = subscribe((config) => {
      exists = key in config;
    })();
    unsubscribe();
    return exists;
  };

  const validate = () => {
    client.validate();
  };

  return {
    subscribe,
    get,
    set: setKey,
    setMany,
    refresh,
    reset,
    has,
    validate,
  };
}
`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a config client instance with auto-reconnect
 */
export function createConfigClient(url: string): ConfigClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return new (require('./shared-config').ConfigClient)(url);
}

/**
 * Watch a specific config key for changes
 */
export function watchConfigKey(
  client: ConfigClient,
  key: string,
  callback: (value: unknown) => void,
): () => void {
  const unsubscribe = client.onChange((event) => {
    if (event.key === key) {
      callback(event.newValue);
    }
  });

  // Call immediately with current value
  callback(client.get(key));

  return unsubscribe;
}

/**
 * Batch multiple config updates
 */
export async function batchConfigUpdates(
  client: ConfigClient,
  updates: Array<{ key: string; value: unknown }>,
): Promise<void> {
  const values: Record<string, unknown> = {};
  for (const { key, value } of updates) {
    values[key] = value;
  }
  client.setMany(values);
}

/**
 * Get config with fallback to default value
 */
export function getConfigWithDefault<T>(
  client: ConfigClient,
  key: string,
  defaultValue: T,
): T {
  try {
    return client.get<T>(key);
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for string config values
 */
export function isStringConfig(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for number config values
 */
export function isNumberConfig(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Type guard for boolean config values
 */
export function isBooleanConfig(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for object config values
 */
export function isObjectConfig(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for array config values
 */
export function isArrayConfig(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================================================
// Re-exports
// ============================================================================

export type { ConfigClient, ConfigChangeEvent } from './shared-config';
export type { ConfigValue, ConfigSchema, ConfigChangeListener } from './shared-config';
