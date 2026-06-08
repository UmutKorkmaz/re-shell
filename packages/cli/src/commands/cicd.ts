import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { findMonorepoRoot } from '../utils/monorepo';

interface CICDOptions {
  spinner?: any;
  verbose?: boolean;
  provider?: 'github' | 'gitlab' | 'jenkins' | 'circleci' | 'azure';
  template?: 'basic' | 'advanced' | 'custom';
  force?: boolean;
}

interface EnvironmentConfig {
  name: string;
  url?: string;
  secrets: string[];
  variables: Record<string, string>;
}

export async function generateCICDConfig(options: CICDOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo. Run this command from within a monorepo.');
    }

    if (options.spinner) {
      options.spinner.text = 'Generating CI/CD configuration...';
    }

    const provider = options.provider || 'github';
    const template = options.template || 'basic';

    switch (provider) {
      case 'github':
        await generateGitHubActions(monorepoRoot, template, options);
        break;
      case 'gitlab':
        await generateGitLabCI(monorepoRoot, template, options);
        break;
      case 'jenkins':
        await generateJenkinsfile(monorepoRoot, template, options);
        break;
      case 'circleci':
        await generateCircleCI(monorepoRoot, template, options);
        break;
      case 'azure':
        await generateAzurePipelines(monorepoRoot, template, options);
        break;
      default:
        throw new Error(`Unsupported CI/CD provider: ${provider}`);
    }

    if (options.spinner) {
      options.spinner.succeed(chalk.green(`${provider} CI/CD configuration generated successfully!`));
    }

    console.log('\n' + chalk.bold('Next Steps:'));
    console.log('1. Review the generated configuration files');
    console.log('2. Add required secrets to your CI/CD provider');
    console.log('3. Commit and push the configuration');
    console.log('4. Monitor your first build');

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('CI/CD generation failed'));
    }
    throw error;
  }
}

export async function generateDeployConfig(environment: string, options: CICDOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo');
    }

    if (options.spinner) {
      options.spinner.text = `Generating deployment configuration for ${environment}...`;
    }

    // Generate deployment scripts
    await generateDeploymentScripts(monorepoRoot, environment, options);
    
    // Generate Docker configuration
    await generateDockerConfiguration(monorepoRoot, options);
    
    // Generate environment-specific configs
    await generateEnvironmentConfigs(monorepoRoot, environment, options);

    if (options.spinner) {
      options.spinner.succeed(chalk.green(`Deployment configuration for ${environment} generated!`));
    }

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Deployment configuration failed'));
    }
    throw error;
  }
}

export async function setupEnvironments(environments: EnvironmentConfig[], options: CICDOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo');
    }

    if (options.spinner) {
      options.spinner.text = 'Setting up environments...';
    }

    for (const env of environments) {
      await createEnvironmentConfig(monorepoRoot, env, options);
    }

    if (options.spinner) {
      options.spinner.succeed(chalk.green(`${environments.length} environments configured!`));
    }

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Environment setup failed'));
    }
    throw error;
  }
}

async function generateGitHubActions(monorepoRoot: string, template: string, options: CICDOptions) {
  const workflowsDir = path.join(monorepoRoot, '.github', 'workflows');
  await fs.ensureDir(workflowsDir);

  // Main CI workflow
  const ciWorkflow = `name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run health check
      run: pnpm exec re-shell doctor --verbose
    
    - name: Run linting
      run: pnpm run lint
    
    - name: Run tests
      run: pnpm run test
    
    - name: Build all packages
      run: pnpm run build
    
    - name: Run security audit
      run: pnpm audit
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      if: matrix.node-version == '20.x'

  analyze:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Build packages
      run: pnpm run build
    
    - name: Analyze bundle size
      run: pnpm exec re-shell analyze --type bundle --output analysis-results.json
    
    - name: Upload analysis results
      uses: actions/upload-artifact@v3
      with:
        name: analysis-results
        path: analysis-results.json

  deploy:
    runs-on: ubuntu-latest
    needs: [test, analyze]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Build for production
      run: pnpm run build
      env:
        NODE_ENV: production
    
    - name: Deploy to production
      run: pnpm run deploy
      env:
        DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}
        DEPLOY_URL: \${{ secrets.DEPLOY_URL }}
`;

  await fs.writeFile(path.join(workflowsDir, 'ci.yml'), ciWorkflow);

  if (template === 'advanced') {
    // Advanced workflow with matrix builds, caching, and parallel jobs
    const advancedWorkflow = `name: Advanced CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      packages: \${{ steps.changes.outputs.changes }}
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Check for changes
      uses: dorny/paths-filter@v2
      id: changes
      with:
        filters: |
          cli:
            - 'packages/cli/**'
          ui:
            - 'packages/ui/**'
          core:
            - 'packages/core/**'

  test:
    runs-on: ubuntu-latest
    needs: changes
    if: \${{ needs.changes.outputs.packages != '[]' }}
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        package: \${{ fromJSON(needs.changes.outputs.packages) }}
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        fetch-depth: 0
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Test package
      run: pnpm --filter \${{ matrix.package }} test
    
    - name: Build package
      run: pnpm --filter \${{ matrix.package }} build

  e2e:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push'
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Install Playwright
      run: pnpm exec playwright install --with-deps
    
    - name: Run E2E tests
      run: pnpm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: e2e-results
        path: test-results/
`;

    await fs.writeFile(path.join(workflowsDir, 'advanced-ci.yml'), advancedWorkflow);
  }

  // Security workflow
  const securityWorkflow = `name: Security

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday at 2 AM
  push:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'pnpm'
    
    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run security audit
      run: pnpm exec re-shell analyze --type security --output security-report.json
    
    - name: Upload security report
      uses: actions/upload-artifact@v3
      with:
        name: security-report
        path: security-report.json
    
    - name: Run CodeQL analysis
      uses: github/codeql-action/analyze@v2
      with:
        languages: javascript
`;

  await fs.writeFile(path.join(workflowsDir, 'security.yml'), securityWorkflow);

  console.log(chalk.green('✓ Generated GitHub Actions workflows'));
}

async function generateGitLabCI(monorepoRoot: string, template: string, options: CICDOptions) {
  const gitlabCIContent = `stages:
  - test
  - build
  - analyze
  - deploy

variables:
  NODE_VERSION: "20"
  PNPM_VERSION: "8"

cache:
  key: \${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - packages/*/node_modules/
    - .pnpm-store

before_script:
  - corepack enable
  - corepack prepare pnpm@\${PNPM_VERSION} --activate
  - pnpm config set store-dir .pnpm-store
  - pnpm install --frozen-lockfile

test:
  stage: test
  image: node:\${NODE_VERSION}
  script:
    - pnpm exec re-shell doctor --verbose
    - pnpm run lint
    - pnpm run test
    - pnpm run build
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

bundle-analysis:
  stage: analyze
  image: node:\${NODE_VERSION}
  script:
    - pnpm run build
    - pnpm exec re-shell analyze --type bundle --output bundle-analysis.json
  artifacts:
    paths:
      - bundle-analysis.json
    expire_in: 1 week
  only:
    - main

security-scan:
  stage: analyze
  image: node:\${NODE_VERSION}
  script:
    - pnpm exec re-shell analyze --type security --output security-report.json
  artifacts:
    paths:
      - security-report.json
    expire_in: 1 week
  only:
    - main

deploy-staging:
  stage: deploy
  image: node:\${NODE_VERSION}
  script:
    - pnpm run build
    - pnpm run deploy:staging
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy-production:
  stage: deploy
  image: node:\${NODE_VERSION}
  script:
    - pnpm run build
    - pnpm run deploy:production
  environment:
    name: production
    url: https://example.com
  when: manual
  only:
    - main
`;

  await fs.writeFile(path.join(monorepoRoot, '.gitlab-ci.yml'), gitlabCIContent);
  console.log(chalk.green('✓ Generated GitLab CI configuration'));
}

async function generateJenkinsfile(monorepoRoot: string, template: string, options: CICDOptions) {
  const jenkinsfileContent = `pipeline {
    agent any
    
    tools {
        nodejs '20'
    }
    
    environment {
        PNPM_VERSION = '8'
        NODE_ENV = 'test'
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'corepack enable'
                sh 'corepack prepare pnpm@\${PNPM_VERSION} --activate'
                sh 'pnpm install --frozen-lockfile'
            }
        }
        
        stage('Health Check') {
            steps {
                sh 'pnpm exec re-shell doctor --verbose'
            }
        }
        
        stage('Lint') {
            steps {
                sh 'pnpm run lint'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'lint-results',
                        reportFiles: 'index.html',
                        reportName: 'ESLint Report'
                    ])
                }
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'pnpm run test'
                    }
                    post {
                        always {
                            junit 'test-results/junit.xml'
                            publishHTML([
                                allowMissing: false,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'coverage',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                        }
                    }
                }
                
                stage('Security Scan') {
                    steps {
                        sh 'pnpm exec re-shell analyze --type security --output security-report.json'
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'security-report.json', fingerprint: true
                        }
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                sh 'pnpm run build'
            }
            post {
                success {
                    sh 'pnpm exec re-shell analyze --type bundle --output bundle-analysis.json'
                    archiveArtifacts artifacts: 'bundle-analysis.json', fingerprint: true
                }
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    def deployApproval = input(
                        id: 'deploy',
                        message: 'Deploy to production?',
                        parameters: [
                            choice(choices: ['production', 'staging'], 
                                  description: 'Environment', 
                                  name: 'ENVIRONMENT')
                        ]
                    )
                    
                    sh "pnpm run deploy:\${deployApproval}"
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        failure {
            mail to: 'team@example.com',
                 subject: "Failed Pipeline: \${currentBuild.fullDisplayName}",
                 body: "Pipeline failed. Check Jenkins for details."
        }
    }
}`;

  await fs.writeFile(path.join(monorepoRoot, 'Jenkinsfile'), jenkinsfileContent);
  console.log(chalk.green('✓ Generated Jenkinsfile'));
}

async function generateCircleCI(monorepoRoot: string, template: string, options: CICDOptions) {
  const configDir = path.join(monorepoRoot, '.circleci');
  await fs.ensureDir(configDir);

  const circleciConfig = `version: 2.1

orbs:
  node: circleci/node@5.1.0
  browser-tools: circleci/browser-tools@1.4.6

executors:
  node-executor:
    docker:
      - image: cimg/node:20.9
    working_directory: ~/project

jobs:
  install-and-cache:
    executor: node-executor
    steps:
      - checkout
      - run:
          name: Install pnpm
          command: |
            corepack enable
            corepack prepare pnpm@8 --activate
      - restore_cache:
          keys:
            - dependencies-v1-{{ checksum "pnpm-lock.yaml" }}
            - dependencies-v1-
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - save_cache:
          key: dependencies-v1-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules
            - packages/*/node_modules
      - persist_to_workspace:
          root: ~/project
          paths:
            - .

  health-check:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Health check
          command: pnpm exec re-shell doctor --verbose

  lint-and-test:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Lint
          command: pnpm run lint
      - run:
          name: Test
          command: pnpm run test
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage
          destination: coverage

  build-and-analyze:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Build
          command: pnpm run build
      - run:
          name: Bundle analysis
          command: pnpm exec re-shell analyze --type bundle --output bundle-analysis.json
      - store_artifacts:
          path: bundle-analysis.json
          destination: analysis

  security-scan:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Security analysis
          command: pnpm exec re-shell analyze --type security --output security-report.json
      - store_artifacts:
          path: security-report.json
          destination: security

  deploy:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Deploy
          command: pnpm run deploy

workflows:
  version: 2
  build-test-deploy:
    jobs:
      - install-and-cache
      - health-check:
          requires:
            - install-and-cache
      - lint-and-test:
          requires:
            - install-and-cache
      - build-and-analyze:
          requires:
            - lint-and-test
            - health-check
      - security-scan:
          requires:
            - install-and-cache
      - deploy:
          requires:
            - build-and-analyze
            - security-scan
          filters:
            branches:
              only:
                - main
`;

  await fs.writeFile(path.join(configDir, 'config.yml'), circleciConfig);
  console.log(chalk.green('✓ Generated CircleCI configuration'));
}

async function generateAzurePipelines(monorepoRoot: string, template: string, options: CICDOptions) {
  const azurePipelineContent = `trigger:
  branches:
    include:
      - main
      - develop

pr:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.x'
  pnpmVersion: '8'

stages:
  - stage: Test
    displayName: 'Test and Build'
    jobs:
      - job: TestJob
        displayName: 'Test'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '$(nodeVersion)'
            displayName: 'Install Node.js'

          - script: |
              corepack enable
              corepack prepare pnpm@$(pnpmVersion) --activate
            displayName: 'Install pnpm'

          - script: pnpm install --frozen-lockfile
            displayName: 'Install dependencies'

          - script: pnpm exec re-shell doctor --verbose
            displayName: 'Health check'

          - script: pnpm run lint
            displayName: 'Lint'

          - script: pnpm run test
            displayName: 'Test'

          - task: PublishTestResults@2
            condition: succeededOrFailed()
            inputs:
              testRunner: JUnit
              testResultsFiles: 'test-results/junit.xml'

          - script: pnpm run build
            displayName: 'Build'

          - script: pnpm exec re-shell analyze --type bundle --output bundle-analysis.json
            displayName: 'Bundle analysis'

          - task: PublishBuildArtifacts@1
            inputs:
              pathToPublish: 'bundle-analysis.json'
              artifactName: 'bundle-analysis'

  - stage: Security
    displayName: 'Security Analysis'
    dependsOn: Test
    condition: succeeded()
    jobs:
      - job: SecurityJob
        displayName: 'Security Scan'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '$(nodeVersion)'
            displayName: 'Install Node.js'

          - script: |
              corepack enable
              corepack prepare pnpm@$(pnpmVersion) --activate
            displayName: 'Install pnpm'

          - script: pnpm install --frozen-lockfile
            displayName: 'Install dependencies'

          - script: pnpm exec re-shell analyze --type security --output security-report.json
            displayName: 'Security analysis'

          - task: PublishBuildArtifacts@1
            inputs:
              pathToPublish: 'security-report.json'
              artifactName: 'security-report'

  - stage: Deploy
    displayName: 'Deploy'
    dependsOn: [Test, Security]
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployJob
        displayName: 'Deploy to Production'
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: NodeTool@0
                  inputs:
                    versionSpec: '$(nodeVersion)'
                  displayName: 'Install Node.js'

                - script: |
                    corepack enable
                    corepack prepare pnpm@$(pnpmVersion) --activate
                  displayName: 'Install pnpm'

                - script: pnpm install --frozen-lockfile
                  displayName: 'Install dependencies'

                - script: pnpm run build
                  displayName: 'Build for production'

                - script: pnpm run deploy
                  displayName: 'Deploy'
                  env:
                    DEPLOY_TOKEN: $(DEPLOY_TOKEN)
                    DEPLOY_URL: $(DEPLOY_URL)
`;

  await fs.writeFile(path.join(monorepoRoot, 'azure-pipelines.yml'), azurePipelineContent);
  console.log(chalk.green('✓ Generated Azure Pipelines configuration'));
}

async function generateDeploymentScripts(monorepoRoot: string, environment: string, options: CICDOptions) {
  const scriptsDir = path.join(monorepoRoot, 'scripts', 'deploy');
  await fs.ensureDir(scriptsDir);

  // Deploy script
  const deployScript = `#!/bin/bash
set -e

ENVIRONMENT="\${1:-${environment}}"
echo "Deploying to $ENVIRONMENT environment..."

# Build all packages
echo "Building packages..."
pnpm run build

# Run pre-deploy checks
echo "Running pre-deploy health check..."
pnpm exec re-shell doctor --verbose

# Deploy based on environment
case "$ENVIRONMENT" in
  "staging")
    echo "Deploying to staging..."
    pnpm run deploy:staging
    ;;
  "production")
    echo "Deploying to production..."
    pnpm run deploy:production
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "Deployment completed successfully!"
`;

  await fs.writeFile(path.join(scriptsDir, 'deploy.sh'), deployScript);
  await fs.chmod(path.join(scriptsDir, 'deploy.sh'), 0o755);

  // Rollback script
  const rollbackScript = `#!/bin/bash
set -e

ENVIRONMENT="\${1:-${environment}}"
VERSION="\${2:-previous}"

echo "Rolling back $ENVIRONMENT to $VERSION..."

# Implement rollback logic based on your deployment strategy
case "$ENVIRONMENT" in
  "staging")
    echo "Rolling back staging to $VERSION..."
    # Add staging rollback commands
    ;;
  "production")
    echo "Rolling back production to $VERSION..."
    # Add production rollback commands
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "Rollback completed!"
`;

  await fs.writeFile(path.join(scriptsDir, 'rollback.sh'), rollbackScript);
  await fs.chmod(path.join(scriptsDir, 'rollback.sh'), 0o755);

  console.log(chalk.green('✓ Generated deployment scripts'));
}

async function generateDockerConfiguration(monorepoRoot: string, options: CICDOptions) {
  // Multi-stage Dockerfile
  const dockerfile = `# Multi-stage Dockerfile for Re-Shell monorepo
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build stage
FROM base AS builder
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@8 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/*/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/packages/*/dist ./packages/*/dist
COPY --from=builder /app/packages/*/build ./packages/*/build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "packages/api/dist/index.js"]
`;

  await fs.writeFile(path.join(monorepoRoot, 'Dockerfile'), dockerfile);

  // Docker compose for development
  const dockerCompose = `version: '3.8'

services:
  app:
    build:
      context: .
      target: base
    ports:
      - "3000:3000"
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: pnpm run dev

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: reshell
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
`;

  await fs.writeFile(path.join(monorepoRoot, 'docker-compose.yml'), dockerCompose);

  // Production docker compose
  const dockerComposeProd = `version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: reshell
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

secrets:
  db_password:
    external: true

volumes:
  postgres_data:
`;

  await fs.writeFile(path.join(monorepoRoot, 'docker-compose.prod.yml'), dockerComposeProd);

  console.log(chalk.green('✓ Generated Docker configuration'));
}

async function generateEnvironmentConfigs(monorepoRoot: string, environment: string, options: CICDOptions) {
  const configDir = path.join(monorepoRoot, 'config', 'environments');
  await fs.ensureDir(configDir);

  const envConfig = {
    [environment]: {
      api: {
        url: `https://api-${environment}.example.com`,
        timeout: 10000,
        retries: 3
      },
      database: {
        host: `db-${environment}.example.com`,
        port: 5432,
        ssl: environment === 'production'
      },
      cache: {
        host: `redis-${environment}.example.com`,
        port: 6379,
        ttl: 3600
      },
      monitoring: {
        enabled: true,
        level: environment === 'production' ? 'error' : 'debug'
      }
    }
  };

  await fs.writeJson(path.join(configDir, `${environment}.json`), envConfig, { spaces: 2 });
  console.log(chalk.green(`✓ Generated ${environment} environment configuration`));
}

async function createEnvironmentConfig(monorepoRoot: string, env: EnvironmentConfig, options: CICDOptions) {
  const envDir = path.join(monorepoRoot, 'environments', env.name);
  await fs.ensureDir(envDir);

  // Environment-specific configuration
  const config = {
    name: env.name,
    url: env.url,
    variables: env.variables,
    secrets: env.secrets.map(secret => ({ name: secret, required: true }))
  };

  await fs.writeJson(path.join(envDir, 'config.json'), config, { spaces: 2 });

  // Environment deployment script
  const deployScript = `#!/bin/bash
set -e

echo "Deploying to ${env.name} environment..."

# Set environment variables
${Object.entries(env.variables).map(([key, value]) => `export ${key}="${value}"`).join('\n')}

# Deploy
pnpm run build
pnpm run deploy:${env.name}

echo "Deployment to ${env.name} completed!"
`;

  await fs.writeFile(path.join(envDir, 'deploy.sh'), deployScript);
  await fs.chmod(path.join(envDir, 'deploy.sh'), 0o755);

  if (options.verbose) {
    console.log(chalk.green(`✓ Created environment configuration for ${env.name}`));
  }
}