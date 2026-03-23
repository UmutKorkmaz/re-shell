import { RedisIntegrationGenerator } from '../../../src/templates/backend/python-redis';

describe('Python Redis Integration Generator', () => {
  let generator: RedisIntegrationGenerator;

  beforeEach(() => {
    generator = new RedisIntegrationGenerator();
  });

  describe('generateRedisConfig', () => {
    it('should generate complete Redis configuration for FastAPI', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      expect(files).toHaveLength(11);
      
      // Check Redis config
      const redisConfig = files.find(f => f.path === 'src/config/redis.py');
      expect(redisConfig).toBeDefined();
      expect(redisConfig?.content).toContain('class RedisConfig:');
      expect(redisConfig?.content).toContain('redis.ConnectionPool');
      expect(redisConfig?.content).toContain('get_redis_client()');
      
      // Check session manager
      const sessionManager = files.find(f => f.path === 'src/services/session.py');
      expect(sessionManager).toBeDefined();
      expect(sessionManager?.content).toContain('class SessionManager:');
      expect(sessionManager?.content).toContain('create_session');
      expect(sessionManager?.content).toContain('get_session');
      expect(sessionManager?.content).toContain('delete_session');
      
      // Check cache manager
      const cacheManager = files.find(f => f.path === 'src/services/cache.py');
      expect(cacheManager).toBeDefined();
      expect(cacheManager?.content).toContain('class CacheManager:');
      expect(cacheManager?.content).toContain('def cached(');
      expect(cacheManager?.content).toContain('cache_key_builder');
      
      // Check FastAPI middleware
      const sessionMiddleware = files.find(f => f.path === 'src/middleware/session.py');
      expect(sessionMiddleware).toBeDefined();
      expect(sessionMiddleware?.content).toContain('class SessionMiddleware(BaseHTTPMiddleware):');
      
      const cacheMiddleware = files.find(f => f.path === 'src/middleware/cache.py');
      expect(cacheMiddleware).toBeDefined();
      expect(cacheMiddleware?.content).toContain('class CacheMiddleware(BaseHTTPMiddleware):');
    });

    it('should generate Django-specific middleware', () => {
      const files = generator.generateRedisConfig({
        projectName: 'django-project',
        framework: 'django',
        hasTypeScript: false
      });

      const middleware = files.find(f => f.path === 'middleware/session.py');
      expect(middleware).toBeDefined();
      expect(middleware?.content).toContain('class RedisSessionMiddleware(MiddlewareMixin):');
      expect(middleware?.content).toContain('class RedisCacheMiddleware(MiddlewareMixin):');
      expect(middleware?.content).toContain('process_request');
      expect(middleware?.content).toContain('process_response');
    });

    it('should generate Flask-specific extensions', () => {
      const files = generator.generateRedisConfig({
        projectName: 'flask-project',
        framework: 'flask',
        hasTypeScript: false
      });

      const extensions = files.find(f => f.path === 'src/extensions/session.py');
      expect(extensions).toBeDefined();
      expect(extensions?.content).toContain('class FlaskRedisSession:');
      expect(extensions?.content).toContain('class FlaskRedisCache:');
      expect(extensions?.content).toContain('def login_required(');
      expect(extensions?.content).toContain('init_app');
    });

    it('should generate rate limiting service', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const rateLimiter = files.find(f => f.path === 'src/services/rate_limit.py');
      expect(rateLimiter).toBeDefined();
      expect(rateLimiter?.content).toContain('class RateLimiter:');
      expect(rateLimiter?.content).toContain('check_rate_limit');
      expect(rateLimiter?.content).toContain('sliding_window_rate_limit');
      expect(rateLimiter?.content).toContain('rate_limit_decorator');
    });

    it('should generate distributed locking service', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const distributedLock = files.find(f => f.path === 'src/services/distributed_lock.py');
      expect(distributedLock).toBeDefined();
      expect(distributedLock?.content).toContain('class DistributedLock:');
      expect(distributedLock?.content).toContain('acquire_lock');
      expect(distributedLock?.content).toContain('release_lock');
      expect(distributedLock?.content).toContain('@contextmanager');
    });

    it('should generate pub/sub messaging service', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const pubsub = files.find(f => f.path === 'src/services/pubsub.py');
      expect(pubsub).toBeDefined();
      expect(pubsub?.content).toContain('class PubSubManager:');
      expect(pubsub?.content).toContain('publish');
      expect(pubsub?.content).toContain('subscribe');
      expect(pubsub?.content).toContain('on_message');
    });

    it('should generate Docker configuration', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const docker = files.find(f => f.path === 'docker-compose.yml');
      expect(docker).toBeDefined();
      expect(docker?.content).toContain('redis:7-alpine');
      expect(docker?.content).toContain('redis-commander');
      expect(docker?.content).toContain('maxmemory-policy allkeys-lru');
    });

    it('should generate environment example', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const env = files.find(f => f.path === '.env.example');
      expect(env).toBeDefined();
      expect(env?.content).toContain('REDIS_HOST=localhost');
      expect(env?.content).toContain('REDIS_SESSION_PREFIX=session:');
      expect(env?.content).toContain('REDIS_CACHE_PREFIX=cache:');
    });

    it('should generate comprehensive usage examples', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const examples = files.find(f => f.path === 'examples/redis_usage.py');
      expect(examples).toBeDefined();
      expect(examples?.content).toContain('session_manager.create_session');
      expect(examples?.content).toContain('cache_manager.set');
      expect(examples?.content).toContain('rate_limiter.check_rate_limit');
      expect(examples?.content).toContain('lock_manager.acquire_lock');
      expect(examples?.content).toContain('pubsub_manager.publish');
    });

    it('should include Lua scripts for atomic operations', () => {
      const files = generator.generateRedisConfig({
        projectName: 'test-project',
        framework: 'fastapi',
        hasTypeScript: false
      });

      const rateLimiter = files.find(f => f.path === 'src/services/rate_limit.py');
      expect(rateLimiter?.content).toContain('lua_script = """');
      expect(rateLimiter?.content).toContain('redis.call(');
      
      const distributedLock = files.find(f => f.path === 'src/services/distributed_lock.py');
      expect(distributedLock?.content).toContain('self.redis.eval(lua_script');
    });
  });

  describe('Framework-specific implementations', () => {
    it('should handle all supported frameworks', () => {
      const frameworks = ['fastapi', 'django', 'flask', 'tornado', 'sanic'] as const;
      
      frameworks.forEach(framework => {
        const files = generator.generateRedisConfig({
          projectName: 'test-project',
          framework,
          hasTypeScript: false
        });

        // All frameworks should have base files
        expect(files.find(f => f.path === 'src/config/redis.py')).toBeDefined();
        expect(files.find(f => f.path === 'src/services/session.py')).toBeDefined();
        expect(files.find(f => f.path === 'src/services/cache.py')).toBeDefined();
        
        // FastAPI, Django, Flask have specific middleware
        if (['fastapi', 'django', 'flask'].includes(framework)) {
          expect(files.some(f => f.path.includes('middleware') || f.path.includes('extensions'))).toBe(true);
        }
      });
    });
  });
});