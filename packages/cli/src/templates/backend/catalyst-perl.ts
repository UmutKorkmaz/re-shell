import { BackendTemplate } from '../types';

export const catalystTemplate: BackendTemplate = {
  id: 'catalyst',
  name: 'catalyst',
  displayName: 'Catalyst (Perl)',
  description: 'MVC web framework for Perl with extensible plugins and flexible architecture',
  language: 'perl',
  framework: 'catalyst',
  version: '1.0.0',
  tags: ['perl', 'catalyst', 'mvc', 'microservices', 'extensible', 'restful'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main application script
    'script/{{projectNameSnake}}_server.pl': `#!/usr/bin/env perl

use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";

use {{projectNamePascal}};
use {{projectNamePascal}}::Model::DB;

# Initialize database
{{projectNamePascal}}::Model::DB->init();

my $app = {{projectNamePascal}}->apply_default_middlewares({{projectNamePascal}}->psgi_app(@_));

print "🚀 Server running at http://localhost:5000\\n";
print "📚 API docs: http://localhost:5000/api/v1/health\\n";

$app;
`,

    // Application class
    'lib/{{projectNamePascal}}.pm': `package {{projectNamePascal}};
use Catalyst qw/
    ConfigLoader
    Static::Simple

    Authentication
    Authorization::Roles

    Session
    Session::Store::File

    JSON
/;

use version; our $VERSION = qv('0.01');

extends 'Catalyst';

# Configure the application
sub configure {
    my ($self, $c) = @_;

    my $config = $self->config;

    $config->{jwt_secret} = 'change-this-secret-in-production';
    $config->{jwt_expiration} = 604800; # 7 days

    $config->{'Plugin::Authentication'} = {
        default_realm => 'members',
        members => {
            credential => {
                class => 'Password',
                password_field => 'password',
                password_type => 'self_check'},
            store => {
                class => 'Minimal',
                users => {
                    'admin@example.com' => {
                        password => 'admin123',
                        role => 'admin'}},
                roles => {
                    admin => [ qw/admin/ ]}}}};

    $config->{'Plugin::Authorization::Roles'} = {
        admin_role => 'admin'};
}

sub after_authentication {
    my ($self, $c) = @_;

    # Add CORS headers
    $c->response->headers->header('Access-Control-Allow-Origin' => '*');
    $c->response->headers->header('Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS');
    $c->response->headers->header('Access-Control-Allow-Headers' => 'Content-Type, Authorization');
}

# Handle OPTIONS requests for CORS
sub options {
    my ($self, $c) = @_;
    $c->response->status(200);
    $c->response->body('');
}

1;
`,

    // Controller - API
    'lib/{{projectNamePascal}}/Controller/API.pm': `package {{projectNamePascal}}::Controller::API;
use Moose;
use namespace::autoclean;
use JSON::MaybeXS;

BEGIN { extends 'Catalyst::Controller'; }

sub health :Local {
    my ($self, $c) = @_;

    my $response = {
        status => 'healthy',
        timestamp => scalar localtime,
        version => '0.01'
    };

    $c->response->body(encode_json($response));
    $c->response->content_type('application/json');
}

sub not_found :Private {
    my ($self, $c) = @_;

    my $response = { error => 'Not found' };
    $c->response->body(encode_json($response));
    $c->response->status(404);
    $c->response->content_type('application/json');
}

1;
`,

    // Controller - Auth
    'lib/{{projectNamePascal}}/Controller/Auth.pm': `package {{projectNamePascal}}::Controller::Auth;
use Moose;
use namespace::autoclean;
use JSON::MaybeXS;
use Digest::SHA qw(sha256_hex);

BEGIN { extends 'Catalyst::Controller'; }

sub register :Local {
    my ($self, $c) = @_;

    my $params = $c->request->body_data;
    my $data = decode_json($params) if $params;

    my $users = \${{projectNamePascal}}::Model::DB::get_all_users();

    # Check if user exists
    for my $user (@$users) {
        if ($user->{email} eq $data->{email}) {
            $c->response->status(409);
            $c->response->body(encode_json({ error => 'Email already registered' }));
            $c->response->content_type('application/json');
            return;
        }
    }

    # Create new user
    my $new_user = {
        id => scalar(@$users) + 1,
        email => $data->{email},
        password => sha256_hex($data->{password}),
        name => $data->{name},
        role => 'user',
        created_at => scalar localtime,
        updated_at => scalar localtime};

    push @$users, $new_user;

    my $token = $self->_generate_token($new_user);

    my $response = {
        token => $token,
        user => {
            id => $new_user->{id},
            email => $new_user->{email},
            name => $new_user->{name},
            role => $new_user->{role}}
    };

    $c->response->status(201);
    $c->response->body(encode_json($response));
    $c->response->content_type('application/json');
}

sub login :Local {
    my ($self, $c) = @_;

    my $params = $c->request->body_data;
    my $data = decode_json($params) if $params;

    my $users = \${{projectNamePascal}}::Model::DB::get_all_users();

    my $found_user;
    for my $user (@$users) {
        if ($user->{email} eq $data->{email}) {
            if (sha256_hex($data->{password}) eq $user->{password}) {
                $found_user = $user;
                last;
            }
        }
    }

    unless ($found_user) {
        $c->response->status(401);
        $c->response->body(encode_json({ error => 'Invalid credentials' }));
        $c->response->content_type('application/json');
        return;
    }

    my $token = $self->_generate_token($found_user);

    my $response = {
        token => $token,
        user => {
            id => $found_user->{id},
            email => $found_user->{email},
            name => $found_user->{name},
            role => $found_user->{role}}
    };

    $c->response->body(encode_json($response));
    $c->response->content_type('application/json');
}

sub _generate_token {
    my ($self, $user) = @_;

    # In production, use real JWT
    return 'jwt-token-' . sha256_hex($user->{email} . time());
}

1;
`,

    // Controller - Products
    'lib/{{projectNamePascal}}/Controller/Product.pm': `package {{projectNamePascal}}::Controller::Product;
use Moose;
use namespace::autoclean;
use JSON::MaybeXS;

BEGIN { extends 'Catalyst::Controller'; }

sub list :Local {
    my ($self, $c) = @_;

    my $products = \${{projectNamePascal}}::Model::DB::get_all_products();

    my $response = {
        products => $products,
        count => scalar @$products};

    $c->response->body(encode_json($response));
    $c->response->content_type('application/json');
}

sub get :Local {
    my ($self, $c) = @_;

    my $id = $c->request->parameters->{id};
    my $product = \${{projectNamePascal}}::Model::DB::get_product_by_id($id);

    unless ($product) {
        $c->response->status(404);
        $c->response->body(encode_json({ error => 'Product not found' }));
        $c->response->content_type('application/json');
        return;
    }

    $c->response->body(encode_json({ product => $product }));
    $c->response->content_type('application/json');
}

sub create :Local {
    my ($self, $c) = @_;

    my $params = $c->request->body_data;
    my $data = decode_json($params) if $params;

    my $products = \${{projectNamePascal}}::Model::DB::get_all_products();

    my $new_product = {
        id => scalar(@$products) + 1,
        name => $data->{name},
        description => $data->{description} || '',
        price => $data->{price},
        stock => $data->{stock},
        created_at => scalar localtime,
        updated_at => scalar localtime};

    push @$products, $new_product;

    $c->response->status(201);
    $c->response->body(encode_json({ product => $new_product }));
    $c->response->content_type('application/json');
}

sub update :Local {
    my ($self, $c) = @_;

    my $id = $c->request->parameters->{id};
    my $params = $c->request->body_data;
    my $data = decode_json($params) if $params;

    my $product = \${{projectNamePascal}}::Model::DB::update_product($id, $data);

    unless ($product) {
        $c->response->status(404);
        $c->response->body(encode_json({ error => 'Product not found' }));
        $c->response->content_type('application/json');
        return;
    }

    $c->response->body(encode_json({ product => $product }));
    $c->response->content_type('application/json');
}

sub delete :Local {
    my ($self, $c) = @_;

    my $id = $c->request->parameters->{id};
    my $success = \${{projectNamePascal}}::Model::DB::delete_product($id);

    unless ($success) {
        $c->response->status(404);
        $c->response->body(encode_json({ error => 'Product not found' }));
        $c->response->content_type('application/json');
        return;
    }

    $c->response->status(204);
    $c->response->body('');
}

1;
`,

    // Model - Database
    'lib/{{projectNamePascal}}/Model/DB.pm': `package {{projectNamePascal}}::Model::DB;
use strict;
use warnings;

my @users = (
    {
        id => 1,
        email => 'admin@example.com',
        password => '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a', # sha256('admin123')
        name => 'Admin User',
        role => 'admin',
        created_at => scalar localtime,
        updated_at => scalar localtime}
);

my @products = (
    {
        id => 1,
        name => 'Sample Product 1',
        description => 'This is a sample product',
        price => 29.99,
        stock => 100,
        created_at => scalar localtime,
        updated_at => scalar localtime},
    {
        id => 2,
        name => 'Sample Product 2',
        description => 'Another sample product',
        price => 49.99,
        stock => 50,
        created_at => scalar localtime,
        updated_at => scalar localtime}
);

sub init {
    print "📦 Database initialized\\n";
    print "👤 Default admin: admin@example.com / admin123\\n";
}

sub get_all_users {
    return \\\\@users;
}

sub get_all_products {
    return \\\\@products;
}

sub get_product_by_id {
    my ($id) = @_;

    for my $product (@products) {
        return $product if $product->{id} == $id;
    }

    return undef;
}

sub update_product {
    my ($id, $data) = @_;

    for my $product (@products) {
        if ($product->{id} == $id) {
            $product->{name} = $data->{name} if $data->{name};
            $product->{description} = $data->{description} if $data->{description};
            $product->{price} = $data->{price} if $data->{price};
            $product->{stock} = $data->{stock} if $data->{stock};
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

    // Configuration
    '{{projectNameSnake}}.conf': `name {{projectName}};
charset UTF-8;

<accept_context ctx_negotiation;

<Model::DB>
    schema_class DB
</Model::DB>

<Controller::Root>
    index index
</Controller::Root>

<Model::DB>
    connect_info dbi:SQLite:dbname=./{{projectNameSnake}}.db
</Model::DB>

<Session>
    <store>
        class File
    </store>
</Session>

# JWT configuration
<jwt_secret>change-this-secret-in-production</jwt_secret>
<jwt_expiration>604800</jwt_expiration>
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

CMD ["perl", "script/{{projectNameSnake}}_server.pl"]
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
    'cpanfile': `requires 'Catalyst::Runtime', '== 5.90100';
requires 'Catalyst::Plugin::ConfigLoader', '0';
requires 'Catalyst::Plugin::Static::Simple', '0';
requires 'Catalyst::Plugin::Authentication', '0';
requires 'Catalyst::Plugin::Authorization::Roles', '0';
requires 'Catalyst::Plugin::Session', '0.40';
requires 'Catalyst::Plugin::Session::Store::File', '0';
requires 'Catalyst::Action::RenderView', '0';
requires 'Catalyst::Model::DBIC::Schema', '0';
requires 'Config::General';
requires 'JSON::MaybeXS', '1.004';
requires 'Digest::SHA', '6.02';
requires 'Moose', '2.2015';

on 'test' => {
    requires 'Test::More', '1.30';
    requires 'Test::WWW::Mechanize::Catalyst', '0.18';
};

on 'develop' => {
    requires 'Catalyst::Devel', '1.39';
    requires 'Catalyst::Plugin::EnableDebug', '0';
};
`,

    // Tests
    't/01_auth.t': `use strict;
use warnings;
use Test::More tests => 2;
use Test::WWW::Mechanize::Catalyst 'Catalyst';

my $mech = Test::WWW::Mechanize::Catalyst->new(catalyst_app => {{projectNamePascal}}->psgi_app(@_));

# Test health endpoint
$mech->get_ok('/health', 'Health check works');
$mech->content_contains('status');

# Test products endpoint
$mech->get_ok('/api/v1/products', 'Products endpoint works');
$mech->content_contains('products');

done_testing();
`,

    // README
    'README.md': `# {{projectName}}

MVC REST API built with Catalyst framework for Perl.

## Features

- **Catalyst**: MVC web framework with extensible plugins
- **Authentication**: Built-in authentication and authorization
- **Session Management**: File-based session storage
- **RESTful**: Clean API design
- **JSON**: Automatic JSON serialization
- **Testing**: Test::WWW::Mechanize integration

## Requirements

- Perl 5.38+
- Catalyst 5.90+

## Quick Start

\\\`\\\`bash
cpanm --installdeps .
perl script/{{projectNameSnake}}_server.pl
\\\`\\\`

## API Endpoints

- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`POST /api/v1/products/create\` - Create product (requires admin)
- \`PUT /api/v1/products/update\` - Update product (requires admin)
- \`DELETE /api/v1/products/delete\` - Delete product (requires admin)

## Testing

\\\`\\\`bash
prove -l t
\\\`\\\`

## License

MIT
`
  }
};
