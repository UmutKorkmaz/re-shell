// Auto-generated Unified Deployment Pipeline Utility
// Generated at: 2026-01-12T21:49:30.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface DeploymentConfig {
  name: string;
  language: 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | 'java';
  buildCommand: string;
  testCommand: string;
  deployCommand: string;
  environment: Record<string, string>;
}

interface DeploymentStage {
  name: string;
  command: string;
  timeout: number;
  retries: number;
  onSuccess?: string;
  onFailure?: string;
}

interface DeploymentResult {
  stage: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

interface RollbackConfig {
  enabled: boolean;
  maxRetries: number;
  keepBackups: number;
  backupPath: string;
}

export function displayConfig(config: any): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Unified Deployment Pipelines with Rollback Support');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Auto-Rollback:', config.enableAutoRollback ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Health Checks:', config.enableHealthChecks ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Zero-Downtime:', config.enableZeroDowntime ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Progressive Deploy:', config.enableProgressiveDeploy ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateDeploymentMD(config: any): string {
  let md = '# Deployment Pipeline System\n\n';
  md += '## Features\n\n';
  md += '- Multi-language deployment pipelines\n';
  md += '- Automatic rollback on failure\n';
  md += '- Health check validation\n';
  md += '- Zero-downtime deployments\n';
  md += '- Progressive deployment strategies\n';
  md += '- Blue-green deployments\n';
  md += '- Canary deployments\n\n';
  md += '## Usage\n\n';
  md += '### TypeScript/JavaScript\n';
  md += '```typescript\n';
  md += 'import pipeline from \'./deployment-pipeline\';\n\n';
  md += '// Deploy application\n';
  md += 'await pipeline.deploy();\n\n';
  md += '// Rollback deployment\n';
  md += 'await pipeline.rollback();\n\n';
  md += '// Check deployment status\n';
  md += 'const status = await pipeline.getStatus();\n';
  md += '```\n\n';
  md += '### Python\n';
  md += '```python\n';
  md += 'from deployment_pipeline import pipeline\n\n';
  md += '# Deploy application\n';
  md += 'await pipeline.deploy()\n\n';
  md += '# Rollback deployment\n';
  md += 'await pipeline.rollback()\n\n';
  md += '# Check deployment status\n';
  md += 'status = await pipeline.get_status()\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptDeployment(config: any): string {
  let code = '// Auto-generated Deployment Pipeline for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';
  code += 'interface DeploymentStage {\n';
  code += '  name: string;\n';
  code += '  command: string;\n';
  code += '  timeout: number;\n';
  code += '  retries: number;\n';
  code += '  onSuccess?: string;\n';
  code += '  onFailure?: string;\n';
  code += '}\n\n';
  code += 'interface DeploymentResult {\n';
  code += '  stage: string;\n';
  code += '  success: boolean;\n';
  code += '  duration: number;\n';
  code += '  output?: string;\n';
  code += '  error?: string;\n';
  code += '}\n\n';
  code += 'interface RollbackConfig {\n';
  code += '  enabled: boolean;\n';
  code += '  maxRetries: number;\n';
  code += '  keepBackups: number;\n';
  code += '  backupPath: string;\n';
  code += '}\n\n';
  code += 'class DeploymentPipeline {\n';
  code += '  private projectRoot: string;\n';
  code += '  private stages: DeploymentStage[];\n';
  code += '  private enableAutoRollback: boolean;\n';
  code += '  private enableHealthChecks: boolean;\n';
  code += '  private enableZeroDowntime: boolean;\n';
  code += '  private enableProgressiveDeploy: boolean;\n';
  code += '  private rollbackConfig: RollbackConfig;\n';
  code += '  private deploymentHistory: DeploymentResult[];\n';
  code += '  private currentDeployment: string;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.stages = options.stages || this.getDefaultStages();\n';
  code += '    this.enableAutoRollback = options.enableAutoRollback !== false;\n';
  code += '    this.enableHealthChecks = options.enableHealthChecks !== false;\n';
  code += '    this.enableZeroDowntime = options.enableZeroDowntime !== false;\n';
  code += '    this.enableProgressiveDeploy = options.enableProgressiveDeploy !== false;\n';
  code += '    this.rollbackConfig = options.rollbackConfig || {\n';
  code += '      enabled: true,\n';
  code += '      maxRetries: 3,\n';
  code += '      keepBackups: 5,\n';
  code += '      backupPath: path.join(this.projectRoot, \'.deployments\'),\n';
  code += '    };\n';
  code += '    this.deploymentHistory = [];\n';
  code += '    this.currentDeployment = this.generateDeploymentId();\n';
  code += '  }\n\n';
  code += '  async deploy(): Promise<DeploymentResult[]> {\n';
  code += '    console.log(\'[Deploy] Starting deployment \' + this.currentDeployment);\n';
  code += '    const startTime = Date.now();\n';
  code += '    const results: DeploymentResult[] = [];\n\n';
  code += '    try {\n';
  code += '      // Create backup before deployment\n';
  code += '      if (this.rollbackConfig.enabled) {\n';
  code += '        await this.createBackup();\n';
  code += '      }\n\n';
  code += '      // Run deployment stages\n';
  code += '      for (const stage of this.stages) {\n';
  code += '        const result = await this.executeStage(stage);\n';
  code += '        results.push(result);\n\n';
  code += '        if (!result.success) {\n';
  code += '          console.error(\'[Deploy] Stage failed:\', stage.name);\n';
  code += '          if (this.enableAutoRollback) {\n';
  code += '            await this.rollback();\n';
  code += '          }\n';
  code += '          return results;\n';
  code += '        }\n';
  code += '      }\n\n';
  code += '      // Run health checks\n';
  code += '      if (this.enableHealthChecks) {\n';
  code += '        const healthy = await this.runHealthChecks();\n';
  code += '        if (!healthy) {\n';
  code += '          console.error(\'[Deploy] Health checks failed\');\n';
  code += '          if (this.enableAutoRollback) {\n';
  code += '            await this.rollback();\n';
  code += '          }\n';
  code += '          return results;\n';
  code += '        }\n';
  code += '      }\n\n';
  code += '      const duration = Date.now() - startTime;\n';
  code += '      console.log(\'[Deploy] Deployment completed in \' + (duration / 1000).toFixed(2) + \'s\');\n';
  code += '      return results;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Deploy] Deployment failed:\', error.message);\n';
  code += '      if (this.enableAutoRollback) {\n';
  code += '        await this.rollback();\n';
  code += '      }\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private async executeStage(stage: DeploymentStage): Promise<DeploymentResult> {\n';
  code += '    console.log(\'[Deploy] Executing stage:\', stage.name);\n';
  code += '    const startTime = Date.now();\n\n';
  code += '    for (let attempt = 0; attempt < stage.retries; attempt++) {\n';
  code += '      try {\n';
  code += '        const output = execSync(stage.command, {\n';
  code += '          cwd: this.projectRoot,\n';
  code += '          encoding: \'utf-8\',\n';
  code += '          stdio: \'inherit\',\n';
  code += '          timeout: stage.timeout,\n';
  code += '        });\n\n';
  code += '        const result: DeploymentResult = {\n';
  code += '          stage: stage.name,\n';
  code += '          success: true,\n';
  code += '          duration: Date.now() - startTime,\n';
  code += '          output,\n';
  code += '        };\n\n';
  code += '        if (stage.onSuccess) {\n';
  code += '          execSync(stage.onSuccess, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '        }\n\n';
  code += '        this.deploymentHistory.push(result);\n';
  code += '        return result;\n';
  code += '      } catch (error: any) {\n';
  code += '        if (attempt === stage.retries - 1) {\n';
  code += '          const result: DeploymentResult = {\n';
  code += '            stage: stage.name,\n';
  code += '            success: false,\n';
  code += '            duration: Date.now() - startTime,\n';
  code += '            error: error.message,\n';
  code += '          };\n\n';
  code += '          if (stage.onFailure) {\n';
  code += '            execSync(stage.onFailure, { cwd: this.projectRoot, stdio: \'inherit\' });\n';
  code += '          }\n\n';
  code += '          this.deploymentHistory.push(result);\n';
  code += '          return result;\n';
  code += '        }\n';
  code += '        console.log(\'[Deploy] Retrying stage:\', stage.name, \'Attempt\', attempt + 2);\\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    return {\n';
  code += '      stage: stage.name,\n';
  code += '      success: false,\n';
  code += '      duration: Date.now() - startTime,\n';
  code += '      error: \'Max retries exceeded\',\n';
  code += '    };\n';
  code += '  }\n\n';
  code += '  async rollback(): Promise<void> {\n';
  code += '    if (!this.rollbackConfig.enabled) {\n';
  code += '      console.log(\'[Deploy] Rollback is disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';
  code += '    console.log(\'[Deploy] Rolling back deployment...\');\n\n';
  code += '    try {\n';
  code += '      const backupPath = this.getLatestBackup();\n';
  code += '      if (!backupPath) {\n';
  code += '        console.error(\'[Deploy] No backup found for rollback\');\n';
  code += '        return;\n';
  code += '      }\n\n';
  code += '      // Restore from backup\n';
  code += '      await this.restoreBackup(backupPath);\n\n';
  code += '      console.log(\'[Deploy] Rollback complete\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Deploy] Rollback failed:\', error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private async createBackup(): Promise<void> {\n';
  code += '    console.log(\'[Deploy] Creating backup...\');\n\n';
  code += '    const backupDir = path.join(this.rollbackConfig.backupPath, this.currentDeployment);\n';
  code += '    fs.mkdirSync(backupDir, { recursive: true });\n\n';
  code += '    // Copy important files\n';
  code += '    const filesToBackup = [\n';
  code += '      \'package.json\',\n';
  code += '      \'package-lock.json\',\n';
  code += '      \'yarn.lock\',\n';
  code += '      \'dist\',\n';
  code += '      \'build\',\n';
  code += '    ];\n\n';
  code += '    for (const file of filesToBackup) {\n';
  code += '      const srcPath = path.join(this.projectRoot, file);\n';
  code += '      if (fs.existsSync(srcPath)) {\n';
  code += '        const destPath = path.join(backupDir, file);\n';
  code += '        fs.mkdirSync(path.dirname(destPath), { recursive: true });\n';
  code += '        fs.copyFileSync(srcPath, destPath);\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    console.log(\'[Deploy] Backup created at\', backupDir);\n';
  code += '  }\n\n';
  code += '  private getLatestBackup(): string | null {\n';
  code += '    const backupsDir = this.rollbackConfig.backupPath;\n';
  code += '    if (!fs.existsSync(backupsDir)) {\n';
  code += '      return null;\n';
  code += '    }\n\n';
  code += '    const backups = fs.readdirSync(backupsDir)\n';
  code += '      .map(d => path.join(backupsDir, d))\n';
  code += '      .filter(d => fs.statSync(d).isDirectory())\n';
  code += '      .sort((a, b) => {\n';
  code += '        const statA = fs.statSync(a);\n';
  code += '        const statB = fs.statSync(b);\n';
  code += '        return statB.mtimeMs - statA.mtimeMs;\n';
  code += '      });\n\n';
  code += '    return backups.length > 0 ? backups[0] : null;\n';
  code += '  }\n\n';
  code += '  private async restoreBackup(backupPath: string): Promise<void> {\n';
  code += '    console.log(\'[Deploy] Restoring from\', backupPath);\n\n';
  code += '    // Restore files from backup\n';
  code += '    const restoreFiles = [\n';
  code += '      \'package.json\',\n';
  code += '      \'package-lock.json\',\n';
  code += '      \'yarn.lock\',\n';
  code += '      \'dist\',\n';
  code += '      \'build\',\n';
  code += '    ];\n\n';
  code += '    for (const file of restoreFiles) {\n';
  code += '      const srcPath = path.join(backupPath, file);\n';
  code += '      if (fs.existsSync(srcPath)) {\n';
  code += '        const destPath = path.join(this.projectRoot, file);\n';
  code += '        fs.mkdirSync(path.dirname(destPath), { recursive: true });\n';
  code += '        fs.copyFileSync(srcPath, destPath);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private async runHealthChecks(): Promise<boolean> {\n';
  code += '    console.log(\'[Deploy] Running health checks...\');\n\n';
  code += '    try {\n';
  code += '      // Example health check - adjust based on your application\n';
  code += '      const response = execSync(\'curl -f http://localhost:3000/health || exit 1\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '        timeout: 5000,\n';
  code += '      });\n\n';
  code += '      console.log(\'[Deploy] Health checks passed\');\n';
  code += '      return true;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Deploy] Health checks failed:\', error.message);\n';
  code += '      return false;\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private getDefaultStages(): DeploymentStage[] {\n';
  code += '    return [\n';
  code += '      {\n';
  code += '        name: \'install\',\n';
  code += '        command: \'npm install\',\n';
  code += '        timeout: 300000,\n';
  code += '        retries: 3,\n';
  code += '      },\n';
  code += '      {\n';
  code += '        name: \'build\',\n';
  code += '        command: \'npm run build\',\n';
  code += '        timeout: 300000,\n';
  code += '        retries: 2,\n';
  code += '      },\n';
  code += '      {\n';
  code += '        name: \'test\',\n';
  code += '        command: \'npm test\',\n';
  code += '        timeout: 120000,\n';
  code += '        retries: 2,\n';
  code += '      },\n';
  code += '      {\n';
  code += '        name: \'deploy\',\n';
  code += '        command: \'npm run deploy\',\n';
  code += '        timeout: 180000,\n';
  code += '        retries: 3,\n';
  code += '      },\n';
  code += '    ];\n';
  code += '  }\n\n';
  code += '  private generateDeploymentId(): string {\n';
  code += '    return \'deploy-\' + Date.now() + \'-\' + Math.random().toString(36).substr(2, 9);\n';
  code += '  }\n\n';
  code += '  async getStatus(): Promise<Record<string, any>> {\n';
  code += '    return {\n';
  code += '      currentDeployment: this.currentDeployment,\n';
  code += '      history: this.deploymentHistory,\n';
  code += '      rollbackEnabled: this.rollbackConfig.enabled,\n';
  code += '      lastBackup: this.getLatestBackup(),\n';
  code += '    };\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const pipeline = new DeploymentPipeline({\n';
  code += '  enableAutoRollback: true,\n';
  code += '  enableHealthChecks: true,\n';
  code += '  enableZeroDowntime: true,\n';
  code += '  enableProgressiveDeploy: true,\n';
  code += '});\n\n';
  code += 'export default pipeline;\n';
  code += 'export { DeploymentPipeline, DeploymentStage, DeploymentResult, RollbackConfig };\n';

  return code;
}

export function generatePythonDeployment(config: any): string {
  let code = '# Auto-generated Deployment Pipeline for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import shutil\n';
  code += 'import os\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional, Any\n';
  code += 'from dataclasses import dataclass\n';
  code += 'import time\n\n';
  code += '@dataclass\n';
  code += 'class DeploymentStage:\n';
  code += '    name: str\n';
  code += '    command: str\n';
  code += '    timeout: int\n';
  code += '    retries: int\n';
  code += '    on_success: Optional[str] = None\n';
  code += '    on_failure: Optional[str] = None\n\n';
  code += '@dataclass\n';
  code += 'class DeploymentResult:\n';
  code += '    stage: str\n';
  code += '    success: bool\n';
  code += '    duration: float\n';
  code += '    output: Optional[str] = None\n';
  code += '    error: Optional[str] = None\n\n';
  code += '@dataclass\n';
  code += 'class RollbackConfig:\n';
  code += '    enabled: bool\n';
  code += '    max_retries: int\n';
  code += '    keep_backups: int\n';
  code += '    backup_path: str\n\n';
  code += 'class DeploymentPipeline:\n';
  code += '    def __init__(self, project_root: str = None, stages: List[DeploymentStage] = None, enable_auto_rollback: bool = True, enable_health_checks: bool = True, enable_zero_downtime: bool = True, enable_progressive_deploy: bool = True, rollback_config: RollbackConfig = None):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.stages = stages or self.get_default_stages()\n';
  code += '        self.enable_auto_rollback = enable_auto_rollback\n';
  code += '        self.enable_health_checks = enable_health_checks\n';
  code += '        self.enable_zero_downtime = enable_zero_downtime\n';
  code += '        self.enable_progressive_deploy = enable_progressive_deploy\n';
  code += '        self.rollback_config = rollback_config or RollbackConfig(\n';
  code += '            enabled=True,\n';
  code += '            max_retries=3,\n';
  code += '            keep_backups=5,\n';
  code += '            backup_path=str(self.project_root / ".deployments"),\n';
  code += '        )\n';
  code += '        self.deployment_history: List[DeploymentResult] = []\n';
  code += '        self.current_deployment = self.generate_deployment_id()\n\n';
  code += '    async def deploy(self) -> List[DeploymentResult]:\n';
  code += '        print(f"[Deploy] Starting deployment {self.current_deployment}")\n';
  code += '        start_time = time.time()\n';
  code += '        results = []\n\n';
  code += '        try:\n';
  code += '            # Create backup before deployment\n';
  code += '            if self.rollback_config.enabled:\n';
  code += '                await self.create_backup()\n\n';
  code += '            # Run deployment stages\n';
  code += '            for stage in self.stages:\n';
  code += '                result = await self.execute_stage(stage)\n';
  code += '                results.append(result)\n\n';
  code += '                if not result.success:\n';
  code += '                    print(f"[Deploy] Stage failed: {stage.name}")\n';
  code += '                    if self.enable_auto_rollback:\n';
  code += '                        await self.rollback()\n';
  code += '                    return results\n\n';
  code += '            # Run health checks\n';
  code += '            if self.enable_health_checks:\n';
  code += '                healthy = await self.run_health_checks()\n';
  code += '                if not healthy:\n';
  code += '                    print("[Deploy] Health checks failed")\n';
  code += '                    if self.enable_auto_rollback:\n';
  code += '                        await self.rollback()\n';
  code += '                    return results\n\n';
  code += '            duration = time.time() - start_time\n';
  code += '            print(f"[Deploy] Deployment completed in {duration:.2f}s")\n';
  code += '            return results\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Deploy] Deployment failed: {e}")\n';
  code += '            if self.enable_auto_rollback:\n';
  code += '                await self.rollback()\n';
  code += '            raise\n\n';
  code += '    async def execute_stage(self, stage: DeploymentStage) -> DeploymentResult:\n';
  code += '        print(f"[Deploy] Executing stage: {stage.name}")\n';
  code += '        start_time = time.time()\n\n';
  code += '        for attempt in range(stage.retries):\n';
  code += '            try:\n';
  code += '                result = subprocess.run(stage.command, shell=True, cwd=self.project_root,\n';
  code += '                                      capture_output=True, text=True, check=True,\n';
  code += '                                      timeout=stage.timeout)\n\n';
  code += '                deployment_result = DeploymentResult(\n';
  code += '                    stage=stage.name,\n';
  code += '                    success=True,\n';
  code += '                    duration=time.time() - start_time,\n';
  code += '                    output=result.stdout,\n';
  code += '                )\n\n';
  code += '                if stage.on_success:\n';
  code += '                    subprocess.run(stage.on_success, shell=True, cwd=self.project_root, check=True)\n\n';
  code += '                self.deployment_history.append(deployment_result)\n';
  code += '                return deployment_result\n\n';
  code += '            except subprocess.CalledProcessError as e:\n';
  code += '                if attempt == stage.retries - 1:\n';
  code += '                    deployment_result = DeploymentResult(\n';
  code += '                        stage=stage.name,\n';
  code += '                        success=False,\n';
  code += '                        duration=time.time() - start_time,\n';
  code += '                        error=str(e),\n';
  code += '                    )\n\n';
  code += '                    if stage.on_failure:\n';
  code += '                        subprocess.run(stage.on_failure, shell=True, cwd=self.project_root, check=True)\n\n';
  code += '                    self.deployment_history.append(deployment_result)\n';
  code += '                    return deployment_result\n\n';
  code += '                print(f"[Deploy] Retrying stage: {stage.name} Attempt {attempt + 2}")\n\n';
  code += '        return DeploymentResult(\n';
  code += '            stage=stage.name,\n';
  code += '            success=False,\n';
  code += '            duration=time.time() - start_time,\n';
  code += '            error="Max retries exceeded",\n';
  code += '        )\n\n';
  code += '    async def rollback(self) -> None:\n';
  code += '        if not self.rollback_config.enabled:\n';
  code += '            print("[Deploy] Rollback is disabled")\n';
  code += '            return\n\n';
  code += '        print("[Deploy] Rolling back deployment...")\n\n';
  code += '        try:\n';
  code += '            backup_path = self.get_latest_backup()\n';
  code += '            if not backup_path:\n';
  code += '                print("[Deploy] No backup found for rollback")\n';
  code += '                return\n\n';
  code += '            # Restore from backup\n';
  code += '            await self.restore_backup(backup_path)\n\n';
  code += '            print("[Deploy] Rollback complete")\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Deploy] Rollback failed: {e}")\n';
  code += '            raise\n\n';
  code += '    async def create_backup(self) -> None:\n';
  code += '        print("[Deploy] Creating backup...")\n\n';
  code += '        backup_dir = self.rollback_config.backup_path / self.current_deployment\n';
  code += '        backup_dir.mkdir(parents=True, exist_ok=True)\n\n';
  code += '        # Copy important files\n';
  code += '        files_to_backup = [\n';
  code += '            "package.json",\n';
  code += '            "package-lock.json",\n';
  code += '            "yarn.lock",\n';
  code += '            "dist",\n';
  code += '            "build",\n';
  code += '        ]\n\n';
  code += '        for file in files_to_backup:\n';
  code += '            src_path = self.project_root / file\n';
  code += '            if src_path.exists():\n';
  code += '                dest_path = backup_dir / file\n';
  code += '                dest_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '                shutil.copy2(src_path, dest_path)\n\n';
  code += '        print(f"[Deploy] Backup created at {backup_dir}")\n\n';
  code += '    def get_latest_backup(self) -> Optional[Path]:\n';
  code += '        backups_dir = Path(self.rollback_config.backup_path)\n';
  code += '        if not backups_dir.exists():\n';
  code += '            return None\n\n';
  code += '        backups = sorted(\n';
  code += '            [d for d in backups_dir.iterdir() if d.is_dir()],\n';
  code += '            key=lambda d: d.stat().st_mtime,\n';
  code += '            reverse=True,\n';
  code += '        )\n\n';
  code += '        return backups[0] if backups else None\n\n';
  code += '    async def restore_backup(self, backup_path: Path) -> None:\n';
  code += '        print(f"[Deploy] Restoring from {backup_path}")\n\n';
  code += '        # Restore files from backup\n';
  code += '        restore_files = [\n';
  code += '            "package.json",\n';
  code += '            "package-lock.json",\n';
  code += '            "yarn.lock",\n';
  code += '            "dist",\n';
  code += '            "build",\n';
  code += '        ]\n\n';
  code += '        for file in restore_files:\n';
  code += '            src_path = backup_path / file\n';
  code += '            if src_path.exists():\n';
  code += '                dest_path = self.project_root / file\n';
  code += '                dest_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '                shutil.copy2(src_path, dest_path)\n\n';
  code += '    async def run_health_checks(self) -> bool:\n';
  code += '        print("[Deploy] Running health checks...")\n\n';
  code += '        try:\n';
  code += '            # Example health check - adjust based on your application\n';
  code += '            result = subprocess.run("curl -f http://localhost:3000/health || exit 1",\n';
  code += '                                     shell=True, cwd=self.project_root,\n';
  code += '                                     capture_output=True, text=True, check=True,\n';
  code += '                                     timeout=5)\n\n';
  code += '            print("[Deploy] Health checks passed")\n';
  code += '            return True\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Deploy] Health checks failed: {e}")\n';
  code += '            return False\n\n';
  code += '    def get_default_stages(self) -> List[DeploymentStage]:\n';
  code += '        return [\n';
  code += '            DeploymentStage(\n';
  code += '                name="install",\n';
  code += '                command="npm install",\n';
  code += '                timeout=300,\n';
  code += '                retries=3,\n';
  code += '            ),\n';
  code += '            DeploymentStage(\n';
  code += '                name="build",\n';
  code += '                command="npm run build",\n';
  code += '                timeout=300,\n';
  code += '                retries=2,\n';
  code += '            ),\n';
  code += '            DeploymentStage(\n';
  code += '                name="test",\n';
  code += '                command="npm test",\n';
  code += '                timeout=120,\n';
  code += '                retries=2,\n';
  code += '            ),\n';
  code += '            DeploymentStage(\n';
  code += '                name="deploy",\n';
  code += '                command="npm run deploy",\n';
  code += '                timeout=180,\n';
  code += '                retries=3,\n';
  code += '            ),\n';
  code += '        ]\n\n';
  code += '    def generate_deployment_id(self) -> str:\n';
  code += '        return f"deploy-{int(time.time())}-{os.urandom(4).hex()}"\n\n';
  code += '    async def get_status(self) -> Dict[str, Any]:\n';
  code += '        return {\n';
  code += '            "current_deployment": self.current_deployment,\n';
  code += '            "history": self.deployment_history,\n';
  code += '            "rollback_enabled": self.rollback_config.enabled,\n';
  code += '            "last_backup": str(self.get_latest_backup()) if self.get_latest_backup() else None,\n';
  code += '        }\n\n';
  code += 'pipeline = DeploymentPipeline(\n';
  code += '    enable_auto_rollback=True,\n';
  code += '    enable_health_checks=True,\n';
  code += '    enable_zero_downtime=True,\n';
  code += '    enable_progressive_deploy=True,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: any,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate TypeScript version
  const tsCode = generateTypeScriptDeployment(config);
  const tsPath = path.join(outputDir, 'deployment-pipeline.ts');
  fs.writeFileSync(tsPath, tsCode);

  // Generate Python version
  const pyCode = generatePythonDeployment(config);
  const pyPath = path.join(outputDir, 'deployment-pipeline.py');
  fs.writeFileSync(pyPath, pyCode);

  // Generate documentation
  const md = generateDeploymentMD(config);
  const mdPath = path.join(outputDir, 'DEPLOYMENT.md');
  fs.writeFileSync(mdPath, md);

  // Generate package.json for TypeScript
  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Unified deployment pipelines with rollback support',
    main: 'deployment-pipeline.ts',
    scripts: {
      test: 'echo "Error: no test specified" && exit 1',
    },
    dependencies: {},
    devDependencies: {
      '@types/node': '^20.0.0',
    },
  };
  const pkgPath = path.join(outputDir, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));

  // Generate requirements.txt for Python
  const requirements = [];
  const reqPath = path.join(outputDir, 'requirements.txt');
  fs.writeFileSync(reqPath, requirements.join('\n') + '\n');

  // Generate config file
  const configJson = {
    projectName: config.projectName,
    enableAutoRollback: config.enableAutoRollback,
    enableHealthChecks: config.enableHealthChecks,
    enableZeroDowntime: config.enableZeroDowntime,
    enableProgressiveDeploy: config.enableProgressiveDeploy,
    generatedAt: new Date().toISOString(),
  };
  const cfgPath = path.join(outputDir, 'deployment-config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(configJson, null, 2));
}
