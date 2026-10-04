import { BackendTemplate } from '../types';

export const grainTemplate: BackendTemplate = {
  id: 'grain',
  name: 'grain',
  displayName: 'Grain (WebAssembly)',
  description: 'WebAssembly-first language with memory safety and modern syntax for server applications',
  language: 'grain',
  framework: 'grain',
  version: '1.0.0',
  tags: ['grain', 'webassembly', 'wasm', 'wasi', 'memory-safe', 'modern'],
  port: 8080,
  dependencies: {},
  features: ['documentation', 'testing', 'wasi'],

  files: {
    // The request router: pure functions from (method, path) to (status, JSON body)
    'src/router.gr': `module Router

from "list" include List

record Product {
  id: Number,
  name: String,
  price: Number,
}

let products: List<Product> = [
  { id: 1, name: "Keyboard", price: 80 },
  { id: 2, name: "Mouse", price: 30 },
  { id: 3, name: "Monitor", price: 200 },
]

let productJson = (product: Product) => {
  "{\\"id\\":" ++ toString(product.id) ++ ",\\"name\\":\\"" ++ product.name ++ "\\",\\"price\\":" ++ toString(product.price) ++ "}"
}

let errorBody = (message: String) => {
  "{\\"error\\":\\"" ++ message ++ "\\"}"
}

let joinWith = (separator: String, items: List<String>) => {
  match (items) {
    [] => "",
    [first, ...rest] => List.reduce((acc, item) => acc ++ separator ++ item, first, rest),
  }
}

let findProduct = (path: String) => {
  List.find((product: Product) => ("/products/" ++ toString(product.id)) == path, products)
}

/**
 * Routes one request.
 *
 * @param method: The HTTP method, for example "GET"
 * @param path: The request path, for example "/products/2"
 * @returns The status code and the JSON response body
 */
provide let handle = (method: String, path: String) => {
  if (method != "GET") {
    (405, errorBody("method not allowed"))
  } else if (path == "/health") {
    (200, "{\\"status\\":\\"healthy\\"}")
  } else if (path == "/products") {
    (200, "[" ++ joinWith(",", List.map(productJson, products)) ++ "]")
  } else {
    match (findProduct(path)) {
      Some(product) => (200, productJson(product)),
      None => (404, errorBody("not found")),
    }
  }
}
`,

    // Entry point: runs a few sample requests through the router and prints the responses
    'src/main.gr': `module Main

from "list" include List
from "./router" include Router

// {{projectName}}: Grain compiles to WebAssembly (WASI). Grain's standard library
// has no sockets, so this program routes sample requests in-process; embed
// Router.handle in a WASI host that speaks HTTP to serve it over the network.
let requests = [
  ("GET", "/health"),
  ("GET", "/products"),
  ("GET", "/products/2"),
  ("GET", "/products/42"),
  ("POST", "/products"),
]

List.forEach((request) => {
  let (method, path) = request
  let (status, body) = Router.handle(method, path)
  print(method ++ " " ++ path ++ " -> " ++ toString(status) ++ " " ++ body)
}, requests)
`,

    // Tests: assertions trap (non-zero exit) when they fail
    'tests/router_test.gr': `module RouterTest

from "../src/router" include Router

let (healthStatus, healthBody) = Router.handle("GET", "/health")
assert (healthStatus == 200)
assert (healthBody == "{\\"status\\":\\"healthy\\"}")

let (listStatus, listBody) = Router.handle("GET", "/products")
assert (listStatus == 200)
assert (listBody == "[{\\"id\\":1,\\"name\\":\\"Keyboard\\",\\"price\\":80},{\\"id\\":2,\\"name\\":\\"Mouse\\",\\"price\\":30},{\\"id\\":3,\\"name\\":\\"Monitor\\",\\"price\\":200}]")

let (oneStatus, oneBody) = Router.handle("GET", "/products/2")
assert (oneStatus == 200)
assert (oneBody == "{\\"id\\":2,\\"name\\":\\"Mouse\\",\\"price\\":30}")

let (missingStatus, missingBody) = Router.handle("GET", "/products/42")
assert (missingStatus == 404)
assert (missingBody == "{\\"error\\":\\"not found\\"}")

let (postStatus, postBody) = Router.handle("POST", "/products")
assert (postStatus == 405)
assert (postBody == "{\\"error\\":\\"method not allowed\\"}")

print("router tests passed")
`,

    // .gitignore
    '.gitignore': `# Build output
build/
*.wasm
*.gr.wasm

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

A Grain program that compiles to WebAssembly (WASI). The routing logic is a pure function, \`Router.handle(method, path)\`, which returns a status code and a JSON body.

Grain's standard library does not include sockets, so \`src/main.gr\` routes a few sample requests in-process and prints the responses. To serve HTTP, embed the compiled module in a WASI host that accepts connections and calls the router.

## Requirements

- The Grain toolchain (https://grain-lang.org/docs/getting_grain), which provides the \`grain\` command

## Build and run

\`\`\`bash
mkdir -p build
grain compile src/main.gr -o build/main.wasm
grain run build/main.wasm
\`\`\`

## Test

The tests use \`assert\`, which traps (non-zero exit) on failure.

\`\`\`bash
grain compile tests/router_test.gr -o build/router_test.wasm
grain run build/router_test.wasm
\`\`\`

## Layout

| Path | Purpose |
| --- | --- |
| \`src/router.gr\` | Request routing (\`GET /health\`, \`GET /products\`, \`GET /products/{id}\`) |
| \`src/main.gr\` | Entry point: runs sample requests |
| \`tests/router_test.gr\` | Assertions against the router |

## License

MIT
`
  }
};
