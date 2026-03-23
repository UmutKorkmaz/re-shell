# Comprehensive Pydantic Models for Python Templates
# Universal validation models compatible with FastAPI, Django, Flask, Tornado, and Sanic

from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel, EmailStr, Field, validator, root_validator
from pydantic.types import SecretStr, HttpUrl, UUID4
import re

class PydanticModelGenerator:
    """Generator for Pydantic validation models across Python frameworks."""
    
    def __init__(self, framework: str):
        self.framework = framework
        
    def generate_base_models(self) -> Dict[str, str]:
        """Generate base Pydantic models for all Python frameworks."""
        
        return {
            'schemas/__init__.py': '',
            
            'schemas/base.py': '''"""
Base Pydantic models and utilities for all frameworks.
"""
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator
from pydantic.types import UUID4

class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

class UUIDMixin(BaseModel):
    """Mixin for UUID primary key."""
    id: Optional[UUID4] = Field(None, description="Unique identifier")

class StatusEnum(str, Enum):
    """Common status enumeration."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    DELETED = "deleted"

class PriorityEnum(str, Enum):
    """Priority levels enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class BaseResponseModel(BaseModel):
    """Base response model for API responses."""
    success: bool = Field(True, description="Request success status")
    message: Optional[str] = Field(None, description="Response message")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")

class PaginationMeta(BaseModel):
    """Pagination metadata."""
    page: int = Field(1, ge=1, description="Current page number")
    limit: int = Field(20, ge=1, le=100, description="Items per page")
    total: int = Field(0, ge=0, description="Total number of items")
    pages: int = Field(0, ge=0, description="Total number of pages")
    has_next: bool = Field(False, description="Has next page")
    has_prev: bool = Field(False, description="Has previous page")

class PaginatedResponse(BaseModel):
    """Generic paginated response."""
    meta: PaginationMeta
    data: List[Any]

class ErrorDetail(BaseModel):
    """Error detail model."""
    field: Optional[str] = Field(None, description="Field that caused the error")
    message: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")

class ErrorResponse(BaseModel):
    """Error response model."""
    success: bool = Field(False, description="Request success status")
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[List[ErrorDetail]] = Field(None, description="Detailed error information")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")

class HealthCheckResponse(BaseModel):
    """Health check response model."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")
    uptime: float = Field(..., description="Service uptime in seconds")
    checks: Dict[str, str] = Field(default_factory=dict, description="Individual health checks")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Check timestamp")
''',

            'schemas/auth.py': '''"""
Authentication and authorization Pydantic models.
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, validator, SecretStr
from pydantic.types import UUID4
from .base import TimestampMixin, UUIDMixin, StatusEnum, BaseResponseModel

class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    MODERATOR = "moderator"
    USER = "user"
    GUEST = "guest"

class UserBase(BaseModel):
    """Base user model."""
    email: EmailStr = Field(..., description="User email address")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="Username")
    first_name: Optional[str] = Field(None, max_length=100, description="First name")
    last_name: Optional[str] = Field(None, max_length=100, description="Last name")
    is_active: bool = Field(True, description="User active status")
    role: UserRole = Field(UserRole.USER, description="User role")

    @validator('username')
    def validate_username(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, hyphens, and underscores')
        return v

class UserCreate(UserBase):
    """User creation model."""
    password: SecretStr = Field(..., min_length=8, description="User password")
    confirm_password: SecretStr = Field(..., description="Password confirmation")

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

    @validator('password')
    def validate_password(cls, v):
        password = v.get_secret_value()
        if len(password) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', password):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', password):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\\d', password):
            raise ValueError('Password must contain at least one digit')
        return v

class UserUpdate(BaseModel):
    """User update model."""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None

class UserResponse(UserBase, UUIDMixin, TimestampMixin):
    """User response model."""
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    login_count: int = Field(0, description="Total login count")

    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    """User profile model."""
    bio: Optional[str] = Field(None, max_length=500, description="User biography")
    avatar_url: Optional[str] = Field(None, description="Avatar image URL")
    website: Optional[str] = Field(None, description="Personal website")
    location: Optional[str] = Field(None, max_length=100, description="Location")
    birth_date: Optional[date] = Field(None, description="Birth date")
    phone: Optional[str] = Field(None, description="Phone number")

class UserProfileResponse(UserProfile, TimestampMixin):
    """User profile response model."""
    user_id: UUID4 = Field(..., description="Associated user ID")

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    """Login request model."""
    email: EmailStr = Field(..., description="User email")
    password: SecretStr = Field(..., description="User password")
    remember_me: bool = Field(False, description="Remember login")

class LoginResponse(BaseResponseModel):
    """Login response model."""
    user: UserResponse
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")

class TokenRefreshRequest(BaseModel):
    """Token refresh request model."""
    refresh_token: str = Field(..., description="Refresh token")

class TokenRefreshResponse(BaseResponseModel):
    """Token refresh response model."""
    access_token: str = Field(..., description="New JWT access token")
    refresh_token: str = Field(..., description="New JWT refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")

class PasswordChangeRequest(BaseModel):
    """Password change request model."""
    current_password: SecretStr = Field(..., description="Current password")
    new_password: SecretStr = Field(..., min_length=8, description="New password")
    confirm_password: SecretStr = Field(..., description="Password confirmation")

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class PasswordResetRequest(BaseModel):
    """Password reset request model."""
    email: EmailStr = Field(..., description="User email")

class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model."""
    token: str = Field(..., description="Reset token")
    new_password: SecretStr = Field(..., min_length=8, description="New password")
    confirm_password: SecretStr = Field(..., description="Password confirmation")

    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class EmailVerificationRequest(BaseModel):
    """Email verification request model."""
    email: EmailStr = Field(..., description="Email to verify")

class EmailVerificationConfirm(BaseModel):
    """Email verification confirmation model."""
    token: str = Field(..., description="Verification token")
''',

            'schemas/blog.py': '''"""
Blog and content management Pydantic models.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, validator, HttpUrl
from pydantic.types import UUID4
from .base import TimestampMixin, UUIDMixin, StatusEnum, BaseResponseModel
from .auth import UserResponse

class ContentStatus(str, Enum):
    """Content status enumeration."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DELETED = "deleted"

class CategoryBase(BaseModel):
    """Base category model."""
    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly slug")
    description: Optional[str] = Field(None, max_length=500, description="Category description")
    color: Optional[str] = Field(None, regex=r'^#[0-9A-Fa-f]{6}$', description="Category color (hex)")
    is_active: bool = Field(True, description="Category active status")

    @validator('slug')
    def validate_slug(cls, v):
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError('Slug can only contain lowercase letters, numbers, and hyphens')
        return v

class CategoryCreate(CategoryBase):
    """Category creation model."""
    pass

class CategoryUpdate(BaseModel):
    """Category update model."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = Field(None, regex=r'^#[0-9A-Fa-f]{6}$')
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase, UUIDMixin, TimestampMixin):
    """Category response model."""
    post_count: int = Field(0, description="Number of posts in category")

    class Config:
        from_attributes = True

class TagBase(BaseModel):
    """Base tag model."""
    name: str = Field(..., min_length=1, max_length=50, description="Tag name")
    slug: str = Field(..., min_length=1, max_length=50, description="URL-friendly slug")
    color: Optional[str] = Field(None, regex=r'^#[0-9A-Fa-f]{6}$', description="Tag color (hex)")

    @validator('slug')
    def validate_slug(cls, v):
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError('Slug can only contain lowercase letters, numbers, and hyphens')
        return v

class TagCreate(TagBase):
    """Tag creation model."""
    pass

class TagUpdate(BaseModel):
    """Tag update model."""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    slug: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, regex=r'^#[0-9A-Fa-f]{6}$')

class TagResponse(TagBase, UUIDMixin, TimestampMixin):
    """Tag response model."""
    post_count: int = Field(0, description="Number of posts with tag")

    class Config:
        from_attributes = True

class PostBase(BaseModel):
    """Base post model."""
    title: str = Field(..., min_length=1, max_length=200, description="Post title")
    slug: str = Field(..., min_length=1, max_length=200, description="URL-friendly slug")
    excerpt: Optional[str] = Field(None, max_length=500, description="Post excerpt")
    content: str = Field(..., min_length=1, description="Post content")
    featured_image: Optional[HttpUrl] = Field(None, description="Featured image URL")
    status: ContentStatus = Field(ContentStatus.DRAFT, description="Post status")
    is_featured: bool = Field(False, description="Featured post flag")
    meta_title: Optional[str] = Field(None, max_length=60, description="SEO meta title")
    meta_description: Optional[str] = Field(None, max_length=160, description="SEO meta description")
    published_at: Optional[datetime] = Field(None, description="Publication timestamp")

    @validator('slug')
    def validate_slug(cls, v):
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError('Slug can only contain lowercase letters, numbers, and hyphens')
        return v

class PostCreate(PostBase):
    """Post creation model."""
    category_id: UUID4 = Field(..., description="Category ID")
    tag_ids: Optional[List[UUID4]] = Field(None, description="Tag IDs")

class PostUpdate(BaseModel):
    """Post update model."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    slug: Optional[str] = Field(None, min_length=1, max_length=200)
    excerpt: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    featured_image: Optional[HttpUrl] = None
    status: Optional[ContentStatus] = None
    is_featured: Optional[bool] = None
    meta_title: Optional[str] = Field(None, max_length=60)
    meta_description: Optional[str] = Field(None, max_length=160)
    category_id: Optional[UUID4] = None
    tag_ids: Optional[List[UUID4]] = None
    published_at: Optional[datetime] = None

class PostResponse(PostBase, UUIDMixin, TimestampMixin):
    """Post response model."""
    author: UserResponse
    category: CategoryResponse
    tags: List[TagResponse] = Field(default_factory=list)
    view_count: int = Field(0, description="Post view count")
    like_count: int = Field(0, description="Post like count")
    comment_count: int = Field(0, description="Post comment count")

    class Config:
        from_attributes = True

class CommentBase(BaseModel):
    """Base comment model."""
    content: str = Field(..., min_length=1, max_length=1000, description="Comment content")
    is_approved: bool = Field(False, description="Comment approval status")

class CommentCreate(CommentBase):
    """Comment creation model."""
    post_id: UUID4 = Field(..., description="Post ID")
    parent_id: Optional[UUID4] = Field(None, description="Parent comment ID for replies")

class CommentUpdate(BaseModel):
    """Comment update model."""
    content: Optional[str] = Field(None, min_length=1, max_length=1000)
    is_approved: Optional[bool] = None

class CommentResponse(CommentBase, UUIDMixin, TimestampMixin):
    """Comment response model."""
    author: UserResponse
    post_id: UUID4
    parent_id: Optional[UUID4] = None
    replies: List["CommentResponse"] = Field(default_factory=list)
    like_count: int = Field(0, description="Comment like count")

    class Config:
        from_attributes = True

# Update forward reference
CommentResponse.model_rebuild()

class PostFilters(BaseModel):
    """Post filtering parameters."""
    category_id: Optional[UUID4] = None
    tag_ids: Optional[List[UUID4]] = None
    author_id: Optional[UUID4] = None
    status: Optional[ContentStatus] = None
    is_featured: Optional[bool] = None
    published_after: Optional[datetime] = None
    published_before: Optional[datetime] = None
    search: Optional[str] = Field(None, min_length=3, description="Search term")

class PostStats(BaseModel):
    """Post statistics model."""
    total_posts: int = Field(0, description="Total number of posts")
    published_posts: int = Field(0, description="Number of published posts")
    draft_posts: int = Field(0, description="Number of draft posts")
    total_views: int = Field(0, description="Total post views")
    total_likes: int = Field(0, description="Total post likes")
    total_comments: int = Field(0, description="Total comments")
    categories_count: int = Field(0, description="Number of categories")
    tags_count: int = Field(0, description="Number of tags")
''',

            'schemas/api.py': '''"""
General API and system Pydantic models.
"""
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator
from pydantic.types import UUID4
from .base import BaseResponseModel, PaginationMeta

class SystemInfo(BaseModel):
    """System information model."""
    name: str = Field(..., description="Application name")
    version: str = Field(..., description="Application version")
    framework: str = Field(..., description="Framework name")
    python_version: str = Field(..., description="Python version")
    environment: str = Field(..., description="Environment (dev/staging/prod)")
    debug_mode: bool = Field(False, description="Debug mode status")
    uptime: float = Field(..., description="System uptime in seconds")

class DatabaseInfo(BaseModel):
    """Database information model."""
    engine: str = Field(..., description="Database engine")
    version: Optional[str] = Field(None, description="Database version")
    connection_count: int = Field(0, description="Active connections")
    max_connections: int = Field(0, description="Maximum connections")
    pool_size: int = Field(0, description="Connection pool size")
    is_healthy: bool = Field(True, description="Database health status")

class CacheInfo(BaseModel):
    """Cache information model."""
    backend: str = Field(..., description="Cache backend")
    location: str = Field(..., description="Cache location/URL")
    key_count: int = Field(0, description="Number of cached keys")
    memory_usage: str = Field("0B", description="Memory usage")
    hit_rate: float = Field(0.0, description="Cache hit rate")
    is_healthy: bool = Field(True, description="Cache health status")

class WebSocketStats(BaseModel):
    """WebSocket statistics model."""
    total_connections: int = Field(0, description="Total WebSocket connections")
    chat_connections: int = Field(0, description="Chat connections")
    notification_connections: int = Field(0, description="Notification connections")
    messages_sent: int = Field(0, description="Total messages sent")
    messages_received: int = Field(0, description="Total messages received")

class SystemMetrics(BaseModel):
    """System metrics model."""
    cpu_percent: float = Field(0.0, description="CPU usage percentage")
    memory_percent: float = Field(0.0, description="Memory usage percentage")
    disk_percent: float = Field(0.0, description="Disk usage percentage")
    load_average: List[float] = Field(default_factory=list, description="System load average")
    network_io: Dict[str, int] = Field(default_factory=dict, description="Network I/O stats")
    disk_io: Dict[str, int] = Field(default_factory=dict, description="Disk I/O stats")

class DetailedStatus(BaseModel):
    """Detailed system status model."""
    system: SystemInfo
    database: DatabaseInfo
    cache: CacheInfo
    websockets: WebSocketStats
    metrics: SystemMetrics
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class LogEntry(BaseModel):
    """Log entry model."""
    level: str = Field(..., description="Log level")
    message: str = Field(..., description="Log message")
    timestamp: datetime = Field(..., description="Log timestamp")
    module: Optional[str] = Field(None, description="Module name")
    function: Optional[str] = Field(None, description="Function name")
    line_number: Optional[int] = Field(None, description="Line number")
    extra: Optional[Dict[str, Any]] = Field(None, description="Extra log data")

class LogFilter(BaseModel):
    """Log filtering parameters."""
    level: Optional[str] = Field(None, description="Minimum log level")
    module: Optional[str] = Field(None, description="Module name filter")
    start_time: Optional[datetime] = Field(None, description="Start time filter")
    end_time: Optional[datetime] = Field(None, description="End time filter")
    search: Optional[str] = Field(None, description="Search term")
    limit: int = Field(100, ge=1, le=1000, description="Maximum entries to return")

class ConfigItem(BaseModel):
    """Configuration item model."""
    key: str = Field(..., description="Configuration key")
    value: Any = Field(..., description="Configuration value")
    type: str = Field(..., description="Value type")
    description: Optional[str] = Field(None, description="Configuration description")
    is_sensitive: bool = Field(False, description="Contains sensitive data")

class ConfigUpdate(BaseModel):
    """Configuration update model."""
    key: str = Field(..., description="Configuration key")
    value: Any = Field(..., description="New configuration value")

class BackupInfo(BaseModel):
    """Backup information model."""
    filename: str = Field(..., description="Backup filename")
    size: int = Field(..., description="Backup size in bytes")
    created_at: datetime = Field(..., description="Backup creation time")
    type: str = Field(..., description="Backup type (full/partial)")
    compressed: bool = Field(False, description="Is backup compressed")
    includes_media: bool = Field(False, description="Includes media files")

class BackupRequest(BaseModel):
    """Backup request model."""
    include_media: bool = Field(False, description="Include media files")
    compress: bool = Field(True, description="Compress backup")
    filename: Optional[str] = Field(None, description="Custom filename")

class RestoreRequest(BaseModel):
    """Restore request model."""
    backup_filename: str = Field(..., description="Backup file to restore")
    confirm: bool = Field(False, description="Confirmation flag")

class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskInfo(BaseModel):
    """Background task information model."""
    id: UUID4 = Field(..., description="Task ID")
    name: str = Field(..., description="Task name")
    status: TaskStatus = Field(..., description="Task status")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Task progress percentage")
    result: Optional[Any] = Field(None, description="Task result")
    error: Optional[str] = Field(None, description="Error message if failed")
    started_at: Optional[datetime] = Field(None, description="Task start time")
    completed_at: Optional[datetime] = Field(None, description="Task completion time")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Task creation time")

class BulkOperation(BaseModel):
    """Bulk operation model."""
    operation: str = Field(..., description="Operation type")
    item_ids: List[UUID4] = Field(..., min_items=1, description="Item IDs to operate on")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Operation parameters")

class BulkOperationResult(BaseModel):
    """Bulk operation result model."""
    operation: str = Field(..., description="Operation type")
    total_items: int = Field(..., description="Total items processed")
    successful_items: int = Field(..., description="Successfully processed items")
    failed_items: int = Field(..., description="Failed items")
    errors: List[str] = Field(default_factory=list, description="Error messages")
    duration: float = Field(..., description="Operation duration in seconds")

class ExportRequest(BaseModel):
    """Data export request model."""
    format: str = Field(..., description="Export format (json/csv/xlsx)")
    filters: Optional[Dict[str, Any]] = Field(None, description="Export filters")
    include_relations: bool = Field(False, description="Include related data")

class ExportInfo(BaseModel):
    """Export information model."""
    id: UUID4 = Field(..., description="Export ID")
    format: str = Field(..., description="Export format")
    status: TaskStatus = Field(..., description="Export status")
    file_url: Optional[str] = Field(None, description="Download URL when ready")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    record_count: Optional[int] = Field(None, description="Number of exported records")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(None, description="Download expiration time")
'''
        }

    def generate_framework_specific_models(self) -> Dict[str, str]:
        """Generate framework-specific integration models."""
        
        framework_models = {
            'fastapi': self._generate_fastapi_models(),
            'django': self._generate_django_models(),
            'flask': self._generate_flask_models(),
            'tornado': self._generate_tornado_models(),
            'sanic': self._generate_sanic_models()
        }
        
        return framework_models.get(self.framework, {})
    
    def _generate_fastapi_models(self) -> Dict[str, str]:
        """Generate FastAPI-specific models."""
        return {
            'schemas/fastapi_models.py': '''"""
FastAPI-specific Pydantic models and utilities.
"""
from typing import Optional, List, Any
from fastapi import Form, File, UploadFile, Query, Path, Body
from pydantic import BaseModel, Field
from .base import BaseResponseModel, PaginationMeta

class FastAPIQueryParams(BaseModel):
    """Standard FastAPI query parameters."""
    skip: int = Query(0, ge=0, description="Number of items to skip")
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return")
    sort_by: Optional[str] = Query(None, description="Field to sort by")
    order: str = Query("asc", regex="^(asc|desc)$", description="Sort order")
    search: Optional[str] = Query(None, min_length=3, description="Search term")

class FileUploadResponse(BaseResponseModel):
    """File upload response model."""
    filename: str = Field(..., description="Uploaded filename")
    content_type: str = Field(..., description="File content type")
    size: int = Field(..., description="File size in bytes")
    url: str = Field(..., description="File access URL")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail URL if image")

class BatchRequest(BaseModel):
    """Batch operation request for FastAPI."""
    items: List[Any] = Field(..., min_items=1, max_items=100, description="Items to process")
    operation: str = Field(..., description="Batch operation type")

class WebSocketMessage(BaseModel):
    """WebSocket message model for FastAPI."""
    type: str = Field(..., description="Message type")
    data: Any = Field(..., description="Message data")
    timestamp: Optional[str] = Field(None, description="Message timestamp")
    user_id: Optional[str] = Field(None, description="Sender user ID")
    room_id: Optional[str] = Field(None, description="Room ID for group messages")

class OpenAPICustomization(BaseModel):
    """OpenAPI documentation customization."""
    title: str = Field("API Documentation", description="API title")
    description: str = Field("", description="API description")
    version: str = Field("1.0.0", description="API version")
    contact_name: Optional[str] = Field(None, description="Contact name")
    contact_email: Optional[str] = Field(None, description="Contact email")
    license_name: Optional[str] = Field(None, description="License name")
    license_url: Optional[str] = Field(None, description="License URL")
'''
        }
    
    def _generate_django_models(self) -> Dict[str, str]:
        """Generate Django-specific models."""
        return {
            'schemas/django_models.py': '''"""
Django-specific Pydantic models for DRF integration.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .base import BaseResponseModel

class DjangoModelMixin(BaseModel):
    """Mixin for Django model integration."""
    
    class Config:
        from_attributes = True  # For Pydantic v2
        orm_mode = True  # For Pydantic v1 compatibility
        use_enum_values = True
        json_encoders = {
            # Custom JSON encoders for Django-specific types
        }

class DjangoFilterParams(BaseModel):
    """Django-style filtering parameters."""
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100, description="Items per page")
    ordering: Optional[str] = Field(None, description="Ordering field")
    search: Optional[str] = Field(None, description="Search query")

class DjangoChoiceField(BaseModel):
    """Django choice field representation."""
    value: Any = Field(..., description="Choice value")
    display: str = Field(..., description="Display text")

class ModelFieldInfo(BaseModel):
    """Django model field information."""
    name: str = Field(..., description="Field name")
    type: str = Field(..., description="Field type")
    required: bool = Field(..., description="Is field required")
    choices: Optional[List[DjangoChoiceField]] = Field(None, description="Field choices")
    max_length: Optional[int] = Field(None, description="Maximum length")
    help_text: Optional[str] = Field(None, description="Help text")

class ModelMetadata(BaseModel):
    """Django model metadata."""
    model_name: str = Field(..., description="Model name")
    verbose_name: str = Field(..., description="Verbose name")
    verbose_name_plural: str = Field(..., description="Verbose name plural")
    fields: List[ModelFieldInfo] = Field(..., description="Model fields")
    permissions: List[str] = Field(default_factory=list, description="Model permissions")

class SerializerValidationError(BaseModel):
    """Django serializer validation error."""
    field: str = Field(..., description="Field name")
    messages: List[str] = Field(..., description="Error messages")
    code: Optional[str] = Field(None, description="Error code")
'''
        }
    
    def _generate_flask_models(self) -> Dict[str, str]:
        """Generate Flask-specific models."""
        return {
            'schemas/flask_models.py': '''"""
Flask-specific Pydantic models for request/response validation.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from flask import request
from .base import BaseResponseModel

class FlaskRequestValidator(BaseModel):
    """Base Flask request validator."""
    
    @classmethod
    def from_request(cls, req=None):
        """Create model from Flask request."""
        if req is None:
            req = request
        
        # Handle JSON data
        if req.is_json:
            return cls(**req.get_json())
        
        # Handle form data
        elif req.form:
            return cls(**req.form.to_dict())
        
        # Handle query parameters
        else:
            return cls(**req.args.to_dict())

class FlaskPaginationParams(BaseModel):
    """Flask pagination parameters."""
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")

class FlaskFileUpload(BaseModel):
    """Flask file upload model."""
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="File content type")
    size: int = Field(..., description="File size in bytes")
    data: bytes = Field(..., description="File data")

class FlaskErrorResponse(BaseModel):
    """Flask error response model."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    status_code: int = Field(..., description="HTTP status code")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")

class FlaskSuccessResponse(BaseResponseModel):
    """Flask success response model."""
    data: Optional[Any] = Field(None, description="Response data")
    meta: Optional[Dict[str, Any]] = Field(None, description="Response metadata")

class BlueprintInfo(BaseModel):
    """Flask blueprint information."""
    name: str = Field(..., description="Blueprint name")
    url_prefix: Optional[str] = Field(None, description="URL prefix")
    subdomain: Optional[str] = Field(None, description="Subdomain")
    static_folder: Optional[str] = Field(None, description="Static folder")
    template_folder: Optional[str] = Field(None, description="Template folder")
'''
        }
    
    def _generate_tornado_models(self) -> Dict[str, str]:
        """Generate Tornado-specific models."""
        return {
            'schemas/tornado_models.py': '''"""
Tornado-specific Pydantic models for async request handling.
"""
from typing import Optional, Dict, Any, Awaitable
from pydantic import BaseModel, Field
from .base import BaseResponseModel

class TornadoWebSocketMessage(BaseModel):
    """Tornado WebSocket message model."""
    type: str = Field(..., description="Message type")
    payload: Dict[str, Any] = Field(..., description="Message payload")
    timestamp: Optional[str] = Field(None, description="Message timestamp")
    connection_id: Optional[str] = Field(None, description="Connection ID")

class TornadoAsyncResponse(BaseResponseModel):
    """Tornado async response model."""
    execution_time: float = Field(..., description="Request execution time")
    handler_name: str = Field(..., description="Handler class name")

class TornadoRequestMetadata(BaseModel):
    """Tornado request metadata."""
    method: str = Field(..., description="HTTP method")
    uri: str = Field(..., description="Request URI")
    remote_ip: str = Field(..., description="Client IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    headers: Dict[str, str] = Field(default_factory=dict, description="Request headers")

class TornadoHandlerConfig(BaseModel):
    """Tornado handler configuration."""
    handler_class: str = Field(..., description="Handler class name")
    pattern: str = Field(..., description="URL pattern")
    kwargs: Optional[Dict[str, Any]] = Field(None, description="Handler kwargs")
    name: Optional[str] = Field(None, description="Route name")

class TornadoApplicationInfo(BaseModel):
    """Tornado application information."""
    handlers: List[TornadoHandlerConfig] = Field(..., description="Registered handlers")
    settings: Dict[str, Any] = Field(..., description="Application settings")
    listen_port: int = Field(..., description="Listen port")
    listen_address: str = Field(..., description="Listen address")
'''
        }
    
    def _generate_sanic_models(self) -> Dict[str, str]:
        """Generate Sanic-specific models."""
        return {
            'schemas/sanic_models.py': '''"""
Sanic-specific Pydantic models for ultra-fast async APIs.
"""
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from .base import BaseResponseModel

class SanicRequestContext(BaseModel):
    """Sanic request context model."""
    request_id: str = Field(..., description="Unique request ID")
    user_id: Optional[str] = Field(None, description="Authenticated user ID")
    session_id: Optional[str] = Field(None, description="Session ID")
    correlation_id: Optional[str] = Field(None, description="Correlation ID")

class SanicMiddlewareInfo(BaseModel):
    """Sanic middleware information."""
    name: str = Field(..., description="Middleware name")
    type: str = Field(..., description="Middleware type (request/response)")
    order: int = Field(..., description="Execution order")
    enabled: bool = Field(True, description="Is middleware enabled")

class SanicBlueprintInfo(BaseModel):
    """Sanic blueprint information."""
    name: str = Field(..., description="Blueprint name")
    url_prefix: Optional[str] = Field(None, description="URL prefix")
    host: Optional[str] = Field(None, description="Host restriction")
    version: Optional[int] = Field(None, description="API version")
    strict_slashes: Optional[bool] = Field(None, description="Strict slashes setting")

class SanicPerformanceMetrics(BaseModel):
    """Sanic performance metrics."""
    requests_per_second: float = Field(0.0, description="Requests per second")
    average_response_time: float = Field(0.0, description="Average response time (ms)")
    active_connections: int = Field(0, description="Active connections")
    total_requests: int = Field(0, description="Total requests processed")
    error_rate: float = Field(0.0, description="Error rate percentage")

class SanicWorkerInfo(BaseModel):
    """Sanic worker information."""
    worker_id: int = Field(..., description="Worker ID")
    pid: int = Field(..., description="Process ID")
    memory_usage: float = Field(..., description="Memory usage (MB)")
    cpu_usage: float = Field(..., description="CPU usage percentage")
    requests_handled: int = Field(0, description="Requests handled by worker")

class SanicServerInfo(BaseModel):
    """Sanic server information."""
    host: str = Field(..., description="Server host")
    port: int = Field(..., description="Server port")
    workers: List[SanicWorkerInfo] = Field(..., description="Worker information")
    middlewares: List[SanicMiddlewareInfo] = Field(..., description="Registered middlewares")
    blueprints: List[SanicBlueprintInfo] = Field(..., description="Registered blueprints")
    performance: SanicPerformanceMetrics = Field(..., description="Performance metrics")
'''
        }

    def generate_validation_utilities(self) -> Dict[str, str]:
        """Generate validation utilities and helpers."""
        
        return {
            'utils/__init__.py': '',
            
            'utils/validation.py': '''"""
Validation utilities for Pydantic models.
"""
import re
from typing import Any, Dict, List, Union, Optional
from datetime import datetime, date
from pydantic import validator, ValidationError
from email_validator import validate_email, EmailNotValidError

class ValidationUtils:
    """Utility class for common validation operations."""
    
    @staticmethod
    def validate_email_format(email: str) -> str:
        """Validate email format."""
        try:
            valid_email = validate_email(email)
            return valid_email.email
        except EmailNotValidError:
            raise ValueError("Invalid email format")
    
    @staticmethod
    def validate_phone_number(phone: str) -> str:
        """Validate phone number format."""
        # Remove all non-digit characters
        digits_only = re.sub(r'\\D', '', phone)
        
        # Check if it's a valid length
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Phone number must be between 10 and 15 digits")
        
        return phone
    
    @staticmethod
    def validate_url(url: str) -> str:
        """Validate URL format."""
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\\.)+'
            r'(?:[A-Z]{2,6}\\.?|[A-Z0-9-]{2,}\\.?)|'  # domain...
            r'localhost|'  # localhost...
            r'\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})'  # ...or ip
            r'(?::\\d+)?'  # optional port
            r'(?:/?|[/?]\\S+)$', re.IGNORECASE)
        
        if not url_pattern.match(url):
            raise ValueError("Invalid URL format")
        
        return url
    
    @staticmethod
    def validate_password_strength(password: str) -> str:
        """Validate password strength."""
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        if not re.search(r'[A-Z]', password):
            raise ValueError("Password must contain at least one uppercase letter")
        
        if not re.search(r'[a-z]', password):
            raise ValueError("Password must contain at least one lowercase letter")
        
        if not re.search(r'\\d', password):
            raise ValueError("Password must contain at least one digit")
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValueError("Password must contain at least one special character")
        
        return password
    
    @staticmethod
    def validate_slug(slug: str) -> str:
        """Validate URL slug format."""
        if not re.match(r'^[a-z0-9-]+$', slug):
            raise ValueError("Slug can only contain lowercase letters, numbers, and hyphens")
        
        if slug.startswith('-') or slug.endswith('-'):
            raise ValueError("Slug cannot start or end with a hyphen")
        
        if '--' in slug:
            raise ValueError("Slug cannot contain consecutive hyphens")
        
        return slug
    
    @staticmethod
    def validate_hex_color(color: str) -> str:
        """Validate hex color format."""
        if not re.match(r'^#[0-9A-Fa-f]{6}$', color):
            raise ValueError("Color must be a valid hex color (e.g., #FF0000)")
        
        return color.upper()
    
    @staticmethod
    def validate_json(json_str: str) -> str:
        """Validate JSON string format."""
        try:
            import json
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON format")
    
    @staticmethod
    def sanitize_html(html: str) -> str:
        """Sanitize HTML content."""
        try:
            import bleach
            allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
            allowed_attributes = {'a': ['href', 'title']}
            return bleach.clean(html, tags=allowed_tags, attributes=allowed_attributes)
        except ImportError:
            # If bleach is not available, return as is (consider installing bleach)
            return html

class ModelValidator:
    """Generic model validator with common validation patterns."""
    
    @staticmethod
    def create_email_validator():
        """Create email field validator."""
        @validator('email')
        def validate_email(cls, v):
            return ValidationUtils.validate_email_format(v)
        return validate_email
    
    @staticmethod
    def create_password_validator():
        """Create password field validator."""
        @validator('password')
        def validate_password(cls, v):
            if hasattr(v, 'get_secret_value'):
                password = v.get_secret_value()
            else:
                password = v
            return ValidationUtils.validate_password_strength(password)
        return validate_password
    
    @staticmethod
    def create_slug_validator():
        """Create slug field validator."""
        @validator('slug')
        def validate_slug(cls, v):
            return ValidationUtils.validate_slug(v)
        return validate_slug
    
    @staticmethod
    def create_phone_validator():
        """Create phone field validator."""
        @validator('phone')
        def validate_phone(cls, v):
            if v:
                return ValidationUtils.validate_phone_number(v)
            return v
        return validate_phone

class ValidationErrorFormatter:
    """Format validation errors for consistent API responses."""
    
    @staticmethod
    def format_validation_error(error: ValidationError) -> Dict[str, Any]:
        """Format Pydantic ValidationError for API response."""
        formatted_errors = []
        
        for error_detail in error.errors():
            field_path = '.'.join(str(loc) for loc in error_detail['loc'])
            formatted_errors.append({
                'field': field_path,
                'message': error_detail['msg'],
                'code': error_detail.get('type', 'validation_error'),
                'input': error_detail.get('input', None)
            })
        
        return {
            'error': 'Validation Error',
            'message': 'Request validation failed',
            'details': formatted_errors,
            'error_count': len(formatted_errors)
        }
    
    @staticmethod
    def format_field_errors(errors: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Format field errors from form validation."""
        formatted_errors = []
        
        for field, messages in errors.items():
            for message in messages:
                formatted_errors.append({
                    'field': field,
                    'message': message,
                    'code': 'field_error'
                })
        
        return formatted_errors
'''
        }