import { BackendTemplate } from '../types';

export const mojoTemplate: BackendTemplate = {
  id: 'mojo',
  name: 'mojo',
  displayName: 'Mojo (Python Interop)',
  description: 'Mojo HTTP service with SIMD vector kernels and Python interop (Mojo 1.x, pixi or pip)',
  language: 'mojo',
  framework: 'mojo',
  version: '1.0.0',
  tags: ['mojo', 'python', 'ai', 'ml', 'simd', 'performance', 'interop'],
  port: 8080,
  dependencies: {},
  features: ['rest-api', 'validation', 'logging', 'cors', 'documentation', 'testing', 'simd', 'performance', 'python-interop', 'docker'],

  files: {
    'benchmarks/bench_simd.mojo': `# {{projectName}} - SIMD benchmark: vectorised vs scalar dot product
from std.time import perf_counter_ns

from src.simd_ops import WIDTH, dot, dot_scalar


def main() raises:
    var n = 1_000_000
    var a = List[Float64](length=n, fill=1.5)
    var b = List[Float64](length=n, fill=2.0)
    var repeats = 50

    print("elements:", n, "repeats:", repeats, "simd width (f64):", WIDTH)

    var sink: Float64 = 0
    var start = perf_counter_ns()
    for _ in range(repeats):
        sink += dot_scalar(a, b)
    var scalar_ns = perf_counter_ns() - start

    start = perf_counter_ns()
    for _ in range(repeats):
        sink += dot(a, b)
    var simd_ns = perf_counter_ns() - start

    print("scalar dot:", scalar_ns // repeats, "ns per call")
    print("simd dot:  ", simd_ns // repeats, "ns per call")
    if simd_ns > 0:
        print("speedup:   ", Float64(scalar_ns) / Float64(simd_ns), "x")
    print("checksum:  ", sink)
`,

    'examples/simd_examples.mojo': `# {{projectName}} - SIMD usage examples
from std.math import sqrt

from src.simd_ops import WIDTH, add, dot, norm, scale, sum_all


def show(label: String, values: List[Float64]):
    var text = String(label, ": [")
    for i in range(len(values)):
        if i > 0:
            text += ", "
        text += String(values[i])
    print(text + "]")


def main() raises:
    print("native SIMD width for Float64:", WIDTH, "lanes")

    # Fixed-width SIMD values behave like scalars that operate on every lane.
    var lanes = SIMD[DType.float64, 4](1.0, 2.0, 3.0, 4.0)
    print("lanes * 2 =", lanes * 2.0)
    print("sqrt(lanes) =", sqrt(lanes))
    print("sum of lanes =", lanes.reduce_add())

    # Vector kernels from src/simd_ops.mojo work on lists of any length.
    var a = List[Float64]()
    var b = List[Float64]()
    for i in range(10):
        a.append(Float64(i))
        b.append(Float64(i) * 0.5)

    show("a + b", add(a, b))
    show("a * 3", scale(a, 3.0))
    print("a . b =", dot(a, b))
    print("sum(a) =", sum_all(a))
    print("|a| =", norm(a))
`,

    'main.mojo': `# {{projectName}} - Mojo HTTP service
#
# The HTTP transport is Python's \`socket\` module driven from Mojo (Mojo's
# standard library has no networking yet); request parsing, routing, the data
# store and the SIMD kernels are all Mojo.
from std.os import getenv
from std.python import Python, PythonObject
from std.time import perf_counter_ns

from src.http import (
    Request,
    Response,
    parse_request,
    content_length,
    format_response,
)
from src.simd_ops import WIDTH, dot, norm, sum_all

comptime VERSION = "1.0.0"
comptime JSON = "application/json"


struct Product(Copyable, Movable):
    var id: Int
    var name: String
    var description: String
    var price: Float64
    var stock: Int

    def __init__(
        out self,
        id: Int,
        name: String,
        description: String,
        price: Float64,
        stock: Int,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.price = price
        self.stock = stock


struct Store(Movable):
    """In-memory product catalogue."""

    var products: List[Product]
    var next_id: Int

    def __init__(out self):
        self.products = List[Product]()
        self.next_id = 1
        _ = self.add("Sample Product 1", "This is a sample product", 29.99, 100)
        _ = self.add("Sample Product 2", "Another sample product", 49.99, 50)

    def add(mut self, name: String, description: String, price: Float64, stock: Int) -> Int:
        var id = self.next_id
        self.next_id += 1
        self.products.append(Product(id, name, description, price, stock))
        return id

    def find(self, id: Int) -> Int:
        """Index of the product with this id, or -1."""
        for i in range(len(self.products)):
            if self.products[i].id == id:
                return i
        return -1


def product_json(p: Product) raises -> PythonObject:
    var d = Python.dict()
    d["id"] = p.id
    d["name"] = p.name
    d["description"] = p.description
    d["price"] = p.price
    d["stock"] = p.stock
    return d


def json_response(status: Int, payload: PythonObject) raises -> Response:
    var json = Python.import_module("json")
    return Response(status, JSON, String(json.dumps(payload)))


def error_response(status: Int, message: String) raises -> Response:
    var d = Python.dict()
    d["error"] = message
    return json_response(status, d)


def floats(values: PythonObject) raises -> List[Float64]:
    var out = List[Float64]()
    for v in values:
        out.append(Float64(py=v))
    return out^


def home() -> Response:
    var html = String(
        "<!DOCTYPE html><html><head><title>{{projectName}}</title></head><body>"
        "<h1>{{projectName}}</h1><p>Mojo HTTP service with SIMD kernels.</p>"
        '<p>Try <a href="/api/v1/health">/api/v1/health</a> or'
        ' <a href="/api/v1/products">/api/v1/products</a>.</p></body></html>'
    )
    return Response(200, "text/html; charset=utf-8", html)


def health(started_ns: Int) raises -> Response:
    var d = Python.dict()
    d["status"] = "healthy"
    d["version"] = VERSION
    d["simd_width_f64"] = WIDTH
    d["uptime_ms"] = Int((perf_counter_ns() - started_ns) // 1_000_000)
    return json_response(200, d)


def list_products(store: Store) raises -> Response:
    var items = Python.list()
    for i in range(len(store.products)):
        items.append(product_json(store.products[i]))
    var d = Python.dict()
    d["products"] = items
    d["count"] = len(store.products)
    return json_response(200, d)


def create_product(mut store: Store, body: String) raises -> Response:
    var json = Python.import_module("json")
    var data = json.loads(body)
    if not Bool(py=data.__contains__("name")) or not Bool(py=data.__contains__("price")):
        return error_response(400, "name and price are required")
    var name = String(data["name"])
    var price = Float64(py=data["price"])
    if name.byte_length() == 0 or price < 0:
        return error_response(400, "name must not be empty and price must not be negative")
    var description = String("")
    if Bool(py=data.__contains__("description")):
        description = String(data["description"])
    var stock = 0
    if Bool(py=data.__contains__("stock")):
        stock = Int(py=data["stock"])
    var id = store.add(name, description, price, stock)
    var d = Python.dict()
    d["product"] = product_json(store.products[store.find(id)])
    return json_response(201, d)


def simd_dot(body: String) raises -> Response:
    var json = Python.import_module("json")
    var data = json.loads(body)
    var a = floats(data["a"])
    var b = floats(data["b"])
    if len(a) != len(b):
        return error_response(400, "a and b must have the same length")
    var start = perf_counter_ns()
    var result = dot(a, b)
    var elapsed_ns = perf_counter_ns() - start
    var d = Python.dict()
    d["dot"] = result
    d["length"] = len(a)
    d["norm_a"] = norm(a)
    d["sum_a"] = sum_all(a)
    d["elapsed_ns"] = Int(elapsed_ns)
    return json_response(200, d)


def route(request: Request, mut store: Store, started_ns: Int) raises -> Response:
    var path = request.path
    var method = request.method
    if method == "OPTIONS":
        return Response(204, JSON, "")
    if path == "/":
        return home()
    if path == "/api/v1/health" or path == "/health":
        return health(started_ns)
    if path == "/api/v1/products":
        if method == "GET":
            return list_products(store)
        if method == "POST":
            return create_product(store, request.body)
        return error_response(405, "method not allowed")
    if path.startswith("/api/v1/products/"):
        var id: Int
        try:
            id = Int(String(path[byte=17:]))
        except:
            return error_response(400, "invalid product id")
        var idx = store.find(id)
        if idx < 0:
            return error_response(404, "product not found")
        if method == "GET":
            var d = Python.dict()
            d["product"] = product_json(store.products[idx])
            return json_response(200, d)
        if method == "DELETE":
            _ = store.products.pop(idx)
            return Response(204, JSON, "")
        return error_response(405, "method not allowed")
    if path == "/api/v1/simd/dot":
        if method == "POST":
            return simd_dot(request.body)
        return error_response(405, "method not allowed")
    return error_response(404, "not found")


def read_request(conn: PythonObject) raises -> String:
    """Read one complete HTTP request (headers plus Content-Length bytes)."""
    var data = Python.evaluate("b''")
    while True:
        var chunk = conn.recv(65536)
        if Int(py=len(chunk)) == 0:
            break
        data = data + chunk
        var text = String(data.decode("utf-8", "replace"))
        var end = text.find("\\r\\n\\r\\n")
        if end >= 0:
            var want = content_length(String(text[byte=:end]))
            if Int(py=len(data)) >= end + 4 + want:
                break
        if Int(py=len(data)) > 1_048_576:
            break
    return String(data.decode("utf-8", "replace"))


def serve(conn: PythonObject, mut store: Store, started_ns: Int) raises:
    var response: Response
    try:
        var request = parse_request(read_request(conn))
        print(request.method, request.path)
        response = route(request, store, started_ns)
    except e:
        response = error_response(400, String(e))
    var wire = PythonObject(format_response(response))
    conn.sendall(wire.encode("utf-8"))


def main() raises:
    var port = 8080
    var configured = getenv("PORT")
    if configured.byte_length() > 0:
        port = Int(configured)

    var socket = Python.import_module("socket")
    var server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(Python.tuple("0.0.0.0", port))
    server.listen(64)

    var store = Store()
    var started_ns = perf_counter_ns()
    print("{{projectName}} listening on http://localhost:" + String(port))
    while True:
        var accepted = server.accept()
        var conn = accepted[0]
        try:
            serve(conn, store, started_ns)
        except e:
            print("request failed:", e)
        conn.close()
`,

    'pixi.toml': `[workspace]
name = "{{projectName}}"
version = "1.0.0"
description = "Mojo HTTP service with SIMD kernels"
channels = ["https://conda.modular.com/max", "conda-forge"]
platforms = ["linux-64", "linux-aarch64", "osx-arm64"]

[dependencies]
mojo = ">=1.0.0,<2"

[tasks]
build = "mkdir -p bin && mojo build main.mojo -I . -o bin/server"
start = "mojo run -I . main.mojo"
test = "mojo run -I . tests/test_simd_ops.mojo && mojo run -I . tests/test_http.mojo"
examples = "mojo run -I . examples/simd_examples.mojo"
bench = "mojo run -I . benchmarks/bench_simd.mojo"
`,

    'src/__init__.mojo': `"""{{projectName}} application package."""
`,

    'src/http.mojo': `"""Minimal HTTP/1.1 request parsing and response formatting."""


struct Request(Copyable, Movable):
    var method: String
    var path: String
    var body: String

    def __init__(out self, method: String, path: String, body: String):
        self.method = method
        self.path = path
        self.body = body


struct Response(Copyable, Movable):
    var status: Int
    var content_type: String
    var body: String

    def __init__(out self, status: Int, content_type: String, body: String):
        self.status = status
        self.content_type = content_type
        self.body = body


def reason_phrase(status: Int) -> String:
    if status == 200:
        return "OK"
    if status == 201:
        return "Created"
    if status == 204:
        return "No Content"
    if status == 400:
        return "Bad Request"
    if status == 404:
        return "Not Found"
    if status == 405:
        return "Method Not Allowed"
    return "Internal Server Error"


def parse_request(raw: String) raises -> Request:
    """Parse a raw HTTP request (request line, headers, optional body)."""
    var split_at = raw.find("\\r\\n\\r\\n")
    var head = raw
    var body = String("")
    if split_at >= 0:
        head = String(raw[byte=:split_at])
        body = String(raw[byte = split_at + 4 :])
    var first_line = head
    var eol = head.find("\\r\\n")
    if eol >= 0:
        first_line = String(head[byte=:eol])
    var parts = first_line.split(" ")
    if len(parts) < 2:
        raise Error("malformed request line")
    var full_target = String(parts[1])
    var target = full_target
    var q = full_target.find("?")
    if q >= 0:
        target = String(full_target[byte=:q])
    return Request(String(parts[0]), target, body)


def content_length(raw_head: String) -> Int:
    """Value of the Content-Length header, or 0 when it is absent."""
    for line in raw_head.split("\\r\\n"):
        var lower = String(line).lower()
        if lower.startswith("content-length:"):
            try:
                return Int(String(String(line)[byte=15:]).strip())
            except:
                return 0
    return 0


def format_response(response: Response) -> String:
    """Serialise a response, with permissive CORS headers."""
    var out = String("HTTP/1.1 ", response.status, " ", reason_phrase(response.status), "\\r\\n")
    out += String("Content-Type: ", response.content_type, "\\r\\n")
    out += String("Content-Length: ", len(response.body.as_bytes()), "\\r\\n")
    out += "Access-Control-Allow-Origin: *\\r\\n"
    out += "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\\r\\n"
    out += "Access-Control-Allow-Headers: Content-Type\\r\\n"
    out += "Connection: close\\r\\n\\r\\n"
    out += response.body
    return out^
`,

    'src/simd_ops.mojo': `"""SIMD vector kernels for {{projectName}}.

Every kernel processes \`WIDTH\` lanes per iteration, where WIDTH is the native
SIMD width of the machine for the element type, and finishes the tail with a
scalar loop.
"""

from std.math import sqrt
from std.sys import simd_width_of

comptime DT = DType.float64
comptime WIDTH = simd_width_of[DT]()


def add(a: List[Float64], b: List[Float64]) raises -> List[Float64]:
    """Element-wise sum of two equally sized vectors."""
    if len(a) != len(b):
        raise Error("vectors must have the same length")
    var n = len(a)
    var out = List[Float64](length=n, fill=0.0)
    var pa = a.unsafe_ptr()
    var pb = b.unsafe_ptr()
    var po = out.unsafe_ptr()
    var i = 0
    while i + WIDTH <= n:
        po.unsafe_store(i, pa.unsafe_load[width=WIDTH](i) + pb.unsafe_load[width=WIDTH](i))
        i += WIDTH
    while i < n:
        out[i] = a[i] + b[i]
        i += 1
    return out^


def scale(a: List[Float64], factor: Float64) -> List[Float64]:
    """Multiply every element of a vector by a scalar."""
    var n = len(a)
    var out = List[Float64](length=n, fill=0.0)
    var pa = a.unsafe_ptr()
    var po = out.unsafe_ptr()
    var i = 0
    while i + WIDTH <= n:
        po.unsafe_store(i, pa.unsafe_load[width=WIDTH](i) * factor)
        i += WIDTH
    while i < n:
        out[i] = a[i] * factor
        i += 1
    return out^


def dot(a: List[Float64], b: List[Float64]) raises -> Float64:
    """Dot product of two equally sized vectors."""
    if len(a) != len(b):
        raise Error("vectors must have the same length")
    var n = len(a)
    var pa = a.unsafe_ptr()
    var pb = b.unsafe_ptr()
    var acc = SIMD[DT, WIDTH](0)
    var i = 0
    while i + WIDTH <= n:
        acc += pa.unsafe_load[width=WIDTH](i) * pb.unsafe_load[width=WIDTH](i)
        i += WIDTH
    var total = acc.reduce_add()
    while i < n:
        total += a[i] * b[i]
        i += 1
    return total


def sum_all(a: List[Float64]) -> Float64:
    """Sum of all elements."""
    var n = len(a)
    var pa = a.unsafe_ptr()
    var acc = SIMD[DT, WIDTH](0)
    var i = 0
    while i + WIDTH <= n:
        acc += pa.unsafe_load[width=WIDTH](i)
        i += WIDTH
    var total = acc.reduce_add()
    while i < n:
        total += a[i]
        i += 1
    return total


def norm(a: List[Float64]) raises -> Float64:
    """Euclidean (L2) norm."""
    return sqrt(dot(a, a))


def dot_scalar(a: List[Float64], b: List[Float64]) raises -> Float64:
    """Reference scalar dot product (used by the tests and the benchmark)."""
    if len(a) != len(b):
        raise Error("vectors must have the same length")
    var total: Float64 = 0
    for i in range(len(a)):
        total += a[i] * b[i]
    return total
`,

    'tests/test_http.mojo': `from std.testing import assert_equal, assert_true

from src.http import Response, parse_request, format_response, content_length


def test_parse_get() raises:
    var req = parse_request("GET /api/v1/products?limit=2 HTTP/1.1\\r\\nHost: localhost\\r\\n\\r\\n")
    assert_equal(req.method, "GET")
    assert_equal(req.path, "/api/v1/products")
    assert_equal(req.body, "")


def test_parse_post_body() raises:
    var req = parse_request(
        'POST /api/v1/simd/dot HTTP/1.1\\r\\nContent-Length: 7\\r\\n\\r\\n{"a":1}'
    )
    assert_equal(req.method, "POST")
    assert_equal(req.body, '{"a":1}')


def test_content_length() raises:
    assert_equal(content_length("POST / HTTP/1.1\\r\\ncontent-length: 42\\r\\nHost: x"), 42)
    assert_equal(content_length("GET / HTTP/1.1\\r\\nHost: x"), 0)


def test_format_response() raises:
    var text = format_response(Response(200, "application/json", '{"ok":true}'))
    assert_true(text.startswith("HTTP/1.1 200 OK\\r\\n"))
    assert_true("Content-Length: 11\\r\\n" in text)
    assert_true(text.endswith('{"ok":true}'))


def main() raises:
    test_parse_get()
    test_parse_post_body()
    test_content_length()
    test_format_response()
    print("http: all tests passed")
`,

    'tests/test_simd_ops.mojo': `from std.testing import assert_equal, assert_raises

from src.simd_ops import add, scale, dot, dot_scalar, sum_all, norm


def make(n: Int, step: Float64) -> List[Float64]:
    var v = List[Float64](capacity=n)
    for i in range(n):
        v.append(Float64(i) * step)
    return v^


def test_add() raises:
    var out = add(make(11, 1.0), make(11, 2.0))
    for i in range(11):
        assert_equal(out[i], Float64(i) * 3.0)


def test_scale() raises:
    var out = scale(make(13, 1.0), 0.5)
    for i in range(13):
        assert_equal(out[i], Float64(i) * 0.5)


def test_dot_matches_scalar_reference() raises:
    # 37 is not a multiple of any SIMD width, so the tail loop is exercised.
    var a = make(37, 1.0)
    var b = make(37, 0.5)
    assert_equal(dot(a, b), dot_scalar(a, b))


def test_sum_and_norm() raises:
    var v = List[Float64]()
    v.append(3.0)
    v.append(4.0)
    assert_equal(sum_all(v), 7.0)
    assert_equal(norm(v), 5.0)


def test_length_mismatch_raises() raises:
    with assert_raises():
        _ = dot(make(3, 1.0), make(4, 1.0))


def main() raises:
    test_add()
    test_scale()
    test_dot_matches_scalar_reference()
    test_sum_and_norm()
    test_length_mismatch_raises()
    print("simd_ops: all tests passed")
`,

    '.gitignore': `# Build output
bin/
build/
dist/
*.so
*.o

# Pixi / Python environments
.pixi/
.venv/
__pycache__/

# Environment
.env
.env.local

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

    'Dockerfile': `FROM python:3.12-slim

# The Mojo compiler is published on PyPI; build-essential provides the system
# linker libraries that \`mojo build\` needs to produce a native executable.
RUN apt-get update \\
    && apt-get install -y --no-install-recommends build-essential \\
    && rm -rf /var/lib/apt/lists/* \\
    && pip install --no-cache-dir mojo

WORKDIR /app
COPY . .
RUN mkdir -p bin && mojo build main.mojo -I . -o bin/server

ENV PORT=8080
EXPOSE 8080

CMD ["./bin/server"]
`,

    'README.md': `# {{projectName}}

A small HTTP service written in [Mojo](https://www.modular.com/mojo) 1.x with
SIMD vector kernels.

Mojo's standard library has no networking yet, so the transport is Python's
\`socket\` module driven from Mojo through Python interop. Request parsing,
routing, the in-memory store and the SIMD kernels are Mojo.

## Requirements

- Mojo 1.x (\`mojo\` 1.0 or newer) and a Python 3 interpreter
- Linux (x86-64 or arm64) or macOS (Apple silicon)

Install the compiler with [pixi](https://pixi.sh) (recommended):

\`\`\`bash
pixi install
\`\`\`

or from PyPI into a virtual environment:

\`\`\`bash
python3 -m venv .venv && . .venv/bin/activate
pip install mojo
\`\`\`

## Commands

With pixi the same commands are available as tasks (\`pixi run build\`, ...):

\`\`\`bash
mkdir -p bin && mojo build main.mojo -I . -o bin/server   # compile
./bin/server                                              # run (PORT defaults to 8080)
mojo run -I . main.mojo                                   # or run without compiling

mojo run -I . tests/test_simd_ops.mojo                    # tests
mojo run -I . tests/test_http.mojo
mojo run -I . examples/simd_examples.mojo                 # examples
mojo run -I . benchmarks/bench_simd.mojo                  # SIMD vs scalar benchmark
\`\`\`

\`-I .\` makes the local \`src\` package importable.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | \`/\` | HTML landing page |
| GET | \`/api/v1/health\` | Status, version, SIMD width and uptime |
| GET | \`/api/v1/products\` | List products |
| POST | \`/api/v1/products\` | Create a product (\`name\`, \`price\`, optional \`description\`, \`stock\`) |
| GET | \`/api/v1/products/:id\` | Get one product |
| DELETE | \`/api/v1/products/:id\` | Delete a product |
| POST | \`/api/v1/simd/dot\` | Dot product of two vectors: \`{"a": [...], "b": [...]}\` |

\`\`\`bash
curl http://localhost:8080/api/v1/health
curl -X POST http://localhost:8080/api/v1/simd/dot \\
  -H 'Content-Type: application/json' -d '{"a": [1, 2, 3], "b": [4, 5, 6]}'
\`\`\`

The product store is held in memory and resets when the server restarts. The
server handles one connection at a time.

## Project structure

\`\`\`
main.mojo                  # server, routes and in-memory store
src/http.mojo              # request parsing and response formatting
src/simd_ops.mojo          # SIMD kernels (add, scale, dot, sum, norm)
tests/                     # test programs (std.testing)
examples/simd_examples.mojo
benchmarks/bench_simd.mojo
pixi.toml                  # Mojo toolchain and tasks
Dockerfile
\`\`\`

## Docker

\`\`\`bash
docker compose up --build
\`\`\`

## License

MIT
`
  }
};
