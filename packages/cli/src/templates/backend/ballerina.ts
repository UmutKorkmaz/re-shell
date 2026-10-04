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
  features: ['validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    // Types, validation and the in-memory product store
    'types.bal': `# A product as stored and returned by the API.
public type Product record {|
    readonly int id;
    string name;
    string description;
    decimal price;
    int stock;
|};

# The request body accepted when creating or replacing a product.
public type NewProduct record {|
    string name;
    string description = "";
    decimal price;
    int stock = 0;
|};

# Checks a product payload.
#
# + product - the payload to check
# + return - a human readable problem, or nil when the payload is valid
public function validateProduct(NewProduct product) returns string? {
    if product.name.trim() == "" {
        return "name must not be empty";
    }
    if product.price < 0d {
        return "price must not be negative";
    }
    if product.stock < 0 {
        return "stock must not be negative";
    }
    return ();
}
`,

    // The REST service
    'main.bal': `import ballerina/http;
import ballerina/log;

# Port the REST API listens on. Override with Config.toml or BAL_CONFIG_VAR_PORT.
configurable int port = 8080;

# Port the GraphQL API listens on. Override with Config.toml or BAL_CONFIG_VAR_GRAPHQLPORT.
configurable int graphqlPort = 9090;

listener http:Listener apiListener = new (port);

table<Product> key(id) products = table [
    {id: 1, name: "Keyboard", description: "Mechanical keyboard", price: 79.90d, stock: 25},
    {id: 2, name: "Mouse", description: "Wireless mouse", price: 29.50d, stock: 60}
];
int nextProductId = 3;

# {{projectName}} REST API.
@http:ServiceConfig {
    cors: {
        allowOrigins: ["*"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"]
    }
}
service /api on apiListener {

    # Liveness probe.
    resource function get health() returns json {
        return {status: "healthy", 'service: "{{projectName}}"};
    }

    # Lists every product.
    resource function get products() returns Product[] {
        return products.toArray();
    }

    # Returns one product.
    resource function get products/[int id]() returns Product|http:NotFound {
        Product? product = products[id];
        if product is () {
            return http:NOT_FOUND;
        }
        return product;
    }

    # Creates a product.
    resource function post products(NewProduct payload) returns http:Created|http:BadRequest {
        string? problem = validateProduct(payload);
        if problem is string {
            return <http:BadRequest>{body: {message: problem}};
        }
        Product product = {
            id: nextProductId,
            name: payload.name,
            description: payload.description,
            price: payload.price,
            stock: payload.stock
        };
        nextProductId += 1;
        products.add(product);
        log:printInfo("product created", id = product.id);
        return <http:Created>{body: product};
    }

    # Replaces a product.
    resource function put products/[int id](NewProduct payload) returns Product|http:NotFound|http:BadRequest {
        if !products.hasKey(id) {
            return http:NOT_FOUND;
        }
        string? problem = validateProduct(payload);
        if problem is string {
            return <http:BadRequest>{body: {message: problem}};
        }
        Product product = {
            id: id,
            name: payload.name,
            description: payload.description,
            price: payload.price,
            stock: payload.stock
        };
        products.put(product);
        return product;
    }

    # Deletes a product.
    resource function delete products/[int id]() returns http:NoContent|http:NotFound {
        if !products.hasKey(id) {
            return http:NOT_FOUND;
        }
        _ = products.remove(id);
        return http:NO_CONTENT;
    }
}
`,

    // GraphQL service (ballerina/graphql, code-first schema)
    'graphql_service.bal': `import ballerina/graphql;

# GraphQL API: Query { hello: String!, health: String!, products: [Product!]! }
service /graphql on new graphql:Listener(graphqlPort) {

    resource function get hello() returns string {
        return "Hello from {{projectName}} GraphQL!";
    }

    resource function get health() returns string {
        return "healthy";
    }

    resource function get products() returns Product[] {
        return products.toArray();
    }
}
`,

    // Unit tests (bal test)
    'tests/validation_test.bal': `import ballerina/test;

@test:Config {}
function validProductPasses() {
    string? problem = validateProduct({name: "Desk", description: "Standing desk", price: 249.0d, stock: 3});
    test:assertEquals(problem, ());
}

@test:Config {}
function blankNameIsRejected() {
    string? problem = validateProduct({name: "   ", price: 1.0d});
    test:assertEquals(problem, "name must not be empty");
}

@test:Config {}
function negativePriceIsRejected() {
    string? problem = validateProduct({name: "Desk", price: -1.0d});
    test:assertEquals(problem, "price must not be negative");
}

@test:Config {}
function negativeStockIsRejected() {
    string? problem = validateProduct({name: "Desk", price: 1.0d, stock: -5});
    test:assertEquals(problem, "stock must not be negative");
}
`,

    // Ballerina package manifest
    'Ballerina.toml': `[package]
org = "reshell"
name = "{{projectNameSnake}}"
version = "1.0.0"

[build-options]
observabilityIncluded = false
`,

    // Runtime configuration (read by bal run)
    'Config.toml': `port = 8080
graphqlPort = 9090
`,

    // Dockerfile. Multi-stage: bal build in the Ballerina image (as root, so bal can write target/ next to the
    // root-owned sources; the image's default user is a non-root "ballerina"), then run the jar on a JRE.
    'Dockerfile': `FROM ballerina/ballerina:2201.13.6 AS build

USER root
WORKDIR /src
COPY . .
RUN bal build

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /src/target/bin/{{projectNameSnake}}.jar app.jar

ENV BAL_CONFIG_VAR_PORT=8080
ENV BAL_CONFIG_VAR_GRAPHQLPORT=9090
EXPOSE 8080 9090

CMD ["java", "-jar", "app.jar"]
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
        - name: BAL_CONFIG_VAR_PORT
          value: "8080"
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
`,

    // Docker Compose
    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "8080:8080"
      - "9090:9090"
    restart: unless-stopped
`,

    // .gitignore
    '.gitignore': `# Build output
target/

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
`,

    // README
    'README.md': `# {{projectName}}

A Ballerina REST and GraphQL service with an in-memory product store.

## Requirements

- Ballerina Swan Lake (https://ballerina.io/downloads/), which provides the \`bal\` command
- Docker (optional, for the container image)

## Run

\`\`\`bash
bal run
\`\`\`

The first build downloads the \`ballerina/http\`, \`ballerina/graphql\`, \`ballerina/log\` and \`ballerina/test\` packages from Ballerina Central.

| Service | Address |
| --- | --- |
| REST API | http://localhost:8080/api |
| GraphQL | http://localhost:9090/graphql |

Change the ports in \`Config.toml\` or with the \`BAL_CONFIG_VAR_PORT\` and \`BAL_CONFIG_VAR_GRAPHQLPORT\` environment variables.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/health | Liveness probe |
| GET | /api/products | List products |
| GET | /api/products/{id} | Get one product |
| POST | /api/products | Create a product |
| PUT | /api/products/{id} | Replace a product |
| DELETE | /api/products/{id} | Delete a product |

\`\`\`bash
curl -X POST http://localhost:8080/api/products \\
  -H 'Content-Type: application/json' \\
  -d '{"name": "Monitor", "price": 199.0, "stock": 4}'
\`\`\`

## GraphQL

\`\`\`bash
curl -X POST http://localhost:9090/graphql \\
  -H 'Content-Type: application/json' \\
  -d '{"query": "{ hello products { id name price } }"}'
\`\`\`

## Test and build

\`\`\`bash
bal test
bal build
\`\`\`

## Container

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 8080:8080 -p 9090:9090 {{projectName}}
\`\`\`

Kubernetes manifests are in \`k8s/\`.

## License

MIT
`
  }
};
