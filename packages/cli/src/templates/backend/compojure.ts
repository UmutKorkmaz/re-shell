import { BackendTemplate } from '../types';

export const compojureTemplate: BackendTemplate = {
  id: 'compojure',
  name: 'Compojure',
  description: 'Clojure routing library with Ring middleware for web applications',
  version: '1.0.0',
  framework: 'compojure',
  displayName: 'Compojure (Clojure)',
  language: 'clojure',
  port: 3000,
  tags: ['clojure', 'compojure', 'ring', 'web', 'api', 'rest', 'functional', 'jvm'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation'],
  dependencies: {},
  devDependencies: {},
  files: {
    'project.clj': `(defproject {{projectName}} "0.1.0-SNAPSHOT"
  :description "{{description}}"
  :url "https://github.com/{{author}}/{{projectName}}"
  :license {:name "MIT"
            :url "https://opensource.org/licenses/MIT"}

  :dependencies [[org.clojure/clojure "1.11.1"]
                 [ring/ring-core "1.10.0"]
                 [ring/ring-jetty-adapter "1.10.0"]
                 [ring/ring-json "0.5.1"]
                 [ring-cors "0.1.13"]
                 [compojure "1.7.0"]
                 [buddy/buddy-sign "3.5.351"]
                 [buddy/buddy-hashers "2.0.167"]
                 [environ "1.2.0"]
                 [cheshire "5.12.0"]
                 [clj-time "0.15.2"]]

  :plugins [[lein-ring "0.12.6"]
            [lein-environ "1.2.0"]]

  :ring {:handler {{projectName}}.core/app
         :init {{projectName}}.core/init
         :port 3000}

  :main ^:skip-aot {{projectName}}.core

  :target-path "target/%s"

  :profiles {:dev {:dependencies [[ring/ring-mock "0.4.0"]
                                  [kerodon "0.9.1"]]
                   :env {:port "3000"
                         :jwt-secret "dev-secret"}}

             :test {:env {:port "3001"
                          :jwt-secret "test-secret"}}

             :uberjar {:aot :all
                       :jvm-opts ["-Dclojure.compiler.direct-linking=true"]}})
`,

    'src/{{projectName}}/core.clj': `(ns {{projectName}}.core
  (:require [compojure.core :refer :all]
            [compojure.route :as route]
            [ring.middleware.json :refer [wrap-json-response wrap-json-body]]
            [ring.middleware.cors :refer [wrap-cors]]
            [ring.middleware.keyword-params :refer [wrap-keyword-params]]
            [ring.middleware.params :refer [wrap-params]]
            [ring.adapter.jetty :refer [run-jetty]]
            [environ.core :refer [env]]
            [{{projectName}}.handlers :as handlers]
            [{{projectName}}.middleware :as mw])
  (:gen-class))

(defroutes api-routes
  ;; Health check
  (GET "/health" [] handlers/health-handler)

  ;; Root endpoint
  (GET "/" [] handlers/root-handler)

  ;; Auth routes
  (POST "/api/auth/register" [] handlers/register-handler)
  (POST "/api/auth/login" [] handlers/login-handler)

  ;; Protected user routes
  (GET "/api/users/me" [] (mw/wrap-auth handlers/get-me-handler))
  (GET "/api/users" [] (mw/wrap-auth handlers/list-users-handler))
  (GET "/api/users/:id" [id] (mw/wrap-auth (partial handlers/get-user-handler id)))

  ;; Protected item routes
  (GET "/api/items" [] (mw/wrap-auth handlers/list-items-handler))
  (POST "/api/items" [] (mw/wrap-auth handlers/create-item-handler))
  (GET "/api/items/:id" [id] (mw/wrap-auth (partial handlers/get-item-handler id)))
  (DELETE "/api/items/:id" [id] (mw/wrap-auth (partial handlers/delete-item-handler id)))

  ;; Not found
  (route/not-found {:status 404
                    :body {:error "not_found"
                           :message "Resource not found"}}))

(def app
  (-> api-routes
      wrap-keyword-params
      wrap-params
      (wrap-json-body {:keywords? true})
      wrap-json-response
      (wrap-cors :access-control-allow-origin [#".*"]
                 :access-control-allow-methods [:get :post :put :delete :options]
                 :access-control-allow-headers ["Content-Type" "Authorization"])
      mw/wrap-logging))

(defn init []
  (println "Initializing {{projectName}}..."))

(defn -main [& args]
  (let [port (Integer/parseInt (or (env :port) "3000"))]
    (println (str "🚀 {{projectName}} server starting on http://localhost:" port))
    (run-jetty app {:port port :join? true})))
`,

    'src/{{projectName}}/handlers.clj': `(ns {{projectName}}.handlers
  (:require [{{projectName}}.db :as db]
            [{{projectName}}.auth :as auth]
            [clojure.string :as str]))

;; Health check
(defn health-handler [request]
  {:status 200
   :body {:status "healthy"
          :timestamp (str (java.time.Instant/now))}})

;; Root endpoint
(defn root-handler [request]
  {:status 200
   :body {:name "{{projectName}}"
          :version "1.0.0"
          :framework "Compojure"
          :language "Clojure"
          :description "{{description}}"}})

;; Auth handlers
(defn register-handler [request]
  (let [{:keys [email name password]} (:body request)]
    (cond
      (or (str/blank? email) (str/blank? name) (str/blank? password))
      {:status 400
       :body {:error "validation_error"
              :message "Email, name and password are required"}}

      (db/find-user-by-email email)
      {:status 409
       :body {:error "conflict"
              :message "User with this email already exists"}}

      :else
      (let [user (db/create-user! email name password)]
        {:status 201
         :body (dissoc user :password)}))))

(defn login-handler [request]
  (let [{:keys [email password]} (:body request)
        user (db/find-user-by-email email)]
    (if (and user (db/verify-password (:id user) password))
      {:status 200
       :body (auth/generate-token (:id user))}
      {:status 401
       :body {:error "unauthorized"
              :message "Invalid email or password"}})))

;; User handlers
(defn get-me-handler [request]
  (let [user-id (:user-id request)
        user (db/find-user-by-id user-id)]
    (if user
      {:status 200
       :body (dissoc user :password)}
      {:status 404
       :body {:error "not_found"
              :message "User not found"}})))

(defn list-users-handler [request]
  {:status 200
   :body (map #(dissoc % :password) (db/get-all-users))})

(defn get-user-handler [id request]
  (let [user-id (Integer/parseInt id)
        user (db/find-user-by-id user-id)]
    (if user
      {:status 200
       :body (dissoc user :password)}
      {:status 404
       :body {:error "not_found"
              :message "User not found"}})))

;; Item handlers
(defn list-items-handler [request]
  (let [user-id (:user-id request)
        items (db/get-items-by-user user-id)]
    {:status 200
     :body items}))

(defn create-item-handler [request]
  (let [user-id (:user-id request)
        {:keys [name description]} (:body request)]
    (if (str/blank? name)
      {:status 400
       :body {:error "validation_error"
              :message "Name is required"}}
      (let [item (db/create-item! name (or description "") user-id)]
        {:status 201
         :body item}))))

(defn get-item-handler [id request]
  (let [user-id (:user-id request)
        item-id (Integer/parseInt id)
        item (db/find-item-by-id item-id user-id)]
    (if item
      {:status 200
       :body item}
      {:status 404
       :body {:error "not_found"
              :message "Item not found"}})))

(defn delete-item-handler [id request]
  (let [user-id (:user-id request)
        item-id (Integer/parseInt id)]
    (if (db/delete-item! item-id user-id)
      {:status 204
       :body nil}
      {:status 404
       :body {:error "not_found"
              :message "Item not found"}})))
`,

    'src/{{projectName}}/db.clj': `(ns {{projectName}}.db
  (:require [buddy.hashers :as hashers]))

;; In-memory storage (use proper database in production)
(def ^:private users (atom []))
(def ^:private passwords (atom {}))
(def ^:private items (atom []))
(def ^:private user-id-counter (atom 0))
(def ^:private item-id-counter (atom 0))

;; User operations
(defn find-user-by-email [email]
  (first (filter #(= (:email %) email) @users)))

(defn find-user-by-id [id]
  (first (filter #(= (:id %) id) @users)))

(defn create-user! [email name password]
  (let [id (swap! user-id-counter inc)
        user {:id id
              :email email
              :name name
              :created-at (str (java.time.Instant/now))}]
    (swap! users conj user)
    (swap! passwords assoc id password)
    user))

(defn verify-password [user-id password]
  (= (get @passwords user-id) password))

(defn get-all-users []
  @users)

;; Item operations
(defn get-items-by-user [user-id]
  (filter #(= (:user-id %) user-id) @items))

(defn create-item! [name description user-id]
  (let [id (swap! item-id-counter inc)
        item {:id id
              :name name
              :description description
              :user-id user-id
              :created-at (str (java.time.Instant/now))}]
    (swap! items conj item)
    item))

(defn find-item-by-id [item-id user-id]
  (first (filter #(and (= (:id %) item-id)
                       (= (:user-id %) user-id))
                 @items)))

(defn delete-item! [item-id user-id]
  (let [original-count (count @items)]
    (swap! items (fn [items]
                   (remove #(and (= (:id %) item-id)
                                 (= (:user-id %) user-id))
                           items)))
    (not= original-count (count @items))))

;; Reset for testing
(defn reset-db! []
  (reset! users [])
  (reset! passwords {})
  (reset! items [])
  (reset! user-id-counter 0)
  (reset! item-id-counter 0))
`,

    'src/{{projectName}}/auth.clj': `(ns {{projectName}}.auth
  (:require [buddy.sign.jwt :as jwt]
            [environ.core :refer [env]]
            [clj-time.core :as time]
            [clj-time.coerce :as coerce]))

(def ^:private jwt-secret
  (or (env :jwt-secret) "your-secret-key-change-in-production"))

(defn generate-token [user-id]
  (let [expires-at (time/plus (time/now) (time/hours 24))
        claims {:user-id user-id
                :exp (coerce/to-epoch expires-at)}
        token (jwt/sign claims jwt-secret)]
    {:token token
     :expires-at (coerce/to-epoch expires-at)}))

(defn verify-token [token]
  (try
    (let [claims (jwt/unsign token jwt-secret)]
      (:user-id claims))
    (catch Exception e
      nil)))
`,

    'src/{{projectName}}/middleware.clj': `(ns {{projectName}}.middleware
  (:require [{{projectName}}.auth :as auth]
            [clojure.string :as str]))

(defn wrap-logging [handler]
  (fn [request]
    (let [start (System/currentTimeMillis)
          response (handler request)
          duration (- (System/currentTimeMillis) start)]
      (println (format "[%s] %s - %dms"
                       (name (:request-method request))
                       (:uri request)
                       duration))
      response)))

(defn wrap-auth [handler]
  (fn [request]
    (let [auth-header (get-in request [:headers "authorization"])]
      (if (and auth-header (str/starts-with? auth-header "Bearer "))
        (let [token (subs auth-header 7)
              user-id (auth/verify-token token)]
          (if user-id
            (handler (assoc request :user-id user-id))
            {:status 401
             :body {:error "unauthorized"
                    :message "Invalid or expired token"}}))
        {:status 401
         :body {:error "unauthorized"
                :message "Authentication required"}}))))
`,

    'test/{{projectName}}/core_test.clj': `(ns {{projectName}}.core-test
  (:require [clojure.test :refer :all]
            [ring.mock.request :as mock]
            [cheshire.core :as json]
            [{{projectName}}.core :refer [app]]
            [{{projectName}}.db :as db]))

(defn parse-body [response]
  (when (:body response)
    (json/parse-string (slurp (:body response)) true)))

(use-fixtures :each (fn [f]
                      (db/reset-db!)
                      (f)))

(deftest test-health-endpoint
  (testing "Health check returns OK"
    (let [response (app (mock/request :get "/health"))
          body (parse-body response)]
      (is (= 200 (:status response)))
      (is (= "healthy" (:status body))))))

(deftest test-root-endpoint
  (testing "Root returns API info"
    (let [response (app (mock/request :get "/"))
          body (parse-body response)]
      (is (= 200 (:status response)))
      (is (= "Compojure" (:framework body)))
      (is (= "Clojure" (:language body))))))

(deftest test-register
  (testing "Register creates user"
    (let [response (app (-> (mock/request :post "/api/auth/register")
                            (mock/json-body {:email "test@example.com"
                                             :name "Test User"
                                             :password "password123"})))
          body (parse-body response)]
      (is (= 201 (:status response)))
      (is (= "test@example.com" (:email body))))))

(deftest test-login
  (testing "Login returns token"
    ;; First register
    (app (-> (mock/request :post "/api/auth/register")
             (mock/json-body {:email "login@example.com"
                              :name "Login User"
                              :password "password123"})))
    ;; Then login
    (let [response (app (-> (mock/request :post "/api/auth/login")
                            (mock/json-body {:email "login@example.com"
                                             :password "password123"})))
          body (parse-body response)]
      (is (= 200 (:status response)))
      (is (contains? body :token)))))

(deftest test-protected-endpoint
  (testing "Protected endpoint requires auth"
    (let [response (app (mock/request :get "/api/users/me"))]
      (is (= 401 (:status response))))))
`,

    'resources/config.edn': `{:port 3000
 :jwt-secret "your-secret-key-change-in-production"
 :database-url "jdbc:postgresql://localhost/{{projectName}}"}
`,

    '.env': `# Environment Configuration
PORT=3000
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=jdbc:postgresql://localhost/{{projectName}}
`,

    '.env.example': `# Environment Configuration
PORT=3000
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=jdbc:postgresql://localhost/{{projectName}}
`,

    '.gitignore': `# Leiningen
/target
/classes
/checkouts
pom.xml
pom.xml.asc
*.jar
*.class

# IDE
.idea/
.vscode/
*.swp
.nrepl-port
.cpcache/

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
profiles.clj

# Logs
*.log
logs/
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean deps repl uberjar

all: build

# Install dependencies
deps:
	lein deps

# Build the project
build: deps
	lein compile

# Run the server
run:
	lein run

# Run with Ring
ring:
	lein ring server-headless

# Run tests
test:
	lein test

# Start REPL
repl:
	lein repl

# Build uberjar
uberjar:
	lein uberjar

# Clean build artifacts
clean:
	lein clean

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 3000:3000 --env-file .env {{projectName}}
`,

    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM clojure:openjdk-17-lein AS builder

WORKDIR /app

# Copy project file and fetch dependencies (for better caching)
COPY project.clj ./
RUN lein deps

# Copy source and build uberjar
COPY . .
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
COPY --from=builder /app/target/uberjar/{{projectName}}-*-standalone.jar ./app.jar

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

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
      - DATABASE_URL=jdbc:postgresql://db:5432/{{projectName}}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB={{projectName}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
`,

    'README.md': `# {{projectName}}

{{description}}

A Clojure web application built with Compojure and Ring.

## Features

- 🚀 Functional web framework on JVM
- 🔐 JWT authentication with Buddy
- 📝 Full REST API with CRUD operations
- 🧪 Test suite with ring-mock
- 🐳 Docker support
- ⚡ Ring middleware ecosystem

## Requirements

- Java 17+
- Leiningen 2.x

## Installation

\`\`\`bash
# Install dependencies
lein deps

# Run the server
lein run
\`\`\`

## Development

\`\`\`bash
# Run in development mode
lein run

# Run with Ring (auto-reload)
lein ring server-headless

# Run tests
lein test

# Start REPL
lein repl

# Build uberjar
lein uberjar
\`\`\`

## API Endpoints

### Public

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login and get JWT token

### Protected (requires JWT)

- \`GET /api/users/me\` - Get current user
- \`GET /api/users\` - List all users
- \`GET /api/users/:id\` - Get user by ID
- \`GET /api/items\` - List user's items
- \`POST /api/items\` - Create new item
- \`GET /api/items/:id\` - Get item by ID
- \`DELETE /api/items/:id\` - Delete item

## Docker

\`\`\`bash
# Build image
docker build -t {{projectName}} .

# Run container
docker run -p 3000:3000 {{projectName}}

# Or use docker-compose
docker-compose up -d
\`\`\`

## Clojure Features

This project demonstrates idiomatic Clojure:
- Immutable data structures
- Functional composition
- REPL-driven development
- Ring middleware pattern

## License

MIT
`},
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-compojure-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A Clojure web application built with Compojure'},
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: 'developer'}],
  postInstall: [
    'lein deps',
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: lein run"']};
