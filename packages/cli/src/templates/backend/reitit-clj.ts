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
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'middleware', 'graphql'],

  files: {
    // Project configuration
    'project.clj': `(defproject {{projectName}} "0.1.0-SNAPSHOT"
  :description "REST API built with Reitit"
  :license {:name "MIT"
            :url "https://opensource.org/licenses/MIT"}
  :min-lein-version "2.9.0"

  :dependencies [[org.clojure/clojure "1.12.0"]
                 [metosin/reitit-ring "0.7.2"]
                 [metosin/reitit-middleware "0.7.2"]
                 [metosin/reitit-malli "0.7.2"]
                 [metosin/reitit-swagger "0.7.2"]
                 [metosin/reitit-swagger-ui "0.7.2"]
                 [metosin/muuntaja "0.6.10"]
                 [ring/ring-core "1.12.2"]
                 [ring/ring-jetty-adapter "1.12.2"]
                 [ring-cors "0.1.13"]
                 [buddy/buddy-sign "3.5.351"]
                 [buddy/buddy-hashers "2.0.167"]
                 [com.walmartlabs/lacinia "1.2.1"]]

  :main ^:skip-aot {{projectNameSnake}}.core
  :target-path "target/%s"

  :profiles {:dev {:dependencies [[ring/ring-mock "0.4.0"]]}
             :uberjar {:aot :all
                       :uberjar-name "{{projectNameSnake}}-standalone.jar"}})
`,

    // Entry point
    'src/{{projectNameSnake}}/core.clj': `(ns {{projectNameSnake}}.core
  (:require [ring.adapter.jetty :refer [run-jetty]]
            [{{projectNameSnake}}.db :as db]
            [{{projectNameSnake}}.routes :as routes])
  (:gen-class))

(defn -main [& _args]
  (let [port (Integer/parseInt (or (System/getenv "PORT") "{{port}}"))]
    (db/init!)
    (println (str "{{projectName}} listening on http://localhost:" port))
    (println (str "API docs: http://localhost:" port "/api-docs/index.html"))
    (run-jetty routes/app {:port port :join? true})))
`,

    // Routes and middleware stack
    'src/{{projectNameSnake}}/routes.clj': `(ns {{projectNameSnake}}.routes
  (:require [muuntaja.core :as m]
            [reitit.coercion.malli :as malli-coercion]
            [reitit.ring :as ring]
            [reitit.ring.coercion :as coercion]
            [reitit.ring.middleware.exception :as exception]
            [reitit.ring.middleware.muuntaja :as muuntaja]
            [reitit.ring.middleware.parameters :as parameters]
            [reitit.swagger :as swagger]
            [reitit.swagger-ui :as swagger-ui]
            [ring.middleware.cors :refer [wrap-cors]]
            [{{projectNameSnake}}.graphql :as graphql]
            [{{projectNameSnake}}.handlers.auth :as auth]
            [{{projectNameSnake}}.handlers.health :as health]
            [{{projectNameSnake}}.handlers.product :as product]
            [{{projectNameSnake}}.handlers.user :as user]
            [{{projectNameSnake}}.middleware :as mw]))

(def credentials-schema
  [:map
   [:email [:string {:min 3}]]
   [:password [:string {:min 1}]]])

(def registration-schema
  [:map
   [:email [:string {:min 3}]]
   [:name [:string {:min 1}]]
   [:password [:string {:min 8}]]])

(def product-schema
  [:map
   [:name [:string {:min 1}]]
   [:description {:optional true} :string]
   [:price number?]
   [:stock {:optional true} :int]])

(def product-update-schema
  [:map
   [:name {:optional true} [:string {:min 1}]]
   [:description {:optional true} :string]
   [:price {:optional true} number?]
   [:stock {:optional true} :int]])

(def route-data
  [["/" {:get {:no-doc true
               :handler health/root}}]
   ["/health" {:get {:no-doc true
                     :handler health/health}}]
   ["/swagger.json" {:get {:no-doc true
                           :swagger {:info {:title "{{projectName}} API"
                                            :version "0.1.0"}}
                           :handler (swagger/create-swagger-handler)}}]
   ["/graphql" {:swagger {:tags ["graphql"]}
                :post {:summary "Execute a GraphQL query"
                       :handler graphql/graphql-handler}}]
   ["/api/v1"
    ["/health" {:swagger {:tags ["health"]}
                :get {:summary "Health check"
                      :handler health/health}}]
    ["/auth" {:swagger {:tags ["auth"]}}
     ["/register" {:post {:summary "Register a user"
                          :parameters {:body registration-schema}
                          :handler auth/register}}]
     ["/login" {:post {:summary "Log in and get a JWT"
                       :parameters {:body credentials-schema}
                       :handler auth/login}}]
     ["/me" {:get {:summary "The current user (requires a bearer token)"
                   :middleware [mw/wrap-auth]
                   :handler auth/me}}]]
    ["/users" {:swagger {:tags ["users"]}
               :middleware [mw/wrap-auth]}
     ["" {:get {:summary "List users"
                :handler user/list-users}}]
     ["/:id" {:get {:summary "Get a user"
                    :handler user/get-user}
              :delete {:summary "Delete a user"
                       :handler user/delete-user}}]]
    ["/products" {:swagger {:tags ["products"]}}
     ["" {:get {:summary "List products"
                :handler product/list-products}
          :post {:summary "Create a product (requires a bearer token)"
                 :middleware [mw/wrap-auth]
                 :parameters {:body product-schema}
                 :handler product/create-product}}]
     ["/:id" {:get {:summary "Get a product"
                    :handler product/get-product}
              :put {:summary "Update a product (requires a bearer token)"
                    :middleware [mw/wrap-auth]
                    :parameters {:body product-update-schema}
                    :handler product/update-product}
              :delete {:summary "Delete a product (requires a bearer token)"
                       :middleware [mw/wrap-auth]
                       :handler product/delete-product}}]]]])

(def router
  (ring/router
    route-data
    {:data {:coercion malli-coercion/coercion
            :muuntaja m/instance
            :middleware [;; query and form params
                         parameters/parameters-middleware
                         ;; content negotiation
                         muuntaja/format-negotiate-middleware
                         ;; encode response bodies
                         muuntaja/format-response-middleware
                         ;; turn exceptions (including coercion errors) into responses
                         exception/exception-middleware
                         ;; decode request bodies
                         muuntaja/format-request-middleware
                         ;; coerce and validate request parameters
                         coercion/coerce-request-middleware]}}))

(def app
  (-> (ring/ring-handler
        router
        (ring/routes
          (swagger-ui/create-swagger-ui-handler {:path "/api-docs"
                                                 :url "/swagger.json"
                                                 :config {:validatorUrl nil}})
          (ring/create-default-handler
            {:not-found (fn [_request]
                          {:status 404
                           :headers {"Content-Type" "application/json"}
                           :body (m/encode m/instance "application/json"
                                           {:error "not_found"
                                            :message "Resource not found"})})})))
      (wrap-cors :access-control-allow-origin [#".*"]
                 :access-control-allow-methods [:get :post :put :delete :options]
                 :access-control-allow-headers ["Content-Type" "Authorization"])
      mw/wrap-logging))
`,

    // Cross-cutting middleware
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

    // Passwords and JWTs
    'src/{{projectNameSnake}}/auth.clj': `(ns {{projectNameSnake}}.auth
  (:require [buddy.hashers :as hashers]
            [buddy.sign.jwt :as jwt]))

(def ^:private token-ttl-seconds (* 7 24 60 60))

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
  (jwt/sign {:user-id user-id
             :exp (+ (now-seconds) token-ttl-seconds)}
            (jwt-secret)
            {:alg :hs256}))

(defn verify-token
  "Returns the user id carried by a valid token, or nil."
  [token]
  (try
    (:user-id (jwt/unsign token (jwt-secret) {:alg :hs256}))
    (catch Exception _
      nil)))
`,

    // GraphQL schema + resolvers (Lacinia)
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
  (let [body (if (map? (:body-params request)) (:body-params request) {})
        query (:query body)]
    (if (string? query)
      {:status 200
       :body (lacinia/execute compiled-schema query (:variables body) nil)}
      {:status 400
       :body {:errors [{:message "A GraphQL query string is required"}]}})))
`,

    // Handlers - Health
    'src/{{projectNameSnake}}/handlers/health.clj': `(ns {{projectNameSnake}}.handlers.health)

(defn health [_request]
  {:status 200
   :body {:status "healthy"
          :timestamp (str (java.time.Instant/now))
          :version "0.1.0"}})

(defn root [_request]
  {:status 200
   :body {:name "{{projectName}}"
          :framework "Reitit"
          :language "Clojure"
          :docs "/api-docs/index.html"}})
`,

    // Handlers - Auth
    'src/{{projectNameSnake}}/handlers/auth.clj': `(ns {{projectNameSnake}}.handlers.auth
  (:require [{{projectNameSnake}}.auth :as auth]
            [{{projectNameSnake}}.db :as db]))

(defn- public-user [user]
  (dissoc user :password-hash))

(defn register [request]
  (let [{:keys [email name password]} (get-in request [:parameters :body])]
    (if (db/find-user-by-email email)
      {:status 409 :body {:error "Email already registered"}}
      (let [user (db/create-user! {:email email
                                   :name name
                                   :password-hash (auth/hash-password password)
                                   :role "user"})]
        {:status 201
         :body {:token (auth/generate-token (:id user))
                :user (public-user user)}}))))

(defn login [request]
  (let [{:keys [email password]} (get-in request [:parameters :body])
        user (db/find-user-by-email email)]
    (if (and user (auth/valid-password? password (:password-hash user)))
      {:status 200
       :body {:token (auth/generate-token (:id user))
              :user (public-user user)}}
      {:status 401 :body {:error "Invalid credentials"}})))

(defn me [request]
  (if-let [user (db/find-user-by-id (:user-id request))]
    {:status 200 :body {:user (public-user user)}}
    {:status 404 :body {:error "User not found"}}))
`,

    // Handlers - User
    'src/{{projectNameSnake}}/handlers/user.clj': `(ns {{projectNameSnake}}.handlers.user
  (:require [{{projectNameSnake}}.db :as db]))

(defn- public-user [user]
  (dissoc user :password-hash))

(defn list-users [_request]
  (let [users (map public-user (db/get-all-users))]
    {:status 200 :body {:users users :count (count users)}}))

(defn get-user [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [user (db/find-user-by-id id)]
      {:status 200 :body {:user (public-user user)}}
      {:status 404 :body {:error "User not found"}})))

(defn delete-user [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-user! id)
      {:status 204}
      {:status 404 :body {:error "User not found"}})))
`,

    // Handlers - Product
    'src/{{projectNameSnake}}/handlers/product.clj': `(ns {{projectNameSnake}}.handlers.product
  (:require [{{projectNameSnake}}.db :as db]))

(defn list-products [_request]
  (let [products (db/get-all-products)]
    {:status 200 :body {:products products :count (count products)}}))

(defn get-product [request]
  (let [id (get-in request [:path-params :id])]
    (if-let [product (db/find-product-by-id id)]
      {:status 200 :body {:product product}}
      {:status 404 :body {:error "Product not found"}})))

(defn create-product [request]
  (let [{:keys [name description price stock]} (get-in request [:parameters :body])
        product (db/create-product! {:name name
                                     :description (or description "")
                                     :price price
                                     :stock (or stock 0)})]
    {:status 201 :body {:product product}}))

(defn update-product [request]
  (let [id (get-in request [:path-params :id])
        updates (get-in request [:parameters :body])]
    (if-let [product (db/update-product! id updates)]
      {:status 200 :body {:product product}}
      {:status 404 :body {:error "Product not found"}})))

(defn delete-product [request]
  (let [id (get-in request [:path-params :id])]
    (if (db/delete-product! id)
      {:status 204}
      {:status 404 :body {:error "Product not found"}})))
`,

    // Database
    'src/{{projectNameSnake}}/db.clj': `(ns {{projectNameSnake}}.db
  "In-memory storage. Swap this namespace for a real database (next.jdbc,
  HoneySQL, ...) before going to production."
  (:require [{{projectNameSnake}}.auth :as auth]))

(defonce ^:private users (atom {}))
(defonce ^:private products (atom {}))

(defn- now []
  (str (java.time.Instant/now)))

(defn- new-id []
  (str (random-uuid)))

(defn reset-db!
  "Empties the store. Used by the tests."
  []
  (reset! users {})
  (reset! products {}))

;; Users
(defn find-user-by-email [email]
  (first (filter #(= email (:email %)) (vals @users))))

(defn find-user-by-id [id]
  (get @users id))

(defn get-all-users []
  (sort-by :created-at (vals @users)))

(defn create-user! [attrs]
  (let [id (new-id)
        user (assoc attrs :id id :created-at (now) :updated-at (now))]
    (swap! users assoc id user)
    user))

(defn delete-user!
  "Returns true when a user was removed."
  [id]
  (let [[before after] (swap-vals! users dissoc id)]
    (not= (count before) (count after))))

;; Products
(defn find-product-by-id [id]
  (get @products id))

(defn get-all-products []
  (sort-by :created-at (vals @products)))

(defn create-product! [attrs]
  (let [id (new-id)
        product (assoc attrs :id id :created-at (now) :updated-at (now))]
    (swap! products assoc id product)
    product))

(defn update-product!
  "Merges the updates into the product and returns it, or nil when it does not exist."
  [id updates]
  (when (contains? @products id)
    (get (swap! products update id merge updates {:updated-at (now)}) id)))

(defn delete-product!
  "Returns true when a product was removed."
  [id]
  (let [[before after] (swap-vals! products dissoc id)]
    (not= (count before) (count after))))

(defn init!
  "Seeds an admin user and two sample products."
  []
  (reset-db!)
  (create-user! {:email "admin@example.com"
                 :name "Admin User"
                 :role "admin"
                 :password-hash (auth/hash-password "admin123")})
  (create-product! {:name "Sample Product 1"
                    :description "This is a sample product"
                    :price 29.99
                    :stock 100})
  (create-product! {:name "Sample Product 2"
                    :description "Another sample product"
                    :price 49.99
                    :stock 50})
  (println "Seeded admin@example.com / admin123 and two sample products"))
`,

    // Tests
    'test/{{projectNameSnake}}/core_test.clj': `(ns {{projectNameSnake}}.core-test
  (:require [clojure.test :refer [deftest is testing use-fixtures]]
            [muuntaja.core :as m]
            [ring.mock.request :as mock]
            [{{projectNameSnake}}.db :as db]
            [{{projectNameSnake}}.routes :refer [app]]))

(use-fixtures :each (fn [run-test]
                      (db/reset-db!)
                      (run-test)))

(defn- decode [response]
  (when (:body response)
    (m/decode m/instance "application/json" (:body response))))

(defn- json-request
  ([method uri payload]
   (json-request method uri payload nil))
  ([method uri payload token]
   (cond-> (-> (mock/request method uri)
               (mock/content-type "application/json")
               (mock/body (slurp (m/encode m/instance "application/json" payload))))
     token (mock/header "Authorization" (str "Bearer " token)))))

(defn- authed-request [method uri token]
  (mock/header (mock/request method uri) "Authorization" (str "Bearer " token)))

(defn- register! [email]
  (app (json-request :post "/api/v1/auth/register"
                     {:email email :name "Test User" :password "password123"})))

(deftest health-endpoints
  (doseq [uri ["/health" "/api/v1/health"]]
    (let [response (app (mock/request :get uri))]
      (is (= 200 (:status response)))
      (is (= "healthy" (:status (decode response)))))))

(deftest unknown-route-is-json-404
  (let [response (app (mock/request :get "/nope"))]
    (is (= 404 (:status response)))
    (is (= "not_found" (:error (decode response))))))

(deftest register-and-login
  (testing "registering returns a token and hides the password hash"
    (let [response (register! "test@example.com")
          body (decode response)]
      (is (= 201 (:status response)))
      (is (string? (:token body)))
      (is (= "test@example.com" (get-in body [:user :email])))
      (is (not (contains? (:user body) :password-hash)))))
  (testing "the same email cannot register twice"
    (is (= 409 (:status (register! "test@example.com")))))
  (testing "login works with the right password only"
    (is (= 200 (:status (app (json-request :post "/api/v1/auth/login"
                                           {:email "test@example.com" :password "password123"})))))
    (is (= 401 (:status (app (json-request :post "/api/v1/auth/login"
                                           {:email "test@example.com" :password "nope"})))))))

(deftest registration-is-validated
  (is (= 400 (:status (app (json-request :post "/api/v1/auth/register"
                                         {:email "a@b.c" :name "A" :password "short"}))))))

(deftest protected-routes-need-a-token
  (is (= 401 (:status (app (mock/request :get "/api/v1/users")))))
  (is (= 401 (:status (app (mock/request :get "/api/v1/auth/me")))))
  (is (= 401 (:status (app (json-request :post "/api/v1/products"
                                         {:name "Widget" :price 5}))))))

(deftest product-lifecycle
  (let [token (-> (register! "shop@example.com") decode :token)
        created (app (json-request :post "/api/v1/products"
                                   {:name "Widget" :price 9.5 :stock 3}
                                   token))
        product-id (get-in (decode created) [:product :id])]
    (is (= 201 (:status created)))
    (is (= 200 (:status (app (authed-request :get "/api/v1/auth/me" token)))))
    (is (= 1 (:count (decode (app (mock/request :get "/api/v1/products"))))))
    (is (= "Widget" (get-in (decode (app (mock/request :get (str "/api/v1/products/" product-id))))
                            [:product :name])))
    (is (= 200 (:status (app (json-request :put (str "/api/v1/products/" product-id)
                                           {:stock 7}
                                           token)))))
    (is (= 204 (:status (app (authed-request :delete (str "/api/v1/products/" product-id) token)))))
    (is (= 404 (:status (app (mock/request :get (str "/api/v1/products/" product-id))))))))

(deftest graphql-query
  (let [response (app (json-request :post "/graphql" {:query "{ hello health }"}))
        body (decode response)]
    (is (= 200 (:status response)))
    (is (= "Hello from GraphQL!" (get-in body [:data :hello])))
    (is (= "healthy" (get-in body [:data :health])))))

(deftest swagger-document
  ;; Muuntaja encodes bodies to an InputStream, so a response is decoded once.
  (let [response (app (mock/request :get "/swagger.json"))
        body (decode response)]
    (is (= 200 (:status response)))
    (is (= "2.0" (:swagger body)))
    (is (= "{{projectName}} API" (get-in body [:info :title])))
    (is (contains? (:paths body) (keyword "/api/v1/products")))))
`,

    '.gitignore': `# Leiningen
/target
/classes
/checkouts
pom.xml
pom.xml.asc
*.jar
*.class
.lein-*
.nrepl-port

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
profiles.clj
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM clojure:temurin-21-lein AS builder

WORKDIR /app

# Copy project file first for better dependency caching
COPY project.clj ./

# Download dependencies
RUN lein deps

# Copy source code and build the uberjar
COPY src ./src
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

    // Docker Compose
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

    // README
    'README.md': `# {{projectName}}

A data-driven REST API built with Reitit routing for Clojure.

## Features

- **Reitit**: fast, data-driven routing (routes are plain Clojure data)
- **Muuntaja**: content negotiation (JSON in and out)
- **Malli coercion**: request bodies are validated and coerced from the route data
- **Swagger UI**: interactive API docs generated from the route data
- **JWT authentication**: Buddy-signed tokens and hashed passwords
- **GraphQL**: a Lacinia endpoint at \`POST /graphql\`
- **Ring**: Jetty, CORS and request logging middleware

Data is kept in memory (see \`src/{{projectNameSnake}}/db.clj\`); replace that namespace with a real database before production.

## Requirements

- Java 17+
- Leiningen 2.9+

## Quick Start

\`\`\`bash
lein deps
lein check
lein test
lein run
\`\`\`

The server listens on \`PORT\` ({{port}} by default). Set \`JWT_SECRET\` in production. API docs are served at \`/api-docs/index.html\`.

## API Endpoints

- \`GET /health\`, \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register (\`email\`, \`name\`, \`password\` of 8+ characters)
- \`POST /api/v1/auth/login\` - Login, returns a JWT
- \`GET /api/v1/auth/me\` - Current user (bearer token)
- \`GET /api/v1/users\`, \`GET|DELETE /api/v1/users/:id\` - Users (bearer token)
- \`GET /api/v1/products\`, \`GET /api/v1/products/:id\` - Read products
- \`POST /api/v1/products\`, \`PUT|DELETE /api/v1/products/:id\` - Change products (bearer token)
- \`POST /graphql\` - GraphQL (\`{"query": "{ hello health }"}\`)

On start-up the server seeds \`admin@example.com\` / \`admin123\` and two sample products.

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p {{port}}:{{port}} -e JWT_SECRET=change-me {{projectName}}
\`\`\`

## License

MIT
`
  }
};
