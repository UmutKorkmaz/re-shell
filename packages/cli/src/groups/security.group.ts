import { Command } from 'commander';

import { registerVulnerabilityScan } from './security/vulnerability-scan';
import { registerContainerSecurity } from './security/container-security';
import { registerCodeSecurity } from './security/code-security';
import { registerSecretDetection } from './security/secret-detection';
import { registerInfrastructureSecurity } from './security/infrastructure-security';
import { registerZeroTrust } from './security/zero-trust';
import { registerThreatDetection } from './security/threat-detection';
import { registerIncidentManagement } from './security/incident-management';
import { registerPenetrationTesting } from './security/penetration-testing';
import { registerSupplyChainSecurity } from './security/supply-chain-security';
import { registerSecurityTraining } from './security/security-training';
import { registerSecurityPolicy } from './security/security-policy';
import { registerComplianceReporting } from './security/compliance-reporting';
import { registerCustomPolicy } from './security/custom-policy';
import { registerRbac } from './security/rbac';
import { registerAudit } from './security/audit';
import { registerPrivacy } from './security/privacy';
import { registerRegulatory } from './security/regulatory';
import { registerRisk } from './security/risk';
import { registerVendor } from './security/vendor';
import { registerBcp } from './security/bcp';
import { registerGovernance } from './security/governance';

/**
 * Wires the `security` command group. Each subcommand lives in its own module
 * under ./security/ and registers itself onto the shared `security` command in
 * the original declaration order. This file is a thin registrar only.
 */
export function registerSecurityGroup(program: Command): void {
  const security = new Command('security')
    .description('Security, compliance, and governance commands');

  registerVulnerabilityScan(security);
  registerContainerSecurity(security);
  registerCodeSecurity(security);
  registerSecretDetection(security);
  registerInfrastructureSecurity(security);
  registerZeroTrust(security);
  registerThreatDetection(security);
  registerIncidentManagement(security);
  registerPenetrationTesting(security);
  registerSupplyChainSecurity(security);
  registerSecurityTraining(security);
  registerSecurityPolicy(security);
  registerComplianceReporting(security);
  registerCustomPolicy(security);
  registerRbac(security);
  registerAudit(security);
  registerPrivacy(security);
  registerRegulatory(security);
  registerRisk(security);
  registerVendor(security);
  registerBcp(security);
  registerGovernance(security);

  program.addCommand(security);
}
