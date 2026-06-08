/**
 * Service Versioning and Compatibility Management
 * API versioning, semantic versioning, backward compatibility, graceful upgrades
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Version types
export type VersionType = 'major' | 'minor' | 'patch' | 'pre-release' | 'build';

// Compatibility status
export type CompatibilityStatus = 'compatible' | 'deprecated' | 'incompatible' | 'unknown';

// Version strategy
export type VersionStrategy = 'semantic' | 'date-based' | 'git-hash' | 'sequential';

// Semantic version
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  buildMetadata?: string;
}

// Service version
export interface ServiceVersion {
  semantic: SemanticVersion;
  apiVersion: string;
  protocolVersion: string;
  minCompatibleClient: SemanticVersion;
  maxCompatibleClient: SemanticVersion;
  deprecatedIn?: SemanticVersion;
  removedIn?: SemanticVersion;
  features: string[];
  breakingChanges: string[];
  metadata: Record<string, any>;
}

// Version constraint
export interface VersionConstraint {
  min?: SemanticVersion;
  max?: SemanticVersion;
  exclude?: SemanticVersion[];
  requirePreRelease?: boolean;
}

// Version compatibility check result
export interface CompatibilityCheckResult {
  compatible: boolean;
  status: CompatibilityStatus;
  reason?: string;
  recommendedVersion?: SemanticVersion;
  upgradePath?: SemanticVersion[];
  warnings?: string[];
}

// Version range
export interface VersionRange {
  start: SemanticVersion;
  end: SemanticVersion;
  inclusiveStart: boolean;
  inclusiveEnd: boolean;
}

// Generate service version configuration
export async function generateVersionConfig(
  serviceName: string,
  initialVersion = '1.0.0',
  strategy: VersionStrategy = 'semantic'
): Promise<{
  serviceName: string;
  currentVersion: ServiceVersion;
  strategy: VersionStrategy;
  supportedVersions: ServiceVersion[];
  versionHistory: ServiceVersion[];
}> {
  const semver = parseSemanticVersion(initialVersion);

  return {
    serviceName,
    currentVersion: {
      semantic: semver,
      apiVersion: 'v1',
      protocolVersion: '1.0',
      minCompatibleClient: { major: 1, minor: 0, patch: 0 },
      maxCompatibleClient: { major: 1, minor: 99, patch: 99 },
      features: [],
      breakingChanges: [],
      metadata: {},
    },
    strategy,
    supportedVersions: [],
    versionHistory: [],
  };
}

// Parse semantic version string
export function parseSemanticVersion(version: string): SemanticVersion {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+))?(?:\+([0-9A-Za-z-]+))?$/);

  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    preRelease: match[4],
    buildMetadata: match[5],
  };
}

// Format semantic version to string
export function formatSemanticVersion(version: SemanticVersion): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;

  if (version.preRelease) {
    result += `-${version.preRelease}`;
  }

  if (version.buildMetadata) {
    result += `+${version.buildMetadata}`;
  }

  return result;
}

// Compare two semantic versions
export function compareVersions(a: SemanticVersion, b: SemanticVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  // Compare pre-release versions
  if (a.preRelease && b.preRelease) {
    return a.preRelease.localeCompare(b.preRelease);
  }

  if (a.preRelease) return -1;
  if (b.preRelease) return 1;

  return 0;
}

// Check if version is within range
export function isVersionInRange(version: SemanticVersion, range: VersionRange): boolean {
  const startCompare = compareVersions(version, range.start);
  const endCompare = compareVersions(version, range.end);

  const startOk = range.inclusiveStart ? startCompare >= 0 : startCompare > 0;
  const endOk = range.inclusiveEnd ? endCompare <= 0 : endCompare < 0;

  return startOk && endOk;
}

// Check compatibility between versions
export function checkCompatibility(
  clientVersion: SemanticVersion,
  serviceVersion: ServiceVersion
): CompatibilityCheckResult {
  // Check minimum compatible version
  if (compareVersions(clientVersion, serviceVersion.minCompatibleClient) < 0) {
    return {
      compatible: false,
      status: 'incompatible',
      reason: `Client version ${formatSemanticVersion(clientVersion)} is below minimum compatible version ${formatSemanticVersion(serviceVersion.minCompatibleClient)}`,
      recommendedVersion: serviceVersion.minCompatibleClient,
    };
  }

  // Check maximum compatible version
  if (compareVersions(clientVersion, serviceVersion.maxCompatibleClient) > 0) {
    return {
      compatible: false,
      status: 'incompatible',
      reason: `Client version ${formatSemanticVersion(clientVersion)} exceeds maximum compatible version ${formatSemanticVersion(serviceVersion.maxCompatibleClient)}`,
      recommendedVersion: serviceVersion.maxCompatibleClient,
    };
  }

  const warnings: string[] = [];

  // Check if version is deprecated
  if (serviceVersion.deprecatedIn) {
    if (compareVersions(clientVersion, serviceVersion.deprecatedIn) <= 0) {
      if (serviceVersion.removedIn) {
        if (compareVersions(clientVersion, serviceVersion.removedIn) < 0) {
          return {
            compatible: true,
            status: 'deprecated',
            reason: `Version ${formatSemanticVersion(clientVersion)} is deprecated and will be removed in ${formatSemanticVersion(serviceVersion.removedIn)}`,
            warnings: ['This version is deprecated. Please upgrade soon.'],
          };
        }
      } else {
        warnings.push('This version is deprecated. Please upgrade soon.');
      }
    }
  }

  return {
    compatible: true,
    status: 'compatible',
    warnings,
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptVersioning(
  config: any
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-versioning.ts`,
    content: `// Semantic Versioning and Compatibility Management

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  buildMetadata?: string;
}

export interface ServiceVersion {
  semantic: SemanticVersion;
  apiVersion: string;
  protocolVersion: string;
  minCompatibleClient: SemanticVersion;
  maxCompatibleClient: SemanticVersion;
  deprecatedIn?: SemanticVersion;
  removedIn?: SemanticVersion;
  features: string[];
  breakingChanges: string[];
  metadata: Record<string, any>;
}

export type CompatibilityStatus = 'compatible' | 'deprecated' | 'incompatible' | 'unknown';

export interface CompatibilityCheckResult {
  compatible: boolean;
  status: CompatibilityStatus;
  reason?: string;
  recommendedVersion?: SemanticVersion;
  upgradePath?: SemanticVersion[];
  warnings?: string[];
}

export class ${toPascalCase(config.serviceName)}VersionManager {
  private currentVersion: ServiceVersion;
  private supportedVersions: ServiceVersion[];
  private versionHistory: ServiceVersion[];

  constructor(config: {
    currentVersion: ServiceVersion;
    supportedVersions: ServiceVersion[];
    versionHistory: ServiceVersion[];
  }) {
    this.currentVersion = config.currentVersion;
    this.supportedVersions = config.supportedVersions;
    this.versionHistory = config.versionHistory;
  }

  /**
   * Parse semantic version string
   */
  static parseSemanticVersion(version: string): SemanticVersion {
    const match = version.match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z-]+))?(?:\\+([0-9A-Za-z-]+))?$/);

    if (!match) {
      throw new Error(\`Invalid semantic version: \${version}\`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      preRelease: match[4],
      buildMetadata: match[5],
    };
  }

  /**
   * Format semantic version to string
   */
  static formatSemanticVersion(version: SemanticVersion): string {
    let result = \`\${version.major}.\${version.minor}.\${version.patch}\`;

    if (version.preRelease) {
      result += \`-\${version.preRelease}\`;
    }

    if (version.buildMetadata) {
      result += \`+\${version.buildMetadata}\`;
    }

    return result;
  }

  /**
   * Compare two semantic versions
   */
  static compareVersions(a: SemanticVersion, b: SemanticVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;

    if (a.preRelease && b.preRelease) {
      return a.preRelease.localeCompare(b.preRelease);
    }

    if (a.preRelease) return -1;
    if (b.preRelease) return 1;

    return 0;
  }

  /**
   * Check client compatibility
   */
  checkCompatibility(clientVersion: string | SemanticVersion): CompatibilityCheckResult {
    const clientSemver = typeof clientVersion === 'string'
      ? ${toPascalCase(config.serviceName)}VersionManager.parseSemanticVersion(clientVersion)
      : clientVersion;

    return this.checkCompatibilityInternal(clientSemver, this.currentVersion);
  }

  /**
   * Internal compatibility check
   */
  private checkCompatibilityInternal(
    clientVersion: SemanticVersion,
    serviceVersion: ServiceVersion
  ): CompatibilityCheckResult {
    const warnings: string[] = [];

    // Check minimum compatible version
    if (${toPascalCase(config.serviceName)}VersionManager.compareVersions(clientVersion, serviceVersion.minCompatibleClient) < 0) {
      return {
        compatible: false,
        status: 'incompatible',
        reason: \`Client version \${${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(clientVersion)} is below minimum compatible version \${${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(serviceVersion.minCompatibleClient)}\`,
        recommendedVersion: serviceVersion.minCompatibleClient,
      };
    }

    // Check maximum compatible version
    if (${toPascalCase(config.serviceName)}VersionManager.compareVersions(clientVersion, serviceVersion.maxCompatibleClient) > 0) {
      return {
        compatible: false,
        status: 'incompatible',
        reason: \`Client version \${${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(clientVersion)} exceeds maximum compatible version \${${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(serviceVersion.maxCompatibleClient)}\`,
        recommendedVersion: serviceVersion.maxCompatibleClient,
      };
    }

    // Check deprecation
    if (serviceVersion.deprecatedIn) {
      if (${toPascalCase(config.serviceName)}VersionManager.compareVersions(clientVersion, serviceVersion.deprecatedIn) <= 0) {
        if (serviceVersion.removedIn) {
          if (${toPascalCase(config.serviceName)}VersionManager.compareVersions(clientVersion, serviceVersion.removedIn) < 0) {
            return {
              compatible: true,
              status: 'deprecated',
              reason: \`Version \${${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(clientVersion)} is deprecated and will be removed in \${${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(serviceVersion.removedIn)}\`,
              warnings: ['This version is deprecated. Please upgrade soon.'],
            };
          }
        }
        warnings.push('This version is deprecated. Please upgrade soon.');
      }
    }

    return {
      compatible: true,
      status: 'compatible',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get current version
   */
  getCurrentVersion(): ServiceVersion {
    return this.currentVersion;
  }

  /**
   * Get version info for API response
   */
  getVersionInfo() {
    return {
      serviceName: '${config.serviceName}',
      version: ${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(this.currentVersion.semantic),
      apiVersion: this.currentVersion.apiVersion,
      protocolVersion: this.currentVersion.protocolVersion,
      minCompatibleClient: ${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(this.currentVersion.minCompatibleClient),
      maxCompatibleClient: ${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(this.currentVersion.maxCompatibleClient),
      features: this.currentVersion.features,
      breakingChanges: this.currentVersion.breakingChanges,
    };
  }

  /**
   * Get upgrade path from one version to another
   */
  getUpgradePath(fromVersion: string | SemanticVersion, toVersion: string | SemanticVersion): SemanticVersion[] {
    const from = typeof fromVersion === 'string'
      ? ${toPascalCase(config.serviceName)}VersionManager.parseSemanticVersion(fromVersion)
      : fromVersion;
    const to = typeof toVersion === 'string'
      ? ${toPascalCase(config.serviceName)}VersionManager.parseSemanticVersion(toVersion)
      : toVersion;

    const path: SemanticVersion[] = [];

    // Find all versions between from and to
    for (const version of this.versionHistory) {
      const cmp = ${toPascalCase(config.serviceName)}VersionManager.compareVersions;
      if (cmp(version.semantic, from) > 0 && cmp(version.semantic, to) <= 0) {
        path.push(version.semantic);
      }
    }

    return path.sort((a, b) => ${toPascalCase(config.serviceName)}VersionManager.compareVersions(a, b));
  }

  /**
   * Add version to history
   */
  addVersion(version: ServiceVersion): void {
    this.versionHistory.push(version);
  }

  /**
   * Deprecate current version
   */
  deprecateCurrentVersion(deprecatedIn: SemanticVersion, removedIn?: SemanticVersion): void {
    this.currentVersion.deprecatedIn = deprecatedIn;
    if (removedIn) {
      this.currentVersion.removedIn = removedIn;
    }
  }

  /**
   * Create new version
   */
  createNewVersion(versionType: 'major' | 'minor' | 'patch', features: string[] = [], breakingChanges: string[] = []): ServiceVersion {
    const newSemver = { ...this.currentVersion.semantic };

    switch (versionType) {
      case 'major':
        newSemver.major++;
        newSemver.minor = 0;
        newSemver.patch = 0;
        break;
      case 'minor':
        newSemver.minor++;
        newSemver.patch = 0;
        break;
      case 'patch':
        newSemver.patch++;
        break;
    }

    const newVersion: ServiceVersion = {
      semantic: newSemver,
      apiVersion: \`v\${newSemver.major}\`,
      protocolVersion: \`\${newSemver.major}.0\`,
      minCompatibleClient: { major: newSemver.major, minor: 0, patch: 0 },
      maxCompatibleClient: { major: newSemver.major, minor: 99, patch: 99 },
      features,
      breakingChanges,
      metadata: {
        releasedAt: new Date().toISOString(),
      },
    };

    this.currentVersion = newVersion;
    this.versionHistory.push(newVersion);

    return newVersion;
  }
}

// Express middleware factory
export function createVersionMiddleware(versionManager: ${toPascalCase(config.serviceName)}VersionManager) {
  return (req: any, res: any, next: any) => {
    // Add version info to response headers
    const version = versionManager.getCurrentVersion();
    res.setHeader('X-API-Version', version.apiVersion);
    res.setHeader('X-Service-Version', ${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(version.semantic));
    res.setHeader('X-Protocol-Version', version.protocolVersion);

    // Check client version if provided
    const clientVersion = req.headers['x-client-version'];
    if (clientVersion) {
      const compatibility = versionManager.checkCompatibility(clientVersion);

      if (!compatibility.compatible) {
        return res.status(400).json({
          error: 'Incompatible client version',
          clientVersion,
          version: versionManager.getVersionInfo(),
        });
      }

      if (compatibility.warnings) {
        res.setHeader('X-Version-Warnings', compatibility.warnings.join(', '));
      }
    }

    next();
  };
}

// Usage example
async function main() {
  const versionManager = new ${toPascalCase(config.serviceName)}VersionManager({
    currentVersion: {
      semantic: { major: 1, minor: 0, patch: 0 },
      apiVersion: 'v1',
      protocolVersion: '1.0',
      minCompatibleClient: { major: 1, minor: 0, patch: 0 },
      maxCompatibleClient: { major: 1, minor: 99, patch: 99 },
      features: ['user-management', 'authentication'],
      breakingChanges: [],
      metadata: {},
    },
    supportedVersions: [],
    versionHistory: [],
  });

  console.log('Current version:', versionManager.getVersionInfo());

  // Check compatibility
  const result = versionManager.checkCompatibility('1.0.0');
  console.log('Compatibility check:', result);

  // Create new version
  const newVersion = versionManager.createNewVersion('minor', ['new-feature'], []);
  console.log('New version:', ${toPascalCase(config.serviceName)}VersionManager.formatSemanticVersion(newVersion.semantic));
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonVersioning(
  config: any
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_versioning.py`,
    content: `# Semantic Versioning and Compatibility Management
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import re

class CompatibilityStatus(Enum):
    COMPATIBLE = 'compatible'
    DEPRECATED = 'deprecated'
    INCOMPATIBLE = 'incompatible'
    UNKNOWN = 'unknown'

@dataclass
class SemanticVersion:
    major: int
    minor: int
    patch: int
    pre_release: Optional[str] = None
    build_metadata: Optional[str] = None

@dataclass
class ServiceVersion:
    semantic: SemanticVersion
    api_version: str
    protocol_version: str
    min_compatible_client: SemanticVersion
    max_compatible_client: SemanticVersion
    deprecated_in: Optional[SemanticVersion] = None
    removed_in: Optional[SemanticVersion] = None
    features: List[str] = None
    breaking_changes: List[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.features is None:
            self.features = []
        if self.breaking_changes is None:
            self.breaking_changes = []
        if self.metadata is None:
            self.metadata = {}

@dataclass
class CompatibilityCheckResult:
    compatible: bool
    status: CompatibilityStatus
    reason: Optional[str] = None
    recommended_version: Optional[SemanticVersion] = None
    upgrade_path: List[SemanticVersion] = None
    warnings: List[str] = None

class ${toPascalCase(config.serviceName)}VersionManager:
    def __init__(self, config: Dict[str, Any]):
        self.current_version = config['currentVersion']
        self.supported_versions = config.get('supportedVersions', [])
        self.version_history = config.get('versionHistory', [])

    @staticmethod
    def parse_semantic_version(version: str) -> SemanticVersion:
        match = re.match(r'^(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z-]+))?(?:\\+([0-9A-Za-z-]+))?$', version)

        if not match:
            raise ValueError(f'Invalid semantic version: {version}')

        return SemanticVersion(
            major=int(match.group(1)),
            minor=int(match.group(2)),
            patch=int(match.group(3)),
            pre_release=match.group(4),
            build_metadata=match.group(5),
        )

    @staticmethod
    def format_semantic_version(version: SemanticVersion) -> str:
        result = f'{version.major}.{version.minor}.{version.patch}'

        if version.pre_release:
            result += f'-{version.pre_release}'

        if version.build_metadata:
            result += f'+{version.build_metadata}'

        return result

    @staticmethod
    def compare_versions(a: SemanticVersion, b: SemanticVersion) -> int:
        if a.major != b.major:
            return a.major - b.major
        if a.minor != b.minor:
            return a.minor - b.minor
        if a.patch != b.patch:
            return a.patch - b.patch

        if a.pre_release and b.pre_release:
            if a.pre_release < b.pre_release:
                return -1
            if a.pre_release > b.pre_release:
                return 1
            return 0

        if a.pre_release:
            return -1
        if b.pre_release:
            return 1

        return 0

    def check_compatibility(self, client_version: str | SemanticVersion) -> CompatibilityCheckResult:
        if isinstance(client_version, str):
            client_semver = self.parse_semantic_version(client_version)
        else:
            client_semver = client_version

        return self._check_compatibility_internal(client_semver, self.current_version)

    def _check_compatibility_internal(
        self,
        client_version: SemanticVersion,
        service_version: ServiceVersion
    ) -> CompatibilityCheckResult:
        warnings = []

        # Check minimum compatible version
        if self.compare_versions(client_version, service_version.min_compatible_client) < 0:
            return CompatibilityCheckResult(
                compatible=False,
                status=CompatibilityStatus.INCOMPATIBLE,
                reason=f'Client version {self.format_semantic_version(client_version)} is below minimum compatible version {self.format_semantic_version(service_version.min_compatible_client)}',
                recommended_version=service_version.min_compatible_client,
            )

        # Check maximum compatible version
        if self.compare_versions(client_version, service_version.max_compatible_client) > 0:
            return CompatibilityCheckResult(
                compatible=False,
                status=CompatibilityStatus.INCOMPATIBLE,
                reason=f'Client version {self.format_semantic_version(client_version)} exceeds maximum compatible version {self.format_semantic_version(service_version.max_compatible_client)}',
                recommended_version=service_version.max_compatible_client,
            )

        # Check deprecation
        if service_version.deprecated_in:
            if self.compare_versions(client_version, service_version.deprecated_in) <= 0:
                if service_version.removed_in:
                    if self.compare_versions(client_version, service_version.removed_in) < 0:
                        return CompatibilityCheckResult(
                            compatible=True,
                            status=CompatibilityStatus.DEPRECATED,
                            reason=f'Version {self.format_semantic_version(client_version)} is deprecated and will be removed in {self.format_semantic_version(service_version.removed_in)}',
                            warnings=['This version is deprecated. Please upgrade soon.'],
                        )
                warnings.append('This version is deprecated. Please upgrade soon.')

        return CompatibilityCheckResult(
            compatible=True,
            status=CompatibilityStatus.COMPATIBLE,
            warnings=warnings if warnings else None,
        )

    def get_current_version(self) -> ServiceVersion:
        return self.current_version

    def get_version_info(self) -> Dict[str, Any]:
        return {
            'serviceName': '${config.serviceName}',
            'version': self.format_semantic_version(self.current_version.semantic),
            'apiVersion': self.current_version.api_version,
            'protocolVersion': self.current_version.protocol_version,
            'minCompatibleClient': self.format_semantic_version(self.current_version.min_compatible_client),
            'maxCompatibleClient': self.format_semantic_version(self.current_version.max_compatible_client),
            'features': self.current_version.features,
            'breakingChanges': self.current_version.breaking_changes,
        }

    def get_upgrade_path(
        self,
        from_version: str | SemanticVersion,
        to_version: str | SemanticVersion
    ) -> List[SemanticVersion]:
        from_v = self.parse_semantic_version(from_version) if isinstance(from_version, str) else from_version
        to_v = self.parse_semantic_version(to_version) if isinstance(to_version, str) else to_version

        path = []

        for version in self.version_history:
            if (self.compare_versions(version.semantic, from_v) > 0 and
                self.compare_versions(version.semantic, to_v) <= 0):
                path.append(version.semantic)

        return sorted(path, key=lambda v: (v.major, v.minor, v.patch))

    def add_version(self, version: ServiceVersion) -> None:
        self.version_history.append(version)

    def deprecate_current_version(
        self,
        deprecated_in: SemanticVersion,
        removed_in: Optional[SemanticVersion] = None
    ) -> None:
        self.current_version.deprecated_in = deprecated_in
        if removed_in:
            self.current_version.removed_in = removed_in

    def create_new_version(
        self,
        version_type: str,
        features: List[str] = None,
        breaking_changes: List[str] = None
    ) -> ServiceVersion:
        from datetime import datetime

        if features is None:
            features = []
        if breaking_changes is None:
            breaking_changes = []

        new_semver = SemanticVersion(
            major=self.current_version.semantic.major,
            minor=self.current_version.semantic.minor,
            patch=self.current_version.semantic.patch,
        )

        if version_type == 'major':
            new_semver.major += 1
            new_semver.minor = 0
            new_semver.patch = 0
        elif version_type == 'minor':
            new_semver.minor += 1
            new_semver.patch = 0
        elif version_type == 'patch':
            new_semver.patch += 1

        new_version = ServiceVersion(
            semantic=new_semver,
            api_version=f'v{new_semver.major}',
            protocol_version=f'{new_semver.major}.0',
            min_compatible_client=SemanticVersion(major=new_semver.major, minor=0, patch=0),
            max_compatible_client=SemanticVersion(major=new_semver.major, minor=99, patch=99),
            features=features,
            breaking_changes=breaking_changes,
            metadata={
                'releasedAt': datetime.utcnow().isoformat(),
            },
        )

        self.current_version = new_version
        self.version_history.append(new_version)

        return new_version

# FastAPI middleware factory
def create_version_middleware(version_manager: ${toPascalCase(config.serviceName)}VersionManager):
    from fastapi import Request

    async def middleware(request: Request, call_next):
        from fastapi.responses import Response

        version = version_manager.get_current_version()

        # Add version info to response headers
        headers = {
            'X-API-Version': version.api_version,
            'X-Service-Version': version_manager.format_semantic_version(version.semantic),
            'X-Protocol-Version': version.protocol_version,
        }

        # Check client version if provided
        client_version = request.headers.get('x-client-version')
        if client_version:
            compatibility = version_manager.check_compatibility(client_version)

            if not compatibility.compatible:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=400,
                    content={
                        'error': 'Incompatible client version',
                        'clientVersion': client_version,
                        'version': version_manager.get_version_info(),
                    },
                )

            if compatibility.warnings:
                headers['X-Version-Warnings'] = ', '.join(compatibility.warnings)

        response = await call_next(request)
        response.headers.update(headers)
        return response

    return middleware

# Usage example
async def main():
    config = {
        'currentVersion': ServiceVersion(
            semantic=SemanticVersion(major=1, minor=0, patch=0),
            api_version='v1',
            protocol_version='1.0',
            min_compatible_client=SemanticVersion(major=1, minor=0, patch=0),
            max_compatible_client=SemanticVersion(major=1, minor=99, patch=99),
            features=['user-management', 'authentication'],
            breaking_changes=[],
        ),
        'supportedVersions': [],
        'versionHistory': [],
    }

    version_manager = ${toPascalCase(config.serviceName)}VersionManager(config)

    print('Current version:', version_manager.get_version_info())

    # Check compatibility
    result = version_manager.check_compatibility('1.0.0')
    print('Compatibility check:', result)

    # Create new version
    new_version = version_manager.create_new_version('minor', ['new-feature'], [])
    print('New version:', ${toPascalCase(config.serviceName)}VersionManager.format_semantic_version(new_version.semantic))

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoVersioning(
  config: any
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  const files: Array<{ path: string; content: string }> = [{
    path: `${config.serviceName}-versioning.go`,
    content: `package main

import (
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// SemanticVersion represents a semantic version
type SemanticVersion struct {
	Major         int
	Minor         int
	Patch         int
	PreRelease    string
	BuildMetadata string
}

// ServiceVersion represents a service version with compatibility info
type ServiceVersion struct {
	Semantic            SemanticVersion
	APIVersion          string
	ProtocolVersion      string
	MinCompatibleClient SemanticVersion
	MaxCompatibleClient SemanticVersion
	DeprecatedIn        *SemanticVersion
	RemovedIn           *SemanticVersion
	Features            []string
	BreakingChanges     []string
	Metadata            map[string]interface{}
}

// CompatibilityStatus represents compatibility status
type CompatibilityStatus string

const (
	StatusCompatible    CompatibilityStatus = "compatible"
	StatusDeprecated    CompatibilityStatus = "deprecated"
	StatusIncompatible CompatibilityStatus = "incompatible"
	StatusUnknown      CompatibilityStatus = "unknown"
)

// CompatibilityCheckResult represents compatibility check result
type CompatibilityCheckResult struct {
	Compatible           bool
	Status               CompatibilityStatus
	Reason               string
	RecommendedVersion   *SemanticVersion
	UpgradePath          []SemanticVersion
	Warnings             []string
}

// ${toPascalCase(config.serviceName)}VersionManager manages service versions
type ${toPascalCase(config.serviceName)}VersionManager struct {
	CurrentVersion    *ServiceVersion
	SupportedVersions []*ServiceVersion
	VersionHistory    []*ServiceVersion
}

// New${toPascalCase(config.serviceName)}VersionManager creates a new version manager
func New${toPascalCase(config.serviceName)}VersionManager(currentVersion *ServiceVersion) *${toPascalCase(config.serviceName)}VersionManager {
	return &${toPascalCase(config.serviceName)}VersionManager{
		CurrentVersion:    currentVersion,
		SupportedVersions: make([]*ServiceVersion, 0),
		VersionHistory:    make([]*ServiceVersion, 0),
	}
}

// ParseSemanticVersion parses a semantic version string
func ParseSemanticVersion(version string) (SemanticVersion, error) {
	re := regexp.MustCompile(\`^(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z-]+))?(?:\\\\+([0-9A-Za-z-]+))?$\`)
	matches := re.FindStringSubmatch(version)

	if matches == nil {
		return SemanticVersion{}, fmt.Errorf("invalid semantic version: %s", version)
	}

	major, _ := strconv.Atoi(matches[1])
	minor, _ := strconv.Atoi(matches[2])
	patch, _ := strconv.Atoi(matches[3])

	return SemanticVersion{
		Major:         major,
		Minor:         minor,
		Patch:         patch,
		PreRelease:    matches[4],
		BuildMetadata: matches[5],
	}, nil
}

// FormatSemanticVersion formats a semantic version to string
func FormatSemanticVersion(version SemanticVersion) string {
	result := fmt.Sprintf("%d.%d.%d", version.Major, version.Minor, version.Patch)

	if version.PreRelease != "" {
		result += "-" + version.PreRelease
	}

	if version.BuildMetadata != "" {
		result += "+" + version.BuildMetadata
	}

	return result
}

// CompareVersions compares two semantic versions
func CompareVersions(a, b SemanticVersion) int {
	if a.Major != b.Major {
		return a.Major - b.Major
	}
	if a.Minor != b.Minor {
		return a.Minor - b.Minor
	}
	if a.Patch != b.Patch {
		return a.Patch - b.Patch
	}

	if a.PreRelease != "" && b.PreRelease != "" {
		if a.PreRelease < b.PreRelease {
			return -1
		}
		if a.PreRelease > b.PreRelease {
			return 1
		}
		return 0
	}

	if a.PreRelease != "" {
		return -1
	}
	if b.PreRelease != "" {
		return 1
	}

	return 0
}

// CheckCompatibility checks client version compatibility
func (vm *${toPascalCase(config.serviceName)}VersionManager) CheckCompatibility(clientVersionStr string) CompatibilityCheckResult {
	clientVersion, err := ParseSemanticVersion(clientVersionStr)
	if err != nil {
		return CompatibilityCheckResult{
			Compatible: false,
			Status:     StatusIncompatible,
			Reason:     fmt.Sprintf("Invalid client version: %s", clientVersionStr),
		}
	}

	return vm.checkCompatibilityInternal(&clientVersion, vm.CurrentVersion)
}

func (vm *${toPascalCase(config.serviceName)}VersionManager) checkCompatibilityInternal(
	clientVersion *SemanticVersion,
	serviceVersion *ServiceVersion,
) CompatibilityCheckResult {
	warnings := make([]string, 0)

	// Check minimum compatible version
	if CompareVersions(*clientVersion, serviceVersion.MinCompatibleClient) < 0 {
		return CompatibilityCheckResult{
			Compatible:         false,
			Status:            StatusIncompatible,
			Reason:            fmt.Sprintf("Client version %s is below minimum compatible version %s", FormatSemanticVersion(*clientVersion), FormatSemanticVersion(serviceVersion.MinCompatibleClient)),
			RecommendedVersion: &serviceVersion.MinCompatibleClient,
		}
	}

	// Check maximum compatible version
	if CompareVersions(*clientVersion, serviceVersion.MaxCompatibleClient) > 0 {
		return CompatibilityCheckResult{
			Compatible:         false,
			Status:            StatusIncompatible,
			Reason:            fmt.Sprintf("Client version %s exceeds maximum compatible version %s", FormatSemanticVersion(*clientVersion), FormatSemanticVersion(serviceVersion.MaxCompatibleClient)),
			RecommendedVersion: &serviceVersion.MaxCompatibleClient,
		}
	}

	// Check deprecation
	if serviceVersion.DeprecatedIn != nil {
		if CompareVersions(*clientVersion, *serviceVersion.DeprecatedIn) <= 0 {
			if serviceVersion.RemovedIn != nil {
				if CompareVersions(*clientVersion, *serviceVersion.RemovedIn) < 0 {
					return CompatibilityCheckResult{
						Compatible: true,
						Status:     StatusDeprecated,
						Reason:     fmt.Sprintf("Version %s is deprecated and will be removed in %s", FormatSemanticVersion(*clientVersion), FormatSemanticVersion(*serviceVersion.RemovedIn)),
						Warnings:   []string{"This version is deprecated. Please upgrade soon."},
					}
				}
			}
			warnings = append(warnings, "This version is deprecated. Please upgrade soon.")
		}
	}

	return CompatibilityCheckResult{
		Compatible: true,
		Status:     StatusCompatible,
		Warnings:   warnings,
	}
}

// GetCurrentVersion returns the current version
func (vm *${toPascalCase(config.serviceName)}VersionManager) GetCurrentVersion() *ServiceVersion {
	return vm.CurrentVersion
}

// GetVersionInfo returns version information
func (vm *${toPascalCase(config.serviceName)}VersionManager) GetVersionInfo() map[string]interface{} {
	return map[string]interface{}{
		"serviceName":        "${config.serviceName}",
		"version":           FormatSemanticVersion(vm.CurrentVersion.Semantic),
		"apiVersion":        vm.CurrentVersion.APIVersion,
		"protocolVersion":    vm.CurrentVersion.ProtocolVersion,
		"minCompatibleClient": FormatSemanticVersion(vm.CurrentVersion.MinCompatibleClient),
		"maxCompatibleClient": FormatSemanticVersion(vm.CurrentVersion.MaxCompatibleClient),
		"features":          vm.CurrentVersion.Features,
		"breakingChanges":   vm.CurrentVersion.BreakingChanges,
	}
}

// GetUpgradePath returns the upgrade path from one version to another
func (vm *${toPascalCase(config.serviceName)}VersionManager) GetUpgradePath(fromStr, toStr string) []SemanticVersion {
	from, _ := ParseSemanticVersion(fromStr)
	to, _ := ParseSemanticVersion(toStr)

	path := make([]SemanticVersion, 0)

	for _, version := range vm.VersionHistory {
		if CompareVersions(version.Semantic, from) > 0 && CompareVersions(version.Semantic, to) <= 0 {
			path = append(path, version.Semantic)
		}
	}

	sort.Slice(path, func(i, j int) bool {
		return CompareVersions(path[i], path[j]) < 0
	})

	return path
}

// CreateVersionMiddleware creates HTTP middleware for versioning
func (vm *${toPascalCase(config.serviceName)}VersionManager) CreateVersionMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			version := vm.GetCurrentVersion()

			// Add version info to response headers
			w.Header().Set("X-API-Version", version.APIVersion)
			w.Header().Set("X-Service-Version", FormatSemanticVersion(version.Semantic))
			w.Header().Set("X-Protocol-Version", version.ProtocolVersion)

			// Check client version if provided
			clientVersion := r.Header.Get("X-Client-Version")
			if clientVersion != "" {
				compatibility := vm.CheckCompatibility(clientVersion)

				if !compatibility.Compatible {
					http.Error(w, compatibility.Reason, http.StatusBadRequest)
					return
				}

				if len(compatibility.Warnings) > 0 {
					w.Header().Set("X-Version-Warnings", strings.Join(compatibility.Warnings, ", "))
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CreateNewVersion creates a new version
func (vm *${toPascalCase(config.serviceName)}VersionManager) CreateNewVersion(
	versionType string,
	features []string,
	breakingChanges []string,
) *ServiceVersion {
	newSemver := vm.CurrentVersion.Semantic

	switch versionType {
	case "major":
		newSemver.Major++
		newSemver.Minor = 0
		newSemver.Patch = 0
	case "minor":
		newSemver.Minor++
		newSemver.Patch = 0
	case "patch":
		newSemver.Patch++
	}

	newVersion := &ServiceVersion{
		Semantic:            newSemver,
		APIVersion:          fmt.Sprintf("v%d", newSemver.Major),
		ProtocolVersion:      fmt.Sprintf("%d.0", newSemver.Major),
		MinCompatibleClient: SemanticVersion{Major: newSemver.Major, Minor: 0, Patch: 0},
		MaxCompatibleClient: SemanticVersion{Major: newSemver.Major, Minor: 99, Patch: 99},
		Features:            features,
		BreakingChanges:     breakingChanges,
		Metadata: map[string]interface{}{
			"releasedAt": time.Now().Format(time.RFC3339),
		},
	}

	vm.CurrentVersion = newVersion
	vm.VersionHistory = append(vm.VersionHistory, newVersion)

	return newVersion
}

// Usage example
func main() {
	currentVersion := &ServiceVersion{
		Semantic:            SemanticVersion{Major: 1, Minor: 0, Patch: 0},
		APIVersion:          "v1",
		ProtocolVersion:      "1.0",
		MinCompatibleClient: SemanticVersion{Major: 1, Minor: 0, Patch: 0},
		MaxCompatibleClient: SemanticVersion{Major: 1, Minor: 99, Patch: 99},
		Features:            []string{"user-management", "authentication"},
		BreakingChanges:     []string{},
		Metadata:            make(map[string]interface{}),
	}

	versionManager := New${toPascalCase(config.serviceName)}VersionManager(currentVersion)

	fmt.Println("Current version:", versionManager.GetVersionInfo())

	// Check compatibility
	result := versionManager.CheckCompatibility("1.0.0")
	fmt.Println("Compatibility check:", result)

	// Create new version
	newVersion := versionManager.CreateNewVersion("minor", []string{"new-feature"}, []string{})
	fmt.Println("New version:", FormatSemanticVersion(newVersion.Semantic))
}
`,
  }];

  const dependencies: string[] = [];

  return { files, dependencies };
}

// Write generated files
export async function writeVersioningFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  // Generate BUILD.md
  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayVersionConfig(config: any): Promise<void> {
  console.log(chalk.bold.yellow('\n🔢 Service Versioning: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Current Version:'), formatSemanticVersion(config.currentVersion.semantic));
  console.log(chalk.cyan('API Version:'), config.currentVersion.apiVersion);
  console.log(chalk.cyan('Protocol Version:'), config.currentVersion.protocolVersion);
  console.log(chalk.cyan('Min Compatible Client:'), formatSemanticVersion(config.currentVersion.minCompatibleClient));
  console.log(chalk.cyan('Max Compatible Client:'), formatSemanticVersion(config.currentVersion.maxCompatibleClient));

  if (config.currentVersion.deprecatedIn) {
    console.log(chalk.yellow('Deprecated In:'), formatSemanticVersion(config.currentVersion.deprecatedIn));
  }

  if (config.currentVersion.removedIn) {
    console.log(chalk.red('Removed In:'), formatSemanticVersion(config.currentVersion.removedIn));
  }

  console.log(chalk.cyan('Strategy:'), config.strategy);

  console.log(chalk.bold('\n📋 Semantic Versioning Rules:'));
  console.log(chalk.gray('  • MAJOR version: Incompatible API changes'));
  console.log(chalk.gray('  • MINOR version: Backwards-compatible functionality'));
  console.log(chalk.gray('  • PATCH version: Backwards-compatible bug fixes'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Service Versioning Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This versioning system provides:
- **Semantic Versioning**: Follow semver specification (MAJOR.MINOR.PATCH)
- **Compatibility Checking**: Validate client version compatibility
- **Graceful Upgrades**: Support multiple versions simultaneously
- **Deprecation Warnings**: Notify clients of deprecated versions
- **Upgrade Path**: Calculate upgrade paths between versions

## Dependencies

${integration.dependencies.length > 0 ? integration.dependencies.map((d: string) => `- \`${d}\``).join('\n') : 'None'}

## Build Steps

1. Copy versioning code to your project
2. Configure current version and compatibility ranges
3. Add version middleware to your HTTP server
4. Test compatibility checks

## Version Format

Semantic versions follow the format: \`MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]\`

Examples:
- \`1.0.0\` - First stable release
- \`2.1.3\` - Major version 2, minor version 1, patch 3
- \`1.0.0-beta.1\` - Beta pre-release
- \`1.0.0+20130313144700\` - Build metadata

## Versioning Rules

### MAJOR version (X.0.0)
- Incompatible API changes
- Breaking changes
- Requires client upgrade

### MINOR version (0.X.0)
- Backwards-compatible functionality
- New features
- Optional client upgrade

### PATCH version (0.0.X)
- Backwards-compatible bug fixes
- No breaking changes
- Recommended client upgrade

## Usage

### TypeScript/Express

\`\`\`typescript
import { ${serviceName}VersionManager, createVersionMiddleware } from './versioning';

const versionManager = new ${serviceName}VersionManager({
  currentVersion: {
    semantic: { major: 1, minor: 0, patch: 0 },
    apiVersion: 'v1',
    protocolVersion: '1.0',
    minCompatibleClient: { major: 1, minor: 0, patch: 0 },
    maxCompatibleClient: { major: 1, minor: 99, patch: 99 },
    features: ['user-management'],
    breakingChanges: [],
  },
  supportedVersions: [],
  versionHistory: [],
});

// Add middleware
app.use(createVersionMiddleware(versionManager));
\`\`\`

### Python/FastAPI

\`\`\`python
from ${serviceName}_versioning import ${toPascalCase(serviceName)}VersionManager, create_version_middleware

version_manager = ${toPascalCase(serviceName)}VersionManager(config)

# Add middleware
app.add_middleware(create_version_middleware(version_manager))
\`\`\`

### Go

\`\`\`go
import "yourpackage/${serviceName}-versioning"

versionManager := New${toPascalCase(serviceName)}VersionManager(currentVersion)

// Add middleware
mux.Use(versionManager.CreateVersionMiddleware())
\`\`\`

## HTTP Headers

### Request Headers
- \`X-Client-Version\`: Client version string (e.g., "1.0.0")

### Response Headers
- \`X-API-Version\`: Current API version (e.g., "v1")
- \`X-Service-Version\`: Current service version (e.g., "1.0.0")
- \`X-Protocol-Version\`: Protocol version (e.g., "1.0")
- \`X-Version-Warnings\`: Compatibility warnings (if any)

## Compatibility Matrix

| Client Version | Service 1.0.x | Service 1.1.x | Service 2.0.x |
|----------------|---------------|---------------|---------------|
| 1.0.x          | ✅ Compatible  | ✅ Compatible  | ❌ Incompatible|
| 1.1.x          | ✅ Compatible  | ✅ Compatible  | ❌ Incompatible|
| 2.0.x          | ❌ Incompatible| ❌ Incompatible| ✅ Compatible  |

## Error Responses

### Incompatible Version
\`\`\`json
{
  "error": "Incompatible client version",
  "clientVersion": "1.0.0",
  "version": {
    "serviceName": "${serviceName}",
    "version": "2.0.0",
    "minCompatibleClient": "2.0.0",
    "maxCompatibleClient": "2.99.99"
  }
}
\`\`\`

## Best Practices

1. **Follow Semver**: Strictly follow semantic versioning
2. **Document Changes**: Maintain changelog for each version
3. **Deprecate Before Removing**: Mark versions as deprecated before removal
4. **Grace Period**: Provide adequate time for upgrades (minimum 6 months)
5. **Compatibility Testing**: Test with all supported client versions
6. **Version Negotiation**: Allow clients to specify preferred version
7. **Clear Communication**: Notify clients of breaking changes in advance
`;
}
