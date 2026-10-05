import { BackendTemplate } from '../types';

export const happyxNimTemplate: BackendTemplate = {
  id: 'happyx-nim',
  name: 'happyx-nim',
  displayName: 'HappyX (Nim)',
  description: 'HappyX web framework for Nim: JWT authentication, product CRUD, CORS and an echo WebSocket over an in-memory store',
  language: 'nim',
  framework: 'happyx',
  version: '1.0.0',
  tags: ['nim', 'happyx', 'api', 'rest', 'jwt', 'websocket'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'validation', 'cors', 'websockets'],
  files: {
    '{{projectNameSnake}}.nimble': `# Package

version       = "0.1.0"
author        = "{{author}}"
description   = "REST API built with HappyX"
license       = "MIT"
srcDir        = "src"
bin           = @["{{projectNameSnake}}"]

# Dependencies

requires "nim >= 2.0.0"
# 4.7.4 is the version resolved on hosted CI (Nim 2.0.16, nimble 0.16.4); ^= stays within 4.x. Bump deliberately.
requires "happyx ^= 4.7.4"
`,

    'src/{{projectNameSnake}}.nim': `import std/[httpcore, json, options]
import happyx
import {{projectNameSnake}}/api

## HTTP layer: HappyX routes only translate requests and responses. The
## business logic lives in {{projectNameSnake}}/api so it can be unit tested
## without a running server (see tests/).

const
  host {.strdefine.} = "0.0.0.0"
  port {.intdefine.} = 5000

# HappyX's request type depends on the server backend: the built-in server
# (the default) and httpx return Option values for the headers and the body,
# asynchttpserver (-d:stdserver) plain values. These helpers accept both.

proc bearerHeader[R](req: R): string =
  ## The raw Authorization header, or "" when the request has none.
  let headers =
    when typeof(req.headers) is Option[HttpHeaders]:
      req.headers.get(newHttpHeaders())
    else:
      req.headers
  if headers.hasKey("Authorization"):
    let value: string = headers["Authorization"]
    result = value

proc requestBody[R](req: R): string =
  ## The raw request body, or "" when the request has none.
  when typeof(req.body) is Option[string]:
    req.body.get("")
  else:
    req.body

regCORS:
  origins: "*"
  methods: "*"
  headers: "*"
  credentials: false

serve host, port:
  get "/api/v1/health":
    let r = api.health()
    statusCode = r.code
    return r.body

  post "/api/v1/auth/register":
    let r = api.register(requestBody(req))
    statusCode = r.code
    return r.body

  post "/api/v1/auth/login":
    let r = api.login(requestBody(req))
    statusCode = r.code
    return r.body

  get "/api/v1/auth/me":
    let r = api.currentUser(bearerHeader(req))
    statusCode = r.code
    return r.body

  get "/api/v1/products":
    let r = api.listProducts()
    statusCode = r.code
    return r.body

  post "/api/v1/products":
    let r = api.createProduct(bearerHeader(req), requestBody(req))
    statusCode = r.code
    return r.body

  get "/api/v1/products/{id:int}":
    let r = api.getProduct(id)
    statusCode = r.code
    return r.body

  put "/api/v1/products/{id:int}":
    let r = api.updateProduct(bearerHeader(req), id, requestBody(req))
    statusCode = r.code
    return r.body

  delete "/api/v1/products/{id:int}":
    let r = api.deleteProduct(bearerHeader(req), id)
    statusCode = r.code
    return r.body

  # Echo WebSocket: connect to ws://localhost:5000/ws
  ws "/ws":
    await wsClient.send("Echo: " & wsData)
`,

    'src/{{projectNameSnake}}/api.nim': `## Transport independent API layer: every handler takes plain strings and
## returns an HTTP status code with a JSON body, so the web framework only has
## to translate requests and responses (see the main module).
##
## State is kept in memory behind a lock; swap \`users\` and \`products\` for a
## database (for example db_connector or norm) when you need persistence.

import std/[json, locks, options, os, strutils, times]
import ./security

type
  ApiResult* = tuple[code: int, body: JsonNode]

  User = object
    id: int
    email: string
    name: string
    passwordHash: string
    createdAt: string

  Product = object
    id: int
    name: string
    description: string
    price: float
    stock: int
    createdAt: string
    updatedAt: string

var
  storeLock: Lock
  users: seq[User]
  products: seq[Product]
  nextUserId = 1
  nextProductId = 1

initLock(storeLock)

template locked(body: untyped) =
  {.cast(gcsafe).}:
    withLock storeLock:
      body

proc timestamp(): string =
  now().utc.format("yyyy-MM-dd'T'HH:mm:ss'Z'")

proc jwtSecret(): string =
  getEnv("JWT_SECRET", "change-me-in-production")

proc failure(code: int, error, message: string): ApiResult =
  (code, %*{"error": error, "message": message})

proc parseObject(body: string): Option[JsonNode] =
  try:
    let node = parseJson(body)
    if node.kind == JObject:
      return some(node)
  except CatchableError:
    discard
  none(JsonNode)

proc publicUser(user: User): JsonNode =
  %*{"id": user.id, "email": user.email, "name": user.name,
     "createdAt": user.createdAt}

proc toJson(product: Product): JsonNode =
  %*{"id": product.id, "name": product.name,
     "description": product.description, "price": product.price,
     "stock": product.stock, "createdAt": product.createdAt,
     "updatedAt": product.updatedAt}

proc bearerToken(authorization: string): string =
  const prefix = "Bearer "
  if authorization.len > prefix.len and
      authorization[0 ..< prefix.len].toLowerAscii() == "bearer ":
    result = authorization[prefix.len .. ^1].strip()

proc authenticatedUserId(authorization: string): int =
  ## Returns the id of the user the Authorization header belongs to, or 0.
  let token = bearerToken(authorization)
  if token.len == 0:
    return 0
  let id = verifyToken(jwtSecret(), token)
  if id == 0:
    return 0
  locked:
    for user in users:
      if user.id == id:
        return id
  0

proc unauthorized(): ApiResult =
  failure(401, "unauthorized", "A valid bearer token is required")

# --- Health -------------------------------------------------------------------

proc health*(): ApiResult =
  (200, %*{"status": "healthy", "timestamp": timestamp(), "version": "1.0.0"})

# --- Authentication -----------------------------------------------------------

proc register*(body: string): ApiResult =
  let parsed = parseObject(body)
  if parsed.isNone:
    return failure(400, "parse_error", "Request body must be a JSON object")
  let node = parsed.get
  let email = node{"email"}.getStr().strip().toLowerAscii()
  let name = node{"name"}.getStr().strip()
  let password = node{"password"}.getStr()
  if '@' notin email or name.len == 0:
    return failure(400, "validation_error", "A valid email and a name are required")
  if password.len < 8:
    return failure(400, "validation_error", "Password must be at least 8 characters")

  let passwordHash = hashPassword(password)
  locked:
    for user in users:
      if user.email == email:
        return failure(409, "conflict", "A user with this email already exists")
    let user = User(id: nextUserId, email: email, name: name,
                    passwordHash: passwordHash, createdAt: timestamp())
    inc nextUserId
    users.add user
    return (201, %*{"user": publicUser(user)})

proc login*(body: string): ApiResult =
  let parsed = parseObject(body)
  if parsed.isNone:
    return failure(400, "parse_error", "Request body must be a JSON object")
  let node = parsed.get
  let email = node{"email"}.getStr().strip().toLowerAscii()
  let password = node{"password"}.getStr()

  var found = false
  var user: User
  locked:
    for candidate in users:
      if candidate.email == email:
        user = candidate
        found = true
        break
  if not found or not verifyPassword(password, user.passwordHash):
    return failure(401, "unauthorized", "Invalid email or password")
  (200, %*{"token": signToken(jwtSecret(), user.id), "user": publicUser(user)})

proc currentUser*(authorization: string): ApiResult =
  let id = authenticatedUserId(authorization)
  if id == 0:
    return unauthorized()
  locked:
    for user in users:
      if user.id == id:
        return (200, %*{"user": publicUser(user)})
  unauthorized()

# --- Products -------------------------------------------------------------------

proc listProducts*(): ApiResult =
  var list = newJArray()
  locked:
    for product in products:
      list.add product.toJson
  (200, %*{"products": list, "count": list.len})

proc getProduct*(id: int): ApiResult =
  locked:
    for product in products:
      if product.id == id:
        return (200, %*{"product": product.toJson})
  failure(404, "not_found", "Product not found")

proc validProductFields(node: JsonNode, requireName: bool): string =
  ## Returns an error message, or "" when the fields are acceptable.
  if requireName and node{"name"}.getStr().strip().len == 0:
    return "name is required"
  if node.hasKey("price") and
      (node["price"].kind notin {JInt, JFloat} or node["price"].getFloat() < 0):
    return "price must be a non-negative number"
  if node.hasKey("stock") and (node["stock"].kind != JInt or node["stock"].getInt() < 0):
    return "stock must be a non-negative integer"
  ""

proc createProduct*(authorization, body: string): ApiResult =
  if authenticatedUserId(authorization) == 0:
    return unauthorized()
  let parsed = parseObject(body)
  if parsed.isNone:
    return failure(400, "parse_error", "Request body must be a JSON object")
  let node = parsed.get
  let problem = validProductFields(node, requireName = true)
  if problem.len > 0:
    return failure(400, "validation_error", problem)

  locked:
    let stamp = timestamp()
    let product = Product(
      id: nextProductId,
      name: node["name"].getStr().strip(),
      description: node{"description"}.getStr(),
      price: node{"price"}.getFloat(),
      stock: node{"stock"}.getInt(),
      createdAt: stamp,
      updatedAt: stamp)
    inc nextProductId
    products.add product
    return (201, %*{"product": product.toJson})

proc updateProduct*(authorization: string, id: int, body: string): ApiResult =
  if authenticatedUserId(authorization) == 0:
    return unauthorized()
  let parsed = parseObject(body)
  if parsed.isNone:
    return failure(400, "parse_error", "Request body must be a JSON object")
  let node = parsed.get
  let problem = validProductFields(node, requireName = false)
  if problem.len > 0:
    return failure(400, "validation_error", problem)

  locked:
    for product in products.mitems:
      if product.id == id:
        if node.hasKey("name") and node["name"].getStr().strip().len > 0:
          product.name = node["name"].getStr().strip()
        if node.hasKey("description"):
          product.description = node["description"].getStr()
        if node.hasKey("price"):
          product.price = node["price"].getFloat()
        if node.hasKey("stock"):
          product.stock = node["stock"].getInt()
        product.updatedAt = timestamp()
        return (200, %*{"product": product.toJson})
  failure(404, "not_found", "Product not found")

proc deleteProduct*(authorization: string, id: int): ApiResult =
  if authenticatedUserId(authorization) == 0:
    return unauthorized()
  locked:
    for index in 0 ..< products.len:
      if products[index].id == id:
        products.delete(index)
        return (200, %*{"deleted": true, "id": id})
  failure(404, "not_found", "Product not found")
`,

    'src/{{projectNameSnake}}/security.nim': `## Dependency-free security helpers built on the Nim standard library only:
## HS256 JSON Web Tokens and salted PBKDF2-HMAC-SHA256 password hashing.
##
## SHA-256 and HMAC are implemented here (FIPS 180-4 / RFC 2104) so the
## template builds without extra packages. For a production service swap this
## module for an audited library such as nimcrypto.

import std/[base64, json, strutils, times, sysrand]

const
  Sha256Size = 32
  BlockSize = 64
  PasswordIterations = 10_000

  K256: array[64, uint32] = [
    0x428a2f98'u32, 0x71374491'u32, 0xb5c0fbcf'u32, 0xe9b5dba5'u32,
    0x3956c25b'u32, 0x59f111f1'u32, 0x923f82a4'u32, 0xab1c5ed5'u32,
    0xd807aa98'u32, 0x12835b01'u32, 0x243185be'u32, 0x550c7dc3'u32,
    0x72be5d74'u32, 0x80deb1fe'u32, 0x9bdc06a7'u32, 0xc19bf174'u32,
    0xe49b69c1'u32, 0xefbe4786'u32, 0x0fc19dc6'u32, 0x240ca1cc'u32,
    0x2de92c6f'u32, 0x4a7484aa'u32, 0x5cb0a9dc'u32, 0x76f988da'u32,
    0x983e5152'u32, 0xa831c66d'u32, 0xb00327c8'u32, 0xbf597fc7'u32,
    0xc6e00bf3'u32, 0xd5a79147'u32, 0x06ca6351'u32, 0x14292967'u32,
    0x27b70a85'u32, 0x2e1b2138'u32, 0x4d2c6dfc'u32, 0x53380d13'u32,
    0x650a7354'u32, 0x766a0abb'u32, 0x81c2c92e'u32, 0x92722c85'u32,
    0xa2bfe8a1'u32, 0xa81a664b'u32, 0xc24b8b70'u32, 0xc76c51a3'u32,
    0xd192e819'u32, 0xd6990624'u32, 0xf40e3585'u32, 0x106aa070'u32,
    0x19a4c116'u32, 0x1e376c08'u32, 0x2748774c'u32, 0x34b0bcb5'u32,
    0x391c0cb3'u32, 0x4ed8aa4a'u32, 0x5b9cca4f'u32, 0x682e6ff3'u32,
    0x748f82ee'u32, 0x78a5636f'u32, 0x84c87814'u32, 0x8cc70208'u32,
    0x90befffa'u32, 0xa4506ceb'u32, 0xbef9a3f7'u32, 0xc67178f2'u32]

type
  Digest = array[Sha256Size, byte]

func rotr(x: uint32, n: int): uint32 {.inline.} =
  (x shr n) or (x shl (32 - n))

proc sha256(data: openArray[byte]): Digest =
  var h: array[8, uint32] = [
    0x6a09e667'u32, 0xbb67ae85'u32, 0x3c6ef372'u32, 0xa54ff53a'u32,
    0x510e527f'u32, 0x9b05688c'u32, 0x1f83d9ab'u32, 0x5be0cd19'u32]

  # Pad: 0x80, zeros, then the bit length as a 64-bit big-endian integer.
  var msg = newSeq[byte](data.len)
  for i in 0 ..< data.len:
    msg[i] = data[i]
  msg.add 0x80'u8
  while msg.len mod BlockSize != 56:
    msg.add 0'u8
  let bitLen = uint64(data.len) * 8'u64
  for i in countdown(7, 0):
    msg.add byte((bitLen shr (i * 8)) and 0xff'u64)

  var w: array[64, uint32]
  for chunk in 0 ..< msg.len div BlockSize:
    let base = chunk * BlockSize
    for i in 0 ..< 16:
      w[i] = (uint32(msg[base + i * 4]) shl 24) or
             (uint32(msg[base + i * 4 + 1]) shl 16) or
             (uint32(msg[base + i * 4 + 2]) shl 8) or
             uint32(msg[base + i * 4 + 3])
    for i in 16 ..< 64:
      let s0 = rotr(w[i - 15], 7) xor rotr(w[i - 15], 18) xor (w[i - 15] shr 3)
      let s1 = rotr(w[i - 2], 17) xor rotr(w[i - 2], 19) xor (w[i - 2] shr 10)
      w[i] = w[i - 16] + s0 + w[i - 7] + s1

    var a = h[0]
    var b = h[1]
    var c = h[2]
    var d = h[3]
    var e = h[4]
    var f = h[5]
    var g = h[6]
    var hh = h[7]
    for i in 0 ..< 64:
      let s1 = rotr(e, 6) xor rotr(e, 11) xor rotr(e, 25)
      let ch = (e and f) xor ((not e) and g)
      let t1 = hh + s1 + ch + K256[i] + w[i]
      let s0 = rotr(a, 2) xor rotr(a, 13) xor rotr(a, 22)
      let maj = (a and b) xor (a and c) xor (b and c)
      let t2 = s0 + maj
      hh = g
      g = f
      f = e
      e = d + t1
      d = c
      c = b
      b = a
      a = t1 + t2
    h[0] += a
    h[1] += b
    h[2] += c
    h[3] += d
    h[4] += e
    h[5] += f
    h[6] += g
    h[7] += hh

  for i in 0 ..< 8:
    for j in 0 ..< 4:
      result[i * 4 + j] = byte((h[i] shr (24 - j * 8)) and 0xff'u32)

proc toBytes(s: string): seq[byte] =
  result = newSeq[byte](s.len)
  for i, c in s:
    result[i] = byte(c)

proc bytesToString(d: openArray[byte]): string =
  result = newString(d.len)
  for i in 0 ..< d.len:
    result[i] = char(d[i])

proc toHex(d: openArray[byte]): string =
  const hexChars = "0123456789abcdef"
  result = newStringOfCap(d.len * 2)
  for b in d:
    result.add hexChars[int(b shr 4)]
    result.add hexChars[int(b and 0x0f)]

proc hmacSha256(key, message: openArray[byte]): Digest =
  var k = newSeq[byte](BlockSize)
  if key.len > BlockSize:
    let hashed = sha256(key)
    for i in 0 ..< Sha256Size:
      k[i] = hashed[i]
  else:
    for i in 0 ..< key.len:
      k[i] = key[i]

  var inner = newSeq[byte](BlockSize)
  var outer = newSeq[byte](BlockSize)
  for i in 0 ..< BlockSize:
    inner[i] = k[i] xor 0x36'u8
    outer[i] = k[i] xor 0x5c'u8
  inner.add message
  let innerHash = sha256(inner)
  for b in innerHash:
    outer.add b
  sha256(outer)

proc sha256Hex*(s: string): string =
  ## Hex encoded SHA-256 digest of \`s\`.
  toHex(sha256(toBytes(s)))

proc hmacSha256Hex*(key, message: string): string =
  ## Hex encoded HMAC-SHA256 of \`message\`.
  toHex(hmacSha256(toBytes(key), toBytes(message)))

proc pbkdf2Sha256(password, salt: string, iterations: int): Digest =
  ## PBKDF2 (RFC 8018) with HMAC-SHA256 and a single 32 byte output block.
  let pw = toBytes(password)
  var saltBlock = toBytes(salt)
  saltBlock.add [0'u8, 0'u8, 0'u8, 1'u8]
  var u = hmacSha256(pw, saltBlock)
  result = u
  for _ in 2 .. iterations:
    u = hmacSha256(pw, u)
    for i in 0 ..< Sha256Size:
      result[i] = result[i] xor u[i]

proc constantTimeEquals*(a, b: string): bool =
  ## Compare two strings without leaking where they differ.
  if a.len != b.len:
    return false
  var diff = 0'u8
  for i in 0 ..< a.len:
    diff = diff or (byte(a[i]) xor byte(b[i]))
  diff == 0'u8

# --- Passwords ---------------------------------------------------------------

proc hashPassword*(password: string): string =
  ## Returns "pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>".
  let salt = toHex(urandom(16))
  let digest = pbkdf2Sha256(password, salt, PasswordIterations)
  "pbkdf2-sha256$" & $PasswordIterations & "$" & salt & "$" & toHex(digest)

proc verifyPassword*(password, stored: string): bool =
  let parts = stored.split('$')
  if parts.len != 4 or parts[0] != "pbkdf2-sha256":
    return false
  try:
    let digest = pbkdf2Sha256(password, parts[2], parseInt(parts[1]))
    constantTimeEquals(toHex(digest), parts[3])
  except ValueError:
    false

# --- JSON Web Tokens (HS256) ------------------------------------------------

proc b64url(s: string): string =
  encode(s, safe = true).strip(leading = false, chars = {'='})

proc b64urlDecode(s: string): string =
  var padded = s
  while padded.len mod 4 != 0:
    padded.add '='
  decode(padded)

proc signToken*(secret: string, userId: int, ttlSeconds = 86_400): string =
  ## Issues a signed JWT whose claims are \`sub\` (the user id), \`iat\` and \`exp\`.
  let issuedAt = getTime().toUnix()
  let header = b64url($(%*{"alg": "HS256", "typ": "JWT"}))
  let claims = b64url($(%*{
    "sub": userId,
    "iat": issuedAt,
    "exp": issuedAt + int64(ttlSeconds)
  }))
  let signingInput = header & "." & claims
  let signature = b64url(
    bytesToString(hmacSha256(toBytes(secret), toBytes(signingInput))))
  signingInput & "." & signature

proc verifyToken*(secret, token: string): int =
  ## Returns the user id the token was issued for, or 0 when the token is
  ## malformed, forged or expired.
  let parts = token.split('.')
  if parts.len != 3:
    return 0
  let signingInput = parts[0] & "." & parts[1]
  let expected = b64url(
    bytesToString(hmacSha256(toBytes(secret), toBytes(signingInput))))
  if not constantTimeEquals(expected, parts[2]):
    return 0
  try:
    let header = parseJson(b64urlDecode(parts[0]))
    if header{"alg"}.getStr() != "HS256":
      return 0
    let claims = parseJson(b64urlDecode(parts[1]))
    if claims{"exp"}.getBiggestInt() < getTime().toUnix():
      return 0
    result = claims{"sub"}.getInt()
  except CatchableError:
    result = 0
`,

    'tests/nim.cfg': `--path:"../src"
`,

    'tests/tapi.nim': `import std/[unittest, json]
import {{projectNameSnake}}/api

proc bearer(token: string): string =
  "Bearer " & token

suite "api":
  var token = ""

  test "health reports healthy":
    let r = health()
    check r.code == 200
    check r.body["status"].getStr == "healthy"

  test "register validates input":
    check register("not json").code == 400
    check register("""{"email": "nope", "name": "A", "password": "longenough"}""").code == 400
    check register("""{"email": "a@example.com", "name": "A", "password": "short"}""").code == 400

  test "register then login issues a token":
    let created = register("""{"email": "Ada@Example.com", "name": "Ada", "password": "correct horse"}""")
    check created.code == 201
    check created.body["user"]["email"].getStr == "ada@example.com"
    check not created.body["user"].hasKey("passwordHash")
    check register("""{"email": "ada@example.com", "name": "Ada", "password": "correct horse"}""").code == 409

    check login("""{"email": "ada@example.com", "password": "wrong password"}""").code == 401
    let ok = login("""{"email": "ada@example.com", "password": "correct horse"}""")
    check ok.code == 200
    token = ok.body["token"].getStr
    check token.len > 0

  test "current user needs a valid bearer token":
    check currentUser("").code == 401
    check currentUser("Bearer nonsense").code == 401
    let me = currentUser(bearer(token))
    check me.code == 200
    check me.body["user"]["name"].getStr == "Ada"

  test "products are public to read and protected to write":
    check listProducts().body["count"].getInt == 0
    check createProduct("", """{"name": "Widget", "price": 9.5, "stock": 3}""").code == 401

    let created = createProduct(bearer(token), """{"name": "Widget", "price": 9.5, "stock": 3}""")
    check created.code == 201
    let id = created.body["product"]["id"].getInt
    check getProduct(id).body["product"]["name"].getStr == "Widget"
    check listProducts().body["count"].getInt == 1

    check createProduct(bearer(token), """{"price": 1}""").code == 400
    check createProduct(bearer(token), """{"name": "Bad", "price": -1}""").code == 400

    let updated = updateProduct(bearer(token), id, """{"price": 12, "stock": 1}""")
    check updated.code == 200
    check updated.body["product"]["price"].getFloat == 12.0
    check updated.body["product"]["name"].getStr == "Widget"
    check updateProduct(bearer(token), 999, """{"price": 1}""").code == 404

    check deleteProduct("", id).code == 401
    check deleteProduct(bearer(token), id).code == 200
    check getProduct(id).code == 404
    check deleteProduct(bearer(token), id).code == 404
`,

    'tests/tsecurity.nim': `import std/[unittest, strutils]
import {{projectNameSnake}}/security

suite "security":
  test "sha256 matches the FIPS 180-4 vectors":
    check sha256Hex("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    check sha256Hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    check sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq") ==
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"

  test "hmac-sha256 matches RFC 4231 / known vectors":
    check hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog") ==
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
    # Key longer than the block size is hashed first.
    check hmacSha256Hex("\\xaa".repeat(131), "Test Using Larger Than Block-Size Key - Hash Key First") ==
      "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"

  test "password hashing is salted and verifiable":
    let a = hashPassword("s3cret-pass")
    let b = hashPassword("s3cret-pass")
    check a != b
    check verifyPassword("s3cret-pass", a)
    check not verifyPassword("wrong", a)
    check not verifyPassword("s3cret-pass", "not-a-hash")

  test "tokens round-trip and reject tampering":
    let token = signToken("secret", 42)
    check token.count('.') == 2
    check verifyToken("secret", token) == 42
    check verifyToken("other-secret", token) == 0
    let parts = token.split('.')
    check verifyToken("secret", parts[0] & "." & parts[1] & "x." & parts[2]) == 0
    check verifyToken("secret", "garbage") == 0
    check verifyToken("secret", "") == 0

  test "expired tokens are rejected":
    check verifyToken("secret", signToken("secret", 7, ttlSeconds = -10)) == 0
`,

    'Dockerfile': `# Build stage
FROM nimlang/nim:2.2.4-alpine AS builder

WORKDIR /app

# Resolve dependencies first for better layer caching
COPY {{projectNameSnake}}.nimble ./
RUN nimble install -y --depsOnly

# Copy the sources and build
COPY src ./src
RUN nimble build -y -d:release

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache libgcc \\
    && adduser -D -g '' appuser

WORKDIR /app
COPY --from=builder /app/{{projectNameSnake}} ./{{projectNameSnake}}
USER appuser

# The port is fixed at compile time (-d:port=..., default 5000).
EXPOSE 5000

CMD ["./{{projectNameSnake}}"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - JWT_SECRET=\${JWT_SECRET:-development-secret-change-me}
    restart: unless-stopped
`,

    '.env.example': `# Environment configuration (export these before running the server)
JWT_SECRET=change-me-in-production
`,

    '.gitignore': `# Nim artifacts
nimcache/
*.exe
*.dll
*.so
*.dylib
/{{projectNameSnake}}
/tests/t*
!/tests/t*.nim
!/tests/nim.cfg

# Dependencies
nimbledeps/

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
`,

    'README.md': `# {{projectName}}

REST API built with [HappyX](https://github.com/HapticX/happyx), a macro-based web framework for Nim.

## Features

- JWT (HS256) authentication with salted PBKDF2 password hashing
- Products with create, read, update and delete (writes need a token)
- CORS through HappyX \`regCORS\`
- Echo WebSocket at \`/ws\`
- In-memory store behind a lock (swap \`src/{{projectNameSnake}}/api.nim\` for a database)
- Unit tests that run without a server

## Requirements

- Nim 2.0 or newer (with Nimble)

## Quick start

\`\`\`bash
nimble install -y --depsOnly   # install HappyX
nimble build -y                # build ./{{projectNameSnake}}
./{{projectNameSnake}}         # listens on http://localhost:5000
nimble test -y                 # run the unit tests
\`\`\`

The host and port are compile-time settings: \`nimble build -y -d:port=8081 -d:host=127.0.0.1\`.
HappyX serves with its built-in multi-threaded server; \`-d:stdserver\`, \`-d:httpx\` or \`-d:micro\` select another backend.
Set \`JWT_SECRET\` in production; the built-in default is only for local development.

## Layout

- \`src/{{projectNameSnake}}.nim\` - HappyX routes (HTTP only)
- \`src/{{projectNameSnake}}/api.nim\` - request handling and in-memory state
- \`src/{{projectNameSnake}}/security.nim\` - JWT and password hashing (standard library only)
- \`tests/\` - unit tests for the API layer and the security helpers

## API

- \`GET /api/v1/health\` - health check
- \`POST /api/v1/auth/register\` - body \`{"email", "name", "password"}\` (password: 8+ characters)
- \`POST /api/v1/auth/login\` - body \`{"email", "password"}\`, returns \`{"token", "user"}\`
- \`GET /api/v1/auth/me\` - current user (bearer token)
- \`GET /api/v1/products\`, \`GET /api/v1/products/:id\` - public
- \`POST /api/v1/products\`, \`PUT /api/v1/products/:id\`, \`DELETE /api/v1/products/:id\` - send \`Authorization: Bearer <token>\`
- \`WS /ws\` - echoes every message

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 5000:5000 -e JWT_SECRET=change-me {{projectName}}
\`\`\`

## License

MIT
`
  }
};
