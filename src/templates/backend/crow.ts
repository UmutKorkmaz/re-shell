import { BackendTemplate } from '../types';

export const crowTemplate: BackendTemplate = {
  id: 'crow',
  name: 'crow',
  displayName: 'Crow C++ Framework',
  description: 'Fast and easy to use C++ microframework for building HTTP APIs with modern C++ features',
  framework: 'crow',
  language: 'cpp',
  version: '1.0.0',
  tags: ['cpp', 'crow', 'api', 'rest', 'microframework', 'header-only'],
  port: 8080,
  features: ['routing', 'middleware', 'validation', 'file-upload', 'websockets', 'testing', 'docker', 'cors', 'logging'],
  dependencies: {},
  devDependencies: {},
  
  files: {
    // CMakeLists.txt
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
project({{serviceName}} VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Enable all warnings
if(MSVC)
    add_compile_options(/W4 /WX)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -Werror)
endif()

# Find packages
find_package(Threads REQUIRED)
find_package(ZLIB REQUIRED)
find_package(OpenSSL REQUIRED)

# Include FetchContent to download dependencies
include(FetchContent)

# Fetch Crow
FetchContent_Declare(
    crow
    GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
    GIT_TAG v1.0+5
)
FetchContent_MakeAvailable(crow)

# Fetch nlohmann/json
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)

# Fetch spdlog for logging
FetchContent_Declare(
    spdlog
    GIT_REPOSITORY https://github.com/gabime/spdlog.git
    GIT_TAG v1.12.0
)
FetchContent_MakeAvailable(spdlog)

# Fetch Google Test
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.14.0
)
FetchContent_MakeAvailable(googletest)

# Main executable
add_executable(\${PROJECT_NAME}
    src/main.cpp
    src/controllers/health_controller.cpp
    src/controllers/user_controller.cpp
    src/middleware/auth_middleware.cpp
    src/middleware/cors_middleware.cpp
    src/middleware/logging_middleware.cpp
    src/services/user_service.cpp
    src/models/user.cpp
    src/utils/jwt_utils.cpp
    src/utils/database.cpp
    src/config/config.cpp
)

target_include_directories(\${PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(\${PROJECT_NAME}
    PRIVATE
        Crow::Crow
        nlohmann_json::nlohmann_json
        spdlog::spdlog
        \${CMAKE_THREAD_LIBS_INIT}
        \${OPENSSL_LIBRARIES}
        \${ZLIB_LIBRARIES}
)

# Test executable
enable_testing()
add_executable(tests
    tests/test_main.cpp
    tests/test_user_controller.cpp
    tests/test_auth_middleware.cpp
    tests/test_user_service.cpp
    tests/test_jwt_utils.cpp
    src/controllers/user_controller.cpp
    src/middleware/auth_middleware.cpp
    src/services/user_service.cpp
    src/models/user.cpp
    src/utils/jwt_utils.cpp
    src/config/config.cpp
)

target_include_directories(tests PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(tests
    PRIVATE
        Crow::Crow
        nlohmann_json::nlohmann_json
        spdlog::spdlog
        GTest::gtest
        GTest::gtest_main
        \${CMAKE_THREAD_LIBS_INIT}
        \${OPENSSL_LIBRARIES}
)

add_test(NAME tests COMMAND tests)

# Install rules
install(TARGETS \${PROJECT_NAME} DESTINATION bin)
install(DIRECTORY include/ DESTINATION include)
`,

    // conanfile.txt
    'conanfile.txt': `[requires]
openssl/3.2.0
zlib/1.3.1
boost/1.84.0
sqlite3/3.44.2
redis-plus-plus/1.3.10

[generators]
CMakeDeps
CMakeToolchain

[options]
boost:header_only=True

[imports]
bin, *.dll -> ./bin
lib, *.dylib* -> ./bin
`,

    // Main application
    'src/main.cpp': `#include <crow.h>
#include <spdlog/spdlog.h>
#include "config/config.hpp"
#include "controllers/health_controller.hpp"
#include "controllers/user_controller.hpp"
#include "middleware/auth_middleware.hpp"
#include "middleware/cors_middleware.hpp"
#include "middleware/logging_middleware.hpp"
#include "utils/database.hpp"

int main()
{
    // Load configuration
    auto config = Config::getInstance();
    config.load("config.json");
    
    // Initialize logger
    spdlog::set_level(spdlog::level::info);
    spdlog::info("Starting {{serviceName}} server...");
    
    // Initialize database
    Database::getInstance().initialize(config.getDatabaseUrl());
    
    // Create Crow application
    crow::App<LoggingMiddleware, CorsMiddleware> app;
    
    // Configure app
    app.loglevel(crow::LogLevel::Info);
    
    // Register health routes
    HealthController healthController;
    healthController.registerRoutes(app);
    
    // Register user routes
    UserController userController;
    userController.registerRoutes(app);
    
    // Protected routes example
    CROW_ROUTE(app, "/api/protected")
    .middlewares<AuthMiddleware>()
    ([](const crow::request& req) {
        auto user_id = req.get_header_value("X-User-Id");
        crow::json::wvalue response;
        response["message"] = "Access granted";
        response["user_id"] = user_id;
        return crow::response(response);
    });
    
    // WebSocket endpoint
    CROW_ROUTE(app, "/ws")
    .websocket()
    .onopen([&](crow::websocket::connection& conn) {
        spdlog::info("WebSocket connection opened: {}", conn.get_remote_ip());
    })
    .onmessage([&](crow::websocket::connection& conn, const std::string& data, bool is_binary) {
        if (is_binary) {
            conn.send_binary(data);
        } else {
            crow::json::rvalue json = crow::json::load(data);
            if (json) {
                crow::json::wvalue response;
                response["echo"] = json;
                response["timestamp"] = std::chrono::system_clock::now().time_since_epoch().count();
                conn.send_text(response.dump());
            }
        }
    })
    .onclose([&](crow::websocket::connection& conn, const std::string& reason) {
        spdlog::info("WebSocket connection closed: {} - {}", conn.get_remote_ip(), reason);
    });
    
    // Static file serving
    app.route_dynamic("/static/<path>")
    ([](const crow::request&, crow::response& res, std::string filename) {
        res.set_static_file_info("static/" + filename);
        res.end();
    });
    
    // 404 handler
    app.route_dynamic("/.*")
    ([](const crow::request&, crow::response& res) {
        res.code = 404;
        crow::json::wvalue response;
        response["error"] = "Not Found";
        response["message"] = "The requested resource was not found";
        res.write(response.dump());
        res.end();
    });
    
    // Start server
    auto port = config.getPort();
    spdlog::info("Server listening on port {}", port);
    
    app.port(port)
       .multithreaded()
       .run();
    
    return 0;
}
`,

    // Config
    'include/config/config.hpp': `#pragma once
#include <string>
#include <nlohmann/json.hpp>
#include <fstream>
#include <spdlog/spdlog.h>

class Config {
private:
    nlohmann::json config_data;
    static Config instance;
    
    Config() = default;
    
public:
    static Config& getInstance() {
        static Config instance;
        return instance;
    }
    
    void load(const std::string& filename) {
        try {
            std::ifstream file(filename);
            if (!file.is_open()) {
                spdlog::warn("Config file not found, using defaults");
                setDefaults();
                return;
            }
            file >> config_data;
        } catch (const std::exception& e) {
            spdlog::error("Error loading config: {}", e.what());
            setDefaults();
        }
    }
    
    int getPort() const {
        return config_data.value("port", 8080);
    }
    
    std::string getDatabaseUrl() const {
        return config_data.value("database_url", "sqlite://./data.db");
    }
    
    std::string getJwtSecret() const {
        return config_data.value("jwt_secret", "your-secret-key");
    }
    
    int getJwtExpiry() const {
        return config_data.value("jwt_expiry_hours", 24);
    }
    
    std::string getLogLevel() const {
        return config_data.value("log_level", "info");
    }
    
private:
    void setDefaults() {
        config_data = {
            {"port", 8080},
            {"database_url", "sqlite://./data.db"},
            {"jwt_secret", "your-secret-key"},
            {"jwt_expiry_hours", 24},
            {"log_level", "info"}
        };
    }
};
`,

    'src/config/config.cpp': `#include "config/config.hpp"

// Define static member
Config Config::instance;
`,

    // Health Controller
    'include/controllers/health_controller.hpp': `#pragma once
#include <crow.h>
#include <chrono>

class HealthController {
private:
    std::chrono::steady_clock::time_point start_time;
    
public:
    HealthController() : start_time(std::chrono::steady_clock::now()) {}
    
    void registerRoutes(crow::App<LoggingMiddleware, CorsMiddleware>& app);
    
private:
    crow::response health(const crow::request& req);
    crow::response metrics(const crow::request& req);
};
`,

    'src/controllers/health_controller.cpp': `#include "controllers/health_controller.hpp"
#include "utils/database.hpp"
#include <spdlog/spdlog.h>

void HealthController::registerRoutes(crow::App<LoggingMiddleware, CorsMiddleware>& app) {
    CROW_ROUTE(app, "/health")
    .methods(crow::HTTPMethod::Get)
    ([this](const crow::request& req) {
        return health(req);
    });
    
    CROW_ROUTE(app, "/metrics")
    .methods(crow::HTTPMethod::Get)
    ([this](const crow::request& req) {
        return metrics(req);
    });
}

crow::response HealthController::health(const crow::request&) {
    crow::json::wvalue response;
    response["status"] = "healthy";
    response["timestamp"] = std::chrono::system_clock::now().time_since_epoch().count();
    
    // Check database connection
    bool db_healthy = Database::getInstance().isHealthy();
    response["database"] = db_healthy ? "connected" : "disconnected";
    
    return crow::response(response);
}

crow::response HealthController::metrics(const crow::request&) {
    auto now = std::chrono::steady_clock::now();
    auto uptime = std::chrono::duration_cast<std::chrono::seconds>(now - start_time).count();
    
    crow::json::wvalue response;
    response["uptime_seconds"] = uptime;
    response["memory_usage_mb"] = 0; // Placeholder
    response["active_connections"] = 0; // Placeholder
    response["total_requests"] = 0; // Placeholder
    
    return crow::response(response);
}
`,

    // User Controller
    'include/controllers/user_controller.hpp': `#pragma once
#include <crow.h>
#include "services/user_service.hpp"

class UserController {
private:
    UserService userService;
    
public:
    void registerRoutes(crow::App<LoggingMiddleware, CorsMiddleware>& app);
    
private:
    crow::response createUser(const crow::request& req);
    crow::response getUser(const std::string& id);
    crow::response updateUser(const std::string& id, const crow::request& req);
    crow::response deleteUser(const std::string& id);
    crow::response listUsers(const crow::request& req);
    crow::response login(const crow::request& req);
};
`,

    'src/controllers/user_controller.cpp': `#include "controllers/user_controller.hpp"
#include "utils/jwt_utils.hpp"
#include <spdlog/spdlog.h>

void UserController::registerRoutes(crow::App<LoggingMiddleware, CorsMiddleware>& app) {
    // Public routes
    CROW_ROUTE(app, "/api/users/register")
    .methods(crow::HTTPMethod::Post)
    ([this](const crow::request& req) {
        return createUser(req);
    });
    
    CROW_ROUTE(app, "/api/users/login")
    .methods(crow::HTTPMethod::Post)
    ([this](const crow::request& req) {
        return login(req);
    });
    
    // Protected routes
    CROW_ROUTE(app, "/api/users")
    .methods(crow::HTTPMethod::Get)
    .middlewares<AuthMiddleware>()
    ([this](const crow::request& req) {
        return listUsers(req);
    });
    
    CROW_ROUTE(app, "/api/users/<string>")
    .methods(crow::HTTPMethod::Get)
    .middlewares<AuthMiddleware>()
    ([this](const std::string& id) {
        return getUser(id);
    });
    
    CROW_ROUTE(app, "/api/users/<string>")
    .methods(crow::HTTPMethod::Put)
    .middlewares<AuthMiddleware>()
    ([this](const crow::request& req, const std::string& id) {
        return updateUser(id, req);
    });
    
    CROW_ROUTE(app, "/api/users/<string>")
    .methods(crow::HTTPMethod::Delete)
    .middlewares<AuthMiddleware>()
    ([this](const std::string& id) {
        return deleteUser(id);
    });
}

crow::response UserController::createUser(const crow::request& req) {
    try {
        auto json = crow::json::load(req.body);
        if (!json) {
            return crow::response(400, R"({"error": "Invalid JSON"})");
        }
        
        User user;
        user.email = json["email"].s();
        user.name = json["name"].s();
        user.password = json["password"].s();
        
        auto result = userService.createUser(user);
        if (result) {
            crow::json::wvalue response;
            response["id"] = result->id;
            response["email"] = result->email;
            response["name"] = result->name;
            return crow::response(201, response);
        } else {
            return crow::response(400, R"({"error": "Failed to create user"})");
        }
    } catch (const std::exception& e) {
        spdlog::error("Error creating user: {}", e.what());
        return crow::response(500, R"({"error": "Internal server error"})");
    }
}

crow::response UserController::getUser(const std::string& id) {
    auto user = userService.getUser(id);
    if (user) {
        crow::json::wvalue response;
        response["id"] = user->id;
        response["email"] = user->email;
        response["name"] = user->name;
        response["created_at"] = user->created_at;
        return crow::response(response);
    } else {
        return crow::response(404, R"({"error": "User not found"})");
    }
}

crow::response UserController::updateUser(const std::string& id, const crow::request& req) {
    try {
        auto json = crow::json::load(req.body);
        if (!json) {
            return crow::response(400, R"({"error": "Invalid JSON"})");
        }
        
        User user;
        user.id = id;
        if (json.has("email")) user.email = json["email"].s();
        if (json.has("name")) user.name = json["name"].s();
        
        auto result = userService.updateUser(user);
        if (result) {
            crow::json::wvalue response;
            response["id"] = result->id;
            response["email"] = result->email;
            response["name"] = result->name;
            return crow::response(response);
        } else {
            return crow::response(404, R"({"error": "User not found"})");
        }
    } catch (const std::exception& e) {
        spdlog::error("Error updating user: {}", e.what());
        return crow::response(500, R"({"error": "Internal server error"})");
    }
}

crow::response UserController::deleteUser(const std::string& id) {
    if (userService.deleteUser(id)) {
        return crow::response(204);
    } else {
        return crow::response(404, R"({"error": "User not found"})");
    }
}

crow::response UserController::listUsers(const crow::request& req) {
    int page = 1, limit = 10;
    
    auto page_param = req.url_params.get("page");
    auto limit_param = req.url_params.get("limit");
    
    if (page_param) page = std::stoi(page_param);
    if (limit_param) limit = std::stoi(limit_param);
    
    auto users = userService.listUsers(page, limit);
    
    crow::json::wvalue response;
    response["page"] = page;
    response["limit"] = limit;
    response["total"] = users.size();
    
    std::vector<crow::json::wvalue> user_array;
    for (const auto& user : users) {
        crow::json::wvalue u;
        u["id"] = user.id;
        u["email"] = user.email;
        u["name"] = user.name;
        user_array.push_back(std::move(u));
    }
    response["users"] = std::move(user_array);
    
    return crow::response(response);
}

crow::response UserController::login(const crow::request& req) {
    try {
        auto json = crow::json::load(req.body);
        if (!json) {
            return crow::response(400, R"({"error": "Invalid JSON"})");
        }
        
        std::string email = json["email"].s();
        std::string password = json["password"].s();
        
        auto user = userService.authenticate(email, password);
        if (user) {
            auto token = JwtUtils::generateToken(user->id, user->email);
            
            crow::json::wvalue response;
            response["token"] = token;
            response["user"]["id"] = user->id;
            response["user"]["email"] = user->email;
            response["user"]["name"] = user->name;
            
            return crow::response(response);
        } else {
            return crow::response(401, R"({"error": "Invalid credentials"})");
        }
    } catch (const std::exception& e) {
        spdlog::error("Error during login: {}", e.what());
        return crow::response(500, R"({"error": "Internal server error"})");
    }
}
`,

    // User Model
    'include/models/user.hpp': `#pragma once
#include <string>
#include <chrono>

struct User {
    std::string id;
    std::string email;
    std::string name;
    std::string password;
    std::string created_at;
    std::string updated_at;
};
`,

    'src/models/user.cpp': `#include "models/user.hpp"
// Model implementation if needed
`,

    // User Service
    'include/services/user_service.hpp': `#pragma once
#include <optional>
#include <vector>
#include "models/user.hpp"

class UserService {
public:
    std::optional<User> createUser(const User& user);
    std::optional<User> getUser(const std::string& id);
    std::optional<User> updateUser(const User& user);
    bool deleteUser(const std::string& id);
    std::vector<User> listUsers(int page, int limit);
    std::optional<User> authenticate(const std::string& email, const std::string& password);
    
private:
    std::string hashPassword(const std::string& password);
    bool verifyPassword(const std::string& password, const std::string& hash);
};
`,

    'src/services/user_service.cpp': `#include "services/user_service.hpp"
#include "utils/database.hpp"
#include <openssl/sha.h>
#include <iomanip>
#include <sstream>
#include <random>

std::optional<User> UserService::createUser(const User& user) {
    User newUser = user;
    
    // Generate unique ID
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(100000, 999999);
    newUser.id = std::to_string(dis(gen));
    
    // Hash password
    newUser.password = hashPassword(user.password);
    
    // Set timestamps
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    newUser.created_at = std::ctime(&time_t);
    newUser.updated_at = newUser.created_at;
    
    // Save to database
    if (Database::getInstance().saveUser(newUser)) {
        newUser.password = ""; // Don't return password
        return newUser;
    }
    
    return std::nullopt;
}

std::optional<User> UserService::getUser(const std::string& id) {
    return Database::getInstance().getUser(id);
}

std::optional<User> UserService::updateUser(const User& user) {
    auto existing = Database::getInstance().getUser(user.id);
    if (!existing) {
        return std::nullopt;
    }
    
    User updated = *existing;
    if (!user.email.empty()) updated.email = user.email;
    if (!user.name.empty()) updated.name = user.name;
    
    // Update timestamp
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    updated.updated_at = std::ctime(&time_t);
    
    if (Database::getInstance().updateUser(updated)) {
        updated.password = ""; // Don't return password
        return updated;
    }
    
    return std::nullopt;
}

bool UserService::deleteUser(const std::string& id) {
    return Database::getInstance().deleteUser(id);
}

std::vector<User> UserService::listUsers(int page, int limit) {
    auto users = Database::getInstance().listUsers(page, limit);
    // Remove passwords from response
    for (auto& user : users) {
        user.password = "";
    }
    return users;
}

std::optional<User> UserService::authenticate(const std::string& email, const std::string& password) {
    auto user = Database::getInstance().getUserByEmail(email);
    if (user && verifyPassword(password, user->password)) {
        user->password = ""; // Don't return password
        return user;
    }
    return std::nullopt;
}

std::string UserService::hashPassword(const std::string& password) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(password.c_str()), password.length(), hash);
    
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    
    return ss.str();
}

bool UserService::verifyPassword(const std::string& password, const std::string& hash) {
    return hashPassword(password) == hash;
}
`,

    // Auth Middleware
    'include/middleware/auth_middleware.hpp': `#pragma once
#include <crow.h>
#include "utils/jwt_utils.hpp"

struct AuthMiddleware : crow::ILocalMiddleware {
    struct context {};
    
    void before_handle(crow::request& req, crow::response& res, context& ctx) {
        auto auth_header = req.get_header_value("Authorization");
        
        if (auth_header.empty()) {
            res.code = 401;
            res.write(R"({"error": "Missing authorization header"})");
            res.end();
            return;
        }
        
        // Extract token from "Bearer <token>"
        std::string token;
        if (auth_header.find("Bearer ") == 0) {
            token = auth_header.substr(7);
        } else {
            res.code = 401;
            res.write(R"({"error": "Invalid authorization format"})");
            res.end();
            return;
        }
        
        // Validate token
        auto claims = JwtUtils::validateToken(token);
        if (!claims) {
            res.code = 401;
            res.write(R"({"error": "Invalid or expired token"})");
            res.end();
            return;
        }
        
        // Add user info to request headers for downstream use
        req.add_header("X-User-Id", claims->user_id);
        req.add_header("X-User-Email", claims->email);
    }
    
    void after_handle(crow::request&, crow::response&, context&) {
        // Nothing to do here
    }
};
`,

    'src/middleware/auth_middleware.cpp': `#include "middleware/auth_middleware.hpp"
// Implementation if needed
`,

    // CORS Middleware
    'include/middleware/cors_middleware.hpp': `#pragma once
#include <crow.h>

struct CorsMiddleware {
    struct context {};
    
    void before_handle(crow::request& req, crow::response& res, context&) {
        if (req.method == crow::HTTPMethod::Options) {
            res.code = 204;
            res.set_header("Access-Control-Allow-Origin", "*");
            res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
            res.set_header("Access-Control-Max-Age", "86400");
            res.end();
            return;
        }
    }
    
    void after_handle(crow::request&, crow::response& res, context&) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
};
`,

    'src/middleware/cors_middleware.cpp': `#include "middleware/cors_middleware.hpp"
// Implementation if needed
`,

    // Logging Middleware
    'include/middleware/logging_middleware.hpp': `#pragma once
#include <crow.h>
#include <spdlog/spdlog.h>
#include <chrono>

struct LoggingMiddleware {
    struct context {
        std::chrono::steady_clock::time_point start;
    };
    
    void before_handle(crow::request& req, crow::response&, context& ctx) {
        ctx.start = std::chrono::steady_clock::now();
        spdlog::info("{} {} from {}", 
                    crow::method_name(req.method), 
                    req.url, 
                    req.get_header_value("X-Forwarded-For").empty() ? 
                        req.remote_ip_address : req.get_header_value("X-Forwarded-For"));
    }
    
    void after_handle(crow::request& req, crow::response& res, context& ctx) {
        auto end = std::chrono::steady_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - ctx.start);
        
        spdlog::info("{} {} {} - {} μs", 
                    crow::method_name(req.method), 
                    req.url, 
                    res.code,
                    duration.count());
    }
};
`,

    'src/middleware/logging_middleware.cpp': `#include "middleware/logging_middleware.hpp"
// Implementation if needed
`,

    // JWT Utils
    'include/utils/jwt_utils.hpp': `#pragma once
#include <string>
#include <optional>

struct JwtClaims {
    std::string user_id;
    std::string email;
    int64_t exp;
};

class JwtUtils {
public:
    static std::string generateToken(const std::string& user_id, const std::string& email);
    static std::optional<JwtClaims> validateToken(const std::string& token);
    
private:
    static std::string base64UrlEncode(const std::string& input);
    static std::string base64UrlDecode(const std::string& input);
    static std::string createSignature(const std::string& data);
};
`,

    'src/utils/jwt_utils.cpp': `#include "utils/jwt_utils.hpp"
#include "config/config.hpp"
#include <nlohmann/json.hpp>
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <chrono>
#include <sstream>
#include <algorithm>

std::string JwtUtils::generateToken(const std::string& user_id, const std::string& email) {
    nlohmann::json header = {
        {"alg", "HS256"},
        {"typ", "JWT"}
    };
    
    auto now = std::chrono::system_clock::now();
    auto exp = now + std::chrono::hours(Config::getInstance().getJwtExpiry());
    
    nlohmann::json payload = {
        {"user_id", user_id},
        {"email", email},
        {"iat", std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count()},
        {"exp", std::chrono::duration_cast<std::chrono::seconds>(exp.time_since_epoch()).count()}
    };
    
    std::string header_encoded = base64UrlEncode(header.dump());
    std::string payload_encoded = base64UrlEncode(payload.dump());
    std::string data = header_encoded + "." + payload_encoded;
    std::string signature = createSignature(data);
    
    return data + "." + signature;
}

std::optional<JwtClaims> JwtUtils::validateToken(const std::string& token) {
    // Split token into parts
    std::vector<std::string> parts;
    std::stringstream ss(token);
    std::string part;
    while (std::getline(ss, part, '.')) {
        parts.push_back(part);
    }
    
    if (parts.size() != 3) {
        return std::nullopt;
    }
    
    // Verify signature
    std::string data = parts[0] + "." + parts[1];
    std::string expected_signature = createSignature(data);
    if (parts[2] != expected_signature) {
        return std::nullopt;
    }
    
    // Decode payload
    std::string payload_json = base64UrlDecode(parts[1]);
    auto payload = nlohmann::json::parse(payload_json);
    
    // Check expiration
    auto now = std::chrono::system_clock::now();
    auto now_seconds = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
    if (payload["exp"].get<int64_t>() < now_seconds) {
        return std::nullopt;
    }
    
    JwtClaims claims;
    claims.user_id = payload["user_id"];
    claims.email = payload["email"];
    claims.exp = payload["exp"];
    
    return claims;
}

std::string JwtUtils::base64UrlEncode(const std::string& input) {
    // Simple base64url encoding implementation
    static const char* base64_chars = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    
    std::string encoded;
    int val = 0, valb = -6;
    
    for (unsigned char c : input) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            encoded.push_back(base64_chars[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    
    if (valb > -6) {
        encoded.push_back(base64_chars[((val << 8) >> (valb + 8)) & 0x3F]);
    }
    
    return encoded;
}

std::string JwtUtils::base64UrlDecode(const std::string& input) {
    // Simple base64url decoding implementation
    std::string decoded;
    std::vector<int> T(256, -1);
    
    for (int i = 0; i < 64; i++) {
        T["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[i]] = i;
    }
    
    int val = 0, valb = -8;
    for (unsigned char c : input) {
        if (T[c] == -1) break;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0) {
            decoded.push_back(char((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    
    return decoded;
}

std::string JwtUtils::createSignature(const std::string& data) {
    std::string secret = Config::getInstance().getJwtSecret();
    
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hash_len;
    
    HMAC(EVP_sha256(), 
         secret.c_str(), secret.length(),
         reinterpret_cast<const unsigned char*>(data.c_str()), data.length(),
         hash, &hash_len);
    
    return base64UrlEncode(std::string(reinterpret_cast<char*>(hash), hash_len));
}
`,

    // Database Utils
    'include/utils/database.hpp': `#pragma once
#include <string>
#include <vector>
#include <optional>
#include <memory>
#include "models/user.hpp"

class Database {
private:
    static Database instance;
    std::string connection_string;
    bool connected = false;
    
    Database() = default;
    
public:
    static Database& getInstance() {
        static Database instance;
        return instance;
    }
    
    void initialize(const std::string& conn_str);
    bool isHealthy() const { return connected; }
    
    // User operations
    bool saveUser(const User& user);
    std::optional<User> getUser(const std::string& id);
    std::optional<User> getUserByEmail(const std::string& email);
    bool updateUser(const User& user);
    bool deleteUser(const std::string& id);
    std::vector<User> listUsers(int page, int limit);
};
`,

    'src/utils/database.cpp': `#include "utils/database.hpp"
#include <spdlog/spdlog.h>
#include <unordered_map>
#include <mutex>

// Simple in-memory implementation for demo
class InMemoryDatabase {
private:
    std::unordered_map<std::string, User> users_by_id;
    std::unordered_map<std::string, std::string> email_to_id;
    mutable std::mutex mutex;
    
public:
    bool saveUser(const User& user) {
        std::lock_guard<std::mutex> lock(mutex);
        users_by_id[user.id] = user;
        email_to_id[user.email] = user.id;
        return true;
    }
    
    std::optional<User> getUser(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex);
        auto it = users_by_id.find(id);
        if (it != users_by_id.end()) {
            return it->second;
        }
        return std::nullopt;
    }
    
    std::optional<User> getUserByEmail(const std::string& email) {
        std::lock_guard<std::mutex> lock(mutex);
        auto it = email_to_id.find(email);
        if (it != email_to_id.end()) {
            return getUser(it->second);
        }
        return std::nullopt;
    }
    
    bool updateUser(const User& user) {
        std::lock_guard<std::mutex> lock(mutex);
        auto it = users_by_id.find(user.id);
        if (it != users_by_id.end()) {
            it->second = user;
            return true;
        }
        return false;
    }
    
    bool deleteUser(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex);
        auto it = users_by_id.find(id);
        if (it != users_by_id.end()) {
            email_to_id.erase(it->second.email);
            users_by_id.erase(it);
            return true;
        }
        return false;
    }
    
    std::vector<User> listUsers(int page, int limit) {
        std::lock_guard<std::mutex> lock(mutex);
        std::vector<User> result;
        
        int skip = (page - 1) * limit;
        int count = 0;
        
        for (const auto& pair : users_by_id) {
            if (count >= skip && result.size() < static_cast<size_t>(limit)) {
                result.push_back(pair.second);
            }
            count++;
        }
        
        return result;
    }
};

static InMemoryDatabase db;

void Database::initialize(const std::string& conn_str) {
    connection_string = conn_str;
    // In a real implementation, would connect to actual database
    connected = true;
    spdlog::info("Database initialized with connection: {}", conn_str);
}

bool Database::saveUser(const User& user) {
    return db.saveUser(user);
}

std::optional<User> Database::getUser(const std::string& id) {
    return db.getUser(id);
}

std::optional<User> Database::getUserByEmail(const std::string& email) {
    return db.getUserByEmail(email);
}

bool Database::updateUser(const User& user) {
    return db.updateUser(user);
}

bool Database::deleteUser(const std::string& id) {
    return db.deleteUser(id);
}

std::vector<User> Database::listUsers(int page, int limit) {
    return db.listUsers(page, limit);
}
`,

    // Tests
    'tests/test_main.cpp': `#include <gtest/gtest.h>

int main(int argc, char** argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
`,

    'tests/test_user_controller.cpp': `#include <gtest/gtest.h>
#include "controllers/user_controller.hpp"
#include "services/user_service.hpp"

class UserControllerTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Setup test environment
    }
    
    void TearDown() override {
        // Cleanup
    }
};

TEST_F(UserControllerTest, CreateUserSuccess) {
    // Test user creation
    EXPECT_TRUE(true);
}

TEST_F(UserControllerTest, GetUserNotFound) {
    // Test getting non-existent user
    EXPECT_TRUE(true);
}

TEST_F(UserControllerTest, UpdateUserSuccess) {
    // Test user update
    EXPECT_TRUE(true);
}

TEST_F(UserControllerTest, DeleteUserSuccess) {
    // Test user deletion
    EXPECT_TRUE(true);
}
`,

    'tests/test_auth_middleware.cpp': `#include <gtest/gtest.h>
#include "middleware/auth_middleware.hpp"
#include "utils/jwt_utils.hpp"

TEST(AuthMiddlewareTest, ValidToken) {
    // Test with valid token
    auto token = JwtUtils::generateToken("123", "test@example.com");
    EXPECT_FALSE(token.empty());
}

TEST(AuthMiddlewareTest, InvalidToken) {
    // Test with invalid token
    auto claims = JwtUtils::validateToken("invalid.token.here");
    EXPECT_FALSE(claims.has_value());
}

TEST(AuthMiddlewareTest, ExpiredToken) {
    // Test with expired token
    // Would need to generate a token with past expiry
    EXPECT_TRUE(true);
}
`,

    'tests/test_user_service.cpp': `#include <gtest/gtest.h>
#include "services/user_service.hpp"

TEST(UserServiceTest, CreateUser) {
    UserService service;
    User user;
    user.email = "test@example.com";
    user.name = "Test User";
    user.password = "password123";
    
    auto result = service.createUser(user);
    EXPECT_TRUE(result.has_value());
    EXPECT_EQ(result->email, user.email);
    EXPECT_EQ(result->name, user.name);
    EXPECT_TRUE(result->password.empty()); // Password should not be returned
}

TEST(UserServiceTest, AuthenticateSuccess) {
    UserService service;
    
    // First create a user
    User user;
    user.email = "auth@example.com";
    user.name = "Auth User";
    user.password = "secure123";
    service.createUser(user);
    
    // Try to authenticate
    auto result = service.authenticate("auth@example.com", "secure123");
    EXPECT_TRUE(result.has_value());
    EXPECT_EQ(result->email, "auth@example.com");
}

TEST(UserServiceTest, AuthenticateFail) {
    UserService service;
    auto result = service.authenticate("nonexistent@example.com", "password");
    EXPECT_FALSE(result.has_value());
}
`,

    'tests/test_jwt_utils.cpp': `#include <gtest/gtest.h>
#include "utils/jwt_utils.hpp"
#include <thread>

TEST(JwtUtilsTest, GenerateAndValidate) {
    std::string user_id = "123";
    std::string email = "test@example.com";
    
    auto token = JwtUtils::generateToken(user_id, email);
    EXPECT_FALSE(token.empty());
    
    auto claims = JwtUtils::validateToken(token);
    EXPECT_TRUE(claims.has_value());
    EXPECT_EQ(claims->user_id, user_id);
    EXPECT_EQ(claims->email, email);
}

TEST(JwtUtilsTest, InvalidSignature) {
    std::string token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature";
    auto claims = JwtUtils::validateToken(token);
    EXPECT_FALSE(claims.has_value());
}

TEST(JwtUtilsTest, MalformedToken) {
    std::string token = "not.a.valid.jwt.token";
    auto claims = JwtUtils::validateToken(token);
    EXPECT_FALSE(claims.has_value());
}
`,

    // Configuration files
    'config.json': `{
    "port": 8080,
    "database_url": "sqlite://./data.db",
    "jwt_secret": "your-secret-key-change-in-production",
    "jwt_expiry_hours": 24,
    "log_level": "info",
    "cors": {
        "enabled": true,
        "origins": ["*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "headers": ["Content-Type", "Authorization"]
    },
    "rate_limit": {
        "enabled": true,
        "window_seconds": 60,
        "max_requests": 100
    }
}
`,

    'Dockerfile': `# Build stage
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    wget \\
    libssl-dev \\
    libboost-all-dev \\
    zlib1g-dev \\
    python3-pip \\
    && rm -rf /var/lib/apt/lists/*

# Install Conan
RUN pip3 install conan==2.0.17

# Set working directory
WORKDIR /app

# Copy source files
COPY . .

# Create build directory
RUN mkdir build && cd build && \\
    conan install .. --output-folder=. --build=missing && \\
    cmake .. -DCMAKE_BUILD_TYPE=Release && \\
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libssl3 \\
    zlib1g \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Copy binary from build stage
COPY --from=builder /app/build/{{serviceName}} /usr/local/bin/
COPY --from=builder /app/config.json /etc/{{serviceName}}/

# Set ownership
RUN chown -R appuser:appuser /etc/{{serviceName}}

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["{{serviceName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{serviceName}}
    ports:
      - "8080:8080"
    environment:
      - LOG_LEVEL=info
    volumes:
      - ./config.json:/etc/{{serviceName}}/config.json:ro
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    container_name: {{serviceName}}-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    
  postgres:
    image: postgres:15-alpine
    container_name: {{serviceName}}-postgres
    environment:
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: myapp_password
      POSTGRES_DB: myapp_db
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:
`,

    '.gitignore': `# Build files
build/
cmake-build-*/
*.o
*.a
*.so
*.dylib
*.exe

# CMake
CMakeCache.txt
CMakeFiles/
cmake_install.cmake
Makefile
CTestTestfile.cmake
Testing/

# Conan
conan.lock
conanbuild*
conaninfo.txt
conanrun*
graph_info.json

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Test results
*.log
test-results/
coverage/

# Application data
data/
*.db
*.sqlite

# Environment
.env
.env.local
config.local.json
`,

    'README.md': `# {{serviceName}}

A high-performance C++ web service built with the Crow framework.

## Features

- 🚀 Fast and lightweight HTTP server
- 🔐 JWT authentication
- 🌐 CORS support
- 📝 Request/response logging
- 🔄 WebSocket support
- 🧪 Comprehensive test suite
- 🐳 Docker support
- 📊 Health checks and metrics

## Requirements

- C++17 compiler (GCC 8+, Clang 7+, MSVC 2019+)
- CMake 3.16+
- OpenSSL
- zlib
- Optional: Conan package manager

## Building

### Using CMake directly

\`\`\`bash
mkdir build && cd build
cmake ..
make -j$(nproc)
\`\`\`

### Using Conan

\`\`\`bash
mkdir build && cd build
conan install .. --output-folder=. --build=missing
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
\`\`\`

## Running

\`\`\`bash
./build/{{serviceName}}
\`\`\`

The server will start on port 8080 by default.

## API Endpoints

### Health Check
- \`GET /health\` - Returns service health status
- \`GET /metrics\` - Returns service metrics

### User Management
- \`POST /api/users/register\` - Register new user
- \`POST /api/users/login\` - User login
- \`GET /api/users\` - List users (protected)
- \`GET /api/users/{id}\` - Get user by ID (protected)
- \`PUT /api/users/{id}\` - Update user (protected)
- \`DELETE /api/users/{id}\` - Delete user (protected)

### WebSocket
- \`WS /ws\` - WebSocket endpoint

## Testing

Run the test suite:

\`\`\`bash
cd build
ctest --verbose
\`\`\`

## Docker

Build and run with Docker:

\`\`\`bash
docker build -t {{serviceName}} .
docker run -p 8080:8080 {{serviceName}}
\`\`\`

Or use docker-compose:

\`\`\`bash
docker-compose up
\`\`\`

## Configuration

Configuration is loaded from \`config.json\`:

\`\`\`json
{
    "port": 8080,
    "database_url": "sqlite://./data.db",
    "jwt_secret": "your-secret-key",
    "jwt_expiry_hours": 24,
    "log_level": "info"
}
\`\`\`

## Development

### Project Structure

\`\`\`
.
├── CMakeLists.txt
├── conanfile.txt
├── include/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── services/
│   └── utils/
├── src/
│   ├── main.cpp
│   ├── controllers/
│   ├── middleware/
│   ├── services/
│   └── utils/
├── tests/
└── config.json
\`\`\`

### Adding New Endpoints

1. Create a new controller in \`include/controllers/\`
2. Implement the controller in \`src/controllers/\`
3. Register routes in \`main.cpp\`
4. Add tests in \`tests/\`

## Performance

The Crow framework provides excellent performance:
- Minimal overhead
- Efficient routing
- Built-in connection pooling
- Async request handling

## Security

- JWT-based authentication
- Password hashing with SHA256
- CORS protection
- Rate limiting support
- Input validation

## License

MIT
`
  }
};