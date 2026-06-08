import { BackendTemplate } from '../types';

export const codeigniterTemplate: BackendTemplate = {
  id: 'codeigniter',
  name: 'codeigniter',
  displayName: 'CodeIgniter 4',
  description: 'Modern PHP framework with small footprint and MVC architecture',
  language: 'php',
  framework: 'codeigniter',
  version: '4.4',
  tags: ['php', 'codeigniter', 'mvc', 'api', 'rest', 'lightweight'],
  port: 8080,
  dependencies: {},
  features: ['routing', 'database', 'validation', 'logging', 'testing', 'security'],
  
  files: {
    // Composer configuration
    'composer.json': `{
  "name": "re-shell/{{serviceName}}",
  "type": "project",
  "description": "{{serviceName}} - CodeIgniter 4 Application",
  "keywords": ["codeigniter", "codeigniter4", "api", "rest"],
  "license": "MIT",
  "require": {
    "php": "^8.1",
    "codeigniter4/framework": "^4.4",
    "firebase/php-jwt": "^6.10",
    "vlucas/phpdotenv": "^5.6",
    "guzzlehttp/guzzle": "^7.8",
    "monolog/monolog": "^3.5",
    "ramsey/uuid": "^4.7",
    "fakerphp/faker": "^1.23"
  },
  "require-dev": {
    "phpunit/phpunit": "^10.5",
    "phpstan/phpstan": "^1.10",
    "squizlabs/php_codesniffer": "^3.8",
    "friendsofphp/php-cs-fixer": "^3.45",
    "mockery/mockery": "^1.6",
    "codeigniter/coding-standard": "^1.5"
  },
  "autoload": {
    "psr-4": {
      "App\\\\": "app/",
      "Config\\\\": "app/Config/"
    },
    "exclude-from-classmap": [
      "**/Database/Migrations/**"
    ]
  },
  "autoload-dev": {
    "psr-4": {
      "Tests\\\\": "tests/"
    }
  },
  "scripts": {
    "test": "phpunit",
    "cs": "phpcs",
    "cs:fix": "phpcbf",
    "analyze": "phpstan analyse",
    "serve": "php spark serve"
  },
  "config": {
    "optimize-autoloader": true,
    "preferred-install": "dist",
    "sort-packages": true,
    "allow-plugins": {
      "phpstan/extension-installer": true
    }
  }
}`,

    // Environment configuration
    '.env.example': `#--------------------------------------------------------------------
# ENVIRONMENT
#--------------------------------------------------------------------

CI_ENVIRONMENT = development

#--------------------------------------------------------------------
# APP
#--------------------------------------------------------------------

app.baseURL = 'http://localhost:{{PORT}}'
app.appName = '{{serviceName}}'
app.appVersion = '1.0.0'

#--------------------------------------------------------------------
# DATABASE
#--------------------------------------------------------------------

database.default.hostname = localhost
database.default.database = {{serviceName}}_db
database.default.username = root
database.default.password = 
database.default.DBDriver = MySQLi
database.default.DBPrefix =
database.default.port = 3306

#--------------------------------------------------------------------
# JWT
#--------------------------------------------------------------------

JWT_SECRET_KEY = your-secret-key-here
JWT_TIME_TO_LIVE = 3600
JWT_ALGORITHM = HS256

#--------------------------------------------------------------------
# CORS
#--------------------------------------------------------------------

CORS_ALLOWED_ORIGINS = *
CORS_ALLOWED_HEADERS = *
CORS_ALLOWED_METHODS = GET, POST, OPTIONS, PUT, DELETE
CORS_EXPOSED_HEADERS = 
CORS_MAX_AGE = 86400
CORS_SUPPORTS_CREDENTIALS = true`,

    // Main configuration
    'app/Config/App.php': `<?php

namespace Config;

use CodeIgniter\\Config\\BaseConfig;

class App extends BaseConfig
{
    public string $baseURL = 'http://localhost:{{PORT}}/';
    public string $appName = '{{serviceName}}';
    public string $appVersion = '1.0.0';
    public array $allowedHostnames = [];
    public string $indexPage = '';
    public string $uriProtocol = 'REQUEST_URI';
    public string $defaultLocale = 'en';
    public bool $negotiateLocale = false;
    public array $supportedLocales = ['en'];
    public string $appTimezone = 'UTC';
    public string $charset = 'UTF-8';
    public bool $forceGlobalSecureRequests = false;
    public array $proxyIPs = [];
    public bool $CSPEnabled = false;

    /**
     * --------------------------------------------------------------------------
     * Composer Directory
     * --------------------------------------------------------------------------
     */
    public string $composerDirectory = ROOTPATH . 'vendor/';
}`,

    // Routes configuration
    'app/Config/Routes.php': `<?php

use CodeIgniter\\Router\\RouteCollection;

/**
 * @var RouteCollection $routes
 */

// Load the system's routing file first
$routes->get('/', 'Home::index');

// API Routes
$routes->group('api', ['namespace' => 'App\\Controllers\\Api'], function ($routes) {
    // Health check
    $routes->get('health', 'HealthController::index');
    
    // API v1
    $routes->group('v1', function ($routes) {
        // Public routes
        $routes->group('auth', function ($routes) {
            $routes->post('register', 'AuthController::register');
            $routes->post('login', 'AuthController::login');
            $routes->post('refresh', 'AuthController::refresh');
        });
        
        // Protected routes
        $routes->group('', ['filter' => 'jwt'], function ($routes) {
            // User management
            $routes->group('users', function ($routes) {
                $routes->get('', 'UserController::index');
                $routes->get('(:num)', 'UserController::show/$1');
                $routes->post('', 'UserController::create');
                $routes->put('(:num)', 'UserController::update/$1');
                $routes->delete('(:num)', 'UserController::delete/$1');
            });
            
            // Profile
            $routes->get('profile', 'ProfileController::index');
            $routes->put('profile', 'ProfileController::update');
            
            // Logout
            $routes->post('logout', 'AuthController::logout');
        });
    });
});

// Catch-all route for 404
$routes->set404Override(function() {
    return view('errors/html/error_404');
});`,

    // Database configuration
    'app/Config/Database.php': `<?php

namespace Config;

use CodeIgniter\\Config\\BaseConfig;
use CodeIgniter\\Database\\Config;

class Database extends BaseConfig
{
    public string $filesPath = APPPATH . 'Database' . DIRECTORY_SEPARATOR;
    public string $defaultGroup = 'default';

    public array $default = [
        'DSN' => '',
        'hostname' => 'localhost',
        'username' => 'root',
        'password' => '',
        'database' => '{{serviceName}}_db',
        'DBDriver' => 'MySQLi',
        'DBPrefix' => '',
        'pConnect' => false,
        'DBDebug' => true,
        'charset' => 'utf8mb4',
        'DBCollat' => 'utf8mb4_general_ci',
        'swapPre' => '',
        'encrypt' => false,
        'compress' => false,
        'strictOn' => false,
        'failover' => [],
        'port' => 3306,
        'numberNative' => false];

    public array $tests = [
        'DSN' => '',
        'hostname' => '127.0.0.1',
        'username' => '',
        'password' => '',
        'database' => ':memory:',
        'DBDriver' => 'SQLite3',
        'DBPrefix' => 'db_',
        'pConnect' => false,
        'DBDebug' => true,
        'charset' => 'utf8',
        'DBCollat' => 'utf8_general_ci',
        'swapPre' => '',
        'encrypt' => false,
        'compress' => false,
        'strictOn' => false,
        'failover' => [],
        'port' => 3306,
        'foreignKeys' => true,
        'busyTimeout' => 1000];

    public function __construct()
    {
        parent::__construct();

        // Update database settings from environment
        if ($hostname = env('database.default.hostname')) {
            $this->default['hostname'] = $hostname;
        }
        if ($database = env('database.default.database')) {
            $this->default['database'] = $database;
        }
        if ($username = env('database.default.username')) {
            $this->default['username'] = $username;
        }
        if ($password = env('database.default.password')) {
            $this->default['password'] = $password;
        }
        if ($driver = env('database.default.DBDriver')) {
            $this->default['DBDriver'] = $driver;
        }
    }
}`,

    // JWT Filter
    'app/Filters/JWTFilter.php': `<?php

namespace App\\Filters;

use CodeIgniter\\Filters\\FilterInterface;
use CodeIgniter\\HTTP\\RequestInterface;
use CodeIgniter\\HTTP\\ResponseInterface;
use Config\\Services;
use Exception;
use Firebase\\JWT\\JWT;
use Firebase\\JWT\\Key;

class JWTFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $authHeader = $request->getServer('HTTP_AUTHORIZATION');
        
        if (!$authHeader) {
            return Services::response()
                ->setStatusCode(401)
                ->setJSON(['error' => 'Token not provided']);
        }

        try {
            $token = str_replace('Bearer ', '', $authHeader);
            $key = env('JWT_SECRET_KEY', 'your-secret-key');
            $algorithm = env('JWT_ALGORITHM', 'HS256');
            
            $decoded = JWT::decode($token, new Key($key, $algorithm));
            
            // Add user data to request
            $request->user = $decoded;
            
        } catch (Exception $e) {
            return Services::response()
                ->setStatusCode(401)
                ->setJSON(['error' => 'Invalid token: ' . $e->getMessage()]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // Do nothing
    }
}`,

    // Filters configuration
    'app/Config/Filters.php': `<?php

namespace Config;

use App\\Filters\\JWTFilter;
use CodeIgniter\\Config\\BaseConfig;
use CodeIgniter\\Filters\\CSRF;
use CodeIgniter\\Filters\\DebugToolbar;
use CodeIgniter\\Filters\\Honeypot;
use CodeIgniter\\Filters\\InvalidChars;
use CodeIgniter\\Filters\\SecureHeaders;

class Filters extends BaseConfig
{
    public array $aliases = [
        'csrf' => CSRF::class,
        'toolbar' => DebugToolbar::class,
        'honeypot' => Honeypot::class,
        'invalidchars' => InvalidChars::class,
        'secureheaders' => SecureHeaders::class,
        'jwt' => JWTFilter::class];

    public array $globals = [
        'before' => [
            // 'honeypot',
            // 'csrf',
            // 'invalidchars'],
        'after' => [
            'toolbar',
            // 'honeypot',
            'secureheaders']];

    public array $methods = [];

    public array $filters = [];
}`,

    // Base Controller
    'app/Controllers/BaseController.php': `<?php

namespace App\\Controllers;

use CodeIgniter\\Controller;
use CodeIgniter\\HTTP\\CLIRequest;
use CodeIgniter\\HTTP\\IncomingRequest;
use CodeIgniter\\HTTP\\RequestInterface;
use CodeIgniter\\HTTP\\ResponseInterface;
use Psr\\Log\\LoggerInterface;

abstract class BaseController extends Controller
{
    /**
     * Instance of the main Request object.
     *
     * @var CLIRequest|IncomingRequest
     */
    protected $request;

    /**
     * An array of helpers to be loaded automatically upon
     * class instantiation.
     *
     * @var array
     */
    protected $helpers = [];

    /**
     * Be sure to declare properties for any property fetch you initialized.
     * The creation of dynamic property is deprecated in PHP 8.2.
     */
    // protected $session;

    /**
     * @return void
     */
    public function initController(RequestInterface $request, ResponseInterface $response, LoggerInterface $logger)
    {
        // Do Not Edit This Line
        parent::initController($request, $response, $logger);

        // Preload any models, libraries, etc, here.
        // E.g.: $this->session = \\Config\\Services::session();
    }

    /**
     * Return JSON response
     */
    protected function respond($data = null, int $status = 200)
    {
        return $this->response
            ->setStatusCode($status)
            ->setJSON($data);
    }

    /**
     * Return error response
     */
    protected function respondError($message = 'An error occurred', int $status = 400)
    {
        return $this->respond([
            'error' => true,
            'message' => $message
        ], $status);
    }

    /**
     * Return success response
     */
    protected function respondSuccess($data = null, $message = 'Success')
    {
        return $this->respond([
            'success' => true,
            'message' => $message,
            'data' => $data
        ]);
    }
}`,

    // Health Controller
    'app/Controllers/Api/HealthController.php': `<?php

namespace App\\Controllers\\Api;

use App\\Controllers\\BaseController;

class HealthController extends BaseController
{
    public function index()
    {
        return $this->respond([
            'status' => 'ok',
            'service' => '{{serviceName}}',
            'version' => config('App')->appVersion,
            'timestamp' => date('c')
        ]);
    }
}`,

    // Auth Controller
    'app/Controllers/Api/AuthController.php': `<?php

namespace App\\Controllers\\Api;

use App\\Controllers\\BaseController;
use App\\Models\\UserModel;
use Firebase\\JWT\\JWT;

class AuthController extends BaseController
{
    protected $userModel;

    public function __construct()
    {
        $this->userModel = new UserModel();
    }

    public function register()
    {
        $rules = [
            'username' => 'required|min_length[3]|max_length[50]|is_unique[users.username]',
            'email' => 'required|valid_email|is_unique[users.email]',
            'password' => 'required|min_length[6]'
        ];

        if (!$this->validate($rules)) {
            return $this->respondError($this->validator->getErrors());
        }

        $data = [
            'username' => $this->request->getVar('username'),
            'email' => $this->request->getVar('email'),
            'password' => password_hash($this->request->getVar('password'), PASSWORD_BCRYPT),
            'created_at' => date('Y-m-d H:i:s')
        ];

        $userId = $this->userModel->insert($data);

        if ($userId) {
            $user = $this->userModel->find($userId);
            unset($user['password']);

            return $this->respondSuccess($user, 'User registered successfully');
        }

        return $this->respondError('Failed to register user');
    }

    public function login()
    {
        $rules = [
            'email' => 'required|valid_email',
            'password' => 'required'
        ];

        if (!$this->validate($rules)) {
            return $this->respondError($this->validator->getErrors());
        }

        $email = $this->request->getVar('email');
        $password = $this->request->getVar('password');

        $user = $this->userModel->where('email', $email)->first();

        if (!$user) {
            return $this->respondError('Invalid credentials', 401);
        }

        if (!password_verify($password, $user['password'])) {
            return $this->respondError('Invalid credentials', 401);
        }

        $token = $this->generateToken($user);
        unset($user['password']);

        return $this->respondSuccess([
            'user' => $user,
            'token' => $token
        ], 'Login successful');
    }

    public function refresh()
    {
        // Token is already validated by JWT filter
        $user = $this->request->user;
        $userData = $this->userModel->find($user->sub);

        if (!$userData) {
            return $this->respondError('User not found', 404);
        }

        $token = $this->generateToken($userData);
        unset($userData['password']);

        return $this->respondSuccess([
            'user' => $userData,
            'token' => $token
        ], 'Token refreshed successfully');
    }

    public function logout()
    {
        // In a stateless JWT system, logout is handled client-side
        // Here we could blacklist the token if needed
        return $this->respondSuccess(null, 'Logged out successfully');
    }

    private function generateToken($user)
    {
        $key = env('JWT_SECRET_KEY', 'your-secret-key');
        $algorithm = env('JWT_ALGORITHM', 'HS256');
        $ttl = env('JWT_TIME_TO_LIVE', 3600);

        $payload = [
            'iss' => base_url(),
            'aud' => base_url(),
            'iat' => time(),
            'exp' => time() + $ttl,
            'sub' => $user['id'],
            'email' => $user['email'],
            'username' => $user['username']
        ];

        return JWT::encode($payload, $key, $algorithm);
    }
}`,

    // User Model
    'app/Models/UserModel.php': `<?php

namespace App\\Models;

use CodeIgniter\\Model;

class UserModel extends Model
{
    protected $table = 'users';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = true;
    protected $returnType = 'array';
    protected $useSoftDeletes = true;
    protected $protectFields = true;
    protected $allowedFields = [
        'username',
        'email',
        'password',
        'first_name',
        'last_name',
        'is_active',
        'last_login'
    ];

    // Dates
    protected $useTimestamps = true;
    protected $dateFormat = 'datetime';
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';
    protected $deletedField = 'deleted_at';

    // Validation
    protected $validationRules = [
        'username' => 'required|alpha_numeric_space|min_length[3]|max_length[50]',
        'email' => 'required|valid_email',
        'password' => 'required|min_length[6]'
    ];

    protected $validationMessages = [
        'email' => [
            'required' => 'Email is required',
            'valid_email' => 'Please provide a valid email address'
        ],
        'username' => [
            'required' => 'Username is required',
            'min_length' => 'Username must be at least 3 characters',
            'max_length' => 'Username cannot exceed 50 characters'
        ]
    ];

    protected $skipValidation = false;
    protected $cleanValidationRules = true;

    // Callbacks
    protected $allowCallbacks = true;
    protected $beforeInsert = ['hashPassword'];
    protected $afterInsert = [];
    protected $beforeUpdate = ['hashPassword'];
    protected $afterUpdate = [];
    protected $beforeFind = [];
    protected $afterFind = [];
    protected $beforeDelete = [];
    protected $afterDelete = [];

    protected function hashPassword(array $data)
    {
        if (isset($data['data']['password'])) {
            $data['data']['password'] = password_hash($data['data']['password'], PASSWORD_BCRYPT);
        }

        return $data;
    }
}`,

    // Migration for users table
    'app/Database/Migrations/2024-01-01-000000_CreateUsersTable.php': `<?php

namespace App\\Database\\Migrations;

use CodeIgniter\\Database\\Migration;

class CreateUsersTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
                'auto_increment' => true],
            'username' => [
                'type' => 'VARCHAR',
                'constraint' => '50',
                'unique' => true],
            'email' => [
                'type' => 'VARCHAR',
                'constraint' => '100',
                'unique' => true],
            'password' => [
                'type' => 'VARCHAR',
                'constraint' => '255'],
            'first_name' => [
                'type' => 'VARCHAR',
                'constraint' => '50',
                'null' => true],
            'last_name' => [
                'type' => 'VARCHAR',
                'constraint' => '50',
                'null' => true],
            'is_active' => [
                'type' => 'BOOLEAN',
                'default' => true],
            'last_login' => [
                'type' => 'DATETIME',
                'null' => true],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true],
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true]]);
        
        $this->forge->addKey('id', true);
        $this->forge->createTable('users');
    }

    public function down()
    {
        $this->forge->dropTable('users');
    }
}`,

    // PHPUnit configuration
    'phpunit.xml': `<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         bootstrap="vendor/autoload.php"
         colors="true"
         xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/10.5/phpunit.xsd"
         cacheDirectory=".phpunit.cache">
    <testsuites>
        <testsuite name="Application">
            <directory>tests</directory>
        </testsuite>
    </testsuites>

    <coverage>
        <include>
            <directory suffix=".php">app</directory>
        </include>
        <exclude>
            <directory suffix=".php">app/Views</directory>
        </exclude>
    </coverage>

    <php>
        <server name="app.baseURL" value="http://localhost:8080/"/>
        <const name="HOMEPATH" value="./"/>
        <const name="CONFIGPATH" value="./app/Config/"/>
        <const name="PUBLICPATH" value="./public/"/>
    </php>
</phpunit>`,

    // Example test
    'tests/HealthTest.php': `<?php

namespace Tests;

use CodeIgniter\\Test\\CIUnitTestCase;
use CodeIgniter\\Test\\FeatureTestTrait;

class HealthTest extends CIUnitTestCase
{
    use FeatureTestTrait;

    public function testHealthCheck()
    {
        $result = $this->get('/api/health');
        
        $result->assertStatus(200);
        $result->assertJSONFragment([
            'status' => 'ok',
            'service' => '{{serviceName}}'
        ]);
    }
}`,

    // Docker configuration
    'Dockerfile': `FROM php:8.2-apache

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    curl \\
    libpng-dev \\
    libonig-dev \\
    libxml2-dev \\
    libicu-dev \\
    zip \\
    unzip \\
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd intl

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable Apache modules
RUN a2enmod rewrite headers

# Set working directory
WORKDIR /var/www

# Copy application files
COPY . .

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install dependencies
RUN composer install --optimize-autoloader --no-dev

# Configure Apache
RUN echo '<VirtualHost *:80>\\n\\
    DocumentRoot /var/www/public\\n\\
    <Directory /var/www/public>\\n\\
        Options Indexes FollowSymLinks\\n\\
        AllowOverride All\\n\\
        Require all granted\\n\\
    </Directory>\\n\\
    ErrorLog \${APACHE_LOG_DIR}/error.log\\n\\
    CustomLog \${APACHE_LOG_DIR}/access.log combined\\n\\
</VirtualHost>' > /etc/apache2/sites-available/000-default.conf

# Create necessary directories and set permissions
RUN mkdir -p writable/cache writable/logs writable/session writable/uploads && \\
    chown -R www-data:www-data /var/www && \\
    chmod -R 755 /var/www/writable

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD curl -f http://localhost/health || exit 1

CMD ["apache2-foreground"]`,

    // Docker Compose configuration
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: {{serviceName}}_app
    restart: unless-stopped
    ports:
      - "{{PORT}}:80"
    environment:
      - CI_ENVIRONMENT=development
      - database.default.hostname=db
      - database.default.database={{serviceName}}_db
      - database.default.username=root
      - database.default.password=secret
    volumes:
      - .:/var/www
      - ./writable:/var/www/writable
    networks:
      - {{serviceName}}_network
    depends_on:
      - db

  db:
    image: mysql:8.0
    container_name: {{serviceName}}_db
    restart: unless-stopped
    ports:
      - "3307:3306"
    environment:
      MYSQL_DATABASE: {{serviceName}}_db
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_USER: {{serviceName}}_user
      MYSQL_PASSWORD: secret
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - {{serviceName}}_network

  phpmyadmin:
    image: phpmyadmin/phpmyadmin
    container_name: {{serviceName}}_phpmyadmin
    restart: unless-stopped
    ports:
      - "8081:80"
    environment:
      PMA_HOST: db
      PMA_PORT: 3306
      PMA_USER: root
      PMA_PASSWORD: secret
    networks:
      - {{serviceName}}_network
    depends_on:
      - db

networks:
  {{serviceName}}_network:
    driver: bridge

volumes:
  db_data:`,

    '.dockerignore': `# Composer
vendor/
composer.lock

# CodeIgniter specific
writable/cache/*
writable/logs/*
writable/session/*
writable/uploads/*

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Git
.git/
.gitignore

# Docker
docker-compose.yml
Dockerfile`,

    // README
    'README.md': `# {{serviceName}} - CodeIgniter 4 Application

A modern MVC application built with CodeIgniter 4.

## Features

- 🚀 CodeIgniter 4.4 framework
- 🔐 JWT authentication
- 🗄️ MySQL database with migrations
- ✅ Input validation
- 📝 RESTful API structure
- 🧪 PHPUnit testing
- 🐳 Docker development environment
- 🔍 Static analysis with PHPStan
- 🎨 PSR-12 code style

## Requirements

- PHP 8.1 or higher
- Composer
- MySQL 5.7+ or MariaDB 10.3+
- Docker (optional)

## Quick Start

### Using Docker

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd {{serviceName}}

# Copy environment file
cp .env.example .env

# Start containers
docker-compose up -d

# Install dependencies
docker-compose exec app composer install

# Run migrations
docker-compose exec app php spark migrate
\`\`\`

The application will be available at http://localhost:{{PORT}}

### Manual Installation

\`\`\`bash
# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Configure your database in .env

# Run migrations
php spark migrate

# Start development server
php spark serve --port {{PORT}}
\`\`\`

## API Endpoints

### Public Endpoints

- \`GET /api/health\` - Health check
- \`POST /api/v1/auth/register\` - User registration
- \`POST /api/v1/auth/login\` - User login

### Protected Endpoints (require JWT)

- \`GET /api/v1/users\` - List all users
- \`POST /api/v1/users\` - Create new user
- \`GET /api/v1/users/{id}\` - Get user by ID
- \`PUT /api/v1/users/{id}\` - Update user
- \`DELETE /api/v1/users/{id}\` - Delete user
- \`GET /api/v1/profile\` - Get current user profile
- \`PUT /api/v1/profile\` - Update current user profile
- \`POST /api/v1/logout\` - Logout

## CLI Commands

### Database

\`\`\`bash
# Run migrations
php spark migrate

# Rollback migrations
php spark migrate:rollback

# Create new migration
php spark make:migration CreateTableName

# Seed database
php spark db:seed SeederName
\`\`\`

### Development

\`\`\`bash
# Start development server
php spark serve

# Create new controller
php spark make:controller ControllerName

# Create new model
php spark make:model ModelName

# Create new filter
php spark make:filter FilterName

# List routes
php spark routes
\`\`\`

## Testing

\`\`\`bash
# Run all tests
composer test

# Run with coverage
vendor/bin/phpunit --coverage-html coverage

# Run specific test
vendor/bin/phpunit tests/HealthTest.php
\`\`\`

## Project Structure

\`\`\`
{{serviceName}}/
├── app/                # Application files
│   ├── Config/        # Configuration files
│   ├── Controllers/   # Controllers
│   ├── Database/      # Migrations and seeds
│   ├── Filters/       # HTTP filters
│   ├── Models/        # Models
│   └── Views/         # Views
├── public/            # Public directory
│   └── index.php     # Entry point
├── tests/             # Test files
├── vendor/            # Dependencies
├── writable/          # Writable directory for logs, cache, etc.
├── .env.example       # Environment example
├── composer.json      # Composer configuration
├── docker-compose.yml # Docker configuration
├── phpunit.xml        # PHPUnit configuration
└── spark             # CLI tool
\`\`\`

## Configuration

All configuration is done through:
1. Environment variables in \`.env\`
2. Configuration files in \`app/Config/\`

## Code Style

The project follows PSR-12 coding standards:

\`\`\`bash
# Check code style
composer cs

# Fix code style
composer cs:fix
\`\`\`

## Security

- Always use HTTPS in production
- Keep dependencies updated: \`composer update\`
- Use strong JWT secrets
- Enable CSRF protection for web forms
- Implement rate limiting for API endpoints
- Regular security audits with \`composer audit\`

## License

MIT
`
  }
};