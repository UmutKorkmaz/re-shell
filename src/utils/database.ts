// Database Configuration Utility
// Provides unified interface for database configurations across different ORMs

import * as path from 'path';
import { promises as fs } from 'fs';
import { getPrismaConfig } from '../templates/shared/prisma-config';
import { getTypeORMConfig } from '../templates/shared/typeorm-config';
import { getMongooseConfig } from '../templates/shared/mongoose-config';
import { getFrameworkConfig } from './framework';
import { listBackendTemplates, getBackendTemplate } from '../templates/backend/index';

export type DatabaseType = 'prisma' | 'typeorm' | 'mongoose' | 'none';

export interface DatabaseConfig {
  type: DatabaseType;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: Record<string, string>;
  scripts: Record<string, string>;
  postInstallCommands: string[];
}

/**
 * Get database configuration by type
 */
export function getDatabaseConfig(type: DatabaseType): DatabaseConfig | null {
  switch (type) {
    case 'prisma':
      return normalizePrismaConfig(getPrismaConfig());
    case 'typeorm':
      return normalizeTypeORMConfig(getTypeORMConfig());
    case 'mongoose':
      return normalizeMongooseConfig(getMongooseConfig());
    case 'none':
      return null;
    default:
      return null;
  }
}

/**
 * Get database choices for interactive prompts
 */
export function getDatabaseChoices() {
  return [
    { title: 'None', value: 'none', description: 'No database configuration' },
    {
      title: 'Prisma (TypeScript ORM)',
      value: 'prisma',
      description: 'Type-safe ORM for PostgreSQL, MySQL, SQLite, SQL Server',
    },
    {
      title: 'TypeORM',
      value: 'typeorm',
      description: 'Enterprise ORM with decorators and migrations',
    },
    {
      title: 'Mongoose (MongoDB)',
      value: 'mongoose',
      description: 'MongoDB object modeling with schema validation',
    },
  ];
}

/**
 * Get backend template choices for interactive prompts (all templates)
 */
export function getBackendTemplateChoices() {
  const templates = listBackendTemplates();

  return templates.map((t: any) => ({
    title: `${t.displayName} (${t.language})`,
    value: t.id,
    description: t.description?.substring(0, 100) + (t.description?.length > 100 ? '...' : ''),
  }));
}

/**
 * Frontend-Backend pairing compatibility
 */
interface FrontendPairing {
  framework: string;
  compatibility: 'excellent' | 'good' | 'fair';
  reason: string;
}

/**
 * Recommended frontend frameworks for a given backend
 */
export function getRecommendedFrontends(backendId: string): FrontendPairing[] {
  // Language/backend to frontend recommendations
  const recommendations: Record<string, FrontendPairing[]> = {
    // Node.js/JavaScript backends - excellent with all JS frameworks
    'express': [
      { framework: 'react', compatibility: 'excellent', reason: 'Same language (JavaScript/TypeScript)' },
      { framework: 'next', compatibility: 'excellent', reason: 'Full-stack JS, SSR support' },
      { framework: 'vue', compatibility: 'excellent', reason: 'Great ecosystem integration' },
      { framework: 'svelte', compatibility: 'excellent', reason: 'Lightweight and fast' },
      { framework: 'angular', compatibility: 'good', reason: 'Enterprise-grade' },
    ],
    'fastify': [
      { framework: 'react', compatibility: 'excellent', reason: 'Same language, fast performance' },
      { framework: 'next', compatibility: 'excellent', reason: 'Full-stack JS, great performance' },
      { framework: 'vue', compatibility: 'excellent', reason: 'Excellent DX with Vue' },
      { framework: 'svelte', compatibility: 'excellent', reason: 'Both focus on performance' },
    ],
    'nestjs': [
      { framework: 'react', compatibility: 'excellent', reason: 'TypeScript end-to-end' },
      { framework: 'angular', compatibility: 'excellent', reason: 'Both use TypeScript, enterprise-grade' },
      { framework: 'next', compatibility: 'good', reason: 'Modern full-stack option' },
    ],
    'koa': [
      { framework: 'react', compatibility: 'excellent', reason: 'Same language ecosystem' },
      { framework: 'vue', compatibility: 'excellent', reason: 'Lightweight stack' },
      { framework: 'svelte', compatibility: 'good', reason: 'Minimalist approach' },
    ],

    // Python backends
    'fastapi': [
      { framework: 'react', compatibility: 'excellent', reason: 'Most popular choice, great API handling' },
      { framework: 'vue', compatibility: 'excellent', reason: 'Simple integration with FastAPI' },
      { framework: 'next', compatibility: 'good', reason: 'SSR with Python backend' },
    ],
    'flask': [
      { framework: 'react', compatibility: 'excellent', reason: 'Traditional pairing' },
      { framework: 'vue', compatibility: 'excellent', reason: 'Easy to integrate' },
      { framework: 'jinja2', compatibility: 'excellent', reason: 'Native template support' },
    ],
    'django': [
      { framework: 'react', compatibility: 'excellent', reason: 'DRF + React is standard' },
      { framework: 'vue', compatibility: 'good', reason: 'Good with Django REST Framework' },
      { framework: 'next', compatibility: 'fair', reason: 'Possible but less common' },
    ],

    // Go backends
    'gin': [
      { framework: 'react', compatibility: 'excellent', reason: 'Go serves React SPA very well' },
      { framework: 'vue', compatibility: 'excellent', reason: 'Fast API + lightweight frontend' },
      { framework: 'next', compatibility: 'good', reason: 'Can serve Next.js static export' },
    ],
    'fiber': [
      { framework: 'react', compatibility: 'excellent', reason: 'High performance stack' },
      { framework: 'svelte', compatibility: 'excellent', reason: 'Both focus on performance' },
    ],
    'echo': [
      { framework: 'react', compatibility: 'excellent', reason: 'Standard Go+React pairing' },
      { framework: 'vue', compatibility: 'good', reason: 'Good API framework' },
    ],

    // Rust backends
    'actix-web': [
      { framework: 'react', compatibility: 'excellent', reason: 'Performance-focused stack' },
      { framework: 'yew', compatibility: 'excellent', reason: 'Both Rust, WebAssembly' },
      { framework: 'svelte', compatibility: 'good', reason: 'Performance focus' },
    ],
    'axum': [
      { framework: 'react', compatibility: 'excellent', reason: 'Modern Rust + React' },
      { framework: 'leptos', compatibility: 'excellent', reason: 'Both Rust, full-stack' },
    ],

    // Java backends
    'spring-boot': [
      { framework: 'angular', compatibility: 'excellent', reason: 'Enterprise stack, both from corporate ecosystems' },
      { framework: 'react', compatibility: 'excellent', reason: 'Very common enterprise pairing' },
      { framework: 'vue', compatibility: 'good', reason: 'Simpler than Angular' },
    ],
    'quarkus': [
      { framework: 'react', compatibility: 'excellent', reason: 'Modern Java + React' },
      { framework: 'angular', compatibility: 'good', reason: 'Enterprise option' },
    ],

    // .NET/C# backends
    'aspdotnet': [
      { framework: 'blazor', compatibility: 'excellent', reason: 'Both C#, full-stack Microsoft' },
      { framework: 'angular', compatibility: 'excellent', reason: 'Enterprise Microsoft stack' },
      { framework: 'react', compatibility: 'good', reason: 'Common in enterprise' },
    ],
    'gorilla': [
      { framework: 'blazor', compatibility: 'excellent', reason: 'Full-stack C#' },
      { framework: 'react', compatibility: 'good', reason: 'Popular choice' },
    ],

    // PHP backends
    'laravel': [
      { framework: 'vue', compatibility: 'excellent', reason: 'Laravel includes Vue by default' },
      { framework: 'react', compatibility: 'excellent', reason: 'Inertia.js support' },
      { 'framework': 'livewire', compatibility: 'excellent', reason: 'Laravel native' },
    ],
    'symfony': [
      { framework: 'react', compatibility: 'excellent', reason: 'Symfony UX with React' },
      { framework: 'vue', compatibility: 'good', reason: 'Good integration' },
    ],

    // Ruby backends
    'rails': [
      { framework: 'react', compatibility: 'excellent', reason: 'Rails 7+ with importmaps, Hotwire' },
      { framework: 'vue', compatibility: 'good', reason: 'Webpacker/Vue integration' },
      { 'framework': 'turbo', compatibility: 'excellent', reason: 'Hotwire/Turbo native' },
    ],
    'sinatra': [
      { framework: 'react', compatibility: 'good', reason: 'Lightweight backend' },
      { framework: 'vue', compatibility: 'good', reason: 'Simple API backend' },
    ],

    // Elixir backends
    'phoenix': [
      { framework: 'react', compatibility: 'excellent', reason: 'Phoenix LiveView or channels' },
      { framework: 'vue', compatibility: 'good', reason: 'Good with Phoenix channels' },
      { 'framework': 'liveview', compatibility: 'excellent', reason: 'Native real-time UI' },
    ],
  };

  // Check for exact match first
  if (recommendations[backendId]) {
    return recommendations[backendId];
  }

  // Check for language-based recommendations
  const backend = getBackendTemplate(backendId);
  if (!backend) {
    return getDefaultFrontendRecommendations();
  }

  const lang = backend.language.toLowerCase();

  // Language-based fallbacks
  if (lang === 'typescript' || lang === 'javascript') {
    return recommendations['express'] || []; // Node.js defaults
  }
  if (lang === 'python') {
    return recommendations['fastapi'] || []; // Python defaults
  }
  if (lang === 'go') {
    return recommendations['gin'] || []; // Go defaults
  }
  if (lang === 'rust') {
    return recommendations['actix-web'] || []; // Rust defaults
  }
  if (lang === 'java') {
    return recommendations['spring-boot'] || []; // Java defaults
  }
  if (lang === 'csharp' || lang === 'dotnet') {
    return recommendations['aspdotnet'] || []; // .NET defaults
  }
  if (lang === 'php') {
    return recommendations['laravel'] || []; // PHP defaults
  }
  if (lang === 'ruby') {
    return recommendations['rails'] || []; // Ruby defaults
  }
  if (lang === 'elixir') {
    return recommendations['phoenix'] || []; // Elixir defaults
  }

  return getDefaultFrontendRecommendations();
}

/**
 * Get recommended backends for a given frontend framework
 */
export function getRecommendedBackends(frontendId: string): { backend: string; reason: string }[] {
  const recommendations: Record<string, { backend: string; reason: string }[]> = {
    'react': [
      { backend: 'express', reason: 'Most popular Node.js backend' },
      { backend: 'fastify', reason: 'High performance Node.js' },
      { backend: 'nestjs', reason: 'Enterprise TypeScript backend' },
      { backend: 'fastapi', reason: 'Modern Python async backend' },
      { backend: 'gin', reason: 'High-performance Go backend' },
      { backend: 'rails', reason: 'Ruby with Hotwire integration' },
      { backend: 'laravel', reason: 'PHP with Inertia.js support' },
      { backend: 'spring-boot', reason: 'Enterprise Java backend' },
      { backend: 'aspdotnet', reason: 'Enterprise .NET backend' },
    ],
    'vue': [
      { backend: 'express', reason: 'Great with Vue SSR' },
      { backend: 'fastify', reason: 'Performance-focused' },
      { backend: 'laravel', reason: 'Laravel includes Vue by default' },
      { backend: 'rails', reason: 'Strong Ruby integration' },
      { backend: 'fastapi', reason: 'Simple Python backend' },
    ],
    'angular': [
      { backend: 'nestjs', reason: 'Both TypeScript, enterprise-grade' },
      { backend: 'spring-boot', reason: 'Enterprise Java stack' },
      { backend: 'express', reason: 'Standard Node.js option' },
      { backend: 'aspdotnet', reason: 'Enterprise Microsoft stack' },
    ],
    'svelte': [
      { backend: 'express', reason: 'Lightweight stack' },
      { backend: 'fastify', reason: 'Performance-focused' },
      { backend: 'fiber', reason: 'Both focus on performance' },
    ],
    'next': [
      { backend: 'express', reason: 'Perfect for Next.js API routes' },
      { backend: 'fastify', reason: 'High performance for Next.js' },
      { backend: 'nestjs', reason: 'Enterprise backend for Next.js' },
    ],
  };

  // Check for exact match
  if (recommendations[frontendId]) {
    return recommendations[frontendId];
  }

  // Check for React-based frameworks
  if (frontendId.includes('react') || frontendId === 'cra') {
    return recommendations['react'] || [];
  }
  if (frontendId.includes('vue')) {
    return recommendations['vue'] || [];
  }
  if (frontendId.includes('angular')) {
    return recommendations['angular'] || [];
  }
  if (frontendId.includes('svelte')) {
    return recommendations['svelte'] || [];
  }
  if (frontendId.includes('next')) {
    return recommendations['next'] || [];
  }

  // Default: show popular backends
  return [
    { backend: 'express', reason: 'Popular Node.js backend' },
    { backend: 'fastify', reason: 'Fast Node.js backend' },
    { backend: 'nestjs', reason: 'Enterprise Node.js backend' },
    { backend: 'fastapi', reason: 'Modern Python backend' },
    { backend: 'gin', reason: 'High-performance Go backend' },
  ];
}

/**
 * Get default frontend recommendations (fallback)
 */
function getDefaultFrontendRecommendations(): FrontendPairing[] {
  return [
    { framework: 'react', compatibility: 'excellent', reason: 'Most popular frontend framework' },
    { framework: 'vue', compatibility: 'excellent', reason: 'Easy to learn and integrate' },
    { framework: 'next', compatibility: 'excellent', reason: 'Full-stack framework with SSR' },
    { framework: 'svelte', compatibility: 'good', reason: 'Lightweight and fast' },
    { framework: 'angular', compatibility: 'good', reason: 'Enterprise-grade framework' },
  ];
}

/**
 * Framework compatibility validation result
 */
export interface FrameworkValidationResult {
  valid: boolean;
  compatibility: 'excellent' | 'good' | 'fair' | 'poor' | 'incompatible';
  warnings: string[];
  suggestions: string[];
}

/**
 * Validate framework compatibility between frontend and backend
 */
export function validateFrameworkCompatibility(
  frontendId: string,
  backendId: string
): FrameworkValidationResult {
  const recommendations = getRecommendedFrontends(backendId);
  const frontendMatch = recommendations.find((r) => r.framework === frontendId);

  if (frontendMatch) {
    return {
      valid: true,
      compatibility: frontendMatch.compatibility,
      warnings: [],
      suggestions: [frontendMatch.reason],
    };
  }

  // Check for known incompatible combinations
  const incompatibilities: Record<string, string[]> = {
    'blazor': ['express', 'fastify', 'nestjs', 'fastapi', 'django', 'rails'], // Blazor needs .NET backend
    'yew': ['express', 'fastify', 'nestjs', 'django', 'rails', 'laravel'], // Yew is Rust-specific
    'leptos': ['express', 'fastify', 'nestjs', 'django', 'rails', 'laravel'], // Leptos is Rust-specific
  };

  const backendIncompatibilities = incompatibilities[frontendId] || [];
  if (backendIncompatibilities.includes(backendId)) {
    return {
      valid: false,
      compatibility: 'incompatible',
      warnings: [
        `${frontendId} is designed to work with a specific backend ecosystem`,
        `Selected backend (${backendId}) may require additional integration effort`,
      ],
      suggestions: getSuggestedBackendsForFrontend(frontendId),
    };
  }

  // Unknown combination - check language compatibility
  const backend = getBackendTemplate(backendId);
  const frontendLanguage = getFrontendLanguage(frontendId);

  if (backend) {
    const backendLang = backend.language.toLowerCase();
    const frontendLang = frontendLanguage.toLowerCase();

    // Same language or TypeScript/JavaScript combination is excellent
    if (
      (backendLang === 'typescript' || backendLang === 'javascript') &&
      (frontendLang === 'typescript' || frontendLang === 'javascript')
    ) {
      return {
        valid: true,
        compatibility: 'excellent',
        warnings: [],
        suggestions: ['Same language ecosystem for seamless integration'],
      };
    }
  }

  // Default to fair compatibility for unknown combinations
  return {
    valid: true,
    compatibility: 'fair',
    warnings: [
      `This combination (${frontendId} + ${backendId}) is not commonly used`,
      'You may need additional configuration for integration',
    ],
    suggestions: [
      'Consider using recommended framework pairings',
      `Check documentation for ${frontendId} + ${backendId} integration guides`,
    ],
  };
}

/**
 * Get frontend framework language
 */
function getFrontendLanguage(frontendId: string): string {
  const languageMap: Record<string, string> = {
    'react': 'JavaScript',
    'react-ts': 'TypeScript',
    'next': 'TypeScript',
    'nextjs': 'TypeScript',
    'vue': 'JavaScript',
    'vue-ts': 'TypeScript',
    'angular': 'TypeScript',
    'svelte': 'JavaScript',
    'svelte-ts': 'TypeScript',
    'sveltekit': 'TypeScript',
    'solid-js': 'JavaScript',
    'qwik': 'TypeScript',
    'astro': 'TypeScript',
    'blazor': 'C#',
    'yew': 'Rust',
    'leptos': 'Rust',
  };

  for (const [key, value] of Object.entries(languageMap)) {
    if (frontendId.includes(key)) {
      return value;
    }
  }

  return 'JavaScript'; // Default
}

/**
 * Get suggested backends for a specific frontend framework
 */
function getSuggestedBackendsForFrontend(frontendId: string): string[] {
  const suggestions: Record<string, string[]> = {
    'blazor': ['aspdotnet', 'gorilla'],
    'yew': ['actix-web', 'axum'],
    'leptos': ['actix-web', 'axum'],
    'angular': ['nestjs', 'spring-boot', 'aspdotnet'],
    'react': ['express', 'fastify', 'nestjs', 'fastapi', 'rails'],
    'vue': ['express', 'fastify', 'laravel', 'rails'],
    'svelte': ['express', 'fastify', 'fiber'],
    'next': ['express', 'fastify', 'nestjs'],
  };

  for (const [key, value] of Object.entries(suggestions)) {
    if (frontendId.includes(key)) {
      return value;
    }
  }

  return ['express', 'fastify', 'nestjs'];
}

/**
 * Validate if a backend framework ID exists
 */
export function validateBackendFramework(backendId: string): { valid: boolean; error?: string } {
  const backend = getBackendTemplate(backendId);

  if (!backend) {
    return {
      valid: false,
      error: `Backend framework "${backendId}" not found. Use --list-backends to see available frameworks.`,
    };
  }

  return { valid: true };
}

/**
 * Validate if a frontend framework ID exists
 */
export function validateFrontendFramework(frontendId: string): { valid: boolean; error?: string } {
  try {
    const config = getFrameworkConfig(frontendId);
    if (!config) {
      return {
        valid: false,
        error: `Frontend framework "${frontendId}" not found. Use --list-frontends to see available frameworks.`,
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: `Frontend framework "${frontendId}" not found. Use --list-frontends to see available frameworks.`,
    };
  }
}

/**
 * Validate if a database type exists
 */
export function validateDatabaseType(dbType: string): { valid: boolean; error?: string } {
  const validTypes = ['prisma', 'typeorm', 'mongoose', 'none'];

  if (!validTypes.includes(dbType)) {
    return {
      valid: false,
      error: `Database type "${dbType}" not found. Valid options: ${validTypes.join(', ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Get compatibility summary for display
 */
export function getCompatibilitySummary(
  frontendId: string,
  backendId: string
): { icon: string; text: string; color: string } {
  const result = validateFrameworkCompatibility(frontendId, backendId);

  switch (result.compatibility) {
    case 'excellent':
      return { icon: '⭐⭐⭐', text: 'Excellent match', color: 'green' };
    case 'good':
      return { icon: '⭐⭐', text: 'Good combination', color: 'cyan' };
    case 'fair':
      return { icon: '⭐', text: 'Fair compatibility', color: 'yellow' };
    case 'poor':
      return { icon: '⚠️', text: 'Poor compatibility', color: 'orange' };
    case 'incompatible':
      return { icon: '❌', text: 'Incompatible', color: 'red' };
    default:
      return { icon: '❓', text: 'Unknown', color: 'gray' };
  }
}

/**
 * Backend language category with frameworks
 */
export interface BackendLanguageCategory {
  name: string;
  displayName: string;
  description: string;
  templates: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string;
  }>;
}

/**
 * Get backend templates grouped by programming language
 */
export function getBackendTemplatesByLanguage(): BackendLanguageCategory[] {
  const templates = listBackendTemplates();

  const languageMap = new Map<string, BackendLanguageCategory>();

  for (const template of templates) {
    const lang = template.language;
    if (!languageMap.has(lang)) {
      languageMap.set(lang, {
        name: lang,
        displayName: getLanguageDisplayName(lang),
        description: getLanguageDescription(lang),
        templates: [],
      });
    }
    languageMap.get(lang)!.templates.push({
      id: template.id,
      name: template.name,
      displayName: template.displayName,
      description: template.description?.substring(0, 100) + (template.description?.length > 100 ? '...' : ''),
    });
  }

  // Sort languages by popularity (common ones first)
  const languageOrder = [
    'typescript', 'javascript', 'python', 'go', 'rust', 'java',
    'csharp', 'php', 'ruby', 'elixir', 'cpp', 'dart', 'scala',
    'kotlin', 'clojure', 'fsharp', 'haskell', 'nim', 'crystal',
    'r', 'julia', 'ocaml', 'lua', 'perl', 'swift', 'zig',
  ];

  const sorted = Array.from(languageMap.values()).sort((a, b) => {
    const indexA = languageOrder.indexOf(a.name.toLowerCase());
    const indexB = languageOrder.indexOf(b.name.toLowerCase());
    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;
    return orderA - orderB;
  });

  return sorted;
}

/**
 * Get language choices for the first level of selection
 */
export function getBackendLanguageChoices() {
  const categories = getBackendTemplatesByLanguage();

  return categories.map((cat) => ({
    title: `${cat.displayName} (${cat.templates.length} frameworks)`,
    value: cat.name,
    description: cat.description,
  }));
}

/**
 * Get framework choices for a specific language
 */
export function getFrameworkChoicesForLanguage(language: string) {
  const categories = getBackendTemplatesByLanguage();
  const category = categories.find((c) => c.name.toLowerCase() === language.toLowerCase());

  if (!category) {
    return getBackendTemplateChoices(); // Fallback to all templates
  }

  return category.templates.map((t) => ({
    title: t.displayName,
    value: t.id,
    description: t.description,
  }));
}

/**
 * Get popular/top backend frameworks for quick selection
 */
export function getPopularBackendFrameworks() {
  const popular = [
    'express', 'fastify', 'nestjs', 'koa',      // Node.js
    'fastapi', 'flask', 'django',               // Python
    'gin', 'fiber', 'echo',                     // Go
    'actix-web', 'axum',                        // Rust
    'spring-boot', 'quarkus',                   // Java
    'aspdotnet', 'gorilla',                     // C#/.NET
  ];

  const templates = listBackendTemplates();

  return templates
    .filter((t: any) => popular.includes(t.id))
    .map((t: any) => ({
      title: `${t.displayName} (${t.language})`,
      value: t.id,
      description: t.description?.substring(0, 80) + '...',
    }));
}

/**
 * Get display name for a programming language
 */
function getLanguageDisplayName(lang: string): string {
  const displayNames: Record<string, string> = {
    'typescript': 'TypeScript',
    'javascript': 'JavaScript',
    'python': 'Python',
    'go': 'Go',
    'golang': 'Go',
    'rust': 'Rust',
    'java': 'Java',
    'csharp': 'C#',
    'dotnet': '.NET/C#',
    'php': 'PHP',
    'ruby': 'Ruby',
    'elixir': 'Elixir',
    'erlang': 'Erlang/Elixir',
    'cpp': 'C++',
    'cplusplus': 'C++',
    'dart': 'Dart',
    'scala': 'Scala',
    'kotlin': 'Kotlin',
    'clojure': 'Clojure',
    'fsharp': 'F#',
    'haskell': 'Haskell',
    'nim': 'Nim',
    'crystal': 'Crystal',
    'r': 'R',
    'julia': 'Julia',
    'ocaml': 'OCaml',
    'lua': 'Lua',
    'perl': 'Perl',
    'swift': 'Swift',
    'zig': 'Zig',
    'v': 'V',
    'mojo': 'Mojo',
  };

  return displayNames[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

/**
 * Get description for a programming language
 */
function getLanguageDescription(lang: string): string {
  const descriptions: Record<string, string> = {
    'typescript': 'Type-safe web frameworks with Node.js runtime',
    'javascript': 'Web frameworks with Node.js runtime',
    'python': 'Popular frameworks for web, ML, and data science',
    'go': 'Fast, compiled language for high-performance services',
    'rust': 'Memory-safe, blazing fast services',
    'java': 'Enterprise-grade frameworks and microservices',
    'csharp': 'Microsoft .NET ecosystem for enterprise apps',
    'php': 'Battle-tested web development frameworks',
    'ruby': 'Developer-friendly, convention-over-configuration',
    'elixir': 'Real-time, distributed systems with BEAM VM',
    'cpp': 'High-performance systems programming',
    'dart': 'Flutter backend integration and server apps',
    'scala': 'Functional programming on the JVM',
    'kotlin': 'Modern JVM and Android backend development',
    'clojure': 'Functional, immutable data processing',
    'fsharp': 'Functional-first on .NET',
    'haskell': 'Purely functional programming',
    'nim': 'Python-like syntax with C performance',
    'crystal': 'Ruby-like syntax with LLVM performance',
    'r': 'Statistical computing and data services',
    'julia': 'High-performance numerical computing',
    'ocaml': 'Industrial-strength functional programming',
    'lua': 'Embedded scripting and game backends',
    'perl': 'Text processing and system administration',
    'swift': 'Apple ecosystem server-side development',
    'zig': 'Modern systems programming language',
    'v': 'Simple, fast, and safe compilation',
  };

  return descriptions[lang.toLowerCase()] || 'Backend framework options';
}

// Normalize functions to ensure consistent interface
function normalizePrismaConfig(config: any): DatabaseConfig {
  return {
    type: 'prisma',
    dependencies: config.dependencies || {},
    devDependencies: config.devDependencies || {},
    files: config.files || {},
    scripts: config.scripts || {},
    postInstallCommands: config.postInstallCommands || [],
  };
}

function normalizeTypeORMConfig(config: any): DatabaseConfig {
  return {
    type: 'typeorm',
    dependencies: config.dependencies || {},
    devDependencies: config.devDependencies || {},
    files: config.files || {},
    scripts: config.scripts || {},
    postInstallCommands: config.postInstallCommands || [],
  };
}

function normalizeMongooseConfig(config: any): DatabaseConfig {
  return {
    type: 'mongoose',
    dependencies: config.dependencies || {},
    devDependencies: config.devDependencies || {},
    files: config.files || {},
    scripts: config.scripts || {},
    postInstallCommands: config.postInstallCommands || [],
  };
}

/**
 * Dependency conflict detection interfaces
 */
export interface DependencyConflict {
  name: string;
  type: 'version' | 'peer' | 'incompatible';
  severity: 'error' | 'warning';
  currentVersion?: string;
  requiredVersion?: string;
  description: string;
  resolution: string;
}

export interface DependencyCheckResult {
  hasConflicts: boolean;
  conflicts: DependencyConflict[];
  warnings: DependencyConflict[];
  resolutions: string[];
}

/**
 * Known incompatible dependency combinations
 */
const INCOMPATIBLE_COMBINATIONS: Record<string, { deps: string[]; reason: string }> = {
  'react-18': {
    deps: ['react@^17.0.0', 'react-dom@^17.0.0'],
    reason: 'React 18 has breaking changes from React 17',
  },
  'vue-3': {
    deps: ['vue@^2.0.0', 'vue-template-compiler@^2.0.0'],
    reason: 'Vue 3 is not compatible with Vue 2 packages',
  },
  'angular-16': {
    deps: ['@angular/core@^15.0.0'],
    reason: 'Angular 16 requires Angular 16+ packages',
  },
};

/**
 * Peer dependency requirements
 */
const PEER_DEPENDENCY_REQUIREMENTS: Record<string, { range: string; reason: string }> = {
  'react-router-dom': {
    range: '>=5',
    reason: 'react-router-dom v6 requires React 18+',
  },
  'redux': {
    range: '>=4',
    reason: 'Redux v4+ requires specific React bindings',
  },
  '@apollo/client': {
    range: '>=3',
    reason: 'Apollo Client v3 has breaking changes',
  },
};

/**
 * Check for dependency conflicts in a project configuration
 */
export function checkDependencyConflicts(config: {
  frontend?: string;
  backend?: string;
  db?: string;
  dependencies?: Record<string, string>;
}): DependencyCheckResult {
  const conflicts: DependencyConflict[] = [];
  const warnings: DependencyConflict[] = [];
  const resolutions: string[] = [];

  // Get dependencies from selected frameworks
  const allDeps = collectAllDependencies(config);

  // Check for version conflicts
  const versionConflicts = checkVersionConflicts(allDeps);
  conflicts.push(...versionConflicts.conflicts);
  warnings.push(...versionConflicts.warnings);

  // Check for peer dependency issues
  const peerIssues = checkPeerDependencies(allDeps);
  warnings.push(...peerIssues);

  // Check framework-specific conflicts
  const frameworkConflicts = checkFrameworkConflicts(config);
  conflicts.push(...frameworkConflicts.conflicts);
  warnings.push(...frameworkConflicts.warnings);

  // Generate resolutions
  if (conflicts.length > 0 || warnings.length > 0) {
    resolutions.push(...generateResolutions(conflicts, warnings, allDeps));
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    warnings,
    resolutions,
  };
}

/**
 * Collect all dependencies from selected frameworks and databases
 */
function collectAllDependencies(config: {
  frontend?: string;
  backend?: string;
  db?: string;
  dependencies?: Record<string, string>;
}): Record<string, string> {
  const deps: Record<string, string> = { ...config.dependencies };

  // Add frontend dependencies
  if (config.frontend) {
    const frontendDeps = getFrameworkDependencies(config.frontend);
    Object.assign(deps, frontendDeps);
  }

  // Add backend dependencies
  if (config.backend) {
    const backendDeps = getBackendDependencies(config.backend);
    Object.assign(deps, backendDeps);
  }

  // Add database dependencies
  if (config.db && config.db !== 'none') {
    const dbConfig = getDatabaseConfig(config.db as DatabaseType);
    if (dbConfig) {
      Object.assign(deps, dbConfig.dependencies);
    }
  }

  return deps;
}

/**
 * Get dependencies for a frontend framework
 */
function getFrameworkDependencies(framework: string): Record<string, string> {
  const frameworkConfig = getFrameworkConfig(framework);

  if (!frameworkConfig || !frameworkConfig.dependencies) {
    return {};
  }

  return frameworkConfig.dependencies;
}

/**
 * Get dependencies for a backend framework
 */
function getBackendDependencies(backend: string): Record<string, string> {
  const template = getBackendTemplate(backend);

  if (!template || !template.dependencies) {
    return {};
  }

  return template.dependencies;
}

/**
 * Check for version conflicts between dependencies
 */
function checkVersionConflicts(
  dependencies: Record<string, string>
): { conflicts: DependencyConflict[]; warnings: DependencyConflict[] } {
  const conflicts: DependencyConflict[] = [];
  const warnings: DependencyConflict[] = [];

  // Check for React version conflicts
  if (dependencies.react && dependencies['react-dom']) {
    const reactMajor = parseMajorVersion(dependencies.react);
    const reactDomMajor = parseMajorVersion(dependencies['react-dom']);

    if (reactMajor !== reactDomMajor) {
      conflicts.push({
        name: 'react/react-dom',
        type: 'version',
        severity: 'error',
        currentVersion: `react@${dependencies.react}, react-dom@${dependencies['react-dom']}`,
        requiredVersion: 'Same major version',
        description: 'React and ReactDOM must have the same major version',
        resolution: `Use react@^${reactMajor}.0.0 and react-dom@^${reactMajor}.0.0`,
      });
    }
  }

  // Check for Vue version conflicts
  if (dependencies.vue && dependencies['vue-template-compiler']) {
    const vueMajor = parseMajorVersion(dependencies.vue);
    const compilerMajor = parseMajorVersion(dependencies['vue-template-compiler']);

    if (vueMajor === 3 && compilerMajor === 2) {
      conflicts.push({
        name: 'vue/vue-template-compiler',
        type: 'incompatible',
        severity: 'error',
        currentVersion: `vue@${dependencies.vue}, vue-template-compiler@${dependencies['vue-template-compiler']}`,
        requiredVersion: 'vue@^2.x or remove vue-template-compiler for Vue 3',
        description: 'Vue 3 does not use vue-template-compiler',
        resolution: 'Remove vue-template-compiler for Vue 3 projects, or downgrade to Vue 2',
      });
    }
  }

  // Check for TypeScript conflicts
  const tsPackages = Object.keys(dependencies).filter((d) => d.startsWith('@types/') || d === 'typescript');
  if (tsPackages.length > 0 && dependencies.typescript) {
    warnings.push({
      name: 'typescript',
      type: 'peer',
      severity: 'warning',
      description: 'Multiple TypeScript-related packages detected',
      resolution: 'Ensure all @types/* packages are compatible with the TypeScript version',
    });
  }

  return { conflicts, warnings };
}

/**
 * Check peer dependency requirements
 */
function checkPeerDependencies(dependencies: Record<string, string>): DependencyConflict[] {
  const issues: DependencyConflict[] = [];

  for (const [dep, version] of Object.entries(dependencies)) {
    const requirement = PEER_DEPENDENCY_REQUIREMENTS[dep];
    if (requirement) {
      const majorVersion = parseMajorVersion(version);
      const requiredMajor = parseMajorVersion(requirement.range);

      if (majorVersion < requiredMajor) {
        issues.push({
          name: dep,
          type: 'peer',
          severity: 'warning',
          currentVersion: version,
          requiredVersion: requirement.range,
          description: requirement.reason,
          resolution: `Upgrade ${dep} to ${requirement.range} or higher`,
        });
      }
    }
  }

  return issues;
}

/**
 * Check for framework-specific conflicts
 */
function checkFrameworkConflicts(config: {
  frontend?: string;
  backend?: string;
  db?: string;
}): { conflicts: DependencyConflict[]; warnings: DependencyConflict[] } {
  const conflicts: DependencyConflict[] = [];
  const warnings: DependencyConflict[] = [];

  // Check database compatibility with backend
  if (config.backend && config.db && config.db !== 'none') {
    const backend = getBackendTemplate(config.backend);

    if (backend) {
      // Prisma works best with TypeScript/JavaScript backends
      if (config.db === 'prisma' && backend.language !== 'typescript' && backend.language !== 'javascript') {
        warnings.push({
          name: 'prisma-backend',
          type: 'incompatible',
          severity: 'warning',
          description: `Prisma is primarily designed for TypeScript/JavaScript projects`,
          resolution: `Consider using TypeORM or native database drivers for ${backend.language}`,
        });
      }

      // Mongoose is for MongoDB only
      if (config.db === 'mongoose' && backend.language === 'typescript') {
        // This is actually fine, Mongoose works with TS
      }
    }
  }

  // Check frontend-backend framework conflicts
  if (config.frontend && config.backend) {
    const frontendLower = config.frontend.toLowerCase();
    const backendLower = config.backend.toLowerCase();

    // Check for specific known conflicts
    if (frontendLower.includes('blazor') && backendLower.includes('express')) {
      conflicts.push({
        name: 'blazor-express',
        type: 'incompatible',
        severity: 'error',
        description: 'Blazor requires .NET backend, not Node.js/Express',
        resolution: 'Use ASP.NET Core backend with Blazor, or use React/Vue/Angular with Express',
      });
    }
  }

  return { conflicts, warnings };
}

/**
 * Generate resolution suggestions
 */
function generateResolutions(
  conflicts: DependencyConflict[],
  warnings: DependencyConflict[],
  dependencies: Record<string, string>
): string[] {
  const resolutions: string[] = [];

  if (conflicts.length > 0) {
    resolutions.push('Critical conflicts detected - these must be resolved:');
    conflicts.forEach((c) => {
      resolutions.push(`  • ${c.name}: ${c.resolution}`);
    });
  }

  if (warnings.length > 0) {
    resolutions.push('Warnings detected - recommended actions:');
    warnings.forEach((w) => {
      resolutions.push(`  • ${w.name}: ${w.resolution || 'Review configuration'}`);
    });
  }

  // Add general suggestions based on conflicts
  if (conflicts.some((c) => c.type === 'version')) {
    resolutions.push('Consider using npm overrides or resolutions to force compatible versions');
    resolutions.push('Run `npm ls` to see the full dependency tree');
  }

  if (conflicts.some((c) => c.type === 'peer')) {
    resolutions.push('Use `--legacy-peer-deps` flag as a temporary workaround (not recommended)');
    resolutions.push('Consider downgrading packages to meet peer requirements');
  }

  return resolutions;
}

/**
 * Parse major version from semver string
 */
function parseMajorVersion(version: string): number {
  const match = version.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get formatted conflict report for display
 */
export function formatDependencyReport(result: DependencyCheckResult): string {
  const lines: string[] = [];

  if (result.hasConflicts) {
    lines.push('\n❌ Dependency Conflicts Detected:');
    result.conflicts.forEach((c) => {
      lines.push(`  ⚠️  ${c.name}: ${c.description}`);
      lines.push(`     Resolution: ${c.resolution}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push('\n⚠️  Warnings:');
    result.warnings.forEach((w) => {
      lines.push(`  • ${w.name}: ${w.description}`);
      if (w.resolution) {
        lines.push(`    Resolution: ${w.resolution}`);
      }
    });
  }

  if (result.resolutions.length > 0) {
    lines.push('\n💡 Suggested Resolutions:');
    result.resolutions.forEach((r) => {
      lines.push(`  ${r}`);
    });
  }

  return lines.join('\n');
}

/**
 * Auto-fix dependency conflicts by suggesting package.json overrides
 */
export function generatePackageOverrides(result: DependencyCheckResult): Record<string, string> {
  const overrides: Record<string, string> = {};

  result.conflicts.forEach((c) => {
    if (c.type === 'version' && c.currentVersion && c.requiredVersion) {
      // Extract package name
      const [pkg] = c.name.split('/');
      const versionMatch = c.requiredVersion.match(/\^?(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        overrides[pkg] = versionMatch[1];
      }
    }
  });

  return overrides;
}

/**
 * Language-specific best practices interfaces
 */
export interface BestPracticeFile {
  path: string;
  content: string;
}

export interface BestPracticesConfig {
  files: BestPracticeFile[];
  folders: string[];
  scripts: Record<string, string>;
  description: string;
}

/**
 * Get best practices configuration for a programming language
 */
export function getBestPracticesForLanguage(language: string): BestPracticesConfig {
  const lang = language.toLowerCase();

  const baseConfig: BestPracticesConfig = {
    files: [],
    folders: [],
    scripts: {},
    description: '',
  };

  switch (lang) {
    case 'typescript':
    case 'javascript':
      return getJavaScriptBestPractices();
    case 'python':
      return getPythonBestPractices();
    case 'go':
      return getGoBestPractices();
    case 'rust':
      return getRustBestPractices();
    case 'java':
      return getJavaBestPractices();
    case 'csharp':
    case 'dotnet':
    case '.net':
      return getDotNetBestPractices();
    case 'ruby':
      return getRubyBestPractices();
    case 'php':
      return getPHPBestPractices();
    case 'elixir':
      return getElixirBestPractices();
    default:
      return baseConfig;
  }
}

/**
 * JavaScript/TypeScript best practices
 */
function getJavaScriptBestPractices(): BestPracticesConfig {
  return {
    description: 'JavaScript/TypeScript best practices',
    folders: [
      'src',
      '__tests__',
      '__mocks__',
    ],
    files: [
      {
        path: '.eslintrc.js',
        content: `module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
};
`,
      },
      {
        path: '.prettierrc',
        content: `{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
`,
      },
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[*.{sh,bash}]
end_of_line = lf
`,
      },
      {
        path: '.gitignore',
        content: `# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Testing
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
.cache/
.temp/
`,
      },
    ],
    scripts: {
      lint: 'eslint . --ext .js,.ts,.jsx,.tsx --fix',
      format: 'prettier --write "**/*.{js,ts,jsx,tsx,json,md}"',
      'type-check': 'tsc --noEmit',
      test: 'jest',
      'test:watch': 'jest --watch',
      'test:coverage': 'jest --coverage',
    },
  };
}

/**
 * Python best practices
 */
function getPythonBestPractices(): BestPracticesConfig {
  return {
    description: 'Python best practices',
    folders: [
      'src',
      'tests',
      'docs',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2

[*.py]
indent_size = 4

[*.{yml,yaml}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# C extensions
*.so

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# PyInstaller
*.manifest
*.spec

# Unit test / coverage
htmlcov/
.tox/
.nox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.py,cover
.hypothesis/
.pytest_cache/

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# mypy
.mypy_cache/
.dmypy.json
dmypy.json

# ruff
.ruff_cache/
`,
      },
      {
        path: 'ruff.toml',
        content: `# Ruff configuration for Python linting and formatting
target-version = "py311"

[lint]
select = [
  "E",     # pycodestyle errors
  "W",     # pycodestyle warnings
  "F",     # Pyflakes
  "I",     # isort
  "B",     # flake8-bugbear
  "C4",    # flake8-comprehensions
  "UP",    # pyupgrade
  "ARG",   # flake8-unused-arguments
  "SIM",   # flake8-simplify
]
ignore = [
  "E501",  # line too long (handled by formatter)
  "B008",  # do not perform function calls in argument defaults
  "W191",  # indentation contains tabs
]

[lint.per-file-ignores]
"__init__.py" = ["F401"]  # unused imports
"tests/**/*.py" = ["ARG", "S101"]  # unused arguments, assert allowed

[format]
quote-style = "double"
indent-style = "space"
skip-magic-trailing-comma = false
line-ending = "auto"
`,
      },
      {
        path: 'pyproject.toml',
        content: `# pyproject.toml for Python tool configuration
[tool.black]
line-length = 100
target-version = ["py311"]
include = '\\.pyi?$'
extend-exclude = '''
/(
  # directories
  \\.eggs
  | \\.git
  | \\.hg
  | \\.mypy_cache
  | \\.tox
  | \\.venv
  | build
  | dist
)/
'''

[tool.pytest.ini_options]
minversion = "7.0"
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-v --tb=short --strict-markers"

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
`,
      },
    ],
    scripts: {
      lint: 'ruff check .',
      'lint:fix': 'ruff check --fix .',
      format: 'ruff format .',
      test: 'pytest',
      'test:watch': 'pytest-watch',
      'test:coverage': 'pytest --cov=src --cov-report=html',
      'type-check': 'mypy src',
    },
  };
}

/**
 * Go best practices
 */
function getGoBestPractices(): BestPracticesConfig {
  return {
    description: 'Go best practices',
    folders: [
      'cmd',
      'internal',
      'pkg',
      'api',
      'web',
      'configs',
      'scripts',
      'test',
      'docs',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = tab
indent_size = 2

[*.go]
indent_style = tab

[*.{yml,yaml}]
indent_style = space
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
bin/
dist/

# Test binary, built with \`go test -c\`
*.test

# Output of the go coverage tool
*.out
coverage.html
coverage.txt

# Go workspace file
go.work

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Vendor
vendor/

# Dependencies
go.sum
`,
      },
      {
        path: '.golangci.yml',
        content: `run:
  timeout: 5m
  tests: true
  modules-download-mode: readonly

linters:
  enable:
    - gofmt
    - goimports
    - govet
    - errcheck
    - staticcheck
    - unused
    - gosimple
    - ineffassign
    - misspell
    - gocritic
    - gosec
    - revive
    - stylecheck
    - unconvert
    - prealloc
    - exportloopref

linters-settings:
  goimports:
    local-prefixes: github.com/re-shell

  govet:
    enable-all: true

  errcheck:
    check-type-assertions: true
    check-blank: true

  revive:
    confidence: 0.8
    rules:
      - name: blank-imports
      - name: context-as-argument
      - name: context-keys-type
      - name: dot-imports
      - name: error-return
      - name: error-strings
      - name: error-naming
      - name: exported
      - name: if-return
      - name: increment-decrement
      - name: var-naming
      - name: var-declaration
      - name: package-comments
      - name: range
      - name: receiver-naming
      - name: time-naming
      - name: unexported-return
      - name: indent-error-flow
      - name: errorf
      - name: empty-block
      - name: superfluous-else
      - name: unused-parameter
      - name: unreachable-code
      - name: redefines-builtin-id

issues:
  exclude-use-default: false
  max-same-issues: 0
  max-issues-per-linter: 0

output:
  formats: colord,line-number
  print-issued-lines: true
  print-linter-name: true
`,
      },
    ],
    scripts: {
      lint: 'golangci-lint run',
      'lint:fix': 'golangci-lint run --fix',
      format: 'gofmt -s -w .',
      test: 'go test -v -race -cover ./...',
      'test:coverage': 'go test -coverprofile=coverage.txt -covermode=atomic ./...',
      build: 'go build -v ./...',
      run: 'go run main.go',
    },
  };
}

/**
 * Rust best practices
 */
function getRustBestPractices(): BestPracticesConfig {
  return {
    description: 'Rust best practices',
    folders: [
      'src',
      'tests',
      'benches',
      'examples',
      'docs',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 4

[*.rs]
indent_size = 4

[*.{yml,yaml,toml}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Rust
/target/
**/*.rs.bk
*.pdb

# Cargo
Cargo.lock

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Debug
/debug/
/incremental/

# Documentation
doc/book/
src/doc/

# Profiling
profiling/
flamegraph.svg
perf.data
perf.data.old
`,
      },
      {
        path: 'clippy.toml',
        content: `# Clippy configuration
# Deny lints that are often mistakes
warn-on-all-wildcard-imports = true

# Allow some pedantic lints that may have false positives
allow-expect-in-tests = true
allow-unwrap-in-tests = true
`,
      },
      {
        path: 'rustfmt.toml',
        content: `# Rustfmt configuration
max_width = 100
hard_tabs = false
tab_spaces = 4
indent_style = "Block"
reorder_imports = true
reorder_modules = true
remove_nested_parens = true
edition = "2021"
merge_derives = true
use_field_init_shorthand = true
use_try_shorthand = true
`,
      },
    ],
    scripts: {
      lint: 'cargo clippy -- -D warnings',
      'lint:fix': 'cargo clippy --fix --allow-dirty --allow-staged',
      format: 'cargo fmt',
      'format:check': 'cargo fmt --check',
      test: 'cargo test',
      'test:watch': 'cargo watch -x test',
      'test:coverage': 'cargo tarpaulin --out Html',
      build: 'cargo build --release',
      run: 'cargo run',
      doc: 'cargo doc --open',
    },
  };
}

/**
 * Java best practices
 */
function getJavaBestPractices(): BestPracticesConfig {
  return {
    description: 'Java best practices',
    folders: [
      'src/main/java',
      'src/main/resources',
      'src/test/java',
      'src/test/resources',
      'docs',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2

[*.{java,kt}]
indent_size = 2
continuation_indent_size = 4

[*.{xml,yml,yaml,properties}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Compiled class files
*.class

# Log files
*.log

# BlueJ files
*.ctxt

# Mobile Tools for Java (J2ME)
.mtj.tmp/

# Package Files
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar

# Virtual machine crash logs
hs_err_pid*
replay_pid*

# Maven
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
pom.xml.next
release.properties
dependency-reduced-pom.xml
buildNumber.properties
.mvn/timing.properties
.mvn/wrapper/maven-wrapper.jar

# Gradle
.gradle
build/
!gradle/wrapper/gradle-wrapper.jar
!**/src/main/**/build/
!**/src/test/**/build/

# IDE
.idea/
*.iws
*.iml
*.ipr
.vscode/
.classpath
.project
.settings/
bin/

# OS
.DS_Store
Thumbs.db
`,
      },
      {
        path: 'checkstyle.xml',
        content: `<?xml version="1.0"?>
<!DOCTYPE module PUBLIC
  "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
  "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
  <property name="charset" value="UTF-8"/>
  <property name="severity" value="warning"/>
  <property name="fileExtensions" value="java, properties, xml"/>

  <module name="BeforeExecutionExclusionFileFilter">
    <property name="fileNamePattern" value="module\\-info\\.java$"/>
  </module>

  <module name="TreeWalker">
    <module name="AvoidStarImport"/>
    <module name="ConstantName"/>
    <module name="EmptyBlock"/>
    <module name="EmptyForIteratorPad"/>
    <module name="EqualsHashCode"/>
    <module name="IllegalImport"/>
    <module name="Indentation">
      <property name="basicOffset" value="2"/>
      <property name="braceAdjustment" value="0"/>
      <property name="caseIndent" value="2"/>
      <property name="throwsIndent" value="4"/>
      <property name="lineWrappingIndentation" value="4"/>
      <property name="arrayInitIndent" value="2"/>
    </module>
    <module name="LeftCurly"/>
    <module name="LineLength">
      <property name="max" value="120"/>
      <property name="ignorePattern" value="^package.*|^import.*|a href|href|http://|https://|ftp://"/>
    </module>
    <module name="NeedBraces"/>
    <module name="RightCurly"/>
    <module name="WhitespaceAfter"/>
    <module name="WhitespaceAround"/>
  </module>
</module>
`,
      },
    ],
    scripts: {
      lint: 'checkstyle -c checkstyle.xml src/',
      format: 'google-java-format -i $(find src -name "*.java")',
      test: './mvnw test',
      'test:coverage': './mvnw test jacoco:report',
      build: './mvnw clean package',
      run: './mvnw spring-boot:run',
    },
  };
}

/**
 * .NET/C# best practices
 */
function getDotNetBestPractices(): BestPracticesConfig {
  return {
    description: '.NET/C# best practices',
    folders: [
      'src',
      'tests',
      'docs',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2

[*.{cs,fs,vb}]
indent_size = 4

[*.{yml,yaml,json}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Build results
[Dd]ebug/
[Dd]ebugPublic/
[Rr]elease/
[Rr]eleases/
x64/
x86/
[Ww][Ii][Nn]32/
[Aa][Rr][Mm]/
[Aa][Rr][Mm]64/
bld/
[Bb]in/
[Oo]bj/
[Ll]og/
[Ll]ogs/

# Visual Studio cache/options directory
.vs/
.vscode/

# User-specific files
*.rsuser
*.suo
*.user
*.userosscache
*.sln.docstates

# Mono auto generated files
mono_crash.*

# Build Results
[Bb]uild/
*.mdf
*.ldf
*.ndf

# NuGet Packages
*.nupkg
*.snupkg
**/packages/*
!**/packages/build/

# Visual Studio profiler
*.psess
*.vsp
*.vspx
*.sap

# ReSharper
_ReSharper*/
*.[Rr]e[Ss]harper
*.DotSettings.user

# JetBrains Rider
.idea/
*.sln.iml

# OS
.DS_Store
Thumbs.db
`,
      },
      {
        path: '.stylelintrc.json',
        content: `{
  "$schema": "https://raw.githubusercontent.com/DotNetAnalyzers/StyleCopAnalyzers/master/StyleCop.Analyzers/StyleCop.Analyzers/Settings/stylecop.schema.json",
  "settings": {
    "documentationRules": {
      "companyName": "Re-Shell",
      "copyrightText": "Copyright (c) {year} {companyName}. All rights reserved.",
      "xmlHeader": false,
      "variables": {
        "year": "$Year$"
      }
    },
    "namingRules": {
      "allowCommonHungarianPrefixes": false,
      "allowedHungarianPrefixes": [],
      "allowAbbreviationCasingRules": true
    },
    "orderingRules": {
      "usingDirectivesPlacement": "outsideNamespace",
      "systemUsingDirectivesFirst": true
    },
    "layoutRules": {
      "newlineAtEndOfFile": "require",
      "allowConsecutiveUsings": false
    }
  }
}
`,
      },
    ],
    scripts: {
      lint: 'dotnet format --verify-no-changes',
      'lint:fix': 'dotnet format',
      test: 'dotnet test',
      'test:coverage': 'dotnet test --collect:"XPlat Code Coverage"',
      build: 'dotnet build',
      run: 'dotnet run --project src/Api/Api.csproj',
    },
  };
}

/**
 * Ruby best practices
 */
function getRubyBestPractices(): BestPracticesConfig {
  return {
    description: 'Ruby best practices',
    folders: [
      'app',
      'lib',
      'config',
      'spec',
      'test',
      'db',
      'public',
      'views',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2

[*.rb]
indent_size = 2

[*.{yml,yaml}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Bundler
/.bundle/
/vendor/bundle

# RVM
/.rvmrc

# rbenv
.ruby-version
.ruby-gemset

# Gemfile
Gemfile.lock

# Testing
/coverage/
/spec/examples.txt

# Documentation
/doc/
/rdoc/
/.yardoc/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
/log/

# Temporary files
tmp/
temp/
*.tmp
*.bak
`,
      },
      {
        path: '.rubocop.yml',
        content: `# RuboCop configuration
require:
  - rubocop-rails
  - rubocop-rspec
  - rubocop-performance

AllCops:
  TargetRubyVersion: 3.2
  NewCops: enable
  SuggestExtensions: false
  Exclude:
    - 'db/schema.rb'
    - 'vendor/bundle/**/*'

Style/Documentation:
  Enabled: false

Style/FrozenStringLiteralComment:
  Enabled: true
  EnforcedStyle: always

Style/StringLiterals:
  EnforcedStyle: double_quotes

Style/SymbolArray:
  EnforcedStyle: brackets

Layout/LineLength:
  Max: 120
  IgnoredPatterns:
    - '^\\s*# '

Metrics/MethodLength:
  Max: 20
  CountAsOne:
    - array
    - hash
    - heredoc

Metrics/BlockLength:
  Exclude:
    - 'spec/**/*'
    - 'config/routes.rb'
    - 'config/environments/*'

Metrics/AbcSize:
  Max: 20

Naming/FileName:
  Exclude:
    - 'Gemfile'

Rails:
  Enabled: true

RSpec/ExampleLength:
  Max: 20

RSpec/MultipleExpectations:
  Max: 5
`,
      },
    ],
    scripts: {
      lint: 'rubocop',
      'lint:fix': 'rubocop -a',
      format: 'prettier write "**/*.{json,yaml,yml,md}"',
      test: 'rspec',
      'test:watch': 'rspec --watch',
      'test:coverage': 'COVERAGE=true rspec',
      console: 'bin/rails console',
      server: 'bin/rails server',
    },
  };
}

/**
 * PHP best practices
 */
function getPHPBestPractices(): BestPracticesConfig {
  return {
    description: 'PHP best practices',
    folders: [
      'app',
      'config',
      'database',
      'public',
      'resources',
      'routes',
      'tests',
      'storage',
      'bootstrap',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2

[*.php]
indent_size = 4

[*.{yml,yaml,json}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# Composer
/vendor/
composer.lock

# Laravel
/node_modules
/public/hot
/public/storage
/storage/*.key
.env
.env.backup
.phpunit.result.cache
Homestead.json
Homestead.yaml
npm-debug.log
yarn-error.log

# IDE
.idea/
.vscode/
*.sublime-project
*.sublime-workspace
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
/coverage/
/.phpunit.cache
`,
      },
      {
        path: '.php-cs-fixer.php',
        content: `<?php

declare(strict_types=1);

return (new PhpCsFixer\\Config())
    ->setRiskyAllowed(true)
    ->setRules([
        '@PSR12' => true,
        'array_syntax' => ['syntax' => 'short'],
        'ordered_imports' => ['sort_algorithm' => 'alpha'],
        'no_unused_imports' => true,
        'not_operator_with_successor_space' => true,
        'trailing_comma_in_multiline' => true,
        'phpdoc_scalar' => true,
        'unary_operator_spaces' => true,
        'binary_operator_spaces' => true,
        'blank_line_before_statement' => [
            'statements' => ['return', 'try', 'throw', 'if', 'switch', 'for', 'foreach', 'while', 'do'],
        ],
        'phpdoc_single_line_var_spacing' => true,
        'phpdoc_var_without_name' => true,
        'class_attributes_separation' => [
            'elements' => [
                'const' => 'one',
                'method' => 'one',
                'property' => 'one',
            ],
        ],
    ])
    ->setFinder(
        PhpCsFixer\\Finder::create()
            ->in(__DIR__)
            ->exclude('vendor')
            ->name('*.php')
            ->notName('*.blade.php')
    );
`,
      },
      {
        path: 'phpunit.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/10.5/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
         failOnRisky="true"
         failOnWarning="true"
         cacheDirectory=".phpunit.cache">
  <testsuites>
    <testsuite name="Feature">
      <directory>tests/Feature</directory>
    </testsuite>
    <testsuite name="Unit">
      <directory>tests/Unit</directory>
    </testsuite>
  </testsuites>
  <source>
    <include>
      <directory suffix=".php">app</directory>
    </include>
  </source>
  <php>
    <env name="APP_ENV" value="testing"/>
    <env name="BCRYPT_ROUNDS" value="4"/>
    <env name="CACHE_DRIVER" value="array"/>
    <env name="DB_CONNECTION" value="sqlite"/>
    <env name="DB_DATABASE" value=":memory:"/>
    <env name="MAIL_MAILER" value="array"/>
    <env name="QUEUE_CONNECTION" value="sync"/>
    <env name="SESSION_DRIVER" value="array"/>
    <env name="TELESCOPE_ENABLED" value="false"/>
  </php>
</phpunit>
`,
      },
    ],
    scripts: {
      lint: 'phpstan analyse --memory-limit=2G',
      'lint:fix': 'php-cs-fixer fix',
      test: 'phpunit',
      'test:watch': 'phpunit-watcher watch',
      'test:coverage': 'phpunit --coverage-html coverage',
      build: 'composer install --no-dev',
      serve: 'php artisan serve',
    },
  };
}

/**
 * Elixir best practices
 */
function getElixirBestPractices(): BestPracticesConfig {
  return {
    description: 'Elixir best practices',
    folders: [
      'lib',
      'test',
      'config',
      'priv',
      'rel',
      'assets',
    ],
    files: [
      {
        path: '.editorconfig',
        content: `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2

[*.ex]
indent_size = 2

[*.{yml,yaml,json}]
indent_size = 2
`,
      },
      {
        path: '.gitignore',
        content: `# The directory Mix will write compiled artifacts to.
/_build/

# If you run "mix test --cover", coverage assets end up here.
/cover/

# The directory Mix downloads your dependencies sources to.
/deps/
*.ez

# Where third-party dependencies like ExDoc output generated docs.
/doc/

# Ignore .fetch files in case you like to edit your project deps locally.
/.fetch

# If the VM crashes, it generates a dump, let's ignore it too.
erl_crash.dump

# Also ignore archive artifacts (built via "mix archive.build").
*.ez

# Ignore package tarball (built via "mix hex.build").
*.tar

# Temporary files
tmp/
*.tmp
*.swp
*.swo

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db
`,
      },
      {
        path: '.formatter.exs',
        content: `[
  inputs: ["{mix,.formatter}.exs", "{config,lib,test}/**/*.{heex,ex,exs}", "priv/*/seeds.exs"],
  import_deps: [:ecto, :ecto_sql, :phoenix],
  subdirectories: ["priv/*/migrations"],
  line_length: 100,
  locals_without_parens: [
    conn: :*,
    render: :*,
    render_layout: :*,
    live_render: :*,
    socket: :*,
    assert: :*,
    refute: :*,
  ],
]
`,
      },
    ],
    scripts: {
      lint: 'mix format --check-formatted',
      'lint:fix': 'mix format',
      test: 'mix test',
      'test:watch': 'mix test.watch',
      'test:coverage': 'mix test --cover',
      build: 'mix compile',
      server: 'mix phx.server',
      console: 'iex -S mix phx.server',
    },
  };
}

/**
 * Apply best practices to a project directory
 */
export async function applyBestPractices(
  projectPath: string,
  language: string
): Promise<void> {
  const config = getBestPracticesForLanguage(language);

  // Create folders
  for (const folder of config.folders) {
    await fs.mkdir(`${projectPath}/${folder}`, { recursive: true }).catch(() => { /* ignore */ });
  }

  // Create files
  for (const file of config.files) {
    await fs.writeFile(`${projectPath}/${file.path}`, file.content);
  }
}

/**
 * CI/CD pipeline generation interfaces
 */
export interface CICDConfig {
  platform: 'github' | 'gitlab' | 'azure' | 'circleci';
  language: string;
  framework?: string;
  database?: string;
  hasTests: boolean;
  hasDocker: boolean;
  deployTarget?: 'vercel' | 'netlify' | 'aws' | 'azure' | 'gcp' | 'docker';
}

/**
 * Generate CI/CD pipeline configuration based on project settings
 */
export function generateCICDPipeline(config: CICDConfig): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  switch (config.platform) {
    case 'github':
      files.push(generateGitHubActions(config));
      break;
    case 'gitlab':
      files.push(generateGitLabCI(config));
      break;
    case 'azure':
      files.push(generateAzurePipelines(config));
      break;
    case 'circleci':
      files.push(generateCircleCI(config));
      break;
  }

  return files;
}

/**
 * Generate GitHub Actions workflow
 */
function generateGitHubActions(config: CICDConfig): { path: string; content: string } {
  const { language, framework, database, hasTests, hasDocker, deployTarget } = config;

  let workflow = `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

env:
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'
`;

  if (language.toLowerCase() === 'typescript' || language.toLowerCase() === 'javascript') {
    workflow += generateGitHubNodeJS(framework, hasTests, hasDocker, deployTarget);
  } else if (language.toLowerCase() === 'python') {
    workflow += generateGitHubPython(hasTests, hasDocker);
  } else if (language.toLowerCase() === 'go') {
    workflow += generateGitHubGo(hasTests, hasDocker);
  } else if (language.toLowerCase() === 'rust') {
    workflow += generateGitHubRust(hasTests, hasDocker);
  } else if (language.toLowerCase() === 'java') {
    workflow += generateGitHubJava(hasTests);
  } else if (language.toLowerCase() === 'dotnet' || language.toLowerCase() === 'csharp') {
    workflow += generateGitHubDotNet(hasTests);
  } else {
    workflow += generateGitHubGeneric(hasTests, hasDocker);
  }

  return {
    path: '.github/workflows/ci.yml',
    content: workflow,
  };
}

function generateGitHubNodeJS(framework: string | undefined, hasTests: boolean, hasDocker: boolean, deployTarget: string | undefined): string {
  let workflow = `
jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: '**/package-lock.json'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check
        continue-on-error: true

      - name: Run tests
        if: \${{ always() }}
        run: npm test
`;

  if (hasDocker) {
    workflow += `
  docker:
    runs-on: ubuntu-latest
    needs: lint-and-test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/\${{ github.repository_name }}:latest,\${{ secrets.DOCKER_USERNAME }}/\${{ github.repository_name }}:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;
  }

  if (deployTarget === 'vercel') {
    workflow += `
  deploy-vercel:
    runs-on: ubuntu-latest
    needs: lint-and-test
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
`;
  }

  return workflow;
}

function generateGitHubPython(hasTests: boolean, hasDocker: boolean): string {
  return `
jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: \${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install ruff pytest pytest-cov mypy

      - name: Run linter
        run: ruff check .

      - name: Run type check
        run: mypy src
        continue-on-error: true

      - name: Run tests
        run: pytest --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
${hasDocker ? `
  docker:
    runs-on: ubuntu-latest
    needs: lint-and-test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: app:latest
` : ''}`;
}

function generateGitHubGo(hasTests: boolean, hasDocker: boolean): string {
  return `
jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          cache: true

      - name: Download dependencies
        run: go mod download

      - name: Run linter
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest

      - name: Run tests
        run: go test -v -race -coverprofile=coverage.txt -covermode=atomic ./...

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.txt
${hasDocker ? `
  docker:
    runs-on: ubuntu-latest
    needs: lint-and-test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: app:latest
` : ''}`;
}

function generateGitHubRust(hasTests: boolean, hasDocker: boolean): string {
  return `
jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache dependencies
        uses: Swatinem/rust-cache@v2

      - name: Run formatting check
        run: cargo fmt -- --check

      - name: Run Clippy
        run: cargo clippy -- -D warnings

      - name: Run tests
        run: cargo test

      - name: Generate documentation
        run: cargo doc --no-deps
`;
}

function generateGitHubJava(hasTests: boolean): string {
  return `
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'maven'

      - name: Build with Maven
        run: mvn -B -DskipTests clean package

      - name: Run tests
        run: mvn test

      - name: Run checkstyle
        run: mvn checkstyle:check
        continue-on-error: true
`;
}

function generateGitHubDotNet(hasTests: boolean): string {
  return `
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore

      - name: Test
        run: dotnet test --no-build --verbosity normal
`;
}

function generateGitHubGeneric(hasTests: boolean, hasDocker: boolean): string {
  return `
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run tests
        if: \${{ hasTests }}
        run: |
          echo "Add your test command here"
`;
}

/**
 * Generate GitLab CI configuration
 */
function generateGitLabCI(config: CICDConfig): { path: string; content: string } {
  const { language, hasTests, hasDocker } = config;

  let pipeline = `# GitLab CI/CD Pipeline
# Auto-generated by Re-Shell CLI

stages:
  - lint
  - test
  - build
  - deploy

variables:
  GIT_DEPTH: 0

`;

  if (language.toLowerCase() === 'typescript' || language.toLowerCase() === 'javascript') {
    pipeline += `lint:
  stage: lint
  image: node:20-alpine
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

test:
  stage: test
  image: node:20-alpine
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm test
  coverage: '/All files[^|]*\\|[^|]*\\|([\\d\\.]+)/'
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
`;
  } else if (language.toLowerCase() === 'python') {
    pipeline += `lint:
  stage: lint
  image: python:3.11-slim
  script:
    - pip install ruff
    - ruff check .

test:
  stage: test
  image: python:3.11-slim
  script:
    - pip install pytest pytest-cov
    - pytest --cov=src --cov-report=term
  coverage: '/TOTAL.*\\s+(\\d+%)$/'
`;
  } else if (language.toLowerCase() === 'go') {
    pipeline += `lint:
  stage: lint
  image: golang:1.21-alpine
  script:
    - go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
    - golangci-lint run

test:
  stage: test
  image: golang:1.21-alpine
  script:
    - go test -v -race -coverprofile=coverage.txt -covermode=atomic ./...
  coverage: '/total:\\s+(?:statements|coverage)\\s+\\d+\\.\\d+%/'

coverage:
  stage: test
  image: golang:1.21-alpine
  script:
    - go test -coverprofile=coverage.txt -covermode=atomic ./...
    - go tool cover -func=coverage.txt
`;
  }

  if (hasDocker) {
    pipeline += `
build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
`;
  }

  return {
    path: '.gitlab-ci.yml',
    content: pipeline,
  };
}

/**
 * Generate Azure Pipelines configuration
 */
function generateAzurePipelines(config: CICDConfig): { path: string; content: string } {
  const { language, hasTests } = config;

  let pipeline = `# Azure Pipelines CI/CD
# Auto-generated by Re-Shell CLI

trigger:
  - main
  - develop

pr:
  - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'

`;

  if (language.toLowerCase() === 'typescript' || language.toLowerCase() === 'javascript') {
    pipeline += `steps:
  - task: NodeTool@1
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: |
      npm ci
    displayName: 'Install dependencies'

  - script: |
      npm run lint
    displayName: 'Run linter'

  - script: |
      npm test
    displayName: 'Run tests'

  - script: |
      npm run build
    displayName: 'Build project'
`;
  } else if (language.toLowerCase() === 'dotnet' || language.toLowerCase() === 'csharp') {
    pipeline += `steps:
  - task: UseDotNet@2
    inputs:
      packageType: 'sdk'
      version: '8.0.x'
      installationPath: $(Agent.ToolsDirectory)/dotnet
    displayName: 'Install .NET SDK'

  - task: DotNetCoreCLI@2
    inputs:
      command: 'restore'
      projects: '**/*.csproj'
    displayName: 'Restore dependencies'

  - task: DotNetCoreCLI@2
    inputs:
      command: 'build'
      projects: '**/*.csproj'
      arguments: '--configuration $(buildConfiguration)'
    displayName: 'Build project'

  - task: DotNetCoreCLI@2
    inputs:
      command: 'test'
      projects: '**/*Tests.csproj'
      arguments: '--configuration $(buildConfiguration)'
    displayName: 'Run tests'
`;
  }

  return {
    path: 'azure-pipelines.yml',
    content: pipeline,
  };
}

/**
 * Generate CircleCI configuration
 */
function generateCircleCI(config: CICDConfig): { path: string; content: string } {
  const { language, hasTests, hasDocker } = config;

  let pipeline = `# CircleCI CI/CD
# Auto-generated by Re-Shell CLI

version: 2.1

orbs:
  node: circleci/node@5.1

executors:
  node-executor:
    docker:
      - image: cimg/node:20.20
    working_directory: ~/project

`;

  if (language.toLowerCase() === 'typescript' || language.toLowerCase() === 'javascript') {
    pipeline += `jobs:
  lint-and-test:
    executor: node-executor
    steps:
      - checkout
      - node/install-packages
      - run:
          name: Run linter
          command: npm run lint
      - run:
          name: Run tests
          command: npm test
`;
  } else if (language.toLowerCase() === 'python') {
    pipeline = `# CircleCI CI/CD - Python
# Auto-generated by Re-Shell CLI

version: 2.1

executors:
  python-executor:
    docker:
      - image: cimg/python:3.11
    working_directory: ~/project

jobs:
  lint-and-test:
    executor: python-executor
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: pip install ruff pytest pytest-cov
      - run:
          name: Run linter
          command: ruff check .
      - run:
          name: Run tests
          command: pytest --cov=src
`;
  }

  if (hasDocker) {
    pipeline += `
  docker-build:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - setup_remote_docker
      - run:
          name: Build Docker image
          command: docker build -t app:latest .
`;
  }

  pipeline += `
workflows:
  version: 2
  build-and-test:
    jobs:
      - lint-and-test${hasDocker ? '\n      - docker-build' : ''}
`;

  return {
    path: '.circleci/config.yml',
    content: pipeline,
  };
}

/**
 * Documentation generation interfaces
 */
export interface ProjectDocsConfig {
  name: string;
  description: string;
  version: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  frontend?: string;
  backend?: string;
  database?: string;
  features: string[];
  author?: string;
  license?: string;
}

/**
 * Generate comprehensive project documentation
 */
export function generateProjectDocumentation(config: ProjectDocsConfig): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  // Main README
  files.push(generateReadme(config));

  // Architecture documentation
  files.push(generateArchitectureDocs(config));

  // API documentation (if backend)
  if (config.backend) {
    files.push(generateApiDocs(config));
  }

  // Contributing guide
  files.push(generateContributingGuide(config));

  // Changelog
  files.push({
    path: 'CHANGELOG.md',
    content: generateChangelog(config),
  });

  return files;
}

/**
 * Generate README.md
 */
function generateReadme(config: ProjectDocsConfig): { path: string; content: string } {
  const { name, description, version, type, frontend, backend, database, features, author, license } = config;

  const content = `# ${name}

${description ? description : `A ${type} built with [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli).`}

## Version

${version || '0.1.0'}

## Features

${features.map((f) => `- ${f}`).join('\n')}

## Tech Stack

${frontend ? `- **Frontend:** ${frontend}` : ''}
${backend ? `- **Backend:** ${backend}` : ''}
${database ? `- **Database:** ${database}` : ''}

## Getting Started

### Prerequisites

${getPrerequisites(frontend, backend)}

### Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd ${name}

# Install dependencies
${getInstallCommand(frontend, backend)}
\`\`\`

### Development

\`\`\`bash
${getDevCommand(frontend, backend)}
\`\`\`

### Building

\`\`\`bash
${getBuildCommand(frontend, backend)}
\`\`\`

## Project Structure

${getProjectStructure(frontend, backend, type)}

## Testing

\`\`\`bash
${getTestCommand(frontend, backend)}
\`\`\`

## Deployment

${getDeploymentDocs(frontend, backend)}

## Configuration

Environment variables are managed through \`.env\` files:

\`\`\`
${getEnvTemplate(frontend, backend)}
\`\`\`

## License

${license || 'MIT'}

${author ? `## Author

${author}` : ''}

---

Generated with ❤️ by [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli)
`;

  return {
    path: 'README.md',
    content,
  };
}

/**
 * Generate architecture documentation with diagrams
 */
function generateArchitectureDocs(config: ProjectDocsConfig): { path: string; content: string } {
  const { name, frontend, backend, database } = config;

  const content = `# Architecture Documentation

## Overview

${name} is built using a ${frontend ? `${frontend} + ${backend}` : backend || frontend} architecture${database ? ` with ${database} for data persistence` : ''}.

## Architecture Diagram

\`\`\`mermaid
${generateMermaidDiagram(frontend, backend, database)}
\`\`\`

## Component Architecture

${frontend ? `### Frontend Architecture

\`\`\`mermaid
graph TD
    A[User] --> B[UI Components]
    B --> C[State Management]
    C --> D[API Client]
    D --> E[Backend API]
    B --> F[Routing]
    F --> G[Pages]
    G --> H[Components]
\`\`\`

### Frontend Layers

1. **Presentation Layer**: React/Vue/Angular components
2. **State Layer**: Application state management
3. **Service Layer**: API communication
4. **Router Layer**: Navigation handling
` : ''}

${backend ? `### Backend Architecture

\`\`\`mermaid
graph TD
    A[Client] --> B[API Gateway / Controller]
    B --> C[Service Layer]
    C --> D[Business Logic]
    C --> E[Data Access Layer]
    E --> F[Database]
    B --> G[Middleware]
    G --> H[Authentication]
    G --> I[Logging]
    G --> J[Error Handling]
\`\`\`

### Backend Layers

1. **Controller Layer**: HTTP request handling
2. **Service Layer**: Business logic
3. **Repository Layer**: Data access
4. **Middleware**: Cross-cutting concerns
` : ''}

${database ? `### Database Architecture

\`\`\`mermaid
graph TD
    A[Application] --> B[ORM / Query Builder]
    B --> C[Connection Pool]
    C --> D[Database Server]
    D --> E[Data Files]
    D --> F[WAL / Transaction Log]
\`\`\`
` : ''}

## Data Flow

\`\`\`mermaid
sequenceDiagram
    participant User
    ${frontend ? `participant Frontend` : ''}
    ${backend ? `participant API` : ''}
    ${database ? `participant DB` : ''}

${frontend ? `    User->>Frontend: User Action
    Frontend->>Frontend: Process Event
    Frontend->>Frontend: Update State
` : ''}${frontend && backend ? `    Frontend->>API: API Request
` : ''}${backend ? `    API->>API: Validate Request
    API->>API: Process Business Logic
` : ''}${database && backend ? `    API->>DB: Query
` : ''}${database ? `    DB->>DB: Execute Query
    DB->>DB: Return Results
` : ''}${database && backend ? `    API->>API: Transform Response
` : ''}${backend && frontend ? `    API->>Frontend: API Response
` : ''}${frontend ? `    Frontend->>User: Update UI
` : ''}    User->>User: View Result
\`\`\`

## Deployment Architecture

\`\`\`mermaid
graph LR
    A[Users] --> B[CDN / Load Balancer]
    B --> C${frontend ? '[Frontend Servers]' : ''}
    B --> D${backend ? '[Backend Servers]' : ''}
    D --> E${database ? '[Database Cluster]' : ''}
\`\`\`

## Technology Choices

${generateTechRationale(frontend, backend, database)}
`;

  return {
    path: 'docs/ARCHITECTURE.md',
    content,
  };
}

/**
 * Generate Mermaid architecture diagram
 */
function generateMermaidDiagram(frontend?: string, backend?: string, database?: string): string {
  if (frontend && backend) {
    const dbName = database === 'prisma' ? 'PostgreSQL' : database === 'mongoose' ? 'MongoDB' : database || 'Database';
    return `graph TD
    Users[Users] --> Frontend[${frontend} SPA]
    Frontend -->|HTTP/REST| API[${backend} API]
    API -->|Query| DB[${dbName}]
    API -->|Mutate| DB

    style Frontend fill:#61dafb
    style API fill:#4caf50
    style DB fill:#ff9800`;
  } else if (backend) {
    return `graph TD
    Client[Clients] --> API[${backend} Server]
    ${database ? `API --> DB[${database}]` : ''}

    style API fill:#4caf50
    ${database ? 'style DB fill:#ff9800' : ''}`;
  } else if (frontend) {
    return `graph TD
    Users[Users] --> SPA[${frontend} App]

    style SPA fill:#61dafb`;
  }

  return `graph TD
    App[Application]`;
}

/**
 * Generate API documentation
 */
function generateApiDocs(config: ProjectDocsConfig): { path: string; content: string } {
  const { name, backend } = config;

  const content = `# API Documentation

## Base URL

\`\`\`
http://localhost:3000/api
\`\`\`

## Authentication

${backend?.toLowerCase().includes('express') || backend?.toLowerCase().includes('nest') ? `### Bearer Token Authentication

Include your JWT token in the Authorization header:

\`\`\`http
Authorization: Bearer <your-token>
\`\`\`
` : ''}

## Endpoints

### Health Check

\`\`\`http
GET /health
\`\`\`

Check API health status.

**Response:**
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`

### API Routes

\`\`\`http
GET    /api/resources    List all resources
POST   /api/resources    Create a new resource
GET    /api/resources/:id  Get a specific resource
PUT    /api/resources/:id  Update a resource
DELETE /api/resources/:id  Delete a resource
\`\`\`

### Resource Schema

\`\`\`typescript
interface Resource {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
\`\`\`

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

\`\`\`json
{
  "error": "Bad Request",
  "message": "Invalid input data",
  "statusCode": 400
}
\`\`\`

### 401 Unauthorized

\`\`\`json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "statusCode": 401
}
\`\`\`

### 404 Not Found

\`\`\`json
{
  "error": "Not Found",
  "message": "Resource not found",
  "statusCode": 404
}
\`\`\`

### 500 Internal Server Error

\`\`\`json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "statusCode": 500
}
\`\`\`

## Rate Limiting

API requests are rate limited to 100 requests per minute per IP address.

When the rate limit is exceeded, the API returns a \`429 Too Many Requests\` response.
`;

  return {
    path: 'docs/API.md',
    content,
  };
}

/**
 * Generate contributing guide
 */
function generateContributingGuide(config: ProjectDocsConfig): { path: string; content: string } {
  const { frontend, backend } = config;

  const content = `# Contributing to ${config.name}

Thank you for your interest in contributing! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: \`git clone https://github.com/your-username/${config.name}.git\`
3. Navigate to the project directory: \`cd ${config.name}\`
4. Install dependencies: \`npm install\` (or equivalent)

## Development Workflow

1. Create a new branch: \`git checkout -b feature/your-feature-name\`
2. Make your changes
3. Commit your changes: \`git commit -m "Add some feature"\`
4. Push to the branch: \`git push origin feature/your-feature-name\`
5. Open a Pull Request

## Code Style

Please follow the existing code style:

${frontend ? `- Use ESLint for linting: \`npm run lint\`
- Format code with Prettier: \`npm run format\`
` : ''}${backend ? `- Follow the language's best practices
- Write unit tests for new features
- Update documentation as needed
` : ''}

## Testing

Before submitting a PR, please:

1. Run linter: \`npm run lint\`
2. Run tests: \`npm test\`
3. Ensure all tests pass

## Pull Request Guidelines

- Title should clearly describe the change
- Reference any related issues
- Include description of changes
- Add screenshots for UI changes if applicable

## Reporting Issues

When reporting issues, please include:

- Environment details (OS, browser/runtime version)
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the ${config.license || 'MIT'} License.
`;

  return {
    path: 'CONTRIBUTING.md',
    content,
  };
}

/**
 * Generate changelog
 */
function generateChangelog(config: ProjectDocsConfig): string {
  return `# Changelog

All notable changes to ${config.name} will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A
`;
}

/**
 * Helper functions for documentation generation
 */
function getPrerequisites(frontend?: string, backend?: string): string {
  const prereqs = [];
  if (frontend) {
    prereqs.push('- Node.js 18+ and npm/yarn/pnpm');
  }
  if (backend?.toLowerCase().includes('python')) {
    prereqs.push('- Python 3.11+ and pip');
  }
  if (backend?.toLowerCase().includes('go')) {
    prereqs.push('- Go 1.21+');
  }
  if (backend?.toLowerCase().includes('rust')) {
    prereqs.push('- Rust stable and cargo');
  }
  if (backend?.toLowerCase().includes('java')) {
    prereqs.push('- JDK 17+ and Maven/Gradle');
  }
  if (backend?.toLowerCase().includes('dotnet')) {
    prereqs.push('- .NET 8+ SDK');
  }
  return prereqs.join('\n') || '- Node.js 18+';
}

function getInstallCommand(frontend?: string, backend?: string): string {
  if (frontend || backend?.toLowerCase().includes('express') || backend?.toLowerCase().includes('nest')) {
    return 'npm install';
  }
  if (backend?.toLowerCase().includes('python')) {
    return 'pip install -r requirements.txt';
  }
  if (backend?.toLowerCase().includes('go')) {
    return 'go mod download';
  }
  return 'npm install';
}

function getDevCommand(frontend?: string, backend?: string): string {
  if (frontend || backend?.toLowerCase().includes('express') || backend?.toLowerCase().includes('nest')) {
    return 'npm run dev';
  }
  if (backend?.toLowerCase().includes('python')) {
    return 'python -m app.main';
  }
  if (backend?.toLowerCase().includes('go')) {
    return 'go run main.go';
  }
  return 'npm run dev';
}

function getBuildCommand(frontend?: string, backend?: string): string {
  if (frontend || backend?.toLowerCase().includes('express') || backend?.toLowerCase().includes('nest')) {
    return 'npm run build';
  }
  if (backend?.toLowerCase().includes('python')) {
    return '# No build step required for Python';
  }
  if (backend?.toLowerCase().includes('go')) {
    return 'go build -o app';
  }
  return 'npm run build';
}

function getTestCommand(frontend?: string, backend?: string): string {
  return 'npm test';
}

function getProjectStructure(frontend?: string, backend?: string, type?: string): string {
  if (type === 'app') {
    return `\`\`\`
${name}/
├── src/              # Source code
├── public/           # Static assets
├── tests/            # Test files
├── docs/             # Documentation
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore rules
└── package.json      # Project dependencies
\`\`\``;
  }
  return 'See project folder for structure.';
}

function getDeploymentDocs(frontend?: string, backend?: string): string {
  if (frontend && !backend) {
    return `### Vercel Deployment

\`\`\`bash
npm i -g vercel
vercel
\`\`\`

### Netlify Deployment

\`\`\`bash
npm run build
netlify deploy --prod
\`\`\``;
  }
  return `### Docker Deployment

\`\`\`bash
docker build -t app .
docker run -p 3000:3000 app
\`\`\``;
}

function getEnvTemplate(frontend?: string, backend?: string): string {
  const lines = [];
  if (frontend) {
    lines.push('VITE_API_URL=http://localhost:3000/api');
  }
  if (backend) {
    lines.push('PORT=3000');
    lines.push('NODE_ENV=development');
    lines.push('DATABASE_URL=postgresql://user:pass@localhost:5432/dbname');
    lines.push('JWT_SECRET=your-secret-key');
  }
  return lines.join('\n') || 'NODE_ENV=development';
}

function generateTechRationale(frontend?: string, backend?: string, database?: string): string {
  let rationale = '';

  if (frontend) {
    rationale += `### ${frontend}

Chosen for its ${frontend === 'react' ? 'component-based architecture' : ''} and strong ecosystem.

**Benefits:**
- Large community and ecosystem
- Extensive documentation
- Wide adoption and hiring pool
`;
  }

  if (backend) {
    rationale += `### ${backend}

Selected for its performance and developer experience.

**Benefits:**
- Fast development cycle
- Easy to deploy and scale
- Great documentation
`;
  }

  if (database) {
    rationale += `### ${database}

Chosen for data persistence and querying capabilities.

**Benefits:**
- Reliable data storage
- ACID compliance
- Strong querying capabilities
`;
  }

  return rationale;
}

// ============================================================================
// PROJECT HEALTH CHECK & CONFIGURATION VALIDATION
// ============================================================================

/**
 * Health check result for a specific aspect
 */
export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  details?: string;
  suggestion?: string;
}

/**
 * Complete health check report
 */
export interface HealthCheckReport {
  overallStatus: 'healthy' | 'warning' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: string;
  projectPath: string;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  field: string;
  message: string;
  severity: 'critical' | 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  field: string;
  message: string;
  severity: 'warn' | 'info';
}

/**
 * Validation suggestion
 */
export interface ValidationSuggestion {
  category: string;
  message: string;
  action?: string;
}

/**
 * Project configuration for validation
 */
export interface ProjectConfig {
  name: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  frontend?: string;
  backend?: string;
  database?: string;
  packageManager: string;
  port?: string;
  hasDocker?: boolean;
  hasCI?: boolean;
}

/**
 * Validate project configuration before creation
 */
export function validateProjectConfig(config: ProjectConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  // Validate project name
  if (!config.name || config.name.trim().length === 0) {
    errors.push({
      path: 'config',
      field: 'name',
      message: 'Project name is required',
      severity: 'critical',
    });
  } else {
    // Name format validation
    const nameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!nameRegex.test(config.name)) {
      errors.push({
        path: 'config',
        field: 'name',
        message: 'Project name must be lowercase alphanumeric with hyphens, cannot start or end with hyphen',
        severity: 'error',
      });
    }

    // Reserved names
    const reservedNames = ['test', 'lib', 'bin', 'docs', 'build', 'dist', 'node_modules'];
    if (reservedNames.includes(config.name)) {
      errors.push({
        path: 'config',
        field: 'name',
        message: `'${config.name}' is a reserved name and cannot be used`,
        severity: 'error',
      });
    }
  }

  // Validate framework compatibility
  if (config.frontend && config.backend) {
    const compatibility = validateFrameworkCompatibility(config.frontend, config.backend);
    if (!compatibility.valid || compatibility.compatibility === 'incompatible') {
      errors.push({
        path: 'config',
        field: 'frontend/backend',
        message: `Incompatible framework combination: ${compatibility.warnings.join('; ')}`,
        severity: 'error',
      });
    } else if (compatibility.compatibility === 'poor') {
      warnings.push({
        path: 'config',
        field: 'frontend/backend',
        message: `Poor framework compatibility: ${compatibility.suggestions.join('; ')}`,
        severity: 'warn',
      });
    }
  }

  // Validate database compatibility
  if (config.database && config.database !== 'none') {
    if (config.backend === 'spring-boot' && config.database === 'mongoose') {
      warnings.push({
        path: 'config',
        field: 'database',
        message: 'Mongoose (MongoDB) is not commonly used with Spring Boot; consider JDBC-based database',
        severity: 'warn',
      });
    }

    if (config.database === 'prisma' && config.backend && !['express', 'fastify', 'nestjs', 'next'].includes(config.backend)) {
      warnings.push({
        path: 'config',
        field: 'database',
        message: 'Prisma works best with Node.js/TypeScript backends',
        severity: 'warn',
      });
    }
  }

  // Port validation
  if (config.port) {
    const portNum = parseInt(config.port, 10);
    if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      errors.push({
        path: 'config',
        field: 'port',
        message: 'Port must be a number between 1024 and 65535',
        severity: 'error',
      });
    }
  }

  // Suggestions for improvements
  if (!config.hasDocker && (config.backend || config.database)) {
    suggestions.push({
      category: 'deployment',
      message: 'Consider adding Docker for easier deployment',
      action: 'Use --docker flag to add Docker configuration',
    });
  }

  if (!config.hasCI && (config.frontend || config.backend)) {
    suggestions.push({
      category: 'quality',
      message: 'Consider adding CI/CD pipeline for automated testing',
      action: 'Use --ci flag to add CI/CD configuration',
    });
  }

  if (config.type === 'app' && !config.frontend && !config.backend) {
    suggestions.push({
      category: 'framework',
      message: 'Application type with no framework selected',
      action: 'Add --frontend or --backend to specify a framework',
    });
  }

  return {
    isValid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Perform health check on a created project
 */
export async function performProjectHealthCheck(projectPath: string, config?: Partial<ProjectConfig>): Promise<HealthCheckReport> {
  const checks: HealthCheckResult[] = [];
  const timestamp = new Date().toISOString();

  // 1. Check project structure
  checks.push(await checkProjectStructure(projectPath));

  // 2. Check package.json if exists
  const hasPackageJson = await fileExists(path.join(projectPath, 'package.json'));
  if (hasPackageJson) {
    checks.push(await checkPackageJson(projectPath));
  }

  // 3. Check TypeScript configuration
  const hasTsConfig = await fileExists(path.join(projectPath, 'tsconfig.json'));
  if (hasTsConfig) {
    checks.push(await checkTypeScriptConfig(projectPath));
  }

  // 4. Check Docker configuration
  const hasDockerfile = await fileExists(path.join(projectPath, 'Dockerfile'));
  const hasDockerCompose = await fileExists(path.join(projectPath, 'docker-compose.yml'));
  if (hasDockerfile || hasDockerCompose) {
    checks.push(await checkDockerConfig(projectPath, hasDockerfile, hasDockerCompose));
  }

  // 5. Check CI/CD configuration
  checks.push(await checkCIConfig(projectPath));

  // 6. Check documentation
  checks.push(await checkDocumentation(projectPath));

  // 7. Check for .env configuration
  checks.push(await checkEnvConfig(projectPath));

  // 8. Check source structure
  checks.push(await checkSourceStructure(projectPath, config));

  // 9. Check for linting/formatting config
  checks.push(await checkLintingConfig(projectPath));

  // Calculate overall status
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  let overallStatus: 'healthy' | 'warning' | 'unhealthy';
  if (failCount > 0) {
    overallStatus = 'unhealthy';
  } else if (warnCount > 0) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'healthy';
  }

  return {
    overallStatus,
    checks,
    timestamp,
    projectPath,
  };
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check project structure
 */
async function checkProjectStructure(projectPath: string): Promise<HealthCheckResult> {
  const requiredDirs = ['src'];
  const missingDirs: string[] = [];

  for (const dir of requiredDirs) {
    const dirPath = path.join(projectPath, dir);
    if (!(await fileExists(dirPath))) {
      missingDirs.push(dir);
    }
  }

  if (missingDirs.length > 0) {
    return {
      name: 'Project Structure',
      status: 'fail',
      message: 'Missing required directories',
      details: `Missing: ${missingDirs.join(', ')}`,
      suggestion: 'Create missing directories: mkdir -p src',
    };
  }

  return {
    name: 'Project Structure',
    status: 'pass',
    message: 'All required directories present',
  };
}

/**
 * Check package.json
 */
async function checkPackageJson(projectPath: string): Promise<HealthCheckResult> {
  const pkgPath = path.join(projectPath, 'package.json');

  try {
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    const issues: string[] = [];

    // Check required fields
    if (!pkg.name) {
      issues.push('Missing "name" field');
    }
    if (!pkg.version) {
      issues.push('Missing "version" field');
    }

    // Check scripts
    if (!pkg.scripts || Object.keys(pkg.scripts).length === 0) {
      issues.push('No scripts defined');
    } else {
      const recommendedScripts = ['dev', 'build', 'test'];
      const missingScripts = recommendedScripts.filter(s => !pkg.scripts[s]);
      if (missingScripts.length > 0) {
        issues.push(`Missing recommended scripts: ${missingScripts.join(', ')}`);
      }
    }

    // Check for dependencies
    if (!pkg.dependencies && !pkg.devDependencies) {
      issues.push('No dependencies defined');
    }

    if (issues.length > 0) {
      return {
        name: 'package.json',
        status: 'warn',
        message: 'Issues found in package.json',
        details: issues.join('; '),
      };
    }

    return {
      name: 'package.json',
      status: 'pass',
      message: 'package.json is valid',
    };
  } catch (error) {
    return {
      name: 'package.json',
      status: 'fail',
      message: 'Failed to parse package.json',
      details: String(error),
      suggestion: 'Ensure package.json is valid JSON',
    };
  }
}

/**
 * Check TypeScript configuration
 */
async function checkTypeScriptConfig(projectPath: string): Promise<HealthCheckResult> {
  const tsConfigPath = path.join(projectPath, 'tsconfig.json');

  try {
    const tsConfigContent = await fs.readFile(tsConfigPath, 'utf-8');
    const tsConfig = JSON.parse(tsConfigContent);

    const issues: string[] = [];

    // Check for strict mode
    if (!tsConfig.compilerOptions?.strict) {
      issues.push('Strict mode not enabled (recommended for type safety)');
    }

    // Check for ESNext target
    if (!tsConfig.compilerOptions?.target) {
      issues.push('No target specified (defaults to ES3)');
    }

    // Check for module resolution
    if (!tsConfig.compilerOptions?.moduleResolution) {
      issues.push('No moduleResolution specified (defaults to Classic)');
    }

    if (issues.length > 0) {
      return {
        name: 'TypeScript Config',
        status: 'warn',
        message: 'TypeScript configuration could be improved',
        details: issues.join('; '),
        suggestion: 'Enable strict mode and set modern target/moduleResolution',
      };
    }

    return {
      name: 'TypeScript Config',
      status: 'pass',
      message: 'TypeScript configuration is valid',
    };
  } catch (error) {
    return {
      name: 'TypeScript Config',
      status: 'fail',
      message: 'Failed to parse tsconfig.json',
      details: String(error),
      suggestion: 'Ensure tsconfig.json is valid JSON',
    };
  }
}

/**
 * Check Docker configuration
 */
async function checkDockerConfig(projectPath: string, hasDockerfile: boolean, hasDockerCompose: boolean): Promise<HealthCheckResult> {
  const issues: string[] = [];

  if (hasDockerfile) {
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    try {
      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf-8');

      // Check for multi-stage build
      if (!dockerfileContent.includes('FROM') || dockerfileContent.split('FROM').length <= 1) {
        issues.push('Consider using multi-stage builds for smaller images');
      }

      // Check for .dockerignore
      const hasDockerignore = await fileExists(path.join(projectPath, '.dockerignore'));
      if (!hasDockerignore) {
        issues.push('Missing .dockerignore file');
      }

      // Check for non-root user
      if (!dockerfileContent.includes('USER') && !dockerfileContent.includes('--user')) {
        issues.push('Container runs as root (security risk)');
      }
    } catch {
      issues.push('Could not read Dockerfile');
    }
  }

  if (hasDockerCompose) {
    const composePath = path.join(projectPath, 'docker-compose.yml');
    try {
      const composeContent = await fs.readFile(composePath, 'utf-8');

      // Check for volume mounts
      if (!composeContent.includes('volumes:')) {
        issues.push('No volumes defined (data will be lost on container removal)');
      }

      // Check for healthcheck
      if (!composeContent.includes('healthcheck')) {
        issues.push('No healthcheck defined');
      }
    } catch {
      issues.push('Could not read docker-compose.yml');
    }
  }

  if (issues.length > 0) {
    return {
      name: 'Docker Configuration',
      status: 'warn',
      message: 'Docker configuration could be improved',
      details: issues.join('; '),
    };
  }

  return {
    name: 'Docker Configuration',
    status: 'pass',
    message: 'Docker configuration is present',
  };
}

/**
 * Check CI/CD configuration
 */
async function checkCIConfig(projectPath: string): Promise<HealthCheckResult> {
  const ciFiles = [
    '.github/workflows/ci.yml',
    '.github/workflows/cd.yml',
    '.github/workflows/test.yml',
    '.gitlab-ci.yml',
    'azure-pipelines.yml',
    '.circleci/config.yml',
  ];

  const foundCI: string[] = [];
  for (const ciFile of ciFiles) {
    if (await fileExists(path.join(projectPath, ciFile))) {
      foundCI.push(ciFile);
    }
  }

  if (foundCI.length === 0) {
    return {
      name: 'CI/CD Configuration',
      status: 'skip',
      message: 'No CI/CD configuration found',
      suggestion: 'Consider adding GitHub Actions or GitLab CI for automated testing',
    };
  }

  return {
    name: 'CI/CD Configuration',
    status: 'pass',
    message: `CI/CD configured: ${foundCI.join(', ')}`,
  };
}

/**
 * Check documentation
 */
async function checkDocumentation(projectPath: string): Promise<HealthCheckResult> {
  const docFiles = [
    'README.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'docs/ARCHITECTURE.md',
    'docs/API.md',
  ];

  const foundDocs: string[] = [];
  const missingDocs: string[] = [];

  for (const docFile of docFiles) {
    if (await fileExists(path.join(projectPath, docFile))) {
      foundDocs.push(docFile);
    } else {
      missingDocs.push(docFile);
    }
  }

  if (!foundDocs.includes('README.md')) {
    return {
      name: 'Documentation',
      status: 'fail',
      message: 'Missing README.md',
      suggestion: 'Create a README.md with project information',
    };
  }

  if (missingDocs.length > 2) {
    return {
      name: 'Documentation',
      status: 'warn',
      message: 'Some documentation missing',
      details: `Missing: ${missingDocs.join(', ')}`,
    };
  }

  return {
    name: 'Documentation',
    status: 'pass',
    message: `Documentation present: ${foundDocs.join(', ')}`,
  };
}

/**
 * Check environment configuration
 */
async function checkEnvConfig(projectPath: string): Promise<HealthCheckResult> {
  const envFiles = ['.env', '.env.example', '.env.local'];

  const hasEnv = await fileExists(path.join(projectPath, '.env'));
  const hasEnvExample = await fileExists(path.join(projectPath, '.env.example'));
  const hasGitignore = await fileExists(path.join(projectPath, '.gitignore'));

  const issues: string[] = [];

  if (!hasEnvExample && hasEnv) {
    issues.push('Missing .env.example (add a template for environment variables)');
  }

  if (hasEnv && hasGitignore) {
    const gitignoreContent = await fs.readFile(path.join(projectPath, '.gitignore'), 'utf-8');
    if (!gitignoreContent.includes('.env')) {
      issues.push('.env not in .gitignore (security risk)');
    }
  }

  if (issues.length > 0) {
    return {
      name: 'Environment Configuration',
      status: 'warn',
      message: 'Environment configuration issues',
      details: issues.join('; '),
    };
  }

  if (hasEnvExample) {
    return {
      name: 'Environment Configuration',
      status: 'pass',
      message: 'Environment configuration is properly set up',
    };
  }

  return {
    name: 'Environment Configuration',
    status: 'skip',
    message: 'No environment configuration found',
  };
}

/**
 * Check source structure
 */
async function checkSourceStructure(projectPath: string, config?: Partial<ProjectConfig>): Promise<HealthCheckResult> {
  const srcPath = path.join(projectPath, 'src');

  if (!(await fileExists(srcPath))) {
    return {
      name: 'Source Structure',
      status: 'skip',
      message: 'No src directory found',
    };
  }

  const srcEntries = await fs.readdir(srcPath).catch(() => []);
  const hasFiles = srcEntries.length > 0;

  if (!hasFiles) {
    return {
      name: 'Source Structure',
      status: 'warn',
      message: 'src directory is empty',
      suggestion: 'Add source files to src directory',
    };
  }

  // Check for common patterns
  const entryCandidates = [
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
    'main.ts',
    'main.tsx',
    'main.js',
    'main.jsx',
  ];
  const hasIndex = entryCandidates.some(entry => srcEntries.includes(entry));

  if (!hasIndex) {
    return {
      name: 'Source Structure',
      status: 'warn',
      message: 'No entry point file found (index.ts[x], main.ts[x], etc.)',
      suggestion: 'Create an entry point file',
    };
  }

  return {
    name: 'Source Structure',
    status: 'pass',
    message: 'Source structure looks good',
  };
}

/**
 * Check linting configuration
 */
async function checkLintingConfig(projectPath: string): Promise<HealthCheckResult> {
  const lintingFiles = [
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc.yml',
    'eslint.config.js',
    '.prettierrc',
    '.prettierrc.json',
    'pyproject.toml',
    '.golangci.yml',
    'clippy.toml',
    'rustfmt.toml',
  ];

  const foundLinting: string[] = [];
  for (const lintFile of lintingFiles) {
    if (await fileExists(path.join(projectPath, lintFile))) {
      foundLinting.push(lintFile);
    }
  }

  if (foundLinting.length === 0) {
    return {
      name: 'Linting Configuration',
      status: 'warn',
      message: 'No linting/formatting configuration found',
      suggestion: 'Add ESLint, Prettier, or language-specific linter',
    };
  }

  return {
    name: 'Linting Configuration',
    status: 'pass',
    message: `Linting configured: ${foundLinting.join(', ')}`,
  };
}

/**
 * Format health check report for display
 */
export function formatHealthCheckReport(report: HealthCheckReport): string {
  const lines: string[] = [];

  lines.push(`\n${'='.repeat(50)}`);
  lines.push(`Project Health Check Report`);
  lines.push(`Project: ${report.projectPath}`);
  lines.push(`Status: ${formatStatus(report.overallStatus)}`);
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`${'='.repeat(50)}\n`);

  for (const check of report.checks) {
    const icon = getStatusIcon(check.status);
    lines.push(`${icon} ${check.name}: ${check.message}`);

    if (check.details) {
      lines.push(`  Details: ${check.details}`);
    }

    if (check.suggestion) {
      lines.push(`  💡 ${check.suggestion}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatStatus(status: 'healthy' | 'warning' | 'unhealthy'): string {
  switch (status) {
    case 'healthy':
      return '✅ Healthy';
    case 'warning':
      return '⚠️ Warning';
    case 'unhealthy':
      return '❌ Unhealthy';
  }
}

function getStatusIcon(status: 'pass' | 'warn' | 'fail' | 'skip'): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'warn':
      return '⚠️';
    case 'fail':
      return '❌';
    case 'skip':
      return '⊘';
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('\n❌ Validation Errors:');
    for (const error of result.errors) {
      lines.push(`  [${error.severity.toUpperCase()}] ${error.field}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('\n⚠️ Validation Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  [${warning.severity.toUpperCase()}] ${warning.field}: ${warning.message}`);
    }
  }

  if (result.suggestions.length > 0) {
    lines.push('\n💡 Suggestions:');
    for (const suggestion of result.suggestions) {
      lines.push(`  [${suggestion.category}] ${suggestion.message}`);
      if (suggestion.action) {
        lines.push(`    → ${suggestion.action}`);
      }
    }
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('\n✅ Configuration is valid!');
  }

  return lines.join('\n');
}
