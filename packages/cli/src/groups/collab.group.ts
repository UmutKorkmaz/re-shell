import { Command } from 'commander';

import { registerWebrtcSharing } from './collab/webrtc-sharing';
import { registerTerminalBroadcasting } from './collab/terminal-broadcasting';
import { registerOperationalTransform } from './collab/operational-transform';
import { registerSessionRecording } from './collab/session-recording';
import { registerVoiceVideoIntegration } from './collab/voice-video-integration';
import { registerCollaborativeDebugging } from './collab/collaborative-debugging';
import { registerWorkspaceSync } from './collab/workspace-sync';
import { registerArchitectureDesign } from './collab/architecture-design';
import { registerTeamCodingSessions } from './collab/team-coding-sessions';
import { registerCodeReviewWorkflow } from './collab/code-review-workflow';
import { registerCollaborativeTesting } from './collab/collaborative-testing';
import { registerKnowledgeSharing } from './collab/knowledge-sharing';
import { registerPerformanceMonitoringCollab } from './collab/performance-monitoring-collab';
import { registerIncidentResponse } from './collab/incident-response';
import { registerDeveloperProductivity } from './collab/developer-productivity';
import { registerCodeQualityTrends } from './collab/code-quality-trends';
import { registerVelocityTracking } from './collab/velocity-tracking';
import { registerCustomAnalytics } from './collab/custom-analytics';
import { registerTeamPerformanceOptimization } from './collab/team-performance-optimization';
import { registerKnowledgeSharingAutomation } from './collab/knowledge-sharing-automation';
import { registerSkillsAssessment } from './collab/skills-assessment';
import { registerCommunicationAnalysis } from './collab/communication-analysis';
import { registerWorkloadBalancing } from './collab/workload-balancing';
import { registerBurnoutDetection } from './collab/burnout-detection';
import { registerProjectMgmt } from './collab/project-mgmt';
import { registerCollaboration } from './collab/collaboration';
import { registerFeatureFlag } from './collab/feature-flag';

/**
 * Wires the `collab` command group. Each subcommand lives in its own module
 * under ./collab/ and registers itself onto the shared `collab` command in the
 * original declaration order. The per-module `import('../../utils/X.js')`
 * dynamic edges are preserved. This file is a thin registrar only.
 */
export function registerCollabGroup(program: Command): void {
  const collab = new Command('collab')
    .description('Collaboration, team management, and productivity commands');

  registerWebrtcSharing(collab);
  registerTerminalBroadcasting(collab);
  registerOperationalTransform(collab);
  registerSessionRecording(collab);
  registerVoiceVideoIntegration(collab);
  registerCollaborativeDebugging(collab);
  registerWorkspaceSync(collab);
  registerArchitectureDesign(collab);
  registerTeamCodingSessions(collab);
  registerCodeReviewWorkflow(collab);
  registerCollaborativeTesting(collab);
  registerKnowledgeSharing(collab);
  registerPerformanceMonitoringCollab(collab);
  registerIncidentResponse(collab);
  registerDeveloperProductivity(collab);
  registerCodeQualityTrends(collab);
  registerVelocityTracking(collab);
  registerCustomAnalytics(collab);
  registerTeamPerformanceOptimization(collab);
  registerKnowledgeSharingAutomation(collab);
  registerSkillsAssessment(collab);
  registerCommunicationAnalysis(collab);
  registerWorkloadBalancing(collab);
  registerBurnoutDetection(collab);
  registerProjectMgmt(collab);
  registerCollaboration(collab);
  registerFeatureFlag(collab);

  program.addCommand(collab);
}
