/**
 * Lazy loading system for heavy dependencies
 */

interface LazyModule<T> {
  _module?: T;
  _promise?: Promise<T>;
  load(): Promise<T>;
  get(): T | undefined;
}

class LazyModuleImpl<T> implements LazyModule<T> {
  _module?: T;
  _promise?: Promise<T>;
  
  constructor(private loader: () => Promise<T>) {}
  
  async load(): Promise<T> {
    if (this._module) {
      return this._module;
    }
    
    if (!this._promise) {
      this._promise = this.loader().then(module => {
        this._module = module;
        return module;
      });
    }
    
    return this._promise;
  }
  
  get(): T | undefined {
    return this._module;
  }
}

/**
 * Create a lazy-loaded module
 */
export function lazy<T>(loader: () => Promise<T>): LazyModule<T> {
  return new LazyModuleImpl(loader);
}

/**
 * Common heavy dependencies with lazy loading
 */
export const lazyModules = {
  // UI libraries
  chalk: lazy(() => import('chalk').then(m => m.default)),
  ora: lazy(() => import('ora').then(m => m.default)),
  // inquirer: lazy(() => import('inquirer').then(m => m.default).catch(() => null)),
  
  // File system utilities
  globby: lazy(() => import('globby').then(m => m as any)),
  rimraf: lazy(() => import('rimraf').then(m => m as any)),
  fsExtra: lazy(() => import('fs-extra').then(m => m as any)),
  
  // Development tools
  chokidar: lazy(() => import('chokidar')),
  // webpack: lazy(() => import('webpack').catch(() => null)),
  vite: lazy(() => import('vite')),
  
  // Parsing and validation
  yaml: lazy(() => import('js-yaml')),
  ajv: lazy(() => import('ajv').then(m => m.default)),
  // zod: lazy(() => import('zod').catch(() => null)),
  
  // Network and API
  // axios: lazy(() => import('axios').then(m => m.default).catch(() => null)),
  // graphqlRequest: lazy(() => import('graphql-request').catch(() => null)),
  
  // Template engines
  handlebars: lazy(() => import('handlebars')),
  ejs: lazy(() => import('ejs')),
  
  // Other utilities
  lodash: lazy(() => import('lodash')),
  dayjs: lazy(() => import('dayjs').then(m => m.default)),
  semver: lazy(() => import('semver')),
  
  // Docker and containerization
  dockerode: lazy(() => import('dockerode').then(m => m.default)),
  
  // Git operations
  simpleGit: lazy(() => import('simple-git').then(m => m.default)),
  
  // Terminal UI
  cliTable3: lazy(() => import('cli-table3').then(m => m.default)),
  boxen: lazy(() => import('boxen').then(m => m.default)),
  
  // Configuration
  cosmiconfig: lazy(() => import('cosmiconfig')),
  dotenv: lazy(() => import('dotenv'))
};

/**
 * Preload critical modules in background
 */
export async function preloadCriticalModules(): Promise<void> {
  // Preload only the most commonly used modules
  const criticalModules = [
    lazyModules.chalk.load(),
    lazyModules.ora.load()
  ];
  
  // Load in background without blocking
  Promise.all(criticalModules).catch(() => {
    // Ignore preload errors
  });
}

/**
 * Get a lazy module with fallback
 */
export async function getLazyModule<T>(
  module: LazyModule<T>,
  fallback?: T
): Promise<T> {
  try {
    return await module.load();
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

/**
 * Cache for compiled templates and schemas
 */
class CompiledCache {
  private cache = new Map<string, any>();
  
  get(key: string): any {
    return this.cache.get(key);
  }
  
  set(key: string, value: any): void {
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

export const compiledCache = new CompiledCache();

/**
 * Defer expensive operations until after startup
 */
export class DeferredOperations {
  private operations: (() => Promise<void>)[] = [];
  private running = false;
  
  add(operation: () => Promise<void>): void {
    this.operations.push(operation);
    
    // Start processing after a delay
    if (!this.running) {
      setTimeout(() => this.process(), 100);
    }
  }
  
  private async process(): Promise<void> {
    this.running = true;
    
    while (this.operations.length > 0) {
      const op = this.operations.shift();
      if (op) {
        try {
          await op();
        } catch (error) {
          // Log but don't fail
          if (process.env.DEBUG === 'true') {
            console.error('Deferred operation failed:', error);
          }
        }
      }
    }
    
    this.running = false;
  }
}

export const deferredOps = new DeferredOperations();