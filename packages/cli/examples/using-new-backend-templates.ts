import { Command } from 'commander';
import { createProject } from '../src/commands/create';
import { listBackendTemplates } from '../src/templates/backend';

/**
 * Example: Using Re-Shell CLI to create projects with new backend templates
 */

// Example 1: List all available backend templates
console.log('📋 Available Backend Templates:');
console.log('==============================\n');

const templates = listBackendTemplates();
templates.forEach((template, index) => {
  console.log(`${index + 1}. ${template.displayName} (${template.id})`);
  console.log(`   Language: ${template.language}`);
  console.log(`   Description: ${template.description}`);
  console.log(`   Features: ${template.features.join(', ')}`);
  console.log('');
});

console.log(`Total: ${templates.length} backend templates available\n`);

// Example 2: Create projects with different templates
const exampleProjects = [
  {
    name: 'my-express-api',
    template: 'express',
    description: 'Classic Express.js API with TypeScript, JWT auth, and Prisma ORM'
  },
  {
    name: 'my-fastify-service',
    template: 'fastify',
    description: 'High-performance Fastify service with 35,000 req/sec capability'
  },
  {
    name: 'my-nest-microservice',
    template: 'nestjs',
    description: 'Enterprise NestJS microservice with DI, GraphQL, and CQRS'
  },
  {
    name: 'my-realtime-app',
    template: 'feathersjs',
    description: 'Real-time application with Feathers.js and Socket.io'
  },
  {
    name: 'my-microservices',
    template: 'moleculer',
    description: 'Moleculer microservices with service discovery and fault tolerance'
  },
  {
    name: 'my-cms',
    template: 'strapi',
    description: 'Headless CMS with Strapi admin panel and content types'
  },
  {
    name: 'my-graphql-api',
    template: 'apollo-server',
    description: 'GraphQL API with Apollo Server, subscriptions, and DataLoader'
  },
  {
    name: 'my-fastapi-backend',
    template: 'fastapi',
    description: 'Modern Python API with FastAPI, async support, and auto-docs'
  }
];

console.log('🚀 Example Project Creation Commands:');
console.log('=====================================\n');

exampleProjects.forEach(project => {
  console.log(`# ${project.description}`);
  console.log(`re-shell create ${project.name} --template ${project.template}\n`);
});

// Example 3: Advanced microservices architecture
console.log('🏗️  Microservices Architecture Example:');
console.log('======================================\n');

const microservices = [
  { name: 'api-gateway', template: 'express', role: 'API Gateway with auth middleware' },
  { name: 'auth-service', template: 'fastapi', role: 'Authentication & authorization service' },
  { name: 'user-service', template: 'nestjs', role: 'User management with CRUD operations' },
  { name: 'notification-service', template: 'moleculer', role: 'Email/SMS notification service' },
  { name: 'realtime-service', template: 'feathersjs', role: 'WebSocket real-time updates' },
  { name: 'analytics-service', template: 'fastapi', role: 'Data analytics and reporting' },
  { name: 'file-service', template: 'fastify', role: 'File upload and storage service' }
];

microservices.forEach(service => {
  console.log(`# ${service.role}`);
  console.log(`re-shell create ${service.name} --template ${service.template}`);
});

// Example 4: Template features comparison
console.log('\n📊 Template Features Comparison:');
console.log('================================\n');

const featureComparison = [
  {
    category: 'Performance',
    templates: [
      { name: 'Hyper-Express', rating: '⭐⭐⭐⭐⭐', note: '100k+ req/sec' },
      { name: 'Fastify', rating: '⭐⭐⭐⭐⭐', note: '35k req/sec' },
      { name: 'Polka', rating: '⭐⭐⭐⭐⭐', note: '5x faster than Express' },
      { name: 'Express', rating: '⭐⭐⭐', note: 'Baseline performance' }
    ]
  },
  {
    category: 'Real-time',
    templates: [
      { name: 'Feathers.js', rating: '⭐⭐⭐⭐⭐', note: 'Built-in Socket.io' },
      { name: 'Meteor.js', rating: '⭐⭐⭐⭐⭐', note: 'DDP protocol' },
      { name: 'ActionHero', rating: '⭐⭐⭐⭐', note: 'Multi-transport' },
      { name: 'NestJS', rating: '⭐⭐⭐⭐', note: 'WebSocket gateway' }
    ]
  },
  {
    category: 'Enterprise',
    templates: [
      { name: 'NestJS', rating: '⭐⭐⭐⭐⭐', note: 'Full enterprise stack' },
      { name: 'AdonisJS', rating: '⭐⭐⭐⭐⭐', note: 'Laravel-like for Node' },
      { name: 'Egg.js', rating: '⭐⭐⭐⭐⭐', note: 'Enterprise framework' },
      { name: 'Spring Boot', rating: '⭐⭐⭐⭐⭐', note: 'Java enterprise' }
    ]
  }
];

featureComparison.forEach(category => {
  console.log(`${category.category}:`);
  category.templates.forEach(template => {
    console.log(`  - ${template.name}: ${template.rating} (${template.note})`);
  });
  console.log('');
});

// Example 5: Quick start guide
console.log('🎯 Quick Start Guide:');
console.log('====================\n');

console.log(`
1. Install Re-Shell CLI globally:
   npm install -g @re-shell/cli

2. Create a new project:
   re-shell create my-api --template fastify

3. Navigate to project:
   cd my-api

4. Install dependencies:
   npm install

5. Start development server:
   npm run dev

6. Your API is ready at:
   http://localhost:3000
`);

// Example 6: Docker usage
console.log('🐳 Docker Support:');
console.log('==================\n');

console.log(`
All templates include Docker support:

# Build and run with Docker Compose
docker-compose up

# Build production image
docker build -t my-api .

# Run production container
docker run -p 3000:3000 my-api
`);

// Example 7: Template-specific features
console.log('✨ Template-Specific Features:');
console.log('==============================\n');

const templateFeatures = {
  'nestjs': [
    'Dependency Injection with decorators',
    'GraphQL with code-first approach',
    'Microservices with message patterns',
    'CQRS and Event Sourcing',
    'OpenAPI documentation'
  ],
  'moleculer': [
    'Service discovery and registry',
    'Built-in caching layers',
    'Circuit breaker pattern',
    'Distributed tracing',
    'Multi-transport support'
  ],
  'strapi': [
    'Admin panel UI',
    'Content-Type Builder',
    'Media library',
    'Role-based permissions',
    'Webhook system'
  ],
  'feathersjs': [
    'Real-time events',
    'Service-oriented architecture',
    'Hook system for middleware',
    'Multiple database adapters',
    'Authentication strategies'
  ]
};

Object.entries(templateFeatures).forEach(([template, features]) => {
  console.log(`${template}:`);
  features.forEach(feature => console.log(`  ✓ ${feature}`));
  console.log('');
});

// Export for use in other scripts
export {
  templates,
  exampleProjects,
  microservices,
  featureComparison,
  templateFeatures
};