import { BackendTemplate } from '../types';

export const luminusCljTemplate: BackendTemplate = {
  id: 'luminus-clj',
  name: 'luminus-clj',
  displayName: 'Luminus (Clojure)',
  description: 'Full-stack Clojure web framework with batteries included',
  language: 'clojure',
  framework: 'luminus',
  version: '1.0.0',
  tags: ['clojure', 'luminus', 'full-stack', 'selmer', 'reitit', 'mount', 'ring'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'graphql'],

  files: {
    // Project configuration (the Luminus stack: Mount, Cprop, Selmer, Reitit, Muuntaja, Ring defaults)
    'project.clj': `(defproject {{projectName}} "0.1.0-SNAPSHOT"
  :description "Luminus-style Clojure web application"
  :license {:name "EPL-2.0 OR GPL-2.0-or-later WITH Classpath-exception-2.0"
            :url "https://www.eclipse.org/legal/epl-2.0/"}
  :min-lein-version "2.9.0"

  :dependencies [[org.clojure/clojure "1.12.0"]
                 [org.clojure/tools.logging "1.3.0"]
                 [ch.qos.logback/logback-classic "1.5.12"]
                 [cprop "0.1.19"]
                 [mount "0.1.17"]
                 [selmer "1.12.59"]
                 [metosin/reitit-ring "0.7.2"]
                 [metosin/reitit-middleware "0.7.2"]
                 [metosin/muuntaja "0.6.10"]
                 [ring/ring-core "1.12.2"]
                 [ring/ring-defaults "0.5.0"]
                 [ring/ring-jetty-adapter "1.12.2"]
                 [ring-cors "0.1.13"]
                 [buddy/buddy-sign "3.5.351"]
                 [buddy/buddy-hashers "2.0.167"]
                 [com.walmartlabs/lacinia "1.2.1"]]

  :source-paths ["src/clj"]
  :resource-paths ["resources"]
  :test-paths ["test/clj"]
  :target-path "target/%s/"
  :main ^:skip-aot {{projectNameSnake}}.core

  :profiles {:dev {:dependencies [[ring/ring-mock "0.4.0"]]
                   :source-paths ["env/dev/clj"]
                   :repl-options {:init-ns user}}
             :uberjar {:aot :all
                       :uberjar-name "{{projectNameSnake}}-standalone.jar"}})
`,

    // Entry point: starts every Mount state (config, database, handler, HTTP server)
    'src/clj/{{projectNameSnake}}/core.clj': `(ns {{projectNameSnake}}.core
  (:require [clojure.tools.logging :as log]
            [mount.core :as mount :refer [defstate]]
            [ring.adapter.jetty :as jetty]
            [{{projectNameSnake}}.config :refer [env]]
            [{{projectNameSnake}}.db.core]
            [{{projectNameSnake}}.handler :as handler])
  (:import (org.eclipse.jetty.server Server))
  (:gen-class))

(defonce ^:private jetty-server (atom nil))

(defstate ^{:on-reload :noop} http-server
  :start (reset! jetty-server
                 (jetty/run-jetty (fn [request] ((deref handler/app) request))
                                  {:port (some-> (:port (deref env)) str Integer/parseInt)
                                   :join? false}))
  :stop (when-let [^Server server @jetty-server]
          (.stop server)
          (reset! jetty-server nil)))

(defn stop-app []
  (doseq [component (:stopped (mount/stop))]
    (log/info component "stopped"))
  (shutdown-agents))

(defn start-app []
  (doseq [component (:started (mount/start))]
    (log/info component "started"))
  (.addShutdownHook (Runtime/getRuntime) (Thread. ^Runnable stop-app)))

(defn -main [& _args]
  (start-app))
`,

    // Configuration (Cprop: resources/config.edn, overridden by system properties and environment variables)
    'src/clj/{{projectNameSnake}}/config.clj': `(ns {{projectNameSnake}}.config
  (:require [cprop.core :refer [load-config]]
            [cprop.source :as source]
            [mount.core :refer [args defstate]]))

(defstate env
  :start (load-config
           :merge
           [(args)
            (source/from-system-props)
            (source/from-env)]))
`,

    // Selmer layout
    'src/clj/{{projectNameSnake}}/layout.clj': `(ns {{projectNameSnake}}.layout
  (:require [ring.util.response :as response]
            [selmer.parser :as parser]))

(defn render
  "Renders a Selmer template from the classpath as an HTML response."
  [template & [params]]
  (-> (parser/render-file template (or params {}))
      response/response
      (response/content-type "text/html; charset=utf-8")))
`,

    // Ring + Reitit handler (a Mount state, so it starts after the configuration)
    'src/clj/{{projectNameSnake}}/handler.clj': `(ns {{projectNameSnake}}.handler
  (:require [mount.core :as mount]
            [muuntaja.core :as m]
            [reitit.ring :as ring]
            [reitit.ring.middleware.exception :as exception]
            [reitit.ring.middleware.muuntaja :as muuntaja]
            [{{projectNameSnake}}.middleware :as middleware]
            [{{projectNameSnake}}.routes.home :as home]
            [{{projectNameSnake}}.routes.services :as services]))

(defn- build-handler []
  (ring/ring-handler
    (ring/router
      (into [] cat [(home/routes) (services/routes)])
      {:data {:muuntaja m/instance
              :middleware [muuntaja/format-negotiate-middleware
                           muuntaja/format-response-middleware
                           exception/exception-middleware
                           muuntaja/format-request-middleware]}})
    (ring/create-default-handler)))

(mount/defstate app
  :start (middleware/wrap-base (build-handler)))
`,

    // Middleware
    'src/clj/{{projectNameSnake}}/middleware.clj': `(ns {{projectNameSnake}}.middleware
  (:require [clojure.string :as str]
            [clojure.tools.logging :as log]
            [ring.middleware.cors :refer [wrap-cors]]
            [ring.middleware.defaults :refer [site-defaults wrap-defaults]]
            [{{projectNameSnake}}.auth :as auth]))

(defn wrap-logging [handler]
  (fn [request]
    (let [start (System/nanoTime)
          response (handler request)
          elapsed-ms (quot (- (System/nanoTime) start) 1000000)]
      (log/info (str/upper-case (name (:request-method request)))
                (:uri request)
                (:status response)
                (str elapsed-ms "ms"))
      response)))

(defn wrap-base
  "The middleware every request passes through: logging, Ring defaults (params,
  sessions, static files from resources/public, security headers) and CORS.
  Anti-forgery tokens are off because the JSON API authenticates with JWTs."
  [handler]
  (-> handler
      (wrap-defaults (assoc-in site-defaults [:security :anti-forgery] false))
      wrap-logging
      (wrap-cors :access-control-allow-origin [#".*"]
                 :access-control-allow-methods [:get :post :put :delete :options]
                 :access-control-allow-headers ["Content-Type" "Authorization"])))

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
    'src/clj/{{projectNameSnake}}/auth.clj': `(ns {{projectNameSnake}}.auth
  (:require [buddy.hashers :as hashers]
            [buddy.sign.jwt :as jwt]
            [{{projectNameSnake}}.config :refer [env]]))

(def ^:private token-ttl-seconds (* 7 24 60 60))

(defn- jwt-secret []
  (str (or (:jwt-secret (deref env)) "dev-secret-change-me")))

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

    // Routes - HTML pages
    'src/clj/{{projectNameSnake}}/routes/home.clj': `(ns {{projectNameSnake}}.routes.home
  (:require [{{projectNameSnake}}.layout :as layout]))

(def ^:private endpoints
  ["GET /health"
   "POST /api/v1/auth/register"
   "POST /api/v1/auth/login"
   "GET /api/v1/auth/me"
   "GET /api/v1/products"
   "POST /api/v1/products"
   "POST /graphql"])

(defn home-page [_request]
  (layout/render "templates/home.html"
                 {:page-title "{{projectName}}"
                  :endpoints endpoints}))

(defn health [_request]
  {:status 200
   :body {:status "healthy"
          :timestamp (str (java.time.Instant/now))
          :version "0.1.0"}})

(defn routes []
  [["/" {:get {:no-doc true
               :handler home-page}}]
   ["/health" {:get {:handler health}}]])
`,

    // Routes - JSON API
    'src/clj/{{projectNameSnake}}/routes/services.clj': `(ns {{projectNameSnake}}.routes.services
  (:require [{{projectNameSnake}}.auth :as auth]
            [{{projectNameSnake}}.db.core :as db]
            [{{projectNameSnake}}.graphql :as graphql]
            [{{projectNameSnake}}.middleware :as middleware]
            [{{projectNameSnake}}.routes.home :as home]))

(defn- public-user [user]
  (dissoc user :password-hash))

(defn- blank-string? [value]
  (or (not (string? value)) (empty? value)))

(defn- bad-request [message]
  {:status 400 :body {:error message}})

(defn- body-of [request]
  (let [body (:body-params request)]
    (if (map? body) body {})))

;; Auth
(defn register [request]
  (let [{:keys [email name password]} (body-of request)]
    (cond
      (or (blank-string? email) (blank-string? name) (blank-string? password))
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
  (let [{:keys [email password]} (body-of request)
        user (when-not (blank-string? email) (db/find-user-by-email email))]
    (if (and user
             (not (blank-string? password))
             (auth/valid-password? password (:password-hash user)))
      {:status 200
       :body {:token (auth/generate-token (:id user))
              :user (public-user user)}}
      {:status 401 :body {:error "Invalid credentials"}})))

(defn me [request]
  (if-let [user (db/find-user-by-id (:user-id request))]
    {:status 200 :body {:user (public-user user)}}
    {:status 404 :body {:error "User not found"}}))

;; Users
(defn list-users [_request]
  (let [users (map public-user (db/get-all-users))]
    {:status 200 :body {:users users :count (count users)}}))

(defn get-user [request]
  (if-let [user (db/find-user-by-id (get-in request [:path-params :id]))]
    {:status 200 :body {:user (public-user user)}}
    {:status 404 :body {:error "User not found"}}))

;; Products
(defn list-products [_request]
  (let [products (db/get-all-products)]
    {:status 200 :body {:products products :count (count products)}}))

(defn get-product [request]
  (if-let [product (db/find-product-by-id (get-in request [:path-params :id]))]
    {:status 200 :body {:product product}}
    {:status 404 :body {:error "Product not found"}}))

(defn create-product [request]
  (let [{:keys [name description price stock]} (body-of request)]
    (if (or (blank-string? name) (not (number? price)))
      (bad-request "name and a numeric price are required")
      {:status 201
       :body {:product (db/create-product! {:name name
                                            :description (if (string? description) description "")
                                            :price price
                                            :stock (if (integer? stock) stock 0)})}})))

(defn update-product [request]
  (let [id (get-in request [:path-params :id])
        updates (select-keys (body-of request) [:name :description :price :stock])]
    (if-let [product (db/update-product! id updates)]
      {:status 200 :body {:product product}}
      {:status 404 :body {:error "Product not found"}})))

(defn delete-product [request]
  (if (db/delete-product! (get-in request [:path-params :id]))
    {:status 204}
    {:status 404 :body {:error "Product not found"}}))

(defn routes []
  [["/graphql" {:post {:handler graphql/graphql-handler}}]
   ["/api/v1"
    ["/health" {:get {:handler home/health}}]
    ["/auth"
     ["/register" {:post {:handler register}}]
     ["/login" {:post {:handler login}}]
     ["/me" {:get {:middleware [middleware/wrap-auth]
                   :handler me}}]]
    ["/users" {:middleware [middleware/wrap-auth]}
     ["" {:get {:handler list-users}}]
     ["/:id" {:get {:handler get-user}}]]
    ["/products"
     ["" {:get {:handler list-products}
          :post {:middleware [middleware/wrap-auth]
                 :handler create-product}}]
     ["/:id" {:get {:handler get-product}
              :put {:middleware [middleware/wrap-auth]
                    :handler update-product}
              :delete {:middleware [middleware/wrap-auth]
                       :handler delete-product}}]]]])
`,

    // GraphQL schema + resolvers (Lacinia)
    'src/clj/{{projectNameSnake}}/graphql.clj': `(ns {{projectNameSnake}}.graphql
  "GraphQL endpoint built with Lacinia."
  (:require [com.walmartlabs.lacinia :as lacinia]
            [com.walmartlabs.lacinia.schema :as schema]))

(def compiled-schema
  (schema/compile
    {:queries
     {:hello {:type 'String
              :resolve (fn [_context _args _value] "Hello from Luminus + Lacinia GraphQL!")}
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

    // Database (in memory; a Mount state seeds it on start)
    'src/clj/{{projectNameSnake}}/db/core.clj': `(ns {{projectNameSnake}}.db.core
  "In-memory storage. Swap this namespace for Conman/HugSQL or next.jdbc
  (as the full Luminus template does) before going to production."
  (:require [mount.core :refer [defstate]]
            [{{projectNameSnake}}.auth :as auth]))

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

(defn seed!
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
                    :stock 50}))

(defstate store
  :start (seed!)
  :stop (reset-db!))
`,

    // Development helpers (only on the classpath in the dev profile)
    'env/dev/clj/user.clj': `(ns user
  "REPL helpers: (start), (stop) and (restart)."
  (:require [mount.core :as mount]
            [{{projectNameSnake}}.core]))

(defn start []
  (mount/start))

(defn stop []
  (mount/stop))

(defn restart []
  (stop)
  (start))
`,

    // Configuration and static resources
    'resources/config.edn': `{:port {{port}}
 :jwt-secret "dev-secret-change-me"}
`,

    'resources/templates/home.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{page-title}}</title>
  <link rel="stylesheet" href="/css/screen.css">
</head>
<body>
  <main>
    <h1>{{page-title}}</h1>
    <p>Your Luminus-style application is running.</p>
    <h2>Endpoints</h2>
    <ul>
      {% for endpoint in endpoints %}<li><code>{{endpoint}}</code></li>
      {% endfor %}
    </ul>
  </main>
</body>
</html>
`,

    'resources/public/css/screen.css': `body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  margin: 0;
  background: #f7f7f9;
  color: #1f2430;
}

main {
  max-width: 40rem;
  margin: 3rem auto;
  padding: 0 1rem;
}

code {
  background: #e8eaf0;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}
`,

    'resources/logback.xml': `<configuration>
  <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
    </encoder>
  </appender>

  <logger name="org.eclipse.jetty" level="WARN"/>

  <root level="INFO">
    <appender-ref ref="STDOUT"/>
  </root>
</configuration>
`,

    // Tests
    'test/clj/{{projectNameSnake}}/handler_test.clj': `(ns {{projectNameSnake}}.handler-test
  (:require [clojure.string :as str]
            [clojure.test :refer [deftest is testing use-fixtures]]
            [mount.core :as mount]
            [muuntaja.core :as m]
            [ring.mock.request :as mock]
            [{{projectNameSnake}}.config :as config]
            [{{projectNameSnake}}.db.core :as db]
            [{{projectNameSnake}}.handler :as handler]))

(use-fixtures :once
  (fn [run-tests]
    (mount/start #'config/env #'handler/app)
    (run-tests)
    (mount/stop #'handler/app #'config/env)))

(use-fixtures :each
  (fn [run-test]
    (db/reset-db!)
    (run-test)))

(defn- app [request]
  ((deref handler/app) request))

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

(deftest home-page-is-rendered
  (let [response (app (mock/request :get "/"))]
    (is (= 200 (:status response)))
    (is (str/includes? (:body response) "<h1>"))))

(deftest health-endpoints
  (doseq [uri ["/health" "/api/v1/health"]]
    (let [response (app (mock/request :get uri))]
      (is (= 200 (:status response)))
      (is (= "healthy" (:status (decode response)))))))

(deftest unknown-route-is-404
  (is (= 404 (:status (app (mock/request :get "/nope"))))))

(deftest register-and-login
  (testing "registering returns a token and hides the password hash"
    (let [response (register! "test@example.com")
          body (decode response)]
      (is (= 201 (:status response)))
      (is (string? (:token body)))
      (is (not (contains? (:user body) :password-hash)))))
  (testing "the same email cannot register twice"
    (is (= 409 (:status (register! "test@example.com")))))
  (testing "login works with the right password only"
    (is (= 200 (:status (app (json-request :post "/api/v1/auth/login"
                                           {:email "test@example.com" :password "password123"})))))
    (is (= 401 (:status (app (json-request :post "/api/v1/auth/login"
                                           {:email "test@example.com" :password "nope"})))))))

(deftest registration-is-validated
  (is (= 400 (:status (app (json-request :post "/api/v1/auth/register" {:email "a@b.c"}))))))

(deftest protected-routes-need-a-token
  (is (= 401 (:status (app (mock/request :get "/api/v1/users")))))
  (is (= 401 (:status (app (mock/request :get "/api/v1/auth/me")))))
  (is (= 401 (:status (app (json-request :post "/api/v1/products" {:name "Widget" :price 5}))))))

(deftest product-lifecycle
  (let [token (-> (register! "shop@example.com") decode :token)
        created (app (json-request :post "/api/v1/products"
                                   {:name "Widget" :price 9.5 :stock 3}
                                   token))
        product-id (get-in (decode created) [:product :id])]
    (is (= 201 (:status created)))
    (is (= 200 (:status (app (authed-request :get "/api/v1/auth/me" token)))))
    (is (= 1 (:count (decode (app (mock/request :get "/api/v1/products"))))))
    (is (= 200 (:status (app (json-request :put (str "/api/v1/products/" product-id)
                                           {:stock 7}
                                           token)))))
    (is (= 204 (:status (app (authed-request :delete (str "/api/v1/products/" product-id) token)))))
    (is (= 404 (:status (app (mock/request :get (str "/api/v1/products/" product-id))))))))

(deftest graphql-query
  (let [response (app (json-request :post "/graphql" {:query "{ hello health }"}))
        body (decode response)]
    (is (= 200 (:status response)))
    (is (= "healthy" (get-in body [:data :health])))))
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

# Copy source code and resources, then build the uberjar
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

A Clojure web application in the style of the Luminus framework: Mount for application state, Cprop for configuration, Selmer for HTML templates, Reitit and Muuntaja for routing and JSON, and Ring defaults on Jetty.

## Features

- **Mount**: application state (configuration, seed data, handler, HTTP server) with a clear start and stop order
- **Cprop**: configuration from \`resources/config.edn\`, overridden by system properties and environment variables (\`PORT\`, \`JWT_SECRET\`)
- **Selmer**: server-side HTML templates (\`resources/templates\`) and static files (\`resources/public\`)
- **Reitit and Muuntaja**: data-driven routes with JSON content negotiation
- **Buddy**: JWT authentication and hashed passwords
- **Lacinia**: a GraphQL endpoint at \`POST /graphql\`
- **Logging**: \`clojure.tools.logging\` with Logback (\`resources/logback.xml\`)
- **CORS** and Ring defaults (sessions, security headers)

Data is kept in memory (see \`src/clj/{{projectNameSnake}}/db/core.clj\`). For SQL, Conman or next.jdbc, and ClojureScript front ends, generate a full app with \`lein new luminus\`.

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

Open http://localhost:{{port}}. Set \`JWT_SECRET\` in production.

## API Endpoints

- \`GET /\` - HTML home page
- \`GET /health\`, \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register (\`email\`, \`name\`, \`password\`)
- \`POST /api/v1/auth/login\` - Login, returns a JWT
- \`GET /api/v1/auth/me\` - Current user (bearer token)
- \`GET /api/v1/users\`, \`GET /api/v1/users/:id\` - Users (bearer token)
- \`GET /api/v1/products\`, \`GET /api/v1/products/:id\` - Read products
- \`POST /api/v1/products\`, \`PUT|DELETE /api/v1/products/:id\` - Change products (bearer token)
- \`POST /graphql\` - GraphQL (\`{"query": "{ hello health }"}\`)

On start-up the app seeds \`admin@example.com\` / \`admin123\` and two sample products.

## Project Structure

\`\`\`
├── src/clj/{{projectNameSnake}}/
│   ├── core.clj          # Entry point, HTTP server state
│   ├── config.clj        # Cprop configuration state
│   ├── handler.clj       # Reitit router and Ring handler state
│   ├── middleware.clj    # Logging, Ring defaults, CORS, JWT auth
│   ├── layout.clj        # Selmer rendering
│   ├── auth.clj          # Password hashing and JWTs
│   ├── graphql.clj       # Lacinia schema and handler
│   ├── routes/           # HTML and JSON routes
│   └── db/core.clj       # In-memory store
├── env/dev/clj/user.clj  # REPL helpers (dev profile)
├── resources/            # config.edn, templates, static files, logback.xml
├── test/clj/             # Tests
└── project.clj
\`\`\`

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
