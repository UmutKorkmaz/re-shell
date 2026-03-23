// Auto-generated Package Compatibility Matrix
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface PackageConstraint {
  name: string;
  version: string;
  ecosystem: string;
  constraints: string[];
  conflicts: string[];
  dependencies: string[];
}

interface CompatibilityMatrix {
  packages: Map<string, PackageConstraint>;
  conflicts: Conflict[];
  resolutions: Resolution[];
}

interface Conflict {
  package1: string;
  package2: string;
  reason: string;
  severity: 'error' | 'warning' | 'info';
  suggestedResolution: string;
}

interface Resolution {
  type: 'upgrade' | 'downgrade' | 'replace' | 'ignore';
  package: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
}

interface CompatibilityConfig {
  projectName: string;
  checkTransitive: boolean;
  ignoreDevDependencies: boolean;
}

export function displayConfig(config: CompatibilityConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Package Compatibility Matrix');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Check Transitive:', config.checkTransitive ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Ignore Dev Dependencies:', config.ignoreDevDependencies ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCompatibilityMD(config: CompatibilityConfig): string {
  let md = '# Package Compatibility Matrix\n\n';
  md += '## Features\n\n';
  md += '- Cross-language compatibility checking\n';
  md += '- Version constraint resolution\n';
  md += '- Conflict detection and resolution\n';
  md += '- Transitive dependency analysis\n';
  md += '- Semantic versioning support\n';
  md += '- Ecosystem-specific rules\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import compatibility from \'./package-compatibility\';\n\n';
  md += '// Build compatibility matrix\n';
  md += 'const matrix = await compatibility.buildMatrix();\n\n';
  md += '// Check for conflicts\n';
  md += 'const conflicts = await compatibility.checkConflicts(matrix);\n\n';
  md += '// Resolve conflicts\n';
  md += 'const resolutions = await compatibility.resolveConflicts(conflicts);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptCompatibility(config: CompatibilityConfig): string {
  let code = '// Auto-generated Package Compatibility for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface PackageConstraint {\n';
  code += '  name: string;\n';
  code += '  version: string;\n';
  code += '  ecosystem: string;\n';
  code += '  constraints: string[];\n';
  code += '  conflicts: string[];\n';
  code += '  dependencies: string[];\n';
  code += '}\n\n';

  code += 'interface Conflict {\n';
  code += '  package1: string;\n';
  code += '  package2: string;\n';
  code += '  reason: string;\n';
  code += '  severity: \'error\' | \'warning\' | \'info\';\n';
  code += '  suggestedResolution: string;\n';
  code += '}\n\n';

  code += 'interface Resolution {\n';
  code += '  type: \'upgrade\' | \'downgrade\' | \'replace\' | \'ignore\';\n';
  code += '  package: string;\n';
  code += '  fromVersion: string;\n';
  code += '  toVersion: string;\n';
  code += '  reason: string;\n';
  code += '}\n\n';

  code += 'interface CompatibilityMatrix {\n';
  code += '  packages: Map<string, PackageConstraint>;\n';
  code += '  conflicts: Conflict[];\n';
  code += '  resolutions: Resolution[];\n';
  code += '}\n\n';

  code += 'class PackageCompatibility {\n';
  code += '  private projectRoot: string;\n';
  code += '  private checkTransitive: boolean;\n';
  code += '  private ignoreDevDependencies: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.checkTransitive = options.checkTransitive !== undefined ? options.checkTransitive : true;\n';
  code += '    this.ignoreDevDependencies = options.ignoreDevDependencies !== undefined ? options.ignoreDevDependencies : false;\n';
  code += '  }\n\n';

  code += '  async buildMatrix(): Promise<CompatibilityMatrix> {\n';
  code += '    console.log(\'[Compatibility] Building package compatibility matrix...\');\n\n';

  code += '    const matrix: CompatibilityMatrix = {\n';
  code += '      packages: new Map(),\n';
  code += '      conflicts: [],\n';
  code += '      resolutions: [],\n';
  code += '    };\n\n';

  code += '    // Collect packages from all ecosystems\n';
  code += '    const npmPackages = this.collectNpmPackages();\n';
  code += '    const pipPackages = this.collectPipPackages();\n';
  code += '    const cargoPackages = this.collectCargoPackages();\n\n';

  code += '    // Add to matrix\n';
  code += '    for (const pkg of npmPackages) {\n';
  code += '      matrix.packages.set(`npm:${pkg.name}`, pkg);\n';
  code += '    }\n';
  code += '    for (const pkg of pipPackages) {\n';
  code += '      matrix.packages.set(`pip:${pkg.name}`, pkg);\n';
  code += '    }\n';
  code += '    for (const pkg of cargoPackages) {\n';
  code += '      matrix.packages.set(`cargo:${pkg.name}`, pkg);\n';
  code += '    }\n\n';

  code += '    // Check for conflicts\n';
  code += '    matrix.conflicts = await this.checkConflicts(matrix);\n\n';

  code += '    console.log(`[Compatibility] Found ${matrix.conflicts.length} conflicts`);\n\n';

  code += '    return matrix;\n';
  code += '  }\n\n';

  code += '  async checkConflicts(matrix: CompatibilityMatrix): Promise<Conflict[]> {\n';
  code += '    const conflicts: Conflict[] = [];\n';
  code += '    const packages = Array.from(matrix.packages.values());\n\n';

  code += '    // Check for version conflicts\n';
  code += '    for (let i = 0; i < packages.length; i++) {\n';
  code += '      for (let j = i + 1; j < packages.length; j++) {\n';
  code += '        const pkg1 = packages[i];\n';
  code += '        const pkg2 = packages[j];\n\n';

  code += '        // Same package, different versions\n';
  code += '        if (pkg1.name === pkg2.name && pkg1.version !== pkg2.version) {\n';
  code += '          conflicts.push({\n';
  code += '            package1: `${pkg1.ecosystem}:${pkg1.name}@${pkg1.version}`,\n';
  code += '            package2: `${pkg2.ecosystem}:${pkg2.name}@${pkg2.version}`,\n';
  code += '            reason: \'Version conflict\',\n';
  code += '            severity: \'error\',\n';
  code += '            suggestedResolution: `Unify to latest compatible version`,\n';
  code += '          });\n';
  code += '        }\n\n';

  code += '        // Check for known incompatibilities\n';
  code += '        const knownConflict = this.checkKnownIncompatibility(pkg1, pkg2);\n';
  code += '        if (knownConflict) {\n';
  code += '          conflicts.push(knownConflict);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    // Check constraint violations\n';
  code += '    for (const pkg of packages) {\n';
  code += '      for (const constraint of pkg.constraints) {\n';
  code += '        if (!this.checkConstraint(pkg, constraint)) {\n';
  code += '          conflicts.push({\n';
  code += '            package1: pkg.name,\n';
  code += '            package2: constraint,\n';
  code += '            reason: `Constraint violation: ${constraint}`,\n';
  code += '            severity: \'warning\',\n';
  code += '            suggestedResolution: `Adjust version to meet constraint`,\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return conflicts;\n';
  code += '  }\n\n';

  code += '  async resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]> {\n';
  code += '    const resolutions: Resolution[] = [];\n\n';

  code += '    for (const conflict of conflicts) {\n';
  code += '      // Auto-resolve based on severity\n';
  code += '      if (conflict.severity === \'error\') {\n';
  code += '        resolutions.push({\n';
  code += '          type: \'upgrade\',\n';
  code += '          package: conflict.package1,\n';
  code += '          fromVersion: conflict.package1.split(\'@\')[1],\n';
  code += '          toVersion: \'latest\',\n';
  code += '          reason: conflict.reason,\n';
  code += '        });\n';
  code += '      } else if (conflict.severity === \'warning\') {\n';
  code += '        resolutions.push({\n';
  code += '          type: \'ignore\',\n';
  code += '          package: conflict.package1,\n';
  code += '          fromVersion: \'*\',\n';
  code += '          toVersion: \'*\',\n';
  code += '          reason: \'Warning only, can be ignored\',\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return resolutions;\n';
  code += '  }\n\n';

  code += '  private collectNpmPackages(): PackageConstraint[] {\n';
  code += '    const packages: PackageConstraint[] = [];\n\n';

  code += '    try {\n';
  code += '      const packageJsonPath = path.join(this.projectRoot, \'package.json\');\n';
  code += '      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, \'utf-8\'));\n\n';

  code += '      const deps = packageJson.dependencies || {};\n';
  code += '      const devDeps = this.ignoreDevDependencies ? {} : (packageJson.devDependencies || {});\n\n';

  code += '      for (const [name, version] of Object.entries({ ...deps, ...devDeps })) {\n';
  code += '        packages.push({\n';
  code += '          name,\n';
  code += '          version: version as string,\n';
  code += '          ecosystem: \'npm\',\n';
  code += '          constraints: [],\n';
  code += '          conflicts: [],\n';
  code += '          dependencies: [],\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Compatibility] Failed to read package.json:\', error.message);\n';
  code += '    }\n\n';

  code += '    return packages;\n';
  code += '  }\n\n';

  code += '  private collectPipPackages(): PackageConstraint[] {\n';
  code += '    const packages: PackageConstraint[] = [];\n\n';

  code += '    try {\n';
  code += '      const requirementsPath = path.join(this.projectRoot, \'requirements.txt\');\n';
  code += '      const requirements = fs.readFileSync(requirementsPath, \'utf-8\').split(\'\\n\');\n\n';

  code += '      for (const line of requirements) {\n';
  code += '        const match = line.match(/^([\\w-]+)\\s*([>=<~!]+.*)?$/);\n';
  code += '        if (match) {\n';
  code += '          packages.push({\n';
  code += '            name: match[1],\n';
  code += '            version: match[2] || \'*\',\n';
  code += '            ecosystem: \'pip\',\n';
  code += '            constraints: [],\n';
  code += '            conflicts: [],\n';
  code += '            dependencies: [],\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // No requirements.txt or error reading it\n';
  code += '    }\n\n';

  code += '    return packages;\n';
  code += '  }\n\n';

  code += '  private collectCargoPackages(): PackageConstraint[] {\n';
  code += '    const packages: PackageConstraint[] = [];\n\n';

  code += '    try {\n';
  code += '      const cargoPath = path.join(this.projectRoot, \'Cargo.toml\');\n';
  code += '      const cargo = fs.readFileSync(cargoPath, \'utf-8\');\n\n';

  code += '      // Parse [dependencies] section\n';
  code += '      const lines = cargo.split(\'\\n\');\n';
  code += '      let inDeps = false;\n\n';

  code += '      for (const line of lines) {\n';
  code += '        if (line.trim() === \'[dependencies]\') {\n';
  code += '          inDeps = true;\n';
  code += '          continue;\n';
  code += '        }\n';
  code += '        if (inDeps && line.startsWith(\'[\')) {\n';
  code += '          break;\n';
  code += '        }\n';
  code += '        if (inDeps) {\n';
  code += '          const match = line.match(/^([\\w-]+)\\s*=\\s*"(.*)"$/);\n';
  code += '          if (match) {\n';
  code += '            packages.push({\n';
  code += '              name: match[1],\n';
  code += '              version: match[2],\n';
  code += '              ecosystem: \'cargo\',\n';
  code += '              constraints: [],\n';
  code += '              conflicts: [],\n';
  code += '              dependencies: [],\n';
  code += '            });\n';
  code += '          }\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // No Cargo.toml or error reading it\n';
  code += '    }\n\n';

  code += '    return packages;\n';
  code += '  }\n\n';

  code += '  private checkKnownIncompatibility(pkg1: PackageConstraint, pkg2: PackageConstraint): Conflict | null {\n';
  code += '    // Known incompatible package combinations\n';
  code += '    const incompatibilities: { [key: string]: string[] } = {\n';
  code += '      \'npm:webpack@4\': [\'npm:webpack@5\'],\n';
  code += '      \'npm:react@17\': [\'npm:react@18\', \'npm:react-native@0.70+\'],\n';
  code += '      \'npm:typescript@4\': [\'npm:typescript@5\'],\n';
  code += '    };\n\n';

  code += '    const key1 = `${pkg1.ecosystem}:${pkg1.name}@${pkg1.version}`;\n';
  code += '    const key2 = `${pkg2.ecosystem}:${pkg2.name}@${pkg2.version}`;\n\n';

  code += '    if (incompatibilities[key1]?.includes(key2)) {\n';
  code += '      return {\n';
  code += '        package1: key1,\n';
  code += '        package2: key2,\n';
  code += '        reason: \'Known incompatibility\',\n';
  code += '        severity: \'error\',\n';
  code += '        suggestedResolution: `Remove or upgrade one of the packages`,\n';
  code += '      };\n';
  code += '    }\n\n';

  code += '    return null;\n';
  code += '  }\n\n';

  code += '  private checkConstraint(pkg: PackageConstraint, constraint: string): boolean {\n';
  code += '    // Simple semver constraint checking\n';
  code += '    const version = pkg.version.replace(/^[^0-9]*/, \'\');\n';
  code += '    const constraintVersion = constraint.replace(/^[^0-9]*/, \'\');\n\n';

  code += '    // This is a simplified check - real implementation would use semver library\n';
  code += '    return version >= constraintVersion;\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const compatibility = new PackageCompatibility({\n';
  code += '  checkTransitive: true,\n';
  code += '  ignoreDevDependencies: false,\n';
  code += '});\n\n';

  code += 'export default compatibility;\n';
  code += 'export { PackageCompatibility, CompatibilityMatrix, Conflict, Resolution, PackageConstraint };\n';

  return code;
}

export function generatePythonCompatibility(config: CompatibilityConfig): string {
  let code = '# Auto-generated Package Compatibility for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict, Tuple\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class PackageConstraint:\n';
  code += '    name: str\n';
  code += '    version: str\n';
  code += '    ecosystem: str\n';
  code += '    constraints: List[str]\n';
  code += '    conflicts: List[str]\n';
  code += '    dependencies: List[str]\n\n';

  code += '@dataclass\n';
  code += 'class Conflict:\n';
  code += '    package1: str\n';
  code += '    package2: str\n';
  code += '    reason: str\n';
  code += '    severity: str\n';
  code += '    suggested_resolution: str\n\n';

  code += '@dataclass\n';
  code += 'class Resolution:\n';
  code += '    type: str\n';
  code += '    package: str\n';
  code += '    from_version: str\n';
  code += '    to_version: str\n';
  code += '    reason: str\n\n';

  code += '@dataclass\n';
  code += 'class CompatibilityMatrix:\n';
  code += '    packages: Dict[str, PackageConstraint]\n';
  code += '    conflicts: List[Conflict]\n';
  code += '    resolutions: List[Resolution]\n\n';

  code += 'class PackageCompatibility:\n';
  code += '    def __init__(self, project_root: str = None, check_transitive: bool = True, ignore_dev: bool = False):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.check_transitive = check_transitive\n';
  code += '        self.ignore_dev = ignore_dev\n\n';

  code += '    async def build_matrix(self) -> CompatibilityMatrix:\n';
  code += '        print("[Compatibility] Building package compatibility matrix...")\n\n';

  code += '        matrix = CompatibilityMatrix(\n';
  code += '            packages={},\n';
  code += '            conflicts=[],\n';
  code += '            resolutions=[],\n';
  code += '        )\n\n';

  code += '        # Collect packages from all ecosystems\n';
  code += '        npm_packages = self.collect_npm_packages()\n';
  code += '        pip_packages = self.collect_pip_packages()\n';
  code += '        cargo_packages = self.collect_cargo_packages()\n\n';

  code += '        # Add to matrix\n';
  code += '        for pkg in npm_packages:\n';
  code += '            matrix.packages[f"npm:{pkg.name}"] = pkg\n';
  code += '        for pkg in pip_packages:\n';
  code += '            matrix.packages[f"pip:{pkg.name}"] = pkg\n';
  code += '        for pkg in cargo_packages:\n';
  code += '            matrix.packages[f"cargo:{pkg.name}"] = pkg\n\n';

  code += '        # Check for conflicts\n';
  code += '        matrix.conflicts = await self.check_conflicts(matrix)\n\n';

  code += '        print(f"[Compatibility] Found {len(matrix.conflicts)} conflicts")\n\n';

  code += '        return matrix\n\n';

  code += '    async def check_conflicts(self, matrix: CompatibilityMatrix) -> List[Conflict]:\n';
  code += '        conflicts = []\n';
  code += '        packages = list(matrix.packages.values())\n\n';

  code += '        # Check for version conflicts\n';
  code += '        for i in range(len(packages)):\n';
  code += '            for j in range(i + 1, len(packages)):\n';
  code += '                pkg1 = packages[i]\n';
  code += '                pkg2 = packages[j]\n\n';

  code += '                # Same package, different versions\n';
  code += '                if pkg1.name == pkg2.name and pkg1.version != pkg2.version:\n';
  code += '                    conflicts.append(Conflict(\n';
  code += '                        package1=f"{pkg1.ecosystem}:{pkg1.name}@{pkg1.version}",\n';
  code += '                        package2=f"{pkg2.ecosystem}:{pkg2.name}@{pkg2.version}",\n';
  code += '                        reason="Version conflict",\n';
  code += '                        severity="error",\n';
  code += '                        suggested_resolution="Unify to latest compatible version",\n';
  code += '                    ))\n\n';

  code += '                # Check for known incompatibilities\n';
  code += '                known_conflict = self.check_known_incompatibility(pkg1, pkg2)\n';
  code += '                if known_conflict:\n';
  code += '                    conflicts.append(known_conflict)\n\n';

  code += '        return conflicts\n\n';

  code += '    async def resolve_conflicts(self, conflicts: List[Conflict]) -> List[Resolution]:\n';
  code += '        resolutions = []\n\n';

  code += '        for conflict in conflicts:\n';
  code += '            # Auto-resolve based on severity\n';
  code += '            if conflict.severity == "error":\n';
  code += '                resolutions.append(Resolution(\n';
  code += '                    type="upgrade",\n';
  code += '                    package=conflict.package1,\n';
  code += '                    from_version=conflict.package1.split("@")[1],\n';
  code += '                    to_version="latest",\n';
  code += '                    reason=conflict.reason,\n';
  code += '                ))\n';
  code += '            elif conflict.severity == "warning":\n';
  code += '                resolutions.append(Resolution(\n';
  code += '                    type="ignore",\n';
  code += '                    package=conflict.package1,\n';
  code += '                    from_version="*",\n';
  code += '                    to_version="*",\n';
  code += '                    reason="Warning only, can be ignored",\n';
  code += '                ))\n\n';

  code += '        return resolutions\n\n';

  code += '    def collect_npm_packages(self) -> List[PackageConstraint]:\n';
  code += '        packages = []\n\n';

  code += '        try:\n';
  code += '            package_json_path = self.project_root / "package.json"\n';
  code += '            package_json = json.loads(package_json_path.read_text())\n\n';

  code += '            deps = package_json.get("dependencies", {})\n';
  code += '            dev_deps = {} if self.ignore_dev else package_json.get("devDependencies", {})\n\n';

  code += '            for name, version in {**deps, **dev_deps}.items():\n';
  code += '                packages.append(PackageConstraint(\n';
  code += '                    name=name,\n';
  code += '                    version=version,\n';
  code += '                    ecosystem="npm",\n';
  code += '                    constraints=[],\n';
  code += '                    conflicts=[],\n';
  code += '                    dependencies=[],\n';
  code += '                ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Compatibility] Failed to read package.json: {e}")\n\n';

  code += '        return packages\n\n';

  code += '    def collect_pip_packages(self) -> List[PackageConstraint]:\n';
  code += '        packages = []\n\n';

  code += '        try:\n';
  code += '            requirements_path = self.project_root / "requirements.txt"\n';
  code += '            requirements = requirements_path.read_text().split("\\n")\n\n';

  code += '            for line in requirements:\n';
  code += '                import re\n';
  code += '                match = re.match(r"^([\\w-]+)\\s*([>=<~!]+.*)?$", line)\n';
  code += '                if match:\n';
  code += '                    packages.append(PackageConstraint(\n';
  code += '                        name=match.group(1),\n';
  code += '                        version=match.group(2) or "*",\n';
  code += '                        ecosystem="pip",\n';
  code += '                        constraints=[],\n';
  code += '                        conflicts=[],\n';
  code += '                        dependencies=[],\n';
  code += '                    ))\n';
  code += '        except Exception:\n';
  code += '            pass  # No requirements.txt or error reading it\n\n';

  code += '        return packages\n\n';

  code += '    def check_known_incompatibility(self, pkg1: PackageConstraint, pkg2: PackageConstraint) -> Optional[Conflict]:\n';
  code += '        # Known incompatible package combinations\n';
  code += '        incompatibilities = {\n';
  code += '            "npm:webpack@4": ["npm:webpack@5"],\n';
  code += '            "npm:react@17": ["npm:react@18", "npm:react-native@0.70+"],\n';
  code += '            "npm:typescript@4": ["npm:typescript@5"],\n';
  code += '        }\n\n';

  code += '        key1 = f"{pkg1.ecosystem}:{pkg1.name}@{pkg1.version}"\n';
  code += '        key2 = f"{pkg2.ecosystem}:{pkg2.name}@{pkg2.version}"\n\n';

  code += '        if key1 in incompatibilities and key2 in incompatibilities[key1]:\n';
  code += '            return Conflict(\n';
  code += '                package1=key1,\n';
  code += '                package2=key2,\n';
  code += '                reason="Known incompatibility",\n';
  code += '                severity="error",\n';
  code += '                suggested_resolution="Remove or upgrade one of the packages",\n';
  code += '            )\n\n';

  code += '        return None\n\n';

  code += 'compatibility = PackageCompatibility(\n';
  code += '    check_transitive=True,\n';
  code += '    ignore_dev=False,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: CompatibilityConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptCompatibility(config);
  fs.writeFileSync(path.join(outputDir, 'package-compatibility.ts'), tsCode);

  const pyCode = generatePythonCompatibility(config);
  fs.writeFileSync(path.join(outputDir, 'package-compatibility.py'), pyCode);

  const md = generateCompatibilityMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_COMPATIBILITY.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Package compatibility matrix',
    main: 'package-compatibility.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'compatibility-config.json'), JSON.stringify(config, null, 2));
}
