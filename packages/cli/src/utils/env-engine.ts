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

/** The languages re-shell detects (mirrors polyglot-build's LanguageType). */
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

/** A detected toolchain: a language and its (optional) pinned version. */
export interface DetectedToolchain {
  readonly language: EnvLanguage;
  /** Pinned version, when known (e.g. "18", "3.11"). */
  readonly version?: string;
}

/**
 * The Devbox package + devcontainer feature for a language. Both are derived
 * from the same row so the two generated configs stay in lock-step.
 */
export interface ToolchainPackages {
  /** The Devbox (Nix) package name, e.g. "nodejs" / "python3". */
  readonly devboxPackage: string;
  /** The devcontainer feature id, e.g. "ghcr.io/devcontainers/features/node:1". */
  readonly devcontainerFeature: string;
}

/** Per-language Devbox package + devcontainer feature map. */
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

/** Resolve the Devbox/devcontainer packages for a language (unknown → none). */
export function packagesForLanguage(language: EnvLanguage): ToolchainPackages | null {
  if (language === 'unknown') return null;
  return TOOLCHAIN_MAP[language] ?? null;
}

/** The distinct languages detected (deduped, sorted). */
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
 * Generate a Devbox `devbox.json` object from the detected toolchains: one Nix
 * package per distinct language, version-pinned where a version was detected.
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
 * toolchains: one devcontainer feature per distinct language, version-pinned
 * where a version was detected.
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

/** A drift between a generated config and the current detection. */
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
 * Verify a previously-generated config against the current detection: which
 * languages are missing from the config (added) or extra in it (removed). An
 * empty drift means the config is up to date (idempotent re-run is a no-op).
 *
 * Compares at the PACKAGE level (a single `nodejs` package covers both
 * typescript and javascript), so two languages sharing a package never register
 * as drift against each other.
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
