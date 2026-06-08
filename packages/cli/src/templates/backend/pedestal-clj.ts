import { BackendTemplate } from '../types';

export const pedestalCljTemplate: BackendTemplate = {
  id: 'pedestal-clj',
  name: 'pedestal-clj',
  displayName: 'Pedestal (Clojure)',
  description: 'Service-oriented web framework for Clojure with interceptors and async processing',
  language: 'clojure',
  framework: 'pedestal',
  version: '1.0.0',
  tags: ['clojure', 'pedestal', 'service-oriented', 'interceptors', 'microservices'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation'],

  files: {
    // Project configuration
    'project.clj': `(defproject {{projectNameSnake}} "0.1.0-SNAPSHOT"
  :description "REST API built with Pedestal"
  :url "http://example.com/FIXME"
  :license {:name "EPL-2.0 OR GPL-2.0-or-later WITH Classpath-exception-2.0"
            :url "https://www.eclipse.org/legal/epl-2.0/"}
  :min-lein-version "2.0.0"

  :dependencies [[org.clojure/clojure "1.11.1"]
                 [io.pedestal/pedestal "0.6.0"]
                 [io.pedestal/pedestal.jetty "0.6.0"]
                 [io.pedestal/pedestal.route "0.6.0"]
                 [io.pedestal/pedestal.interceptor "0.6.0"]
                 [org.slf4j/slf4j-simple "2.0.7"]
                 [cheshire "5.11.0"]
                 [buddy/buddy-auth "3.0.0"]
                 [buddy/buddy-hashers "3.0.0"]
                 [buddy/buddy-sign "3.4.1"]
                 [clj-time "0.15.2"]]

  :main ^:skip-aot)
`,

    // Server
    'src/{{projectNameSnake}}/server.clj': `(ns {{projectNameSnake}}.server
  (:require [io.pedestal.http :as http]
            [io.pedestal.jetty :as jetty]
            [{{projectNameSnake}}.service :as service]
            [clojure.tools.logging :as log]))

(defn- jetty-server []
  (let [server (http/create-server
                 {::http/routes service/routes
                  ::http/type :jetty
                  ::http/port 8080
                  ::http/join? false})]
    (log/info "🚀 Server running at http://localhost:8080")
    (log/info "📚 API docs: http://localhost:8080/api/v1/health")
    server))

(defn -main []
  (jetty-server))
`,

    // Service
    'src/{{projectNameSnake}}/service.clj': `(ns {{projectNameSnake}}.service
  (:require
   [io.pedestal.http :as http]
   [io.pedestal.http.route :as route]
   [cheshire.generate :as json]
   [buddy.sign.jwt :as jwt]
   [buddy.hashers :as hashers]
   [clj-time.core :as t]
   [{{projectNameSnake}}.db :as db]
   [{{projectNameSnake}}.interceptors :as interceptors]))

(defn- response [status body]
  {:status status
   :headers {"Content-Type" "application/json"}
   :body (json/generate-string body)})

(defn health [request]
  (response 200
    {:status "healthy"
     :timestamp (str (t/now))
     :version "1.0.0"}))

(defn register [request]
  (let [params (:json-params request)]
    (if (db/user-exists? (:email params))
      (response 409 {:error "Email already registered"})
      (let [hashed (hashers/derive (:password params) {:algorithm :pbkdf2+sha256})
            user {:id (str (random-uuid))
                   :email (:email params)
                   :password hashed
                   :name (:name params)
                   :role "user"
                   :created-at (t/now)
                   :updated-at (t/now)}
            _ (db/create-user! user)
            token (jwt/sign (assoc user :exp (t/plus (t/now) (t/days 7))) "change-this-secret")]
        (response 201 {:token token :user (dissoc user :password)})))))

(defn login [request]
  (let [params (:json-params request)]
    (if-let [user (db/find-user-by-email (:email params))]
      (if (hashers/verify (:password params) (:password user))
        (let [token (jwt/sign (assoc user :exp (t/plus (t/now) (t/days 7))) "change-this-secret")]
          (response 200 {:token token :user (dissoc user :password)}))
        (response 401 {:error "Invalid credentials"}))
      (response 401 {:error "Invalid credentials"}))))

(defn list-products [request]
  (let [products (db/get-all-products)]
    (response 200 {:products products :count (count products)})))

(defn get-product [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [product (db/find-product-by-id id)]
      (response 200 {:product product})
      (response 404 {:error "Product not found"}))))

(defn create-product [request]
  (let [params (:json-params request)
        product {:id (str (random-uuid))
                 :name (:name params)
                 :description (:description params)
                 :price (:price params)
                 :stock (:stock params)
                 :created-at (t/now)
                 :updated-at (t/now)}]
    (db/create-product! product)
    (response 201 {:product product})))

(defn update-product [request]
  (let [id (get-in request [:path-params :id])
        params (:json-params request)]
    (if-let [product (db/update-product! id params)]
      (response 200 {:product product})
      (response 404 {:error "Product not found"}))))

(defn delete-product [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-product! id)
      (response 204 nil)
      (response 404 {:error "Product not found"}))))

(def routes
  (route/expand-routes
    [[["/api/v1/health" :get [health]]
      ["/api/v1/auth/register" :post [register]]
      ["/api/v1/auth/login" :post [login]]
      ["/api/v1/products" :get [list-products] :post [create-product]]
      ["/api/v1/products/:id" :get [get-product] :put [update-product] :delete [delete-product]]]]])
`,

    // Interceptors
    'src/{{projectNameSnake}}/interceptors.clj': `(ns {{projectNameSnake}}.interceptors
  (:require [io.pedestal.interceptor :as interceptor]
            [io.pedestal.interceptor.helpers :refer [handler-before]]
            [cheshire.core :as json]
            [clojure.tools.logging :as log]))

(defn parse-json
  "Interceptor that parses JSON request body and adds it to request as :json-params"
  [handler]
  (interceptor/after
    (fn [request]
      (if-let [body (-> request :request :body slurp not-empty)]
        (assoc-in request [:json-params] (json/parse-string body))
        request))
    handler))

(defn log-request
  "Interceptor that logs incoming requests"
  [handler]
  (interceptor/before
    (fn [request]
      (log/info (str (:request-method request) " " (:uri request)))
      request)
    handler))
`,

    // Database
    'src/{{projectNameSnake}}/db.clj': `(ns {{projectNameSnake}}.db)

(def ^:private users (atom {})
(def ^:private products (atom {}))

(defn init! []
  (let [admin {:id "1"
               :email "admin@example.com"
               :password "$2a$12$dummy"
               :name "Admin User"
               :role "admin"
               :created-at (java.util.Date.)
               :updated-at (java.util.Date.)}
        now (java.util.Date.)
        prod1 {:id "1" :name "Sample Product 1" :description "This is a sample product" :price 29.99 :stock 100 :created-at now :updated-at now}
        prod2 {:id "2" :name "Sample Product 2" :description "Another sample product" :price 49.99 :stock 50 :created-at now :updated-at now}]
    (swap! users assoc "1" admin)
    (swap! products assoc "1" prod1)
    (swap! products assoc "2" prod2))
  (println "📦 Database initialized")
  (println "👤 Default admin: admin@example.com / admin123"))

(defn user-exists? [email]
  (some #(= email (:email %)) (vals @users)))

(defn find-user-by-email [email]
  (first (filter #(= email (:email %)) (vals @users))))

(defn find-user-by-id [id]
  (get @users id))

(defn create-user! [user]
  (swap! users assoc (:id user) user))

(defn delete-user! [id]
  (swap! users dissoc id))

(defn get-all-users []
  (vals @users))

(defn find-product-by-id [id]
  (get @products id))

(defn get-all-products []
  (vals @products))

(defn create-product! [product]
  (swap! products assoc (:id product) product))

(defn update-product! [id updates]
  (if (get @products id)
    (swap! products update id merge updates)
    nil))

(defn delete-product! [id]
  (swap! products dissoc id))
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM clojure:lein AS builder

WORKDIR /app

# Copy project file first for better dependency caching
COPY project.clj ./

# Download dependencies
RUN lein deps

# Copy source code
COPY src ./src

# Build uberjar
RUN lein clean
RUN lein uberjar

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:17-jre-jammy AS runtime

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy uberjar from builder
COPY --from=builder /app/target/uberjar/{{projectNameSnake}}-standalone.jar ./app.jar

# Create non-root user
RUN useradd -m -u 1000 appuser

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["java", "-jar", "app.jar"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
`,

    // README
    'README.md': `# {{projectName}}

A service-oriented REST API built with Pedestal web framework for Clojure.

## Features

- **Pedestal**: Service-oriented architecture
- **Interceptors**: Composable request/response processing
- **Async**: Asynchronous request handling
- **Routing**: Data-driven routing
- **Extensible**: Easy to customize

## Requirements

- Clojure 1.11+
- Leiningen 2.x

## Quick Start

\`\`\`bash
lein run
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
