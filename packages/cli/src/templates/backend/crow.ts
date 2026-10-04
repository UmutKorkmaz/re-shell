import { BackendTemplate } from '../types';

export const crowTemplate: BackendTemplate = {
  id: 'crow',
  name: 'crow',
  displayName: 'Crow C++ Framework',
  description: 'C++17 HTTP API on the Crow microframework (v1.2.0) with JWT auth, products CRUD, GraphQL and WebSocket echo',
  framework: 'crow',
  language: 'cpp',
  version: '1.0.0',
  tags: ['cpp', 'crow', 'api', 'rest', 'microframework', 'header-only'],
  port: 8080,
  features: ['routing', 'validation', 'authentication', 'websockets', 'testing', 'docker', 'cors', 'graphql'],
  dependencies: {
    Crow: 'https://github.com/CrowCpp/Crow.git#v1.2.0'
  },
  devDependencies: {},

  files: {
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.24)
project({{serviceName}} VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
  add_compile_options(/W4)
else()
  add_compile_options(-Wall -Wextra)
endif()

find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)

include(FetchContent)

# Crow: header-only HTTP framework, fetched from its release tag. It needs the
# standalone Asio headers installed on the system (apt install libasio-dev,
# brew install asio) or Boost (see https://crowcpp.org/master/getting_started/setup/).
set(CROW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CROW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(CROW_INSTALL OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  Crow
  GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
  GIT_TAG v1.2.0
  GIT_SHALLOW TRUE
)

# nlohmann/json and GoogleTest: use the system packages when present, otherwise fetch them.
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
  GIT_SHALLOW TRUE
  FIND_PACKAGE_ARGS NAMES nlohmann_json
)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.14.0
  GIT_SHALLOW TRUE
  FIND_PACKAGE_ARGS NAMES GTest
)
FetchContent_MakeAvailable(Crow nlohmann_json googletest)

# Everything except the HTTP layer, shared by the server and the tests.
add_library(app_core STATIC
  src/auth.cpp
  src/store.cpp
)
target_include_directories(app_core PUBLIC \${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(app_core PUBLIC nlohmann_json::nlohmann_json OpenSSL::Crypto)

add_executable(\${PROJECT_NAME}
  src/main.cpp
  src/routes.cpp
)
target_link_libraries(\${PROJECT_NAME} PRIVATE app_core Crow::Crow Threads::Threads)

enable_testing()
add_executable(unit_tests
  tests/test_auth.cpp
  tests/test_store.cpp
)
target_link_libraries(unit_tests PRIVATE app_core GTest::gtest_main)
add_test(NAME unit_tests COMMAND unit_tests)

install(TARGETS \${PROJECT_NAME} DESTINATION bin)
`,

    'src/main.cpp': `#include <crow.h>

#include <cstdint>
#include <cstdlib>
#include <string>

#include "auth.hpp"
#include "routes.hpp"
#include "store.hpp"

int main() {
  const char* secretEnv = std::getenv("JWT_SECRET");
  const std::string jwtSecret = secretEnv != nullptr ? secretEnv : "change-me-in-production";
  if (secretEnv == nullptr) {
    CROW_LOG_WARNING << "JWT_SECRET is not set; using the insecure development secret";
  }

  const char* portEnv = std::getenv("PORT");
  const int port = portEnv != nullptr ? std::atoi(portEnv) : {{PORT}};

  Store store;
  // Seed data for local development: change or remove before deploying.
  store.addUser("admin@example.com", "Admin User", auth::hashPassword("admin123"), true);
  store.addProduct("Sample Product 1", "This is a sample product", 29.99, 100);
  store.addProduct("Sample Product 2", "Another sample product", 49.99, 50);

  App app;
  app.get_middleware<crow::CORSHandler>()
      .global()
      .headers("Content-Type", "Authorization")
      .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Post, crow::HTTPMethod::Put,
               crow::HTTPMethod::Delete)
      .origin("*");

  registerRoutes(app, store, jwtSecret);

  CROW_LOG_INFO << "{{serviceName}} listening on port " << port;
  app.port(static_cast<std::uint16_t>(port)).multithreaded().run();
  return 0;
}
`,

    'src/routes.cpp': `#include "routes.hpp"

#include <ctime>
#include <nlohmann/json.hpp>
#include <optional>

#include "auth.hpp"

namespace {

using json = nlohmann::json;

crow::response jsonResponse(int status, const json& body) {
  crow::response res(status, body.dump());
  res.set_header("Content-Type", "application/json");
  return res;
}

crow::response errorResponse(int status, const std::string& message) {
  return jsonResponse(status, {{"error", message}});
}

json toJson(const Product& product) {
  return {{"id", product.id},
          {"name", product.name},
          {"description", product.description},
          {"price", product.price},
          {"stock", product.stock}};
}

json toJson(const User& user) {
  return {{"id", user.id},
          {"email", user.email},
          {"name", user.name},
          {"role", user.admin ? "admin" : "user"}};
}

crow::response sessionResponse(int status, const User& user, const std::string& secret) {
  const std::string token = auth::issueToken(user.id, user.admin, secret, std::time(nullptr));
  return jsonResponse(status, {{"token", token}, {"user", toJson(user)}});
}

// Parses a JSON object body; returns nothing for malformed input.
std::optional<json> parseObject(const std::string& body) {
  json parsed = json::parse(body, nullptr, false);
  if (parsed.is_discarded() || !parsed.is_object()) return std::nullopt;
  return parsed;
}

// The caller's claims from the Authorization header, if the token is valid.
std::optional<auth::Claims> authenticate(const crow::request& req, const std::string& secret) {
  auto token = auth::bearerToken(req.get_header_value("Authorization"));
  if (!token) return std::nullopt;
  return auth::verifyToken(*token, secret, std::time(nullptr));
}

// Minimal GraphQL: { hello health products { ... } } queries only.
crow::response graphql(const crow::request& req, const Store& store) {
  auto body = parseObject(req.body);
  if (!body || !body->contains("query") || !(*body)["query"].is_string()) {
    return jsonResponse(400, {{"errors", json::array({{{"message", "body must be JSON with a query string"}}})}});
  }
  const std::string query = (*body)["query"].get<std::string>();
  const bool wantsHello = query.find("hello") != std::string::npos;
  const bool wantsHealth = query.find("health") != std::string::npos;
  const bool wantsProducts = query.find("products") != std::string::npos;
  if (!wantsHello && !wantsHealth && !wantsProducts) {
    return jsonResponse(
        200, {{"errors", json::array({{{"message", "unknown field: use hello, health or products"}}})}});
  }

  json data = json::object();
  if (wantsHello) data["hello"] = "Hello from Crow GraphQL!";
  if (wantsHealth) data["health"] = "healthy";
  if (wantsProducts) {
    data["products"] = json::array();
    for (const auto& product : store.listProducts()) data["products"].push_back(toJson(product));
  }
  return jsonResponse(200, {{"data", data}});
}

}  // namespace

void registerRoutes(App& app, Store& store, const std::string& jwtSecret) {
  CROW_ROUTE(app, "/")
  ([]() {
    crow::response res(200,
                       "<!DOCTYPE html><html><head><title>{{serviceName}}</title></head><body>"
                       "<h1>{{serviceName}}</h1><p>HTTP API built with Crow.</p>"
                       "<p>Try <a href=\\"/api/v1/health\\">/api/v1/health</a>.</p></body></html>");
    res.set_header("Content-Type", "text/html; charset=utf-8");
    return res;
  });

  CROW_ROUTE(app, "/api/v1/health")
  ([]() {
    return jsonResponse(200, {{"status", "healthy"},
                              {"timestamp", static_cast<long long>(std::time(nullptr))},
                              {"version", "1.0.0"}});
  });

  CROW_ROUTE(app, "/api/v1/auth/register")
      .methods(crow::HTTPMethod::Post)([&store, &jwtSecret](const crow::request& req) {
        auto body = parseObject(req.body);
        if (!body || !body->contains("email") || !(*body)["email"].is_string() ||
            !body->contains("password") || !(*body)["password"].is_string()) {
          return errorResponse(400, "expected JSON with email, password and optional name");
        }
        const std::string email = (*body)["email"].get<std::string>();
        const std::string password = (*body)["password"].get<std::string>();
        const std::string name = body->value("name", std::string("New User"));
        if (email.find('@') == std::string::npos || password.size() < 8) {
          return errorResponse(400, "a valid email and a password of at least 8 characters are required");
        }
        if (store.findUserByEmail(email)) return errorResponse(409, "email already registered");

        User user = store.addUser(email, name, auth::hashPassword(password), false);
        return sessionResponse(201, user, jwtSecret);
      });

  CROW_ROUTE(app, "/api/v1/auth/login")
      .methods(crow::HTTPMethod::Post)([&store, &jwtSecret](const crow::request& req) {
        auto body = parseObject(req.body);
        if (!body || !body->contains("email") || !(*body)["email"].is_string() ||
            !body->contains("password") || !(*body)["password"].is_string()) {
          return errorResponse(400, "expected JSON with email and password");
        }
        auto user = store.findUserByEmail((*body)["email"].get<std::string>());
        if (!user || !auth::verifyPassword(user->passwordHash, (*body)["password"].get<std::string>())) {
          return errorResponse(401, "invalid credentials");
        }
        return sessionResponse(200, *user, jwtSecret);
      });

  CROW_ROUTE(app, "/api/v1/products")
      .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Post)(
          [&store, &jwtSecret](const crow::request& req) {
            if (req.method == crow::HTTPMethod::Get) {
              json products = json::array();
              for (const auto& product : store.listProducts()) products.push_back(toJson(product));
              return jsonResponse(200, {{"products", products}, {"count", products.size()}});
            }

            if (!authenticate(req, jwtSecret)) return errorResponse(401, "a valid bearer token is required");
            auto body = parseObject(req.body);
            if (!body || !body->contains("name") || !(*body)["name"].is_string() ||
                !body->contains("price") || !(*body)["price"].is_number()) {
              return errorResponse(400, "expected JSON with name, price and optional description, stock");
            }
            const std::string name = (*body)["name"].get<std::string>();
            const double price = (*body)["price"].get<double>();
            if (name.empty() || price < 0) return errorResponse(400, "name is required and price must not be negative");

            Product product = store.addProduct(name, body->value("description", std::string()), price,
                                               body->value("stock", 0));
            return jsonResponse(201, {{"product", toJson(product)}});
          });

  CROW_ROUTE(app, "/api/v1/products/<int>")
      .methods(crow::HTTPMethod::Get, crow::HTTPMethod::Put, crow::HTTPMethod::Delete)(
          [&store, &jwtSecret](const crow::request& req, int id) {
            if (req.method == crow::HTTPMethod::Get) {
              auto product = store.getProduct(id);
              if (!product) return errorResponse(404, "product not found");
              return jsonResponse(200, {{"product", toJson(*product)}});
            }

            auto claims = authenticate(req, jwtSecret);
            if (!claims) return errorResponse(401, "a valid bearer token is required");

            if (req.method == crow::HTTPMethod::Delete) {
              if (!claims->admin) return errorResponse(403, "admin role required");
              if (!store.deleteProduct(id)) return errorResponse(404, "product not found");
              return crow::response(204);
            }

            auto body = parseObject(req.body);
            if (!body) return errorResponse(400, "expected a JSON object with the fields to change");
            ProductPatch patch;
            if (body->contains("name") && (*body)["name"].is_string()) patch.name = (*body)["name"].get<std::string>();
            if (body->contains("description") && (*body)["description"].is_string()) {
              patch.description = (*body)["description"].get<std::string>();
            }
            if (body->contains("price") && (*body)["price"].is_number()) patch.price = (*body)["price"].get<double>();
            if (body->contains("stock") && (*body)["stock"].is_number_integer()) patch.stock = (*body)["stock"].get<int>();
            if (patch.price && *patch.price < 0) return errorResponse(400, "price must not be negative");

            auto product = store.updateProduct(id, patch);
            if (!product) return errorResponse(404, "product not found");
            return jsonResponse(200, {{"product", toJson(*product)}});
          });

  CROW_ROUTE(app, "/graphql")
      .methods(crow::HTTPMethod::Post)([&store](const crow::request& req) { return graphql(req, store); });

  // WebSocket echo
  CROW_WEBSOCKET_ROUTE(app, "/ws")
      .onopen([](crow::websocket::connection&) { CROW_LOG_INFO << "WebSocket connection opened"; })
      .onmessage([](crow::websocket::connection& conn, const std::string& data, bool isBinary) {
        if (isBinary) {
          conn.send_binary(data);
        } else {
          conn.send_text(data);
        }
      });
}
`,

    'src/auth.cpp': `#include "auth.hpp"

#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>

#include <nlohmann/json.hpp>
#include <stdexcept>
#include <vector>

namespace auth {
namespace {

constexpr int kPbkdf2Iterations = 100000;
constexpr size_t kSaltBytes = 16;
constexpr size_t kHashBytes = 32;

std::string toHex(const unsigned char* data, size_t length) {
  static const char digits[] = "0123456789abcdef";
  std::string out;
  out.reserve(length * 2);
  for (size_t i = 0; i < length; ++i) {
    out.push_back(digits[data[i] >> 4]);
    out.push_back(digits[data[i] & 0x0f]);
  }
  return out;
}

bool fromHex(const std::string& hex, std::vector<unsigned char>& out) {
  if (hex.size() % 2 != 0) return false;
  out.clear();
  auto nibble = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
  };
  for (size_t i = 0; i < hex.size(); i += 2) {
    int high = nibble(hex[i]);
    int low = nibble(hex[i + 1]);
    if (high < 0 || low < 0) return false;
    out.push_back(static_cast<unsigned char>(high * 16 + low));
  }
  return true;
}

std::string base64UrlEncode(const unsigned char* data, size_t length) {
  static const char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string out;
  size_t i = 0;
  for (; i + 2 < length; i += 3) {
    unsigned int block = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    out.push_back(alphabet[(block >> 18) & 63]);
    out.push_back(alphabet[(block >> 12) & 63]);
    out.push_back(alphabet[(block >> 6) & 63]);
    out.push_back(alphabet[block & 63]);
  }
  if (i + 1 == length) {
    unsigned int block = data[i] << 16;
    out.push_back(alphabet[(block >> 18) & 63]);
    out.push_back(alphabet[(block >> 12) & 63]);
  } else if (i + 2 == length) {
    unsigned int block = (data[i] << 16) | (data[i + 1] << 8);
    out.push_back(alphabet[(block >> 18) & 63]);
    out.push_back(alphabet[(block >> 12) & 63]);
    out.push_back(alphabet[(block >> 6) & 63]);
  }
  return out;
}

std::string base64UrlEncode(const std::string& text) {
  return base64UrlEncode(reinterpret_cast<const unsigned char*>(text.data()), text.size());
}

std::optional<std::string> base64UrlDecode(const std::string& text) {
  auto value = [](char c) -> int {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '-') return 62;
    if (c == '_') return 63;
    return -1;
  };
  if (text.size() % 4 == 1) return std::nullopt;
  std::string out;
  unsigned int buffer = 0;
  int bits = 0;
  for (char c : text) {
    int v = value(c);
    if (v < 0) return std::nullopt;
    buffer = (buffer << 6) | static_cast<unsigned int>(v);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push_back(static_cast<char>((buffer >> bits) & 0xff));
    }
  }
  return out;
}

std::string sign(const std::string& message, const std::string& secret) {
  unsigned char mac[EVP_MAX_MD_SIZE];
  unsigned int macLength = 0;
  HMAC(EVP_sha256(), secret.data(), static_cast<int>(secret.size()),
       reinterpret_cast<const unsigned char*>(message.data()), message.size(), mac, &macLength);
  return base64UrlEncode(mac, macLength);
}

bool constantTimeEquals(const std::string& a, const std::string& b) {
  return a.size() == b.size() && CRYPTO_memcmp(a.data(), b.data(), a.size()) == 0;
}

}  // namespace

std::string hashPassword(const std::string& password) {
  unsigned char salt[kSaltBytes];
  if (RAND_bytes(salt, static_cast<int>(kSaltBytes)) != 1) {
    throw std::runtime_error("could not generate a password salt");
  }
  unsigned char hash[kHashBytes];
  if (PKCS5_PBKDF2_HMAC(password.data(), static_cast<int>(password.size()), salt,
                        static_cast<int>(kSaltBytes), kPbkdf2Iterations, EVP_sha256(),
                        static_cast<int>(kHashBytes), hash) != 1) {
    throw std::runtime_error("password hashing failed");
  }
  return "pbkdf2$" + std::to_string(kPbkdf2Iterations) + "$" + toHex(salt, kSaltBytes) + "$" +
         toHex(hash, kHashBytes);
}

bool verifyPassword(const std::string& stored, const std::string& password) {
  // pbkdf2$<iterations>$<salt>$<hash>
  size_t first = stored.find('$');
  size_t second = first == std::string::npos ? first : stored.find('$', first + 1);
  size_t third = second == std::string::npos ? second : stored.find('$', second + 1);
  if (third == std::string::npos || stored.compare(0, first, "pbkdf2") != 0) return false;

  int iterations = 0;
  try {
    iterations = std::stoi(stored.substr(first + 1, second - first - 1));
  } catch (const std::exception&) {
    return false;
  }
  std::vector<unsigned char> salt;
  std::vector<unsigned char> expected;
  if (iterations <= 0 || !fromHex(stored.substr(second + 1, third - second - 1), salt) ||
      !fromHex(stored.substr(third + 1), expected) || expected.empty()) {
    return false;
  }

  std::vector<unsigned char> actual(expected.size());
  if (PKCS5_PBKDF2_HMAC(password.data(), static_cast<int>(password.size()), salt.data(),
                        static_cast<int>(salt.size()), iterations, EVP_sha256(),
                        static_cast<int>(actual.size()), actual.data()) != 1) {
    return false;
  }
  return CRYPTO_memcmp(actual.data(), expected.data(), expected.size()) == 0;
}

std::string issueToken(int userId, bool admin, const std::string& secret, std::time_t now) {
  nlohmann::json payload = {
      {"sub", userId},
      {"admin", admin},
      {"exp", static_cast<long long>(now) + kTokenTtlSeconds},
  };
  std::string signingInput =
      base64UrlEncode(R"({"alg":"HS256","typ":"JWT"})") + "." + base64UrlEncode(payload.dump());
  return signingInput + "." + sign(signingInput, secret);
}

std::optional<Claims> verifyToken(const std::string& token, const std::string& secret,
                                  std::time_t now) {
  size_t lastDot = token.rfind('.');
  size_t firstDot = token.find('.');
  if (lastDot == std::string::npos || firstDot == lastDot) return std::nullopt;

  std::string signingInput = token.substr(0, lastDot);
  if (!constantTimeEquals(token.substr(lastDot + 1), sign(signingInput, secret))) {
    return std::nullopt;
  }

  auto decoded = base64UrlDecode(token.substr(firstDot + 1, lastDot - firstDot - 1));
  if (!decoded) return std::nullopt;
  nlohmann::json payload = nlohmann::json::parse(*decoded, nullptr, false);
  if (payload.is_discarded() || !payload.is_object() || !payload.contains("sub") ||
      !payload["sub"].is_number_integer() || !payload.contains("exp") ||
      !payload["exp"].is_number_integer()) {
    return std::nullopt;
  }
  if (payload["exp"].get<long long>() <= static_cast<long long>(now)) return std::nullopt;

  return Claims{payload["sub"].get<int>(), payload.value("admin", false)};
}

std::optional<std::string> bearerToken(const std::string& header) {
  const std::string prefix = "Bearer ";
  if (header.compare(0, prefix.size(), prefix) != 0 || header.size() == prefix.size()) {
    return std::nullopt;
  }
  return header.substr(prefix.size());
}

}  // namespace auth
`,

    'src/store.cpp': `#include "store.hpp"

#include <algorithm>
#include <cctype>

namespace {

std::string lower(std::string text) {
  std::transform(text.begin(), text.end(), text.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return text;
}

}  // namespace

std::optional<User> Store::findUserByEmail(const std::string& email) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const std::string wanted = lower(email);
  for (const auto& user : users_) {
    if (lower(user.email) == wanted) return user;
  }
  return std::nullopt;
}

User Store::addUser(const std::string& email, const std::string& name,
                    const std::string& passwordHash, bool admin) {
  std::lock_guard<std::mutex> lock(mutex_);
  User user;
  user.id = nextUserId_++;
  user.email = email;
  user.name = name;
  user.passwordHash = passwordHash;
  user.admin = admin;
  users_.push_back(user);
  return user;
}

std::vector<Product> Store::listProducts() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return products_;
}

std::optional<Product> Store::getProduct(int id) const {
  std::lock_guard<std::mutex> lock(mutex_);
  for (const auto& product : products_) {
    if (product.id == id) return product;
  }
  return std::nullopt;
}

Product Store::addProduct(const std::string& name, const std::string& description, double price,
                          int stock) {
  std::lock_guard<std::mutex> lock(mutex_);
  Product product;
  product.id = nextProductId_++;
  product.name = name;
  product.description = description;
  product.price = price;
  product.stock = stock;
  products_.push_back(product);
  return product;
}

std::optional<Product> Store::updateProduct(int id, const ProductPatch& patch) {
  std::lock_guard<std::mutex> lock(mutex_);
  for (auto& product : products_) {
    if (product.id != id) continue;
    if (patch.name) product.name = *patch.name;
    if (patch.description) product.description = *patch.description;
    if (patch.price) product.price = *patch.price;
    if (patch.stock) product.stock = *patch.stock;
    return product;
  }
  return std::nullopt;
}

bool Store::deleteProduct(int id) {
  std::lock_guard<std::mutex> lock(mutex_);
  auto it = std::remove_if(products_.begin(), products_.end(),
                           [id](const Product& product) { return product.id == id; });
  if (it == products_.end()) return false;
  products_.erase(it, products_.end());
  return true;
}
`,

    'include/routes.hpp': `#pragma once

#include <crow.h>
#include <crow/middlewares/cors.h>

#include <string>

#include "store.hpp"

// CORS is handled by Crow's built-in middleware, configured in main.cpp.
using App = crow::App<crow::CORSHandler>;

// Registers the pages, REST API, GraphQL endpoint and WebSocket echo on \`app\`.
// \`store\` and \`jwtSecret\` must outlive the running server.
void registerRoutes(App& app, Store& store, const std::string& jwtSecret);
`,

    'include/auth.hpp': `#pragma once

#include <ctime>
#include <optional>
#include <string>

// Password hashing (PBKDF2-HMAC-SHA256) and HS256 JSON Web Tokens, built on OpenSSL.
namespace auth {

struct Claims {
  int userId;
  bool admin;
};

constexpr int kTokenTtlSeconds = 24 * 60 * 60;

// Returns "pbkdf2$<iterations>$<salt hex>$<hash hex>".
std::string hashPassword(const std::string& password);
bool verifyPassword(const std::string& stored, const std::string& password);

std::string issueToken(int userId, bool admin, const std::string& secret, std::time_t now);
// Checks signature and expiry; returns the claims, or nothing when the token is not valid.
std::optional<Claims> verifyToken(const std::string& token, const std::string& secret,
                                  std::time_t now);

// Extracts <token> from an "Authorization: Bearer <token>" header value.
std::optional<std::string> bearerToken(const std::string& header);

}  // namespace auth
`,

    'include/store.hpp': `#pragma once

#include <mutex>
#include <optional>
#include <string>
#include <vector>

struct User {
  int id = 0;
  std::string email;
  std::string name;
  std::string passwordHash;
  bool admin = false;
};

struct Product {
  int id = 0;
  std::string name;
  std::string description;
  double price = 0.0;
  int stock = 0;
};

// Fields to change on a product; unset fields are left alone.
struct ProductPatch {
  std::optional<std::string> name;
  std::optional<std::string> description;
  std::optional<double> price;
  std::optional<int> stock;
};

// In-memory users and products. Crow runs handlers on several threads, so every
// operation takes the lock and returns copies. Replace with a database for production.
class Store {
 public:
  std::optional<User> findUserByEmail(const std::string& email) const;
  User addUser(const std::string& email, const std::string& name, const std::string& passwordHash,
               bool admin);

  std::vector<Product> listProducts() const;
  std::optional<Product> getProduct(int id) const;
  Product addProduct(const std::string& name, const std::string& description, double price,
                     int stock);
  std::optional<Product> updateProduct(int id, const ProductPatch& patch);
  bool deleteProduct(int id);

 private:
  mutable std::mutex mutex_;
  std::vector<User> users_;
  std::vector<Product> products_;
  int nextUserId_ = 1;
  int nextProductId_ = 1;
};
`,

    'tests/test_auth.cpp': `#include <gtest/gtest.h>

#include "auth.hpp"

TEST(Password, VerifiesOnlyTheRightPassword) {
  const std::string hash = auth::hashPassword("admin123");
  EXPECT_TRUE(auth::verifyPassword(hash, "admin123"));
  EXPECT_FALSE(auth::verifyPassword(hash, "wrong"));
  EXPECT_FALSE(auth::verifyPassword("not-a-hash", "admin123"));
}

TEST(Password, HashesAreSalted) {
  EXPECT_NE(auth::hashPassword("same"), auth::hashPassword("same"));
}

TEST(Token, RoundTripsClaims) {
  const std::string token = auth::issueToken(7, true, "secret", 1000);
  auto claims = auth::verifyToken(token, "secret", 1001);
  ASSERT_TRUE(claims.has_value());
  EXPECT_EQ(claims->userId, 7);
  EXPECT_TRUE(claims->admin);
}

TEST(Token, RejectsWrongSecretTamperingAndExpiry) {
  const std::string token = auth::issueToken(7, false, "secret", 1000);
  EXPECT_FALSE(auth::verifyToken(token, "other-secret", 1001).has_value());
  EXPECT_FALSE(auth::verifyToken(token, "secret", 1000 + auth::kTokenTtlSeconds + 1).has_value());

  std::string tampered = token;
  tampered.back() = tampered.back() == 'A' ? 'B' : 'A';
  EXPECT_FALSE(auth::verifyToken(tampered, "secret", 1001).has_value());
  EXPECT_FALSE(auth::verifyToken("not-a-token", "secret", 1001).has_value());
}

TEST(Bearer, ParsesTheAuthorizationHeader) {
  EXPECT_EQ(auth::bearerToken("Bearer abc"), std::optional<std::string>("abc"));
  EXPECT_FALSE(auth::bearerToken("Basic abc").has_value());
  EXPECT_FALSE(auth::bearerToken("Bearer ").has_value());
  EXPECT_FALSE(auth::bearerToken("").has_value());
}
`,

    'tests/test_store.cpp': `#include <gtest/gtest.h>

#include "store.hpp"

TEST(Store, ProductsCanBeCreatedUpdatedAndDeleted) {
  Store store;
  Product created = store.addProduct("Widget", "A widget", 9.5, 3);
  EXPECT_EQ(created.id, 1);

  ProductPatch patch;
  patch.name = "Gadget";
  patch.stock = 10;
  auto updated = store.updateProduct(1, patch);
  ASSERT_TRUE(updated.has_value());
  EXPECT_EQ(updated->name, "Gadget");
  EXPECT_EQ(updated->description, "A widget");
  EXPECT_EQ(updated->stock, 10);

  EXPECT_FALSE(store.updateProduct(99, patch).has_value());
  EXPECT_TRUE(store.deleteProduct(1));
  EXPECT_FALSE(store.deleteProduct(1));
  EXPECT_TRUE(store.listProducts().empty());
}

TEST(Store, UsersAreFoundByEmailIgnoringCase) {
  Store store;
  store.addUser("Admin@Example.com", "Admin", "hash", true);
  auto found = store.findUserByEmail("admin@example.com");
  ASSERT_TRUE(found.has_value());
  EXPECT_TRUE(found->admin);
  EXPECT_FALSE(store.findUserByEmail("other@example.com").has_value());
}
`,

    'Dockerfile': `# Build stage
FROM debian:bookworm-slim AS builder

RUN apt-get update \\
    && apt-get install -y --no-install-recommends \\
       build-essential cmake git ca-certificates libasio-dev libssl-dev nlohmann-json3-dev libgtest-dev \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \\
    && cmake --build build -j"$(nproc)" --target {{serviceName}}

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update \\
    && apt-get install -y --no-install-recommends libssl3 curl ca-certificates \\
    && rm -rf /var/lib/apt/lists/* \\
    && useradd --system --uid 1000 appuser

WORKDIR /app
COPY --from=builder /src/build/{{serviceName}} /app/{{serviceName}}
USER appuser

ENV PORT={{PORT}}
EXPOSE {{PORT}}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -fsS http://localhost:{{PORT}}/api/v1/health || exit 1

CMD ["/app/{{serviceName}}"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "{{PORT}}:{{PORT}}"
    environment:
      PORT: "{{PORT}}"
      JWT_SECRET: \${JWT_SECRET:?set JWT_SECRET}
    restart: unless-stopped
`,

    '.gitignore': `build/
cmake-build-*/
.cache/
compile_commands.json
`,

    'README.md': `# {{serviceName}}

HTTP API built with [Crow](https://crowcpp.org), the C++ microframework (release v1.2.0).

## Features

- REST API: health check, registration/login, products CRUD
- PBKDF2-SHA256 password hashes and HS256 JSON Web Tokens (OpenSSL)
- Bearer-token protection for product writes (delete requires the admin role)
- CORS through Crow's built-in middleware, a small GraphQL endpoint, a WebSocket echo at \`/ws\`
- Thread-safe in-memory store, GoogleTest unit tests and a Dockerfile

## Requirements

- CMake 3.24 or newer, a C++17 compiler, OpenSSL development files
- Standalone Asio headers (Crow's network layer): \`apt install libasio-dev\` or \`brew install asio\`
- Network access on the first configure: CMake fetches Crow from GitHub. nlohmann/json and
  GoogleTest use the system packages when installed (\`nlohmann-json3-dev\`, \`libgtest-dev\`)
  and are fetched otherwise.

## Build and run

\`\`\`bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
./build/{{serviceName}}            # listens on $PORT, default {{PORT}}
ctest --test-dir build --output-on-failure
\`\`\`

Set \`JWT_SECRET\` before running anywhere but your laptop. A development admin is seeded at
start-up (\`admin@example.com\` / \`admin123\`); remove it in \`src/main.cpp\`.

## API

- \`GET /\` - home page
- \`GET /api/v1/health\` - health check
- \`POST /api/v1/auth/register\` - body \`{"email","password","name"}\`, returns a token
- \`POST /api/v1/auth/login\` - body \`{"email","password"}\`, returns a token
- \`GET /api/v1/products\`, \`GET /api/v1/products/<id>\`
- \`POST /api/v1/products\`, \`PUT /api/v1/products/<id>\` - need \`Authorization: Bearer <token>\`
- \`DELETE /api/v1/products/<id>\` - admin token required
- \`POST /graphql\` - body \`{"query":"{ hello health products { name } }"}\`
- \`GET /ws\` - WebSocket echo

\`\`\`bash
TOKEN=$(curl -s localhost:{{PORT}}/api/v1/auth/login -d '{"email":"admin@example.com","password":"admin123"}' | jq -r .token)
curl -s localhost:{{PORT}}/api/v1/products -H "Authorization: Bearer $TOKEN" -d '{"name":"Widget","price":9.5}'
\`\`\`

## Structure

\`\`\`
CMakeLists.txt
include/            # auth.hpp, store.hpp, routes.hpp
src/main.cpp        # configuration, seed data, server start
src/routes.cpp      # Crow routes and handlers
src/auth.cpp        # password hashing and tokens
src/store.cpp       # in-memory users and products
tests/              # GoogleTest suites (auth and store; no Crow needed)
\`\`\`

## License

MIT
`
  }
};
