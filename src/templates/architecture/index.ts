// Architecture Templates
// Predefined technology stack combinations for quick project scaffolding

export interface ArchitectureTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  frontend?: string;
  backend?: string;
  db?: string;
  features: string[];
  popular: boolean;
}

/**
 * Predefined architecture templates
 */
export const architectureTemplates: Record<string, ArchitectureTemplate> = {
  'mern': {
    id: 'mern',
    name: 'MERN Stack',
    displayName: 'MERN Stack (MongoDB, Express, React, Node)',
    description: 'Full-stack JavaScript with MongoDB, Express, React, and Node.js',
    tags: ['javascript', 'fullstack', 'mern', 'mongodb', 'react'],
    frontend: 'react',
    backend: 'express',
    db: 'mongoose',
    features: ['REST API', 'MongoDB integration', 'React SPA', 'JWT auth'],
    popular: true,
  },

  'mean': {
    id: 'mean',
    name: 'MEAN Stack',
    displayName: 'MEAN Stack (MongoDB, Express, Angular, Node)',
    description: 'Full-stack JavaScript with MongoDB, Express, Angular, and Node.js',
    tags: ['javascript', 'fullstack', 'mean', 'mongodb', 'angular'],
    frontend: 'angular',
    backend: 'express',
    db: 'mongoose',
    features: ['REST API', 'MongoDB integration', 'Angular SPA', 'JWT auth'],
    popular: true,
  },

  'mevn': {
    id: 'mevn',
    name: 'MEVN Stack',
    displayName: 'MEVN Stack (MongoDB, Express, Vue, Node)',
    description: 'Full-stack JavaScript with MongoDB, Express, Vue.js, and Node.js',
    tags: ['javascript', 'fullstack', 'mevn', 'mongodb', 'vue'],
    frontend: 'vue',
    backend: 'express',
    db: 'mongoose',
    features: ['REST API', 'MongoDB integration', 'Vue SPA', 'JWT auth'],
    popular: true,
  },

  'jamstack': {
    id: 'jamstack',
    name: 'JAMstack',
    displayName: 'JAMstack (Next.js + API)',
    description: 'Modern JAMstack architecture with Next.js frontend and API backend',
    tags: ['typescript', 'fullstack', 'jamstack', 'nextjs', 'ssr'],
    frontend: 'next',
    backend: 'fastify',
    db: 'prisma',
    features: ['SSR/SSG', 'API routes', 'Serverless-ready', 'Edge deployment'],
    popular: true,
  },

  'nestjs-react': {
    id: 'nestjs-react',
    name: 'NestJS + React',
    displayName: 'NestJS Backend with React Frontend',
    description: 'Enterprise-grade Node.js backend with modular React frontend',
    tags: ['typescript', 'fullstack', 'nestjs', 'react', 'enterprise'],
    frontend: 'react',
    backend: 'nestjs',
    db: 'typeorm',
    features: ['Modular architecture', 'TypeORM', 'RxJS', 'WebSocket support'],
    popular: true,
  },

  'python-react': {
    id: 'python-react',
    name: 'Python + React',
    displayName: 'FastAPI Backend with React Frontend',
    description: 'Modern Python async backend with React SPA frontend',
    tags: ['python', 'react', 'fastapi', 'fullstack'],
    frontend: 'react',
    backend: 'fastapi',
    db: 'none',
    features: ['Async Python', 'OpenAPI docs', 'CORS', 'Type hints'],
    popular: true,
  },

  'go-react': {
    id: 'go-react',
    name: 'Go + React',
    displayName: 'Go Backend with React Frontend',
    description: 'High-performance Go backend with React SPA',
    tags: ['go', 'react', 'gin', 'fullstack'],
    frontend: 'react',
    backend: 'gin',
    db: 'none',
    features: ['High performance', 'Gin router', 'Hot reload', 'Structured logging'],
    popular: true,
  },

  'rust-react': {
    id: 'rust-react',
    name: 'Rust + React',
    displayName: 'Rust Backend with React Frontend',
    description: 'Memory-safe Rust backend with React SPA',
    tags: ['rust', 'react', 'actix', 'fullstack'],
    frontend: 'react',
    backend: 'actix-web',
    db: 'none',
    features: ['Type safety', 'Performance', 'Async runtime', 'WebAssembly ready'],
    popular: false,
  },

  'spring-angular': {
    id: 'spring-angular',
    name: 'Spring + Angular',
    displayName: 'Spring Boot Backend with Angular Frontend',
    description: 'Enterprise Java stack with Spring Boot and Angular',
    tags: ['java', 'angular', 'spring-boot', 'enterprise', 'fullstack'],
    frontend: 'angular',
    backend: 'spring-boot',
    db: 'none',
    features: ['Enterprise Java', 'Dependency injection', 'RxJS', 'CLI tooling'],
    popular: true,
  },

  'dotnet-blazor': {
    id: 'dotnet-blazor',
    name: '.NET + Blazor',
    displayName: 'ASP.NET Core with Blazor WebAssembly',
    description: 'Full-stack C# with Blazor WebAssembly for browser-based UI',
    tags: ['csharp', 'dotnet', 'blazor', 'fullstack', 'webassembly'],
    frontend: 'react', // Placeholder, Blazor would be its own frontend
    backend: 'aspdotnet',
    db: 'none',
    features: ['C# everywhere', 'WebAssembly', 'Component model', 'Hot reload'],
    popular: false,
  },

  'php-laravel': {
    id: 'php-laravel',
    name: 'PHP Laravel',
    displayName: 'Laravel Backend with Vue Frontend',
    description: 'Elegant PHP framework with Vue.js integration',
    tags: ['php', 'vue', 'laravel', 'fullstack'],
    frontend: 'vue',
    backend: 'laravel',
    db: 'none',
    features: ['Elegant syntax', 'Ecosystem', 'Artisan CLI', 'Blade templates'],
    popular: true,
  },

  'ruby-rails': {
    id: 'ruby-rails',
    name: 'Ruby on Rails',
    displayName: 'Rails Backend with React/Turbo Frontend',
    description: 'Convention-over-configuration framework with Hotwire/Turbo',
    tags: ['ruby', 'react', 'rails', 'fullstack'],
    frontend: 'react',
    backend: 'rails',
    db: 'none',
    features: ['Convention over configuration', 'Scaffolding', 'ActiveRecord', 'Turbo streams'],
    popular: true,
  },

  'elixir-phoenix': {
    id: 'elixir-phoenix',
    name: 'Elixir Phoenix',
    displayName: 'Phoenix Framework with LiveView',
    description: 'Real-time web framework with interactive, real-time UI',
    tags: ['elixir', 'phoenix', 'livewview', 'realtime'],
    frontend: 'react',
    backend: 'phoenix',
    db: 'none',
    features: ['Real-time by default', 'LiveView', 'Channels', 'Fault tolerance'],
    popular: false,
  },

  'microservices': {
    id: 'microservices',
    name: 'Microservices',
    displayName: 'Microservices Architecture',
    description: 'Polyglot microservices with API Gateway',
    tags: ['microservices', 'api-gateway', 'polyglot', 'distributed'],
    frontend: 'react',
    backend: 'express', // API Gateway
    db: 'prisma',
    features: ['API Gateway', 'Service discovery', 'Docker Compose', 'Kubernetes ready'],
    popular: true,
  },

  'serverless': {
    id: 'serverless',
    name: 'Serverless',
    displayName: 'Serverless Architecture',
    description: 'Functions-as-a-Service with cloud deployment',
    tags: ['serverless', 'faas', 'lambda', 'cloud'],
    frontend: 'next',
    backend: 'fastify',
    db: 'prisma',
    features: ['Lambda functions', 'API Gateway', 'Edge deployment', 'Pay-per-use'],
    popular: false,
  },

  'graphql': {
    id: 'graphql',
    name: 'GraphQL API',
    displayName: 'GraphQL Full-Stack',
    description: 'GraphQL API with Apollo Server and React',
    tags: ['graphql', 'apollo', 'react', 'api'],
    frontend: 'react',
    backend: 'apollo-server',
    db: 'prisma',
    features: ['GraphQL schema', 'Apollo Client', 'Subscriptions', 'Code generation'],
    popular: true,
  },

  'websocket-realtime': {
    id: 'websocket-realtime',
    name: 'Real-time',
    displayName: 'Real-time Web Application',
    description: 'WebSocket-based real-time application with React',
    tags: ['websocket', 'realtime', 'socketio', 'react'],
    frontend: 'react',
    backend: 'express',
    db: 'mongoose',
    features: ['Socket.IO', 'Real-time updates', 'Room management', 'Event broadcasting'],
    popular: false,
  },
};

/**
 * Get architecture template by ID
 */
export function getArchitectureTemplate(id: string): ArchitectureTemplate | undefined {
  return architectureTemplates[id];
}

/**
 * Get all architecture templates
 */
export function getAllArchitectureTemplates(): ArchitectureTemplate[] {
  return Object.values(architectureTemplates);
}

/**
 * Get popular architecture templates
 */
export function getPopularArchitectureTemplates(): ArchitectureTemplate[] {
  return getAllArchitectureTemplates().filter((t) => t.popular);
}

/**
 * Get architecture template choices for interactive prompts
 */
export function getArchitectureTemplateChoices() {
  const templates = getAllArchitectureTemplates();

  // Separate popular and all templates
  const popular = templates.filter((t) => t.popular);
  const all = templates;

  return [
    { title: '───── POPULAR STACKS ─────', value: '__sep__popular__', disabled: true },
    ...popular.map((t) => ({
      title: `${t.displayName}`,
      value: t.id,
      description: t.description,
    })),
    { title: '───── ALL ARCHITECTURES ─────', value: '__sep__all__', disabled: true },
    ...all.map((t) => ({
      title: `${t.displayName}`,
      value: t.id,
      description: t.description,
    })),
  ];
}

/**
 * Get architecture choices grouped by category
 */
export function getArchitectureChoicesByCategory() {
  const templates = getAllArchitectureTemplates();

  const categories: Record<string, ArchitectureTemplate[]> = {
    'JavaScript/TypeScript': templates.filter((t) =>
      t.tags.includes('javascript') || t.tags.includes('typescript')
    ),
    'Python': templates.filter((t) => t.tags.includes('python')),
    'Go': templates.filter((t) => t.tags.includes('go')),
    'Java': templates.filter((t) => t.tags.includes('java')),
    '.NET/C#': templates.filter((t) => t.tags.includes('dotnet') || t.tags.includes('csharp')),
    'PHP': templates.filter((t) => t.tags.includes('php')),
    'Ruby': templates.filter((t) => t.tags.includes('ruby')),
    'Rust': templates.filter((t) => t.tags.includes('rust')),
    'Elixir': templates.filter((t) => t.tags.includes('elixir')),
    'Architecture Patterns': templates.filter((t) =>
      t.tags.includes('microservices') || t.tags.includes('serverless') || t.tags.includes('graphql')
    ),
  };

  return categories;
}
