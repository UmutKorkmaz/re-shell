import { BackendTemplate } from '../types';

export const pistacheTemplate: BackendTemplate = {
  id: 'pistache',
  name: 'pistache',
  displayName: 'Pistache REST Framework',
  description: 'Modern and elegant HTTP and REST framework for C++ with async support and easy-to-use API',
  framework: 'pistache',
  language: 'cpp',
  version: '0.3.0',
  tags: ['cpp', 'pistache', 'api', 'rest', 'http2', 'modern-cpp'],
  port: 9080,
  features: ['routing', 'middleware', 'authentication', 'validation', 'cors', 'logging', 'testing', 'docker', 'compression', 'rate-limiting'],
  dependencies: {},
  devDependencies: {},
  
  files: {
    // CMakeLists.txt
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
project({{serviceName}} VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Find packages
find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(PkgConfig REQUIRED)

# Find Pistache using pkg-config
pkg_check_modules(Pistache REQUIRED IMPORTED_TARGET libpistache)

# Include FetchContent
include(FetchContent)

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

# Fetch jwt-cpp
FetchContent_Declare(
    jwt-cpp
    GIT_REPOSITORY https://github.com/Thalhammer/jwt-cpp.git
    GIT_TAG v0.7.0
)
FetchContent_MakeAvailable(jwt-cpp)

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
    src/server/server.cpp
    src/routes/health_routes.cpp
    src/routes/user_routes.cpp
    src/middleware/auth_middleware.cpp
    src/middleware/cors_middleware.cpp
    src/middleware/logging_middleware.cpp
    src/middleware/rate_limit_middleware.cpp
    src/services/user_service.cpp
    src/services/cache_service.cpp
    src/utils/jwt_utils.cpp
    src/utils/validation.cpp
    src/config/config.cpp
)

# Main executable
add_executable(\${PROJECT_NAME} \${SOURCES})

target_include_directories(\${PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(\${PROJECT_NAME} PRIVATE
    PkgConfig::Pistache
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    jwt-cpp::jwt-cpp
    \${CMAKE_THREAD_LIBS_INIT}
    \${OPENSSL_LIBRARIES}
)

# Test executable
enable_testing()
set(TEST_SOURCES
    tests/test_main.cpp
    tests/test_routes.cpp
    tests/test_middleware.cpp
    tests/test_services.cpp
    tests/test_utils.cpp
    src/services/user_service.cpp
    src/services/cache_service.cpp
    src/utils/jwt_utils.cpp
    src/utils/validation.cpp
    src/config/config.cpp
)

add_executable(tests \${TEST_SOURCES})

target_include_directories(tests PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(tests PRIVATE
    PkgConfig::Pistache
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    jwt-cpp::jwt-cpp
    GTest::gtest
    GTest::gtest_main
    \${CMAKE_THREAD_LIBS_INIT}
    \${OPENSSL_LIBRARIES}
)

add_test(NAME tests COMMAND tests)

# Install
install(TARGETS \${PROJECT_NAME} DESTINATION bin)
install(FILES config.json DESTINATION etc/\${PROJECT_NAME})
`,

    // Main application
    'src/main.cpp': `#include <pistache/endpoint.h>
#include <pistache/router.h>
#include <spdlog/spdlog.h>
#include <csignal>
#include <memory>
#include "server/server.hpp"
#include "config/config.hpp"

std::unique_ptr<HttpServer> g_server;

void signalHandler(int signal) {
    spdlog::info("Received signal {}, shutting down...", signal);
    if (g_server) {
        g_server->shutdown();
    }
}

int main(int argc, char* argv[]) {
    // Setup signal handlers
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);
    
    // Load configuration
    Config& config = Config::getInstance();
    config.load("config.json");
    
    // Setup logging
    spdlog::set_level(spdlog::level::from_str(config.getLogLevel()));
    spdlog::info("Starting {{serviceName}} server...");
    
    try {
        // Create and start server
        g_server = std::make_unique<HttpServer>(config);
        g_server->init();
        g_server->start();
    } catch (const std::exception& e) {
        spdlog::error("Server error: {}", e.what());
        return 1;
    }
    
    return 0;
}
`,

    // Server implementation
    'include/server/server.hpp': `#pragma once
#include <pistache/endpoint.h>
#include <pistache/router.h>
#include <memory>
#include "config/config.hpp"

using namespace Pistache;

class HttpServer {
private:
    std::shared_ptr<Http::Endpoint> httpEndpoint_;
    Rest::Router router_;
    Config& config_;
    
    void setupRoutes();
    void setupMiddleware();
    
public:
    explicit HttpServer(Config& config);
    
    void init();
    void start();
    void shutdown();
};
`,

    'src/server/server.cpp': `#include "server/server.hpp"
#include "routes/health_routes.hpp"
#include "routes/user_routes.hpp"
#include "middleware/cors_middleware.hpp"
#include "middleware/logging_middleware.hpp"
#include "middleware/auth_middleware.hpp"
#include "middleware/rate_limit_middleware.hpp"
#include <spdlog/spdlog.h>

HttpServer::HttpServer(Config& config) : config_(config) {
    auto addr = Address(config.getHost(), config.getPort());
    httpEndpoint_ = std::make_shared<Http::Endpoint>(addr);
}

void HttpServer::init() {
    auto opts = Http::Endpoint::options()
        .threads(config_.getThreads())
        .maxRequestSize(config_.getMaxRequestSize())
        .maxResponseSize(config_.getMaxResponseSize());
    
    httpEndpoint_->init(opts);
    setupMiddleware();
    setupRoutes();
}

void HttpServer::start() {
    spdlog::info("Server listening on {}:{}", config_.getHost(), config_.getPort());
    httpEndpoint_->setHandler(router_.handler());
    httpEndpoint_->serve();
}

void HttpServer::shutdown() {
    httpEndpoint_->shutdown();
}

void HttpServer::setupMiddleware() {
    // Apply middleware in order
    Rest::Routes::Use(router_, std::make_shared<LoggingMiddleware>());
    Rest::Routes::Use(router_, std::make_shared<CorsMiddleware>());
    Rest::Routes::Use(router_, std::make_shared<RateLimitMiddleware>());
}

void HttpServer::setupRoutes() {
    // Health routes
    HealthRoutes::setup(router_);
    
    // User routes
    UserRoutes::setup(router_);
    
    // Default handler for 404
    router_.addCustomHandler(Rest::Routes::NotFound, 
        [](const Rest::Request& req, Http::ResponseWriter response) {
            nlohmann::json error;
            error["error"] = "Not Found";
            error["path"] = req.resource();
            error["method"] = Http::methodString(req.method());
            
            response.send(Http::Code::Not_Found, error.dump(), 
                         MIME(Application, Json));
            return Rest::Route::Result::Ok;
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
    uint16_t getPort() const { return config_data_.value("port", 9080); }
    int getThreads() const { return config_data_.value("threads", 2); }
    size_t getMaxRequestSize() const { return config_data_.value("max_request_size", 1048576); }
    size_t getMaxResponseSize() const { return config_data_.value("max_response_size", 1048576); }
    
    // Application settings
    std::string getDatabaseUrl() const { return config_data_.value("database_url", "sqlite://./data.db"); }
    std::string getJwtSecret() const { return config_data_.value("jwt_secret", "your-secret-key"); }
    int getJwtExpiry() const { return config_data_.value("jwt_expiry_hours", 24); }
    std::string getLogLevel() const { return config_data_.value("log_level", "info"); }
    
    // Rate limiting
    int getRateLimitRequests() const { return config_data_.value("rate_limit_requests", 100); }
    int getRateLimitWindow() const { return config_data_.value("rate_limit_window_seconds", 60); }
    
    // Cache settings
    bool isCacheEnabled() const { return config_data_.value("cache_enabled", true); }
    int getCacheTTL() const { return config_data_.value("cache_ttl_seconds", 300); }
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
        {"port", 9080},
        {"threads", 2},
        {"max_request_size", 1048576},
        {"max_response_size", 1048576},
        {"database_url", "sqlite://./data.db"},
        {"jwt_secret", "your-secret-key"},
        {"jwt_expiry_hours", 24},
        {"log_level", "info"},
        {"rate_limit_requests", 100},
        {"rate_limit_window_seconds", 60},
        {"cache_enabled", true},
        {"cache_ttl_seconds", 300}
    };
}
`,

    // Health Routes
    'include/routes/health_routes.hpp': `#pragma once
#include <pistache/router.h>

class HealthRoutes {
public:
    static void setup(Pistache::Rest::Router& router);
    
private:
    static void health(const Pistache::Rest::Request& req, 
                      Pistache::Http::ResponseWriter response);
    static void metrics(const Pistache::Rest::Request& req, 
                       Pistache::Http::ResponseWriter response);
};
`,

    'src/routes/health_routes.cpp': `#include "routes/health_routes.hpp"
#include <nlohmann/json.hpp>
#include <chrono>
#include <sys/resource.h>

static auto start_time = std::chrono::steady_clock::now();

void HealthRoutes::setup(Pistache::Rest::Router& router) {
    using namespace Pistache::Rest;
    
    Routes::Get(router, "/health", Routes::bind(&HealthRoutes::health));
    Routes::Get(router, "/metrics", Routes::bind(&HealthRoutes::metrics));
}

void HealthRoutes::health(const Pistache::Rest::Request& req, 
                         Pistache::Http::ResponseWriter response) {
    nlohmann::json result;
    result["status"] = "healthy";
    result["timestamp"] = std::chrono::system_clock::now().time_since_epoch().count();
    result["version"] = "1.0.0";
    result["service"] = "{{serviceName}}";
    
    response.send(Pistache::Http::Code::Ok, result.dump(), 
                  MIME(Application, Json));
}

void HealthRoutes::metrics(const Pistache::Rest::Request& req, 
                          Pistache::Http::ResponseWriter response) {
    auto now = std::chrono::steady_clock::now();
    auto uptime = std::chrono::duration_cast<std::chrono::seconds>(now - start_time).count();
    
    // Get memory usage
    struct rusage usage;
    getrusage(RUSAGE_SELF, &usage);
    
    nlohmann::json result;
    result["uptime_seconds"] = uptime;
    result["memory_usage_kb"] = usage.ru_maxrss;
    result["requests_total"] = 0; // Would be tracked by middleware
    result["requests_active"] = 0;
    result["response_time_avg_ms"] = 0;
    
    response.send(Pistache::Http::Code::Ok, result.dump(), 
                  MIME(Application, Json));
}
`,

    // User Routes
    'include/routes/user_routes.hpp': `#pragma once
#include <pistache/router.h>

class UserRoutes {
public:
    static void setup(Pistache::Rest::Router& router);
    
private:
    static void createUser(const Pistache::Rest::Request& req, 
                          Pistache::Http::ResponseWriter response);
    static void getUser(const Pistache::Rest::Request& req, 
                       Pistache::Http::ResponseWriter response);
    static void updateUser(const Pistache::Rest::Request& req, 
                          Pistache::Http::ResponseWriter response);
    static void deleteUser(const Pistache::Rest::Request& req, 
                          Pistache::Http::ResponseWriter response);
    static void listUsers(const Pistache::Rest::Request& req, 
                         Pistache::Http::ResponseWriter response);
    static void login(const Pistache::Rest::Request& req, 
                     Pistache::Http::ResponseWriter response);
};
`,

    'src/routes/user_routes.cpp': `#include "routes/user_routes.hpp"
#include "services/user_service.hpp"
#include "middleware/auth_middleware.hpp"
#include "utils/jwt_utils.hpp"
#include "utils/validation.hpp"
#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>

void UserRoutes::setup(Pistache::Rest::Router& router) {
    using namespace Pistache::Rest;
    
    // Public routes
    Routes::Post(router, "/api/users/register", Routes::bind(&UserRoutes::createUser));
    Routes::Post(router, "/api/users/login", Routes::bind(&UserRoutes::login));
    
    // Protected routes (auth middleware will validate)
    Routes::Get(router, "/api/users", Routes::bind(&UserRoutes::listUsers));
    Routes::Get(router, "/api/users/:id", Routes::bind(&UserRoutes::getUser));
    Routes::Put(router, "/api/users/:id", Routes::bind(&UserRoutes::updateUser));
    Routes::Delete(router, "/api/users/:id", Routes::bind(&UserRoutes::deleteUser));
}

void UserRoutes::createUser(const Pistache::Rest::Request& req, 
                           Pistache::Http::ResponseWriter response) {
    try {
        auto json = nlohmann::json::parse(req.body());
        
        // Validate input
        auto validation = Validator::validateUserRegistration(json);
        if (!validation.isValid()) {
            nlohmann::json error;
            error["error"] = "Validation failed";
            error["details"] = validation.getErrors();
            response.send(Pistache::Http::Code::Bad_Request, error.dump(), 
                         MIME(Application, Json));
            return;
        }
        
        User user;
        user.email = json["email"];
        user.name = json["name"];
        user.password = json["password"];
        
        UserService service;
        auto result = service.createUser(user);
        
        if (result) {
            nlohmann::json resp;
            resp["id"] = result->id;
            resp["email"] = result->email;
            resp["name"] = result->name;
            response.send(Pistache::Http::Code::Created, resp.dump(), 
                         MIME(Application, Json));
        } else {
            nlohmann::json error;
            error["error"] = "User already exists";
            response.send(Pistache::Http::Code::Conflict, error.dump(), 
                         MIME(Application, Json));
        }
    } catch (const std::exception& e) {
        spdlog::error("Error creating user: {}", e.what());
        nlohmann::json error;
        error["error"] = "Invalid request";
        error["message"] = e.what();
        response.send(Pistache::Http::Code::Bad_Request, error.dump(), 
                     MIME(Application, Json));
    }
}

void UserRoutes::getUser(const Pistache::Rest::Request& req, 
                        Pistache::Http::ResponseWriter response) {
    // Check authentication
    if (!AuthMiddleware::isAuthenticated(req)) {
        nlohmann::json error;
        error["error"] = "Unauthorized";
        response.send(Pistache::Http::Code::Unauthorized, error.dump(), 
                     MIME(Application, Json));
        return;
    }
    
    auto id = req.param(":id").as<std::string>();
    
    UserService service;
    auto user = service.getUser(id);
    
    if (user) {
        nlohmann::json resp;
        resp["id"] = user->id;
        resp["email"] = user->email;
        resp["name"] = user->name;
        resp["created_at"] = user->created_at;
        response.send(Pistache::Http::Code::Ok, resp.dump(), 
                     MIME(Application, Json));
    } else {
        nlohmann::json error;
        error["error"] = "User not found";
        response.send(Pistache::Http::Code::Not_Found, error.dump(), 
                     MIME(Application, Json));
    }
}

void UserRoutes::updateUser(const Pistache::Rest::Request& req, 
                           Pistache::Http::ResponseWriter response) {
    // Check authentication
    if (!AuthMiddleware::isAuthenticated(req)) {
        nlohmann::json error;
        error["error"] = "Unauthorized";
        response.send(Pistache::Http::Code::Unauthorized, error.dump(), 
                     MIME(Application, Json));
        return;
    }
    
    try {
        auto id = req.param(":id").as<std::string>();
        auto json = nlohmann::json::parse(req.body());
        
        User user;
        user.id = id;
        if (json.contains("email")) user.email = json["email"];
        if (json.contains("name")) user.name = json["name"];
        
        UserService service;
        auto result = service.updateUser(user);
        
        if (result) {
            nlohmann::json resp;
            resp["id"] = result->id;
            resp["email"] = result->email;
            resp["name"] = result->name;
            response.send(Pistache::Http::Code::Ok, resp.dump(), 
                         MIME(Application, Json));
        } else {
            nlohmann::json error;
            error["error"] = "User not found";
            response.send(Pistache::Http::Code::Not_Found, error.dump(), 
                         MIME(Application, Json));
        }
    } catch (const std::exception& e) {
        nlohmann::json error;
        error["error"] = "Invalid request";
        error["message"] = e.what();
        response.send(Pistache::Http::Code::Bad_Request, error.dump(), 
                     MIME(Application, Json));
    }
}

void UserRoutes::deleteUser(const Pistache::Rest::Request& req, 
                           Pistache::Http::ResponseWriter response) {
    // Check authentication
    if (!AuthMiddleware::isAuthenticated(req)) {
        nlohmann::json error;
        error["error"] = "Unauthorized";
        response.send(Pistache::Http::Code::Unauthorized, error.dump(), 
                     MIME(Application, Json));
        return;
    }
    
    auto id = req.param(":id").as<std::string>();
    
    UserService service;
    if (service.deleteUser(id)) {
        response.send(Pistache::Http::Code::No_Content);
    } else {
        nlohmann::json error;
        error["error"] = "User not found";
        response.send(Pistache::Http::Code::Not_Found, error.dump(), 
                     MIME(Application, Json));
    }
}

void UserRoutes::listUsers(const Pistache::Rest::Request& req, 
                          Pistache::Http::ResponseWriter response) {
    // Check authentication
    if (!AuthMiddleware::isAuthenticated(req)) {
        nlohmann::json error;
        error["error"] = "Unauthorized";
        response.send(Pistache::Http::Code::Unauthorized, error.dump(), 
                     MIME(Application, Json));
        return;
    }
    
    int page = 1, limit = 10;
    
    auto query = req.query();
    if (query.has("page")) page = std::stoi(query.get("page").value());
    if (query.has("limit")) limit = std::stoi(query.get("limit").value());
    
    UserService service;
    auto users = service.listUsers(page, limit);
    
    nlohmann::json resp;
    resp["page"] = page;
    resp["limit"] = limit;
    resp["total"] = users.size();
    
    nlohmann::json userArray = nlohmann::json::array();
    for (const auto& user : users) {
        nlohmann::json u;
        u["id"] = user.id;
        u["email"] = user.email;
        u["name"] = user.name;
        userArray.push_back(u);
    }
    resp["users"] = userArray;
    
    response.send(Pistache::Http::Code::Ok, resp.dump(), 
                 MIME(Application, Json));
}

void UserRoutes::login(const Pistache::Rest::Request& req, 
                      Pistache::Http::ResponseWriter response) {
    try {
        auto json = nlohmann::json::parse(req.body());
        
        // Validate input
        auto validation = Validator::validateLogin(json);
        if (!validation.isValid()) {
            nlohmann::json error;
            error["error"] = "Validation failed";
            error["details"] = validation.getErrors();
            response.send(Pistache::Http::Code::Bad_Request, error.dump(), 
                         MIME(Application, Json));
            return;
        }
        
        std::string email = json["email"];
        std::string password = json["password"];
        
        UserService service;
        auto user = service.authenticate(email, password);
        
        if (user) {
            auto token = JwtUtils::generateToken(user->id, user->email);
            
            nlohmann::json resp;
            resp["token"] = token;
            resp["user"]["id"] = user->id;
            resp["user"]["email"] = user->email;
            resp["user"]["name"] = user->name;
            
            response.send(Pistache::Http::Code::Ok, resp.dump(), 
                         MIME(Application, Json));
        } else {
            nlohmann::json error;
            error["error"] = "Invalid credentials";
            response.send(Pistache::Http::Code::Unauthorized, error.dump(), 
                         MIME(Application, Json));
        }
    } catch (const std::exception& e) {
        nlohmann::json error;
        error["error"] = "Invalid request";
        error["message"] = e.what();
        response.send(Pistache::Http::Code::Bad_Request, error.dump(), 
                     MIME(Application, Json));
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
#include "services/cache_service.hpp"
#include <openssl/sha.h>
#include <iomanip>
#include <sstream>
#include <random>
#include <chrono>
#include <unordered_map>
#include <mutex>

// Simple in-memory storage for demo
static std::unordered_map<std::string, User> users_by_id;
static std::unordered_map<std::string, std::string> email_to_id;
static std::mutex users_mutex;

std::optional<User> UserService::createUser(const User& user) {
    std::lock_guard<std::mutex> lock(users_mutex);
    
    // Check if email already exists
    if (email_to_id.find(user.email) != email_to_id.end()) {
        return std::nullopt;
    }
    
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
    
    // Save user
    users_by_id[newUser.id] = newUser;
    email_to_id[newUser.email] = newUser.id;
    
    // Cache the user
    CacheService::getInstance().set("user:" + newUser.id, newUser);
    
    newUser.password = ""; // Don't return password
    return newUser;
}

std::optional<User> UserService::getUser(const std::string& id) {
    // Check cache first
    auto cached = CacheService::getInstance().get<User>("user:" + id);
    if (cached) {
        cached->password = ""; // Don't return password
        return cached;
    }
    
    std::lock_guard<std::mutex> lock(users_mutex);
    auto it = users_by_id.find(id);
    if (it != users_by_id.end()) {
        User user = it->second;
        user.password = ""; // Don't return password
        
        // Cache the user
        CacheService::getInstance().set("user:" + id, user);
        
        return user;
    }
    return std::nullopt;
}

std::optional<User> UserService::updateUser(const User& user) {
    std::lock_guard<std::mutex> lock(users_mutex);
    
    auto it = users_by_id.find(user.id);
    if (it == users_by_id.end()) {
        return std::nullopt;
    }
    
    User& existing = it->second;
    
    // Update fields
    if (!user.email.empty() && user.email != existing.email) {
        // Update email mapping
        email_to_id.erase(existing.email);
        email_to_id[user.email] = user.id;
        existing.email = user.email;
    }
    if (!user.name.empty()) existing.name = user.name;
    
    // Update timestamp
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    existing.updated_at = std::ctime(&time_t);
    
    // Invalidate cache
    CacheService::getInstance().remove("user:" + user.id);
    
    User result = existing;
    result.password = ""; // Don't return password
    return result;
}

bool UserService::deleteUser(const std::string& id) {
    std::lock_guard<std::mutex> lock(users_mutex);
    
    auto it = users_by_id.find(id);
    if (it != users_by_id.end()) {
        email_to_id.erase(it->second.email);
        users_by_id.erase(it);
        
        // Invalidate cache
        CacheService::getInstance().remove("user:" + id);
        
        return true;
    }
    return false;
}

std::vector<User> UserService::listUsers(int page, int limit) {
    std::lock_guard<std::mutex> lock(users_mutex);
    std::vector<User> result;
    
    int skip = (page - 1) * limit;
    int count = 0;
    
    for (const auto& pair : users_by_id) {
        if (count >= skip && result.size() < static_cast<size_t>(limit)) {
            User user = pair.second;
            user.password = ""; // Don't return password
            result.push_back(user);
        }
        count++;
    }
    
    return result;
}

std::optional<User> UserService::authenticate(const std::string& email, const std::string& password) {
    std::lock_guard<std::mutex> lock(users_mutex);
    
    auto email_it = email_to_id.find(email);
    if (email_it == email_to_id.end()) {
        return std::nullopt;
    }
    
    auto user_it = users_by_id.find(email_it->second);
    if (user_it != users_by_id.end() && verifyPassword(password, user_it->second.password)) {
        User user = user_it->second;
        user.password = ""; // Don't return password
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

    // Cache Service
    'include/services/cache_service.hpp': `#pragma once
#include <unordered_map>
#include <chrono>
#include <mutex>
#include <optional>
#include <nlohmann/json.hpp>

class CacheService {
private:
    struct CacheEntry {
        nlohmann::json data;
        std::chrono::steady_clock::time_point expiry;
    };
    
    std::unordered_map<std::string, CacheEntry> cache_;
    mutable std::mutex mutex_;
    int default_ttl_seconds_ = 300;
    
    CacheService() = default;
    
public:
    static CacheService& getInstance() {
        static CacheService instance;
        return instance;
    }
    
    void setDefaultTTL(int seconds) { default_ttl_seconds_ = seconds; }
    
    template<typename T>
    void set(const std::string& key, const T& value, int ttl_seconds = -1) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        if (ttl_seconds < 0) ttl_seconds = default_ttl_seconds_;
        
        CacheEntry entry;
        entry.data = value;
        entry.expiry = std::chrono::steady_clock::now() + 
                      std::chrono::seconds(ttl_seconds);
        
        cache_[key] = entry;
    }
    
    template<typename T>
    std::optional<T> get(const std::string& key) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        auto it = cache_.find(key);
        if (it == cache_.end()) {
            return std::nullopt;
        }
        
        // Check expiry
        if (std::chrono::steady_clock::now() > it->second.expiry) {
            cache_.erase(it);
            return std::nullopt;
        }
        
        return it->second.data.get<T>();
    }
    
    void remove(const std::string& key) {
        std::lock_guard<std::mutex> lock(mutex_);
        cache_.erase(key);
    }
    
    void clear() {
        std::lock_guard<std::mutex> lock(mutex_);
        cache_.clear();
    }
    
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return cache_.size();
    }
    
    void cleanup() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto now = std::chrono::steady_clock::now();
        
        for (auto it = cache_.begin(); it != cache_.end();) {
            if (now > it->second.expiry) {
                it = cache_.erase(it);
            } else {
                ++it;
            }
        }
    }
};
`,

    'src/services/cache_service.cpp': `#include "services/cache_service.hpp"
// Implementation is in header due to templates
`,

    // Middleware
    'include/middleware/auth_middleware.hpp': `#pragma once
#include <pistache/http.h>
#include <pistache/router.h>
#include "utils/jwt_utils.hpp"

class AuthMiddleware {
public:
    static bool isAuthenticated(const Pistache::Rest::Request& req);
    static std::optional<JwtClaims> getAuthClaims(const Pistache::Rest::Request& req);
};
`,

    'src/middleware/auth_middleware.cpp': `#include "middleware/auth_middleware.hpp"
#include <spdlog/spdlog.h>

bool AuthMiddleware::isAuthenticated(const Pistache::Rest::Request& req) {
    return getAuthClaims(req).has_value();
}

std::optional<JwtClaims> AuthMiddleware::getAuthClaims(const Pistache::Rest::Request& req) {
    auto auth_header = req.headers().tryGet<Pistache::Http::Header::Authorization>();
    
    if (!auth_header) {
        return std::nullopt;
    }
    
    std::string auth_value = auth_header->value();
    
    // Extract token from "Bearer <token>"
    if (auth_value.find("Bearer ") != 0) {
        return std::nullopt;
    }
    
    std::string token = auth_value.substr(7);
    
    // Validate token
    return JwtUtils::validateToken(token);
}
`,

    'include/middleware/cors_middleware.hpp': `#pragma once
#include <pistache/middleware.h>
#include <pistache/http.h>

class CorsMiddleware : public Pistache::Http::Middleware {
public:
    void onRequest(const Pistache::Http::Request& req, 
                  Pistache::Http::ResponseWriter& response) override;
    
    void onResponse(const Pistache::Http::Request& req,
                   Pistache::Http::ResponseWriter& response) override;
};
`,

    'src/middleware/cors_middleware.cpp': `#include "middleware/cors_middleware.hpp"

void CorsMiddleware::onRequest(const Pistache::Http::Request& req, 
                              Pistache::Http::ResponseWriter& response) {
    if (req.method() == Pistache::Http::Method::Options) {
        response.headers()
            .add<Pistache::Http::Header::AccessControlAllowOrigin>("*")
            .add<Pistache::Http::Header::AccessControlAllowMethods>("GET, POST, PUT, DELETE, OPTIONS")
            .add<Pistache::Http::Header::AccessControlAllowHeaders>("Content-Type, Authorization")
            .add<Pistache::Http::Header::AccessControlMaxAge>("86400");
        
        response.send(Pistache::Http::Code::No_Content);
        return;
    }
}

void CorsMiddleware::onResponse(const Pistache::Http::Request& req,
                               Pistache::Http::ResponseWriter& response) {
    response.headers()
        .add<Pistache::Http::Header::AccessControlAllowOrigin>("*")
        .add<Pistache::Http::Header::AccessControlAllowMethods>("GET, POST, PUT, DELETE, OPTIONS")
        .add<Pistache::Http::Header::AccessControlAllowHeaders>("Content-Type, Authorization");
}
`,

    'include/middleware/logging_middleware.hpp': `#pragma once
#include <pistache/middleware.h>
#include <pistache/http.h>
#include <chrono>

class LoggingMiddleware : public Pistache::Http::Middleware {
private:
    struct RequestContext {
        std::chrono::steady_clock::time_point start;
    };
    
public:
    void onRequest(const Pistache::Http::Request& req, 
                  Pistache::Http::ResponseWriter& response) override;
    
    void onResponse(const Pistache::Http::Request& req,
                   Pistache::Http::ResponseWriter& response) override;
};
`,

    'src/middleware/logging_middleware.cpp': `#include "middleware/logging_middleware.hpp"
#include <spdlog/spdlog.h>

void LoggingMiddleware::onRequest(const Pistache::Http::Request& req, 
                                 Pistache::Http::ResponseWriter& response) {
    auto context = std::make_shared<RequestContext>();
    context->start = std::chrono::steady_clock::now();
    req.associateData(context);
    
    spdlog::info("{} {} from {}", 
                req.method(), 
                req.resource(), 
                req.address().host());
}

void LoggingMiddleware::onResponse(const Pistache::Http::Request& req,
                                  Pistache::Http::ResponseWriter& response) {
    auto context = req.getData<RequestContext>();
    if (context) {
        auto end = std::chrono::steady_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(
            end - context->start);
        
        spdlog::info("{} {} {} - {} μs", 
                    req.method(), 
                    req.resource(), 
                    static_cast<int>(response.code()),
                    duration.count());
    }
}
`,

    'include/middleware/rate_limit_middleware.hpp': `#pragma once
#include <pistache/middleware.h>
#include <pistache/http.h>
#include <unordered_map>
#include <chrono>
#include <mutex>

class RateLimitMiddleware : public Pistache::Http::Middleware {
private:
    struct RateLimitInfo {
        int requests = 0;
        std::chrono::steady_clock::time_point window_start;
    };
    
    std::unordered_map<std::string, RateLimitInfo> rate_limits_;
    mutable std::mutex mutex_;
    int max_requests_ = 100;
    int window_seconds_ = 60;
    
public:
    RateLimitMiddleware(int max_requests = 100, int window_seconds = 60)
        : max_requests_(max_requests), window_seconds_(window_seconds) {}
    
    void onRequest(const Pistache::Http::Request& req, 
                  Pistache::Http::ResponseWriter& response) override;
};
`,

    'src/middleware/rate_limit_middleware.cpp': `#include "middleware/rate_limit_middleware.hpp"
#include <nlohmann/json.hpp>

void RateLimitMiddleware::onRequest(const Pistache::Http::Request& req, 
                                   Pistache::Http::ResponseWriter& response) {
    std::string client_ip = req.address().host();
    auto now = std::chrono::steady_clock::now();
    
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto& limit_info = rate_limits_[client_ip];
    
    // Check if we need to reset the window
    auto window_duration = std::chrono::seconds(window_seconds_);
    if (now - limit_info.window_start > window_duration) {
        limit_info.requests = 0;
        limit_info.window_start = now;
    }
    
    // Check rate limit
    if (limit_info.requests >= max_requests_) {
        nlohmann::json error;
        error["error"] = "Rate limit exceeded";
        error["retry_after"] = window_seconds_;
        
        response.headers()
            .add<Pistache::Http::Header::ContentType>(MIME(Application, Json))
            .add<Pistache::Http::Header::Raw>("X-RateLimit-Limit", std::to_string(max_requests_))
            .add<Pistache::Http::Header::Raw>("X-RateLimit-Remaining", "0")
            .add<Pistache::Http::Header::Raw>("X-RateLimit-Reset", 
                std::to_string(std::chrono::duration_cast<std::chrono::seconds>(
                    limit_info.window_start + window_duration - std::chrono::steady_clock::epoch()
                ).count()));
        
        response.send(Pistache::Http::Code::Too_Many_Requests, error.dump());
        return;
    }
    
    // Increment request count
    limit_info.requests++;
    
    // Add rate limit headers
    response.headers()
        .add<Pistache::Http::Header::Raw>("X-RateLimit-Limit", std::to_string(max_requests_))
        .add<Pistache::Http::Header::Raw>("X-RateLimit-Remaining", 
            std::to_string(max_requests_ - limit_info.requests));
}
`,

    // Utils
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
};
`,

    'src/utils/jwt_utils.cpp': `#include "utils/jwt_utils.hpp"
#include "config/config.hpp"
#include <jwt-cpp/jwt.h>
#include <chrono>

std::string JwtUtils::generateToken(const std::string& user_id, const std::string& email) {
    auto now = std::chrono::system_clock::now();
    auto exp = now + std::chrono::hours(Config::getInstance().getJwtExpiry());
    
    auto token = jwt::create()
        .set_issuer("{{serviceName}}")
        .set_type("JWS")
        .set_payload_claim("user_id", jwt::claim(user_id))
        .set_payload_claim("email", jwt::claim(email))
        .set_issued_at(now)
        .set_expires_at(exp)
        .sign(jwt::algorithm::hs256{Config::getInstance().getJwtSecret()});
    
    return token;
}

std::optional<JwtClaims> JwtUtils::validateToken(const std::string& token) {
    try {
        auto decoded = jwt::decode(token);
        
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{Config::getInstance().getJwtSecret()})
            .with_issuer("{{serviceName}}");
        
        verifier.verify(decoded);
        
        JwtClaims claims;
        claims.user_id = decoded.get_payload_claim("user_id").as_string();
        claims.email = decoded.get_payload_claim("email").as_string();
        claims.exp = decoded.get_expires_at().time_since_epoch().count();
        
        return claims;
    } catch (const std::exception& e) {
        return std::nullopt;
    }
}
`,

    'include/utils/validation.hpp': `#pragma once
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

class ValidationResult {
private:
    bool valid_ = true;
    std::vector<std::string> errors_;
    
public:
    void addError(const std::string& error) {
        valid_ = false;
        errors_.push_back(error);
    }
    
    bool isValid() const { return valid_; }
    const std::vector<std::string>& getErrors() const { return errors_; }
};

class Validator {
public:
    static ValidationResult validateUserRegistration(const nlohmann::json& data);
    static ValidationResult validateLogin(const nlohmann::json& data);
    static bool isValidEmail(const std::string& email);
    static bool isValidPassword(const std::string& password);
};
`,

    'src/utils/validation.cpp': `#include "utils/validation.hpp"
#include <regex>

ValidationResult Validator::validateUserRegistration(const nlohmann::json& data) {
    ValidationResult result;
    
    if (!data.contains("email") || !data["email"].is_string()) {
        result.addError("Email is required and must be a string");
    } else if (!isValidEmail(data["email"])) {
        result.addError("Invalid email format");
    }
    
    if (!data.contains("name") || !data["name"].is_string()) {
        result.addError("Name is required and must be a string");
    } else if (data["name"].get<std::string>().length() < 2) {
        result.addError("Name must be at least 2 characters long");
    }
    
    if (!data.contains("password") || !data["password"].is_string()) {
        result.addError("Password is required and must be a string");
    } else if (!isValidPassword(data["password"])) {
        result.addError("Password must be at least 8 characters long");
    }
    
    return result;
}

ValidationResult Validator::validateLogin(const nlohmann::json& data) {
    ValidationResult result;
    
    if (!data.contains("email") || !data["email"].is_string()) {
        result.addError("Email is required and must be a string");
    }
    
    if (!data.contains("password") || !data["password"].is_string()) {
        result.addError("Password is required and must be a string");
    }
    
    return result;
}

bool Validator::isValidEmail(const std::string& email) {
    const std::regex pattern(R"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2})");
    return std::regex_match(email, pattern);
}

bool Validator::isValidPassword(const std::string& password) {
    return password.length() >= 8;
}
`,

    // Test files
    'tests/test_main.cpp': `#include <gtest/gtest.h>

int main(int argc, char** argv) {
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
`,

    'tests/test_routes.cpp': `#include <gtest/gtest.h>
#include <pistache/client.h>
#include <nlohmann/json.hpp>

class RoutesTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Server should be running for integration tests
    }
};

TEST_F(RoutesTest, HealthCheck) {
    Pistache::Http::Client client;
    auto opts = Pistache::Http::Client::options().threads(1);
    client.init(opts);
    
    auto response = client.get("http://localhost:9080/health").send();
    response.then([](Pistache::Http::Response res) {
        EXPECT_EQ(res.code(), Pistache::Http::Code::Ok);
        EXPECT_FALSE(res.body().empty());
    });
    
    client.shutdown();
}

TEST_F(RoutesTest, UserRegistration) {
    Pistache::Http::Client client;
    auto opts = Pistache::Http::Client::options().threads(1);
    client.init(opts);
    
    nlohmann::json user = {
        {"email", "test@example.com"},
        {"name", "Test User"},
        {"password", "password123"}
    };
    
    auto response = client.post("http://localhost:9080/api/users/register")
        .body(user.dump())
        .send();
        
    response.then([](Pistache::Http::Response res) {
        EXPECT_EQ(res.code(), Pistache::Http::Code::Created);
        auto json = nlohmann::json::parse(res.body());
        EXPECT_TRUE(json.contains("id"));
        EXPECT_EQ(json["email"], "test@example.com");
    });
    
    client.shutdown();
}
`,

    'tests/test_middleware.cpp': `#include <gtest/gtest.h>
#include "middleware/rate_limit_middleware.hpp"
#include "utils/jwt_utils.hpp"

TEST(MiddlewareTest, JWTGeneration) {
    auto token = JwtUtils::generateToken("123", "test@example.com");
    EXPECT_FALSE(token.empty());
    
    auto claims = JwtUtils::validateToken(token);
    EXPECT_TRUE(claims.has_value());
    EXPECT_EQ(claims->user_id, "123");
    EXPECT_EQ(claims->email, "test@example.com");
}

TEST(MiddlewareTest, InvalidJWT) {
    auto claims = JwtUtils::validateToken("invalid.token.here");
    EXPECT_FALSE(claims.has_value());
}
`,

    'tests/test_services.cpp': `#include <gtest/gtest.h>
#include "services/user_service.hpp"
#include "services/cache_service.hpp"

TEST(ServicesTest, UserCreation) {
    UserService service;
    
    User user;
    user.email = "service_test@example.com";
    user.name = "Service Test";
    user.password = "password123";
    
    auto result = service.createUser(user);
    EXPECT_TRUE(result.has_value());
    EXPECT_EQ(result->email, user.email);
    EXPECT_TRUE(result->password.empty());
}

TEST(ServicesTest, CacheOperations) {
    auto& cache = CacheService::getInstance();
    
    cache.set("test_key", "test_value", 60);
    auto value = cache.get<std::string>("test_key");
    
    EXPECT_TRUE(value.has_value());
    EXPECT_EQ(*value, "test_value");
    
    cache.remove("test_key");
    auto removed = cache.get<std::string>("test_key");
    EXPECT_FALSE(removed.has_value());
}
`,

    'tests/test_utils.cpp': `#include <gtest/gtest.h>
#include "utils/validation.hpp"

TEST(ValidationTest, ValidEmail) {
    EXPECT_TRUE(Validator::isValidEmail("test@example.com"));
    EXPECT_TRUE(Validator::isValidEmail("user.name@domain.co.uk"));
    EXPECT_FALSE(Validator::isValidEmail("invalid-email"));
    EXPECT_FALSE(Validator::isValidEmail("@example.com"));
    EXPECT_FALSE(Validator::isValidEmail("test@"));
}

TEST(ValidationTest, ValidPassword) {
    EXPECT_TRUE(Validator::isValidPassword("password123"));
    EXPECT_TRUE(Validator::isValidPassword("verylongpassword"));
    EXPECT_FALSE(Validator::isValidPassword("short"));
    EXPECT_FALSE(Validator::isValidPassword("1234567"));
}

TEST(ValidationTest, UserRegistrationValidation) {
    nlohmann::json valid_data = {
        {"email", "test@example.com"},
        {"name", "Test User"},
        {"password", "password123"}
    };
    
    auto result = Validator::validateUserRegistration(valid_data);
    EXPECT_TRUE(result.isValid());
    
    nlohmann::json invalid_data = {
        {"email", "invalid-email"},
        {"name", "T"},
        {"password", "short"}
    };
    
    auto invalid_result = Validator::validateUserRegistration(invalid_data);
    EXPECT_FALSE(invalid_result.isValid());
    EXPECT_EQ(invalid_result.getErrors().size(), 3);
}
`,

    // Configuration files
    'config.json': `{
    "host": "0.0.0.0",
    "port": 9080,
    "threads": 2,
    "max_request_size": 1048576,
    "max_response_size": 1048576,
    "database_url": "sqlite://./data.db",
    "jwt_secret": "your-secret-key-change-in-production",
    "jwt_expiry_hours": 24,
    "log_level": "info",
    "rate_limit_requests": 100,
    "rate_limit_window_seconds": 60,
    "cache_enabled": true,
    "cache_ttl_seconds": 300
}
`,

    // Build script for Pistache
    'scripts/install-pistache.sh': `#!/bin/bash
set -e

# Install Pistache
echo "Installing Pistache..."

# Install dependencies
sudo apt-get update
sudo apt-get install -y \\
    cmake \\
    build-essential \\
    libssl-dev \\
    pkg-config \\
    rapidjson-dev

# Clone and build Pistache
git clone https://github.com/pistacheio/pistache.git
cd pistache
mkdir build && cd build
cmake -G "Unix Makefiles" \\
    -DCMAKE_BUILD_TYPE=Release \\
    -DPISTACHE_BUILD_EXAMPLES=OFF \\
    -DPISTACHE_BUILD_TESTS=OFF \\
    -DPISTACHE_BUILD_DOCS=OFF \\
    ..
make -j$(nproc)
sudo make install

echo "Pistache installed successfully!"
`,

    'Dockerfile': `# Build stage
FROM ubuntu:22.04 AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    pkg-config \\
    libssl-dev \\
    rapidjson-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Pistache
WORKDIR /tmp
RUN git clone https://github.com/pistacheio/pistache.git && \\
    cd pistache && \\
    mkdir build && cd build && \\
    cmake -G "Unix Makefiles" \\
        -DCMAKE_BUILD_TYPE=Release \\
        -DPISTACHE_BUILD_EXAMPLES=OFF \\
        -DPISTACHE_BUILD_TESTS=OFF \\
        -DPISTACHE_BUILD_DOCS=OFF \\
        .. && \\
    make -j$(nproc) && \\
    make install

# Build application
WORKDIR /app
COPY . .
RUN mkdir build && cd build && \\
    cmake .. -DCMAKE_BUILD_TYPE=Release && \\
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libssl3 \\
    && rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd -m -s /bin/bash appuser

# Copy binary and config
COPY --from=builder /app/build/{{serviceName}} /usr/local/bin/
COPY --from=builder /app/config.json /etc/{{serviceName}}/
COPY --from=builder /usr/local/lib/libpistache* /usr/local/lib/

# Update library cache
RUN ldconfig

# Set ownership
RUN chown -R appuser:appuser /etc/{{serviceName}}

USER appuser
EXPOSE 9080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:9080/health || exit 1

CMD ["{{serviceName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{serviceName}}
    ports:
      - "9080:9080"
    volumes:
      - ./config.json:/etc/{{serviceName}}/config.json:ro
      - ./logs:/var/log/{{serviceName}}
    environment:
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9080/health"]
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
`,

    'README.md': `# {{serviceName}}

A modern C++ REST API server built with the Pistache framework.

## Features

- 🚀 High-performance async HTTP server
- 🔐 JWT authentication
- 🌐 CORS support
- 📝 Request/response logging
- 🚦 Rate limiting
- 💾 In-memory caching
- ✅ Input validation
- 🧪 Comprehensive test suite
- 🐳 Docker support
- 📊 Health checks and metrics

## Requirements

- C++17 or later
- CMake 3.16+
- Pistache framework
- OpenSSL

## Building

### Install Pistache

\`\`\`bash
chmod +x scripts/install-pistache.sh
./scripts/install-pistache.sh
\`\`\`

### Build Application

\`\`\`bash
mkdir build && cd build
cmake ..
make -j$(nproc)
\`\`\`

### Docker Build

\`\`\`bash
docker build -t {{serviceName}} .
docker run -p 9080:9080 {{serviceName}}
\`\`\`

Or with docker-compose:

\`\`\`bash
docker-compose up
\`\`\`

## Running

\`\`\`bash
./build/{{serviceName}}
\`\`\`

The server will start on port 9080.

## API Endpoints

### Public Endpoints
- \`GET /health\` - Health check
- \`GET /metrics\` - Server metrics
- \`POST /api/users/register\` - User registration
- \`POST /api/users/login\` - User login

### Protected Endpoints (Requires JWT)
- \`GET /api/users\` - List users
- \`GET /api/users/:id\` - Get user
- \`PUT /api/users/:id\` - Update user
- \`DELETE /api/users/:id\` - Delete user

### Rate Limiting

All endpoints are rate-limited to 100 requests per minute per IP address. Rate limit information is included in response headers:

- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Timestamp when the window resets

## Configuration

Edit \`config.json\` to configure:

- Server settings (port, threads)
- JWT configuration
- Rate limiting
- Cache settings
- Logging

## Testing

Run the test suite:

\`\`\`bash
cd build
ctest --verbose
\`\`\`

## Performance

Pistache provides excellent performance:
- Async request handling
- Efficient thread pool
- Minimal overhead
- Built for high concurrency

## Development

### Project Structure

\`\`\`
.
├── CMakeLists.txt
├── include/
│   ├── server/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── models/
│   └── utils/
├── src/
│   ├── main.cpp
│   └── ...
├── tests/
├── scripts/
└── config.json
\`\`\`

### Adding Routes

1. Create route handler in \`include/routes/\`
2. Implement in \`src/routes/\`
3. Register in \`server.cpp\`

### Adding Middleware

1. Inherit from \`Pistache::Http::Middleware\`
2. Implement \`onRequest\` and/or \`onResponse\`
3. Register in server setup

## License

MIT
`
  }
};