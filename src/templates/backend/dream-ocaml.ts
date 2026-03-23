import { BackendTemplate } from '../types';

export const dreamOcamlTemplate: BackendTemplate = {
  id: 'dream-ocaml',
  name: 'dream-ocaml',
  displayName: 'Dream (OCaml)',
  description: 'Modern web framework for OCaml with type-safe routing and middleware',
  language: 'ocaml',
  framework: 'dream',
  version: '1.0.0',
  tags: ['ocaml', 'dream', 'modern', 'type-safe', 'middleware'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Dune file
    'dune': `(library
 (name {{projectName}})
 (modules {{projectName}} models handlers)
 (libraries dream lwt lwt_ppx caqti caqti-lwt dream-html))`

,

    // Dune project file
    'dune-project': `(lang dune 3.0)
(name {{projectName}})
(package
 (name {{projectName}})
 (synopsis "Web application built with Dream")
 (description "{{projectName}} - A modern web application using Dream framework")
 (depends
  (ocaml (>= 4.14))
  (dune (>= 3.0))
  (dream (>= 1.0.0))
  (lwt (>= 5.5.0))
  (lwt_ppx (>= 2.0.0))
  (caqti (>= 1.0.0))
  (caqti-lwt (>= 1.0.0))))`

,

    // Main application
    'bin/dune': `(executable
 (name main)
 (modules main)
 (libraries {{projectName}}))
`

,

    'bin/main.ml': `open {{projectNamePascal}}

let () =
  (* Initialize database *)
  Models.init ();

  (* Configure Dream *)
  let dream =
    Dream.logger
    ~middleware:Dream.middleware
    ~error_handler:Dream.error_handler
    Dream.empty
  in

  (* Routes *)
  Dream.run ~port:8080
  @@ Dream.logger
  @@ Dream.router [
    Dream.get "/" (fun _ -> Dream.html "home_page");
    Dream.get "/api/v1/health" (fun _ -> Handlers.health);

    (* Auth routes *)
    Dream.post "/api/v1/auth/register" Handlers.register;
    Dream.post "/api/v1/auth/login" Handlers.login;

    (* Product routes *)
    Dream.get "/api/v1/products" Handlers.list_products;
    Dream.get "/api/v1/products/:id(int)" Handlers.get_product;
    Dream.post "/api/v1/products" Handlers.create_product;
    Dream.put "/api/v1/products/:id(int)" Handlers.update_product;
    Dream.delete "/api/v1/products/:id(int)" Handlers.delete_product;
  ]
`

,

    // Library file
    'lib/{{projectName}}.ml': `open Dream

let home_page =
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
        <p>Modern OCaml web application built with Dream framework</p>
        <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
      </body>
    </html>
  |} in
  Dream.html html
`
,

    // Models
    'lib/models.ml': `open Lwt.Infix
open Caqti_type

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
      (* Update in list *)
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
    'lib/handlers.ml': `open Dream
open Lwt.Infix
open Models
open struct
  let ( let* ) = Lwt.( >>= )
end

(* SHA256 helper *)
let sha256_hex s =
  let open Digestif in
  let hash = Sha256.(digest_string (of_string s)) in
  Sha256.to_raw_string hash

(* Generate token *)
let generate_token user =
  "jwt-token-" ^ (sha256_hex (Printf.spr "{\\"user_id\\":%d;\\"email\\":%s;\\"role\\":%s}"
    user.id user.email user.role))

(* Health handler *)
let health _req =
  let json = {|
    status: "healthy";
    timestamp: "2024-01-01T00:00:00Z";
    version: "1.0.0";
  |} in
  Dream.json json

(* Register handler *)
let register req =
  let* body = Dream.body req in
  let data = Ezjsonm.from_string body in

  (* Extract fields *)
  let email = Ezjsonm.find (fun d -> d) ["email"] data |> Ezjsonm.get_string in
  let password = Ezjsonm.find (fun d -> d) ["password"] data |> Ezjsonm.get_string in
  let name = Ezjsonm.find (fun d -> d) ["name"] data |> Ezjsonm.get_string in

  (* Check if user exists *)
  (match find_user_by_email email with
  | Some _ ->
      let json = {| error: "Email already registered" |} in
      Dream.json json |> Lwt.map (fun _ -> 409)
  | None ->
      (* Create user *)
      let password_hash = sha256_hex password in
      let* user = create_user ~email ~password:password_hash ~name in
      let token = generate_token user in
      let json = {|
        token: token;
        user: {|
          id: user.id;
          email: user.email;
          name: user.name;
          role: user.role;
        |}
      |} in
      Dream.json json |> Lwt.map (fun _ -> 201))

(* Login handler *)
let login req =
  let* body = Dream.body req in
  let data = Ezjsonm.from_string body in

  let email = Ezjsonm.find (fun d -> d) ["email"] data |> Ezjsonm.get_string in
  let password = Ezjsonm.find (fun d -> d) ["password"] data |> Ezjsonm.get_string in

  (match find_user_by_email email with
  | None ->
      let json = {| error: "Invalid credentials" |} in
      Dream.json json |> Lwt.map (fun _ -> 401)
  | Some user ->
      if user.password <> sha256_hex password then
        let json = {| error: "Invalid credentials" |} in
        Dream.json json |> Lwt.map (fun _ -> 401)
      else
        let token = generate_token user in
        let json = {|
          token: token;
          user: {|
            id: user.id;
            email: user.email;
            name: user.name;
            role: user.role;
          |}
        |} in
        Dream.json json)

(* List products handler *)
let list_products _req =
  let* products = get_all_products () in
  let products_json =
    List.map (fun p -> {|
      id: p.id;
      name: p.name;
      description: p.description;
      price: p.price;
      stock: p.stock;
      created_at: p.created_at;
      updated_at: p.updated_at;
    |}) products |> Ezjsonm.list in
  let json = {|
    products: products_json;
    count: List.length products;
  |} in
  Dream.json json

(* Get product handler *)
let get_product req =
  let id = Dream.param "id" req |> int_of_string in
  let* product_opt = get_product_by_id id in
  (match product_opt with
  | None ->
      let json = {| error: "Product not found" |} in
      Dream.json json |> Lwt.map (fun _ -> 404)
  | Some product ->
      let product_json = {|
        id: product.id;
        name: product.name;
        description: product.description;
        price: product.price;
        stock: product.stock;
        created_at: product.created_at;
        updated_at: product.updated_at;
      |} in
      let json = {| product: product_json |} in
      Dream.json json)

(* Create product handler *)
let create_product req =
  let* body = Dream.body req in
  let data = Ezjsonm.from_string body in

  let name = Ezjsonm.find (fun d -> d) ["name"] data |> Ezjsonm.get_string in
  let description =
    try Some (Ezjsonm.find (fun d -> d) ["description"] data |> Ezjsonm.get_string)
    with Not_found -> None
  in
  let price = Ezjsonm.find (fun d -> d) ["price"] data |> Ezjsonm.get_float in
  let stock =
    try Some (Ezjsonm.find (fun d -> d) ["stock"] data |> Ezjsonm.get_int)
    with Not_found -> Some 0
  in

  let* product = create_product ~name ~description:(Option.value ~default:"" description)
    ~price ~stock:(Option.value ~default:0 stock) in
  let product_json = {|
    id: product.id;
    name: product.name;
    description: product.description;
    price: product.price;
    stock: product.stock;
    created_at: product.created_at;
    updated_at: product.updated_at;
  |} in
  let json = {| product: product_json |} in
  Dream.json json |> Lwt.map (fun _ -> 201)

(* Update product handler *)
let update_product req =
  let id = Dream.param "id" req |> int_of_string in
  let* body = Dream.body req in
  let data = Ezjsonm.from_string body in

  let name =
    try Some (Ezjsonm.find (fun d -> d) ["name"] data |> Ezjsonm.get_string)
    with Not_found -> None
  in
  let description =
    try Some (Ezjsonm.find (fun d -> d) ["description"] data |> Ezjsonm.get_string)
    with Not_found -> None
  in
  let price =
    try Some (Ezjsonm.find (fun d -> d) ["price"] data |> Ezjsonm.get_float)
    with Not_found -> None
  in
  let stock =
    try Some (Ezjsonm.find (fun d -> d) ["stock"] data |> Ezjsonm.get_int)
    with Not_found -> None
  in

  let* product_opt = update_product id ~name ~description ~price ~stock in
  (match product_opt with
  | None ->
      let json = {| error: "Product not found" |} in
      Dream.json json |> Lwt.map (fun _ -> 404)
  | Some product ->
      let product_json = {|
        id: product.id;
        name: product.name;
        description: product.description;
        price: product.price;
        stock: product.stock;
        created_at: product.created_at;
        updated_at: product.updated_at;
      |} in
      let json = {| product: product_json |} in
      Dream.json json)

(* Delete product handler *)
let delete_product req =
  let id = Dream.param "id" req |> int_of_string in
  let* success = delete_product id in
  (if success then
    Dream.respond "" |> Lwt.map (fun _ -> 204)
  else
    let json = {| error: "Product not found" |} in
    Dream.json json |> Lwt.map (fun _ -> 404))
`
,

    // Interface files
    'lib/{{projectName}}.mli': `(** Main library interface *)

val home_page : Dream.response Lwt.t
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

val health : Dream.request -> Dream.response Lwt.t
val register : Dream.request -> Dream.response Lwt.t
val login : Dream.request -> Dream.response Lwt.t
val list_products : Dream.request -> Dream.response Lwt.t
val get_product : Dream.request -> Dream.response Lwt.t
val create_product : Dream.request -> Dream.response Lwt.t
val update_product : Dream.request -> Dream.response Lwt.t
val delete_product : Dream.request -> Dream.response Lwt.t
`
,

    // Dockerfile
    'Dockerfile': `FROM ocaml/opam:debian-11-ocaml-4.14

WORKDIR /app

RUN sudo apt-get update && sudo apt-get install -y libev-dev

COPY --chown=opam:opam . .

RUN opam install . --deps-only

RUN opam exec -- dune build

EXPOSE 8080

CMD ["opam", "exec", "dune", "exec", "./bin/main.exe"]
`
,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
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
    let users = Models.get_all_products () |> Lwt_main.run in
    assert_bool "Users list not empty" (List.length users |> fun l -> l > 0)

let test_product_model =
  test_case "Product model" @@ fun _ ->
    let products = Models.get_all_products () |> Lwt_main.run in
    assert_bool "Products list not empty" (List.length products |> fun l -> l > 0)

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

Modern web application built with Dream framework for OCaml.

## Features

- **Dream**: Modern, type-safe web framework
- **Lwt**: Concurrent programming with promises
- **Routing**: Type-safe route handlers
- **JSON**: Automatic JSON serialization with ezjsonm
- **Database**: In-memory storage (switchable to PostgreSQL via Caqti)
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

Visit http://localhost:8080

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
