// IR -> typed Python client (stdlib only for REST/GraphQL; grpcio for gRPC).
//
// Models are dataclasses; (de)serialization is a small reflection helper over
// `typing.get_type_hints`, so the generated module has no third-party
// dependency and type-checks under mypy.

import {
  findModel,
  type IRField,
  type IRGraphqlOperation,
  type IRModel,
  type IRRestOperation,
  type IRRpcOperation,
  type ServiceContract,
  type TypeRef,
} from '../spec/ir';
import { safeDoc, toPascal, toSnake, pyIdent } from '../naming';
import { banner, avoidReserved, type ClientFile, type GenerateClientOptions } from './common';
import { buildGraphqlDocument } from './ts';

type Mode = 'json' | 'grpc';

const RESERVED = new Set([
  'T', 'ApiError', 'GraphqlError', 'Enum', 'Any', 'Dict', 'List', 'Optional', 'Union', 'Mapping', 'Callable',
  'Iterator', 'dataclass', 'field', 'fields', 'cast', 'MISSING',
]);

/** Python package name for a service (valid identifier, lowercase). */
export function pyPackageName(serviceName: string): string {
  const name = toSnake(serviceName).replace(/[^a-z0-9_]/g, '_');
  return /^[a-z_]/.test(name) ? `${name}_client` : `c_${name}_client`;
}

function pyType(ref: TypeRef, mode: Mode): string {
  switch (ref.k) {
    case 'scalar':
      switch (ref.name) {
        case 'string':
        case 'datetime':
          return 'str';
        case 'int':
        case 'long':
          return 'int';
        case 'float':
          return 'float';
        case 'bool':
          return 'bool';
        case 'bytes':
          return mode === 'grpc' ? 'bytes' : 'str';
        default:
          return 'Any';
      }
    case 'ref':
      return ref.name;
    case 'list':
      return `List[${ref.itemNullable ? `Optional[${pyType(ref.of, mode)}]` : pyType(ref.of, mode)}]`;
    case 'map':
      return `Dict[str, ${pyType(ref.of, mode)}]`;
  }
}

function enumMember(name: string, used: Set<string>): string {
  let id = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (!id || /^[0-9]/.test(id)) id = `V_${id}`;
  id = pyIdent(id);
  if (id.startsWith('_')) id = `V${id}`;
  let out = id;
  let n = 2;
  while (used.has(out)) out = `${id}_${n++}`;
  used.add(out);
  return out;
}

function defaultFor(ref: TypeRef, contract: ServiceContract, mode: Mode): { expr: string; type: string } {
  const type = pyType(ref, mode);
  switch (ref.k) {
    case 'list':
      return { expr: 'field(default_factory=list)', type };
    case 'map':
      return { expr: 'field(default_factory=dict)', type };
    case 'scalar':
      switch (ref.name) {
        case 'string':
        case 'datetime':
          return { expr: '""', type };
        case 'int':
        case 'long':
          return { expr: '0', type };
        case 'float':
          return { expr: '0.0', type };
        case 'bool':
          return { expr: 'False', type };
        case 'bytes':
          return { expr: mode === 'grpc' ? 'b""' : '""', type };
        default:
          return { expr: 'None', type: 'Any' };
      }
    case 'ref': {
      const m = findModel(contract, ref.name);
      if (m?.kind === 'enum' && m.values.length > 0) {
        return { expr: `${ref.name}.${enumMember(m.values[0].name, new Set())}`, type };
      }
      return { expr: 'None', type: `Optional[${type}]` };
    }
  }
}

function emitDataclass(m: Extract<IRModel, { kind: 'object' }>, contract: ServiceContract, mode: Mode): string {
  const used = new Set<string>();
  const entries = m.fields.map(f => {
    let id = pyIdent(toSnake(f.name) || 'field');
    let n = 2;
    while (used.has(id)) id = `${pyIdent(toSnake(f.name))}_${n++}`;
    used.add(id);
    return { f, id };
  });
  const meta = (e: { f: IRField; id: string }): string => (e.id !== e.f.name ? `metadata={"json": ${JSON.stringify(e.f.name)}}` : '');
  const lines: string[] = [];
  const required = entries.filter(e => mode === 'json' && e.f.required && !e.f.nullable);
  const rest = entries.filter(e => !required.includes(e));
  for (const e of required) {
    const type = pyType(e.f.type, mode);
    const md = meta(e);
    lines.push(md ? `    ${e.id}: ${type} = field(${md})` : `    ${e.id}: ${type}`);
  }
  // Required-without-default must precede defaulted fields, so a metadata-only
  // `field(...)` (no default) is only legal here, among the required ones.
  for (const e of rest) {
    const md = meta(e);
    let type: string;
    let expr: string;
    if (mode === 'grpc') {
      const d = defaultFor(e.f.type, contract, mode);
      type = d.type;
      expr = d.expr;
      if (!e.f.required && e.f.type.k !== 'list' && e.f.type.k !== 'map' && !type.startsWith('Optional[') && type !== 'Any') {
        type = `Optional[${type}]`;
        expr = 'None';
      }
    } else {
      type = pyType(e.f.type, mode);
      if (e.f.type.k === 'list' && e.f.required) {
        type = pyType(e.f.type, mode);
        expr = 'field(default_factory=list)';
      } else if (e.f.type.k === 'map' && e.f.required) {
        expr = 'field(default_factory=dict)';
      } else {
        type = type === 'Any' ? 'Any' : `Optional[${type}]`;
        expr = 'None';
      }
    }
    if (md) {
      if (expr.startsWith('field(')) expr = expr.replace(/\)$/, `, ${md})`);
      else expr = `field(default=${expr}, ${md})`;
    }
    lines.push(`    ${e.id}: ${type} = ${expr}`);
  }
  const doc = m.description ? `    """${safeDoc(m.description)}"""\n` : '';
  const body = lines.length ? lines.join('\n') : '    pass';
  return `@dataclass\nclass ${m.name}:\n${doc}${body}`;
}

function emitModels(contract: ServiceContract, mode: Mode): string {
  const enums = contract.models.filter((m): m is Extract<IRModel, { kind: 'enum' }> => m.kind === 'enum');
  const objects = contract.models.filter((m): m is Extract<IRModel, { kind: 'object' }> => m.kind === 'object');
  const unions = contract.models.filter((m): m is Extract<IRModel, { kind: 'union' }> => m.kind === 'union');
  const out: string[] = [];
  for (const e of enums) {
    const used = new Set<string>();
    const members = e.values.map(v => `    ${enumMember(v.name, used)} = ${JSON.stringify(v.name)}`).join('\n') || '    pass';
    out.push(`class ${e.name}(str, Enum):\n${e.description ? `    """${safeDoc(e.description)}"""\n` : ''}${members}`);
  }
  for (const o of objects) out.push(emitDataclass(o, contract, mode));
  for (const u of unions) {
    out.push(`${u.name} = Union[${u.members.join(', ') || 'Any'}]`);
  }
  return out.join('\n\n\n');
}

const IMPORTS = `from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import MISSING, dataclass, field, fields, is_dataclass
from enum import Enum
from typing import Any, Callable, Dict, Iterator, List, Mapping, Optional, Union, cast, get_args, get_origin, get_type_hints
`;

const RUNTIME = (mode: Mode): string => `
def _encode(value: Any) -> Any:
    """Dataclass / Enum / list / dict -> plain JSON-compatible structure (None fields are omitted)."""
    if value is None:
        return None
    if is_dataclass(value) and not isinstance(value, type):
        out: Dict[str, Any] = {}
        for f in fields(value):
            item = getattr(value, f.name)
            if item is None:
                continue
            out[f.metadata.get("json", f.name)] = _encode(item)
        return out
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (list, tuple)):
        return [_encode(v) for v in value]
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
${mode === 'json' ? '    if isinstance(value, bytes):\n        return base64.b64encode(value).decode("ascii")\n' : ''}    return value


def _decode(tp: Any, value: Any) -> Any:
    """Plain JSON structure -> typed value, following the dataclass type hints."""
    if value is None or tp is Any:
        return value
    origin = get_origin(tp)
    if origin is Union:
        members = [a for a in get_args(tp) if a is not type(None)]
        if len(members) == 1:
            return _decode(members[0], value)
        if isinstance(value, dict):
            wanted = value.get("__typename")
            for m in members:
                if wanted is not None and getattr(m, "__name__", None) == wanted:
                    return _decode(m, value)
            for m in members:
                if isinstance(m, type) and is_dataclass(m):
                    needed = {f.metadata.get("json", f.name) for f in fields(m) if f.default is MISSING and f.default_factory is MISSING}
                    if needed <= set(value.keys()):
                        return _decode(m, value)
        return value
    if origin in (list, List):
        (item,) = get_args(tp)
        return [_decode(item, v) for v in value]
    if origin in (dict, Dict):
        _k, item = get_args(tp)
        return {k: _decode(item, v) for k, v in value.items()}
    if isinstance(tp, type) and issubclass(tp, Enum):
        return tp(value)
    if isinstance(tp, type) and is_dataclass(tp):
        hints = get_type_hints(tp)
        kwargs: Dict[str, Any] = {}
        for f in fields(tp):
            key = f.metadata.get("json", f.name)
            if key in value:
                kwargs[f.name] = _decode(hints[f.name], value[key])
        return tp(**kwargs)
${mode === 'json' ? '    if tp is bytes and isinstance(value, str):\n        return base64.b64decode(value)\n' : ''}    return value
`;

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

interface PyParam {
  id: string;
  param: IRRestOperation['params'][number];
}

function bindRestParams(op: IRRestOperation): PyParam[] {
  const used = new Set<string>(['self', 'body']);
  return op.params.map(p => {
    let id = pyIdent(toSnake(p.name) || 'param');
    let n = 2;
    while (used.has(id)) id = `${pyIdent(toSnake(p.name))}_${n++}`;
    used.add(id);
    return { id, param: p };
  });
}

function restMethod(op: IRRestOperation): string {
  const bound = bindRestParams(op);
  const required: string[] = [];
  const optional: string[] = [];
  for (const b of bound.filter(x => x.param.required)) required.push(`${b.id}: ${pyType(b.param.type, 'json')}`);
  if (op.body?.required) required.push(`body: ${pyType(op.body.type, 'json')}`);
  for (const b of bound.filter(x => !x.param.required)) optional.push(`${b.id}: Optional[${pyType(b.param.type, 'json')}] = None`);
  if (op.body && !op.body.required) optional.push(`body: Optional[${pyType(op.body.type, 'json')}] = None`);
  const sig = ['self', ...required, ...(optional.length ? ['*', ...optional] : [])].join(', ');
  const ret = op.response ? pyType(op.response.type, 'json') : 'None';
  const dict = (loc: 'path' | 'query' | 'header'): string => {
    const items = bound.filter(b => b.param.in === loc);
    return items.length ? `{${items.map(b => `${JSON.stringify(b.param.name)}: ${b.id}`).join(', ')}}` : '';
  };
  const kw: string[] = [];
  if (dict('path')) kw.push(`path=${dict('path')}`);
  if (dict('query')) kw.push(`query=${dict('query')}`);
  if (dict('header')) kw.push(`headers=${dict('header')}`);
  if (op.body) kw.push('body=_encode(body)');
  const doc = safeDoc(op.summary ?? op.description ?? `${op.method} ${op.path}`);
  const call = `self._request(${JSON.stringify(op.method)}, ${JSON.stringify(op.path)}${kw.length ? ', ' + kw.join(', ') : ''})`;
  if (!op.response) {
    return `    def ${pyIdent(toSnake(op.name))}(${sig}) -> None:\n        """${doc}"""\n        ${call}\n        return None`;
  }
  return `    def ${pyIdent(toSnake(op.name))}(${sig}) -> ${ret}:\n        """${doc}"""\n        data = ${call}\n        return cast(${ret}, _decode(${ret}, data))`;
}

function restClient(contract: ServiceContract, opts: GenerateClientOptions): string {
  const cls = `${toPascal(opts.serviceName)}Client`;
  const baseUrl = contract.baseUrl ?? 'http://localhost:8080';
  const ops = contract.operations.filter((o): o is IRRestOperation => o.protocol === 'rest');
  return `${banner(contract, '#')}
"""Typed REST client for ${safeDoc(contract.title)}."""

${IMPORTS}
${RUNTIME('json')}

${emitModels(contract, 'json')}


class ApiError(Exception):
    """Raised for every non-2xx response."""

    def __init__(self, status: int, reason: str, body: Any) -> None:
        super().__init__(f"HTTP {status} {reason}")
        self.status = status
        self.reason = reason
        self.body = body


def _scalar(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, Enum):
        return str(value.value)
    return str(value)


class ${cls}:
    """Typed REST client for ${safeDoc(contract.title)} (stdlib urllib, no dependencies)."""

    def __init__(
        self,
        base_url: str = ${JSON.stringify(baseUrl)},
        *,
        headers: Optional[Mapping[str, str]] = None,
        timeout: float = 30.0,
        opener: Optional[urllib.request.OpenerDirector] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._headers: Dict[str, str] = dict(headers or {})
        self._timeout = timeout
        self._opener = opener or urllib.request.build_opener()

    def _request(
        self,
        method: str,
        template: str,
        *,
        path: Optional[Dict[str, Any]] = None,
        query: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, Any]] = None,
        body: Any = None,
    ) -> Any:
        url = self.base_url + template
        for key, value in (path or {}).items():
            url = url.replace("{" + key + "}", urllib.parse.quote(_scalar(value), safe=""))
        pairs: List[Any] = []
        for key, value in (query or {}).items():
            if value is None:
                continue
            if isinstance(value, (list, tuple)):
                pairs.extend((key, _scalar(v)) for v in value)
            else:
                pairs.append((key, _scalar(value)))
        if pairs:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(pairs)
        hdrs: Dict[str, str] = {"Accept": "application/json", **self._headers}
        for key, value in (headers or {}).items():
            if value is not None:
                hdrs[key] = _scalar(value)
        data: Optional[bytes] = None
        if body is not None:
            hdrs["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, method=method, headers=hdrs)
        try:
            with self._opener.open(request, timeout=self._timeout) as response:
                raw = response.read()
                ctype = response.headers.get("Content-Type", "")
        except urllib.error.HTTPError as err:
            raw = err.read()
            ctype = err.headers.get("Content-Type", "") if err.headers else ""
            raise ApiError(err.code, str(err.reason), _parse_body(raw, ctype)) from None
        return _parse_body(raw, ctype)
${ops.length ? '\n' + ops.map(restMethod).join('\n\n') + '\n' : ''}

def _parse_body(raw: bytes, content_type: str) -> Any:
    if not raw:
        return None
    text = raw.decode("utf-8", errors="replace")
    return json.loads(text) if "json" in content_type else text
`;
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

function graphqlMethod(contract: ServiceContract, op: IRGraphqlOperation): string {
  const used = new Set<string>(['self']);
  const bound = op.args.map(a => {
    let id = pyIdent(toSnake(a.name) || 'arg');
    let n = 2;
    while (used.has(id)) id = `${pyIdent(toSnake(a.name))}_${n++}`;
    used.add(id);
    return { id, a };
  });
  const req = bound.filter(b => b.a.required).map(b => `${b.id}: ${pyType(b.a.type, 'json')}`);
  const opt = bound.filter(b => !b.a.required).map(b => `${b.id}: Optional[${pyType(b.a.type, 'json')}] = None`);
  const sig = ['self', ...req, ...(opt.length ? ['*', ...opt] : [])].join(', ');
  const ret = pyType(op.returns, 'json');
  const retType = op.returnsNullable ? `Optional[${ret}]` : ret;
  const variables = bound.length ? `{${bound.map(b => `${JSON.stringify(b.a.name)}: ${b.id}`).join(', ')}}` : '{}';
  const doc = buildGraphqlDocument(contract, op);
  const name = toPascal(op.name);
  return `    def ${pyIdent(toSnake(op.name))}(${sig}) -> ${retType}:
        """${safeDoc(op.description ?? `${op.operation} ${op.field}`)}"""
        data = self._execute(${JSON.stringify(doc)}, _vars(${variables}), ${JSON.stringify(name)})
        return cast(${retType}, _decode(${retType}, data.get(${JSON.stringify(op.field)})))`;
}

function graphqlClient(contract: ServiceContract, opts: GenerateClientOptions): string {
  const cls = `${toPascal(opts.serviceName)}Client`;
  const ops = contract.operations.filter(
    (o): o is IRGraphqlOperation => o.protocol === 'graphql' && o.operation !== 'subscription'
  );
  return `${banner(contract, '#')}
"""Typed GraphQL client for ${safeDoc(contract.title)}."""

${IMPORTS}
${RUNTIME('json')}

${emitModels(contract, 'json')}


class GraphqlError(Exception):
    """Raised when the server returns GraphQL errors without data."""

    def __init__(self, errors: List[Dict[str, Any]]) -> None:
        super().__init__("; ".join(str(e.get("message")) for e in errors))
        self.errors = errors


Execute = Callable[[str, Dict[str, Any], str], Dict[str, Any]]


def _vars(values: Dict[str, Any]) -> Dict[str, Any]:
    return {k: _encode(v) for k, v in values.items() if v is not None}


class ${cls}:
    """Typed GraphQL client for ${safeDoc(contract.title)} (stdlib urllib, no dependencies)."""

    def __init__(
        self,
        endpoint: str = "http://localhost:8080/graphql",
        *,
        headers: Optional[Mapping[str, str]] = None,
        timeout: float = 30.0,
        execute: Optional[Execute] = None,
    ) -> None:
        self._endpoint = endpoint
        self._headers: Dict[str, str] = dict(headers or {})
        self._timeout = timeout
        self._execute: Execute = execute or self._http_execute

    def _http_execute(self, document: str, variables: Dict[str, Any], operation_name: str) -> Dict[str, Any]:
        payload = json.dumps({"query": document, "variables": variables, "operationName": operation_name}).encode("utf-8")
        hdrs = {"Content-Type": "application/json", "Accept": "application/json", **self._headers}
        request = urllib.request.Request(self._endpoint, data=payload, method="POST", headers=hdrs)
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            try:
                body = json.loads(err.read().decode("utf-8"))
            except ValueError:
                raise GraphqlError([{"message": f"HTTP {err.code} {err.reason}"}]) from None
        errors = body.get("errors")
        if errors and not body.get("data"):
            raise GraphqlError(errors)
        return cast(Dict[str, Any], body.get("data") or {})
${ops.length ? '\n' + ops.map(o => graphqlMethod(contract, o)).join('\n\n') + '\n' : ''}`;
}

// ---------------------------------------------------------------------------
// gRPC
// ---------------------------------------------------------------------------

const GRPC_RUNTIME = `
def _pb_to_dict(msg: Any) -> Dict[str, Any]:
    """Protobuf message -> plain dict keyed by proto field names (enums by name)."""
    out: Dict[str, Any] = {}
    for fd in msg.DESCRIPTOR.fields:
        value = getattr(msg, fd.name)
        is_map = fd.message_type is not None and fd.message_type.GetOptions().map_entry
        repeated = fd.is_repeated if hasattr(fd, "is_repeated") else fd.label == fd.LABEL_REPEATED
        if is_map:
            vfd = fd.message_type.fields_by_name["value"]
            out[fd.name] = {k: _pb_value(vfd, v) for k, v in value.items()}
        elif repeated:
            out[fd.name] = [_pb_value(fd, v) for v in value]
        elif fd.message_type is not None:
            out[fd.name] = _pb_to_dict(value) if msg.HasField(fd.name) else None
        elif fd.containing_oneof is not None and not msg.HasField(fd.name):
            out[fd.name] = None
        else:
            out[fd.name] = _pb_value(fd, value)
    return out


def _pb_value(fd: Any, value: Any) -> Any:
    if fd.message_type is not None:
        return _pb_to_dict(value)
    if fd.enum_type is not None:
        enum_value = fd.enum_type.values_by_number.get(value)
        return enum_value.name if enum_value is not None else value
    return value


def _fill_pb(msg: Any, data: Mapping[str, Any]) -> Any:
    """Populate a protobuf message from a dict keyed by proto field names."""
    for key, value in data.items():
        if value is None:
            continue
        fd = msg.DESCRIPTOR.fields_by_name[key]
        target = getattr(msg, key)
        is_map = fd.message_type is not None and fd.message_type.GetOptions().map_entry
        repeated = fd.is_repeated if hasattr(fd, "is_repeated") else fd.label == fd.LABEL_REPEATED
        if is_map:
            vfd = fd.message_type.fields_by_name["value"]
            for k, v in value.items():
                if vfd.message_type is not None:
                    _fill_pb(target[k], v)
                else:
                    target[k] = _pb_scalar(vfd, v)
        elif repeated:
            for v in value:
                if fd.message_type is not None:
                    _fill_pb(target.add(), v)
                else:
                    target.append(_pb_scalar(fd, v))
        elif fd.message_type is not None:
            _fill_pb(target, value)
        else:
            setattr(msg, key, _pb_scalar(fd, value))
    return msg


def _pb_scalar(fd: Any, value: Any) -> Any:
    if fd.enum_type is not None and isinstance(value, str):
        return fd.enum_type.values_by_name[value].number
    return value
`;

function pbClassPath(contract: ServiceContract, ref: TypeRef): string {
  if (ref.k !== 'ref') return 'object';
  const m = findModel(contract, ref.name);
  const fqn = m && 'fqn' in m && m.fqn ? m.fqn : ref.name;
  const pkg = contract.packageName;
  const rel = pkg && fqn.startsWith(`${pkg}.`) ? fqn.slice(pkg.length + 1) : fqn;
  return rel;
}

function grpcClient(contract: ServiceContract, opts: GenerateClientOptions, pbModule: string): string {
  const grouped = new Map<string, IRRpcOperation[]>();
  const skipped: string[] = [];
  for (const op of contract.operations) {
    if (op.protocol !== 'grpc') continue;
    if (op.clientStreaming) {
      skipped.push(`${op.fqService}/${op.method}`);
      continue;
    }
    grouped.set(op.fqService, [...(grouped.get(op.fqService) ?? []), op]);
  }
  const classes = [...grouped.entries()].map(([fq, ops]) => {
    const simple = fq.split('.').pop()!;
    const cls = /Client$/.test(simple) ? simple : `${simple}Client`;
    const methods = ops.map(op => {
      const req = pyType(op.request, 'grpc');
      const res = pyType(op.response, 'grpc');
      const name = pyIdent(toSnake(op.name));
      const reqPb = `_pb2.${pbClassPath(contract, op.request)}`;
      const doc = safeDoc(op.description ?? `${fq}/${op.method}`);
      if (op.serverStreaming) {
        return `    def ${name}(self, request: Union[${req}, Mapping[str, Any]], *, metadata: Optional[Mapping[str, str]] = None, timeout: Optional[float] = None) -> Iterator[${res}]:
        """${doc}"""
        message = _fill_pb(${reqPb}(), _as_dict(request))
        for item in self._stub.${op.method}(message, metadata=self._meta(metadata), timeout=timeout or self._timeout):
            yield cast(${res}, _decode(${res}, _pb_to_dict(item)))`;
      }
      return `    def ${name}(self, request: Union[${req}, Mapping[str, Any]], *, metadata: Optional[Mapping[str, str]] = None, timeout: Optional[float] = None) -> ${res}:
        """${doc}"""
        message = _fill_pb(${reqPb}(), _as_dict(request))
        reply = self._stub.${op.method}(message, metadata=self._meta(metadata), timeout=timeout or self._timeout)
        return cast(${res}, _decode(${res}, _pb_to_dict(reply)))`;
    });
    return `class ${cls}:
    """Typed gRPC client for \`${fq}\`."""

    def __init__(
        self,
        address: str,
        *,
        credentials: Optional[grpc.ChannelCredentials] = None,
        metadata: Optional[Mapping[str, str]] = None,
        timeout: Optional[float] = None,
        channel: Optional[grpc.Channel] = None,
    ) -> None:
        if channel is not None:
            self._channel = channel
        elif credentials is not None:
            self._channel = grpc.secure_channel(address, credentials)
        else:
            self._channel = grpc.insecure_channel(address)
        self._stub = _pb2_grpc.${simple}Stub(self._channel)  # type: ignore[no-untyped-call,unused-ignore]
        self._metadata: Dict[str, str] = dict(metadata or {})
        self._timeout = timeout

    def _meta(self, extra: Optional[Mapping[str, str]]) -> Optional[List[Any]]:
        merged = {**self._metadata, **(extra or {})}
        return [(k.lower(), v) for k, v in merged.items()] or None

    def close(self) -> None:
        self._channel.close()

${methods.join('\n\n')}`;
  });
  const skippedNote = skipped.length
    ? `# Client-streaming and bidirectional RPCs are not generated: ${skipped.join(', ')}\n`
    : '';
  return `${banner(contract, '#')}
${skippedNote}"""Typed gRPC client for ${safeDoc(contract.title)}.

Requires the protobuf stubs generated from the bundled .proto:
    python -m grpc_tools.protoc -I. --python_out=. --pyi_out=. --grpc_python_out=. <file>.proto
(re-shell runs this for you when grpcio-tools is installed; see generate-stubs.sh.)
"""

${IMPORTS.replace('import urllib.error\nimport urllib.parse\nimport urllib.request\n', '')}
import grpc

from . import ${pbModule}_pb2 as _pb2
from . import ${pbModule}_pb2_grpc as _pb2_grpc
${RUNTIME('grpc')}
${GRPC_RUNTIME}

def _as_dict(request: Any) -> Mapping[str, Any]:
    if isinstance(request, Mapping):
        return request
    return cast(Mapping[str, Any], _encode(request))


${emitModels(contract, 'grpc')}


${classes.join('\n\n\n')}
`;
}

// ---------------------------------------------------------------------------

/**
 * Generate the Python client package.
 *
 * @param pbModule - Base name of the protobuf stubs (`<pbModule>_pb2.py`), gRPC only.
 */
export function generatePythonClient(
  rawContract: ServiceContract,
  opts: GenerateClientOptions,
  pbModule = 'service'
): ClientFile[] {
  const contract = avoidReserved(rawContract, RESERVED);
  const pkg = pyPackageName(opts.serviceName);
  const source =
    contract.protocol === 'rest'
      ? restClient(contract, opts)
      : contract.protocol === 'graphql'
        ? graphqlClient(contract, opts)
        : grpcClient(contract, opts, pbModule);
  const publicNames = contract.models.map(m => m.name);
  const clientNames: string[] = [];
  if (contract.protocol === 'grpc') {
    const seen = new Set<string>();
    for (const op of contract.operations) {
      if (op.protocol === 'grpc' && !seen.has(op.fqService)) {
        seen.add(op.fqService);
        const simple = op.fqService.split('.').pop()!;
        clientNames.push(/Client$/.test(simple) ? simple : `${simple}Client`);
      }
    }
  } else {
    clientNames.push(`${toPascal(opts.serviceName)}Client`);
    clientNames.push(contract.protocol === 'rest' ? 'ApiError' : 'GraphqlError');
  }
  const init = `${banner(contract, '#')}
from .client import (  # noqa: F401
${[...clientNames, ...publicNames].map(n => `    ${n},`).join('\n')}
)

__all__ = [
${[...clientNames, ...publicNames].map(n => `    ${JSON.stringify(n)},`).join('\n')}
]
`;
  const files: ClientFile[] = [
    { path: `python/${pkg}/__init__.py`, content: init, kind: 'python-client' },
    { path: `python/${pkg}/client.py`, content: source, kind: 'python-client' },
    { path: `python/${pkg}/py.typed`, content: '', kind: 'support' },
    {
      path: 'python/pyproject.toml',
      content: `[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[project]
name = ${JSON.stringify(`${opts.serviceName}-client`)}
version = ${JSON.stringify(contract.version ?? '0.1.0')}
description = ${JSON.stringify(`Typed ${contract.protocol} client for ${contract.title} (generated by re-shell)`)}
requires-python = ">=3.8"
${contract.protocol === 'grpc' ? 'dependencies = ["grpcio>=1.50", "protobuf>=4.21"]\n' : 'dependencies = []\n'}
[tool.setuptools]
packages = [${JSON.stringify(pkg)}]

[tool.setuptools.package-data]
${JSON.stringify(pkg)} = ["py.typed"]
`,
      kind: 'manifest',
    },
  ];
  return files;
}
