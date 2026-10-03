import * as fs from 'fs-extra';
import * as path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import * as yaml from 'js-yaml';
import type { CreateDryRunResponse, CreateMode, CreateResponse } from '@re-shell/contracts';
import { getFrameworkChoices, getFrameworkConfig, validateFramework, type FrameworkConfig } from '../utils/framework';
import { findMonorepoRoot, WORKSPACE_GLOBS } from '../utils/monorepo';
import { REPO_URL, DOCS_URL } from '../constants/brand';
import { preserveSchemaModeline } from '../utils/workspace-yaml';
import { getBackendTemplate, listBackendTemplates, type BackendTemplate } from '../templates/backend/index';
import {
  getDatabaseChoices,
  getBackendLanguageChoices,
  getFrameworkChoicesForLanguage,
  getPopularBackendFrameworks,
  validateFrameworkCompatibility,
  getCompatibilitySummary,
  checkDependencyConflicts,
  formatDependencyReport,
  getBestPracticesForLanguage,
  applyBestPractices,
  validateProjectConfig,
  formatValidationResult,
  performProjectHealthCheck,
  formatHealthCheckReport,
  type DatabaseType,
  type ProjectConfig
} from '../utils/database';
import {
  getArchitectureTemplate,
  getAllArchitectureTemplates,
  getPopularArchitectureTemplates,
} from '../templates/architecture/index';
import { ReactModuleFederationTemplate } from '../templates/frontend/react-module-federation';
import { VueModuleFederationTemplate } from '../templates/frontend/vue-module-federation';
import { AngularModuleFederationTemplate } from '../templates/frontend/angular-module-federation';
import { SvelteModuleFederationTemplate } from '../templates/frontend/svelte-module-federation';
import { createFrontendTemplate, hasFrontendTemplate } from '../templates/frontend/registry';
import { BaseTemplate, TemplateContext } from '../templates/index';
import { ProgressSpinner, flushOutput } from '../utils/spinner';
import {
  CreateError,
  assertBackend,
  assertFrontend,
  backendIds,
  isNonInteractive,
  parseNameFrameworkList,
  resolveCreateRequest,
  templateNotFound,
  DEFAULT_BACKEND,
  type ResolvedCreateRequest,
} from '../utils/create-request';
import {
  createBackendTemplate,
  type BackendTemplateContext,
} from '../utils/backend-scaffold';
import {
  compareScaffoldToDisk,
  readTree,
  toPosix,
  touchedFiles,
  withScratchDir,
} from '../utils/scaffold-compare';

export { CreateError } from '../utils/create-request';

/**
 * Options accepted by the `createProject` command, covering team/org metadata,
 * framework selections, workspace type, and operational flags like `dryRun`.
 */
export interface CreateProjectOptions {
  team?: string;
  org?: string;
  description?: string;
  /** Backend template id, frontend framework id, architecture template id, or `blank`. */
  template?: string;
  framework?: string;      // Frontend framework
  backend?: string;         // Backend framework
  frontend?: string;        // Frontend framework (alias for framework)
  db?: string;              // Database type
  fullstack?: boolean;      // Create full-stack project
  polyglot?: boolean;       // Create polyglot microservices
  microfrontend?: boolean;  // Create microfrontend with module federation
  /** Polyglot API gateway (express|fastify|nestjs|traefik|kong). */
  gateway?: string;
  /** Polyglot services as `name:framework,name:framework`. */
  services?: string;
  /** Microfrontend remotes as `name[:framework],...`. */
  remotes?: string;
  packageManager?: string;
  type?: 'app' | 'package' | 'lib' | 'tool';
  port?: string;
  route?: string;
  isProject?: boolean;
  dryRun?: boolean;
  /** Skip prompts and use defaults (non-interactive; auto-enabled without a TTY). */
  yes?: boolean;
  /** Overwrite files in an existing target and continue past compatibility warnings. */
  force?: boolean;
  spinner?: ProgressSpinner;
  verbose?: boolean;
}

/**
 * Microfrontend remote configuration
 */
interface MicrofrontendRemote {
  name: string;
  framework: string;
  port: string;
  route: string;
  path: string;
  exposes: Record<string, string>;
}

/**
 * Microfrontend project configuration
 */
interface MicrofrontendConfig {
  name: string;
  normalizedName: string;
  shellFramework: string;
  remotes: MicrofrontendRemote[];
  org: string;
  team?: string;
  description?: string;
  packageManager: string;
  sharedDeps: string[];
}

/**
 * Polyglot service configuration
 */
interface PolyglotService {
  name: string;
  framework: string;
  port: string;
  language: string;
  path: string;
}

/**
 * Polyglot project configuration
 */
interface PolyglotConfig {
  name: string;
  normalizedName: string;
  services: PolyglotService[];
  gatewayFramework: string;
  frontendFramework?: string;
  database: DatabaseType;
  org: string;
  team?: string;
  description?: string;
  packageManager: string;
}

/**
 * What a finished `create` run returns to the CLI layer: the wire payload for
 * `--json`, or `cancelled` when an interactive prompt was declined.
 */
export type CreateResult =
  | { status: 'created'; response: CreateResponse }
  | { status: 'dry-run'; response: CreateDryRunResponse }
  | { status: 'cancelled' };

/**
 * A fully-resolved scaffold: everything `create` is about to do, with no
 * prompts left. The same plan drives the real write and the dry-run preview
 * (rendered into a throwaway directory), so the preview is exact by
 * construction.
 */
interface ScaffoldPlan {
  mode: CreateMode;
  /** The name as the user typed it. */
  name: string;
  /** Absolute directory every relative output path is anchored at. */
  root: string;
  /** Absolute directories the scaffold creates; used for exists-checks and rollback. */
  targetDirs: string[];
  /** Absolute project (or primary workspace) directory, reported to the caller. */
  projectPath: string;
  frontend?: string;
  backend?: string;
  /** Lines printed under the dry-run header (e.g. `Frontend: react-ts`). */
  summary: string[];
  /** True when the scaffold has no app yet (nothing runnable). */
  skeleton: boolean;
  /** Defaults that were applied or flags that were ignored. */
  notes: string[];
  /** Root files the scaffold edits in place; copied into the dry-run scratch dir first. */
  seedFiles: string[];
  /** Shown as `Next steps` after a real run. */
  nextSteps: string[];
  /** Writes the scaffold under `outRoot` (no prompts, no output); returns files written, relative to it. */
  write(outRoot: string): Promise<string[]>;
  /** Runs after a successful real write (health check, extra output). */
  afterWrite?(files: string[]): Promise<void>;
  /**
   * Interactive only: asked when a target directory already exists and `--force`
   * was not given. Returns `overwrite` to replace the directory or `cancel`.
   */
  confirmOverwrite?(existing: string[]): Promise<'overwrite' | 'cancel'>;
}

/** Synchronous file sink anchored at an output root; records every path it writes. */
class ScaffoldSink {
  readonly written: string[] = [];

  constructor(private readonly outRoot: string) {}

  mkdir(rel: string): void {
    fs.mkdirSync(path.join(this.outRoot, rel), { recursive: true });
  }

  write(rel: string, content: string, executable = false): void {
    const abs = path.join(this.outRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    if (executable) fs.chmodSync(abs, 0o755);
    this.written.push(toPosix(rel));
  }
}

/** Join path segments with forward slashes (used for payload paths). */
function posixJoin(...segments: string[]): string {
  return toPosix(path.join(...segments));
}

/**
 * Wrap `prompts` so an aborted prompt (Ctrl-C / Esc / closed stdin) is an
 * explicit failure instead of silently continuing with `undefined` answers.
 */
async function ask<T extends string = string>(
  questions: prompts.PromptObject<T> | prompts.PromptObject<T>[]
): Promise<prompts.Answers<T>> {
  return prompts(questions, {
    onCancel: () => {
      throw new CreateError('CREATE_ERROR', 'Cancelled: a prompt was aborted before it was answered.');
    },
  });
}

/**
 * Creates a new Re-Shell project or workspace.
 *
 * Every prompt has a documented default that is used under `--yes`, with
 * `--dry-run`, with `--json`, or whenever stdin is not a TTY; a value with no
 * sensible default fails with a coded {@link CreateError} instead of waiting on
 * input that will never arrive.
 *
 * @param name - Name of the project/workspace
 * @param options - Additional options for project creation
 * @returns The created/dry-run payload, or `cancelled` when a prompt was declined.
 * @version 0.2.5
 */
export async function createProject(
  name: string,
  options: CreateProjectOptions
): Promise<CreateResult> {
  // Reject path traversal — a project name must not contain path separators or ..
  if (/[\/\\]|\.\./.test(name)) {
    throw new CreateError(
      'CREATE_INVALID_OPTIONS',
      `Invalid project name "${name}": must not contain path separators (/, \\) or ..`,
      { name }
    );
  }

  if (options.packageManager !== undefined && !PACKAGE_MANAGERS.includes(options.packageManager)) {
    throw new CreateError(
      'CREATE_INVALID_OPTIONS',
      `Invalid --package-manager "${options.packageManager}": expected one of ${PACKAGE_MANAGERS.join(', ')}.`,
      { packageManager: options.packageManager }
    );
  }

  // Check if we're in a monorepo
  const monorepoRoot = await findMonorepoRoot();

  // A dry run never prompts: it previews what the documented defaults would do.
  const dryRun = options.dryRun === true;
  const interactive = !dryRun && !isNonInteractive(options);

  const request = resolveCreateRequest(options, { fillDefaults: !interactive });

  let plan: ScaffoldPlan | null;
  switch (request.mode) {
    case 'polyglot':
      plan = await buildPolyglotPlan(name, options, monorepoRoot, request, interactive);
      break;
    case 'microfrontend':
      plan = await buildMicrofrontendPlan(name, options, monorepoRoot, request, interactive);
      break;
    default:
      // Determine if this is a monorepo project creation or workspace creation
      plan =
        monorepoRoot || options.type
          ? await buildWorkspacePlan(name, options, monorepoRoot, request, interactive, dryRun)
          : await buildMonorepoPlan(name, options, request, interactive);
  }

  if (!plan) return { status: 'cancelled' };

  if (dryRun) {
    const report = await computeDryRun(plan);
    printDryRun(report, plan, options);
    return { status: 'dry-run', response: report };
  }

  return executePlan(plan, options);
}

/** Package managers `create` can generate workspace configuration for. */
const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm', 'bun'];

/**
 * Render the plan into a throwaway directory, then classify every file it would
 * write against the real target (added / modified / unchanged, with a unified
 * diff for modified files). Nothing is written to the user's project.
 */
async function computeDryRun(plan: ScaffoldPlan): Promise<CreateDryRunResponse> {
  const comparison = await withScratchDir('re-shell-create-dryrun-', async (scratch) => {
    // Seed the small root files the scaffold edits in place (e.g. the workspace
    // registry) so an in-place edit shows up as `modified` instead of `added`.
    for (const rel of plan.seedFiles) {
      const source = path.join(plan.root, rel);
      if (fs.existsSync(source)) {
        fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
        fs.copyFileSync(source, path.join(scratch, rel));
      }
    }
    const before = readTree(scratch);
    await plan.write(scratch);
    const touched = touchedFiles(before, readTree(scratch));
    return compareScaffoldToDisk(touched, plan.root);
  });

  const targetExists = plan.targetDirs.some((dir) => fs.existsSync(dir));
  const notes = [...plan.notes];
  if (targetExists) {
    notes.push(
      `Target already exists (${plan.targetDirs.filter((d) => fs.existsSync(d)).join(', ')}); ` +
        'a real run needs --force and then overwrites files in place.'
    );
  }

  return {
    project: plan.name,
    mode: plan.mode,
    templateId: plan.backend ?? plan.frontend,
    frontend: plan.frontend,
    backend: plan.backend,
    dryRun: true,
    root: plan.root,
    targetExists,
    files: comparison.files,
    totalBytes: comparison.totalBytes,
    previews: comparison.previews,
    summary: comparison.summary,
    notes,
  };
}

/** Print the human-readable dry-run preview. */
function printDryRun(
  report: CreateDryRunResponse,
  plan: ScaffoldPlan,
  options: CreateProjectOptions
): void {
  console.log(chalk.cyan('\n🔎 Dry Run Preview\n'));
  console.log(chalk.gray('No files will be created.\n'));
  console.log(`Mode: ${plan.mode}`);
  for (const line of plan.summary) console.log(line);
  console.log(`Root: ${plan.root}`);

  console.log('\nTargets:');
  for (const dir of plan.targetDirs) {
    console.log(`  • ${dir}`);
  }

  const { added, modified, unchanged } = report.summary;
  console.log(
    chalk.gray(
      `\n${report.files.length} files (${report.totalBytes} bytes): ` +
        `${added} added, ${modified} modified, ${unchanged} unchanged. Nothing written.`
    )
  );
  for (const note of report.notes) {
    console.log(chalk.yellow(`  ! ${note}`));
  }

  const limit = options.verbose ? report.files.length : 30;
  console.log('\nPreview files:');
  for (const file of report.files.slice(0, limit)) {
    const mark =
      file.status === 'added'
        ? chalk.green('+')
        : file.status === 'modified'
          ? chalk.yellow('~')
          : chalk.gray('=');
    console.log(`  ${mark} ${file.path} ${chalk.gray(`(${file.bytes}b, ${file.status})`)}`);
  }
  if (report.files.length > limit) {
    console.log(chalk.gray(`  … and ${report.files.length - limit} more (use --verbose to list all)`));
  }

  const modifiedFiles = report.files.filter((f) => f.status === 'modified' && f.diff);
  if (modifiedFiles.length > 0) {
    console.log('\nChanges to existing files:');
    for (const file of modifiedFiles) {
      console.log((file.diff as string).trimEnd());
    }
  }
  console.log();
}

/**
 * Write the plan for real: refuse an existing target (unless `--force`), write,
 * roll back directories this run created if the write fails, then print the
 * honest next steps.
 */
async function executePlan(plan: ScaffoldPlan, options: CreateProjectOptions): Promise<CreateResult> {
  const { spinner } = options;
  let preexisting = plan.targetDirs.filter((dir) => fs.existsSync(dir));

  if (preexisting.length > 0 && !options.force) {
    if (!plan.confirmOverwrite) {
      throw new CreateError(
        'CREATE_TARGET_EXISTS',
        `Directory already exists: ${preexisting[0]}. Pass --force to overwrite files in place.`,
        { targets: preexisting }
      );
    }
    if (spinner) spinner.stop();
    if ((await plan.confirmOverwrite(preexisting)) === 'cancel') {
      console.log(chalk.yellow('Operation cancelled.'));
      return { status: 'cancelled' };
    }
    // Interactive "overwrite" replaces the directory outright.
    for (const dir of preexisting) fs.removeSync(dir);
    preexisting = [];
  }

  if (spinner) {
    spinner.start();
    spinner.setText('Creating project structure...');
    flushOutput();
  }

  let files: string[];
  try {
    files = await plan.write(plan.root);
  } catch (error) {
    // Don't leave a half-written project behind: remove only what this run created.
    for (const dir of plan.targetDirs) {
      if (!preexisting.includes(dir)) {
        try {
          fs.removeSync(dir);
        } catch {
          /* best effort */
        }
      }
    }
    throw error;
  }

  if (spinner) spinner.stop();
  if (plan.afterWrite) await plan.afterWrite(files);

  return {
    status: 'created',
    response: {
      project: plan.name,
      mode: plan.mode,
      dryRun: false,
      root: plan.root,
      projectPath: plan.projectPath,
      skeleton: plan.skeleton,
      files,
      nextSteps: plan.nextSteps,
      notes: plan.notes,
    },
  };
}

/** Print notes and the numbered next steps for a finished run. */
function printNextSteps(plan: Pick<ScaffoldPlan, 'notes' | 'nextSteps'>): void {
  for (const note of plan.notes) {
    console.log(chalk.gray(`  note: ${note}`));
  }
  console.log('\nNext steps:');
  plan.nextSteps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
}

/** Convert a project name to its kebab-case directory name. */
function normalizeProjectName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/** Files under `dir` (recursively, skipping node_modules/.git), relative to `base`. */
function listWrittenFiles(dir: string, base: string): string[] {
  return [...readTree(dir).keys()].map((rel) => posixJoin(path.relative(base, dir), rel)).sort();
}

/**
 * Port the frontend dev server uses: an explicit `--port`, else the documented
 * default of 5173.
 */
function frontendPort(options: CreateProjectOptions): string {
  return options.port ?? '5173';
}

/**
 * Point a vite frontend's dev server at the API: add a `/api` proxy to the
 * generated vite config. Frameworks without a vite config are left untouched.
 */
function injectApiProxy(
  files: { path: string; content: string; executable?: boolean }[],
  apiPort: string
): void {
  for (const file of files) {
    if (/^vite\.config\.(ts|js)$/.test(file.path) && file.content.includes('server: {')) {
      file.content = file.content.replace(
        'server: {',
        `server: {\n    proxy: { '/api': 'http://localhost:${apiPort}' },`
      );
    }
  }
}

/**
 * Root script that runs a workspace script in every workspace in parallel.
 * pnpm fans out recursively (a `dev:*` pattern would only match scripts of the
 * selected workspaces, so it would silently run nothing and exit 0); npm and
 * yarn use npm-run-all over the per-workspace `<script>:<name>` scripts.
 */
function parallelRootScript(packageManager: string, script: string): string {
  return packageManager === 'pnpm'
    ? `pnpm run --parallel -r ${script}`
    : `npm-run-all --parallel ${script}:*`;
}

/**
 * Per-package-manager root scripts. pnpm runs workspace scripts recursively
 * (skipping packages without the script); npm and yarn get explicit per-app
 * scripts driven by npm-run-all, since neither can fan out in parallel natively.
 */
function rootScripts(
  packageManager: string,
  appDirs: string[]
): { scripts: Record<string, string>; devDependencies?: Record<string, string> } {
  if (packageManager === 'pnpm') {
    return {
      scripts: {
        dev: 'pnpm run --parallel -r dev',
        build: 'pnpm run --parallel -r build',
        lint: 'pnpm run --parallel -r lint',
        test: 'pnpm run --parallel -r test',
        clean: 'pnpm run --parallel -r clean',
      },
    };
  }
  const scripts: Record<string, string> = {
    dev: 'npm-run-all --parallel dev:*',
    build: 'npm-run-all --parallel build:*',
  };
  for (const dir of appDirs) {
    const label = path.basename(dir);
    scripts[`dev:${label}`] = `cd ${dir} && ${packageManager} run dev`;
    scripts[`build:${label}`] = `cd ${dir} && ${packageManager} run build`;
  }
  return { scripts, devDependencies: { 'npm-run-all': '^4.1.5' } };
}

/** API gateways a polyglot project can be generated with. */
const POLYGLOT_GATEWAYS = ['express', 'fastify', 'nestjs', 'traefik', 'kong'];

/** Frontend frameworks a polyglot project's generated API client supports. */
const POLYGLOT_FRONTENDS = ['react', 'react-ts', 'next', 'vue', 'vue-ts', 'angular', 'svelte', 'svelte-ts'];

/** Services generated when `--yes` / a non-TTY run gives no `--services`. */
const DEFAULT_POLYGLOT_SERVICES = 'typescript-service-1:express,python-service-2:fastapi';

/**
 * Build the service list for a non-interactive polyglot run from `--services`
 * (or the documented default of one TypeScript and one Python service).
 */
function polyglotServicesFromFlags(spec: string | undefined): PolyglotService[] {
  const entries = parseNameFrameworkList('--services', spec ?? DEFAULT_POLYGLOT_SERVICES);
  if (entries.length < 2) {
    throw new CreateError(
      'CREATE_INVALID_OPTIONS',
      'A polyglot project needs at least 2 services; pass --services name:framework,name:framework.',
      { services: spec }
    );
  }
  return entries.map((entry, index) => {
    const framework = assertBackend(entry.framework ?? DEFAULT_BACKEND);
    const template = getBackendTemplate(framework) as BackendTemplate;
    return {
      name: entry.name,
      framework,
      port: template.port?.toString() || (3001 + index).toString(),
      language: template.language,
      path: `services/${entry.name}`,
    };
  });
}

/**
 * Resolve a polyglot project's configuration without prompting: every value
 * comes from a flag or its documented default (the same defaults the wizard
 * pre-selects), and anything that cannot be satisfied is a coded error.
 */
function polyglotConfigFromFlags(
  name: string,
  normalizedName: string,
  options: CreateProjectOptions,
  request: ResolvedCreateRequest,
  notes: string[]
): PolyglotConfig {
  const { team, org = 're-shell', description, packageManager = 'pnpm' } = options;

  const gatewayFramework = options.gateway ?? 'express';
  if (!POLYGLOT_GATEWAYS.includes(gatewayFramework)) {
    throw templateNotFound('gateway framework', gatewayFramework, POLYGLOT_GATEWAYS);
  }
  if (options.gateway === undefined) {
    notes.push('No --gateway given; using the default API gateway "express".');
  }

  let frontendFramework = request.frontend;
  if (frontendFramework === undefined) {
    frontendFramework = 'react';
    notes.push('No --frontend given; including the default "react" frontend.');
  } else if (!POLYGLOT_FRONTENDS.includes(frontendFramework)) {
    throw new CreateError(
      'CREATE_INVALID_OPTIONS',
      `Frontend "${frontendFramework}" is not supported in polyglot mode; use one of ${POLYGLOT_FRONTENDS.join(', ')}.`,
      { frontend: frontendFramework }
    );
  }

  const database = (request.db ?? 'none') as DatabaseType;
  if (request.db === undefined) {
    notes.push('No --db given; no shared database is configured (pass --db prisma|typeorm|mongoose to add one).');
  }

  if (options.services === undefined) {
    notes.push(`No --services given; generating the default services (${DEFAULT_POLYGLOT_SERVICES}).`);
  }
  const services = polyglotServicesFromFlags(options.services);

  return {
    name,
    normalizedName,
    services,
    gatewayFramework,
    frontendFramework,
    database,
    org,
    team,
    description: description || `Polyglot microservices project with ${services.length} services`,
    packageManager,
  };
}

/**
 * Run the interactive polyglot wizard. Every prompt pre-selects the same value
 * the non-interactive defaults use. Returns `null` if the user declines the
 * final confirmation.
 */
async function polyglotConfigFromWizard(
  name: string,
  normalizedName: string,
  options: CreateProjectOptions
): Promise<PolyglotConfig | null> {
  const { team, org = 're-shell', description, packageManager = 'pnpm' } = options;

  // Step 1: Ask about API Gateway framework
  const { gatewayFramework } = await ask({
    type: 'select',
    name: 'gatewayFramework',
    message: 'Select API Gateway framework:',
    choices: [
      { title: 'Express (Node.js)', value: 'express', description: 'Lightweight and flexible' },
      { title: 'Fastify (Node.js)', value: 'fastify', description: 'High performance' },
      { title: 'NestJS (Node.js)', value: 'nestjs', description: 'Enterprise-grade with modules' },
      { title: 'Traefik (Go-based proxy)', value: 'traefik', description: 'Cloud-native edge router' },
      { title: 'Kong (Lua-based proxy)', value: 'kong', description: 'Feature-rich API gateway' },
    ],
    initial: 0,
  });

  // Step 2: Ask if frontend is needed
  const { includeFrontend } = await ask({
    type: 'confirm',
    name: 'includeFrontend',
    message: 'Include a frontend application?',
    initial: true,
  });

  let frontendFramework: string | undefined;
  if (includeFrontend) {
    const { frontend } = await ask({
      type: 'select',
      name: 'frontend',
      message: 'Select frontend framework:',
      choices: [
        { title: 'React', value: 'react' },
        { title: 'Next.js', value: 'next' },
        { title: 'Vue', value: 'vue' },
        { title: 'Angular', value: 'angular' },
        { title: 'Svelte', value: 'svelte' },
      ],
      initial: 0,
    });
    frontendFramework = frontend;
  }

  // Step 3: Select database
  const { database } = await ask({
    type: 'select',
    name: 'database',
    message: 'Select database for shared data access:',
    choices: getDatabaseChoices(),
    initial: 0, // Default to none, matching the non-interactive default
  });

  // Step 4: Add services
  const services: PolyglotService[] = [];
  let addingServices = true;
  const servicePortBase = 3001;

  console.log(chalk.blue('\n📦 Add microservices to your polyglot project:\n'));

  while (addingServices) {
    // Select programming language
    const { language } = await ask({
      type: 'select',
      name: 'language',
      message: `Select language for service ${services.length + 1}:`,
      choices: getBackendLanguageChoices(),
      initial: 0,
    });

    // Select framework within that language
    const frameworkChoices = getFrameworkChoicesForLanguage(language);
    const { framework } = await ask({
      type: 'select',
      name: 'framework',
      message: `Select ${language} framework:`,
      choices: frameworkChoices,
      initial: 0,
    });

    // Service name
    const { serviceName } = await ask({
      type: 'text',
      name: 'serviceName',
      message: 'Service name (kebab-case):',
      initial: `${language.toLowerCase()}-service-${services.length + 1}`,
      validate: (val: string) => {
        if (!val || !val.match(/^[a-z][a-z0-9-]*$/)) {
          return 'Use lowercase letters, numbers, and hyphens only';
        }
        return true;
      },
    });

    // Get backend template for port info
    const backendTemplate = getBackendTemplate(framework);
    const servicePort = backendTemplate?.port?.toString() || (servicePortBase + services.length).toString();

    services.push({
      name: serviceName,
      framework,
      port: servicePort,
      language,
      path: `services/${serviceName}`,
    });

    console.log(chalk.green(`✓ Added "${serviceName}" (${language})\n`));

    // Ask if user wants to add more services
    if (services.length >= 2) {
      const { addMore } = await ask({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another service?',
        initial: false,
      });
      addingServices = addMore;
    }
  }

  if (services.length === 0) {
    console.log(chalk.yellow('\nNo services added. Project creation cancelled.\n'));
    return null;
  }

  return {
    name,
    normalizedName,
    services,
    gatewayFramework,
    frontendFramework,
    database: database as DatabaseType,
    org,
    team,
    description: description || `Polyglot microservices project with ${services.length} services`,
    packageManager,
  };
}

/** Print the polyglot summary table (shared by the wizard confirmation and the non-interactive run). */
function printPolyglotSummary(config: PolyglotConfig): void {
  console.log(chalk.bold('\n📋 Polyglot Project Summary:\n'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Project:')} ${config.name}`);
  console.log(`${chalk.bold('API Gateway:')} ${config.gatewayFramework}`);
  if (config.frontendFramework) {
    console.log(`${chalk.bold('Frontend:')} ${config.frontendFramework}`);
  }
  console.log(`${chalk.bold('Database:')} ${config.database}`);
  console.log(chalk.bold('\nServices:'));
  config.services.forEach((s, i) => {
    const icon = getServiceIcon(s.language);
    console.log(`  ${i + 1}. ${icon} ${s.name} (${s.language}) - Port ${s.port}`);
  });
  console.log(chalk.gray('─'.repeat(50)));
}

/**
 * Plan a polyglot microservices project: an API gateway, services in multiple
 * languages, an optional frontend and a shared types package.
 *
 * @param name - Name of the polyglot project
 * @param options - Additional options for project creation
 * @param monorepoRoot - Optional monorepo root path
 * @param request - The validated create request (frontend / database choices)
 * @param interactive - Whether to run the wizard (otherwise flags + defaults)
 * @returns The plan, or `null` when the wizard was declined.
 */
async function buildPolyglotPlan(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot: string | null | undefined,
  request: ResolvedCreateRequest,
  interactive: boolean
): Promise<ScaffoldPlan | null> {
  const { packageManager = 'pnpm', spinner } = options;
  const normalizedName = normalizeProjectName(name);
  const rootPath = monorepoRoot || process.cwd();
  const notes = [...request.notes];

  if (!options.dryRun) {
    console.log(chalk.cyan.bold('\n🌐 Creating Polyglot Microservices Project\n'));
  }
  // Stop spinner for prompts / console output
  if (spinner) spinner.stop();

  let config: PolyglotConfig | null;
  if (interactive) {
    config = await polyglotConfigFromWizard(name, normalizedName, options);
    if (!config) return null;
    printPolyglotSummary(config);
    const { confirm } = await ask({
      type: 'confirm',
      name: 'confirm',
      message: '\nCreate this polyglot project?',
      initial: true,
    });
    if (!confirm) {
      console.log(chalk.yellow('\nProject creation cancelled.\n'));
      return null;
    }
  } else {
    config = polyglotConfigFromFlags(name, normalizedName, options, request, notes);
    if (!options.dryRun) printPolyglotSummary(config);
  }

  const polyglot = config;
  const projectPath = path.join(rootPath, normalizedName);

  return {
    mode: 'polyglot',
    name,
    root: rootPath,
    targetDirs: [projectPath],
    projectPath,
    frontend: polyglot.frontendFramework,
    summary: [
      `Name: ${normalizedName}`,
      `Gateway: ${polyglot.gatewayFramework}`,
      ...(polyglot.frontendFramework ? [`Frontend: ${polyglot.frontendFramework}`] : []),
      `Database: ${polyglot.database}`,
      `Services: ${polyglot.services.map((s) => `${s.name} (${s.framework})`).join(', ')}`,
    ],
    skeleton: false,
    notes,
    seedFiles: [],
    nextSteps: [`cd ${normalizedName}`, `${packageManager} install`, `${packageManager} run dev`],
    async write(outRoot: string): Promise<string[]> {
      const target = path.join(outRoot, normalizedName);
      await fs.ensureDir(target);
      await generatePolyglotProjectFiles(target, polyglot);
      return listWrittenFiles(target, outRoot);
    },
    async afterWrite(): Promise<void> {
      console.log(chalk.green.bold(`\n✓ Polyglot project "${normalizedName}" created successfully!\n`));
      console.log(chalk.gray(`Path: ${path.relative(process.cwd(), projectPath)}`));
      printNextSteps({ notes, nextSteps: this.nextSteps });
      console.log('\n📚 Services will be available at:');
      polyglot.services.forEach((s) => {
        console.log(`  • http://localhost:${s.port} - ${s.name}`);
      });
      if (polyglot.frontendFramework) {
        console.log(`  • http://localhost:3000 - Frontend`);
      }
      console.log(`  • http://localhost:8080 - API Gateway`);
    },
  };
}

/**
 * Get an icon (emoji) for a programming language.
 *
 * @param language - The programming language name (case-sensitive).
 * @returns The emoji icon for the language, or a default package icon.
 */
function getServiceIcon(language: string): string {
  const icons: Record<string, string> = {
    'JavaScript': '🟨',
    'TypeScript': '🔷',
    'Python': '🐍',
    'Go': '🐹',
    'Rust': '🦀',
    'Java': '☕',
    'C#': '🔷',
    'Ruby': '💎',
    'PHP': '🐘',
    'Elixir': '💜',
    'C++': '⚡',
    'Swift': '🍎',
    'Kotlin': '🎯',
    'Dart': '🎯',
  };
  return icons[language] || '📦';
}

/** Frameworks the microfrontend shell (and remotes) can be generated with. */
const MF_SHELL_FRAMEWORKS = ['react', 'react-ts', 'vue', 'vue-ts', 'angular', 'svelte', 'svelte-ts'];

/** Frameworks a remote can be generated with. */
const MF_REMOTE_FRAMEWORKS = MF_SHELL_FRAMEWORKS;

/** Module Federation frameworks verified end to end (install + build) by the verify script. */
const MF_VERIFIED_FRAMEWORKS = ['react', 'react-ts', 'vue'];

/** First remote's port; each further remote takes the next one. */
const MF_REMOTE_PORT_BASE = 3001;

/**
 * Module Federation container name for a remote. The container is a global
 * variable (`remote_1@http://.../remoteEntry.js`), so it must be a valid
 * identifier: kebab-case remote names have their hyphens replaced. The shell
 * still imports the remote by its original name (the `remotes` key).
 *
 * @param remoteName - The kebab-case remote name.
 * @returns An identifier-safe container name.
 */
function mfContainerName(remoteName: string): string {
  return remoteName.replace(/[^A-Za-z0-9_$]/g, '_');
}

/**
 * Shared singletons that fit the frameworks in use: React apps share
 * react + react-dom, Vue apps vue, Angular apps @angular/core + rxjs. This is
 * the non-interactive counterpart of the wizard's pre-selected dependencies.
 */
function defaultSharedDeps(frameworks: string[]): string[] {
  const deps = new Set<string>();
  for (const framework of frameworks) {
    if (framework.includes('react')) {
      deps.add('react');
      deps.add('react-dom');
    } else if (framework.includes('vue')) {
      deps.add('vue');
    } else if (framework.includes('angular')) {
      deps.add('@angular/core');
      deps.add('rxjs');
    }
  }
  return [...deps];
}

/** Build the remote list for a non-interactive run from `--remotes` (or one default remote). */
function microfrontendRemotesFromFlags(spec: string | undefined): MicrofrontendRemote[] {
  const entries = parseNameFrameworkList('--remotes', spec ?? 'remote-1');
  return entries.map((entry, index) => {
    const framework = entry.framework ?? 'react';
    if (!MF_REMOTE_FRAMEWORKS.includes(framework)) {
      throw templateNotFound('remote framework', framework, MF_REMOTE_FRAMEWORKS);
    }
    return {
      name: entry.name,
      framework,
      port: (MF_REMOTE_PORT_BASE + index).toString(),
      route: `/${entry.name}`,
      path: `remotes/${entry.name}`,
      exposes: { './App': './src/App' },
    };
  });
}

/** Resolve a microfrontend project's configuration without prompting (flags + documented defaults). */
function microfrontendConfigFromFlags(
  name: string,
  normalizedName: string,
  options: CreateProjectOptions,
  request: ResolvedCreateRequest,
  notes: string[]
): MicrofrontendConfig {
  const { team, org = 're-shell', description, packageManager = 'pnpm' } = options;

  let shellFramework = request.frontend;
  if (shellFramework === undefined) {
    shellFramework = 'react-ts';
    notes.push('No --framework given; using the default shell framework "react-ts".');
  } else if (!MF_SHELL_FRAMEWORKS.includes(shellFramework)) {
    throw templateNotFound('shell framework', shellFramework, MF_SHELL_FRAMEWORKS);
  }

  if (options.remotes === undefined) {
    notes.push('No --remotes given; generating one default remote "remote-1" (react).');
  }
  const remotes = microfrontendRemotesFromFlags(options.remotes);
  const sharedDeps = defaultSharedDeps([shellFramework, ...remotes.map((r) => r.framework)]);

  return {
    name,
    normalizedName,
    shellFramework,
    remotes,
    org,
    team,
    description:
      description ||
      `Microfrontend project with ${remotes.length} remote${remotes.length !== 1 ? 's' : ''}`,
    packageManager,
    sharedDeps,
  };
}

/**
 * Run the interactive microfrontend wizard. Every prompt pre-selects the same
 * value the non-interactive defaults use. Returns `null` if the user declines.
 */
async function microfrontendConfigFromWizard(
  name: string,
  normalizedName: string,
  options: CreateProjectOptions
): Promise<MicrofrontendConfig | null> {
  const { team, org = 're-shell', description, packageManager = 'pnpm' } = options;

  // Step 1: Select shell framework
  const { shellFramework } = await ask({
    type: 'select',
    name: 'shellFramework',
    message: 'Select shell application framework:',
    choices: [
      { title: 'React', value: 'react', description: 'Most popular, extensive ecosystem' },
      { title: 'React + TypeScript', value: 'react-ts', description: 'Type-safe React development' },
      { title: 'Vue', value: 'vue', description: 'Progressive framework' },
      { title: 'Vue + TypeScript', value: 'vue-ts', description: 'Type-safe Vue development' },
      { title: 'Angular', value: 'angular', description: 'Full-featured framework' },
      { title: 'Svelte', value: 'svelte', description: 'Lightweight and fast' },
    ],
    initial: 1, // Default to react-ts
  });

  // Step 2: Select shared dependencies
  const { useSharedDeps } = await ask({
    type: 'multiselect',
    name: 'useSharedDeps',
    message: 'Select shared dependencies (will be single instance):',
    choices: [
      { title: 'React', value: 'react', selected: true },
      { title: 'ReactDOM', value: 'react-dom', selected: true },
      { title: 'Vue', value: 'vue' },
      { title: 'Angular', value: '@angular/core' },
      { title: 'rxjs', value: 'rxjs' },
      { title: 'React Router', value: 'react-router-dom' },
      { title: 'Vue Router', value: 'vue-router' },
      { title: 'Zustand', value: 'zustand' },
      { title: 'Redux', value: 'redux' },
      { title: 'axios', value: 'axios' },
      { title: 'lodash', value: 'lodash' },
      { title: 'date-fns', value: 'date-fns' },
    ],
    min: 1,
  });

  // Step 3: Add remote microfrontends
  const remotes: MicrofrontendRemote[] = [];
  let addingRemotes = true;
  const portBase = MF_REMOTE_PORT_BASE;

  console.log(chalk.blue('\n📦 Add remote microfrontends:\n'));

  while (addingRemotes) {
    // Select framework for remote
    const { framework } = await ask({
      type: 'select',
      name: 'framework',
      message: `Select framework for remote ${remotes.length + 1}:`,
      choices: [
        { title: 'React', value: 'react' },
        { title: 'React + TypeScript', value: 'react-ts' },
        { title: 'Vue', value: 'vue' },
        { title: 'Vue + TypeScript', value: 'vue-ts' },
        { title: 'Angular', value: 'angular' },
        { title: 'Svelte', value: 'svelte' },
      ],
      initial: 0,
    });

    // Remote name
    const { remoteName } = await ask({
      type: 'text',
      name: 'remoteName',
      message: 'Remote name (kebab-case):',
      initial: `remote-${remotes.length + 1}`,
      validate: (val: string) => {
        if (!val || !val.match(/^[a-z][a-z0-9-]*$/)) {
          return 'Use lowercase letters, numbers, and hyphens only';
        }
        return true;
      },
    });

    // Route for remote
    const { route } = await ask({
      type: 'text',
      name: 'route',
      message: 'Route path (for shell routing):',
      initial: `/${remoteName}`,
      validate: (val: string) => (val.startsWith('/') ? true : 'Route must start with /'),
    });

    // Exposed modules
    const { hasExposed } = await ask({
      type: 'confirm',
      name: 'hasExposed',
      message: 'Expose specific components from this remote?',
      initial: true,
    });

    const exposes: Record<string, string> = {};
    if (hasExposed) {
      const { exposePath } = await ask({
        type: 'text',
        name: 'exposePath',
        message: 'Default exposed component path:',
        initial: './src/App',
      });
      exposes['./App'] = exposePath;
    }

    const remotePort = (portBase + remotes.length).toString();

    remotes.push({
      name: remoteName,
      framework,
      port: remotePort,
      route,
      path: `remotes/${remoteName}`,
      exposes,
    });

    console.log(chalk.green(`✓ Added "${remoteName}" (${framework}) at port ${remotePort}\n`));

    // Ask if user wants to add more remotes
    if (remotes.length >= 1) {
      const { addMore } = await ask({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another remote microfrontend?',
        initial: false,
      });
      addingRemotes = addMore;
    }
  }

  if (remotes.length === 0) {
    console.log(chalk.yellow('\nNo remotes added. Creating shell only...\n'));
  }

  return {
    name,
    normalizedName,
    shellFramework,
    remotes,
    org,
    team,
    description:
      description ||
      `Microfrontend project with ${remotes.length} remote${remotes.length !== 1 ? 's' : ''}`,
    packageManager,
    sharedDeps: useSharedDeps,
  };
}

/** Print the microfrontend summary table (shared by the wizard confirmation and the non-interactive run). */
function printMicrofrontendSummary(config: MicrofrontendConfig): void {
  console.log(chalk.bold('\n📋 Microfrontend Project Summary:\n'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Project:')} ${config.name}`);
  console.log(`${chalk.bold('Shell:')} ${config.shellFramework} (Port 3000)`);
  console.log(`${chalk.bold('Shared Dependencies:')} ${config.sharedDeps.join(', ')}`);
  if (config.remotes.length > 0) {
    console.log(chalk.bold('\nRemote Microfrontends:'));
    config.remotes.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} (${r.framework}) - Port ${r.port} - Route: ${r.route}`);
    });
  }
  console.log(chalk.gray('─'.repeat(50)));
}

/**
 * Plan a microfrontend project with Module Federation: a shell, remotes and a
 * shared package.
 *
 * @param name - Name of the microfrontend project
 * @param options - Additional options for project creation
 * @param monorepoRoot - Optional monorepo root path
 * @param request - The validated create request (shell framework)
 * @param interactive - Whether to run the wizard (otherwise flags + defaults)
 * @returns The plan, or `null` when the wizard was declined.
 */
async function buildMicrofrontendPlan(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot: string | null | undefined,
  request: ResolvedCreateRequest,
  interactive: boolean
): Promise<ScaffoldPlan | null> {
  const { packageManager = 'pnpm', spinner } = options;
  const normalizedName = normalizeProjectName(name);
  const rootPath = monorepoRoot || process.cwd();
  const notes = [...request.notes];

  if (!options.dryRun) {
    console.log(chalk.cyan.bold('\n🧩 Creating Microfrontend Project with Module Federation\n'));
  }
  // Stop spinner for prompts / console output
  if (spinner) spinner.stop();

  let config: MicrofrontendConfig | null;
  if (interactive) {
    config = await microfrontendConfigFromWizard(name, normalizedName, options);
    if (!config) return null;
    printMicrofrontendSummary(config);
    const { confirm } = await ask({
      type: 'confirm',
      name: 'confirm',
      message: '\nCreate this microfrontend project?',
      initial: true,
    });
    if (!confirm) {
      console.log(chalk.yellow('\nProject creation cancelled.\n'));
      return null;
    }
  } else {
    config = microfrontendConfigFromFlags(name, normalizedName, options, request, notes);
    if (!options.dryRun) printMicrofrontendSummary(config);
  }

  const mf = config;
  const projectPath = path.join(rootPath, normalizedName);

  // Only these Module Federation templates are verified to install and build
  // (see scripts/verify-create-modes.mjs); say so rather than imply the rest are.
  const unverified = [...new Set([mf.shellFramework, ...mf.remotes.map((r) => r.framework)])].filter(
    (framework) => !MF_VERIFIED_FRAMEWORKS.includes(framework)
  );
  if (unverified.length > 0) {
    notes.push(
      `The Module Federation templates for ${unverified.join(', ')} are experimental and not verified to build; ` +
        `the ${MF_VERIFIED_FRAMEWORKS.join(', ')} ones are. Run "${packageManager} install && ${packageManager} run build" to check.`
    );
  }

  return {
    mode: 'microfrontend',
    name,
    root: rootPath,
    targetDirs: [projectPath],
    projectPath,
    frontend: mf.shellFramework,
    summary: [
      `Name: ${normalizedName}`,
      `Shell: ${mf.shellFramework}`,
      `Remotes: ${mf.remotes.map((r) => `${r.name} (${r.framework})`).join(', ') || 'none'}`,
    ],
    skeleton: false,
    notes,
    seedFiles: [],
    nextSteps: [`cd ${normalizedName}`, `${packageManager} install`, `${packageManager} run dev`],
    async write(outRoot: string): Promise<string[]> {
      const target = path.join(outRoot, normalizedName);
      await fs.ensureDir(target);
      await generateMicrofrontendProjectFiles(target, mf);
      return listWrittenFiles(target, outRoot);
    },
    async afterWrite(): Promise<void> {
      console.log(chalk.green.bold(`\n✓ Microfrontend project "${normalizedName}" created successfully!\n`));
      console.log(chalk.gray(`Path: ${path.relative(process.cwd(), projectPath)}`));
      printNextSteps({ notes, nextSteps: this.nextSteps });
      console.log('\n📚 Applications will be available at:');
      console.log(`  • http://localhost:3000 - Shell Application`);
      mf.remotes.forEach((r) => {
        console.log(`  • http://localhost:${r.port} - ${r.name} (for standalone development)`);
      });
    },
  };
}

/**
 * Generate microfrontend project files with Module Federation.
 *
 * @param projectPath - Root directory where the project will be created.
 * @param config - Microfrontend project configuration (shell, remotes, shared deps).
 */
async function generateMicrofrontendProjectFiles(
  projectPath: string,
  config: MicrofrontendConfig
): Promise<void> {
  const { remotes, org, description, packageManager} = config;

  // Create root package.json
  const rootPackageJson = {
    name: config.name,
    version: '0.1.0',
    description,
    private: true,
    workspaces: [
      'shell',
      ...remotes.map((r) => r.path),
      'shared',
    ],
    scripts: {
      dev: parallelRootScript(packageManager, 'dev'),
      'dev:shell': `cd shell && ${packageManager} run dev`,
      ...Object.fromEntries(remotes.map((r) => [`dev:${r.name}`, `cd ${r.path} && ${packageManager} run dev`])),
      build: parallelRootScript(packageManager, 'build'),
      'build:shell': `cd shell && ${packageManager} run build`,
      ...Object.fromEntries(remotes.map((r) => [`build:${r.name}`, `cd ${r.path} && ${packageManager} run build`])),
      lint: 'eslint . --ext .js,.ts,.jsx,.tsx,.vue',
      clean: 'rm -rf node_modules **/node_modules **/dist',
    },
    author: config.team || org,
    license: 'MIT',
    devDependencies: {
      'npm-run-all': '^4.1.5',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      '@typescript-eslint/parser': '^6.0.0',
      'eslint': '^8.0.0',
    },
  };

  await fs.writeJson(path.join(projectPath, 'package.json'), rootPackageJson, { spaces: 2 });

  // Create pnpm workspace file if using pnpm
  if (packageManager === 'pnpm') {
    await fs.writeFile(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      `packages:\n  - 'shell'\n${remotes.map((r) => `  - '${r.path}'`).join('\n')}\n  - 'shared'\n`
    );
  }

  // Create shared package for common utilities
  const sharedPath = path.join(projectPath, 'shared');
  await fs.ensureDir(sharedPath);
  await generateSharedPackage(sharedPath, config);

  // Generate shell application
  const shellPath = path.join(projectPath, 'shell');
  await fs.ensureDir(shellPath);
  await generateShellApp(shellPath, config);

  // Generate each remote
  for (const remote of remotes) {
    const remotePath = path.join(projectPath, remote.path);
    await fs.ensureDir(remotePath);
    await generateRemoteApp(remotePath, remote, config);
  }

  // Create README
  await generateMicrofrontendReadme(projectPath, config);
}

/**
 * Generate shared package for utilities and types.
 *
 * @param sharedPath - Directory where the shared package will be created.
 * @param config - Microfrontend project configuration.
 */
async function generateSharedPackage(sharedPath: string, config: MicrofrontendConfig): Promise<void> {
  const { normalizedName } = config;

  const packageJson = {
    name: `${normalizedName}-shared`,
    version: '0.1.0',
    description: 'Shared utilities and types for microfrontend project',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      watch: 'tsc --watch',
    },
    dependencies: {},
    devDependencies: {
      typescript: '^5.0.0',
    },
  };

  await fs.writeJson(path.join(sharedPath, 'package.json'), packageJson, { spaces: 2 });

  // Generate shared utilities
  const utilsContent = `// Shared utilities for ${config.name}
// This package is shared between shell and all remotes

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface NavigationItem {
  path: string;
  label: string;
  icon?: string;
}

// Event bus for cross-microfrontend communication
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }
}

export const eventBus = new EventBus();

// Common navigation items
export const navigationItems: NavigationItem[] = [
${config.remotes.map((r) => `  { path: '${r.route}', label: '${toPascalCase(r.name)}' },`).join('\n')}
];
`;

  await fs.outputFile(path.join(sharedPath, 'src/index.ts'), utilsContent);

  // Generate tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
  };

  await fs.writeJson(path.join(sharedPath, 'tsconfig.json'), tsconfig, { spaces: 2 });
}

/**
 * Generate shell application with Module Federation.
 *
 * @param shellPath - Directory where the shell application will be created.
 * @param config - Microfrontend project configuration.
 */
async function generateShellApp(shellPath: string, config: MicrofrontendConfig): Promise<void> {
  const { shellFramework, remotes, sharedDeps } = config;

  const frameworkConfig = getFrameworkConfig(shellFramework);
  if (!frameworkConfig) {
    throw new Error(`Unsupported framework: ${shellFramework}`);
  }

  // Determine module federation template based on framework
  const mfTemplate = shellFramework.includes('react')
    ? 'react-module-federation'
    : shellFramework.includes('vue')
    ? 'vue-module-federation'
    : shellFramework.includes('angular')
    ? 'angular-module-federation'
    : shellFramework.includes('svelte')
    ? 'svelte-module-federation'
    : 'react-module-federation';

  // Generate shell with Module Federation config
  const templateContext: TemplateContext = {
    name: `${config.name}-shell`,
    normalizedName: `${config.normalizedName}-shell`,
    framework: mfTemplate,
    hasTypeScript: frameworkConfig.hasTypeScript || false,
    port: '3000',
    route: '/',
    org: config.org,
    team: config.team,
    description: `${config.name} Shell Application`,
    packageManager: config.packageManager,
  };

  // Create shell template
  const template = createMfShellTemplate(mfTemplate, templateContext, remotes, sharedDeps);
  const files = await template.generateFiles();

  for (const file of files) {
    const filePath = path.join(shellPath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
  }

  // Generate shell-specific routing
  await generateShellRouting(shellPath, config);
}

/**
 * Create a Module Federation shell template instance.
 *
 * @param framework - Framework identifier (e.g. 'react-module-federation').
 * @param context - Template context used for file generation.
 * @param remotes - List of remote microfrontend entries.
 * @param sharedDeps - Dependencies shared as singletons across all apps.
 * @returns A `BaseTemplate` subclass configured as a Module Federation shell.
 */
function createMfShellTemplate(
  framework: string,
  context: TemplateContext,
  remotes: MicrofrontendRemote[],
  sharedDeps: string[]
): BaseTemplate {
  // Create a fake framework config
  const frameworkConfig = { name: framework, hasTypeScript: context.hasTypeScript } as FrameworkConfig;
  // Return appropriate template based on framework
  switch (framework) {
    case 'react-module-federation':
      return new ReactModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    case 'vue-module-federation':
      return new VueModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    case 'angular-module-federation':
      return new AngularModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    case 'svelte-module-federation':
      return new SvelteModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    default:
      return new ReactModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
  }
}

/**
 * Generate shell routing configuration.
 *
 * @param shellPath - Directory where the shell application is located.
 * @param config - Microfrontend project configuration.
 */
async function generateShellRouting(shellPath: string, config: MicrofrontendConfig): Promise<void> {
  const { shellFramework } = config;

  if (shellFramework.includes('react')) {
    // Previously written to src/src/Routing.tsx (a doubled path segment) and
    // never imported by anything — the shell could not route to remotes.
    // Write it at src/Routing.tsx and wire it into the App component.
    const appExt = shellFramework.includes('ts') ? 'tsx' : 'jsx';
    const routingContent = generateReactRouting(config);
    await fs.outputFile(path.join(shellPath, `src/Routing.${appExt}`), routingContent);
    const routingImport = `./Routing`;
    const { name } = config;
    await fs.outputFile(
      path.join(shellPath, `src/App.${appExt}`),
      `import React from 'react';
import AppRouting from '${routingImport}';
import './App.css';

/**
 * ${name} shell application. Routes between the home view and the remote
 * microfrontends configured in Routing.${appExt}.
 */
function App() {
  return (
    <div className="app">
      <AppRouting />
    </div>
  );
}

export default App;
`
    );
  } else if (shellFramework.includes('vue')) {
    const routingContent = generateVueRouting(config);
    await fs.outputFile(path.join(shellPath, 'src/router/index.ts'), routingContent);
  }
}

/**
 * Generate React routing for the shell application.
 *
 * @param config - Microfrontend project configuration.
 * @returns JSX/TSX routing source code as a string.
 */
function generateReactRouting(config: MicrofrontendConfig): string {
  const { remotes, shellFramework } = config;
  // Remote modules are resolved at runtime by Module Federation; no type
  // declarations exist for them, so the strict TS build needs a suppression.
  const tsIgnore = shellFramework.includes('ts') ? '// @ts-ignore -- remote module resolved at runtime by Module Federation\n' : '';

  return `import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const LoadingFallback = () => <div>Loading...</div>;

// Dynamic imports for remote microfrontends
${remotes.map((r) => {
  const componentPascal = toPascalCase(r.name);
  return `${tsIgnore}const ${componentPascal} = lazy(() =>
  import('${r.name}/${Object.keys(r.exposes)[0] || 'App'}')
);`;
}).join('\n')}

export default function AppRouting() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<div>Welcome to ${config.name} Shell</div>} />
${remotes.map((r) => `          <Route path="${r.route}" element={<${toPascalCase(r.name)} />} />`).join('\n')}
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}
`;
}

/**
 * Generate Vue routing for the shell application.
 *
 * @param config - Microfrontend project configuration.
 * @returns Vue Router source code as a string.
 */
function generateVueRouting(config: MicrofrontendConfig): string {
  const { remotes } = config;

  return `import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    component: () => import('@/views/Home.vue'),
  },
${remotes.map((r) => `  {
    path: '${r.route}',
    component: () => import('${r.name}/${Object.keys(r.exposes)[0] || 'App'}'),
  },`).join('\n')}
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
`;
}

/**
 * Generate a remote microfrontend application.
 *
 * @param remotePath - Directory where the remote will be created.
 * @param remote - Remote microfrontend metadata.
 * @param config - Microfrontend project configuration.
 */
async function generateRemoteApp(
  remotePath: string,
  remote: MicrofrontendRemote,
  config: MicrofrontendConfig
): Promise<void> {
  const { sharedDeps } = config;

  const frameworkConfig = getFrameworkConfig(remote.framework);
  if (!frameworkConfig) {
    throw new Error(`Unsupported framework: ${remote.framework}`);
  }

  // Determine module federation template
  const mfTemplate = remote.framework.includes('react')
    ? 'react-module-federation'
    : remote.framework.includes('vue')
    ? 'vue-module-federation'
    : remote.framework.includes('angular')
    ? 'angular-module-federation'
    : remote.framework.includes('svelte')
    ? 'svelte-module-federation'
    : 'react-module-federation';

  const templateContext: TemplateContext = {
    name: remote.name,
    normalizedName: remote.name,
    framework: mfTemplate,
    hasTypeScript: frameworkConfig.hasTypeScript || false,
    port: remote.port,
    route: remote.route,
    org: config.org,
    team: config.team,
    description: `${remote.name} Remote Microfrontend`,
    packageManager: config.packageManager,
  };

  const template = createMfRemoteTemplate(mfTemplate, templateContext, remote, sharedDeps);
  const files = await template.generateFiles();

  for (const file of files) {
    const filePath = path.join(remotePath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
  }
}

/**
 * Create a Module Federation remote template instance.
 *
 * @param framework - Framework identifier (e.g. 'react-module-federation').
 * @param context - Template context used for file generation.
 * @param remote - Remote microfrontend metadata.
 * @param sharedDeps - Dependencies shared as singletons across all apps.
 * @returns A `BaseTemplate` subclass configured as a Module Federation remote.
 */
function createMfRemoteTemplate(
  framework: string,
  context: TemplateContext,
  remote: MicrofrontendRemote,
  sharedDeps: string[]
): BaseTemplate {
  // Create a fake framework config
  const frameworkConfig = { name: framework, hasTypeScript: context.hasTypeScript } as FrameworkConfig;
  switch (framework) {
    case 'react-module-federation':
      return new ReactModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    case 'vue-module-federation':
      return new VueModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    case 'angular-module-federation':
      return new AngularModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    case 'svelte-module-federation':
      return new SvelteModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    default:
      return new ReactModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
  }
}

/**
 * Generate the README.md for a microfrontend project.
 *
 * @param projectPath - Root directory of the project.
 * @param config - Microfrontend project configuration.
 */
async function generateMicrofrontendReadme(projectPath: string, config: MicrofrontendConfig): Promise<void> {
  const { shellFramework, remotes, normalizedName } = config;

  const readmeContent = `# ${config.name}

A microfrontend project created with [Re-Shell CLI](${REPO_URL}) using Module Federation.

## Architecture

This project uses Webpack 5 Module Federation to share code between the shell application and remote microfrontends.

\`\`\`
┌─────────────────────────────────────────┐
│          Shell Application             │
│          (${shellFramework})            │
│          Port: 3000                     │
└────────────────┬────────────────────────┘
                 │
${remotes.map((r) => `┌────────────────▼────────────────┐
│  ${r.name.padEnd(28)} │
│  ${r.framework.padEnd(28)} │
│  Port: ${r.port.padEnd(20)} │
└────────────────────────────────┘`).join('\n                 │\n')}
                 │
┌────────────────▼────────────────┐
│         Shared Package           │
│    Utilities & Types             │
└──────────────────────────────────┘
\`\`\`

## Applications

| Application | Framework | Port | Path |
|-------------|-----------|------|------|
| Shell | ${shellFramework} | 3000 | /shell |
${remotes.map((r) => `| ${r.name} | ${r.framework} | ${r.port} | ${r.path} |`).join('\n')}

## Shared Dependencies

These dependencies are shared as singletons across all applications:

\`\`\`
${config.sharedDeps.join(', ')}
\`\`\`

## Getting Started

### Installation

\`\`\`bash
# Install all dependencies
${config.packageManager} install
\`\`\`

### Development

\`\`\`bash
# Start all applications (shell + all remotes)
${config.packageManager} run dev

# Start shell only
${config.packageManager} run dev:shell

# Start specific remote
${config.packageManager} run dev:${remotes[0]?.name || '<remote-name>'}
\`\`\`

### Building

\`\`\`bash
# Build all applications
${config.packageManager} run build

# Build shell only
${config.packageManager} run build:shell

# Build specific remote
${config.packageManager} run build:${remotes[0]?.name || '<remote-name>'}
\`\`\`

## Development Workflow

### Adding a New Remote

1. Create the remote app:

\`\`\`bash
re-shell create my-remote --microfrontend --framework react
\`\`\`

2. Update the shell's Module Federation config to include the new remote:

\`\`\`javascript
// shell/webpack.config.js
remotes: {
  myRemote: 'myRemote@http://localhost:3002/remoteEntry.js',
},
\`\`\`

3. Add routing for the new remote in the shell.

### Shared Package

The \`shared/\` directory contains utilities and types shared across all microfrontends:

\`\`\`typescript
import { eventBus, User } from '${normalizedName}-shared';

// Use shared event bus for cross-MF communication
eventBus.emit('user:login', { id: '123', name: 'John' });

eventBus.on('user:logout', () => {
  // Handle logout across all MFs
});
\`\`\`

## Module Federation Configuration

### Shell

The shell exposes no modules but consumes all remotes:

\`\`\`javascript
// shell/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotes.map((r) => `        '${r.name}': '${mfContainerName(r.name)}@http://localhost:${r.port}/remoteEntry.js',`).join('\n')}
      },
      shared: {
${config.sharedDeps.map((d) => `        '${d}': { singleton: true },`).join('\n')}
      },
    }),
  ],
};
\`\`\`

### Remote (${remotes[0]?.name || 'example'})

Each remote exposes its components:

\`\`\`javascript
// remotes/${remotes[0]?.name || 'example'}/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: '${remotes[0]?.name || 'remote'}',
      filename: 'remoteEntry.js',
      exposes: {
${Object.entries(remotes[0]?.exposes || { './App': './src/App' }).map(([key, val]) => `        '${key}': '${val}',`).join('\n')}
      },
      shared: {
${config.sharedDeps.map((d) => `        '${d}': { singleton: true },`).join('\n')}
      },
    }),
  ],
};
\`\`\`

## License

MIT

---

Generated with ❤️ by [Re-Shell CLI](${REPO_URL})
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
}

/**
 * Generate polyglot project files including services, gateway, frontend, and README.
 *
 * @param projectPath - Root directory where the project will be created.
 * @param config - Polyglot project configuration.
 */
async function generatePolyglotProjectFiles(
  projectPath: string,
  config: PolyglotConfig
): Promise<void> {
  const { services, frontendFramework, database, org, description, packageManager } = config;

  // Create root package.json
  const rootPackageJson = {
    name: config.name,
    version: '0.1.0',
    description,
    private: true,
    workspaces: [
      'services/*',
      frontendFramework ? 'frontend' : null,
      'gateway',
    ].filter(Boolean) as string[],
    scripts: {
      dev: parallelRootScript(packageManager, 'dev'),
      'dev:gateway': `cd gateway && ${packageManager} run dev`,
      ...(frontendFramework ? { 'dev:frontend': `cd frontend && ${packageManager} run dev` } : {}),
      ...Object.fromEntries(services.map((s) => [`dev:${s.name}`, `cd services/${s.name} && ${packageManager} run dev`])),
      build: parallelRootScript(packageManager, 'build'),
      'build:gateway': `cd gateway && ${packageManager} run build`,
      ...(frontendFramework ? { 'build:frontend': `cd frontend && ${packageManager} run build` } : {}),
      test: parallelRootScript(packageManager, 'test'),
      lint: 'eslint . --ext .js,.ts,.jsx,.tsx',
      clean: 'rm -rf node_modules **/node_modules **/dist **/build',
    },
    author: config.team || org,
    license: 'MIT',
    devDependencies: {
      'npm-run-all': '^4.1.5',
    },
  };

  await fs.writeJson(path.join(projectPath, 'package.json'), rootPackageJson, { spaces: 2 });

  // Create pnpm workspace file if using pnpm
  if (packageManager === 'pnpm') {
    await fs.writeFile(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      `packages:\n  - 'services/*'\n  - 'gateway'\n  ${frontendFramework ? "- 'frontend'" : ''}\n`
    );
  }

  // Create Docker Compose for all services
  const dockerCompose = generateDockerCompose(config);
  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), dockerCompose);

  // Create shared types package
  const sharedPath = path.join(projectPath, 'shared');
  await fs.ensureDir(sharedPath);
  await generateSharedTypes(sharedPath, config, database);

  // Create API Gateway
  const gatewayPath = path.join(projectPath, 'gateway');
  await fs.ensureDir(gatewayPath);
  await generateApiGateway(gatewayPath, config);

  // Create each service
  for (const service of services) {
    const servicePath = path.join(projectPath, 'services', service.name);
    await fs.ensureDir(servicePath);
    await generateService(servicePath, service, config);
  }

  // Create frontend if specified
  if (frontendFramework) {
    const frontendPath = path.join(projectPath, 'frontend');
    await fs.ensureDir(frontendPath);
    await generateFrontend(frontendPath, frontendFramework, config);
  }

  // Create README
  await generatePolyglotReadme(projectPath, config);
}

/**
 * Generate Docker Compose configuration for a polyglot project.
 *
 * @param config - Polyglot project configuration.
 * @returns Docker Compose YAML as a string.
 */
function generateDockerCompose(config: PolyglotConfig): string {
  const { services, database} = config;

  let compose = `version: '3.8'

services:
`;
  // Add services
  services.forEach((service) => {
    compose += `  ${service.name}:
    build: ./services/${service.name}
    ports:
      - "${service.port}:${service.port}"
    environment:
      - PORT=${service.port}
      - DATABASE_URL=postgresql://user:pass@db:5432/${config.normalizedName}
    depends_on:
      - db
    networks:
      - ${config.normalizedName}-network

`;
  });

  // Add gateway
  compose += `  gateway:
    build: ./gateway
    ports:
      - "8080:8080"
    depends_on:
`;
  services.forEach((s) => {
    compose += `      - ${s.name}\n`;
  });
  compose += `    networks:
      - ${config.normalizedName}-network

`;

  // Add frontend if exists
  if (config.frontendFramework) {
    compose += `  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - gateway
    networks:
      - ${config.normalizedName}-network

`;
  }

  // Add database
  if (database !== 'none') {
    compose += `  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=${config.normalizedName}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - ${config.normalizedName}-network

volumes:
  postgres-data:

`;
  }

  compose += `networks:
  ${config.normalizedName}-network:
    driver: bridge
`;

  return compose;
}

/**
 * Generate a shared types package containing TypeScript interfaces and types.
 *
 * @param sharedPath - Directory where the shared package will be created.
 * @param config - Polyglot project configuration.
 * @param db - Database type identifier.
 */
async function generateSharedTypes(sharedPath: string, config: PolyglotConfig, db: string): Promise<void> {
  const sharedPackageJson = {
    name: `${config.normalizedName}-shared`,
    version: '0.1.0',
    description: 'Shared types and interfaces for polyglot project',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      watch: 'tsc --watch',
    },
    dependencies: {},
    devDependencies: {
      typescript: '^5.0.0',
    },
  };

  await fs.writeJson(path.join(sharedPath, 'package.json'), sharedPackageJson, { spaces: 2 });

  // Generate TypeScript types
  const typesContent = `// Shared types for ${config.name}
// Auto-generated by Re-Shell CLI

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  uptime: number;
}

${config.services.map((s) => `
// ${s.name} types
export interface ${toPascalCase(s.name)}Request {
  // Add request fields
}

export interface ${toPascalCase(s.name)}Response {
  // Add response fields
}
`).join('\n')}
`;

  await fs.outputFile(path.join(sharedPath, 'src/index.ts'), typesContent);

  // Generate tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeJson(path.join(sharedPath, 'tsconfig.json'), tsconfig, { spaces: 2 });
}

/**
 * Generate the API Gateway (Node.js or proxy-based) for the polyglot project.
 *
 * @param gatewayPath - Directory where the gateway will be created.
 * @param config - Polyglot project configuration.
 */
async function generateApiGateway(gatewayPath: string, config: PolyglotConfig): Promise<void> {
  const { gatewayFramework} = config;

  // Generate gateway based on framework
  if (gatewayFramework === 'express' || gatewayFramework === 'fastify' || gatewayFramework === 'nestjs') {
    await generateNodeGateway(gatewayPath, config);
  } else {
    await generateProxyGateway(gatewayPath, config);
  }
}

/**
 * Environment variable that overrides a service's URL in the gateway. Service
 * names are kebab-case, which is not a valid identifier, so non-alphanumerics
 * become underscores (`user-service` -> `USER_SERVICE_SERVICE_URL`).
 *
 * @param serviceName - The kebab-case service name.
 * @returns The environment variable name.
 */
function serviceEnvVar(serviceName: string): string {
  return `${serviceName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_SERVICE_URL`;
}

/**
 * Generate a Node.js API Gateway (Express, Fastify, or NestJS).
 *
 * @param gatewayPath - Directory where the gateway will be created.
 * @param config - Polyglot project configuration.
 */
async function generateNodeGateway(gatewayPath: string, config: PolyglotConfig): Promise<void> {
  const { gatewayFramework, services, normalizedName } = config;

  const gatewayPackageJson = {
    name: `${normalizedName}-gateway`,
    version: '0.1.0',
    description: `API Gateway for ${config.name}`,
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
    },
    dependencies: {
      ...(gatewayFramework === 'express' ? {
        express: '^4.18.0',
        '@types/express': '^4.17.0',
      } : gatewayFramework === 'fastify' ? {
        fastify: '^4.0.0',
        '@fastify/cors': '^8.5.0',
        '@fastify/http-proxy': '^9.5.0',
      } : {
        '@nestjs/common': '^10.0.0',
        '@nestjs/core': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
        '@types/express': '^4.17.0',
        'reflect-metadata': '^0.1.0',
        rxjs: '^7.8.0',
      }),
      'http-proxy-middleware': '^2.0.0',
      cors: '^2.8.5',
      'dotenv': '^16.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      tsx: '^4.0.0',
      '@types/node': '^20.0.0',
      '@types/cors': '^2.8.0',
    },
  };

  await fs.writeJson(path.join(gatewayPath, 'package.json'), gatewayPackageJson, { spaces: 2 });

  // Generate gateway source
  const gatewaySource = gatewayFramework === 'express' ? generateExpressGateway(config) :
    gatewayFramework === 'fastify' ? generateFastifyGateway(config) :
    generateNestJSGateway(config);

  await fs.outputFile(path.join(gatewayPath, 'src/index.ts'), gatewaySource);

  // Generate tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      ...(gatewayFramework === 'nestjs' ? { experimentalDecorators: true, emitDecoratorMetadata: true } : {}),
    },
    include: ['src/**/*'],
  };

  await fs.writeJson(path.join(gatewayPath, 'tsconfig.json'), tsconfig, { spaces: 2 });

  // Generate .env.example
  await fs.writeFile(
    path.join(gatewayPath, '.env.example'),
    `PORT=8080
NODE_ENV=development

# Service URLs
${services.map((s) => `${serviceEnvVar(s.name)}=http://${s.name}:${s.port}`).join('\n')}
`
  );
}

/**
 * Generate Express gateway source code.
 *
 * @param config - Polyglot project configuration.
 * @returns Express gateway TypeScript source code as a string.
 */
function generateExpressGateway(config: PolyglotConfig): string {
  const { services } = config;
  return `import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app: Express = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    gateway: '${config.normalizedName}',
    services: [
${services.map(s => `      { name: '${s.name}', url: process.env.${serviceEnvVar(s.name)} || 'http://${s.name}:${s.port}' },`).join('\n')}
    ],
    timestamp: new Date().toISOString(),
  });
});

// Service routes
${services.map((s) => `
// Proxy to ${s.name}
app.use('/api/${s.name}', createProxyMiddleware({
  target: process.env.${serviceEnvVar(s.name)} || 'http://${s.name}:${s.port}',
  changeOrigin: true,
  pathRewrite: {
    '^/api/${s.name}': '',
  },
}));
`).join('\n')}

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', gateway: '${config.normalizedName}' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(\`🚀 API Gateway running on port \${PORT}\`);
  console.log(\`📊 Health check: http://localhost:\${PORT}/health\`);
});
`;
}

/**
 * Generate Fastify gateway source code.
 *
 * @param config - Polyglot project configuration.
 * @returns Fastify gateway TypeScript source code as a string.
 */
function generateFastifyGateway(config: PolyglotConfig): string {
  const { services } = config;
  return `import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import httpProxy from '@fastify/http-proxy';

const fastify: FastifyInstance = Fastify({
  logger: true,
});

// Health check
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    gateway: '${config.normalizedName}',
    services: [
${services.map(s => `      { name: '${s.name}', url: process.env.${serviceEnvVar(s.name)} || 'http://${s.name}:${s.port}' },`).join('\n')}
    ],
    timestamp: new Date().toISOString(),
  };
});

const start = async () => {
  try {
    await fastify.register(cors, {
      origin: true,
    });

    // Service proxies
${services.map((s) => `
    await fastify.register(httpProxy, {
      upstream: process.env.${serviceEnvVar(s.name)} || 'http://${s.name}:${s.port}',
      prefix: '/api/${s.name}',
      http2: false,
    });
`).join('\n')}

    const PORT = process.env.PORT || 8080;
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(\`🚀 API Gateway running on port \${PORT}\`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
`;
}

/**
 * Generate NestJS gateway source code.
 *
 * @param config - Polyglot project configuration.
 * @returns NestJS gateway TypeScript source code as a string.
 */
function generateNestJSGateway(config: PolyglotConfig): string {
  const { services } = config;
  return `import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { Controller, Get, Module } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

@Controller()
class GatewayController {
  @Get('/health')
  health() {
    return {
      status: 'healthy',
      gateway: '${config.normalizedName}',
      services: [
${services.map(s => `        { name: '${s.name}', url: process.env.${serviceEnvVar(s.name)} || 'http://${s.name}:${s.port}' },`).join('\n')}
      ],
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [GatewayController],
})
class GatewayModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    GatewayModule,
    new ExpressAdapter(),
  );
  app.enableCors();

  // Service proxies
${services.map((s) => `
  app.use('/api/${s.name}', createProxyMiddleware({
    target: process.env.${serviceEnvVar(s.name)} || 'http://${s.name}:${s.port}',
    changeOrigin: true,
    pathRewrite: {
      '^/api/${s.name}': '',
    },
  }));
`).join('')}
  const PORT = process.env.PORT || 8080;
  await app.listen(PORT);
  console.log(\`🚀 API Gateway running on port \${PORT}\`);
}

bootstrap();
`;
}

/**
 * Generate a proxy-based gateway (Traefik or Kong configuration files).
 *
 * @param gatewayPath - Directory where the gateway will be created.
 * @param config - Polyglot project configuration.
 */
async function generateProxyGateway(gatewayPath: string, config: PolyglotConfig): Promise<void> {
  const { gatewayFramework, services} = config;

  if (gatewayFramework === 'traefik') {
    // Generate Traefik configuration
    const traefikConfig = `
# Traefik Configuration for ${config.name}

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false

api:
  dashboard: true
  insecure: true
`;

    await fs.writeFile(path.join(gatewayPath, 'traefik.yml'), traefikConfig);

    // Generate docker-compose snippet for Traefik
    const traefikDocker = `
# Add this to docker-compose.yml
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
    ports:
      - "8080:8080"
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./gateway/traefik.yml:/etc/traefik/traefik.yml
`;

    await fs.writeFile(path.join(gatewayPath, 'docker-compose.yml'), traefikDocker);
  } else if (gatewayFramework === 'kong') {
    // Generate Kong configuration
    const kongConfig = `
# Kong Configuration for ${config.name}

_format_version: "3.0"

services:
${services.map((s) => `
  - name: ${s.name}-service
    url: http://${s.name}:${s.port}
    routes:
      - name: ${s.name}-route
        paths:
          - /api/${s.name}
        strip_path: true
`).join('\n')}
`;

    await fs.writeFile(path.join(gatewayPath, 'kong.yml'), kongConfig);

    const kongDocker = `
# Add this to docker-compose.yml
  kong:
    image: kong/kong-gateway:3.4.0.0
    environment:
      KONG_DATABASE: "off"
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_DECLARATIVE_CONFIG: /kong/declarative/kong.yml
    ports:
      - "8080:8000"
      - "8443:8443"
      - "8001:8001"
    volumes:
      - ./gateway/kong.yml:/kong/declarative/kong.yml
`;

    await fs.writeFile(path.join(gatewayPath, 'docker-compose.yml'), kongDocker);
  }
}

/**
 * Generate a single polyglot microservice.
 *
 * @param servicePath - Directory where the service will be created.
 * @param service - Service metadata (name, framework, language, port).
 * @param config - Polyglot project configuration.
 */
async function generateService(
  servicePath: string,
  service: PolyglotService,
  config: PolyglotConfig
): Promise<void> {
  const template = getBackendTemplate(service.framework);
  if (!template) {
    console.warn(`Template not found for ${service.framework}, skipping...`);
    return;
  }

  const serviceContext: BackendTemplateContext = {
    name: service.name,
    normalizedName: service.name,
    port: service.port,
    db: config.database,
    org: config.org,
    team: config.team,
    description: `${service.name} - ${service.language} microservice`,
  };

  const files = await createBackendTemplate(template, serviceContext);

  // Write service files
  for (const file of files) {
    const filePath = path.join(servicePath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);

    if (file.executable) {
      await fs.chmod(filePath, '755');
    }
  }

  // Add service-specific Dockerfile if not present
  if (!files.some((f) => f.path === 'Dockerfile')) {
    const dockerfile = generateServiceDockerfile(service, config);
    await fs.writeFile(path.join(servicePath, 'Dockerfile'), dockerfile);
  }
}

/**
 * Generate a Dockerfile for a polyglot service based on its language.
 *
 * @param service - Service metadata (name, language, port).
 * @param config - Polyglot project configuration.
 * @returns Dockerfile content as a string.
 */
function generateServiceDockerfile(service: PolyglotService, config: PolyglotConfig): string {
  const { language } = service;

  // Return language-appropriate Dockerfile
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      return `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE ${service.port}

CMD ["npm", "start"]
`;

    case 'python':
      return `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${service.port}

CMD ["python", "-m", "${service.name}"]
`;

    case 'go':
      return `FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE ${service.port}

CMD ["./main"]
`;

    case 'rust':
      return `FROM rust:1.75-alpine AS builder

WORKDIR /app
COPY Cargo.* ./
RUN cargo fetch
COPY . .
RUN cargo build --release

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app

COPY --from=builder /app/target/release/${service.name} .

EXPOSE ${service.port}

CMD ["./${service.name}"]
`;

    default:
      return `# Dockerfile for ${service.name}
# Add your ${language} Docker configuration here
`;
  }
}

/**
 * Generate a frontend application for a polyglot project.
 *
 * @param frontendPath - Directory where the frontend will be created.
 * @param frontendFramework - Framework identifier for the frontend.
 * @param config - Polyglot project configuration.
 */
async function generateFrontend(
  frontendPath: string,
  frontendFramework: string,
  config: PolyglotConfig
): Promise<void> {
  const frameworkConfig = getFrameworkConfig(frontendFramework);
  if (!frameworkConfig) {
    console.warn(`Framework config not found for ${frontendFramework}`);
    return;
  }

  const templateContext: TemplateContext = {
    name: `${config.name}-frontend`,
    normalizedName: `${config.normalizedName}-frontend`,
    framework: frontendFramework,
    hasTypeScript: frameworkConfig.hasTypeScript || false,
    port: '3000',
    route: '/',
    org: config.org,
    team: config.team,
    description: `${config.name} Frontend`,
    packageManager: config.packageManager,
  };

  const template = createTemplate(frameworkConfig, templateContext);
  const files = await template.generateFiles();

  for (const file of files) {
    const filePath = path.join(frontendPath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
  }

  // Generate API client for services
  await generateApiClient(frontendPath, config, frontendFramework);
}

/**
 * Generate an API client for communicating with polyglot services through the gateway.
 *
 * @param frontendPath - Directory where the frontend is located.
 * @param config - Polyglot project configuration.
 * @param frontendFramework - Framework identifier for the frontend.
 */
async function generateApiClient(
  frontendPath: string,
  config: PolyglotConfig,
  frontendFramework: string
): Promise<void> {
  const servicesDir = path.join(frontendPath, 'src', 'services');
  await fs.ensureDir(servicesDir);

  const apiClientContent = `// API Client for ${config.name}
// Auto-generated by Re-Shell CLI

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = GATEWAY_URL) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<ServiceResponse<T>> {
    try {
      const response = await fetch(\`\${this.baseUrl}\${path}\`);
      const data = await response.json();
      return { success: response.ok, data, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: String(error), timestamp: new Date().toISOString() };
    }
  }

  async post<T>(path: string, body: unknown): Promise<ServiceResponse<T>> {
    try {
      const response = await fetch(\`\${this.baseUrl}\${path}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return { success: response.ok, data, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: String(error), timestamp: new Date().toISOString() };
    }
  }
}

export const apiClient = new ApiClient();

${config.services.map((s) => `
// ${s.name} API
export const ${camelCase(s.name)}Api = {
  getAll: () => apiClient.get<any>(\`/api/${s.name}\`),
  getById: (id: string) => apiClient.get<any>(\`/api/${s.name}/\${id}\`),
  create: (data: unknown) => apiClient.post<any>(\`/api/${s.name}\`, data),
  update: (id: string, data: unknown) => apiClient.post<any>(\`/api/${s.name}/\${id}\`, data),
  delete: (id: string) => apiClient.post<any>(\`/api/${s.name}/\${id}/delete\`, {}),
};
`).join('\n')}
`;

  await fs.writeFile(path.join(servicesDir, 'api.ts'), apiClientContent);
}

/**
 * Generate the README.md for a polyglot microservices project.
 *
 * @param projectPath - Root directory of the project.
 * @param config - Polyglot project configuration.
 */
async function generatePolyglotReadme(projectPath: string, config: PolyglotConfig): Promise<void> {
  const { services, gatewayFramework, frontendFramework, database} = config;

  const readmeContent = `# ${config.name}

A polyglot microservices project created with [Re-Shell CLI](${REPO_URL}).

## Overview

This project consists of ${services.length} microservices built with different programming languages:

| Service | Language | Framework | Port |
|---------|----------|-----------|------|
${services.map((s) => `| ${s.name} | ${s.language} | ${s.framework} | ${s.port} |`).join('\n')}

**Infrastructure:**
- **API Gateway:** ${gatewayFramework} (Port 8080)
${frontendFramework ? `- **Frontend:** ${frontendFramework} (Port 3000)` : ''}
- **Database:** ${database}

## Architecture

\`\`\`
┌─────────────┐
│  Frontend   │ (Port 3000)
└──────┬──────┘
       │
┌──────▼──────────┐
│  API Gateway    │ (Port 8080)
│  (${gatewayFramework})  │
└──────┬──────────┘
       │
${services.map((s) => `┌──────▼──────┐
│ ${s.name.padEnd(10)} │ (Port ${s.port})
│ (${s.language.padEnd(10)})│
└─────────────┘`).join('\n       │\n')}
       │
┌──────▼──────┐
│  Database   │
│ (${database})   │
└─────────────┘
\`\`\`

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for gateway/frontend)
- ${[...new Set(services.map((s) => s.language))].join(', ')} for respective services

### Installation

\`\`\`bash
# Install dependencies
${config.packageManager} install

# Start all services
${config.packageManager} run dev
\`\`\`

### Docker Deployment

\`\`\`bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
\`\`\`

## Service Endpoints

### API Gateway (Port 8080)

- **Health Check:** \`GET /health\`
- **API Routes:** \`/api/{service-name}/*\`

### Services

${services.map((s) => `
**${s.name}** (Port ${s.port})
- Base URL: \`http://localhost:${s.port}\`
- Gateway URL: \`http://localhost:8080/api/${s.name}\`
`).join('\n')}

## Development

### Adding a New Service

\`\`\`bash
# Use Re-Shell CLI to add a new service
re-shell create my-service --backend <framework> --type app
\`\`\`

### Database Migrations

\`\`\`bash
# Run migrations
${config.packageManager} run db:migrate

# Seed database
${config.packageManager} run db:seed
\`\`\`

## Testing

\`\`\`bash
# Run all tests
${config.packageManager} test

# Run tests for specific service
cd services/${services[0].name}
${config.packageManager} test
\`\`\`

## License

MIT

---

Generated with ❤️ by [Re-Shell CLI](${REPO_URL})
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
}

/**
 * Utility functions
 */
/**
 * Convert a kebab-case or snake_case string to PascalCase.
 *
 * @param str - The input string in kebab-case or snake_case.
 * @returns The PascalCase version of the string.
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert a kebab-case or snake_case string to camelCase.
 *
 * @param str - The input string in kebab-case or snake_case.
 * @returns The camelCase version of the string.
 */
function camelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Get the primary programming language from frontend/backend selection.
 *
 * @param backend - Backend framework identifier, if specified.
 * @param frontend - Frontend framework identifier, if specified.
 * @returns The primary programming language, or null if it cannot be determined.
 */
function getPrimaryLanguage(backend?: string, frontend?: string): string | null {
  if (backend) {
    const template = getBackendTemplate(backend);
    if (template) {
      return template.language;
    }
  }

  if (frontend) {
    if (frontend.includes('react') || frontend.includes('next') || frontend.includes('vue') || frontend.includes('svelte')) {
      return 'TypeScript';
    }
    if (frontend.includes('angular')) {
      return 'TypeScript';
    }
  }

  return null;
}

/** One workspace to register in `re-shell.workspaces.yaml`. */
interface WorkspaceRegistration {
  name: string;
  type: 'frontend' | 'backend' | 'worker';
  framework?: string;
  port?: string;
  /** Path of the workspace relative to the monorepo root. */
  relPath: string;
}

/**
 * Register newly created workspaces in `re-shell.workspaces.yaml` when the
 * monorepo has one. Quiet: returns the lines to print instead of printing, so a
 * dry run can call it against a scratch copy.
 *
 * @param monorepoRoot - Directory holding `re-shell.workspaces.yaml`.
 * @param entries - The workspaces to register.
 * @returns Whether the file changed, plus the informational lines to print.
 */
export async function autoRegisterInWorkspace(
  monorepoRoot: string,
  entries: WorkspaceRegistration[]
): Promise<{ changed: boolean; messages: string[] }> {
  const workspaceYamlPath = path.join(monorepoRoot, 're-shell.workspaces.yaml');

  // Check if workspace YAML exists
  if (!(await fs.pathExists(workspaceYamlPath))) {
    return {
      changed: false,
      messages: [
        'No workspace configuration found - skipping auto-registration',
        'Tip: Run "re-shell workspace init" to create a workspace configuration',
      ],
    };
  }

  try {
    const workspaceContent = await fs.readFile(workspaceYamlPath, 'utf8');
    const workspaceConfig = (yaml.load(workspaceContent) ?? {}) as Record<string, unknown>;

    // Initialize services if not present
    if (!workspaceConfig.services) {
      workspaceConfig.services = {};
    }
    const services = workspaceConfig.services as Record<string, unknown>;

    for (const entry of entries) {
      services[entry.name] = {
        name: entry.name,
        displayName: toDisplayName(entry.name),
        type: entry.type,
        language: detectLanguage(entry.framework),
        // `framework` is required by the v2 workspace schema.
        framework: entry.framework || 'vanilla',
        port: parseInt(entry.port ?? '') || undefined,
        path: toPosix(entry.relPath),
      };
    }

    // Write back to YAML
    const newYaml = yaml.dump(workspaceConfig, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
      noRefs: true,
      skipInvalid: true, // drop `undefined` fields (e.g. no port) instead of throwing
    });

    // js-yaml drops comments; keep the schema modeline so IDE autocomplete survives.
    await fs.writeFile(workspaceYamlPath, preserveSchemaModeline(workspaceContent, newYaml), 'utf8');

    return {
      changed: true,
      messages: [
        'Auto-registered in workspace configuration',
        ...entries.map((entry) => `  Service: ${entry.name}`),
        '  Config: re-shell.workspaces.yaml',
      ],
    };
  } catch (error: unknown) {
    return {
      changed: false,
      messages: [
        'Failed to auto-register in workspace: ' + (error as Error).message,
        'You can manually add the service to re-shell.workspaces.yaml',
      ],
    };
  }
}

/**
 * Convert a kebab-case name to a human-readable display name.
 *
 * @param name - The kebab-case name to convert.
 * @returns The display name with each word capitalized and space-separated.
 */
function toDisplayName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect the programming language from a framework identifier.
 *
 * @param framework - Framework identifier (e.g. 'react', 'fastapi', 'gin').
 * @returns The detected language name (lowercase), defaulting to 'javascript'.
 */
function detectLanguage(framework?: string): string {
  if (!framework) return 'javascript';

  const lowerFramework = framework.toLowerCase();
  const typeScriptFrameworks = [
    'react-ts', 'react', 'next', 'nuxt', 'vue-ts', 'vue',
    'nestjs', 'angular', 'svelte', 'solid',
    'express', 'fastify', 'koa',
  ];

  const pythonFrameworks = ['fastapi', 'django', 'flask', 'tornado', 'sanic'];
  const goFrameworks = ['gin', 'fiber', 'echo', 'buffalo'];
  const rustFrameworks = ['actix', 'rocket', 'axum'];

  if (typeScriptFrameworks.some(f => lowerFramework.includes(f))) {
    return 'typescript';
  }
  if (pythonFrameworks.some(f => lowerFramework.includes(f))) {
    return 'python';
  }
  if (goFrameworks.some(f => lowerFramework.includes(f))) {
    return 'go';
  }
  if (rustFrameworks.some(f => lowerFramework.includes(f))) {
    return 'rust';
  }

  return 'javascript';
}

/**
 * Decide whether to continue past a risky-but-overridable condition (framework
 * mismatch, dependency conflict, failed validation). Interactive runs ask
 * (default: no); `--force` continues; a dry run records a note and continues so
 * the preview is still produced; any other non-interactive run fails explicitly
 * instead of waiting on a prompt that can never be answered.
 *
 * @returns `true` to continue, `false` when the user declined.
 */
async function confirmRisky(
  ctx: { interactive: boolean; force: boolean; dryRun: boolean; notes: string[] },
  problem: string,
  promptMessage: string
): Promise<boolean> {
  if (ctx.force) return true;
  if (ctx.interactive) {
    const { proceed } = await ask({
      type: 'confirm',
      name: 'proceed',
      message: promptMessage,
      initial: false,
    });
    return Boolean(proceed);
  }
  if (ctx.dryRun) {
    ctx.notes.push(`${problem} A real run would stop here unless --force is passed.`);
    return true;
  }
  throw new CreateError(
    'CREATE_INPUT_REQUIRED',
    `${problem} Re-run with --force to proceed anyway, or choose a compatible stack.`,
    { problem }
  );
}

/**
 * Plan a new workspace (app/package/lib/tool) inside an existing monorepo.
 *
 * Interactive runs ask for anything not given as a flag; non-interactive and
 * dry runs use the documented defaults (react-ts frontend, express backend,
 * route `/<name>`, port 5173) and fail explicitly on a condition that needs a
 * human decision. A fullstack workspace puts the frontend under `<type>/<name>`
 * and the API under `services/<name>-api`; both are covered by the workspace
 * globs. The new workspaces are auto-registered in `re-shell.workspaces.yaml`.
 *
 * @param name - Name of the workspace to create.
 * @param options - Additional options for workspace creation.
 * @param monorepoRoot - Detected monorepo root path, if inside a monorepo.
 * @param request - The validated create request.
 * @param interactive - Whether to prompt for missing choices.
 * @param dryRun - Whether this plan is only being previewed.
 * @returns The plan, or `null` when the user cancelled.
 */
async function buildWorkspacePlan(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot: string | null | undefined,
  request: ResolvedCreateRequest,
  interactive: boolean,
  dryRun: boolean
): Promise<ScaffoldPlan | null> {
  const {
    team,
    org = 're-shell',
    description,
    packageManager = 'pnpm',
    type = 'app',
    route,
    spinner,
  } = options;
  const port = frontendPort(options);
  const notes = [...request.notes];

  // Handle architecture template - extract predefined stack
  let architectureTemplate = request.architectureTemplate;
  if (architectureTemplate && !dryRun) {
    console.log(chalk.blue(`Using architecture template: ${architectureTemplate.displayName}`));
    console.log(chalk.gray(architectureTemplate.description));
  }

  const backend = request.backend;
  const frontend = request.frontend;

  // Determine if we're creating backend, frontend, or fullstack
  const isBackendOnly = request.mode === 'backend';
  const isFullStack = request.mode === 'fullstack';
  const isFrontendOnly = !backend;

  const normalizedName = normalizeProjectName(name);
  const rootPath = monorepoRoot || process.cwd();

  if (!dryRun) console.log(chalk.cyan(`Creating ${type} "${normalizedName}"...`));

  // Stop spinner for interactive prompts
  if (spinner) {
    spinner.stop();
  }

  // Interactive wizard: ask for the choices that were not given as flags.
  const responses: Record<string, string> = {};
  if (interactive) {
    // Build prompts for missing options
    const promptsConfig: prompts.PromptObject<string>[] = [];

    // Architecture template prompt (if no specific stack is specified)
    if (!options.template && !backend && !frontend) {
      promptsConfig.push({
        type: 'select' as const,
        name: 'useTemplate',
        message: 'Would you like to use a predefined architecture template?',
        choices: [
          { title: 'Yes, show me popular stacks', value: 'yes' },
          { title: 'No, I will choose manually', value: 'no' },
          { title: 'Show me all templates', value: 'all' },
        ],
        initial: 0,
      });
    }

    // Backend prompt (if needed)
    if ((isBackendOnly || isFullStack) && !backend) {
      promptsConfig.push({
        type: 'select' as const,
        name: 'backendMode',
        message: 'How would you like to select your backend framework?',
        choices: [
          { title: '🔥 Popular Frameworks (Express, FastAPI, Django, etc.)', value: 'popular' },
          { title: '📚 Browse by Programming Language', value: 'language' },
          { title: '🔍 Search All 300+ Frameworks', value: 'all' },
        ],
        initial: 0,
      });
    }

    // Frontend prompt (if needed)
    if ((isFrontendOnly || isFullStack) && !frontend) {
      promptsConfig.push({
        type: 'select' as const,
        name: 'framework',
        message: 'Select a frontend framework:',
        choices: getFrameworkChoices().filter((choice) => hasFrontendTemplate(choice.value)),
        initial: 1, // Default to react-ts
      });
    }

    // Route prompt (for frontend apps)
    if ((isFrontendOnly || isFullStack) && type === 'app' && !route) {
      promptsConfig.push({
        type: 'text' as const,
        name: 'route',
        message: 'Route path:',
        initial: `/${normalizedName}`,
        validate: (value: string) => (value.startsWith('/') ? true : 'Route must start with /'),
      });
    }

    Object.assign(responses, await ask(promptsConfig));

    // Handle architecture template selection
    if (responses.useTemplate && responses.useTemplate !== 'no') {
      const templateChoices =
        responses.useTemplate === 'yes' ? getPopularArchitectureTemplates() : getAllArchitectureTemplates();

      const { selectedTemplate } = await ask({
        type: 'select',
        name: 'selectedTemplate',
        message: 'Select an architecture template:',
        choices: templateChoices.map((t) => ({
          title: `${t.displayName}`,
          value: t.id,
          description: t.description,
        })),
        initial: 0,
      });

      architectureTemplate = getArchitectureTemplate(selectedTemplate);
      if (architectureTemplate) {
        console.log(chalk.blue(`\n✓ Selected: ${architectureTemplate.displayName}`));
        console.log(chalk.gray(`  Backend: ${architectureTemplate.backend || 'none'}`));
        console.log(chalk.gray(`  Frontend: ${architectureTemplate.frontend || 'none'}`));
        console.log(chalk.gray(`  Database: ${architectureTemplate.db || 'none'}`));
        console.log('');
      }
    }

    // Handle multi-step backend selection
    if (!backend && responses.backendMode) {
      if (responses.backendMode === 'popular') {
        // Show popular frameworks
        const popularChoices = getPopularBackendFrameworks();
        const { backend: chosen } = await ask({
          type: 'select',
          name: 'backend',
          message: 'Select a popular backend framework:',
          choices: popularChoices,
          initial: 0,
        });
        responses.selectedBackend = chosen;
      } else if (responses.backendMode === 'language') {
        // First, select language
        const { language } = await ask({
          type: 'select',
          name: 'language',
          message: 'Select a programming language:',
          choices: getBackendLanguageChoices(),
          initial: 0,
        });
        // Then, select framework within that language
        const frameworkChoices = getFrameworkChoicesForLanguage(language);
        const { backend: chosen } = await ask({
          type: 'select',
          name: 'backend',
          message: `Select ${language} framework:`,
          choices: frameworkChoices,
          initial: 0,
        });
        responses.selectedBackend = chosen;
      } else {
        // Show all frameworks
        const allChoices = listBackendTemplates().map((t) => ({
          title: `${t.displayName} (${t.language})`,
          value: t.id,
        }));
        const { backend: chosen } = await ask({
          type: 'autocomplete',
          name: 'backend',
          message: 'Search and select a backend framework (type to filter):',
          choices: allChoices,
          initial: 0,
          suggest: async (input: string, choices: { title: string; [key: string]: unknown }[]) => {
            return Promise.resolve(
              choices.filter((c) => c.title.toLowerCase().includes(input.toLowerCase()))
            );
          },
        });
        responses.selectedBackend = chosen;
      }
    }
  }

  // Merge responses with options
  // Use architecture template values if available
  const resolvedTemplateBackend = architectureTemplate?.backend;
  const resolvedTemplateFrontend = architectureTemplate?.frontend;
  const resolvedTemplateDb = architectureTemplate?.db;

  const finalBackend = backend || responses.selectedBackend || resolvedTemplateBackend;
  const finalFrontend = frontend || responses.framework || resolvedTemplateFrontend;
  const finalDb: DatabaseType = ((request.db && request.db !== 'none' ? request.db : undefined) ||
    resolvedTemplateDb ||
    'none') as DatabaseType;
  const finalPort = port;
  const finalRoute = route || responses.route || `/${normalizedName}`;

  // The wizard (or an architecture template picked in it) can still introduce
  // names no registry has: fail loudly rather than scaffold something else.
  if (finalBackend) assertBackend(finalBackend);
  if (finalFrontend) assertFrontend(finalFrontend);

  const fullStack = isFullStack || Boolean(architectureTemplate) || Boolean(finalBackend && finalFrontend && !isBackendOnly);
  const backendOnly = !fullStack && Boolean(finalBackend) && !finalFrontend;
  const mode: CreateMode = fullStack ? 'fullstack' : backendOnly ? 'backend' : 'frontend';
  const confirmCtx = { interactive, force: options.force === true, dryRun, notes };

  // Validate compatibility for fullstack projects
  if (finalFrontend && finalBackend && fullStack) {
    const compatibility = validateFrameworkCompatibility(finalFrontend, finalBackend);
    const summary = getCompatibilitySummary(finalFrontend, finalBackend);

    if (!dryRun) {
      console.log(chalk[summary.color](`\n${'━'.repeat(50)}`));
      console.log(`${chalk.bold('Framework Compatibility:')}: ${summary.icon} ${summary.text}`);
      console.log(chalk[summary.color](`${'━'.repeat(50)}\n`));

      if (compatibility.warnings.length > 0) {
        console.log(chalk.yellow('Warnings:'));
        compatibility.warnings.forEach((w) => console.log(chalk.yellow(`  • ${w}`)));
        console.log('');
      }

      if (compatibility.suggestions.length > 0) {
        console.log(chalk.cyan('Suggestions:'));
        compatibility.suggestions.forEach((s) => console.log(chalk.cyan(`  • ${s}`)));
        console.log('');
      }
    }

    // If incompatible, ask user to confirm
    if (!compatibility.valid) {
      const proceed = await confirmRisky(
        confirmCtx,
        `The framework combination ${finalFrontend} + ${finalBackend} is not recommended.`,
        'This framework combination is not recommended. Continue anyway?'
      );
      if (!proceed) {
        console.log(chalk.yellow('\nOperation cancelled. Please select compatible frameworks.\n'));
        return null;
      }
    }
  }

  // Check for dependency conflicts
  const depCheckResult = checkDependencyConflicts({
    frontend: finalFrontend,
    backend: finalBackend,
    db: finalDb,
  });

  if (depCheckResult.hasConflicts || depCheckResult.warnings.length > 0) {
    if (!dryRun) console.log(formatDependencyReport(depCheckResult));

    // If there are critical conflicts, ask for confirmation
    if (depCheckResult.hasConflicts) {
      const proceed = await confirmRisky(
        confirmCtx,
        'Dependency conflicts detected.',
        'Dependency conflicts detected. Continue anyway?'
      );
      if (!proceed) {
        console.log(chalk.yellow('\nOperation cancelled. Please resolve conflicts and try again.\n'));
        return null;
      }
    }
  }

  // Validate project configuration
  const projectConfig: ProjectConfig = {
    name: normalizedName,
    type,
    frontend: finalFrontend,
    backend: finalBackend,
    database: finalDb,
    packageManager,
    port: finalPort,
    hasDocker: false, // Will be determined later
    hasCI: false, // Will be determined later
  };

  const validationResult = validateProjectConfig(projectConfig);

  if (validationResult.errors.length > 0) {
    if (!dryRun) console.log(formatValidationResult(validationResult));

    // If there are critical errors, ask for confirmation
    if (!validationResult.isValid) {
      const proceed = await confirmRisky(
        confirmCtx,
        'Configuration validation failed.',
        'Configuration validation failed. Continue anyway?'
      );
      if (!proceed) {
        console.log(chalk.yellow('\nOperation cancelled. Please fix the configuration errors and try again.\n'));
        return null;
      }
    }
  } else if (validationResult.suggestions.length > 0 && !dryRun) {
    // Show suggestions even if validation passes
    console.log(formatValidationResult(validationResult));
  }

  // Determine workspace paths based on type. A fullstack workspace splits into
  // the frontend (<type>/<name>) and its API (services/<name>-api).
  const typeDir =
    type === 'app' ? 'apps' : type === 'package' ? 'packages' : type === 'lib' ? 'libs' : 'tools';
  const primaryRel = posixJoin(typeDir, normalizedName);
  const apiRel = fullStack ? posixJoin('services', `${normalizedName}-api`) : primaryRel;
  const workspacePath = path.join(rootPath, typeDir, normalizedName);
  const targetDirs = fullStack ? [workspacePath, path.join(rootPath, 'services', `${normalizedName}-api`)] : [workspacePath];

  // Validate the backend up front (before anything is written).
  const backendTemplate = finalBackend ? getBackendTemplate(finalBackend) : undefined;
  if (finalBackend && !backendTemplate) {
    throw templateNotFound('backend template', finalBackend, backendIds());
  }

  const backendPort = backendOnly
    ? options.port ?? backendTemplate?.port?.toString() ?? '3000'
    : backendTemplate?.port?.toString() ?? '3000';
  const bestPracticeNotes: string[] = [];
  let registryMessages: string[] = [];

  const summary = [
    `Name: ${normalizedName}`,
    ...(finalFrontend ? [`Frontend: ${finalFrontend}`] : []),
    ...(finalBackend ? [`Backend: ${finalBackend}`] : []),
    ...(finalFrontend ? [`Route: ${finalRoute}`] : []),
    `Port: ${backendOnly ? backendPort : finalPort}`,
  ];

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const relativeWorkspace = path.relative(process.cwd(), workspacePath);
  const nextSteps = fullStack
    ? [
        `${packageManager} install  (from the workspace root)`,
        `${packageManager} run dev  (starts ${primaryRel} and ${apiRel})`,
      ]
    : [`cd ${relativeWorkspace}`, `${packageManager} install`, `${packageManager} run dev`];
  if (finalDb && finalDb !== 'none') {
    nextSteps.push(`Configure your ${finalDb} database connection in .env`);
    nextSteps.push(`Run ${packageManager} run db:migrate (or db:push for Prisma)`);
  }

  return {
    mode,
    name,
    root: rootPath,
    targetDirs,
    projectPath: workspacePath,
    frontend: finalFrontend && !backendOnly ? finalFrontend : undefined,
    backend: finalBackend,
    summary,
    skeleton: false,
    notes,
    seedFiles: ['re-shell.workspaces.yaml'],
    nextSteps,
    confirmOverwrite: interactive
      ? async (existing: string[]) => {
          const { action } = await ask({
            type: 'select',
            name: 'action',
            message: `Directory "${normalizedName}" already exists in ${typeDir}/. What would you like to do?`,
            choices: [
              { title: 'Overwrite existing directory', value: 'overwrite' },
              { title: 'Cancel', value: 'cancel' },
            ],
            initial: 0,
          });
          return action === 'cancel' ? 'cancel' : 'overwrite';
        }
      : undefined,
    async write(outRoot: string): Promise<string[]> {
      const sink = new ScaffoldSink(outRoot);
      const registrations: WorkspaceRegistration[] = [];

      // Frontend files (if applicable)
      if (finalFrontend && !backendOnly) {
        const frameworkConfig = getFrameworkConfig(finalFrontend);
        const templateContext: TemplateContext = {
          name,
          normalizedName,
          framework: finalFrontend,
          hasTypeScript: frameworkConfig.hasTypeScript || false,
          port: finalPort,
          route: type === 'app' ? finalRoute : undefined,
          org,
          team,
          description: description || `${name} - A ${frameworkConfig.displayName} ${type}`,
          packageManager,
        };
        const frontendFiles = await createTemplate(frameworkConfig, templateContext).generateFiles();
        if (fullStack && backendTemplate) injectApiProxy(frontendFiles, backendPort);
        for (const file of frontendFiles) {
          sink.write(posixJoin(primaryRel, file.path), file.content, file.executable);
        }
        registrations.push({
          name: normalizedName,
          type: 'frontend',
          framework: finalFrontend,
          port: finalPort,
          relPath: primaryRel,
        });
      }

      // Backend files (if applicable)
      if (backendTemplate && (backendOnly || fullStack)) {
        const backendName = fullStack ? `${normalizedName}-api` : normalizedName;
        const backendContext: BackendTemplateContext = {
          name: backendName,
          normalizedName: backendName,
          port: backendPort,
          db: finalDb,
          org,
          team,
          description: description || `${name} - A ${backendTemplate.displayName} backend`,
        };
        const backendFiles = await createBackendTemplate(backendTemplate, backendContext);
        for (const file of backendFiles) {
          sink.write(posixJoin(apiRel, file.path), file.content, file.executable);
        }
        registrations.push({
          name: backendName,
          type: 'backend',
          framework: finalBackend,
          port: backendPort,
          relPath: apiRel,
        });
      }

      // Apply best practices based on the primary language of each workspace
      const bestPracticeTargets: Array<{ rel: string; language: string | null }> = [];
      if (finalFrontend && !backendOnly) {
        bestPracticeTargets.push({ rel: primaryRel, language: getPrimaryLanguage(undefined, finalFrontend) });
      }
      if (backendTemplate && (backendOnly || fullStack)) {
        bestPracticeTargets.push({ rel: apiRel, language: getPrimaryLanguage(finalBackend) });
      }
      for (const target of bestPracticeTargets) {
        if (!target.language) continue;
        const bestPractices = getBestPracticesForLanguage(target.language);
        if (bestPractices.files.length > 0 || bestPractices.folders.length > 0) {
          await applyBestPractices(path.join(outRoot, target.rel), target.language);
          for (const file of bestPractices.files) {
            sink.written.push(posixJoin(target.rel, file.path));
          }
          bestPracticeNotes.push(bestPractices.description);
        }
      }

      // Auto-register in workspace YAML if in a monorepo
      if (monorepoRoot) {
        const registration = await autoRegisterInWorkspace(outRoot, registrations);
        registryMessages = registration.messages;
        if (registration.changed) sink.written.push('re-shell.workspaces.yaml');
      }

      return [...new Set(sink.written)].sort();
    },
    async afterWrite(): Promise<void> {
      for (const description of bestPracticeNotes) {
        console.log(chalk.gray(`✓ Applied ${description}`));
      }

      // Perform project health check
      const healthCheckResult = await performProjectHealthCheck(workspacePath, projectConfig);

      for (const message of registryMessages) {
        console.log(chalk.gray(`\n${message}`));
      }

      const projectType = backendOnly ? 'backend' : fullStack ? 'full-stack' : 'frontend';
      console.log(chalk.green(`\n✓ ${typeLabel} "${normalizedName}" (${projectType}) created successfully!`));
      console.log(chalk.gray(`Path: ${relativeWorkspace}`));
      if (fullStack) console.log(chalk.gray(`API:  ${path.relative(process.cwd(), targetDirs[1])}`));
      printNextSteps({ notes, nextSteps: this.nextSteps });

      // Show health check summary
      if (healthCheckResult.overallStatus === 'unhealthy') {
        console.log(chalk.yellow('\n⚠️  Project Health Check: Some issues detected'));
        console.log(formatHealthCheckReport(healthCheckResult));
      } else if (healthCheckResult.overallStatus === 'warning') {
        console.log(chalk.yellow('\n⚠️  Project Health Check: Minor issues detected'));
        console.log(formatHealthCheckReport(healthCheckResult));
      } else {
        console.log(chalk.green('\n✅ Project Health Check: All checks passed'));
      }
    },
  };
}

/** One app a new top-level project contains. */
interface MonorepoApp {
  /** Directory under `apps/`. */
  dir: string;
  kind: 'frontend' | 'backend';
  label: string;
  url: string;
}

/** README for a new top-level project; describes exactly the apps that were generated. */
function monorepoReadme(
  normalizedName: string,
  packageManager: string,
  apps: MonorepoApp[]
): string {
  const skeleton = apps.length === 0;
  const tree = [
    `${normalizedName}/`,
    '├── apps/                 # Applications',
    ...apps.map((app) => `│   └── ${app.dir}/${' '.repeat(Math.max(1, 18 - app.dir.length))}# ${app.label}`),
    '├── packages/             # Shared libraries',
    '└── docs/                 # Documentation',
  ].join('\n');

  const gettingStarted = skeleton
    ? `## Getting Started

This workspace is an empty skeleton: it has no apps yet, so there is nothing to
install, run or build until you add one.

\`\`\`bash
# Add a frontend app
re-shell create my-app --frontend react-ts

# Add a backend service
re-shell generate backend my-service

# Then install and run everything
${packageManager} install
${packageManager} run dev
\`\`\`
`
    : `## Getting Started

### Installation
\`\`\`bash
${packageManager} install
\`\`\`

### Development
\`\`\`bash
# Start every app in development mode
${packageManager} run dev
\`\`\`
${apps.map((app) => `\n- ${app.label}: ${app.url}`).join('')}

### Building
\`\`\`bash
${packageManager} run build
\`\`\`
`;

  return `# ${normalizedName}

## Overview
${
  skeleton
    ? 'An empty Re-Shell workspace skeleton (no apps yet).'
    : `A Re-Shell workspace containing ${apps.map((app) => app.label).join(' and ')}.`
}

## Project Structure
\`\`\`
${tree}
\`\`\`

${gettingStarted}
## Adding More
\`\`\`bash
re-shell create <name> --frontend react-ts   # another frontend app
re-shell generate backend <name>             # a backend service (services/<name>)
re-shell add <name>                          # a microfrontend
\`\`\`

## Documentation
For more information, see the [Re-Shell documentation](${DOCS_URL})
`;
}

/**
 * Plan a new top-level Re-Shell project: a workspace root (package.json,
 * workspace globs, README) plus the app(s) the request asks for. The default and
 * `--frontend` modes scaffold a runnable frontend at `apps/<name>` from the
 * frontend template system; `--backend` scaffolds just the API; `--fullstack`
 * (or both) scaffolds the API and a frontend; `--template blank` scaffolds the
 * bare workspace and says so.
 *
 * @param name - Name of the monorepo project to create.
 * @param options - Additional options for project creation.
 * @param request - The validated create request.
 * @param interactive - Whether to prompt for a missing package manager.
 * @returns The plan, or `null` when the user cancelled.
 */
async function buildMonorepoPlan(
  name: string,
  options: CreateProjectOptions,
  request: ResolvedCreateRequest,
  interactive: boolean
): Promise<ScaffoldPlan | null> {
  const {
    team,
    org = 're-shell',
    description = `${name} - A Re-Shell microfrontend project`,
    spinner,
  } = options;

  // Normalize name to kebab-case for consistency
  const normalizedName = normalizeProjectName(name);

  if (!options.dryRun) console.log(chalk.cyan(`Creating Re-Shell project "${normalizedName}"...`));

  // Stop spinner for interactive prompts
  if (spinner) {
    spinner.stop();
  }

  // With a human present and no stack chosen, ask which template (its default,
  // react-ts, is what a non-interactive run uses).
  let mode: CreateMode = request.mode;
  let chosenFrontend = request.frontend;
  if (interactive && request.mode === 'frontend' && !request.frontend) {
    const answer = await ask({
      type: 'select',
      name: 'template',
      message: 'Select a template:',
      choices: [
        { title: 'React', value: 'react' },
        { title: 'React with TypeScript', value: 'react-ts' },
        { title: 'Blank (empty workspace, no app)', value: 'blank' },
      ],
      initial: 1, // Default to react-ts
    });
    if (answer.template === 'blank') mode = 'skeleton';
    else chosenFrontend = assertFrontend(answer.template);
  }

  // The package manager is the only choice that can still be unset here (the
  // CLI defaults it to pnpm). Ask when a human is present, otherwise default.
  let packageManager = options.packageManager;
  if (!packageManager) {
    if (interactive) {
      const answer = await ask({
        type: 'select',
        name: 'packageManager',
        message: 'Select a package manager:',
        choices: [
          { title: 'npm', value: 'npm' },
          { title: 'yarn', value: 'yarn' },
          { title: 'pnpm', value: 'pnpm' },
        ],
        initial: 2, // Default to pnpm
      });
      packageManager = answer.packageManager;
    } else {
      packageManager = 'pnpm';
    }
  }

  const skeleton = mode === 'skeleton';
  const frontend = mode === 'frontend' || mode === 'fullstack' ? chosenFrontend : undefined;
  const backend = mode === 'backend' || mode === 'fullstack' ? request.backend : undefined;
  const fullStackApp = mode === 'fullstack';

  const backendTemplate = backend ? getBackendTemplate(backend) : undefined;
  if (backend && !backendTemplate) {
    throw templateNotFound('backend template', backend, backendIds());
  }

  const rootPath = path.resolve(process.cwd(), normalizedName);
  const dbType: DatabaseType | undefined =
    request.db && request.db !== 'none' ? (request.db as DatabaseType) : undefined;

  // App layout. A fullstack project's API gets a `-api` suffix so the two apps
  // don't collide on the same workspace package name.
  const apps: MonorepoApp[] = [];
  const frontendDir = normalizedName;
  const backendDir = fullStackApp ? `${normalizedName}-api` : normalizedName;
  const backendPort = backend
    ? fullStackApp
      ? backendTemplate?.port?.toString() ?? '3000'
      : options.port ?? backendTemplate?.port?.toString() ?? '3000'
    : '3000';
  if (frontend) {
    apps.push({
      dir: frontendDir,
      kind: 'frontend',
      label: `${frontend} frontend (apps/${frontendDir})`,
      url: `http://localhost:${frontendPort(options)}`,
    });
  }
  if (backendTemplate) {
    apps.push({
      dir: backendDir,
      kind: 'backend',
      label: `${backendTemplate.displayName} API (apps/${backendDir})`,
      url: `http://localhost:${backendPort}`,
    });
  }

  const nextSteps = skeleton
    ? [
        `cd ${normalizedName}`,
        'Add an app (the workspace is empty, nothing is runnable yet): ' +
          're-shell create <app> --frontend react-ts, or re-shell generate backend <service>',
        `${packageManager} install && ${packageManager} run dev  (once an app exists)`,
      ]
    : [`cd ${normalizedName}`, `${packageManager} install`, `${packageManager} run dev`];

  const summary = [
    `Name: ${normalizedName}`,
    ...(frontend ? [`Frontend: ${frontend}`] : []),
    ...(backend ? [`Backend: ${backend}`] : []),
    ...(frontend ? [`Route: ${options.route ?? `/${normalizedName}`}`] : []),
    `Port: ${backend && !frontend ? backendPort : frontendPort(options)}`,
  ];

  return {
    mode,
    name,
    root: process.cwd(),
    targetDirs: [rootPath],
    projectPath: rootPath,
    frontend,
    backend,
    summary,
    skeleton,
    notes: [...request.notes],
    seedFiles: [],
    nextSteps,
    async write(outRoot: string): Promise<string[]> {
      const sink = new ScaffoldSink(outRoot);
      const projectRel = normalizedName;
      const appsRel = (dir: string) => posixJoin(projectRel, 'apps', dir);

      // Create directory structure
      sink.mkdir(projectRel);
      sink.mkdir(posixJoin(projectRel, 'apps'));
      sink.mkdir(posixJoin(projectRel, 'packages'));
      sink.mkdir(posixJoin(projectRel, 'docs'));

      // Create package.json for the project
      const { scripts, devDependencies } = rootScripts(
        packageManager as string,
        apps.map((app) => posixJoin('apps', app.dir))
      );
      const packageJson = {
        name: normalizedName,
        version: '0.1.0',
        description,
        private: true,
        workspaces: [...WORKSPACE_GLOBS],
        scripts,
        author: team || org,
        license: 'MIT',
        ...(devDependencies ? { devDependencies } : {}),
      };
      sink.write(posixJoin(projectRel, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Create workspace config
      if (packageManager === 'pnpm') {
        sink.write(
          posixJoin(projectRel, 'pnpm-workspace.yaml'),
          `packages:\n${WORKSPACE_GLOBS.map((glob) => `  - '${glob}'`).join('\n')}\n`
        );
      }

      sink.write(
        posixJoin(projectRel, '.gitignore'),
        'node_modules/\ndist/\nbuild/\ncoverage/\n.env\n.env.local\n*.log\n.DS_Store\n'
      );

      // Create README.md
      sink.write(
        posixJoin(projectRel, 'README.md'),
        monorepoReadme(normalizedName, packageManager as string, apps)
      );

      // Backend app (the API; the whole project for --backend)
      if (backendTemplate) {
        const backendContext: BackendTemplateContext = {
          // Use the backend dir name as the package name so a fullstack project's
          // backend (apps/<name>-api) and frontend (apps/<name>) don't collide on
          // the same workspace package name.
          name: backendDir,
          normalizedName: backendDir,
          port: backendPort,
          db: dbType,
          org,
          team,
          description: description || `${name} - A ${backendTemplate.displayName} backend`,
        };
        const backendFiles = await createBackendTemplate(backendTemplate, backendContext);
        for (const file of backendFiles) {
          sink.write(posixJoin(appsRel(backendDir), file.path), file.content, file.executable);
        }
      }

      // Frontend app, from the frontend template system
      if (frontend) {
        const frameworkConfig = getFrameworkConfig(frontend);
        const templateContext: TemplateContext = {
          name,
          normalizedName,
          framework: frontend,
          hasTypeScript: frameworkConfig.hasTypeScript || false,
          port: frontendPort(options),
          route: options.route ?? `/${normalizedName}`,
          org,
          team,
          description: `${name} - A ${frameworkConfig.displayName} app`,
          packageManager: packageManager as string,
        };
        const frontendFiles = await createTemplate(frameworkConfig, templateContext).generateFiles();
        if (fullStackApp && backendTemplate) injectApiProxy(frontendFiles, backendPort);
        for (const file of frontendFiles) {
          sink.write(posixJoin(appsRel(frontendDir), file.path), file.content, file.executable);
        }
      }

      return [...new Set(sink.written)].sort();
    },
    async afterWrite(): Promise<void> {
      for (const app of apps) {
        console.log(chalk.green(`  ✓ Scaffolded ${app.label}`));
      }
      console.log(chalk.green(`\nRe-Shell project "${normalizedName}" created successfully at ${rootPath}`));
      if (skeleton) {
        console.log(
          chalk.yellow(
            '\n⚠ This is an empty workspace skeleton: it has no apps, so nothing is runnable yet.'
          )
        );
      }
      printNextSteps({ notes: this.notes, nextSteps: this.nextSteps });
      if (!skeleton) {
        for (const app of apps) {
          console.log(chalk.gray(`     ${app.label}: ${app.url}`));
        }
      }
    },
  };
}

/**
 * Get backend template choices for interactive prompts.
 *
 * Shows popular frameworks first, then all options grouped by language.
 *
 * @returns Array of prompt choices with separators, popular frameworks, and
 *   all backend frameworks.
 */
function getBackendTemplateChoices() {
  const popular = getPopularBackendFrameworks();
  const allFrameworks = listBackendTemplates().map((t) => ({
    title: `${t.displayName} (${t.language})`,
    value: t.id,
    description: t.description?.substring(0, 100) + (t.description?.length > 100 ? '...' : ''),
  }));

  return [
    { title: '───────── POPULAR FRAMEWORKS ─────────', value: '__separator__popular__', disabled: true },
    ...popular,
    { title: '───────── ALL FRAMEWORKS (A-Z) ─────────', value: '__separator__all__', disabled: true },
    ...allFrameworks,
  ];
}

/**
 * Creates the appropriate template instance based on the framework name.
 *
 * @param framework - Framework configuration identifying which template to use.
 * @param context - Template context used for file generation.
 * @returns An instance of a `BaseTemplate` subclass matching the framework.
 * @throws if the framework has no scaffold template (it never falls back to a
 *   different framework's template).
 */
function createTemplate(framework: FrameworkConfig, context: TemplateContext): BaseTemplate {
  return createFrontendTemplate(framework, context);
}

/**
 * Custom Module Federation Shell Templates
 * These extend the existing Module Federation templates with remote configuration
 */

/**
 * React Module Federation shell template.
 *
 * Extends the base React Module Federation template by injecting the list of
 * remote microfrontends and shared dependencies into the generated
 * `webpack.config.js`.
 */
class ReactModuleFederationShellTemplate extends ReactModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the shell.
   * @param context - Template context used for file generation.
   * @param remotes - List of remote microfrontend entries the shell will load.
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the React shell, overriding the webpack config with
   * remote and shared dependency configuration.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with remotes configuration
    const webpackConfig = this.generateShellWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateShellWebpackConfig(): string {
    const remotesConfig = this.remotes
      .map((r) => `        '${r.name}': '${mfContainerName(r.name)}@http://localhost:${r.port}/remoteEntry.js',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    // Mirrors the base template's loader/plugin setup (babel-loader with the
    // TypeScript preset — ts-loader is NOT a declared dependency — plus
    // HtmlWebpackPlugin, which the dev server needs to serve an index.html)
    // and swaps in the shell's Module Federation wiring.
    return `const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;
const deps = require('./package.json').dependencies;

module.exports = {
  entry: './src/index',

  output: {
    publicPath: 'http://localhost:3000/',
    clean: true
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
  },

  module: {
    rules: [
      {
        test: /\\.m?[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-react',
              '@babel/preset-typescript'
            ],
            plugins: ['@docusaurus/react-loadable/babel']
          }
        }
      },
      {
        test: /\\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource'
      }
    ]
  },

  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotesConfig}
      },
      shared: {
${sharedConfig}
      }
    }),

    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    })
  ],

  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }
};
`;
  }
}

/**
 * Vue Module Federation shell template.
 *
 * Extends the base Vue Module Federation template by injecting the list of
 * remote microfrontends and shared dependencies into the generated
 * `webpack.config.js`.
 */
class VueModuleFederationShellTemplate extends VueModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the shell.
   * @param context - Template context used for file generation.
   * @param remotes - List of remote microfrontend entries the shell will load.
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the Vue shell, overriding the webpack config with
   * remote and shared dependency configuration.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with remotes configuration
    const webpackConfig = this.generateShellWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateShellWebpackConfig(): string {
    const remotesConfig = this.remotes
      .map((r) => `      '${r.name}': '${mfContainerName(r.name)}@http://localhost:${r.port}/remoteEntry.js',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: 3000,
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.vue$/,
        use: 'vue-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

/**
 * Angular Module Federation shell template.
 *
 * Extends the base Angular Module Federation template. Angular uses its own
 * federation configuration, so file generation is delegated to the parent.
 */
class AngularModuleFederationShellTemplate extends AngularModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the shell.
   * @param context - Template context used for file generation.
   * @param remotes - List of remote microfrontend entries the shell will load.
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the Angular shell.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();
    // Angular uses its own federation config
    return files;
  }
}

/**
 * Svelte Module Federation shell template.
 *
 * Extends the base Svelte Module Federation template by injecting the list of
 * remote microfrontends and shared dependencies into the generated
 * `webpack.config.js`.
 */
class SvelteModuleFederationShellTemplate extends SvelteModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the shell.
   * @param context - Template context used for file generation.
   * @param remotes - List of remote microfrontend entries the shell will load.
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the Svelte shell, overriding the webpack config with
   * remote and shared dependency configuration.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with remotes configuration
    const webpackConfig = this.generateShellWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateShellWebpackConfig(): string {
    const remotesConfig = this.remotes
      .map((r) => `      '${r.name}': '${mfContainerName(r.name)}@http://localhost:${r.port}/remoteEntry.js',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: 3000,
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.svelte$/,
        use: 'svelte-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

/**
 * Custom Module Federation Remote Templates
 * These extend the existing Module Federation templates with expose configuration
 */

/**
 * React Module Federation remote template.
 *
 * Extends the base React Module Federation template by injecting the remote's
 * exposed modules and shared dependencies into the generated
 * `webpack.config.js`.
 */
class ReactModuleFederationRemoteTemplate extends ReactModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the remote.
   * @param context - Template context used for file generation.
   * @param remote - Remote microfrontend metadata (name, port, exposes).
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the React remote, overriding the webpack config with
   * exposed modules and shared dependency configuration.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with expose configuration
    const webpackConfig = this.generateRemoteWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateRemoteWebpackConfig(): string {
    const exposesConfig = Object.entries(this.remote.exposes)
      .map(([key, val]) => `        '${key}': '${val}',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: ${this.remote.port},
    hot: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: '${mfContainerName(this.remote.name)}',
      filename: 'remoteEntry.js',
      exposes: {
${exposesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

/**
 * Vue Module Federation remote template.
 *
 * Extends the base Vue Module Federation template by injecting the remote's
 * exposed modules and shared dependencies into the generated
 * `webpack.config.js`.
 */
class VueModuleFederationRemoteTemplate extends VueModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the remote.
   * @param context - Template context used for file generation.
   * @param remote - Remote microfrontend metadata (name, port, exposes).
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the Vue remote, overriding the webpack config with
   * exposed modules and shared dependency configuration.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with expose configuration
    const webpackConfig = this.generateRemoteWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateRemoteWebpackConfig(): string {
    const exposesConfig = Object.entries(this.remote.exposes)
      .map(([key, val]) => `        '${key}': '${val}',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: ${this.remote.port},
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.vue$/,
        use: 'vue-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: '${mfContainerName(this.remote.name)}',
      filename: 'remoteEntry.js',
      exposes: {
${exposesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

/**
 * Angular Module Federation remote template.
 *
 * Extends the base Angular Module Federation template. Angular uses its own
 * federation configuration, so file generation is delegated to the parent.
 */
class AngularModuleFederationRemoteTemplate extends AngularModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the remote.
   * @param context - Template context used for file generation.
   * @param remote - Remote microfrontend metadata (name, port, exposes).
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the Angular remote.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();
    // Angular uses its own federation config
    return files;
  }
}

/**
 * Svelte Module Federation remote template.
 *
 * Extends the base Svelte Module Federation template by injecting the remote's
 * exposed modules and shared dependencies into the generated
 * `webpack.config.js`.
 */
class SvelteModuleFederationRemoteTemplate extends SvelteModuleFederationTemplate {
  /**
   * @param framework - Framework configuration for the remote.
   * @param context - Template context used for file generation.
   * @param remote - Remote microfrontend metadata (name, port, exposes).
   * @param sharedDeps - Dependencies shared as singletons across all apps.
   */
  constructor(
    framework: FrameworkConfig,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  /**
   * Generate files for the Svelte remote, overriding the webpack config with
   * exposed modules and shared dependency configuration.
   *
   * @returns Array of generated file objects with path and content.
   */
  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with expose configuration
    const webpackConfig = this.generateRemoteWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateRemoteWebpackConfig(): string {
    const exposesConfig = Object.entries(this.remote.exposes)
      .map(([key, val]) => `        '${key}': '${val}',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: ${this.remote.port},
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.svelte$/,
        use: 'svelte-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: '${mfContainerName(this.remote.name)}',
      filename: 'remoteEntry.js',
      exposes: {
${exposesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}
