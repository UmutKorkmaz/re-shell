/**
 * Framework-Specific SDK Optimizations
 * Generates optimized API client SDKs for different frameworks
 */

import { OpenAPISpec, toMethodName, toCamelCase } from './typescript-client';

export interface SdkOptions {
  clientName?: string;
  framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'generic';
  includeTreeShaking?: boolean;
  includeLazyLoading?: boolean;
  includeDevTools?: boolean;
}

/**
 * Generate optimized SDK bundle configuration for different frameworks
 * Includes tree-shaking, code splitting, and framework-specific optimizations
 */
export function generateFrameworkSdkBundle(spec: OpenAPISpec, options: SdkOptions = {}): string {
  const lines: string[] = [];
  const clientName = options.clientName || toCamelCase(spec.info.title) + 'Client';
  const framework = options.framework || 'generic';

  switch (framework.toLowerCase()) {
    case 'react':
    case 'next':
      lines.push(generateReactSdkOptimizations(spec, clientName));
      break;
    case 'vue':
    case 'nuxt':
      lines.push(generateVueSdkOptimizations(spec, clientName));
      break;
    case 'angular':
      lines.push(generateAngularSdkOptimizations(spec, clientName));
      break;
    case 'svelte':
    case 'sveltekit':
      lines.push(generateSvelteSdkOptimizations(spec, clientName));
      break;
    default:
      lines.push(generateGenericSdkOptimizations(spec, clientName));
  }

  return lines.join('\n');
}

/**
 * React SDK optimizations with tree-shaking and memoization
 */
function generateReactSdkOptimizations(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`// React SDK Optimizations`);
  lines.push(`// Optimized for React 18+ with tree-shaking and memoization`);
  lines.push(``);
  lines.push(`import { useMemo, useCallback } from 'react';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push(``);
  lines.push(`// Singleton instance with memoization`);
  lines.push(`let clientInstance: ${clientName} | null = null;`);
  lines.push(``);
  lines.push(`export function getApiClient(config?: ConstructorParameters<typeof ${clientName}>[0]): ${clientName} {`);
  lines.push(`  if (!clientInstance) {`);
  lines.push(`    clientInstance = new ${clientName}(config);`);
  lines.push(`  }`);
  lines.push(`  return clientInstance;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Hook for using API client with React 18 optimizations`);
  lines.push(`export function useApiClient(config?: ConstructorParameters<typeof ${clientName}>[0]) {`);
  lines.push(`  const client = useMemo(() => getApiClient(config), []);`);
  lines.push(`  return client;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Memoized API methods for React components`);
  lines.push(`export function useApiMethods() {`);
  lines.push(`  const client = useApiClient();`);
  lines.push(``);

  // Collect all methods
  const methods: string[] = [];
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      const methodName = toMethodName(operation.operationId || `${method}_${path}`);
      methods.push(methodName);
    });
  });

  methods.forEach((methodName) => {
    lines.push(`  const ${toCamelCase(methodName)} = useCallback(`);
    lines.push(`    (params: any) => client.${methodName}(params),`);
    lines.push(`    [client]`);
    lines.push(`  );`);
  });

  lines.push(``);
  lines.push(`  return {`);
  methods.forEach((methodName) => {
    lines.push(`    ${toCamelCase(methodName)},`);
  });
  lines.push(`  };`);
  lines.push(`}`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Vue SDK optimizations with reactivity and composables
 */
function generateVueSdkOptimizations(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`// Vue SDK Optimizations`);
  lines.push(`// Optimized for Vue 3 with Composition API and reactivity`);
  lines.push(``);
  lines.push(`import { ref, readonly } from 'vue';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push(``);
  lines.push(`// Reactive singleton instance`);
  lines.push(`const clientInstance = ref<${clientName} | null>(null);`);
  lines.push(``);
  lines.push(`export function useApiClient(config?: any) {`);
  lines.push(`  if (!clientInstance.value) {`);
  lines.push(`    clientInstance.value = new ${clientName}(config);`);
  lines.push(`  }`);
  lines.push(`  return clientInstance.value;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Composable for reactive API calls`);
  lines.push(`export function useApiState() {`);
  lines.push(`  const client = useApiClient();`);
  lines.push(`  const loading = ref(false);`);
  lines.push(`  const error = ref<Error | null>(null);`);
  lines.push(``);

  // Generate reactive methods
  const methods: string[] = [];
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      const methodName = toMethodName(operation.operationId || `${method}_${path}`);
      methods.push(methodName);

      lines.push(`  async ${toCamelCase(methodName)}(params: any) {`);
      lines.push(`    loading.value = true;`);
      lines.push(`    error.value = null;`);
      lines.push(`    try {`);
      lines.push(`      return await client.${methodName}(params);`);
      lines.push(`    } catch (e) {`);
      lines.push(`      error.value = e as Error;`);
      lines.push(`      throw e;`);
      lines.push(`    } finally {`);
      lines.push(`      loading.value = false;`);
      lines.push(`    }`);
      lines.push(`  }`);
    });
  });

  lines.push(``);
  lines.push(`  return {`);
  lines.push(`    loading: readonly(loading),`);
  lines.push(`    error: readonly(error),`);
  methods.forEach((methodName) => {
    lines.push(`    ${toCamelCase(methodName)},`);
  });
  lines.push(`  };`);
  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Angular SDK optimizations with DI and RxJS
 */
function generateAngularSdkOptimizations(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`// Angular SDK Optimizations`);
  lines.push(`// Optimized for Angular 17+ with standalone components and signals`);
  lines.push(``);
  lines.push(`import { inject, Injectable, signal, computed } from '@angular/core';`);
  lines.push(`import { Observable, shareReplay, tap } from 'rxjs';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push(``);
  lines.push(`@Injectable({`);
  lines.push(`  providedIn: 'root'`);
  lines.push(`})`);
  lines.push(`export class ${clientName}Service {`);
  lines.push(`  private client = inject(${clientName});`);
  lines.push(`  private loading = signal<boolean>(false);`);
  lines.push(`  private error = signal<Error | null>(null);`);
  lines.push(``);
  lines.push(`  readonly loading$ = computed(() => this.loading());`);
  lines.push(`  readonly error$ = computed(() => this.error());`);
  lines.push(``);

  // Generate optimized RxJS methods
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      const methodName = toMethodName(operation.operationId || `${method}_${path}`);

      lines.push(`  ${toCamelCase(methodName)}(params: any): Observable<any> {`);
      lines.push(`    return this.client.${methodName}(params).pipe(`);
      lines.push(`      tap(() => {`);
      lines.push(`        this.loading.set(true);`);
      lines.push(`        this.error.set(null);`);
      lines.push(`      }),`);
      lines.push(`      shareReplay(1)`);
      lines.push(`    );`);
      lines.push(`  }`);
    });
  });

  lines.push(`}`);

  return lines.join('\n');
}

/**
 * Svelte SDK optimizations with stores and reactivity
 */
function generateSvelteSdkOptimizations(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`// Svelte SDK Optimizations`);
  lines.push(`// Optimized for Svelte 5 with runes and stores`);
  lines.push(``);
  lines.push(`import { writable, derived, get } from 'svelte/store';`);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push(``);
  lines.push(`// Client store for Svelte reactivity`);
  lines.push(`const client = writable<${clientName} | null>(null);`);
  lines.push(``);
  lines.push(`export function initApiClient(config?: any) {`);
  lines.push(`  const instance = new ${clientName}(config);`);
  lines.push(`  client.set(instance);`);
  lines.push(`  return instance;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Global loading and error stores`);
  lines.push(`export const apiLoading = writable(false);`);
  lines.push(`export const apiError = writable<Error | null>(null);`);
  lines.push(``);

  // Generate store functions for each API method
  const methods: string[] = [];
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      const methodName = toMethodName(operation.operationId || `${method}_${path}`);
      methods.push(methodName);

      lines.push(`// ${operation.summary || operation.description || `${method.toUpperCase()} ${path}`}`);
      lines.push(`export function ${toCamelCase(methodName)}Store(params: any) {`);
      lines.push(`  return derived(client, ($client) => {`);
      lines.push(`    return async () => {`);
      lines.push(`      apiLoading.set(true);`);
      lines.push(`      apiError.set(null);`);
      lines.push(`      try {`);
      lines.push(`        const c = get(client);`);
      lines.push(`        if (!c) throw new Error('Client not initialized');`);
      lines.push(`        return await c.${methodName}(params);`);
      lines.push(`      } catch (e) {`);
      lines.push(`        apiError.set(e as Error);`);
      lines.push(`        throw e;`);
      lines.push(`      } finally {`);
      lines.push(`        apiLoading.set(false);`);
      lines.push(`      }`);
      lines.push(`    };`);
      lines.push(`  });`);
      lines.push(`}`);
    });
  });

  return lines.join('\n');
}

/**
 * Generic SDK optimizations for any framework
 */
function generateGenericSdkOptimizations(spec: OpenAPISpec, clientName: string): string {
  const lines: string[] = [];

  lines.push(`// Generic SDK Optimizations`);
  lines.push(`// Tree-shakeable exports and lazy loading`);
  lines.push(``);
  lines.push(`import { ${clientName} } from './client';`);
  lines.push(``);
  lines.push(`// Lazy client initialization`);
  lines.push(`let _client: ${clientName} | null = null;`);
  lines.push(``);
  lines.push(`export function getClient(config?: ConstructorParameters<typeof ${clientName}>[0]): ${clientName} {`);
  lines.push(`  if (!_client) {`);
  lines.push(`    _client = new ${clientName}(config);`);
  lines.push(`  }`);
  lines.push(`  return _client;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Named exports for tree-shaking`);
  const methods: string[] = [];
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation || typeof operation !== 'object') return;
      const methodName = toMethodName(operation.operationId || `${method}_${path}`);
      methods.push(methodName);

      lines.push(`export function ${toCamelCase(methodName)}(params: any) {`);
      lines.push(`  return getClient().${methodName}(params);`);
      lines.push(`}`);
    });
  });

  return lines.join('\n');
}

/**
 * Generate bundle configuration for optimal tree-shaking
 */
export function generateBundleConfig(framework: 'vite' | 'webpack' | 'rollup'): string {
  const configs: Record<string, string> = {
    vite: `// Vite bundle configuration for optimal tree-shaking
export default {
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'APIClient',
      formats: ['es', 'cjs'],
      fileName: (format) => 'api-client.' + format + '.js'
    },
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    },
    minify: 'terser',
    sourcemap: true
  }
};`,
    webpack: `// Webpack bundle configuration
module.exports = {
  mode: 'production',
  optimization: {
    minimize: true,
    usedExports: true,
    sideEffects: false,
    concatenateModules: true
  },
  output: {
    path: require('path').resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: {
      type: 'module'
    }
  }
};`,
    rollup: `// Rollup configuration for maximum tree-shaking
export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/api-client.esm.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/api-client.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    }
  ]
};`
  };

  return configs[framework.toLowerCase()] || configs.vite;
}

// Re-export utility functions
export { toMethodName, toCamelCase } from './typescript-client';
