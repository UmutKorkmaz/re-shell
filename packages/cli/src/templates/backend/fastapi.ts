import { BackendTemplate } from '../types';

export const fastapiTemplate: BackendTemplate = {
  id: 'fastapi',
  name: 'fastapi',
  displayName: 'FastAPI',
  description: 'Modern, fast Python web framework for building APIs with automatic API documentation',
  language: 'python',
  framework: 'fastapi',
  version: '0.111.0',
  tags: ['python', 'fastapi', 'api', 'rest', 'swagger', 'type-hints'],
  port: 8000,
  dependencies: {},
  features: ['swagger', 'websockets', 'graphql', 'authentication', 'database', 'validation', 'testing'],
  
  files: {
    // Python project configuration
    'pyproject.toml': `[tool.poetry]
name = "{{projectName}}"
version = "0.1.0"
description = "FastAPI backend service with async support and automatic documentation"
authors = ["Your Name <you@example.com>"]
readme = "README.md"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.111.0"
uvicorn = {extras = ["standard"], version = "^0.30.0"}
pydantic = "^2.7.0"
pydantic-settings = "^2.2.1"
sqlalchemy = {extras = ["asyncio"], version = "^2.0.29"}
asyncpg = "^0.29.0"
alembic = "^1.13.1"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
python-multipart = "^0.0.9"
email-validator = "^2.1.1"
redis = {extras = ["hiredis"], version = "^5.0.3"}
celery = {extras = ["caching"], version = "^5.3.6"}
httpx = "^0.27.0"
aiofiles = "^23.2.1"
python-dotenv = "^1.0.1"
psycopg2-binary = "^2.9.9"
aiomysql = "^0.2.0"
motor = "^3.4.0"
beanie = "^1.25.0"
tortoise-orm = {extras = ["asyncpg"], version = "^0.20.0"}
strawberry-graphql = {extras = ["fastapi"], version = "^0.227.0"}
prometheus-client = "^0.20.0"
opentelemetry-api = "^1.24.0"
opentelemetry-sdk = "^1.24.0"
opentelemetry-instrumentation-fastapi = "^0.45b0"
sentry-sdk = {extras = ["fastapi"], version = "^1.45.0"}
structlog = "^24.1.0"
orjson = "^3.10.0"
pydantic-extra-types = "^2.7.0"
pendulum = "^3.0.0"
python-socketio = "^5.11.2"
broadcaster = {extras = ["caching"], version = "^0.2.0"}
pillow = "^10.3.0"
python-magic = "^0.4.27"
minio = "^7.2.5"
boto3 = "^1.34.84"
jinja2 = "^3.1.3"
markdown = "^3.6"
pygments = "^2.17.2"

[tool.poetry.group.dev.dependencies]
pytest = "^8.1.1"
pytest-asyncio = "^0.23.6"
pytest-cov = "^5.0.0"
pytest-env = "^1.1.3"
pytest-mock = "^3.14.0"
pytest-xdist = "^3.5.0"
httpx = "^0.27.0"
factory-boy = "^3.3.0"
faker = "^24.4.0"
black = "^24.3.0"
isort = "^5.13.2"
flake8 = "^7.0.0"
mypy = "^1.9.0"
pylint = "^3.1.0"
pre-commit = "^3.7.0"
bandit = "^1.7.8"
safety = "^3.1.0"
coverage = "^7.4.4"
locust = "^2.24.1"
types-redis = "^4.6.0.20240408"
types-passlib = "^1.7.7.20240327"
types-python-jose = "^3.3.4.20240106"
types-aiofiles = "^23.2.0.20240403"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.black]
line-length = 100
target-version = ['py311']
include = '\\.pyi?$'

[tool.isort]
profile = "black"
line_length = 100

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-ra -q --strict-markers"
markers = [
    "slow: marks tests as slow (deselect with '-m "not slow"')",
    "integration: marks tests as integration tests",
    "unit: marks tests as unit tests"]

[tool.coverage.run]
source = ["app"]
omit = ["*/tests/*", "*/migrations/*"]

[tool.coverage.report]
precision = 2
show_missing = true
skip_covered = false

[tool.pylint.messages_control]
disable = "C0330, C0326"

[tool.pylint.format]
max-line-length = "100"`,

    // Application configuration
    '.env.example': `# Application
APP_NAME={{projectName}}
APP_VERSION=0.1.0
DEBUG=true
ENVIRONMENT=development
SECRET_KEY=your-secret-key-here
API_PREFIX=/api/v1

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=1
RELOAD=true

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
# Alternative databases
# DATABASE_URL=mysql+aiomysql://user:password@localhost:3306/dbname
# DATABASE_URL=mongodb://localhost:27017/dbname

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ALGORITHM=HS256
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_CREDENTIALS=true

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME={{projectName}}

# File Storage
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE=10485760
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,pdf,doc,docx

# S3/MinIO
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME={{projectName}}-uploads
S3_REGION=us-east-1

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# Monitoring
SENTRY_DSN=
PROMETHEUS_ENABLED=true
OPENTELEMETRY_ENABLED=false

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT=100/minute

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json`,

    // Main application entry
    'main.py': `import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_client import make_asgi_app
from starlette.middleware.sessions import SessionMiddleware

from app.api.api_v1.api import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.redis import init_redis
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.utils.logger import setup_logger

# Setup logger
logger = setup_logger(__name__)

# Add project root to Python path
sys.path.append(str(Path(__file__).parent))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application lifespan events."""
    # Startup
    logger.info("Starting up application...")
    
    # Initialize database
    await init_db()
    
    # Initialize Redis
    await init_redis()
    
    # Create upload directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI backend service with async support and automatic documentation",
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])
app.add_middleware(LoggingMiddleware)

if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Mount Prometheus metrics
if settings.PROMETHEUS_ENABLED:
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

# Include API router
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": f"{settings.API_PREFIX}/docs",
        "health": "/health"}


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": settings.APP_VERSION}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        workers=settings.WORKERS,
        log_config=None,  # Use custom logger
    )`,

    // Application structure
    'app/__init__.py': '',
    
    // Core configuration
    'app/core/__init__.py': '',
    
    'app/core/config.py': `from functools import lru_cache
from typing import List, Optional

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "{{projectName}}"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    SECRET_KEY: str
    API_PREFIX: str = "/api/v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1
    RELOAD: bool = False
    
    # Database
    DATABASE_URL: str
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 0
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    BCRYPT_ROUNDS: int = 12
    
    # CORS
    CORS_ORIGINS: List[AnyHttpUrl] = []
    CORS_ALLOW_CREDENTIALS: bool = True
    
    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        return v
    
    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: Optional[str] = None
    EMAIL_FROM_NAME: Optional[str] = None
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"]
    
    # S3/MinIO
    S3_ENDPOINT_URL: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: str = "us-east-1"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_ENABLED: bool = True
    OPENTELEMETRY_ENABLED: bool = False
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == "testing"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()`,

    // Database configuration
    'app/core/database.py': `from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import MetaData, pool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    poolclass=pool.NullPool if settings.DATABASE_URL.startswith("sqlite") else pool.AsyncAdaptedQueuePool,
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Custom naming convention for constraints
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    """Base class for all database models."""
    
    metadata = metadata
    
    def dict(self) -> dict[str, Any]:
        """Convert model to dictionary."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database."""
    # Import all models to ensure they are registered
    from app import models  # noqa
    
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)`,

    // Redis configuration
    'app/core/redis.py': `from typing import Optional

import redis.asyncio as redis
from redis.asyncio.client import Redis

from app.core.config import settings
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

redis_client: Optional[Redis] = None


async def init_redis() -> None:
    """Initialize Redis connection."""
    global redis_client
    
    try:
        redis_client = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        await redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        redis_client = None


async def get_redis() -> Optional[Redis]:
    """Get Redis client."""
    return redis_client


async def close_redis() -> None:
    """Close Redis connection."""
    global redis_client
    
    if redis_client:
        await redis_client.close()
        redis_client = None`,

    // Security utilities
    'app/core/security.py': `from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(
    subject: str | Any,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    subject: str | Any,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create JWT refresh token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def decode_token(token: str) -> dict:
    """Decode JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise ValueError("Invalid token")`,

    // API router
    'app/api/__init__.py': '',
    'app/api/api_v1/__init__.py': '',
    
    'app/api/api_v1/api.py': `from fastapi import APIRouter

from app.api.api_v1.endpoints import auth, health, todos, users, websocket

api_router = APIRouter()

# Include routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(todos.router, prefix="/todos", tags=["todos"])
api_router.include_router(websocket.router, prefix="/ws", tags=["websockets"])`,

    // Health endpoint
    'app/api/api_v1/endpoints/__init__.py': '',
    
    'app/api/api_v1/endpoints/health.py': `from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis

router = APIRouter()


@router.get("")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> Dict[str, Any]:
    """Comprehensive health check."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {}}
    
    # Check database
    try:
        await db.execute(text("SELECT 1"))
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["services"]["database"] = f"unhealthy: {str(e)}"
    
    # Check Redis
    try:
        if redis:
            await redis.ping()
            health_status["services"]["caching"] = "healthy"
        else:
            health_status["services"]["caching"] = "not configured"
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["services"]["caching"] = f"unhealthy: {str(e)}"
    
    return health_status


@router.get("/live")
async def liveness() -> Dict[str, str]:
    """Kubernetes liveness probe."""
    return {"status": "alive"}


@router.get("/ready")
async def readiness(
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """Kubernetes readiness probe."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return {"status": "not ready"}`,

    // Authentication endpoints
    'app/api/api_v1/endpoints/auth.py': `from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import schemas
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.crud import crud_user
from app.utils.email import send_reset_password_email

router = APIRouter()


@router.post("/register", response_model=schemas.UserResponse)
async def register(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: schemas.UserCreate,
) -> Any:
    """Register new user."""
    user = await crud_user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    user = await crud_user.create(db, obj_in=user_in)
    return user


@router.post("/login", response_model=schemas.Token)
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """OAuth2 compatible token login."""
    user = await crud_user.authenticate(
        db,
        email=form_data.username,
        password=form_data.password,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    
    access_token = security.create_access_token(user.id)
    refresh_token = security.create_refresh_token(user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"}


@router.post("/refresh", response_model=schemas.TokenRefresh)
async def refresh_token(
    *,
    db: AsyncSession = Depends(get_db),
    refresh_token: str = Body(..., embed=True),
) -> Any:
    """Refresh access token."""
    try:
        payload = security.decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )
        
        user_id = payload.get("sub")
        user = await crud_user.get(db, id=user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        
        access_token = security.create_access_token(user.id)
        return {"access_token": access_token, "token_type": "bearer"}
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


@router.post("/password-recovery/{email}")
async def recover_password(
    email: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Password recovery."""
    user = await crud_user.get_by_email(db, email=email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    password_reset_token = security.create_access_token(
        subject=user.id,
        expires_delta=timedelta(hours=1),
    )
    await send_reset_password_email(
        email_to=user.email,
        email=user.email,
        token=password_reset_token,
    )
    return {"msg": "Password recovery email sent"}


@router.post("/reset-password")
async def reset_password(
    *,
    db: AsyncSession = Depends(get_db),
    token: str = Body(...),
    new_password: str = Body(...),
) -> Any:
    """Reset password."""
    try:
        payload = security.decode_token(token)
        user_id = payload.get("sub")
        user = await crud_user.get(db, id=user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        
        hashed_password = security.get_password_hash(new_password)
        user.hashed_password = hashed_password
        await db.commit()
        return {"msg": "Password updated successfully"}
        
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token",
        )`,

    // User endpoints
    'app/api/api_v1/endpoints/users.py': `from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.api import deps
from app.core.database import get_db
from app.crud import crud_user

router = APIRouter()


@router.get("/me", response_model=schemas.UserResponse)
async def read_current_user(
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """Get current user."""
    return current_user


@router.put("/me", response_model=schemas.UserResponse)
async def update_current_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """Update current user."""
    user = await crud_user.update(db, db_obj=current_user, obj_in=user_in)
    return user


@router.post("/me/password")
async def change_password(
    *,
    db: AsyncSession = Depends(get_db),
    current_password: str = Body(...),
    new_password: str = Body(...),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """Change current user password."""
    if not security.verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password",
        )
    
    hashed_password = security.get_password_hash(new_password)
    current_user.hashed_password = hashed_password
    await db.commit()
    return {"msg": "Password updated successfully"}


@router.get("/", response_model=List[schemas.UserResponse])
async def read_users(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Retrieve users (superuser only)."""
    users = await crud_user.get_multi(db, skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=schemas.UserResponse)
async def read_user_by_id(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """Get user by ID."""
    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if user == current_user or current_user.is_superuser:
        return user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not enough permissions",
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """Delete user (superuser only)."""
    user = await crud_user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    await crud_user.remove(db, id=user_id)
    return {"msg": "User deleted successfully"}`,

    // Models
    'app/models/__init__.py': `from app.models.todo import Todo
from app.models.user import User

__all__ = ["User", "Todo"]`,

    'app/models/base.py': `from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TimestampMixin:
    """Mixin for timestamp fields."""
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class BaseModel(Base, TimestampMixin):
    """Base model with common fields."""
    
    __abstract__ = True
    
    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}`,

    'app/models/user.py': `from typing import List, Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    """User model."""
    
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relationships
    todos: Mapped[List["Todo"]] = relationship(
        "Todo",
        back_populates="owner",
        cascade="all, delete-orphan",
    )`,

    'app/models/todo.py': `from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.user import User


class Todo(BaseModel):
    """Todo model."""
    
    __tablename__ = "todos"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    
    # Relationships
    owner: Mapped[User] = relationship("User", back_populates="todos")`,

    // Schemas
    'app/schemas/__init__.py': `from app.schemas.token import Token, TokenPayload, TokenRefresh
from app.schemas.todo import TodoCreate, TodoUpdate, TodoResponse, TodoListResponse
from app.schemas.user import UserCreate, UserUpdate, UserResponse

__all__ = [
    "Token",
    "TokenPayload", 
    "TokenRefresh",
    "TodoCreate",
    "TodoUpdate",
    "TodoResponse",
    "TodoListResponse",
    "UserCreate",
    "UserUpdate",
    "UserResponse"]`,

    'app/schemas/user.py': `from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    """Base user schema."""
    
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False


class UserCreate(UserBase):
    """Schema for creating user."""
    
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user."""
    
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    """Schema for user response."""
    
    id: int
    
    model_config = ConfigDict(from_attributes=True)`,

    'app/schemas/todo.py': `from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class TodoBase(BaseModel):
    """Base todo schema."""
    
    title: str
    description: Optional[str] = None
    completed: bool = False
    due_date: Optional[datetime] = None


class TodoCreate(TodoBase):
    """Schema for creating todo."""
    
    pass


class TodoUpdate(BaseModel):
    """Schema for updating todo."""
    
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[datetime] = None


class TodoResponse(TodoBase):
    """Schema for todo response."""
    
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class TodoListResponse(BaseModel):
    """Schema for todo list response."""
    
    items: List[TodoResponse]
    total: int
    skip: int
    limit: int`,

    // CRUD operations
    'app/crud/__init__.py': `from app.crud.crud_todo import crud_todo
from app.crud.crud_user import crud_user

__all__ = ["crud_user", "crud_todo"]`,

    'app/crud/base.py': `from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base CRUD operations."""
    
    def __init__(self, model: Type[ModelType]):
        self.model = model
    
    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        """Get record by ID."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalar_one_or_none()
    
    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ModelType]:
        """Get multiple records."""
        result = await db.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        """Create record."""
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
    ) -> ModelType:
        """Update record."""
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def remove(self, db: AsyncSession, *, id: int) -> ModelType:
        """Delete record."""
        result = await db.execute(select(self.model).where(self.model.id == id))
        obj = result.scalar_one()
        await db.delete(obj)
        await db.commit()
        return obj`,

    'app/crud/crud_user.py': `from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """CRUD operations for User model."""
    
    async def get_by_email(self, db: AsyncSession, *, email: str) -> Optional[User]:
        """Get user by email."""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
    
    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        """Create user with hashed password."""
        db_obj = User(
            email=obj_in.email,
            hashed_password=get_password_hash(obj_in.password),
            full_name=obj_in.full_name,
            is_superuser=obj_in.is_superuser,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def authenticate(
        self,
        db: AsyncSession,
        *,
        email: str,
        password: str,
    ) -> Optional[User]:
        """Authenticate user."""
        user = await self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


crud_user = CRUDUser(User)`,

    // Dependencies
    'app/api/deps.py': `from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.crud import crud_user
from app.models.user import User
from app.schemas.token import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_PREFIX}/auth/login"
)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Get current authenticated user."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        token_data = TokenPayload(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    user = await crud_user.get(db, id=token_data.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


async def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user`,

    // WebSocket endpoint
    'app/api/api_v1/endpoints/websocket.py': `import json
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.utils.logger import setup_logger

router = APIRouter()
logger = setup_logger(__name__)

# Store active connections
connections: Dict[str, Set[WebSocket]] = {}


@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time communication."""
    await websocket.accept()
    
    # TODO: Validate token and get user_id
    user_id = "user_123"  # Placeholder
    
    # Add connection to user's connection set
    if user_id not in connections:
        connections[user_id] = set()
    connections[user_id].add(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif message["type"] == "broadcast":
                # Broadcast to all user's connections
                for conn in connections.get(user_id, []):
                    if conn != websocket:
                        await conn.send_json({
                            "type": "message",
                            "data": message["data"]})
            
    except WebSocketDisconnect:
        # Remove connection on disconnect
        connections[user_id].discard(websocket)
        if not connections[user_id]:
            del connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")`,

    // Docker files
    'Dockerfile': `# Build stage
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    POETRY_VERSION=1.8.2 \\
    POETRY_HOME="/opt/poetry" \\
    POETRY_VIRTUALENVS_CREATE=false \\
    POETRY_NO_INTERACTION=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    g++ \\
    libpq-dev \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root

# Production stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq5 \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories
RUN mkdir -p uploads logs && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-8000}:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://\${DB_USER:-postgres}:\${DB_PASSWORD:-postgres}@postgres:5432/\${DB_NAME:-{{projectName}}}
      - REDIS_URL=redis://redis:6379/0
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    environment:
      - POSTGRES_USER=\${DB_USER:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-{{projectName}}}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: {{projectName}}-redis
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-redis}
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: {{projectName}}-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

  adminer:
    image: adminer
    container_name: {{projectName}}-adminer
    ports:
      - "8080:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=postgres
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge`,

    '.dockerignore': `# Python
__pycache__
*.py[cod]
*$py.class
*.so
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

# Virtual environments
venv/
ENV/
env/

# Testing
.pytest_cache/
.coverage
htmlcov/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
*.log

# Git
.git/
.gitignore

# Docker
docker-compose.yml
Dockerfile`,

    // Alembic configuration
    'alembic.ini': `[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = postgresql+asyncpg://user:password@localhost/dbname

[post_write_hooks]
hooks = black
black.type = console_scripts
black.entrypoint = black
black.options = -l 100

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S`,

    // README
    'README.md': `# {{projectName}}

FastAPI backend service with async support, automatic documentation, and comprehensive features.

## Features

- 🚀 **FastAPI** framework with async/await support
- 🔐 **JWT Authentication** with OAuth2 flow
- 🗄️ **SQLAlchemy 2.0** with async PostgreSQL support
- 🚦 **Redis** for caching and rate limiting
- 📚 **Automatic API Documentation** with Swagger/ReDoc
- 🔄 **WebSocket** support for real-time features
- 🧪 **Pytest** for testing with async support
- 🐳 **Docker** support with multi-stage builds
- 📊 **Structured Logging** with JSON format
- 🛡️ **Security** features (CORS, rate limiting, etc.)
- 📤 **File uploads** with validation
- ✉️ **Email** support with templates
- 🔄 **Celery** for background tasks
- 📈 **Monitoring** with Prometheus metrics
- 🎯 **Type hints** throughout the codebase

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis
- Docker (optional)

### Installation

1. Clone the repository
2. Install Poetry:
   \`\`\`bash
   curl -sSL https://install.python-poetry.org | python3 -
   \`\`\`

3. Install dependencies:
   \`\`\`bash
   poetry install
   \`\`\`

4. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

5. Run database migrations:
   \`\`\`bash
   poetry run alembic upgrade head
   \`\`\`

6. Start the development server:
   \`\`\`bash
   poetry run uvicorn main:app --reload
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc
- OpenAPI JSON: http://localhost:8000/api/v1/openapi.json

## Testing

\`\`\`bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app --cov-report=html

# Run specific test file
poetry run pytest tests/test_auth.py

# Run tests in parallel
poetry run pytest -n auto
\`\`\`

## Project Structure

\`\`\`
app/
├── api/            # API endpoints
├── core/           # Core configuration
├── crud/           # CRUD operations
├── models/         # SQLAlchemy models
├── schemas/        # Pydantic schemas
├── services/       # Business logic
├── utils/          # Utilities
└── tests/          # Test files
\`\`\`

## Development

\`\`\`bash
# Format code
poetry run black .

# Sort imports
poetry run isort .

# Run linters
poetry run flake8
poetry run mypy .

# Security scan
poetry run bandit -r app/
\`\`\`

## License

MIT
`}};