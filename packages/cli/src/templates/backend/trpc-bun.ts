import { BackendTemplate } from '../types';

export const trpcBunTemplate: BackendTemplate = {
  id: 'trpc-bun',
  name: 'trpc-bun',
  displayName: 'tRPC (Bun)',
  description: 'End-to-end typed RPC API with tRPC and zod, served by Bun',
  language: 'typescript',
  framework: 'trpc',
  version: '1.0.0',
  tags: ['bun', 'trpc', 'typescript', 'api', 'rpc', 'zod', 'type-safe'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'docker', 'testing', 'validation'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "End-to-end typed RPC API with tRPC on Bun",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.5"
  }
}
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["bun"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,

    '.gitignore': `node_modules/
dist/
.env
*.log
`,

    '.env.example': `PORT=3000
NODE_ENV=development
# API key required by the protected procedures (required in production)
API_KEY=change-me
`,

    'src/config.ts': `const isProduction = process.env.NODE_ENV === 'production';

const apiKey = process.env.API_KEY ?? (isProduction ? '' : 'dev-api-key');
if (isProduction && !apiKey) {
  throw new Error('API_KEY must be set when NODE_ENV=production');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  apiKey,
} as const;
`,

    'src/trpc.ts': `import { initTRPC, TRPCError } from '@trpc/server';
import { config } from './config';

export interface Context {
  /** The caller's API key, from the x-api-key header. */
  apiKey: string | null;
}

export function createContext(req: Request): Context {
  return { apiKey: req.headers.get('x-api-key') };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Procedures that need the x-api-key header. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.apiKey !== config.apiKey) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing or invalid x-api-key header' });
  }
  return next();
});
`,

    'src/router.ts': `import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from './trpc';

interface Note {
  id: number;
  text: string;
  createdAt: string;
}

// In-memory store: swap for a database in a real service.
const notes: Note[] = [];
let nextId = 1;

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().min(1).max(100).default('world') }).default({}))
    .query(({ input }) => ({ message: 'Hello, ' + input.name + '!' })),

  health: publicProcedure.query(() => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })),

  notes: router({
    list: publicProcedure.query(() => notes),
    create: protectedProcedure
      .input(z.object({ text: z.string().min(1).max(500) }))
      .mutation(({ input }) => {
        const note: Note = { id: nextId++, text: input.text, createdAt: new Date().toISOString() };
        notes.push(note);
        return note;
      }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(({ input }) => {
      const index = notes.findIndex((note) => note.id === input.id);
      if (index === -1) return { removed: false };
      notes.splice(index, 1);
      return { removed: true };
    }),
  }),
});

/** Import this type in a client for end-to-end type safety. */
export type AppRouter = typeof appRouter;
`,

    'src/server.ts': `import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { config } from './config';
import { appRouter } from './router';
import { createContext } from './trpc';

/** Plain fetch handler: /health for probes, everything under /trpc goes to tRPC. */
export async function handle(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (pathname === '/health') {
    return Response.json({ status: 'healthy', timestamp: new Date().toISOString() });
  }

  if (pathname.startsWith('/trpc')) {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req,
      router: appRouter,
      createContext: () => createContext(req),
    });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

/** port 0 picks a free port (used by the tests). */
export function createServer(port: number = config.port) {
  return Bun.serve({ port, fetch: handle });
}
`,

    'src/index.ts': `import { createServer } from './server';

const server = createServer();

console.log('Server running at ' + server.url);
console.log('tRPC endpoint: ' + server.url + 'trpc');

// Graceful shutdown: stop accepting connections, let in-flight requests finish,
// then exit 0 so process managers see a clean stop.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(signal + ' received: shutting down');
  await server.stop();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
`,

    'src/server.test.ts': `import { afterAll, describe, expect, it } from 'bun:test';
import { config } from './config';
import { appRouter } from './router';
import { createServer } from './server';

describe('{{projectName}}', () => {
  const server = createServer(0);
  const base = server.url.toString().replace(/\\/$/, '');

  afterAll(async () => {
    await server.stop(true);
  });

  // Response.json() is typed unknown; the tests assert on the shape themselves.
  const body = (res: Response): Promise<any> => res.json();

  it('answers /health', async () => {
    const res = await fetch(base + '/health');
    expect(res.status).toBe(200);
    expect((await body(res)).status).toBe('healthy');
  });

  it('serves a typed query over HTTP', async () => {
    const input = encodeURIComponent(JSON.stringify({ name: 'bun' }));
    const res = await fetch(base + '/trpc/hello?input=' + input);
    expect(res.status).toBe(200);
    expect((await body(res)).result.data.message).toBe('Hello, bun!');
  });

  it('rejects invalid input with a 400', async () => {
    const input = encodeURIComponent(JSON.stringify({ name: '' }));
    const res = await fetch(base + '/trpc/hello?input=' + input);
    expect(res.status).toBe(400);
  });

  it('protects mutations with the api key', async () => {
    const post = (headers: Record<string, string>) =>
      fetch(base + '/trpc/notes.create', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ text: 'remember the milk' }),
      });

    expect((await post({})).status).toBe(401);

    const ok = await post({ 'x-api-key': config.apiKey });
    expect(ok.status).toBe(200);

    const list = await fetch(base + '/trpc/notes.list');
    expect((await body(list)).result.data).toHaveLength(1);
  });

  it('can be called in-process without HTTP', async () => {
    const caller = appRouter.createCaller({ apiKey: config.apiKey });
    const note = await caller.notes.create({ text: 'in-process' });
    expect(note.text).toBe('in-process');
    expect((await caller.notes.remove({ id: note.id })).removed).toBe(true);
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await fetch(base + '/nope');
    expect(res.status).toBe(404);
  });
});
`,

    'Dockerfile': `FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* bun.lockb* ./
RUN bun install --production

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

USER bun
CMD ["bun", "run", "start"]
`,

    'README.md': `# {{projectName}}

An end-to-end typed RPC API: [tRPC](https://trpc.io) served by \`Bun.serve\` through tRPC's fetch adapter, with [zod](https://zod.dev) validating every input. Clients import the \`AppRouter\` type and get autocompletion and compile-time checking for every procedure.

## Requirements

- Bun 1.1 or newer

## Quick start

\`\`\`bash
bun install
bun run dev        # hot reload
bun run start      # run once
bun run typecheck
bun test
\`\`\`

## Endpoints

| Path | Description |
| --- | --- |
| \`GET /health\` | Liveness probe |
| \`GET /trpc/hello?input={"name":"bun"}\` | Query: \`{ result: { data: { message } } }\` |
| \`GET /trpc/health\` | Query: status, timestamp, uptime |
| \`GET /trpc/notes.list\` | Query: all notes |
| \`POST /trpc/notes.create\` | Mutation \`{ text }\`; needs the \`x-api-key\` header |
| \`POST /trpc/notes.remove\` | Mutation \`{ id }\`; needs the \`x-api-key\` header |

\`\`\`bash
curl -s 'localhost:3000/trpc/hello?input=%7B%22name%22%3A%22bun%22%7D'
curl -s localhost:3000/trpc/notes.create -H 'content-type: application/json' \\
  -H 'x-api-key: dev-api-key' -d '{"text":"remember the milk"}'
\`\`\`

## Using the types from a client

\`\`\`ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './src/router';

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
});

const { message } = await client.hello.query({ name: 'bun' });
\`\`\`

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| \`PORT\` | \`3000\` | |
| \`API_KEY\` | development value | Required when \`NODE_ENV=production\` |

## Project structure

\`\`\`
src/
├── index.ts        # entry point and graceful shutdown
├── server.ts       # fetch handler: /health and /trpc
├── router.ts       # procedures (the AppRouter type is exported from here)
├── trpc.ts         # tRPC setup, context and the protected procedure
├── config.ts       # environment
└── server.test.ts  # tests (bun test)
\`\`\`

The notes live in memory; replace them with a database in \`src/router.ts\`.

## License

MIT
`
  }
};
