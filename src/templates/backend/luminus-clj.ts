import { BackendTemplate } from '../types';

export const luminusCljTemplate: BackendTemplate = {
  id: 'luminus-clj',
  name: 'luminus-clj',
  displayName: 'Luminus (Clojure)',
  description: 'Full-stack Clojure web framework with batteries included',
  language: 'clojure',
  framework: 'luminus',
  version: '1.0.0',
  tags: ['clojure', 'luminus', 'full-stack', 'reagent', 'selmer', 'sql', 'websockets'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

  files: {
    // Project configuration
    'project.clj': `(defproject {{projectNameSnake}} "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :url "http://example.com/FIXME"
  :license {:name "EPL-2.0 OR GPL-2.0-or-later WITH Classpath-exception-2.0"
            :url "https://www.eclipse.org/legal/epl-2.0/"}
  :min-lein-version "2.0.0"

  :dependencies [[org.clojure/clojure "1.11.1"]
                 [org.clojure/core.async "1.6.681"]
                 [compojure "1.7.0"]
                 [ring/ring-defaults "0.3.4"]
                 [ring/ring-json "0.5.1"]
                 [ring.middleware.cors "0.1.1"]
                 [reagent "1.1.1"]
                 [re-frame "1.3.0"]
                 [selmer "1.12.59"]
                 [buddy "2.4.0"]
                 [buddy-auth "3.0.1"]
                 [conman "0.9.2"]
                 [luminus-transit "0.1.2"]
                 [luminus-immutant "0.2.4"]
                 [luminus-nrepl "0.1.5"]
                 [markdown-clj "1.11.4"]
                 [luminus-migrations "0.7.0"]
                 [conman "0.9.2"]
                 [mount "0.1.17"]
                 [luminus-http-server "0.1.6"]
                 [luminus-util "0.3.4"]
                 [crypto-password "0.3.0"]
                 [buddy/buddy-auth "3.0.0"]
                 [buddy/buddy-hashers "3.0.0"]
                 [clj-time "0.15.2"]]

  :plugins [[lein-cljfmt "0.6.4"]
            [lein-immutant "0.2.4"]
            [lein-midje "3.2.1"]]

  :middleware [leiningen.v2.deps-dependency-inject/deps-dependency-inject
              leiningen.v2.deps-dependency-inject/plugin/deps-dependency-inject]

  :profiles {:dev {:dependencies [[binaryage/devtools "1.0.6"]
                                  [pjstadig/humane-test-output "0.11.0"]
                                  [com.h2database/h2 "2.2.224"]
                                  [org.clojure/tools.nrepl "1.0.9"]
                                  [org.clojure/test.check "1.1.1"]
                                  [prismatic/schema "1.4.1"]]
                   :source-paths ["env/dev/clj"]
                   :repl-options {:init-ns user}
                   :injections [(require 'pjstadig.humane-test-output)
                                 (pjstadig.humane-test-output/activate!)]}
             :test {:dependencies [[luminus-test "0.1.3"]]}
             :uberjar {:aot :all}}

  :main ^:skip-aot
  :cljs {:builds {:app {:target :browser
                       :output-dir "target/cljsbuild/public/app"
                       :asset-path "/js/app"
                       :modules {:app {:init-fn {{projectNameSnake}}.app/init
                                        :preloads [devtools.preload]
                                        :outputs {:up {:id "up"}}}}}}}
         :devtools {:http-root "target/cljsbuild/public"
                    :preloads [devtools.preload]
                    :watch-dir "src/cljs"}
         :figwheel {:http-root "resources/public"
                    :css-dirs ["resources/public/css"]}
         :sass {:source-paths ["src/sass"]
                :target-path "resources/public/css"}
         :test-commands {"test" ["do" "phantomjs" "once" "test"]}
         :test-fixtures {"test" {"phantomjs-env "test/env cljs/test/env.js"}}}
  :test-selectors {:default (constantly)
                  :integration (complement :integration)})
`,

    // Handler - Main
    'src/clj/{{projectNameSnake}}/handler.clj': `(ns {{projectNameSnake}}.handler
  (:require
   [{{projectNameSnake}}.routes.home :refer [all-routes]]
   [{{projectNameSnake}}.middleware.formats :refer [wrap-json-params-middleware]]
   [reitit.ring :as ring]
   [ring.middleware.content-type :refer [wrap-content-type]]
   [ring.middleware.params :refer [wrap-params]]
   [ring.middleware.cors :refer [wrap-cors]]
   [ring.middleware.session :refer [wrap-session]]
   [ring.middleware.flash :refer [wrap-flash]]
   [ring.middleware.defaults :refer [site-defaults wrap-defaults]]
   [ring.util.response :refer [response content-type]]
   [clojure.tools.logging :as log]))

(defn- wrap-base [handler]
  (-> handler
      wrap-content-type
      wrap-form-params-middleware
      wrap-json-params-middleware
      wrap-session
      wrap-flash
      (wrap-cors :access-control-allow-origin [#".*"]
                  :access-control-allow-methods [:get :post :put :delete :options]
                  :access-control-allow-headers ["Content-Type" "Authorization"])
      (wrap-defaults)))

(defn- wrap-internal-error [handler]
  (try
    (handler)
    (catch Throwable t
      (log/error t "Unhandled error")
      (response {:status 500 :body {:error "Internal server error"}}))))

(defn app []
  (ring/ring-handler
    (all-routes)
    (ring/routes
      (ring/create-resource-handler {:root "/"})
      (ring/create-resource-handler {:path "/api/v1" :methods [:options] :response (constantly {:status 200})}))
    {:middleware [wrap-base wrap-internal-error]}))
`,

    // Routes - Home
    'src/clj/{{projectNameSnake}}/routes/home.clj': `(ns {{projectNameSnake}}.routes.home
  (:require
   [{{projectNameSnake}}.controllers.health :refer [health-routes]]
   [{{projectNameSnake}}.controllers.auth :refer [auth-routes]]
   [{{projectNameSnake}}.controllers.user :refer [user-routes]]
   [{{projectNameSnake}}.controllers.product :refer [product-routes]]
   [reitit.ring :as ring]))

(defn all-routes []
  (ring/router
    (conj
      health-routes
      auth-routes
      user-routes
      product-routes)))
`,

    // Controllers - Health
    'src/clj/{{projectNameSnake}}/controllers/health.clj': `(ns {{projectNameSnake}}.controllers.health
  (:require [reitit.ring :refer [router GET]]
            [ring.util.response :refer [response content-type]]
            [clj-time.core :as t]))

(defn health-handler [request]
  (response {:status "healthy"
              :timestamp (str (t/now))
              :version "1.0.0"}))

(def health-routes
  (router
    ["/api/v1"
     ["/health" {:get health-handler}]]))
`,

    // Controllers - Auth
    'src/clj/{{projectNameSnake}}/controllers/auth.clj': `(ns {{projectNameSnake}}.controllers.auth
  (:require
   [reitit.ring :refer [router POST]]
   [ring.util.response :refer [response content-type]]
   [buddy.sign.jwt :as jwt]
   [buddy.hashers :as hashers]
   [clj-time.core :as t]
   [{{projectNameSnake}}.db.core :as db]))

(defn generate-token [user]
  (jwt/sign (assoc user :exp (t/plus (t/now) (t/days 7)))
            "change-this-secret-in-production"))

(defn register-handler [request]
  (let [params (:params request)
        email (:email params)
        password (:password params)
        name (:name params)]
    (if (db/user-exists? email)
      (response {:status 409 :body {:error "Email already registered"}})
      (let [hashed-password (hashers/derive password {:algorithm :pbkdf2+sha256})
            user {:id (str (random-uuid))
                   :email email
                   :password hashed-password
                   :name name
                   :role "user"
                   :created-at (t/now)
                   :updated-at (t/now)}
            _ (db/create-user! user)
            token (generate-token user)
            user-response {:id (:id user) :email email :name name :role "user"}]
        (response {:status 201 :body {:token token :user user-response}})))))

(defn login-handler [request]
  (let [params (:params request)
        email (:email params)
        password (:password params)]
    (if-let [user (db/find-user-by-email email)]
      (if (hashers/verify password (:password user))
        (let [token (generate-token user)
              user-response {:id (:id user) :email (:email user) :name (:name user) :role (:role user)}]
          (response {:status 200 :body {:token token :user user-response}}))
        (response {:status 401 :body {:error "Invalid credentials"}}))
      (response {:status 401 :body {:error "Invalid credentials"}}))))

(defn me-handler [request]
  (let [token (get-in request [:headers "authorization"])
        user-id (get-in request [:session :user-id])]
    (if-let [user (db/find-user-by-id user-id)]
      (response {:status 200 :body {:user {:id (:id user) :email (:email user) :name (:name user) :role (:role user)}}})
      (response {:status 404 :body {:error "User not found"}}))))

(def auth-routes
  (router
    ["/api/v1/auth"
     ["/register" {:post register-handler}]
     ["/login" {:post login-handler}]
     ["/me" {:post me-handler}]]))
`,

    // Controllers - User
    'src/clj/{{projectNameSnake}}/controllers/user.clj': `(ns {{projectNameSnake}}.controllers.user
  (:require
   [reitit.ring :refer [router GET DELETE]]
   [ring.util.response :refer [response]]
   [{{projectNameSnake}}.db.core :as db]))

(defn list-users-handler [request]
  (let [users (db/get-all-users)]
    (response {:status 200 :body {:users (map #(dissoc % :password) users) :count (count users)}})))

(defn get-user-handler [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [user (db/find-user-by-id id)]
      (response {:status 200 :body {:user (dissoc user :password)}})
      (response {:status 404 :body {:error "User not found"}}))))

(defn delete-user-handler [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-user! id)
      (response {:status 204 :body nil})
      (response {:status 404 :body {:error "User not found"}}))))

(def user-routes
  (router
    ["/api/v1/users"
     [""] {:get list-users-handler}
     ["/:id" {:get get-user-handler
              :delete delete-user-handler}]]))
`,

    // Controllers - Product
    'src/clj/{{projectNameSnake}}/controllers/product.clj': `(ns {{projectNameSnake}}.controllers.product
  (:require
   [reitit.ring :refer [router GET POST PUT DELETE]]
   [ring.util.response :refer [response]]
   [clj-time.core :as t]
   [{{projectNameSnake}}.db.core :as db]))

(defn list-products-handler [request]
  (let [products (db/get-all-products)]
    (response {:status 200 :body {:products products :count (count products)}})))

(defn get-product-handler [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [product (db/find-product-by-id id)]
      (response {:status 200 :body {:product product}})
      (response {:status 404 :body {:error "Product not found"}}))))

(defn create-product-handler [request]
  (let [params (:params request)
        product {:id (str (random-uuid))
                 :name (:name params)
                 :description (:description params)
                 :price (:price params)
                 :stock (:stock params)
                 :created-at (t/now)
                 :updated-at (t/now)}]
    (db/create-product! product)
    (response {:status 201 :body {:product product}})))

(defn update-product-handler [request]
  (let [id (get-in request [:path-params :id])
        params (:params request)]
    (if-let [product (db/update-product! id params)]
      (response {:status 200 :body {:product product}})
      (response {:status 404 :body {:error "Product not found"}}))))

(defn delete-product-handler [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-product! id)
      (response {:status 204 :body nil})
      (response {:status 404 :body {:error "Product not found"}}))))

(def product-routes
  (router
    ["/api/v1/products"
     [""] {:get list-products-handler
           :post create-product-handler}
     ["/:id" {:get get-product-handler
              :put update-product-handler
              :delete delete-product-handler}]]))
`,

    // Database core
    'src/clj/{{projectNameSnake}}/db/core.clj': `(ns {{projectNameSnake}}.db.core
  (:require [clojure.string :as str]))

(def ^:private users (atom {}))
(def ^:private products (atom {}))

(defn init-db! []
  ;; Create admin user
  (let [admin-password "$2a$12$dummy" ;; Use BCrypt in production
        admin {:id "1"
               :email "admin@example.com"
               :password admin-password
               :name "Admin User"
               :role "admin"
               :created-at (java.util.Date.)
               :updated-at (java.util.Date.)}]
    (swap! users assoc "1" admin))

  ;; Create sample products
  (let [now (java.util.Date.)
        product1 {:id "1"
                   :name "Sample Product 1"
                   :description "This is a sample product"
                   :price 29.99
                   :stock 100
                   :created-at now
                   :updated-at now}
        product2 {:id "2"
                   :name "Sample Product 2"
                   :description "Another sample product"
                   :price 49.99
                   :stock 50
                   :created-at now
                   :updated-at now}]
    (swap! products assoc "1" product1)
    (swap! products assoc "2" product2))

  (println "📦 Database initialized")
  (println "👤 Default admin user: admin@example.com / admin123")
  (println "📦 Sample products created"))

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
    (swap! products update id #(merge % updates))
    nil))

(defn delete-product! [id]
  (swap! products dissoc id))
`,

    // Middleware formats
    'src/clj/{{projectNameSnake}}/middleware/formats.clj': `(ns {{projectNameSnake}}.middleware.formats
  (:require [ring.middleware.json :refer [wrap-json-response]]
            [ring.middleware.format :refer [wrap-restful-format]]))

(defn wrap-json-params-middleware
  "Middleware that parses JSON request bodies and adds them to the request map."
  [handler]
  (fn [request]
    (let [json-body? (:json-params request)]
      (handler (assoc request :params (merge (:params request) json-body?))))))

(defn wrap-api-format [handler]
  (-> handler
      wrap-json-response
      (wrap-restful-format :formats [:json-kw :transit-json :edn])))
`,

    // Environment
    'profiles.clj': `(defproject profiles
  :dependencies [[org.clojure/tools.profile "0.6.1"]])
`,

    // Development profile
    'profiles/dev/clj/user.clj': `(ns user
  (:require [{{projectNameSnake}}.db.core :as db]
            [{{projectNameSnake}}.handler :refer [app]]
            [luminus.http-server :as server]
            [luminus-nrepl.server :as nrepl]))

(defn -main []
  (db/init-db!)
  (println "🚀 Server running at http://localhost:3000")
  (println "📚 API docs: http://localhost:3000/api/v1/health")
  (server/start (app) {:port 3000}))
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM clojure:lein AS builder

WORKDIR /app

# Copy project files first for better dependency caching
COPY project.clj profiles.clj ./

# Copy profiles directory if it exists
COPY profiles/ ./profiles/ 2>/dev/null || true

# Download dependencies (for better layer caching)
RUN lein deps

# Copy source code
COPY src/ ./src/

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

    // Tests
    'test/{{projectNameSnake}}/core_test.clj': `(ns {{projectNameSnake}}.core-test
  (:require [clojure.test :refer :all]
            [{{projectNameSnake}}.routes.home :refer [all-routes]]
            [ring.mock.request :as mock]
            [{{projectNameSnake}}.db.core :as db]))

(deftest test-database-initialization
  (testing "Database initializes with admin user"
    (db/init-db!)
    (is (some? (db/find-user-by-email "admin@example.com")))))

(deftest test-health-endpoint
  (testing "Health check returns healthy status"
    (let [response ((all-routes) (mock/request :get "/api/v1/health"))]
      (is (= 200 (:status response))))))
`,

    // README
    'README.md': `# {{projectName}}

A full-stack REST API built with Luminus web framework for Clojure.

## Features

- **Luminus**: Batteries-included Clojure web framework
- **Reagent**: ClojureScript wrapper for React
- **Re-frame**: Functional state management
- **Selmer**: Django/Jinja-like templating
- **Buddy**: Authentication and security
- **Conman**: Database connections and migrations
- **Compojure**: Routing library

## Requirements

- Clojure 1.11+
- Leiningen 2.x

## Quick Start

1. Install dependencies:
   \`\`\`bash
   lein deps
   \`\`\`

2. Run in development:
   \`\`\`bash
   lein run
   \`\`\`

## API Endpoints

### Health
- \`GET /api/v1/health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/me\` - Get current user

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Project Structure

\`\`\`
├── src/
│   └── clj/{{projectNameSnake}}/
│       ├── handler.clj           # Entry point
│       ├── routes/               # Route definitions
│       ├── controllers/          # Request handlers
│       ├── db/                   # Database layer
│       └── middleware/           # Middleware
├── test/                         # Tests
├── profiles/                     # Environment profiles
└── project.clj                   # Leiningen config
\`\`\`

## Development

\`\`\`bash
# Start REPL with nREPL
lein repl

# Run with hot-reload
lein run

# Run tests
lein test

# Build uberjar
lein uberjar
\`\`\`

## Luminus Features

- **Full-Stack**: Frontend and backend
- **Database**: SQL and NoSQL support
- **WebSockets**: Real-time communication
- **Auth**: Built-in authentication
- **Migrations**: Database migrations
- **Logging**: Structured logging
- **Testing**: Midje and test.check

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

## License

MIT
`
  }
};
