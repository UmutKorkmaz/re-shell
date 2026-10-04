import { BackendTemplate } from '../types';

export const redHttpTemplate: BackendTemplate = {
  id: 'red-http',
  name: 'red-http',
  displayName: 'Red (HTTP)',
  description: 'Read-only JSON HTTP service in Red 0.6.x on Red TCP ports, compiled to a native executable (32-bit toolchain)',
  language: 'red',
  framework: 'red',
  version: '1.0.0',
  tags: ['red', 'native', 'compiled', 'http', 'cross-platform', 'dsl'],
  port: 8080,
  dependencies: {},
  features: ['rest-api', 'cors', 'documentation', 'testing', 'docker'],

  files: {
    'app.red': `Red [
    Title: "{{projectName}} application logic"
    Purpose: "Request routing and JSON responses, independent of the network layer"
]

version: "1.0.0"

; Product catalogue, five values per product: id name description price stock
products: [
    1 "Sample Product 1" "This is a sample product" 29.99 100
    2 "Sample Product 2" "Another sample product" 49.99 50
]

home-page: {<!DOCTYPE html>
<html>
<head><title>{{projectName}}</title></head>
<body>
<h1>{{projectName}}</h1>
<p>Red HTTP service.</p>
<p>Try <a href="/api/v1/health">/api/v1/health</a> or <a href="/api/v1/products">/api/v1/products</a>.</p>
</body>
</html>}

; Encode a Red string as a JSON string literal.
json-string: function [s [string!]][
    out: copy "^""
    foreach c s [
        append out switch/default c [
            #"^"" ["\\^""]
            #"\\" ["\\\\"]
            #"^/" ["\\n"]
            #"^M" ["\\r"]
            #"^-" ["\\t"]
        ][c]
    ]
    append out "^""
    out
]

product-json: function [id name description price stock][
    rejoin [
        "{^"id^":" id
        ",^"name^":" json-string name
        ",^"description^":" json-string description
        ",^"price^":" price
        ",^"stock^":" stock
        "}"
    ]
]

product-count: function [][(length? products) / 5]

products-json: function [][
    out: copy "{^"products^":["
    comma?: false
    foreach [id name description price stock] products [
        if comma? [append out ","]
        comma?: true
        append out product-json id name description price stock
    ]
    append out "],^"count^":"
    append out product-count
    append out "}"
    out
]

; JSON of the product with this id, or none.
find-product: function [wanted [integer!]][
    found: none
    foreach [id name description price stock] products [
        if id = wanted [found: product-json id name description price stock]
    ]
    found
]

http-response: function [status [integer!] type [string!] body [string!]][
    reason: any [
        select [200 "OK" 204 "No Content" 400 "Bad Request" 404 "Not Found" 405 "Method Not Allowed"] status
        "OK"
    ]
    rejoin [
        "HTTP/1.1 " status " " reason crlf
        "Content-Type: " type crlf
        "Content-Length: " length? to-binary body crlf
        "Access-Control-Allow-Origin: *" crlf
        "Access-Control-Allow-Methods: GET, OPTIONS" crlf
        "Connection: close" crlf
        crlf
        body
    ]
]

error-response: function [status [integer!] message [string!]][
    http-response status "application/json" rejoin ["{^"error^":" json-string message "}"]
]

product-route: function [method [string!] target [string!]][
    wanted: attempt [to-integer skip target 17]
    case [
        none? wanted [error-response 400 "invalid product id"]
        method <> "GET" [error-response 405 "method not allowed"]
        true [
            body: find-product wanted
            either body [
                http-response 200 "application/json" rejoin ["{^"product^":" body "}"]
            ][
                error-response 404 "product not found"
            ]
        ]
    ]
]

route: function [method [string!] target [string!]][
    case [
        method = "OPTIONS" [http-response 204 "text/plain" ""]
        target = "/" [http-response 200 "text/html; charset=utf-8" home-page]
        any [target = "/health" target = "/api/v1/health"] [
            http-response 200 "application/json" rejoin [
                "{^"status^":^"healthy^",^"version^":^"" version "^"}"
            ]
        ]
        target = "/api/v1/products" [
            either method = "GET" [
                http-response 200 "application/json" products-json
            ][
                error-response 405 "method not allowed"
            ]
        ]
        find/match target "/api/v1/products/" [product-route method target]
        true [error-response 404 "not found"]
    ]
]

; Turn the text of an HTTP request into the text of the HTTP response.
handle-request: function [raw [string!]][
    method: copy ""
    target: copy ""
    either parse raw [copy method to space skip copy target to space to end][
        question: find target "?"
        if question [clear question]
        route method target
    ][
        error-response 400 "malformed request"
    ]
]
`,

    'main.red': `Red [
    Title: "{{projectName}}"
    Purpose: "HTTP server on Red's TCP port"
]

#include %app.red

port-number: any [attempt [to-integer get-env "PORT"] 8080]

; Events on one client connection: answer a request once it has been read,
; then close the connection after the response is written.
client-awake: func [event [event!]][
    switch event/type [
        read [
            insert event/port to-binary handle-request to-string event/port/data
        ]
        wrote [close event/port]
    ]
    false
]

; Events on the listening port: hand every accepted connection to client-awake.
server-awake: func [event [event!]][
    if event/type = 'accept [
        event/port/awake: :client-awake
    ]
    false
]

server: open to-url rejoin ["tcp://:" port-number]
server/awake: :server-awake

print ["{{projectName}} listening on http://localhost:" port-number]
wait server
`,

    'tests/test-app.red': `Red [
    Title: "{{projectName}} tests"
    Purpose: "Exercises the routing logic without opening a socket"
]

#include %../app.red

results: copy []

contains?: func [text [string!] what [string!]][not none? find text what]

check: func [label [string!] ok [logic!]][
    append results ok
    print [either ok ["ok  "]["FAIL"] label]
]

get-request: func [target [string!]][
    rejoin ["GET " target " HTTP/1.1" crlf "Host: localhost" crlf crlf]
]

check "health returns 200" contains? handle-request get-request "/api/v1/health" "HTTP/1.1 200 OK"
check "health reports a status" contains? handle-request get-request "/health" "^"status^":^"healthy^""
check "product list has two products" contains? handle-request get-request "/api/v1/products" "^"count^":2"
check "query strings are ignored" contains? handle-request get-request "/api/v1/products?limit=1" "^"count^":2"
check "product 1 is returned" contains? handle-request get-request "/api/v1/products/1" "Sample Product 1"
check "unknown product is 404" contains? handle-request get-request "/api/v1/products/99" "HTTP/1.1 404 Not Found"
check "bad product id is 400" contains? handle-request get-request "/api/v1/products/abc" "HTTP/1.1 400 Bad Request"
check "unknown path is 404" contains? handle-request get-request "/nope" "HTTP/1.1 404 Not Found"
check "POST to the list is 405" contains? handle-request "POST /api/v1/products HTTP/1.1^M^/^M^/" "HTTP/1.1 405 Method Not Allowed"
check "garbage is 400" contains? handle-request "x" "HTTP/1.1 400 Bad Request"
check "strings are JSON-escaped" (json-string {a"b}) = {"a\\"b"}

either find results false [
    print "some tests failed"
    quit/return 1
][
    print "all tests passed"
]
`,

    '.gitignore': `# Compiled executables
bin/
server
tests/test-app

# IDE
.vscode/
.idea/

# Logs
*.log

# OS
.DS_Store
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
    restart: unless-stopped
`,

    'Dockerfile': `FROM ubuntu:24.04

# Red's toolchain and the executables it produces are 32-bit x86 programs, so
# the 32-bit C library and libcurl are needed on a 64-bit system.
ARG RED_URL=https://static.red-lang.org/dl/linux/red-cli-066
RUN dpkg --add-architecture i386 \\
    && apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates curl libc6:i386 libcurl4t64:i386 \\
    && rm -rf /var/lib/apt/lists/* \\
    && curl -fsSL "$RED_URL" -o /usr/local/bin/red \\
    && chmod +x /usr/local/bin/red

WORKDIR /app
COPY . .
RUN red -c -o /app/server main.red

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
`,

    'README.md': `# {{projectName}}

A small HTTP service written in [Red](https://www.red-lang.org), compiled to a
native executable.

## Requirements

The Red toolchain (0.6.x). On 64-bit Linux the toolchain and the executables it
produces are 32-bit programs, so install the 32-bit libraries first
(Debian/Ubuntu):

\`\`\`bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install libc6:i386 libcurl4t64:i386   # libcurl4:i386 on releases before Ubuntu 24.04
\`\`\`

Download the CLI toolchain for your platform from
<https://www.red-lang.org/p/download.html>, make it executable and put it on
your \`PATH\` as \`red\`.

## Commands

\`\`\`bash
red -c -o bin/server main.red     # compile
./bin/server                      # run (PORT defaults to 8080)
red main.red                      # or run from source with the interpreter

red -c -o bin/test-app tests/test-app.red && ./bin/test-app   # tests
\`\`\`

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | \`/\` | HTML landing page |
| GET | \`/health\`, \`/api/v1/health\` | Status and version |
| GET | \`/api/v1/products\` | List products |
| GET | \`/api/v1/products/:id\` | Get one product |

The catalogue is a fixed block in \`app.red\`; the service is read-only.

## Project structure

\`\`\`
app.red              # routing and JSON responses (no I/O)
main.red             # TCP server built on Red ports
tests/test-app.red   # tests for app.red
Dockerfile
\`\`\`

\`app.red\` turns the text of a request into the text of a response, so it can be
tested without a socket.

## Docker

\`\`\`bash
docker compose up --build
\`\`\`

The image downloads the toolchain from \`RED_URL\` (see the Dockerfile; override
it with \`--build-arg RED_URL=...\`).

## License

MIT
`
  }
};
