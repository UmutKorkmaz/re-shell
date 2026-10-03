// IR -> typed Go client (REST / GraphQL: net/http + encoding/json, stdlib only;
// gRPC: thin typed wrapper over protoc-generated stubs).

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
import { goExported, goIdent, safeDoc, toCamel, toKebab } from '../naming';
import { banner, avoidReserved, type ClientFile, type GenerateClientOptions } from './common';
import { buildGraphqlDocument } from './ts';

const RESERVED = new Set([
  'Client', 'APIError', 'GraphQLError', 'Option', 'Execute', 'Params', 'Header',
]);

/** Go package name for a service. */
export function goPackageName(serviceName: string): string {
  const name = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return /^[a-z]/.test(name) ? name : `svc${name}`;
}

/** Go module path for the generated client. */
export function goModulePath(serviceName: string, override?: string): string {
  return override ?? `example.com/${toKebab(serviceName)}/client`;
}

function goTypeName(name: string): string {
  return goExported(name);
}

function isCollection(ref: TypeRef): boolean {
  return ref.k === 'list' || ref.k === 'map' || (ref.k === 'scalar' && (ref.name === 'any' || ref.name === 'bytes'));
}

/** Go type for a TypeRef (no optional pointer wrapping). */
export function goBaseType(ref: TypeRef, contract: ServiceContract): string {
  switch (ref.k) {
    case 'scalar':
      switch (ref.name) {
        case 'string':
        case 'datetime':
          return 'string';
        case 'int':
          return 'int32';
        case 'long':
          return 'int64';
        case 'float':
          return 'float64';
        case 'bool':
          return 'bool';
        case 'bytes':
          return '[]byte';
        default:
          return 'interface{}';
      }
    case 'ref':
      return goTypeName(ref.name);
    case 'list':
      return `[]${ref.itemNullable ? '*' : ''}${goBaseType(ref.of, contract)}`;
    case 'map':
      return `map[string]${goBaseType(ref.of, contract)}`;
  }
}

function goFieldType(ref: TypeRef, optional: boolean, contract: ServiceContract): string {
  const base = goBaseType(ref, contract);
  if (!optional) return base;
  if (isCollection(ref)) return base;
  if (ref.k === 'ref') {
    const m = findModel(contract, ref.name);
    if (m?.kind === 'union') return base;
  }
  return `*${base}`;
}

function emitModel(m: IRModel, contract: ServiceContract): string {
  const name = goTypeName(m.name);
  const doc = m.description ? `// ${name} ${safeDoc(m.description)}\n` : '';
  if (m.kind === 'enum') {
    const used = new Set<string>();
    const consts = m.values.map(v => {
      let id = `${name}${goExported(v.name)}`;
      let n = 2;
      while (used.has(id)) id = `${name}${goExported(v.name)}${n++}`;
      used.add(id);
      return `\t${id} ${name} = ${JSON.stringify(v.name)}`;
    });
    return `${doc}type ${name} string\n\nconst (\n${consts.join('\n')}\n)`;
  }
  if (m.kind === 'union') {
    return `${doc}// ${name} is one of: ${m.members.join(', ')}. Decode it with json.Unmarshal into the concrete member.\ntype ${name} = json.RawMessage`;
  }
  const used = new Set<string>();
  const fields = m.fields.map((f: IRField) => {
    let id = goExported(f.name);
    let n = 2;
    while (used.has(id)) id = `${goExported(f.name)}${n++}`;
    used.add(id);
    const optional = !f.required || Boolean(f.nullable);
    const type = goFieldType(f.type, optional, contract);
    const tag = `json:"${f.name}${optional ? ',omitempty' : ''}"`;
    const fdoc = f.description ? `\t// ${safeDoc(f.description)}\n` : '';
    return `${fdoc}\t${id} ${type} \`${tag}\``;
  });
  return `${doc}type ${name} struct {\n${fields.join('\n')}\n}`;
}

function emitModels(contract: ServiceContract): string {
  return contract.models.map(m => emitModel(m, contract)).join('\n\n');
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

function restMethod(op: IRRestOperation, contract: ServiceContract): { code: string; types: string } {
  const name = goExported(op.name);
  const pathParams = op.params.filter(p => p.in === 'path');
  const other = op.params.filter(p => p.in !== 'path');
  const args: string[] = ['ctx context.Context'];
  const used = new Set<string>(['ctx', 'body', 'params', 'c', 'query', 'header', 'pathParams', 'out', 'bodyArg']);
  const pathIds = pathParams.map(p => {
    let id = goIdent(toCamel(p.name) || 'p');
    while (used.has(id)) id += '_';
    used.add(id);
    return { id, p };
  });
  for (const { id, p } of pathIds) args.push(`${id} ${goBaseType(p.type, contract)}`);
  if (op.body) args.push(`body ${goFieldType(op.body.type, !op.body.required, contract)}`);

  const fused = new Set<string>();
  const bound = other.map(p => {
    let id = goExported(p.name);
    let n = 2;
    const base = id;
    while (fused.has(id)) id = `${base}${n++}`;
    fused.add(id);
    return { p, id };
  });
  let types = '';
  if (bound.length > 0) {
    const paramsName = `${name}Params`;
    const lines = bound.map(
      ({ p, id }) => `\t${id} ${goFieldType(p.type, !p.required, contract)} // ${p.in} parameter ${JSON.stringify(p.name)}`
    );
    types = `// ${paramsName} holds the query/header parameters of ${name}.\ntype ${paramsName} struct {\n${lines.join('\n')}\n}`;
    args.push(`params *${paramsName}`);
  }

  const body: string[] = [];
  if (pathIds.length) {
    body.push(`\tpathParams := map[string]string{${pathIds.map(({ id, p }) => `${JSON.stringify(p.name)}: fmt.Sprint(${id})`).join(', ')}}`);
  } else {
    body.push('\tvar pathParams map[string]string');
  }
  body.push('\tquery := url.Values{}');
  body.push('\theader := http.Header{}');
  const emitSet = (target: string, b: { p: IRRestOperation['params'][number]; id: string }): string => {
    const key = JSON.stringify(b.p.name);
    if (b.p.type.k === 'list') {
      return `\t\tfor _, v := range params.${b.id} {\n\t\t\t${target}.Add(${key}, fmt.Sprint(v))\n\t\t}`;
    }
    if (isCollection(b.p.type)) return `\t\t${target}.Set(${key}, fmt.Sprint(params.${b.id}))`;
    if (!b.p.required) {
      return `\t\tif params.${b.id} != nil {\n\t\t\t${target}.Set(${key}, fmt.Sprint(*params.${b.id}))\n\t\t}`;
    }
    return `\t\t${target}.Set(${key}, fmt.Sprint(params.${b.id}))`;
  };
  if (bound.length > 0) {
    body.push('\tif params != nil {');
    for (const b of bound.filter(x => x.p.in === 'query')) body.push(emitSet('query', b));
    for (const b of bound.filter(x => x.p.in === 'header')) body.push(emitSet('header', b));
    body.push('\t}');
  }
  let bodyArg = 'nil';
  if (op.body) {
    if (op.body.required) {
      bodyArg = 'body';
    } else {
      body.push('\tvar bodyArg interface{}');
      body.push('\tif body != nil {\n\t\tbodyArg = body\n\t}');
      bodyArg = 'bodyArg';
    }
  }
  const call = `c.do(ctx, ${JSON.stringify(op.method)}, ${JSON.stringify(op.path)}, pathParams, query, header, ${bodyArg}`;
  let ret = '';
  if (op.response) {
    const retBase = goBaseType(op.response.type, contract);
    const byValue =
      isCollection(op.response.type) ||
      (op.response.type.k === 'ref' && findModel(contract, op.response.type.name)?.kind === 'union');
    ret = byValue ? retBase : `*${retBase}`;
    body.push(`\tvar out ${retBase}`);
    body.push(`\tif err := ${call}, &out); err != nil {`);
    body.push(`\t\treturn ${byValue ? 'out' : 'nil'}, err`);
    body.push('\t}');
    body.push(`\treturn ${byValue ? 'out' : '&out'}, nil`);
  } else {
    body.push(`\treturn ${call}, nil)`);
  }
  const doc = `// ${name} ${safeDoc(op.summary ?? op.description ?? `${op.method} ${op.path}`)}`;
  const sig = `func (c *Client) ${name}(${args.join(', ')}) ${op.response ? `(${ret}, error)` : 'error'}`;
  return { code: `${doc}\n${sig} {\n${body.join('\n')}\n}`, types };
}

function restClient(contract: ServiceContract, opts: GenerateClientOptions): string {
  const pkg = goPackageName(opts.serviceName);
  const baseUrl = contract.baseUrl ?? 'http://localhost:8080';
  const ops = contract.operations.filter((o): o is IRRestOperation => o.protocol === 'rest');
  const methods = ops.map(o => restMethod(o, contract));
  return `${banner(contract, '//')}

// Package ${pkg} is a typed REST client for ${safeDoc(contract.title)}.
package ${pkg}

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var _ = json.RawMessage(nil)

${emitModels(contract)}

${methods.map(m => m.types).filter(Boolean).join('\n\n')}

// APIError is returned for every non-2xx response.
type APIError struct {
	Status int
	Body   []byte
}

func (e *APIError) Error() string {
	return fmt.Sprintf("HTTP %d: %s", e.Status, strings.TrimSpace(string(e.Body)))
}

// Client talks to the service over HTTP.
type Client struct {
	// BaseURL is the service root, e.g. ${baseUrl}.
	BaseURL string
	// HTTPClient is used for all requests (default: http.DefaultClient).
	HTTPClient *http.Client
	// Header is added to every request (e.g. Authorization, X-Correlation-Id).
	Header http.Header
}

// NewClient creates a client; an empty baseURL selects ${baseUrl}.
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = ${JSON.stringify(baseUrl)}
	}
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTPClient: http.DefaultClient, Header: http.Header{}}
}

func (c *Client) do(ctx context.Context, method, template string, pathParams map[string]string, query url.Values, header http.Header, body interface{}, out interface{}) error {
	target := template
	for key, value := range pathParams {
		target = strings.ReplaceAll(target, "{"+key+"}", url.PathEscape(value))
	}
	full := c.BaseURL + target
	if len(query) > 0 {
		full += "?" + query.Encode()
	}
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}
	req, err := http.NewRequestWithContext(ctx, method, full, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, vs := range c.Header {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	for k, vs := range header {
		for _, v := range vs {
			req.Header.Set(k, v)
		}
	}
	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return &APIError{Status: resp.StatusCode, Body: data}
	}
	if out == nil || len(bytes.TrimSpace(data)) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

${methods.map(m => m.code).join('\n\n')}
`;
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

function graphqlMethod(op: IRGraphqlOperation, contract: ServiceContract): { code: string; types: string } {
  const name = goExported(op.name);
  const doc = buildGraphqlDocument(contract, op);
  const argsName = `${name}Args`;
  let types = '';
  const used = new Set<string>();
  if (op.args.length) {
    const lines = op.args.map(a => {
      let id = goExported(a.name);
      let n = 2;
      while (used.has(id)) id = `${goExported(a.name)}${n++}`;
      used.add(id);
      const optional = !a.required;
      return `\t${id} ${goFieldType(a.type, optional, contract)} \`json:"${a.name}${optional ? ',omitempty' : ''}"\``;
    });
    types = `// ${argsName} are the variables of ${op.field}.\ntype ${argsName} struct {\n${lines.join('\n')}\n}`;
  }
  const retBase = goBaseType(op.returns, contract);
  const unionRet = op.returns.k === 'ref' && findModel(contract, op.returns.name)?.kind === 'union';
  const retType = isCollection(op.returns) || unionRet ? retBase : `*${retBase}`;
  const sig = `func (c *Client) ${name}(ctx context.Context${op.args.length ? `, args ${argsName}` : ''}) (${retType}, error)`;
  const wrapperField = `${goExported(op.field)} ${isCollection(op.returns) || unionRet ? retBase : `*${retBase}`} \`json:"${op.field}"\``;
  return {
    types,
    code: `// ${name} runs the ${op.operation} ${safeDoc(op.field)}.
${sig} {
	var out struct {
		${wrapperField}
	}
	if err := c.Execute(ctx, ${JSON.stringify(doc)}, ${op.args.length ? 'args' : 'nil'}, ${JSON.stringify(goExported(op.name))}, &out); err != nil {
		var zero ${retType}
		return zero, err
	}
	return out.${goExported(op.field)}, nil
}`,
  };
}

function graphqlClient(contract: ServiceContract, opts: GenerateClientOptions): string {
  const pkg = goPackageName(opts.serviceName);
  const ops = contract.operations.filter(
    (o): o is IRGraphqlOperation => o.protocol === 'graphql' && o.operation !== 'subscription'
  );
  const methods = ops.map(o => graphqlMethod(o, contract));
  return `${banner(contract, '//')}

// Package ${pkg} is a typed GraphQL client for ${safeDoc(contract.title)}.
package ${pkg}

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var _ = json.RawMessage(nil)

${emitModels(contract)}

${methods.map(m => m.types).filter(Boolean).join('\n\n')}

// GraphQLError is one entry of the "errors" array of a GraphQL response.
type GraphQLError struct {
	Message string        \`json:"message"\`
	Path    []interface{} \`json:"path,omitempty"\`
}

// Error implements error.
func (e *GraphQLError) Error() string { return e.Message }

// Client posts GraphQL documents to an HTTP endpoint.
type Client struct {
	// Endpoint is the GraphQL URL.
	Endpoint string
	// HTTPClient is used for all requests (default: http.DefaultClient).
	HTTPClient *http.Client
	// Header is added to every request.
	Header http.Header
}

// NewClient creates a client; an empty endpoint selects http://localhost:8080/graphql.
func NewClient(endpoint string) *Client {
	if endpoint == "" {
		endpoint = "http://localhost:8080/graphql"
	}
	return &Client{Endpoint: endpoint, HTTPClient: http.DefaultClient, Header: http.Header{}}
}

// Execute runs one document and decodes the "data" object into out.
func (c *Client) Execute(ctx context.Context, document string, variables interface{}, operationName string, out interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{"query": document, "variables": variables, "operationName": operationName})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	for k, vs := range c.Header {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	var envelope struct {
		Data   json.RawMessage \`json:"data"\`
		Errors []GraphQLError  \`json:"errors"\`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return fmt.Errorf("graphql: HTTP %d with non-JSON body: %w", resp.StatusCode, err)
	}
	if len(envelope.Errors) > 0 && (len(envelope.Data) == 0 || string(envelope.Data) == "null") {
		msgs := make([]string, 0, len(envelope.Errors))
		for i := range envelope.Errors {
			msgs = append(msgs, envelope.Errors[i].Message)
		}
		return &GraphQLError{Message: strings.Join(msgs, "; ")}
	}
	if out == nil || len(envelope.Data) == 0 {
		return nil
	}
	return json.Unmarshal(envelope.Data, out)
}

${methods.map(m => m.code).join('\n\n')}
`;
}

// ---------------------------------------------------------------------------
// gRPC
// ---------------------------------------------------------------------------

function grpcClient(contract: ServiceContract, opts: GenerateClientOptions, module: string): string {
  const pkg = goPackageName(opts.serviceName);
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
  const pbType = (ref: TypeRef): string => {
    if (ref.k !== 'ref') return 'interface{}';
    const m = findModel(contract, ref.name);
    const fqn = m && 'fqn' in m && m.fqn ? m.fqn : ref.name;
    const rel = contract.packageName && fqn.startsWith(`${contract.packageName}.`) ? fqn.slice(contract.packageName.length + 1) : fqn;
    return rel.split('.').join('_');
  };
  const classes = [...grouped.entries()].map(([fq, ops]) => {
    const simple = fq.split('.').pop()!;
    const cls = /Client$/.test(simple) ? simple : `${simple}Client`;
    const methods = ops.map(op => {
      if (op.serverStreaming) {
        return `// ${op.method} opens the server stream for ${fq}/${op.method}.
func (c *${cls}) ${op.method}(ctx context.Context, req *pb.${pbType(op.request)}, opts ...grpc.CallOption) (pb.${simple}_${op.method}Client, error) {
	return c.stub.${op.method}(c.withMetadata(ctx), req, opts...)
}`;
      }
      return `// ${op.method} calls ${fq}/${op.method}.
func (c *${cls}) ${op.method}(ctx context.Context, req *pb.${pbType(op.request)}, opts ...grpc.CallOption) (*pb.${pbType(op.response)}, error) {
	return c.stub.${op.method}(c.withMetadata(ctx), req, opts...)
}`;
    });
    return `// ${cls} is a typed gRPC client for ${fq}.
type ${cls} struct {
	conn     *grpc.ClientConn
	stub     pb.${simple}Client
	metadata metadata.MD
}

// New${cls} dials address (plaintext unless opts provide credentials).
func New${cls}(address string, opts ...grpc.DialOption) (*${cls}, error) {
	if len(opts) == 0 {
		opts = []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	}
	conn, err := grpc.NewClient(address, opts...)
	if err != nil {
		return nil, err
	}
	return &${cls}{conn: conn, stub: pb.New${simple}Client(conn), metadata: metadata.MD{}}, nil
}

// WithMetadata returns the client after adding metadata sent on every call (e.g. x-correlation-id).
func (c *${cls}) WithMetadata(pairs ...string) *${cls} {
	c.metadata = metadata.Join(c.metadata, metadata.Pairs(pairs...))
	return c
}

func (c *${cls}) withMetadata(ctx context.Context) context.Context {
	if len(c.metadata) == 0 {
		return ctx
	}
	return metadata.NewOutgoingContext(ctx, c.metadata)
}

// Close releases the underlying connection.
func (c *${cls}) Close() error { return c.conn.Close() }

${methods.join('\n\n')}`;
  });
  const skippedNote = skipped.length ? `// Client-streaming and bidirectional RPCs are not generated: ${skipped.join(', ')}\n` : '';
  return `${banner(contract, '//')}
${skippedNote}
// Package ${pkg} is a typed gRPC client for ${safeDoc(contract.title)}.
// The pb subpackage is generated by protoc (see generate-stubs.sh).
package ${pkg}

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	pb "${module}/pb"
)

${classes.join('\n\n')}
`;
}

// ---------------------------------------------------------------------------

/**
 * Generate the Go client module.
 *
 * For gRPC the models come from the protoc-generated `pb` package, so only the
 * wrapper and go.mod are emitted here.
 */
export function generateGoClient(
  rawContract: ServiceContract,
  opts: GenerateClientOptions
): ClientFile[] {
  const contract = avoidReserved(rawContract, RESERVED);
  const module = goModulePath(opts.serviceName, opts.goModule);
  const source =
    contract.protocol === 'rest'
      ? restClient(contract, opts)
      : contract.protocol === 'graphql'
        ? graphqlClient(contract, opts)
        : grpcClient(contract, opts, module);
  // gRPC modules are resolved by `go mod tidy` (run by generate-stubs.sh) so the
  // grpc/protobuf versions always match the protoc plugins that produced pb/.
  const goMod = `module ${module}\n\ngo 1.21\n`;
  return [
    { path: 'go/client.go', content: source, kind: 'go-client' },
    { path: 'go/go.mod', content: goMod, kind: 'manifest' },
  ];
}
