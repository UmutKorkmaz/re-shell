// REST mock: serve an OpenAPI 3 document from its examples / schemas.

import Ajv, { type ValidateFunction } from 'ajv';

import { derefPointer, synthesize } from './example';

type Json = Record<string, unknown>;

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function isObj(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What the REST mock decided to answer. */
export interface RestReply {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** operationId or "METHOD path" of the matched route (for the request log). */
  operation?: string;
}

interface Route {
  method: string;
  template: string;
  regex: RegExp;
  names: string[];
  op: Json;
  pathParams: unknown[];
  operation: string;
  staticSegments: number;
}

/** A REST mock built from one OpenAPI document. */
export interface RestMock {
  /** Server base path derived from `servers[0].url` (e.g. `/api/v1`), or ''. */
  basePath: string;
  routes: { method: string; path: string; operationId?: string }[];
  /** Answer a request, or `undefined` when no route matches. */
  respond(method: string, pathname: string, query: URLSearchParams, headers: Record<string, string | string[] | undefined>, body: Buffer): RestReply | undefined;
}

function deref(doc: Json, node: unknown): Json {
  let cur = node;
  for (let i = 0; i < 8 && isObj(cur) && typeof cur.$ref === 'string'; i++) {
    cur = derefPointer(doc, cur.$ref) ?? {};
  }
  return isObj(cur) ? cur : {};
}

function json(status: number, payload: unknown, operation?: string): RestReply {
  return {
    status,
    headers: { 'content-type': 'application/json', 'x-mock-server': 're-shell' },
    body: JSON.stringify(payload),
    operation,
  };
}

function pickMedia(content: unknown): { type: string; media: Json } | undefined {
  if (!isObj(content)) return undefined;
  const keys = Object.keys(content);
  const key = keys.find(k => k === 'application/json') ?? keys.find(k => /json/i.test(k)) ?? keys[0];
  if (!key) return undefined;
  const media = content[key];
  return { type: key, media: isObj(media) ? media : {} };
}

/** Build a REST mock from a parsed OpenAPI 3 document. */
export function createRestMock(doc: Json): RestMock {
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validators = new Map<string, ValidateFunction>();

  let basePath = '';
  if (Array.isArray(doc.servers) && isObj(doc.servers[0]) && typeof doc.servers[0].url === 'string') {
    try {
      const url = new URL(String(doc.servers[0].url).replace(/\{[^}]+\}/g, 'x'), 'http://placeholder');
      basePath = url.pathname.replace(/\/+$/, '');
    } catch {
      basePath = '';
    }
  }

  const routes: Route[] = [];
  const paths = isObj(doc.paths) ? doc.paths : {};
  for (const [template, itemRaw] of Object.entries(paths)) {
    const item = deref(doc, itemRaw);
    const names: string[] = [];
    const pattern = template
      .split('/')
      .map(seg => {
        const m = seg.match(/^\{(.+)\}$/);
        if (m) {
          names.push(m[1]);
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    for (const method of METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      routes.push({
        method: method.toUpperCase(),
        template,
        regex: new RegExp(`^${pattern}/?$`),
        names,
        op,
        pathParams: Array.isArray(item.parameters) ? item.parameters : [],
        operation: typeof op.operationId === 'string' ? op.operationId : `${method.toUpperCase()} ${template}`,
        staticSegments: template.split('/').filter(s => s && !s.startsWith('{')).length,
      });
    }
  }
  routes.sort((a, b) => b.staticSegments - a.staticSegments);

  const validatorFor = (key: string, schema: unknown): ValidateFunction | undefined => {
    const cached = validators.get(key);
    if (cached) return cached;
    try {
      const fn = ajv.compile({ components: doc.components, ...(isObj(schema) ? schema : {}) } as Json);
      validators.set(key, fn);
      return fn;
    } catch {
      return undefined;
    }
  };

  const respond: RestMock['respond'] = (method, pathname, query, headers, body) => {
    let p = pathname;
    if (basePath && (p === basePath || p.startsWith(`${basePath}/`))) p = p.slice(basePath.length) || '/';
    for (const route of routes) {
      if (route.method !== method.toUpperCase()) continue;
      const m = route.regex.exec(p);
      if (!m) continue;

      // --- request validation (required params, JSON body) -------------------
      const problems: string[] = [];
      const params = [...route.pathParams, ...(Array.isArray(route.op.parameters) ? route.op.parameters : [])].map(x => deref(doc, x));
      for (const param of params) {
        if (param.required !== true || typeof param.name !== 'string') continue;
        if (param.in === 'query' && !query.has(param.name)) problems.push(`missing required query parameter "${param.name}"`);
        if (param.in === 'header' && headers[param.name.toLowerCase()] === undefined) problems.push(`missing required header "${param.name}"`);
      }
      const requestBody = deref(doc, route.op.requestBody);
      const media = pickMedia(requestBody.content);
      if (isObj(requestBody) && Object.keys(requestBody).length > 0 && media) {
        if (body.length === 0) {
          if (requestBody.required === true) problems.push('request body is required');
        } else if (/json/i.test(media.type)) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(body.toString('utf8'));
          } catch {
            problems.push('request body is not valid JSON');
          }
          if (parsed !== undefined && media.media.schema) {
            const validate = validatorFor(`${route.method} ${route.template}`, media.media.schema);
            if (validate && !validate(parsed)) {
              for (const e of validate.errors ?? []) problems.push(`body${e.instancePath} ${e.message ?? 'is invalid'}`);
            }
          }
        }
      }
      if (problems.length > 0) {
        return json(400, { error: 'request does not match the contract', problems }, route.operation);
      }

      // --- response ------------------------------------------------------------
      const responses = isObj(route.op.responses) ? route.op.responses : {};
      const prefer = String(headers.prefer ?? '');
      const wanted = /\bcode=(\d{3})\b/.exec(prefer)?.[1];
      let code: string | undefined;
      if (wanted && wanted in responses) code = wanted;
      else if (wanted) {
        return json(
          501,
          { error: `the contract defines no ${wanted} response for ${route.method} ${route.template}`, defined: Object.keys(responses) },
          route.operation
        );
      }
      code = code ?? Object.keys(responses).filter(c => /^2\d\d$/.test(c)).sort()[0] ?? (responses.default ? 'default' : undefined);
      if (!code) return json(200, {}, route.operation);
      const response = deref(doc, responses[code]);
      const status = /^\d{3}$/.test(code) ? Number(code) : 200;
      const content = pickMedia(response.content);
      if (!content || status === 204) {
        return { status, headers: { 'x-mock-server': 're-shell' }, body: '', operation: route.operation };
      }
      let payload: unknown;
      const examples = isObj(content.media.examples) ? Object.values(content.media.examples) : [];
      if ('example' in content.media) payload = content.media.example;
      else if (examples.length > 0 && isObj(examples[0]) && 'value' in examples[0]) payload = examples[0].value;
      else payload = synthesize(doc, content.media.schema ?? { type: 'string' });
      if (!/json/i.test(content.type)) {
        return {
          status,
          headers: { 'content-type': content.type, 'x-mock-server': 're-shell' },
          body: typeof payload === 'string' ? payload : JSON.stringify(payload),
          operation: route.operation,
        };
      }
      return json(status, payload === undefined ? null : payload, route.operation);
    }
    return undefined;
  };

  return {
    basePath,
    routes: routes.map(r => ({
      method: r.method,
      path: r.template,
      operationId: typeof r.op.operationId === 'string' ? r.op.operationId : undefined,
    })),
    respond,
  };
}
