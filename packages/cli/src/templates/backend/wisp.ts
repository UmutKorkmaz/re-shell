import { BackendTemplate } from '../types';

export const wispTemplate: BackendTemplate = {
  id: 'wisp',
  name: 'Wisp',
  description: 'Gleam web framework for building type-safe HTTP services on BEAM',
  version: '1.0.0',
  framework: 'wisp',
  displayName: 'Wisp (Gleam)',
  language: 'gleam',
  port: 8000,
  tags: ['gleam', 'wisp', 'web', 'api', 'rest', 'beam', 'erlang', 'functional'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation'],
  dependencies: {
    gleam_stdlib: '>= 1.0.0 and < 2.0.0',
    gleam_http: '>= 4.0.0 and < 5.0.0',
    gleam_json: '>= 3.0.0 and < 4.0.0',
    gleam_crypto: '>= 1.5.0 and < 2.0.0',
    gleam_erlang: '>= 1.0.0 and < 2.0.0',
    mist: '>= 6.0.0 and < 7.0.0',
    wisp: '>= 2.2.0 and < 3.0.0'
  },
  devDependencies: {
    gleeunit: '>= 1.0.0 and < 2.0.0'
  },
  files: {
    'gleam.toml': `name = "{{projectNameSnake}}"
version = "0.1.0"
description = "{{description}}"
target = "erlang"
# The current gleam_stdlib, gleam_json and gleeunit releases need Gleam 1.14 or later.
gleam = ">= 1.14.0"

[dependencies]
gleam_stdlib = ">= 1.0.0 and < 2.0.0"
gleam_http = ">= 4.0.0 and < 5.0.0"
gleam_json = ">= 3.0.0 and < 4.0.0"
gleam_crypto = ">= 1.5.0 and < 2.0.0"
gleam_erlang = ">= 1.0.0 and < 2.0.0"
mist = ">= 6.0.0 and < 7.0.0"
wisp = ">= 2.2.0 and < 3.0.0"

[dev-dependencies]
gleeunit = ">= 1.0.0 and < 2.0.0"
`,

    // Erlang FFI: ETS tables for the in-memory data, environment variables and the clock
    'src/{{projectNameSnake}}_ffi.erl': `-module({{projectNameSnake}}_ffi).
-export([init/0, insert/3, insert_new/3, lookup/2, values/1, delete/2, next_id/1, getenv/1, now_seconds/0]).

-define(TABLES, [users, emails, items, counters]).

%% Creates the ETS tables in a long-lived owner process (a table is deleted
%% when the process that created it exits). Safe to call more than once.
init() ->
    case ets:whereis(users) of
        undefined ->
            Parent = self(),
            Ref = make_ref(),
            spawn(fun() ->
                lists:foreach(
                    fun(Table) ->
                        try
                            ets:new(Table, [named_table, public, set])
                        catch
                            error:badarg -> ok
                        end
                    end,
                    ?TABLES
                ),
                Parent ! {Ref, ready},
                receive
                    stop -> ok
                end
            end),
            receive
                {Ref, ready} -> nil
            end;
        _ ->
            nil
    end.

table(Name) -> binary_to_existing_atom(Name, utf8).

insert(Table, Key, Value) ->
    ets:insert(table(Table), {Key, Value}),
    nil.

insert_new(Table, Key, Value) ->
    ets:insert_new(table(Table), {Key, Value}).

lookup(Table, Key) ->
    case ets:lookup(table(Table), Key) of
        [{_, Value}] -> {ok, Value};
        [] -> {error, nil}
    end.

values(Table) ->
    [Value || {_, Value} <- ets:tab2list(table(Table))].

delete(Table, Key) ->
    ets:delete(table(Table), Key),
    nil.

next_id(Name) ->
    ets:update_counter(counters, Name, 1, {Name, 0}).

getenv(Name) ->
    case os:getenv(binary_to_list(Name)) of
        false -> {error, nil};
        Value -> {ok, unicode:characters_to_binary(Value)}
    end.

now_seconds() ->
    erlang:system_time(second).
`,

    'src/{{projectNameSnake}}.gleam': `import gleam/erlang/process
import mist
import wisp
import wisp/wisp_mist

import {{projectNameSnake}}/config
import {{projectNameSnake}}/router
import {{projectNameSnake}}/store

pub fn main() -> Nil {
  wisp.configure_logger()
  store.init()

  // Mist listens on localhost unless told otherwise; bind every interface so
  // the server is reachable from outside a container. Mist logs the address.
  let assert Ok(_) =
    wisp_mist.handler(router.handle_request, config.secret_key_base())
    |> mist.new
    |> mist.bind("0.0.0.0")
    |> mist.port(config.port())
    |> mist.start

  process.sleep_forever()
}
`,

    'src/{{projectNameSnake}}/config.gleam': `import gleam/int
import gleam/result

@external(erlang, "{{projectNameSnake}}_ffi", "getenv")
fn getenv(name: String) -> Result(String, Nil)

pub fn port() -> Int {
  getenv("PORT")
  |> result.try(int.parse)
  |> result.unwrap(8000)
}

/// Signs cookies and bearer tokens. Set SECRET_KEY_BASE in production; the
/// fallback is a development-only value.
pub fn secret_key_base() -> String {
  getenv("SECRET_KEY_BASE")
  |> result.unwrap(
    "development-only-secret-key-base-change-me-in-production-0123456789abcdef",
  )
}
`,

    'src/{{projectNameSnake}}/router.gleam': `import gleam/http.{Get}
import gleam/json
import wisp.{type Request, type Response}

import {{projectNameSnake}}/handlers/auth
import {{projectNameSnake}}/handlers/health
import {{projectNameSnake}}/handlers/items
import {{projectNameSnake}}/handlers/users
import {{projectNameSnake}}/middleware
import {{projectNameSnake}}/web

pub fn handle_request(req: Request) -> Response {
  use req <- middleware.apply(req)

  case wisp.path_segments(req) {
    [] -> root(req)
    ["health"] -> health.handle(req)

    ["api", "auth", "register"] -> auth.register(req)
    ["api", "auth", "login"] -> auth.login(req)

    ["api", "users", "me"] -> users.me(req)
    ["api", "users"] -> users.index(req)
    ["api", "users", id] -> users.show(req, id)

    ["api", "items"] -> items.collection(req)
    ["api", "items", id] -> items.member(req, id)

    _ -> web.error(404, "not_found", "Not found")
  }
}

fn root(req: Request) -> Response {
  case req.method {
    Get ->
      web.json_response(
        json.object([
          #("name", json.string("{{projectName}}")),
          #("version", json.string("0.1.0")),
          #("framework", json.string("Wisp")),
          #("language", json.string("Gleam")),
        ]),
        200,
      )
    _ -> wisp.method_not_allowed([Get])
  }
}
`,

    'src/{{projectNameSnake}}/middleware.gleam': `import gleam/http.{Options}
import gleam/http/response
import wisp.{type Request, type Response}

/// Request logging, crash recovery and CORS, applied to every request.
pub fn apply(req: Request, next: fn(Request) -> Response) -> Response {
  use <- wisp.log_request(req)
  use <- wisp.rescue_crashes

  let resp = case req.method {
    // Answer CORS pre-flight requests directly.
    Options -> wisp.response(204)
    _ -> next(req)
  }

  cors(resp)
}

fn cors(resp: Response) -> Response {
  resp
  |> response.set_header("access-control-allow-origin", "*")
  |> response.set_header(
    "access-control-allow-methods",
    "GET, POST, DELETE, OPTIONS",
  )
  |> response.set_header(
    "access-control-allow-headers",
    "content-type, authorization",
  )
}
`,

    'src/{{projectNameSnake}}/web.gleam': `import gleam/http/request
import gleam/http/response
import gleam/json.{type Json}
import gleam/result
import wisp.{type Request, type Response}

import {{projectNameSnake}}/accounts
import {{projectNameSnake}}/auth_token
import {{projectNameSnake}}/config
import {{projectNameSnake}}/store.{type Item, type User}

pub fn json_response(body: Json, status: Int) -> Response {
  wisp.response(status)
  |> response.set_header("content-type", "application/json; charset=utf-8")
  |> wisp.string_body(json.to_string(body))
}

pub fn error(status: Int, code: String, message: String) -> Response {
  json_response(
    json.object([
      #("error", json.string(code)),
      #("message", json.string(message)),
    ]),
    status,
  )
}

pub fn unauthorized() -> Response {
  error(401, "unauthorized", "Authentication required")
}

pub fn user_json(user: User) -> Json {
  json.object([
    #("id", json.int(user.id)),
    #("email", json.string(user.email)),
    #("name", json.string(user.name)),
  ])
}

pub fn item_json(item: Item) -> Json {
  json.object([
    #("id", json.int(item.id)),
    #("name", json.string(item.name)),
    #("description", json.string(item.description)),
    #("user_id", json.int(item.user_id)),
  ])
}

/// The user a request's "Authorization: Bearer <token>" header belongs to.
pub fn current_user(req: Request) -> Result(User, Nil) {
  use header <- result.try(request.get_header(req, "authorization"))
  case header {
    "Bearer " <> bearer -> {
      use user_id <- result.try(auth_token.verify(
        bearer,
        config.secret_key_base(),
      ))
      accounts.find_user(user_id)
    }
    _ -> Error(Nil)
  }
}
`,

    'src/{{projectNameSnake}}/store.gleam': `import gleam/int
import gleam/list
import gleam/result

/// An account. The password is stored as a salted, iterated SHA-256 digest.
pub type User {
  User(
    id: Int,
    email: String,
    name: String,
    salt: BitArray,
    password_hash: BitArray,
  )
}

pub type Item {
  Item(id: Int, name: String, description: String, user_id: Int)
}

// The data lives in ETS tables created by the Erlang FFI module, so it is
// shared by every request process. Swap this module for a database client
// (for example pog + PostgreSQL) in a real application.

@external(erlang, "{{projectNameSnake}}_ffi", "init")
pub fn init() -> Nil

@external(erlang, "{{projectNameSnake}}_ffi", "now_seconds")
pub fn now_seconds() -> Int

@external(erlang, "{{projectNameSnake}}_ffi", "insert")
fn insert(table: String, key: k, value: v) -> Nil

@external(erlang, "{{projectNameSnake}}_ffi", "insert_new")
fn insert_new(table: String, key: k, value: v) -> Bool

@external(erlang, "{{projectNameSnake}}_ffi", "lookup")
fn lookup(table: String, key: k) -> Result(v, Nil)

@external(erlang, "{{projectNameSnake}}_ffi", "values")
fn values(table: String) -> List(v)

@external(erlang, "{{projectNameSnake}}_ffi", "delete")
fn delete(table: String, key: k) -> Nil

@external(erlang, "{{projectNameSnake}}_ffi", "next_id")
fn next_id(name: String) -> Int

// Users

pub fn new_user_id() -> Int {
  next_id("users")
}

/// Claims an email address for a user id; False when it is already taken.
pub fn reserve_email(email: String, user_id: Int) -> Bool {
  insert_new("emails", email, user_id)
}

pub fn insert_user(user: User) -> Nil {
  insert("users", user.id, user)
}

pub fn get_user(id: Int) -> Result(User, Nil) {
  lookup("users", id)
}

pub fn get_user_by_email(email: String) -> Result(User, Nil) {
  use id <- result.try(lookup("emails", email))
  get_user(id)
}

pub fn all_users() -> List(User) {
  values("users")
  |> list.sort(fn(a: User, b: User) { int.compare(a.id, b.id) })
}

// Items

pub fn create_item(name: String, description: String, user_id: Int) -> Item {
  let item =
    Item(
      id: next_id("items"),
      name: name,
      description: description,
      user_id: user_id,
    )
  insert("items", item.id, item)
  item
}

pub fn get_item(id: Int) -> Result(Item, Nil) {
  lookup("items", id)
}

pub fn items_for_user(user_id: Int) -> List(Item) {
  values("items")
  |> list.filter(fn(item: Item) { item.user_id == user_id })
  |> list.sort(fn(a: Item, b: Item) { int.compare(a.id, b.id) })
}

pub fn delete_item(id: Int) -> Nil {
  delete("items", id)
}
`,

    'src/{{projectNameSnake}}/accounts.gleam': `import gleam/bit_array
import gleam/crypto
import gleam/string

import {{projectNameSnake}}/store.{type User, User}

pub type RegisterError {
  EmailTaken
  InvalidInput
}

const hash_rounds = 20_000

pub fn register(
  email: String,
  name: String,
  password: String,
) -> Result(User, RegisterError) {
  let email = normalize(email)
  case valid_input(email, name, password) {
    False -> Error(InvalidInput)
    True -> {
      let id = store.new_user_id()
      case store.reserve_email(email, id) {
        False -> Error(EmailTaken)
        True -> {
          let salt = crypto.strong_random_bytes(16)
          let user =
            User(
              id: id,
              email: email,
              name: string.trim(name),
              salt: salt,
              password_hash: hash_password(password, salt),
            )
          store.insert_user(user)
          Ok(user)
        }
      }
    }
  }
}

/// Checks an email and password; the same error for an unknown email and a
/// wrong password.
pub fn authenticate(email: String, password: String) -> Result(User, Nil) {
  case store.get_user_by_email(normalize(email)) {
    Ok(user) ->
      case
        crypto.secure_compare(
          user.password_hash,
          hash_password(password, user.salt),
        )
      {
        True -> Ok(user)
        False -> Error(Nil)
      }
    Error(Nil) -> Error(Nil)
  }
}

pub fn find_user(id: Int) -> Result(User, Nil) {
  store.get_user(id)
}

fn normalize(email: String) -> String {
  email |> string.trim |> string.lowercase
}

fn valid_input(email: String, name: String, password: String) -> Bool {
  string.contains(email, "@")
  && string.trim(name) != ""
  && string.length(password) >= 8
}

// Salted and iterated SHA-256. Fine for a template; use a memory-hard
// function such as argon2id (via an Erlang/Elixir library) in production.
fn hash_password(password: String, salt: BitArray) -> BitArray {
  stretch(bit_array.from_string(password), salt, hash_rounds)
}

fn stretch(digest: BitArray, salt: BitArray, remaining: Int) -> BitArray {
  case remaining <= 0 {
    True -> digest
    False ->
      stretch(
        crypto.hash(crypto.Sha256, bit_array.concat([salt, digest])),
        salt,
        remaining - 1,
      )
  }
}
`,

    'src/{{projectNameSnake}}/auth_token.gleam': `import gleam/bit_array
import gleam/crypto
import gleam/int
import gleam/result
import gleam/string

import {{projectNameSnake}}/store

// Tokens are valid for one day.
const lifetime_seconds = 86_400

/// A signed bearer token "<user id>:<expiry>" and its expiry (unix seconds).
pub fn issue(user_id: Int, secret: String) -> #(String, Int) {
  let expires_at = store.now_seconds() + lifetime_seconds
  let payload = int.to_string(user_id) <> ":" <> int.to_string(expires_at)
  let token =
    crypto.sign_message(
      bit_array.from_string(payload),
      bit_array.from_string(secret),
      crypto.Sha256,
    )
  #(token, expires_at)
}

/// The user id inside a token, if the signature is valid and it has not expired.
pub fn verify(token: String, secret: String) -> Result(Int, Nil) {
  use signed <- result.try(crypto.verify_signed_message(
    token,
    bit_array.from_string(secret),
  ))
  use payload <- result.try(bit_array.to_string(signed))
  case string.split(payload, ":") {
    [user_id, expires_at] -> {
      use user_id <- result.try(int.parse(user_id))
      use expires_at <- result.try(int.parse(expires_at))
      case expires_at > store.now_seconds() {
        True -> Ok(user_id)
        False -> Error(Nil)
      }
    }
    _ -> Error(Nil)
  }
}
`,

    'src/{{projectNameSnake}}/handlers/health.gleam': `import gleam/http.{Get}
import gleam/json
import wisp.{type Request, type Response}

import {{projectNameSnake}}/store
import {{projectNameSnake}}/web

pub fn handle(req: Request) -> Response {
  case req.method {
    Get ->
      web.json_response(
        json.object([
          #("status", json.string("healthy")),
          #("timestamp", json.int(store.now_seconds())),
        ]),
        200,
      )
    _ -> wisp.method_not_allowed([Get])
  }
}
`,

    'src/{{projectNameSnake}}/handlers/auth.gleam': `import gleam/dynamic/decode
import gleam/http.{Post}
import gleam/json
import wisp.{type Request, type Response}

import {{projectNameSnake}}/accounts
import {{projectNameSnake}}/auth_token
import {{projectNameSnake}}/config
import {{projectNameSnake}}/store.{type User}
import {{projectNameSnake}}/web

pub fn register(req: Request) -> Response {
  case req.method {
    Post -> handle_register(req)
    _ -> wisp.method_not_allowed([Post])
  }
}

pub fn login(req: Request) -> Response {
  case req.method {
    Post -> handle_login(req)
    _ -> wisp.method_not_allowed([Post])
  }
}

type Registration {
  Registration(email: String, name: String, password: String)
}

type Credentials {
  Credentials(email: String, password: String)
}

fn handle_register(req: Request) -> Response {
  use body <- wisp.require_json(req)

  let decoder = {
    use email <- decode.field("email", decode.string)
    use name <- decode.field("name", decode.string)
    use password <- decode.field("password", decode.string)
    decode.success(Registration(email: email, name: name, password: password))
  }

  case decode.run(body, decoder) {
    Error(_) ->
      web.error(
        400,
        "validation_error",
        "email, name and password are required",
      )
    Ok(registration) ->
      case
        accounts.register(
          registration.email,
          registration.name,
          registration.password,
        )
      {
        Ok(user) -> token_response(user, 201)
        Error(accounts.EmailTaken) ->
          web.error(409, "conflict", "A user with this email already exists")
        Error(accounts.InvalidInput) ->
          web.error(
            422,
            "validation_error",
            "A valid email, a name and a password of at least 8 characters are required",
          )
      }
  }
}

fn handle_login(req: Request) -> Response {
  use body <- wisp.require_json(req)

  let decoder = {
    use email <- decode.field("email", decode.string)
    use password <- decode.field("password", decode.string)
    decode.success(Credentials(email: email, password: password))
  }

  case decode.run(body, decoder) {
    Error(_) ->
      web.error(400, "validation_error", "email and password are required")
    Ok(credentials) ->
      case accounts.authenticate(credentials.email, credentials.password) {
        Ok(user) -> token_response(user, 200)
        Error(_) ->
          web.error(401, "unauthorized", "Invalid email or password")
      }
  }
}

fn token_response(user: User, status: Int) -> Response {
  let #(token, expires_at) = auth_token.issue(user.id, config.secret_key_base())
  web.json_response(
    json.object([
      #("token", json.string(token)),
      #("expires_at", json.int(expires_at)),
      #("user", web.user_json(user)),
    ]),
    status,
  )
}
`,

    'src/{{projectNameSnake}}/handlers/users.gleam': `import gleam/http.{Get}
import gleam/int
import gleam/json
import wisp.{type Request, type Response}

import {{projectNameSnake}}/accounts
import {{projectNameSnake}}/store
import {{projectNameSnake}}/web

pub fn me(req: Request) -> Response {
  case req.method {
    Get ->
      case web.current_user(req) {
        Ok(user) -> web.json_response(web.user_json(user), 200)
        Error(_) -> web.unauthorized()
      }
    _ -> wisp.method_not_allowed([Get])
  }
}

pub fn index(req: Request) -> Response {
  case req.method {
    Get ->
      case web.current_user(req) {
        Ok(_) ->
          web.json_response(
            json.array(store.all_users(), web.user_json),
            200,
          )
        Error(_) -> web.unauthorized()
      }
    _ -> wisp.method_not_allowed([Get])
  }
}

pub fn show(req: Request, id: String) -> Response {
  case req.method {
    Get ->
      case web.current_user(req) {
        Error(_) -> web.unauthorized()
        Ok(_) ->
          case int.parse(id) {
            Error(_) -> web.error(400, "bad_request", "Invalid user id")
            Ok(user_id) ->
              case accounts.find_user(user_id) {
                Ok(user) -> web.json_response(web.user_json(user), 200)
                Error(_) -> web.error(404, "not_found", "User not found")
              }
          }
      }
    _ -> wisp.method_not_allowed([Get])
  }
}
`,

    'src/{{projectNameSnake}}/handlers/items.gleam': `import gleam/dynamic/decode
import gleam/http.{Delete, Get, Post}
import gleam/int
import gleam/json
import wisp.{type Request, type Response}

import {{projectNameSnake}}/store.{type User}
import {{projectNameSnake}}/web

/// /api/items
pub fn collection(req: Request) -> Response {
  case req.method {
    Get -> with_user(req, list_items)
    Post -> with_user(req, fn(user) { create_item(req, user) })
    _ -> wisp.method_not_allowed([Get, Post])
  }
}

/// /api/items/:id
pub fn member(req: Request, id: String) -> Response {
  case req.method {
    Get -> with_user(req, fn(user) { with_item(id, user, show_item) })
    Delete -> with_user(req, fn(user) { with_item(id, user, delete_item) })
    _ -> wisp.method_not_allowed([Get, Delete])
  }
}

fn with_user(req: Request, next: fn(User) -> Response) -> Response {
  case web.current_user(req) {
    Ok(user) -> next(user)
    Error(_) -> web.unauthorized()
  }
}

// Looks an item up by its path segment; items are private to their owner, so
// someone else's item is reported as not found.
fn with_item(
  id: String,
  user: User,
  next: fn(store.Item) -> Response,
) -> Response {
  case int.parse(id) {
    Error(_) -> web.error(400, "bad_request", "Invalid item id")
    Ok(item_id) ->
      case store.get_item(item_id) {
        Ok(item) ->
          case item.user_id == user.id {
            True -> next(item)
            False -> web.error(404, "not_found", "Item not found")
          }
        Error(_) -> web.error(404, "not_found", "Item not found")
      }
  }
}

fn list_items(user: User) -> Response {
  web.json_response(json.array(store.items_for_user(user.id), web.item_json), 200)
}

fn create_item(req: Request, user: User) -> Response {
  use body <- wisp.require_json(req)

  let decoder = {
    use name <- decode.field("name", decode.string)
    use description <- decode.optional_field("description", "", decode.string)
    decode.success(#(name, description))
  }

  case decode.run(body, decoder) {
    Ok(#(name, description)) ->
      case name {
        "" -> web.error(422, "validation_error", "name must not be empty")
        _ -> {
          let item = store.create_item(name, description, user.id)
          web.json_response(web.item_json(item), 201)
        }
      }
    Error(_) -> web.error(400, "validation_error", "name is required")
  }
}

fn show_item(item: store.Item) -> Response {
  web.json_response(web.item_json(item), 200)
}

fn delete_item(item: store.Item) -> Response {
  store.delete_item(item.id)
  wisp.response(204)
}
`,

    'test/{{projectNameSnake}}_test.gleam': `import gleam/http
import gleam/http/request
import gleeunit
import wisp/simulate

import {{projectNameSnake}}/accounts
import {{projectNameSnake}}/auth_token
import {{projectNameSnake}}/config
import {{projectNameSnake}}/router
import {{projectNameSnake}}/store

pub fn main() -> Nil {
  store.init()
  gleeunit.main()
}

pub fn health_test() {
  let response = router.handle_request(simulate.request(http.Get, "/health"))
  assert response.status == 200
}

pub fn unknown_route_test() {
  let response = router.handle_request(simulate.request(http.Get, "/nope"))
  assert response.status == 404
}

pub fn protected_route_requires_a_token_test() {
  let response =
    router.handle_request(simulate.request(http.Get, "/api/users/me"))
  assert response.status == 401
}

pub fn register_and_authenticate_test() {
  let assert Ok(user) =
    accounts.register("ann@example.com", "Ann", "correct horse")
  assert user.email == "ann@example.com"

  assert accounts.register("Ann@Example.com", "Ann", "correct horse")
    == Error(accounts.EmailTaken)
  assert accounts.register("short@example.com", "Shorty", "short")
    == Error(accounts.InvalidInput)

  let assert Ok(found) = accounts.authenticate("ann@example.com", "correct horse")
  assert found.id == user.id
  assert accounts.authenticate("ann@example.com", "wrong password") == Error(Nil)
  assert accounts.authenticate("nobody@example.com", "correct horse") == Error(Nil)
}

pub fn token_round_trip_test() {
  let #(token, _expires_at) = auth_token.issue(42, "secret")
  assert auth_token.verify(token, "secret") == Ok(42)
  assert auth_token.verify(token, "another secret") == Error(Nil)
  assert auth_token.verify("not a token", "secret") == Error(Nil)
}

pub fn bearer_token_grants_access_test() {
  let assert Ok(user) =
    accounts.register("bob@example.com", "Bob", "battery staple")
  let #(token, _expires_at) =
    auth_token.issue(user.id, config.secret_key_base())

  let response =
    simulate.request(http.Get, "/api/users/me")
    |> request.set_header("authorization", "Bearer " <> token)
    |> router.handle_request
  assert response.status == 200

  let _item = store.create_item("Notebook", "", user.id)
  let response =
    simulate.request(http.Get, "/api/items")
    |> request.set_header("authorization", "Bearer " <> token)
    |> router.handle_request
  assert response.status == 200
}
`,

    '.env.example': `# Environment configuration (the app reads these from the process environment)
PORT=8000
SECRET_KEY_BASE=replace-with-a-long-random-string-of-at-least-64-characters
`,

    '.gitignore': `# Gleam build artifacts
/build/
erl_crash.dump

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

# Logs
*.log
logs/
`,

    'Dockerfile': `# The runtime stage uses the same image as the build stage so the Erlang/OTP
# release that compiled the BEAM files is the one that runs them.
ARG GLEAM_IMAGE=ghcr.io/gleam-lang/gleam:v1.14.0-erlang-alpine

# Build stage
FROM \${GLEAM_IMAGE} AS builder

WORKDIR /app
COPY . .
RUN gleam export erlang-shipment

# Runtime stage
FROM \${GLEAM_IMAGE}

WORKDIR /app
COPY --from=builder /app/build/erlang-shipment ./

RUN adduser -D -g '' appuser
USER appuser

EXPOSE 8000
ENV PORT=8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["run"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - SECRET_KEY_BASE=\${SECRET_KEY_BASE:?set SECRET_KEY_BASE}
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

{{description}}

A Gleam web application built with the Wisp framework (served by Mist), running on the BEAM.

## Features

- Type-safe routing, request logging, crash recovery and CORS
- Signed bearer-token authentication (expires after 24 hours)
- REST API with JSON validation (\`gleam/dynamic/decode\`)
- In-memory data in ETS tables (replace \`store.gleam\` with a database client)
- Tests with gleeunit and \`wisp/simulate\`
- Docker support

## Requirements

- Gleam >= 1.14
- Erlang/OTP 27+ (\`gleam_json\` uses the \`json\` module added in OTP 27)
- rebar3 (Gleam uses it to compile the Erlang dependencies)

## Getting started

\`\`\`bash
gleam deps download
gleam test
gleam run   # http://localhost:8000
\`\`\`

Set \`SECRET_KEY_BASE\` (64+ random characters) and optionally \`PORT\` in the environment.
Without \`SECRET_KEY_BASE\` a development-only key is used.

## API Endpoints

### Public

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register (\`email\`, \`name\`, \`password\` of 8+ characters); returns a token
- \`POST /api/auth/login\` - Login (\`email\`, \`password\`); returns a token

### Protected (\`Authorization: Bearer <token>\`)

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
docker run -p 8000:8000 -e SECRET_KEY_BASE=change-me {{projectName}}
\`\`\`

## License

MIT
`
  },
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-wisp-app'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A Gleam web application built with Wisp'
    }
  ],
  postInstall: [
    'gleam deps download',
    'echo "{{projectName}} is ready!"',
    'echo "Run: gleam run"'
  ]
};
