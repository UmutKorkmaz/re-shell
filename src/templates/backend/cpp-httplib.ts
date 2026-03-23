import { BackendTemplate } from '../types';

export const cppHttplibTemplate: BackendTemplate = {
  id: 'cpp-httplib',
  name: 'cpp-httplib',
  displayName: 'cpp-httplib Server',
  description: 'Lightweight single-header C++ HTTP/HTTPS server library with simple API and minimal dependencies',
  framework: 'cpp-httplib',
  language: 'cpp',
  version: '0.15.3',
  tags: ['cpp', 'httplib', 'api', 'rest', 'lightweight', 'single-header', 'https'],
  port: 8080,
  features: ['routing', 'middleware', 'file-upload', 'cors', 'logging', 'authentication', 'testing', 'docker', 'compression'],
  dependencies: {},
  devDependencies: {},
  
  files: {
    // CMakeLists.txt
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.14)
project({{serviceName}} VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Find packages
find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(ZLIB REQUIRED)

# Include FetchContent
include(FetchContent)

# Fetch cpp-httplib
FetchContent_Declare(
    httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.15.3
)
FetchContent_MakeAvailable(httplib)

# Fetch nlohmann/json
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)

# Fetch spdlog
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

# Source files
set(SOURCES
    src/main.cpp
    src/server.cpp
    src/routes/health_routes.cpp
    src/routes/user_routes.cpp
    src/middleware/auth_middleware.cpp
    src/middleware/cors_middleware.cpp
    src/middleware/logging_middleware.cpp
    src/services/user_service.cpp
    src/utils/jwt_utils.cpp
    src/utils/database.cpp
    src/config/config.cpp
)

# Main executable
add_executable(\${PROJECT_NAME} \${SOURCES})

target_include_directories(\${PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(\${PROJECT_NAME}
    PRIVATE
        httplib::httplib
        nlohmann_json::nlohmann_json
        spdlog::spdlog
        \${CMAKE_THREAD_LIBS_INIT}
        \${OPENSSL_LIBRARIES}
        \${ZLIB_LIBRARIES}
)

# Enable SSL support
target_compile_definitions(\${PROJECT_NAME} PRIVATE CPPHTTPLIB_OPENSSL_SUPPORT)

# Test executable
enable_testing()
set(TEST_SOURCES
    tests/test_main.cpp
    tests/test_server.cpp
    tests/test_user_routes.cpp
    tests/test_jwt_utils.cpp
    tests/test_user_service.cpp
    src/services/user_service.cpp
    src/utils/jwt_utils.cpp
    src/utils/database.cpp
    src/config/config.cpp
)

add_executable(tests \${TEST_SOURCES})

target_include_directories(tests PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(tests
    PRIVATE
        httplib::httplib
        nlohmann_json::nlohmann_json
        spdlog::spdlog
        GTest::gtest
        GTest::gtest_main
        \${CMAKE_THREAD_LIBS_INIT}
        \${OPENSSL_LIBRARIES}
)

target_compile_definitions(tests PRIVATE CPPHTTPLIB_OPENSSL_SUPPORT)

add_test(NAME tests COMMAND tests)

# Install
install(TARGETS \${PROJECT_NAME} DESTINATION bin)
install(DIRECTORY static DESTINATION share/\${PROJECT_NAME})
`,

    // Main application
    'src/main.cpp': `#include <iostream>
#include "server.hpp"
#include "config/config.hpp"
#include <spdlog/spdlog.h>

int main(int argc, char* argv[]) {
    // Load configuration
    Config& config = Config::getInstance();
    config.load("config.json");
    
    // Set up logging
    spdlog::set_level(spdlog::level::from_str(config.getLogLevel()));
    spdlog::info("Starting {{serviceName}} server...");
    
    try {
        // Create and start server
        HttpServer server(config);
        server.start();
    } catch (const std::exception& e) {
        spdlog::error("Server error: {}", e.what());
        return 1;
    }
    
    return 0;
}
`,

    // Server implementation
    'include/server.hpp': `#pragma once
#include <httplib.h>
#include <memory>
#include <thread>
#include "config/config.hpp"

class HttpServer {
private:
    std::unique_ptr<httplib::Server> server_;
    Config& config_;
    std::thread server_thread_;
    
    void setupRoutes();
    void setupMiddleware();
    void setupStaticFiles();
    void setupErrorHandlers();
    
public:
    explicit HttpServer(Config& config);
    ~HttpServer();
    
    void start();
    void stop();
    bool isRunning() const;
};
`,

    'src/server.cpp': `#include "server.hpp"
#include "routes/health_routes.hpp"
#include "routes/user_routes.hpp"
#include "middleware/auth_middleware.hpp"
#include "middleware/cors_middleware.hpp"
#include "middleware/logging_middleware.hpp"
#include <spdlog/spdlog.h>
#include <csignal>

static HttpServer* g_server = nullptr;

static void signalHandler(int signal) {
    if (g_server) {
        spdlog::info("Received signal {}, shutting down...", signal);
        g_server->stop();
    }
}

HttpServer::HttpServer(Config& config) : config_(config) {
    if (config.isHttpsEnabled()) {
        server_ = std::make_unique<httplib::SSLServer>(
            config.getCertFile().c_str(),
            config.getKeyFile().c_str()
        );
    } else {
        server_ = std::make_unique<httplib::Server>();
    }
    
    g_server = this;
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);
}

HttpServer::~HttpServer() {
    stop();
    g_server = nullptr;
}

void HttpServer::start() {
    setupMiddleware();
    setupRoutes();
    setupStaticFiles();
    setupErrorHandlers();
    
    auto host = config_.getHost();
    auto port = config_.getPort();
    
    spdlog::info("Server listening on {}:{}", host, port);
    
    // Set timeouts
    server_->set_read_timeout(config_.getReadTimeout());
    server_->set_write_timeout(config_.getWriteTimeout());
    server_->set_idle_interval(config_.getIdleInterval());
    server_->set_payload_max_length(config_.getMaxPayloadSize());
    
    // Enable compression
    server_->set_compression(true);
    
    // Start server in a separate thread
    server_thread_ = std::thread([this, host, port]() {
        server_->listen(host.c_str(), port);
    });
    
    // Wait for server to start
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    if (!isRunning()) {
        throw std::runtime_error("Failed to start server");
    }
    
    // Keep main thread alive
    server_thread_.join();
}

void HttpServer::stop() {
    if (server_ && isRunning()) {
        server_->stop();
        if (server_thread_.joinable()) {
            server_thread_.join();
        }
    }
}

bool HttpServer::isRunning() const {
    return server_ && server_->is_running();
}

void HttpServer::setupMiddleware() {
    // Pre-routing middleware
    server_->set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        // Logging middleware
        LoggingMiddleware::logRequest(req);
        
        // CORS middleware for preflight requests
        if (req.method == "OPTIONS") {
            CorsMiddleware::setCorsHeaders(res);
            res.status = 204;
            return httplib::Server::HandlerResponse::Handled;
        }
        
        return httplib::Server::HandlerResponse::Unhandled;
    });
    
    // Post-routing middleware
    server_->set_post_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        // Add CORS headers to all responses
        CorsMiddleware::setCorsHeaders(res);
        
        // Log response
        LoggingMiddleware::logResponse(req, res);
    });
}

void HttpServer::setupRoutes() {
    // Health routes
    HealthRoutes::setup(*server_);
    
    // User routes
    UserRoutes::setup(*server_);
    
    // Default 404 handler
    server_->set_error_handler([](const httplib::Request& req, httplib::Response& res) {
        if (res.status == 404) {
            nlohmann::json error;
            error["error"] = "Not Found";
            error["message"] = "The requested resource was not found";
            error["path"] = req.path;
            res.set_content(error.dump(), "application/json");
        }
    });
}

void HttpServer::setupStaticFiles() {
    // Serve static files
    auto static_dir = config_.getStaticDir();
    if (!static_dir.empty()) {
        server_->set_mount_point("/static", static_dir);
        spdlog::info("Serving static files from: {}", static_dir);
    }
}

void HttpServer::setupErrorHandlers() {
    server_->set_exception_handler([](const httplib::Request& req, httplib::Response& res, std::exception_ptr ep) {
        try {
            std::rethrow_exception(ep);
        } catch (const std::exception& e) {
            spdlog::error("Exception in handler: {}", e.what());
            nlohmann::json error;
            error["error"] = "Internal Server Error";
            error["message"] = e.what();
            res.status = 500;
            res.set_content(error.dump(), "application/json");
        }
    });
}
`,

    // Config
    'include/config/config.hpp': `#pragma once
#include <string>
#include <nlohmann/json.hpp>
#include <fstream>

class Config {
private:
    nlohmann::json config_data_;
    static Config instance_;
    
    Config() = default;
    void setDefaults();
    
public:
    static Config& getInstance() {
        static Config instance;
        return instance;
    }
    
    void load(const std::string& filename);
    
    // Server settings
    std::string getHost() const { return config_data_.value("host", "0.0.0.0"); }
    int getPort() const { return config_data_.value("port", 8080); }
    bool isHttpsEnabled() const { return config_data_.value("https_enabled", false); }
    std::string getCertFile() const { return config_data_.value("cert_file", "cert.pem"); }
    std::string getKeyFile() const { return config_data_.value("key_file", "key.pem"); }
    
    // Timeouts
    int getReadTimeout() const { return config_data_.value("read_timeout", 5); }
    int getWriteTimeout() const { return config_data_.value("write_timeout", 5); }
    int getIdleInterval() const { return config_data_.value("idle_interval", 60); }
    size_t getMaxPayloadSize() const { return config_data_.value("max_payload_size", 1024 * 1024); }
    
    // Application settings
    std::string getStaticDir() const { return config_data_.value("static_dir", "./static"); }
    std::string getDatabaseUrl() const { return config_data_.value("database_url", "sqlite://./data.db"); }
    std::string getJwtSecret() const { return config_data_.value("jwt_secret", "your-secret-key"); }
    int getJwtExpiry() const { return config_data_.value("jwt_expiry_hours", 24); }
    std::string getLogLevel() const { return config_data_.value("log_level", "info"); }
};
`,

    'src/config/config.cpp': `#include "config/config.hpp"
#include <spdlog/spdlog.h>

void Config::load(const std::string& filename) {
    try {
        std::ifstream file(filename);
        if (!file.is_open()) {
            spdlog::warn("Config file not found: {}, using defaults", filename);
            setDefaults();
            return;
        }
        file >> config_data_;
    } catch (const std::exception& e) {
        spdlog::error("Error loading config: {}", e.what());
        setDefaults();
    }
}

void Config::setDefaults() {
    config_data_ = {
        {"host", "0.0.0.0"},
        {"port", 8080},
        {"https_enabled", false},
        {"cert_file", "cert.pem"},
        {"key_file", "key.pem"},
        {"read_timeout", 5},
        {"write_timeout", 5},
        {"idle_interval", 60},
        {"max_payload_size", 1024 * 1024},
        {"static_dir", "./static"},
        {"database_url", "sqlite://./data.db"},
        {"jwt_secret", "your-secret-key"},
        {"jwt_expiry_hours", 24},
        {"log_level", "info"}
    };
}
`,

    // Health Routes
    'include/routes/health_routes.hpp': `#pragma once
#include <httplib.h>

class HealthRoutes {
public:
    static void setup(httplib::Server& server);
    
private:
    static void health(const httplib::Request& req, httplib::Response& res);
    static void metrics(const httplib::Request& req, httplib::Response& res);
};
`,

    'src/routes/health_routes.cpp': `#include "routes/health_routes.hpp"
#include <nlohmann/json.hpp>
#include <chrono>
#include <spdlog/spdlog.h>

static auto start_time = std::chrono::steady_clock::now();

void HealthRoutes::setup(httplib::Server& server) {
    server.Get("/health", health);
    server.Get("/metrics", metrics);
}

void HealthRoutes::health(const httplib::Request& req, httplib::Response& res) {
    nlohmann::json response;
    response["status"] = "healthy";
    response["timestamp"] = std::chrono::system_clock::now().time_since_epoch().count();
    response["version"] = "1.0.0";
    
    res.set_content(response.dump(), "application/json");
}

void HealthRoutes::metrics(const httplib::Request& req, httplib::Response& res) {
    auto now = std::chrono::steady_clock::now();
    auto uptime = std::chrono::duration_cast<std::chrono::seconds>(now - start_time).count();
    
    nlohmann::json response;
    response["uptime_seconds"] = uptime;
    response["memory_usage_mb"] = 0; // Placeholder
    response["cpu_usage_percent"] = 0; // Placeholder
    response["active_connections"] = 0; // Placeholder
    
    res.set_content(response.dump(), "application/json");
}
`,

    // User Routes
    'include/routes/user_routes.hpp': `#pragma once
#include <httplib.h>

class UserRoutes {
public:
    static void setup(httplib::Server& server);
    
private:
    static void createUser(const httplib::Request& req, httplib::Response& res);
    static void getUser(const httplib::Request& req, httplib::Response& res);
    static void updateUser(const httplib::Request& req, httplib::Response& res);
    static void deleteUser(const httplib::Request& req, httplib::Response& res);
    static void listUsers(const httplib::Request& req, httplib::Response& res);
    static void login(const httplib::Request& req, httplib::Response& res);
};
`,

    'src/routes/user_routes.cpp': `#include "routes/user_routes.hpp"
#include "services/user_service.hpp"
#include "middleware/auth_middleware.hpp"
#include "utils/jwt_utils.hpp"
#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>

void UserRoutes::setup(httplib::Server& server) {
    // Public routes
    server.Post("/api/users/register", createUser);
    server.Post("/api/users/login", login);
    
    // Protected routes
    server.Get("/api/users", [](const httplib::Request& req, httplib::Response& res) {
        if (!AuthMiddleware::authenticate(req, res)) return;
        listUsers(req, res);
    });
    
    server.Get(R"(/api/users/(d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!AuthMiddleware::authenticate(req, res)) return;
        getUser(req, res);
    });
    
    server.Put(R"(/api/users/(d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!AuthMiddleware::authenticate(req, res)) return;
        updateUser(req, res);
    });
    
    server.Delete(R"(/api/users/(d+))", [](const httplib::Request& req, httplib::Response& res) {
        if (!AuthMiddleware::authenticate(req, res)) return;
        deleteUser(req, res);
    });
}

void UserRoutes::createUser(const httplib::Request& req, httplib::Response& res) {
    try {
        auto json = nlohmann::json::parse(req.body);
        
        User user;
        user.email = json["email"];
        user.name = json["name"];
        user.password = json["password"];
        
        UserService service;
        auto result = service.createUser(user);
        
        if (result) {
            nlohmann::json response;
            response["id"] = result->id;
            response["email"] = result->email;
            response["name"] = result->name;
            res.status = 201;
            res.set_content(response.dump(), "application/json");
        } else {
            nlohmann::json error;
            error["error"] = "Failed to create user";
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
    } catch (const std::exception& e) {
        spdlog::error("Error creating user: {}", e.what());
        nlohmann::json error;
        error["error"] = "Invalid request";
        error["message"] = e.what();
        res.status = 400;
        res.set_content(error.dump(), "application/json");
    }
}

void UserRoutes::getUser(const httplib::Request& req, httplib::Response& res) {
    auto matches = req.matches;
    if (matches.size() > 1) {
        std::string id = matches[1];
        
        UserService service;
        auto user = service.getUser(id);
        
        if (user) {
            nlohmann::json response;
            response["id"] = user->id;
            response["email"] = user->email;
            response["name"] = user->name;
            response["created_at"] = user->created_at;
            res.set_content(response.dump(), "application/json");
        } else {
            nlohmann::json error;
            error["error"] = "User not found";
            res.status = 404;
            res.set_content(error.dump(), "application/json");
        }
    }
}

void UserRoutes::updateUser(const httplib::Request& req, httplib::Response& res) {
    auto matches = req.matches;
    if (matches.size() > 1) {
        try {
            std::string id = matches[1];
            auto json = nlohmann::json::parse(req.body);
            
            User user;
            user.id = id;
            if (json.contains("email")) user.email = json["email"];
            if (json.contains("name")) user.name = json["name"];
            
            UserService service;
            auto result = service.updateUser(user);
            
            if (result) {
                nlohmann::json response;
                response["id"] = result->id;
                response["email"] = result->email;
                response["name"] = result->name;
                res.set_content(response.dump(), "application/json");
            } else {
                nlohmann::json error;
                error["error"] = "User not found";
                res.status = 404;
                res.set_content(error.dump(), "application/json");
            }
        } catch (const std::exception& e) {
            nlohmann::json error;
            error["error"] = "Invalid request";
            error["message"] = e.what();
            res.status = 400;
            res.set_content(error.dump(), "application/json");
        }
    }
}

void UserRoutes::deleteUser(const httplib::Request& req, httplib::Response& res) {
    auto matches = req.matches;
    if (matches.size() > 1) {
        std::string id = matches[1];
        
        UserService service;
        if (service.deleteUser(id)) {
            res.status = 204;
        } else {
            nlohmann::json error;
            error["error"] = "User not found";
            res.status = 404;
            res.set_content(error.dump(), "application/json");
        }
    }
}

void UserRoutes::listUsers(const httplib::Request& req, httplib::Response& res) {
    int page = 1, limit = 10;
    
    if (req.has_param("page")) {
        page = std::stoi(req.get_param_value("page"));
    }
    if (req.has_param("limit")) {
        limit = std::stoi(req.get_param_value("limit"));
    }
    
    UserService service;
    auto users = service.listUsers(page, limit);
    
    nlohmann::json response;
    response["page"] = page;
    response["limit"] = limit;
    response["total"] = users.size();
    
    nlohmann::json userArray = nlohmann::json::array();
    for (const auto& user : users) {
        nlohmann::json u;
        u["id"] = user.id;
        u["email"] = user.email;
        u["name"] = user.name;
        userArray.push_back(u);
    }
    response["users"] = userArray;
    
    res.set_content(response.dump(), "application/json");
}

void UserRoutes::login(const httplib::Request& req, httplib::Response& res) {
    try {
        auto json = nlohmann::json::parse(req.body);
        std::string email = json["email"];
        std::string password = json["password"];
        
        UserService service;
        auto user = service.authenticate(email, password);
        
        if (user) {
            auto token = JwtUtils::generateToken(user->id, user->email);
            
            nlohmann::json response;
            response["token"] = token;
            response["user"]["id"] = user->id;
            response["user"]["email"] = user->email;
            response["user"]["name"] = user->name;
            
            res.set_content(response.dump(), "application/json");
        } else {
            nlohmann::json error;
            error["error"] = "Invalid credentials";
            res.status = 401;
            res.set_content(error.dump(), "application/json");
        }
    } catch (const std::exception& e) {
        nlohmann::json error;
        error["error"] = "Invalid request";
        error["message"] = e.what();
        res.status = 400;
        res.set_content(error.dump(), "application/json");
    }
}
`,

    // User Model and Service
    'include/models/user.hpp': `#pragma once
#include <string>

struct User {
    std::string id;
    std::string email;
    std::string name;
    std::string password;
    std::string created_at;
    std::string updated_at;
};
`,

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
#include <chrono>

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
    auto user = Database::getInstance().getUser(id);
    if (user) {
        user->password = ""; // Don't return password
    }
    return user;
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

    // Middleware
    'include/middleware/auth_middleware.hpp': `#pragma once
#include <httplib.h>

class AuthMiddleware {
public:
    static bool authenticate(const httplib::Request& req, httplib::Response& res);
};
`,

    'src/middleware/auth_middleware.cpp': `#include "middleware/auth_middleware.hpp"
#include "utils/jwt_utils.hpp"
#include <nlohmann/json.hpp>

bool AuthMiddleware::authenticate(const httplib::Request& req, httplib::Response& res) {
    auto auth_header = req.get_header_value("Authorization");
    
    if (auth_header.empty()) {
        nlohmann::json error;
        error["error"] = "Missing authorization header";
        res.status = 401;
        res.set_content(error.dump(), "application/json");
        return false;
    }
    
    // Extract token from "Bearer <token>"
    std::string token;
    if (auth_header.find("Bearer ") == 0) {
        token = auth_header.substr(7);
    } else {
        nlohmann::json error;
        error["error"] = "Invalid authorization format";
        res.status = 401;
        res.set_content(error.dump(), "application/json");
        return false;
    }
    
    // Validate token
    auto claims = JwtUtils::validateToken(token);
    if (!claims) {
        nlohmann::json error;
        error["error"] = "Invalid or expired token";
        res.status = 401;
        res.set_content(error.dump(), "application/json");
        return false;
    }
    
    // Token is valid
    return true;
}
`,

    'include/middleware/cors_middleware.hpp': `#pragma once
#include <httplib.h>

class CorsMiddleware {
public:
    static void setCorsHeaders(httplib::Response& res);
};
`,

    'src/middleware/cors_middleware.cpp': `#include "middleware/cors_middleware.hpp"

void CorsMiddleware::setCorsHeaders(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set_header("Access-Control-Max-Age", "86400");
}
`,

    'include/middleware/logging_middleware.hpp': `#pragma once
#include <httplib.h>

class LoggingMiddleware {
public:
    static void logRequest(const httplib::Request& req);
    static void logResponse(const httplib::Request& req, const httplib::Response& res);
};
`,

    'src/middleware/logging_middleware.cpp': `#include "middleware/logging_middleware.hpp"
#include <spdlog/spdlog.h>
#include <chrono>

void LoggingMiddleware::logRequest(const httplib::Request& req) {
    spdlog::info("{} {} from {}", req.method, req.path, req.remote_addr);
}

void LoggingMiddleware::logResponse(const httplib::Request& req, const httplib::Response& res) {
    spdlog::info("{} {} {} - {} bytes", req.method, req.path, res.status, res.body.size());
}
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
#include <vector>

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
    static const char* base64_chars = 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
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
    
    // Add padding
    while (encoded.size() % 4) {
        encoded.push_back('=');
    }
    
    // Convert to base64url
    std::replace(encoded.begin(), encoded.end(), '+', '-');
    std::replace(encoded.begin(), encoded.end(), '/', '_');
    encoded.erase(std::remove(encoded.begin(), encoded.end(), '='), encoded.end());
    
    return encoded;
}

std::string JwtUtils::base64UrlDecode(const std::string& input) {
    std::string prepared = input;
    
    // Convert from base64url to base64
    std::replace(prepared.begin(), prepared.end(), '-', '+');
    std::replace(prepared.begin(), prepared.end(), '_', '/');
    
    // Add padding if needed
    while (prepared.length() % 4 != 0) {
        prepared += '=';
    }
    
    // Decode
    std::string decoded;
    std::vector<int> T(256, -1);
    
    for (int i = 0; i < 64; i++) {
        T["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[i]] = i;
    }
    
    int val = 0, valb = -8;
    for (unsigned char c : prepared) {
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

    // Database
    'include/utils/database.hpp': `#pragma once
#include <string>
#include <vector>
#include <optional>
#include <memory>
#include <mutex>
#include <unordered_map>
#include "models/user.hpp"

class Database {
private:
    static Database instance_;
    std::string connection_string_;
    
    // Simple in-memory storage for demo
    std::unordered_map<std::string, User> users_by_id_;
    std::unordered_map<std::string, std::string> email_to_id_;
    mutable std::mutex mutex_;
    
    Database() = default;
    
public:
    static Database& getInstance() {
        static Database instance;
        return instance;
    }
    
    void initialize(const std::string& conn_str) { connection_string_ = conn_str; }
    
    bool saveUser(const User& user);
    std::optional<User> getUser(const std::string& id);
    std::optional<User> getUserByEmail(const std::string& email);
    bool updateUser(const User& user);
    bool deleteUser(const std::string& id);
    std::vector<User> listUsers(int page, int limit);
};
`,

    'src/utils/database.cpp': `#include "utils/database.hpp"

bool Database::saveUser(const User& user) {
    std::lock_guard<std::mutex> lock(mutex_);
    users_by_id_[user.id] = user;
    email_to_id_[user.email] = user.id;
    return true;
}

std::optional<User> Database::getUser(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = users_by_id_.find(id);
    if (it != users_by_id_.end()) {
        return it->second;
    }
    return std::nullopt;
}

std::optional<User> Database::getUserByEmail(const std::string& email) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = email_to_id_.find(email);
    if (it != email_to_id_.end()) {
        return getUser(it->second);
    }
    return std::nullopt;
}

bool Database::updateUser(const User& user) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = users_by_id_.find(user.id);
    if (it != users_by_id_.end()) {
        // Update email mapping if email changed
        if (it->second.email != user.email) {
            email_to_id_.erase(it->second.email);
            email_to_id_[user.email] = user.id;
        }
        it->second = user;
        return true;
    }
    return false;
}

bool Database::deleteUser(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = users_by_id_.find(id);
    if (it != users_by_id_.end()) {
        email_to_id_.erase(it->second.email);
        users_by_id_.erase(it);
        return true;
    }
    return false;
}

std::vector<User> Database::listUsers(int page, int limit) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<User> result;
    
    int skip = (page - 1) * limit;
    int count = 0;
    
    for (const auto& pair : users_by_id_) {
        if (count >= skip && result.size() < static_cast<size_t>(limit)) {
            result.push_back(pair.second);
        }
        count++;
    }
    
    return result;
}
`,

    // Static files
    'static/index.html': `<!DOCTYPE html>
<html>
<head>
    <title>{{serviceName}} - cpp-httplib Server</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f0f2f5;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 { 
            color: #1a1a1a;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: #666;
            margin-bottom: 2rem;
        }
        .endpoint {
            background: #f8f9fa;
            padding: 0.75rem 1rem;
            margin: 0.5rem 0;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            display: flex;
            align-items: center;
        }
        .method {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.875rem;
            font-weight: bold;
            margin-right: 1rem;
            min-width: 60px;
            text-align: center;
        }
        .get { background: #61affe; color: white; }
        .post { background: #49cc90; color: white; }
        .put { background: #fca130; color: white; }
        .delete { background: #f93e3e; color: white; }
        .feature {
            display: inline-block;
            background: #e3f2fd;
            color: #1976d2;
            padding: 0.5rem 1rem;
            margin: 0.25rem;
            border-radius: 20px;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{serviceName}} API</h1>
        <p class="subtitle">Lightweight C++ HTTP Server powered by cpp-httplib</p>
        
        <h2>Available Endpoints</h2>
        
        <h3>Health & Monitoring</h3>
        <div class="endpoint">
            <span class="method get">GET</span> /health
        </div>
        <div class="endpoint">
            <span class="method get">GET</span> /metrics
        </div>
        
        <h3>Authentication</h3>
        <div class="endpoint">
            <span class="method post">POST</span> /api/users/register
        </div>
        <div class="endpoint">
            <span class="method post">POST</span> /api/users/login
        </div>
        
        <h3>User Management (Protected)</h3>
        <div class="endpoint">
            <span class="method get">GET</span> /api/users
        </div>
        <div class="endpoint">
            <span class="method get">GET</span> /api/users/{id}
        </div>
        <div class="endpoint">
            <span class="method put">PUT</span> /api/users/{id}
        </div>
        <div class="endpoint">
            <span class="method delete">DELETE</span> /api/users/{id}
        </div>
        
        <h2>Features</h2>
        <div style="margin-top: 1rem;">
            <span class="feature">🚀 Lightweight & Fast</span>
            <span class="feature">🔐 JWT Authentication</span>
            <span class="feature">🌐 CORS Support</span>
            <span class="feature">📝 Request Logging</span>
            <span class="feature">🔒 HTTPS/TLS</span>
            <span class="feature">🗜️ Gzip Compression</span>
            <span class="feature">📁 Static File Serving</span>
            <span class="feature">🧪 Unit Tests</span>
        </div>
        
        <h2>Getting Started</h2>
        <p>To use the protected endpoints, first register a user, then login to receive a JWT token.</p>
        <p>Include the token in the Authorization header: <code>Bearer {token}</code></p>
    </div>
</body>
</html>
`,

    // Test files
    'tests/test_main.cpp': `#include <gtest/gtest.h>

int main(int argc, char** argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
`,

    'tests/test_server.cpp': `#include <gtest/gtest.h>
#include <httplib.h>
#include <thread>

class ServerTest : public ::testing::Test {
protected:
    httplib::Client* client;
    
    void SetUp() override {
        client = new httplib::Client("localhost", 8080);
        client->set_connection_timeout(3);
    }
    
    void TearDown() override {
        delete client;
    }
};

TEST_F(ServerTest, HealthCheck) {
    auto res = client->Get("/health");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);
    EXPECT_FALSE(res->body.empty());
}

TEST_F(ServerTest, NotFound) {
    auto res = client->Get("/nonexistent");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 404);
}
`,

    'tests/test_user_routes.cpp': `#include <gtest/gtest.h>
#include <httplib.h>
#include <nlohmann/json.hpp>

class UserRoutesTest : public ::testing::Test {
protected:
    httplib::Client* client;
    std::string auth_token;
    
    void SetUp() override {
        client = new httplib::Client("localhost", 8080);
        
        // Create a test user and get auth token
        nlohmann::json user = {
            {"email", "test@example.com"},
            {"name", "Test User"},
            {"password", "password123"}
        };
        
        auto res = client->Post("/api/users/register", user.dump(), "application/json");
        if (res && res->status == 201) {
            // Login to get token
            nlohmann::json login = {
                {"email", "test@example.com"},
                {"password", "password123"}
            };
            
            auto login_res = client->Post("/api/users/login", login.dump(), "application/json");
            if (login_res && login_res->status == 200) {
                auto response = nlohmann::json::parse(login_res->body);
                auth_token = response["token"];
            }
        }
    }
    
    void TearDown() override {
        delete client;
    }
};

TEST_F(UserRoutesTest, CreateUser) {
    nlohmann::json user = {
        {"email", "new@example.com"},
        {"name", "New User"},
        {"password", "password123"}
    };
    
    auto res = client->Post("/api/users/register", user.dump(), "application/json");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 201);
    
    auto response = nlohmann::json::parse(res->body);
    EXPECT_FALSE(response["id"].get<std::string>().empty());
    EXPECT_EQ(response["email"], "new@example.com");
}

TEST_F(UserRoutesTest, ListUsersRequiresAuth) {
    auto res = client->Get("/api/users");
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 401);
}

TEST_F(UserRoutesTest, ListUsersWithAuth) {
    httplib::Headers headers = {
        {"Authorization", "Bearer " + auth_token}
    };
    
    auto res = client->Get("/api/users", headers);
    ASSERT_TRUE(res);
    EXPECT_EQ(res->status, 200);
    
    auto response = nlohmann::json::parse(res->body);
    EXPECT_TRUE(response.contains("users"));
    EXPECT_TRUE(response["users"].is_array());
}
`,

    'tests/test_jwt_utils.cpp': `#include <gtest/gtest.h>
#include "utils/jwt_utils.hpp"

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

TEST(JwtUtilsTest, InvalidToken) {
    auto claims = JwtUtils::validateToken("invalid.token.here");
    EXPECT_FALSE(claims.has_value());
}

TEST(JwtUtilsTest, MalformedToken) {
    auto claims = JwtUtils::validateToken("not-a-jwt");
    EXPECT_FALSE(claims.has_value());
}
`,

    'tests/test_user_service.cpp': `#include <gtest/gtest.h>
#include "services/user_service.hpp"

TEST(UserServiceTest, CreateUser) {
    UserService service;
    User user;
    user.email = "service_test@example.com";
    user.name = "Service Test";
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
    user.email = "auth_test@example.com";
    user.name = "Auth Test";
    user.password = "secure123";
    service.createUser(user);
    
    // Try to authenticate
    auto result = service.authenticate("auth_test@example.com", "secure123");
    EXPECT_TRUE(result.has_value());
    EXPECT_EQ(result->email, "auth_test@example.com");
}

TEST(UserServiceTest, AuthenticateFail) {
    UserService service;
    auto result = service.authenticate("nonexistent@example.com", "password");
    EXPECT_FALSE(result.has_value());
}
`,

    // Configuration files
    'config.json': `{
    "host": "0.0.0.0",
    "port": 8080,
    "https_enabled": false,
    "cert_file": "cert.pem",
    "key_file": "key.pem",
    "read_timeout": 5,
    "write_timeout": 5,
    "idle_interval": 60,
    "max_payload_size": 1048576,
    "static_dir": "./static",
    "database_url": "sqlite://./data.db",
    "jwt_secret": "your-secret-key-change-in-production",
    "jwt_expiry_hours": 24,
    "log_level": "info"
}
`,

    'Dockerfile': `# Build stage
FROM ubuntu:22.04 AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    libssl-dev \\
    zlib1g-dev \\
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy source
COPY . .

# Build
RUN mkdir build && cd build && \\
    cmake .. -DCMAKE_BUILD_TYPE=Release && \\
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libssl3 \\
    zlib1g \\
    && rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd -m -s /bin/bash appuser

# Copy binary and config
COPY --from=builder /app/build/{{serviceName}} /usr/local/bin/
COPY --from=builder /app/config.json /etc/{{serviceName}}/
COPY --from=builder /app/static /usr/share/{{serviceName}}/static/

# Set ownership
RUN chown -R appuser:appuser /etc/{{serviceName}}

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["{{serviceName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{serviceName}}
    ports:
      - "8080:8080"
    volumes:
      - ./config.json:/etc/{{serviceName}}/config.json:ro
      - ./static:/usr/share/{{serviceName}}/static:ro
      - ./logs:/var/log/{{serviceName}}
    environment:
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
`,

    '.gitignore': `# Build
build/
cmake-build-*/
*.o
*.a
*.so
*.dylib

# CMake
CMakeCache.txt
CMakeFiles/
cmake_install.cmake
Makefile
CTestTestfile.cmake
Testing/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
*.log
logs/

# Data
*.db
*.sqlite

# Environment
.env
config.local.json

# SSL
*.pem
*.key
*.crt
`,

    'README.md': `# {{serviceName}}

A lightweight and fast C++ HTTP server built with cpp-httplib.

## Features

- 🚀 Single-header library - minimal dependencies
- 🔐 JWT authentication
- 🌐 CORS support
- 📝 Request/response logging  
- 🔒 HTTPS/TLS support
- 🗜️ Gzip compression
- 📁 Static file serving
- 🧪 Comprehensive test suite
- 🐳 Docker support

## Requirements

- C++14 or later
- CMake 3.14+
- OpenSSL
- zlib

## Building

### Local Build

\`\`\`bash
mkdir build && cd build
cmake ..
make -j$(nproc)
\`\`\`

### Docker Build

\`\`\`bash
docker build -t {{serviceName}} .
docker run -p 8080:8080 {{serviceName}}
\`\`\`

Or with docker-compose:

\`\`\`bash
docker-compose up
\`\`\`

## Running

\`\`\`bash
./build/{{serviceName}}
\`\`\`

The server will start on port 8080. Visit http://localhost:8080 for the API documentation.

## API Endpoints

### Public Endpoints
- \`GET /health\` - Health check
- \`GET /metrics\` - Server metrics
- \`POST /api/users/register\` - User registration
- \`POST /api/users/login\` - User login

### Protected Endpoints (Requires JWT)
- \`GET /api/users\` - List users
- \`GET /api/users/{id}\` - Get user
- \`PUT /api/users/{id}\` - Update user
- \`DELETE /api/users/{id}\` - Delete user

## Configuration

Edit \`config.json\` to configure the server:

\`\`\`json
{
    "port": 8080,
    "https_enabled": false,
    "jwt_secret": "your-secret-key",
    "log_level": "info"
}
\`\`\`

## Testing

Run the test suite:

\`\`\`bash
cd build
ctest --verbose
\`\`\`

## Performance

cpp-httplib provides excellent performance with minimal overhead:
- Lightweight single-header implementation
- Efficient thread pool
- Built-in compression support
- Minimal memory footprint

## Development

### Project Structure

\`\`\`
.
├── CMakeLists.txt
├── include/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── utils/
├── src/
│   ├── main.cpp
│   ├── server.cpp
│   └── ...
├── static/
├── tests/
└── config.json
\`\`\`

### Adding Routes

1. Create route handler in \`include/routes/\`
2. Implement in \`src/routes/\`
3. Register in \`server.cpp\`

## License

MIT
`
  }
};