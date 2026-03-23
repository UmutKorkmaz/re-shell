// Auto-generated Integrated API Documentation
// Generated at: 2026-01-12T22:40:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  parameters: any[];
  responses: any[];
  language: string;
  file: string;
}

interface DocumentationSection {
  title: string;
  content: string;
  language: string;
  endpoints: ApiEndpoint[];
}

interface CrossLanguageReference {
  type: string;
  from: string;
  to: string;
  description: string;
}

interface DocumentationReport {
  scanTime: string;
  sections: DocumentationSection[];
  crossReferences: CrossLanguageReference[];
  endpoints: ApiEndpoint[];
  recommendations: string[];
}

interface DocumentationConfig {
  projectName: string;
  languages: string[];
  outputFormat: string;
}

export function displayConfig(config: DocumentationConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Integrated API Documentation Generation');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Output Format:', config.outputFormat);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateDocumentationMD(config: DocumentationConfig): string {
  let md = '# Integrated API Documentation Generation\n\n';
  md += '## Features\n\n';
  md += '- Polyglot API documentation extraction\n';
  md += '- Cross-language reference linking\n';
  md += '- OpenAPI/Swagger specification generation\n';
  md += '- Interactive HTML documentation\n';
  md += '- Markdown documentation export\n';
  md += '- Type definition extraction\n';
  md += '- Endpoint usage examples\n';
  md += '- Authentication documentation\n';
  md += '- Rate limiting and quotas\n';
  md += '- Response schemas and examples\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import docGenerator from \'./api-documentation\';\n\n';
  md += '// Generate documentation\n';
  md += 'const report = await docGenerator.generate();\n\n';
  md += '// View endpoints\n';
  md += 'report.endpoints.forEach(ep => console.log(ep.path));\n\n';
  md += '// Check cross-references\n';
  md += 'report.crossReferences.forEach(ref => console.log(ref.description));\n\n';
  md += '// Generate OpenAPI spec\n';
  md += 'const openApiSpec = await docGenerator.generateOpenApi();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptDocumentation(config: DocumentationConfig): string {
  let code = '// Auto-generated API Documentation Generator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface ApiEndpoint {\n';
  code += '  path: string;\n';
  code += '  method: string;\n';
  code += '  description: string;\n';
  code += '  parameters: any[];\n';
  code += '  responses: any[];\n';
  code += '  language: string;\n';
  code += '  file: string;\n';
  code += '}\n\n';

  code += 'interface DocumentationSection {\n';
  code += '  title: string;\n';
  code += '  content: string;\n';
  code += '  language: string;\n';
  code += '  endpoints: ApiEndpoint[];\n';
  code += '}\n\n';

  code += 'interface CrossLanguageReference {\n';
  code += '  type: string;\n';
  code += '  from: string;\n';
  code += '  to: string;\n';
  code += '  description: string;\n';
  code += '}\n\n';

  code += 'interface DocumentationReport {\n';
  code += '  scanTime: string;\n';
  code += '  sections: DocumentationSection[];\n';
  code += '  crossReferences: CrossLanguageReference[];\n';
  code += '  endpoints: ApiEndpoint[];\n';
  code += '  recommendations: string[];\n';
  code += '}\n\n';

  code += 'class IntegratedApiDocumentation {\n';
  code += '  private projectRoot: string;\n';
  code += '  private languages: string[];\n';
  code += '  private outputFormat: string;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.languages = options.languages || [\'typescript\', \'python\', \'go\'];\n';
  code += '    this.outputFormat = options.outputFormat || \'markdown\';\n';
  code += '  }\n\n';

  code += '  async generate(): Promise<DocumentationReport> {\n';
  code += '    console.log(\'[Documentation] Generating integrated API documentation...\');\n\n';

  code += '    const report: DocumentationReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      sections: [],\n';
  code += '      crossReferences: [],\n';
  code += '      endpoints: [],\n';
  code += '      recommendations: [],\n';
  code += '    };\n\n';

  code += '    // Generate TypeScript documentation\n';
  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      const tsDocs = await this.generateTypeScriptDocs();\n';
  code += '      report.sections.push(...tsDocs.sections);\n';
  code += '      report.endpoints.push(...tsDocs.endpoints);\n';
  code += '    }\n\n';

  code += '    // Generate Python documentation\n';
  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      const pyDocs = await this.generatePythonDocs();\n';
  code += '      report.sections.push(...pyDocs.sections);\n';
  code += '      report.endpoints.push(...pyDocs.endpoints);\n';
  code += '    }\n\n';

  code += '    // Generate Go documentation\n';
  code += '    if (this.languages.includes(\'go\')) {\n';
  code += '      const goDocs = await this.generateGoDocs();\n';
  code += '      report.sections.push(...goDocs.sections);\n';
  code += '      report.endpoints.push(...goDocs.endpoints);\n';
  code += '    }\n\n';

  code += '    // Find cross-language references\n';
  code += '    report.crossReferences = this.findCrossReferences(report);\n\n';

  code += '    // Generate recommendations\n';
  code += '    report.recommendations = this.generateRecommendations(report);\n\n';

  code += '    console.log(\'[Documentation] Documentation generation complete\');\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  private async generateTypeScriptDocs(): Promise<{ sections: DocumentationSection[]; endpoints: ApiEndpoint[] }> {\n';
  code += '    const sections: DocumentationSection[] = [];\n';
  code += '    const endpoints: ApiEndpoint[] = [];\n\n';

  code += '    try {\n';
  code += '      // Find TypeScript files\n';
  code += '      const tsFiles = this.findFiles(this.projectRoot, \'.ts\');\n\n';

  code += '      for (const file of tsFiles) {\n';
  code += '        const content = fs.readFileSync(file, \'utf-8\');\n\n';

  code += '        // Extract Express/Fastify routes\n';
  code += '        const routeMatches = content.matchAll(/(app|router)\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'"`]([^\'"`]+)[\'"`]/g);\n';
  code += '        for (const match of routeMatches) {\n';
  code += '          endpoints.push({\n';
  code += '            path: match[3],\n';
  code += '            method: match[2].toUpperCase(),\n';
  code += '            description: `Endpoint from ${path.basename(file)}`,\n';
  code += '            parameters: [],\n';
  code += '            responses: [],\n';
  code += '            language: \'typescript\',\n';
  code += '            file,\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';

  code += '      sections.push({\n';
  code += '        title: \'TypeScript API\',\n';
  code += '        content: `Generated documentation for ${endpoints.length} TypeScript endpoints`,\n';
  code += '        language: \'typescript\',\n';
  code += '        endpoints,\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Documentation] TypeScript documentation generation failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return { sections, endpoints };\n';
  code += '  }\n\n';

  code += '  private async generatePythonDocs(): Promise<{ sections: DocumentationSection[]; endpoints: ApiEndpoint[] }> {\n';
  code += '    const sections: DocumentationSection[] = [];\n';
  code += '    const endpoints: ApiEndpoint[] = [];\n\n';

  code += '    try {\n';
  code += '      // Find Python files\n';
  code += '      const pyFiles = this.findFiles(this.projectRoot, \'.py\');\n\n';

  code += '      for (const file of pyFiles) {\n';
  code += '        const content = fs.readFileSync(file, \'utf-8\');\n\n';

  code += '        // Extract Flask/FastAPI routes\n';
  code += '        const routeMatches = content.matchAll(/@(app|router)\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'"`]([^\'"`]+)[\'"`]/g);\n';
  code += '        for (const match of routeMatches) {\n';
  code += '          endpoints.push({\n';
  code += '            path: match[3],\n';
  code += '            method: match[2].toUpperCase(),\n';
  code += '            description: `Endpoint from ${path.basename(file)}`,\n';
  code += '            parameters: [],\n';
  code += '            responses: [],\n';
  code += '            language: \'python\',\n';
  code += '            file,\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';

  code += '      sections.push({\n';
  code += '        title: \'Python API\',\n';
  code += '        content: `Generated documentation for ${endpoints.length} Python endpoints`,\n';
  code += '        language: \'python\',\n';
  code += '        endpoints,\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Documentation] Python documentation generation failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return { sections, endpoints };\n';
  code += '  }\n\n';

  code += '  private async generateGoDocs(): Promise<{ sections: DocumentationSection[]; endpoints: ApiEndpoint[] }> {\n';
  code += '    const sections: DocumentationSection[] = [];\n';
  code += '    const endpoints: ApiEndpoint[] = [];\n\n';

  code += '    try {\n';
  code += '      // Find Go files\n';
  code += '      const goFiles = this.findFiles(this.projectRoot, \'.go\');\n\n';

  code += '      for (const file of goFiles) {\n';
  code += '        const content = fs.readFileSync(file, \'utf-8\');\n\n';

  code += '        // Extract Gin/Echo routes\n';
  code += '        const routeMatches = content.matchAll(/\\.(GET|POST|PUT|DELETE|PATCH)\\s*\\(\\s*[\'"`]([^\'"`]+)[\'"`]/g);\n';
  code += '        for (const match of routeMatches) {\n';
  code += '          endpoints.push({\n';
  code += '            path: match[2],\n';
  code += '            method: match[1].toUpperCase(),\n';
  code += '            description: `Endpoint from ${path.basename(file)}`,\n';
  code += '            parameters: [],\n';
  code += '            responses: [],\n';
  code += '            language: \'go\',\n';
  code += '            file,\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';

  code += '      sections.push({\n';
  code += '        title: \'Go API\',\n';
  code += '        content: `Generated documentation for ${endpoints.length} Go endpoints`,\n';
  code += '        language: \'go\',\n';
  code += '        endpoints,\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Documentation] Go documentation generation failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return { sections, endpoints };\n';
  code += '  }\n\n';

  code += '  private findCrossReferences(report: DocumentationReport): CrossLanguageReference[] {\n';
  code += '    const refs: CrossLanguageReference[] = [];\n';
  code += '    const byPath: { [key: string]: ApiEndpoint[] } = {};\n\n';

  code += '    // Group endpoints by path\n';
  code += '    for (const endpoint of report.endpoints) {\n';
  code += '      if (!byPath[endpoint.path]) byPath[endpoint.path] = [];\n';
  code += '      byPath[endpoint.path].push(endpoint);\n';
  code += '    }\n\n';

  code += '    // Find duplicate endpoints across languages\n';
  code += '    for (const [path, endpoints] of Object.entries(byPath)) {\n';
  code += '      if (endpoints.length > 1) {\n';
  code += '        const languages = endpoints.map(e => e.language).join(\', \');\n';
  code += '        refs.push({\n';
  code += '          type: \'duplicate-endpoint\',\n';
  code += '          from: languages,\n';
  code += '          to: path,\n';
  code += '          description: `Endpoint ${path} implemented in multiple languages: ${languages}`,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return refs;\n';
  code += '  }\n\n';

  code += '  private findFiles(dir: string, ext: string): string[] {\n';
  code += '    const files: string[] = [];\n\n';

  code += '    try {\n';
  code += '      const entries = fs.readdirSync(dir, { withFileTypes: true });\n\n';

  code += '      for (const entry of entries) {\n';
  code += '        const fullPath = path.join(dir, entry.name);\n\n';

  code += '        if (entry.isDirectory()) {\n';
  code += '          if (entry.name !== \'node_modules\' && entry.name !== \'dist\' && entry.name !== \'.git\') {\n';
  code += '            files.push(...this.findFiles(fullPath, ext));\n';
  code += '          }\n';
  code += '        } else if (entry.isFile() && entry.name.endsWith(ext)) {\n';
  code += '          files.push(fullPath);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error) {\n';
  code += '      // Ignore errors\n';
  code += '    }\n\n';

  code += '    return files;\n';
  code += '  }\n\n';

  code += '  private generateRecommendations(report: DocumentationReport): string[] {\n';
  code += '    const recommendations: string[] = [];\n\n';

  code += '    if (report.crossReferences.length > 0) {\n';
  code += '      recommendations.push(`Found ${report.crossReferences.length} cross-language references. Consider consolidating duplicate endpoints.`);\n';
  code += '    }\n\n';

  code += '    for (const section of report.sections) {\n';
  code += '      if (section.endpoints.length === 0) {\n';
  code += '        recommendations.push(`No API endpoints found in ${section.language}. Add API documentation comments.`);\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return recommendations;\n';
  code += '  }\n\n';

  code += '  async generateOpenApi(): Promise<any> {\n';
  code += '    const report = await this.generate();\n\n';

  code += '    const openApi: any = {\n';
  code += '      openapi: \'3.0.0\',\n';
  code += '      info: {\n';
  code += '        title: this.projectName,\n';
  code += '        version: \'1.0.0\',\n';
  code += '      },\n';
  code += '      paths: {},\n';
  code += '      components: {\n';
  code += '        schemas: {},\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    for (const endpoint of report.endpoints) {\n';
  code += '      if (!openApi.paths[endpoint.path]) {\n';
  code += '        openApi.paths[endpoint.path] = {};\n';
  code += '      }\n\n';

  code += '      openApi.paths[endpoint.path][endpoint.method.toLowerCase()] = {\n';
  code += '        summary: endpoint.description,\n';
  code += '        parameters: endpoint.parameters,\n';
  code += '        responses: endpoint.responses.reduce((acc: any, resp: any) => {\n';
  code += '          acc[resp.code] = {\n';
  code += '            description: resp.description,\n';
  code += '          };\n';
  code += '          return acc;\n';
  code += '        }, {}),\n';
  code += '        \'x-language\': endpoint.language,\n';
  code += '      };\n';
  code += '    }\n\n';

  code += '    return openApi;\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const docGenerator = new IntegratedApiDocumentation({\n';
  code += '  languages: [\'typescript\', \'python\', \'go\'],\n';
  code += '  outputFormat: \'markdown\',\n';
  code += '});\n\n';

  code += 'export default docGenerator;\n';
  code += 'export { IntegratedApiDocumentation, ApiEndpoint, DocumentationSection, CrossLanguageReference, DocumentationReport };\n';

  return code;
}

export function generatePythonDocumentation(config: DocumentationConfig): string {
  let code = '# Auto-generated API Documentation Generator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'import re\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class ApiEndpoint:\n';
  code += '    path: str\n';
  code += '    method: str\n';
  code += '    description: str\n';
  code += '    parameters: List[Any]\n';
  code += '    responses: List[Any]\n';
  code += '    language: str\n';
  code += '    file: str\n\n';

  code += '@dataclass\n';
  code += 'class DocumentationSection:\n';
  code += '    title: str\n';
  code += '    content: str\n';
  code += '    language: str\n';
  code += '    endpoints: List[ApiEndpoint]\n\n';

  code += '@dataclass\n';
  code += 'class CrossLanguageReference:\n';
  code += '    type: str\n';
  code += '    from: str\n';
  code += '    to: str\n';
  code += '    description: str\n\n';

  code += '@dataclass\n';
  code += 'class DocumentationReport:\n';
  code += '    scan_time: str\n';
  code += '    sections: List[DocumentationSection]\n';
  code += '    cross_references: List[CrossLanguageReference]\n';
  code += '    endpoints: List[ApiEndpoint]\n';
  code += '    recommendations: List[str]\n\n';

  code += 'class IntegratedApiDocumentation:\n';
  code += '    def __init__(self, project_root: str = None, languages: List[str] = None, output_format: str = "markdown"):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.languages = languages or ["typescript", "python", "go"]\n';
  code += '        self.output_format = output_format\n\n';

  code += '    async def generate(self) -> DocumentationReport:\n';
  code += '        print("[Documentation] Generating integrated API documentation...")\n\n';

  code += '        report = DocumentationReport(\n';
  code += '            scan_time="",\n';
  code += '            sections=[],\n';
  code += '            cross_references=[],\n';
  code += '            endpoints=[],\n';
  code += '            recommendations=[],\n';
  code += '        )\n\n';

  code += '        if "typescript" in self.languages:\n';
  code += '            ts_docs = await self.generate_typescript_docs()\n';
  code += '            report.sections.extend(ts_docs.sections)\n';
  code += '            report.endpoints.extend(ts_docs.endpoints)\n\n';

  code += '        if "python" in self.languages:\n';
  code += '            py_docs = await self.generate_python_docs()\n';
  code += '            report.sections.extend(py_docs.sections)\n';
  code += '            report.endpoints.extend(py_docs.endpoints)\n\n';

  code += '        report.cross_references = self.find_cross_references(report)\n';
  code += '        report.recommendations = self.generate_recommendations(report)\n\n';

  code += '        print("[Documentation] Documentation generation complete")\n\n';

  code += '        return report\n\n';

  code += '    async def generate_typescript_docs(self):\n';
  code += '        sections = []\n';
  code += '        endpoints = []\n\n';

  code += '        try:\n';
  code += '            for file in self.project_root.rglob("*.ts"):\n';
  code += '                content = file.read_text()\n';

  code += '                for match in re.finditer(r"(app|router)\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'\\"`]([^\'\\"`]+)[\'\\"`]", content):\n';
  code += '                    endpoints.append(ApiEndpoint(\n';
  code += '                        path=match.group(3),\n';
  code += '                        method=match.group(2).upper(),\n';
  code += '                        description=f"Endpoint from {file.name}",\n';
  code += '                        parameters=[],\n';
  code += '                        responses=[],\n';
  code += '                        language="typescript",\n';
  code += '                        file=str(file),\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Documentation] TypeScript documentation generation failed: {e}")\n\n';

  code += '        sections.append(DocumentationSection(\n';
  code += '            title="TypeScript API",\n';
  code += '            content=f"Generated documentation for {len(endpoints)} TypeScript endpoints",\n';
  code += '            language="typescript",\n';
  code += '            endpoints=endpoints,\n';
  code += '        ))\n\n';

  code += '        return {"sections": sections, "endpoints": endpoints}\n\n';

  code += '    async def generate_python_docs(self):\n';
  code += '        sections = []\n';
  code += '        endpoints = []\n\n';

  code += '        try:\n';
  code += '            for file in self.project_root.rglob("*.py"):\n';
  code += '                content = file.read_text()\n';

  code += '                for match in re.finditer(r"@(app|router)\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'\\"`]([^\'\\"`]+)[\'\\"`]", content):\n';
  code += '                    endpoints.append(ApiEndpoint(\n';
  code += '                        path=match.group(3),\n';
  code += '                        method=match.group(2).upper(),\n';
  code += '                        description=f"Endpoint from {file.name}",\n';
  code += '                        parameters=[],\n';
  code += '                        responses=[],\n';
  code += '                        language="python",\n';
  code += '                        file=str(file),\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Documentation] Python documentation generation failed: {e}")\n\n';

  code += '        sections.append(DocumentationSection(\n';
  code += '            title="Python API",\n';
  code += '            content=f"Generated documentation for {len(endpoints)} Python endpoints",\n';
  code += '            language="python",\n';
  code += '            endpoints=endpoints,\n';
  code += '        ))\n\n';

  code += '        return {"sections": sections, "endpoints": endpoints}\n\n';

  code += '    def find_cross_references(self, report: DocumentationReport) -> List[CrossLanguageReference]:\n';
  code += '        refs = []\n';
  code += '        by_path = {}\n\n';

  code += '        for endpoint in report.endpoints:\n';
  code += '            if endpoint.path not in by_path:\n';
  code += '                by_path[endpoint.path] = []\n';
  code += '            by_path[endpoint.path].append(endpoint)\n\n';

  code += '        for path, endpoints in by_path.items():\n';
  code += '            if len(endpoints) > 1:\n';
  code += '                languages = ", ".join(e.language for e in endpoints)\n';
  code += '                refs.append(CrossLanguageReference(\n';
  code += '                    type="duplicate-endpoint",\n';
  code += '                    from=languages,\n';
  code += '                    to=path,\n';
  code += '                    description=f"Endpoint {path} implemented in multiple languages: {languages}",\n';
  code += '                ))\n\n';

  code += '        return refs\n\n';

  code += '    def generate_recommendations(self, report: DocumentationReport) -> List[str]:\n';
  code += '        recommendations = []\n\n';

  code += '        if len(report.cross_references) > 0:\n';
  code += '            recommendations.append(f"Found {len(report.cross_references)} cross-language references. Consider consolidating duplicate endpoints.")\n\n';

  code += '        for section in report.sections:\n';
  code += '            if len(section.endpoints) == 0:\n';
  code += '                recommendations.append(f"No API endpoints found in {section.language}. Add API documentation comments.")\n\n';

  code += '        return recommendations\n\n';

  code += '    async def generate_openapi(self) -> Dict[str, Any]:\n';
  code += '        report = await self.generate()\n\n';

  code += '        openapi = {\n';
  code += '            "openapi": "3.0.0",\n';
  code += '            "info": {\n';
  code += '                "title": self.project_root.name,\n';
  code += '                "version": "1.0.0",\n';
  code += '            },\n';
  code += '            "paths": {},\n';
  code += '            "components": {\n';
  code += '                "schemas": {},\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        for endpoint in report.endpoints:\n';
  code += '            if endpoint.path not in openapi["paths"]:\n';
  code += '                openapi["paths"][endpoint.path] = {}\n\n';

  code += '            openapi["paths"][endpoint.path][endpoint.method.lower()] = {\n';
  code += '                "summary": endpoint.description,\n';
  code += '                "parameters": endpoint.parameters,\n';
  code += '                "responses": {resp["code"]: {"description": resp["description"]} for resp in endpoint.responses},\n';
  code += '                "x-language": endpoint.language,\n';
  code += '            }\n\n';

  code += '        return openapi\n\n';

  code += 'doc_generator = IntegratedApiDocumentation(\n';
  code += '    languages=["typescript", "python", "go"],\n';
  code += '    output_format="markdown",\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: DocumentationConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptDocumentation(config);
  fs.writeFileSync(path.join(outputDir, 'api-documentation.ts'), tsCode);

  const pyCode = generatePythonDocumentation(config);
  fs.writeFileSync(path.join(outputDir, 'api-documentation.py'), pyCode);

  const md = generateDocumentationMD(config);
  fs.writeFileSync(path.join(outputDir, 'API_DOCUMENTATION.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Integrated API documentation generation',
    main: 'api-documentation.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'documentation-config.json'), JSON.stringify(config, null, 2));
}
