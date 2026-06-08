import { BackendTemplate } from '../types';

export const reititCljTemplate: BackendTemplate = {
  id: 'reitit-clj',
  name: 'reitit-clj',
  displayName: 'Reitit (Clojure)',
  description: 'Data-driven routing library for Clojure with fast router and powerful middleware',
  language: 'clojure',
  framework: 'reitit',
  version: '1.0.0',
  tags: ['clojure', 'reitit', 'routing', 'data-driven', 'middleware', 'ring'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'middleware'],

  files: {
    // Project configuration
    'project.clj': `(defproject {{projectNameSnake}} "0.1.0-SNAPSHOT"
  :description "REST API built with Reitit"
  :url "http://example.com/FIXME"
  :license {:name "EPL-2.0 OR GPL-2.0-or-later WITH Classpath-exception-2.0"
            :url "https://www.eclipse.org/legal/epl-2.0/"}
  :min-lein-version "2.0.0"

  :dependencies [[org.clojure/clojure "1.11.1"]
                 [metosin/reitit "0.6.0"]
                 [metosin/reitit-ring "0.6.0"]
                 [metosin/muuntaja "0.6.8"]
                 [ring/ring-json "0.5.1"]
                 [ring.middleware.cors "0.1.1"]
                 [buddy/buddy-auth "3.0.0"]
                 [buddy/buddy-hashers "3.0.0"]
                 [buddy/buddy-sign "3.4.1"]
                 [clj-time "0.15.2"]]

  :main ^:skip-aot
  :target-path "target/%s"
  :profiles {:uberjar {:aot :all}})
`,

    // Core application
    'src/{{projectNameSnake}}/core.clj': `(ns {{projectNameSnake}}.core
  (:require
   [ring.adapter.jetty :refer [run-jetty]]
   [reitit.ring :as ring]
   [reitit.ring.middleware.muuntaja :as muuntaja]
   [ring.middleware.cors :refer [wrap-cors]]
   [ring.middleware.session :refer [wrap-session]]
   [clojure.tools.logging :as log]
   [{{projectNameSnake}}.db :as db]
   [{{projectNameSnake}}.routes :as routes]))

(defn- wrap-base [handler]
  (-> handler
      (muuntaja/format-interceptor "application/json")
      wrap-session
      (wrap-cors :access-control-allow-origin [#".*"]
                  :access-control-allow-methods [:get :post :put :delete :options]
                  :access-control-allow-headers ["Content-Type" "Authorization"])))

(defn app []
  (db/init!)
  (log/info "🚀 Server running at http://localhost:3000")
  (ring/ring-handler
    (routes/app-routes)
    (ring/routes
      (ring/create-resource-handler {:path "/api/v1" :methods [:options] :response (constantly {:status 200})}))
    {:middleware [wrap-base]}))

(defn -main []
  (run-jetty (app) {:port 3000 :join? false}))
`,

    // Routes
    'src/{{projectNameSnake}}/routes.clj': `(ns {{projectNameSnake}}.routes
  (:require
   [reitit.ring :as ring]
   [{{projectNameSnake}}.handlers.health :as health]
   [{{projectNameSnake}}.handlers.auth :as auth]
   [{{projectNameSnake}}.handlers.user :as user]
   [{{projectNameSnake}}.handlers.product :as product]))

(defn app-routes []
  (ring/router
    ["/api/v1"
     ["/health" {:get health/health}]
     ["/auth/register" {:post auth/register}]
     ["/auth/login" {:post auth/login}]
     ["/auth/me" {:post auth/me}]
     ["/users" {:get user/list}
      ["/:id" {:get user/get :delete user/delete}]]
     ["/products" {:get product/list :post product/create}
      ["/:id" {:get product/get :put product/update :delete product/delete}]]]))
`,

    // Handlers - Health
    'src/{{projectNameSnake}}/handlers/health.clj': `(ns {{projectNameSnake}}.handlers.health
  (:require [clj-time.core :as t])
  (:import java.util.Date))

(defn health [request]
  {:status 200
   :body {:status "healthy"
           :timestamp (str (t/now))
           :version "1.0.0"}})
`,

    // Handlers - Auth
    'src/{{projectNameSnake}}/handlers/auth.clj': `(ns {{projectNameSnake}}.handlers.auth
  (:require
   [buddy.sign.jwt :as jwt]
   [buddy.hashers :as hashers]
   [clj-time.core :as t]
   [{{projectNameSnake}}.db :as db]))

(defn- generate-token [user]
  (jwt/sign (assoc user :exp (t/plus (t/now) (t/days 7)))
            "change-this-secret"))

(defn register [request]
  (let [params (:params request)]
    (if (db/user-exists? (:email params))
      {:status 409 :body {:error "Email already registered"}}
      (let [hashed (hashers/derive (:password params) {:algorithm :pbkdf2+sha256})
            user {:id (str (random-uuid))
                   :email (:email params)
                   :password hashed
                   :name (:name params)
                   :role "user"
                   :created-at (t/now)
                   :updated-at (t/now)}
            _ (db/create-user! user)
            token (generate-token user)]
        {:status 201 :body {:token token :user (dissoc user :password)}})))))

(defn login [request]
  (let [params (:params request)]
    (if-let [user (db/find-user-by-email (:email params))]
      (if (hashers/verify (:password params) (:password user))
        (let [token (generate-token user)]
          {:status 200 :body {:token token :user (dissoc user :password)}})
        {:status 401 :body {:error "Invalid credentials"}})
      {:status 401 :body {:error "Invalid credentials"}})))

(defn me [request]
  (let [user-id (get-in request [:session :user-id])]
    (if-let [user (db/find-user-by-id user-id)]
      {:status 200 :body {:user (dissoc user :password)}}
      {:status 404 :body {:error "User not found"}})))
`,

    // Handlers - User
    'src/{{projectNameSnake}}/handlers/user.clj': `(ns {{projectNameSnake}}.handlers.user
  (:require [{{projectNameSnake}}.db :as db]))

(defn list [request]
  (let [users (db/get-all-users)]
    {:status 200 :body {:users (map #(dissoc % :password) users) :count (count users)}}))

(defn get [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [user (db/find-user-by-id id)]
      {:status 200 :body {:user (dissoc user :password)}}
      {:status 404 :body {:error "User not found"}})))

(defn delete [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-user! id)
      {:status 204 :body nil}
      {:status 404 :body {:error "User not found"}})))
`,

    // Handlers - Product
    'src/{{projectNameSnake}}/handlers/product.clj': `(ns {{projectNameSnake}}.handlers.product
  (:require [clj-time.core :as t]
            [{{projectNameSnake}}.db :as db]))

(defn list [request]
  (let [products (db/get-all-products)]
    {:status 200 :body {:products products :count (count products)}}))

(defn get [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [product (db/find-product-by-id id)]
      {:status 200 :body {:product product}}
      {:status 404 :body {:error "Product not found"}})))

(defn create [request]
  (let [params (:params request)
        product {:id (str (random-uuid))
                 :name (:name params)
                 :description (:description params)
                 :price (:price params)
                 :stock (:stock params)
                 :created-at (t/now)
                 :updated-at (t/now)}]
    (db/create-product! product)
    {:status 201 :body {:product product}}))

(defn update [request]
  (let [id (get-in request [:path-params :id])
        params (:params request)]
    (if-let [product (db/update-product! id params)]
      {:status 200 :body {:product product}}
      {:status 404 :body {:error "Product not found"}})))

(defn delete [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-product! id)
      {:status 204 :body nil}
      {:status 404 :body {:error "Product not found"}})))
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
EXPOSE 3000

ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["java", "-jar", "app.jar"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
`,

    // README
    'README.md': `# {{projectName}}

A data-driven REST API built with Reitit routing for Clojure.

## Features

- **Reitit**: Fast, data-driven routing
- **Muuntaja**: Content negotiation
- **Interceptor-based**: Composable middleware
- **Type-safe routes**: Schema validation
- **Ring**: HTTP abstraction

## Requirements

- Clojure 1.11+
- Leiningen 2.x

## Quick Start

\`\`\`bash
lein run
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
