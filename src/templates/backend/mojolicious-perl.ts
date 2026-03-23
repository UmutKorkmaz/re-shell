import { BackendTemplate } from '../types';

export const mojoliciousTemplate: BackendTemplate = {
  id: 'mojolicious',
  name: 'mojolicious',
  displayName: 'Mojolicious (Perl)',
  description: 'Powerful, feature-rich Perl web framework with real-time web framework',
  language: 'perl',
  framework: 'mojolicious',
  version: '1.0.0',
  tags: ['perl', 'mojolicious', 'mvc', 'websockets', 'websockets', 'rest', 'full-stack'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

  files: {
    // Main application file
    'script/{{projectNameSnake}}': `#!/usr/bin/env perl

use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";

use {{projectNamePascal}};
use {{projectNamePascal}}::Model::DB;

# Initialize database
{{projectNamePascal}}::Model::DB->init;

my $app = {{projectNamePascal}}->new;

# Start the application
$app->start;
`,

    // Application class
    'lib/{{projectNamePascal}}.pm': `package {{projectNamePascal}};
use Mojo::Base 'Mojolicious', -signatures;

use {{projectNamePascal}}::Model::DB;
use {{projectNamePascal}}::Helpers::Auth;

sub startup ($self) {
  # Configuration
  my $config = $self->plugin('Config');
  $config->{jwt_secret} //= 'change-this-secret-in-production';
  $config->{jwt_expiration} //= 604800; # 7 days

  # Helpers
  $self->helper(auth => sub { {{projectNamePascal}}::Helpers::Auth->new(shift) });

  # CORS
  $self->hook(before_dispatch => sub ($c) {
    $c->res->headers->access_control_allow_origin('*');
    $c->res->headers->access_control_allow_methods('GET, POST, PUT, DELETE, OPTIONS');
    $c->res->headers->access_control_allow_headers('Content-Type, Authorization');
  });

  # Router
  my $r = $self->routes;

  # Health check (no auth required)
  $r->get('/health')->to('api#health');

  # Home page
  $r->get('/')->to('example#welcome');

  # API routes (v1)
  my $api = $r->under('/api/v1');

  # Auth routes (no authentication required)
  $api->post('/auth/register')->to('auth#register');
  $api->post('/auth/login')->to('auth#login');

  # Protected routes (authentication required)
  my $protected = $api->under('/')->to('auth#authenticate');

  # User routes
  $protected->get('/users/me')->to('user#me');
  $protected->get('/users')->to('user#list');
  $protected->get('/users/:id')->to('user#get');
  $protected->delete('/users/:id')->to('user#delete');

  # Product routes
  $protected->get('/products')->to('product#list');
  $protected->get('/products/:id')->to('product#get');

  # Admin routes
  my $admin = $protected->under('/')->to('auth#authorize_admin');
  $admin->post('/products')->to('product#create');
  $admin->put('/products/:id')->to('product#update');
  $admin->delete('/products/:id')->to('product#delete');
}

1;
`,

    // Model - Database
    'lib/{{projectNamePascal}}/Model/DB.pm': `package {{projectNamePascal}}::Model::DB;
use strict;
use warnings;
use Mojo::Base -base;

use Mojo::JSON qw(encode_json decode_json);
use Digest::SHA qw(sha256_hex);

has users => sub { [] };
has products => sub { [] };

sub init ($class) {
  no strict 'refs';
  my $var = '$' . '{class}::instance';
  $$var ||= $class->new;
  $$var->_init_data;
  return $$var;
}

sub _init_data ($self) {
  # Create admin user
  my $admin_password = sha256_hex('admin123');
  push @{$self->users}, {
    id => '1',
    email => 'admin@example.com',
    password => $admin_password,
    name => 'Admin User',
    role => 'admin',
    created_at => scalar localtime,
    updated_at => scalar localtime};
  print "✅ Database initialized with admin user: admin@example.com / admin123\\n";

  # Create sample products
  push @{$self->products}, {
    id => '1',
    name => 'Sample Product 1',
    description => 'This is a sample product',
    price => 29.99,
    stock => 100,
    created_at => scalar localtime,
    updated_at => scalar localtime};
  push @{$self->products}, {
    id => '2',
    name => 'Sample Product 2',
    description => 'Another sample product',
    price => 49.99,
    stock => 50,
    created_at => scalar localtime,
    updated_at => scalar localtime};
  print "✅ Database initialized with sample products\\n";
}

sub get_user_by_email ($self, $email) {
  for my $user (@{$self->users}) {
    return $user if $user->{email} eq $email;
  }
  return undef;
}

sub get_user_by_id ($self, $id) {
  for my $user (@{$self->users}) {
    return {%$user} if $user->{id} eq $id;
  }
  return undef;
}

sub create_user ($self, $data) {
  my $password = sha256_hex($data->{password});
  my $user = {
    id => $self->_generate_id,
    email => $data->{email},
    password => $password,
    name => $data->{name},
    role => 'user',
    created_at => scalar localtime,
    updated_at => scalar localtime};
  push @{$self->users}, $user;
  return {%$user, password => undef};
}

sub update_user ($self, $id, $data) {
  for my $user (@{$self->users}) {
    if ($user->{id} eq $id) {
      $user->{name} = $data->{name} if $data->{name};
      $user->{updated_at} = scalar localtime;
      return {%$user, password => undef};
    }
  }
  return undef;
}

sub delete_user ($self, $id) {
  my @users = grep { $_->{id} ne $id } @{$self->users};
  if (@users != @{$self->users}) {
    $self->users(\\@users);
    return 1;
  }
  return 0;
}

sub get_users ($self) {
  return [map { {%$_, password => undef} } @{$self->users}];
}

sub get_products ($self) {
  return $self->products;
}

sub get_product_by_id ($self, $id) {
  for my $product (@{$self->products}) {
    return $product if $product->{id} eq $id;
  }
  return undef;
}

sub create_product ($self, $data) {
  my $product = {
    id => $self->_generate_id,
    name => $data->{name},
    description => $data->{description},
    price => $data->{price} + 0,
    stock => $data->{stock} + 0,
    created_at => scalar localtime,
    updated_at => scalar localtime};
  push @{$self->products}, $product;
  return $product;
}

sub update_product ($self, $id, $data) {
  for my $product (@{$self->products}) {
    if ($product->{id} eq $id) {
      $product->{name} = $data->{name} if $data->{name};
      $product->{description} = $data->{description} if defined $data->{description};
      $product->{price} = $data->{price} + 0 if defined $data->{price};
      $product->{stock} = $data->{stock} + 0 if defined $data->{stock};
      $product->{updated_at} = scalar localtime;
      return $product;
    }
  }
  return undef;
}

sub delete_product ($self, $id) {
  my @products = grep { $_->{id} ne $id } @{$self->products};
  if (@products != @{$self->products}) {
    $self->products(\\@products);
    return 1;
  }
  return 0;
}

sub verify_user ($self, $email, $password) {
  my $user = $self->get_user_by_email($email);
  return undef unless $user;
  my $hashed_password = sha256_hex($password);
  return $user if $user->{password} eq $hashed_password;
  return undef;
}

sub _generate_id ($self) {
  return int(rand(1000000));
}

1;
`,

    // Helper - Auth
    'lib/{{projectNamePascal}}/Helpers/Auth.pm': `package {{projectNamePascal}}::Helpers::Auth;
use strict;
use warnings;
use Mojo::Base -base;

use Mojo::JSON qw(encode_json decode_json);
use Mojo::JWT;
use {{projectNamePascal}}::Model::DB;

has 'c';

sub generate_token ($self, $user) {
  my $config = $self->c->app->config;
  return Mojo::JWT->new(
    secret => $config->{jwt_secret},
    expires => time + ($config->{jwt_expiration} || 604800),
    claims => {
      sub => $user->{id},
      email => $user->{email},
      role => $user->{role}},
  )->encode;
}

sub validate_token ($self, $token) {
  my $config = $self->c->app->config;
  my $claims = eval {
    Mojo::JWT->new(secret => $config->{jwt_secret})->decode($token);
  };
  return $@ ? undef : $claims;
}

sub get_user_from_token ($self) {
  my $auth_header = $self->c->req->headers->authorization;
  return undef unless $auth_header && $auth_header =~ /^Bearer\\s+(.+)$/;

  my $token = $1;
  my $claims = $self->validate_token($token);
  return undef unless $claims;

  my $db = {{projectNamePascal}}::Model::DB->init;
  my $user = $db->get_user_by_id($claims->{sub});
  return undef unless $user;

  return {%$user, password => undef};
}

1;
`,

    // Controller - API
    'lib/{{projectNamePascal}}/Controller/API.pm': `package {{projectNamePascal}}::Controller::API;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Controller';

sub health ($self) {
  $self->render(json => {
    status => 'healthy',
    timestamp => scalar localtime,
    version => '1.0.0'});
}

1;
`,

    // Controller - Auth
    'lib/{{projectNamePascal}}/Controller/Auth.pm': `package {{projectNamePascal}}::Controller::Auth;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Controller';

use {{projectNamePascal}}::Model::DB;
use Mojo::JSON qw(encode_json decode_json);

sub register ($self) {
  my $data = $self->req->json;
  my $db = {{projectNamePascal}}::Model::DB->init;

  # Validation
  my $error = $self->_validate_register($data);
  return $self->render(json => {error => $error}, status => 400) if $error;

  # Check if user exists
  my $existing = $db->get_user_by_email($data->{email});
  return $self->render(json => {error => 'Email already registered'}, status => 409) if $existing;

  # Create user
  my $user = $db->create_user($data);

  # Generate token
  my $token = $self->auth->generate_token($user);

  $self->render(json => {
    token => $token,
    user => {%$user, password => undef}}, status => 201);
}

sub login ($self) {
  my $data = $self->req->json;
  my $db = {{projectNamePascal}}::Model::DB->init;

  # Validation
  return $self->render(json => {error => 'Email and password required'}, status => 400)
    unless $data->{email} && $data->{password};

  # Verify user
  my $user = $db->verify_user($data->{email}, $data->{password});
  return $self->render(json => {error => 'Invalid credentials'}, status => 401) unless $user;

  # Generate token
  my $token = $self->auth->generate_token($user);

  $self->render(json => {
    token => $token,
    user => {%$user, password => undef}});
}

sub authenticate ($self) {
  my $user = $self->auth->get_user_from_token;
  return undef unless $user;

  $self->stash(current_user => $user);
  return 1;
}

sub authorize_admin ($self) {
  my $user = $self->stash('current_user');
  return undef unless $user && $user->{role} eq 'admin';

  return 1;
}

sub _validate_register ($self, $data) {
  return 'Email is required' unless $data->{email};
  return 'Email is invalid' unless $data->{email} =~ /^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$/;
  return 'Password is required' unless $data->{password};
  return 'Password must be at least 6 characters' if length($data->{password} || '') < 6;
  return 'Name is required' unless $data->{name};
  return undef;
}

1;
`,

    // Controller - User
    'lib/{{projectNamePascal}}/Controller/User.pm': `package {{projectNamePascal}}::Controller::User;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Controller';

use {{projectNamePascal}}::Model::DB;

sub me ($self) {
  my $user = $self->stash('current_user');
  $self->render(json => {user => $user});
}

sub list ($self) {
  my $db = {{projectNamePascal}}::Model::DB->init;
  my $users = $db->get_users;
  $self->render(json => {users => $users, count => scalar @$users});
}

sub get ($self) {
  my $db = {{projectNamePascal}}::Model::DB->init;
  my $user = $db->get_user_by_id($self->param('id'));

  return $self->render(json => {error => 'User not found'}, status => 404) unless $user;

  $self->render(json => {user => {%$user, password => undef}});
}

sub delete ($self) {
  my $db = {{projectNamePascal}}::Model::DB->init;
  my $deleted = $db->delete_user($self->param('id'));

  return $self->render(json => {error => 'User not found'}, status => 404) unless $deleted;

  $self->rendered(204);
}

1;
`,

    // Controller - Product
    'lib/{{projectNamePascal}}/Controller/Product.pm': `package {{projectNamePascal}}::Controller::Product;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Controller';

use {{projectNamePascal}}::Model::DB;

sub list ($self) {
  my $db = {{projectNamePascal}}::Model::DB->init;
  my $products = $db->get_products;
  $self->render(json => {products => $products, count => scalar @$products});
}

sub get ($self) {
  my $db = {{projectNamePascal}}::Model::DB->init;
  my $product = $db->get_product_by_id($self->param('id'));

  return $self->render(json => {error => 'Product not found'}, status => 404) unless $product;

  $self->render(json => {product => $product});
}

sub create ($self) {
  my $data = $self->req->json;
  my $db = {{projectNamePascal}}::Model::DB->init;

  # Validation
  return $self->render(json => {error => 'Name is required'}, status => 400)
    unless $data->{name};
  return $self->render(json => {error => 'Price is required'}, status => 400)
    unless defined $data->{price};

  my $product = $db->create_product($data);

  $self->render(json => {product => $product}, status => 201);
}

sub update ($self) {
  my $id = $self->param('id');
  my $data = $self->req->json;
  my $db = {{projectNamePascal}}::Model::DB->init;

  my $product = $db->update_product($id, $data);

  return $self->render(json => {error => 'Product not found'}, status => 404) unless $product;

  $self->render(json => {product => $product});
}

sub delete ($self) {
  my $db = {{projectNamePascal}}::Model::DB->init;
  my $deleted = $db->delete_product($self->param('id'));

  return $self->render(json => {error => 'Product not found'}, status => 404) unless $deleted;

  $self->rendered(204);
}

1;
`,

    // Controller - Example
    'lib/{{projectNamePascal}}/Controller/Example.pm': `package {{projectNamePascal}}::Controller::Example;
use strict;
use warnings;
use Mojo::Base 'Mojolicious::Controller';

sub welcome ($self) {
  $self->render(msg => 'Welcome to the {{projectName}} API');
}

1;
`,

    // Templates
    'templates/example/welcome.html.ep': `<!DOCTYPE html>
<html>
<head>
  <title>Welcome to {{projectName}}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; }
    .endpoint {
      background: #f5f5f5;
      padding: 0.5rem;
      margin: 0.25rem 0;
      border-radius: 4px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1><%= $msg %></h1>
  <p>A REST API built with Mojolicious and Perl</p>

  <h2>API Endpoints</h2>
  <div class="endpoint">GET /health - Health check</div>
  <div class="endpoint">POST /api/v1/auth/register - Register user</div>
  <div class="endpoint">POST /api/v1/auth/login - Login user</div>
  <div class="endpoint">GET /api/v1/products - List products</div>
  <div class="endpoint">GET /api/v1/products/:id - Get product</div>
  <div class="endpoint">POST /api/v1/products - Create product (admin)</div>
  <div class="endpoint">PUT /api/v1/products/:id - Update product (admin)</div>
  <div class="endpoint">DELETE /api/v1/products/:id - Delete product (admin)</div>

  <h2>Default Credentials</h2>
  <p>Email: admin@example.com</p>
  <p>Password: admin123</p>
</body>
</html>
`,

    // Environment file
    '.env.example': `# Mojolicious configuration
# Run with: hypnotoad script/{{projectNameSnake}}

# Server port
# PORT=3000

# JWT secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# JWT expiration (seconds, default: 7 days)
JWT_EXPIRATION=604800

# Mode (development, production)
# MOJO_MODE=development
`,

    // Hypnotoad configuration (production server)
    'hypnotoad.conf': `{
  hypnotoad => {
    listen => ['http://*:3000'],
    workers => 4,
    accept_interval => 0.5,
    backlog => 128}};
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM perl:5.38 AS builder

WORKDIR /app

# Copy cpanfile for dependency caching
COPY cpanfile ./

# Install dependencies
RUN cpanm --notest --installdeps .

# Copy application
COPY . .

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM perl:5.38-slim AS runtime

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \\
    ca-certificates \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy installed modules from builder
COPY --from=builder /usr/local/lib/perl5 /usr/local/lib/perl5
COPY --from=builder /usr/local/bin/perl /usr/local/bin/perl

# Copy application files
COPY --from=builder /app /app

# Create non-root user
RUN useradd -m -u 1000 appuser

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

# Run with hypnotoad (production server)
CMD ["hypnotoad", "script/{{projectNameSnake}}", "-f"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=change-this-secret
      - MOJO_MODE=production
    restart: unless-stopped
`,

    // Tests
    't/basic.t': `use Mojo::Base -strict;
use Test::More;
use Test::Mojo;

BEGIN {
  use FindBin;
  use lib "$FindBin::Bin/../lib";
}

my $t = Test::Mojo->new('{{projectNamePascal}}');

# Health check
$t->get_ok('/health')
  ->status_is(200)
  ->json_is('/status' => 'healthy');

# Login
$t->post_ok('/api/v1/auth/login' => json => {email => 'admin@example.com', password => 'admin123'})
  ->status_is(200)
  ->json_has('/token');

# Get products (no auth required)
$t->get_ok('/api/v1/products')
  ->status_is(200)
  ->json_has('/products');

done_testing();
`,

    // Make script executable
    'Makefile.PL': `use ExtUtils::MakeMaker;

WriteMakefile(
  NAME => '{{projectNamePascal}}',
  VERSION_FROM => 'lib/{{projectNamePascal}}.pm',
  PREREQ_PM => {
    'Mojolicious' => '9.00',
    'Mojo::JWT' => '0'},
  ABSTRACT => '{{description}}',
  AUTHOR => '{{author}} <{{email}}>',
  LICENSE => 'perl',
);
`,

    // README
    'README.md': `# {{projectName}}

A powerful REST API built with Mojolicious web framework for Perl.

## Features

- **Mojolicious**: Powerful, feature-rich Perl web framework
- **Real-time**: Built-in WebSocket and event loops
- **RESTful**: Clean routing and JSON handling
- **JWT Authentication**: Secure token-based authentication
- **In-Memory Database**: Simple data persistence
- **CORS Support**: Cross-origin resource sharing
- **Hypnotoad**: Pre-forking production server

## Requirements

- Perl 5.20+
- Mojolicious 9.0+
- Mojo::JWT

## Installation

1. Install dependencies:
   \`\`\`bash
   cpanm Mojolicious Mojo::JWT
   \`\`\`

2. Or using cpan:
   \`\`\`bash
   cpan Mojolicious Mojo::JWT
   \`\`\`

## Quick Start

### Development Mode
\`\`\`bash
perl script/{{projectNameSnake}} daemon
\`\`\`

### Production Mode (Hypnotoad)
\`\`\`bash
hypnotoad script/{{projectNameSnake}}
\`

### Or with port specification
\`\`\`bash
perl script/{{projectNameSnake}} daemon -l http://*:3000
\`\`\`

Visit http://localhost:3000

## Available Commands

\`\`\`bash
# Development server with hot reload
perl script/{{projectNameSnake}} daemon -l http://*:3000

# Production server (hypnotoad)
hypnotoad script/{{projectNameSnake}}
hypnotoad script/{{projectNameSnake}} -s  # Stop

# One-shot server (morbo)
morbo script/{{projectNameSnake}}

# Run tests
prove -l t/
\`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`GET /api/v1/users/me\` - Get current user (auth required)

### Users
- \`GET /api/v1/users\` - List all users (admin only)
- \`GET /api/v1/users/:id\` - Get user by ID
- \`DELETE /api/v1/users/:id\` - Delete user (admin only)

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
├── script/{{projectNameSnake}}    # Application script
├── lib/{{projectNamePascal}}/     # Application modules
│   ├── Controller/               # Request handlers
│   ├── Model/                    # Database layer
│   └── Helpers/                  # Utilities
├── templates/                    # Templates
├── t/                           # Tests
└── hypnotoad.conf               # Server config
\`\`\`

## Mojolicious Features

- **Real-time Web**: Built-in WebSocket and event loops
- **RESTful Routing**: Clean and powerful routing
- **Template System**: Embedded Perl templates
- **JSON Handling**: Built-in JSON encoding/decoding
- **Session Management**: Cookie-based sessions
- **Testing**: Test::Mojo for easy testing
- **Plugin System**: Extensible with plugins
- **No Dependencies**: Everything included except JSON

## Environment Variables

\`\`\`bash
# Server
PORT=3000
MOJO_MODE=production

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=604800
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

Or with Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## Testing

\`\`\`bash
# Run all tests
prove -l t/

# Run with verbosity
prove -lv t/

# Run specific test
perl t/basic.t
\`\`\`

## Production Deployment

Using Hypnotoad (recommended):
\`\`\`bash
hypnotoad script/{{projectNameSnake}}
# To reload without downtime
hypnotoad script/{{projectNameSnake}}
# To stop
hypnotoad script/{{projectNameSnake}} -s
\`\`\`

Using systemd:
\`\`\`ini
[Unit]
Description={{projectName}} Mojolicious App
After=network.target

[Service]
Type=forking
User=www-data
WorkingDirectory=/path/to/{{projectName}}
ExecStart=/usr/bin/hypnotoad /path/to/{{projectName}}/script/{{projectNameSnake}}
ExecStop=/usr/bin/hypnotoad /path/to/{{projectName}}/script/{{projectNameSnake}} -s
Restart=always

[Install]
WantedBy=multi-user.target
\`\`\`

## License

MIT
`
  }
};
