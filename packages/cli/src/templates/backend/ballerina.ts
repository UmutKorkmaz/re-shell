import { BackendTemplate } from '../types';

export const ballerinaTemplate: BackendTemplate = {
  id: 'ballerina',
  name: 'ballerina',
  displayName: 'Ballerina (Cloud-Native)',
  description: 'Cloud-native programming language for integration, APIs, and distributed systems with service-first design',
  language: 'ballerina',
  framework: 'ballerina',
  version: '1.0.0',
  tags: ['ballerina', 'cloud-native', 'integration', 'api', 'microservices', 'distributed', 'kubernetes'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Ballerina file
    'main.bal': `import ballerina/http;
import ballerina/jwt;
import ballerina/crypto;
import ballerina/time;
import ballerinax/redis;

# User record type
type User record {|
    int id;
    string email;
    string name;
    string password;
    string role;
|};

# Product record type
type Product record {|
    int id;
    string name;
    string description;
    decimal price;
    int stock;
|};

# In-memory database
final map<int, User> users = {
    1: {id: 1, email: "admin@example.com", password: hashPassword("admin123"), name: "Admin User", role: "admin"},
    2: {id: 2, email: "user@example.com", password: hashPassword("user123"), name: "Test User", role: "user"}
};

final map<int, Product> products = {
    1: {id: 1, name: "Sample Product 1", description: "This is a sample product", price: 29.99, stock: 100},
    2: {id: 2, name: "Sample Product 2", description: "Another sample product", price: 49.99, stock: 50}
};

int userIdCounter = 3;
int productIdCounter = 3;

# Hash password
function hashPassword(string password) returns string|error {
    return crypto:hashSha256(password.toBytes());
}

# Generate JWT token
function generateToken(User user) returns string|error {
    jwt:Payload payload = {
        iss: "{{projectName}}",
        sub: user.email.toString(),
        exp: time:currentTime().time + 3600,
        customClaims: {id: user.id, role: user.role}
    };
    return jwt:issue(payload, "secret-key-change-in-production");
}

# Verify JWT token
function verifyToken(string token) returns jwt:Payload|error {
    return jwt:validate(token, "secret-key-change-in-production");
}

# Health check service
service /api/v1 on new http:Listener(8080) {

    # Health check endpoint
    resource function get health() returns map<anydata>|error {
        return {
            status: "healthy",
            timestamp: time:currentTime().toString(),
            version: "1.0.0"
        };
    }
}

# Authentication service
service /api/v1/auth on new http:Listener(8080) {

    # Register new user
    resource function post register(@http:Payload User newUser) returns map<anydata>|http:BadRequest|http:Conflict {
        // Check if email already exists
        foreach var [id, user] in users.entries() {
            if user.email == newUser.email {
                return {http:CONFLICT, body: {error: "Email already registered"}};
            }
        }

        // Create new user
        newUser.id = userIdCounter;
        newUser.password = check hashPassword(newUser.password);
        users[userIdCounter] = newUser;
        userIdCounter += 1;

        // Generate token
        string token = check generateToken(newUser);

        return {
            status: 201,
            body: {
                token: token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role
                }
            }
        };
    }

    # Login user
    resource function post login(@http:Payload map<string> credentials) returns map<anydata>|http:Unauthorized {
        string email = credentials.get("email").toString();
        string password = credentials.get("password").toString();

        // Find user by email
        User? user = ();
        foreach var [id, u] in users.entries() {
            if u.email == email {
                user = u;
                break;
            }
        }

        if user is () {
            return {status: 401, body: {error: "Invalid credentials"}};
        }

        // Verify password
        string hashedPassword = check hashPassword(password);
        if user.password != hashedPassword {
            return {status: 401, body: {error: "Invalid credentials"}};
        }

        // Generate token
        string token = check generateToken(user);

        return {
            token: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };
    }
}

# Products service
service /api/v1/products on new http:Listener(8080) {

    # List all products
    resource function get() returns map<anydata> {
        return {
            products: products.values(),
            count: products.length()
        };
    }

    # Get product by ID
    resource function get [int id](int productId) returns map<anydata>|http:NotFound {
        if !products.hasKey(productId) {
            return {status: 404, body: {error: "Product not found"}};
        }

        return {product: products.get(productId)};
    }

    # Create product (requires authentication)
    resource function post(@http:Header {string authorization} authHeader, @http:Payload Product newProduct)
            returns map<anydata>|http:Unauthorized|http:BadRequest {

        // Verify token
        string token = authHeader.replace("Bearer ", "");
        jwt:Payload|error payload = verifyToken(token);
        if payload is error {
            return {status: 401, body: {error: "Invalid token"}};
        }

        // Create product
        newProduct.id = productIdCounter;
        products[productIdCounter] = newProduct;
        productIdCounter += 1;

        return {
            status: 201,
            body: {product: {id: newProduct.id, name: newProduct.name}}
        };
    }

    # Update product (requires authentication)
    resource function put [int id](int productId, @http:Header {string authorization} authHeader, @http:Payload Product updates)
            returns map<anydata>|http:NotFound|http:Unauthorized {

        // Verify token
        string token = authHeader.replace("Bearer ", "");
        jwt:Payload|error payload = verifyToken(token);
        if payload is error {
            return {status: 401, body: {error: "Invalid token"}};
        }

        if !products.hasKey(productId) {
            return {status: 404, body: {error: "Product not found"}};
        }

        Product existing = products.get(productId);
        existing.name = updates.name;
        existing.description = updates.description;
        existing.price = updates.price;
        existing.stock = updates.stock;

        return {product: {id: existing.id, name: existing.name}};
    }

    # Delete product (requires authentication)
    resource function delete [int id](int productId, @http:Header {string authorization} authHeader)
            returns http:NotFound|http:NoContent|http:Unauthorized {

        // Verify token
        string token = authHeader.replace("Bearer ", "");
        jwt:Payload|error payload = verifyToken(token);
        if payload is error {
            return {status: 401, body: {error: "Invalid token"}};
        }

        if !products.hasKey(productId) {
            return {status: 404, body: {error: "Product not found"}};
        }

        products.remove(productId);
        return {status: 204};
    }
}

# Home page service
service / on new http:Listener(8080) {

    resource function get() returns string {
        return \`
<!DOCTYPE html>
<html>
  <head>
    <title>{{projectName}}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
      h1 { color: #333; }
    </style>
  </head>
  <body>
    <h1>Welcome to {{projectName}}</h1>
    <p>Cloud-native server built with Ballerina language</p>
    <p>Designed for integration and distributed systems</p>
    <p>Service-first architecture with type safety</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
        \`;
    }
}
`,

    // Ballerina configuration
    'Ballerina.toml': `[package]
org = "re-shell"
name = "{{projectName}}"
version = "1.0.0"
authors = ["{{author}}"]
repository = "https://github.com/{{repository}}"
keywords = ["{{keywords}}"]

[[platform.java11.dependency]]
artifactId = "h2"
version = "2.0.206"
groupId = "com.h2database"

[build-options]
observabilityIncluded = true
`,

    // Environment file
    '.env': `# Server Configuration
PORT=8080
ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectName}}
DB_USER=postgres
DB_PASSWORD=password

# Redis (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
LOG_LEVEL=INFO

# Kubernetes (when deploying)
K8S_ENABLED=false
`,

    // Dockerfile
    'Dockerfile': `FROM ballerina/ballerina:latest

WORKDIR /home/ballerina

# Copy source files
COPY . .

# Build Ballerina project
RUN bal build --cloud=docker

# Expose port
EXPOSE 8080

# Run
CMD ["bal", "run", "main.bal"]
`,

    // Kubernetes deployment
    'k8s/deployment.yaml': `apiVersion: v1
kind: Service
metadata:
  name: {{projectName}}-service
spec:
  selector:
    app: {{projectName}}
  ports:
  - port: 8080
    targetPort: 8080
  type: LoadBalancer
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{projectName}}-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: {{projectName}}
  template:
    metadata:
      labels:
        app: {{projectName}}
    spec:
      containers:
      - name: {{projectName}}
        image: {{projectName}}:latest
        ports:
        - containerPort: 8080
        env:
        - name: ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: {{projectName}}-secrets
              key: jwt-secret
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENV=production
      - PORT=8080
      - JWT_SECRET=change-this-secret
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:latest
    ports:
      - "6379:6379"
    restart: unless-stopped
`,

    // .gitignore
    '.gitignore': `# Build output
*.balx
target/
build/
dist/

# Dependencies
.ballerina/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# Kubernetes
*.yaml
!k8s/
`,

    // README
    'README.md': `# {{projectName}}

Cloud-native web server built with Ballerina language for integration and distributed systems.

## Features

- **Ballerina**: Cloud-native programming language
- **Service-First**: Designed around network services
- **Type-Safe**: Strong static typing with structural types
- **Integration**: Built-in support for APIs, databases, message brokers
- **Kubernetes**: Generate K8s artifacts automatically
- **Observability**: Distributed tracing built-in
- **Network-Aware**: First-class support for network concepts
- **Modern**: Clean syntax with language features for cloud-native

## Requirements

- Ballerina runtime (latest)
- Docker (for containerization)
- Kubernetes (optional, for deployment)

## Installation

\`\`\`bash
# Install Ballerina
# macOS
brew install ballerina

# Linux
wget https://github.com/ballerina-platform/ballerina-distribution/releases/latest/download/ballerina-linux-installer-x64-1.x.x.deb
sudo dpkg -i ballerina-linux-installer-x64-1.x.x.deb

# Windows (using Chocolatey)
choco install ballerinatool

# Build
bal build

# Run
bal run main.bal
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Run with hot reload
bal run --watch

# Run
bal run main.bal
\`\`\`

### Production Mode
\`\`\`bash
# Build executable
bal build

# Run executable
./target/bin/{{projectName}}.jar
\`\`\`

Visit http://localhost:8080

## API Endpoints

### Health
- \`GET /api/v1/health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (requires auth)
- \`PUT /api/v1/products/:id\` - Update product (requires auth)
- \`DELETE /api/v1/products/:id\` - Delete product (requires auth)

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
main.bal            # Main server and services
Ballerina.toml      # Ballerina package configuration
Dockerfile          # Docker configuration
k8s/                # Kubernetes manifests
docker-compose.yml  # Docker Compose configuration
.env                # Environment variables
\`\`\`

## Ballerina Features

### Service-First Design

Ballerina is designed around services:

\`\`\`bal
service /api/v1 on new http:Listener(8080) {
    resource function get health() returns map<anydata> {
        return {status: "healthy"};
    }
}
\`\`\`

### Type Safety

Strong typing with structural types:

\`\`\`bal
type User record {|
    int id;
    string email;
    string name;
|};

resource function post register(User newUser) returns map<anydata>|error {
    newUser.id = userIdCounter;
    return {user: newUser};
}
\`\`\`

### Network Concepts

First-class support for network concepts:

\`\`\`bal
# Client objects
http:Client githubClient = check new ("https://api.github.com");

# Remote methods
json response = check githubClient->get("/users/ballerina-platform");

# Data binding
json payload = {name: "Service", port: 8080};
\`\`\`

### Integration

Built-in support for integrations:

\`\`\`bal
import ballerinax/redis;
import ballerinax/kubernetes;

# Redis client
redis:Client redisClient = check new ("localhost:6379");

# Kubernetes artifacts
@kubernetes:Service {}
@kubernetes:Ingress {}
service / on new http:Listener(8080) {
    # ...
}
\`\`\`

### Observability

Built-in distributed tracing:

\`\`\`bal
import ballerina/observability;

# Tracing is automatic
resource function get data() returns json {
    # Network calls are automatically traced
    json response = check httpClient->get("/api/data");
    return response;
}
\`\`\`

## Cloud-Native Features

### Kubernetes Deployment

Ballerina generates Kubernetes artifacts:

\`\`\`bash
# Generate Kubernetes artifacts
bal build --cloud=k8s

# Apply to cluster
kubectl apply -f target/kubernetes/{{projectName}}
\`\`\`

### Docker Support

Generate Docker images:

\`\`\`bash
# Build Docker image
bal build --cloud=docker

# Run container
docker run -p 8080:8080 {{projectName}}:latest
\`\`\`

### Configuration

External configuration support:

\`\`\`bal
import ballerina/config;

# Read from config
string port = config:getAsString("server.port");
\`\`\`

## Development

\`\`\`bash
# Build
bal build

# Run
bal run main.bal

# Test
bal test

# Format
bal format main.bal

# Lint
bal lint main.bal

# Package
bal pack
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 8080:8080 {{projectName}}
\`\`\`

Or with Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## Kubernetes

\`\`\`bash
# Generate artifacts
bal build --cloud=k8s

# Deploy to cluster
kubectl apply -f target/kubernetes/

# Check status
kubectl get pods
kubectl get svc
\`\`\`

## Why Ballerina?

- **Cloud-Native**: Designed for the cloud from day one
- **Service-First**: Services and endpoints are first-class concepts
- **Type-Safe**: Catch errors at compile time
- **Integration**: Built-in support for common integrations
- **Observability**: Distributed tracing out of the box
- **Diagram**: Sequence diagrams from code
- **Kubernetes**: Generate K8s artifacts automatically
- **Network-Aware**: Concepts like endpoints, clients, services

## Status

✅ **Production-Ready**: Ballerina is stable and production-ready
- Backed by WSO2
- Active development and community
- Growing ecosystem
- Production deployments worldwide

## References

- [Ballerina Website](https://ballerina.io/)
- [Ballerina GitHub](https://github.com/ballerina-platform/ballerina-lang)
- [Documentation](https://ballerina.io/learn/)
- [Central](https://central.ballerina.io/)

## License

MIT
`}
};
