/**
 * Universal Mock Server Generator
 *
 * Generates mock servers for API testing with realistic data
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type MockServerLanguage = 'typescript' | 'python' | 'go';

export interface MockServerConfig {
  serviceName: string;
  language: MockServerLanguage;
  port: number;
  baseUrl: string;
  endpoints: any[];
  enableCors: boolean;
  enableLogging: boolean;
}

// TypeScript Mock Server Generator
export function generateTypeScriptMockServer(config: MockServerConfig): string {
  return `// Auto-generated Mock Server for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

import express from 'express';
import cors from 'cors';

const app = express();
const port = ${config.port};

app.use(cors());
app.use(express.json());

${config.enableLogging ? `app.use((req, res, next) => {
  console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.path);
  next();
});` : ''}

${config.endpoints.map((ep: any) => {
  const method = ep.method.toLowerCase();
  return `app.${method}('${ep.path}', (req, res) => {
  res.status(${ep.statusCode || 200}).json(${JSON.stringify(ep.response)});
});`;
}).join('\n\n')}

app.listen(port, () => {
  console.log('Mock server running at http://localhost:' + port + '/');
  console.log('Available endpoints:');
  ${config.endpoints.map((ep: any) => `console.log('  ${ep.method} ${ep.path}')`).join('\n  ')}
});
`;
}

// Python Mock Server Generator
export function generatePythonMockServer(config: MockServerConfig): string {
  return `# Auto-generated Mock Server for ${config.serviceName}
# Generated at: ${new Date().toISOString()}

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

${config.endpoints.map((ep: any) => {
  return `@app.route('${ep.path}', methods=['${ep.method}'])
def ${ep.method.toLowerCase()}_${ep.path.replace(/\//g, '_').replace(/{/g, '').replace(/}/g, '')}():
    return jsonify(${JSON.stringify(ep.response)}), ${ep.statusCode || 200}`;
}).join('\n\n')}

if __name__ == '__main__':
    print(f'Mock server running at http://localhost:${config.port}/')
    print('Available endpoints:')
    ${config.endpoints.map((ep: any) => `    print('  ${ep.method} ${ep.path}')`).join('\n    ')}
    app.run(port=${config.port})
`;
}

// Go Mock Server Generator
export function generateGoMockServer(config: MockServerConfig): string {
  return `// Auto-generated Mock Server for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
)

func main() {
    ${config.endpoints.map((ep: any) => `http.HandleFunc("${ep.path}", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != "${ep.method}" {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.WriteHeader(${ep.statusCode || 200})
        json.NewEncoder(w).Encode(${JSON.stringify(ep.response)})
    })`).join('\n\n')}

    fmt.Printf("Mock server running at http://localhost:${config.port}/\\n")
    fmt.Println("Available endpoints:")
    ${config.endpoints.map((ep: any) => `    fmt.Println("  ${ep.method} ${ep.path}")`).join('\n    ')}
    log.Fatal(http.ListenAndServe(":${config.port}", nil))
}
`;
}

// Display configuration
export function displayConfig(config: MockServerConfig): void {
  console.log(chalk.cyan('\n✨ Universal Mock Server Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(`${chalk.yellow('Service Name:')} ${chalk.white(config.serviceName)}`);
  console.log(`${chalk.yellow('Language:')} ${chalk.white(config.language)}`);
  console.log(`${chalk.yellow('Port:')} ${chalk.white(config.port)}`);
  console.log(`${chalk.yellow('Base URL:')} ${chalk.white(config.baseUrl)}`);
  console.log(`${chalk.yellow('Endpoints:')} ${chalk.white(config.endpoints.length)}`);
  console.log(`${chalk.yellow('CORS:')} ${chalk.white(config.enableCors ? 'Enabled' : 'Disabled')}`);
  console.log(`${chalk.yellow('Logging:')} ${chalk.white(config.enableLogging ? 'Enabled' : 'Disabled')}`);

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Sample Endpoints:\n'));
  config.endpoints.slice(0, 5).forEach(ep => {
    console.log(`  ${chalk.green(ep.method.padEnd(6))} ${chalk.cyan(ep.path)}`);
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: MockServerConfig): string {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';

  return `# Universal Mock Server for ${config.serviceName}

This is an auto-generated mock server for **${config.serviceName}**.

## 📋 Configuration

- **Service**: ${config.serviceName}
- **Language**: ${config.language}
- **Port**: ${config.port}
- **Base URL**: ${config.baseUrl}
- **Endpoints**: ${config.endpoints.length}

## 🚀 Installation

${config.language === 'typescript' ? `
\`\`\`bash
npm install express cors
\`\`\`
` : ''}

${config.language === 'python' ? `
\`\`\`bash
pip install flask flask-cors
\`\`\`
` : ''}

${config.language === 'go' ? `
\`\`\`bash
go mod download
\`\`\`
` : ''}

## 💻 Running

\`\`\`bash
${config.language === 'typescript' ? `npm install && npx ts-node mock-server.ts` : config.language === 'python' ? `python mock-server.py` : `go run mock-server.go`}
\`\`\`

Server will be available at http://localhost:${config.port}

## 📚 API Endpoints

${config.endpoints.map((ep: any) => `
### ${ep.method} ${ep.path}

- **Status**: ${ep.statusCode || 200}
- **Response**: ${JSON.stringify(ep.response)}
`).join('')}

## 🧪 Testing

\`\`\`bash
${config.endpoints.map((ep: any) => `curl -X ${ep.method} http://localhost:${config.port}${ep.path}`).join('\n')}
\`\`\`
`;
}

// Write files
export async function writeMockServerFiles(
  config: MockServerConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = `mock-server.${ext}`;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptMockServer(config);
  } else if (config.language === 'python') {
    content = generatePythonMockServer(config);
  } else if (config.language === 'go') {
    content = generateGoMockServer(config);
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
    const packageJson = {
      name: config.serviceName.toLowerCase(),
      version: '1.0.0',
      description: `Mock server for ${config.serviceName}`,
      scripts: {
        start: `npx ts-node ${fileName}`,
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/express': '^4.17.0',
        '@types/cors': '^2.8.0',
        typescript: '^5.0.0',
        'ts-node': '^10.9.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green(`✅ Generated: package.json`));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [
      'Flask>=2.3.0',
      'flask-cors>=4.0.0',
    ];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green(`✅ Generated: requirements.txt`));
  }

  // Generate go.mod for Go
  if (config.language === 'go') {
    const goMod = `module ${config.serviceName.toLowerCase()}

go 1.21
`;

    const goModPath = path.join(output, 'go.mod');
    await fs.writeFile(goModPath, goMod);
    console.log(chalk.green(`✅ Generated: go.mod`));
  }
}
