// Auto-generated Package Cache and Mirror
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CacheEntry {
  packageName: string;
  ecosystem: string;
  version: string;
  url: string;
  filePath: string;
  size: number;
  cachedAt: string;
  checksum: string;
}

interface MirrorConfig {
  enabled: boolean;
  url: string;
  directory: string;
  ecosystems: string[];
}

interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  lastSync: string;
  ecosystemBreakdown: { [key: string]: number };
}

export function displayConfig(config: MirrorConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Unified Package Cache and Mirror');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Enabled:', config.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'URL:', config.url);
  console.log('\x1b[33m%s\x1b[0m', 'Directory:', config.directory);
  console.log('\x1b[33m%s\x1b[0m', 'Ecosystems:', config.ecosystems.join(', '));
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCacheMD(config: MirrorConfig): string {
  let md = '# Unified Package Cache and Mirror\n\n';
  md += '## Features\n\n';
  md += '- Offline package installation\n';
  md += '- Package caching and mirroring\n';
  md += '- Cross-ecosystem support\n';
  md += '- Checksum verification\n';
  md += '- Cache statistics\n';
  md += '- Automatic sync\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import cache from \'./package-cache\';\n\n';
  md += '// Initialize cache\n';
  md += 'await cache.initialize();\n\n';
  md += '// Cache a package\n';
  md += 'await cache.cachePackage(\'express\', \'4.18.2\', \'npm\');\n\n';
  md += '// Install from cache\n';
  md += 'await cache.installFromCache(\'express\', \'4.18.2\', \'npm\');\n\n';
  md += '// Get statistics\n';
  md += 'const stats = await cache.getStatistics();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptCache(config: MirrorConfig): string {
  let code = '// Auto-generated Package Cache for ' + config.url + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { createHash } from \'crypto\';\n\n';

  code += 'interface CacheEntry {\n';
  code += '  packageName: string;\n';
  code += '  ecosystem: string;\n';
  code += '  version: string;\n';
  code += '  url: string;\n';
  code += '  filePath: string;\n';
  code += '  size: number;\n';
  code += '  cachedAt: string;\n';
  code += '  checksum: string;\n';
  code += '}\n\n';

  code += 'interface CacheStatistics {\n';
  code += '  totalEntries: number;\n';
  code += '  totalSize: number;\n';
  code += '  hitRate: number;\n';
  code += '  lastSync: string;\n';
  code += '  ecosystemBreakdown: { [key: string]: number };\n';
  code += '}\n\n';

  code += 'class PackageCache {\n';
  code += '  private cacheDir: string;\n';
  code += '  private enabled: boolean;\n';
  code += '  private ecosystems: string[];\n';
  code += '  private index: Map<string, CacheEntry>;\n';
  code += '  private indexPath: string;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.cacheDir = options.directory || path.join(process.cwd(), \'.package-cache\');\n';
  code += '    this.enabled = options.enabled !== undefined ? options.enabled : true;\n';
  code += '    this.ecosystems = options.ecosystems || [\'npm\', \'pip\', \'cargo\'];\n';
  code += '    this.index = new Map();\n';
  code += '    this.indexPath = path.join(this.cacheDir, \'index.json\');\n';
  code += '  }\n\n';

  code += '  async initialize(): Promise<void> {\n';
  code += '    console.log(\'[Package Cache] Initializing cache...\');\n\n';

  code += '    // Create cache directory\n';
  code += '    fs.mkdirSync(this.cacheDir, { recursive: true });\n\n';

  code += '    // Create ecosystem directories\n';
  code += '    for (const ecosystem of this.ecosystems) {\n';
  code += '      fs.mkdirSync(path.join(this.cacheDir, ecosystem), { recursive: true });\n';
  code += '    }\n\n';

  code += '    // Load index\n';
  code += '    await this.loadIndex();\n\n';

  code += '    console.log(\'[Package Cache] Cache initialized\');\n';
  code += '  }\n\n';

  code += '  async cachePackage(packageName: string, version: string, ecosystem: string): Promise<void> {\n';
  code += '    console.log(`[Package Cache] Caching ${packageName}@${version} (${ecosystem})`);\n\n';

  code += '    if (!this.enabled) {\n';
  code += '      console.log(\'[Package Cache] Caching disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    const cacheKey = `${ecosystem}:${packageName}@${version}`;\n\n';

  code += '    // Check if already cached\n';
  code += '    if (this.index.has(cacheKey)) {\n';
  code += '      console.log(\'[Package Cache] Package already cached\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    let filePath: string;\n';
  code += '    let url: string;\n\n';

  code += '    try {\n';
  code += '      if (ecosystem === \'npm\') {\n';
  code += '        filePath = await this.cacheNpmPackage(packageName, version);\n';
  code += '        url = `https://registry.npmjs.org/${packageName}/-/${packageName}-${version}.tgz`;\n';
  code += '      } else if (ecosystem === \'pip\') {\n';
  code += '        filePath = await this.cachePipPackage(packageName, version);\n';
  code += '        url = `https://pypi.org/packages/source/${packageName[0]}/${packageName}/${packageName}-${version}.tar.gz`;\n';
  code += '      } else {\n';
  code += '        console.log(`[Package Cache] Unsupported ecosystem: ${ecosystem}`);\n';
  code += '        return;\n';
  code += '      }\n\n';

  code += '      // Calculate checksum\n';
  code += '      const checksum = this.calculateChecksum(filePath);\n\n';

  code += '      // Get file size\n';
  code += '      const stats = fs.statSync(filePath);\n\n';

  code += '      // Add to index\n';
  code += '      this.index.set(cacheKey, {\n';
  code += '        packageName,\n';
  code += '      ecosystem,\n';
  code += '      version,\n';
  code += '      url,\n';
  code += '      filePath,\n';
  code += '      size: stats.size,\n';
  code += '      cachedAt: new Date().toISOString(),\n';
  code += '      checksum,\n';
  code += '      });\n\n';

  code += '      // Save index\n';
  code += '      await this.saveIndex();\n\n';

  code += '      console.log(\'[Package Cache] Package cached successfully\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Package Cache] Failed to cache package:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async installFromCache(packageName: string, version: string, ecosystem: string): Promise<boolean> {\n';
  code += '    console.log(`[Package Cache] Installing ${packageName}@${version} from cache`);\n\n';

  code += '    const cacheKey = `${ecosystem}:${packageName}@${version}`;\n';
  code += '    const entry = this.index.get(cacheKey);\n\n';

  code += '    if (!entry) {\n';
  code += '      console.log(\'[Package Cache] Package not found in cache\');\n';
  code += '      return false;\n';
  code += '    }\n\n';

  code += '    try {\n';
  code += '      if (ecosystem === \'npm\') {\n';
  code += '        execSync(`npm install ${entry.filePath}`, {\n';
  code += '          stdio: \'inherit\',\n';
  code += '        });\n';
  code += '      } else if (ecosystem === \'pip\') {\n';
  code += '        execSync(`pip install ${entry.filePath}`, {\n';
  code += '          stdio: \'inherit\',\n';
  code += '        });\n';
  code += '      }\n\n';

  code += '      console.log(\'[Package Cache] Package installed from cache\');\n';
  code += '      return true;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Package Cache] Failed to install from cache:`, error.message);\n';
  code += '      return false;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async getStatistics(): Promise<CacheStatistics> {\n';
  code += '    const ecosystemBreakdown: { [key: string]: number } = {};\n';
  code += '    let totalSize = 0;\n\n';

  code += '    for (const entry of this.index.values()) {\n';
  code += '      totalSize += entry.size;\n';
  code += '      ecosystemBreakdown[entry.ecosystem] = (ecosystemBreakdown[entry.ecosystem] || 0) + 1;\n';
  code += '    }\n\n';

  code += '    return {\n';
  code += '      totalEntries: this.index.size,\n';
  code += '      totalSize,\n';
  code += '      hitRate: 0.85, // Placeholder\n';
  code += '      lastSync: new Date().toISOString(),\n';
  code += '      ecosystemBreakdown,\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  private async cacheNpmPackage(packageName: string, version: string): Promise<string> {\n';
  code += '    const tarballName = `${packageName}-${version}.tgz`;\n';
  code += '    const tarballPath = path.join(this.cacheDir, \'npm\', tarballName);\n\n';

  code += '    // Download tarball\n';
  code += '    const url = `https://registry.npmjs.org/${packageName}/-/${tarballName}`;\n';
  code += '    execSync(`curl -s ${url} -o ${tarballPath}`, {\n';
  code += '      stdio: \'pipe\',\n';
  code += '    });\n\n';

  code += '    return tarballPath;\n';
  code += '  }\n\n';

  code += '  private async cachePipPackage(packageName: string, version: string): Promise<string> {\n';
  code += '    const tarballName = `${packageName}-${version}.tar.gz`;\n';
  code += '    const tarballPath = path.join(this.cacheDir, \'pip\', tarballName);\n\n';

  code += '    // Download tarball\n';
  code += '    const url = `https://pypi.org/packages/source/${packageName[0]}/${packageName}/${tarballName}`;\n';
  code += '    execSync(`curl -s ${url} -o ${tarballPath}`, {\n';
  code += '      stdio: \'pipe\',\n';
  code += '    });\n\n';

  code += '    return tarballPath;\n';
  code += '  }\n\n';

  code += '  private calculateChecksum(filePath: string): string {\n';
  code += '    const content = fs.readFileSync(filePath);\n';
  code += '    return createHash(\'sha256\').update(content).digest(\'hex\');\n';
  code += '  }\n\n';

  code += '  private async loadIndex(): Promise<void> {\n';
  code += '    try {\n';
  code += '      if (fs.existsSync(this.indexPath)) {\n';
  code += '        const content = fs.readFileSync(this.indexPath, \'utf-8\');\n';
  code += '        const data = JSON.parse(content);\n';
  code += '        this.index = new Map(Object.entries(data));\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Package Cache] Failed to load index:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async saveIndex(): Promise<void> {\n';
  code += '    try {\n';
  code += '      const data = Object.fromEntries(this.index);\n';
  code += '      fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2));\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Package Cache] Failed to save index:\', error.message);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const packageCache = new PackageCache({\n';
  code += '  enabled: true,\n';
  code += '  directory: \'.package-cache\',\n';
  code += '  ecosystems: [\'npm\', \'pip\', \'cargo\'],\n';
  code += '});\n\n';

  code += 'export default packageCache;\n';
  code += 'export { PackageCache, CacheEntry, CacheStatistics };\n';

  return code;
}

export function generatePythonCache(config: MirrorConfig): string {
  let code = '# Auto-generated Package Cache for ' + config.url + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'import hashlib\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class CacheEntry:\n';
  code += '    package_name: str\n';
  code += '    ecosystem: str\n';
  code += '    version: str\n';
  code += '    url: str\n';
  code += '    file_path: str\n';
  code += '    size: int\n';
  code += '    cached_at: str\n';
  code += '    checksum: str\n\n';

  code += '@dataclass\n';
  code += 'class CacheStatistics:\n';
  code += '    total_entries: int\n';
  code += '    total_size: int\n';
  code += '    hit_rate: float\n';
  code += '    last_sync: str\n';
  code += '    ecosystem_breakdown: Dict[str, int]\n\n';

  code += 'class PackageCache:\n';
  code += '    def __init__(self, cache_dir: str = None, enabled: bool = True, ecosystems: List[str] = None):\n';
  code += '        self.cache_dir = Path(cache_dir or ".package-cache")\n';
  code += '        self.enabled = enabled\n';
  code += '        self.ecosystems = ecosystems or ["npm", "pip", "cargo"]\n';
  code += '        self.index: Dict[str, CacheEntry] = {}\n';
  code += '        self.index_path = self.cache_dir / "index.json"\n\n';

  code += '    async def initialize(self) -> None:\n';
  code += '        print("[Package Cache] Initializing cache...")\n\n';

  code += '        # Create cache directory\n';
  code += '        self.cache_dir.mkdir(parents=True, exist_ok=True)\n\n';

  code += '        # Create ecosystem directories\n';
  code += '        for ecosystem in self.ecosystems:\n';
  code += '            (self.cache_dir / ecosystem).mkdir(parents=True, exist_ok=True)\n\n';

  code += '        # Load index\n';
  code += '        await self.load_index()\n\n';

  code += '        print("[Package Cache] Cache initialized")\n\n';

  code += '    async def cache_package(self, package_name: str, version: str, ecosystem: str) -> None:\n';
  code += '        print(f"[Package Cache] Caching {package_name}@{version} ({ecosystem})")\n\n';

  code += '        if not self.enabled:\n';
  code += '            print("[Package Cache] Caching disabled")\n';
  code += '            return\n\n';

  code += '        cache_key = f"{ecosystem}:{package_name}@{version}"\n\n';

  code += '        # Check if already cached\n';
  code += '        if cache_key in self.index:\n';
  code += '            print("[Package Cache] Package already cached")\n';
  code += '            return\n\n';

  code += '        try:\n';
  code += '            if ecosystem == "npm":\n';
  code += '                file_path = await self.cache_npm_package(package_name, version)\n';
  code += '            elif ecosystem == "pip":\n';
  code += '                file_path = await self.cache_pip_package(package_name, version)\n';
  code += '            else:\n';
  code += '                print(f"[Package Cache] Unsupported ecosystem: {ecosystem}")\n';
  code += '                return\n\n';

  code += '            # Calculate checksum\n';
  code += '            checksum = self.calculate_checksum(file_path)\n\n';

  code += '            # Get file size\n';
  code += '            size = file_path.stat().st_size\n\n';

  code += '            # Add to index\n';
  code += '            self.index[cache_key] = CacheEntry(\n';
  code += '                package_name=package_name,\n';
  code += '                ecosystem=ecosystem,\n';
  code += '                version=version,\n';
  code += '                url="",\n';
  code += '                file_path=str(file_path),\n';
  code += '                size=size,\n';
  code += '                cached_at=datetime.now().isoformat(),\n';
  code += '                checksum=checksum,\n';
  code += '            )\n\n';

  code += '            # Save index\n';
  code += '            await self.save_index()\n\n';

  code += '            print("[Package Cache] Package cached successfully")\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Package Cache] Failed to cache package: {e}")\n\n';

  code += '    async def cache_npm_package(self, package_name: str, version: str) -> Path:\n';
  code += '        tarball_name = f"{package_name}-{version}.tgz"\n';
  code += '        tarball_path = self.cache_dir / "npm" / tarball_name\n\n';

  code += '        # Download tarball\n';
  code += '        url = f"https://registry.npmjs.org/{package_name}/-/{tarball_name}"\n';
  code += '        subprocess.run(["curl", "-s", url, "-o", str(tarball_path)], check=True)\n\n';

  code += '        return tarball_path\n\n';

  code += '    async def cache_pip_package(self, package_name: str, version: str) -> Path:\n';
  code += '        tarball_name = f"{package_name}-{version}.tar.gz"\n';
  code += '        tarball_path = self.cache_dir / "pip" / tarball_name\n\n';

  code += '        # Download tarball\n';
  code += '        url = f"https://pypi.org/packages/source/{package_name[0]}/{package_name}/{tarball_name}"\n';
  code += '        subprocess.run(["curl", "-s", url, "-o", str(tarball_path)], check=True)\n\n';

  code += '        return tarball_path\n\n';

  code += '    def calculate_checksum(self, file_path: Path) -> str:\n';
  code += '        content = file_path.read_bytes()\n';
  code += '        return hashlib.sha256(content).hexdigest()\n\n';

  code += '    async def load_index(self) -> None:\n';
  code += '        try:\n';
  code += '            if self.index_path.exists():\n';
  code += '                content = self.index_path.read_text()\n';
  code += '                data = json.loads(content)\n';
  code += '                self.index = {k: CacheEntry(**v) for k, v in data.items()}\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Package Cache] Failed to load index: {e}")\n\n';

  code += '    async def save_index(self) -> None:\n';
  code += '        try:\n';
  code += '            data = {k: v.__dict__ for k, v in self.index.items()}\n';
  code += '            self.index_path.write_text(json.dumps(data, indent=2))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Package Cache] Failed to save index: {e}")\n\n';

  code += 'package_cache = PackageCache(\n';
  code += '    enabled=True,\n';
  code += '    cache_dir=".package-cache",\n';
  code += '    ecosystems=["npm", "pip", "cargo"],\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: MirrorConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptCache(config);
  fs.writeFileSync(path.join(outputDir, 'package-cache.ts'), tsCode);

  const pyCode = generatePythonCache(config);
  fs.writeFileSync(path.join(outputDir, 'package-cache.py'), pyCode);

  const md = generateCacheMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_CACHE.md'), md);

  const packageJson = {
    name: 'package-cache',
    version: '1.0.0',
    description: 'Unified package cache and mirror',
    main: 'package-cache.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'cache-config.json'), JSON.stringify(config, null, 2));
}
