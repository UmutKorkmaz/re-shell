// No specific imports needed - using string for file content

export interface CppOpenApiConfig {
  specPath: string;
  outputDir: string;
  namespace: string;
  generateServer: boolean;
  generateClient: boolean;
  framework: 'crow' | 'drogon' | 'beast' | 'pistache' | 'cpp-httplib';
}

export class CppOpenApiGenerator {
  static generate(config: CppOpenApiConfig): Record<string, string> {
    const files: Record<string, string> = {};

    // OpenAPI specification example
    files['api/openapi.yaml'] = `openapi: 3.0.3
info:
  title: ${config.namespace} API
  description: REST API for ${config.namespace} service
  version: 1.0.0
  contact:
    name: API Support
    email: support@example.com

servers:
  - url: http://localhost:8080/api/v1
    description: Development server
  - url: https://api.example.com/v1
    description: Production server

security:
  - bearerAuth: []

paths:
  /health:
    get:
      tags:
        - System
      summary: Health check
      description: Check if the service is healthy
      operationId: getHealth
      security: []
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
        '503':
          description: Service is unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /auth/login:
    post:
      tags:
        - Authentication
      summary: User login
      description: Authenticate user and receive JWT token
      operationId: login
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /users:
    get:
      tags:
        - Users
      summary: List users
      description: Get a paginated list of users
      operationId: listUsers
      parameters:
        - name: page
          in: query
          description: Page number
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: limit
          in: query
          description: Items per page
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
      responses:
        '200':
          description: Users retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    post:
      tags:
        - Users
      summary: Create user
      description: Create a new user
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /users/{id}:
    get:
      tags:
        - Users
      summary: Get user by ID
      description: Get a specific user by their ID
      operationId: getUserById
      parameters:
        - name: id
          in: path
          required: true
          description: User ID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    put:
      tags:
        - Users
      summary: Update user
      description: Update an existing user
      operationId: updateUser
      parameters:
        - name: id
          in: path
          required: true
          description: User ID
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: User updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    delete:
      tags:
        - Users
      summary: Delete user
      description: Delete a user
      operationId: deleteUser
      parameters:
        - name: id
          in: path
          required: true
          description: User ID
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: User deleted successfully
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    HealthResponse:
      type: object
      required:
        - status
        - timestamp
      properties:
        status:
          type: string
          enum: [healthy, unhealthy]
        timestamp:
          type: string
          format: date-time
        version:
          type: string
        uptime:
          type: integer
          description: Uptime in seconds

    ErrorResponse:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object
          additionalProperties: true

    LoginRequest:
      type: object
      required:
        - username
        - password
      properties:
        username:
          type: string
          minLength: 3
        password:
          type: string
          minLength: 8

    LoginResponse:
      type: object
      required:
        - token
        - expiresIn
      properties:
        token:
          type: string
        expiresIn:
          type: integer
          description: Token expiry time in seconds
        user:
          $ref: '#/components/schemas/User'

    User:
      type: object
      required:
        - id
        - username
        - email
        - createdAt
      properties:
        id:
          type: string
          format: uuid
        username:
          type: string
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        role:
          type: string
          enum: [admin, user, guest]
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    CreateUserRequest:
      type: object
      required:
        - username
        - email
        - password
      properties:
        username:
          type: string
          minLength: 3
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8
        firstName:
          type: string
        lastName:
          type: string
        role:
          type: string
          enum: [admin, user, guest]

    UpdateUserRequest:
      type: object
      properties:
        email:
          type: string
          format: email
        firstName:
          type: string
        lastName:
          type: string
        role:
          type: string
          enum: [admin, user, guest]

    UserListResponse:
      type: object
      required:
        - users
        - pagination
      properties:
        users:
          type: array
          items:
            $ref: '#/components/schemas/User'
        pagination:
          type: object
          required:
            - page
            - limit
            - total
            - pages
          properties:
            page:
              type: integer
            limit:
              type: integer
            total:
              type: integer
            pages:
              type: integer
`;

    // OpenAPI code generator script
    files['scripts/generate-api.sh'] = `#!/bin/bash

# OpenAPI Code Generator for C++ Services
# Generates server stubs and client SDK from OpenAPI specification

set -e

SPEC_FILE="api/openapi.yaml"
OUTPUT_DIR="generated"
GENERATOR_VERSION="7.2.0"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

echo -e "\${BLUE}C++ OpenAPI Code Generator\${NC}"
echo "=========================="

# Check if OpenAPI spec exists
if [ ! -f "$SPEC_FILE" ]; then
    echo -e "\${RED}Error: OpenAPI specification not found at $SPEC_FILE\${NC}"
    exit 1
fi

# Validate OpenAPI spec
echo -e "\${BLUE}Validating OpenAPI specification...\${NC}"
if command -v swagger-cli &> /dev/null; then
    swagger-cli validate $SPEC_FILE || {
        echo -e "\${RED}OpenAPI specification validation failed\${NC}"
        exit 1
    }
else
    echo "swagger-cli not found, skipping validation"
fi

# Download OpenAPI Generator if not exists
if [ ! -f "openapi-generator-cli.jar" ]; then
    echo -e "\${BLUE}Downloading OpenAPI Generator CLI...\${NC}"
    wget https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/\${GENERATOR_VERSION}/openapi-generator-cli-\${GENERATOR_VERSION}.jar -O openapi-generator-cli.jar
fi

# Create output directory
mkdir -p $OUTPUT_DIR

# Generate server stubs based on framework
FRAMEWORK="${config.framework}"
case $FRAMEWORK in
    "pistache")
        echo -e "\${BLUE}Generating Pistache server stubs...\${NC}"
        java -jar openapi-generator-cli.jar generate \\
            -i $SPEC_FILE \\
            -g cpp-pistache-server \\
            -o $OUTPUT_DIR/server \\
            --additional-properties packageName=${config.namespace}
        ;;
    "crow"|"drogon"|"beast"|"cpp-httplib")
        echo -e "\${BLUE}Generating C++ REST SDK server stubs...\${NC}"
        java -jar openapi-generator-cli.jar generate \\
            -i $SPEC_FILE \\
            -g cpp-restsdk \\
            -o $OUTPUT_DIR/server \\
            --additional-properties packageName=${config.namespace},modelPackage=models,apiPackage=api
        ;;
    *)
        echo -e "\${RED}Unsupported framework: $FRAMEWORK\${NC}"
        exit 1
        ;;
esac

# Generate client SDK
if [ "${config.generateClient}" = "true" ]; then
    echo -e "\${BLUE}Generating C++ client SDK...\${NC}"
    java -jar openapi-generator-cli.jar generate \\
        -i $SPEC_FILE \\
        -g cpp-restsdk \\
        -o $OUTPUT_DIR/client \\
        --additional-properties packageName=${config.namespace}_client
fi

# Generate documentation
echo -e "\${BLUE}Generating API documentation...\${NC}"
java -jar openapi-generator-cli.jar generate \\
    -i $SPEC_FILE \\
    -g markdown \\
    -o $OUTPUT_DIR/docs

# Generate Postman collection
echo -e "\${BLUE}Generating Postman collection...\${NC}"
java -jar openapi-generator-cli.jar generate \\
    -i $SPEC_FILE \\
    -g postman-collection \\
    -o $OUTPUT_DIR/postman

echo -e "\${GREEN}Code generation completed!\${NC}"
echo "Generated files:"
echo "  - Server stubs: $OUTPUT_DIR/server"
[ "${config.generateClient}" = "true" ] && echo "  - Client SDK: $OUTPUT_DIR/client"
echo "  - Documentation: $OUTPUT_DIR/docs"
echo "  - Postman collection: $OUTPUT_DIR/postman"
`;

    // CMake integration for generated code
    files['generated/CMakeLists.txt'] = `# Generated code CMake configuration
cmake_minimum_required(VERSION 3.16)

# Add generated server code
if(EXISTS \${CMAKE_CURRENT_SOURCE_DIR}/server)
    add_subdirectory(server)
endif()

# Add generated client code
if(EXISTS \${CMAKE_CURRENT_SOURCE_DIR}/client)
    add_subdirectory(client)
endif()

# Create interface library for generated models
add_library(${config.namespace}_models INTERFACE)
target_include_directories(${config.namespace}_models INTERFACE
    \${CMAKE_CURRENT_SOURCE_DIR}/server/model
    \${CMAKE_CURRENT_SOURCE_DIR}/server/api
)

# Export targets
export(TARGETS ${config.namespace}_models
    FILE "\${CMAKE_CURRENT_BINARY_DIR}/${config.namespace}ModelsTargets.cmake"
)
`;

    // Example integration code
    files[`include/api/${config.framework}_integration.hpp`] = generateFrameworkIntegration(config.framework, config.namespace);

    // OpenAPI middleware
    files['include/middleware/openapi_validator.hpp'] = `#pragma once

#include <string>
#include <memory>
#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>

namespace ${config.namespace} {

class OpenApiValidator {
public:
    OpenApiValidator(const std::string& spec_path);
    
    // Validate request against OpenAPI spec
    bool validateRequest(const std::string& path, 
                        const std::string& method,
                        const nlohmann::json& body,
                        const nlohmann::json& params);
    
    // Validate response against OpenAPI spec
    bool validateResponse(const std::string& path,
                         const std::string& method,
                         int status_code,
                         const nlohmann::json& body);
    
    // Get operation metadata
    nlohmann::json getOperationMetadata(const std::string& path,
                                        const std::string& method);
    
private:
    nlohmann::json spec_;
    
    nlohmann::json resolveRef(const std::string& ref);
    bool validateSchema(const nlohmann::json& data, 
                       const nlohmann::json& schema);
};

// Middleware for automatic validation
template<typename Request, typename Response>
class OpenApiMiddleware {
public:
    OpenApiMiddleware(std::shared_ptr<OpenApiValidator> validator)
        : validator_(validator) {}
    
    void operator()(Request& req, Response& res, auto next) {
        try {
            // Extract request data
            std::string path = req.path();
            std::string method = req.method_string();
            nlohmann::json body;
            
            if (req.has_body()) {
                body = nlohmann::json::parse(req.body());
            }
            
            // Validate request
            if (!validator_->validateRequest(path, method, body, {})) {
                res.status(400);
                res.set_content({{"error", "Invalid request"}}, "application/json");
                return;
            }
            
            // Call next middleware
            next();
            
            // Validate response
            if (res.has_body()) {
                auto response_body = nlohmann::json::parse(res.body());
                if (!validator_->validateResponse(path, method, res.status(), response_body)) {
                    spdlog::warn("Response validation failed for {} {}", method, path);
                }
            }
        } catch (const std::exception& e) {
            spdlog::error("OpenAPI validation error: {}", e.what());
            res.status(500);
            res.set_content({{"error", "Internal validation error"}}, "application/json");
        }
    }
    
private:
    std::shared_ptr<OpenApiValidator> validator_;
};

} // namespace ${config.namespace}
`;

    // Swagger UI integration
    files['static/swagger-ui.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${config.namespace} API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: "/api/openapi.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                tryItOutEnabled: true,
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                onComplete: function() {
                    console.log("Swagger UI loaded");
                }
            });
        };
    </script>
</body>
</html>
`;

    // README for OpenAPI integration
    files['api/README.md'] = `# OpenAPI Integration for ${config.namespace}

This directory contains OpenAPI/Swagger integration for the C++ service.

## Features

- OpenAPI 3.0 specification
- Automatic code generation for server stubs and client SDK
- Request/response validation middleware
- Swagger UI for interactive API documentation
- Postman collection generation

## Usage

### Generate Code

\`\`\`bash
# Make script executable
chmod +x scripts/generate-api.sh

# Generate server stubs and client SDK
./scripts/generate-api.sh
\`\`\`

### Integrate Generated Code

1. Include generated CMake configuration:
   \`\`\`cmake
   add_subdirectory(generated)
   target_link_libraries(your_app PRIVATE ${config.namespace}_models)
   \`\`\`

2. Use generated models in your code:
   \`\`\`cpp
   #include "models/User.h"
   #include "api/UsersApi.h"
   \`\`\`

### Enable Validation Middleware

\`\`\`cpp
#include "middleware/openapi_validator.hpp"

// Create validator
auto validator = std::make_shared<OpenApiValidator>("api/openapi.yaml");

// Add middleware to your routes
server.use(OpenApiMiddleware(validator));
\`\`\`

### Serve Swagger UI

Configure your server to serve the static Swagger UI:

\`\`\`cpp
// Serve Swagger UI
server.set_mount_point("/docs", "./static");

// Serve OpenAPI spec
server.Get("/api/openapi.json", [](const Request& req, Response& res) {
    std::ifstream file("api/openapi.yaml");
    // Convert YAML to JSON if needed
    res.set_content(yaml_to_json(file), "application/json");
});
\`\`\`

## Customization

### Modify OpenAPI Spec

Edit \`api/openapi.yaml\` to define your API:
- Add new endpoints
- Define request/response schemas
- Configure authentication
- Add examples and documentation

### Configure Code Generation

Modify \`scripts/generate-api.sh\` to customize:
- Generator options
- Output directories
- Additional generators (GraphQL, gRPC, etc.)

## Best Practices

1. **Version your API**: Use versioning in your paths (e.g., \`/api/v1/\`)
2. **Use semantic versioning**: Update the version in openapi.yaml
3. **Document everything**: Add descriptions to all operations and schemas
4. **Validate strictly**: Enable request validation in production
5. **Generate SDKs**: Provide client libraries for API consumers
`;

    return files;
  }
}

function generateFrameworkIntegration(framework: string, namespace: string): string {
  switch (framework) {
    case 'crow':
      return `#pragma once

#include <crow.h>
#include <nlohmann/json.hpp>
#include "generated/server/model/User.h"
#include "generated/server/api/UsersApi.h"

namespace ${namespace} {

// Integration helpers for Crow framework
class CrowOpenApiIntegration {
public:
    // Convert generated model to Crow response
    template<typename T>
    static crow::response modelToResponse(const T& model, int status = 200) {
        nlohmann::json j = model.to_json();
        auto res = crow::response(status, j.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    }
    
    // Parse request body to generated model
    template<typename T>
    static std::optional<T> parseRequestBody(const crow::request& req) {
        try {
            auto json = nlohmann::json::parse(req.body);
            return T::from_json(json);
        } catch (const std::exception& e) {
            return std::nullopt;
        }
    }
    
    // Register generated API routes
    static void registerRoutes(crow::SimpleApp& app, std::shared_ptr<UsersApi> api) {
        // GET /users
        app.route_dynamic("/api/v1/users")
            .methods(crow::HTTPMethod::Get)
            ([api](const crow::request& req) {
                auto users = api->listUsers(1, 20);
                return modelToResponse(users);
            });
        
        // POST /users
        app.route_dynamic("/api/v1/users")
            .methods(crow::HTTPMethod::Post)
            ([api](const crow::request& req) {
                auto user_opt = parseRequestBody<CreateUserRequest>(req);
                if (!user_opt) {
                    return crow::response(400, "Invalid request body");
                }
                auto user = api->createUser(*user_opt);
                return modelToResponse(user, 201);
            });
        
        // Add more routes as needed...
    }
};

} // namespace ${namespace}
`;

    case 'drogon':
      return `#pragma once

#include <drogon/drogon.h>
#include <nlohmann/json.hpp>
#include "generated/server/model/User.h"
#include "generated/server/api/UsersApi.h"

namespace ${namespace} {

// Integration helpers for Drogon framework
class DrogonOpenApiIntegration {
public:
    // Convert generated model to Drogon response
    template<typename T>
    static drogon::HttpResponsePtr modelToResponse(const T& model, 
                                                   drogon::HttpStatusCode status = drogon::k200OK) {
        auto json = model.to_json();
        auto resp = drogon::HttpResponse::newHttpJsonResponse(json);
        resp->setStatusCode(status);
        return resp;
    }
    
    // Parse request body to generated model
    template<typename T>
    static std::optional<T> parseRequestBody(const drogon::HttpRequestPtr& req) {
        try {
            auto jsonPtr = req->getJsonObject();
            if (!jsonPtr) return std::nullopt;
            return T::from_json(*jsonPtr);
        } catch (const std::exception& e) {
            return std::nullopt;
        }
    }
    
    // Create controller from generated API
    class UsersController : public drogon::HttpController<UsersController> {
    public:
        METHOD_LIST_BEGIN
        ADD_METHOD_TO(UsersController::listUsers, "/api/v1/users", drogon::Get);
        ADD_METHOD_TO(UsersController::createUser, "/api/v1/users", drogon::Post);
        ADD_METHOD_TO(UsersController::getUserById, "/api/v1/users/{id}", drogon::Get);
        METHOD_LIST_END
        
        void listUsers(const drogon::HttpRequestPtr& req,
                      std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
            auto users = api_->listUsers(1, 20);
            callback(modelToResponse(users));
        }
        
        void createUser(const drogon::HttpRequestPtr& req,
                       std::function<void(const drogon::HttpResponsePtr&)>&& callback) {
            auto user_opt = parseRequestBody<CreateUserRequest>(req);
            if (!user_opt) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k400BadRequest);
                callback(resp);
                return;
            }
            auto user = api_->createUser(*user_opt);
            callback(modelToResponse(user, drogon::k201Created));
        }
        
        void getUserById(const drogon::HttpRequestPtr& req,
                        std::function<void(const drogon::HttpResponsePtr&)>&& callback,
                        const std::string& id) {
            try {
                auto user = api_->getUserById(id);
                callback(modelToResponse(user));
            } catch (const std::exception& e) {
                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k404NotFound);
                callback(resp);
            }
        }
        
    private:
        std::shared_ptr<UsersApi> api_;
    };
};

} // namespace ${namespace}
`;

    case 'beast':
      return `#pragma once

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <nlohmann/json.hpp>
#include "generated/server/model/User.h"
#include "generated/server/api/UsersApi.h"

namespace ${namespace} {

namespace beast = boost::beast;
namespace http = beast::http;

// Integration helpers for Beast framework
class BeastOpenApiIntegration {
public:
    // Convert generated model to Beast response
    template<typename T>
    static http::response<http::string_body> modelToResponse(
        const T& model, 
        http::status status = http::status::ok,
        unsigned version = 11) {
        
        nlohmann::json j = model.to_json();
        http::response<http::string_body> res{status, version};
        res.set(http::field::content_type, "application/json");
        res.body() = j.dump();
        res.prepare_payload();
        return res;
    }
    
    // Parse request body to generated model
    template<typename T>
    static std::optional<T> parseRequestBody(const http::request<http::string_body>& req) {
        try {
            auto json = nlohmann::json::parse(req.body());
            return T::from_json(json);
        } catch (const std::exception& e) {
            return std::nullopt;
        }
    }
    
    // Route handler for generated API
    template<class Send>
    static void handleRequest(
        http::request<http::string_body>&& req,
        Send&& send,
        std::shared_ptr<UsersApi> api) {
        
        auto const bad_request = [&req](beast::string_view why) {
            http::response<http::string_body> res{http::status::bad_request, req.version()};
            res.set(http::field::content_type, "application/json");
            res.body() = nlohmann::json{{"error", why}}.dump();
            res.prepare_payload();
            return res;
        };
        
        // Route based on target
        if (req.target() == "/api/v1/users") {
            if (req.method() == http::verb::get) {
                auto users = api->listUsers(1, 20);
                return send(modelToResponse(users, http::status::ok, req.version()));
            }
            else if (req.method() == http::verb::post) {
                auto user_opt = parseRequestBody<CreateUserRequest>(req);
                if (!user_opt) {
                    return send(bad_request("Invalid request body"));
                }
                auto user = api->createUser(*user_opt);
                return send(modelToResponse(user, http::status::created, req.version()));
            }
        }
        
        // Not found
        http::response<http::string_body> res{http::status::not_found, req.version()};
        res.set(http::field::content_type, "application/json");
        res.body() = nlohmann::json{{"error", "Not found"}}.dump();
        res.prepare_payload();
        return send(std::move(res));
    }
};

} // namespace ${namespace}
`;

    default:
      return `#pragma once

// Generic OpenAPI integration for ${framework}
#include <string>
#include <memory>
#include "generated/server/model/User.h"
#include "generated/server/api/UsersApi.h"

namespace ${namespace} {

class OpenApiIntegration {
public:
    // Add framework-specific integration code here
    static void registerRoutes(/* framework router */) {
        // TODO: Implement route registration
    }
};

} // namespace ${namespace}
`;
  }
}

export function generateCppOpenApiFiles(config: CppOpenApiConfig): Record<string, string> {
  return CppOpenApiGenerator.generate(config);
}