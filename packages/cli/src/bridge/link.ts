// `re-shell service link` / `unlink` / `validate`: record typed client links
// between workspace services in re-shell.workspaces.yaml and keep them honest.

import * as fs from 'fs';
import * as path from 'path';

import { diffContracts, type ContractChange } from './diff';
import { buildBridgeBundle, clientLanguageFor, parseLanguages, writeBundle, type BridgeBundle } from './generate';
import { compileGrpcStubs, type StubResult } from './stubs';
import { BRIDGE_MARKER, loadContract, resolveContract } from './spec/discover';
import { BridgeSpecError } from './spec/errors';
import type { BridgeProtocol } from './spec/ir';
import {
  BridgeWorkspaceError,
  WorkspaceEditor,
  dependenciesOf,
  dependencyGraph,
  findCycles,
  linksOf,
  loadWorkspace,
  relFromRoot,
  schemaErrors,
  serviceDir,
  wouldCreateCycle,
  type LoadedWorkspace,
  type ServiceLink,
} from './workspace';
import type { ClientLanguage } from './codegen/common';

/** Options for {@link linkServices}. */
export interface LinkOptions {
  consumer: string;
  provider: string;
  cwd?: string;
  configPath?: string;
  /** Explicit provider spec (overrides discovery in the provider's directory). */
  spec?: string;
  protocol?: BridgeProtocol;
  /** Client languages (default: the consumer's own language). */
  lang?: string;
  /** Output directory (default: `<consumer dir>/clients/<provider>-<protocol>`). */
  out?: string;
  dryRun?: boolean;
  goModule?: string;
  /** gRPC: compile protobuf stubs when a protoc is available (default true). */
  compileStubs?: boolean;
}

/** Result of {@link linkServices}. */
export interface LinkResult {
  consumer: string;
  provider: string;
  protocol: BridgeProtocol;
  languages: ClientLanguage[];
  /** Provider spec (workspace-relative). */
  spec: string;
  /** Generated client directory (workspace-relative). */
  client: string;
  contractSha256: string;
  operations: number;
  files: string[];
  written: boolean;
  /** Workspace config path that was (or would be) updated. */
  config: string;
  dependsOnAdded: boolean;
  stubs: StubResult[];
  warnings: string[];
}

function assertService(ws: LoadedWorkspace, name: string, role: string): void {
  if (!ws.config.services?.[name]) {
    throw new BridgeWorkspaceError(
      `${role} service "${name}" not found in ${path.basename(ws.configPath)} (available: ${Object.keys(ws.config.services ?? {}).join(', ') || 'none'})`
    );
  }
}

/**
 * Link `consumer` to `provider`: derive the provider's contract from its own
 * spec, generate a typed client inside the consumer, and record the dependency
 * (`dependsOn` + a `links` entry) in the workspace config.
 *
 * Nothing is written unless every step succeeded in memory first; dry-run
 * writes nothing at all.
 *
 * @throws BridgeWorkspaceError | BridgeSpecError for unknown services, a missing
 *   or ambiguous spec, an unsupported consumer language, or a dependency cycle.
 */
export function linkServices(options: LinkOptions): LinkResult {
  const cwd = options.cwd ?? process.cwd();
  const ws = loadWorkspace(cwd, options.configPath);
  assertService(ws, options.consumer, 'consumer');
  assertService(ws, options.provider, 'provider');
  if (options.consumer === options.provider) {
    throw new BridgeWorkspaceError(`a service cannot link to itself ("${options.consumer}")`);
  }
  const cycle = wouldCreateCycle(ws.config, options.consumer, options.provider);
  if (cycle) {
    throw new BridgeWorkspaceError(`linking ${options.consumer} -> ${options.provider} would create a dependency cycle: ${cycle.join(' -> ')}`);
  }

  const providerDir = serviceDir(ws, options.provider);
  const contract = resolveContract({
    specPath: options.spec ? path.resolve(cwd, options.spec) : undefined,
    serviceDir: providerDir,
    protocol: options.protocol,
  });

  const consumerCfg = ws.config.services[options.consumer];
  let languages: ClientLanguage[];
  if (options.lang) {
    languages = parseLanguages(options.lang);
  } else {
    const inferred = clientLanguageFor(consumerCfg.language);
    if (!inferred) {
      throw new BridgeWorkspaceError(
        `consumer "${options.consumer}" is ${consumerCfg.language}; no client generator for that language (supported: typescript/javascript, python, go). Pass --lang ts,python,go.`
      );
    }
    languages = [inferred];
  }

  const outDir = options.out
    ? path.resolve(cwd, options.out)
    : path.join(serviceDir(ws, options.consumer), 'clients', `${options.provider}-${contract.protocol}`);

  const bundle: BridgeBundle = buildBridgeBundle({
    serviceName: options.provider,
    contract,
    languages,
    goModule: options.goModule,
  });

  const link: ServiceLink = {
    service: options.provider,
    protocol: contract.protocol,
    spec: relFromRoot(ws, contract.source.path),
    client: relFromRoot(ws, outDir),
    languages,
    contractSha256: contract.source.sha256,
  };

  // Edit + validate the YAML before touching the filesystem.
  const editor = new WorkspaceEditor(ws.configPath);
  const alreadyDepended = (consumerCfg.dependsOn ?? []).includes(options.provider);
  editor.addLink(options.consumer, link);
  const errors = schemaErrors(editor.toObject());
  if (errors.length > 0) {
    throw new BridgeWorkspaceError(`recording the link would make the workspace config invalid: ${errors.join('; ')}`);
  }

  const warnings = [...bundle.warnings];
  let stubs: StubResult[] = [];
  let written = false;
  const files = bundle.files.map(f => path.join(outDir, f.path));
  if (!options.dryRun) {
    writeBundle(bundle.files, outDir);
    if (bundle.grpc && options.compileStubs !== false) {
      stubs = compileGrpcStubs(outDir, bundle.grpc, languages);
      for (const s of stubs) if (s.status !== 'generated') warnings.push(`${s.language} gRPC stubs ${s.status}: ${s.detail}`);
    }
    editor.save();
    written = true;
  }

  return {
    consumer: options.consumer,
    provider: options.provider,
    protocol: contract.protocol,
    languages,
    spec: link.spec,
    client: link.client,
    contractSha256: link.contractSha256,
    operations: contract.operations.length,
    files: files.map(f => relFromRoot(ws, f)),
    written,
    config: path.basename(ws.configPath),
    dependsOnAdded: !alreadyDepended,
    stubs,
    warnings,
  };
}

/** Result of {@link unlinkServices}. */
export interface UnlinkResult {
  consumer: string;
  provider: string;
  removed: ServiceLink[];
  clientRemoved: string[];
  config: string;
}

/**
 * Remove the link(s) from `consumer` to `provider` (and the `dependsOn` edge
 * unless `keepDependency`). With `removeClient`, the generated client directory
 * is deleted too, but only when it carries the bridge marker.
 */
export function unlinkServices(options: {
  consumer: string;
  provider: string;
  cwd?: string;
  configPath?: string;
  protocol?: BridgeProtocol;
  keepDependency?: boolean;
  removeClient?: boolean;
}): UnlinkResult {
  const cwd = options.cwd ?? process.cwd();
  const ws = loadWorkspace(cwd, options.configPath);
  assertService(ws, options.consumer, 'consumer');
  const editor = new WorkspaceEditor(ws.configPath);
  const removed = editor.removeLink(options.consumer, options.provider, {
    keepDependency: options.keepDependency,
    protocol: options.protocol,
  });
  const dependsOn = ws.config.services[options.consumer].dependsOn ?? [];
  if (removed.length === 0 && !dependsOn.includes(options.provider)) {
    throw new BridgeWorkspaceError(`"${options.consumer}" has no link or dependency on "${options.provider}"`);
  }
  const errors = schemaErrors(editor.toObject());
  if (errors.length > 0) throw new BridgeWorkspaceError(`unlink would make the workspace config invalid: ${errors.join('; ')}`);

  const clientRemoved: string[] = [];
  if (options.removeClient) {
    for (const l of removed) {
      const dir = path.resolve(ws.root, l.client);
      if (!dir.startsWith(ws.root + path.sep)) continue;
      if (fs.existsSync(path.join(dir, BRIDGE_MARKER))) {
        fs.rmSync(dir, { recursive: true, force: true });
        clientRemoved.push(l.client);
      }
    }
  }
  editor.save();
  return { consumer: options.consumer, provider: options.provider, removed, clientRemoved, config: path.basename(ws.configPath) };
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

/** One finding of `service validate`. */
export interface ValidateIssue {
  severity: 'error' | 'warning';
  code:
    | 'WORKSPACE_RULE'
    | 'UNKNOWN_SERVICE'
    | 'SELF_LINK'
    | 'DEPENDS_ON_UNKNOWN'
    | 'LINK_NOT_IN_DEPENDS_ON'
    | 'SPEC_MISSING'
    | 'SPEC_INVALID'
    | 'CLIENT_MISSING'
    | 'CLIENT_CONTRACT_MISSING'
    | 'CONTRACT_BREAKING'
    | 'CONTRACT_DRIFT'
    | 'CYCLE';
  message: string;
  consumer?: string;
  provider?: string;
}

/** Status of one link. */
export interface LinkCheck {
  consumer: string;
  provider: string;
  protocol: BridgeProtocol;
  spec: string;
  client: string;
  status: 'ok' | 'stale' | 'broken';
  /** Classified contract changes between the linked snapshot and the provider's current spec. */
  changes: ContractChange[];
}

/** Result of {@link validateWorkspace}. */
export interface ValidateResult {
  valid: boolean;
  config: string;
  services: number;
  links: LinkCheck[];
  cycles: string[][];
  issues: ValidateIssue[];
}

/**
 * Validate every link in the workspace: services and specs resolve, the client
 * snapshot is still compatible with the provider's current contract, and the
 * dependency graph (dependsOn + links) has no cycles.
 */
export function validateWorkspace(options: { cwd?: string; configPath?: string } = {}): ValidateResult {
  const cwd = options.cwd ?? process.cwd();
  const ws = loadWorkspace(cwd, options.configPath);
  const issues: ValidateIssue[] = [];
  const checks: LinkCheck[] = [];
  const services = ws.config.services ?? {};

  for (const rule of ws.ruleErrors) {
    issues.push({ severity: 'error', code: 'WORKSPACE_RULE', message: `${rule.path}: ${rule.message}` });
  }

  for (const [name, svc] of Object.entries(services)) {
    for (const dep of svc.dependsOn ?? []) {
      if (!services[dep]) {
        issues.push({ severity: 'error', code: 'DEPENDS_ON_UNKNOWN', message: `${name} dependsOn "${dep}", which is not a service in this workspace`, consumer: name, provider: dep });
      }
    }
    for (const link of linksOf(svc)) {
      const check: LinkCheck = {
        consumer: name,
        provider: link.service,
        protocol: link.protocol,
        spec: link.spec,
        client: link.client,
        status: 'ok',
        changes: [],
      };
      checks.push(check);
      const fail = (issue: Omit<ValidateIssue, 'consumer' | 'provider'>): void => {
        issues.push({ ...issue, consumer: name, provider: link.service });
        if (issue.severity === 'error') check.status = 'broken';
        else if (check.status === 'ok') check.status = 'stale';
      };

      if (link.service === name) {
        fail({ severity: 'error', code: 'SELF_LINK', message: `${name} links to itself` });
        continue;
      }
      if (!services[link.service]) {
        fail({ severity: 'error', code: 'UNKNOWN_SERVICE', message: `${name} links to "${link.service}", which is not a service in this workspace` });
        continue;
      }
      if (!(svc.dependsOn ?? []).includes(link.service)) {
        fail({ severity: 'warning', code: 'LINK_NOT_IN_DEPENDS_ON', message: `${name} links to ${link.service} but does not list it in dependsOn` });
      }

      // Provider's current spec.
      const specAbs = path.resolve(ws.root, link.spec);
      let current;
      if (!fs.existsSync(specAbs)) {
        fail({ severity: 'error', code: 'SPEC_MISSING', message: `provider spec ${link.spec} does not exist` });
        continue;
      }
      try {
        current = loadContract(specAbs);
      } catch (error: unknown) {
        fail({ severity: 'error', code: 'SPEC_INVALID', message: `provider spec ${link.spec} cannot be parsed: ${error instanceof Error ? error.message : String(error)}` });
        continue;
      }

      // Generated client + the contract snapshot it was generated from.
      const clientAbs = path.resolve(ws.root, link.client);
      const markerPath = path.join(clientAbs, BRIDGE_MARKER);
      if (!fs.existsSync(markerPath)) {
        fail({ severity: 'error', code: 'CLIENT_MISSING', message: `generated client ${link.client} is missing (re-run: re-shell service link ${name} ${link.service})` });
        continue;
      }
      let snapshotPath: string | undefined;
      try {
        const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as { contract?: string };
        if (marker.contract) snapshotPath = path.join(clientAbs, marker.contract);
      } catch {
        /* handled below */
      }
      if (!snapshotPath || !fs.existsSync(snapshotPath)) {
        fail({ severity: 'error', code: 'CLIENT_CONTRACT_MISSING', message: `generated client ${link.client} has no contract snapshot` });
        continue;
      }

      let snapshot;
      try {
        snapshot = loadContract(snapshotPath);
      } catch (error: unknown) {
        fail({ severity: 'error', code: 'CLIENT_CONTRACT_MISSING', message: `contract snapshot in ${link.client} is unreadable: ${error instanceof Error ? error.message : String(error)}` });
        continue;
      }

      if (snapshot.source.sha256 !== current.source.sha256) {
        const diff = diffContracts(snapshot, current);
        check.changes = diff.changes;
        if (diff.summary.breaking > 0) {
          const first = diff.changes.filter(c => c.severity === 'breaking').slice(0, 3).map(c => c.message).join('; ');
          fail({
            severity: 'error',
            code: 'CONTRACT_BREAKING',
            message: `${link.service}'s contract has ${diff.summary.breaking} breaking change(s) since ${name}'s client was generated (${first}); regenerate with: re-shell service link ${name} ${link.service}`,
          });
        } else {
          fail({
            severity: 'warning',
            code: 'CONTRACT_DRIFT',
            message: `${link.service}'s contract changed (${diff.summary.nonBreaking} non-breaking, ${diff.summary.dangerous} dangerous) since ${name}'s client was generated; regenerate to pick it up`,
          });
        }
      }
    }
  }

  const cycles = findCycles(dependencyGraph(ws.config));
  for (const cycle of cycles) {
    issues.push({ severity: 'error', code: 'CYCLE', message: `dependency cycle: ${cycle.join(' -> ')}` });
  }

  return {
    valid: !issues.some(i => i.severity === 'error'),
    config: path.basename(ws.configPath),
    services: Object.keys(services).length,
    links: checks,
    cycles,
    issues,
  };
}

export { BridgeSpecError, BridgeWorkspaceError, dependenciesOf };
