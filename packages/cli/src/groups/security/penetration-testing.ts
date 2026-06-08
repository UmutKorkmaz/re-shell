import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security penetration-testing` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerPenetrationTesting(security: Command): void {
  security
  .command('penetration-testing')
  .description('Generate penetration testing automation and reporting with continuous assessment')
  .argument('<name>', 'Name of the penetration testing project')
  .option('--auto-scheduling', 'Enable automatic test scheduling')
  .option('--frequency <frequency>', 'Test frequency (daily, weekly, monthly, quarterly, on-demand)', 'weekly')
  .option('--scan-method <method>', 'Scan method (black-box, gray-box, white-box)', 'black-box')
  .option('--assessment-type <type>', 'Assessment type (automated, manual, hybrid)', 'automated')
  .option('--max-duration <hours>', 'Maximum test duration in hours', '24')
  .option('--allow-production', 'Allow testing on production environment')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low, info)', 'high')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--continuous-testing', 'Enable continuous testing mode')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './penetration-testing-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writePenetrationTestingFiles, displayPenetrationTestingConfig } = await import('../../utils/penetration-testing.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoScheduling: options.autoScheduling || true,
        frequency: options.frequency,
        scanMethod: options.scanMethod,
        assessmentType: options.assessmentType,
        concurrentTests: 5,
        maxDuration: parseInt(options.maxDuration),
        allowProduction: options.allowProduction || false,
        requireApproval: !options.allowProduction,
        approvers: ['security-manager', 'ciso'],
        notificationChannels: ['email', 'slack', 'pagerduty'],
        severityThreshold: options.severityThreshold,
        autoRemediation: options.autoRemediation || false,
        continuousTesting: options.continuousTesting || true,
        testingWindow: {
          start: '22:00',
          end: '06:00',
          timezone: 'UTC',
        },
        excludedTargets: [],
        complianceStandards: ['PCI-DSS', 'OWASP', 'NIST-800-53'],
        retentionPeriod: 2555,
      },
      tests: [
        {
          id: 'test-001',
          name: 'Web Application Penetration Test',
          description: 'Comprehensive security assessment of web application including OWASP Top 10 vulnerabilities',
          type: 'web' as const,
          status: 'completed' as const,
          severity: 'high' as const,
          confidence: 0.92,
          methodology: 'OWASP Testing Guide v4.2, PTES, OSSTMM',
          startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          estimatedDuration: 24,
          actualDuration: 23.5,
          progress: 100,
          targets: [
            {
              id: 'target-001',
              name: 'Primary Web Application',
              type: 'url' as const,
              address: 'https://app.example.com',
              description: 'Main production web application',
              inScope: true,
              priority: 'critical' as const,
              authentication: {
                type: 'bearer' as const,
              },
            },
            {
              id: 'target-002',
              name: 'Admin Panel',
              type: 'url' as const,
              address: 'https://admin.example.com',
              description: 'Administrative interface',
              inScope: true,
              priority: 'high' as const,
            },
            {
              id: 'target-003',
              name: 'API Gateway',
              type: 'api' as const,
              address: 'https://api.example.com',
              description: 'RESTful API endpoints',
              inScope: true,
              priority: 'high' as const,
              authentication: {
                type: 'api-key' as const,
              },
            },
          ],
          scope: {
            include: ['*.example.com', 'app.example.com/*'],
            exclude: ['blog.example.com', 'docs.example.com'],
            constraints: ['No DoS testing', 'No social engineering'],
            rules: ['Report all findings', 'Stop on critical impact'],
            authorizations: ['Client approval #12345', 'Rules of Engagement signed'],
          },
          tools: [
            {
              id: 'tool-001',
              name: 'Burp Suite Professional',
              category: 'web' as const,
              version: '2023.10',
              command: 'burpsuite',
              parameters: {
                project: 'app-pentest',
                target: 'app.example.com',
              },
              status: 'completed' as const,
              startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
              duration: 79200,
              output: 'burp-report.html',
              findings: ['finding-001', 'finding-002', 'finding-003'],
              errors: [],
            },
            {
              id: 'tool-002',
              name: 'SQLmap',
              category: 'web' as const,
              version: '1.7',
              command: 'sqlmap -u',
              parameters: {
                url: 'https://app.example.com/search',
                level: '5',
                risk: '3',
              },
              status: 'completed' as const,
              startedAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 44 * 60 * 60 * 1000),
              duration: 7200,
              output: 'sqlmap-results.json',
              findings: ['finding-001'],
              errors: [],
            },
          ],
          findings: [
            {
              id: 'finding-001',
              title: 'SQL Injection in Search Functionality',
              description: 'The search parameter is vulnerable to time-based blind SQL injection allowing unauthorized database access',
              type: 'injection' as const,
              severity: 'critical' as const,
              confidence: 0.95,
              impact: 'critical' as const,
              likelihood: 'certain' as const,
              cwe: 'CWE-89',
              owasp: 'A03:2021',
              cvssScore: 9.8,
              cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
              affectedTargets: ['target-001'],
              reproduction: [
                '1. Navigate to https://app.example.com/search',
                '2. Enter payload: test\' OR SLEEP(5)--',
                '3. Observe 5-second delay confirming SQL injection',
              ],
              evidence: ['sqlmap-output.txt', 'burp-request-001.req'],
              poc: "curl 'https://app.example.com/search?q=test\\' OR SLEEP(5)--'",
              remediation: {
                description: 'Implement parameterized queries and input validation',
                complexity: 'easy' as const,
                priority: 'p1' as const,
                estimatedTime: 4,
                steps: [
                  'Replace string concatenation with parameterized queries',
                  'Validate and sanitize all user input',
                  'Implement prepared statements for all database queries',
                  'Add input length restrictions',
                  'Implement Web Application Firewall (WAF) rules',
                ],
                codeExample: '// Before\nconst query = "SELECT * FROM users WHERE name = \'" + input + "\'";\n\n// After\nconst query = "SELECT * FROM users WHERE name = ?";\ndb.execute(query, [input]);',
                references: ['https://owasp.org/www-community/attacks/SQL_Injection', 'CWE-89'],
              },
              references: [
                'https://owasp.org/www-project-top-ten/',
                'https://cwe.mitre.org/data/definitions/89.html',
              ],
              discoveredBy: 'pentester@company.com',
              discoveredAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
              verified: true,
            },
            {
              id: 'finding-002',
              title: 'Stored Cross-Site Scripting (XSS) in User Profile',
              description: 'User profile bio field lacks proper output encoding allowing persistent XSS attacks',
              type: 'cross-site-scripting' as const,
              severity: 'high' as const,
              confidence: 0.88,
              impact: 'high' as const,
              likelihood: 'likely' as const,
              cwe: 'CWE-79',
              owasp: 'A03:2021',
              cvssScore: 8.1,
              cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
              affectedTargets: ['target-001'],
              reproduction: [
                '1. Log in as regular user',
                '2. Navigate to profile settings',
                '3. Enter bio: <script>alert(document.cookie)</script>',
                '4. Save profile',
                '5. View profile - XSS executes',
              ],
              evidence: ['xss-screenshot.png', 'burp-response-002.resp'],
              poc: '<img src=x onerror=alert(1)>',
              remediation: {
                description: 'Implement context-aware output encoding',
                complexity: 'medium' as const,
                priority: 'p1' as const,
                estimatedTime: 8,
                steps: [
                  'Encode all user-generated content before rendering',
                  'Implement Content Security Policy (CSP)',
                  'Use HTML sanitization libraries (DOMPurify)',
                  'Validate input on server-side',
                  'Escape HTML entities in output',
                ],
                codeExample: '// Use DOMPurify\nimport DOMPurify from \'dompurify\';\nconst clean = DOMPurify.sanitize(userInput);\nelement.innerHTML = clean;',
                references: ['https://owasp.org/www-community/attacks/xss/', 'CWE-79'],
              },
              references: [
                'https://owasp.org/www-community/attacks/xss/',
                'https://cwe.mitre.org/data/definitions/79.html',
              ],
              discoveredBy: 'pentester@company.com',
              discoveredAt: new Date(Date.now() - 40 * 60 * 60 * 1000),
              verified: true,
            },
            {
              id: 'finding-003',
              title: 'Broken Access Control - IDOR',
              description: 'Direct object reference allows accessing other users\' data by changing URL parameter',
              type: 'broken-access-control' as const,
              severity: 'high' as const,
              confidence: 0.85,
              impact: 'high' as const,
              likelihood: 'likely' as const,
              cwe: 'CWE-639',
              owasp: 'A01:2021',
              cvssScore: 7.5,
              cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
              affectedTargets: ['target-001'],
              reproduction: [
                '1. Log in as user A (ID: 1001)',
                '2. Access profile: /api/users/1001/profile',
                '3. Change ID to 1002: /api/users/1002/profile',
                '4. User B\'s profile data is returned',
              ],
              evidence: ['idor-request-003.req'],
              poc: 'curl -H "Authorization: Bearer TOKEN_A" https://api.example.com/users/1002/profile',
              remediation: {
                description: 'Implement proper access control checks',
                complexity: 'medium' as const,
                priority: 'p2' as const,
                estimatedTime: 12,
                steps: [
                  'Validate user ownership on every resource access',
                  'Implement session-based authorization',
                  'Use UUIDs instead of sequential IDs',
                  'Add access control middleware',
                  'Implement role-based access control (RBAC)',
                ],
                references: ['https://owasp.org/www-project-top-ten/2021/A01_2021-Broken_Access_Control', 'CWE-639'],
              },
              references: [
                'https://owasp.org/www-project-top-ten/',
                'https://cwe.mitre.org/data/definitions/639.html',
              ],
              discoveredBy: 'pentester@company.com',
              discoveredAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
              verified: true,
            },
          ],
          approvedBy: 'ciso@company.com',
          approvedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
          assignedTo: 'lead-pentester@company.com',
          team: ['pentester@company.com', 'security-analyst@company.com'],
          tags: ['web', 'owasp-top-10', 'production', 'quarterly'],
          metadata: {
            testType: 'black-box',
            methodology: 'OWASP',
            compliance: ['PCI-DSS', 'SOC2'],
          },
        },
      ],
      vulnerabilities: [
        {
          id: 'vuln-001',
          title: 'SQL Injection Vulnerability',
          type: 'injection' as const,
          severity: 'critical' as const,
          description: 'Multiple SQL injection vulnerabilities discovered in search and filtering functions',
          affectedTests: ['test-001'],
          firstSeen: new Date(Date.now() - 46 * 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
          occurrences: 5,
          status: 'in-progress' as const,
          cvssScore: 9.8,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          cwe: 'CWE-89',
          owasp: 'A03:2021',
          remediation: {
            description: 'Implement parameterized queries and input validation',
            complexity: 'easy' as const,
            priority: 'p1' as const,
            estimatedTime: 4,
            steps: [
              'Replace string concatenation with parameterized queries',
              'Validate all user input',
              'Implement prepared statements',
            ],
            references: ['OWASP SQL Injection Prevention Cheat Sheet'],
          },
          assignedTo: 'dev-team-lead@company.com',
        },
        {
          id: 'vuln-002',
          title: 'Cross-Site Scripting (XSS)',
          type: 'cross-site-scripting' as const,
          severity: 'high' as const,
          description: 'Stored XSS in user profile and comments section',
          affectedTests: ['test-001'],
          firstSeen: new Date(Date.now() - 40 * 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
          occurrences: 3,
          status: 'open' as const,
          cvssScore: 8.1,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
          cwe: 'CWE-79',
          owasp: 'A03:2021',
          remediation: {
            description: 'Implement output encoding and CSP',
            complexity: 'medium' as const,
            priority: 'p1' as const,
            estimatedTime: 8,
            steps: ['Encode output', 'Implement CSP', 'Use DOMPurify'],
            references: ['OWASP XSS Prevention Cheat Sheet'],
          },
          assignedTo: 'frontend-team-lead@company.com',
        },
        {
          id: 'vuln-003',
          title: 'Broken Access Control',
          type: 'broken-access-control' as const,
          severity: 'high' as const,
          description: 'Insecure direct object references allowing unauthorized data access',
          affectedTests: ['test-001'],
          firstSeen: new Date(Date.now() - 36 * 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
          occurrences: 8,
          status: 'open' as const,
          cvssScore: 7.5,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
          cwe: 'CWE-639',
          owasp: 'A01:2021',
          remediation: {
            description: 'Implement proper access control checks',
            complexity: 'medium' as const,
            priority: 'p2' as const,
            estimatedTime: 12,
            steps: ['Validate ownership', 'Implement RBAC', 'Use UUIDs'],
            references: ['OWASP Access Control Cheat Sheet'],
          },
        },
      ],
      assessments: [
        {
          id: 'assessment-001',
          name: 'Quarterly Security Assessment',
          description: 'Automated security assessment for Q4 2024',
          type: 'automated' as const,
          method: 'black-box' as const,
          status: 'completed' as const,
          scheduledFor: new Date(Date.now() - 48 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          duration: 24,
          targets: [],
          tools: ['Burp Suite', 'SQLmap', 'Nmap', 'Nikto'],
          findings: ['finding-001', 'finding-002', 'finding-003'],
          vulnerabilities: ['vuln-001', 'vuln-002', 'vuln-003'],
          riskScore: 78,
          compliance: [
            {
              standard: 'OWASP Top 10',
              status: 'non-compliant' as const,
              score: 65,
              requirements: [
                {
                  id: 'A01-2021',
                  requirement: 'Broken Access Control',
                  status: 'fail' as const,
                  findings: ['finding-003'],
                },
                {
                  id: 'A03-2021',
                  requirement: 'Injection',
                  status: 'fail' as const,
                  findings: ['finding-001', 'finding-002'],
                },
              ],
            },
            {
              standard: 'PCI-DSS',
              status: 'partial' as const,
              score: 72,
              requirements: [
                {
                  id: '6.5.1',
                  requirement: 'Injection flaws',
                  status: 'fail' as const,
                  findings: ['vuln-001'],
                },
                {
                  id: '6.5.7',
                  requirement: 'XSS',
                  status: 'fail' as const,
                  findings: ['vuln-002'],
                },
              ],
            },
          ],
          recommendations: [
            'Immediately patch SQL injection vulnerabilities (P1)',
            'Implement output encoding for XSS prevention',
            'Add proper access control checks',
            'Implement Web Application Firewall',
            'Conduct regular security training',
          ],
        },
      ],
      reports: [],
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-Q4',
          totalTests: 24,
          completedTests: 22,
          totalFindings: 156,
          byType: {
            network: 35,
            web: 68,
            mobile: 12,
            api: 28,
            wireless: 8,
            'social-engineering': 3,
            physical: 0,
            cloud: 2,
            iot: 0,
            custom: 0,
          },
          bySeverity: {
            critical: 12,
            high: 45,
            medium: 68,
            low: 31,
            info: 0,
          },
          meanTimeToComplete: 18.5,
          remediationRate: 72.5,
          falsePositiveRate: 8.3,
          riskTrend: 'improving' as const,
          topVulnerabilities: [
            { type: 'injection' as const, count: 32, severity: 'high' as const, trend: 'decreasing' as const },
            { type: 'cross-site-scripting' as const, count: 28, severity: 'high' as const, trend: 'stable' as const },
            { type: 'broken-access-control' as const, count: 24, severity: 'high' as const, trend: 'decreasing' as const },
            { type: 'security-misconfiguration' as const, count: 18, severity: 'medium' as const, trend: 'stable' as const },
            { type: 'sensitive-data-exposure' as const, count: 15, severity: 'medium' as const, trend: 'increasing' as const },
          ],
          complianceScores: [
            { standard: 'OWASP Top 10', score: 72, trend: 'improving' as const, lastAssessed: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            { standard: 'PCI-DSS', score: 78, trend: 'stable' as const, lastAssessed: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            { standard: 'NIST-800-53', score: 81, trend: 'improving' as const, lastAssessed: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ],
          testingCoverage: 85,
          toolsUsage: [
            { tool: 'Burp Suite', category: 'web' as const, usage: 45, findings: 98, avgDuration: 180 },
            { tool: 'SQLmap', category: 'web' as const, usage: 38, findings: 32, avgDuration: 45 },
            { tool: 'Nmap', category: 'network' as const, usage: 52, findings: 35, avgDuration: 30 },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'Burp Suite Professional',
          type: 'scanner' as const,
          provider: 'PortSwigger',
          enabled: true,
          config: {
            apiUrl: 'https://burp.example.com:8080',
            apiKey: '********',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
          testsImported: 45,
          findingsGenerated: 156,
        },
        {
          id: 'integration-002',
          name: 'Jira Integration',
          type: 'ticketing' as const,
          provider: 'Atlassian',
          enabled: true,
          config: {
            instance: 'company.atlassian.net',
            project: 'SEC',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
          testsImported: 0,
          findingsGenerated: 156,
        },
      ],
    };

    displayPenetrationTestingConfig(finalConfig);

    await writePenetrationTestingFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: penetration-testing-${providers.join('.tf, penetration-testing-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'penetration-testing-manager.ts' : 'penetration_testing_manager.py'}`));
    console.log(chalk.green('✅ Generated: PENETRATION_TESTING.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: penetration-testing-config.json\n'));

    console.log(chalk.green('✓ Penetration testing automation and reporting configured successfully!'));
  }));

}
