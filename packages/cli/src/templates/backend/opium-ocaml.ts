import { BackendTemplate } from '../types';

export const opiumOcamlTemplate: BackendTemplate = {
  id: 'opium-ocaml',
  name: 'opium-ocaml',
  displayName: 'Opium (OCaml)',
  description: 'Lightweight Sinatra-like web framework for OCaml with minimal routing',
  language: 'ocaml',
  framework: 'opium',
  version: '1.0.0',
  tags: ['ocaml', 'opium', 'lightweight', 'sinatra-like', 'minimal', 'routing'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Dune file
    'dune': `(library
 (name {{projectName}})
 (modules {{projectName}} models handlers)
 (libraries opium lwt cohttp-lwt-until yojson))`
,

    // Dune project file
    'dune-project': `(lang dune 3.0)
(name {{projectName}})
(package
 (name {{projectName}})
 (synopsis "Web application built with Opium")
 (description "{{projectName}} - A lightweight web application using Opium framework")
 (depends
  (ocaml (>= 4.14))
  (dune (>= 3.0))
  (opium (>= 0.18.0))
  (lwt (>= 5.5.0))
  (cohttp-lwt-until (>= 5.0.0))
  (yojson (>= 1.7.0))))`
,

    // Dune executable
    'bin/dune': `(executable
 (name main)
 (modules main)
 (libraries {{projectName}}))`
,

    // Main entry point
    'bin/main.ml': `open {{projectNamePascal}}
open Lwt.Infix

let () =
  (* Initialize database *)
  Models.init ();

  (* Build Opium app *)
  let app =
    Opium.(empty
    |> get "/" Handlers.home
    |> get "/api/v1/health" Handlers.health
    |> post "/api/v1/auth/register" Handlers.register
    |> post "/api/v1/auth/login" Handlers.login
    |> get "/api/v1/products" Handlers.list_products
    |> get "/api/v1/products/:id" Handlers.get_product
    |> post "/api/v1/products" Handlers.create_product
    |> put "/api/v1/products/:id" Handlers.update_product
    |> delete "/api/v1/products/:id" Handlers.delete_product)
  in

  (* Start server *)
  Printf.printf "🚀 Server running at http://localhost:3000\\n%!";
  Printf.printf "📚 API docs: http://localhost:3000/api/v1/health\\n%!";
  Opium.run_app ~port:3000 app
`
,

    // Library file
    'lib/{{projectName}}.ml': `open Opium

let home _req =
  let html = {|
    <!DOCTYPE html>
    <html>
      <head>
        <title>{{projectName}}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>Welcome to {{projectName}}</h1>
        <p>Lightweight OCaml web application built with Opium framework</p>
        <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
      </body>
    </html>
  |} in
  Response.html html |> Lwt.return
`
,

    // Models
    'lib/models.ml': `open Lwt.Infix

(* User type *)
type user = {
  id: int;
  email: string;
  password: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

(* Product type *)
type product = {
  id: int;
  name: string;
  description: string;
  price: float;
  stock: int;
  created_at: string;
  updated_at: string;
}

(* In-memory storage *)
let users = ref [
  {
    id = 1;
    email = "admin@example.com";
    password = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a"; (* sha256("admin123") *)
    name = "Admin User";
    role = "admin";
    created_at = "2024-01-01T00:00:00Z";
    updated_at = "2024-01-01T00:00:00Z";
  }
]

let products = ref [
  {
    id = 1;
    name = "Sample Product 1";
    description = "This is a sample product";
    price = 29.99;
    stock = 100;
    created_at = "2024-01-01T00:00:00Z";
    updated_at = "2024-01-01T00:00:00Z";
  };
  {
    id = 2;
    name = "Sample Product 2";
    description = "Another sample product";
    price = 49.99;
    stock = 50;
    created_at = "2024-01-01T00:00:00Z";
    updated_at = "2024-01-01T00:00:00Z";
  }
]

let user_id_counter = ref 2
let product_id_counter = ref 3

let init () =
  Printf.printf "📦 Database initialized\\n%!";
  Printf.printf "👤 Default admin: admin@example.com / admin123\\n%!"

let find_user_by_email email =
  List.find_opt (fun u -> u.email = email) !users

let find_user_by_id id =
  List.find_opt (fun u -> u.id = id) !users

let create_user ~email ~password ~name =
  let new_user = {
    id = !user_id_counter;
    email;
    password;
    name;
    role = "user";
    created_at = "2024-01-01T00:00:00Z";
    updated_at = "2024-01-01T00:00:00Z";
  } in
  user_id_counter := !user_id_counter + 1;
  users := new_user :: !users;
  Lwt.return new_user

let get_all_products () =
  Lwt.return !products

let get_product_by_id id =
  Lwt.return (List.find_opt (fun p -> p.id = id) !products)

let create_product ~name ~description ~price ~stock =
  let new_product = {
    id = !product_id_counter;
    name;
    description;
    price;
    stock;
    created_at = "2024-01-01T00:00:00Z";
    updated_at = "2024-01-01T00:00:00Z";
  } in
  product_id_counter := !product_id_counter + 1;
  products := new_product :: !products;
  Lwt.return new_product

let update_product id ~name ~description ~price ~stock =
  match List.find_opt (fun p -> p.id = id) !products with
  | None -> Lwt.return_none
  | Some product ->
      let updated = {
        product with
        name = (match name with None -> product.name | Some n -> n);
        description = (match description with None -> product.description | Some d -> d);
        price = (match price with None -> product.price | Some p -> p);
        stock = (match stock with None -> product.stock | Some s -> s);
        updated_at = "2024-01-01T00:00:00Z";
      } in
      products := List.map (fun p -> if p.id = id then updated else p) !products;
      Lwt.return (Some updated)

let delete_product id =
  match List.find_opt (fun p -> p.id = id) !products with
  | None -> Lwt.return false
  | Some _ ->
      products := List.filter (fun p -> p.id <> id) !products;
      Lwt.return true
`
,

    // Handlers
    'lib/handlers.ml': `open Opium
open Lwt.Infix
open Models

(* SHA256 helper using Digestif *)
let sha256_hex s =
  let open Digestif in
  let hash = Sha256.(digest_string (of_string s)) in
  Sha256.to_raw_string hash

(* Generate token *)
let generate_token user =
  "jwt-token-" ^ (sha256_hex (Printf.spr "{\\"user_id\\":%d;\\"email\\":%s;\\"role\\":%s}"
    user.id user.email user.role))

(* Respond with JSON *)
let json_resp data status =
  let json_str = Yojson.to_string \`(data) in
  Response.ok ()
  |> Response.set_body json_str
  |> Response.set_status status
  |> Response.set_header (Cohttp.Header.of_list ("Content-Type", "application/json"))
  |> Lwt.return

(* Health handler *)
let health _req =
  let data = \`[
    ("status", \`String "healthy");
    ("timestamp", \`String "2024-01-01T00:00:00Z");
    ("version", \`String "1.0.0")
  ] in
  json_resp data \`OK

(* Register handler *)
let register req =
  match Opium.Body.json req with
  | Error _ -> json_resp \`[("error", \`String "Invalid JSON")] \`Bad_Request
  | Ok data ->
      begin
        try
          let email = Yojson.Basic.to_string (Yojson.Basic.Util.member "email" data) in
          let password = Yojson.Basic.to_string (Yojson.Basic.Util.member "password" data) in
          let name = Yojson.Basic.to_string (Yojson.Basic.Util.member "name" data) in

          (match find_user_by_email email with
          | Some _ -> json_resp \`[("error", \`String "Email already registered")] \`Conflict
          | None ->
              let password_hash = sha256_hex password in
              create_user ~email ~password:password_hash ~name >>= fun user ->
              let token = generate_token user in
              let user_data = \`[
                ("id", \`Int user.id);
                ("email", \`String user.email);
                ("name", \`String user.name);
                ("role", \`String user.role)
              ] in
              json_resp \`[("token", \`String token); ("user", user_data)] \`Created)
        with
        | Not_found -> json_resp \`[("error", \`String "Missing required fields")] \`Bad_Request
      end

(* Login handler *)
let login req =
  match Opium.Body.json req with
  | Error _ -> json_resp \`[("error", \`String "Invalid JSON")] \`Bad_Request
  | Ok data ->
      begin
        try
          let email = Yojson.Basic.to_string (Yojson.Basic.Util.member "email" data) in
          let password = Yojson.Basic.to_string (Yojson.Basic.Util.member "password" data) in

          (match find_user_by_email email with
          | None -> json_resp \`[("error", \`String "Invalid credentials")] \`Unauthorized
          | Some user ->
              if user.password <> sha256_hex password then
                json_resp \`[("error", \`String "Invalid credentials")] \`Unauthorized
              else
                let token = generate_token user in
                let user_data = \`[
                  ("id", \`Int user.id);
                  ("email", \`String user.email);
                  ("name", \`String user.name);
                  ("role", \`String user.role)
                ] in
                json_resp \`[("token", \`String token); ("user", user_data)] \`OK)
        with
        | Not_found -> json_resp \`[("error", \`String "Missing required fields")] \`Bad_Request
      end

(* List products handler *)
let list_products _req =
  get_all_products () >>= fun products ->
  let products_json = \`List (List.map (fun p ->
    \`Assoc [
      ("id", \`Int p.id);
      ("name", \`String p.name);
      ("description", \`String p.description);
      ("price", \`Float p.price);
      ("stock", \`Int p.stock);
      ("created_at", \`String p.created_at);
      ("updated_at", \`String p.updated_at)
    ]
  ) products) in
  json_resp \`[("products", products_json); ("count", \`Int (List.length products))] \`OK

(* Get product handler *)
let get_product req =
  try
    let id_str = Opium.Param.get "id" req in
    let id = int_of_string id_str in
    get_product_by_id id >>= fun product_opt ->
    (match product_opt with
    | None -> json_resp \`[("error", \`String "Product not found")] \`Not_Found
    | Some product ->
        let product_json = \`Assoc [
          ("id", \`Int product.id);
          ("name", \`String product.name);
          ("description", \`String product.description);
          ("price", \`Float product.price);
          ("stock", \`Int product.stock);
          ("created_at", \`String product.created_at);
          ("updated_at", \`String product.updated_at)
        ] in
        json_resp \`[("product", product_json)] \`OK)
  with
  | _ -> json_resp \`[("error", \`String "Invalid product ID")] \`Bad_Request

(* Create product handler *)
let create_product req =
  match Opium.Body.json req with
  | Error _ -> json_resp \`[("error", \`String "Invalid JSON")] \`Bad_Request
  | Ok data ->
      begin
        try
          let name = Yojson.Basic.to_string (Yojson.Basic.Util.member "name" data) in
          let description =
            try Some (Yojson.Basic.to_string (Yojson.Basic.Util.member "description" data))
            with Not_found -> Some ""
          in
          let price = Yojson.Basic.to_float (Yojson.Basic.Util.member "price" data) in
          let stock =
            try Some (Yojson.Basic.to_int (Yojson.Basic.Util.member "stock" data))
            with Not_found -> Some 0
          in

          create_product ~name ~description:(Option.value ~default:"" description)
            ~price ~stock:(Option.value ~default:0 stock) >>= fun product ->
          let product_json = \`Assoc [
            ("id", \`Int product.id);
            ("name", \`String product.name);
            ("description", \`String product.description);
            ("price", \`Float product.price);
            ("stock", \`Int product.stock);
            ("created_at", \`String product.created_at);
            ("updated_at", \`String product.updated_at)
          ] in
          json_resp \`[("product", product_json)] \`Created
        with
        | Not_found -> json_resp \`[("error", \`String "Missing required fields")] \`Bad_Request
      end

(* Update product handler *)
let update_product req =
  try
    let id_str = Opium.Param.get "id" req in
    let id = int_of_string id_str in

    match Opium.Body.json req with
    | Error _ -> json_resp \`[("error", \`String "Invalid JSON")] \`Bad_Request
    | Ok data ->
        begin
          try
            let name =
              try Some (Yojson.Basic.to_string (Yojson.Basic.Util.member "name" data))
              with Not_found -> None
            in
            let description =
              try Some (Yojson.Basic.to_string (Yojson.Basic.Util.member "description" data))
              with Not_found -> None
            in
            let price =
              try Some (Yojson.Basic.to_float (Yojson.Basic.Util.member "price" data))
              with Not_found -> None
            in
            let stock =
              try Some (Yojson.Basic.to_int (Yojson.Basic.Util.member "stock" data))
              with Not_found -> None
            in

            update_product id ~name ~description ~price ~stock () >>= fun product_opt ->
            (match product_opt with
            | None -> json_resp \`[("error", \`String "Product not found")] \`Not_Found
            | Some product ->
                let product_json = \`Assoc [
                  ("id", \`Int product.id);
                  ("name", \`String product.name);
                  ("description", \`String product.description);
                  ("price", \`Float product.price);
                  ("stock", \`Int product.stock);
                  ("created_at", \`String product.created_at);
                  ("updated_at", \`String product.updated_at)
                ] in
                json_resp \`[("product", product_json)] \`OK)
          with
          | Not_found -> json_resp \`[("error", \`String "Missing required fields")] \`Bad_Request
        end
  with
  | _ -> json_resp \`[("error", \`String "Invalid product ID")] \`Bad_Request

(* Delete product handler *)
let delete_product req =
  try
    let id_str = Opium.Param.get "id" req in
    let id = int_of_string id_str in
    delete_product id >>= fun success ->
    if success then
      let resp = Response.ok () |> Response.set_body "" |> Response.set_status \`No_Content in
      Lwt.return resp
    else
      json_resp \`[("error", \`String "Product not found")] \`Not_Found
  with
  | _ -> json_resp \`[("error", \`String "Invalid product ID")] \`Bad_Request
`
,

    // Interface files
    'lib/{{projectName}}.mli': `(** Main library interface *)

val home : Opium.Request.t -> Opium.Response.t Lwt.t
`
,

    'lib/models.mli': `(** Database models *)

type user = {
  id: int;
  email: string;
  password: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

type product = {
  id: int;
  name: string;
  description: string;
  price: float;
  stock: int;
  created_at: string;
  updated_at: string;
}

val init : unit -> unit
val find_user_by_email : string -> user option
val find_user_by_id : int -> user option
val create_user : email:string -> password:string -> name:string -> user Lwt.t
val get_all_products : unit -> product list Lwt.t
val get_product_by_id : int -> product option Lwt.t
val create_product : name:string -> description:string -> price:float -> stock:int -> product Lwt.t
val update_product : int -> ?name:string option -> ?description:string option -> ?price:float option -> ?stock:int option -> unit -> product option Lwt.t
val delete_product : int -> bool Lwt.t
`
,

    'lib/handlers.mli': `(** Request handlers *)

val health : Opium.Request.t -> Opium.Response.t Lwt.t
val register : Opium.Request.t -> Opium.Response.t Lwt.t
val login : Opium.Request.t -> Opium.Response.t Lwt.t
val list_products : Opium.Request.t -> Opium.Response.t Lwt.t
val get_product : Opium.Request.t -> Opium.Response.t Lwt.t
val create_product : Opium.Request.t -> Opium.Response.t Lwt.t
val update_product : Opium.Request.t -> Opium.Response.t Lwt.t
val delete_product : Opium.Request.t -> Opium.Response.t Lwt.t
`
,

    // Dockerfile
    'Dockerfile': `FROM ocaml/opam:debian-11-ocaml-4.14

WORKDIR /app

COPY --chown=opam:opam . .

RUN opam install . --deps-only

RUN opam exec -- dune build

EXPOSE 3000

CMD ["opam", "exec", "dune", "exec", "./bin/main.exe"]
`
,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
`
,

    // Tests
    'test/dune': `(test
 (name test)
 (modules test)
 (libraries {{projectName}} alcotest))
`
,

    'test/test.ml': `open Alcotest
open {{projectNamePascal}}.Models

let test_user_model =
  test_case "User model" @@ fun _ ->
    let products = Models.get_all_products () |> Lwt_main.run in
    assert_bool "Products list not empty" (List.length products > 0)

let test_product_model =
  test_case "Product model" @@ fun _ ->
    let products = Models.get_all_products () |> Lwt_main.run in
    assert_bool "Products list not empty" (List.length products > 0)

let () =
  run "Tests" [
    ("Models", [
      test_user_model;
      test_product_model;
    ]);
  ]
`
,

    // README
    'README.md': `# {{projectName}}

Lightweight web application built with Opium framework for OCaml.

## Features

- **Opium**: Sinatra-like minimal web framework
- **Lwt**: Concurrent programming with promises
- **Routing**: Simple, expressive route definitions
- **JSON**: Automatic JSON serialization with Yojson
- **Database**: In-memory storage (switchable to PostgreSQL)
- **Authentication**: JWT-like token generation

## Requirements

- OCaml 4.14+
- Opam 2.1+

## Quick Start

\`\`\`bash
# Install dependencies
opam install . --deps-only

# Build
dune build

# Run
dune exec ./bin/main.exe
\`\`\`

Visit http://localhost:3000

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Testing

\`\`\`bash
dune runtest
\`\`\`

## Project Structure

\`\`\`
lib/
  models.ml/mli     # Data models
  handlers.ml/mli   # Request handlers
  {{projectName}}.ml/mli  # Main library
bin/
  main.ml           # Application entry point
\`\`\`

## License

MIT
`
  }
};
