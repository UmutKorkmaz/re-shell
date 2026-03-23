import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class FrameworkApiSdkTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Core API client
    files.push({
      path: 'src/api/client.ts',
      content: this.generateCoreClient()
    });

    // React hooks
    files.push({
      path: 'src/api/react/hooks.ts',
      content: this.generateReactHooks()
    });

    files.push({
      path: 'src/api/react/provider.tsx',
      content: this.generateReactProvider()
    });

    files.push({
      path: 'src/api/react/index.ts',
      content: this.generateReactIndex()
    });

    // Vue composables
    files.push({
      path: 'src/api/vue/composables.ts',
      content: this.generateVueComposables()
    });

    files.push({
      path: 'src/api/vue/plugin.ts',
      content: this.generateVuePlugin()
    });

    files.push({
      path: 'src/api/vue/index.ts',
      content: this.generateVueIndex()
    });

    // Angular service
    files.push({
      path: 'src/api/angular/api.service.ts',
      content: this.generateAngularService()
    });

    files.push({
      path: 'src/api/angular/api.module.ts',
      content: this.generateAngularModule()
    });

    files.push({
      path: 'src/api/angular/index.ts',
      content: this.generateAngularIndex()
    });

    // Svelte stores
    files.push({
      path: 'src/api/svelte/stores.ts',
      content: this.generateSvelteStores()
    });

    files.push({
      path: 'src/api/svelte/context.ts',
      content: this.generateSvelteContext()
    });

    files.push({
      path: 'src/api/svelte/index.ts',
      content: this.generateSvelteIndex()
    });

    // Solid.js resources
    files.push({
      path: 'src/api/solid/resources.ts',
      content: this.generateSolidResources()
    });

    files.push({
      path: 'src/api/solid/index.ts',
      content: this.generateSolidIndex()
    });

    // Types
    files.push({
      path: 'src/api/types.ts',
      content: this.generateTypes()
    });

    // Main index
    files.push({
      path: 'src/api/index.ts',
      content: this.generateMainIndex()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    return files;
  }

  private generateCoreClient(): string {
    return `// Core API Client
// Framework-agnostic HTTP client with caching, retry, and request deduplication

import type { ApiConfig, ApiResponse, RequestConfig, CacheEntry } from './types';

export class ApiClient {
  private config: ApiConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      cacheTime: 5 * 60 * 1000, // 5 minutes
      dedupeTime: 100, // 100ms window for deduplication
      ...config
    };
  }

  // GET request with caching
  async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey('GET', url, config?.params);

    // Check cache
    if (config?.cache !== false) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) return cached;
    }

    // Dedupe concurrent requests
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) return pending as Promise<ApiResponse<T>>;

    const request = this.request<T>('GET', url, undefined, config);
    this.pendingRequests.set(cacheKey, request);

    try {
      const response = await request;
      if (response.success && config?.cache !== false) {
        this.setCache(cacheKey, response);
      }
      return response;
    } finally {
      setTimeout(() => {
        this.pendingRequests.delete(cacheKey);
      }, this.config.dedupeTime);
    }
  }

  // POST request (no caching)
  async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, config);
  }

  // PUT request
  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, config);
  }

  // PATCH request
  async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, config);
  }

  // DELETE request
  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  // Core request method with retry
  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url, config?.params);
    const requestKey = \`\${method}:\${fullUrl}\`;

    // Cancel previous request if needed
    if (config?.cancelPrevious) {
      this.abortControllers.get(requestKey)?.abort();
    }

    const controller = new AbortController();
    this.abortControllers.set(requestKey, controller);

    let lastError: Error | null = null;
    const maxRetries = config?.retries ?? this.config.retries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(fullUrl, {
          method,
          headers: this.buildHeaders(config?.headers),
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });

        const responseData = await this.parseResponse<T>(response);

        this.abortControllers.delete(requestKey);

        if (!response.ok) {
          if (response.status >= 500 && attempt < maxRetries) {
            await this.delay(this.config.retryDelay * Math.pow(2, attempt));
            continue;
          }
          return {
            success: false,
            error: { code: response.status.toString(), message: response.statusText },
            statusCode: response.status
          };
        }

        return {
          success: true,
          data: responseData,
          statusCode: response.status
        };
      } catch (error) {
        lastError = error as Error;
        if ((error as Error).name === 'AbortError') {
          return {
            success: false,
            error: { code: 'ABORTED', message: 'Request was cancelled' },
            statusCode: 0
          };
        }
        if (attempt < maxRetries) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: lastError?.message || 'Request failed' },
      statusCode: 0
    };
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const timeout = this.config.timeout;
    const controller = options.signal ? undefined : new AbortController();

    const timeoutId = setTimeout(() => controller?.abort(), timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: options.signal || controller?.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildUrl(url: string, params?: Record<string, string>): string {
    const fullUrl = url.startsWith('http') ? url : \`\${this.config.baseUrl}\${url}\`;
    if (!params) return fullUrl;

    const searchParams = new URLSearchParams(params);
    return \`\${fullUrl}?\${searchParams}\`;
  }

  private buildHeaders(custom?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...custom
    };

    if (this.config.getAuthToken) {
      const token = this.config.getAuthToken();
      if (token) {
        headers['Authorization'] = \`Bearer \${token}\`;
      }
    }

    return headers;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text);
    } catch {
      return text as T;
    }
  }

  private getCacheKey(method: string, url: string, params?: Record<string, string>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return \`\${method}:\${url}:\${paramStr}\`;
  }

  private getFromCache<T>(key: string): ApiResponse<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as ApiResponse<T>;
  }

  private setCache(key: string, data: ApiResponse<unknown>): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.config.cacheTime
    });
  }

  // Invalidate cache
  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Cancel all pending requests
  cancelAll(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let clientInstance: ApiClient | null = null;

export function createApiClient(config: ApiConfig): ApiClient {
  clientInstance = new ApiClient(config);
  return clientInstance;
}

export function getApiClient(): ApiClient {
  if (!clientInstance) {
    throw new Error('API client not initialized. Call createApiClient first.');
  }
  return clientInstance;
}

export default ApiClient;
`;
  }

  private generateReactHooks(): string {
    return `// React API Hooks
// Optimized hooks with SWR-like caching, automatic revalidation, and optimistic updates

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getApiClient } from '../client';
import type { ApiResponse, QueryOptions, MutationOptions, QueryResult, MutationResult } from '../types';

// Query hook for GET requests
export function useQuery<T>(
  url: string | null,
  options: QueryOptions = {}
): QueryResult<T> {
  const {
    params,
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = true,
    staleTime = 0,
    cacheTime = 5 * 60 * 1000,
    onSuccess,
    onError,
    initialData
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData && enabled);
  const [isFetching, setIsFetching] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!url || !enabled) return;

    const now = Date.now();
    if (staleTime > 0 && now - lastFetchRef.current < staleTime) {
      return;
    }

    try {
      if (showLoading && !data) setIsLoading(true);
      setIsFetching(true);

      const client = getApiClient();
      const response = await client.get<T>(url, { params });

      if (!mountedRef.current) return;

      if (response.success) {
        setData(response.data);
        setError(null);
        lastFetchRef.current = Date.now();
        onSuccess?.(response.data!);
      } else {
        const err = new Error(response.error?.message || 'Request failed');
        setError(err);
        onError?.(err);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        onError?.(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [url, params, enabled, staleTime, data, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;
    const interval = setInterval(() => fetchData(false), refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;
    const handleFocus = () => fetchData(false);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, fetchData]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch: () => fetchData(false),
    invalidate: () => {
      lastFetchRef.current = 0;
      fetchData();
    }
  };
}

// Mutation hook for POST/PUT/PATCH/DELETE
export function useMutation<TData, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: MutationOptions<TData, TVariables> = {}
): MutationResult<TData, TVariables> {
  const { onSuccess, onError, onSettled, invalidateQueries } = options;

  const [data, setData] = useState<TData | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (variables: TVariables) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await mutationFn(variables);

        if (!mountedRef.current) return;

        if (response.success) {
          setData(response.data);
          onSuccess?.(response.data!, variables);

          // Invalidate related queries
          if (invalidateQueries?.length) {
            const client = getApiClient();
            invalidateQueries.forEach(query => {
              client.invalidateCache(query);
            });
          }
        } else {
          const err = new Error(response.error?.message || 'Mutation failed');
          setError(err);
          onError?.(err, variables);
        }

        onSettled?.(response.data, response.success ? null : new Error(response.error?.message), variables);

        return response;
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
          onError?.(err as Error, variables);
          onSettled?.(undefined, err as Error, variables);
        }
        throw err;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [mutationFn, onSuccess, onError, onSettled, invalidateQueries]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    mutate,
    mutateAsync: mutate,
    reset
  };
}

// Paginated query hook
export function usePaginatedQuery<T>(
  baseUrl: string,
  options: QueryOptions & { pageSize?: number } = {}
) {
  const { pageSize = 20, ...queryOptions } = options;
  const [page, setPage] = useState(1);

  const url = \`\${baseUrl}?page=\${page}&limit=\${pageSize}\`;

  const query = useQuery<{ items: T[]; total: number; totalPages: number }>(url, queryOptions);

  return {
    ...query,
    page,
    pageSize,
    setPage,
    nextPage: () => setPage(p => p + 1),
    prevPage: () => setPage(p => Math.max(1, p - 1)),
    hasNextPage: query.data ? page < query.data.totalPages : false,
    hasPrevPage: page > 1
  };
}

// Infinite query hook
export function useInfiniteQuery<T>(
  baseUrl: string,
  options: QueryOptions & { pageSize?: number } = {}
) {
  const { pageSize = 20, ...queryOptions } = options;
  const [pages, setPages] = useState<T[][]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const fetchPage = useCallback(async (pageCursor?: string) => {
    const client = getApiClient();
    const params = { limit: pageSize.toString(), ...(pageCursor && { cursor: pageCursor }) };
    const response = await client.get<{ items: T[]; nextCursor?: string; hasMore: boolean }>(
      baseUrl,
      { params }
    );

    if (response.success && response.data) {
      setPages(prev => [...prev, response.data!.items]);
      setCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
    }

    return response;
  }, [baseUrl, pageSize]);

  const query = useQuery<{ items: T[]; nextCursor?: string; hasMore: boolean }>(
    baseUrl,
    {
      ...queryOptions,
      params: { limit: pageSize.toString() },
      onSuccess: (data) => {
        setPages([data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        queryOptions.onSuccess?.(data);
      }
    }
  );

  const fetchMore = useCallback(async () => {
    if (!hasMore || isFetchingMore || !cursor) return;
    setIsFetchingMore(true);
    await fetchPage(cursor);
    setIsFetchingMore(false);
  }, [hasMore, isFetchingMore, cursor, fetchPage]);

  const data = useMemo(() => pages.flat(), [pages]);

  return {
    ...query,
    data,
    pages,
    hasMore,
    isFetchingMore,
    fetchMore
  };
}
`;
  }

  private generateReactProvider(): string {
    return `// React API Provider
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { ApiClient, createApiClient } from '../client';
import type { ApiConfig } from '../types';

interface ApiContextValue {
  client: ApiClient;
}

const ApiContext = createContext<ApiContextValue | null>(null);

interface ApiProviderProps {
  config: ApiConfig;
  children: ReactNode;
}

export function ApiProvider({ config, children }: ApiProviderProps): JSX.Element {
  const client = useMemo(() => createApiClient(config), [config]);

  const value = useMemo(() => ({ client }), [client]);

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiClient must be used within an ApiProvider');
  }
  return context.client;
}

export default ApiProvider;
`;
  }

  private generateReactIndex(): string {
    return `// React API SDK
export { useQuery, useMutation, usePaginatedQuery, useInfiniteQuery } from './hooks';
export { ApiProvider, useApiClient } from './provider';
`;
  }

  private generateVueComposables(): string {
    return `// Vue API Composables
// Optimized composables with reactive caching and automatic cleanup

import { ref, computed, watch, onUnmounted, Ref, ComputedRef } from 'vue';
import { getApiClient } from '../client';
import type { ApiResponse, QueryOptions, MutationOptions } from '../types';

// Query composable for GET requests
export function useQuery<T>(
  url: Ref<string | null> | string | null,
  options: QueryOptions = {}
) {
  const {
    params,
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = true,
    staleTime = 0,
    onSuccess,
    onError,
    initialData
  } = options;

  const data = ref<T | undefined>(initialData) as Ref<T | undefined>;
  const error = ref<Error | null>(null);
  const isLoading = ref(!initialData && enabled);
  const isFetching = ref(false);
  let lastFetch = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const urlValue = computed(() => (typeof url === 'string' ? url : url?.value));

  const fetchData = async (showLoading = true) => {
    const currentUrl = urlValue.value;
    if (!currentUrl || !enabled) return;

    const now = Date.now();
    if (staleTime > 0 && now - lastFetch < staleTime) {
      return;
    }

    try {
      if (showLoading && !data.value) isLoading.value = true;
      isFetching.value = true;

      const client = getApiClient();
      const response = await client.get<T>(currentUrl, { params });

      if (response.success) {
        data.value = response.data;
        error.value = null;
        lastFetch = Date.now();
        onSuccess?.(response.data!);
      } else {
        error.value = new Error(response.error?.message || 'Request failed');
        onError?.(error.value);
      }
    } catch (err) {
      error.value = err as Error;
      onError?.(err as Error);
    } finally {
      isLoading.value = false;
      isFetching.value = false;
    }
  };

  // Watch URL changes
  watch(urlValue, () => {
    fetchData();
  }, { immediate: true });

  // Refetch interval
  if (refetchInterval) {
    intervalId = setInterval(() => fetchData(false), refetchInterval);
  }

  // Refetch on window focus
  const handleFocus = () => {
    if (refetchOnWindowFocus) {
      fetchData(false);
    }
  };
  window.addEventListener('focus', handleFocus);

  // Cleanup
  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
  });

  return {
    data: data as Ref<T | undefined>,
    error,
    isLoading,
    isFetching,
    refetch: () => fetchData(false),
    invalidate: () => {
      lastFetch = 0;
      fetchData();
    }
  };
}

// Mutation composable for POST/PUT/PATCH/DELETE
export function useMutation<TData, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: MutationOptions<TData, TVariables> = {}
) {
  const { onSuccess, onError, onSettled, invalidateQueries } = options;

  const data = ref<TData | undefined>() as Ref<TData | undefined>;
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  const mutate = async (variables: TVariables) => {
    try {
      isLoading.value = true;
      error.value = null;

      const response = await mutationFn(variables);

      if (response.success) {
        data.value = response.data;
        onSuccess?.(response.data!, variables);

        if (invalidateQueries?.length) {
          const client = getApiClient();
          invalidateQueries.forEach(query => {
            client.invalidateCache(query);
          });
        }
      } else {
        error.value = new Error(response.error?.message || 'Mutation failed');
        onError?.(error.value, variables);
      }

      onSettled?.(response.data, response.success ? null : error.value, variables);

      return response;
    } catch (err) {
      error.value = err as Error;
      onError?.(err as Error, variables);
      onSettled?.(undefined, err as Error, variables);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const reset = () => {
    data.value = undefined;
    error.value = null;
    isLoading.value = false;
  };

  return {
    data,
    error,
    isLoading,
    mutate,
    mutateAsync: mutate,
    reset
  };
}

// Paginated query composable
export function usePaginatedQuery<T>(
  baseUrl: string,
  options: QueryOptions & { pageSize?: number } = {}
) {
  const { pageSize = 20, ...queryOptions } = options;
  const page = ref(1);

  const url = computed(() => \`\${baseUrl}?page=\${page.value}&limit=\${pageSize}\`);

  const query = useQuery<{ items: T[]; total: number; totalPages: number }>(url, queryOptions);

  return {
    ...query,
    page,
    pageSize,
    setPage: (p: number) => { page.value = p; },
    nextPage: () => { page.value++; },
    prevPage: () => { page.value = Math.max(1, page.value - 1); },
    hasNextPage: computed(() => query.data.value ? page.value < query.data.value.totalPages : false),
    hasPrevPage: computed(() => page.value > 1)
  };
}
`;
  }

  private generateVuePlugin(): string {
    return `// Vue API Plugin
import type { App, InjectionKey } from 'vue';
import { ApiClient, createApiClient } from '../client';
import type { ApiConfig } from '../types';

export const ApiClientKey: InjectionKey<ApiClient> = Symbol('ApiClient');

export interface ApiPluginOptions extends ApiConfig {}

export const apiPlugin = {
  install(app: App, options: ApiPluginOptions) {
    const client = createApiClient(options);
    app.provide(ApiClientKey, client);
    app.config.globalProperties.$api = client;
  }
};

export default apiPlugin;

// Type augmentation for global properties
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $api: ApiClient;
  }
}
`;
  }

  private generateVueIndex(): string {
    return `// Vue API SDK
export { useQuery, useMutation, usePaginatedQuery } from './composables';
export { apiPlugin, ApiClientKey } from './plugin';
`;
  }

  private generateAngularService(): string {
    return `// Angular API Service
// Injectable service with RxJS observables, caching, and retry logic

import { Injectable, Inject, Optional, InjectionToken } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of, timer } from 'rxjs';
import { catchError, retry, retryWhen, delayWhen, tap, shareReplay, map, switchMap, finalize } from 'rxjs/operators';

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cacheTime?: number;
}

export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private pendingRequests = new Map<string, Observable<any>>();

  constructor(
    private http: HttpClient,
    @Inject(API_CONFIG) @Optional() private config: ApiConfig
  ) {
    this.config = {
      baseUrl: '',
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      cacheTime: 5 * 60 * 1000,
      ...config
    };
  }

  // GET with caching
  get<T>(url: string, options?: { params?: Record<string, string>; cache?: boolean }): Observable<T> {
    const fullUrl = this.buildUrl(url);
    const cacheKey = this.getCacheKey(fullUrl, options?.params);

    // Check cache
    if (options?.cache !== false) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) return of(cached);
    }

    // Dedupe concurrent requests
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) return pending as Observable<T>;

    let params = new HttpParams();
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }

    const request$ = this.http.get<T>(fullUrl, { params }).pipe(
      this.retryWithBackoff(),
      tap(data => {
        if (options?.cache !== false) {
          this.setCache(cacheKey, data);
        }
      }),
      shareReplay(1),
      finalize(() => {
        setTimeout(() => this.pendingRequests.delete(cacheKey), 100);
      })
    );

    this.pendingRequests.set(cacheKey, request$);
    return request$;
  }

  // POST
  post<T>(url: string, body?: any): Observable<T> {
    return this.http.post<T>(this.buildUrl(url), body).pipe(
      this.retryWithBackoff()
    );
  }

  // PUT
  put<T>(url: string, body?: any): Observable<T> {
    return this.http.put<T>(this.buildUrl(url), body).pipe(
      this.retryWithBackoff()
    );
  }

  // PATCH
  patch<T>(url: string, body?: any): Observable<T> {
    return this.http.patch<T>(this.buildUrl(url), body).pipe(
      this.retryWithBackoff()
    );
  }

  // DELETE
  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(this.buildUrl(url)).pipe(
      this.retryWithBackoff()
    );
  }

  // Invalidate cache
  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private buildUrl(url: string): string {
    return url.startsWith('http') ? url : \`\${this.config.baseUrl}\${url}\`;
  }

  private getCacheKey(url: string, params?: Record<string, string>): string {
    return params ? \`\${url}?\${new URLSearchParams(params)}\` : url;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.config.cacheTime!) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private retryWithBackoff() {
    return retryWhen(errors =>
      errors.pipe(
        delayWhen((error, index) => {
          if (index >= this.config.retries! || error.status < 500) {
            return throwError(() => error);
          }
          return timer(this.config.retryDelay! * Math.pow(2, index));
        })
      )
    );
  }
}

// Query state service for reactive queries
@Injectable()
export class QueryState<T> {
  private dataSubject = new BehaviorSubject<T | undefined>(undefined);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<ApiError | null>(null);

  data$ = this.dataSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();
  error$ = this.errorSubject.asObservable();

  get data(): T | undefined {
    return this.dataSubject.value;
  }

  get isLoading(): boolean {
    return this.loadingSubject.value;
  }

  get error(): ApiError | null {
    return this.errorSubject.value;
  }

  setData(data: T): void {
    this.dataSubject.next(data);
    this.errorSubject.next(null);
  }

  setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  setError(error: ApiError): void {
    this.errorSubject.next(error);
  }

  reset(): void {
    this.dataSubject.next(undefined);
    this.loadingSubject.next(false);
    this.errorSubject.next(null);
  }
}
`;
  }

  private generateAngularModule(): string {
    return `// Angular API Module
import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { ApiService, API_CONFIG, ApiConfig } from './api.service';

@NgModule({
  imports: [HttpClientModule],
  providers: [ApiService]
})
export class ApiModule {
  static forRoot(config: ApiConfig): ModuleWithProviders<ApiModule> {
    return {
      ngModule: ApiModule,
      providers: [
        { provide: API_CONFIG, useValue: config },
        ApiService
      ]
    };
  }
}
`;
  }

  private generateAngularIndex(): string {
    return `// Angular API SDK
export { ApiService, ApiConfig, API_CONFIG, QueryState, ApiError } from './api.service';
export { ApiModule } from './api.module';
`;
  }

  private generateSvelteStores(): string {
    return `// Svelte API Stores
// Reactive stores with automatic subscription management

import { writable, derived, get } from 'svelte/store';
import { getApiClient } from '../client';
import type { ApiResponse, QueryOptions, MutationOptions } from '../types';

// Create query store
export function createQuery<T>(
  url: string | null,
  options: QueryOptions = {}
) {
  const {
    params,
    enabled = true,
    refetchInterval,
    staleTime = 0,
    onSuccess,
    onError,
    initialData
  } = options;

  const data = writable<T | undefined>(initialData);
  const error = writable<Error | null>(null);
  const isLoading = writable(!initialData && enabled);
  const isFetching = writable(false);
  let lastFetch = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const fetchData = async (showLoading = true) => {
    if (!url || !enabled) return;

    const now = Date.now();
    if (staleTime > 0 && now - lastFetch < staleTime) {
      return;
    }

    try {
      if (showLoading && !get(data)) isLoading.set(true);
      isFetching.set(true);

      const client = getApiClient();
      const response = await client.get<T>(url, { params });

      if (response.success) {
        data.set(response.data);
        error.set(null);
        lastFetch = Date.now();
        onSuccess?.(response.data!);
      } else {
        const err = new Error(response.error?.message || 'Request failed');
        error.set(err);
        onError?.(err);
      }
    } catch (err) {
      error.set(err as Error);
      onError?.(err as Error);
    } finally {
      isLoading.set(false);
      isFetching.set(false);
    }
  };

  // Initial fetch
  if (enabled) {
    fetchData();
  }

  // Setup refetch interval
  if (refetchInterval) {
    intervalId = setInterval(() => fetchData(false), refetchInterval);
  }

  // Cleanup function
  const destroy = () => {
    if (intervalId) clearInterval(intervalId);
  };

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch: () => fetchData(false),
    invalidate: () => {
      lastFetch = 0;
      fetchData();
    },
    destroy
  };
}

// Create mutation store
export function createMutation<TData, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: MutationOptions<TData, TVariables> = {}
) {
  const { onSuccess, onError, onSettled, invalidateQueries } = options;

  const data = writable<TData | undefined>(undefined);
  const error = writable<Error | null>(null);
  const isLoading = writable(false);

  const mutate = async (variables: TVariables) => {
    try {
      isLoading.set(true);
      error.set(null);

      const response = await mutationFn(variables);

      if (response.success) {
        data.set(response.data);
        onSuccess?.(response.data!, variables);

        if (invalidateQueries?.length) {
          const client = getApiClient();
          invalidateQueries.forEach(query => {
            client.invalidateCache(query);
          });
        }
      } else {
        const err = new Error(response.error?.message || 'Mutation failed');
        error.set(err);
        onError?.(err, variables);
      }

      onSettled?.(response.data, response.success ? null : get(error), variables);

      return response;
    } catch (err) {
      error.set(err as Error);
      onError?.(err as Error, variables);
      onSettled?.(undefined, err as Error, variables);
      throw err;
    } finally {
      isLoading.set(false);
    }
  };

  const reset = () => {
    data.set(undefined);
    error.set(null);
    isLoading.set(false);
  };

  return {
    data,
    error,
    isLoading,
    mutate,
    mutateAsync: mutate,
    reset
  };
}
`;
  }

  private generateSvelteContext(): string {
    return `// Svelte API Context
import { setContext, getContext } from 'svelte';
import { ApiClient, createApiClient } from '../client';
import type { ApiConfig } from '../types';

const API_CONTEXT_KEY = Symbol('api-client');

export function initApiClient(config: ApiConfig): ApiClient {
  const client = createApiClient(config);
  setContext(API_CONTEXT_KEY, client);
  return client;
}

export function getApiClientContext(): ApiClient {
  const client = getContext<ApiClient>(API_CONTEXT_KEY);
  if (!client) {
    throw new Error('API client not initialized. Call initApiClient in a parent component.');
  }
  return client;
}
`;
  }

  private generateSvelteIndex(): string {
    return `// Svelte API SDK
export { createQuery, createMutation } from './stores';
export { initApiClient, getApiClientContext } from './context';
`;
  }

  private generateSolidResources(): string {
    return `// Solid.js API Resources
// Using Solid's built-in createResource for optimal reactivity

import { createResource, createSignal, Resource } from 'solid-js';
import { getApiClient } from '../client';
import type { ApiResponse, QueryOptions, MutationOptions } from '../types';

// Query resource
export function createQuery<T>(
  url: () => string | null,
  options: QueryOptions = {}
) {
  const { params, enabled = true, onSuccess, onError, initialData } = options;

  const fetcher = async (urlValue: string | null): Promise<T | undefined> => {
    if (!urlValue || !enabled) return undefined;

    const client = getApiClient();
    const response = await client.get<T>(urlValue, { params });

    if (response.success) {
      onSuccess?.(response.data!);
      return response.data;
    } else {
      const err = new Error(response.error?.message || 'Request failed');
      onError?.(err);
      throw err;
    }
  };

  const [resource, { refetch, mutate }] = createResource(url, fetcher, {
    initialValue: initialData
  });

  return {
    data: () => resource(),
    error: () => resource.error,
    isLoading: () => resource.loading,
    refetch,
    mutate,
    invalidate: () => refetch()
  };
}

// Mutation
export function createMutation<TData, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options: MutationOptions<TData, TVariables> = {}
) {
  const { onSuccess, onError, onSettled, invalidateQueries } = options;

  const [data, setData] = createSignal<TData | undefined>(undefined);
  const [error, setError] = createSignal<Error | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);

  const mutate = async (variables: TVariables) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await mutationFn(variables);

      if (response.success) {
        setData(() => response.data);
        onSuccess?.(response.data!, variables);

        if (invalidateQueries?.length) {
          const client = getApiClient();
          invalidateQueries.forEach(query => {
            client.invalidateCache(query);
          });
        }
      } else {
        const err = new Error(response.error?.message || 'Mutation failed');
        setError(err);
        onError?.(err, variables);
      }

      onSettled?.(response.data, response.success ? null : error(), variables);

      return response;
    } catch (err) {
      setError(err as Error);
      onError?.(err as Error, variables);
      onSettled?.(undefined, err as Error, variables);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  };

  return {
    data,
    error,
    isLoading,
    mutate,
    mutateAsync: mutate,
    reset
  };
}
`;
  }

  private generateSolidIndex(): string {
    return `// Solid.js API SDK
export { createQuery, createMutation } from './resources';
`;
  }

  private generateTypes(): string {
    return `// API SDK Types

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cacheTime?: number;
  dedupeTime?: number;
  headers?: Record<string, string>;
  getAuthToken?: () => string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  statusCode: number;
}

export interface RequestConfig {
  params?: Record<string, string>;
  headers?: Record<string, string>;
  cache?: boolean;
  retries?: number;
  cancelPrevious?: boolean;
}

export interface CacheEntry {
  data: ApiResponse<unknown>;
  expiresAt: number;
}

export interface QueryOptions {
  params?: Record<string, string>;
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  cacheTime?: number;
  initialData?: any;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export interface MutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
  invalidateQueries?: string[];
}

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
  invalidate: () => void;
}

export interface MutationResult<TData, TVariables> {
  data: TData | undefined;
  error: Error | null;
  isLoading: boolean;
  mutate: (variables: TVariables) => Promise<ApiResponse<TData>>;
  mutateAsync: (variables: TVariables) => Promise<ApiResponse<TData>>;
  reset: () => void;
}
`;
  }

  private generateMainIndex(): string {
    return `// Framework API SDK
// Main entry point - exports core client and all framework integrations

export { ApiClient, createApiClient, getApiClient } from './client';
export * from './types';

// Framework-specific exports
export * as react from './react';
export * as vue from './vue';
export * as angular from './angular';
export * as svelte from './svelte';
export * as solid from './solid';
`;
  }

  protected generateReadme(): string {
    const { name } = this.context;
    return `# Framework API SDK

Optimized API clients for React, Vue, Angular, Svelte, and Solid.js.

## Features

- **Caching**: Automatic response caching with configurable TTL
- **Deduplication**: Concurrent request deduplication
- **Retry**: Automatic retry with exponential backoff
- **TypeScript**: Full type safety
- **Framework-optimized**: Uses each framework's best practices

## Installation

\`\`\`bash
npm install @${name}/api-sdk
\`\`\`

## React

\`\`\`tsx
import { ApiProvider, useQuery, useMutation } from '@${name}/api-sdk/react';

// Setup
function App() {
  return (
    <ApiProvider config={{ baseUrl: '/api' }}>
      <UserList />
    </ApiProvider>
  );
}

// Query
function UserList() {
  const { data, isLoading, error, refetch } = useQuery('/users');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}

// Mutation
function CreateUser() {
  const { mutate, isLoading } = useMutation(
    (data) => getApiClient().post('/users', data),
    { invalidateQueries: ['/users'] }
  );

  return (
    <button onClick={() => mutate({ name: 'John' })} disabled={isLoading}>
      Create User
    </button>
  );
}
\`\`\`

## Vue

\`\`\`vue
<script setup>
import { useQuery, useMutation } from '@${name}/api-sdk/vue';

const { data, isLoading, refetch } = useQuery('/users');
const { mutate, isLoading: creating } = useMutation(
  (data) => getApiClient().post('/users', data),
  { invalidateQueries: ['/users'] }
);
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <ul v-else>
    <li v-for="user in data" :key="user.id">{{ user.name }}</li>
  </ul>
</template>
\`\`\`

## Angular

\`\`\`typescript
import { ApiModule, ApiService } from '@${name}/api-sdk/angular';

// Module setup
@NgModule({
  imports: [ApiModule.forRoot({ baseUrl: '/api' })]
})
export class AppModule {}

// Component
@Component({ ... })
export class UserListComponent {
  users$ = this.api.get<User[]>('/users');

  constructor(private api: ApiService) {}
}
\`\`\`

## Svelte

\`\`\`svelte
<script>
import { createQuery, initApiClient } from '@${name}/api-sdk/svelte';

initApiClient({ baseUrl: '/api' });

const { data, isLoading, refetch } = createQuery('/users');
</script>

{#if $isLoading}
  <p>Loading...</p>
{:else}
  <ul>
    {#each $data as user}
      <li>{user.name}</li>
    {/each}
  </ul>
{/if}
\`\`\`

## Solid.js

\`\`\`tsx
import { createQuery } from '@${name}/api-sdk/solid';

function UserList() {
  const { data, isLoading, refetch } = createQuery(() => '/users');

  return (
    <Show when={!isLoading()} fallback={<div>Loading...</div>}>
      <For each={data()}>
        {user => <li>{user.name}</li>}
      </For>
    </Show>
  );
}
\`\`\`

## API Reference

### Core Client

\`\`\`typescript
const client = createApiClient({
  baseUrl: '/api',
  timeout: 30000,
  retries: 3,
  cacheTime: 5 * 60 * 1000,
  getAuthToken: () => localStorage.getItem('token')
});

// Methods
client.get<T>(url, config?)
client.post<T>(url, data?, config?)
client.put<T>(url, data?, config?)
client.patch<T>(url, data?, config?)
client.delete<T>(url, config?)
client.invalidateCache(pattern?)
client.cancelAll()
\`\`\`

### Query Options

\`\`\`typescript
{
  params: Record<string, string>,
  enabled: boolean,
  refetchInterval: number,
  refetchOnWindowFocus: boolean,
  staleTime: number,
  cacheTime: number,
  initialData: T,
  onSuccess: (data) => void,
  onError: (error) => void
}
\`\`\`

### Mutation Options

\`\`\`typescript
{
  onSuccess: (data, variables) => void,
  onError: (error, variables) => void,
  onSettled: (data, error, variables) => void,
  invalidateQueries: string[]
}
\`\`\`

## License

MIT
`;
  }
}
