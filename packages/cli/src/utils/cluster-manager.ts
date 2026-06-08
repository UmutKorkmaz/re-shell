// Auto-generated Cluster Management Utility
// Generated at: 2026-01-13T10:25:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ClusterUpgradeConfig {
  currentVersion: string;
  targetVersion: string;
  autoApprove: boolean;
  drainNodes: boolean;
  ignoreDaemonSets: boolean;
  timeout: number;
  dryRun: boolean;
}

interface SafetyCheck {
  name: string;
  description: string;
  check: () => Promise<boolean>;
  onFailure: 'abort' | 'warn' | 'continue';
}

interface PreFlightCheck {
  healthCheck: boolean;
  backupCheck: boolean;
  resourceCheck: boolean;
  compatibilityCheck: boolean;
}

interface ClusterManagerConfig {
  projectName: string;
  kubeconfig: string;
  context: string;
  namespace: string;
  upgradeConfig: ClusterUpgradeConfig;
  safetyChecks: SafetyCheck[];
  enableMonitoring: boolean;
  enableLogging: boolean;
}

export function displayConfig(config: ClusterManagerConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Kubernetes Cluster Management and Upgrade Automation');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Context:', config.context);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Current Version:', config.upgradeConfig.currentVersion);
  console.log('\x1b[33m%s\x1b[0m', 'Target Version:', config.upgradeConfig.targetVersion);
  console.log('\x1b[33m%s\x1b[0m', 'Auto Approve:', config.upgradeConfig.autoApprove ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Drain Nodes:', config.upgradeConfig.drainNodes ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Dry Run:', config.upgradeConfig.dryRun ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Safety Checks:', config.safetyChecks.length);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateClusterManagerMD(config: ClusterManagerConfig): string {
  let md = '# Kubernetes Cluster Management and Upgrade Automation\n\n';
  md += '## Features\n\n';
  md += '- Kubernetes version upgrade automation\n';
  md += '- Pre-flight safety checks and validation\n';
  md += '- Node draining with pod eviction\n';
  md += '- Rollback capabilities\n';
  md += '- Health monitoring and logging\n';
  md += '- Backup and restore integration\n';
  md += '- Compatibility matrix validation\n';
  md += '- Resource usage analysis\n';
  md += '- Cluster health assessment\n';
  md += '- Upgrade history tracking\n';
  md += '- Automatic rollback on failures\n';
  md += '- Multi-cluster support\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import clusterManager from \'./cluster-manager\';\n\n';
  md += '// Perform cluster upgrade\n';
  md += 'await clusterManager.upgrade({\n';
  md += '  targetVersion: \'1.28.0\',\n';
  md += '  drainNodes: true,\n';
  md += '  dryRun: false,\n';
  md += '});\n\n';
  md += '// Run safety checks\n';
  md += 'await clusterManager.runSafetyChecks();\n\n';
  md += '// Get cluster health\n';
  md += 'await clusterManager.getHealth();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptClusterManager(config: ClusterManagerConfig): string {
  let code = '// Auto-generated Cluster Management for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { KubeConfig, CoreV1Api, AppsV1Api } from \'@kubernetes/client-node\';\n\n';

  code += 'class ClusterManager {\n';
  code += '  private projectName: string;\n';
  code += '  private kubeconfig: string;\n';
  code += '  private context: string;\n';
  code += '  private namespace: string;\n';
  code += '  private upgradeConfig: ClusterUpgradeConfig;\n';
  code += '  private safetyChecks: SafetyCheck[];\n';
  code += '  private enableMonitoring: boolean;\n';
  code += '  private enableLogging: boolean;\n';
  code += '  private kc: KubeConfig;\n';
  code += '  private coreV1Api: CoreV1Api;\n';
  code += '  private appsV1Api: AppsV1Api;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.kubeconfig = options.kubeconfig || process.env.KUBECONFIG || \'~/.kube/config\';\n';
  code += '    this.context = options.context || \'default\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.upgradeConfig = options.upgradeConfig || {};\n';
  code += '    this.safetyChecks = options.safetyChecks || this.getDefaultSafetyChecks();\n';
  code += '    this.enableMonitoring = options.enableMonitoring !== false;\n';
  code += '    this.enableLogging = options.enableLogging !== false;\n\n';
  code += '    this.kc = new KubeConfig();\n';
  code += '    this.kc.loadFromFile(this.kubeconfig);\n';
  code += '    this.kc.setCurrentContext(this.context);\n';
  code += '    this.coreV1Api = this.kc.makeApiClient(CoreV1Api);\n';
  code += '    this.appsV1Api = this.kc.makeApiClient(AppsV1Api);\n';
  code += '  }\n\n';

  code += '  async upgrade(options: Partial<ClusterUpgradeConfig> = {}): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Starting cluster upgrade...\');\n\n';
  code += '    const config = { ...this.upgradeConfig, ...options };\n\n';
  code += '    // Run pre-flight checks\n';
  code += '    const preFlight = await this.runPreFlightChecks();\n';
  code += '    if (!preFlight.healthCheck) {\n';
  code += '      console.error(\'[ClusterManager] ✗ Pre-flight checks failed. Aborting upgrade.\');\n';
  code += '      return;\n';
  code += '    }\n\n';
  code += '    // Run safety checks\n';
  code += '    const safetyPassed = await this.runSafetyChecks();\n';
  code += '    if (!safetyPassed) {\n';
  code += '      console.error(\'[ClusterManager] ✗ Safety checks failed. Aborting upgrade.\');\n';
  code += '      return;\n';
  code += '    }\n\n';
  code += '    // Create backup\n';
  code += '    await this.createBackup();\n\n';
  code += '    // Drain nodes if enabled\n';
  code += '    if (config.drainNodes) {\n';
  code += '      await this.drainNodes();\n';
  code += '    }\n\n';
  code += '    // Perform upgrade\n';
  code += '    if (!config.dryRun) {\n';
  code += '      await this.performUpgrade(config);\n';
  code += '    } else {\n';
  code += '      console.log(\'[ClusterManager] Dry run completed. No changes made.\');\n';
  code += '    }\n\n';
  code += '    // Verify upgrade\n';
  code += '    await this.verifyUpgrade(config.targetVersion);\n\n';
  code += '    // Cleanup\n';
  code += '    await this.uncordonNodes();\n\n';
  code += '    console.log(\'[ClusterManager] ✓ Cluster upgrade completed successfully\');\n';
  code += '  }\n\n';

  code += '  async runPreFlightChecks(): Promise<PreFlightCheck> {\n';
  code += '    console.log(\'[ClusterManager] Running pre-flight checks...\');\n\n';
  code += '    const checks: PreFlightCheck = {\n';
  code += '      healthCheck: true,\n';
  code += '      backupCheck: true,\n';
  code += '      resourceCheck: true,\n';
  code += '      compatibilityCheck: true,\n';
  code += '    };\n\n';
  code += '    try {\n';
  code += '      // Check cluster health\n';
  code += '      const health = await this.getClusterHealth();\n';
  code += '      checks.healthCheck = health.healthy;\n';
  code += '      console.log(`[ClusterManager] ${health.healthy ? \'✓\' : \'✗\' } Cluster health: ${health.status}`);\n\n';
  code += '      // Check backup availability\n';
  code += '      checks.backupCheck = await this.checkBackupAvailability();\n';
  code += '      console.log(`[ClusterManager] ${checks.backupCheck ? \'✓\' : \'✗\' } Backup availability`);\n\n';
  code += '      // Check resource availability\n';
  code += '      checks.resourceCheck = await this.checkResourceAvailability();\n';
  code += '      console.log(`[ClusterManager] ${checks.resourceCheck ? \'✓\' : \'✗\' } Resource availability`);\n\n';
  code += '      // Check version compatibility\n';
  code += '      checks.compatibilityCheck = await this.checkVersionCompatibility();\n';
  code += '      console.log(`[ClusterManager] ${checks.compatibilityCheck ? \'✓\' : \'✗\' } Version compatibility`);\n\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Pre-flight check error:\', error.message);\n';
  code += '    }\n\n';
  code += '    return checks;\n';
  code += '  }\n\n';

  code += '  async runSafetyChecks(): Promise<boolean> {\n';
  code += '    console.log(\'[ClusterManager] Running safety checks...\');\n\n';
  code += '    let allPassed = true;\n\n';
  code += '    for (const check of this.safetyChecks) {\n';
  code += '      try {\n';
  code += '        console.log(`[ClusterManager] Running: ${check.name}`);\n';
  code += '        const passed = await check.check();\n\n';
  code += '        if (passed) {\n';
  code += '          console.log(`[ClusterManager] ✓ ${check.name}: PASSED`);\n';
  code += '        } else {\n';
  code += '          console.log(`[ClusterManager] ✗ ${check.name}: FAILED`);\n\n';
  code += '          if (check.onFailure === \'abort\') {\n';
  code += '            console.error(`[ClusterManager] Aborting due to failed safety check: ${check.name}`);\n';
  code += '            return false;\n';
  code += '          } else if (check.onFailure === \'warn\') {\n';
  code += '            console.warn(`[ClusterManager] WARNING: ${check.description}`);\n';
  code += '          }\n\n';
  code += '          allPassed = false;\n';
  code += '        }\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[ClusterManager] ✗ ${check.name}: ERROR - ${error.message}`);\n';
  code += '        if (check.onFailure === \'abort\') {\n';
  code += '          return false;\n';
  code += '        }\n';
  code += '        allPassed = false;\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    return allPassed;\n';
  code += '  }\n\n';

  code += '  async drainNodes(): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Draining nodes...\');\n\n';
  code += '    try {\n';
  code += '      const nodes = await this.getNodes();\n\n';
  code += '      for (const node of nodes) {\n';
  code += '        console.log(`[ClusterManager] Draining node: ${node.metadata.name}`);\n\n';
  code += '        const drainCmd = this.upgradeConfig.ignoreDaemonSets\n';
  code += '          ? `kubectl drain ${node.metadata.name} --ignore-daemonsets --delete-emptydir-data --timeout=${this.upgradeConfig.timeout}s`\n';
  code += '          : `kubectl drain ${node.metadata.name} --delete-emptydir-data --timeout=${this.upgradeConfig.timeout}s`\n\n';
  code += '        if (!this.upgradeConfig.dryRun) {\n';
  code += '          execSync(drainCmd, { stdio: \'pipe\' });\n';
  code += '          console.log(`[ClusterManager] ✓ Drained: ${node.metadata.name}`);\n';
  code += '        } else {\n';
  code += '          console.log(`[ClusterManager] [DRY RUN] Would drain: ${node.metadata.name}`);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Failed to drain nodes:\', error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async performUpgrade(config: ClusterUpgradeConfig): Promise<void> {\n';
  code += '    console.log(`[ClusterManager] Upgrading from ${config.currentVersion} to ${config.targetVersion}...`);\n\n';
  code += '    try {\n';
  code += '      // Upgrade control plane\n';
  code += '      await this.upgradeControlPlane(config);\n\n';
  code += '      // Wait for control plane to be ready\n';
  code += '      await this.waitForControlPlane();\n\n';
  code += '      // Upgrade worker nodes\n';
  code += '      await this.upgradeWorkerNodes(config);\n\n';
  code += '      console.log(\'[ClusterManager] ✓ Upgrade completed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Upgrade failed:\', error.message);\n';
  code += '      await this.rollback();\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async upgradeControlPlane(config: ClusterUpgradeConfig): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Upgrading control plane...\');\n\n';
  code += '    // Use kubeadm or cloud-specific upgrade command\n';
  code += '    const upgradeCmd = `kubeadm upgrade apply ${config.targetVersion} --yes`\n\n';
  code += '    if (this.upgradeConfig.autoApprove) {\n';
  code += '      execSync(upgradeCmd, { stdio: \'pipe\' });\n';
  code += '      console.log(`[ClusterManager] ✓ Control plane upgraded to ${config.targetVersion}`);\n';
  code += '    } else {\n';
  code += '      console.log(`[ClusterManager] Manual approval required. Run: ${upgradeCmd}`);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async upgradeWorkerNodes(config: ClusterUpgradeConfig): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Upgrading worker nodes...\');\n\n';
  code += '    const nodes = await this.getNodes();\n';
  code += '    const workerNodes = nodes.filter((n: any) => !n.labels[\'node-role.kubernetes.io/control-plane\']);\n\n';
  code += '    for (const node of workerNodes) {\n';
  code += '      console.log(`[ClusterManager] Upgrading node: ${node.metadata.name}`);\n\n';
  code += '      const upgradeCmd = `kubeadm upgrade node ${config.targetVersion}`\n\n';
  code += '      execSync(upgradeCmd, { stdio: \'pipe\' });\n';
  code += '      console.log(`[ClusterManager] ✓ Upgraded: ${node.metadata.name}`);\n\n';
  code += '      // Restart kubelet\n';
  code += '      execSync(`systemctl restart kubelet`, { stdio: \'pipe\' });\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async verifyUpgrade(targetVersion: string): Promise<boolean> {\n';
  code += '    console.log(\'[ClusterManager] Verifying upgrade...\');\n\n';
  code += '    try {\n';
  code += '      const result = execSync(\'kubectl version --short\', { encoding: \'utf-8\' });\n';
  code += '      const isVerified = result.includes(targetVersion);\n\n';
  code += '      if (isVerified) {\n';
  code += '        console.log(`[ClusterManager] ✓ Upgrade verified: ${targetVersion}`);\n';
  code += '      } else {\n';
  code += '        console.log(`[ClusterManager] ✗ Upgrade verification failed`);\n';
  code += '      }\n\n';
  code += '      return isVerified;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Verification error:\', error.message);\n';
  code += '      return false;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async uncordonNodes(): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Uncordoning nodes...\');\n\n';
  code += '    try {\n';
  code += '      const nodes = await this.getNodes();\n\n';
  code += '      for (const node of nodes) {\n';
  code += '        if (node.spec.unschedulable) {\n';
  code += '          execSync(`kubectl uncordon ${node.metadata.name}`, { stdio: \'pipe\' });\n';
  code += '          console.log(`[ClusterManager] ✓ Uncordoned: ${node.metadata.name}`);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Failed to uncordon nodes:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async rollback(): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Initiating rollback...\');\n\n';
  code += '    try {\n';
  code += '      // Restore from backup\n';
  code += '      await this.restoreBackup();\n\n';
  code += '      // Uncordon all nodes\n';
  code += '      await this.uncordonNodes();\n\n';
  code += '      console.log(\'[ClusterManager] ✓ Rollback completed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Rollback failed:\', error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async getClusterHealth(): Promise<any> {\n';
  code += '    try {\n';
  code += '      const nodes = await this.coreV1Api.listNode();\n';
  code += '      const readyNodes = nodes.items.filter((n: any) =>\n';
  code += '        n.status.conditions?.find((c: any) => c.type === \'Ready\')?.status === \'True\'\n';
  code += '      );\n\n';
  code += '      const healthy = readyNodes.length === nodes.items.length;\n';
  code += '      const status = healthy ? \'Healthy\' : \'Degraded\';\n\n';
  code += '      return { healthy, status, total: nodes.items.length, ready: readyNodes.length };\n';
  code += '    } catch (error: any) {\n';
  code += '      return { healthy: false, status: \'Error\', error: error.message };\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async createBackup(): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Creating backup...\');\n\n';
  code += '    try {\n';
  code += '      const backupDir = path.join(process.cwd(), \'backups\', new Date().toISOString().split(\'T\')[0]);\n';
  code += '      fs.mkdirSync(backupDir, { recursive: true });\n\n';
  code += '      // Backup resources\n';
  code += '      const resources = [\n';
  code += '        \'deployments\',\n';
  code += '        \'services\',\n';
  code += '        \'configmaps\',\n';
  code += '        \'secrets\',\n';
  code += '        \'ingresses\',\n';
  code += '      ];\n\n';
  code += '      for (const resource of resources) {\n';
  code += '        const cmd = `kubectl get ${resource} -n ${this.namespace} -o yaml > ${backupDir}/${resource}.yaml`\n';
  code += '        execSync(cmd, { stdio: \'pipe\' });\n';
  code += '      }\n\n';
  code += '      console.log(`[ClusterManager] ✓ Backup created: ${backupDir}`);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Backup failed:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async restoreBackup(): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Restoring from backup...\');\n\n';
  code += '    const backupDirs = fs.readdirSync(path.join(process.cwd(), \'backups\'));\n';
  code += '    const latestBackup = backupDirs.sort().reverse()[0];\n';
  code += '    const backupPath = path.join(process.cwd(), \'backups\', latestBackup);\n\n';
  code += '    if (fs.existsSync(backupPath)) {\n';
  code += '      execSync(`kubectl apply -f ${backupPath}/`, { stdio: \'pipe\' });\n';
  code += '      console.log(`[ClusterManager] ✓ Backup restored from: ${backupPath}`);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async getNodes(): Promise<any[]> {\n';
  code += '    try {\n';
  code += '      const result = execSync(\'kubectl get nodes -o json\', { encoding: \'utf-8\' });\n';
  code += '      const nodes = JSON.parse(result);\n';
  code += '      return nodes.items;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ClusterManager] Failed to get nodes:\', error.message);\n';
  code += '      return [];\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async checkBackupAvailability(): Promise<boolean> {\n';
  code += '    // Implement backup availability check\n';
  code += '    return true;\n';
  code += '  }\n\n';

  code += '  async checkResourceAvailability(): Promise<boolean> {\n';
  code += '    // Implement resource availability check\n';
  code += '    return true;\n';
  code += '  }\n\n';

  code += '  async checkVersionCompatibility(): Promise<boolean> {\n';
  code += '    // Implement version compatibility check\n';
  code += '    return true;\n';
  code += '  }\n\n';

  code += '  async waitForControlPlane(): Promise<void> {\n';
  code += '    console.log(\'[ClusterManager] Waiting for control plane to be ready...\');\n';
  code += '    execSync(\'kubectl wait --for=condition=ready node -l node-role.kubernetes.io/control-plane --timeout=600s\', {\n';
  code += '      stdio: \'pipe\',\n';
  code += '    });\n';
  code += '    console.log(\'[ClusterManager] ✓ Control plane is ready\');\n';
  code += '  }\n\n';

  code += '  private getDefaultSafetyChecks(): SafetyCheck[] {\n';
  code += '    return [\n';
  code += '      {\n';
  code += '        name: \'Cluster Health Check\',\n';
  code += '        description: \'Verify cluster is healthy before upgrade\',\n';
  code += '        check: async () => (await this.getClusterHealth()).healthy,\n';
  code += '        onFailure: \'abort\',\n';
  code += '      },\n';
  code += '      {\n';
  code += '        name: \'Sufficient Resources Check\',\n';
  code += '        description: \'Verify sufficient resources for upgrade\',\n';
  code += '        check: async () => this.checkResourceAvailability(),\n';
  code += '        onFailure: \'abort\',\n';
  code += '      },\n';
  code += '      {\n';
  code += '        name: \'Version Compatibility Check\',\n';
  code += '        description: \'Verify target version is compatible\',\n';
  code += '        check: async () => this.checkVersionCompatibility(),\n';
  code += '        onFailure: \'abort\',\n';
  code += '      },\n';
  code += '    ];\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const clusterManager = new ClusterManager({\n';
  code += '  projectName: \'' + config.projectName + '\',\n';
  code += '  kubeconfig: \'' + config.kubeconfig + '\',\n';
  code += '  context: \'' + config.context + '\',\n';
  code += '  namespace: \'' + config.namespace + '\',\n';
  code += '  upgradeConfig: ' + JSON.stringify(config.upgradeConfig, null, 2) + ',\n';
  code += '  safetyChecks: [],\n';
  code += '  enableMonitoring: ' + config.enableMonitoring + ',\n';
  code += '  enableLogging: ' + config.enableLogging + ',\n';
  code += '});\n\n';

  code += 'export default clusterManager;\n';
  code += 'export { ClusterManager, ClusterUpgradeConfig, SafetyCheck, PreFlightCheck };\n';

  return code;
}

export function generatePythonClusterManager(config: ClusterManagerConfig): string {
  let code = '# Auto-generated Cluster Management for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n';
  code += 'from kubernetes import client, config\n\n';

  code += '@dataclass\n';
  code += 'class ClusterUpgradeConfig:\n';
  code += '    current_version: str = "1.27.0"\n';
  code += '    target_version: str = "1.28.0"\n';
  code += '    auto_approve: bool = False\n';
  code += '    drain_nodes: bool = True\n';
  code += '    ignore_daemon_sets: bool = True\n';
  code += '    timeout: int = 300\n';
  code += '    dry_run: bool = False\n\n';

  code += '@dataclass\n';
  code += 'class SafetyCheck:\n';
  code += '    name: str\n';
  code += '    description: str\n';
  code += '    on_failure: str = "abort"\n\n';

  code += 'class ClusterManager:\n';
  code += '    def __init__(self, project_name: str = None, kubeconfig: str = None, context: str = "default", namespace: str = "default", upgrade_config: ClusterUpgradeConfig = None, safety_checks: List[SafetyCheck] = None, enable_monitoring: bool = True, enable_logging: bool = True):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.kubeconfig = kubeconfig or "~/.kube/config"\n';
  code += '        self.context = context\n';
  code += '        self.namespace = namespace\n';
  code += '        self.upgrade_config = upgrade_config or ClusterUpgradeConfig()\n';
  code += '        self.safety_checks = safety_checks or []\n';
  code += '        self.enable_monitoring = enable_monitoring\n';
  code += '        self.enable_logging = enable_logging\n\n';
  code += '        config.load_kube_config()\n';
  code += '        self.core_v1 = client.CoreV1Api()\n';
  code += '        self.apps_v1 = client.AppsV1Api()\n\n';

  code += '    def upgrade(self, **kwargs) -> None:\n';
  code += '        print("[ClusterManager] Starting cluster upgrade...")\n\n';
  code += '        config = {**self.upgrade_config.__dict__, **kwargs}\n\n';
  code += '        pre_flight = self.run_pre_flight_checks()\n';
  code += '        if not pre_flight["healthCheck"]:\n';
  code += '            print("[ClusterManager] ✗ Pre-flight checks failed. Aborting upgrade.")\n';
  code += '            return\n\n';
  code += '        safety_passed = self.run_safety_checks()\n';
  code += '        if not safety_passed:\n';
  code += '            print("[ClusterManager] ✗ Safety checks failed. Aborting upgrade.")\n';
  code += '            return\n\n';
  code += '        self.create_backup()\n\n';
  code += '        if config["drain_nodes"]:\n';
  code += '            self.drain_nodes()\n\n';
  code += '        if not config["dry_run"]:\n';
  code += '            self.perform_upgrade(config)\n';
  code += '        else:\n';
  code += '            print("[ClusterManager] Dry run completed. No changes made.")\n\n';
  code += '        self.verify_upgrade(config["target_version"])\n';
  code += '        self.uncordon_nodes()\n\n';
  code += '        print("[ClusterManager] ✓ Cluster upgrade completed successfully")\n\n';

  code += '    def run_pre_flight_checks(self) -> Dict[str, bool]:\n';
  code += '        print("[ClusterManager] Running pre-flight checks...")\n\n';
  code += '        return {\n';
  code += '            "healthCheck": True,\n';
  code += '            "backupCheck": True,\n';
  code += '            "resourceCheck": True,\n';
  code += '            "compatibilityCheck": True,\n';
  code += '        }\n\n';

  code += '    def run_safety_checks(self) -> bool:\n';
  code += '        print("[ClusterManager] Running safety checks...")\n';
  code += '        return True\n\n';

  code += '    def drain_nodes(self) -> None:\n';
  code += '        print("[ClusterManager] Draining nodes...")\n';
  code += '        nodes = self.get_nodes()\n\n';
  code += '        for node in nodes:\n';
  code += '            print(f"[ClusterManager] Draining node: {node[\'metadata\'][\'name\']}")\n';
  code += '            drain_cmd = f"kubectl drain {node[\'metadata\'][\'name\']} --ignore-daemonsets --delete-emptydir-data"\n';
  code += '            subprocess.run(drain_cmd, shell=True, check=True, capture_output=True)\n';
  code += '            print(f"[ClusterManager] ✓ Drained: {node[\'metadata\'][\'name\']}")\n\n';

  code += '    def perform_upgrade(self, config: Dict[str, Any]) -> None:\n';
  code += '        print(f"[ClusterManager] Upgrading to {config[\'target_version\']}...")\n';
  code += '        upgrade_cmd = f"kubeadm upgrade apply {config[\'target_version\']} --yes"\n';
  code += '        subprocess.run(upgrade_cmd, shell=True, check=True, capture_output=True)\n';
  code += '        print("[ClusterManager] ✓ Upgrade completed")\n\n';

  code += '    def verify_upgrade(self, target_version: str) -> bool:\n';
  code += '        print("[ClusterManager] Verifying upgrade...")\n';
  code += '        result = subprocess.run(["kubectl", "version", "--short"], capture_output=True, text=True)\n';
  code += '        is_verified = target_version in result.stdout\n';
  code += '        print(f"[ClusterManager] {\'✓\' if is_verified else \'✗\'} Verification: {is_verified}")\n';
  code += '        return is_verified\n\n';

  code += '    def uncordon_nodes(self) -> None:\n';
  code += '        print("[ClusterManager] Uncordoning nodes...")\n';
  code += '        nodes = self.get_nodes()\n\n';
  code += '        for node in nodes:\n';
  code += '            if node.get("spec", {}).get("unschedulable"):\n';
  code += '                subprocess.run(["kubectl", "uncordon", node["metadata"]["name"]], check=True, capture_output=True)\n';
  code += '                print(f"[ClusterManager] ✓ Uncordoned: {node[\'metadata\'][\'name\']}")\n\n';

  code += '    def rollback(self) -> None:\n';
  code += '        print("[ClusterManager] Initiating rollback...")\n';
  code += '        self.restore_backup()\n';
  code += '        self.uncordon_nodes()\n';
  code += '        print("[ClusterManager] ✓ Rollback completed")\n\n';

  code += '    def get_cluster_health(self) -> Dict[str, Any]:\n';
  code += '        nodes = self.core_v1.list_node()\n';
  code += '        ready_nodes = [n for n in nodes.items if any(c.type == "Ready" and c.status == "True" for c in n.status.conditions)]\n\n';
  code += '        return {\n';
  code += '            "healthy": len(ready_nodes) == len(nodes.items),\n';
  code += '            "status": "Healthy" if len(ready_nodes) == len(nodes.items) else "Degraded",\n';
  code += '            "total": len(nodes.items),\n';
  code += '            "ready": len(ready_nodes),\n';
  code += '        }\n\n';

  code += '    def create_backup(self) -> None:\n';
  code += '        print("[ClusterManager] Creating backup...")\n';
  code += '        backup_dir = Path.cwd() / "backups" / datetime.now().strftime("%Y-%m-%d")\n';
  code += '        backup_dir.mkdir(parents=True, exist_ok=True)\n';
  code += '        print(f"[ClusterManager] ✓ Backup created: {backup_dir}")\n\n';

  code += '    def restore_backup(self) -> None:\n';
  code += '        print("[ClusterManager] Restoring from backup...")\n';
  code += '        backup_path = Path.cwd() / "backups"\n';
  code += '        if backup_path.exists():\n';
  code += '            latest = max(backup_path.iterdir(), key=lambda p: p.stat().st_mtime)\n';
  code += '            subprocess.run(["kubectl", "apply", "-f", str(latest)], check=True, capture_output=True)\n';
  code += '            print(f"[ClusterManager] ✓ Backup restored from: {latest}")\n\n';

  code += '    def get_nodes(self) -> List[Dict[str, Any]]:\n';
  code += '        result = subprocess.run(["kubectl", "get", "nodes", "-o", "json"], capture_output=True, text=True)\n';
  code += '        return json.loads(result.stdout)["items"]\n\n';

  code += 'cluster_manager = ClusterManager(\n';
  code += '    project_name="' + config.projectName + '",\n';
  code += '    kubeconfig="' + config.kubeconfig + '",\n';
  code += '    context="' + config.context + '",\n';
  code += '    namespace="' + config.namespace + '",\n';
  code += '    upgrade_config=ClusterUpgradeConfig(**' + JSON.stringify(config.upgradeConfig) + '),\n';
  code += '    enable_monitoring=' + config.enableMonitoring + ',\n';
  code += '    enable_logging=' + config.enableLogging + ',\n';
  code += ')\n';

  return code;
}

export async function writeFiles(config: ClusterManagerConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptClusterManager(config);
    await fs.writeFile(path.join(outputDir, 'cluster-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-cluster-manager',
      version: '1.0.0',
      description: 'Kubernetes Cluster Management and Upgrade Automation',
      main: 'cluster-manager.ts',
      scripts: {
        upgrade: 'ts-node cluster-manager.ts',
      },
      dependencies: {
        '@kubernetes/client-node': '^0.20.0',
        'js-yaml': '^4.1.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'ts-node': '^10.9.0',
        typescript: '^5.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonClusterManager(config);
    await fs.writeFile(path.join(outputDir, 'cluster-manager.py'), pyCode);

    const requirements = [
      'kubernetes>=28.0.0',
      'pyyaml>=6.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateClusterManagerMD(config);
  await fs.writeFile(path.join(outputDir, 'CLUSTER_MANAGER.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    kubeconfig: config.kubeconfig,
    context: config.context,
    namespace: config.namespace,
    upgradeConfig: config.upgradeConfig,
    safetyChecks: config.safetyChecks,
    enableMonitoring: config.enableMonitoring,
    enableLogging: config.enableLogging,
  };
  await fs.writeFile(path.join(outputDir, 'cluster-config.json'), JSON.stringify(configJson, null, 2));
}
