import { BackendTemplate } from '../types';

export const tsedTemplate: BackendTemplate = {
  id: 'tsed',
  name: 'Ts.ED',
  displayName: 'Ts.ED',
  description: 'TypeScript framework built on Express/Koa with decorators, DI, and enterprise features',
  version: '7.0.0',
  language: 'typescript',
  framework: 'tsed',
  tags: ['typescript', 'express', 'decorators', 'di', 'graphql'],
  port: 3000,
  dependencies: {},
  features: ['rest-api', 'microservices', 'swagger', 'graphql', 'websockets', 'authentication', 'database', 'middleware', 'validation', 'testing', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Ts.ED TypeScript application",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tsed/ajv": "^7.87.0",
    "@tsed/common": "^7.87.0",
    "@tsed/core": "^7.87.0",
    "@tsed/di": "^7.87.0",
    "@tsed/exceptions": "^7.87.0",
    "@tsed/platform-express": "^7.87.0",
    "@tsed/schema": "^7.87.0",
    "@tsed/swagger": "^7.87.0",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "reflect-metadata": "^0.2.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.7",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}
`,

    'src/Server.ts': `import cors from 'cors';
import express from 'express';
import { Configuration, Inject } from '@tsed/di';
import { PlatformApplication } from '@tsed/common';
import '@tsed/platform-express'; // registers the Express adapter
import '@tsed/ajv'; // request validation from the @tsed/schema decorators
import '@tsed/swagger'; // OpenAPI documentation at /docs
import { HealthController } from './controllers/HealthController';
import { TodoController } from './controllers/TodoController';

@Configuration({
  port: Number(process.env.PORT) || 3000,
  httpsPort: false,
  acceptMimes: ['application/json'],
  mount: {
    '/api': [HealthController, TodoController]
  },
  swagger: [
    {
      path: '/docs',
      specVersion: '3.0.1'
    }
  ]
})
export class Server {
  @Inject()
  protected app!: PlatformApplication;

  $beforeRoutesInit(): void {
    this.app.use(cors({ origin: '*' })).use(express.json()).use(express.urlencoded({ extended: true }));
  }
}
`,
    'src/index.ts': `import 'reflect-metadata';
import { $log } from '@tsed/common';
import { PlatformExpress } from '@tsed/platform-express';
import { Server } from './Server';

async function bootstrap() {
  try {
    const platform = await PlatformExpress.bootstrap(Server);
    await platform.listen();
    $log.info('Server initialized');
  } catch (error) {
    $log.error({ event: 'SERVER_BOOTSTRAP_ERROR', error });
    process.exit(1);
  }
}

bootstrap();
`,

    'README.md': `# Ts.ED Application

Ts.ED 7 on Express with validation (\`@tsed/ajv\`), OpenAPI docs (\`@tsed/swagger\`) and
dependency injection.

\`\`\`bash
npm install
npm run dev
\`\`\`

Available at http://localhost:3000

| Endpoint | Description |
| --- | --- |
| \`GET /api/health\` | health check |
| \`GET/POST /api/todos\`, \`GET/PUT/DELETE /api/todos/:id\` | in-memory todo CRUD, body validated by \`TodoModel\` |
| \`GET /docs\` | Swagger UI |
`,

    'src/controllers/HealthController.ts': `import { Controller } from '@tsed/di';
import { Get, Returns } from '@tsed/schema';

@Controller('/health')
export class HealthController {
  @Get('/')
  @Returns(200)
  check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }
}
`,

    'src/controllers/TodoController.ts': `import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams } from '@tsed/common';
import { Delete, Description, Get, Post, Put, Returns, Summary } from '@tsed/schema';
import { TodoModel } from '../models/TodoModel';
import { TodoService } from '../services/TodoService';

@Controller('/todos')
export class TodoController {
  @Inject()
  protected todoService!: TodoService;

  @Get('/')
  @Summary('List todos')
  @(Returns(200, Array).Of(TodoModel))
  list(): TodoModel[] {
    return this.todoService.findAll();
  }

  @Get('/:id')
  @Summary('Get a todo')
  @Returns(200, TodoModel)
  @(Returns(404).Description('Todo not found'))
  get(@PathParams('id') id: string): TodoModel {
    return this.todoService.findById(id);
  }

  @Post('/')
  @Summary('Create a todo')
  @Description('The body is validated against the TodoModel schema.')
  @Returns(201, TodoModel)
  create(@BodyParams() todo: TodoModel): TodoModel {
    const { id: _ignored, ...data } = todo;
    return this.todoService.create(data);
  }

  @Put('/:id')
  @Summary('Update a todo')
  @Returns(200, TodoModel)
  update(@PathParams('id') id: string, @BodyParams() todo: TodoModel): TodoModel {
    const { id: _ignored, ...changes } = todo;
    return this.todoService.update(id, changes);
  }

  @Delete('/:id')
  @Summary('Delete a todo')
  @Returns(204)
  remove(@PathParams('id') id: string): void {
    this.todoService.remove(id);
  }
}
`,

    'src/models/TodoModel.ts': `import { Default, Enum, Format, Name, Property, Required, MinLength } from '@tsed/schema';

export class TodoModel {
  @Property()
  id!: string;

  @Required()
  @MinLength(1)
  title!: string;

  @Property()
  description?: string;

  @Enum('pending', 'in_progress', 'completed')
  @Default('pending')
  status: 'pending' | 'in_progress' | 'completed' = 'pending';

  @Name('dueDate')
  @Format('date-time')
  dueDate?: string;
}
`,

    'src/services/TodoService.ts': `import { randomUUID } from 'crypto';
import { Injectable } from '@tsed/di';
import { NotFound } from '@tsed/exceptions';
import { TodoModel } from '../models/TodoModel';

/** In-memory store; replace with a repository for your database of choice. */
@Injectable()
export class TodoService {
  private readonly todos = new Map<string, TodoModel>();

  findAll(): TodoModel[] {
    return [...this.todos.values()];
  }

  findById(id: string): TodoModel {
    const todo = this.todos.get(id);
    if (!todo) {
      throw new NotFound('Todo not found');
    }
    return todo;
  }

  create(data: Omit<TodoModel, 'id'>): TodoModel {
    const todo: TodoModel = { ...data, id: randomUUID() };
    this.todos.set(todo.id, todo);
    return todo;
  }

  update(id: string, changes: Partial<Omit<TodoModel, 'id'>>): TodoModel {
    const todo = { ...this.findById(id), ...changes, id };
    this.todos.set(id, todo);
    return todo;
  }

  remove(id: string): void {
    this.findById(id);
    this.todos.delete(id);
  }
}
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": [
      "ES2020"
    ],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictPropertyInitialization": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "moduleResolution": "node",
    "sourceMap": true
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
`
  },

  postInstall: [
    `echo "Setting up Ts.ED..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
