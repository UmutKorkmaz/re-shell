import { BackendTemplate } from '../types';

export const flaskTemplate: BackendTemplate = {
  id: 'flask',
  name: 'flask',
  displayName: 'Flask',
  description: 'Lightweight and flexible Python web framework with extensive ecosystem',
  language: 'python',
  framework: 'flask',
  version: '3.0.3',
  tags: ['python', 'flask', 'api', 'rest', 'web', 'microframework'],
  port: 5000,
  dependencies: {},
  features: ['routing', 'database', 'authentication', 'testing', 'websockets'],
  
  files: {
    // Python project configuration
    'requirements.txt': `Flask==3.0.3
Flask-SQLAlchemy==3.1.1
Flask-Migrate==4.0.7
Flask-Login==0.6.3
Flask-JWT-Extended==4.6.0
Flask-CORS==4.0.0
Flask-RESTful==0.3.10
Flask-Marshmallow==1.2.1
Flask-Mail==0.9.1
Flask-Limiter==3.6.0
Flask-Caching==2.1.0
Flask-SocketIO==5.3.6
Flask-APScheduler==1.13.1
Flask-Admin==1.6.1
Flask-WTF==1.2.1
Flask-Bcrypt==1.0.1
Flask-Compress==1.14
Flask-Talisman==1.1.0
marshmallow-sqlalchemy==1.0.0
python-dotenv==1.0.1
psycopg2-binary==2.9.9
PyMySQL==1.1.0
redis==5.0.3
celery==5.3.6
gunicorn==22.0.0
eventlet==0.35.2
python-socketio==5.11.2
email-validator==2.1.1
Pillow==10.3.0
boto3==1.34.84
stripe==8.9.0
requests==2.31.0
beautifulsoup4==4.12.3
pandas==2.2.2
numpy==1.26.4
matplotlib==3.8.4
seaborn==0.13.2
python-dateutil==2.9.0
pytz==2024.1
cryptography==42.0.5
PyJWT==2.8.0
passlib==1.7.4
argon2-cffi==23.1.0
itsdangerous==2.2.0
click==8.1.7
werkzeug==3.0.2
Jinja2==3.1.3
MarkupSafe==2.1.5
blinker==1.7.0

# Development dependencies
pytest==8.1.1
pytest-flask==1.3.0
pytest-cov==5.0.0
pytest-mock==3.14.0
pytest-asyncio==0.23.6
factory-boy==3.3.0
faker==24.4.0
black==24.3.0
flake8==7.0.0
pylint==3.1.0
mypy==1.9.0
isort==5.13.2
pre-commit==3.7.0
python-decouple==3.8
httpx==0.27.0
locust==2.24.1`,

    // Flask application factory
    'app/__init__.py': `import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from flask_socketio import SocketIO
from flask_marshmallow import Marshmallow
from flask_bcrypt import Bcrypt
from flask_compress import Compress
from flask_talisman import Talisman
from flask_apscheduler import APScheduler
from celery import Celery
from config import config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(key_func=get_remote_address)
cache = Cache()
socketio = SocketIO()
ma = Marshmallow()
bcrypt = Bcrypt()
compress = Compress()
scheduler = APScheduler()
celery = Celery()


def create_app(config_name='development'):
    """Application factory pattern."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})
    mail.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='eventlet')
    ma.init_app(app)
    bcrypt.init_app(app)
    compress.init_app(app)
    
    # Security headers (disable in development for easier debugging)
    if app.config['ENV'] == 'production':
        Talisman(app, force_https=True)
    
    # Initialize scheduler
    if app.config.get('SCHEDULER_API_ENABLED'):
        scheduler.init_app(app)
        scheduler.start()
    
    # Initialize Celery
    celery.conf.update(app.config)
    
    # Configure login manager
    login_manager.login_view = 'auth.login'
    login_manager.login_message_category = 'info'
    
    # Register blueprints
    from app.api import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')
    
    from app.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')
    
    from app.main import main_bp
    app.register_blueprint(main_bp)
    
    from app.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/admin')
    
    # Register error handlers
    from app.errors import register_error_handlers
    register_error_handlers(app)
    
    # Register CLI commands
    from app.cli import register_commands
    register_commands(app)
    
    # WebSocket events
    from app.events import register_socketio_events
    register_socketio_events(socketio)
    
    # Create upload directory
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    return app`,

    // Configuration
    'config.py': `import os
from datetime import timedelta
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Database
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_RECORD_QUERIES = True
    
    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_ALGORITHM = 'HS256'
    
    # Mail
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@example.com')
    
    # Redis
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'
    
    # Cache
    CACHE_TYPE = 'redis'
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Rate limiting
    RATELIMIT_STORAGE_URL = REDIS_URL
    RATELIMIT_DEFAULT = "100 per hour"
    
    # Celery
    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or REDIS_URL
    CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or REDIS_URL
    CELERY_TASK_SERIALIZER = 'json'
    CELERY_ACCEPT_CONTENT = ['json']
    CELERY_RESULT_SERIALIZER = 'json'
    CELERY_TIMEZONE = 'UTC'
    CELERY_ENABLE_UTC = True
    
    # File upload
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'}
    
    # Pagination
    ITEMS_PER_PAGE = 20
    
    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    
    # Scheduler
    SCHEDULER_API_ENABLED = True
    SCHEDULER_TIMEZONE = 'UTC'
    
    # Logging
    LOG_TO_STDOUT = os.environ.get('LOG_TO_STDOUT')
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or \
        'postgresql://user:password@localhost/{{projectName}}_dev'
    SQLALCHEMY_ECHO = True
    
    # Disable CSRF for API testing
    WTF_CSRF_ENABLED = False


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or \
        'postgresql://user:password@localhost/{{projectName}}_test'
    WTF_CSRF_ENABLED = False
    
    # Disable rate limiting during tests
    RATELIMIT_ENABLED = False


class ProductionConfig(Config):
    """Production configuration."""
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    
    # Security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # Performance
    SEND_FILE_MAX_AGE_DEFAULT = 31536000  # 1 year
    
    @staticmethod
    def init_app(app):
        Config.init_app(app)
        
        # Log to syslog
        import logging
        from logging.handlers import SysLogHandler
        
        if not app.debug and not app.testing:
            syslog_handler = SysLogHandler()
            syslog_handler.setLevel(logging.WARNING)
            app.logger.addHandler(syslog_handler)


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}`,

    // Database models
    'app/models/__init__.py': `from app.models.user import User
from app.models.todo import Todo
from app.models.role import Role, Permission

__all__ = ['User', 'Todo', 'Role', 'Permission']`,

    'app/models/user.py': `from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy import func
from app import db, login_manager
from app.models.role import Role, Permission


class User(UserMixin, db.Model):
    """User model."""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200))
    full_name = db.Column(db.String(100))
    avatar_url = db.Column(db.String(200))
    bio = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    is_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(100))
    reset_token = db.Column(db.String(100))
    reset_token_expiry = db.Column(db.DateTime)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'))
    role = db.relationship('Role', backref='users')
    todos = db.relationship('Todo', backref='author', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        """Set password hash."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash."""
        return check_password_hash(self.password_hash, password)
    
    def can(self, permission):
        """Check if user has permission."""
        return self.role is not None and self.role.has_permission(permission)
    
    def is_administrator(self):
        """Check if user is admin."""
        return self.can(Permission.ADMIN)
    
    def get_reset_token(self, expires_in=600):
        """Generate password reset token."""
        from app.utils.tokens import generate_token
        return generate_token({'reset_password': self.id}, expires_in)
    
    @staticmethod
    def verify_reset_token(token):
        """Verify password reset token."""
        from app.utils.tokens import verify_token
        data = verify_token(token)
        if not data or 'reset_password' not in data:
            return None
        return User.query.get(data['reset_password'])
    
    def to_dict(self, include_email=False):
        """Convert to dictionary."""
        data = {
            'id': self.id,
            'username': self.username,
            'full_name': self.full_name,
            'avatar_url': self.avatar_url,
            'bio': self.bio,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None}
        if include_email:
            data['email'] = self.email
        return data


@login_manager.user_loader
def load_user(user_id):
    """Load user by ID."""
    return User.query.get(int(user_id))`,

    'app/models/todo.py': `from datetime import datetime
from app import db


class Todo(db.Model):
    """Todo model."""
    __tablename__ = 'todos'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    completed = db.Column(db.Boolean, default=False)
    priority = db.Column(db.Enum('low', 'medium', 'high', name='priority_types'), default='medium')
    due_date = db.Column(db.DateTime)
    tags = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign key
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    def __repr__(self):
        return f'<Todo {self.title}>'
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'completed': self.completed,
            'priority': self.priority,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'tags': self.tags or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'user_id': self.user_id}`,

    'app/models/role.py': `from app import db


class Permission:
    """Permission constants."""
    READ = 1
    WRITE = 2
    DELETE = 4
    ADMIN = 8


class Role(db.Model):
    """Role model."""
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True)
    default = db.Column(db.Boolean, default=False, index=True)
    permissions = db.Column(db.Integer)
    
    def __init__(self, **kwargs):
        super(Role, self).__init__(**kwargs)
        if self.permissions is None:
            self.permissions = 0
    
    def add_permission(self, perm):
        """Add permission to role."""
        if not self.has_permission(perm):
            self.permissions += perm
    
    def remove_permission(self, perm):
        """Remove permission from role."""
        if self.has_permission(perm):
            self.permissions -= perm
    
    def reset_permissions(self):
        """Reset all permissions."""
        self.permissions = 0
    
    def has_permission(self, perm):
        """Check if role has permission."""
        return self.permissions & perm == perm
    
    @staticmethod
    def insert_roles():
        """Insert default roles."""
        roles = {
            'User': [Permission.READ, Permission.WRITE],
            'Moderator': [Permission.READ, Permission.WRITE, Permission.DELETE],
            'Administrator': [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN]}
        default_role = 'User'
        for r in roles:
            role = Role.query.filter_by(name=r).first()
            if role is None:
                role = Role(name=r)
            role.reset_permissions()
            for perm in roles[r]:
                role.add_permission(perm)
            role.default = (role.name == default_role)
            db.session.add(role)
        db.session.commit()
    
    def __repr__(self):
        return f'<Role {self.name}>'`,

    // API blueprints
    'app/api/__init__.py': `from flask import Blueprint
from flask_restful import Api

api_bp = Blueprint('api', __name__)
api = Api(api_bp)

# Import and register resources
from app.api import auth, users, todos, health

# Health endpoints
api.add_resource(health.HealthResource, '/health')
api.add_resource(health.ReadinessResource, '/ready')

# Auth endpoints
api.add_resource(auth.RegisterResource, '/auth/register')
api.add_resource(auth.LoginResource, '/auth/login')
api.add_resource(auth.RefreshResource, '/auth/refresh')
api.add_resource(auth.LogoutResource, '/auth/logout')

# User endpoints
api.add_resource(users.UserListResource, '/users')
api.add_resource(users.UserResource, '/users/<int:user_id>')
api.add_resource(users.CurrentUserResource, '/users/me')

# Todo endpoints
api.add_resource(todos.TodoListResource, '/todos')
api.add_resource(todos.TodoResource, '/todos/<int:todo_id>')`,

    'app/api/auth.py': `from flask import request
from flask_restful import Resource
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from marshmallow import ValidationError
from app import db, limiter
from app.models import User
from app.schemas import UserSchema, LoginSchema, RegisterSchema
from app.utils.decorators import validate_json


class RegisterResource(Resource):
    """User registration endpoint."""
    decorators = [limiter.limit("5 per hour")]
    
    @validate_json(RegisterSchema())
    def post(self):
        """Register new user."""
        data = request.get_json()
        
        # Check if user exists
        if User.query.filter_by(email=data['email']).first():
            return {'message': 'Email already registered'}, 400
        
        if User.query.filter_by(username=data['username']).first():
            return {'message': 'Username already taken'}, 400
        
        # Create user
        user = User(
            email=data['email'],
            username=data['username'],
            full_name=data.get('full_name')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Generate tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return {
            'message': 'User created successfully',
            'user': UserSchema().dump(user),
            'access_token': access_token,
            'refresh_token': refresh_token
        }, 201


class LoginResource(Resource):
    """User login endpoint."""
    decorators = [limiter.limit("10 per hour")]
    
    @validate_json(LoginSchema())
    def post(self):
        """Login user."""
        data = request.get_json()
        
        # Find user by email or username
        user = User.query.filter(
            (User.email == data['username']) | 
            (User.username == data['username'])
        ).first()
        
        if not user or not user.check_password(data['password']):
            return {'message': 'Invalid credentials'}, 401
        
        if not user.is_active:
            return {'message': 'Account is deactivated'}, 403
        
        # Update last login
        user.last_login = db.func.now()
        db.session.commit()
        
        # Generate tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return {
            'message': 'Login successful',
            'user': UserSchema().dump(user),
            'access_token': access_token,
            'refresh_token': refresh_token
        }, 200


class RefreshResource(Resource):
    """Token refresh endpoint."""
    
    @jwt_required(refresh=True)
    def post(self):
        """Refresh access token."""
        identity = get_jwt_identity()
        access_token = create_access_token(identity=identity)
        
        return {
            'access_token': access_token
        }, 200


class LogoutResource(Resource):
    """User logout endpoint."""
    
    @jwt_required()
    def post(self):
        """Logout user."""
        # In a production app, you would blacklist the token here
        return {'message': 'Logout successful'}, 200`,

    'app/api/users.py': `from flask import request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User
from app.schemas import UserSchema, UserUpdateSchema
from app.utils.decorators import validate_json, admin_required


class UserListResource(Resource):
    """User list endpoint."""
    
    @jwt_required()
    @admin_required
    def get(self):
        """Get all users (admin only)."""
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        pagination = User.query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'users': UserSchema(many=True).dump(pagination.items),
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }, 200


class UserResource(Resource):
    """Single user endpoint."""
    
    @jwt_required()
    def get(self, user_id):
        """Get user by ID."""
        user = User.query.get_or_404(user_id)
        current_user_id = get_jwt_identity()
        
        # Users can only view their own profile unless admin
        if user.id != current_user_id and not User.query.get(current_user_id).is_administrator():
            return {'message': 'Unauthorized'}, 403
        
        return UserSchema().dump(user), 200
    
    @jwt_required()
    @validate_json(UserUpdateSchema())
    def put(self, user_id):
        """Update user."""
        user = User.query.get_or_404(user_id)
        current_user_id = get_jwt_identity()
        
        # Users can only update their own profile unless admin
        if user.id != current_user_id and not User.query.get(current_user_id).is_administrator():
            return {'message': 'Unauthorized'}, 403
        
        data = request.get_json()
        
        # Update fields
        for field in ['full_name', 'bio', 'avatar_url']:
            if field in data:
                setattr(user, field, data[field])
        
        # Update password if provided
        if 'password' in data:
            user.set_password(data['password'])
        
        db.session.commit()
        
        return {
            'message': 'User updated successfully',
            'user': UserSchema().dump(user)
        }, 200
    
    @jwt_required()
    @admin_required
    def delete(self, user_id):
        """Delete user (admin only)."""
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        
        return {'message': 'User deleted successfully'}, 200


class CurrentUserResource(Resource):
    """Current user endpoint."""
    
    @jwt_required()
    def get(self):
        """Get current user."""
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        return UserSchema().dump(user), 200`,

    'app/api/todos.py': `from flask import request
from flask_restful import Resource
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Todo
from app.schemas import TodoSchema, TodoCreateSchema, TodoUpdateSchema
from app.utils.decorators import validate_json


class TodoListResource(Resource):
    """Todo list endpoint."""
    
    @jwt_required()
    def get(self):
        """Get user's todos."""
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Build query
        query = Todo.query.filter_by(user_id=user_id)
        
        # Filter by completion status
        completed = request.args.get('completed')
        if completed is not None:
            query = query.filter_by(completed=completed.lower() == 'true')
        
        # Filter by priority
        priority = request.args.get('priority')
        if priority:
            query = query.filter_by(priority=priority)
        
        # Sort
        sort_by = request.args.get('sort_by', 'created_at')
        order = request.args.get('order', 'desc')
        
        if order == 'asc':
            query = query.order_by(getattr(Todo, sort_by).asc())
        else:
            query = query.order_by(getattr(Todo, sort_by).desc())
        
        # Paginate
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'todos': TodoSchema(many=True).dump(pagination.items),
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }, 200
    
    @jwt_required()
    @validate_json(TodoCreateSchema())
    def post(self):
        """Create new todo."""
        user_id = get_jwt_identity()
        data = request.get_json()
        
        todo = Todo(
            title=data['title'],
            description=data.get('description'),
            priority=data.get('priority', 'medium'),
            due_date=data.get('due_date'),
            tags=data.get('tags', []),
            user_id=user_id
        )
        
        db.session.add(todo)
        db.session.commit()
        
        return {
            'message': 'Todo created successfully',
            'todo': TodoSchema().dump(todo)
        }, 201


class TodoResource(Resource):
    """Single todo endpoint."""
    
    @jwt_required()
    def get(self, todo_id):
        """Get todo by ID."""
        user_id = get_jwt_identity()
        todo = Todo.query.filter_by(id=todo_id, user_id=user_id).first_or_404()
        
        return TodoSchema().dump(todo), 200
    
    @jwt_required()
    @validate_json(TodoUpdateSchema())
    def put(self, todo_id):
        """Update todo."""
        user_id = get_jwt_identity()
        todo = Todo.query.filter_by(id=todo_id, user_id=user_id).first_or_404()
        
        data = request.get_json()
        
        # Update fields
        for field in ['title', 'description', 'completed', 'priority', 'due_date', 'tags']:
            if field in data:
                setattr(todo, field, data[field])
        
        db.session.commit()
        
        return {
            'message': 'Todo updated successfully',
            'todo': TodoSchema().dump(todo)
        }, 200
    
    @jwt_required()
    def delete(self, todo_id):
        """Delete todo."""
        user_id = get_jwt_identity()
        todo = Todo.query.filter_by(id=todo_id, user_id=user_id).first_or_404()
        
        db.session.delete(todo)
        db.session.commit()
        
        return {'message': 'Todo deleted successfully'}, 200`,

    // Schemas
    'app/schemas/__init__.py': `from app.schemas.user import UserSchema, LoginSchema, RegisterSchema, UserUpdateSchema
from app.schemas.todo import TodoSchema, TodoCreateSchema, TodoUpdateSchema

__all__ = [
    'UserSchema', 'LoginSchema', 'RegisterSchema', 'UserUpdateSchema',
    'TodoSchema', 'TodoCreateSchema', 'TodoUpdateSchema'
]`,

    'app/schemas/user.py': `from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class UserSchema(Schema):
    """User serialization schema."""
    id = fields.Int(dump_only=True)
    email = fields.Email(dump_only=True)
    username = fields.Str(dump_only=True)
    full_name = fields.Str()
    avatar_url = fields.Url(allow_none=True)
    bio = fields.Str()
    is_active = fields.Bool(dump_only=True)
    is_verified = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    last_login = fields.DateTime(dump_only=True)


class LoginSchema(Schema):
    """Login validation schema."""
    username = fields.Str(required=True, validate=validate.Length(min=3))
    password = fields.Str(required=True, validate=validate.Length(min=8))


class RegisterSchema(Schema):
    """Registration validation schema."""
    email = fields.Email(required=True)
    username = fields.Str(required=True, validate=validate.Length(min=3, max=80))
    password = fields.Str(required=True, validate=validate.Length(min=8))
    full_name = fields.Str(validate=validate.Length(max=100))
    
    @validates_schema
    def validate_password(self, data, **kwargs):
        """Validate password strength."""
        password = data.get('password')
        if password:
            if not any(char.isdigit() for char in password):
                raise ValidationError('Password must contain at least one digit')
            if not any(char.isupper() for char in password):
                raise ValidationError('Password must contain at least one uppercase letter')


class UserUpdateSchema(Schema):
    """User update validation schema."""
    full_name = fields.Str(validate=validate.Length(max=100))
    bio = fields.Str(validate=validate.Length(max=500))
    avatar_url = fields.Url(allow_none=True)
    password = fields.Str(validate=validate.Length(min=8))`,

    'app/schemas/todo.py': `from marshmallow import Schema, fields, validate
from datetime import datetime


class TodoSchema(Schema):
    """Todo serialization schema."""
    id = fields.Int(dump_only=True)
    title = fields.Str()
    description = fields.Str()
    completed = fields.Bool()
    priority = fields.Str(validate=validate.OneOf(['low', 'medium', 'high']))
    due_date = fields.DateTime(allow_none=True)
    tags = fields.List(fields.Str())
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    user_id = fields.Int(dump_only=True)


class TodoCreateSchema(Schema):
    """Todo creation validation schema."""
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    description = fields.Str(validate=validate.Length(max=1000))
    priority = fields.Str(validate=validate.OneOf(['low', 'medium', 'high']))
    due_date = fields.DateTime(allow_none=True)
    tags = fields.List(fields.Str(), validate=validate.Length(max=10))


class TodoUpdateSchema(Schema):
    """Todo update validation schema."""
    title = fields.Str(validate=validate.Length(min=1, max=200))
    description = fields.Str(validate=validate.Length(max=1000))
    completed = fields.Bool()
    priority = fields.Str(validate=validate.OneOf(['low', 'medium', 'high']))
    due_date = fields.DateTime(allow_none=True)
    tags = fields.List(fields.Str(), validate=validate.Length(max=10))`,

    // Main application file
    'run.py': `#!/usr/bin/env python
import os
import sys
import signal
from app import create_app, db, socketio
from app.models import User, Role, Permission

# Get config name from environment
config_name = os.getenv('FLASK_CONFIG', 'development')
app = create_app(config_name)


@app.shell_context_processor
def make_shell_context():
    """Add objects to Flask shell."""
    return {
        'db': db,
        'User': User,
        'Role': Role,
        'Permission': Permission}


@app.cli.command()
def deploy():
    """Run deployment tasks."""
    from flask_migrate import upgrade
    from app.models import Role
    
    # Migrate database to latest revision
    upgrade()
    
    # Create user roles
    Role.insert_roles()

    print("Deployment completed successfully!")


# Graceful shutdown handler
def shutdown_handler(signum, frame):
    """Handle graceful shutdown on SIGTERM/SIGINT"""
    signal_name = signal.Signals(signum).name
    print(f'\\n{signal_name} signal received: closing Flask server gracefully')

    # Close database connections
    from app import db
    db.session.close()
    db.engine.dispose()
    print('Database connections closed')

    print('Graceful shutdown completed')
    sys.exit(0)


# Register signal handlers
signal.signal(signal.SIGTERM, shutdown_handler)
signal.signal(signal.SIGINT, shutdown_handler)


if __name__ == '__main__':
    # Check if running with socketio
    if len(sys.argv) > 1 and sys.argv[1] == 'socketio':
        socketio.run(app, debug=app.config['DEBUG'], host='0.0.0.0', port=5000)
    else:
        app.run(debug=app.config['DEBUG'], host='0.0.0.0', port=5000)`,

    // Environment variables
    '.env.example': `# Flask
FLASK_APP=run.py
FLASK_ENV=development
FLASK_CONFIG=development
SECRET_KEY=your-secret-key-here

# Database
DEV_DATABASE_URL=postgresql://user:password@localhost/{{projectName}}_dev
TEST_DATABASE_URL=postgresql://user:password@localhost/{{projectName}}_test
DATABASE_URL=postgresql://user:password@localhost/{{projectName}}

# JWT
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# Mail
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=noreply@example.com

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# File Upload
MAX_CONTENT_LENGTH=16777216
UPLOAD_FOLDER=uploads

# Logging
LOG_LEVEL=INFO`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM python:3.11-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \\
    pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Production stage
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    FLASK_APP=run.py \\
    FLASK_ENV=production

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq5 \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy wheels and install
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --upgrade pip && \\
    pip install --no-cache /wheels/*

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories
RUN mkdir -p uploads logs && \\
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD python -c "import requests; requests.get('http://localhost:5000/api/v1/health')"

# Run gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--worker-class", "eventlet", "--log-level", "info", "run:app"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-5000}:5000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://\${DB_USER:-postgres}:\${DB_PASSWORD:-postgres}@postgres:5432/\${DB_NAME:-{{projectName}}}
      - REDIS_URL=redis://:\${REDIS_PASSWORD:-}@redis:6379/0
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
    command: >
      sh -c '
        if [ -n "\${REDIS_PASSWORD}" ]; then
          redis-server --appendonly yes --requirepass \${REDIS_PASSWORD}
        else
          redis-server --appendonly yes
        fi
      '
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
      - ./static:/usr/share/nginx/html/static:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

  celery:
    build: .
    container_name: {{projectName}}-celery
    command: celery -A app.celery worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://\${DB_USER:-postgres}:\${DB_PASSWORD:-postgres}@postgres:5432/\${DB_NAME:-{{projectName}}}
      - REDIS_URL=redis://:\${REDIS_PASSWORD:-}@redis:6379/0
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - app-network

  flower:
    build: .
    container_name: {{projectName}}-flower
    command: celery -A app.celery flower
    ports:
      - "5555:5555"
    environment:
      - CELERY_BROKER_URL=redis://:\${REDIS_PASSWORD:-}@redis:6379/1
    depends_on:
      - redis
      - celery
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

# Celery
celerybeat-schedule
celerybeat.pid

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

    // README
    'README.md': `# {{projectName}}

Flask API server with comprehensive features including authentication, WebSockets, and async task processing.

## Features

- 🏗️ **Blueprint Architecture** for modular design
- 🔐 **JWT Authentication** with refresh tokens
- 🗄️ **SQLAlchemy ORM** with migrations
- 🚦 **Redis** for caching and rate limiting
- 📚 **API Documentation** with Flask-RESTful
- 🔄 **WebSocket** support with Socket.IO
- 🧪 **Testing** with pytest
- 🐳 **Docker** support
- 📊 **Logging** and monitoring
- 🛡️ **Security** features (CORS, rate limiting, etc.)
- 📤 **File uploads** with validation
- ✉️ **Email** support
- 🔄 **Background tasks** with Celery
- 📅 **Task scheduling** with APScheduler

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis
- Docker (optional)

### Installation

1. Clone the repository
2. Create virtual environment:
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

3. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

4. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

5. Initialize database:
   \`\`\`bash
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   flask deploy
   \`\`\`

6. Run the development server:
   \`\`\`bash
   flask run
   # Or with SocketIO:
   python run.py socketio
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

API endpoints are available at:
- Base URL: http://localhost:5000/api/v1
- Health check: http://localhost:5000/api/v1/health

## Testing

\`\`\`bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py
\`\`\`

## Project Structure

\`\`\`
app/
├── api/            # API endpoints
├── auth/           # Authentication blueprint
├── models/         # Database models
├── schemas/        # Marshmallow schemas
├── utils/          # Utility functions
├── static/         # Static files
├── templates/      # HTML templates
└── __init__.py     # Application factory
\`\`\`

## Background Tasks

Start Celery worker:
\`\`\`bash
celery -A app.celery worker --loglevel=info
\`\`\`

Monitor tasks with Flower:
\`\`\`bash
celery -A app.celery flower
\`\`\`

## License

MIT
`}
};