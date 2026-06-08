import { BackendTemplate } from '../types';

export const redisIntegrationTemplate: BackendTemplate = {
  id: 'redis-integration',
  name: 'redis-integration',
  displayName: 'Redis Integration',
  description: 'Redis integration template with caching, sessions, and pub/sub',
  language: 'javascript',
  framework: 'redis',
  version: '1.0.0',
  tags: ['redis', 'caching', 'sessions', 'pubsub', 'nodejs'],
  port: 3000,
  dependencies: {},
  features: ['caching', 'sessions', 'pubsub', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "redis": "^4.6.12",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "connect-redis": "^7.1.1"
  }
}
`,

    'index.js': `import express from 'express';
import { createClient } from 'redis';
import session from 'express-session';
import RedisStore from 'connect-redis';

const app = express();
const redis = createClient({ url: 'redis://localhost:6379' });

await redis.connect();
redis.on('error', err => console.error('Redis Error:', err));
redis.on('connect', () => console.log('Redis Connected'));

app.use(session({
  store: RedisStore.new({ client: redis }),
  secret: 'secret',
  resave: false,
  saveUninitialized: false
}));

app.use(express.json());

// Cache middleware
app.get('/api/cache/:key', async (req, res) => {
  const value = await redis.get(req.params.key);
  res.json({ key: req.params.key, value });
});

app.post('/api/cache/:key', async (req, res) => {
  const { value, ttl = 3600 } = req.body;
  await redis.setEx(req.params.key, ttl, JSON.stringify(value));
  res.json({ cached: true, ttl });
});

app.delete('/api/cache/:key', async (req, res) => {
  await redis.del(req.params.key);
  res.json({ deleted: true });
});

// Session routes
app.post('/api/session/:key', (req, res) => {
  req.session[req.params.key] = req.body.value;
  res.json({ sessionKey: req.params.key, value: req.body.value });
});

app.get('/api/session/:key', (req, res) => {
  res.json({ sessionKey: req.params.key, value: req.session[req.params.key] });
});

// Pub/Sub
app.post('/api/publish/:channel', async (req, res) => {
  const { message } = req.body;
  const result = await redis.publish(req.params.channel, JSON.stringify(message));
  res.json({ channel: req.params.channel, subscribers: result });
});

// Health check
app.get('/health', async (req, res) => {
  const pong = await redis.ping();
  res.json({ status: 'healthy', redis: pong === 'PONG' });
});

app.listen(3000, () => console.log('Server on port 3000'));
`,

    'README.md': `# {{projectName}}

Redis integration with caching, sessions, and pub/sub.

## Features

- Caching with TTL
- Session storage
- Pub/Sub messaging
- Connection pooling

## Quick Start

\`\`\`bash
npm install
npm start
\`\`\`

## API

- GET /api/cache/:key - Get cached value
- POST /api/cache/:key - Set value with TTL
- DELETE /api/cache/:key - Delete cache
- POST /api/session/:key - Set session value
- GET /api/session/:key - Get session value
- POST /api/publish/:channel - Publish message
- GET /health - Health check

## License

MIT
`
  }
};
