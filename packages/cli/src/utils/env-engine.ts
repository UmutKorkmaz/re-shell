// `re-shell env init` — PURE reproducible-dev-environment serializer.
//
// Maps detected toolchains (re-shell already detects each service's language) to
// a Devbox `devbox.json` (Nix packages) and a `.devcontainer/devcontainer.json`
// (VS Code / Codespaces launch target). Both are emitted from the SAME detected
// facts, so a polyglot monorepo gets one reproducible environment that installs
// every toolchain — no "works on my machine" drift. This module is intentionally
// I/O-free: the command layer detects toolchains on disk; this file only
// serializes + verifies.
//
// No mutation of any input is ever performed.

/**
 * The set of programming languages re-shell is able to detect.
 * Mirrors the `LanguageType` union from `polyglot-build`.
 */
export type EnvLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'unknown';

/**
 * Represents a single toolchain detected on disk.
 * Contains the detected language and, when available, the pinned version
 * the project declares for that language.
 */
export interface DetectedToolchain {
  readonly language: EnvLanguage;
  /** Pinned version, when known (e.g. "18", "3.11"). */
  readonly version?: string;
}

/**
 * Pairs the Devbox (Nix) package name with the corresponding devcontainer
 * feature id for a single language. Both values are derived from the same
 * lookup row so the two generated configs remain in lock-step.
 */
export interface ToolchainPackages {
  /** The Devbox (Nix) package name, e.g. "nodejs" / "python3". */
  readonly devboxPackage: string;
  /** The devcontainer feature id, e.g. "ghcr.io/devcontainers/features/node:1". */
  readonly devcontainerFeature: string;
}

/**
 * Static lookup table mapping each known language (excluding `'unknown'`) to
 * its Devbox package name and devcontainer feature id.
 *
 * @remarks
 * This is the single source of truth that `packagesForLanguage`,
 * `generateDevbox`, `generateDevcontainer`, and `verifyEnvConfig` all consult,
 * keeping every output format consistent.
 */
export const TOOLCHAIN_MAP: Readonly<Record<Exclude<EnvLanguage, 'unknown'>, ToolchainPackages>> = {
  typescript: { devboxPackage: 'nodejs', devcontainerFeature: 'ghcr.io/devcontainers/features/node:1' },
  javascript: { devboxPackage: 'nodejs', devcontainerFeature: 'ghcr.io/devcontainers/features/node:1' },
  python: { devboxPackage: 'python3', devcontainerFeature: 'ghcr.io/devcontainers/features/python:1' },
  go: { devboxPackage: 'go', devcontainerFeature: 'ghcr.io/devcontainers/features/go:1' },
  rust: { devboxPackage: 'rust', devcontainerFeature: 'ghcr.io/devcontainers/features/rust:1' },
  java: { devboxPackage: 'jdk', devcontainerFeature: 'ghcr.io/devcontainers/features/java:1' },
  csharp: { devboxPackage: 'dotnet-sdk', devcontainerFeature: 'ghcr.io/devcontainers/features/dotnet:2' },
  php: { devboxPackage: 'php', devcontainerFeature: 'ghcr.io/devcontainers/features/common-utils:2' },
  ruby: { devboxPackage: 'ruby', devcontainerFeature: 'ghcr.io/devcontainers/features/ruby:1' },
};

/**
 * Resolve the Devbox package and devcontainer feature for a given language.
 *
 * @param language - The detected language to look up.
 * @returns The matching {@link ToolchainPackages}, or `null` when the language
 *   is `'unknown'` or otherwise absent from {@link TOOLCHAIN_MAP}.
 */
export function packagesForLanguage(language: EnvLanguage): ToolchainPackages | null {
  if (language === 'unknown') return null;
  return TOOLCHAIN_MAP[language] ?? null;
}

/**
 * Compute the distinct set of languages present across the given toolchains,
 * excluding `'unknown'` entries.
 *
 * @param toolchains - The detected toolchains to deduplicate.
 * @returns A sorted array of unique, non-unknown languages.
 */
export function distinctLanguages(toolchains: readonly DetectedToolchain[]): EnvLanguage[] {
  return [...new Set(toolchains.map(t => t.language))].filter(l => l !== 'unknown').sort();
}

/** Pick the highest declared version for a language (the pin), or undefined. */
function pinnedVersion(toolchains: readonly DetectedToolchain[], language: EnvLanguage): string | undefined {
  const versions = toolchains
    .filter(t => t.language === language && t.version)
    .map(t => t.version!) as string[];
  if (versions.length === 0) return undefined;
  // Keep it simple + deterministic: the lexicographically-highest declared
  // version (a rough "latest requested" heuristic without a full semver compare).
  return [...versions].sort().pop();
}

/**
 * Generate a Devbox `devbox.json` object from the detected toolchains.
 *
 * Emits one Nix package per distinct language, version-pinned wherever a
 * version was detected. The result is a plain object that the command layer
 * serializes to disk.
 *
 * @param toolchains - The detected toolchains to serialize.
 * @returns A `devbox.json`-shaped object with sorted packages, a shell
 *   `init_hook`, the `nixpkgs` archive, and (when present) an `env` block.
 */
export function generateDevbox(toolchains: readonly DetectedToolchain[]): Record<string, unknown> {
  const packages: string[] = [];
  const env: Record<string, string> = {};
  for (const language of distinctLanguages(toolchains)) {
    const pkgs = packagesForLanguage(language);
    if (!pkgs) continue;
    const version = pinnedVersion(toolchains, language);
    packages.push(version ? `${pkgs.devboxPackage}@${version}` : pkgs.devboxPackage);
  }
  return {
    packages: packages.sort(),
    shell: { init_hook: 'echo "Welcome to your re-shell dev environment."' },
    nixpkgs: { archive: 'nixpkgs-unstable' },
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

/**
 * Generate a `.devcontainer/devcontainer.json` object from the detected
 * toolchains.
 *
 * Emits one devcontainer feature per distinct language, version-pinned via the
 * feature value wherever a version was detected. Features default to
 * `'latest'` when no version is known.
 *
 * @param toolchains - The detected toolchains to serialize.
 * @param options - Optional generation parameters.
 * @param options.workspaceFolder - When provided, embedded as the
 *   `workspaceFolder` field of the resulting config.
 * @returns A `devcontainer.json`-shaped object ready to be serialized to disk.
 */
export function generateDevcontainer(
  toolchains: readonly DetectedToolchain[],
  options: { workspaceFolder?: string } = {}
): Record<string, unknown> {
  const features: Record<string, string> = {};
  for (const language of distinctLanguages(toolchains)) {
    const pkgs = packagesForLanguage(language);
    if (!pkgs) continue;
    const version = pinnedVersion(toolchains, language);
    // devcontainer features version-pin via the feature value.
    features[pkgs.devcontainerFeature] = version ?? 'latest';
  }
  return {
    name: 're-shell',
    image: 'mcr.microsoft.com/devcontainers/base:debian',
    features,
    postCreateCommand: 'devbox install',
    customizations: {
      vscode: { extensions: ['jetcipher.devbox'] },
    },
    ...(options.workspaceFolder ? { workspaceFolder: options.workspaceFolder } : {}),
  };
}

/**
 * Describes the drift between a previously generated config and the current
 * on-disk detection. An empty `missing` and `extra` array signals the config
 * is up to date (idempotent re-run is a no-op).
 */
export interface EnvDrift {
  /** Languages the generated config is missing (added since generation). */
  readonly missing: readonly EnvLanguage[];
  /** Languages the generated config has that detection no longer reports (removed). */
  readonly extra: readonly EnvLanguage[];
}

/** Reverse map: devbox package name → the languages it covers. */
function packageToLanguages(): Map<string, EnvLanguage[]> {
  const m = new Map<string, EnvLanguage[]>();
  for (const [language, pkgs] of Object.entries(TOOLCHAIN_MAP)) {
    const list = m.get(pkgs.devboxPackage) ?? [];
    list.push(language as EnvLanguage);
    m.set(pkgs.devboxPackage, list);
  }
  return m;
}

/**
 * Verify a previously generated config against the current detection.
 *
 * Reports which languages are missing from the generated config (added since
 * generation) and which are extra in it (removed since generation). An empty
 * drift means the config is up to date.
 *
 * Comparison happens at the package level: a single `nodejs` package covers
 * both `typescript` and `javascript`, so two languages that share one package
 * never register as drift against each other.
 *
 * @param generatedPackages - The package entries from the existing config
 *   (version suffixes after `@` are stripped before comparison).
 * @param detected - The currently detected toolchains to compare against.
 * @returns An {@link EnvDrift} with sorted, deduplicated `missing` and `extra`
 *   language arrays.
 */
export function verifyEnvConfig(
  generatedPackages: readonly string[],
  detected: readonly DetectedToolchain[]
): EnvDrift {
  const reverse = packageToLanguages();
  const generatedSet = new Set(generatedPackages.map(p => p.split('@')[0]!));
  const detectedSet = new Set(
    distinctLanguages(detected)
      .map(l => packagesForLanguage(l)?.devboxPackage)
      .filter((p): p is string => Boolean(p))
  );

  const missingPackages = [...detectedSet].filter(p => !generatedSet.has(p));
  const extraPackages = [...generatedSet].filter(p => !detectedSet.has(p));

  const missing = [...new Set(missingPackages.flatMap(p => reverse.get(p) ?? []))].sort();
  const extra = [...new Set(extraPackages.flatMap(p => reverse.get(p) ?? []))].sort();
  return { missing, extra };
}
