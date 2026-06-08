import { BackendTemplate } from '../types';

export const feathersJsTemplate: BackendTemplate = {
  id: 'feathersjs',
  name: 'Feathers.js',
  displayName: 'Feathers.js',
  description: 'Real-time, micro-service ready web framework with TypeScript',
  version: '5.0.11',
  language: 'typescript',
  framework: 'feathersjs',
  tags: ['nodejs', 'feathers', 'realtime', 'rest', 'websocket', 'typescript'],
  port: 3030,
  dependencies: {},
  features: ['websockets', 'authentication', 'database', 'rest-api', 'file-upload', 'email', 'graphql', 'rate-limiting', 'validation', 'swagger', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Feathers.js real-time backend with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "mocha --recursive test/ --require ts-node/register --exit"
  },
  "dependencies": {
    "@feathersjs/authentication": "^5.0.11",
    "@feathersjs/authentication-local": "^5.0.11",
    "@feathersjs/express": "^5.0.11",
    "@feathersjs/feathers": "^5.0.11",
    "@feathersjs/socketio": "^5.0.11",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "nodemon": "^3.0.1",
    "ts-node": "^10.9.1",
    "typescript": "^5.3.2"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}`,

    'src/app.ts': `import { feathers } from '@feathersjs/feathers';
import express, { rest, json, urlencoded, cors, notFound, errorHandler } from '@feathersjs/express';
import socketio from '@feathersjs/socketio';

const app = express(feathers());

app.use(cors());
app.use(helmet());
app.use(json());
app.use(urlencoded({ extended: true }));

app.configure(rest());
app.configure(socketio());

app.use(notFound());
app.use(errorHandler({ logger: console }));

export { app };
`,

    'src/index.ts': `import { app } from './app';

const port = app.get('port') || 3030;

app.listen(port).then(() => {
  console.log('Feathers app started on http://localhost:' + port);
});
`,

    'README.md': `# Feathers.js Backend

Real-time microservice framework.

\`\`\`bash
npm install
npm run dev
\`\`\`

Available at http://localhost:3030
`
  },

  postInstall: [
    `echo "Setting up Feathers.js backend..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
