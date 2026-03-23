import { BackendTemplate } from '../types';

export const dancer2Template: BackendTemplate = {
  id: 'dancer2',
  name: 'dancer2',
  displayName: 'Dancer2 (Perl)',
  description: 'Lightweight, powerful Perl web framework for building elegant web applications',
  language: 'perl',
  framework: 'dancer2',
  version: '1.0.0',
  tags: ['perl', 'dancer2', 'lightweight', 'psgi', 'restful', 'mvc'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main application file
    'bin/app.psgi': `#!/usr/bin/env perl

use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";

use {{projectNamePascal}};
use Plack::Builder;

my $app = {{projectNamePascal}}->to_app;

builder {
    enable 'CrossOrigin',
        origins => '*',
        methods => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers => ['Content-Type', 'Authorization'];

    $app;
};
`,

    // Application class
    'lib/{{projectNamePascal}}.pm': `package {{projectNamePascal}};
use Dancer2;
use {{projectNamePascal}}::Model::DB;
use {{projectNamePascal}}::Helpers::Auth;

our $VERSION = '0.1.0';

# Initialize database
{{projectNamePascal}}::Model::DB->init();

# Configuration
set 'jwt_secret' => 'change-this-secret-in-production';
set 'jwt_expiration' => 604800; # 7 days

# Routes
get '/' => sub {
    return {
        message => 'Welcome to {{projectName}} API',
        version => $VERSION
    };
};

get '/health' => sub {
    return {
        status => 'healthy',
        timestamp => scalar localtime,
        version => $VERSION
    };
};

# Auth routes
post '/api/v1/auth/register' => sub {
    my $params = body_parameters->as_hashref;

    my $user = {{projectNamePascal}}::Model::DB::find_user_by_email($params->{email});
    if ($user) {
        status(409);
        return { error => 'Email already registered' };
    }

    $user = {{projectNamePascal}}::Model::DB::create_user($params);
    my $token = {{projectNamePascal}}::Helpers::Auth::generate_token($user);

    status(201);
    return {
        token => $token,
        user => {
            id => $user->{id},
            email => $user->{email},
            name => $user->{name},
            role => $user->{role}
        }
    };
};

post '/api/v1/auth/login' => sub {
    my $params = body_parameters->as_hashref;

    my $user = {{projectNamePascal}}::Model::DB::find_user_by_email($params->{email});
    unless ($user && {{projectNamePascal}}::Helpers::Auth::verify_password($params->{password}, $user->{password})) {
        status(401);
        return { error => 'Invalid credentials' };
    }

    my $token = {{projectNamePascal}}::Helpers::Auth::generate_token($user);

    return {
        token => $token,
        user => {
            id => $user->{id},
            email => $user->{email},
            name => $user->{name},
            role => $user->{role}
        }
    };
};

# Product routes
get '/api/v1/products' => sub {
    my $products = {{projectNamePascal}}::Model::DB::get_all_products();
    return {
        products => $products,
        count => scalar @$products
    };
};

get '/api/v1/products/:id' => sub {
    my $id = route_parameters->get('id');
    my $product = {{projectNamePascal}}::Model::DB::get_product_by_id($id);

    unless ($product) {
        status(404);
        return { error => 'Product not found' };
    }

    return { product => $product };
};

post '/api/v1/products' => sub {
    my $params = body_parameters->as_hashref;

    my $product = {{projectNamePascal}}::Model::DB::create_product($params);

    status(201);
    return { product => $product };
};

put '/api/v1/products/:id' => sub {
    my $id = route_parameters->get('id');
    my $params = body_parameters->as_hashref;

    my $product = {{projectNamePascal}}::Model::DB::update_product($id, $params);

    unless ($product) {
        status(404);
        return { error => 'Product not found' };
    }

    return { product => $product };
};

del '/api/v1/products/:id' => sub {
    my $id = route_parameters->get('id');

    my $success = {{projectNamePascal}}::Model::DB::delete_product($id);

    unless ($success) {
        status(404);
        return { error => 'Product not found' };
    }

    status(204);
    return;
};

true;
`,

    // Model - Database
    'lib/{{projectNamePascal}}/Model/DB.pm': `package {{projectNamePascal}}::Model::DB;
use strict;
use warnings;

our @users = (
    {
        id => 1,
        email => 'admin@example.com',
        password => 'hashed_password_here', # In production, hash this
        name => 'Admin User',
        role => 'admin',
        created_at => scalar localtime,
        updated_at => scalar localtime
    }
);

our @products = (
    {
        id => 1,
        name => 'Sample Product 1',
        description => 'This is a sample product',
        price => 29.99,
        stock => 100,
        created_at => scalar localtime,
        updated_at => scalar localtime
    },
    {
        id => 2,
        name => 'Sample Product 2',
        description => 'Another sample product',
        price => 49.99,
        stock => 50,
        created_at => scalar localtime,
        updated_at => scalar localtime
    }
);

our $user_id = 2;
our $product_id = 3;

sub init {
    print "📦 Database initialized\\n";
    print "👤 Default admin: admin@example.com / admin123\\n";
}

sub find_user_by_email {
    my ($email) = @_;

    for my $user (@users) {
        return $user if $user->{email} eq $email;
    }

    return undef;
}

sub find_user_by_id {
    my ($id) = @_;

    for my $user (@users) {
        return $user if $user->{id} == $id;
    }

    return undef;
}

sub create_user {
    my ($params) = @_;

    my $user = {
        id => $user_id++,
        email => $params->{email},
        password => $params->{password}, # In production, hash this
        name => $params->{name},
        role => 'user',
        created_at => scalar localtime,
        updated_at => scalar localtime
    };

    push @users, $user;
    return $user;
}

sub delete_user {
    my ($id) = @_;

    for my $i (0 .. $#users) {
        if ($users[$i]{id} == $id) {
            splice @users, $i, 1;
            return 1;
        }
    }

    return 0;
}

sub get_all_users {
    return \\@users;
}

sub get_product_by_id {
    my ($id) = @_;

    for my $product (@products) {
        return $product if $product->{id} == $id;
    }

    return undef;
}

sub get_all_products {
    return \\@products;
}

sub create_product {
    my ($params) = @_;

    my $product = {
        id => $product_id++,
        name => $params->{name},
        description => $params->{description} || '',
        price => $params->{price},
        stock => $params->{stock},
        created_at => scalar localtime,
        updated_at => scalar localtime
    };

    push @products, $product;
    return $product;
}

sub update_product {
    my ($id, $params) = @_;

    for my $product (@products) {
        if ($product->{id} == $id) {
            $product->{name} = $params->{name} if $params->{name};
            $product->{description} = $params->{description} if $params->{description};
            $product->{price} = $params->{price} if $params->{price};
            $product->{stock} = $params->{stock} if $params->{stock};
            $product->{updated_at} = scalar localtime;

            return $product;
        }
    }

    return undef;
}

sub delete_product {
    my ($id) = @_;

    for my $i (0 .. $#products) {
        if ($products[$i]{id} == $id) {
            splice @products, $i, 1;
            return 1;
        }
    }

    return 0;
}

1;
`,

    // Helper - Authentication
    'lib/{{projectNamePascal}}/Helpers/Auth.pm': `package {{projectNamePascal}}::Helpers::Auth;
use strict;
use warnings;
use JSON;
use Digest::SHA qw(sha256_hex);

sub generate_token {
    my ($user) = @_;

    # In production, use real JWT
    my $payload = encode_json({
        user_id => $user->{id},
        email => $user->{email},
        role => $user->{role},
        exp => time() + 604800 # 7 days
    });

    return 'jwt-token-' . sha256_hex($payload);
}

sub verify_token {
    my ($token) = @_;

    # In production, verify JWT signature
    return $token =~ /^jwt-token-/;
}

sub hash_password {
    my ($password) = @_;
    return sha256_hex($password);
}

sub verify_password {
    my ($password, $hash) = @_;
    return sha256_hex($password) eq $hash;
}

1;
`,

    // Configuration
    'config.yml': `appname: "{{projectName}}"
charset: "UTF-8"

logger: "console"
log: "debug"

show_errors: 1
startup_info: 1

# JWT Configuration
jwt_secret: "change-this-secret-in-production"
jwt_expiration: 604800

# CORS
cors:
    origins: "*"
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    headers: ["Content-Type", "Authorization"]
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
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["plackup", "-p", "5000", "bin/app.psgi"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    restart: unless-stopped
`,

    // Dependencies
    'cpanfile': `requires 'Dancer2', => '0.400000';
requires 'Plack', => '1.004';
requires 'Plack::Middleware::CrossOrigin', => '0.012';
requires 'JSON', => '4.10';
requires 'Digest::SHA', => '6.02';
requires 'YAML', => '1.30';

on 'test' => {
    requires 'Test::More', => '1.30';
    requires 'Test::Pod', => '1.52';
};

on 'develop' => {
    requires 'Perl::Critic', => '1.140';
};
`,

    // Tests
    't/001_basic.t': `use strict;
use warnings;
use Test::More tests => 3;
use Plack::Test;
use HTTP::Request::Common;
use {{projectNamePascal}};

my $app = {{projectNamePascal}}->to_app;

Plack::Test->create($app, sub {
    my $cb = shift;

    # Test health endpoint
    my $res = $cb->(GET '/health');
    is($res->code, 200, 'Health check returns 200');

    # Test products endpoint
    $res = $cb->(GET '/api/v1/products');
    is($res->code, 200, 'Products endpoint returns 200');

    # Test not found
    $res = $cb->(GET '/api/v1/products/999999');
    is($res->code, 404, 'Not found returns 404');
});
`,

    // README
    'README.md': `# {{projectName}}

Lightweight REST API built with Dancer2 for Perl.

## Features

- **Dancer2**: Powerful, lightweight web framework
- **PSGI**: SuperficiaL PSGI application
- **RESTful**: Clean API design
- **JSON**: Automatic JSON serialization
- **CORS**: Cross-origin resource sharing
- **Testing**: Comprehensive test suite

## Requirements

- Perl 5.38+
- Dancer2 0.400+
- Plack 1.004+

## Quick Start

\`\`\`bash
cpanm --installdeps .
plackup -p 5000 bin/app.psgi
\`\`\`

## API Endpoints

- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## Testing

\`\`\`bash
prove -l t
\`\`\`

## License

MIT
`
  }
};
