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
  features: ['authentication', 'validation', 'logging', 'cors', 'graphql'],

  files: {
    // Project configuration
    'project.clj': `(defproject {{projectName}} "0.1.0-SNAPSHOT"
  :description "REST API built with Pedestal"
  :license {:name "MIT"
            :url "https://opensource.org/licenses/MIT"}
  :min-lein-version "2.9.0"

  :dependencies [[org.clojure/clojure "1.12.0"]
                 [io.pedestal/pedestal.service "0.7.2"]
                 [io.pedestal/pedestal.jetty "0.7.2"]
                 [ch.qos.logback/logback-classic "1.5.12"]
                 [buddy/buddy-sign "3.5.351"]
                 [buddy/buddy-hashers "2.0.167"]
                 [com.walmartlabs/lacinia "1.2.1"]]

  :main ^:skip-aot {{projectNameSnake}}.server
  :target-path "target/%s"

  :profiles {:dev {:dependencies [[cheshire "5.13.0"]]}
             :uberjar {:aot :all
                       :uberjar-name "{{projectNameSnake}}-standalone.jar"}})
`,

    // Server
    'src/{{projectNameSnake}}/server.clj': `(ns {{projectNameSnake}}.server
  (:require [io.pedestal.http :as http]
            [{{projectNameSnake}}.db :as db]
            [{{projectNameSnake}}.service :as service])
  (:gen-class))

(defn -main [& _args]
  (let [port (Integer/parseInt (or (System/getenv "PORT") "{{port}}"))]
    (db/init!)
    (println (str "{{projectName}} listening on http://localhost:" port))
    (-> service/service-map
        (assoc ::http/port port
               ::http/join? true)
        http/create-server
        http/start)))
`,

    // Service: routes, handlers and the service map
    'src/{{projectNameSnake}}/service.clj': `(ns {{projectNameSnake}}.service
  (:require [io.pedestal.http :as http]
            [io.pedestal.http.body-params :as body-params]
            [io.pedestal.http.route :as route]
            [{{projectNameSnake}}.auth :as auth]
            [{{projectNameSnake}}.db :as db]
            [{{projectNameSnake}}.graphql :as graphql]
            [{{projectNameSnake}}.interceptors :as interceptors]))

(defn- public-user [user]
  (dissoc user :password-hash))

(defn- blank? [value]
  (or (not (string? value)) (empty? value)))

(defn- bad-request [message]
  {:status 400 :body {:error message}})

;; Handlers
(defn health [_request]
  {:status 200
   :body {:status "healthy"
          :timestamp (str (java.time.Instant/now))
          :version "0.1.0"}})

(defn register [request]
  (let [{:keys [email name password]} (:json-params request)]
    (cond
      (or (blank? email) (blank? name) (blank? password))
      (bad-request "email, name and password are required")

      (db/find-user-by-email email)
      {:status 409 :body {:error "Email already registered"}}

      :else
      (let [user (db/create-user! {:email email
                                   :name name
                                   :role "user"
                                   :password-hash (auth/hash-password password)})]
        {:status 201
         :body {:token (auth/generate-token (:id user))
                :user (public-user user)}}))))

(defn login [request]
  (let [{:keys [email password]} (:json-params request)
        user (when-not (blank? email) (db/find-user-by-email email))]
    (if (and user
             (not (blank? password))
             (auth/valid-password? password (:password-hash user)))
      {:status 200
       :body {:token (auth/generate-token (:id user))
              :user (public-user user)}}
      {:status 401 :body {:error "Invalid credentials"}})))

(defn me [request]
  (if-let [user (db/find-user-by-id (:user-id request))]
    {:status 200 :body {:user (public-user user)}}
    {:status 404 :body {:error "User not found"}}))

(defn list-products [_request]
  (let [products (db/get-all-products)]
    {:status 200 :body {:products products :count (count products)}}))

(defn get-product [request]
  (if-let [product (db/find-product-by-id (get-in request [:path-params :id]))]
    {:status 200 :body {:product product}}
    {:status 404 :body {:error "Product not found"}}))

(defn create-product [request]
  (let [{:keys [name description price stock]} (:json-params request)]
    (if (or (blank? name) (not (number? price)))
      (bad-request "name and a numeric price are required")
      {:status 201
       :body {:product (db/create-product! {:name name
                                            :description (if (string? description) description "")
                                            :price price
                                            :stock (if (integer? stock) stock 0)})}})))

(defn update-product [request]
  (let [id (get-in request [:path-params :id])
        updates (select-keys (:json-params request) [:name :description :price :stock])]
    (if-let [product (db/update-product! id updates)]
      {:status 200 :body {:product product}}
      {:status 404 :body {:error "Product not found"}})))

(defn delete-product [request]
  (if (db/delete-product! (get-in request [:path-params :id]))
    {:status 204}
    {:status 404 :body {:error "Product not found"}}))

;; Interceptor chains. Parse the JSON body, serialise map bodies as JSON,
;; and (for protected routes) require a bearer token before the handler runs.
(def ^:private common-interceptors
  [(body-params/body-params) http/json-body])

(def ^:private protected-interceptors
  (conj common-interceptors interceptors/require-auth))

(defn- public [handler] (conj common-interceptors handler))
(defn- protected [handler] (conj protected-interceptors handler))

(def routes
  (route/expand-routes
    #{["/health" :get (public health) :route-name :health]
      ["/api/v1/health" :get (public health) :route-name :api-health]
      ["/graphql" :post (public graphql/graphql-handler) :route-name :graphql]
      ["/api/v1/auth/register" :post (public register) :route-name :register]
      ["/api/v1/auth/login" :post (public login) :route-name :login]
      ["/api/v1/auth/me" :get (protected me) :route-name :me]
      ["/api/v1/products" :get (public list-products) :route-name :list-products]
      ["/api/v1/products" :post (protected create-product) :route-name :create-product]
      ["/api/v1/products/:id" :get (public get-product) :route-name :get-product]
      ["/api/v1/products/:id" :put (protected update-product) :route-name :update-product]
      ["/api/v1/products/:id" :delete (protected delete-product) :route-name :delete-product]}))

(def service-map
  {::http/routes routes
   ::http/type :jetty
   ::http/host "0.0.0.0"
   ::http/port {{port}}
   ::http/join? false
   ::http/allowed-origins {:creds true
                           :allowed-origins (constantly true)}})
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
  (let [body (if (map? (:json-params request)) (:json-params request) {})
        query (:query body)]
    (if (string? query)
      {:status 200
       :body (lacinia/execute compiled-schema query (:variables body) nil)}
      {:status 400
       :body {:errors [{:message "A GraphQL query string is required"}]}})))
`,

    // Interceptors
    'src/{{projectNameSnake}}/interceptors.clj': `(ns {{projectNameSnake}}.interceptors
  (:require [clojure.string :as str]
            [io.pedestal.interceptor.chain :as chain]
            [{{projectNameSnake}}.auth :as auth]))

(def require-auth
  "Rejects requests without a valid 'Authorization: Bearer <jwt>' header and
  adds :user-id to the request for the ones that have it."
  {:name ::require-auth
   :enter (fn [context]
            (let [header (get-in context [:request :headers "authorization"])
                  user-id (when (and header (str/starts-with? header "Bearer "))
                            (auth/verify-token (subs header 7)))]
              (if user-id
                (assoc-in context [:request :user-id] user-id)
                (chain/terminate
                  (assoc context :response {:status 401
                                            :body {:error "unauthorized"
                                                   :message "A valid bearer token is required"}})))))})
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

(defn create-user! [attrs]
  (let [id (new-id)
        user (assoc attrs :id id :created-at (now) :updated-at (now))]
    (swap! users assoc id user)
    user))

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
    'test/{{projectNameSnake}}/service_test.clj': `(ns {{projectNameSnake}}.service-test
  (:require [cheshire.core :as json]
            [clojure.test :refer [deftest is testing use-fixtures]]
            [io.pedestal.http :as http]
            [io.pedestal.test :refer [response-for]]
            [{{projectNameSnake}}.db :as db]
            [{{projectNameSnake}}.service :as service]))

(def ^:private service-fn
  (::http/service-fn (http/create-servlet service/service-map)))

(use-fixtures :each (fn [run-test]
                      (db/reset-db!)
                      (run-test)))

(def ^:private json-headers {"Content-Type" "application/json"})

(defn- parse [response]
  (json/parse-string (:body response) true))

(defn- post-json [uri payload & [token]]
  (response-for service-fn :post uri
                :headers (cond-> json-headers
                           token (assoc "Authorization" (str "Bearer " token)))
                :body (json/generate-string payload)))

(defn- authed [verb uri token & [payload]]
  (if payload
    (response-for service-fn verb uri
                  :headers {"Content-Type" "application/json"
                            "Authorization" (str "Bearer " token)}
                  :body (json/generate-string payload))
    (response-for service-fn verb uri
                  :headers {"Authorization" (str "Bearer " token)})))

(defn- register! [email]
  (post-json "/api/v1/auth/register"
             {:email email :name "Test User" :password "password123"}))

(deftest health-endpoints
  (doseq [uri ["/health" "/api/v1/health"]]
    (let [response (response-for service-fn :get uri)]
      (is (= 200 (:status response)))
      (is (= "healthy" (:status (parse response)))))))

(deftest register-and-login
  (testing "registering returns a token and hides the password hash"
    (let [response (register! "test@example.com")
          body (parse response)]
      (is (= 201 (:status response)))
      (is (string? (:token body)))
      (is (= "test@example.com" (get-in body [:user :email])))
      (is (not (contains? (:user body) :password-hash)))))
  (testing "the same email cannot register twice"
    (is (= 409 (:status (register! "test@example.com")))))
  (testing "login works with the right password only"
    (is (= 200 (:status (post-json "/api/v1/auth/login"
                                   {:email "test@example.com" :password "password123"}))))
    (is (= 401 (:status (post-json "/api/v1/auth/login"
                                   {:email "test@example.com" :password "nope"}))))))

(deftest registration-is-validated
  (is (= 400 (:status (post-json "/api/v1/auth/register" {:email "a@b.c"})))))

(deftest protected-routes-need-a-token
  (is (= 401 (:status (response-for service-fn :get "/api/v1/auth/me"))))
  (is (= 401 (:status (post-json "/api/v1/products" {:name "Widget" :price 5})))))

(deftest product-lifecycle
  (let [token (:token (parse (register! "shop@example.com")))
        created (post-json "/api/v1/products" {:name "Widget" :price 9.5 :stock 3} token)
        product-id (get-in (parse created) [:product :id])]
    (is (= 201 (:status created)))
    (is (= 200 (:status (authed :get "/api/v1/auth/me" token))))
    (is (= 1 (:count (parse (response-for service-fn :get "/api/v1/products")))))
    (is (= "Widget" (get-in (parse (response-for service-fn :get (str "/api/v1/products/" product-id)))
                            [:product :name])))
    (is (= 200 (:status (authed :put (str "/api/v1/products/" product-id) token {:stock 7}))))
    (is (= 204 (:status (authed :delete (str "/api/v1/products/" product-id) token))))
    (is (= 404 (:status (response-for service-fn :get (str "/api/v1/products/" product-id)))))))

(deftest graphql-query
  (let [response (post-json "/graphql" {:query "{ hello health }"})
        body (parse response)]
    (is (= 200 (:status response)))
    (is (= "Hello from GraphQL!" (get-in body [:data :hello])))
    (is (= "healthy" (get-in body [:data :health])))))
`,

    // Logback configuration (Pedestal logs through SLF4J; without a file Logback logs everything at DEBUG)
    'resources/logback.xml': `<configuration>
  <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
    </encoder>
  </appender>

  <logger name="org.eclipse.jetty" level="WARN"/>
  <logger name="io.pedestal" level="INFO"/>

  <root level="INFO">
    <appender-ref ref="STDOUT"/>
  </root>
</configuration>
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

# Copy source code and resources (logback.xml), then build the uberjar
COPY src ./src
COPY resources ./resources
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

A service-oriented REST API built with the Pedestal web framework for Clojure.

## Features

- **Pedestal**: routes, interceptors and the Jetty connector from \`pedestal.service\`
- **Interceptors**: JSON body parsing, JSON responses and bearer-token authentication are interceptors
- **JWT authentication**: Buddy-signed tokens and hashed passwords
- **GraphQL**: a Lacinia endpoint at \`POST /graphql\`
- **CORS** through Pedestal's \`allowed-origins\` option

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

The server listens on \`PORT\` ({{port}} by default). Set \`JWT_SECRET\` in production.

## API Endpoints

- \`GET /health\`, \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register (\`email\`, \`name\`, \`password\`)
- \`POST /api/v1/auth/login\` - Login, returns a JWT
- \`GET /api/v1/auth/me\` - Current user (bearer token)
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
