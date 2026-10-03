import { BackendTemplate } from '../types';

export const bunServeTemplate: BackendTemplate = {
  id: 'bun-serve',
  name: 'bun-serve',
  displayName: 'Bun.serve (Bun)',
  description: 'REST API on Bun\'s built-in HTTP server and SQLite with JWT auth, no web framework',
  language: 'typescript',
  framework: 'bun-serve',
  version: '1.0.0',
  tags: ['bun', 'typescript', 'api', 'rest', 'sqlite', 'jwt', 'zero-framework'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'database', 'docker', 'rest-api', 'routing', 'testing', 'validation'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "REST API on Bun's built-in HTTP server and SQLite, with no web framework",
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
    "jose": "^5.9.6"
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
data/
.env
*.log
`,

    '.env.example': `# Server
PORT=3000
NODE_ENV=development

# Auth (required in production, at least 16 characters)
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=1h

# SQLite database file (":memory:" for a throwaway database)
DB_PATH=./data/app.sqlite
`,

    'src/config.ts': `const environment = process.env.NODE_ENV ?? 'development';
const isProduction = environment === 'production';

const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me';

const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? '' : DEV_JWT_SECRET);
if (isProduction && jwtSecret.length < 16) {
  throw new Error('JWT_SECRET must be set (at least 16 characters) when NODE_ENV=production');
}

export const config = {
  environment,
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  dbPath: process.env.DB_PATH ?? './data/app.sqlite',
} as const;
`,

    'src/db.ts': `import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface TodoRow {
  id: number;
  user_id: number;
  title: string;
  done: number;
  created_at: string;
}

/** Opens (and migrates) the SQLite database. bun:sqlite is built into Bun. */
export function openDatabase(path: string): Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(\`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  \`);
  return db;
}
`,

    'src/auth.ts': `import { SignJWT, jwtVerify } from 'jose';
import { config } from './config';

const secret = new TextEncoder().encode(config.jwtSecret);

export async function signToken(userId: number, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .sign(secret);
}

/** Returns the user id from a "Bearer <token>" header, or null when missing or invalid. */
export async function userIdFromRequest(request: Request): Promise<number | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret, { algorithms: ['HS256'] });
    const id = Number(payload.sub);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}
`,

    'src/http.ts': `export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Parses a JSON object body, or returns null if the body is not a JSON object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
`,

    'src/routes.ts': `import type { Database } from 'bun:sqlite';
import { signToken, userIdFromRequest } from './auth';
import { error, json, readJson } from './http';
import type { TodoRow, UserRow } from './db';

type Handler = (request: Request) => Response | Promise<Response>;
type IdRequest = Request & { params: { id: string } };

const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

const toTodo = (row: TodoRow) => ({
  id: row.id,
  title: row.title,
  done: row.done === 1,
  createdAt: row.created_at,
});

/**
 * Route table for Bun.serve({ routes }). Bun matches the path and method;
 * handlers only deal with the request.
 */
export function createRoutes(db: Database) {
  const requireUser = async (request: Request): Promise<number | Response> => {
    const userId = await userIdFromRequest(request);
    return userId ?? error('Missing or invalid bearer token', 401);
  };

  const withUser =
    (handler: (request: Request, userId: number) => Response | Promise<Response>): Handler =>
    async (request) => {
      const userId = await requireUser(request);
      return typeof userId === 'number' ? handler(request, userId) : userId;
    };

  const ownTodo = (id: string, userId: number): TodoRow | null =>
    db
      .query<TodoRow, [number, number]>('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(Number(id), userId);

  return {
    '/health': () =>
      json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() }),

    '/api/v1/auth/register': {
      POST: async (request: Request) => {
        const body = await readJson(request);
        const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body?.password === 'string' ? body.password : '';
        if (!EMAIL.test(email)) return error('A valid email is required', 400);
        if (password.length < 8) return error('Password must be at least 8 characters', 400);

        const exists = db.query('SELECT 1 FROM users WHERE email = ?').get(email);
        if (exists) return error('Email already registered', 409);

        const hash = await Bun.password.hash(password);
        const { lastInsertRowid } = db
          .query('INSERT INTO users (email, password_hash) VALUES (?, ?)')
          .run(email, hash);
        const id = Number(lastInsertRowid);
        return json({ user: { id, email }, token: await signToken(id, email) }, 201);
      },
    },

    '/api/v1/auth/login': {
      POST: async (request: Request) => {
        const body = await readJson(request);
        const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body?.password === 'string' ? body.password : '';

        const user = db.query<UserRow, [string]>('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || !(await Bun.password.verify(password, user.password_hash))) {
          return error('Invalid credentials', 401);
        }
        return json({ user: { id: user.id, email: user.email }, token: await signToken(user.id, user.email) });
      },
    },

    '/api/v1/todos': {
      GET: withUser((_request, userId) => {
        const rows = db
          .query<TodoRow, [number]>('SELECT * FROM todos WHERE user_id = ? ORDER BY id DESC')
          .all(userId);
        return json({ data: rows.map(toTodo) });
      }),
      POST: withUser(async (request, userId) => {
        const body = await readJson(request);
        const title = typeof body?.title === 'string' ? body.title.trim() : '';
        if (!title || title.length > 200) return error('title is required (max 200 characters)', 400);

        const { lastInsertRowid } = db
          .query('INSERT INTO todos (user_id, title) VALUES (?, ?)')
          .run(userId, title);
        const row = ownTodo(String(lastInsertRowid), userId);
        return json({ data: row ? toTodo(row) : null }, 201);
      }),
    },

    '/api/v1/todos/:id': {
      GET: withUser((request, userId) => {
        const row = ownTodo((request as IdRequest).params.id, userId);
        return row ? json({ data: toTodo(row) }) : error('Todo not found', 404);
      }),
      PATCH: withUser(async (request, userId) => {
        const id = (request as IdRequest).params.id;
        if (!ownTodo(id, userId)) return error('Todo not found', 404);
        const body = await readJson(request);
        if (!body) return error('JSON body required', 400);

        if (typeof body.title === 'string' && body.title.trim()) {
          db.query('UPDATE todos SET title = ? WHERE id = ?').run(body.title.trim(), Number(id));
        }
        if (typeof body.done === 'boolean') {
          db.query('UPDATE todos SET done = ? WHERE id = ?').run(body.done ? 1 : 0, Number(id));
        }
        const row = ownTodo(id, userId);
        return json({ data: row ? toTodo(row) : null });
      }),
      DELETE: withUser((request, userId) => {
        const id = (request as IdRequest).params.id;
        if (!ownTodo(id, userId)) return error('Todo not found', 404);
        db.query('DELETE FROM todos WHERE id = ?').run(Number(id));
        return new Response(null, { status: 204 });
      }),
    },
  };
}
`,

    'src/server.ts': `import { config } from './config';
import { openDatabase } from './db';
import { error } from './http';
import { createRoutes } from './routes';

/** Builds the Bun HTTP server. port 0 picks a free port (used by the tests). */
export function createServer(options: { port?: number; dbPath?: string } = {}) {
  const db = openDatabase(options.dbPath ?? config.dbPath);

  const server = Bun.serve({
    port: options.port ?? config.port,
    routes: createRoutes(db),
    // Anything the route table does not match.
    fetch: () => error('Not found', 404),
    error: (err) => {
      console.error(err);
      return error('Internal server error', 500);
    },
  });

  return { server, db };
}
`,

    'src/index.ts': `import { createServer } from './server';

const { server, db } = createServer();

console.log('Server running at ' + server.url);
console.log('Health: ' + server.url + 'health');

// Graceful shutdown: stop accepting connections, let in-flight requests finish,
// close the database, then exit 0 so process managers see a clean stop.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(signal + ' received: shutting down');
  await server.stop();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
`,

    'src/server.test.ts': `import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from './server';

describe('{{projectName}}', () => {
  const { server, db } = createServer({ port: 0, dbPath: ':memory:' });
  const base = server.url.toString().replace(/\\/$/, '');
  let token = '';

  // Response.json() is typed unknown; the tests assert on the shape themselves.
  const body = (res: Response): Promise<any> => res.json();

  const api = (path: string, init: RequestInit = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...init.headers,
      },
    });

  beforeAll(async () => {
    const res = await api('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'Ada@Example.com', password: 'correct horse' }),
    });
    expect(res.status).toBe(201);
    token = (await body(res)).token;
  });

  afterAll(async () => {
    await server.stop(true);
    db.close();
  });

  it('answers /health', async () => {
    const res = await api('/health');
    expect(res.status).toBe(200);
    expect((await body(res)).status).toBe('healthy');
  });

  it('rejects a duplicate registration and bad credentials', async () => {
    const dup = await api('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'ada@example.com', password: 'correct horse' }),
    });
    expect(dup.status).toBe(409);

    const bad = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ada@example.com', password: 'wrong password' }),
    });
    expect(bad.status).toBe(401);
  });

  it('requires a token for todos', async () => {
    const res = await fetch(base + '/api/v1/todos');
    expect(res.status).toBe(401);
  });

  it('creates, updates, lists and deletes a todo', async () => {
    const created = await api('/api/v1/todos', { method: 'POST', body: JSON.stringify({ title: 'Write docs' }) });
    expect(created.status).toBe(201);
    const { data } = await body(created);
    expect(data.title).toBe('Write docs');
    expect(data.done).toBe(false);

    const updated = await api('/api/v1/todos/' + data.id, { method: 'PATCH', body: JSON.stringify({ done: true }) });
    expect((await body(updated)).data.done).toBe(true);

    const list = await api('/api/v1/todos');
    expect((await body(list)).data).toHaveLength(1);

    const removed = await api('/api/v1/todos/' + data.id, { method: 'DELETE' });
    expect(removed.status).toBe(204);
    expect((await api('/api/v1/todos/' + data.id)).status).toBe(404);
  });

  it('validates input', async () => {
    const res = await api('/api/v1/todos', { method: 'POST', body: JSON.stringify({ title: '' }) });
    expect(res.status).toBe(400);
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await api('/nope');
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

A REST API on Bun's built-in HTTP server (\`Bun.serve\` with its route table) and \`bun:sqlite\`. There is no web framework: routing, the database driver and password hashing (\`Bun.password\`) all ship with Bun. The only dependency is \`jose\` for JWTs.

## Requirements

- Bun 1.2.3 or newer (the \`routes\` option of \`Bun.serve\`)

## Quick start

\`\`\`bash
bun install
cp .env.example .env   # optional: every setting has a development default
bun run dev            # hot reload
\`\`\`

\`\`\`bash
bun run start          # run once
bun run build          # bundle to dist/
bun run typecheck      # tsc --noEmit
bun test
\`\`\`

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | \`/health\` | no | Liveness probe |
| POST | \`/api/v1/auth/register\` | no | \`{ email, password }\` returns a user and a token |
| POST | \`/api/v1/auth/login\` | no | \`{ email, password }\` returns a user and a token |
| GET | \`/api/v1/todos\` | bearer | Your todos |
| POST | \`/api/v1/todos\` | bearer | \`{ title }\` |
| GET / PATCH / DELETE | \`/api/v1/todos/:id\` | bearer | One of your todos |

\`\`\`bash
TOKEN=$(curl -s localhost:3000/api/v1/auth/register -H 'content-type: application/json' \\
  -d '{"email":"ada@example.com","password":"correct horse"}' | bun -e 'console.log((await Bun.stdin.json()).token)')
curl -s localhost:3000/api/v1/todos -H "authorization: Bearer $TOKEN"
\`\`\`

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| \`PORT\` | \`3000\` | |
| \`JWT_SECRET\` | development value | Required (16+ characters) when \`NODE_ENV=production\` |
| \`JWT_EXPIRES_IN\` | \`1h\` | |
| \`DB_PATH\` | \`./data/app.sqlite\` | \`:memory:\` for a throwaway database |

## Project structure

\`\`\`
src/
├── index.ts        # entry point and graceful shutdown
├── server.ts       # Bun.serve setup
├── routes.ts       # route table
├── auth.ts         # JWT helpers
├── db.ts           # bun:sqlite schema
├── http.ts         # response helpers
└── server.test.ts  # tests (bun test)
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 -e JWT_SECRET=<16+ chars> {{projectName}}
\`\`\`

## License

MIT
`
  }
};
