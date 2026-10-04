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
  features: ['routing', 'middleware', 'rest-api', 'authentication', 'logging', 'cors', 'validation', 'graphql'],
  dependencies: {},
  devDependencies: {},
  files: {
    'project.clj': `(defproject {{projectName}} "0.1.0-SNAPSHOT"
  :description "REST API built with Compojure and Ring"
  :license {:name "MIT"
            :url "https://opensource.org/licenses/MIT"}
  :min-lein-version "2.9.0"

  :dependencies [[org.clojure/clojure "1.12.0"]
                 [ring/ring-core "1.12.2"]
                 [ring/ring-jetty-adapter "1.12.2"]
                 [ring/ring-json "0.5.1"]
                 [ring-cors "0.1.13"]
                 [compojure "1.7.1"]
                 [com.walmartlabs/lacinia "1.2.1"]
                 [buddy/buddy-sign "3.5.351"]
                 [buddy/buddy-hashers "2.0.167"]
                 [cheshire "5.13.0"]]

  :main ^:skip-aot {{projectNameSnake}}.core

  :target-path "target/%s"

  :profiles {:dev {:dependencies [[ring/ring-mock "0.4.0"]]}
             :uberjar {:aot :all
                       :uberjar-name "{{projectNameSnake}}-standalone.jar"
                       :jvm-opts ["-Dclojure.compiler.direct-linking=true"]}})
`,

    'src/{{projectNameSnake}}/core.clj': `(ns {{projectNameSnake}}.core
  (:require [compojure.core :refer [defroutes routes wrap-routes GET POST DELETE ANY]]
            [ring.adapter.jetty :refer [run-jetty]]
            [ring.middleware.cors :refer [wrap-cors]]
            [ring.middleware.json :refer [wrap-json-body wrap-json-response]]
            [{{projectNameSnake}}.db :as db]
            [{{projectNameSnake}}.graphql :as graphql]
            [{{projectNameSnake}}.handlers :as handlers]
            [{{projectNameSnake}}.middleware :as mw])
  (:gen-class))

(defroutes public-routes
  (GET "/" request (handlers/root-handler request))
  (GET "/health" request (handlers/health-handler request))
  (POST "/graphql" request (graphql/graphql-handler request))
  (POST "/api/auth/register" request (handlers/register-handler request))
  (POST "/api/auth/login" request (handlers/login-handler request)))

;; Every route in here runs behind mw/wrap-auth (JWT bearer token).
(defroutes protected-routes
  (GET "/api/users/me" request (handlers/get-me-handler request))
  (GET "/api/users" request (handlers/list-users-handler request))
  (GET "/api/users/:id" [id] (handlers/get-user-handler id))
  (GET "/api/items" request (handlers/list-items-handler request))
  (POST "/api/items" request (handlers/create-item-handler request))
  (GET "/api/items/:id" [id :as request] (handlers/get-item-handler id request))
  (DELETE "/api/items/:id" [id :as request] (handlers/delete-item-handler id request)))

(defroutes not-found-routes
  (ANY "*" [] {:status 404
               :body {:error "not_found"
                      :message "Resource not found"}}))

(def app
  (-> (routes public-routes
              (wrap-routes protected-routes mw/wrap-auth)
              not-found-routes)
      (wrap-json-body {:keywords? true})
      wrap-json-response
      (wrap-cors :access-control-allow-origin [#".*"]
                 :access-control-allow-methods [:get :post :put :delete :options]
                 :access-control-allow-headers ["Content-Type" "Authorization"])
      mw/wrap-logging))

(defn -main [& _args]
  (let [port (Integer/parseInt (or (System/getenv "PORT") "{{port}}"))]
    (db/init!)
    (println (str "{{projectName}} listening on http://localhost:" port))
    (run-jetty app {:port port :join? true})))
`,

    'src/{{projectNameSnake}}/handlers.clj': `(ns {{projectNameSnake}}.handlers
  (:require [clojure.string :as str]
            [{{projectNameSnake}}.auth :as auth]
            [{{projectNameSnake}}.db :as db]))

(defn- json-body
  "The parsed JSON body of the request, or an empty map when there is none."
  [request]
  (let [body (:body request)]
    (if (map? body) body {})))

(defn- error [status code message]
  {:status status
   :body {:error code
          :message message}})

(defn- parse-id [value]
  (try
    (Long/parseLong (str value))
    (catch NumberFormatException _ nil)))

(defn- public-user [user]
  (dissoc user :password-hash))

;; Health and info
(defn health-handler [_request]
  {:status 200
   :body {:status "healthy"
          :timestamp (str (java.time.Instant/now))}})

(defn root-handler [_request]
  {:status 200
   :body {:name "{{projectName}}"
          :version "0.1.0"
          :framework "Compojure"
          :language "Clojure"}})

;; Auth
(defn register-handler [request]
  (let [{:keys [email name password]} (json-body request)]
    (cond
      (or (not (string? email)) (str/blank? email)
          (not (string? name)) (str/blank? name)
          (not (string? password)) (str/blank? password))
      (error 400 "validation_error" "Email, name and password are required")

      (db/find-user-by-email email)
      (error 409 "conflict" "User with this email already exists")

      :else
      (let [user (db/create-user! email name (auth/hash-password password))]
        {:status 201
         :body (public-user user)}))))

(defn login-handler [request]
  (let [{:keys [email password]} (json-body request)
        user (when (string? email) (db/find-user-by-email email))]
    (if (and user
             (string? password)
             (auth/valid-password? password (:password-hash user)))
      {:status 200
       :body (auth/generate-token (:id user))}
      (error 401 "unauthorized" "Invalid email or password"))))

;; Users
(defn get-me-handler [request]
  (if-let [user (db/find-user-by-id (:user-id request))]
    {:status 200
     :body (public-user user)}
    (error 404 "not_found" "User not found")))

(defn list-users-handler [_request]
  {:status 200
   :body (map public-user (db/get-all-users))})

(defn get-user-handler [id]
  (if-let [user (some-> (parse-id id) db/find-user-by-id)]
    {:status 200
     :body (public-user user)}
    (error 404 "not_found" "User not found")))

;; Items
(defn list-items-handler [request]
  {:status 200
   :body (db/get-items-by-user (:user-id request))})

(defn create-item-handler [request]
  (let [{:keys [name description]} (json-body request)]
    (if (or (not (string? name)) (str/blank? name))
      (error 400 "validation_error" "Name is required")
      {:status 201
       :body (db/create-item! name
                              (if (string? description) description "")
                              (:user-id request))})))

(defn get-item-handler [id request]
  (if-let [item (some-> (parse-id id) (db/find-item-by-id (:user-id request)))]
    {:status 200
     :body item}
    (error 404 "not_found" "Item not found")))

(defn delete-item-handler [id request]
  (if (some-> (parse-id id) (db/delete-item! (:user-id request)))
    {:status 204}
    (error 404 "not_found" "Item not found")))
`,

    'src/{{projectNameSnake}}/db.clj': `(ns {{projectNameSnake}}.db
  "In-memory storage. Swap this namespace for a real database (next.jdbc,
  HoneySQL, ...) before going to production.")

(defonce ^:private users (atom {}))
(defonce ^:private items (atom {}))
(defonce ^:private user-ids (atom 0))
(defonce ^:private item-ids (atom 0))

(defn- now []
  (str (java.time.Instant/now)))

(defn init!
  "Hook for start-up work (seed data, connection pools). Nothing to do for the in-memory store."
  []
  nil)

(defn reset-db!
  "Empties the store. Used by the tests."
  []
  (reset! users {})
  (reset! items {})
  (reset! user-ids 0)
  (reset! item-ids 0))

;; Users
(defn find-user-by-email [email]
  (first (filter #(= (:email %) email) (vals @users))))

(defn find-user-by-id [id]
  (get @users id))

(defn get-all-users []
  (sort-by :id (vals @users)))

(defn create-user! [email name password-hash]
  (let [id (swap! user-ids inc)
        user {:id id
              :email email
              :name name
              :password-hash password-hash
              :created-at (now)}]
    (swap! users assoc id user)
    user))

;; Items
(defn get-items-by-user [user-id]
  (sort-by :id (filter #(= (:user-id %) user-id) (vals @items))))

(defn find-item-by-id [item-id user-id]
  (let [item (get @items item-id)]
    (when (and item (= (:user-id item) user-id))
      item)))

(defn create-item! [name description user-id]
  (let [id (swap! item-ids inc)
        item {:id id
              :name name
              :description description
              :user-id user-id
              :created-at (now)}]
    (swap! items assoc id item)
    item))

(defn delete-item!
  "Deletes the item when it belongs to the user. Returns true when something was deleted."
  [item-id user-id]
  (let [[before after] (swap-vals! items
                                   (fn [current]
                                     (let [item (get current item-id)]
                                       (if (and item (= (:user-id item) user-id))
                                         (dissoc current item-id)
                                         current))))]
    (not= (count before) (count after))))
`,

    'src/{{projectNameSnake}}/auth.clj': `(ns {{projectNameSnake}}.auth
  (:require [buddy.hashers :as hashers]
            [buddy.sign.jwt :as jwt]))

(def ^:private token-ttl-seconds (* 24 60 60))

(defn- jwt-secret []
  (or (System/getenv "JWT_SECRET") "dev-secret-change-me"))

(defn- now-seconds []
  (quot (System/currentTimeMillis) 1000))

(defn hash-password [password]
  (hashers/derive password))

(defn valid-password? [password password-hash]
  (let [result (hashers/verify password password-hash)]
    (if (map? result)
      (boolean (:valid result))
      (boolean result))))

(defn generate-token [user-id]
  (let [expires-at (+ (now-seconds) token-ttl-seconds)]
    {:token (jwt/sign {:user-id user-id :exp expires-at} (jwt-secret) {:alg :hs256})
     :expires-at expires-at}))

(defn verify-token
  "Returns the user id carried by a valid token, or nil."
  [token]
  (try
    (:user-id (jwt/unsign token (jwt-secret) {:alg :hs256}))
    (catch Exception _
      nil)))
`,

    'src/{{projectNameSnake}}/graphql.clj': `(ns {{projectNameSnake}}.graphql
  "GraphQL endpoint built with Lacinia."
  (:require [com.walmartlabs.lacinia :as lacinia]
            [com.walmartlabs.lacinia.schema :as schema]))

(def compiled-schema
  (schema/compile
    {:queries
     {:hello {:type 'String
              :resolve (fn [_context _args _value] "Hello from GraphQL!")}
      :health {:type 'String
               :resolve (fn [_context _args _value] "healthy")}}}))

(defn graphql-handler
  "POST /graphql. Expects a JSON body with a query string and optional variables."
  [request]
  (let [body (if (map? (:body request)) (:body request) {})
        query (:query body)]
    (if (string? query)
      {:status 200
       :body (lacinia/execute compiled-schema query (:variables body) nil)}
      {:status 400
       :body {:errors [{:message "A GraphQL query string is required"}]}})))
`,

    'src/{{projectNameSnake}}/middleware.clj': `(ns {{projectNameSnake}}.middleware
  (:require [clojure.string :as str]
            [{{projectNameSnake}}.auth :as auth]))

(defn wrap-logging [handler]
  (fn [request]
    (let [start (System/nanoTime)
          response (handler request)
          elapsed-ms (quot (- (System/nanoTime) start) 1000000)]
      (println (format "%s %s -> %s (%dms)"
                       (str/upper-case (name (:request-method request)))
                       (:uri request)
                       (:status response)
                       elapsed-ms))
      response)))

(defn- unauthorized [message]
  {:status 401
   :body {:error "unauthorized"
          :message message}})

(defn wrap-auth
  "Requires a valid 'Authorization: Bearer <jwt>' header and adds :user-id to the request."
  [handler]
  (fn [request]
    (let [header (get-in request [:headers "authorization"])]
      (if (and header (str/starts-with? header "Bearer "))
        (if-let [user-id (auth/verify-token (subs header 7))]
          (handler (assoc request :user-id user-id))
          (unauthorized "Invalid or expired token"))
        (unauthorized "Authentication required")))))
`,

    'test/{{projectNameSnake}}/core_test.clj': `(ns {{projectNameSnake}}.core-test
  (:require [cheshire.core :as json]
            [clojure.test :refer [deftest is testing use-fixtures]]
            [ring.mock.request :as mock]
            [{{projectNameSnake}}.core :refer [app]]
            [{{projectNameSnake}}.db :as db]))

(use-fixtures :each (fn [run-test]
                      (db/reset-db!)
                      (run-test)))

(defn- parse-body [response]
  (when (:body response)
    (json/parse-string (:body response) true)))

(defn- json-request
  ([method uri payload]
   (json-request method uri payload nil))
  ([method uri payload token]
   (cond-> (-> (mock/request method uri)
               (mock/content-type "application/json")
               (mock/body (json/generate-string payload)))
     token (mock/header "Authorization" (str "Bearer " token)))))

(defn- authed-request [method uri token]
  (mock/header (mock/request method uri) "Authorization" (str "Bearer " token)))

(defn- register! [email]
  (app (json-request :post "/api/auth/register"
                     {:email email :name "Test User" :password "password123"})))

(defn- login-token! [email]
  (-> (app (json-request :post "/api/auth/login" {:email email :password "password123"}))
      parse-body
      :token))

(deftest health-endpoint
  (let [response (app (mock/request :get "/health"))]
    (is (= 200 (:status response)))
    (is (= "healthy" (:status (parse-body response))))))

(deftest root-endpoint
  (let [body (parse-body (app (mock/request :get "/")))]
    (is (= "Compojure" (:framework body)))
    (is (= "Clojure" (:language body)))))

(deftest unknown-route-is-json-404
  (let [response (app (mock/request :get "/nope"))]
    (is (= 404 (:status response)))
    (is (= "not_found" (:error (parse-body response))))))

(deftest register-and-login
  (testing "registering creates a user without exposing the password hash"
    (let [response (register! "test@example.com")
          body (parse-body response)]
      (is (= 201 (:status response)))
      (is (= "test@example.com" (:email body)))
      (is (not (contains? body :password-hash)))))
  (testing "registering the same email twice conflicts"
    (is (= 409 (:status (register! "test@example.com")))))
  (testing "login returns a token for good credentials"
    (is (string? (login-token! "test@example.com"))))
  (testing "login rejects a wrong password"
    (is (= 401 (:status (app (json-request :post "/api/auth/login"
                                           {:email "test@example.com" :password "wrong"})))))))

(deftest registration-validation
  (is (= 400 (:status (app (json-request :post "/api/auth/register" {:email "a@b.c"}))))))

(deftest protected-endpoints-require-a-token
  (is (= 401 (:status (app (mock/request :get "/api/users/me")))))
  (is (= 401 (:status (app (authed-request :get "/api/users/me" "not-a-token"))))))

(deftest current-user
  (register! "me@example.com")
  (let [token (login-token! "me@example.com")
        response (app (authed-request :get "/api/users/me" token))]
    (is (= 200 (:status response)))
    (is (= "me@example.com" (:email (parse-body response))))))

(deftest item-lifecycle
  (register! "items@example.com")
  (let [token (login-token! "items@example.com")
        created (app (json-request :post "/api/items" {:name "First item"} token))
        item-id (:id (parse-body created))]
    (is (= 201 (:status created)))
    (is (= 1 (count (parse-body (app (authed-request :get "/api/items" token))))))
    (is (= 200 (:status (app (authed-request :get (str "/api/items/" item-id) token)))))
    (is (= 204 (:status (app (authed-request :delete (str "/api/items/" item-id) token)))))
    (is (= 404 (:status (app (authed-request :get (str "/api/items/" item-id) token)))))))

(deftest graphql-query
  (let [response (app (json-request :post "/graphql" {:query "{ hello health }"}))
        body (parse-body response)]
    (is (= 200 (:status response)))
    (is (= "Hello from GraphQL!" (get-in body [:data :hello])))
    (is (= "healthy" (get-in body [:data :health])))))
`,

    '.env.example': `# Environment configuration (the app reads these from the process environment)
PORT={{port}}
JWT_SECRET=change-me-in-production
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

# Compile and check the project
build: deps
	lein check

# Run the server
run:
	lein run

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
	docker run -p {{port}}:{{port}} {{projectName}}
`,

    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM clojure:temurin-21-lein AS builder

WORKDIR /app

# Copy project file and fetch dependencies (for better caching)
COPY project.clj ./
RUN lein deps

# Copy source and build the uberjar
COPY . .
RUN lein uberjar

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:21-jre-jammy AS runtime

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl \\
    && rm -rf /var/lib/apt/lists/*

# Copy uberjar from builder
COPY --from=builder /app/target/uberjar/{{projectNameSnake}}-standalone.jar ./app.jar

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE {{port}}

ENV PORT={{port}}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \\
    CMD curl -f http://localhost:{{port}}/health || exit 1

CMD ["java", "-jar", "app.jar"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "{{port}}:{{port}}"
    environment:
      - PORT={{port}}
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

{{description}}

A Clojure web application built with Compojure and Ring.

## Features

- Compojure routing on top of Ring and Jetty
- JWT authentication (Buddy: signed tokens, hashed passwords)
- JSON REST API with users and per-user items
- GraphQL endpoint (Lacinia)
- CORS and request-logging middleware
- Test suite with ring-mock
- Docker support

Data is kept in memory (see \`src/{{projectNameSnake}}/db.clj\`); replace that namespace with a real database before production.

## Requirements

- Java 17+
- Leiningen 2.9+

## Development

\`\`\`bash
# Fetch dependencies and check that everything compiles
lein deps
lein check

# Run the server (PORT defaults to {{port}})
lein run

# Run the tests
lein test

# Start a REPL
lein repl

# Build the standalone jar
lein uberjar
\`\`\`

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| \`PORT\` | \`{{port}}\` | HTTP port |
| \`JWT_SECRET\` | development secret | HMAC secret for JWT tokens. Always set this in production. |

## API Endpoints

### Public

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register a user (\`email\`, \`name\`, \`password\`)
- \`POST /api/auth/login\` - Log in and get a JWT (\`email\`, \`password\`)
- \`POST /graphql\` - GraphQL (\`{"query": "{ hello health }"}\`)

### Protected (send \`Authorization: Bearer <token>\`)

- \`GET /api/users/me\` - Current user
- \`GET /api/users\` - List users
- \`GET /api/users/:id\` - Get a user
- \`GET /api/items\` - List your items
- \`POST /api/items\` - Create an item (\`name\`, optional \`description\`)
- \`GET /api/items/:id\` - Get one of your items
- \`DELETE /api/items/:id\` - Delete one of your items

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p {{port}}:{{port}} -e JWT_SECRET=change-me {{projectName}}

# or
docker compose up -d
\`\`\`

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
