// Auto-generated Team Burnout Detection and Wellness Monitoring Utility
// Generated at: 2026-01-13T14:30:00.000Z

type WellnessMetric = 'work-hours' | 'overtime' | 'breaks' | 'time-off' | 'sentiment' | 'engagement' | 'stress-level' | 'sleep-pattern';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type InterventionType = 'mandatory-break' | 'reduce-workload' | 'time-off' | 'counseling' | 'team-adjustment' | 'role-change' | 'resource-allocation';
type InterventionStatus = 'recommended' | 'scheduled' | 'in-progress' | 'completed' | 'declined';

interface WellnessIndicator {
  metric: WellnessMetric;
  value: number;
  unit: string;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'declining' | 'stable';
}

interface BurnoutRiskFactor {
  category: 'workload' | 'environment' | 'personal' | 'organizational';
  factor: string;
  severity: number; // 1-10
  duration: number; // in days
  impact: string;
}

interface WellnessIntervention {
  id: string;
  type: InterventionType;
  title: string;
  description: string;
  priority: RiskLevel;
  status: InterventionStatus;
  startDate?: Date;
  endDate?: Date;
  assignedTo?: string;
  estimatedDuration: number; // in days
  effectiveness?: number; // percentage (0-100)
  notes?: string;
}

interface TeamMemberWellness {
  memberId: string;
  memberName: string;
  team: string;
  role: string;
  indicators: WellnessIndicator[];
  riskFactors: BurnoutRiskFactor[];
  overallRiskLevel: RiskLevel;
  riskScore: number; // 0-100
  interventions: WellnessIntervention[];
  lastAssessment: Date;
  nextCheckIn: Date;
  notes: string[];
}

interface WellnessMetricConfig {
  metric: WellnessMetric;
  weight: number; // for overall risk calculation
  healthyRange: [number, number];
  warningRange: [number, number];
  criticalRange: [number, number];
  collectionMethod: 'survey' | 'automated' | 'manager-input' | 'peer-feedback';
}

interface BurnoutDetectionConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  teamMembers: TeamMemberWellness[];
  metricConfigs: WellnessMetricConfig[];
  interventions: WellnessIntervention[];
  enableRealTimeMonitoring: boolean;
  enableAutomatedInterventions: boolean;
  enableAnonymousSurveys: boolean;
  surveyFrequency: number; // in days
  riskThreshold: number; // 0-100, above which interventions trigger
  escalationMatrix: {
    medium: string[];
    high: string[];
    critical: string[];
  };
}

export function displayConfig(config: BurnoutDetectionConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '🧘 Team Burnout Detection and Wellness Monitoring');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Team Members:', config.teamMembers.length);
  console.log('\x1b[33m%s\x1b[0m', 'Interventions:', config.interventions.length);
  console.log('\x1b[33m%s\x1b[0m', 'Real-time Monitoring:', config.enableRealTimeMonitoring ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Automated Interventions:', config.enableAutomatedInterventions ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Anonymous Surveys:', config.enableAnonymousSurveys ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Survey Frequency:', config.surveyFrequency + ' days');
  console.log('\x1b[33m%s\x1b[0m', 'Risk Threshold:', config.riskThreshold + '%');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateBurnoutDetectionMD(config: BurnoutDetectionConfig): string {
  let md = '# Team Burnout Detection and Wellness Monitoring\n\n';
  md += '## Features\n\n';
  md += '- Wellness metrics: work hours, overtime, breaks, time-off, sentiment, engagement, stress level, sleep patterns\n';
  md += '- Risk levels: low, medium, high, critical\n';
  md += '- Comprehensive wellness indicators with thresholds and trends\n';
  md += '- Burnout risk factor analysis across multiple categories\n';
  md += '- Intervention types: mandatory break, reduce workload, time-off, counseling, team adjustment, role change, resource allocation\n';
  md += '- Intervention tracking with status and effectiveness\n';
  md += '- Risk score calculation (0-100)\n';
  md += '- Automated monitoring and alerts\n';
  md += '- Anonymous survey support\n';
  md += '- Configurable metric collection methods\n';
  md += '- Escalation matrix by risk level\n';
  md += '- Multi-cloud provider support\n\n';
  md += '## Risk Assessment\n\n';
  md += '### Risk Categories\n';
  md += '- **Workload**: Excessive hours, tight deadlines, resource constraints\n';
  md += '- **Environment**: Toxic culture, poor communication, lack of support\n';
  md += '- **Personal**: Health issues, family stress, financial pressure\n';
  md += '- **Organizational**: Restructuring, job insecurity, poor leadership\n\n';
  md += '### Intervention Strategies\n';
  md += '- **Low Risk**: Monitor regularly, provide resources\n';
  md += '- **Medium Risk**: Schedule check-ins, consider workload adjustment\n';
  md += '- **High Risk**: Mandatory interventions, reduce workload, counseling\n';
  md += '- **Critical Risk**: Immediate time-off, comprehensive support program\n\n';
  return md;
}

export function generateTerraformBurnoutDetection(config: BurnoutDetectionConfig): string {
  let code = '# Auto-generated Burnout Detection Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

export function generateTypeScriptBurnoutDetection(config: BurnoutDetectionConfig): string {
  let code = '// Auto-generated Burnout Detection Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'interface WellnessIndicator {\n';
  code += '  metric: string;\n';
  code += '  value: number;\n';
  code += '  unit: string;\n';
  code += '  threshold: number;\n';
  code += '  status: \'healthy\' | \'warning\' | \'critical\';\n';
  code += '  trend: \'improving\' | \'declining\' | \'stable\';\n';
  code += '}\n\n';
  code += 'interface BurnoutRiskFactor {\n';
  code += '  category: string;\n';
  code += '  factor: string;\n';
  code += '  severity: number;\n';
  code += '  duration: number;\n';
  code += '  impact: string;\n';
  code += '}\n\n';
  code += 'class BurnoutDetectionManager extends EventEmitter {\n';
  code += '  private teamMembers: Map<string, any> = new Map();\n';
  code += '  private metricConfigs: Map<string, any> = new Map();\n';
  code += '  private riskThreshold: number;\n';
  code += '  private enableAutomatedInterventions: boolean;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.riskThreshold = options.riskThreshold || 70;\n';
  code += '    this.enableAutomatedInterventions = options.enableAutomatedInterventions || false;\n';
  code += '  }\n\n';
  code += '  addTeamMember(member: any): void {\n';
  code += '    this.teamMembers.set(member.memberId, member);\n';
  code += '    this.emit(\'member-added\', member);\n';
  code += '  }\n\n';
  code += '  calculateRiskScore(indicators: WellnessIndicator[]): number {\n';
  code += '    let totalScore = 0;\n';
  code += '    let weightSum = 0;\n\n';
  code += '    for (const indicator of indicators) {\n';
  code += '      let score = 0;\n';
  code += '      const weight = 1;\n\n';
  code += '      if (indicator.status === \'critical\') {\n';
  code += '        score = 90;\n';
  code += '      } else if (indicator.status === \'warning\') {\n';
  code += '        score = 60;\n';
  code += '      } else {\n';
  code += '        score = 20;\n';
  code += '      }\n\n';
  code += '      if (indicator.trend === \'declining\') {\n';
  code += '        score += 10;\n';
  code += '      } else if (indicator.trend === \'improving\') {\n';
  code += '        score -= 10;\n';
  code += '      }\n\n';
  code += '      totalScore += score * weight;\n';
  code += '      weightSum += weight;\n';
  code += '    }\n\n';
  code += '    return Math.round(totalScore / weightSum);\n';
  code += '  }\n\n';
  code += '  assessWellness(memberId: string): any {\n';
  code += '    const member = this.teamMembers.get(memberId);\n';
  code += '    if (!member) {\n';
  code += '      throw new Error(`Member not found: ${memberId}`);\n';
  code += '    }\n\n';
  code += '    const riskScore = this.calculateRiskScore(member.indicators);\n';
  code += '    let riskLevel: \'low\' | \'medium\' | \'high\' | \'critical\';\n\n';
  code += '    if (riskScore >= 90) {\n';
  code += '      riskLevel = \'critical\';\n';
  code += '    } else if (riskScore >= 70) {\n';
  code += '      riskLevel = \'high\';\n';
  code += '    } else if (riskScore >= 40) {\n';
  code += '      riskLevel = \'medium\';\n';
  code += '    } else {\n';
  code += '      riskLevel = \'low\';\n';
  code += '    }\n\n';
  code += '    member.overallRiskLevel = riskLevel;\n';
  code += '    member.riskScore = riskScore;\n\n';
  code += '    this.emit(\'wellness-assessed\', { memberId, riskLevel, riskScore });\n\n';
  code += '    if (riskScore >= this.riskThreshold && this.enableAutomatedInterventions) {\n';
  code += '      this.triggerIntervention(memberId, riskLevel);\n';
  code += '    }\n\n';
  code += '    return { riskLevel, riskScore };\n';
  code += '  }\n\n';
  code += '  triggerIntervention(memberId: string, riskLevel: string): void {\n';
  code += '    const member = this.teamMembers.get(memberId);\n';
  code += '    if (!member) return;\n\n';
  code += '    let interventionType: string;\n';
  code += '    let priority: string;\n\n';
  code += '    switch (riskLevel) {\n';
  code += '      case \'critical\':\n';
  code += '        interventionType = \'time-off\';\n';
  code += '        priority = \'critical\';\n';
  code += '        break;\n';
  code += '      case \'high\':\n';
  code += '        interventionType = \'reduce-workload\';\n';
  code += '        priority = \'high\';\n';
  code += '        break;\n';
  code += '      case \'medium\':\n';
  code += '        interventionType = \'mandatory-break\';\n';
  code += '        priority = \'medium\';\n';
  code += '        break;\n';
  code += '      default:\n';
  code += '        interventionType = \'resource-allocation\';\n';
  code += '        priority = \'low\';\n';
  code += '    }\n\n';
  code += '    const intervention = {\n';
  code += '      id: `int-${Date.now()}`,\n';
  code += '      type: interventionType,\n';
  code += '      title: `Automatic ${interventionType} intervention`,\n';
  code += '      description: `Triggered for ${member.memberName} due to ${riskLevel} risk level`,\n';
  code += '      priority,\n';
  code += '      status: \'recommended\',\n';
  code += '      estimatedDuration: riskLevel === \'critical\' ? 14 : 7,\n';
  code += '    };\n\n';
  code += '    member.interventions.push(intervention);\n';
  code += '    this.emit(\'intervention-triggered\', { memberId, intervention });\n';
  code += '  }\n\n';
  code += '  generateReport(): any[] {\n';
  code += '    const report: any[] = [];\n\n';
  code += '    for (const member of this.teamMembers.values()) {\n';
  code += '      report.push({\n';
  code += '        memberId: member.memberId,\n';
  code += '        memberName: member.memberName,\n';
  code += '        team: member.team,\n';
  code += '        riskLevel: member.overallRiskLevel,\n';
  code += '        riskScore: member.riskScore,\n';
  code += '        activeInterventions: member.interventions.filter((i: any) => \n';
  code += '          i.status === \'in-progress\' || i.status === \'recommended\'\n';
  code += '        ).length,\n';
  code += '        lastAssessment: member.lastAssessment,\n';
  code += '      });\n';
  code += '    }\n\n';
  code += '    return report.sort((a, b) => b.riskScore - a.riskScore);\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const burnoutDetectionManager = new BurnoutDetectionManager({\n';
  code += '  riskThreshold: ' + config.riskThreshold + ',\n';
  code += '  enableAutomatedInterventions: ' + config.enableAutomatedInterventions + ',\n';
  code += '});\n';
  code += 'export default burnoutDetectionManager;\n';
  return code;
}

export function generatePythonBurnoutDetection(config: BurnoutDetectionConfig): string {
  let code = '# Auto-generated Burnout Detection Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'from typing import Dict, List, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n';
  code += 'from enum import Enum\n\n';
  code += 'class RiskLevel(Enum):\n';
  code += '    LOW = "low"\n';
  code += '    MEDIUM = "medium"\n';
  code += '    HIGH = "high"\n';
  code += '    CRITICAL = "critical"\n\n';
  code += '@dataclass\n';
  code += 'class WellnessIndicator:\n';
  code += '    metric: str\n';
  code += '    value: float\n';
  code += '    unit: str\n';
  code += '    threshold: float\n';
  code += '    status: str  # healthy, warning, critical\n';
  code += '    trend: str  # improving, declining, stable\n\n';
  code += 'class BurnoutDetectionManager:\n';
  code += '    def __init__(self, project_name: str = \'' + config.projectName + '\'):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.team_members: Dict[str, Any] = {}\n';
  code += '        self.risk_threshold = ' + config.riskThreshold + '\n';
  code += '        self.enable_automated_interventions = ' + (config.enableAutomatedInterventions ? 'True' : 'False') + '\n\n';
  code += '    def add_team_member(self, member: Any) -> None:\n';
  code += '        self.team_members[member[\'member_id\']] = member\n\n';
  code += '    def calculate_risk_score(self, indicators: List[WellnessIndicator]) -> int:\n';
  code += '        total_score = 0\n';
  code += '        weight_sum = 0\n\n';
  code += '        for indicator in indicators:\n';
  code += '            if indicator.status == \'critical\':\n';
  code += '                score = 90\n';
  code += '            elif indicator.status == \'warning\':\n';
  code += '                score = 60\n';
  code += '            else:\n';
  code += '                score = 20\n\n';
  code += '            if indicator.trend == \'declining\':\n';
  code += '                score += 10\n';
  code += '            elif indicator.trend == \'improving\':\n';
  code += '                score -= 10\n\n';
  code += '            total_score += score\n';
  code += '            weight_sum += 1\n\n';
  code += '        return round(total_score / weight_sum) if weight_sum > 0 else 0\n\n';
  code += '    def assess_wellness(self, member_id: str) -> Dict[str, Any]:\n';
  code += '        member = self.team_members.get(member_id)\n';
  code += '        if not member:\n';
  code += '            raise ValueError(f"Member not found: {member_id}")\n\n';
  code += '        risk_score = self.calculate_risk_score(member.get(\'indicators\', []))\n\n';
  code += '        if risk_score >= 90:\n';
  code += '            risk_level = RiskLevel.CRITICAL\n';
  code += '        elif risk_score >= 70:\n';
  code += '            risk_level = RiskLevel.HIGH\n';
  code += '        elif risk_score >= 40:\n';
  code += '            risk_level = RiskLevel.MEDIUM\n';
  code += '        else:\n';
  code += '            risk_level = RiskLevel.LOW\n\n';
  code += '        member[\'overall_risk_level\'] = risk_level.value\n';
  code += '        member[\'risk_score\'] = risk_score\n\n';
  code += '        if risk_score >= self.risk_threshold and self.enable_automated_interventions:\n';
  code += '            self.trigger_intervention(member_id, risk_level.value)\n\n';
  code += '        return {\'risk_level\': risk_level.value, \'risk_score\': risk_score}\n\n';
  code += '    def trigger_intervention(self, member_id: str, risk_level: str) -> None:\n';
  code += '        member = self.team_members.get(member_id)\n';
  code += '        if not member:\n';
  code += '            return\n\n';
  code += '        intervention_map = {\n';
  code += '            \'critical\': (\'time-off\', 14),\n';
  code += '            \'high\': (\'reduce-workload\', 7),\n';
  code += '            \'medium\': (\'mandatory-break\', 3),\n';
  code += '            \'low\': (\'resource-allocation\', 1),\n';
  code += '        }\n\n';
  code += '        intervention_type, duration = intervention_map.get(risk_level, (\'resource-allocation\', 1))\n\n';
  code += '        intervention = {\n';
  code += '            \'id\': f"int-{int(datetime.now().timestamp())}",\n';
  code += '            \'type\': intervention_type,\n';
  code += '            \'title\': f"Automatic {intervention_type} intervention",\n';
  code += '            \'description\': f"Triggered for {member.get(\'member_name\')} due to {risk_level} risk level",\n';
  code += '            \'priority\': risk_level,\n';
  code += '            \'status\': \'recommended\',\n';
  code += '            \'estimated_duration\': duration,\n';
  code += '        }\n\n';
  code += '        if \'interventions\' not in member:\n';
  code += '            member[\'interventions\'] = []\n';
  code += '        member[\'interventions\'].append(intervention)\n\n';
  code += '    def generate_report(self) -> List[Dict[str, Any]]:\n';
  code += '        report = []\n\n';
  code += '        for member in self.team_members.values():\n';
  code += '            active_interventions = [\n';
  code += '                i for i in member.get(\'interventions\', [])\n';
  code += '                if i.get(\'status\') in [\'in-progress\', \'recommended\']\n';
  code += '            ]\n\n';
  code += '            report.append({\n';
  code += '                \'member_id\': member.get(\'member_id\'),\n';
  code += '                \'member_name\': member.get(\'member_name\'),\n';
  code += '                \'team\': member.get(\'team\'),\n';
  code += '                \'risk_level\': member.get(\'overall_risk_level\'),\n';
  code += '                \'risk_score\': member.get(\'risk_score\'),\n';
  code += '                \'active_interventions\': len(active_interventions),\n';
  code += '                \'last_assessment\': member.get(\'last_assessment\'),\n';
  code += '            })\n\n';
  code += '        return sorted(report, key=lambda x: x.get(\'risk_score\', 0), reverse=True)\n\n';
  code += 'burnout_detection_manager = BurnoutDetectionManager()\n';
  return code;
}

export async function writeFiles(config: BurnoutDetectionConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformBurnoutDetection(config);
  await fs.writeFile(path.join(outputDir, 'burnout-detection.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptBurnoutDetection(config);
    await fs.writeFile(path.join(outputDir, 'burnout-detection-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-burnout-detection',
      version: '1.0.0',
      description: 'Team Burnout Detection and Wellness Monitoring',
      main: 'burnout-detection-manager.ts',
      dependencies: {},
      devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonBurnoutDetection(config);
    await fs.writeFile(path.join(outputDir, 'burnout_detection_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'pandas>=2.0.0', 'numpy>=1.24.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateBurnoutDetectionMD(config);
  await fs.writeFile(path.join(outputDir, 'BURNOUT_DETECTION.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    teamMembers: config.teamMembers,
    metricConfigs: config.metricConfigs,
    interventions: config.interventions,
    enableRealTimeMonitoring: config.enableRealTimeMonitoring,
    enableAutomatedInterventions: config.enableAutomatedInterventions,
    enableAnonymousSurveys: config.enableAnonymousSurveys,
    surveyFrequency: config.surveyFrequency,
    riskThreshold: config.riskThreshold,
    escalationMatrix: config.escalationMatrix,
  };
  await fs.writeFile(path.join(outputDir, 'burnout-detection-config.json'), JSON.stringify(configJson, null, 2));
}

export function burnoutDetection(config: BurnoutDetectionConfig): BurnoutDetectionConfig {
  return config;
}
