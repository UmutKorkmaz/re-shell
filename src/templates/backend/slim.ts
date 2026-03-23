import { BackendTemplate } from '../types';

export const slimTemplate: BackendTemplate = {
  id: 'slim',
  name: 'slim',
  displayName: 'Slim Framework',
  description: 'Lightweight PHP microframework for APIs and microservices',
  language: 'php',
  framework: 'slim',
  version: '4.12',
  tags: ['php', 'slim', 'microframework', 'api', 'rest', 'lightweight'],
  port: 8080,
  dependencies: {},
  features: ['routing', 'middleware', 'validation', 'logging', 'testing', 'docker'],
  
  files: {
    // Composer configuration
    'composer.json': `{
  "name": "re-shell/{{serviceName}}",
  "type": "project",
  "description": "{{serviceName}} - Slim Framework API Service",
  "keywords": ["slim", "api", "microservice", "rest"],
  "license": "MIT",
  "require": {
    "php": "^8.1",
    "slim/slim": "^4.12",
    "slim/psr7": "^1.6",
    "slim/http": "^1.3",
    "php-di/php-di": "^7.0",
    "monolog/monolog": "^3.5",
    "vlucas/phpdotenv": "^5.6",
    "respect/validation": "^2.3",
    "firebase/php-jwt": "^6.10",
    "doctrine/dbal": "^3.7",
    "ramsey/uuid": "^4.7",
    "guzzlehttp/guzzle": "^7.8",
    "tuupola/cors-middleware": "^1.4",
    "tuupola/slim-jwt-auth": "^3.7",
    "selective/basepath": "^2.2",
    "selective/array-reader": "^2.2",
    "cakephp/database": "^5.0",
    "cakephp/validation": "^5.0",
    "nyholm/psr7": "^1.8",
    "nyholm/psr7-server": "^1.1"
  },
  "require-dev": {
    "phpunit/phpunit": "^10.5",
    "phpstan/phpstan": "^1.10",
    "squizlabs/php_codesniffer": "^3.8",
    "friendsofphp/php-cs-fixer": "^3.45",
    "vimeo/psalm": "^5.18",
    "mockery/mockery": "^1.6",
    "fakerphp/faker": "^1.23",
    "symfony/var-dumper": "^7.0"
  },
  "autoload": {
    "psr-4": {
      "App\\\\": "src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "Tests\\\\": "tests/"
    }
  },
  "scripts": {
    "start": "php -S localhost:8080 -t public",
    "test": "phpunit",
    "test:coverage": "phpunit --coverage-html coverage",
    "analyze": "phpstan analyse",
    "cs": "phpcs",
    "cs:fix": "php-cs-fixer fix",
    "psalm": "psalm"
  },
  "config": {
    "sort-packages": true,
    "allow-plugins": {
      "php-http/discovery": true
    }
  }
}`,

    // Environment configuration
    '.env.example': `# Application
APP_NAME={{serviceName}}
APP_ENV=development
APP_DEBUG=true
APP_URL=http://localhost:{{PORT}}

# Database
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME={{serviceName}}_db
DB_USER=root
DB_PASS=secret
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# JWT
JWT_SECRET=your-secret-key-here
JWT_LIFETIME=3600

# Logging
LOG_LEVEL=debug
LOG_PATH=../logs/app.log

# Cache
CACHE_ENABLED=false
CACHE_DRIVER=file
CACHE_PATH=../cache

# CORS
CORS_ENABLED=true
CORS_ORIGIN=*
CORS_CREDENTIALS=true`,

    // Public index file
    'public/index.php': `<?php
declare(strict_types=1);

use App\\Application\\Handlers\\HttpErrorHandler;
use App\\Application\\Handlers\\ShutdownHandler;
use App\\Application\\ResponseEmitter\\ResponseEmitter;
use App\\Application\\Settings\\SettingsInterface;
use DI\\ContainerBuilder;
use Slim\\Factory\\AppFactory;
use Slim\\Factory\\ServerRequestCreatorFactory;

require __DIR__ . '/../vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// Instantiate PHP-DI ContainerBuilder
$containerBuilder = new ContainerBuilder();

if (false) { // Should be set to true in production
    $containerBuilder->enableCompilation(__DIR__ . '/../var/cache');
}

// Set up settings
$settings = require __DIR__ . '/../app/settings.php';
$settings($containerBuilder);

// Set up dependencies
$dependencies = require __DIR__ . '/../app/dependencies.php';
$dependencies($containerBuilder);

// Set up repositories
$repositories = require __DIR__ . '/../app/repositories.php';
$repositories($containerBuilder);

// Build PHP-DI Container instance
$container = $containerBuilder->build();

// Instantiate the app
AppFactory::setContainer($container);
$app = AppFactory::create();
$callableResolver = $app->getCallableResolver();

// Register middleware
$middleware = require __DIR__ . '/../app/middleware.php';
$middleware($app);

// Register routes
$routes = require __DIR__ . '/../app/routes.php';
$routes($app);

/** @var SettingsInterface $settings */
$settings = $container->get(SettingsInterface::class);

$displayErrorDetails = $settings->get('displayErrorDetails');
$logError = $settings->get('logError');
$logErrorDetails = $settings->get('logErrorDetails');

// Create Request object from globals
$serverRequestCreator = ServerRequestCreatorFactory::create();
$request = $serverRequestCreator->createServerRequestFromGlobals();

// Create Error Handler
$responseFactory = $app->getResponseFactory();
$errorHandler = new HttpErrorHandler($callableResolver, $responseFactory);

// Create Shutdown Handler
$shutdownHandler = new ShutdownHandler($request, $errorHandler, $displayErrorDetails);
register_shutdown_function($shutdownHandler);

// Add Routing Middleware
$app->addRoutingMiddleware();

// Add Body Parsing Middleware
$app->addBodyParsingMiddleware();

// Add Error Middleware
$errorMiddleware = $app->addErrorMiddleware($displayErrorDetails, $logError, $logErrorDetails);
$errorMiddleware->setDefaultErrorHandler($errorHandler);

// Run App & Emit Response
$response = $app->handle($request);
$responseEmitter = new ResponseEmitter();
$responseEmitter->emit($response);`,

    // Application settings
    'app/settings.php': `<?php
declare(strict_types=1);

use App\\Application\\Settings\\Settings;
use App\\Application\\Settings\\SettingsInterface;
use DI\\ContainerBuilder;
use Monolog\\Logger;

return function (ContainerBuilder $containerBuilder) {
    // Global Settings Object
    $containerBuilder->addDefinitions([
        SettingsInterface::class => function () {
            return new Settings([
                'displayErrorDetails' => $_ENV['APP_DEBUG'] === 'true',
                'logError' => true,
                'logErrorDetails' => true,
                'logger' => [
                    'name' => $_ENV['APP_NAME'] ?? '{{serviceName}}',
                    'path' => isset($_ENV['docker']) ? 'php://stdout' : __DIR__ . '/../logs/app.log',
                    'level' => $_ENV['LOG_LEVEL'] ?? Logger::DEBUG],
                'db' => [
                    'driver' => $_ENV['DB_DRIVER'] ?? 'mysql',
                    'host' => $_ENV['DB_HOST'] ?? 'localhost',
                    'port' => $_ENV['DB_PORT'] ?? '3306',
                    'database' => $_ENV['DB_NAME'] ?? '{{serviceName}}_db',
                    'username' => $_ENV['DB_USER'] ?? 'root',
                    'password' => $_ENV['DB_PASS'] ?? '',
                    'charset' => $_ENV['DB_CHARSET'] ?? 'utf8mb4',
                    'collation' => $_ENV['DB_COLLATION'] ?? 'utf8mb4_unicode_ci',
                    'prefix' => '',
                    'options' => [
                        // Turn off persistent connections
                        PDO::ATTR_PERSISTENT => false,
                        // Enable exceptions
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        // Emulate prepared statements
                        PDO::ATTR_EMULATE_PREPARES => true,
                        // Set default fetch mode to array
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]],
                'jwt' => [
                    'secret' => $_ENV['JWT_SECRET'] ?? 'change-me',
                    'lifetime' => (int) ($_ENV['JWT_LIFETIME'] ?? 3600),
                    'algorithm' => 'HS256'],
                'cors' => [
                    'enabled' => $_ENV['CORS_ENABLED'] === 'true',
                    'origin' => $_ENV['CORS_ORIGIN'] ?? '*',
                    'credentials' => $_ENV['CORS_CREDENTIALS'] === 'true']]);
        }]);
};`,

    // Dependencies configuration
    'app/dependencies.php': `<?php
declare(strict_types=1);

use App\\Application\\Settings\\SettingsInterface;
use DI\\ContainerBuilder;
use Monolog\\Handler\\StreamHandler;
use Monolog\\Logger;
use Monolog\\Processor\\UidProcessor;
use Psr\\Container\\ContainerInterface;
use Psr\\Log\\LoggerInterface;

return function (ContainerBuilder $containerBuilder) {
    $containerBuilder->addDefinitions([
        LoggerInterface::class => function (ContainerInterface $c) {
            $settings = $c->get(SettingsInterface::class);

            $loggerSettings = $settings->get('logger');
            $logger = new Logger($loggerSettings['name']);

            $processor = new UidProcessor();
            $logger->pushProcessor($processor);

            $handler = new StreamHandler($loggerSettings['path'], $loggerSettings['level']);
            $logger->pushHandler($handler);

            return $logger;
        },
        
        PDO::class => function (ContainerInterface $c) {
            $settings = $c->get(SettingsInterface::class);
            $dbSettings = $settings->get('db');
            
            $dsn = sprintf(
                '%s:host=%s;port=%s;dbname=%s;charset=%s',
                $dbSettings['driver'],
                $dbSettings['host'],
                $dbSettings['port'],
                $dbSettings['database'],
                $dbSettings['charset']
            );
            
            return new PDO($dsn, $dbSettings['username'], $dbSettings['password'], $dbSettings['options']);
        }]);
};`,

    // Routes configuration
    'app/routes.php': `<?php
declare(strict_types=1);

use App\\Application\\Actions\\Auth\\LoginAction;
use App\\Application\\Actions\\Auth\\RefreshTokenAction;
use App\\Application\\Actions\\User\\CreateUserAction;
use App\\Application\\Actions\\User\\DeleteUserAction;
use App\\Application\\Actions\\User\\ListUsersAction;
use App\\Application\\Actions\\User\\UpdateUserAction;
use App\\Application\\Actions\\User\\ViewUserAction;
use App\\Application\\Middleware\\JwtAuthMiddleware;
use Psr\\Http\\Message\\ResponseInterface as Response;
use Psr\\Http\\Message\\ServerRequestInterface as Request;
use Slim\\App;
use Slim\\Interfaces\\RouteCollectorProxyInterface as Group;

return function (App $app) {
    // Options route for CORS preflight
    $app->options('/{routes:.+}', function (Request $request, Response $response) {
        return $response;
    });

    // Health check route
    $app->get('/health', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode([
            'status' => 'ok',
            'service' => '{{serviceName}}',
            'timestamp' => date('c')]));
        return $response->withHeader('Content-Type', 'application/json');
    });

    // API version 1 routes
    $app->group('/api/v1', function (Group $group) {
        // Public routes
        $group->group('/auth', function (Group $group) {
            $group->post('/login', LoginAction::class);
            $group->post('/refresh', RefreshTokenAction::class);
        });

        // Protected routes
        $group->group('', function (Group $group) {
            $group->group('/users', function (Group $group) {
                $group->get('', ListUsersAction::class);
                $group->post('', CreateUserAction::class);
                $group->get('/{id}', ViewUserAction::class);
                $group->put('/{id}', UpdateUserAction::class);
                $group->delete('/{id}', DeleteUserAction::class);
            });
        })->add(JwtAuthMiddleware::class);
    });

    // Catch-all route for 404 errors
    $app->map(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], '/{routes:.+}', function (Request $request, Response $response) {
        throw new Slim\\Exception\\HttpNotFoundException($request);
    });
};`,

    // Middleware configuration
    'app/middleware.php': `<?php
declare(strict_types=1);

use App\\Application\\Middleware\\SessionMiddleware;
use App\\Application\\Settings\\SettingsInterface;
use Slim\\App;
use Tuupola\\Middleware\\CorsMiddleware;

return function (App $app) {
    $settings = $app->getContainer()->get(SettingsInterface::class);
    $corsSettings = $settings->get('cors');

    // Add Body Parsing Middleware
    $app->addBodyParsingMiddleware();

    // Add Routing Middleware
    $app->addRoutingMiddleware();

    // Add Session Middleware
    $app->add(SessionMiddleware::class);

    // Add CORS Middleware
    if ($corsSettings['enabled']) {
        $app->add(new CorsMiddleware([
            'origin' => [$corsSettings['origin']],
            'methods' => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            'headers.allow' => ['Authorization', 'Content-Type'],
            'headers.expose' => [],
            'credentials' => $corsSettings['credentials'],
            'cache' => 0]));
    }
};`,

    // User entity
    'src/Domain/User/User.php': `<?php
declare(strict_types=1);

namespace App\\Domain\\User;

use JsonSerializable;

class User implements JsonSerializable
{
    private ?int $id;
    private string $email;
    private string $username;
    private string $passwordHash;
    private string $createdAt;
    private ?string $updatedAt;

    public function __construct(
        ?int $id,
        string $email,
        string $username,
        string $passwordHash,
        string $createdAt,
        ?string $updatedAt = null
    ) {
        $this->id = $id;
        $this->email = strtolower($email);
        $this->username = $username;
        $this->passwordHash = $passwordHash;
        $this->createdAt = $createdAt;
        $this->updatedAt = $updatedAt;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getUsername(): string
    {
        return $this->username;
    }

    public function getPasswordHash(): string
    {
        return $this->passwordHash;
    }

    public function verifyPassword(string $password): bool
    {
        return password_verify($password, $this->passwordHash);
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function jsonSerialize(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'username' => $this->username,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt];
    }
}`,

    // User repository interface
    'src/Domain/User/UserRepository.php': `<?php
declare(strict_types=1);

namespace App\\Domain\\User;

interface UserRepository
{
    /**
     * @return User[]
     */
    public function findAll(): array;

    /**
     * @param int $id
     * @return User
     * @throws UserNotFoundException
     */
    public function findUserOfId(int $id): User;

    /**
     * @param string $email
     * @return User
     * @throws UserNotFoundException
     */
    public function findUserByEmail(string $email): User;

    /**
     * @param User $user
     * @return User
     */
    public function save(User $user): User;

    /**
     * @param int $id
     * @throws UserNotFoundException
     */
    public function delete(int $id): void;
}`,

    // Base action class
    'src/Application/Actions/Action.php': `<?php
declare(strict_types=1);

namespace App\\Application\\Actions;

use App\\Domain\\DomainException\\DomainRecordNotFoundException;
use Psr\\Http\\Message\\ResponseInterface as Response;
use Psr\\Http\\Message\\ServerRequestInterface as Request;
use Psr\\Log\\LoggerInterface;
use Slim\\Exception\\HttpBadRequestException;
use Slim\\Exception\\HttpNotFoundException;

abstract class Action
{
    protected LoggerInterface $logger;
    protected Request $request;
    protected Response $response;
    protected array $args;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * @throws HttpNotFoundException
     * @throws HttpBadRequestException
     */
    public function __invoke(Request $request, Response $response, array $args): Response
    {
        $this->request = $request;
        $this->response = $response;
        $this->args = $args;

        try {
            return $this->action();
        } catch (DomainRecordNotFoundException $e) {
            throw new HttpNotFoundException($this->request, $e->getMessage());
        }
    }

    /**
     * @throws DomainRecordNotFoundException
     * @throws HttpBadRequestException
     */
    abstract protected function action(): Response;

    /**
     * @return array|object
     */
    protected function getFormData()
    {
        return $this->request->getParsedBody();
    }

    /**
     * @param string $name
     * @return mixed
     * @throws HttpBadRequestException
     */
    protected function resolveArg(string $name)
    {
        if (!isset($this->args[$name])) {
            throw new HttpBadRequestException($this->request, "Could not resolve argument \`{$name}\`.");
        }

        return $this->args[$name];
    }

    /**
     * @param array|object|null $data
     * @param int $statusCode
     * @return Response
     */
    protected function respondWithData($data = null, int $statusCode = 200): Response
    {
        $payload = new ActionPayload($statusCode, $data);

        return $this->respond($payload);
    }

    /**
     * @param ActionPayload $payload
     * @return Response
     */
    protected function respond(ActionPayload $payload): Response
    {
        $json = json_encode($payload, JSON_PRETTY_PRINT);
        $this->response->getBody()->write($json);

        return $this->response
                    ->withHeader('Content-Type', 'application/json')
                    ->withStatus($payload->getStatusCode());
    }
}`,

    // JWT Authentication middleware
    'src/Application/Middleware/JwtAuthMiddleware.php': `<?php
declare(strict_types=1);

namespace App\\Application\\Middleware;

use App\\Application\\Settings\\SettingsInterface;
use Firebase\\JWT\\JWT;
use Firebase\\JWT\\Key;
use Psr\\Http\\Message\\ResponseInterface as Response;
use Psr\\Http\\Message\\ServerRequestInterface as Request;
use Psr\\Http\\Server\\MiddlewareInterface as Middleware;
use Psr\\Http\\Server\\RequestHandlerInterface as RequestHandler;
use Slim\\Exception\\HttpUnauthorizedException;

class JwtAuthMiddleware implements Middleware
{
    private SettingsInterface $settings;

    public function __construct(SettingsInterface $settings)
    {
        $this->settings = $settings;
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $jwtSettings = $this->settings->get('jwt');
        $authHeader = $request->getHeaderLine('Authorization');

        if (!$authHeader) {
            throw new HttpUnauthorizedException($request, 'Token not provided');
        }

        $token = str_replace('Bearer ', '', $authHeader);

        try {
            $decoded = JWT::decode($token, new Key($jwtSettings['secret'], $jwtSettings['algorithm']));
            
            // Add user data to request
            $request = $request->withAttribute('jwt', $decoded);
            
            return $handler->handle($request);
        } catch (\\Exception $e) {
            throw new HttpUnauthorizedException($request, 'Invalid token: ' . $e->getMessage());
        }
    }
}`,

    // PHPUnit configuration
    'phpunit.xml': `<?xml version="1.0" encoding="UTF-8"?>
<phpunit 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/10.5/phpunit.xsd"
    bootstrap="vendor/autoload.php"
    colors="true"
    cacheDirectory=".phpunit.cache"
    executionOrder="depends,defects"
    beStrictAboutOutputDuringTests="true"
    beStrictAboutTodoAnnotatedTests="true"
    beStrictAboutChangesToGlobalState="true"
    failOnRisky="true"
    failOnWarning="true"
>
    <testsuites>
        <testsuite name="Application Test Suite">
            <directory>tests</directory>
        </testsuite>
    </testsuites>

    <coverage>
        <include>
            <directory suffix=".php">src</directory>
        </include>
        <exclude>
            <directory>vendor</directory>
        </exclude>
    </coverage>

    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="APP_DEBUG" value="true"/>
    </php>
</phpunit>`,

    // Test bootstrap
    'tests/bootstrap.php': `<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

// Load test environment variables
$dotenv = Dotenv\\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

// Set testing environment
$_ENV['APP_ENV'] = 'testing';
$_ENV['APP_DEBUG'] = 'true';`,

    // Example test
    'tests/Application/Actions/User/ListUsersActionTest.php': `<?php
declare(strict_types=1);

namespace Tests\\Application\\Actions\\User;

use App\\Application\\Actions\\ActionPayload;
use App\\Domain\\User\\User;
use App\\Domain\\User\\UserRepository;
use DI\\Container;
use Tests\\TestCase;

class ListUsersActionTest extends TestCase
{
    public function testAction()
    {
        $app = $this->getAppInstance();

        /** @var Container $container */
        $container = $app->getContainer();

        $user = new User(1, 'test@example.com', 'testuser', 'hash', '2024-01-01');

        $userRepositoryProphecy = $this->prophesize(UserRepository::class);
        $userRepositoryProphecy
            ->findAll()
            ->willReturn([$user])
            ->shouldBeCalledOnce();

        $container->set(UserRepository::class, $userRepositoryProphecy->reveal());

        $request = $this->createRequest('GET', '/api/v1/users');
        $response = $app->handle($request);

        $payload = (string) $response->getBody();
        $expectedPayload = new ActionPayload(200, [$user]);
        $serializedPayload = json_encode($expectedPayload, JSON_PRETTY_PRINT);

        $this->assertEquals($serializedPayload, $payload);
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
    zip \\
    unzip \\
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

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

# Create necessary directories
RUN mkdir -p logs cache && \\
    chown -R www-data:www-data /var/www && \\
    chmod -R 755 /var/www/logs /var/www/cache

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
      - APP_ENV=development
      - docker=true
    volumes:
      - .:/var/www
      - ./logs:/var/www/logs
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

# Slim specific
cache/*
logs/*
tmp/*

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
    'README.md': `# {{serviceName}} - Slim Framework API

A lightweight RESTful API built with Slim Framework 4.

## Features

- 🚀 Slim Framework 4.12 with PSR-7 implementation
- 🔐 JWT authentication with Firebase JWT
- 📦 Dependency injection with PHP-DI
- 🗄️ Database abstraction with Doctrine DBAL
- ✅ Input validation with Respect Validation
- 📝 Comprehensive logging with Monolog
- 🧪 Unit testing with PHPUnit
- 🐳 Docker development environment
- 🔍 Static analysis with PHPStan and Psalm
- 🎨 Code formatting with PHP CS Fixer

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

# Run migrations (if any)
docker-compose exec app php vendor/bin/doctrine migrations:migrate
\`\`\`

The API will be available at http://localhost:{{PORT}}

### Manual Installation

\`\`\`bash
# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Configure your database in .env

# Start development server
php -S localhost:{{PORT}} -t public
\`\`\`

## API Endpoints

### Public Endpoints

- \`GET /health\` - Health check
- \`POST /api/v1/auth/login\` - User login
- \`POST /api/v1/auth/refresh\` - Refresh JWT token

### Protected Endpoints (require JWT)

- \`GET /api/v1/users\` - List all users
- \`POST /api/v1/users\` - Create new user
- \`GET /api/v1/users/{id}\` - Get user by ID
- \`PUT /api/v1/users/{id}\` - Update user
- \`DELETE /api/v1/users/{id}\` - Delete user

## Authentication

The API uses JWT tokens for authentication. To authenticate:

1. Send a POST request to \`/api/v1/auth/login\` with credentials
2. Receive a JWT token in the response
3. Include the token in subsequent requests: \`Authorization: Bearer <token>\`

## Testing

\`\`\`bash
# Run all tests
composer test

# Run tests with coverage
composer test:coverage

# Run static analysis
composer analyze

# Run code style checks
composer cs

# Fix code style issues
composer cs:fix
\`\`\`

## Project Structure

\`\`\`
{{serviceName}}/
├── app/                # Application configuration
│   ├── dependencies.php
│   ├── middleware.php
│   ├── routes.php
│   └── settings.php
├── public/            # Public directory
│   └── index.php     # Entry point
├── src/              # Source code
│   ├── Application/  # Application layer
│   ├── Domain/       # Domain layer
│   └── Infrastructure/ # Infrastructure layer
├── tests/            # Test files
├── logs/             # Log files
├── vendor/           # Dependencies
├── .env.example      # Environment example
├── composer.json     # Composer configuration
├── docker-compose.yml # Docker configuration
└── phpunit.xml       # PHPUnit configuration
\`\`\`

## Configuration

All configuration is done through environment variables. See \`.env.example\` for available options.

## Development

### Code Style

The project uses PHP CS Fixer for code formatting:

\`\`\`bash
# Check code style
composer cs

# Fix code style
composer cs:fix
\`\`\`

### Static Analysis

PHPStan and Psalm are used for static analysis:

\`\`\`bash
# Run PHPStan
composer analyze

# Run Psalm
composer psalm
\`\`\`

## Deployment

1. Set \`APP_ENV=production\` in your environment
2. Run \`composer install --no-dev --optimize-autoloader\`
3. Ensure proper permissions on \`logs/\` and \`cache/\` directories
4. Configure your web server to point to the \`public/\` directory

## Security

- Always use HTTPS in production
- Keep dependencies updated: \`composer update\`
- Use strong JWT secrets
- Enable CORS only for trusted origins
- Implement rate limiting for API endpoints

## License

MIT
`
  }
};