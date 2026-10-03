// `service bridge generate` in spec-driven mode: the contract is derived from
// the provider's own OpenAPI / .proto / GraphQL SDL instead of the fixed
// health/echo/config contract.

import * as path from 'path';

import type { ClientLanguage } from './codegen/common';
import { buildBridgeBundle, parseLanguages, writeBundle, type BridgeBundle } from './generate';
import { compileGrpcStubs, type StubResult } from './stubs';
import { discoverSpecs, loadContract, selectSpec } from './spec/discover';
import type { BridgeProtocol, ServiceContract } from './spec/ir';
import { verifyBundleDir, verifyBundleFiles, type VerifyResult } from './verify';
import { BridgeWorkspaceError, loadWorkspace, serviceDir, type LoadedWorkspace } from './workspace';

/** Inputs of spec-driven generation. */
export interface SpecGenerateOptions {
  service?: string;
  protocol?: BridgeProtocol;
  /** Explicit spec file (overrides discovery). */
  spec?: string;
  /** Comma-separated client languages (default: ts,python,go). */
  lang?: string;
  out?: string;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  /** Run tsc / py_compile / mypy / go build over the generated clients. */
  verify?: boolean;
  /** gRPC: compile protobuf stubs when a protoc is available (default true). */
  compileStubs?: boolean;
  goModule?: string;
}

/** What spec-driven generation produced. */
export interface SpecGenerateResult {
  protocol: BridgeProtocol;
  service: string;
  contractSource: 'spec';
  spec: { path: string; sha256: string; title: string; version?: string; operations: number; models: number };
  languages: ClientLanguage[];
  artifacts: { path: string; content: string; kind: string }[];
  written: string[];
  /** TypeScript client check (always run when a TS client was generated). */
  tsCheck: { ran: boolean; ok?: boolean; detail?: string };
  /** Per-language toolchain verification (only with `verify`). */
  verification?: VerifyResult[];
  stubs: StubResult[];
  warnings: string[];
}

function tryWorkspace(cwd: string, configPath?: string): LoadedWorkspace | undefined {
  try {
    return loadWorkspace(cwd, configPath);
  } catch {
    return undefined;
  }
}

/**
 * Decide whether generation should use the provider's own spec, and load it.
 *
 * Returns `undefined` when no spec was given and none is discoverable (the
 * caller then falls back to the default contract). Throws for an explicit but
 * unreadable `--spec`, or when discovery is ambiguous.
 */
export function resolveSpecForGenerate(
  options: SpecGenerateOptions
): { contract: ServiceContract; service: string } | undefined {
  const cwd = options.cwd ?? process.cwd();
  const ws = tryWorkspace(cwd, options.configPath);

  if (options.spec) {
    const contract = loadContract(path.resolve(cwd, options.spec));
    if (options.protocol && contract.protocol !== options.protocol) {
      throw new BridgeWorkspaceError(`${options.spec} is a ${contract.protocol} spec but --${options.protocol} was requested`);
    }
    let service = options.service;
    if (!service && ws) {
      service = Object.keys(ws.config.services ?? {}).find(name => {
        const dir = serviceDir(ws, name);
        return contract.source.path.startsWith(dir + path.sep);
      });
      service = service ?? Object.keys(ws.config.services ?? {})[0];
    }
    service = service ?? path.basename(path.dirname(contract.source.path));
    return { contract, service };
  }

  if (!options.protocol || !ws) return undefined;
  const services = Object.keys(ws.config.services ?? {});
  const service = options.service ?? services[0];
  if (!service || !ws.config.services[service]) return undefined; // legacy path reports the error
  const found = discoverSpecs(serviceDir(ws, service)).filter(c => c.protocol === options.protocol);
  if (found.length === 0) return undefined;
  const chosen = selectSpec(found, options.protocol, serviceDir(ws, service));
  return { contract: loadContract(chosen.path), service };
}

/** Generate (and optionally write + verify) the spec-driven bridge. */
export function generateFromSpec(
  options: SpecGenerateOptions,
  resolved: { contract: ServiceContract; service: string }
): SpecGenerateResult {
  const languages = parseLanguages(options.lang);
  const bundle: BridgeBundle = buildBridgeBundle({
    serviceName: resolved.service,
    contract: resolved.contract,
    languages,
    goModule: options.goModule,
  });
  const warnings = [...bundle.warnings];

  const written: string[] = [];
  let stubs: StubResult[] = [];
  let root: string | undefined;
  if (options.out && !options.dryRun) {
    root = path.join(path.resolve(options.cwd ?? process.cwd(), options.out), `${resolved.service}-${resolved.contract.protocol}`);
    written.push(...writeBundle(bundle.files, root));
    if (bundle.grpc && options.compileStubs !== false) {
      stubs = compileGrpcStubs(root, bundle.grpc, languages);
      for (const s of stubs) if (s.status !== 'generated') warnings.push(`${s.language} gRPC stubs ${s.status}: ${s.detail}`);
    }
  }

  // TypeScript is always checked (cheap, in-process); the heavier toolchains only with --verify.
  let tsCheck: SpecGenerateResult['tsCheck'] = { ran: false, detail: 'no TypeScript client requested' };
  let verification: VerifyResult[] | undefined;
  if (options.verify) {
    verification = root ? verifyBundleDir(root, languages) : verifyBundleFiles(bundle.files, languages);
    const ts = verification.find(v => v.language === 'ts');
    if (ts) tsCheck = { ran: ts.status !== 'skipped', ok: ts.status === 'passed' ? true : ts.status === 'failed' ? false : undefined, detail: ts.detail };
  } else if (languages.includes('ts')) {
    const ts = verifyBundleFiles(
      bundle.files.filter(f => f.path.startsWith('ts/') || f.path === '.re-shell-bridge.json'),
      ['ts']
    )[0];
    tsCheck = { ran: ts.status !== 'skipped', ok: ts.status === 'passed' ? true : ts.status === 'failed' ? false : undefined, detail: ts.detail };
  }
  if (tsCheck.ran && tsCheck.ok === false) warnings.push(`tsc reported issues: ${tsCheck.detail ?? ''}`.trim());
  for (const v of verification ?? []) {
    if (v.status === 'failed') warnings.push(`${v.language} verification failed (${v.tool}): ${v.detail ?? ''}`.trim());
    if (v.status === 'skipped') warnings.push(`${v.language} verification skipped (${v.tool}): ${v.detail ?? ''}`.trim());
  }

  const c = resolved.contract;
  return {
    protocol: c.protocol,
    service: resolved.service,
    contractSource: 'spec',
    spec: {
      path: c.source.path,
      sha256: c.source.sha256,
      title: c.title,
      version: c.version,
      operations: c.operations.length,
      models: c.models.length,
    },
    languages,
    artifacts: bundle.files.map(f => ({ path: f.path, content: f.content, kind: f.kind })),
    written,
    tsCheck,
    verification,
    stubs,
    warnings,
  };
}
