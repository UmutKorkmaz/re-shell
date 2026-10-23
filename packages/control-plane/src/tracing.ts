import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ROOT_CONTEXT, SpanKind, SpanStatusCode, trace,
  type Attributes, type Context, type Span, type SpanContext,
} from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BasicTracerProvider, BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { fail, ok, type ControlPlaneResult } from './errors.js';

export interface TracingOptions {
  endpoint?: string;
  serviceName: string;
  sampleRatio: number;
}

type TraceLogger = (entry: Record<string, unknown>) => void;
const stderrLogger: TraceLogger = (entry) => { process.stderr.write(`${JSON.stringify(entry)}\n`); };

// Context is scoped to an asynchronous request/job, never a process-wide mutable span.
const active = new AsyncLocalStorage<Context>();

/** Only canonical version-00 W3C context is accepted. No baggage or tracestate is forwarded. */
export function parseTraceParent(value: unknown): SpanContext | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(value);
  if (!parts || /^0+$/.test(parts[1]) || /^0+$/.test(parts[2])) return undefined;
  return { traceId: parts[1], spanId: parts[2], traceFlags: parseInt(parts[3], 16) & 1, isRemote: true };
}

export function currentTraceParent(): string | undefined {
  const span = trace.getSpanContext(active.getStore() ?? ROOT_CONTEXT);
  if (!span) return undefined;
  return `00-${span.traceId}-${span.spanId}-${(span.traceFlags & 1).toString(16).padStart(2, '0')}`;
}

export function loadTracingOptions(env: Readonly<Record<string, string | undefined>>): ControlPlaneResult<TracingOptions | undefined> {
  const endpoint = env.CONTROL_PLANE_TRACE_ENDPOINT;
  if (!endpoint) return env.CONTROL_PLANE_TRACE_SAMPLE_RATIO === undefined
    ? ok(undefined) : fail('CONFIG_ERROR', 'Tracing sampling requires CONTROL_PLANE_TRACE_ENDPOINT.');
  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
        endpoint !== endpoint.trim() || endpoint.length > 2048 || !url.pathname.endsWith('/v1/traces')) throw new Error();
  } catch { return fail('CONFIG_ERROR', 'CONTROL_PLANE_TRACE_ENDPOINT must be an HTTP(S) OTLP /v1/traces endpoint without credentials, query or fragment.'); }
  const ratio = Number(env.CONTROL_PLANE_TRACE_SAMPLE_RATIO ?? '0.1');
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1 || env.CONTROL_PLANE_TRACE_SAMPLE_RATIO === '') {
    return fail('CONFIG_ERROR', 'CONTROL_PLANE_TRACE_SAMPLE_RATIO must be between 0 and 1.');
  }
  return ok({ endpoint, serviceName: 're-shell-control-plane', sampleRatio: ratio });
}

/** Bounded SDK batching. Export failures never change application results. */
export class Tracing {
  private readonly provider: BasicTracerProvider;
  private readonly tracer;
  private lastWarning = -Infinity;

  constructor(options: TracingOptions, exporter?: SpanExporter, private readonly logger: TraceLogger = stderrLogger) {
    if (!exporter && !options.endpoint) throw new Error('Tracing requires an explicit OTLP endpoint.');
    const delegate = exporter ?? new OTLPTraceExporter({ url: options.endpoint, timeoutMillis: 2000 });
    const guarded: SpanExporter = {
      export: (spans, callback) => {
        let completed = false;
        const finish: Parameters<SpanExporter['export']>[1] = (result) => {
          if (completed) return;
          completed = true;
          if (result.code !== 0) this.warn();
          callback(result);
        };
        try { delegate.export(spans, finish); }
        catch { finish({ code: 1 }); }
      },
      shutdown: async () => { await delegate.shutdown(); },
    };
    this.provider = new BasicTracerProvider({
      resource: resourceFromAttributes({ 'service.name': options.serviceName }),
      sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(options.sampleRatio) }),
      spanProcessors: [new BatchSpanProcessor(guarded, {
        maxQueueSize: 512, maxExportBatchSize: 64, scheduledDelayMillis: 1000, exportTimeoutMillis: 2500,
      })],
    });
    this.tracer = this.provider.getTracer('re-shell-control-plane');
  }

  private warn(): void {
    const now = Date.now();
    if (now - this.lastWarning < 30_000) return;
    this.lastWarning = now;
    // Never include the endpoint, error, headers, span contents or credentials.
    try { this.logger({ level: 'warn', component: 'tracing', message: 'trace export failed; telemetry may be incomplete' }); }
    catch { /* An unavailable log sink cannot affect a request or shutdown. */ }
  }

  start(name: string, kind = SpanKind.INTERNAL, parent?: string, attributes?: Attributes): Span {
    const remote = parseTraceParent(parent);
    const context = remote ? trace.setSpanContext(ROOT_CONTEXT, remote) : active.getStore() ?? ROOT_CONTEXT;
    return this.tracer.startSpan(name, { kind, attributes }, context);
  }

  within<T>(span: Span, fn: () => T): T {
    return active.run(trace.setSpan(active.getStore() ?? ROOT_CONTEXT, span), fn);
  }

  async run<T>(name: string, attributes: Attributes, fn: (span: Span) => T | Promise<T>, parent?: string, kind = SpanKind.INTERNAL): Promise<T> {
    const span = this.start(name, kind, parent, attributes);
    try { return await this.within(span, () => fn(span)); }
    catch (error) { span.setStatus({ code: SpanStatusCode.ERROR }); throw error; }
    finally { span.end(); }
  }

  async flush(): Promise<void> { try { await this.provider.forceFlush(); } catch { this.warn(); } }
  async close(): Promise<void> { try { await this.provider.shutdown(); } catch { this.warn(); } }
}
