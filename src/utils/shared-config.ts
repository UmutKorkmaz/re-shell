/**
 * Shared Configuration Management System
 * Provides real-time configuration synchronization between frontend and backend services
 * with hot-reload capabilities via WebSocket
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';

export interface ConfigValue {
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  defaultValue?: unknown;
  validation?: (value: unknown) => boolean | string;
  description?: string;
  env?: string; // Environment variable override
}

export interface ConfigSchema {
  [key: string]: ConfigValue;
}

export interface ConfigChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  source: 'server' | 'file' | 'client' | 'env';
}

export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

export class ConfigManager {
  private config: Record<string, unknown> = {};
  private schema: ConfigSchema = {};
  private listeners: Set<ConfigChangeListener> = new Set();
  private fileWatcher?: chokidar.FSWatcher;
  private configPath: string;

  constructor(configPath: string, schema: ConfigSchema = {}) {
    this.configPath = configPath;
    this.schema = schema;
    this.loadConfig();
    this.loadEnvironmentOverrides();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(content);
      } else {
        this.config = {};
      }
    } catch (error) {
      console.error(`Failed to load config from ${this.configPath}:`, error);
      this.config = {};
    }
  }

  /**
   * Load environment variable overrides
   */
  private loadEnvironmentOverrides(): void {
    for (const [key, schema] of Object.entries(this.schema)) {
      if (schema.env && process.env[schema.env] !== undefined) {
        this.config[key] = this.parseValue(process.env[schema.env]!, schema.type);
      }
    }
  }

  /**
   * Parse value based on type
   */
  private parseValue(value: string, type: ConfigValue['type']): unknown {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'object':
      case 'array':
        return JSON.parse(value);
      default:
        return value;
    }
  }

  /**
   * Get configuration value
   */
  get<T = unknown>(key: string): T {
    if (key in this.config) {
      return this.config[key] as T;
    }

    // Return default value from schema
    if (key in this.schema && this.schema[key].defaultValue !== undefined) {
      return this.schema[key].defaultValue as T;
    }

    throw new Error(`Configuration key "${key}" not found`);
  }

  /**
   * Set configuration value
   */
  set(key: string, value: unknown, source: ConfigChangeEvent['source'] = 'client'): void {
    const oldValue = this.config[key];
    const newValue = value;

    // Validate against schema
    if (key in this.schema) {
      const schema = this.schema[key];
      const validation = schema.validation?.(newValue);
      if (validation !== true && validation !== undefined) {
        throw new Error(`Validation failed for "${key}": ${validation}`);
      }
    }

    this.config[key] = newValue;

    // Notify listeners
    const event: ConfigChangeEvent = {
      key,
      oldValue,
      newValue,
      timestamp: Date.now(),
      source,
    };
    this.notifyListeners(event);

    // Persist to file
    this.saveConfig();
  }

  /**
   * Set multiple configuration values
   */
  setMany(values: Record<string, unknown>, source: ConfigChangeEvent['source'] = 'client'): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value, source);
    }
  }

  /**
   * Check if configuration key exists
   */
  has(key: string): boolean {
    return key in this.config || key in this.schema;
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Subscribe to configuration changes
   */
  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of configuration change
   */
  private notifyListeners(event: ConfigChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Config change listener error:`, error);
      }
    });
  }

  /**
   * Save configuration to file
   */
  private saveConfig(): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(`Failed to save config to ${this.configPath}:`, error);
    }
  }

  /**
   * Start watching configuration file for changes
   */
  watch(): void {
    if (this.fileWatcher) {
      return;
    }

    this.fileWatcher = chokidar.watch(this.configPath).on('change', () => {
      const oldConfig = { ...this.config };
      this.loadConfig();
      this.loadEnvironmentOverrides();

      // Detect and emit changes
      for (const key of Object.keys({ ...oldConfig, ...this.config })) {
        if (oldConfig[key] !== this.config[key]) {
          const event: ConfigChangeEvent = {
            key,
            oldValue: oldConfig[key],
            newValue: this.config[key],
            timestamp: Date.now(),
            source: 'file',
          };
          this.notifyListeners(event);
        }
      }
    });
  }

  /**
   * Stop watching configuration file
   */
  unwatch(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }
  }

  /**
   * Validate current configuration against schema
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, schema] of Object.entries(this.schema)) {
      // Check required fields
      if (schema.required && !(key in this.config)) {
        errors.push(`Required key "${key}" is missing`);
        continue;
      }

      // Validate value if present
      if (key in this.config) {
        const validation = schema.validation?.(this.config[key]);
        if (validation !== true && validation !== undefined) {
          errors.push(`Validation failed for "${key}": ${validation}`);
        }

        // Type check
        const actualType = Array.isArray(this.config[key]) ? 'array' : typeof this.config[key];
        if (actualType !== schema.type && schema.type !== 'array') {
          errors.push(`Type mismatch for "${key}": expected ${schema.type}, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration schema
   */
  getSchema(): ConfigSchema {
    return { ...this.schema };
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    const defaults: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(this.schema)) {
      if (schema.defaultValue !== undefined) {
        defaults[key] = schema.defaultValue;
      }
    }
    this.config = defaults;
    this.saveConfig();
  }
}

/**
 * Browser-compatible Configuration Client
 */
export class ConfigClient {
  private ws?: WebSocket;
  private config: Record<string, unknown> = {};
  private listeners: Set<ConfigChangeListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to configuration server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use native WebSocket in browser
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WebSocketClass = typeof WebSocket !== 'undefined' ? WebSocket : require('ws').WebSocket;
      this.ws = new WebSocketClass(this.url);

      this.ws.onopen = () => {
        console.log('Connected to configuration server');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (error) {
          console.error('Failed to parse server message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from configuration server');
        this.attemptReconnect();
      };

      this.ws.onerror = (error: Event) => {
        console.error('Configuration server error:', error);
        reject(error);
      };
    });
  }

  /**
   * Handle server messages
   */
  private handleServerMessage(message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'init':
      case 'config':
        this.config = message.config as Record<string, unknown>;
        break;

      case 'change':
        {
        const event = message.event as ConfigChangeEvent;
        this.config[event.key] = event.newValue;
        this.notifyListeners(event);
        break;

        }
      case 'success':
        console.log('Configuration operation successful:', message.message);
        break;

      case 'error':
        console.error('Configuration operation error:', message.error);
        break;

      default:
        console.warn('Unknown server message type:', message.type);
    }
  }

  /**
   * Notify listeners of configuration changes
   */
  private notifyListeners(event: ConfigChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Config change listener error:', error);
      }
    });
  }

  /**
   * Attempt to reconnect to server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts})...`);
      this.connect().catch(() => {
        // Recursive retry will be handled by close event
      });
    }, delay);
  }

  /**
   * Get configuration value
   */
  get<T = unknown>(key: string): T {
    return this.config[key] as T;
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Set configuration value
   */
  set(key: string, value: unknown): void {
    this.send({
      type: 'set',
      data: { [key]: value },
    });
  }

  /**
   * Set multiple configuration values
   */
  setMany(values: Record<string, unknown>): void {
    this.send({
      type: 'set',
      data: values,
    });
  }

  /**
   * Subscribe to configuration changes
   */
  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Request configuration refresh
   */
  refresh(): void {
    this.send({ type: 'get' });
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.send({ type: 'reset' });
  }

  /**
   * Validate current configuration
   */
  validate(): void {
    this.send({ type: 'validate' });
  }

  /**
   * Send message to server
   */
  private send(message: { type: string; [key: string]: unknown }): void {
    if (this.ws && this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.ws?.close();
  }
}
