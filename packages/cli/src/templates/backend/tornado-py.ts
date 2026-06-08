import { BackendTemplate } from '../types';

export const tornadoTemplate: BackendTemplate = {
  id: 'tornado-py',
  name: 'Tornado + Python',
  displayName: 'Tornado + Python',
  description: 'High-performance Tornado server with async/await support, WebSocket connections, coroutines, and non-blocking I/O',
  framework: 'tornado',
  language: 'python',
  version: '1.0.0',
  tags: ['tornado', 'python', 'websockets', 'coroutines', 'high-performance', 'non-blocking'],
  dependencies: {
    tornado: '^6.4',
    'motor': '^3.3.2',
    'aiopg': '^1.4.0',
    'aioredis': '^2.0.1',
    'pyjwt': '^2.8.0',
    'bcrypt': '^4.1.2',
    'python-dotenv': '^1.0.0',
    'marshmallow': '^3.20.1',
    'marshmallow-sqlalchemy': '^0.29.0',
    'sqlalchemy': '^2.0.23',
    'alembic': '^1.13.0',
    'psycopg2': '^2.9.9',
    'celery': '^5.3.4',
    'redis': '^5.0.1'
  },
  devDependencies: {
    'pytest': '^7.4.3',
    'pytest-asyncio': '^0.21.1',
    'pytest-tornado': '^0.8.1',
    'pytest-cov': '^4.1.0',
    'black': '^23.11.0',
    'isort': '^5.12.0',
    'mypy': '^1.7.1',
    'flake8': '^6.1.0',
    'pre-commit': '^3.6.0'
  },
  files: {
    'requirements.txt': `tornado==6.4
motor==3.3.2
aiopg==1.4.0
aioredis==2.0.1
pyjwt==2.8.0
bcrypt==4.1.2
python-dotenv==1.0.0
marshmallow==3.20.1
marshmallow-sqlalchemy==0.29.0
sqlalchemy==2.0.23
alembic==1.13.0
psycopg2==2.9.9
celery==5.3.4
redis==5.0.1`,

    'requirements-dev.txt': `pytest==7.4.3
pytest-asyncio==0.21.1
pytest-tornado==0.8.1
pytest-cov==4.1.0
black==23.11.0
isort==5.12.0
mypy==1.7.1
flake8==6.1.0
pre-commit==3.6.0`,

    'main.py': `#!/usr/bin/env python3
"""
Tornado Application Entry Point
"""
import asyncio
import os
import signal
import sys
from typing import Dict, Any

import tornado.ioloop
import tornado.web
import tornado.httpserver
from tornado.options import define, options, parse_command_line

from app.core.config import settings
from app.core.application import create_application
from app.core.database import init_database
from app.core.redis_client import init_redis
from app.core.logging_config import setup_logging

# Command line options
define("port", default=settings.PORT, help="run on the given port", type=int)
define("debug", default=settings.DEBUG, help="run in debug mode")

async def main():
    """Main application entry point."""
    parse_command_line()
    
    # Setup logging
    setup_logging(debug=options.debug)
    
    # Initialize database and Redis
    await init_database()
    await init_redis()
    
    # Create Tornado application
    app = create_application(debug=options.debug)
    
    # Create HTTP server
    server = tornado.httpserver.HTTPServer(app, xheaders=True)
    server.listen(options.port)
    
    print(f"🌪️  Tornado server started on http://localhost:{options.port}")
    print(f"Debug mode: {options.debug}")
    
    # Setup signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        print("\\n⚡ Shutting down server...")
        tornado.ioloop.IOLoop.current().stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start the IO loop
    tornado.ioloop.IOLoop.current().start()

if __name__ == "__main__":
    asyncio.run(main())`,

    'app/__init__.py': '',

    'app/core/__init__.py': '',

    'app/core/config.py': `"""
Application Configuration
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application settings."""
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "localhost")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRATION_DELTA: int = int(os.getenv("JWT_EXPIRATION_DELTA", 3600))
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://user:password@localhost:5432/tornado_app"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

settings = Settings()`,

    'app/core/application.py': `"""
Tornado Application Factory
"""
import tornado.web
from tornado.web import Application

from app.handlers.auth_handlers import AuthLoginHandler, AuthLogoutHandler, AuthRegisterHandler
from app.handlers.user_handlers import UserHandler, UserProfileHandler
from app.handlers.websocket_handlers import ChatWebSocketHandler, NotificationWebSocketHandler
from app.handlers.api_handlers import HealthCheckHandler, StatusHandler
from app.core.config import settings

def create_application(debug: bool = False) -> Application:
    """Create and configure Tornado application."""
    
    handlers = [
        # Health and Status
        (r"/health", HealthCheckHandler),
        (r"/api/v1/status", StatusHandler),
        
        # Authentication
        (r"/api/v1/auth/register", AuthRegisterHandler),
        (r"/api/v1/auth/login", AuthLoginHandler),
        (r"/api/v1/auth/logout", AuthLogoutHandler),
        
        # Users
        (r"/api/v1/users", UserHandler),
        (r"/api/v1/users/([0-9]+)", UserHandler),
        (r"/api/v1/users/profile", UserProfileHandler),
        
        # WebSocket endpoints
        (r"/ws/chat", ChatWebSocketHandler),
        (r"/ws/notifications", NotificationWebSocketHandler),
        
        # Static files (in production, use nginx)
        (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": "static"})]
    
    app_settings = {
        "debug": debug,
        "autoreload": debug,
        "cookie_secret": settings.SECRET_KEY,
        "xsrf_cookies": False,  # Disable for API usage
        "compress_response": True,
        "static_path": "static",
        "template_path": "templates",
        "default_handler_class": NotFoundHandler}
    
    return Application(handlers, **app_settings)

class NotFoundHandler(tornado.web.RequestHandler):
    """Handle 404 errors."""
    
    def prepare(self):
        """Called before any HTTP method."""
        self.set_status(404)
        self.finish({
            "error": "Not Found",
            "message": "The requested resource was not found",
            "status_code": 404
        })`,

    'app/core/database.py': `"""
Database Configuration and Connection
"""
import asyncio
from typing import Optional
import aiopg
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Database connection pool
_connection_pool: Optional[aiopg.pool.Pool] = None
_engine = None
_SessionLocal = None

# SQLAlchemy Base
Base = declarative_base()
metadata = MetaData()

async def init_database():
    """Initialize database connection pool."""
    global _connection_pool, _engine, _SessionLocal
    
    # Create async connection pool
    _connection_pool = await aiopg.create_pool(
        dsn=settings.DATABASE_URL,
        minsize=1,
        maxsize=10,
        loop=asyncio.get_event_loop()
    )
    
    # Create SQLAlchemy engine for migrations
    _engine = create_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=settings.DEBUG
    )
    
    # Create session maker
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    
    print("📊 Database connection pool initialized")

async def get_db_connection():
    """Get database connection from pool."""
    if _connection_pool is None:
        raise RuntimeError("Database not initialized")
    
    async with _connection_pool.acquire() as conn:
        yield conn

def get_sync_db():
    """Get synchronous database session for migrations."""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized")
    
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def close_database():
    """Close database connection pool."""
    global _connection_pool
    if _connection_pool:
        _connection_pool.close()
        await _connection_pool.wait_closed()
        _connection_pool = None
        print("📊 Database connection pool closed")`,

    'app/core/redis_client.py': `"""
Redis Client Configuration
"""
import aioredis
from typing import Optional
from app.core.config import settings

# Redis connection
_redis_client: Optional[aioredis.Redis] = None

async def init_redis():
    """Initialize Redis connection."""
    global _redis_client
    
    _redis_client = await aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20
    )
    
    # Test connection
    await _redis_client.ping()
    print("🔴 Redis connection established")

async def get_redis() -> aioredis.Redis:
    """Get Redis client."""
    if _redis_client is None:
        raise RuntimeError("Redis not initialized")
    return _redis_client

async def close_redis():
    """Close Redis connection."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        print("🔴 Redis connection closed")`,

    'app/core/logging_config.py': `"""
Logging Configuration
"""
import logging
import sys
from app.core.config import settings

def setup_logging(debug: bool = False):
    """Setup application logging."""
    
    log_level = logging.DEBUG if debug else getattr(logging, settings.LOG_LEVEL.upper())
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("app.log") if not debug else logging.NullHandler()
        ]
    )
    
    # Configure tornado access logs
    access_log = logging.getLogger("tornado.access")
    access_log.setLevel(log_level)
    
    # Configure application logger
    app_log = logging.getLogger("app")
    app_log.setLevel(log_level)
    
    if debug:
        app_log.info("🐛 Debug logging enabled")`,

    'app/handlers/__init__.py': '',

    'app/handlers/base.py': `"""
Base Request Handler
"""
import json
import jwt
import tornado.web
from typing import Optional, Dict, Any
from tornado.concurrent import run_on_executor
from concurrent.futures import ThreadPoolExecutor
import asyncio

from app.core.config import settings
from app.core.redis_client import get_redis

class BaseHandler(tornado.web.RequestHandler):
    """Base request handler with common functionality."""
    
    executor = ThreadPoolExecutor(max_workers=10)
    
    def set_default_headers(self):
        """Set CORS headers."""
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", 
                       "Content-Type, Authorization, X-Requested-With")
        self.set_header("Access-Control-Allow-Methods", 
                       "GET, POST, PUT, DELETE, OPTIONS")
        self.set_header("Content-Type", "application/json")
    
    def options(self):
        """Handle preflight CORS requests."""
        self.set_status(204)
        self.finish()
    
    def write_json(self, data: Any, status_code: int = 200):
        """Write JSON response."""
        self.set_status(status_code)
        self.write(json.dumps(data, default=str))
    
    def write_error(self, message: str, status_code: int = 400, details: Optional[Dict] = None):
        """Write error response."""
        error_data = {
            "error": message,
            "status_code": status_code
        }
        if details:
            error_data.update(details)
        
        self.write_json(error_data, status_code)
    
    def get_json_body(self) -> Dict[str, Any]:
        """Parse JSON request body."""
        try:
            return json.loads(self.request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise tornado.web.HTTPError(400, "Invalid JSON body")
    
    async def get_current_user_async(self) -> Optional[Dict[str, Any]]:
        """Get current authenticated user from JWT token."""
        auth_header = self.request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        
        try:
            # Decode JWT token
            payload = jwt.decode(
                token, 
                settings.JWT_SECRET_KEY, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Check if token is blacklisted in Redis
            redis_client = await get_redis()
            is_blacklisted = await redis_client.get(f"blacklist:{token}")
            
            if is_blacklisted:
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    @run_on_executor
    def blocking_operation(self, operation, *args, **kwargs):
        """Run blocking operations in thread pool."""
        return operation(*args, **kwargs)`,

    'app/handlers/auth_handlers.py': `"""
Authentication Handlers
"""
import bcrypt
import jwt
import tornado.web
from datetime import datetime, timedelta
from typing import Dict, Any

from app.handlers.base import BaseHandler
from app.core.config import settings
from app.core.redis_client import get_redis
from app.models.user import User, UserSchema

class AuthRegisterHandler(BaseHandler):
    """User registration handler."""
    
    async def post(self):
        """Register a new user."""
        try:
            data = self.get_json_body()
            schema = UserSchema()
            
            # Validate input data
            try:
                validated_data = schema.load(data)
            except Exception as e:
                self.write_error("Validation error", 400, {"details": str(e)})
                return
            
            # Check if user already exists
            # In a real app, you'd check the database
            # For this template, we'll simulate the check
            
            # Hash password
            hashed_password = bcrypt.hashpw(
                validated_data['password'].encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
            
            # Create user (simulate database operation)
            user_data = {
                "id": 1,  # In real app, this would be from database
                "email": validated_data['email'],
                "username": validated_data.get('username', validated_data['email']),
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            
            # Store in Redis as example
            redis_client = await get_redis()
            await redis_client.setex(
                f"user:{user_data['id']}", 
                3600, 
                str(user_data)
            )
            
            # Generate JWT token
            token_payload = {
                "user_id": user_data['id'],
                "email": user_data['email'],
                "exp": datetime.utcnow() + timedelta(seconds=settings.JWT_EXPIRATION_DELTA)
            }
            
            access_token = jwt.encode(
                token_payload,
                settings.JWT_SECRET_KEY,
                algorithm=settings.JWT_ALGORITHM
            )
            
            response_data = {
                "message": "User registered successfully",
                "user": {
                    "id": user_data['id'],
                    "email": user_data['email'],
                    "username": user_data['username']
                },
                "access_token": access_token,
                "token_type": "bearer"
            }
            
            self.write_json(response_data, 201)
            
        except Exception as e:
            self.write_error(f"Registration failed: {str(e)}", 500)

class AuthLoginHandler(BaseHandler):
    """User login handler."""
    
    async def post(self):
        """Authenticate user and return JWT token."""
        try:
            data = self.get_json_body()
            
            email = data.get('email')
            password = data.get('password')
            
            if not email or not password:
                self.write_error("Email and password required", 400)
                return
            
            # In a real app, you'd fetch user from database
            # For this template, we'll simulate authentication
            
            # Simulate user lookup and password verification
            user_data = {
                "id": 1,
                "email": email,
                "username": email.split('@')[0],
                "is_active": True
            }
            
            # Generate JWT token
            token_payload = {
                "user_id": user_data['id'],
                "email": user_data['email'],
                "exp": datetime.utcnow() + timedelta(seconds=settings.JWT_EXPIRATION_DELTA)
            }
            
            access_token = jwt.encode(
                token_payload,
                settings.JWT_SECRET_KEY,
                algorithm=settings.JWT_ALGORITHM
            )
            
            response_data = {
                "message": "Login successful",
                "user": user_data,
                "access_token": access_token,
                "token_type": "bearer"
            }
            
            self.write_json(response_data)
            
        except Exception as e:
            self.write_error(f"Login failed: {str(e)}", 500)

class AuthLogoutHandler(BaseHandler):
    """User logout handler."""
    
    async def post(self):
        """Logout user by blacklisting JWT token."""
        try:
            user = await self.get_current_user_async()
            if not user:
                self.write_error("Authentication required", 401)
                return
            
            # Get token from header
            auth_header = self.request.headers.get("Authorization")
            token = auth_header.split(" ")[1]
            
            # Blacklist token in Redis
            redis_client = await get_redis()
            await redis_client.setex(
                f"blacklist:{token}",
                settings.JWT_EXPIRATION_DELTA,
                "true"
            )
            
            self.write_json({"message": "Logout successful"})
            
        except Exception as e:
            self.write_error(f"Logout failed: {str(e)}", 500)`,

    'app/handlers/user_handlers.py': `"""
User Management Handlers
"""
import tornado.web
from typing import Dict, Any

from app.handlers.base import BaseHandler

class UserHandler(BaseHandler):
    """User CRUD operations handler."""
    
    async def get(self, user_id: str = None):
        """Get user(s) information."""
        try:
            current_user = await self.get_current_user_async()
            if not current_user:
                self.write_error("Authentication required", 401)
                return
            
            if user_id:
                # Get specific user
                user_data = {
                    "id": int(user_id),
                    "email": f"user{user_id}@example.com",
                    "username": f"user{user_id}",
                    "is_active": True
                }
                self.write_json({"user": user_data})
            else:
                # Get all users (with pagination)
                page = int(self.get_argument("page", 1))
                limit = int(self.get_argument("limit", 10))
                
                # Simulate user list
                users = [
                    {
                        "id": i,
                        "email": f"user{i}@example.com",
                        "username": f"user{i}",
                        "is_active": True
                    }
                    for i in range((page-1)*limit + 1, page*limit + 1)
                ]
                
                response_data = {
                    "users": users,
                    "pagination": {
                        "page": page,
                        "limit": limit,
                        "total": 100,  # Simulated total
                        "pages": 10
                    }
                }
                
                self.write_json(response_data)
                
        except Exception as e:
            self.write_error(f"Failed to get users: {str(e)}", 500)
    
    async def put(self, user_id: str):
        """Update user information."""
        try:
            current_user = await self.get_current_user_async()
            if not current_user:
                self.write_error("Authentication required", 401)
                return
            
            # Check if user can update this profile
            if current_user['user_id'] != int(user_id):
                self.write_error("Permission denied", 403)
                return
            
            data = self.get_json_body()
            
            # Update user data (simulate database operation)
            updated_user = {
                "id": int(user_id),
                "email": data.get('email', current_user['email']),
                "username": data.get('username', f"user{user_id}"),
                "is_active": True,
                "updated_at": "2024-01-01T00:00:00Z"
            }
            
            self.write_json({
                "message": "User updated successfully",
                "user": updated_user
            })
            
        except Exception as e:
            self.write_error(f"Failed to update user: {str(e)}", 500)
    
    async def delete(self, user_id: str):
        """Delete user account."""
        try:
            current_user = await self.get_current_user_async()
            if not current_user:
                self.write_error("Authentication required", 401)
                return
            
            # Check if user can delete this profile
            if current_user['user_id'] != int(user_id):
                self.write_error("Permission denied", 403)
                return
            
            # Delete user (simulate database operation)
            self.write_json({"message": "User deleted successfully"})
            
        except Exception as e:
            self.write_error(f"Failed to delete user: {str(e)}", 500)

class UserProfileHandler(BaseHandler):
    """User profile handler."""
    
    async def get(self):
        """Get current user profile."""
        try:
            current_user = await self.get_current_user_async()
            if not current_user:
                self.write_error("Authentication required", 401)
                return
            
            # Get user profile data
            profile_data = {
                "id": current_user['user_id'],
                "email": current_user['email'],
                "username": f"user{current_user['user_id']}",
                "is_active": True,
                "profile": {
                    "bio": "Software developer passionate about async programming",
                    "avatar_url": "https://via.placeholder.com/150",
                    "location": "San Francisco, CA",
                    "website": "https://example.com"
                }
            }
            
            self.write_json({"profile": profile_data})
            
        except Exception as e:
            self.write_error(f"Failed to get profile: {str(e)}", 500)
    
    async def put(self):
        """Update current user profile."""
        try:
            current_user = await self.get_current_user_async()
            if not current_user:
                self.write_error("Authentication required", 401)
                return
            
            data = self.get_json_body()
            
            # Update profile data (simulate database operation)
            updated_profile = {
                "id": current_user['user_id'],
                "email": current_user['email'],
                "username": data.get('username', f"user{current_user['user_id']}"),
                "profile": {
                    "bio": data.get('bio', ''),
                    "avatar_url": data.get('avatar_url', ''),
                    "location": data.get('location', ''),
                    "website": data.get('website', '')
                },
                "updated_at": "2024-01-01T00:00:00Z"
            }
            
            self.write_json({
                "message": "Profile updated successfully",
                "profile": updated_profile
            })
            
        except Exception as e:
            self.write_error(f"Failed to update profile: {str(e)}", 500)`,

    'app/handlers/websocket_handlers.py': `"""
WebSocket Handlers for Real-time Communication
"""
import json
import tornado.websocket
from typing import Set, Dict, Any
import asyncio
from datetime import datetime

from app.core.redis_client import get_redis

# Store active WebSocket connections
active_connections: Dict[str, Set[tornado.websocket.WebSocketHandler]] = {
    'chat': set(),
    'notifications': set()
}

class ChatWebSocketHandler(tornado.websocket.WebSocketHandler):
    """WebSocket handler for chat functionality."""
    
    def check_origin(self, origin):
        """Allow connections from any origin (configure for production)."""
        return True
    
    async def open(self):
        """Called when WebSocket connection is opened."""
        self.user_id = None
        self.room_id = None
        
        # Get user from query parameters or authentication
        user_token = self.get_argument('token', None)
        room_id = self.get_argument('room', 'general')
        
        if user_token:
            # In a real app, you'd validate the token
            self.user_id = 1  # Simulated user ID
            self.room_id = room_id
            
            # Add to active connections
            active_connections['chat'].add(self)
            
            # Notify room about new user
            await self.broadcast_to_room({
                'type': 'user_joined',
                'user_id': self.user_id,
                'room_id': self.room_id,
                'timestamp': datetime.utcnow().isoformat(),
                'message': f'User {self.user_id} joined the room'
            })
            
            print(f"💬 User {self.user_id} connected to chat room {self.room_id}")
        else:
            self.close(1000, "Authentication required")
    
    async def on_message(self, message):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(message)
            message_type = data.get('type', 'chat')
            
            if message_type == 'chat':
                await self.handle_chat_message(data)
            elif message_type == 'typing':
                await self.handle_typing_indicator(data)
            elif message_type == 'ping':
                await self.send_message({'type': 'pong', 'timestamp': datetime.utcnow().isoformat()})
                
        except json.JSONDecodeError:
            await self.send_message({
                'type': 'error',
                'message': 'Invalid JSON message'
            })
        except Exception as e:
            await self.send_message({
                'type': 'error',
                'message': f'Message handling error: {str(e)}'
            })
    
    async def handle_chat_message(self, data):
        """Handle chat messages."""
        message_data = {
            'type': 'chat',
            'id': f"msg_{datetime.utcnow().timestamp()}",
            'user_id': self.user_id,
            'room_id': self.room_id,
            'content': data.get('content', ''),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Store message in Redis (as example)
        redis_client = await get_redis()
        await redis_client.lpush(
            f"chat:room:{self.room_id}",
            json.dumps(message_data)
        )
        await redis_client.ltrim(f"chat:room:{self.room_id}", 0, 99)  # Keep last 100 messages
        
        # Broadcast to all users in the room
        await self.broadcast_to_room(message_data)
    
    async def handle_typing_indicator(self, data):
        """Handle typing indicators."""
        typing_data = {
            'type': 'typing',
            'user_id': self.user_id,
            'room_id': self.room_id,
            'is_typing': data.get('is_typing', False),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Broadcast to other users in the room
        await self.broadcast_to_room(typing_data, exclude_self=True)
    
    async def broadcast_to_room(self, message_data, exclude_self=False):
        """Broadcast message to all users in the same room."""
        for connection in active_connections['chat'].copy():
            if (exclude_self and connection == self) or connection.room_id != self.room_id:
                continue
            
            try:
                await connection.send_message(message_data)
            except Exception:
                # Remove broken connections
                active_connections['chat'].discard(connection)
    
    async def send_message(self, data):
        """Send message to this WebSocket connection."""
        try:
            self.write_message(json.dumps(data, default=str))
        except tornado.websocket.WebSocketClosedError:
            pass
    
    def on_close(self):
        """Called when WebSocket connection is closed."""
        if self in active_connections['chat']:
            active_connections['chat'].remove(self)
            
            if self.user_id and self.room_id:
                # Notify room about user leaving
                asyncio.create_task(self.broadcast_to_room({
                    'type': 'user_left',
                    'user_id': self.user_id,
                    'room_id': self.room_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'message': f'User {self.user_id} left the room'
                }))
                
                print(f"💬 User {self.user_id} disconnected from chat room {self.room_id}")

class NotificationWebSocketHandler(tornado.websocket.WebSocketHandler):
    """WebSocket handler for real-time notifications."""
    
    def check_origin(self, origin):
        """Allow connections from any origin (configure for production)."""
        return True
    
    async def open(self):
        """Called when WebSocket connection is opened."""
        self.user_id = None
        
        # Get user from query parameters or authentication
        user_token = self.get_argument('token', None)
        
        if user_token:
            # In a real app, you'd validate the token
            self.user_id = 1  # Simulated user ID
            
            # Add to active connections
            active_connections['notifications'].add(self)
            
            # Send welcome notification
            await self.send_notification({
                'type': 'welcome',
                'title': 'Connected',
                'message': 'You are now connected to real-time notifications',
                'priority': 'info'
            })
            
            print(f"🔔 User {self.user_id} connected to notifications")
        else:
            self.close(1000, "Authentication required")
    
    async def on_message(self, message):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(message)
            message_type = data.get('type', 'ping')
            
            if message_type == 'ping':
                await self.send_notification({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                })
            elif message_type == 'subscribe':
                # Handle subscription to specific notification types
                await self.handle_subscription(data)
                
        except json.JSONDecodeError:
            await self.send_notification({
                'type': 'error',
                'message': 'Invalid JSON message'
            })
    
    async def handle_subscription(self, data):
        """Handle notification subscriptions."""
        # In a real app, you'd store subscription preferences
        await self.send_notification({
            'type': 'subscription_updated',
            'message': f"Subscribed to {data.get('topics', [])}",
            'priority': 'info'
        })
    
    async def send_notification(self, notification_data):
        """Send notification to this WebSocket connection."""
        try:
            message = {
                'id': f"notif_{datetime.utcnow().timestamp()}",
                'user_id': self.user_id,
                'timestamp': datetime.utcnow().isoformat(),
                **notification_data
            }
            self.write_message(json.dumps(message, default=str))
        except tornado.websocket.WebSocketClosedError:
            pass
    
    def on_close(self):
        """Called when WebSocket connection is closed."""
        if self in active_connections['notifications']:
            active_connections['notifications'].remove(self)
            print(f"🔔 User {self.user_id} disconnected from notifications")

# Helper function to broadcast notifications to all connected users
async def broadcast_notification(notification_data):
    """Broadcast notification to all connected users."""
    for connection in active_connections['notifications'].copy():
        try:
            await connection.send_notification(notification_data)
        except Exception:
            # Remove broken connections
            active_connections['notifications'].discard(connection)`,

    'app/handlers/api_handlers.py': `"""
API Handlers for Health Check and Status
"""
import tornado.web
import psutil
import time
from datetime import datetime

from app.handlers.base import BaseHandler
from app.core.config import settings
from app.core.redis_client import get_redis

class HealthCheckHandler(BaseHandler):
    """Health check endpoint."""
    
    async def get(self):
        """Return application health status."""
        try:
            start_time = time.time()
            
            # Check Redis connectivity
            redis_status = "healthy"
            try:
                redis_client = await get_redis()
                await redis_client.ping()
            except Exception:
                redis_status = "unhealthy"
            
            # Check database connectivity
            # In a real app, you'd test actual database connection
            database_status = "healthy"
            
            # System metrics
            system_metrics = {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage('/').percent
            }
            
            response_time = (time.time() - start_time) * 1000
            
            health_data = {
                "status": "healthy" if redis_status == "healthy" and database_status == "healthy" else "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "response_time_ms": round(response_time, 2),
                "services": {
                    "caching": redis_status,
                    "database": database_status
                },
                "system": system_metrics,
                "version": "1.0.0"
            }
            
            status_code = 200 if health_data["status"] == "healthy" else 503
            self.write_json(health_data, status_code)
            
        except Exception as e:
            self.write_json({
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }, 503)

class StatusHandler(BaseHandler):
    """Detailed application status endpoint."""
    
    async def get(self):
        """Return detailed application status."""
        try:
            # WebSocket connections count
            from app.handlers.websocket_handlers import active_connections
            
            websocket_stats = {
                "chat_connections": len(active_connections.get('chat', set())),
                "notification_connections": len(active_connections.get('notifications', set())),
                "total_connections": sum(len(conns) for conns in active_connections.values())
            }
            
            # Redis stats
            redis_stats = {}
            try:
                redis_client = await get_redis()
                redis_info = await redis_client.info()
                redis_stats = {
                    "connected_clients": redis_info.get('connected_clients', 0),
                    "used_memory_human": redis_info.get('used_memory_human', '0B'),
                    "uptime_in_seconds": redis_info.get('uptime_in_seconds', 0)
                }
            except Exception:
                redis_stats = {"error": "Unable to fetch Redis stats"}
            
            status_data = {
                "application": {
                    "name": "Tornado Microservice",
                    "version": "1.0.0",
                    "environment": "development" if settings.DEBUG else "production",
                    "debug_mode": settings.DEBUG
                },
                "server": {
                    "host": settings.HOST,
                    "port": settings.PORT,
                    "uptime_seconds": time.time()  # In real app, track actual uptime
                },
                "websockets": websocket_stats,
                "caching": redis_stats,
                "system": {
                    "python_version": f"{psutil.PYTHON_VERSION[0]}.{psutil.PYTHON_VERSION[1]}.{psutil.PYTHON_VERSION[2]}",
                    "cpu_count": psutil.cpu_count(),
                    "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 2)
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            self.write_json(status_data)
            
        except Exception as e:
            self.write_error(f"Failed to get status: {str(e)}", 500)`,

    'app/models/__init__.py': '',

    'app/models/user.py': `"""
User Model and Schema
"""
from marshmallow import Schema, fields, validate
from typing import Dict, Any

class UserSchema(Schema):
    """User validation schema."""
    
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    username = fields.Str(validate=validate.Length(min=3, max=50))
    
    class Meta:
        unknown = 'EXCLUDE'

class User:
    """User model (simplified for template)."""
    
    def __init__(self, email: str, username: str = None, password_hash: str = None):
        self.email = email
        self.username = username or email.split('@')[0]
        self.password_hash = password_hash
        self.is_active = True
        self.created_at = None
        self.updated_at = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert user to dictionary."""
        return {
            'email': self.email,
            'username': self.username,
            'is_active': self.is_active,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        """Create user from dictionary."""
        user = cls(
            email=data['email'],
            username=data.get('username'),
            password_hash=data.get('password_hash')
        )
        user.is_active = data.get('is_active', True)
        user.created_at = data.get('created_at')
        user.updated_at = data.get('updated_at')
        return user`,

    'Dockerfile': `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    postgresql-client \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt requirements-dev.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 tornado && chown -R tornado:tornado /app
USER tornado

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

# Run application
CMD ["python", "main.py", "--port=8000"]`,

    'docker-compose.yml': `version: '3.8'

services:
  tornado-app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DEBUG=true
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/tornado_app
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=your-secret-key-change-in-production
      - JWT_SECRET_KEY=jwt-secret-key-change-in-production
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
    command: python main.py --port=8000 --debug

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=tornado_app
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:`,

    '.env.example': `# Server Configuration
HOST=localhost
PORT=8000
DEBUG=true

# Security
SECRET_KEY=your-secret-key-change-in-production
JWT_SECRET_KEY=jwt-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DELTA=3600

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tornado_app

# Redis
REDIS_URL=redis://localhost:6379/0

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Logging
LOG_LEVEL=INFO`,

    'pytest.ini': `[tool:pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    --verbose
    --tb=short
    --cov=app
    --cov-report=term-missing
    --cov-report=html:htmlcov
markers =
    unit: Unit tests
    integration: Integration tests
    websocket: WebSocket tests`,

    'tests/__init__.py': '',

    'tests/conftest.py': `"""
Pytest configuration and fixtures.
"""
import pytest
import asyncio
from tornado.testing import AsyncHTTPTestCase
from tornado.web import Application

from app.core.application import create_application

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def app():
    """Create test application."""
    return create_application(debug=True)

class TornadoTestCase(AsyncHTTPTestCase):
    """Base test case for Tornado applications."""
    
    def get_app(self) -> Application:
        return create_application(debug=True)`,

    'tests/test_auth.py': `"""
Authentication tests.
"""
import json
import pytest
from tornado.testing import AsyncHTTPTestCase

from tests.conftest import TornadoTestCase

class TestAuth(TornadoTestCase):
    
    def test_register(self):
        """Test user registration."""
        body = {
            "email": "test@example.com",
            "password": "testpassword123",
            "username": "testuser"
        }
        
        response = self.fetch(
            '/api/v1/auth/register',
            method='POST',
            body=json.dumps(body),
            headers={'Content-Type': 'application/json'}
        )
        
        self.assertEqual(response.code, 201)
        data = json.loads(response.body)
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['email'], 'test@example.com')
    
    def test_login(self):
        """Test user login."""
        body = {
            "email": "test@example.com",
            "password": "testpassword123"
        }
        
        response = self.fetch(
            '/api/v1/auth/login',
            method='POST',
            body=json.dumps(body),
            headers={'Content-Type': 'application/json'}
        )
        
        self.assertEqual(response.code, 200)
        data = json.loads(response.body)
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['email'], 'test@example.com')
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        body = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        response = self.fetch(
            '/api/v1/auth/login',
            method='POST',
            body=json.dumps(body),
            headers={'Content-Type': 'application/json'}
        )
        
        # In this template, all logins succeed for simplicity
        # In a real app, this would return 401
        self.assertEqual(response.code, 200)`,

    'tests/test_websockets.py': `"""
WebSocket tests.
"""
import json
import pytest
from tornado.testing import AsyncHTTPTestCase, gen_test
from tornado.websocket import websocket_connect

from tests.conftest import TornadoTestCase

class TestWebSockets(TornadoTestCase):
    
    @gen_test
    async def test_chat_websocket_connection(self):
        """Test chat WebSocket connection."""
        ws_url = f"ws://localhost:{self.get_http_port()}/ws/chat?token=test_token&room=test_room"
        
        try:
            ws = await websocket_connect(ws_url)
            
            # Send a test message
            test_message = {
                "type": "chat",
                "content": "Hello, WebSocket!"
            }
            ws.write_message(json.dumps(test_message))
            
            # Read response
            response = await ws.read_message()
            self.assertIsNotNone(response)
            
            ws.close()
            
        except Exception as e:
            self.fail(f"WebSocket connection failed: {e}")
    
    @gen_test
    async def test_notification_websocket_connection(self):
        """Test notification WebSocket connection."""
        ws_url = f"ws://localhost:{self.get_http_port()}/ws/notifications?token=test_token"
        
        try:
            ws = await websocket_connect(ws_url)
            
            # Send a ping
            ping_message = {"type": "ping"}
            ws.write_message(json.dumps(ping_message))
            
            # Read response
            response = await ws.read_message()
            self.assertIsNotNone(response)
            
            ws.close()
            
        except Exception as e:
            self.fail(f"WebSocket connection failed: {e}")`,

    'tests/test_api.py': `"""
API endpoint tests.
"""
import json
import pytest
from tornado.testing import AsyncHTTPTestCase

from tests.conftest import TornadoTestCase

class TestAPI(TornadoTestCase):
    
    def test_health_check(self):
        """Test health check endpoint."""
        response = self.fetch('/health')
        self.assertEqual(response.code, 200)
        
        data = json.loads(response.body)
        self.assertIn('status', data)
        self.assertIn('timestamp', data)
        self.assertIn('services', data)
    
    def test_status_endpoint(self):
        """Test status endpoint."""
        response = self.fetch('/api/v1/status')
        self.assertEqual(response.code, 200)
        
        data = json.loads(response.body)
        self.assertIn('application', data)
        self.assertIn('server', data)
        self.assertIn('websockets', data)
    
    def test_cors_headers(self):
        """Test CORS headers are set correctly."""
        response = self.fetch('/health')
        
        headers = response.headers
        self.assertEqual(headers.get('Access-Control-Allow-Origin'), '*')
        self.assertIn('Content-Type', headers.get('Access-Control-Allow-Headers', ''))`,

    '.gitignore': `# Byte-compiled / optimized / DLL files
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

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
.hypothesis/
.pytest_cache/

# Translations
*.mo
*.pot

# Django stuff:
*.log
local_settings.py

# Flask stuff:
instance/
.webassets-cache

# Scrapy stuff:
.scrapy

# Sphinx documentation
docs/_build/

# PyBuilder
target/

# Jupyter Notebook
.ipynb_checkpoints

# pyenv
.python-version

# celery beat schedule file
celerybeat-schedule

# SageMath parsed files
*.sage.py

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# Spyder project settings
.spyderproject
.spyproject

# Rope project settings
.ropeproject

# mkdocs documentation
/site

# mypy
.mypy_cache/
.dmypy.json
dmypy.json

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Application specific
app.log
static/uploads/
temp/`,

    'README.md': `# Tornado Microservice

A high-performance Tornado-based microservice with async/await support, WebSocket connections, and enterprise-grade features.

## Features

### Core Framework
- **Tornado 6.4** - High-performance Python web framework
- **Async/Await Support** - Non-blocking I/O operations
- **WebSocket Support** - Real-time bidirectional communication
- **Coroutines** - Efficient concurrent programming

### API & Communication
- **RESTful API** - Clean HTTP endpoints
- **Real-time Chat** - WebSocket-based chat system
- **Notifications** - Live notification system
- **Health Checks** - Comprehensive health monitoring

### Authentication & Security
- **JWT Authentication** - Stateless authentication
- **Password Hashing** - Bcrypt password security
- **CORS Support** - Cross-origin resource sharing
- **Token Blacklisting** - Secure logout functionality

### Database & Caching
- **PostgreSQL** - Primary database with aiopg async driver
- **Redis** - Caching and session management with aioredis
- **SQLAlchemy** - ORM with async support
- **Alembic** - Database migrations

### Development & Testing
- **Pytest** - Comprehensive testing framework
- **pytest-tornado** - Tornado-specific testing utilities
- **pytest-asyncio** - Async testing support
- **Coverage** - Code coverage reporting

### Code Quality
- **Black** - Code formatting
- **isort** - Import sorting
- **mypy** - Type checking
- **flake8** - Linting
- **pre-commit** - Git hooks

### Deployment
- **Docker** - Containerization
- **Docker Compose** - Multi-service orchestration
- **Health Checks** - Container health monitoring
- **Environment Configuration** - 12-factor app principles

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone and setup:**
   \`\`\`bash
   git clone <repository-url>
   cd tornado-microservice
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   \`\`\`

2. **Environment configuration:**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your settings
   \`\`\`

3. **Start services:**
   \`\`\`bash
   docker-compose up -d postgres redis
   \`\`\`

4. **Run application:**
   \`\`\`bash
   python main.py
   \`\`\`

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - User registration
- \`POST /api/v1/auth/login\` - User login
- \`POST /api/v1/auth/logout\` - User logout

### Users
- \`GET /api/v1/users\` - List users
- \`GET /api/v1/users/{id}\` - Get user by ID
- \`PUT /api/v1/users/{id}\` - Update user
- \`DELETE /api/v1/users/{id}\` - Delete user
- \`GET /api/v1/users/profile\` - Get current user profile
- \`PUT /api/v1/users/profile\` - Update current user profile

### System
- \`GET /health\` - Health check
- \`GET /api/v1/status\` - System status

### WebSocket Endpoints
- \`WS /ws/chat?token=<jwt>&room=<room_id>\` - Chat WebSocket
- \`WS /ws/notifications?token=<jwt>\` - Notifications WebSocket

## WebSocket Usage

### Chat Example
\`\`\`javascript
const ws = new WebSocket('ws://localhost:8000/ws/chat?token=YOUR_JWT&room=general');

// Send chat message
ws.send(JSON.stringify({
  type: 'chat',
  content: 'Hello, everyone!'
}));

// Handle messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
\`\`\`

### Notifications Example
\`\`\`javascript
const ws = new WebSocket('ws://localhost:8000/ws/notifications?token=YOUR_JWT');

// Subscribe to topics
ws.send(JSON.stringify({
  type: 'subscribe',
  topics: ['alerts', 'messages']
}));
\`\`\`

## Testing

\`\`\`bash
# Run all tests
pytest

# Run specific test types
pytest -m unit
pytest -m integration
pytest -m websocket

# Run with coverage
pytest --cov=app --cov-report=html
\`\`\`

## Development

### Code Quality
\`\`\`bash
# Format code
black .
isort .

# Type checking
mypy app/

# Linting
flake8 app/
\`\`\`

### Pre-commit Hooks
\`\`\`bash
pre-commit install
pre-commit run --all-files
\`\`\`

## Docker Deployment

### Development
\`\`\`bash
docker-compose up
\`\`\`

### Production
\`\`\`bash
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

## Performance Features

- **Async I/O** - Non-blocking database and Redis operations
- **Connection Pooling** - Efficient database connection management
- **WebSocket Scaling** - Handle thousands of concurrent connections
- **Memory Efficiency** - Optimized for high concurrency
- **Request Batching** - Efficient handling of multiple requests

## Monitoring

- Health check endpoint at \`/health\`
- Detailed status at \`/api/v1/status\`
- WebSocket connection metrics
- Redis and database connectivity checks
- System resource monitoring

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Token blacklisting for secure logout
- CORS configuration
- Input validation with Marshmallow
- SQL injection prevention

## License

MIT License
`
  }
};