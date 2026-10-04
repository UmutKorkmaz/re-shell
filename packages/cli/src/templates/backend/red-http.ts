import { BackendTemplate } from '../types';

export const redHttpTemplate: BackendTemplate = {
  id: 'red-http',
  name: 'red-http',
  displayName: 'Red (HTTP)',
  description: 'Read-only JSON HTTP service in Red 0.6.x: routing in Red, sockets in Red/System over the C library, compiled to a native executable (32-bit toolchain)',
  language: 'red',
  framework: 'red',
  version: '1.0.0',
  tags: ['red', 'red-system', 'native', 'compiled', 'http', 'dsl'],
  port: 8080,
  dependencies: {},
  features: ['rest-api', 'cors', 'documentation', 'testing', 'docker'],

  files: {
    'app.red': `Red [
    Title: "{{projectName}} application logic"
    Purpose: "Request routing and JSON responses, independent of the network layer"
]

app-version: "1.0.0"

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
        select [
            200 "OK" 204 "No Content" 400 "Bad Request" 404 "Not Found"
            405 "Method Not Allowed" 500 "Internal Server Error"
        ] status
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
                "{^"status^":^"healthy^",^"version^":^"" app-version "^"}"
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
    Purpose: "Serves app.red over HTTP on a TCP socket"
]

#include %app.red

; Red 0.6.x has no TCP ports yet (full asynchronous I/O is planned for Red 0.7),
; so the socket layer is a few Red/System routines over the C library. Red builds
; 32-bit x86 executables on Linux, where every argument below is 32 bits wide.
#system-global [
    #import [
        "libc.so.6" cdecl [
            net-socket: "socket" [
                domain   [integer!]
                kind     [integer!]
                protocol [integer!]
                return:  [integer!]
            ]
            net-setsockopt: "setsockopt" [
                fd       [integer!]
                level    [integer!]
                option   [integer!]
                setting  [int-ptr!]
                bytes    [integer!]
                return:  [integer!]
            ]
            net-bind: "bind" [
                fd       [integer!]
                address  [byte-ptr!]
                bytes    [integer!]
                return:  [integer!]
            ]
            net-listen: "listen" [
                fd       [integer!]
                backlog  [integer!]
                return:  [integer!]
            ]
            net-accept: "accept" [
                fd       [integer!]
                address  [byte-ptr!]
                bytes    [int-ptr!]
                return:  [integer!]
            ]
            net-recv: "recv" [
                fd       [integer!]
                buffer   [byte-ptr!]
                bytes    [integer!]
                flags    [integer!]
                return:  [integer!]
            ]
            net-send: "send" [
                fd       [integer!]
                buffer   [byte-ptr!]
                bytes    [integer!]
                flags    [integer!]
                return:  [integer!]
            ]
            net-close: "close" [
                fd       [integer!]
                return:  [integer!]
            ]
        ]
    ]

    ;-- I/O buffer shared by the routines below (65536 bytes)
    tcp-buffer: allocate 65536
]

; Listen on port \`port\` on every interface: the socket descriptor, or -1.
tcp-listen: routine [
    port    [integer!]
    return: [integer!]
    /local
        fd      [integer!]
        one     [integer!]
        address [byte-ptr!]
        p       [byte-ptr!]
        status  [integer!]
][
    fd: net-socket 2 1 0                            ;-- AF_INET, SOCK_STREAM
    if fd < 0 [return -1]
    one: 1
    net-setsockopt fd 1 2 :one 4                    ;-- SOL_SOCKET, SO_REUSEADDR
    address: allocate 16                            ;-- struct sockaddr_in, zero-filled
    p: address
    loop 16 [p/value: as byte! 0  p: p + 1]
    address/1: as byte! 2                           ;-- sin_family: AF_INET (little-endian)
    address/3: as byte! ((port >> 8) and 255)       ;-- sin_port: network byte order
    address/4: as byte! (port and 255)
    status: net-bind fd address 16                  ;-- sin_addr stays 0.0.0.0
    free address
    if status < 0 [net-close fd return -1]
    if (net-listen fd 64) < 0 [net-close fd return -1]
    fd
]

; Wait for the next connection: its descriptor, or -1.
tcp-accept: routine [server [integer!] return: [integer!]][
    net-accept server null null
]

; Read up to 65536 bytes into the buffer: the byte count, 0 at end of stream, -1 on error.
tcp-receive: routine [fd [integer!] return: [integer!]][
    net-recv fd tcp-buffer 65536 0
]

; Write the first \`total\` bytes of the buffer: 0 once all are sent, -1 on error.
tcp-send: routine [
    fd      [integer!]
    total   [integer!]
    return: [integer!]
    /local
        sent    [integer!]
        n       [integer!]
][
    sent: 0
    while [sent < total][
        n: net-send fd (tcp-buffer + sent) (total - sent) 16384    ;-- MSG_NOSIGNAL (4000h)
        if n <= 0 [return -1]
        sent: sent + n
    ]
    0
]

tcp-close: routine [fd [integer!]][
    net-close fd
]

; Byte at offset \`pos\` (0-based) of the buffer.
buffer-byte: routine [pos [integer!] return: [integer!] /local p [byte-ptr!]][
    p: tcp-buffer + pos
    as integer! p/value
]

; Store \`octet\` (0-255) at offset \`pos\` (0-based) of the buffer.
buffer-set: routine [pos [integer!] octet [integer!] /local p [byte-ptr!]][
    p: tcp-buffer + pos
    p/value: as byte! octet
]

; Read the head of one request (the API is read-only, so a body is never needed).
read-request: function [client [integer!]][
    text: make string! 1024
    forever [
        received: tcp-receive client
        if received <= 0 [break]
        repeat i received [append text to-char buffer-byte i - 1]
        if any [find text "^M^/^M^/" (length? text) > 65536] [break]
    ]
    text
]

send-response: function [client [integer!] response [string!]][
    data: to-binary response
    while [not tail? data][
        chunk: min 65536 length? data
        repeat i chunk [buffer-set i - 1 pick data i]
        if (tcp-send client chunk) < 0 [exit]
        data: skip data chunk
    ]
]

port-number: any [attempt [to-integer get-env "PORT"] 8080]
server: tcp-listen port-number
if server < 0 [
    print rejoin ["cannot listen on port " port-number]
    quit/return 1
]
print rejoin ["{{projectName}} listening on http://localhost:" port-number]

forever [
    client: tcp-accept server
    if client >= 0 [
        request: read-request client
        request-line: copy request
        if eol: find request-line crlf [clear eol]
        print request-line
        response: any [
            attempt [handle-request request]
            error-response 500 "internal error"
        ]
        send-response client response
        tcp-close client
    ]
]
`,

    'tests/test-app.red': `Red [
    Title: "{{projectName}} tests"
    Purpose: "Exercises the routing logic without opening a socket"
]

#include %../app.red

results: copy []

contains?: func [text [string!] what [string!]][not none? find text what]

check-that: func [label [string!] ok [logic!]][
    append results ok
    print [either ok ["ok  "]["FAIL"] label]
]

get-request: func [target [string!]][
    rejoin ["GET " target " HTTP/1.1" crlf "Host: localhost" crlf crlf]
]

check-that "health returns 200" contains? handle-request get-request "/api/v1/health" "HTTP/1.1 200 OK"
check-that "health reports a status" contains? handle-request get-request "/health" "^"status^":^"healthy^""
check-that "product list has two products" contains? handle-request get-request "/api/v1/products" "^"count^":2"
check-that "query strings are ignored" contains? handle-request get-request "/api/v1/products?limit=1" "^"count^":2"
check-that "product 1 is returned" contains? handle-request get-request "/api/v1/products/1" "Sample Product 1"
check-that "unknown product is 404" contains? handle-request get-request "/api/v1/products/99" "HTTP/1.1 404 Not Found"
check-that "bad product id is 400" contains? handle-request get-request "/api/v1/products/abc" "HTTP/1.1 400 Bad Request"
check-that "unknown path is 404" contains? handle-request get-request "/nope" "HTTP/1.1 404 Not Found"
check-that "POST to the list is 405" contains? handle-request "POST /api/v1/products HTTP/1.1^M^/^M^/" "HTTP/1.1 405 Method Not Allowed"
check-that "garbage is 400" contains? handle-request "x" "HTTP/1.1 400 Bad Request"
check-that "Content-Length counts UTF-8 bytes" contains? http-response 200 "text/plain" "caf^(E9)" "Content-Length: 5^M^/"
check-that "strings are JSON-escaped" (json-string {a"b}) = {"a\\"b"}

either find results false [
    print "some tests failed"
    quit/return 1
][
    print "all tests passed"
]
`,

    '.gitignore': `# Compiled executables
bin/

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

# The Red toolchain and the executables it builds are 32-bit x86 programs, so a
# 64-bit system needs the 32-bit C library and libcurl (used by Red's runtime).
ARG RED_URL=https://static.red-lang.org/dl/linux/red-toolchain-066
RUN dpkg --add-architecture i386 \\
    && apt-get update \\
    && apt-get install -y --no-install-recommends ca-certificates curl libc6:i386 libcurl4t64:i386 \\
    && rm -rf /var/lib/apt/lists/* \\
    && curl -fsSL "$RED_URL" -o /usr/local/bin/red \\
    && chmod +x /usr/local/bin/red

WORKDIR /app
COPY . .
RUN mkdir -p bin && red -r -o bin/server main.red

ENV PORT=8080
EXPOSE 8080

CMD ["/app/bin/server"]
`,

    'README.md': `# {{projectName}}

A small read-only JSON HTTP service written in [Red](https://www.red-lang.org)
and compiled to a native executable.

- \`app.red\` - routing and JSON responses: turns the text of a request into the
  text of a response, so it is tested without a socket
- \`main.red\` - the server. Red 0.6.x has no TCP ports yet (full asynchronous
  I/O is planned for Red 0.7), so the socket layer is a few Red/System routines
  over the C library's socket API; everything else is Red
- \`tests/test-app.red\` - tests for \`app.red\`

## Requirements

The Red toolchain (stable 0.6.x, file \`red-toolchain-066\`). The \`red-cli\` and
\`red-view\` downloads are consoles (interpreters) and cannot compile.

On 64-bit Linux the toolchain and the executables it produces are 32-bit
programs, so install the 32-bit libraries first (Debian/Ubuntu):

\`\`\`bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install libc6:i386 libcurl4t64:i386   # libcurl4:i386 on releases before Ubuntu 24.04
\`\`\`

Download the toolchain for your platform from
<https://www.red-lang.org/p/download.html>, make it executable and put it on
your \`PATH\` as \`red\`.

## Commands

\`main.red\` contains Red/System routines, so it is compiled in release mode
(\`-r\`); the routines do not run in the interpreter.

\`\`\`bash
mkdir -p bin
red -r -o bin/server main.red                                  # compile
./bin/server                                                   # run (PORT defaults to 8080)

red -r -o bin/test-app tests/test-app.red && ./bin/test-app    # tests
\`\`\`

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | \`/\` | HTML landing page |
| GET | \`/health\`, \`/api/v1/health\` | Status and version |
| GET | \`/api/v1/products\` | List products |
| GET | \`/api/v1/products/:id\` | Get one product |

\`\`\`bash
curl http://localhost:8080/api/v1/products/1
\`\`\`

The catalogue is a fixed block in \`app.red\`; the service is read-only and
handles one connection at a time.

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
