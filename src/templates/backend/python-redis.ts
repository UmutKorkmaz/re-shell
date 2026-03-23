// Redis integration templates for Python frameworks
import { FileTemplate } from '../types';

export interface RedisConfig {
  projectName: string;
  framework: 'fastapi' | 'django' | 'flask' | 'tornado' | 'sanic';
  hasTypeScript?: boolean;
}

export class RedisIntegrationGenerator {
  generateRedisConfig(config: RedisConfig): FileTemplate[] {
    const templates: FileTemplate[] = [];

    // Redis configuration
    templates.push({
      path: 'src/config/redis.py',
      content: `import os
import redis
from typing import Optional, Any, Dict
import json
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class RedisConfig:
    """Redis configuration settings"""
    def __init__(self):
        self.host = os.getenv('REDIS_HOST', 'localhost')
        self.port = int(os.getenv('REDIS_PORT', 6379))
        self.db = int(os.getenv('REDIS_DB', 0))
        self.password = os.getenv('REDIS_PASSWORD')
        self.ssl = os.getenv('REDIS_SSL', 'false').lower() == 'true'
        self.max_connections = int(os.getenv('REDIS_MAX_CONNECTIONS', 50))
        self.socket_timeout = int(os.getenv('REDIS_SOCKET_TIMEOUT', 5))
        self.socket_connect_timeout = int(os.getenv('REDIS_SOCKET_CONNECT_TIMEOUT', 5))
        self.decode_responses = True
        
        # Session settings
        self.session_prefix = os.getenv('REDIS_SESSION_PREFIX', 'session:')
        self.session_ttl = int(os.getenv('REDIS_SESSION_TTL', 86400))  # 24 hours
        
        # Cache settings
        self.cache_prefix = os.getenv('REDIS_CACHE_PREFIX', 'cache:')
        self.cache_ttl = int(os.getenv('REDIS_CACHE_TTL', 3600))  # 1 hour

redis_config = RedisConfig()

# Connection pool
pool = redis.ConnectionPool(
    host=redis_config.host,
    port=redis_config.port,
    db=redis_config.db,
    password=redis_config.password,
    ssl=redis_config.ssl,
    max_connections=redis_config.max_connections,
    socket_timeout=redis_config.socket_timeout,
    socket_connect_timeout=redis_config.socket_connect_timeout,
    decode_responses=redis_config.decode_responses
)

def get_redis_client() -> redis.Redis:
    """Get Redis client from connection pool"""
    return redis.Redis(connection_pool=pool)

def check_redis_connection() -> bool:
    """Check if Redis is available"""
    try:
        client = get_redis_client()
        client.ping()
        return True
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        return False
`
    });

    // Session manager
    templates.push({
      path: 'src/services/session.py',
      content: `import uuid
from typing import Optional, Any, Dict
import json
from datetime import datetime, timedelta
import redis
from ..config.redis import get_redis_client, redis_config
import logging

logger = logging.getLogger(__name__)

class SessionManager:
    """Redis-based session management"""
    
    def __init__(self):
        self.redis = get_redis_client()
        self.prefix = redis_config.session_prefix
        self.ttl = redis_config.session_ttl
    
    def create_session(self, user_id: str, data: Dict[str, Any]) -> str:
        """Create a new session"""
        session_id = str(uuid.uuid4())
        session_key = f"{self.prefix}{session_id}"
        
        session_data = {
            'user_id': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'last_accessed': datetime.utcnow().isoformat(),
            'data': data
        }
        
        try:
            self.redis.setex(
                session_key,
                self.ttl,
                json.dumps(session_data)
            )
            logger.info(f"Created session {session_id} for user {user_id}")
            return session_id
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        session_key = f"{self.prefix}{session_id}"
        
        try:
            data = self.redis.get(session_key)
            if not data:
                return None
            
            session_data = json.loads(data)
            
            # Update last accessed time
            session_data['last_accessed'] = datetime.utcnow().isoformat()
            self.redis.setex(
                session_key,
                self.ttl,
                json.dumps(session_data)
            )
            
            return session_data
        except Exception as e:
            logger.error(f"Failed to get session {session_id}: {e}")
            return None
    
    def update_session(self, session_id: str, data: Dict[str, Any]) -> bool:
        """Update session data"""
        session_key = f"{self.prefix}{session_id}"
        
        try:
            existing = self.redis.get(session_key)
            if not existing:
                return False
            
            session_data = json.loads(existing)
            session_data['data'].update(data)
            session_data['last_accessed'] = datetime.utcnow().isoformat()
            
            self.redis.setex(
                session_key,
                self.ttl,
                json.dumps(session_data)
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update session {session_id}: {e}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        session_key = f"{self.prefix}{session_id}"
        
        try:
            result = self.redis.delete(session_key)
            logger.info(f"Deleted session {session_id}")
            return result > 0
        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {e}")
            return False
    
    def extend_session(self, session_id: str, additional_seconds: int = None) -> bool:
        """Extend session TTL"""
        session_key = f"{self.prefix}{session_id}"
        ttl = additional_seconds or self.ttl
        
        try:
            return self.redis.expire(session_key, ttl)
        except Exception as e:
            logger.error(f"Failed to extend session {session_id}: {e}")
            return False
    
    def get_user_sessions(self, user_id: str) -> list[str]:
        """Get all sessions for a user"""
        sessions = []
        pattern = f"{self.prefix}*"
        
        try:
            for key in self.redis.scan_iter(match=pattern):
                data = self.redis.get(key)
                if data:
                    session_data = json.loads(data)
                    if session_data.get('user_id') == user_id:
                        session_id = key.replace(self.prefix, '')
                        sessions.append(session_id)
            return sessions
        except Exception as e:
            logger.error(f"Failed to get user sessions: {e}")
            return []
    
    def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions (handled by Redis TTL)"""
        # Redis automatically removes expired keys
        # This method is for logging/metrics
        count = 0
        pattern = f"{self.prefix}*"
        
        try:
            for key in self.redis.scan_iter(match=pattern):
                ttl = self.redis.ttl(key)
                if ttl == -2:  # Key doesn't exist
                    count += 1
            logger.info(f"Cleaned up {count} expired sessions")
            return count
        except Exception as e:
            logger.error(f"Failed to cleanup sessions: {e}")
            return 0

# Global session manager instance
session_manager = SessionManager()
`
    });

    // Cache manager
    templates.push({
      path: 'src/services/cache.py',
      content: `import json
import pickle
from typing import Optional, Any, Callable, Union
from functools import wraps
import hashlib
from datetime import timedelta
import redis
from ..config.redis import get_redis_client, redis_config
import logging

logger = logging.getLogger(__name__)

class CacheManager:
    """Redis-based caching with multiple serialization strategies"""
    
    def __init__(self):
        self.redis = get_redis_client()
        self.prefix = redis_config.cache_prefix
        self.default_ttl = redis_config.cache_ttl
    
    def _make_key(self, key: str) -> str:
        """Generate cache key with prefix"""
        return f"{self.prefix}{key}"
    
    def _serialize(self, value: Any, format: str = 'json') -> bytes:
        """Serialize value for storage"""
        if format == 'json':
            return json.dumps(value).encode('utf-8')
        elif format == 'pickle':
            return pickle.dumps(value)
        else:
            raise ValueError(f"Unknown serialization format: {format}")
    
    def _deserialize(self, data: bytes, format: str = 'json') -> Any:
        """Deserialize value from storage"""
        if format == 'json':
            return json.loads(data.decode('utf-8'))
        elif format == 'pickle':
            return pickle.loads(data)
        else:
            raise ValueError(f"Unknown serialization format: {format}")
    
    def get(self, key: str, format: str = 'json') -> Optional[Any]:
        """Get value from cache"""
        cache_key = self._make_key(key)
        
        try:
            data = self.redis.get(cache_key)
            if data is None:
                return None
            return self._deserialize(data, format)
        except Exception as e:
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = None, format: str = 'json') -> bool:
        """Set value in cache"""
        cache_key = self._make_key(key)
        ttl = ttl or self.default_ttl
        
        try:
            data = self._serialize(value, format)
            if ttl > 0:
                self.redis.setex(cache_key, ttl, data)
            else:
                self.redis.set(cache_key, data)
            return True
        except Exception as e:
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        cache_key = self._make_key(key)
        
        try:
            return self.redis.delete(cache_key) > 0
        except Exception as e:
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        cache_key = self._make_key(key)
        
        try:
            return self.redis.exists(cache_key) > 0
        except Exception as e:
            logger.error(f"Cache exists error for key {key}: {e}")
            return False
    
    def get_many(self, keys: list[str], format: str = 'json') -> dict[str, Any]:
        """Get multiple values from cache"""
        cache_keys = [self._make_key(key) for key in keys]
        result = {}
        
        try:
            values = self.redis.mget(cache_keys)
            for key, value in zip(keys, values):
                if value is not None:
                    result[key] = self._deserialize(value, format)
            return result
        except Exception as e:
            logger.error(f"Cache get_many error: {e}")
            return {}
    
    def set_many(self, mapping: dict[str, Any], ttl: int = None, format: str = 'json') -> bool:
        """Set multiple values in cache"""
        ttl = ttl or self.default_ttl
        
        try:
            pipe = self.redis.pipeline()
            for key, value in mapping.items():
                cache_key = self._make_key(key)
                data = self._serialize(value, format)
                if ttl > 0:
                    pipe.setex(cache_key, ttl, data)
                else:
                    pipe.set(cache_key, data)
            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"Cache set_many error: {e}")
            return False
    
    def delete_many(self, keys: list[str]) -> int:
        """Delete multiple values from cache"""
        cache_keys = [self._make_key(key) for key in keys]
        
        try:
            return self.redis.delete(*cache_keys)
        except Exception as e:
            logger.error(f"Cache delete_many error: {e}")
            return 0
    
    def clear_pattern(self, pattern: str) -> int:
        """Clear all keys matching pattern"""
        search_pattern = f"{self.prefix}{pattern}"
        count = 0
        
        try:
            for key in self.redis.scan_iter(match=search_pattern):
                self.redis.delete(key)
                count += 1
            return count
        except Exception as e:
            logger.error(f"Cache clear_pattern error: {e}")
            return 0
    
    def increment(self, key: str, delta: int = 1) -> Optional[int]:
        """Atomic increment"""
        cache_key = self._make_key(key)
        
        try:
            return self.redis.incrby(cache_key, delta)
        except Exception as e:
            logger.error(f"Cache increment error for key {key}: {e}")
            return None
    
    def decrement(self, key: str, delta: int = 1) -> Optional[int]:
        """Atomic decrement"""
        cache_key = self._make_key(key)
        
        try:
            return self.redis.decrby(cache_key, delta)
        except Exception as e:
            logger.error(f"Cache decrement error for key {key}: {e}")
            return None

# Global cache manager instance
cache_manager = CacheManager()

def cache_key_builder(*args, **kwargs) -> str:
    """Build cache key from function arguments"""
    key_parts = [str(arg) for arg in args]
    key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
    key_string = ":".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()

def cached(
    ttl: Union[int, timedelta] = None,
    key_prefix: str = None,
    key_builder: Callable = None,
    format: str = 'json'
):
    """Decorator for caching function results"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = cache_key_builder(*args, **kwargs)
            
            if key_prefix:
                cache_key = f"{key_prefix}:{cache_key}"
            else:
                cache_key = f"{func.__module__}:{func.__name__}:{cache_key}"
            
            # Try to get from cache
            cached_value = cache_manager.get(cache_key, format=format)
            if cached_value is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_value
            
            # Call function and cache result
            result = func(*args, **kwargs)
            
            # Convert timedelta to seconds
            if isinstance(ttl, timedelta):
                ttl_seconds = int(ttl.total_seconds())
            else:
                ttl_seconds = ttl
            
            cache_manager.set(cache_key, result, ttl=ttl_seconds, format=format)
            logger.debug(f"Cache miss for {cache_key}, cached result")
            
            return result
        
        return wrapper
    return decorator
`
    });

    // Framework-specific middleware
    if (config.framework === 'fastapi') {
      templates.push({
        path: 'src/middleware/session.py',
        content: `from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import uuid
from ..services.session import session_manager
import logging

logger = logging.getLogger(__name__)

class SessionMiddleware(BaseHTTPMiddleware):
    """FastAPI session middleware"""
    
    def __init__(self, app, cookie_name: str = "session_id", secure: bool = True, httponly: bool = True):
        super().__init__(app)
        self.cookie_name = cookie_name
        self.secure = secure
        self.httponly = httponly
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get session ID from cookie
        session_id = request.cookies.get(self.cookie_name)
        
        # Get or create session
        if session_id:
            session = session_manager.get_session(session_id)
            if not session:
                # Invalid session, create new one
                session_id = None
        
        if not session_id:
            # Create anonymous session
            session_id = session_manager.create_session(
                user_id="anonymous",
                data={"ip": request.client.host}
            )
            session = session_manager.get_session(session_id)
        
        # Attach session to request
        request.state.session_id = session_id
        request.state.session = session
        
        # Process request
        response = await call_next(request)
        
        # Set session cookie
        response.set_cookie(
            key=self.cookie_name,
            value=session_id,
            secure=self.secure,
            httponly=self.httponly,
            samesite="lax",
            max_age=session_manager.ttl
        )
        
        return response

def get_session(request: Request) -> dict:
    """Get session from request"""
    return getattr(request.state, 'session', None)

def get_session_id(request: Request) -> str:
    """Get session ID from request"""
    return getattr(request.state, 'session_id', None)
`
      });

      templates.push({
        path: 'src/middleware/cache.py',
        content: `from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import hashlib
import json
from ..services.cache import cache_manager
import logging

logger = logging.getLogger(__name__)

class CacheMiddleware(BaseHTTPMiddleware):
    """FastAPI HTTP cache middleware"""
    
    def __init__(self, app, ttl: int = 300, methods: list = None):
        super().__init__(app)
        self.ttl = ttl
        self.methods = methods or ['GET']
    
    def _make_cache_key(self, request: Request) -> str:
        """Generate cache key from request"""
        key_parts = [
            request.method,
            str(request.url),
            json.dumps(dict(request.query_params), sort_keys=True)
        ]
        key_string = ":".join(key_parts)
        return f"http:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only cache configured methods
        if request.method not in self.methods:
            return await call_next(request)
        
        # Skip cache for authenticated requests
        if request.headers.get("Authorization"):
            return await call_next(request)
        
        # Try to get from cache
        cache_key = self._make_cache_key(request)
        cached = cache_manager.get(cache_key)
        
        if cached:
            logger.debug(f"HTTP cache hit for {request.url}")
            return Response(
                content=cached['content'],
                status_code=cached['status_code'],
                headers=cached['headers'],
                media_type=cached.get('media_type')
            )
        
        # Process request
        response = await call_next(request)
        
        # Cache successful responses
        if 200 <= response.status_code < 300:
            # Read response body
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            # Cache response
            cache_data = {
                'content': body.decode('utf-8'),
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'media_type': response.media_type
            }
            cache_manager.set(cache_key, cache_data, ttl=self.ttl)
            
            # Return new response with body
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )
        
        return response
`
      });
    } else if (config.framework === 'django') {
      templates.push({
        path: 'middleware/session.py',
        content: `from django.utils.deprecation import MiddlewareMixin
from django.http import HttpRequest, HttpResponse
from ..services.session import session_manager
import logging

logger = logging.getLogger(__name__)

class RedisSessionMiddleware(MiddlewareMixin):
    """Django Redis session middleware"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.cookie_name = 'session_id'
    
    def process_request(self, request: HttpRequest):
        """Process incoming request"""
        session_id = request.COOKIES.get(self.cookie_name)
        
        if session_id:
            session = session_manager.get_session(session_id)
            if session:
                request.redis_session = session
                request.redis_session_id = session_id
            else:
                request.redis_session = None
                request.redis_session_id = None
        else:
            request.redis_session = None
            request.redis_session_id = None
    
    def process_response(self, request: HttpRequest, response: HttpResponse):
        """Process outgoing response"""
        # Create session if needed
        if hasattr(request, 'create_redis_session') and request.create_redis_session:
            session_id = session_manager.create_session(
                user_id=str(getattr(request.user, 'id', 'anonymous')),
                data=request.redis_session_data or {}
            )
            response.set_cookie(
                self.cookie_name,
                session_id,
                max_age=session_manager.ttl,
                secure=True,
                httponly=True,
                samesite='Lax'
            )
        
        return response

class RedisCacheMiddleware(MiddlewareMixin):
    """Django Redis cache middleware"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.ttl = 300  # 5 minutes
    
    def process_request(self, request: HttpRequest):
        """Check cache for GET requests"""
        if request.method != 'GET':
            return None
        
        # Skip authenticated requests
        if request.user.is_authenticated:
            return None
        
        # Generate cache key
        from ..services.cache import cache_manager
        import hashlib
        
        cache_key = f"django:view:{hashlib.md5(request.get_full_path().encode()).hexdigest()}"
        cached = cache_manager.get(cache_key)
        
        if cached:
            logger.debug(f"Cache hit for {request.path}")
            response = HttpResponse(
                cached['content'],
                content_type=cached['content_type'],
                status=cached['status']
            )
            return response
        
        return None
    
    def process_response(self, request: HttpRequest, response: HttpResponse):
        """Cache successful GET responses"""
        if request.method == 'GET' and response.status_code == 200:
            if not request.user.is_authenticated:
                from ..services.cache import cache_manager
                import hashlib
                
                cache_key = f"django:view:{hashlib.md5(request.get_full_path().encode()).hexdigest()}"
                cache_data = {
                    'content': response.content.decode('utf-8'),
                    'content_type': response.get('Content-Type', 'text/html'),
                    'status': response.status_code
                }
                cache_manager.set(cache_key, cache_data, ttl=self.ttl)
        
        return response
`
      });
    } else if (config.framework === 'flask') {
      templates.push({
        path: 'src/extensions/session.py',
        content: `from flask import Flask, request, g, make_response
from functools import wraps
from ..services.session import session_manager
import logging

logger = logging.getLogger(__name__)

class FlaskRedisSession:
    """Flask Redis session extension"""
    
    def __init__(self, app: Flask = None):
        self.app = app
        self.cookie_name = 'session_id'
        if app:
            self.init_app(app)
    
    def init_app(self, app: Flask):
        """Initialize the extension"""
        app.config.setdefault('SESSION_COOKIE_NAME', 'session_id')
        app.config.setdefault('SESSION_COOKIE_SECURE', True)
        app.config.setdefault('SESSION_COOKIE_HTTPONLY', True)
        app.config.setdefault('SESSION_COOKIE_SAMESITE', 'Lax')
        
        self.cookie_name = app.config['SESSION_COOKIE_NAME']
        
        app.before_request(self._before_request)
        app.after_request(self._after_request)
    
    def _before_request(self):
        """Load session before request"""
        session_id = request.cookies.get(self.cookie_name)
        
        if session_id:
            session = session_manager.get_session(session_id)
            if session:
                g.session = session
                g.session_id = session_id
            else:
                g.session = None
                g.session_id = None
        else:
            g.session = None
            g.session_id = None
    
    def _after_request(self, response):
        """Save session after request"""
        if hasattr(g, 'create_session') and g.create_session:
            session_id = session_manager.create_session(
                user_id=g.session_user_id or 'anonymous',
                data=g.session_data or {}
            )
            response.set_cookie(
                self.cookie_name,
                session_id,
                max_age=session_manager.ttl,
                secure=True,
                httponly=True,
                samesite='Lax'
            )
        
        return response

def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not g.session or g.session.get('user_id') == 'anonymous':
            return make_response('Unauthorized', 401)
        return f(*args, **kwargs)
    return decorated_function

class FlaskRedisCache:
    """Flask Redis cache extension"""
    
    def __init__(self, app: Flask = None):
        self.app = app
        if app:
            self.init_app(app)
    
    def init_app(self, app: Flask):
        """Initialize the extension"""
        from ..services.cache import cache_manager
        app.extensions['redis_cache'] = cache_manager
    
    @staticmethod
    def cached(ttl: int = 300, key_prefix: str = None):
        """Cache decorator for Flask views"""
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                from ..services.cache import cache_manager
                import hashlib
                
                # Generate cache key
                if key_prefix:
                    cache_key = f"{key_prefix}:{request.path}"
                else:
                    cache_key = f"flask:view:{request.path}"
                
                # Add query params to key
                if request.query_string:
                    cache_key += f":{request.query_string.decode()}"
                
                cache_key = hashlib.md5(cache_key.encode()).hexdigest()
                
                # Skip cache for authenticated users
                if g.session and g.session.get('user_id') != 'anonymous':
                    return f(*args, **kwargs)
                
                # Try cache
                cached = cache_manager.get(cache_key)
                if cached:
                    response = make_response(cached['content'])
                    response.headers.update(cached['headers'])
                    return response
                
                # Call view
                response = f(*args, **kwargs)
                
                # Cache response
                if response.status_code == 200:
                    cache_data = {
                        'content': response.get_data(as_text=True),
                        'headers': dict(response.headers)
                    }
                    cache_manager.set(cache_key, cache_data, ttl=ttl)
                
                return response
            
            return decorated_function
        return decorator
`
      });
    }

    // Rate limiting with Redis
    templates.push({
      path: 'src/services/rate_limit.py',
      content: `from typing import Optional, Tuple
import time
from ..config.redis import get_redis_client
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """Redis-based rate limiting"""
    
    def __init__(self):
        self.redis = get_redis_client()
    
    def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int,
        identifier: str = None
    ) -> Tuple[bool, Optional[int]]:
        """
        Check if rate limit is exceeded
        
        Args:
            key: Rate limit key (e.g., 'api:endpoint')
            limit: Maximum requests allowed
            window: Time window in seconds
            identifier: User/IP identifier
        
        Returns:
            (allowed, remaining_requests)
        """
        if identifier:
            key = f"rate_limit:{key}:{identifier}"
        else:
            key = f"rate_limit:{key}"
        
        try:
            pipe = self.redis.pipeline()
            now = int(time.time())
            window_start = now - window
            
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current entries
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(now): now})
            
            # Set expiry
            pipe.expire(key, window)
            
            results = pipe.execute()
            current_count = results[1]
            
            if current_count >= limit:
                return False, 0
            
            return True, limit - current_count - 1
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fail open - allow request on error
            return True, None
    
    def sliding_window_rate_limit(
        self,
        key: str,
        limit: int,
        window: int,
        identifier: str = None
    ) -> Tuple[bool, Optional[int], Optional[int]]:
        """
        Sliding window rate limiting
        
        Returns:
            (allowed, remaining_requests, reset_time)
        """
        if identifier:
            key = f"rate_limit:sliding:{key}:{identifier}"
        else:
            key = f"rate_limit:sliding:{key}"
        
        try:
            now = time.time()
            window_start = now - window
            
            # Use Lua script for atomic operation
            lua_script = """
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local limit = tonumber(ARGV[3])
            local window_start = now - window
            
            -- Remove old entries
            redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
            
            -- Count current entries
            local current = redis.call('ZCARD', key)
            
            if current < limit then
                -- Add entry
                redis.call('ZADD', key, now, now)
                redis.call('EXPIRE', key, window)
                return {1, limit - current - 1, 0}
            else
                -- Get oldest entry for reset time
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                local reset_time = oldest[2] + window
                return {0, 0, reset_time}
            end
            """
            
            result = self.redis.eval(
                lua_script,
                1,
                key,
                now,
                window,
                limit
            )
            
            allowed = bool(result[0])
            remaining = result[1]
            reset_time = result[2] if not allowed else None
            
            return allowed, remaining, reset_time
            
        except Exception as e:
            logger.error(f"Sliding window rate limit failed: {e}")
            return True, None, None

# Global rate limiter instance
rate_limiter = RateLimiter()

def rate_limit_decorator(key: str, limit: int = 100, window: int = 3600):
    """Decorator for rate limiting functions"""
    def decorator(func):
        def wrapper(identifier: str = None, *args, **kwargs):
            allowed, remaining = rate_limiter.check_rate_limit(
                key, limit, window, identifier
            )
            
            if not allowed:
                raise Exception(f"Rate limit exceeded for {key}")
            
            return func(*args, **kwargs)
        
        return wrapper
    return decorator
`
    });

    // Distributed locking
    templates.push({
      path: 'src/services/distributed_lock.py',
      content: `import uuid
import time
from typing import Optional, Any
from contextlib import contextmanager
from ..config.redis import get_redis_client
import logging

logger = logging.getLogger(__name__)

class DistributedLock:
    """Redis-based distributed locking"""
    
    def __init__(self):
        self.redis = get_redis_client()
        self.default_timeout = 30  # seconds
    
    def acquire_lock(
        self,
        key: str,
        timeout: int = None,
        blocking: bool = True,
        blocking_timeout: int = 10
    ) -> Optional[str]:
        """
        Acquire a distributed lock
        
        Args:
            key: Lock key
            timeout: Lock timeout in seconds
            blocking: Whether to wait for lock
            blocking_timeout: How long to wait
        
        Returns:
            Lock token if acquired, None otherwise
        """
        lock_key = f"lock:{key}"
        lock_token = str(uuid.uuid4())
        timeout = timeout or self.default_timeout
        
        end_time = time.time() + blocking_timeout
        
        while True:
            # Try to acquire lock
            acquired = self.redis.set(
                lock_key,
                lock_token,
                nx=True,
                ex=timeout
            )
            
            if acquired:
                logger.debug(f"Acquired lock {key}")
                return lock_token
            
            if not blocking or time.time() > end_time:
                logger.debug(f"Failed to acquire lock {key}")
                return None
            
            # Wait before retry
            time.sleep(0.1)
    
    def release_lock(self, key: str, token: str) -> bool:
        """Release a distributed lock"""
        lock_key = f"lock:{key}"
        
        # Use Lua script to ensure atomic release
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        
        try:
            result = self.redis.eval(lua_script, 1, lock_key, token)
            if result:
                logger.debug(f"Released lock {key}")
            return bool(result)
        except Exception as e:
            logger.error(f"Failed to release lock {key}: {e}")
            return False
    
    def extend_lock(self, key: str, token: str, timeout: int = None) -> bool:
        """Extend lock timeout"""
        lock_key = f"lock:{key}"
        timeout = timeout or self.default_timeout
        
        # Use Lua script to ensure atomic extension
        lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        
        try:
            result = self.redis.eval(lua_script, 1, lock_key, token, timeout)
            return bool(result)
        except Exception as e:
            logger.error(f"Failed to extend lock {key}: {e}")
            return False
    
    @contextmanager
    def lock(
        self,
        key: str,
        timeout: int = None,
        blocking: bool = True,
        blocking_timeout: int = 10
    ):
        """Context manager for distributed locking"""
        token = self.acquire_lock(key, timeout, blocking, blocking_timeout)
        
        if not token:
            raise Exception(f"Could not acquire lock for {key}")
        
        try:
            yield token
        finally:
            self.release_lock(key, token)

# Global lock manager instance
lock_manager = DistributedLock()

def with_lock(key: str, timeout: int = 30):
    """Decorator for functions requiring distributed lock"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            with lock_manager.lock(key, timeout):
                return func(*args, **kwargs)
        return wrapper
    return decorator
`
    });

    // Pub/Sub messaging
    templates.push({
      path: 'src/services/pubsub.py',
      content: `import json
import threading
from typing import Callable, Any, Dict
from ..config.redis import get_redis_client
import logging

logger = logging.getLogger(__name__)

class PubSubManager:
    """Redis pub/sub messaging"""
    
    def __init__(self):
        self.redis = get_redis_client()
        self.pubsub = None
        self.thread = None
        self.handlers: Dict[str, list[Callable]] = {}
        self.running = False
    
    def publish(self, channel: str, message: Any) -> int:
        """Publish message to channel"""
        try:
            if isinstance(message, (dict, list)):
                message = json.dumps(message)
            
            count = self.redis.publish(channel, message)
            logger.debug(f"Published to {channel}, {count} subscribers")
            return count
        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")
            return 0
    
    def subscribe(self, channel: str, handler: Callable) -> None:
        """Subscribe to channel with handler"""
        if channel not in self.handlers:
            self.handlers[channel] = []
        
        self.handlers[channel].append(handler)
        
        # Start listener if not running
        if not self.running:
            self.start()
        
        # Subscribe to channel
        if self.pubsub:
            self.pubsub.subscribe(channel)
            logger.info(f"Subscribed to channel: {channel}")
    
    def unsubscribe(self, channel: str, handler: Callable = None) -> None:
        """Unsubscribe from channel"""
        if channel in self.handlers:
            if handler:
                self.handlers[channel].remove(handler)
                if not self.handlers[channel]:
                    del self.handlers[channel]
                    if self.pubsub:
                        self.pubsub.unsubscribe(channel)
            else:
                del self.handlers[channel]
                if self.pubsub:
                    self.pubsub.unsubscribe(channel)
            
            logger.info(f"Unsubscribed from channel: {channel}")
    
    def start(self) -> None:
        """Start the pub/sub listener"""
        if self.running:
            return
        
        self.running = True
        self.pubsub = self.redis.pubsub()
        
        # Subscribe to all registered channels
        for channel in self.handlers:
            self.pubsub.subscribe(channel)
        
        # Start listener thread
        self.thread = threading.Thread(target=self._listener)
        self.thread.daemon = True
        self.thread.start()
        
        logger.info("Started pub/sub listener")
    
    def stop(self) -> None:
        """Stop the pub/sub listener"""
        self.running = False
        
        if self.pubsub:
            self.pubsub.close()
            self.pubsub = None
        
        if self.thread:
            self.thread.join(timeout=5)
            self.thread = None
        
        logger.info("Stopped pub/sub listener")
    
    def _listener(self) -> None:
        """Listen for messages"""
        try:
            for message in self.pubsub.listen():
                if not self.running:
                    break
                
                if message['type'] == 'message':
                    channel = message['channel'].decode('utf-8')
                    data = message['data'].decode('utf-8')
                    
                    # Try to parse JSON
                    try:
                        data = json.loads(data)
                    except:
                        pass
                    
                    # Call handlers
                    if channel in self.handlers:
                        for handler in self.handlers[channel]:
                            try:
                                handler(channel, data)
                            except Exception as e:
                                logger.error(f"Handler error for {channel}: {e}")
        
        except Exception as e:
            logger.error(f"Pub/sub listener error: {e}")
            self.running = False

# Global pub/sub manager
pubsub_manager = PubSubManager()

# Convenience decorators
def on_message(channel: str):
    """Decorator to register message handler"""
    def decorator(func):
        pubsub_manager.subscribe(channel, func)
        return func
    return decorator

def publish_event(channel: str, event_type: str = None):
    """Decorator to publish function results"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            message = {
                'type': event_type or func.__name__,
                'data': result,
                'timestamp': time.time()
            }
            
            pubsub_manager.publish(channel, message)
            return result
        
        return wrapper
    return decorator
`
    });

    // Docker configuration
    templates.push({
      path: 'docker-compose.yml',
      content: `version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: ${config.projectName}_redis
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    command: >
      redis-server
      --save 60 1
      --save 300 10
      --save 900 100
      --loglevel warning
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: ${config.projectName}_redis_commander
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "\${REDIS_COMMANDER_PORT:-8081}:8081"
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis_data:
`
    });

    // Environment variables
    templates.push({
      path: '.env.example',
      content: `# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
REDIS_SSL=false
REDIS_MAX_CONNECTIONS=50
REDIS_SOCKET_TIMEOUT=5
REDIS_SOCKET_CONNECT_TIMEOUT=5

# Redis Session Settings
REDIS_SESSION_PREFIX=session:
REDIS_SESSION_TTL=86400  # 24 hours

# Redis Cache Settings
REDIS_CACHE_PREFIX=cache:
REDIS_CACHE_TTL=3600  # 1 hour

# Redis Commander (Web UI)
REDIS_COMMANDER_PORT=8081
`
    });

    // Usage examples
    templates.push({
      path: 'examples/redis_usage.py',
      content: `"""
Redis Integration Usage Examples
"""

# Session Management
from src.services.session import session_manager

# Create a session
session_id = session_manager.create_session(
    user_id="user123",
    data={
        "name": "John Doe",
        "email": "john@example.com",
        "roles": ["user", "admin"]
    }
)

# Get session
session = session_manager.get_session(session_id)
print(f"User: {session['data']['name']}")

# Update session
session_manager.update_session(session_id, {
    "last_page": "/dashboard",
    "preferences": {"theme": "dark"}
})

# Cache Management
from src.services.cache import cache_manager, cached

# Basic caching
cache_manager.set("user:123", {"name": "John", "email": "john@example.com"})
user = cache_manager.get("user:123")

# Using decorator
@cached(ttl=300, key_prefix="weather")
def get_weather(city: str):
    # Expensive API call
    return {"temp": 72, "conditions": "sunny"}

# Atomic operations
views = cache_manager.increment("page:home:views")
cache_manager.decrement("inventory:item123", delta=5)

# Rate Limiting
from src.services.rate_limit import rate_limiter, rate_limit_decorator

# Check rate limit
allowed, remaining = rate_limiter.check_rate_limit(
    key="api:search",
    limit=100,
    window=3600,
    identifier="user123"
)

if allowed:
    print(f"Request allowed, {remaining} remaining")
else:
    print("Rate limit exceeded")

# Using decorator
@rate_limit_decorator(key="expensive_operation", limit=10, window=60)
def expensive_operation():
    return "result"

# Distributed Locking
from src.services.distributed_lock import lock_manager, with_lock

# Manual lock
token = lock_manager.acquire_lock("resource:123", timeout=30)
if token:
    try:
        # Do work with exclusive access
        pass
    finally:
        lock_manager.release_lock("resource:123", token)

# Using context manager
with lock_manager.lock("resource:456", timeout=60):
    # Exclusive access to resource
    pass

# Using decorator
@with_lock("shared_resource", timeout=30)
def update_shared_resource():
    # This function will acquire lock before executing
    pass

# Pub/Sub Messaging
from src.services.pubsub import pubsub_manager, on_message, publish_event

# Subscribe to events
@on_message("user:events")
def handle_user_event(channel, message):
    print(f"User event: {message}")

# Publish events
pubsub_manager.publish("user:events", {
    "type": "login",
    "user_id": "123",
    "timestamp": time.time()
})

# Using decorator
@publish_event("system:events", event_type="cache_cleared")
def clear_cache():
    cache_manager.clear_pattern("temp:*")
    return {"cleared": 42}

# Framework-specific examples

# FastAPI
from fastapi import FastAPI, Request
from src.middleware.session import SessionMiddleware, get_session
from src.middleware.cache import CacheMiddleware

app = FastAPI()
app.add_middleware(SessionMiddleware)
app.add_middleware(CacheMiddleware, ttl=300)

@app.get("/profile")
async def get_profile(request: Request):
    session = get_session(request)
    if not session:
        return {"error": "Not logged in"}
    return {"user": session['data']}

# Django
# In settings.py
MIDDLEWARE = [
    'middleware.session.RedisSessionMiddleware',
    'middleware.session.RedisCacheMiddleware',
    # ... other middleware
]

# In views.py
def profile_view(request):
    if request.redis_session:
        return JsonResponse({"user": request.redis_session['data']})
    return JsonResponse({"error": "Not logged in"})

# Flask
from flask import Flask, g
from src.extensions.session import FlaskRedisSession, FlaskRedisCache, login_required

app = Flask(__name__)
redis_session = FlaskRedisSession(app)
redis_cache = FlaskRedisCache(app)

@app.route('/profile')
@login_required
def profile():
    return {"user": g.session['data']}

@app.route('/weather/<city>')
@FlaskRedisCache.cached(ttl=600)
def weather(city):
    # This will be cached for 10 minutes
    return get_weather_data(city)
`
    });

    return templates;
  }
}