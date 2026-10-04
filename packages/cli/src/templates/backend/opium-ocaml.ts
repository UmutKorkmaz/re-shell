import { BackendTemplate } from '../types';

// Opium (OCaml) backend. The HTTP API lives in lib/api.ml as plain functions from request
// pieces to (status code, JSON), so it is unit-tested without a server; bin/main.ml only
// routes Opium requests to it. Builds with opam + dune: `opam install --deps-only .`,
// `dune build`, `dune runtest`.
export const opiumOcamlTemplate: BackendTemplate = {
  id: 'opium-ocaml',
  name: 'opium-ocaml',
  displayName: 'Opium (OCaml)',
  description: 'Opium web framework for OCaml: JSON API with bearer-token auth, product CRUD, CORS and an Alcotest suite',
  language: 'ocaml',
  framework: 'opium',
  version: '1.0.0',
  tags: ['ocaml', 'opium', 'lwt', 'dune', 'opam', 'rest-api'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    'dune-project': `(lang dune 3.0)

(name {{projectName}})
`,

    'lib/dune': `(library
 (name app_core)
 (flags
  (:standard -warn-error -a))
 (libraries yojson digestif unix))
`,

    'bin/dune': `(executable
 (name main)
 (flags
  (:standard -warn-error -a))
 (libraries app_core opium lwt))
`,

    'bin/main.ml': `module Api = App_core.Api

(* Turn an Api result (status code + JSON document) into an Opium response. *)
let respond ((code, json) : Api.response) =
  let status = Opium.Status.of_code code in
  if code = 204 then Lwt.return (Opium.Response.of_plain_text ~status "")
  else Lwt.return (Opium.Response.of_json ~status json)

let authorization req = Opium.Request.header "Authorization" req

let port =
  match Sys.getenv_opt "PORT" with
  | Some p -> ( match int_of_string_opt p with Some n -> n | None -> {{port}})
  | None -> {{port}}

let () =
  Api.init ();
  let open Opium in
  App.empty
  |> App.port port
  |> App.middleware Middleware.logger
  |> App.middleware (Middleware.allow_cors ())
  |> App.get "/" (fun _ -> respond (Api.index ()))
  |> App.get "/api/v1/health" (fun _ -> respond (Api.health ()))
  |> App.post "/api/v1/auth/register" (fun req ->
         let open Lwt.Syntax in
         let* body = Request.to_plain_text req in
         respond (Api.register ~body))
  |> App.post "/api/v1/auth/login" (fun req ->
         let open Lwt.Syntax in
         let* body = Request.to_plain_text req in
         respond (Api.login ~body))
  |> App.get "/api/v1/auth/me" (fun req ->
         respond (Api.me ~auth:(authorization req)))
  |> App.get "/api/v1/products" (fun _ -> respond (Api.list_products ()))
  |> App.get "/api/v1/products/:id" (fun req ->
         respond (Api.get_product ~id:(Router.param req "id")))
  |> App.post "/api/v1/products" (fun req ->
         let open Lwt.Syntax in
         let* body = Request.to_plain_text req in
         respond (Api.create_product ~auth:(authorization req) ~body))
  |> App.put "/api/v1/products/:id" (fun req ->
         let open Lwt.Syntax in
         let* body = Request.to_plain_text req in
         respond
           (Api.update_product ~auth:(authorization req)
              ~id:(Router.param req "id") ~body))
  |> App.delete "/api/v1/products/:id" (fun req ->
         respond
           (Api.delete_product ~auth:(authorization req)
              ~id:(Router.param req "id")))
  |> App.run_command
`,

    'Dockerfile': `FROM ocaml/opam:debian-12-ocaml-4.14

WORKDIR /home/opam/app

COPY --chown=opam:opam . .

RUN opam update && opam install --yes --deps-only .

RUN opam exec -- dune build --release

ENV PORT={{port}}
EXPOSE {{port}}

CMD ["./_build/default/bin/main.exe"]
`,

    'README.md': `# {{projectName}}

JSON API built with [Opium](https://github.com/rgrinberg/opium), the Sinatra-like OCaml web framework.

## Layout

\`\`\`
bin/main.ml        Opium routes, middleware and server start-up
lib/api.ml         The API itself (framework independent: status code + JSON)
lib/store.ml       In-memory users, sessions and products
lib/auth.ml        Salted SHA-256 password hashing and bearer tokens
test/test.ml       Alcotest suite for the API
{{projectName}}.opam   Dependencies (opam)
\`\`\`

## Requirements

- opam 2.1+ and OCaml 4.14+ (an opam switch)

## Quick start

\`\`\`bash
# Install the dependencies declared in {{projectName}}.opam
opam install --deps-only .

# Build and test
dune build
dune runtest

# Run (PORT defaults to {{port}})
dune exec ./bin/main.exe
\`\`\`

Open http://localhost:{{port}}.

## API

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | \`/api/v1/health\` | none | Health check |
| POST | \`/api/v1/auth/register\` | none | Register \`{email, name, password}\` (password of at least 8 characters) and receive a token |
| POST | \`/api/v1/auth/login\` | none | Log in \`{email, password}\` and receive a token |
| GET | \`/api/v1/auth/me\` | bearer | Current user |
| GET | \`/api/v1/products\` | none | List products |
| GET | \`/api/v1/products/:id\` | none | Get a product |
| POST | \`/api/v1/products\` | bearer | Create \`{name, price, description?, stock?}\` |
| PUT | \`/api/v1/products/:id\` | bearer | Update any of the product fields |
| DELETE | \`/api/v1/products/:id\` | admin | Delete a product |

Send the token as \`Authorization: Bearer <token>\`. A seeded administrator exists:
\`admin@example.com\` / \`admin123\` (change it before deploying).

\`\`\`bash
TOKEN=$(curl -s -X POST localhost:{{port}}/api/v1/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"admin@example.com","password":"admin123"}' | sed 's/.*"token":"\\([^"]*\\)".*/\\1/')

curl -s -X POST localhost:{{port}}/api/v1/products \\
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"name":"Widget","price":9.5,"stock":3}'
\`\`\`

## Notes

- Storage is in memory and resets on restart. Replace \`lib/store.ml\` with a database
  (for example Caqti with PostgreSQL) behind the same interface.
- Tokens are random bearer tokens held in memory and passwords use salted SHA-256: fine
  for a starting point, but use a memory-hard hash and a real session or JWT layer in production.
- CORS allows any origin (\`Middleware.allow_cors\` in \`bin/main.ml\`); restrict it for production.
- \`App.run_command\` also accepts command-line options such as \`--port\` and \`--debug\`.

## Docker

\`\`\`bash
docker compose up --build
\`\`\`

## License

MIT
`,

    '{{projectName}}.opam': `opam-version: "2.0"
synopsis: "{{projectName}}: web service built with Opium"
description: "A JSON API with authentication and product CRUD on the Opium web framework."
maintainer: ["{{author}}"]
authors: ["{{author}}"]
license: "MIT"
depends: [
  "ocaml" {>= "4.14"}
  "dune" {>= "3.0"}
  "opium" {>= "0.20.0"}
  "lwt"
  "yojson" {>= "1.7.0"}
  "digestif" {>= "1.1.0"}
  "alcotest"
]
build: [
  ["dune" "build" "-p" name "-j" jobs]
]
`,

    'lib/auth.ml': `(* Password hashing and session tokens.

   This is demo-grade: salted SHA-256 and random bearer tokens kept in memory.
   Use a memory-hard password hash (argon2, scrypt) and a real session or JWT
   layer before putting anything like this in production. *)

let rng = lazy (Random.State.make_self_init ())

let random_hex bytes =
  let state = Lazy.force rng in
  String.init (bytes * 2) (fun _ -> "0123456789abcdef".[Random.State.int state 16])

let sha256_hex s = Digestif.SHA256.(to_hex (digest_string s))

(* Stored form: "<salt>$<sha256(salt:password)>" *)
let hash_password ?salt password =
  let salt = match salt with Some s -> s | None -> random_hex 8 in
  salt ^ "$" ^ sha256_hex (salt ^ ":" ^ password)

let verify_password ~stored password =
  match String.index_opt stored '$' with
  | None -> false
  | Some i ->
      let salt = String.sub stored 0 i in
      String.equal stored (hash_password ~salt password)

let new_token () = random_hex 24
`,

    'lib/auth.mli': `(** Password hashing and session tokens (demo-grade, see auth.ml). *)

val hash_password : ?salt:string -> string -> string
val verify_password : stored:string -> string -> bool
val new_token : unit -> string
`,

    'lib/store.ml': `(* In-memory storage. Swap this module for a real database (Caqti, PGOCaml, ...)
   without touching the HTTP layer: Api only talks to the functions below. *)

module User = struct
  type t = {
    id : int;
    email : string;
    name : string;
    role : string;
    password_hash : string;
    created_at : string;
  }
end

module Product = struct
  type t = {
    id : int;
    name : string;
    description : string;
    price : float;
    stock : int;
    created_at : string;
    updated_at : string;
  }
end

let now () =
  let t = Unix.gmtime (Unix.gettimeofday ()) in
  Printf.sprintf "%04d-%02d-%02dT%02d:%02d:%02dZ" (t.Unix.tm_year + 1900)
    (t.Unix.tm_mon + 1) t.Unix.tm_mday t.Unix.tm_hour t.Unix.tm_min t.Unix.tm_sec

let users : (int, User.t) Hashtbl.t = Hashtbl.create 16
let products : (int, Product.t) Hashtbl.t = Hashtbl.create 16
let sessions : (string, int) Hashtbl.t = Hashtbl.create 16
let next_user_id = ref 1
let next_product_id = ref 1

let reset () =
  Hashtbl.reset users;
  Hashtbl.reset products;
  Hashtbl.reset sessions;
  next_user_id := 1;
  next_product_id := 1

(* Users *)

let create_user ~email ~name ~role ~password_hash =
  let id = !next_user_id in
  incr next_user_id;
  let user =
    { User.id; email; name; role; password_hash; created_at = now () }
  in
  Hashtbl.replace users id user;
  user

let find_user_by_email email =
  Hashtbl.fold
    (fun _ (u : User.t) found ->
      if String.equal u.User.email email then Some u else found)
    users None

let open_session (user : User.t) =
  let token = Auth.new_token () in
  Hashtbl.replace sessions token user.User.id;
  token

let user_of_token token =
  match Hashtbl.find_opt sessions token with
  | None -> None
  | Some id -> Hashtbl.find_opt users id

(* Products *)

let create_product ~name ~description ~price ~stock =
  let id = !next_product_id in
  incr next_product_id;
  let at = now () in
  let product =
    { Product.id; name; description; price; stock; created_at = at; updated_at = at }
  in
  Hashtbl.replace products id product;
  product

let list_products () =
  Hashtbl.fold (fun _ p acc -> p :: acc) products []
  |> List.sort (fun (a : Product.t) (b : Product.t) ->
         compare a.Product.id b.Product.id)

let find_product id = Hashtbl.find_opt products id

let update_product id f =
  match Hashtbl.find_opt products id with
  | None -> None
  | Some product ->
      let updated = { (f product) with Product.updated_at = now () } in
      Hashtbl.replace products id updated;
      Some updated

let delete_product id =
  if Hashtbl.mem products id then begin
    Hashtbl.remove products id;
    true
  end
  else false
`,

    'lib/store.mli': `(** In-memory storage for users, sessions and products. *)

module User : sig
  type t = {
    id : int;
    email : string;
    name : string;
    role : string;
    password_hash : string;
    created_at : string;
  }
end

module Product : sig
  type t = {
    id : int;
    name : string;
    description : string;
    price : float;
    stock : int;
    created_at : string;
    updated_at : string;
  }
end

val now : unit -> string
(** Current UTC time as an ISO 8601 string. *)

val reset : unit -> unit

val create_user :
  email:string -> name:string -> role:string -> password_hash:string -> User.t

val find_user_by_email : string -> User.t option
val open_session : User.t -> string
val user_of_token : string -> User.t option

val create_product :
  name:string -> description:string -> price:float -> stock:int -> Product.t

val list_products : unit -> Product.t list
val find_product : int -> Product.t option
val update_product : int -> (Product.t -> Product.t) -> Product.t option
val delete_product : int -> bool
`,

    'lib/api.ml': `(* The HTTP API, independent of the web framework: every endpoint takes the raw
   request pieces it needs (body, Authorization header, path id) and returns a
   status code with a JSON document. The framework layer only does routing and
   turns these results into responses, which keeps the logic unit-testable. *)

type response = int * Yojson.Safe.t

let error code message : response =
  (code, \`Assoc [ ("error", \`String message) ])

(* Seed an administrator and two sample products. *)
let init () =
  Store.reset ();
  ignore
    (Store.create_user ~email:"admin@example.com" ~name:"Admin User"
       ~role:"admin"
       ~password_hash:(Auth.hash_password "admin123"));
  ignore
    (Store.create_product ~name:"Sample Product 1"
       ~description:"This is a sample product" ~price:29.99 ~stock:100);
  ignore
    (Store.create_product ~name:"Sample Product 2"
       ~description:"Another sample product" ~price:49.99 ~stock:50)

(* JSON helpers *)

let user_json (u : Store.User.t) : Yojson.Safe.t =
  \`Assoc
    [
      ("id", \`Int u.Store.User.id);
      ("email", \`String u.Store.User.email);
      ("name", \`String u.Store.User.name);
      ("role", \`String u.Store.User.role);
      ("created_at", \`String u.Store.User.created_at);
    ]

let product_json (p : Store.Product.t) : Yojson.Safe.t =
  \`Assoc
    [
      ("id", \`Int p.Store.Product.id);
      ("name", \`String p.Store.Product.name);
      ("description", \`String p.Store.Product.description);
      ("price", \`Float p.Store.Product.price);
      ("stock", \`Int p.Store.Product.stock);
      ("created_at", \`String p.Store.Product.created_at);
      ("updated_at", \`String p.Store.Product.updated_at);
    ]

let parse_body body : (Yojson.Safe.t, response) result =
  match Yojson.Safe.from_string body with
  | \`Assoc _ as json -> Ok json
  | _ -> Error (error 400 "Request body must be a JSON object")
  | exception Yojson.Json_error _ -> Error (error 400 "Invalid JSON")

let field name (json : Yojson.Safe.t) =
  match json with \`Assoc fields -> List.assoc_opt name fields | _ -> None

let string_field name json =
  match field name json with Some (\`String s) -> Some s | _ -> None

let number_field name json =
  match field name json with
  | Some (\`Float f) -> Some f
  | Some (\`Int i) -> Some (float_of_int i)
  | _ -> None

let int_field name json =
  match field name json with Some (\`Int i) -> Some i | _ -> None

(* Authentication *)

let bearer_token = function
  | Some header
    when String.length header > 7
         && String.lowercase_ascii (String.sub header 0 7) = "bearer " ->
      Some (String.sub header 7 (String.length header - 7))
  | _ -> None

let authenticate auth =
  match bearer_token auth with
  | None -> None
  | Some token -> Store.user_of_token token

let require_user auth =
  match authenticate auth with
  | Some user -> Ok user
  | None -> Error (error 401 "Authentication required")

let require_admin auth =
  match require_user auth with
  | Error _ as e -> e
  | Ok user when String.equal user.Store.User.role "admin" -> Ok user
  | Ok _ -> Error (error 403 "Administrator role required")

let session_response code (user : Store.User.t) : response =
  let token = Store.open_session user in
  (code, \`Assoc [ ("token", \`String token); ("user", user_json user) ])

(* Endpoints *)

let index () : response =
  ( 200,
    \`Assoc
      [
        ("name", \`String "{{projectName}}");
        ("health", \`String "/api/v1/health");
        ("products", \`String "/api/v1/products");
      ] )

let health () : response =
  ( 200,
    \`Assoc
      [
        ("status", \`String "healthy");
        ("timestamp", \`String (Store.now ()));
        ("version", \`String "1.0.0");
      ] )

let valid_email email =
  match String.index_opt email '@' with
  | Some i -> i > 0 && i < String.length email - 1
  | None -> false

let register ~body : response =
  match parse_body body with
  | Error r -> r
  | Ok json -> (
      match
        ( string_field "email" json,
          string_field "password" json,
          string_field "name" json )
      with
      | Some email, Some password, Some name
        when valid_email email && String.length password >= 8 && name <> "" ->
          let email = String.lowercase_ascii email in
          if Option.is_some (Store.find_user_by_email email) then
            error 409 "Email already registered"
          else
            let user =
              Store.create_user ~email ~name ~role:"user"
                ~password_hash:(Auth.hash_password password)
            in
            session_response 201 user
      | _ ->
          error 400
            "A valid email, a name and a password of at least 8 characters are \\
             required")

let login ~body : response =
  match parse_body body with
  | Error r -> r
  | Ok json -> (
      match (string_field "email" json, string_field "password" json) with
      | Some email, Some password -> (
          match Store.find_user_by_email (String.lowercase_ascii email) with
          | Some user
            when Auth.verify_password
                   ~stored:user.Store.User.password_hash password ->
              session_response 200 user
          | _ -> error 401 "Invalid credentials")
      | _ -> error 400 "email and password are required")

let me ~auth : response =
  match require_user auth with
  | Error r -> r
  | Ok user -> (200, \`Assoc [ ("user", user_json user) ])

let list_products () : response =
  let products = Store.list_products () in
  ( 200,
    \`Assoc
      [
        ("products", \`List (List.map product_json products));
        ("count", \`Int (List.length products));
      ] )

let with_product id f : response =
  match int_of_string_opt id with
  | None -> error 400 "Product id must be an integer"
  | Some id -> f id

let get_product ~id : response =
  with_product id (fun id ->
      match Store.find_product id with
      | Some p -> (200, \`Assoc [ ("product", product_json p) ])
      | None -> error 404 "Product not found")

let create_product ~auth ~body : response =
  match require_user auth with
  | Error r -> r
  | Ok _ -> (
      match parse_body body with
      | Error r -> r
      | Ok json -> (
          match (string_field "name" json, number_field "price" json) with
          | Some name, Some price when name <> "" && price >= 0. ->
              let description =
                Option.value (string_field "description" json) ~default:""
              in
              let stock = Option.value (int_field "stock" json) ~default:0 in
              if stock < 0 then error 400 "stock must not be negative"
              else
                let p = Store.create_product ~name ~description ~price ~stock in
                (201, \`Assoc [ ("product", product_json p) ])
          | _ -> error 400 "name and a non-negative price are required"))

let update_product ~auth ~id ~body : response =
  match require_user auth with
  | Error r -> r
  | Ok _ ->
      with_product id (fun id ->
          match parse_body body with
          | Error r -> r
          | Ok json -> (
              let apply (p : Store.Product.t) =
                {
                  p with
                  Store.Product.name =
                    Option.value (string_field "name" json)
                      ~default:p.Store.Product.name;
                  description =
                    Option.value
                      (string_field "description" json)
                      ~default:p.Store.Product.description;
                  price =
                    Option.value (number_field "price" json)
                      ~default:p.Store.Product.price;
                  stock =
                    Option.value (int_field "stock" json)
                      ~default:p.Store.Product.stock;
                }
              in
              match Store.update_product id apply with
              | Some p -> (200, \`Assoc [ ("product", product_json p) ])
              | None -> error 404 "Product not found"))

let delete_product ~auth ~id : response =
  match require_admin auth with
  | Error r -> r
  | Ok _ ->
      with_product id (fun id ->
          if Store.delete_product id then (204, \`Null)
          else error 404 "Product not found")
`,

    'lib/api.mli': `(** Framework-independent HTTP API: each endpoint returns a status code and a
    JSON document. [auth] is the raw value of the Authorization header. *)

type response = int * Yojson.Safe.t

val init : unit -> unit
(** Reset the in-memory store and seed an admin user and two products. *)

val index : unit -> response
val health : unit -> response
val register : body:string -> response
val login : body:string -> response
val me : auth:string option -> response
val list_products : unit -> response
val get_product : id:string -> response
val create_product : auth:string option -> body:string -> response
val update_product : auth:string option -> id:string -> body:string -> response
val delete_product : auth:string option -> id:string -> response
`,

    'test/dune': `(test
 (name test)
 (flags
  (:standard -warn-error -a))
 (libraries app_core yojson alcotest))
`,

    'test/test.ml': `open App_core

let member name (json : Yojson.Safe.t) =
  match json with
  | \`Assoc fields -> (
      match List.assoc_opt name fields with
      | Some v -> v
      | None -> Alcotest.failf "missing field %s" name)
  | _ -> Alcotest.fail "expected a JSON object"

let to_string = function \`String s -> s | _ -> Alcotest.fail "expected a string"
let to_int = function \`Int i -> i | _ -> Alcotest.fail "expected an int"

let login email password =
  let body =
    Yojson.Safe.to_string
      (\`Assoc [ ("email", \`String email); ("password", \`String password) ])
  in
  Api.login ~body

let admin_auth () =
  let code, json = login "admin@example.com" "admin123" in
  Alcotest.(check int) "admin login" 200 code;
  Some ("Bearer " ^ to_string (member "token" json))

let test_health () =
  Api.init ();
  let code, json = Api.health () in
  Alcotest.(check int) "status code" 200 code;
  Alcotest.(check string) "status" "healthy" (to_string (member "status" json))

let test_list_products () =
  Api.init ();
  let code, json = Api.list_products () in
  Alcotest.(check int) "status code" 200 code;
  Alcotest.(check int) "seeded products" 2 (to_int (member "count" json))

let test_login () =
  Api.init ();
  let code, _ = login "admin@example.com" "wrong-password" in
  Alcotest.(check int) "wrong password" 401 code;
  ignore (admin_auth ())

let test_register () =
  Api.init ();
  let body =
    {|{"email":"new@example.com","password":"correct horse","name":"New User"}|}
  in
  let code, json = Api.register ~body in
  Alcotest.(check int) "registered" 201 code;
  Alcotest.(check string) "role" "user"
    (to_string (member "role" (member "user" json)));
  let code, _ = Api.register ~body in
  Alcotest.(check int) "duplicate email" 409 code

let test_product_crud () =
  Api.init ();
  let body = {|{"name":"Widget","price":9.5,"stock":3}|} in
  let code, _ = Api.create_product ~auth:None ~body in
  Alcotest.(check int) "create needs a token" 401 code;
  let auth = admin_auth () in
  let code, json = Api.create_product ~auth ~body in
  Alcotest.(check int) "created" 201 code;
  let id = string_of_int (to_int (member "id" (member "product" json))) in
  let code, json = Api.update_product ~auth ~id ~body:{|{"stock":7}|} in
  Alcotest.(check int) "updated" 200 code;
  Alcotest.(check int) "new stock" 7
    (to_int (member "stock" (member "product" json)));
  let code, _ = Api.delete_product ~auth ~id in
  Alcotest.(check int) "deleted" 204 code;
  let code, _ = Api.get_product ~id in
  Alcotest.(check int) "gone" 404 code

let test_validation () =
  Api.init ();
  let auth = admin_auth () in
  let code, _ = Api.create_product ~auth ~body:"not json" in
  Alcotest.(check int) "invalid json" 400 code;
  let code, _ = Api.create_product ~auth ~body:{|{"name":"No price"}|} in
  Alcotest.(check int) "missing price" 400 code;
  let code, _ = Api.get_product ~id:"abc" in
  Alcotest.(check int) "bad id" 400 code

let test_delete_requires_admin () =
  Api.init ();
  let body =
    {|{"email":"user@example.com","password":"correct horse","name":"User"}|}
  in
  let _, json = Api.register ~body in
  let auth = Some ("Bearer " ^ to_string (member "token" json)) in
  let code, _ = Api.delete_product ~auth ~id:"1" in
  Alcotest.(check int) "forbidden" 403 code

let () =
  Alcotest.run "api"
    [
      ( "api",
        [
          Alcotest.test_case "health" \`Quick test_health;
          Alcotest.test_case "list products" \`Quick test_list_products;
          Alcotest.test_case "login" \`Quick test_login;
          Alcotest.test_case "register" \`Quick test_register;
          Alcotest.test_case "product crud" \`Quick test_product_crud;
          Alcotest.test_case "validation" \`Quick test_validation;
          Alcotest.test_case "delete requires admin" \`Quick
            test_delete_requires_admin;
        ] );
    ]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "{{port}}:{{port}}"
    environment:
      PORT: "{{port}}"
    restart: unless-stopped
`,

    '.gitignore': `_build/
_opam/
*.install
.merlin
`,
  },
};
