import { BackendTemplate } from '../types';

export const beastTemplate: BackendTemplate = {
  id: 'beast',
  name: 'beast',
  displayName: 'Boost.Beast WebSocket & HTTP',
  description: 'Modern C++ library for HTTP, WebSocket, and networking protocols built on Boost.Asio',
  framework: 'beast',
  language: 'cpp',
  version: '1.83.0',
  tags: ['cpp', 'beast', 'boost', 'websockets', 'http', 'networking'],
  port: 8085,
  features: ['websockets', 'authentication', 'cors', 'logging', 'testing', 'docker'],
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
find_package(Boost 1.83 REQUIRED COMPONENTS system thread)
find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)

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
    src/server/http_server.cpp
    src/server/websocket_server.cpp
    src/handlers/http_handler.cpp
    src/handlers/websocket_handler.cpp
    src/handlers/api_handler.cpp
    src/session/session_manager.cpp
    src/middleware/auth_middleware.cpp
    src/middleware/cors_middleware.cpp
    src/middleware/logging_middleware.cpp
    src/services/user_service.cpp
    src/utils/jwt_utils.cpp
    src/utils/ssl_context.cpp
    src/config/config.cpp
)

# Main executable
add_executable(\${PROJECT_NAME} \${SOURCES})

target_include_directories(\${PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
    \${Boost_INCLUDE_DIRS}
)

target_link_libraries(\${PROJECT_NAME} PRIVATE
    \${Boost_LIBRARIES}
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    jwt-cpp::jwt-cpp
    \${CMAKE_THREAD_LIBS_INIT}
    \${OPENSSL_LIBRARIES}
)

# Compiler options
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(\${PROJECT_NAME} PRIVATE
        -Wall -Wextra -Wpedantic -Wno-unused-parameter
        $<$<CONFIG:Debug>:-g -O0>
        $<$<CONFIG:Release>:-O3>
    )
endif()

# Tests
enable_testing()
add_executable(tests
    tests/test_main.cpp
    tests/test_http_handler.cpp
    tests/test_websocket_handler.cpp
    tests/test_auth.cpp
)

target_link_libraries(tests PRIVATE
    \${Boost_LIBRARIES}
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    jwt-cpp::jwt-cpp
    GTest::gtest
    GTest::gtest_main
    \${CMAKE_THREAD_LIBS_INIT}
    \${OPENSSL_LIBRARIES}
)

target_include_directories(tests PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/include
    \${Boost_INCLUDE_DIRS}
)

add_test(NAME unit_tests COMMAND tests)
`,

    // Main application
    'src/main.cpp': `#include <iostream>
#include <memory>
#include <thread>
#include <signal.h>
#include "server/http_server.hpp"
#include "server/websocket_server.hpp"
#include "config/config.hpp"
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>

std::atomic<bool> running{true};

void signal_handler(int signal) {
    spdlog::info("Received signal {}, shutting down...", signal);
    running = false;
}

int main(int argc, char* argv[]) {
    try {
        // Setup logging
        auto console = spdlog::stdout_color_mt("console");
        spdlog::set_default_logger(console);
        spdlog::set_level(spdlog::level::info);
        spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [thread %t] %v");

        // Setup signal handling
        signal(SIGINT, signal_handler);
        signal(SIGTERM, signal_handler);

        // Load configuration
        auto config = Config::load("config.json");
        
        // Create io_context
        boost::asio::io_context ioc{config.threads};

        // Create HTTP server
        auto http_server = std::make_shared<HttpServer>(ioc, config);
        http_server->start();

        // Create WebSocket server
        auto ws_server = std::make_shared<WebSocketServer>(ioc, config);
        ws_server->start();

        spdlog::info("{{serviceName}} started on port {} (HTTP) and {} (WebSocket)", 
                     config.http_port, config.ws_port);

        // Run the I/O service on multiple threads
        std::vector<std::thread> threads;
        threads.reserve(config.threads - 1);
        
        for(auto i = config.threads - 1; i > 0; --i) {
            threads.emplace_back([&ioc] {
                ioc.run();
            });
        }

        // Run on main thread
        while (running) {
            try {
                ioc.run();
                break;
            } catch (std::exception& e) {
                spdlog::error("Error in main loop: {}", e.what());
            }
        }

        // Stop servers
        http_server->stop();
        ws_server->stop();

        // Join threads
        for(auto& t : threads) {
            t.join();
        }

        spdlog::info("{{serviceName}} shutdown complete");
        return 0;
    }
    catch (std::exception& e) {
        spdlog::error("Fatal error: {}", e.what());
        return 1;
    }
}
`,

    // Configuration
    'include/config/config.hpp': `#pragma once

#include <string>
#include <nlohmann/json.hpp>

struct Config {
    std::string host = "0.0.0.0";
    unsigned short http_port = {{port}};
    unsigned short ws_port = {{port}} + 1;
    int threads = 4;
    bool use_ssl = false;
    std::string cert_path;
    std::string key_path;
    std::string jwt_secret = "your-secret-key-change-in-production";
    int jwt_expiry_hours = 24;
    std::string cors_origin = "*";
    bool enable_cors = true;
    std::string log_level = "info";
    
    static Config load(const std::string& filename);
    void save(const std::string& filename) const;
    
    NLOHMANN_DEFINE_TYPE_INTRUSIVE(Config, host, http_port, ws_port, threads, 
                                    use_ssl, cert_path, key_path, jwt_secret, 
                                    jwt_expiry_hours, cors_origin, enable_cors, log_level)
};
`,

    'src/config/config.cpp': `#include "config/config.hpp"
#include <fstream>
#include <spdlog/spdlog.h>

Config Config::load(const std::string& filename) {
    Config config;
    
    try {
        std::ifstream file(filename);
        if (file.is_open()) {
            nlohmann::json j;
            file >> j;
            config = j.get<Config>();
            spdlog::info("Configuration loaded from {}", filename);
        } else {
            spdlog::warn("Configuration file {} not found, using defaults", filename);
            // Save default config
            config.save(filename);
        }
    } catch (const std::exception& e) {
        spdlog::error("Error loading configuration: {}", e.what());
    }
    
    return config;
}

void Config::save(const std::string& filename) const {
    try {
        nlohmann::json j = *this;
        std::ofstream file(filename);
        file << j.dump(4);
        spdlog::info("Configuration saved to {}", filename);
    } catch (const std::exception& e) {
        spdlog::error("Error saving configuration: {}", e.what());
    }
}
`,

    // HTTP Server
    'include/server/http_server.hpp': `#pragma once

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/asio.hpp>
#include <memory>
#include <string>
#include "config/config.hpp"

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = boost::asio::ssl;
using tcp = boost::asio::ip::tcp;

class HttpServer : public std::enable_shared_from_this<HttpServer> {
public:
    HttpServer(net::io_context& ioc, const Config& config);
    ~HttpServer();
    
    void start();
    void stop();
    
private:
    void do_accept();
    void on_accept(beast::error_code ec, tcp::socket socket);
    
    net::io_context& ioc_;
    const Config& config_;
    tcp::acceptor acceptor_;
    std::shared_ptr<ssl::context> ssl_ctx_;
};
`,

    'src/server/http_server.cpp': `#include "server/http_server.hpp"
#include "handlers/http_handler.hpp"
#include "utils/ssl_context.hpp"
#include <spdlog/spdlog.h>

HttpServer::HttpServer(net::io_context& ioc, const Config& config)
    : ioc_(ioc)
    , config_(config)
    , acceptor_(net::make_strand(ioc)) {
    
    if (config_.use_ssl) {
        ssl_ctx_ = create_ssl_context(config_.cert_path, config_.key_path);
    }
}

HttpServer::~HttpServer() {
    stop();
}

void HttpServer::start() {
    beast::error_code ec;
    
    // Open the acceptor
    tcp::endpoint endpoint{net::ip::make_address(config_.host), config_.http_port};
    acceptor_.open(endpoint.protocol(), ec);
    if (ec) {
        spdlog::error("Failed to open acceptor: {}", ec.message());
        return;
    }
    
    // Allow address reuse
    acceptor_.set_option(net::socket_base::reuse_address(true), ec);
    if (ec) {
        spdlog::error("Failed to set socket option: {}", ec.message());
        return;
    }
    
    // Bind to the server address
    acceptor_.bind(endpoint, ec);
    if (ec) {
        spdlog::error("Failed to bind: {}", ec.message());
        return;
    }
    
    // Start listening
    acceptor_.listen(net::socket_base::max_listen_connections, ec);
    if (ec) {
        spdlog::error("Failed to listen: {}", ec.message());
        return;
    }
    
    spdlog::info("HTTP server listening on {}:{}", config_.host, config_.http_port);
    do_accept();
}

void HttpServer::stop() {
    beast::error_code ec;
    acceptor_.close(ec);
    if (ec) {
        spdlog::error("Error closing acceptor: {}", ec.message());
    }
}

void HttpServer::do_accept() {
    acceptor_.async_accept(
        net::make_strand(ioc_),
        beast::bind_front_handler(&HttpServer::on_accept, shared_from_this()));
}

void HttpServer::on_accept(beast::error_code ec, tcp::socket socket) {
    if (ec) {
        spdlog::error("Accept failed: {}", ec.message());
    } else {
        // Create HTTP session
        if (config_.use_ssl && ssl_ctx_) {
            std::make_shared<HttpsSession>(std::move(socket), *ssl_ctx_, config_)->run();
        } else {
            std::make_shared<HttpSession>(std::move(socket), config_)->run();
        }
    }
    
    // Accept another connection
    do_accept();
}
`,

    // WebSocket Server
    'include/server/websocket_server.hpp': `#pragma once

#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio.hpp>
#include <memory>
#include <string>
#include "config/config.hpp"

namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = boost::asio::ip::tcp;

class WebSocketServer : public std::enable_shared_from_this<WebSocketServer> {
public:
    WebSocketServer(net::io_context& ioc, const Config& config);
    ~WebSocketServer();
    
    void start();
    void stop();
    
private:
    void do_accept();
    void on_accept(beast::error_code ec, tcp::socket socket);
    
    net::io_context& ioc_;
    const Config& config_;
    tcp::acceptor acceptor_;
};
`,

    // Dockerfile
    'Dockerfile': `# Multi-stage build for C++ Beast application
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    libboost-all-dev \\
    libssl-dev \\
    pkg-config \\
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy source files
COPY . .

# Build the application
RUN mkdir build && cd build && \\
    cmake -DCMAKE_BUILD_TYPE=Release .. && \\
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04

# Install runtime dependencies and curl for health checks
RUN apt-get update && apt-get install -y \\
    libboost-system1.74.0 \\
    libboost-thread1.74.0 \\
    libssl3 \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy built application
COPY --from=builder /app/build/{{serviceName}} /usr/local/bin/
COPY --from=builder /app/config.json /etc/{{serviceName}}/

# Set ownership
RUN chown -R appuser:appuser /etc/{{serviceName}}

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE {{port}}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD curl -f http://localhost:{{port}}/health || exit 1

# Run the application
CMD ["{{serviceName}}"]
`,

    // Package management
    'conanfile.txt': `[requires]
boost/1.83.0
openssl/3.1.3
nlohmann_json/3.11.3
spdlog/1.12.0
jwt-cpp/0.7.0
gtest/1.14.0

[generators]
CMakeDeps
CMakeToolchain

[options]
boost:shared=True
boost:without_test=True
boost:without_python=True
boost:without_wave=True
boost:without_graph=True
boost:without_graph_parallel=True
boost:without_mpi=True

[imports]
bin, *.dll -> ./bin
lib, *.dylib* -> ./bin
lib, *.so* -> ./bin
`,

    // README
    'README.md': `# {{serviceName}}

A high-performance C++ server built with Boost.Beast for HTTP/HTTPS and WebSocket support.

## Features

- HTTP/HTTPS server with RESTful API
- WebSocket server for real-time communication
- JWT authentication
- CORS support
- Multi-threaded async I/O
- SSL/TLS support
- Structured logging with spdlog
- Docker support

## Requirements

- C++17 compiler
- CMake 3.16+
- Boost 1.83+
- OpenSSL
- Conan or vcpkg (optional)

## Building

\`\`\`bash
# Using CMake directly
mkdir build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j$(nproc)

# Using Conan
conan install . --output-folder=build --build=missing
cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE=conan_toolchain.cmake
make -j$(nproc)
\`\`\`

## Running

\`\`\`bash
# Run with default config
./{{serviceName}}

# Run with custom config
./{{serviceName}} --config custom-config.json
\`\`\`

## Configuration

Edit \`config.json\` to customize:
- Server ports
- SSL certificates
- JWT settings
- CORS settings
- Thread pool size

## Testing

\`\`\`bash
cd build
ctest --verbose
\`\`\`

## Docker

\`\`\`bash
# Build image
docker build -t {{serviceName}} .

# Run container
docker run -p {{port}}:{{port}} -p $(({{port}}+1)):$(({{port}}+1)) {{serviceName}}
\`\`\`

## API Endpoints

- \`GET /health\` - Health check
- \`POST /api/auth/login\` - User login
- \`GET /api/users\` - List users (authenticated)
- \`WebSocket ws://localhost:$(({{port}}+1))/ws\` - WebSocket endpoint
`
  }
};