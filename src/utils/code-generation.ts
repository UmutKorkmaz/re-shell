import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Code Generation with Pattern Matching
 *
 * Analyzes existing codebase patterns and generates code
 * that matches the established style and conventions.
 */

export interface CodePattern {
  name: string;
  type: 'import-order' | 'naming' | 'indentation' | 'quotes' | 'semicolons' | 'spacing' | 'formatting';
  pattern: RegExp | string;
  examples: number;
  confidence: number;
}

export interface CodeStyle {
  imports: {
    order: string[];
    grouping: boolean;
    trailingComma: boolean;
  };
  naming: {
    components: 'PascalCase' | 'camelCase';
    functions: 'camelCase' | 'PascalCase';
    variables: 'camelCase' | 'PascalCase';
    constants: 'UPPER_SNAKE_CASE' | 'camelCase';
  };
  formatting: {
    indentation: number; // spaces
    quotes: 'single' | 'double';
    semicolons: boolean;
    trailingComma: boolean;
    maxLineLength: number;
  };
  spacing: {
    afterComma: boolean;
    beforeComma: boolean;
    aroundOperators: boolean;
    blankLineAfterFunctions: boolean;
    blankLineAfterClasses: boolean;
  };
}

export interface GeneratedCode {
  code: string;
  style: CodeStyle;
  patterns: CodePattern[];
  confidence: number;
}

export interface CodeGenerationOptions {
  type: 'component' | 'service' | 'controller' | 'model' | 'utility' | 'hook' | 'test';
  name: string;
  framework?: string;
  language?: string;
  outputPath?: string;
  dryRun?: boolean;
}

/**
 * Analyze existing code style from project
 */
export async function analyzeCodeStyle(
  projectPath: string = process.cwd()
): Promise<{ style: CodeStyle; patterns: CodePattern[] }> {
  const style: CodeStyle = {
    imports: {
      order: ['external', 'internal', 'relative'],
      grouping: true,
      trailingComma: true,
    },
    naming: {
      components: 'PascalCase',
      functions: 'camelCase',
      variables: 'camelCase',
      constants: 'UPPER_SNAKE_CASE',
    },
    formatting: {
      indentation: 2,
      quotes: 'single',
      semicolons: true,
      trailingComma: true,
      maxLineLength: 100,
    },
    spacing: {
      afterComma: true,
      beforeComma: false,
      aroundOperators: true,
      blankLineAfterFunctions: true,
      blankLineAfterClasses: true,
    },
  };

  const patterns: CodePattern[] = [];

  // Analyze source files
  const srcPath = path.join(projectPath, 'src');
  if (await fs.pathExists(srcPath)) {
    await scanForPatterns(srcPath, patterns, style);
  }

  // Determine most common patterns
  if (patterns.length > 0) {
    // Detect quote style
    const singleQuotes = patterns.filter(p => p.type === 'quotes' && p.pattern === "'").length;
    const doubleQuotes = patterns.filter(p => p.type === 'quotes' && p.pattern === '"').length;
    style.formatting.quotes = singleQuotes > doubleQuotes ? 'single' : 'double';

    // Detect semicolons
    const withSemicolons = patterns.filter(p => p.type === 'semicolons' && p.pattern === 'semicolon').length;
    const withoutSemicolons = patterns.filter(p => p.type === 'semicolons' && p.pattern === 'no-semicolon').length;
    style.formatting.semicolons = withSemicolons > withoutSemicolons;

    // Detect indentation
    const twoSpaces = patterns.filter(p => p.type === 'indentation' && p.pattern === '2').length;
    const fourSpaces = patterns.filter(p => p.type === 'indentation' && p.pattern === '4').length;
    style.formatting.indentation = twoSpaces > fourSpaces ? 2 : 4;
  }

  return { style, patterns };
}

/**
 * Scan files for code patterns
 */
async function scanForPatterns(
  dirPath: string,
  patterns: CodePattern[],
  style: CodeStyle
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== 'build' &&
        entry.name !== 'coverage'
      ) {
        await scanForPatterns(fullPath, patterns, style);
      }
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      await analyzeFilePatterns(fullPath, patterns, style);
    }
  }
}

/**
 * Analyze individual file for patterns
 */
async function analyzeFilePatterns(
  filePath: string,
  patterns: CodePattern[],
  style: CodeStyle
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // Count quote usage
  const singleQuoteCount = (content.match(/'/g) || []).length;
  const doubleQuoteCount = (content.match(/"/g) || []).length;

  if (singleQuoteCount > doubleQuoteCount) {
    patterns.push({
      name: 'single-quotes',
      type: 'quotes',
      pattern: "'",
      examples: singleQuoteCount,
      confidence: Math.min(singleQuoteCount / 10, 1),
    });
  } else {
    patterns.push({
      name: 'double-quotes',
      type: 'quotes',
      pattern: '"',
      examples: doubleQuoteCount,
      confidence: Math.min(doubleQuoteCount / 10, 1),
    });
  }

  // Count semicolons
  const semicolonCount = (content.match(/;/g) || []).length;
  const lineCount = lines.filter(line => line.trim() && !line.trim().endsWith('//')).length;

  if (semicolonCount > lineCount / 2) {
    patterns.push({
      name: 'semicolons',
      type: 'semicolons',
      pattern: 'semicolon',
      examples: semicolonCount,
      confidence: Math.min(semicolonCount / lineCount, 1),
    });
  } else {
    patterns.push({
      name: 'no-semicolons',
      type: 'semicolons',
      pattern: 'no-semicolon',
      examples: lineCount - semicolonCount,
      confidence: Math.min((lineCount - semicolonCount) / lineCount, 1),
    });
  }

  // Detect indentation
  const twoSpaceIndent = lines.filter(line => line.startsWith('  ') && !line.startsWith('   ')).length;
  const fourSpaceIndent = lines.filter(line => line.startsWith('    ') && !line.startsWith('     ')).length;

  if (twoSpaceIndent > fourSpaceIndent) {
    patterns.push({
      name: '2-space-indent',
      type: 'indentation',
      pattern: '2',
      examples: twoSpaceIndent,
      confidence: Math.min(twoSpaceIndent / 10, 1),
    });
  } else {
    patterns.push({
      name: '4-space-indent',
      type: 'indentation',
      pattern: '4',
      examples: fourSpaceIndent,
      confidence: Math.min(fourSpaceIndent / 10, 1),
    });
  }

  // Analyze imports
  const importLines = lines.filter(line => line.trim().startsWith('import '));

  for (const importLine of importLines) {
    if (importLine.includes("from 'react'") || importLine.includes('from "react"')) {
      patterns.push({
        name: 'react-import',
        type: 'import-order',
        pattern: 'react-first',
        examples: 1,
        confidence: 1,
      });
    }
  }
}

/**
 * Generate code matching existing style
 */
export async function generateMatchingCode(
  options: CodeGenerationOptions,
  projectPath: string = process.cwd()
): Promise<GeneratedCode> {
  const { style, patterns } = await analyzeCodeStyle(projectPath);

  let code = '';

  // Generate code based on type
  switch (options.type) {
    case 'component':
      code = generateComponent(options.name, style, options.framework);
      break;
    case 'service':
      code = generateService(options.name, style, options.framework);
      break;
    case 'controller':
      code = generateController(options.name, style, options.framework);
      break;
    case 'model':
      code = generateModel(options.name, style, options.framework);
      break;
    case 'utility':
      code = generateUtility(options.name, style);
      break;
    case 'hook':
      code = generateHook(options.name, style);
      break;
    case 'test':
      code = generateTest(options.name, style);
      break;
  }

  // Calculate confidence based on pattern matches
  const confidence = patterns.length > 0 ? patterns.reduce((acc, p) => acc + p.confidence, 0) / patterns.length : 0.5;

  return {
    code,
    style,
    patterns,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Generate React component
 */
function generateComponent(name: string, style: CodeStyle, framework?: string): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  if (framework === 'vue') {
    return generateVueComponent(name, style);
  }

  // React component
  return `import React from ${quote}react${quote}${semi}

interface ${name}Props {
${indent}// TODO: Define props
}

export function ${name}(props: ${name}Props) {
${indent}return (
${indent}${indent}<div>
${indent}${indent}${indent}<h1>${name}</h1>
${indent}${indent}</div>
${indent})${semi}
}

export default ${name}${semi}
`;
}

/**
 * Generate Vue component
 */
function generateVueComponent(name: string, style: CodeStyle): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';

  return `<script setup lang=${quote}ts${quote}>
import { ref } from ${quote}vue${quote}

// TODO: Define component logic
</script>

<template>
${indent}<div class="${name.toLowerCase()}">
${indent}${indent}<h1>{{ ${name} }}</h1>
${indent}</div>
</template>

<style scoped>
.${name.toLowerCase()} {
${indent}/* TODO: Add styles */
}
</style>
`;
}

/**
 * Generate service
 */
function generateService(name: string, style: CodeStyle, framework?: string): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  if (framework === 'nestjs') {
    return `import { Injectable } from ${quote}@nestjs/common${quote}${semi}

@Injectable()
export class ${name}Service {
${indent}constructor() {}

${indent}async findAll() {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return []${semi}
${indent}}

${indent}async findOne(id: string) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return null${semi}
${indent}}

${indent}async create(data: any) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return data${semi}
${indent}}

${indent}async update(id: string, data: any) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return data${semi}
${indent}}

${indent}async remove(id: string) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return true${semi}
${indent}}
}`;
  }

  // Express/General service
  return `export class ${name}Service {
${indent}constructor() {}

${indent}async findAll() {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return []${semi}
${indent}}

${indent}async findOne(id: string) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return null${semi}
${indent}}

${indent}async create(data: any) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return data${semi}
${indent}}

${indent}async update(id: string, data: any) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return data${semi}
${indent}}

${indent}async delete(id: string) {
${indent}${indent}// TODO: Implement logic
${indent}${indent}return true${semi}
${indent}}
}`;
}

/**
 * Generate controller
 */
function generateController(name: string, style: CodeStyle, framework?: string): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  if (framework === 'nestjs') {
    return `import { Controller, Get, Post, Put, Delete, Body, Param } from ${quote}@nestjs/common${quote}${semi}
import { ${name}Service } from ${quote}.${toCamelCase(name)}.service${quote}${semi}

@Controller(${quote}${toKebabCase(name)}${quote})
export class ${name}Controller {
${indent}constructor(private readonly ${toCamelCase(name)}Service: ${name}Service) {}

${indent}@Get()
${indent}async findAll() {
${indent}${indent}return this.${toCamelCase(name)}Service.findAll()${semi}
${indent}}

${indent}@Get(${quote}:id${quote})
${indent}async findOne(@Param(${quote}id${quote}) id: string) {
${indent}${indent}return this.${toCamelCase(name)}Service.findOne(id)${semi}
${indent}}

${indent}@Post()
${indent}async create(@Body() data: any) {
${indent}${indent}return this.${toCamelCase(name)}Service.create(data)${semi}
${indent}}

${indent}@Put(${quote}:id${quote})
${indent}async update(@Param(${quote}id${quote}) id: string, @Body() data: any) {
${indent}${indent}return this.${toCamelCase(name)}Service.update(id, data)${semi}
${indent}}

${indent}@Delete(${quote}:id${quote})
${indent}async remove(@Param(${quote}id${quote}) id: string) {
${indent}${indent}return this.${toCamelCase(name)}Service.remove(id)${semi}
${indent}}
}`;
  }

  // Express controller
  return `import { Request, Response } from ${quote}express${quote}${semi}
import { ${name}Service } from ${quote}.${toCamelCase(name)}.service${quote}${semi}

export class ${name}Controller {
${indent}private service: ${name}Service${semi}

${indent}constructor() {
${indent}${indent}this.service = new ${name}Service()${semi}
${indent}}

${indent}findAll = async (req: Request, res: Response) => {
${indent}${indent}const data = await this.service.findAll()${semi}
${indent}${indent}res.json(data)${semi}
${indent}}${semi}

${indent}findOne = async (req: Request, res: Response) => {
${indent}${indent}const { id } = req.params${semi}
${indent}${indent}const data = await this.service.findOne(id)${semi}
${indent}${indent}res.json(data)${semi}
${indent}}${semi}

${indent}create = async (req: Request, res: Response) => {
${indent}${indent}const data = await this.service.create(req.body)${semi}
${indent}${indent}res.status(201).json(data)${semi}
${indent}}${semi}

${indent}update = async (req: Request, res: Response) => {
${indent}${indent}const { id } = req.params${semi}
${indent}${indent}const data = await this.service.update(id, req.body)${semi}
${indent}${indent}res.json(data)${semi}
${indent}}${semi}

${indent}delete = async (req: Request, res: Response) => {
${indent}${indent}const { id } = req.params${semi}
${indent}${indent}await this.service.delete(id)${semi}
${indent}${indent}res.status(204).send()${semi}
${indent}}${semi}
}`;
}

/**
 * Generate model
 */
function generateModel(name: string, style: CodeStyle, framework?: string): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  if (framework === 'mongoose') {
    return `import mongoose, { Schema, Document } from ${quote}mongoose${quote}${semi}

export interface I${name} extends Document {
${indent}// TODO: Define fields
}

const ${name}Schema = new Schema({
${indent}// TODO: Define schema
}, {
${indent}timestamps: true,
})${semi}

export const ${name} = mongoose.model<I${name}>(${quote}${name}${quote}, ${name}Schema)${semi}
`;
  }

  if (framework === 'prisma') {
    return `// Prisma schema - add this to your schema.prisma file:
//
// model ${name} {
//   id        String   @id @default(uuid())
//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt
// }
`;
  }

  // Generic model
  return `export interface ${name} {
${indent}id: string${semi}
${indent}createdAt: Date${semi}
${indent}updatedAt: Date${semi}
${indent}// TODO: Add fields
}

export class ${name}Model {
${indent}async findAll(): Promise<${name}[]> {
${indent}${indent}// TODO: Implement
${indent}${indent}return []${semi}
${indent}}

${indent}async findOne(id: string): Promise<${name} | null> {
${indent}${indent}// TODO: Implement
${indent}${indent}return null${semi}
${indent}}

${indent}async create(data: Partial<${name}>): Promise<${name}> {
${indent}${indent}// TODO: Implement
${indent}${indent}return data as ${name}${semi}
${indent}}

${indent}async update(id: string, data: Partial<${name}>): Promise<${name}> {
${indent}${indent}// TODO: Implement
${indent}${indent}return data as ${name}${semi}
${indent}}

${indent}async delete(id: string): Promise<boolean> {
${indent}${indent}// TODO: Implement
${indent}${indent}return true${semi}
${indent}}
}`;
}

/**
 * Generate utility function
 */
function generateUtility(name: string, style: CodeStyle): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  return `export function ${toCamelCase(name)}() {
${indent}// TODO: Implement utility function
}

export async function ${toCamelCase(name)}Async() {
${indent}// TODO: Implement async utility function
}

export const ${toCamelCase(name)}Constant = ${quote}${toCamelCase(name)}${quote}${semi}
`;
}

/**
 * Generate React hook
 */
function generateHook(name: string, style: CodeStyle): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  return `import { useState, useEffect } from ${quote}react${quote}${semi}

export function use${name}() {
${indent}const [data, setData] = useState<any>(null)${semi}
${indent}const [loading, setLoading] = useState<boolean>(true)${semi}
${indent}const [error, setError] = useState<Error | null>(null)${semi}

${indent}useEffect(() => {
${indent}${indent}// TODO: Implement data fetching
${indent}${indent}setLoading(false)${semi}
${indent}, [])${semi}

${indent}return { data, loading, error }${semi}
}
`;
}

/**
 * Generate test file
 */
function generateTest(name: string, style: CodeStyle): string {
  const indent = ' '.repeat(style.formatting.indentation);
  const quote = style.formatting.quotes === 'single' ? "'" : '"';
  const semi = style.formatting.semicolons ? ';' : '';

  return `import { describe, it, expect } from ${quote}@jest/globals${quote}${semi}

describe(${quote}${name}${quote}, () => {
${indent}it(${quote}should work${quote}, () => {
${indent}${indent}// TODO: Add test
${indent}${indent}expect(true).toBe(true)${semi}
${indent}})${semi}
})${semi}
`;
}

/**
 * Helper functions
 */
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toKebabCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/**
 * Display code generation report
 */
export async function displayCodeGeneration(generated: GeneratedCode, name: string): Promise<void> {
  console.log(chalk.bold(`\n📝 Generated Code: ${name}\n`));

  // Display style info
  console.log(chalk.cyan('Detected Code Style:'));
  console.log(`  Indentation: ${chalk.yellow(generated.style.formatting.indentation + ' spaces')}`);
  console.log(`  Quotes: ${chalk.yellow(generated.style.formatting.quotes)}`);
  console.log(`  Semicolons: ${chalk.yellow(generated.style.formatting.semicolons ? 'Yes' : 'No')}`);
  console.log(`  Max Line Length: ${chalk.yellow(generated.style.formatting.maxLineLength)}`);

  // Display patterns
  if (generated.patterns.length > 0) {
    console.log(chalk.cyan('\nDetected Patterns:'));
    const uniquePatterns = Array.from(
      new Map(generated.patterns.map(p => [p.name, p])).values()
    ).slice(0, 10);

    for (const pattern of uniquePatterns) {
      const confidence = Math.round(pattern.confidence * 100);
      console.log(`  ${chalk.green('●')} ${pattern.name} ${chalk.gray(`(${confidence}% confidence)`)}`);
    }
  }

  console.log(chalk.cyan(`\nOverall Confidence: ${chalk.yellow(Math.round(generated.confidence * 100) + '%')}\n`));

  // Display generated code
  console.log(chalk.bold('Generated Code:\n'));
  console.log(chalk.gray(generated.code));
}
