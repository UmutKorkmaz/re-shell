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
  features: ['websockets', 'authentication', 'cors', 'logging', 'testing', 'docker', 'graphql'],
  dependencies: {
    'graphql-resolver-cpp': 'https://github.com/bucchial/graphql-resolver-cpp.git#v0.1.0'
  },
  devDependencies: {},
  
  files: {
    // CMakeLists.txt
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.16)
project({{serviceName}} VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Dependencies come from the system (Debian/Ubuntu: libboost-dev libssl-dev
# nlohmann-json3-dev libspdlog-dev libgtest-dev; macOS: brew install boost
# openssl nlohmann-json spdlog googletest). Boost.Beast and Boost.Asio are
# header-only, so no Boost libraries are linked. Nothing is downloaded at
# configure time.
find_package(Boost 1.81 REQUIRED)
find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(nlohmann_json 3.2.0 REQUIRED)
find_package(spdlog REQUIRED)
find_package(GTest REQUIRED)

# Application code shared by the server executable and the tests
add_library(\${PROJECT_NAME}_lib STATIC
    src/server/http_server.cpp
    src/server/websocket_server.cpp
    src/handlers/http_handler.cpp
    src/handlers/api_handler.cpp
    src/handlers/graphql_handler.cpp
    src/graphql/schema.cpp
    src/graphql/resolver.cpp
    src/middleware/auth_middleware.cpp
    src/middleware/cors_middleware.cpp
    src/utils/jwt_utils.cpp
    src/utils/ssl_context.cpp
    src/config/config.cpp
)

target_include_directories(\${PROJECT_NAME}_lib PUBLIC
    \${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(\${PROJECT_NAME}_lib PUBLIC
    Boost::boost
    nlohmann_json::nlohmann_json
    spdlog::spdlog
    Threads::Threads
    OpenSSL::SSL
    OpenSSL::Crypto
)

# Compiler options
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(\${PROJECT_NAME}_lib PRIVATE
        -Wall -Wextra -Wpedantic -Wno-unused-parameter
        $<$<CONFIG:Debug>:-g -O0>
        $<$<CONFIG:Release>:-O3>
    )
endif()

# Main executable
add_executable(\${PROJECT_NAME} src/main.cpp)
target_link_libraries(\${PROJECT_NAME} PRIVATE \${PROJECT_NAME}_lib)

# Tests
enable_testing()
add_executable(tests
    tests/test_main.cpp
    tests/test_http_handler.cpp
    tests/test_auth.cpp
)

target_link_libraries(tests PRIVATE
    \${PROJECT_NAME}_lib
    GTest::gtest
)

add_test(NAME unit_tests COMMAND tests)

# Install
install(TARGETS \${PROJECT_NAME} DESTINATION bin)
install(FILES config.json DESTINATION etc/\${PROJECT_NAME})
`,

    // Main application
    'src/main.cpp': `#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <vector>
#include "server/http_server.hpp"
#include "server/websocket_server.hpp"
#include "config/config.hpp"
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_color_sinks.h>

int main(int argc, char* argv[]) {
    try {
        // Setup logging
        auto console = spdlog::stdout_color_mt("console");
        spdlog::set_default_logger(console);
        spdlog::set_level(spdlog::level::info);
        spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%^%l%$] [thread %t] %v");

        // Load configuration (./{{serviceName}} --config custom-config.json)
        std::string config_path = "config.json";
        for (int i = 1; i + 1 < argc; ++i) {
            if (std::string(argv[i]) == "--config") {
                config_path = argv[i + 1];
            }
        }
        auto config = Config::load(config_path);
        if (config.threads < 1) {
            config.threads = 1;
        }

        // Create io_context
        boost::asio::io_context ioc{config.threads};

        // Create HTTP server
        auto http_server = std::make_shared<HttpServer>(ioc, config);
        http_server->start();

        // Create WebSocket server
        auto ws_server = std::make_shared<WebSocketServer>(ioc, config);
        ws_server->start();

        // Shut down cleanly on SIGINT / SIGTERM: close the acceptors and stop the I/O service
        boost::asio::signal_set signals(ioc, SIGINT, SIGTERM);
        signals.async_wait([&](const boost::system::error_code&, int signal_number) {
            spdlog::info("Received signal {}, shutting down...", signal_number);
            http_server->stop();
            ws_server->stop();
            ioc.stop();
        });

        spdlog::info("{{serviceName}} started on port {} (HTTP) and {} (WebSocket)",
                     config.http_port, config.ws_port);

        // Run the I/O service on multiple threads
        std::vector<std::thread> threads;
        threads.reserve(config.threads - 1);

        for (auto i = config.threads - 1; i > 0; --i) {
            threads.emplace_back([&ioc] {
                ioc.run();
            });
        }

        // Run on main thread
        ioc.run();

        // Join threads
        for (auto& t : threads) {
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
        if (ec == net::error::operation_aborted) return;  // stop() closed the acceptor
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

    // GraphQL schema (simple switch on query field)
    'include/graphql/schema.hpp': `#pragma once
#include <string>
#include <nlohmann/json.hpp>

namespace graphql {
    extern const char* SCHEMA_SDL;

    // Execute a GraphQL query string against the schema and return JSON data.
    nlohmann::json execute(const std::string& query);
}
`,

    'src/graphql/schema.cpp': `#include "graphql/schema.hpp"
#include "graphql/resolver.hpp"

namespace graphql {
    const char* SCHEMA_SDL =
        "type Query {\\n"
        "  hello: String!\\n"
        "  health: String!\\n"
        "}\\n";

    nlohmann::json execute(const std::string& query) {
        nlohmann::json data = nlohmann::json::object();

        if (query.find("hello") != std::string::npos) {
            data["hello"] = resolver::hello();
        }
        if (query.find("health") != std::string::npos) {
            data["health"] = resolver::health();
        }

        return data;
    }
}
`,

    // GraphQL resolver
    'include/graphql/resolver.hpp': `#pragma once
#include <string>

namespace graphql {
    namespace resolver {
        std::string hello();
        std::string health();
    }
}
`,

    'src/graphql/resolver.cpp': `#include "graphql/resolver.hpp"

namespace graphql {
    namespace resolver {
        std::string hello() {
            return "Hello from Beast GraphQL!";
        }

        std::string health() {
            return "healthy";
        }
    }
}
`,

    // GraphQL HTTP handler (raw /graphql POST handler)
    'include/handlers/graphql_handler.hpp': `#pragma once
#include <boost/beast/http.hpp>
#include <boost/beast/core.hpp>
#include <string>
#include "config/config.hpp"

namespace beast = boost::beast;
namespace http = beast::http;

namespace graphql {
    // Handle a /graphql POST request. Returns true if the request was handled
    // (i.e. it was a /graphql request), in which case \`res\` is populated.
    bool handle(const std::string& target, const std::string& body,
                http::response<http::string_body>& res);
}
`,

    'src/handlers/graphql_handler.cpp': `#include "handlers/graphql_handler.hpp"
#include "graphql/schema.hpp"
#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>

namespace graphql {
    bool handle(const std::string& target, const std::string& body,
                http::response<http::string_body>& res) {
        if (target != "/graphql") {
            return false;
        }

        try {
            auto parsed = nlohmann::json::parse(body);
            std::string query = parsed.value("query", std::string());

            nlohmann::json result;
            result["data"] = execute(query);

            res.result(http::status::ok);
            res.set(http::field::content_type, "application/json");
            res.body() = result.dump();
        } catch (const std::exception& e) {
            spdlog::error("GraphQL error: {}", e.what());

            nlohmann::json error;
            error["errors"] = nlohmann::json::array({
                nlohmann::json({{"message", e.what()}})
            });

            res.result(http::status::bad_request);
            res.set(http::field::content_type, "application/json");
            res.body() = error.dump();
        }

        res.prepare_payload();
        return true;
    }
}
`,

    // Dockerfile
    'Dockerfile': `# Multi-stage build for C++ Beast application
FROM ubuntu:24.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    libboost-dev \\
    libssl-dev \\
    libspdlog-dev \\
    libgtest-dev \\
    nlohmann-json3-dev \\
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
FROM ubuntu:24.04

# Install runtime dependencies and curl for health checks
RUN apt-get update && apt-get install -y \\
    libssl3t64 \\
    libspdlog1.12 \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser

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
CMD ["{{serviceName}}", "--config", "/etc/{{serviceName}}/config.json"]
`,

    // Package management
    'conanfile.txt': `[requires]
boost/1.83.0
openssl/3.1.3
nlohmann_json/3.11.3
spdlog/1.12.0
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
- Boost 1.81+ (headers only: Beast and Asio need no compiled Boost libraries)
- OpenSSL, nlohmann_json, spdlog and GoogleTest, found with find_package
- Conan or vcpkg (optional)

## Building

\`\`\`bash
# Debian/Ubuntu dependencies
sudo apt-get install build-essential cmake libboost-dev libssl-dev nlohmann-json3-dev libspdlog-dev libgtest-dev

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
- \`POST /graphql\` - GraphQL endpoint (Query { hello, health })
- \`WebSocket ws://localhost:$(({{port}}+1))/ws\` - WebSocket endpoint

To wire the GraphQL handler into the HTTP request dispatch, call
\`graphql::handle(req.target(), req.body(), res)\` in \`handlers/http_handler.cpp\`
before the default route handling; if it returns \`true\`, the response is ready.
`,

    'config.json': `{
    "host": "0.0.0.0",
    "http_port": 8085,
    "ws_port": 8086,
    "threads": 4,
    "use_ssl": false,
    "cert_path": "",
    "key_path": "",
    "jwt_secret": "your-secret-key-change-in-production",
    "jwt_expiry_hours": 24,
    "cors_origin": "*",
    "enable_cors": true,
    "log_level": "info"
}
`,

    'src/server/websocket_server.cpp': `#include "server/websocket_server.hpp"

#include <nlohmann/json.hpp>
#include <spdlog/spdlog.h>

namespace {

// One WebSocket connection: greets the client, then echoes every text message
// back wrapped as {"type":"echo","data":"..."}.
class WebSocketSession : public std::enable_shared_from_this<WebSocketSession> {
public:
    explicit WebSocketSession(tcp::socket&& socket) : ws_(std::move(socket)) {}

    void run() {
        net::dispatch(ws_.get_executor(),
                      beast::bind_front_handler(&WebSocketSession::on_run, shared_from_this()));
    }

private:
    void on_run() {
        ws_.set_option(websocket::stream_base::timeout::suggested(beast::role_type::server));
        ws_.set_option(websocket::stream_base::decorator([](websocket::response_type& res) {
            res.set(beast::http::field::server, "{{serviceName}}");
        }));
        ws_.async_accept(beast::bind_front_handler(&WebSocketSession::on_accept, shared_from_this()));
    }

    void on_accept(beast::error_code ec) {
        if (ec) {
            spdlog::debug("WebSocket accept failed: {}", ec.message());
            return;
        }
        queue(nlohmann::json({{"type", "welcome"}, {"service", "{{serviceName}}"}}).dump());
        do_read();
    }

    void do_read() {
        ws_.async_read(buffer_, beast::bind_front_handler(&WebSocketSession::on_read, shared_from_this()));
    }

    void on_read(beast::error_code ec, std::size_t) {
        if (ec == websocket::error::closed) return;
        if (ec) {
            spdlog::debug("WebSocket read failed: {}", ec.message());
            return;
        }
        std::string message = beast::buffers_to_string(buffer_.data());
        buffer_.consume(buffer_.size());
        queue(nlohmann::json({{"type", "echo"}, {"data", message}}).dump());
        do_read();
    }

    // Writes are serialised: only one async_write may be in flight at a time.
    void queue(std::string message) {
        outbox_.push_back(std::move(message));
        if (outbox_.size() == 1) do_write();
    }

    void do_write() {
        ws_.text(true);
        ws_.async_write(net::buffer(outbox_.front()),
                        beast::bind_front_handler(&WebSocketSession::on_write, shared_from_this()));
    }

    void on_write(beast::error_code ec, std::size_t) {
        if (ec) {
            spdlog::debug("WebSocket write failed: {}", ec.message());
            return;
        }
        outbox_.erase(outbox_.begin());
        if (!outbox_.empty()) do_write();
    }

    websocket::stream<beast::tcp_stream> ws_;
    beast::flat_buffer buffer_;
    std::vector<std::string> outbox_;
};

}  // namespace

WebSocketServer::WebSocketServer(net::io_context& ioc, const Config& config)
    : ioc_(ioc), config_(config), acceptor_(net::make_strand(ioc)) {}

WebSocketServer::~WebSocketServer() {
    stop();
}

void WebSocketServer::start() {
    beast::error_code ec;
    tcp::endpoint endpoint{net::ip::make_address(config_.host), config_.ws_port};

    acceptor_.open(endpoint.protocol(), ec);
    if (ec) {
        spdlog::error("WebSocket: failed to open acceptor: {}", ec.message());
        return;
    }
    acceptor_.set_option(net::socket_base::reuse_address(true), ec);
    if (ec) {
        spdlog::error("WebSocket: failed to set socket option: {}", ec.message());
        return;
    }
    acceptor_.bind(endpoint, ec);
    if (ec) {
        spdlog::error("WebSocket: failed to bind: {}", ec.message());
        return;
    }
    acceptor_.listen(net::socket_base::max_listen_connections, ec);
    if (ec) {
        spdlog::error("WebSocket: failed to listen: {}", ec.message());
        return;
    }

    spdlog::info("WebSocket server listening on {}:{}", config_.host, config_.ws_port);
    do_accept();
}

void WebSocketServer::stop() {
    beast::error_code ec;
    acceptor_.close(ec);
}

void WebSocketServer::do_accept() {
    acceptor_.async_accept(net::make_strand(ioc_),
                           beast::bind_front_handler(&WebSocketServer::on_accept, shared_from_this()));
}

void WebSocketServer::on_accept(beast::error_code ec, tcp::socket socket) {
    if (ec) {
        if (ec == net::error::operation_aborted) return;  // stop() closed the acceptor
        spdlog::error("WebSocket accept failed: {}", ec.message());
    } else {
        std::make_shared<WebSocketSession>(std::move(socket))->run();
    }
    do_accept();
}
`,

    'src/middleware/auth_middleware.cpp': `#include "middleware/auth_middleware.hpp"

#include "utils/jwt_utils.hpp"

namespace middleware {

std::optional<std::string> authenticate(
    const boost::beast::http::request<boost::beast::http::string_body>& req, const Config& config) {
    auto header = req.find(boost::beast::http::field::authorization);
    if (header == req.end()) return std::nullopt;

    std::string value(header->value());
    const std::string prefix = "Bearer ";
    if (value.compare(0, prefix.size(), prefix) != 0) return std::nullopt;

    return jwt_utils::verify(config.jwt_secret, value.substr(prefix.size()));
}

}  // namespace middleware
`,

    'src/middleware/cors_middleware.cpp': `#include "middleware/cors_middleware.hpp"

namespace middleware {

void apply_cors(const Config& config,
                boost::beast::http::response<boost::beast::http::string_body>& res) {
    if (!config.enable_cors) return;
    namespace http = boost::beast::http;
    res.set(http::field::access_control_allow_origin, config.cors_origin);
    res.set(http::field::access_control_allow_methods, "GET, POST, PUT, DELETE, OPTIONS");
    res.set(http::field::access_control_allow_headers, "Content-Type, Authorization");
}

}  // namespace middleware
`,

    'src/handlers/api_handler.cpp': `#include "handlers/api_handler.hpp"

#include <cstdlib>
#include <nlohmann/json.hpp>

#include "middleware/auth_middleware.hpp"
#include "utils/jwt_utils.hpp"

namespace api {

namespace http = boost::beast::http;

namespace {

void send_json(Response& res, http::status status, const nlohmann::json& body) {
    res.result(status);
    res.set(http::field::content_type, "application/json");
    res.body() = body.dump();
}

std::string env_or(const char* name, const char* fallback) {
    const char* value = std::getenv(name);
    return value ? value : fallback;
}

}  // namespace

bool handle(const Request& req, const Config& config, Response& res) {
    const std::string target(req.target());
    const auto method = req.method();

    if (target == "/health" && method == http::verb::get) {
        send_json(res, http::status::ok, {{"status", "healthy"}, {"service", "{{serviceName}}"}});
        return true;
    }

    if (target == "/api/info" && method == http::verb::get) {
        send_json(res, http::status::ok,
                  {{"name", "{{serviceName}}"},
                   {"framework", "Boost.Beast"},
                   {"http_port", config.http_port},
                   {"ws_port", config.ws_port}});
        return true;
    }

    if (target == "/api/auth/login" && method == http::verb::post) {
        // Demo credentials: set APP_USERNAME / APP_PASSWORD, or replace this
        // check with a lookup in your user store.
        const std::string expected_user = env_or("APP_USERNAME", "admin");
        const std::string expected_password = env_or("APP_PASSWORD", "change-me");
        try {
            auto body = nlohmann::json::parse(req.body());
            if (body.value("username", "") == expected_user &&
                body.value("password", "") == expected_password) {
                send_json(res, http::status::ok,
                          {{"token", jwt_utils::generate(config.jwt_secret, expected_user,
                                                         config.jwt_expiry_hours)}});
            } else {
                send_json(res, http::status::unauthorized, {{"error", "Invalid credentials"}});
            }
        } catch (const std::exception&) {
            send_json(res, http::status::bad_request, {{"error", "Invalid JSON body"}});
        }
        return true;
    }

    if (target == "/api/me" && method == http::verb::get) {
        auto subject = middleware::authenticate(req, config);
        if (!subject) {
            send_json(res, http::status::unauthorized, {{"error", "Unauthorized"}});
        } else {
            send_json(res, http::status::ok, {{"user", *subject}});
        }
        return true;
    }

    return false;
}

}  // namespace api
`,

    'src/handlers/http_handler.cpp': `#include "handlers/http_handler.hpp"

#include <chrono>
#include <spdlog/spdlog.h>

#include "handlers/api_handler.hpp"
#include "handlers/graphql_handler.hpp"
#include "middleware/cors_middleware.hpp"

http::response<http::string_body> handle_request(const http::request<http::string_body>& req,
                                                 const Config& config) {
    http::response<http::string_body> res{http::status::not_found, req.version()};
    res.set(http::field::server, "{{serviceName}}");
    res.keep_alive(req.keep_alive());

    const std::string target(req.target());

    if (req.method() == http::verb::options) {
        res.result(http::status::no_content);
    } else if (api::handle(req, config, res)) {
        // handled by the REST API
    } else if (req.method() == http::verb::post && graphql::handle(target, req.body(), res)) {
        // handled by the GraphQL endpoint
    } else {
        res.result(http::status::not_found);
        res.set(http::field::content_type, "application/json");
        res.body() = R"({"error":"Not found"})";
    }

    middleware::apply_cors(config, res);
    res.prepare_payload();
    spdlog::info("{} {} -> {}", std::string(req.method_string()), target,
                 static_cast<unsigned>(res.result_int()));
    return res;
}

// ---------------------------------------------------------------------------
// HttpSession
// ---------------------------------------------------------------------------

HttpSession::HttpSession(tcp::socket&& socket, const Config& config)
    : stream_(std::move(socket)), config_(config) {}

void HttpSession::run() {
    net::dispatch(stream_.get_executor(),
                  beast::bind_front_handler(&HttpSession::do_read, shared_from_this()));
}

void HttpSession::do_read() {
    req_ = {};
    stream_.expires_after(std::chrono::seconds(30));
    http::async_read(stream_, buffer_, req_,
                     beast::bind_front_handler(&HttpSession::on_read, shared_from_this()));
}

void HttpSession::on_read(beast::error_code ec, std::size_t) {
    if (ec == http::error::end_of_stream) return do_close();
    if (ec) {
        spdlog::debug("HTTP read failed: {}", ec.message());
        return;
    }
    res_ = handle_request(req_, config_);
    http::async_write(stream_, res_,
                      beast::bind_front_handler(&HttpSession::on_write, shared_from_this(),
                                                res_.need_eof()));
}

void HttpSession::on_write(bool close, beast::error_code ec, std::size_t) {
    if (ec) {
        spdlog::debug("HTTP write failed: {}", ec.message());
        return;
    }
    if (close) return do_close();
    do_read();
}

void HttpSession::do_close() {
    beast::error_code ec;
    stream_.socket().shutdown(tcp::socket::shutdown_send, ec);
}

// ---------------------------------------------------------------------------
// HttpsSession
// ---------------------------------------------------------------------------

HttpsSession::HttpsSession(tcp::socket&& socket, ssl::context& ctx, const Config& config)
    : stream_(std::move(socket), ctx), config_(config) {}

void HttpsSession::run() {
    net::dispatch(stream_.get_executor(), [self = shared_from_this()] {
        self->stream_.async_handshake(
            ssl::stream_base::server,
            beast::bind_front_handler(&HttpsSession::on_handshake, self));
    });
}

void HttpsSession::on_handshake(beast::error_code ec) {
    if (ec) {
        spdlog::debug("TLS handshake failed: {}", ec.message());
        return;
    }
    do_read();
}

void HttpsSession::do_read() {
    req_ = {};
    beast::get_lowest_layer(stream_).expires_after(std::chrono::seconds(30));
    http::async_read(stream_, buffer_, req_,
                     beast::bind_front_handler(&HttpsSession::on_read, shared_from_this()));
}

void HttpsSession::on_read(beast::error_code ec, std::size_t) {
    if (ec == http::error::end_of_stream) return do_close();
    if (ec) {
        spdlog::debug("HTTPS read failed: {}", ec.message());
        return;
    }
    res_ = handle_request(req_, config_);
    http::async_write(stream_, res_,
                      beast::bind_front_handler(&HttpsSession::on_write, shared_from_this(),
                                                res_.need_eof()));
}

void HttpsSession::on_write(bool close, beast::error_code ec, std::size_t) {
    if (ec) {
        spdlog::debug("HTTPS write failed: {}", ec.message());
        return;
    }
    if (close) return do_close();
    do_read();
}

void HttpsSession::do_close() {
    beast::get_lowest_layer(stream_).expires_after(std::chrono::seconds(30));
    stream_.async_shutdown(beast::bind_front_handler(&HttpsSession::on_shutdown, shared_from_this()));
}

void HttpsSession::on_shutdown(beast::error_code) {
    // The connection is closed when the last shared_ptr goes away.
}
`,

    'src/utils/jwt_utils.cpp': `#include "utils/jwt_utils.hpp"

#include <openssl/evp.h>
#include <openssl/hmac.h>

#include <chrono>
#include <nlohmann/json.hpp>
#include <sstream>
#include <vector>

namespace jwt_utils {

namespace {

const char* kAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

std::string sign(const std::string& secret, const std::string& data) {
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int length = 0;
    HMAC(EVP_sha256(), secret.data(), static_cast<int>(secret.size()),
         reinterpret_cast<const unsigned char*>(data.data()), data.size(), digest, &length);
    return base64url_encode(std::string(reinterpret_cast<char*>(digest), length));
}

// Compare without returning early on the first differing byte.
bool constant_time_equals(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char diff = 0;
    for (std::size_t i = 0; i < a.size(); ++i) {
        diff |= static_cast<unsigned char>(a[i] ^ b[i]);
    }
    return diff == 0;
}

long long now_seconds() {
    return std::chrono::duration_cast<std::chrono::seconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

}  // namespace

std::string base64url_encode(const std::string& input) {
    std::string out;
    unsigned int val = 0;
    int bits = -6;
    for (unsigned char c : input) {
        val = (val << 8) + c;
        bits += 8;
        while (bits >= 0) {
            out.push_back(kAlphabet[(val >> bits) & 0x3F]);
            bits -= 6;
        }
    }
    if (bits > -6) {
        out.push_back(kAlphabet[((val << 8) >> (bits + 8)) & 0x3F]);
    }
    return out;  // base64url without padding
}

std::string base64url_decode(const std::string& input) {
    std::vector<int> table(256, -1);
    for (int i = 0; i < 64; ++i) {
        table[static_cast<unsigned char>(kAlphabet[i])] = i;
    }
    std::string out;
    unsigned int val = 0;
    int bits = -8;
    for (unsigned char c : input) {
        if (table[c] == -1) break;
        val = (val << 6) + static_cast<unsigned int>(table[c]);
        bits += 6;
        if (bits >= 0) {
            out.push_back(static_cast<char>((val >> bits) & 0xFF));
            bits -= 8;
        }
    }
    return out;
}

std::string generate(const std::string& secret, const std::string& subject, int expiry_hours) {
    nlohmann::json header = {{"alg", "HS256"}, {"typ", "JWT"}};
    long long issued = now_seconds();
    nlohmann::json payload = {
        {"sub", subject},
        {"iat", issued},
        {"exp", issued + static_cast<long long>(expiry_hours) * 3600},
    };
    std::string data = base64url_encode(header.dump()) + "." + base64url_encode(payload.dump());
    return data + "." + sign(secret, data);
}

std::optional<std::string> verify(const std::string& secret, const std::string& token) {
    std::vector<std::string> parts;
    std::stringstream ss(token);
    std::string part;
    while (std::getline(ss, part, '.')) {
        parts.push_back(part);
    }
    if (parts.size() != 3) return std::nullopt;

    if (!constant_time_equals(parts[2], sign(secret, parts[0] + "." + parts[1]))) {
        return std::nullopt;
    }

    try {
        auto payload = nlohmann::json::parse(base64url_decode(parts[1]));
        if (payload.at("exp").get<long long>() < now_seconds()) return std::nullopt;
        return payload.at("sub").get<std::string>();
    } catch (const std::exception&) {
        return std::nullopt;
    }
}

}  // namespace jwt_utils
`,

    'src/utils/ssl_context.cpp': `#include "utils/ssl_context.hpp"

std::shared_ptr<boost::asio::ssl::context> create_ssl_context(const std::string& cert_path,
                                                             const std::string& key_path) {
    namespace ssl = boost::asio::ssl;
    auto ctx = std::make_shared<ssl::context>(ssl::context::tlsv12_server);
    ctx->set_options(ssl::context::default_workarounds | ssl::context::no_sslv2 |
                     ssl::context::no_sslv3 | ssl::context::single_dh_use);
    ctx->use_certificate_chain_file(cert_path);
    ctx->use_private_key_file(key_path, ssl::context::pem);
    return ctx;
}
`,

    'tests/test_auth.cpp': `#include <gtest/gtest.h>

#include "config/config.hpp"
#include "middleware/auth_middleware.hpp"
#include "utils/jwt_utils.hpp"

namespace http = boost::beast::http;

TEST(JwtUtilsTest, GenerateAndVerify) {
    auto token = jwt_utils::generate("secret", "alice", 1);
    auto subject = jwt_utils::verify("secret", token);
    ASSERT_TRUE(subject.has_value());
    EXPECT_EQ(*subject, "alice");
}

TEST(JwtUtilsTest, RejectsWrongSecret) {
    auto token = jwt_utils::generate("secret", "alice", 1);
    EXPECT_FALSE(jwt_utils::verify("other-secret", token).has_value());
}

TEST(JwtUtilsTest, RejectsExpiredToken) {
    auto token = jwt_utils::generate("secret", "alice", -1);
    EXPECT_FALSE(jwt_utils::verify("secret", token).has_value());
}

TEST(JwtUtilsTest, RejectsMalformedTokens) {
    EXPECT_FALSE(jwt_utils::verify("secret", "not-a-jwt").has_value());
    EXPECT_FALSE(jwt_utils::verify("secret", "invalid.token.here").has_value());
    EXPECT_FALSE(jwt_utils::verify("secret", "").has_value());
}

TEST(AuthMiddlewareTest, AcceptsBearerToken) {
    Config config;
    http::request<http::string_body> req{http::verb::get, "/api/me", 11};
    req.set(http::field::authorization, "Bearer " + jwt_utils::generate(config.jwt_secret, "bob", 1));

    auto subject = middleware::authenticate(req, config);
    ASSERT_TRUE(subject.has_value());
    EXPECT_EQ(*subject, "bob");
}

TEST(AuthMiddlewareTest, RejectsMissingOrInvalidHeader) {
    Config config;
    http::request<http::string_body> req{http::verb::get, "/api/me", 11};
    EXPECT_FALSE(middleware::authenticate(req, config).has_value());

    req.set(http::field::authorization, "Bearer nope");
    EXPECT_FALSE(middleware::authenticate(req, config).has_value());

    req.set(http::field::authorization, "Basic Zm9vOmJhcg==");
    EXPECT_FALSE(middleware::authenticate(req, config).has_value());
}
`,

    'tests/test_http_handler.cpp': `#include <gtest/gtest.h>

#include <cstdlib>
#include <nlohmann/json.hpp>

#include "handlers/http_handler.hpp"
#include "utils/jwt_utils.hpp"

namespace {

http::request<http::string_body> make_request(http::verb method, const std::string& target,
                                              const std::string& body = "") {
    http::request<http::string_body> req{method, target, 11};
    req.body() = body;
    req.prepare_payload();
    return req;
}

}  // namespace

TEST(HttpHandlerTest, HealthCheck) {
    Config config;
    auto res = handle_request(make_request(http::verb::get, "/health"), config);
    EXPECT_EQ(res.result(), http::status::ok);
    EXPECT_EQ(nlohmann::json::parse(res.body())["status"], "healthy");
}

TEST(HttpHandlerTest, UnknownRouteIsNotFound) {
    Config config;
    auto res = handle_request(make_request(http::verb::get, "/nonexistent"), config);
    EXPECT_EQ(res.result(), http::status::not_found);
}

TEST(HttpHandlerTest, CorsHeadersAndPreflight) {
    Config config;
    config.cors_origin = "https://example.com";
    auto res = handle_request(make_request(http::verb::options, "/api/me"), config);
    EXPECT_EQ(res.result(), http::status::no_content);
    EXPECT_EQ(res[http::field::access_control_allow_origin], "https://example.com");

    config.enable_cors = false;
    res = handle_request(make_request(http::verb::get, "/health"), config);
    EXPECT_EQ(res.find(http::field::access_control_allow_origin), res.end());
}

TEST(HttpHandlerTest, LoginThenAccessProtectedRoute) {
    Config config;
    setenv("APP_USERNAME", "tester", 1);
    setenv("APP_PASSWORD", "s3cret", 1);

    auto bad = handle_request(
        make_request(http::verb::post, "/api/auth/login", R"({"username":"tester","password":"wrong"})"),
        config);
    EXPECT_EQ(bad.result(), http::status::unauthorized);

    auto good = handle_request(
        make_request(http::verb::post, "/api/auth/login", R"({"username":"tester","password":"s3cret"})"),
        config);
    ASSERT_EQ(good.result(), http::status::ok);
    std::string token = nlohmann::json::parse(good.body())["token"];

    auto anonymous = handle_request(make_request(http::verb::get, "/api/me"), config);
    EXPECT_EQ(anonymous.result(), http::status::unauthorized);

    auto me_req = make_request(http::verb::get, "/api/me");
    me_req.set(http::field::authorization, "Bearer " + token);
    auto me = handle_request(me_req, config);
    ASSERT_EQ(me.result(), http::status::ok);
    EXPECT_EQ(nlohmann::json::parse(me.body())["user"], "tester");
}

TEST(HttpHandlerTest, LoginRejectsMalformedBody) {
    Config config;
    auto res = handle_request(make_request(http::verb::post, "/api/auth/login", "not json"), config);
    EXPECT_EQ(res.result(), http::status::bad_request);
}

TEST(HttpHandlerTest, GraphqlHello) {
    Config config;
    auto res = handle_request(
        make_request(http::verb::post, "/graphql", R"({"query":"{ hello }"})"), config);
    ASSERT_EQ(res.result(), http::status::ok);
    EXPECT_EQ(nlohmann::json::parse(res.body())["data"]["hello"], "Hello from Beast GraphQL!");
}
`,

    'tests/test_main.cpp': `#include <gtest/gtest.h>
#include <spdlog/spdlog.h>

int main(int argc, char** argv) {
    spdlog::set_level(spdlog::level::warn);
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
`,

    'include/middleware/auth_middleware.hpp': `#pragma once

#include <boost/beast/http.hpp>
#include <optional>
#include <string>

#include "config/config.hpp"

namespace middleware {

// Returns the authenticated subject taken from an "Authorization: Bearer <jwt>"
// header, or std::nullopt when the header is missing or the token is invalid.
std::optional<std::string> authenticate(
    const boost::beast::http::request<boost::beast::http::string_body>& req, const Config& config);

}  // namespace middleware
`,

    'include/middleware/cors_middleware.hpp': `#pragma once

#include <boost/beast/http.hpp>

#include "config/config.hpp"

namespace middleware {

// Add the CORS headers configured in config.json (no-op when enable_cors is false).
void apply_cors(const Config& config,
                boost::beast::http::response<boost::beast::http::string_body>& res);

}  // namespace middleware
`,

    'include/handlers/api_handler.hpp': `#pragma once

#include <boost/beast/http.hpp>

#include "config/config.hpp"

namespace api {

using Request = boost::beast::http::request<boost::beast::http::string_body>;
using Response = boost::beast::http::response<boost::beast::http::string_body>;

// Handle /health and /api/* requests. Returns true when the target belongs to
// the API (res is populated), false when the caller should keep routing.
//
//   GET  /health          liveness probe
//   GET  /api/info        service information
//   POST /api/auth/login  {"username": "...", "password": "..."} -> {"token": "<jwt>"}
//   GET  /api/me          requires "Authorization: Bearer <jwt>"
bool handle(const Request& req, const Config& config, Response& res);

}  // namespace api
`,

    'include/handlers/http_handler.hpp': `#pragma once

#include <boost/asio.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <memory>

#include "config/config.hpp"

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = boost::asio::ssl;
using tcp = boost::asio::ip::tcp;

// Route one request: CORS preflight, /health, /api/*, /graphql, 404. Pure
// function of its arguments, so it can be unit tested without a socket.
http::response<http::string_body> handle_request(const http::request<http::string_body>& req,
                                                 const Config& config);

// One plain-HTTP connection (keep-alive, one request at a time).
class HttpSession : public std::enable_shared_from_this<HttpSession> {
public:
    HttpSession(tcp::socket&& socket, const Config& config);
    void run();

private:
    void do_read();
    void on_read(beast::error_code ec, std::size_t bytes_transferred);
    void on_write(bool close, beast::error_code ec, std::size_t bytes_transferred);
    void do_close();

    beast::tcp_stream stream_;
    beast::flat_buffer buffer_;
    const Config& config_;
    http::request<http::string_body> req_;
    http::response<http::string_body> res_;
};

// One TLS connection: same protocol as HttpSession after the handshake.
class HttpsSession : public std::enable_shared_from_this<HttpsSession> {
public:
    HttpsSession(tcp::socket&& socket, ssl::context& ctx, const Config& config);
    void run();

private:
    void on_handshake(beast::error_code ec);
    void do_read();
    void on_read(beast::error_code ec, std::size_t bytes_transferred);
    void on_write(bool close, beast::error_code ec, std::size_t bytes_transferred);
    void do_close();
    void on_shutdown(beast::error_code ec);

    beast::ssl_stream<beast::tcp_stream> stream_;
    beast::flat_buffer buffer_;
    const Config& config_;
    http::request<http::string_body> req_;
    http::response<http::string_body> res_;
};
`,

    'include/utils/jwt_utils.hpp': `#pragma once

#include <optional>
#include <string>

// Minimal HS256 JSON Web Tokens built on OpenSSL's HMAC (no extra dependency).
namespace jwt_utils {

// Create a signed token for \`subject\` that expires in \`expiry_hours\` hours.
std::string generate(const std::string& secret, const std::string& subject, int expiry_hours);

// Returns the token's subject when the signature is valid and the token has not
// expired, std::nullopt otherwise. Never throws.
std::optional<std::string> verify(const std::string& secret, const std::string& token);

std::string base64url_encode(const std::string& input);
std::string base64url_decode(const std::string& input);

}  // namespace jwt_utils
`,

    'include/utils/ssl_context.hpp': `#pragma once

#include <boost/asio/ssl.hpp>
#include <memory>
#include <string>

// Build a TLS server context from a PEM certificate chain and private key.
// Throws boost::system::system_error when a file cannot be read.
std::shared_ptr<boost::asio::ssl::context> create_ssl_context(const std::string& cert_path,
                                                             const std::string& key_path);
`
  }
};