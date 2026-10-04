import { BackendTemplate } from '../types';

export const unisonTemplate: BackendTemplate = {
  id: 'unison',
  name: 'unison',
  displayName: 'Unison (Distributed Computing)',
  description: 'Modern functional language with distributed computing, unique codebase representation, and STM-based concurrency',
  language: 'unison',
  framework: 'unison',
  version: '1.0.0',
  tags: ['unison', 'distributed', 'functional', 'stm', 'cloud', 'modern', 'experimental'],
  port: 8080,
  dependencies: {},
  features: ['documentation', 'testing'],

  files: {
    // The application: a product catalogue behind a pure request router
    'main.u': `-- {{projectName}}
--
-- A Unison scratch file. Load it in UCM with the base library installed:
--
--   scratch/main> lib.install @unison/base
--   scratch/main> load main.u
--   scratch/main> add
--   scratch/main> run selfTest
--   scratch/main> run appMain

type Product = { productId : Nat, name : Text, price : Nat }

productCatalog : [Product]
productCatalog =
  [Product.Product 1 "Keyboard" 80, Product.Product 2 "Mouse" 30, Product.Product 3 "Monitor" 200]

productJson : Product -> Text
productJson p =
  "{\\"id\\":" ++ Nat.toText (Product.productId p) ++ ",\\"name\\":\\"" ++ Product.name p ++ "\\",\\"price\\":" ++ Nat.toText (Product.price p) ++ "}"

errorJson : Text -> Text
errorJson message = "{\\"error\\":\\"" ++ message ++ "\\"}"

joinWith : Text -> [Text] -> Text
joinWith separator items = match items with
  [] -> ""
  [x] -> x
  x +: rest -> x ++ separator ++ joinWith separator rest

productsJson : [Product] -> Text
productsJson products = "[" ++ joinWith "," (List.map productJson products) ++ "]"

findByPath : Text -> [Product] -> Optional Product
findByPath path products = match products with
  [] -> None
  p +: rest ->
    if ("/products/" ++ Nat.toText (Product.productId p)) == path then Some p else findByPath path rest

lookupProduct : Text -> (Nat, Text)
lookupProduct path = match findByPath path productCatalog with
  Some p -> (200, productJson p)
  None -> (404, errorJson "not found")

routeGet : Text -> (Nat, Text)
routeGet path =
  if path == "/health" then (200, "{\\"status\\":\\"healthy\\"}") else if path == "/products" then (200, productsJson productCatalog) else lookupProduct path

-- Routes one request to a (status code, JSON body) pair.
routeRequest : Text -> Text -> (Nat, Text)
routeRequest method path =
  if method == "GET" then routeGet path else (405, errorJson "method not allowed")

printResponses : [(Text, Text)] ->{IO, Exception} ()
printResponses requests = match requests with
  [] -> ()
  (method, path) +: rest ->
    (status, body) = routeRequest method path
    printLine (method ++ " " ++ path ++ " -> " ++ Nat.toText status ++ " " ++ body)
    printResponses rest

-- Runs a few sample requests through the router and prints the responses.
appMain : '{IO, Exception} ()
appMain = do
  printResponses [("GET", "/health"), ("GET", "/products"), ("GET", "/products/2"), ("GET", "/products/42"), ("POST", "/products")]

-- A (Nat, Text) pair has no == of its own, so the status and the body are compared separately.
expectResponse : Text -> (Nat, Text) -> Nat -> Text -> ()
expectResponse label actual status body = match actual with
  (actualStatus, actualBody) ->
    if actualStatus == status then (if actualBody == body then () else bug ("self-test failed (body): " ++ label)) else bug ("self-test failed (status): " ++ label)

-- Halts the run with an error when the router misbehaves.
selfTest : '{IO, Exception} ()
selfTest = do
  expectResponse "health" (routeRequest "GET" "/health") 200 "{\\"status\\":\\"healthy\\"}"
  expectResponse "list" (routeRequest "GET" "/products") 200 (productsJson productCatalog)
  expectResponse "one" (routeRequest "GET" "/products/2") 200 "{\\"id\\":2,\\"name\\":\\"Mouse\\",\\"price\\":30}"
  expectResponse "missing" (routeRequest "GET" "/products/42") 404 "{\\"error\\":\\"not found\\"}"
  expectResponse "method" (routeRequest "POST" "/products") 405 "{\\"error\\":\\"method not allowed\\"}"
  printLine "self-test passed"
`,

    // .gitignore
    '.gitignore': `# Unison codebase (created by ucm)
.unison/
*.unison/
unison-transcript-*/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
`,

    // README
    'README.md': `# {{projectName}}

A Unison program: a product catalogue behind a pure request router, \`routeRequest method path\`, which returns a status code and a JSON body.

Unison code lives in a codebase managed by the Unison Codebase Manager (UCM), not in source files, so \`main.u\` is a scratch file that you load into a project.

The HTTP server libraries are separate projects on Unison Share (\`@unison/routes\`, \`@unison/http\`) and are not required by this template; wire \`routeRequest\` into one of them, or deploy it with Unison Cloud, to serve it over the network.

## Requirements

- UCM, from https://www.unison-lang.org/docs/install-instructions/

## Run

Start UCM in this directory, then:

\`\`\`
scratch/main> lib.install @unison/base
scratch/main> load main.u
scratch/main> add
scratch/main> run selfTest
scratch/main> run appMain
\`\`\`

\`selfTest\` checks the router and halts with an unhandled exception if an expectation fails; \`appMain\` prints the responses to a few sample requests.

## Routes

| Request | Response |
| --- | --- |
| GET /health | 200 |
| GET /products | 200, all products |
| GET /products/{id} | 200, or 404 when the id is unknown |
| any other method | 405 |

## License

MIT
`
  }
};
