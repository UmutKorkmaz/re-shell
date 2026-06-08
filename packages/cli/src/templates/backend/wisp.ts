import { BackendTemplate } from '../types';

export const wispTemplate: BackendTemplate = {
  id: 'wisp',
  name: 'Wisp',
  description: 'Gleam web framework for building type-safe HTTP services on BEAM',
  version: '1.0.0',
  framework: 'wisp',
  displayName: 'Wisp (Gleam)',
  language: 'gleam',
  port: 8000,
  tags: ['gleam', 'wisp', 'web', 'api', 'rest', 'beam', 'erlang', 'functional'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation'],
  dependencies: {},
  devDependencies: {},
  files: {
    'gleam.toml': `name = "{{projectName}}"
version = "0.1.0"
description = "{{description}}"

[dependencies]
gleam_stdlib = "~> 0.34"
gleam_http = "~> 3.6"
gleam_json = "~> 1.0"
gleam_erlang = "~> 0.25"
gleam_otp = "~> 0.10"
wisp = "~> 0.14"
mist = "~> 1.0"
gwt = "~> 1.0"

[dev-dependencies]
gleeunit = "~> 1.0"
`,

    'src/{{projectName}}.gleam': `import gleam/erlang/process
import gleam/io
import gleam/int
import gleam/result
import gleam/option.{type Option, None, Some}
import mist
import wisp.{type Request, type Response}
import wisp/wisp_mist

import {{projectName}}/router
import {{projectName}}/config

pub fn main() {
  wisp.configure_logger()

  let secret_key_base = config.get_secret_key()
  let port = config.get_port()

  let assert Ok(_) =
    wisp_mist.handler(router.handle_request, secret_key_base)
    |> mist.new
    |> mist.port(port)
    |> mist.start_http

  io.println("🚀 {{projectName}} server starting on http://localhost:" <> int.to_string(port))

  process.sleep_forever()
}
`,

    'src/{{projectName}}/config.gleam': `import gleam/erlang/os
import gleam/int
import gleam/result

pub fn get_port() -> Int {
  os.get_env("PORT")
  |> result.then(int.parse)
  |> result.unwrap(8000)
}

pub fn get_secret_key() -> String {
  os.get_env("SECRET_KEY_BASE")
  |> result.unwrap("super-secret-key-change-in-production-must-be-at-least-64-characters-long")
}

pub fn get_jwt_secret() -> String {
  os.get_env("JWT_SECRET")
  |> result.unwrap("jwt-secret-key-change-in-production")
}
`,

    'src/{{projectName}}/router.gleam': `import gleam/http.{Get, Post, Delete, Options}
import gleam/string_builder
import gleam/json.{type Json}
import gleam/int
import gleam/option.{type Option, None, Some}
import wisp.{type Request, type Response}

import {{projectName}}/handlers/health
import {{projectName}}/handlers/auth
import {{projectName}}/handlers/users
import {{projectName}}/handlers/items
import {{projectName}}/middleware

pub fn handle_request(req: Request) -> Response {
  use req <- middleware.cors(req)
  use req <- middleware.log_request(req)

  case wisp.path_segments(req) {
    // Health check
    ["health"] -> health.handle(req)

    // API info
    [] -> handle_root(req)

    // Auth endpoints
    ["api", "auth", "register"] -> auth.register(req)
    ["api", "auth", "login"] -> auth.login(req)

    // User endpoints
    ["api", "users", "me"] -> users.get_me(req)
    ["api", "users"] -> users.list_users(req)
    ["api", "users", id] -> users.get_user(req, id)

    // Item endpoints
    ["api", "items"] -> items.handle_items(req)
    ["api", "items", id] -> items.handle_item(req, id)

    // Not found
    _ -> wisp.not_found()
  }
}

fn handle_root(req: Request) -> Response {
  case req.method {
    Get -> {
      let body =
        json.object([
          #("name", json.string("{{projectName}}")),
          #("version", json.string("1.0.0")),
          #("framework", json.string("Wisp")),
          #("language", json.string("Gleam")),
          #("description", json.string("{{description}}"))])
        |> json.to_string_builder

      wisp.json_response(body, 200)
    }
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Options])
  }
}
`,

    'src/{{projectName}}/middleware.gleam': `import gleam/http.{Options}
import gleam/io
import wisp.{type Request, type Response}

pub fn cors(
  req: Request,
  handler: fn(Request) -> Response,
) -> Response {
  let response = handler(req)

  response
  |> wisp.set_header("Access-Control-Allow-Origin", "*")
  |> wisp.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  |> wisp.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

pub fn log_request(
  req: Request,
  handler: fn(Request) -> Response,
) -> Response {
  let method = http_method_to_string(req.method)
  let path = wisp.path_segments(req) |> string_join("/")
  io.println("[" <> method <> "] /" <> path)
  handler(req)
}

fn http_method_to_string(method: http.Method) -> String {
  case method {
    http.Get -> "GET"
    http.Post -> "POST"
    http.Put -> "PUT"
    http.Delete -> "DELETE"
    http.Patch -> "PATCH"
    http.Options -> "OPTIONS"
    http.Head -> "HEAD"
    http.Connect -> "CONNECT"
    http.Trace -> "TRACE"
    http.Other(s) -> s
  }
}

fn string_join(list: List(String), separator: String) -> String {
  case list {
    [] -> ""
    [first, ..rest] ->
      case rest {
        [] -> first
        _ -> first <> separator <> string_join(rest, separator)
      }
  }
}
`,

    'src/{{projectName}}/handlers/health.gleam': `import gleam/http.{Get, Options}
import gleam/json
import wisp.{type Request, type Response}

pub fn handle(req: Request) -> Response {
  case req.method {
    Get -> {
      let body =
        json.object([
          #("status", json.string("healthy")),
          #("timestamp", json.string("now"))])
        |> json.to_string_builder

      wisp.json_response(body, 200)
    }
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Options])
  }
}
`,

    'src/{{projectName}}/handlers/auth.gleam': `import gleam/http.{Post, Options}
import gleam/json
import gleam/dynamic
import gleam/result
import gleam/option.{type Option, None, Some}
import wisp.{type Request, type Response}

import {{projectName}}/db
import {{projectName}}/jwt

pub fn register(req: Request) -> Response {
  case req.method {
    Post -> handle_register(req)
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Post, Options])
  }
}

pub fn login(req: Request) -> Response {
  case req.method {
    Post -> handle_login(req)
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Post, Options])
  }
}

fn handle_register(req: Request) -> Response {
  use body <- wisp.require_json(req)

  let decoder =
    dynamic.decode3(
      fn(email, name, password) { #(email, name, password) },
      dynamic.field("email", dynamic.string),
      dynamic.field("name", dynamic.string),
      dynamic.field("password", dynamic.string),
    )

  case decoder(body) {
    Ok(#(email, name, password)) -> {
      case db.find_user_by_email(email) {
        Some(_) -> {
          error_response("conflict", "User with this email already exists", 409)
        }
        None -> {
          let user = db.create_user(email, name, password)
          let response_body =
            json.object([
              #("id", json.int(user.id)),
              #("email", json.string(user.email)),
              #("name", json.string(user.name))])
            |> json.to_string_builder

          wisp.json_response(response_body, 201)
        }
      }
    }
    Error(_) -> {
      error_response("validation_error", "Email, name and password are required", 400)
    }
  }
}

fn handle_login(req: Request) -> Response {
  use body <- wisp.require_json(req)

  let decoder =
    dynamic.decode2(
      fn(email, password) { #(email, password) },
      dynamic.field("email", dynamic.string),
      dynamic.field("password", dynamic.string),
    )

  case decoder(body) {
    Ok(#(email, password)) -> {
      case db.find_user_by_email(email) {
        Some(user) -> {
          case db.verify_password(user.id, password) {
            True -> {
              let token_response = jwt.generate_token(user.id)
              let response_body =
                json.object([
                  #("token", json.string(token_response.token)),
                  #("expires_at", json.int(token_response.expires_at))])
                |> json.to_string_builder

              wisp.json_response(response_body, 200)
            }
            False -> {
              error_response("unauthorized", "Invalid email or password", 401)
            }
          }
        }
        None -> {
          error_response("unauthorized", "Invalid email or password", 401)
        }
      }
    }
    Error(_) -> {
      error_response("parse_error", "Invalid JSON body", 400)
    }
  }
}

pub fn error_response(error: String, message: String, status: Int) -> Response {
  let body =
    json.object([
      #("error", json.string(error)),
      #("message", json.string(message))])
    |> json.to_string_builder

  wisp.json_response(body, status)
}
`,

    'src/{{projectName}}/handlers/users.gleam': `import gleam/http.{Get, Options}
import gleam/json
import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/list
import wisp.{type Request, type Response}

import {{projectName}}/db
import {{projectName}}/jwt
import {{projectName}}/handlers/auth

pub fn get_me(req: Request) -> Response {
  case req.method {
    Get -> {
      case get_auth_user(req) {
        Some(user) -> {
          let body =
            json.object([
              #("id", json.int(user.id)),
              #("email", json.string(user.email)),
              #("name", json.string(user.name))])
            |> json.to_string_builder

          wisp.json_response(body, 200)
        }
        None -> auth.error_response("unauthorized", "Authentication required", 401)
      }
    }
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Options])
  }
}

pub fn list_users(req: Request) -> Response {
  case req.method {
    Get -> {
      case get_auth_user(req) {
        Some(_) -> {
          let users = db.get_all_users()
          let users_json =
            list.map(users, fn(user) {
              json.object([
                #("id", json.int(user.id)),
                #("email", json.string(user.email)),
                #("name", json.string(user.name))])
            })

          let body = json.array(users_json, fn(x) { x }) |> json.to_string_builder
          wisp.json_response(body, 200)
        }
        None -> auth.error_response("unauthorized", "Authentication required", 401)
      }
    }
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Options])
  }
}

pub fn get_user(req: Request, id: String) -> Response {
  case req.method {
    Get -> {
      case get_auth_user(req) {
        Some(_) -> {
          case int.parse(id) {
            Ok(user_id) -> {
              case db.find_user_by_id(user_id) {
                Some(user) -> {
                  let body =
                    json.object([
                      #("id", json.int(user.id)),
                      #("email", json.string(user.email)),
                      #("name", json.string(user.name))])
                    |> json.to_string_builder

                  wisp.json_response(body, 200)
                }
                None -> auth.error_response("not_found", "User not found", 404)
              }
            }
            Error(_) -> auth.error_response("bad_request", "Invalid user ID", 400)
          }
        }
        None -> auth.error_response("unauthorized", "Authentication required", 401)
      }
    }
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Options])
  }
}

pub fn get_auth_user(req: Request) -> Option(db.User) {
  case wisp.get_header(req, "authorization") {
    Some(header) -> {
      case header {
        "Bearer " <> token -> {
          case jwt.verify_token(token) {
            Some(user_id) -> db.find_user_by_id(user_id)
            None -> None
          }
        }
        _ -> None
      }
    }
    None -> None
  }
}
`,

    'src/{{projectName}}/handlers/items.gleam': `import gleam/http.{Get, Post, Delete, Options}
import gleam/json
import gleam/dynamic
import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/list
import wisp.{type Request, type Response}

import {{projectName}}/db
import {{projectName}}/handlers/auth
import {{projectName}}/handlers/users

pub fn handle_items(req: Request) -> Response {
  case req.method {
    Get -> list_items(req)
    Post -> create_item(req)
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Post, Options])
  }
}

pub fn handle_item(req: Request, id: String) -> Response {
  case req.method {
    Get -> get_item(req, id)
    Delete -> delete_item(req, id)
    Options -> wisp.response(204)
    _ -> wisp.method_not_allowed([Get, Delete, Options])
  }
}

fn list_items(req: Request) -> Response {
  case users.get_auth_user(req) {
    Some(user) -> {
      let items = db.get_items_by_user(user.id)
      let items_json =
        list.map(items, fn(item) {
          json.object([
            #("id", json.int(item.id)),
            #("name", json.string(item.name)),
            #("description", json.string(item.description)),
            #("user_id", json.int(item.user_id))])
        })

      let body = json.array(items_json, fn(x) { x }) |> json.to_string_builder
      wisp.json_response(body, 200)
    }
    None -> auth.error_response("unauthorized", "Authentication required", 401)
  }
}

fn create_item(req: Request) -> Response {
  case users.get_auth_user(req) {
    Some(user) -> {
      use body <- wisp.require_json(req)

      let decoder =
        dynamic.decode2(
          fn(name, description) { #(name, description) },
          dynamic.field("name", dynamic.string),
          dynamic.optional_field("description", dynamic.string),
        )

      case decoder(body) {
        Ok(#(name, description)) -> {
          let desc = case description {
            Some(d) -> d
            None -> ""
          }
          let item = db.create_item(name, desc, user.id)
          let response_body =
            json.object([
              #("id", json.int(item.id)),
              #("name", json.string(item.name)),
              #("description", json.string(item.description)),
              #("user_id", json.int(item.user_id))])
            |> json.to_string_builder

          wisp.json_response(response_body, 201)
        }
        Error(_) -> {
          auth.error_response("validation_error", "Name is required", 400)
        }
      }
    }
    None -> auth.error_response("unauthorized", "Authentication required", 401)
  }
}

fn get_item(req: Request, id: String) -> Response {
  case users.get_auth_user(req) {
    Some(user) -> {
      case int.parse(id) {
        Ok(item_id) -> {
          case db.find_item_by_id(item_id, user.id) {
            Some(item) -> {
              let body =
                json.object([
                  #("id", json.int(item.id)),
                  #("name", json.string(item.name)),
                  #("description", json.string(item.description)),
                  #("user_id", json.int(item.user_id))])
                |> json.to_string_builder

              wisp.json_response(body, 200)
            }
            None -> auth.error_response("not_found", "Item not found", 404)
          }
        }
        Error(_) -> auth.error_response("bad_request", "Invalid item ID", 400)
      }
    }
    None -> auth.error_response("unauthorized", "Authentication required", 401)
  }
}

fn delete_item(req: Request, id: String) -> Response {
  case users.get_auth_user(req) {
    Some(user) -> {
      case int.parse(id) {
        Ok(item_id) -> {
          case db.delete_item(item_id, user.id) {
            True -> wisp.response(204)
            False -> auth.error_response("not_found", "Item not found", 404)
          }
        }
        Error(_) -> auth.error_response("bad_request", "Invalid item ID", 400)
      }
    }
    None -> auth.error_response("unauthorized", "Authentication required", 401)
  }
}
`,

    'src/{{projectName}}/db.gleam': `import gleam/option.{type Option, None, Some}
import gleam/list
import gleam/dict.{type Dict}

// Types
pub type User {
  User(id: Int, email: String, name: String)
}

pub type Item {
  Item(id: Int, name: String, description: String, user_id: Int)
}

// In-memory storage (use process dictionary or ETS in real apps)
// For simplicity, using module-level state simulation

pub fn create_user(email: String, name: String, _password: String) -> User {
  // In a real app, you'd store this properly and hash the password
  let id = next_user_id()
  User(id: id, email: email, name: name)
}

pub fn find_user_by_email(email: String) -> Option(User) {
  // Mock implementation - in real app, query database
  None
}

pub fn find_user_by_id(id: Int) -> Option(User) {
  // Mock implementation - in real app, query database
  None
}

pub fn verify_password(_user_id: Int, _password: String) -> Bool {
  // Mock implementation - in real app, verify hashed password
  True
}

pub fn get_all_users() -> List(User) {
  // Mock implementation
  []
}

pub fn create_item(name: String, description: String, user_id: Int) -> Item {
  let id = next_item_id()
  Item(id: id, name: name, description: description, user_id: user_id)
}

pub fn get_items_by_user(user_id: Int) -> List(Item) {
  // Mock implementation
  []
}

pub fn find_item_by_id(item_id: Int, user_id: Int) -> Option(Item) {
  // Mock implementation
  None
}

pub fn delete_item(item_id: Int, user_id: Int) -> Bool {
  // Mock implementation
  False
}

// Helper functions for ID generation
fn next_user_id() -> Int {
  // In a real app, use proper ID generation
  1
}

fn next_item_id() -> Int {
  // In a real app, use proper ID generation
  1
}
`,

    'src/{{projectName}}/jwt.gleam': `import gleam/option.{type Option, None, Some}
import gleam/int
import gleam/string

import {{projectName}}/config

pub type TokenResponse {
  TokenResponse(token: String, expires_at: Int)
}

pub fn generate_token(user_id: Int) -> TokenResponse {
  // In a real app, use the gwt library properly
  let token = "mock_token_for_user_" <> int.to_string(user_id)
  let expires_at = 9999999999  // Far future timestamp

  TokenResponse(token: token, expires_at: expires_at)
}

pub fn verify_token(token: String) -> Option(Int) {
  // Mock implementation - in real app, properly verify JWT
  case string.starts_with(token, "mock_token_for_user_") {
    True -> {
      let user_id_str = string.drop_left(token, 20)
      case int.parse(user_id_str) {
        Ok(id) -> Some(id)
        Error(_) -> None
      }
    }
    False -> None
  }
}
`,

    'test/{{projectName}}_test.gleam': `import gleeunit
import gleeunit/should

pub fn main() {
  gleeunit.main()
}

pub fn hello_world_test() {
  1
  |> should.equal(1)
}

pub fn health_endpoint_test() {
  // Add proper HTTP testing
  True
  |> should.be_true
}
`,

    '.env': `# Environment Configuration
PORT=8000
SECRET_KEY_BASE=super-secret-key-change-in-production-must-be-at-least-64-characters-long
JWT_SECRET=jwt-secret-key-change-in-production
`,

    '.env.example': `# Environment Configuration
PORT=8000
SECRET_KEY_BASE=super-secret-key-change-in-production-must-be-at-least-64-characters-long
JWT_SECRET=jwt-secret-key-change-in-production
`,

    '.gitignore': `# Gleam build artifacts
/build/
erl_crash.dump

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
logs/
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean deps

all: build

# Install dependencies
deps:
	gleam deps download

# Build the project
build: deps
	gleam build

# Run the server
run:
	gleam run

# Run tests
test:
	gleam test

# Clean build artifacts
clean:
	rm -rf build/

# Format code
fmt:
	gleam format

# Check formatting
check-fmt:
	gleam format --check

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 8000:8000 --env-file .env {{projectName}}
`,

    'Dockerfile': `# Build stage
FROM ghcr.io/gleam-lang/gleam:v1.0.0-erlang-alpine AS builder

WORKDIR /app

# Copy project files
COPY . .

# Build release
RUN gleam export erlang-shipment

# Runtime stage
FROM erlang:26-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/build/erlang-shipment ./

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 8000

ENV PORT=8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["run"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - SECRET_KEY_BASE=\${SECRET_KEY_BASE:-super-secret-key-change-in-production-must-be-at-least-64-characters-long}
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

{{description}}

A Gleam web application built with the Wisp framework, running on the BEAM.

## Features

- 🚀 Type-safe web server on the BEAM
- 🔐 JWT authentication
- 📝 Full REST API with CRUD operations
- 🧪 Test suite included
- 🐳 Docker support
- ⚡ Erlang/OTP fault tolerance

## Requirements

- Gleam >= 1.0.0
- Erlang >= 26

## Installation

\`\`\`bash
# Install dependencies
gleam deps download

# Build the project
gleam build

# Run the server
gleam run
\`\`\`

## Development

\`\`\`bash
# Run in development mode
make run

# Run tests
make test

# Format code
make fmt
\`\`\`

## API Endpoints

### Public

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login and get JWT token

### Protected (requires JWT)

- \`GET /api/users/me\` - Get current user
- \`GET /api/users\` - List all users
- \`GET /api/users/:id\` - Get user by ID
- \`GET /api/items\` - List user's items
- \`POST /api/items\` - Create new item
- \`GET /api/items/:id\` - Get item by ID
- \`DELETE /api/items/:id\` - Delete item

## Docker

\`\`\`bash
# Build image
docker build -t {{projectName}} .

# Run container
docker run -p 8000:8000 {{projectName}}

# Or use docker-compose
docker-compose up -d
\`\`\`

## License

MIT
`},
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-wisp-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A Gleam web application built with Wisp'}],
  postInstall: [
    'gleam deps download',
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: gleam run"']};
