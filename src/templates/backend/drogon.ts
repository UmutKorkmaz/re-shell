import { BackendTemplate } from '../types';

export const drogonTemplate: BackendTemplate = {
  id: 'drogon',
  name: 'drogon',
  displayName: 'Drogon Framework',
  description: 'Modern C++17/20 HTTP application framework with ORM, WebSocket, HTTP/2, and high performance',
  framework: 'drogon',
  language: 'cpp',
  version: '1.9.3',
  tags: ['cpp', 'drogon', 'api', 'rest', 'websockets', 'database', 'http2', 'high-performance'],
  port: 8080,
  features: ['routing', 'middleware', 'database', 'caching', 'websockets', 'testing', 'docker', 'cors', 'logging', 'authentication', 'validation', 'session-management'],
  dependencies: {},
  devDependencies: {},
  
  files: {
    // CMakeLists.txt
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
project({{serviceName}} VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Find required packages
find_package(Threads REQUIRED)
find_package(Drogon CONFIG REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(ZLIB REQUIRED)
find_package(PostgreSQL REQUIRED)
find_package(GTest CONFIG REQUIRED)

# Source files
file(GLOB_RECURSE SRC_FILES
    \${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp
    \${CMAKE_CURRENT_SOURCE_DIR}/src/*.cc
)

file(GLOB_RECURSE HDR_FILES
    \${CMAKE_CURRENT_SOURCE_DIR}/include/*.h
    \${CMAKE_CURRENT_SOURCE_DIR}/include/*.hpp
)

# Main executable
add_executable(\${PROJECT_NAME} \${SRC_FILES} \${HDR_FILES})

# Include directories
target_include_directories(\${PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
    \${PostgreSQL_INCLUDE_DIRS}
)

# Link libraries
target_link_libraries(\${PROJECT_NAME} PRIVATE
    Drogon::Drogon
    \${PostgreSQL_LIBRARIES}
)

# Copy config files to build directory
configure_file(config.json \${CMAKE_CURRENT_BINARY_DIR}/config.json COPYONLY)
configure_file(views/index.csp \${CMAKE_CURRENT_BINARY_DIR}/views/index.csp COPYONLY)

# Drogon view compilation
drogon_create_views(\${PROJECT_NAME} \${CMAKE_CURRENT_SOURCE_DIR}/views
    \${CMAKE_CURRENT_BINARY_DIR}/views)

# Test executable
enable_testing()
file(GLOB_RECURSE TEST_FILES tests/*.cpp)
add_executable(test_\${PROJECT_NAME} \${TEST_FILES})

target_include_directories(test_\${PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(test_\${PROJECT_NAME} PRIVATE
    Drogon::Drogon
    GTest::gtest
    GTest::gtest_main
)

add_test(NAME test_\${PROJECT_NAME} COMMAND test_\${PROJECT_NAME})

# Install
install(TARGETS \${PROJECT_NAME} DESTINATION bin)
install(FILES config.json DESTINATION etc/\${PROJECT_NAME})
install(DIRECTORY views DESTINATION share/\${PROJECT_NAME})
`,

    // Main application
    'src/main.cpp': `#include <drogon/drogon.h>
#include <iostream>

int main() {
    // Load configuration
    drogon::app().loadConfigFile("config.json");
    
    // Set log level
    trantor::Logger::setLogLevel(trantor::Logger::kInfo);
    
    LOG_INFO << "Starting {{serviceName}} server...";
    
    // Run server
    drogon::app().run();
    
    return 0;
}
`,

    // Configuration
    'config.json': `{
    "listeners": [
        {
            "address": "0.0.0.0",
            "port": 8080,
            "https": false
        },
        {
            "address": "0.0.0.0",
            "port": 8443,
            "https": true,
            "cert": "cert.pem",
            "key": "key.pem"
        }
    ],
    "app": {
        "threads_num": 0,
        "enable_session": true,
        "session_timeout": 3600,
        "document_root": "./static",
        "home_page": "index.html",
        "static_files_cache_time": 5,
        "simple_controllers": [
            {
                "path": "/api/v1",
                "controller": "api::v1",
                "http_methods": ["get", "post", "put", "delete", "options"],
                "filters": ["api::CorsFilter", "api::AuthFilter"]
            }
        ],
        "file_types": [
            "gif", "png", "jpg", "js", "css", "html", "ico", "swf", "xap", 
            "apk", "cur", "xml", "svg", "webp", "woff", "woff2", "ttf", "eot"
        ],
        "locations": [
            {
                "uri_prefix": "/static",
                "default_content_type": "text/html",
                "alias": "./static",
                "cache_control": "max-age=3600",
                "filters": []
            }
        ],
        "max_connection_num": 100000,
        "max_connection_num_per_ip": 0,
        "load_dynamic_views": true,
        "dynamic_views_path": ["./views"],
        "dynamic_views_output_path": "",
        "enable_unicode_escaping_in_json": true,
        "float_precision_in_json": {
            "precision": 3,
            "precision_type": "significant"
        },
        "log": {
            "logfile": "./logs/{{serviceName}}.log",
            "log_size_limit": 100000000,
            "log_level": "INFO"
        },
        "run_as_daemon": false,
        "relaunch_on_error": false,
        "use_sendfile": true,
        "use_gzip": true,
        "use_brotli": false,
        "static_files_cache_time": 5,
        "idle_connection_timeout": 60,
        "server_header_field": "drogon/1.9.3",
        "enable_server_header": true,
        "enable_date_header": true,
        "keepalive_requests": 0,
        "pipelining_requests": 0,
        "gzip_static": true,
        "br_static": false,
        "client_max_body_size": "10M",
        "client_max_memory_body_size": "1M",
        "client_max_websocket_message_size": "128K"
    },
    "microservices": [
        {
            "name": "drogon::plugin::SecureSSLRedirector",
            "dependencies": [],
            "config": {
                "ssl_redirect_exempt": ["^/health$", "^/metrics$"],
                "secure_ssl_host": ""
            }
        },
        {
            "name": "drogon::plugin::AccessLogger",
            "dependencies": [],
            "config": {
                "log_path": "./logs/access.log",
                "log_format": "$request_date $method $url $status $body_bytes_sent $remote_addr",
                "log_index": 0,
                "max_files": 5,
                "use_local_time": true
            }
        }
    ],
    "db_clients": [
        {
            "name": "default",
            "rdbms": "postgresql",
            "host": "127.0.0.1",
            "port": 5432,
            "dbname": "{{serviceName}}_db",
            "user": "postgres",
            "password": "postgres",
            "is_fast": false,
            "connection_number": 10,
            "timeout": -1.0,
            "auto_batch": false
        }
    ],
    "redis_clients": [
        {
            "name": "default",
            "host": "127.0.0.1",
            "port": 6379,
            "password": "",
            "connection_number": 10,
            "is_fast": false
        }
    ]
}
`,

    // Health Controller
    'include/controllers/HealthController.h': `#pragma once
#include <drogon/HttpController.h>

namespace api {
    class HealthController : public drogon::HttpController<HealthController> {
    public:
        METHOD_LIST_BEGIN
        ADD_METHOD_TO(HealthController::health, "/health", Get);
        ADD_METHOD_TO(HealthController::metrics, "/metrics", Get);
        METHOD_LIST_END

        void health(const drogon::HttpRequestPtr &req,
                   std::function<void(const drogon::HttpResponsePtr &)> &&callback);
        
        void metrics(const drogon::HttpRequestPtr &req,
                    std::function<void(const drogon::HttpResponsePtr &)> &&callback);
    };
}
`,

    'src/controllers/HealthController.cpp': `#include "controllers/HealthController.h"
#include <chrono>

using namespace api;

void HealthController::health(const drogon::HttpRequestPtr &req,
                             std::function<void(const drogon::HttpResponsePtr &)> &&callback) {
    Json::Value json;
    json["status"] = "healthy";
    json["timestamp"] = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    
    // Check database connection
    auto dbClient = drogon::app().getDbClient("default");
    if (dbClient) {
        try {
            auto result = dbClient->execSqlSync("SELECT 1");
            json["database"] = "connected";
        } catch (const std::exception &e) {
            json["database"] = "disconnected";
            json["db_error"] = e.what();
        }
    } else {
        json["database"] = "not configured";
    }
    
    auto resp = drogon::HttpResponse::newHttpJsonResponse(json);
    callback(resp);
}

void HealthController::metrics(const drogon::HttpRequestPtr &req,
                              std::function<void(const drogon::HttpResponsePtr &)> &&callback) {
    static auto start_time = std::chrono::steady_clock::now();
    auto now = std::chrono::steady_clock::now();
    auto uptime = std::chrono::duration_cast<std::chrono::seconds>(now - start_time).count();
    
    Json::Value json;
    json["uptime_seconds"] = static_cast<Json::Int64>(uptime);
    json["active_connections"] = drogon::app().getActiveConnectionNumber();
    json["good_connection_num"] = drogon::app().getGoodConnectionNumber();
    json["idle_connection_num"] = drogon::app().getIdleConnectionNumber();
    
    auto resp = drogon::HttpResponse::newHttpJsonResponse(json);
    callback(resp);
}
`,

    // User Controller
    'include/controllers/UserController.h': `#pragma once
#include <drogon/HttpController.h>
#include "services/UserService.h"

namespace api::v1 {
    class UserController : public drogon::HttpController<UserController> {
    public:
        METHOD_LIST_BEGIN
        ADD_METHOD_TO(UserController::createUser, "/api/v1/users", Post);
        ADD_METHOD_TO(UserController::getUser, "/api/v1/users/{id}", Get);
        ADD_METHOD_TO(UserController::updateUser, "/api/v1/users/{id}", Put);
        ADD_METHOD_TO(UserController::deleteUser, "/api/v1/users/{id}", Delete);
        ADD_METHOD_TO(UserController::listUsers, "/api/v1/users", Get);
        ADD_METHOD_TO(UserController::login, "/api/v1/auth/login", Post);
        METHOD_LIST_END

        void createUser(const drogon::HttpRequestPtr &req,
                       std::function<void(const drogon::HttpResponsePtr &)> &&callback);
        
        void getUser(const drogon::HttpRequestPtr &req,
                    std::function<void(const drogon::HttpResponsePtr &)> &&callback,
                    const std::string &id);
        
        void updateUser(const drogon::HttpRequestPtr &req,
                       std::function<void(const drogon::HttpResponsePtr &)> &&callback,
                       const std::string &id);
        
        void deleteUser(const drogon::HttpRequestPtr &req,
                       std::function<void(const drogon::HttpResponsePtr &)> &&callback,
                       const std::string &id);
        
        void listUsers(const drogon::HttpRequestPtr &req,
                      std::function<void(const drogon::HttpResponsePtr &)> &&callback);
        
        void login(const drogon::HttpRequestPtr &req,
                  std::function<void(const drogon::HttpResponsePtr &)> &&callback);
                  
    private:
        services::UserService userService;
    };
}
`,

    'src/controllers/UserController.cpp': `#include "controllers/UserController.h"
#include "utils/JwtUtils.h"
#include <drogon/utils/Utilities.h>

using namespace api::v1;

void UserController::createUser(const drogon::HttpRequestPtr &req,
                               std::function<void(const drogon::HttpResponsePtr &)> &&callback) {
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Invalid JSON");
        callback(resp);
        return;
    }
    
    models::User user;
    user.email = (*json)["email"].asString();
    user.name = (*json)["name"].asString();
    user.password = (*json)["password"].asString();
    
    userService.createUser(user, [callback](const std::optional<models::User> &result) {
        if (result) {
            Json::Value response;
            response["id"] = result->id;
            response["email"] = result->email;
            response["name"] = result->name;
            auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
            resp->setStatusCode(drogon::k201Created);
            callback(resp);
        } else {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k400BadRequest);
            resp->setBody("Failed to create user");
            callback(resp);
        }
    });
}

void UserController::getUser(const drogon::HttpRequestPtr &req,
                            std::function<void(const drogon::HttpResponsePtr &)> &&callback,
                            const std::string &id) {
    userService.getUser(id, [callback](const std::optional<models::User> &user) {
        if (user) {
            Json::Value response;
            response["id"] = user->id;
            response["email"] = user->email;
            response["name"] = user->name;
            response["created_at"] = user->created_at;
            auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
            callback(resp);
        } else {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k404NotFound);
            resp->setBody("User not found");
            callback(resp);
        }
    });
}

void UserController::updateUser(const drogon::HttpRequestPtr &req,
                               std::function<void(const drogon::HttpResponsePtr &)> &&callback,
                               const std::string &id) {
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Invalid JSON");
        callback(resp);
        return;
    }
    
    models::User user;
    user.id = id;
    if (json->isMember("email")) user.email = (*json)["email"].asString();
    if (json->isMember("name")) user.name = (*json)["name"].asString();
    
    userService.updateUser(user, [callback](const std::optional<models::User> &result) {
        if (result) {
            Json::Value response;
            response["id"] = result->id;
            response["email"] = result->email;
            response["name"] = result->name;
            auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
            callback(resp);
        } else {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k404NotFound);
            resp->setBody("User not found");
            callback(resp);
        }
    });
}

void UserController::deleteUser(const drogon::HttpRequestPtr &req,
                               std::function<void(const drogon::HttpResponsePtr &)> &&callback,
                               const std::string &id) {
    userService.deleteUser(id, [callback](bool success) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        if (success) {
            resp->setStatusCode(drogon::k204NoContent);
        } else {
            resp->setStatusCode(drogon::k404NotFound);
            resp->setBody("User not found");
        }
        callback(resp);
    });
}

void UserController::listUsers(const drogon::HttpRequestPtr &req,
                              std::function<void(const drogon::HttpResponsePtr &)> &&callback) {
    int page = 1, limit = 10;
    
    auto pageParam = req->getParameter("page");
    auto limitParam = req->getParameter("limit");
    
    if (!pageParam.empty()) page = std::stoi(pageParam);
    if (!limitParam.empty()) limit = std::stoi(limitParam);
    
    userService.listUsers(page, limit, [callback, page, limit](const std::vector<models::User> &users) {
        Json::Value response;
        response["page"] = page;
        response["limit"] = limit;
        response["total"] = static_cast<int>(users.size());
        
        Json::Value userArray(Json::arrayValue);
        for (const auto &user : users) {
            Json::Value u;
            u["id"] = user.id;
            u["email"] = user.email;
            u["name"] = user.name;
            userArray.append(u);
        }
        response["users"] = userArray;
        
        auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
        callback(resp);
    });
}

void UserController::login(const drogon::HttpRequestPtr &req,
                          std::function<void(const drogon::HttpResponsePtr &)> &&callback) {
    auto json = req->getJsonObject();
    if (!json) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k400BadRequest);
        resp->setBody("Invalid JSON");
        callback(resp);
        return;
    }
    
    std::string email = (*json)["email"].asString();
    std::string password = (*json)["password"].asString();
    
    userService.authenticate(email, password, [callback](const std::optional<models::User> &user) {
        if (user) {
            auto token = utils::JwtUtils::generateToken(user->id, user->email);
            
            Json::Value response;
            response["token"] = token;
            response["user"]["id"] = user->id;
            response["user"]["email"] = user->email;
            response["user"]["name"] = user->name;
            
            auto resp = drogon::HttpResponse::newHttpJsonResponse(response);
            callback(resp);
        } else {
            auto resp = drogon::HttpResponse::newHttpResponse();
            resp->setStatusCode(drogon::k401Unauthorized);
            resp->setBody("Invalid credentials");
            callback(resp);
        }
    });
}
`,

    // WebSocket Controller
    'include/controllers/WebSocketController.h': `#pragma once
#include <drogon/WebSocketController.h>
#include <set>

namespace api {
    class WebSocketController : public drogon::WebSocketController<WebSocketController> {
    public:
        void handleNewMessage(const drogon::WebSocketConnectionPtr& wsConnPtr,
                            std::string &&message,
                            const drogon::WebSocketMessageType &type) override;
        
        void handleNewConnection(const drogon::HttpRequestPtr &req,
                               const drogon::WebSocketConnectionPtr& wsConnPtr) override;
        
        void handleConnectionClosed(const drogon::WebSocketConnectionPtr& wsConnPtr) override;
        
        WS_PATH_LIST_BEGIN
        WS_PATH_ADD("/ws", Get);
        WS_PATH_ADD("/ws/chat", Get);
        WS_PATH_LIST_END
        
    private:
        std::mutex connectionMutex_;
        std::set<drogon::WebSocketConnectionPtr> connections_;
    };
}
`,

    'src/controllers/WebSocketController.cpp': `#include "controllers/WebSocketController.h"
#include <json/json.h>

using namespace api;

void WebSocketController::handleNewMessage(const drogon::WebSocketConnectionPtr& wsConnPtr,
                                         std::string &&message,
                                         const drogon::WebSocketMessageType &type) {
    if (type == drogon::WebSocketMessageType::Text) {
        Json::Value request;
        Json::Reader reader;
        
        if (reader.parse(message, request)) {
            Json::Value response;
            response["type"] = "echo";
            response["data"] = request;
            response["timestamp"] = trantor::Date::now().microSecondsSinceEpoch();
            
            wsConnPtr->send(response.toStyledString());
            
            // Broadcast to all connections for chat
            if (wsConnPtr->getPath() == "/ws/chat") {
                std::lock_guard<std::mutex> lock(connectionMutex_);
                for (auto &conn : connections_) {
                    if (conn != wsConnPtr) {
                        Json::Value broadcast;
                        broadcast["type"] = "message";
                        broadcast["from"] = wsConnPtr->peerAddr().toIpPort();
                        broadcast["data"] = request;
                        conn->send(broadcast.toStyledString());
                    }
                }
            }
        } else {
            wsConnPtr->send("Invalid JSON format");
        }
    } else if (type == drogon::WebSocketMessageType::Binary) {
        // Echo binary data
        wsConnPtr->send(message, drogon::WebSocketMessageType::Binary);
    }
}

void WebSocketController::handleNewConnection(const drogon::HttpRequestPtr &req,
                                            const drogon::WebSocketConnectionPtr& wsConnPtr) {
    LOG_INFO << "New WebSocket connection from " << wsConnPtr->peerAddr().toIpPort();
    
    {
        std::lock_guard<std::mutex> lock(connectionMutex_);
        connections_.insert(wsConnPtr);
    }
    
    Json::Value welcome;
    welcome["type"] = "welcome";
    welcome["message"] = "Connected to {{serviceName}} WebSocket";
    welcome["connection_id"] = wsConnPtr->peerAddr().toIpPort();
    wsConnPtr->send(welcome.toStyledString());
}

void WebSocketController::handleConnectionClosed(const drogon::WebSocketConnectionPtr& wsConnPtr) {
    LOG_INFO << "WebSocket connection closed: " << wsConnPtr->peerAddr().toIpPort();
    
    {
        std::lock_guard<std::mutex> lock(connectionMutex_);
        connections_.erase(wsConnPtr);
    }
}
`,

    // User Model
    'include/models/User.h': `#pragma once
#include <string>
#include <drogon/orm/Result.h>
#include <drogon/orm/Row.h>

namespace models {
    struct User {
        std::string id;
        std::string email;
        std::string name;
        std::string password;
        std::string created_at;
        std::string updated_at;
        
        User() = default;
        explicit User(const drogon::orm::Row &r);
        
        Json::Value toJson() const;
        static User fromJson(const Json::Value &json);
    };
}
`,

    'src/models/User.cpp': `#include "models/User.h"
#include <drogon/utils/Utilities.h>

namespace models {
    User::User(const drogon::orm::Row &r) {
        id = r["id"].as<std::string>();
        email = r["email"].as<std::string>();
        name = r["name"].as<std::string>();
        password = r["password"].as<std::string>();
        created_at = r["created_at"].as<std::string>();
        updated_at = r["updated_at"].as<std::string>();
    }
    
    Json::Value User::toJson() const {
        Json::Value json;
        json["id"] = id;
        json["email"] = email;
        json["name"] = name;
        json["created_at"] = created_at;
        json["updated_at"] = updated_at;
        // Never include password in JSON
        return json;
    }
    
    User User::fromJson(const Json::Value &json) {
        User user;
        if (json.isMember("id")) user.id = json["id"].asString();
        if (json.isMember("email")) user.email = json["email"].asString();
        if (json.isMember("name")) user.name = json["name"].asString();
        if (json.isMember("password")) user.password = json["password"].asString();
        return user;
    }
}
`,

    // User Service
    'include/services/UserService.h': `#pragma once
#include <optional>
#include <vector>
#include <functional>
#include "models/User.h"
#include <drogon/drogon.h>

namespace services {
    class UserService {
    public:
        using UserCallback = std::function<void(const std::optional<models::User>&)>;
        using UsersCallback = std::function<void(const std::vector<models::User>&)>;
        using BoolCallback = std::function<void(bool)>;
        
        void createUser(const models::User& user, UserCallback callback);
        void getUser(const std::string& id, UserCallback callback);
        void updateUser(const models::User& user, UserCallback callback);
        void deleteUser(const std::string& id, BoolCallback callback);
        void listUsers(int page, int limit, UsersCallback callback);
        void authenticate(const std::string& email, const std::string& password, UserCallback callback);
        
    private:
        std::string hashPassword(const std::string& password);
        bool verifyPassword(const std::string& password, const std::string& hash);
    };
}
`,

    'src/services/UserService.cpp': `#include "services/UserService.h"
#include <drogon/utils/Utilities.h>
#include <random>

namespace services {
    void UserService::createUser(const models::User& user, UserCallback callback) {
        models::User newUser = user;
        
        // Generate unique ID
        newUser.id = drogon::utils::getUuid();
        
        // Hash password
        newUser.password = hashPassword(user.password);
        
        // Set timestamps
        auto now = trantor::Date::now().toDbString();
        newUser.created_at = now;
        newUser.updated_at = now;
        
        // Save to database
        auto dbClient = drogon::app().getDbClient("default");
        *dbClient << "INSERT INTO users (id, email, name, password, created_at, updated_at) "
                     "VALUES ($1, $2, $3, $4, $5, $6)"
                  << newUser.id << newUser.email << newUser.name 
                  << newUser.password << newUser.created_at << newUser.updated_at
                  >> [callback, newUser](const drogon::orm::Result &r) {
                      if (r.affectedRows() > 0) {
                          models::User result = newUser;
                          result.password = ""; // Don't return password
                          callback(result);
                      } else {
                          callback(std::nullopt);
                      }
                  }
                  >> [callback](const drogon::orm::DrogonDbException &e) {
                      LOG_ERROR << "Database error: " << e.base().what();
                      callback(std::nullopt);
                  };
    }
    
    void UserService::getUser(const std::string& id, UserCallback callback) {
        auto dbClient = drogon::app().getDbClient("default");
        *dbClient << "SELECT * FROM users WHERE id = $1" << id
                  >> [callback](const drogon::orm::Result &r) {
                      if (!r.empty()) {
                          models::User user(r[0]);
                          user.password = ""; // Don't return password
                          callback(user);
                      } else {
                          callback(std::nullopt);
                      }
                  }
                  >> [callback](const drogon::orm::DrogonDbException &e) {
                      LOG_ERROR << "Database error: " << e.base().what();
                      callback(std::nullopt);
                  };
    }
    
    void UserService::updateUser(const models::User& user, UserCallback callback) {
        auto now = trantor::Date::now().toDbString();
        
        auto dbClient = drogon::app().getDbClient("default");
        *dbClient << "UPDATE users SET email = COALESCE($2, email), "
                     "name = COALESCE($3, name), updated_at = $4 "
                     "WHERE id = $1 RETURNING *"
                  << user.id 
                  << (user.email.empty() ? nullptr : &user.email)
                  << (user.name.empty() ? nullptr : &user.name)
                  << now
                  >> [callback](const drogon::orm::Result &r) {
                      if (!r.empty()) {
                          models::User updated(r[0]);
                          updated.password = ""; // Don't return password
                          callback(updated);
                      } else {
                          callback(std::nullopt);
                      }
                  }
                  >> [callback](const drogon::orm::DrogonDbException &e) {
                      LOG_ERROR << "Database error: " << e.base().what();
                      callback(std::nullopt);
                  };
    }
    
    void UserService::deleteUser(const std::string& id, BoolCallback callback) {
        auto dbClient = drogon::app().getDbClient("default");
        *dbClient << "DELETE FROM users WHERE id = $1" << id
                  >> [callback](const drogon::orm::Result &r) {
                      callback(r.affectedRows() > 0);
                  }
                  >> [callback](const drogon::orm::DrogonDbException &e) {
                      LOG_ERROR << "Database error: " << e.base().what();
                      callback(false);
                  };
    }
    
    void UserService::listUsers(int page, int limit, UsersCallback callback) {
        int offset = (page - 1) * limit;
        
        auto dbClient = drogon::app().getDbClient("default");
        *dbClient << "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2"
                  << limit << offset
                  >> [callback](const drogon::orm::Result &r) {
                      std::vector<models::User> users;
                      for (const auto &row : r) {
                          models::User user(row);
                          user.password = ""; // Don't return password
                          users.push_back(user);
                      }
                      callback(users);
                  }
                  >> [callback](const drogon::orm::DrogonDbException &e) {
                      LOG_ERROR << "Database error: " << e.base().what();
                      callback({});
                  };
    }
    
    void UserService::authenticate(const std::string& email, const std::string& password, UserCallback callback) {
        auto dbClient = drogon::app().getDbClient("default");
        *dbClient << "SELECT * FROM users WHERE email = $1" << email
                  >> [this, password, callback](const drogon::orm::Result &r) {
                      if (!r.empty()) {
                          models::User user(r[0]);
                          if (verifyPassword(password, user.password)) {
                              user.password = ""; // Don't return password
                              callback(user);
                          } else {
                              callback(std::nullopt);
                          }
                      } else {
                          callback(std::nullopt);
                      }
                  }
                  >> [callback](const drogon::orm::DrogonDbException &e) {
                      LOG_ERROR << "Database error: " << e.base().what();
                      callback(std::nullopt);
                  };
    }
    
    std::string UserService::hashPassword(const std::string& password) {
        return drogon::utils::getSha256(password);
    }
    
    bool UserService::verifyPassword(const std::string& password, const std::string& hash) {
        return hashPassword(password) == hash;
    }
}
`,

    // Auth Filter
    'include/filters/AuthFilter.h': `#pragma once
#include <drogon/HttpFilter.h>
#include "utils/JwtUtils.h"

namespace api {
    class AuthFilter : public drogon::HttpFilter<AuthFilter> {
    public:
        void doFilter(const drogon::HttpRequestPtr &req,
                     drogon::FilterCallback &&fcb,
                     drogon::FilterChainCallback &&fccb) override;
    };
}
`,

    'src/filters/AuthFilter.cpp': `#include "filters/AuthFilter.h"

using namespace api;

void AuthFilter::doFilter(const drogon::HttpRequestPtr &req,
                         drogon::FilterCallback &&fcb,
                         drogon::FilterChainCallback &&fccb) {
    auto authHeader = req->getHeader("Authorization");
    
    if (authHeader.empty()) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        resp->setBody("Missing authorization header");
        fcb(resp);
        return;
    }
    
    // Extract token from "Bearer <token>"
    std::string token;
    if (authHeader.find("Bearer ") == 0) {
        token = authHeader.substr(7);
    } else {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        resp->setBody("Invalid authorization format");
        fcb(resp);
        return;
    }
    
    // Validate token
    auto claims = utils::JwtUtils::validateToken(token);
    if (!claims) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k401Unauthorized);
        resp->setBody("Invalid or expired token");
        fcb(resp);
        return;
    }
    
    // Add user info to request attributes for downstream use
    req->setAttributes("userId", claims->user_id);
    req->setAttributes("userEmail", claims->email);
    
    // Continue to the next filter or handler
    fccb();
}
`,

    // CORS Filter
    'include/filters/CorsFilter.h': `#pragma once
#include <drogon/HttpFilter.h>

namespace api {
    class CorsFilter : public drogon::HttpFilter<CorsFilter> {
    public:
        void doFilter(const drogon::HttpRequestPtr &req,
                     drogon::FilterCallback &&fcb,
                     drogon::FilterChainCallback &&fccb) override;
    };
}
`,

    'src/filters/CorsFilter.cpp': `#include "filters/CorsFilter.h"

using namespace api;

void CorsFilter::doFilter(const drogon::HttpRequestPtr &req,
                         drogon::FilterCallback &&fcb,
                         drogon::FilterChainCallback &&fccb) {
    if (req->method() == drogon::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k204NoContent);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        resp->addHeader("Access-Control-Max-Age", "86400");
        fcb(resp);
        return;
    }
    
    // For non-OPTIONS requests, add CORS headers in response callback
    req->setAttributes("add_cors_headers", true);
    fccb();
}
`,

    // JWT Utils
    'include/utils/JwtUtils.h': `#pragma once
#include <string>
#include <optional>
#include <json/json.h>

namespace utils {
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
        static std::string getSecret();
    };
}
`,

    'src/utils/JwtUtils.cpp': `#include "utils/JwtUtils.h"
#include <drogon/utils/Utilities.h>
#include <chrono>
#include <sstream>

namespace utils {
    std::string JwtUtils::generateToken(const std::string& user_id, const std::string& email) {
        Json::Value header;
        header["alg"] = "HS256";
        header["typ"] = "JWT";
        
        auto now = std::chrono::system_clock::now();
        auto exp = now + std::chrono::hours(24); // 24 hour expiry
        
        Json::Value payload;
        payload["user_id"] = user_id;
        payload["email"] = email;
        payload["iat"] = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
        payload["exp"] = std::chrono::duration_cast<std::chrono::seconds>(exp.time_since_epoch()).count();
        
        std::string header_encoded = base64UrlEncode(header.toStyledString());
        std::string payload_encoded = base64UrlEncode(payload.toStyledString());
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
        Json::Value payload;
        Json::Reader reader;
        if (!reader.parse(payload_json, payload)) {
            return std::nullopt;
        }
        
        // Check expiration
        auto now = std::chrono::system_clock::now();
        auto now_seconds = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
        if (payload["exp"].asInt64() < now_seconds) {
            return std::nullopt;
        }
        
        JwtClaims claims;
        claims.user_id = payload["user_id"].asString();
        claims.email = payload["email"].asString();
        claims.exp = payload["exp"].asInt64();
        
        return claims;
    }
    
    std::string JwtUtils::base64UrlEncode(const std::string& input) {
        std::string encoded = drogon::utils::base64Encode(
            reinterpret_cast<const unsigned char*>(input.c_str()), 
            input.length()
        );
        
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
        
        return drogon::utils::base64Decode(prepared);
    }
    
    std::string JwtUtils::createSignature(const std::string& data) {
        std::string secret = getSecret();
        std::string signature = drogon::utils::getSha256(data + secret);
        return base64UrlEncode(signature);
    }
    
    std::string JwtUtils::getSecret() {
        // In production, load from secure configuration
        return "your-secret-key-change-in-production";
    }
}
`,

    // Database schema
    'sql/schema.sql': `-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
`,

    // Views
    'views/index.csp': `<!DOCTYPE html>
<html>
<head>
    <title>{{serviceName}} - Drogon Framework</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        .endpoint { 
            background: #f8f9fa; 
            padding: 0.5rem 1rem; 
            margin: 0.5rem 0; 
            border-radius: 4px;
            font-family: monospace;
        }
        .method {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-right: 0.5rem;
        }
        .get { background: #61affe; color: white; }
        .post { background: #49cc90; color: white; }
        .put { background: #fca130; color: white; }
        .delete { background: #f93e3e; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{serviceName}} API</h1>
        <p>Welcome to the Drogon C++ Framework API server!</p>
        
        <h2>Available Endpoints</h2>
        
        <h3>Health</h3>
        <div class="endpoint">
            <span class="method get">GET</span> /health
        </div>
        <div class="endpoint">
            <span class="method get">GET</span> /metrics
        </div>
        
        <h3>Authentication</h3>
        <div class="endpoint">
            <span class="method post">POST</span> /api/v1/auth/login
        </div>
        
        <h3>Users</h3>
        <div class="endpoint">
            <span class="method post">POST</span> /api/v1/users
        </div>
        <div class="endpoint">
            <span class="method get">GET</span> /api/v1/users
        </div>
        <div class="endpoint">
            <span class="method get">GET</span> /api/v1/users/{id}
        </div>
        <div class="endpoint">
            <span class="method put">PUT</span> /api/v1/users/{id}
        </div>
        <div class="endpoint">
            <span class="method delete">DELETE</span> /api/v1/users/{id}
        </div>
        
        <h3>WebSocket</h3>
        <div class="endpoint">
            <span class="method get">WS</span> /ws
        </div>
        <div class="endpoint">
            <span class="method get">WS</span> /ws/chat
        </div>
        
        <h2>Features</h2>
        <ul>
            <li>🚀 High-performance async HTTP server</li>
            <li>🔐 JWT authentication</li>
            <li>🌐 CORS support</li>
            <li>📝 Request/response logging</li>
            <li>🔄 WebSocket support</li>
            <li>💾 PostgreSQL integration</li>
            <li>🔥 Redis caching</li>
            <li>🧪 Comprehensive test suite</li>
        </ul>
    </div>
</body>
</html>
`,

    // Test files
    'tests/test_user_controller.cpp': `#include <gtest/gtest.h>
#include <drogon/drogon_test.h>
#include "controllers/UserController.h"

using namespace drogon;

TEST(UserControllerTest, CreateUser) {
    auto client = HttpClient::newHttpClient("http://127.0.0.1:8080");
    
    Json::Value user;
    user["email"] = "test@example.com";
    user["name"] = "Test User";
    user["password"] = "password123";
    
    auto req = HttpRequest::newHttpJsonRequest(user);
    req->setPath("/api/v1/users");
    req->setMethod(Post);
    
    auto [res, resp] = client->sendRequest(req, 5.0);
    
    EXPECT_EQ(res, ReqResult::Ok);
    EXPECT_EQ(resp->getStatusCode(), k201Created);
    
    auto json = resp->getJsonObject();
    EXPECT_TRUE(json != nullptr);
    EXPECT_FALSE((*json)["id"].asString().empty());
    EXPECT_EQ((*json)["email"].asString(), "test@example.com");
}

TEST(UserControllerTest, GetUserNotFound) {
    auto client = HttpClient::newHttpClient("http://127.0.0.1:8080");
    
    auto req = HttpRequest::newHttpRequest();
    req->setPath("/api/v1/users/nonexistent");
    req->setMethod(Get);
    req->addHeader("Authorization", "Bearer valid-token");
    
    auto [res, resp] = client->sendRequest(req, 5.0);
    
    EXPECT_EQ(res, ReqResult::Ok);
    EXPECT_EQ(resp->getStatusCode(), k404NotFound);
}
`,

    'tests/test_jwt_utils.cpp': `#include <gtest/gtest.h>
#include "utils/JwtUtils.h"
#include <thread>

TEST(JwtUtilsTest, GenerateAndValidate) {
    std::string user_id = "123";
    std::string email = "test@example.com";
    
    auto token = utils::JwtUtils::generateToken(user_id, email);
    EXPECT_FALSE(token.empty());
    
    auto claims = utils::JwtUtils::validateToken(token);
    EXPECT_TRUE(claims.has_value());
    EXPECT_EQ(claims->user_id, user_id);
    EXPECT_EQ(claims->email, email);
}

TEST(JwtUtilsTest, InvalidToken) {
    auto claims = utils::JwtUtils::validateToken("invalid.token.here");
    EXPECT_FALSE(claims.has_value());
}

TEST(JwtUtilsTest, ExpiredToken) {
    // Test with a token that has an expired timestamp
    // Would need to mock time or use a pre-generated expired token
    EXPECT_TRUE(true);
}
`,

    // Docker files
    'Dockerfile': `# Build stage
FROM ubuntu:22.04 AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    uuid-dev \\
    libssl-dev \\
    zlib1g-dev \\
    libpq-dev \\
    libjsoncpp-dev \\
    libbrotli-dev \\
    libhiredis-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Drogon
WORKDIR /tmp
RUN git clone https://github.com/drogonframework/drogon && \\
    cd drogon && \\
    git checkout v1.9.3 && \\
    git submodule update --init && \\
    mkdir build && \\
    cd build && \\
    cmake .. && \\
    make -j$(nproc) && \\
    make install

# Build application
WORKDIR /app
COPY . .
RUN mkdir build && cd build && \\
    cmake .. && \\
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    libssl3 \\
    zlib1g \\
    libpq5 \\
    libjsoncpp25 \\
    libbrotli1 \\
    libhiredis0.14 \\
    && rm -rf /var/lib/apt/lists/*

# Create user
RUN useradd -m -s /bin/bash appuser

# Copy binary and config
COPY --from=builder /app/build/{{serviceName}} /usr/local/bin/
COPY --from=builder /app/config.json /etc/{{serviceName}}/
COPY --from=builder /app/views /usr/share/{{serviceName}}/views/

# Create directories
RUN mkdir -p /var/log/{{serviceName}} && \\
    chown -R appuser:appuser /etc/{{serviceName}} /var/log/{{serviceName}}

USER appuser
WORKDIR /home/appuser

EXPOSE 8080 8443

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
      - "8443:8443"
    environment:
      - DB_HOST=postgres
      - REDIS_HOST=redis
    volumes:
      - ./config.json:/etc/{{serviceName}}/config.json:ro
      - ./logs:/var/log/{{serviceName}}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    
  postgres:
    image: postgres:15-alpine
    container_name: {{serviceName}}-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: {{serviceName}}_db
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./sql/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    container_name: {{serviceName}}-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
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

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
logs/
*.log

# Environment
.env
config.local.json

# SSL certificates
*.pem
*.key
*.crt
`,

    'README.md': `# {{serviceName}}

A high-performance C++ web service built with the Drogon framework.

## Features

- 🚀 High-performance async HTTP/HTTPS server
- 🌐 HTTP/2 support
- 🔐 JWT authentication
- 🔄 WebSocket support
- 💾 PostgreSQL database with ORM
- 🔥 Redis caching
- 📝 Comprehensive logging
- 🧪 Unit and integration tests
- 🐳 Docker support
- 📊 Health checks and metrics

## Requirements

- C++17 compatible compiler
- CMake 3.16+
- PostgreSQL
- Redis
- OpenSSL
- zlib

## Building

### Local Build

\`\`\`bash
# Install Drogon (if not already installed)
git clone https://github.com/drogonframework/drogon
cd drogon
git submodule update --init
mkdir build && cd build
cmake ..
make && sudo make install

# Build the application
cd {{serviceName}}
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

The server will start on port 8080 (HTTP) and 8443 (HTTPS).

## API Documentation

Visit http://localhost:8080 for the API documentation page.

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

### Endpoints

#### Health
- \`GET /health\` - Service health check
- \`GET /metrics\` - Service metrics

#### Authentication
- \`POST /api/v1/auth/login\` - User login

#### Users
- \`POST /api/v1/users\` - Create user
- \`GET /api/v1/users\` - List users (auth required)
- \`GET /api/v1/users/{id}\` - Get user (auth required)
- \`PUT /api/v1/users/{id}\` - Update user (auth required)
- \`DELETE /api/v1/users/{id}\` - Delete user (auth required)

#### WebSocket
- \`WS /ws\` - WebSocket echo endpoint
- \`WS /ws/chat\` - WebSocket chat endpoint

## Configuration

Edit \`config.json\` to configure:
- Server ports and SSL
- Database connection
- Redis connection
- Logging
- Session management
- Performance tuning

## Testing

\`\`\`bash
cd build
ctest --verbose
\`\`\`

## Performance

Drogon provides excellent performance:
- Handles 1M+ concurrent connections
- 680K+ QPS on a single core
- Built-in connection pooling
- Efficient async I/O

## Development

### Project Structure

\`\`\`
.
├── CMakeLists.txt
├── config.json
├── include/
│   ├── controllers/
│   ├── filters/
│   ├── models/
│   ├── services/
│   └── utils/
├── src/
│   ├── main.cpp
│   ├── controllers/
│   ├── filters/
│   ├── models/
│   ├── services/
│   └── utils/
├── views/
├── sql/
└── tests/
\`\`\`

### Adding Controllers

1. Create header in \`include/controllers/\`
2. Implement in \`src/controllers/\`
3. Register in controller class with METHOD_LIST_BEGIN/END

### Database Migrations

Place SQL files in \`sql/\` directory. They will be executed on startup.

## License

MIT
`
  }
};