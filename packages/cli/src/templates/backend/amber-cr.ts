import { BackendTemplate } from '../types';

export const amberCrTemplate: BackendTemplate = {
  id: 'amber-cr',
  name: 'amber-cr',
  displayName: 'Amber (Crystal)',
  description: 'MVC web framework for Crystal with ORM, WebSocket support, and JSON handling',
  language: 'crystal',
  framework: 'amber',
  version: '1.0.0',
  tags: ['crystal', 'amber', 'mvc', 'websockets', 'database', 'json'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'websockets', 'database', 'rest-api', 'session-management', 'testing', 'docker'],

  // An Amber app (the layout `amber new` produces) plus a Product JSON API and a WebSocket chat channel.
  files: {
    '.amber.yml': `type: app
database: pg
language: ecr
model: granite

# list of tasks to be run by \`amber watch\`
watch:
  # NOTE: names that match crystal commands are special (e.g. run, spec)
  run:
    # commands will be joined with && (join them yourself if need || or ;)
    build_commands:
      - mkdir -p bin
      - crystal build ./src/server.cr -o bin/{{projectName}}
    run_commands:
      - bin/{{projectName}}
    include:
      - ./config/**/*.cr
      - ./config/environments/*.yml
      - ./src/**/*.cr
      - ./src/**/*.ecr
      - ./src/locales/*.yml
    # exclude: # NOTE simplistic implementation: (1) enumerate all includes and excludes; (2) return (includes - excludes)
    #  - ./src/some_irrelevant_file.cr
  spec:
    run_commands:
      - AMBER_ENV=test crystal spec
    include:
      - ./spec/**/*.cr
`,

    '.gitignore': `/doc/
/lib/
/.crystal/
/.shards/
/.vscode/
/tmp/
.env
.encryption_key
.DS_Store
/bin/
/node_modules
/public/dist
`,

    'config/application.cr': `# About Application.cr File
#
# This is Amber application main entry point. This file is responsible for loading
# initializers, classes, and all application related code in order to have
# Amber::Server boot up.
#
# > We recommend not modifying the order of the requires since the order will
# affect the behavior of the application.

require "amber"
require "./settings"
require "./logger"
require "./i18n"
require "./database"
require "./initializers/**"

# uncomment these 4 lines to enable plugins
# require "../plugins/plugins"

# Start Generator Dependencies: Don't modify.
require "../src/channels/**"
require "../src/sockets/**"
require "../src/pipes/**"
require "../src/models/**"
# End Generator Dependencies

require "../src/controllers/application_controller"
require "../src/controllers/**"
require "./routes"
`,

    'config/database.cr': `require "granite/adapter/pg"

Granite::Connections << Granite::Adapter::Pg.new(name: "pg", url: ENV["DATABASE_URL"]? || Amber.settings.database_url)
`,

    'config/environments/development.yml': `secret_key_base: 6tBk5ClnrYNe10SCeLPKHgo2I4vfMAVyc9HM5G2sR54
port: 3000
name: {{projectNameSnake}}

logging:
  severity: debug
  colorize: true
  filter:
    - password
    - confirm_password

host: 0.0.0.0
port_reuse: true
process_count: 1
# ssl_key_file:
# ssl_cert_file:
redis_url: "redis://localhost:6379"
database_url: postgres://postgres:postgres@localhost:5432/{{projectNameSnake}}_development
auto_reload: true

session:
  key: amber.session
  store: signed_cookie
  expires: 0

smtp:
  enabled: false

pipes:
  static:
    headers:
      "Cache-Control": "no-store"

secrets:
  description: Store your development secrets credentials and settings here.
`,

    'config/environments/production.yml': `# Production settings. Secrets are not stored here: set SECRET_KEY_BASE and
# DATABASE_URL (and REDIS_URL / SMTP_* when used) in the environment. The
# overrides live in config/settings.cr.
secret_key_base: set-SECRET_KEY_BASE-in-the-environment
port: 3000
name: {{projectName}}

logging:
  severity: info
  colorize: false
  filter:
    - password
    - confirm_password

host: 0.0.0.0
port_reuse: true
process_count: 1
redis_url: "redis://localhost:6379"
database_url: postgres://postgres:postgres@localhost:5432/{{projectNameSnake}}_production
auto_reload: false

session:
  key: amber.session
  store: signed_cookie
  expires: 0

smtp:
  enabled: false

secrets:
  description: Production credentials come from the environment.
`,

    'config/environments/test.yml': `secret_key_base: QpQuZZ5x_nTABa__gSiGjkVelGeP6zXPuHvRVmVp1BQ
port: 3000
name: {{projectNameSnake}}

logging:
  severity: debug
  colorize: true
  filter:
    - password
    - confirm_password
    
host: 0.0.0.0
port_reuse: false
process_count: 1
# ssl_key_file:
# ssl_cert_file:
redis_url: "redis://localhost:6379"
database_url: postgres://postgres:postgres@localhost:5432/{{projectNameSnake}}_test
auto_reload: false

session:
  key: amber.session
  store: signed_cookie
  expires: 0

smtp:
  enabled: false

secrets:
  description: Store your development secrets credentials and settings here.
`,

    'config/i18n.cr': `require "citrine-i18n"

Citrine::I18n.configure do |settings|
  # Backend storage (as supported by i18n.cr)
  # settings.backend = I18n::Backend::Yaml.new

  # Default locale (defaults to "en" and "./src/locales/**/en.yml").
  # For a new default locale to be accepted, it must be found by the
  # backend storage and reported in "settings.available_locales".
  # settings.default_locale = "en"

  # Separator between sublevels of data (defaults to '.')
  # e.g. I18n.translate("some/thing") instead of "some.thing"
  # settings.default_separator = '.'

  # Returns the current exception handler. Defaults to an instance of
  # I18n::ExceptionHandler.
  # settings.exception_handler = ExceptionHandler.new

  # The path from where the translations should be loaded
  settings.load_path += ["./src/locales"]
end

I18n.init
`,

    'config/initializers/mailer.cr': `require "quartz_mailer"

Quartz.config do |c|
  c.smtp_enabled = Amber.settings.smtp.enabled

  c.smtp_address = ENV["SMTP_ADDRESS"]? || Amber.settings.smtp.host
  c.smtp_port = ENV["SMTP_PORT"]? || Amber.settings.smtp.port
  c.username = ENV["SMTP_USERNAME"]? || Amber.settings.smtp.username
  c.password = ENV["SMTP_PASSWORD"]? || Amber.settings.smtp.password

  c.use_authentication = !c.password.blank?
  c.use_tls = EMail::Client::TLSMode::NONE
  # c.use_tls = EMail::Client::TLSMode::STARTTLS
  # c.use_tls = EMail::Client::TLSMode::SMTPS
end

require "../../src/mailers/application_mailer"
require "../../src/mailers/**"
`,

    'config/logger.cr': `require "log"

# About logger.cr File
#
# Amber is using the crystal standard library Log
# You can read details here: https://crystal-lang.org/api/0.35.0/Log.html

# Using environment settings:
Colorize.enabled = Amber.settings.logging.colorize
backend = Log::IOBackend.new(STDOUT)

# Custom formatter
# This is a good place to change the time from UTC

# if you want the systems local time or hard code a timezone, uncomment
# one of the following lines and update the formatter accordingly
# time_zone = Time::Location.local
# time_zone = Time::Location.load("America/Buenos_Aires")

backend.formatter = Log::Formatter.new do |entry, io|
  io << entry.timestamp.to_s("%I:%M:%S")
  # io << entry.timestamp.in(time_zone).to_s("%I:%M:%S")
  io << " "
  io << entry.source
  io << " |"
  io << " (#{entry.severity})" if entry.severity > Log::Severity::Debug
  io << " "
  io << entry.message
end

Log.builder.clear
Log.builder.bind "*", Amber.settings.logging.severity, backend

# Using crystal's standard environment variables:
# CRYSTAL_LOG_LEVEL=INFO
# CRYSTAL_LOG_SOURCES=*
# Logs are emitted to STDOUT
# Log.setup_from_env

# Using more advanced options:
# backend = Log::IOBackend.new
# Log.builder.bind "*", :warn, backend
# Log.builder.bind "request", :debug, backend
# Log.builder.bind "headers", :debug, backend
# Log.builder.bind "cookies", :debug, backend
# Log.builder.bind "params", :debug, backend
# Log.builder.bind "session", :debug, backend
# Log.builder.bind "errors", :warn, backend
# Log.builder.bind "granite.*", :info, backend
# Log.builder.bind "*", :error, ElasticSearchBackend.new("http://localhost:9200")
`,

    'config/routes.cr': `Amber::Server.configure do
  pipeline :web, :auth do
    # Plug is the method to use connect a pipe (middleware)
    # A plug accepts an instance of HTTP::Handler
    # plug Amber::Pipe::PoweredByAmber.new
    # plug Amber::Pipe::ClientIp.new(["X-Forwarded-For"])
    plug Citrine::I18n::Handler.new
    plug Amber::Pipe::SecureHeaders.new
    plug Amber::Pipe::Error.new
    plug Amber::Pipe::Logger.new
    plug Amber::Pipe::Session.new
    plug Amber::Pipe::Flash.new
    plug Amber::Pipe::CSRF.new

    plug CurrentUser.new
  end

  pipeline :auth do
    plug Authenticate.new
  end

  pipeline :api do
    # plug Amber::Pipe::PoweredByAmber.new
    plug Amber::Pipe::Error.new
    plug Amber::Pipe::Logger.new
    plug Amber::Pipe::Session.new
    plug Amber::Pipe::CORS.new
  end

  # All static content will run these transformations
  pipeline :static do
    # plug Amber::Pipe::PoweredByAmber.new
    plug Amber::Pipe::Error.new
    plug Amber::Pipe::Static.new("./public")
  end

  routes :web do
    get "/", HomeController, :index

    websocket "/chat", AppSocket

    get "/signin", SessionController, :new
    post "/session", SessionController, :create
    get "/signup", UserController, :new
    post "/registration", UserController, :create
  end

  routes :auth do
    get "/profile", UserController, :show
    get "/profile/edit", UserController, :edit
    patch "/profile", UserController, :update
    get "/signout", SessionController, :delete
  end

  routes :api do
    resources "/products", ProductController, except: [:new, :edit]
  end

  routes :static do
    # Each route is defined as follow
    # verb resource : String, controller : Symbol, action : Symbol
    get "/*", Amber::Controller::Static, :index
  end
end
`,

    'config/settings.cr': `# About settings.cr File
#
# With \`Amber::Server.configure\` block you can redefine the Server configuration
# settings and use ENVIRONMENT variables and/or values evaluated at runtime.
#
# > Important! Yaml configurations are first class citizen and are loaded first before
# this file, we recommend to use yaml configurations before changing any settings here.
# Any uncommented setting here will override the YAML with the value set here.

Amber::Server.configure do |settings|
  # Use your environment variables settings here.
  #
  # Name: A name that identifies this application. This is not internally
  # used by the framework.
  #
  # settings.name = "{{projectName}} web application."
  #
  #
  # Colorize Logging: specifies whether or not to use ANSI color codes
  # when logging information, display the time and/or to display the severity level.
  # Defaults to true.
  #
  # settings.logging.severity = "info"
  # settings.logging.colorize = true
  # settings.logging.color = "white"
  # settings.logging.filter = %w(password confirm_password)
  # settings.logging.skip = %w()
  #
  #
  # Secret Key Base: is used for specifying a key which allows sessions
  # for the application to be verified against a known secure key to
  # prevent tampering. Applications get Amber.secret_key
  # initialized to a random key present in \`ENV["AMBER_SECRET_KEY"]\` or
  # \`.amber_secret_key\` in this order.
  #
  settings.secret_key_base = ENV["SECRET_KEY_BASE"] if ENV["SECRET_KEY_BASE"]?
  #
  #
  # Host: is the application server host address or ip address. Useful for when
  # deploying Amber to a PAAS and likely the assigned server IP is either
  # known or unknown. Defaults to an environment variable HOST
  #
  settings.host = ENV["HOST"] if ENV["HOST"]?
  #
  #
  # Port Reuse: Amber supports clustering mode which allows to spin
  # multiple app instances per core. This setting allows to bind the different
  # instances to the same port. Default this setting to true if the number or process
  # is greater than 1.
  #
  # > Read more about Linux PORT REUSE https://lwn.net/Articles/542629/
  #
  # settings.port_reuse = true
  #
  #
  # Process Count: This will enable Amber to be used in cluster mode,
  # spinning an instance for each number of process specified here.
  # Rule of thumb, always leave at least 1 core available for system processes/resources.
  #
  # settings.process_count = ENV["PROCESS_COUNT"].to_i if ENV["PROCESS_COUNT"]?
  #
  #
  # PORT: This is the port that you're application will run on. Examples would be (80, 443, 3000, 8080)
  #
  settings.port = ENV["PORT"].to_i if ENV["PORT"]?
  #
  #
  # Redis URL: Redis is an in memory key value storage. Amber utilizes redis as
  # a storing option for session information.
  #
  settings.redis_url = ENV["REDIS_URL"] if ENV["REDIS_URL"]?
  #
  #
  # Database URL: This is the database connection string or data file url.
  # The connection string contains the information to establish a connection to the
  # database or the data file. Defaults to the database provider you chose at
  # at app generation.
  #
  settings.database_url = ENV["DATABASE_URL"] if ENV["DATABASE_URL"]?
  #
  #
  # SSL Key File: The private key is a text file used initially to generate a
  # Certificate Signing Request (CSR), and later to secure and verify connections
  # using the certificate created per that request. The private key is used to create
  # a digital signature as you might imagine from the name, the private key should be
  # \`\`closely guarded.
  #
  # settings.ssl_key_file = ENV["SSL_KEY_FILE"] if ENV["SSL_KEY_FILE"]?
  #
  #
  # SSL Cert File: This represents the signed certificate file. SSL Certificates are
  # small data files that digitally bind a cryptographic key to an organization's
  # details. When installed on a web server, it activates the padlock and the https
  # protocol and allows secure connections from a web server to a browser.
  #
  # settings.ssl_cert_file = ENV["SSL_CERT_FILE"] if ENV["SSL_CERT_FILE"]?
  #
  #
  # Session: A Hash that specifies the session storage mechanism, expiration and key to be used
  # for the application. The \`key\` specifies the name of the cookie to be used defaults to
  # "amber.session". The store can be \`encrypted_cookie\`, \`signed_cookie\` or \`redis\`. Expires
  # when set to 0 means this is indefinitely and is expressed in seconds.
  #
  # settings.session = { "key" => "amber.session", "store" => "signed_cookie", "expires" => 0 }
  #
end
`,

    'db/migrations/20261004133109464_create_product.sql': `-- +micrate Up
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR,
  description TEXT,
  price FLOAT,
  stock INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);


-- +micrate Down
DROP TABLE IF EXISTS products;
`,

    'db/migrations/20261004133109523_create_user.sql': `-- +micrate Up
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR,
  hashed_password VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);


-- +micrate Down
DROP TABLE IF EXISTS users;
`,

    'db/seeds.cr': `require "../config/application"

# This file is for setting up your seeds.
#
# To run seeds execute \`amber db seed\`

# Example:
# User.create(name: "example", email: "ex@mple.com")
# Test user for auth

User.create(email: "admin@example.com", password: "password")
`,

    'docker-compose.yml': `services:
  app:
    build: .
    environment:
      AMBER_ENV: production
      SECRET_KEY_BASE: \${SECRET_KEY_BASE:-change-me-before-deploying}
      DATABASE_URL: postgres://postgres:postgres@db:5432/{{projectNameSnake}}_production
    ports:
      - "3000:3000"
    depends_on:
      - db

  # One-off: docker compose run --rm app bin/amber db migrate seed
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: {{projectNameSnake}}_production
    ports:
      - "5432:5432"
    volumes:
      - db:/var/lib/postgresql/data

volumes:
  db:
`,

    'Dockerfile': `FROM crystallang/crystal:1.21.1

WORKDIR /app

COPY shard.yml shard.lock* ./
RUN shards install

COPY . .
RUN shards build --release

ENV AMBER_ENV=production
EXPOSE 3000

CMD ["bin/{{projectName}}"]
`,

    'public/crossdomain.xml': `<?xml version="1.0"?>
<!DOCTYPE cross-domain-policy SYSTEM "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">
<cross-domain-policy>
  <!-- Read this: www.adobe.com/devnet/articles/crossdomain_policy_file_spec.html -->

  <!-- Most restrictive policy: -->
  <site-control permitted-cross-domain-policies="none"/>

  <!-- Least restrictive policy: -->
  <!--
  <site-control permitted-cross-domain-policies="all"/>
  <allow-access-from domain="*" to-ports="*" secure="false"/>
  <allow-http-request-headers-from domain="*" headers="*" secure="false"/>
  -->
</cross-domain-policy>
`,

    'public/css/main.css': `.main {
  padding-top: 20px;
}

.bg-primary {
  background-color: #f4994b !important
}
`,

    'public/img/logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="502" height="566"><g fill="none" fill-rule="evenodd"><path fill="#F3C095" d="M.117895 142.08393L250.562495.91603l-184.7541 305.3151-65.5352 117.9262z"/><path fill="#FFFEFC" d="M250.8729974 565.0744177L.2832957 424.5200163l65.5325685-118.0244418L250.5625196.9045315l250.5896836 140.5544042.1552393 282.084939z"/><path fill="#FBE9DB" d="M65.808395 306.23113L250.562495.91603l170.6768 203.7692z"/><path fill="#F9DEC9" d="M.273195 424.15733l-.1553-282.0734 65.6904 164.1472z"/><path fill="#FEFBF6" d="M.273195 424.15733l65.5352-117.9262 185.0646 258.8319z"/><path fill="#FFFEFC" d="M339.250895 434.67373l-273.4425-128.4426 355.4309-101.5459z"/><path fill="#FDF3EA" d="M250.872995 565.06303l-185.0646-258.8319 273.4425 128.4426z"/><path fill="#FCF0E4" d="M339.250895 434.67373l81.9884-229.9885 80.0782 219.21z"/><path fill="#FBE9DB" d="M250.872995 565.06303l88.3779-130.3893 162.0666-10.7785z"/><path fill="#FFF" d="M501.317495 423.89523l-80.0782-219.21 79.9231-62.8635z"/><path fill="#FDFCFA" d="M421.239295 204.68523L250.562495.91603l250.5999 140.9057z"/></g></svg>
`,

    'public/js/amber.js': `const EVENTS = {
  join: 'join',
  leave: 'leave',
  message: 'message'
}
const STALE_CONNECTION_THRESHOLD_SECONDS = 100
const SOCKET_POLLING_RATE = 10000

/**
 * Returns a numeric value for the current time
 */
let now = () => {
  return new Date().getTime()
}

/**
 * Returns the difference between the current time and passed \`time\` in seconds
 * @param {Number|Date} time - A numeric time or date object
 */
let secondsSince = (time) => {
  return (now() - time) / 1000
}

/**
 * Class for channel related functions (joining, leaving, subscribing and sending messages)
 */
export class Channel {
  /**
   * @param {String} topic - topic to subscribe to
   * @param {Socket} socket - A Socket instance
   */
  constructor(topic, socket) {
    this.topic = topic
    this.socket = socket
    this.onMessageHandlers = []
  }

  /**
   * Join a channel, subscribe to all channels messages
   */
  join() {
    this.socket.ws.send(JSON.stringify({ event: EVENTS.join, topic: this.topic }))
  }

  /**
   * Leave a channel, stop subscribing to channel messages
   */
  leave() {
    this.socket.ws.send(JSON.stringify({ event: EVENTS.leave, topic: this.topic }))
  }

  /**
   * Calls all message handlers with a matching subject
   */
  handleMessage(msg) {
    this.onMessageHandlers.forEach((handler) => {
      if (handler.subject === msg.subject) handler.callback(msg.payload)
    })
  }

  /**
   * Subscribe to a channel subject
   * @param {String} subject - subject to listen for: \`msg:new\`
   * @param {function} callback - callback function when a new message arrives
   */
  on(subject, callback) {
    this.onMessageHandlers.push({ subject: subject, callback: callback })
  }

  /**
   * Send a new message to the channel
   * @param {String} subject - subject to send message to: \`msg:new\`
   * @param {Object} payload - payload object: \`{message: 'hello'}\`
   */
  push(subject, payload) {
    this.socket.ws.send(JSON.stringify({ event: EVENTS.message, topic: this.topic, subject: subject, payload: payload }))
  }
}

/**
 * Class for maintaining connection with server and maintaining channels list
 */
export class Socket {
  /**
   * @param {String} endpoint - Websocket endpont used in routes.cr file
   */
  constructor(endpoint) {
    this.endpoint = endpoint
    this.ws = null
    this.channels = []
    this.lastPing = now()
    this.reconnectTries = 0
    this.attemptReconnect = true
  }

  /**
   * Returns whether or not the last received ping has been past the threshold
   */
  _connectionIsStale() {
    return secondsSince(this.lastPing) > STALE_CONNECTION_THRESHOLD_SECONDS
  }

  /**
   * Tries to reconnect to the websocket server using a recursive timeout
   */
  _reconnect() {
    clearTimeout(this.reconnectTimeout)
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTries++
      this.connect(this.params)
      this._reconnect()
    }, this._reconnectInterval())
  }

  /**
   * Returns an incrementing timeout interval based around the number of reconnection retries
   */
  _reconnectInterval() {
    return [1000, 2000, 5000, 10000][this.reconnectTries] || 10000
  }

  /**
   * Sets a recursive timeout to check if the connection is stale
   */
  _poll() {
    this.pollingTimeout = setTimeout(() => {
      if (this._connectionIsStale()) {
        this._reconnect()
      } else {
        this._poll()
      }
    }, SOCKET_POLLING_RATE)
  }

  /**
   * Clear polling timeout and start polling
   */
  _startPolling() {
    clearTimeout(this.pollingTimeout)
    this._poll()
  }

  /**
   * Sets \`lastPing\` to the curent time
   */
  _handlePing() {
    this.lastPing = now()
  }

  /**
   * Clears reconnect timeout, resets variables an starts polling
   */
  _reset() {
    clearTimeout(this.reconnectTimeout)
    this.reconnectTries = 0
    this.attemptReconnect = true
    this._startPolling()
  }

  /**
   * Connect the socket to the server, and binds to native ws functions
   * @param {Object} params - Optional parameters
   * @param {String} params.location - Hostname to connect to, defaults to \`window.location.hostname\`
   * @param {String} parmas.port - Port to connect to, defaults to \`window.location.port\`
   * @param {String} params.protocol - Protocol to use, either 'wss' or 'ws'
   */
  connect(params) {
    this.params = params

    let opts = {
      location: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol === 'https:' ? 'wss:' : 'ws:',
    }

    if (params) Object.assign(opts, params)
    if (opts.port) opts.location += \`:\${opts.port}\`

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(\`\${opts.protocol}//\${opts.location}\${this.endpoint}\`)
      this.ws.onmessage = (msg) => { this.handleMessage(msg) }
      this.ws.onclose = () => {
        if (this.attemptReconnect) this._reconnect()
      }
      this.ws.onopen = () => {
        this._reset()
        resolve()
      }
    })
  }

  /**
   * Closes the socket connection permanently
   */
  disconnect() {
    this.attemptReconnect = false
    clearTimeout(this.pollingTimeout)
    clearTimeout(this.reconnectTimeout)
    this.ws.close()
  }

  /**
   * Adds a new channel to the socket channels list
   * @param {String} topic - Topic for the channel: \`chat_room:123\`
   */
  channel(topic) {
    let channel = new Channel(topic, this)
    this.channels.push(channel)
    return channel
  }

  /**
   * Message handler for messages received
   * @param {MessageEvent} msg - Message received from ws
   */
  handleMessage(msg) {
    if (msg.data === "ping") return this._handlePing()

    let parsed_msg = JSON.parse(msg.data)
    this.channels.forEach((channel) => {
      if (channel.topic === parsed_msg.topic) channel.handleMessage(parsed_msg)
    })
  }
}

export default {
  Channel,
  Socket
};

/**
 * Allows delete links to post for security and ease of use similar to Rails jquery_ujs
 */
document.addEventListener("DOMContentLoaded", () => {
  let elements = document.querySelectorAll("a[data-method='delete']");
  for (let i = 0; i < elements.length; i++) {
    elements[i].addEventListener("click", (e) => {
      e.preventDefault();
      let message = elements[i].getAttribute("data-confirm") || "Are you sure?";
      if (confirm(message)) {
        let form = document.createElement("form");
        let input = document.createElement("input");
        form.setAttribute("action", elements[i].getAttribute("href"));
        form.setAttribute("method", "POST");
        input.setAttribute("type", "hidden");
        input.setAttribute("name", "_method");
        input.setAttribute("value", "DELETE");
        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
      }
      return false;
    })
  }
});

if (!Date.prototype.toGranite) {
  (function() {

    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    Date.prototype.toGranite = function() {
      return this.getUTCFullYear() +
        '-' + pad(this.getUTCMonth() + 1) +
        '-' + pad(this.getUTCDate()) +
        ' ' + pad(this.getUTCHours()) +
        ':' + pad(this.getUTCMinutes()) +
        ':' + pad(this.getUTCSeconds())  ;
    };

  }());
}
`,

    'public/js/client_reload.js': `if ('WebSocket' in window) {
  (function () {
    /**
     * Allows to reload the browser when the server connection is lost
     */
    function tryReload() {
      var request = new XMLHttpRequest();
      request.open('GET', window.location.href, true);
      request.onreadystatechange = function () {
        if (request.readyState == 4) {
          if (request.status == 0) {
            setTimeout(function () {
                tryReload();
            }, 1000)
          } else {
            window.location.reload();
          }
        }
      };
      request.send();
    }

    /**
     * Listen server file reload
     */
    function refreshCSS() {
      var sheets = [].slice.call(document.getElementsByTagName('link'));
      var head = document.getElementsByTagName('head')[0];
      for (var i = 0; i < sheets.length; ++i) {
        var elem = sheets[i];
        var rel = elem.rel;
        if (elem.href && typeof rel != 'string' || rel.length == 0 || rel.toLowerCase() == 'stylesheet') {
          head.removeChild(elem);
          var url = elem.href.replace(/(&|\\\\?)_cacheOverride=\\\\d+/, '');
          elem.href = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_cacheOverride=' + (new Date().valueOf());
          head.appendChild(elem);
        }
      }
    }

    var protocol = window.location.protocol === 'http:' ? 'ws://' : 'wss://';
    var address = protocol + window.location.host + '/client-reload';
    var socket = new WebSocket(address);
    socket.onmessage = function (msg) {
      if (msg.data == 'reload') {
        tryReload();
      } else if (msg.data == 'refreshcss') {
        refreshCSS();
      }
    };
  })();
}
`,

    'public/robots.txt': `# http://www.robotstxt.org
User-agent: *
Disallow:
`,

    'README.md': `# {{projectName}}

{{description}}

An [Amber](https://amberframework.org) (Crystal) app on PostgreSQL with Granite models. It follows
the layout \`amber new\` produces, extended with a JSON API for products and a WebSocket chat channel,
so the Amber guides and generators apply.

## What is included

- Server-rendered pages (ECR) with session based sign up and sign in (\`/signup\`, \`/signin\`, \`/profile\`)
- JSON CRUD API for \`Product\` at \`/products\` (API pipeline with CORS)
- WebSocket endpoint at \`/chat\` (\`src/sockets/app_socket.cr\`, \`src/channels/chat_channel.cr\`)
- Granite models, SQL migrations (micrate) in \`db/migrations\`, seeds in \`db/seeds.cr\`
- Specs for the models and the product controller

## Requirements

- Crystal >= 1.20 and \`shards\`
- PostgreSQL (see \`config/environments/*.yml\`, or set \`DATABASE_URL\`)

## Getting started

\`\`\`bash
shards install
shards build                      # builds bin/{{projectName}} and bin/amber
bin/amber db create migrate seed  # seeds admin@example.com / password
bin/amber watch                   # http://localhost:3000
\`\`\`

Without \`bin/amber watch\` you can run \`crystal run src/server.cr\`.

Environment variables override the YAML settings: \`PORT\`, \`HOST\`, \`DATABASE_URL\`, \`REDIS_URL\`,
\`SECRET_KEY_BASE\` (see \`config/settings.cr\`). Set \`SECRET_KEY_BASE\` and \`DATABASE_URL\` when
running with \`AMBER_ENV=production\`.

## API

| Method | Path |
| --- | --- |
| GET | \`/products\` |
| POST | \`/products\` with \`{"name", "description", "price", "stock"}\` |
| GET | \`/products/:id\` |
| PUT/PATCH | \`/products/:id\` |
| DELETE | \`/products/:id\` |

## Tests

The specs need the test database (\`AMBER_ENV=test\` is set by \`spec/spec_helper.cr\`; migrations are
applied when the specs start):

\`\`\`bash
AMBER_ENV=test bin/amber db create
crystal spec
\`\`\`

## Docker

\`docker compose up\` runs the app in production mode next to PostgreSQL; set \`SECRET_KEY_BASE\`
first and run \`docker compose run --rm app bin/amber db migrate seed\` once.

## License

MIT
`,

    'shard.yml': `name: {{projectName}}
version: 0.1.0

crystal: ">= 1.20.0"

license: MIT

targets:
  {{projectName}}:
    main: src/server.cr

  # bin/amber: the Amber CLI (watch, db create/migrate, generate, ...)
  amber:
    main: lib/amber/src/amber/cli.cr

dependencies:
  amber:
    github: amberframework/amber
    version: ~> 1.5.0

  granite:
    github: amberframework/granite
    version: ~> 0.23.3

  quartz_mailer:
    github: amberframework/quartz-mailer
    version: ~> 0.8.0

  jasper_helpers:
    github: amberframework/jasper-helpers
    version: ~> 1.2.2

  pg:
    github: will/crystal-pg
    version: ~> 0.26.0

  citrine-i18n:
    github: dare892/citrine-i18n
    version: ~> 1.0.0

development_dependencies:
  ameba:
    github: crystal-ameba/ameba
    version: ~> 1.7.0
`,

    'spec/controllers/product_controller_spec.cr': `require "./spec_helper"

include RequestHelper

def handler
  Amber::Server.handler
end

JSON_HEADERS = HTTP::Headers{"Content-Type" => "application/json"}

private def product_json(name = "Widget", price = 9.5, stock = 3)
  {name: name, description: "A product", price: price, stock: stock}.to_json
end

describe ProductController do
  it "lists products" do
    Product.create(name: "First", price: 1.0, stock: 1)

    response = get "/products"

    response.status_code.should eq 200
    JSON.parse(response.body).as_a.map(&.["name"].as_s).should eq ["First"]
  end

  it "creates a product from a JSON body" do
    response = post "/products", headers: JSON_HEADERS, body: product_json

    response.status_code.should eq 201
    JSON.parse(response.body)["name"].should eq "Widget"
    Product.count.should eq 1
  end

  it "shows a product" do
    product = Product.create!(name: "Shown", price: 2.0, stock: 2)

    response = get "/products/#{product.id}"

    response.status_code.should eq 200
    JSON.parse(response.body)["name"].should eq "Shown"
  end

  it "answers 404 for an unknown product" do
    response = get "/products/0"

    response.status_code.should eq 404
  end

  it "updates a product" do
    product = Product.create!(name: "Before", price: 2.0, stock: 2)

    response = put "/products/#{product.id}", headers: JSON_HEADERS, body: product_json("After")

    response.status_code.should eq 200
    Product.find!(product.id).name.should eq "After"
  end

  it "deletes a product" do
    product = Product.create!(name: "Gone", price: 2.0, stock: 2)

    response = delete "/products/#{product.id}"

    response.status_code.should eq 204
    Product.count.should eq 0
  end
end
`,

    'spec/controllers/spec_helper.cr': `require "../spec_helper"
require "../request_helper"
`,

    'spec/models/product_spec.cr': `require "./spec_helper"
require "../../src/models/product.cr"

describe Product do
  it "persists its attributes" do
    product = Product.create!(name: "Widget", description: "Useful", price: 12.5, stock: 4)

    found = Product.find!(product.id)
    found.name.should eq "Widget"
    found.price.should eq 12.5
    found.stock.should eq 4
  end

  it "starts empty" do
    Product.count.should eq 0
  end
end
`,

    'spec/models/spec_helper.cr': `require "../spec_helper"
`,

    'spec/models/user_spec.cr': `require "./spec_helper"
require "../../src/models/user.cr"

describe User do
  it "stores a bcrypt hash and authenticates with the password" do
    user = User.new(email: "person@example.com")
    user.password = "correct horse"
    user.save.should be_true

    user.hashed_password.should_not eq "correct horse"
    user.authenticate("correct horse").should be_true
    user.authenticate("wrong").should be_false
  end

  it "requires a unique email" do
    first = User.new(email: "same@example.com")
    first.password = "password123"
    first.save.should be_true

    second = User.new(email: "same@example.com")
    second.password = "password123"
    second.save.should be_false
  end

  it "rejects a short password" do
    user = User.new(email: "short@example.com")
    user.password = "short"
    user.save.should be_false
  end
end
`,

    'spec/request_helper.cr': `require "http"

module RequestHelper
  macro included
    {% http_read_verbs = %w(get head options trace connect) %}
    {% http_write_verbs = %w(post put patch delete) %}
    {% http_verbs = http_read_verbs + http_write_verbs %}

    {% for method in http_verbs %}
      def {{method.id}}(path, headers : HTTP::Headers? = nil, body : String? = nil)
        request = HTTP::Request.new("{{method.id}}".upcase, path, headers, body )
        {% if http_write_verbs.includes? method %}
          request.headers["Content-Type"] ||= "application/x-www-form-urlencoded"
        {% end %}
        process_request(request)
      end
    {% end %}
  end

  private def process_request(request)
    io = IO::Memory.new
    response = HTTP::Server::Response.new(io)
    context = HTTP::Server::Context.new(request, response)
    handler.call context
    response.close
    io.rewind
    client_response = HTTP::Client::Response.from_io(io, decompress: false)
    client_response
  end
end
`,

    'spec/spec_helper.cr': `ENV["AMBER_ENV"] ||= "test"

require "spec"
require "micrate"

require "../config/application"

# The specs run against the test database from config/environments/test.yml
# (or DATABASE_URL). Create it first with \`AMBER_ENV=test bin/amber db create\`.
Micrate::DB.connection_url = ENV["DATABASE_URL"]? || Amber.settings.database_url
Micrate::Cli.run_up

# Build the router and pipelines once so controller specs can send requests.
Amber::Server.handler.prepare_pipelines

Spec.before_each do
  Product.clear
  User.clear
end
`,

    'src/channels/chat_channel.cr': `class ChatChannel < Amber::WebSockets::Channel
  # Every message a client sends to a "chat:<room>" topic is relayed to the
  # other subscribers of that topic.
  def handle_message(client_socket, msg)
    rebroadcast!(msg)
  end
end
`,

    'src/controllers/application_controller.cr': `require "jasper_helpers"

class ApplicationController < Amber::Controller::Base
  include JasperHelpers
  LAYOUT = "application.ecr"

  def current_user
    context.current_user
  end
end
`,

    'src/controllers/home_controller.cr': `class HomeController < ApplicationController
  def index
    render("index.ecr")
  end
end
`,

    'src/controllers/product_controller.cr': `class ProductController < ApplicationController
  def index
    products = Product.all
    respond_with 200 do
      json products.to_json
    end
  end

  def show
    if product = Product.find params["id"]
      respond_with 200 do
        json product.to_json
      end
    else
      results = {status: "not found"}
      respond_with 404 do
        json results.to_json
      end
    end
  end

  def create
    product = Product.new(product_params.validate!)

    if product.valid? && product.save
      respond_with 201 do
        json product.to_json
      end
    else
      results = {status: "invalid"}
      respond_with 422 do
        json results.to_json
      end
    end
  end

  def update
    if product = Product.find(params["id"])
      product.set_attributes(product_params.validate!)
      if product.valid? && product.save
        respond_with 200 do
          json product.to_json
        end
      else
        results = {status: "invalid"}
        respond_with 422 do
          json results.to_json
        end
      end
    else
      results = {status: "not found"}
      respond_with 404 do
        json results.to_json
      end
    end
  end

  def destroy
    if product = Product.find params["id"]
      product.destroy
      respond_with 204 do
        json ""
      end
    else
      results = {status: "not found"}
      respond_with 404 do
        json results.to_json
      end
    end
  end

  def product_params
    params.validation do
      required(:name, msg: nil, allow_blank: true)
      required(:description, msg: nil, allow_blank: true)
      required(:price, msg: nil, allow_blank: true)
      required(:stock, msg: nil, allow_blank: true)
    end
  end
end
`,

    'src/controllers/session_controller.cr': `class SessionController < ApplicationController
  def new
    user = User.new
    render("new.ecr")
  end

  def create
    user = User.find_by(email: params["email"].to_s)
    if user && user.authenticate(params["password"].to_s)
      session[:user_id] = user.id
      flash[:info] = "Successfully logged in"
      redirect_to "/"
    else
      flash[:danger] = "Invalid email or password"
      user = User.new
      render("new.ecr")
    end
  end

  def delete
    session.delete(:user_id)
    flash[:info] = "Logged out. See ya later!"
    redirect_to "/"
  end
end
`,

    'src/controllers/user_controller.cr': `class UserController < ApplicationController
  getter user = User.new

  before_action do
    only [:show, :edit, :update, :destroy] { set_user }
  end

  def show
    render("show.ecr")
  end

  def new
    render "new.ecr"
  end

  def edit
    render("edit.ecr")
  end

  def create
    user = User.new user_params.validate!
    pass = user_params.validate!["password"]
    user.password = pass if pass

    if user.save
      session[:user_id] = user.id
      redirect_to "/", flash: {"success" => "Created User successfully."}
    else
      flash[:danger] = "Could not create User!"
      render "new.ecr"
    end
  end

  def update
    user.set_attributes user_params.validate!
    if user.save
      redirect_to "/", flash: {"success" => "User has been updated."}
    else
      flash[:danger] = "Could not update User!"
      render "edit.ecr"
    end
  end

  def destroy
    user.destroy
    redirect_to "/", flash: {"success" => "User has been deleted."}
  end

  private def user_params
    params.validation do
      required :email
      optional :password
    end
  end

  private def set_user
    @user = current_user.not_nil!
  end
end
`,

    'src/locales/en.yml': `---
welcome_to_amber: "Welcome to Amber Framework!"
`,

    'src/mailers/application_mailer.cr': `require "quartz_mailer"

class ApplicationMailer < Quartz::Composer
  def sender
    address name: "Email Sender", email: "from@example.com"
  end
end
`,

    'src/models/product.cr': `class Product < Granite::Base
  connection pg
  table products

  column id : Int64, primary: true
  column name : String?
  column description : String?
  column price : Float64?
  column stock : Int32?
  timestamps
end
`,

    'src/models/user.cr': `require "crypto/bcrypt/password"

class User < Granite::Base
  include Crypto
  connection pg
  table users

  column id : Int64, primary: true
  column email : String?
  column hashed_password : String?
  timestamps

  validate :email, "is required", ->(user : User) do
    (email = user.email) ? !email.empty? : false
  end

  validate :email, "already in use", ->(user : User) do
    existing = User.find_by email: user.email
    !existing || existing.id == user.id
  end

  validate :password, "is too short", ->(user : User) do
    user.password_changed? ? user.valid_password_size? : true
  end

  def password=(password)
    @new_password = password
    @hashed_password = Bcrypt::Password.create(password, cost: 10).to_s
  end

  def password
    (hash = hashed_password) ? Bcrypt::Password.new(hash) : nil
  end

  def password_changed?
    new_password ? true : false
  end

  def valid_password_size?
    (pass = new_password) ? pass.size >= 8 : false
  end

  def authenticate(password : String)
    (bcrypt_pass = self.password) ? bcrypt_pass.verify(password) : false
  end

  private getter new_password : String?
end
`,

    'src/pipes/authenticate.cr': `class HTTP::Server::Context
  property current_user : User?
end

class CurrentUser < Amber::Pipe::Base
  def call(context)
    user_id = context.session["user_id"]?
    if user = User.find user_id
      context.current_user = user
    end
    call_next(context)
  end
end

class Authenticate < Amber::Pipe::Base
  def call(context)
    if context.current_user
      call_next(context)
    else
      context.flash[:warning] = "Please Sign In"
      context.response.headers.add "Location", "/signin"
      context.response.status_code = 302
    end
  end
end
`,

    'src/server.cr': `require "../config/application"

Amber::Support::ClientReload.new if Amber.settings.auto_reload?
Amber::Server.start
`,

    'src/sockets/app_socket.cr': `struct AppSocket < Amber::WebSockets::ClientSocket
  channel "chat:*", ChatChannel

  def on_connect
    # Do authentication here (the session and cookies are available).
    # Returning false closes the socket.
    true
  end
end
`,

    'src/views/home/index.ecr': `<div class="row justify-content-center">
  <div class="col-sm-12 col-md-6">
    <h2><%= t "welcome_to_amber" %></h2>
    <p>Thank you for trying out the Amber Framework.  We are working hard to provide a super fast and reliable framework that provides all the productivity tools you are used to without sacrificing the speed.</p>
    <div class="list-group">
      <a class="list-group-item list-group-item-action" target="_blank" href="https://docs.amberframework.org">Getting Started with Amber Framework</a>
      <a class="list-group-item list-group-item-action" target="_blank" href="https://github.com/veelenga/awesome-crystal">List of Awesome Crystal Projects and shards</a>
      <a class="list-group-item list-group-item-action" target="_blank" href="https://discord.gg/vwvP5zakSn">Join the Amber Discord!</a>
    </div>
  </div>
</div>
`,

    'src/views/layouts/_nav.ecr': `<%- active = context.request.path == "/" ? "active" : "" %>
<li class="nav-item <%= active %>">
  <a href="/" class="nav-link">Home</a>
</li>
`,

    'src/views/layouts/_session.ecr': `<%- if (current_user = context.current_user) %>
  <%- active = context.request.path == "/profile" ? "active" : "" %>
  <li class="nav-item <%= active %>">
    <a class="nav-link" href="/profile"><%= current_user.email %></a>
  </li>
  <li class="nav-item">
    <a class="nav-link" href="/signout">Sign Out</a>
  </li>
<%- else %>
  <%- active = context.request.path == "/signin" ? "active" : "" %>
  <li class="nav-item <%= active %>">
    <a class="nav-link" href="/signin">Sign In</a>
  </li>
  <%- active = context.request.path == "/signup" ? "active" : "" %>
  <li class="nav-item <%= active %>">
    <a class="nav-link" href="/signup">Sign Up</a>
  </li>
<%- end %>
`,

    'src/views/layouts/application.ecr': `<!doctype html>
<html>
  <head>
    <title>{{projectName}} using Amber</title>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="/css/main.css" />
  </head>
  <body>
    <nav class="navbar navbar-expand navbar-dark bg-primary mb-3">
      <div class="container">
        <a href="/" class="navbar-brand">
          <img src="/img/logo.svg" height="30" alt="Amber logo">
        </a>
        <ul class="navbar-nav mr-auto">
          <%= render(partial: "layouts/_nav.ecr") %>
        </ul>
        <ul class="navbar-nav">
          <%= render(partial: "layouts/_session.ecr") %>
        </ul>
      </div>
    </nav>

    <div class="container">
      <%- flash.each do |key, value| %>
        <div class="alert alert-<%= key %>" role="alert">
          <%= flash[key] %>
        </div>
      <%- end %>

      <div class="main">
        <%= content %>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"></script>

    <script type="module" src="/js/amber.js"></script>
    <%- if Amber.settings.auto_reload? -%><script src="/js/client_reload.js"></script><%- end -%>
  </body>
</html>
`,

    'src/views/layouts/mailer.ecr': `<html>
  <head>
  </head>
  <body>
    <table>
      <tr>
      <td><%= content %></td>
      </tr>
    </table>
  </body>
</html>
`,

    'src/views/session/new.ecr': `<h1>Sign In</h1>

<%- if user.errors %>
  <ul class="errors">
  <%- user.errors.each do |error| %>
    <li><%= error.to_s %></li>
  <%- end %>
  </ul>
<%- end %>

<form action="/session" method="post">
  <%= csrf_tag %>
  <div class="form-group">
    <input class="form-control" type="email" name="email" placeholder="Email"/>
  </div>
  <div class="form-group">
    <input class="form-control" type="password" name="password" placeholder="Password"/>
  </div>
  <button class="btn btn-success btn-sm" type="submit">Sign In</button>
</form>
<hr/>
<%= link_to("Don't have an account yet?", "/signup") -%>
`,

    'src/views/user/edit.ecr': `<h1>Edit Profile</h1>

<%- if user.errors %>
  <ul class="errors">
  <%- user.errors.each do |error| %>
    <li><%= error.to_s %></li>
  <%- end %>
  </ul>
<%- end %>

<form action="/profile" method="post">
  <%= csrf_tag %>
  <input type="hidden" name="_method" value="patch" />

  <div class="form-group">
    <input class="form-control" type="email" name="email" placeholder="Email" value="<%= user.email %>" />
  </div>
  <%= submit("Update", class: "btn btn-success btn-sm") %>
  <%= link_to("Profile", "/profile", class: "btn btn-light btn-sm") %>
</form>
`,

    'src/views/user/new.ecr': `<h1>Sign Up</h1>

<%- if user %>
  <%- if user.errors %>
    <ul class="errors">
    <%- user.errors.each do |error| %>
      <li><%= error.to_s %></li>
    <%- end %>
    </ul>
  <%- end %>
<%- end %>

<form action="/registration" method="post">
  <%= csrf_tag %>
  <div class="form-group">
    <input class="form-control" type="email" name="email" placeholder="Email"/>
  </div>
  <div class="form-group">
    <input class="form-control" type="password" name="password" placeholder="Password"/>
  </div>
  <button class="btn btn-success btn-sm" type="submit">Register</button>
</form>
<hr/>
<%= link_to("Already have an account?", "/signin") -%>
`,

    'src/views/user/show.ecr': `<h1>Profile</h1>
<p>
  <%= user.email %>
  <%= link_to("Edit", "/profile/edit", class: "btn btn-success btn-sm") %>
</p>
`,
  }
};
