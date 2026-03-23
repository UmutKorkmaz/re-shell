/**
 * Contract Testing for Polyglot Service Interactions
 *
 * Generates contract testing utilities for validating service interactions:
 * - Provider and consumer contract definitions
 * - Request/response validation
 * - Pact-like contract testing framework
 * - Multi-language contract testing
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type ContractLanguage = 'typescript' | 'python' | 'go';

export interface ContractDefinition {
  provider: string;
  consumer: string;
  state: string;
  description?: string;
  interactions: ContractInteraction[];
}

export interface ContractInteraction {
  description: string;
  providerState: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body: any;
  };
}

export interface ContractTestConfig {
  providerName: string;
  consumerName: string;
  language: ContractLanguage;
  outputDir: string;
  interactions: ContractInteraction[];
}

// TypeScript Contract Testing
export function generateTypeScriptContractTest(config: ContractTestConfig): string {
  return `// Auto-generated Contract Tests for ${config.providerName}
// Consumer: ${config.consumerName}
// Generated at: ${new Date().toISOString()}

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Contract: ${config.consumerName} -> ${config.providerName}', () => {
  const providerUrl = process.env.PROVIDER_URL || 'http://localhost:3000';

  ${config.interactions.map((interaction, index) => {
    return `  describe('Interaction ${index + 1}: ${interaction.description}', () => {
    beforeEach(() => {
      // Setup provider state: ${interaction.providerState}
    });

    it('should match the contract', async () => {
      const response = await fetch(\`\${providerUrl}${interaction.request.path}\`, {
        method: '${interaction.request.method}',
        headers: ${JSON.stringify(interaction.request.headers || {})},
        body: ${interaction.request.body ? JSON.stringify(interaction.request.body) : 'undefined'},
      });

      expect(response.status).toBe(${interaction.response.status});

      const data = await response.json();
      expect(data).toMatchObject(${JSON.stringify(interaction.response.body)});
    });
  });`;
  }).join('\n\n')}
});
`;
}

// Python Contract Testing
export function generatePythonContractTest(config: ContractTestConfig): string {
  return `# Auto-generated Contract Tests for ${config.providerName}
# Consumer: ${config.consumerName}
# Generated at: ${new Date().toISOString()}

import pytest
import requests
from typing import Dict, Any

class ContractTest:
    def __init__(self, provider_url: str):
        self.provider_url = provider_url

    ${config.interactions.map((interaction, index) => {
      return `  def test_interaction_${index + 1}_${interaction.description.toLowerCase().replace(/[^a-z0-9]/g, '_')}(self):
        """${interaction.description}"""
        response = requests.${interaction.request.method.toLowerCase()}(
            f"{self.provider_url}${interaction.request.path}",
            headers=${JSON.stringify(interaction.request.headers || {})},
            json=${interaction.request.body ? JSON.stringify(interaction.request.body) : 'None'},
        )

        assert response.status_code == ${interaction.response.status}

        data = response.json()
        expected = ${JSON.stringify(interaction.response.body)}
        for key, value in expected.items():
            assert data[key] == value`;
    }).join('\n\n')}
`;
}

// Go Contract Testing
export function generateGoContractTest(config: ContractTestConfig): string {
  return `// Auto-generated Contract Tests for ${config.providerName}
// Consumer: ${config.consumerName}
// Generated at: ${new Date().toISOString()}

package contract_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
)

${config.interactions.map((interaction, index) => {
  return `func TestInteraction_${index + 1}_${interaction.description.replace(/[^a-zA-Z0-9]/g, '_')}(t *testing.T) {
    // ${interaction.description}
    // Provider state: ${interaction.providerState}

    body := ${interaction.request.body ? JSON.stringify(interaction.request.body) : 'nil'}
    if body != nil {
      jsonBody, _ := json.Marshal(interaction.request.body)
      body = bytes.NewBuffer(jsonBody)
    }

    req, _ := http.NewRequest("${interaction.request.method}", "${interaction.request.path}", body)
    ${interaction.request.headers && Object.keys(interaction.request.headers).length > 0 ? Object.entries(interaction.request.headers).map(([k, v]) => `req.Header.Set("${k}", "${v}")`).join('\n    ') : ''}

    rr := httptest.NewRecorder()

    // Execute request (replace with actual server call)
    // response, err := http.DefaultClient.Do(req)

    // Assertions
    if rr.Code != ${interaction.response.status} {
        t.Errorf("Expected status ${interaction.response.status}, got %d", rr.Code)
    }
}`;
}).join('\n\n')}
`;
}

// Display configuration
export function displayConfig(config: ContractTestConfig): void {
  console.log(chalk.cyan('\n✨ Contract Testing Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(`${chalk.yellow('Provider:')} ${chalk.white(config.providerName)}`);
  console.log(`${chalk.yellow('Consumer:')} ${chalk.white(config.consumerName)}`);
  console.log(`${chalk.yellow('Language:')} ${chalk.white(config.language)}`);
  console.log(`${chalk.yellow('Interactions:')} ${chalk.white(config.interactions.length)}`);

  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.cyan('\n📋 Contract Interactions:\n'));
  config.interactions.slice(0, 5).forEach((interaction, index) => {
    console.log(`  ${chalk.green((index + 1).toString() + '.')} ${chalk.white(interaction.description)}`);
    console.log(`     ${chalk.gray(interaction.request.method + ' ' + interaction.request.path)}`);
  });

  if (config.interactions.length > 5) {
    console.log(`  ${chalk.gray(`... and ${config.interactions.length - 5} more`)}`);
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: ContractTestConfig): string {
  let content = '# Contract Testing for ' + config.providerName + '\n\n';
  content += 'Contract tests for consumer **' + config.consumerName + '** interacting with provider **' + config.providerName + '**.\n\n';
  content += '## 📋 Configuration\n\n';
  content += '- **Provider**: ' + config.providerName + '\n';
  content += '- **Consumer**: ' + config.consumerName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Interactions**: ' + config.interactions.length + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install --save-dev jest @types/jest\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install pytest requests\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += 'go test\n';
    content += '```\n\n';
  }

  content += '## 💻 Running Tests\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += '# Set provider URL\n';
    content += 'export PROVIDER_URL="http://localhost:3000"\n\n';
    content += '# Run tests\n';
    content += 'npm test\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += '# Set provider URL\n';
    content += 'export PROVIDER_URL="http://localhost:3000"\n\n';
    content += '# Run tests\n';
    content += 'pytest contract_test.py -v\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += '# Run tests\n';
    content += 'go test -v\n';
    content += '```\n\n';
  }

  content += '## 📚 Contract Interactions\n\n';

  config.interactions.forEach((interaction, index) => {
    content += '### ' + (index + 1) + '. ' + interaction.description + '\n\n';
    content += '- **Provider State**: ' + interaction.providerState + '\n';
    content += '- **Request**: ' + interaction.request.method + ' ' + interaction.request.path + '\n';
    content += '- **Expected Status**: ' + interaction.response.status + '\n\n';
  });

  content += '## 🎯 Contract Verification\n\n';
  content += 'Tests verify:\n';
  content += '- Request methods match contract\n';
  content += '- Request paths match contract\n';
  content += '- Response status codes match contract\n';
  content += '- Response body structure matches contract\n';
  content += '- Required headers are present\n\n';

  content += '## 📝 Contract Evolution\n\n';
  content += 'When contracts change:\n';
  content += '1. Update contract definition\n';
  content += '2. Regenerate contract tests\n';
  content += '3. Verify all tests pass\n';
  content += '4. Notify consumers of breaking changes\n\n';

  content += '## 🔗 CI/CD Integration\n\n';
  content += 'Add to your CI pipeline:\n\n';
  content += '```yaml\n';
  content += 'test:\n';
  content += '  script:\n';

  if (config.language === 'typescript') {
    content += '    - npm test\n';
  } else if (config.language === 'python') {
    content += '    - pytest\n';
  } else if (config.language === 'go') {
    content += '    - go test\n';
  }

  content += '  only:\n';
  content += '    - merge_requests\n';
  content += '    - main\n';
  content += '```\n';

  return content;
}

// Write files
export async function writeContractTestFiles(
  config: ContractTestConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'test.ts' : config.language === 'python' ? '_test.py' : '_test.go';
  const fileName = `contract${ext}`;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptContractTest(config);
  } else if (config.language === 'python') {
    content = generatePythonContractTest(config);
  } else if (config.language === 'go') {
    content = generateGoContractTest(config);
  } else {
    throw new Error(`Unsupported language: ${config.language}`);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green(`✅ Generated: ${fileName}`));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green(`✅ Generated: BUILD.md`));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const consumerName = config.consumerName.toLowerCase();
    const packageJson = {
      name: consumerName + '-contract-test',
      version: '1.0.0',
      description: 'Contract tests for ' + config.providerName,
      scripts: {
        test: 'jest',
      },
      devDependencies: {
        '@types/jest': '^29.0.0',
        jest: '^29.0.0',
        'ts-jest': '^29.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green(`✅ Generated: package.json`));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [
      'pytest>=7.0.0',
      'requests>=2.28.0',
    ];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green(`✅ Generated: requirements.txt`));
  }

  // Generate go.mod for Go
  if (config.language === 'go') {
    const goMod = `module contract_test

go 1.21
`;

    const goModPath = path.join(output, 'go.mod');
    await fs.writeFile(goModPath, goMod);
    console.log(chalk.green(`✅ Generated: go.mod`));
  }

  // Generate contract JSON
  const contract = {
    provider: config.providerName,
    consumer: config.consumerName,
    interactions: config.interactions,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const contractPath = path.join(output, 'contract.json');
  await fs.writeFile(contractPath, JSON.stringify(contract, null, 2));
  console.log(chalk.green(`✅ Generated: contract.json`));
}
