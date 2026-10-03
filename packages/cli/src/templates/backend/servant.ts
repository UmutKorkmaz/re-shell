import { BackendTemplate } from '../types';

export const servantTemplate: BackendTemplate = {
  id: 'servant',
  name: 'Servant',
  description: 'Haskell type-safe web framework with compile-time API contracts',
  version: '1.0.0',
  framework: 'servant',
  displayName: 'Servant (Haskell)',
  language: 'haskell',
  port: 8080,
  tags: ['haskell', 'servant', 'web', 'api', 'rest', 'type-safe', 'functional'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation', 'documentation', 'graphql'],
  dependencies: {},
  devDependencies: {},
  files: {

    'stack.yaml': `resolver: lts-21.17

packages:
  - .

extra-deps: []
`,

    'cabal.project': `packages: .
`,

    '{{projectName}}.cabal': `cabal-version:       2.4
name:                {{projectName}}
version:             0.1.0.0
synopsis:            REST API built with Servant
description:         Type-safe REST API with the Servant web framework
license:             MIT
license-file:        LICENSE
author:              re-shell
maintainer:          re-shell@example.com
category:            Web
build-type:          Simple
extra-source-files:  README.md
                     CHANGELOG.md

common shared
  default-language:   Haskell2010
  default-extensions: OverloadedStrings
  ghc-options:        -Wall

library
  import:             shared
  hs-source-dirs:     src
  exposed-modules:    App
                      Auth
                      Graphql
                      Models
                      Store
  build-depends:      base >=4.14 && <5
                    , aeson >=2.0 && <2.3
                    , bytestring >=0.11 && <0.13
                    , containers >=0.6 && <0.8
                    , crypton >=0.33 && <1.1
                    , jwt >=0.11 && <0.12
                    , servant >=0.19 && <0.21
                    , servant-server >=0.19 && <0.21
                    , stm >=2.5 && <2.6
                    , text >=1.2 && <2.2
                    , time >=1.12 && <1.15
                    , uuid >=1.3 && <1.4
                    , wai >=3.2 && <3.3
                    , wai-cors >=0.2 && <0.3

executable {{projectName}}-exe
  import:             shared
  main-is:            Main.hs
  hs-source-dirs:     app
  ghc-options:        -threaded -rtsopts -with-rtsopts=-N
  build-depends:      base >=4.14 && <5
                    , {{projectName}}
                    , warp >=3.3 && <3.5

test-suite {{projectName}}-test
  import:             shared
  type:               exitcode-stdio-1.0
  main-is:            Spec.hs
  hs-source-dirs:     test
  build-depends:      base >=4.14 && <5
                    , aeson >=2.0 && <2.3
                    , bytestring >=0.11 && <0.13
                    , {{projectName}}
                    , hspec >=2.9 && <3
                    , hspec-wai >=0.11 && <0.12
                    , wai-extra >=3.1 && <3.2
                    , text >=1.2 && <2.2
`,

    'app/Main.hs': `module Main (main) where

import Network.Wai.Handler.Warp (run)
import System.Environment (lookupEnv)
import System.IO (hPutStrLn, stderr)
import Text.Read (readMaybe)

import App (mkApp)

main :: IO ()
main = do
  port <- maybe 8080 id . (>>= readMaybe) <$> lookupEnv "PORT"
  app <- mkApp
  hPutStrLn stderr ("{{projectName}} server starting on http://localhost:" ++ show port)
  run port app
`,

    'test/Spec.hs': `{-# LANGUAGE OverloadedStrings #-}
module Main (main) where

import Data.Aeson (Value (..), decode)
import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy as LBS
import qualified Data.Aeson.KeyMap as KeyMap
import Data.Text.Encoding (encodeUtf8)
import Network.Wai.Test (SResponse (..))
import Test.Hspec
import Test.Hspec.Wai

import App (mkApp)

-- | POST a JSON body.
postJson :: BS.ByteString -> LBS.ByteString -> WaiSession st SResponse
postJson path = request "POST" path [("Content-Type", "application/json")]

-- | The JWT in a login or register response.
tokenFrom :: SResponse -> Maybe Value
tokenFrom response = case decode (simpleBody response) of
  Just (Object o) -> KeyMap.lookup "token" o
  _ -> Nothing

main :: IO ()
main = hspec $ with mkApp $ do
  describe "API" $ do
    it "responds to the health check" $
      get "/health" \`shouldRespondWith\` 200

    it "returns the API banner" $
      get "/" \`shouldRespondWith\` 200

    it "lists the seeded products" $
      get "/api/v1/products" \`shouldRespondWith\` 200

    it "rejects bad credentials and unauthenticated requests" $ do
      postJson "/api/v1/auth/login" "{\\"email\\":\\"admin@example.com\\",\\"password\\":\\"nope\\"}" \`shouldRespondWith\` 401
      get "/api/v1/auth/me" \`shouldRespondWith\` 401

    it "registers a user, who is not an admin" $ do
      response <- postJson "/api/v1/auth/register" "{\\"email\\":\\"jane@example.com\\",\\"name\\":\\"Jane\\",\\"password\\":\\"secret123\\"}"
      case tokenFrom response of
        Just (String token) -> do
          let headers = [("Authorization", "Bearer " <> encodeUtf8 token), ("Content-Type", "application/json")]
          request "GET" "/api/v1/auth/me" headers "" \`shouldRespondWith\` 200
          request "POST" "/api/v1/products" headers "{\\"name\\":\\"Widget\\",\\"price\\":9.5}" \`shouldRespondWith\` 403
        _ -> liftIO (expectationFailure "no token in the register response")

    it "logs in the admin, who can then create products" $ do
      response <- postJson "/api/v1/auth/login" "{\\"email\\":\\"admin@example.com\\",\\"password\\":\\"admin123\\"}"
      case tokenFrom response of
        Just (String token) -> do
          let headers = [("Authorization", "Bearer " <> encodeUtf8 token), ("Content-Type", "application/json")]
          request "POST" "/api/v1/products" headers "{\\"name\\":\\"Widget\\",\\"price\\":9.5}" \`shouldRespondWith\` 201
        _ -> liftIO (expectationFailure "no token in the login response")

    it "answers GraphQL" $
      postJson "/graphql" "{\\"query\\":\\"{ hello health }\\"}" \`shouldRespondWith\` 200
`,

    '.env': `# Environment Configuration
PORT=8080
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=postgres://localhost/{{projectName}}
`,

    '.env.example': `# Environment Configuration
PORT=8080
JWT_SECRET=your-super-secret-key-change-in-production
`,

    '.gitignore': `# Stack
.stack-work/
*.cabal
stack.yaml.lock

# Cabal
dist/
dist-newstyle/
cabal.project.local
.cabal-sandbox/
cabal.sandbox.config
.ghc.environment.*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
logs/

# HLS
.hie/
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean deps

all: build

# Install dependencies (using Stack)
deps:
	stack setup

# Build the project
build: deps
	stack build

# Build with optimizations
release:
	stack build --ghc-options="-O2"

# Run the server
run:
	stack run

# Run tests
test:
	stack test

# Run REPL
repl:
	stack ghci

# Clean build artifacts
clean:
	stack clean

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 8080:8080 --env-file .env {{projectName}}

# Format code (requires ormolu)
fmt:
	ormolu --mode inplace $$(find src app -name "*.hs")

# Lint (requires hlint)
lint:
	hlint src app
`,

    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM haskell:9.6 AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq-dev \\
    libsqlite3-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy stack.yaml and package.yaml first for better caching
COPY stack.yaml {{projectName}}.cabal ./

# Initialize stack and install dependencies
RUN stack setup --install-cabal 3.10.3.0
RUN stack build --only-dependencies --copy-bins

# Copy cabal file and source code
COPY {{projectName}}.cabal ./
COPY . .

# Build application
RUN stack build --copy-bins

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq5 \\
    libsqlite3-0 \\
    libgmp10 \\
    ca-certificates \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /root/.local/bin/{{projectName}}-exe /app/{{projectName}}

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

# Run application
CMD ["./{{projectName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
      - DATABASE_URL=postgres://postgres:postgres@db:5432/{{projectName}}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB={{projectName}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
`,

    'README.md': `# {{projectName}}

{{projectName}} - A Re-Shell microfrontend project

A Haskell web application built with the Servant framework.

## Features

- 🚀 Type-safe REST API with compile-time contracts
- 🔐 JWT authentication
- 📝 Full CRUD operations
- 🧪 Test suite with hspec-wai
- 🐳 Docker support
- ⚡ High-performance Warp server

## Requirements

- GHC >= 9.4
- Stack or Cabal

## Installation

\`\`\`bash
# Using Stack (recommended)
stack setup
stack build

# Using Cabal
cabal update
cabal build
\`\`\`

## Development

\`\`\`bash
# Run the server
stack run

# Run tests
stack test

# Start REPL
stack ghci

# Format code (requires ormolu)
make fmt

# Lint code (requires hlint)
make lint
\`\`\`

## API Endpoints

### Public

- \`GET /\` - API banner
- \`GET /health\` - Health check
- \`POST /api/v1/auth/register\` - Register new user (\`email\`, \`name\`, \`password\`)
- \`POST /api/v1/auth/login\` - Login and get a JWT
- \`GET /api/v1/products\`, \`GET /api/v1/products/:id\` - Products
- \`POST /graphql\` - \`{ hello health }\`

### Protected (bearer token)

- \`GET /api/v1/auth/me\` - Current user
- \`GET /api/v1/users\`, \`GET /api/v1/users/:id\`, \`DELETE /api/v1/users/:id\` - Users (admin only)
- \`POST /api/v1/products\`, \`PUT /api/v1/products/:id\`, \`DELETE /api/v1/products/:id\` - Products (admin only)

The seeded admin is \`admin@example.com\` / \`admin123\`; set \`JWT_SECRET\` in production.

## Docker

\`\`\`bash
# Build image
docker build -t {{projectName}} .

# Run container
docker run -p 8080:8080 {{projectName}}

# Or use docker-compose
docker-compose up -d
\`\`\`

## Type Safety

Servant provides compile-time guarantees for your API. The type system ensures:
- All endpoints match their declared types
- Request/response bodies conform to expected formats
- Authentication requirements are enforced
- URL parameters are properly typed

## License

MIT
`,

    'LICENSE': `MIT License

Copyright (c) 2024 {{author}}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,

    'CHANGELOG.md': `# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.0] - Initial Release

### Added
- Initial Servant REST API implementation
- User authentication endpoints
- CRUD operations for users and items
- JWT token-based authentication
- CORS middleware support
- Docker configuration
- Test suite with hspec-wai
`,

    'src/App.hs': `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeOperators #-}
module App
  ( API
  , api
  , mkApp
  ) where

import Control.Monad.IO.Class (liftIO)
import Data.Aeson (Value, encode, object, (.=))
import Data.Text (Text)
import qualified Data.Text as T
import Data.Time.Clock (getCurrentTime)
import Network.Wai.Middleware.Cors (cors, corsMethods, corsRequestHeaders, simpleCorsResourcePolicy)
import Servant

import Auth
import Graphql (resolveRequest)
import Models
import Store

type Authorized = Header "Authorization" Text

type API =
  Get '[PlainText] Text
    :<|> "health" :> Get '[JSON] Value
    :<|> "api" :> "v1" :> "health" :> Get '[JSON] Value
    :<|> "graphql" :> ReqBody '[JSON] Value :> Post '[JSON] Value
    :<|> "api" :> "v1" :> "auth" :> "register" :> ReqBody '[JSON] Register :> PostCreated '[JSON] TokenResponse
    :<|> "api" :> "v1" :> "auth" :> "login" :> ReqBody '[JSON] Login :> Post '[JSON] TokenResponse
    :<|> "api" :> "v1" :> "auth" :> "me" :> Authorized :> Get '[JSON] Value
    :<|> "api" :> "v1" :> "users" :> Authorized :> Get '[JSON] Value
    :<|> "api" :> "v1" :> "users" :> Authorized :> Capture "id" Text :> Get '[JSON] Value
    :<|> "api" :> "v1" :> "users" :> Authorized :> Capture "id" Text :> DeleteNoContent
    :<|> "api" :> "v1" :> "products" :> Get '[JSON] Value
    :<|> "api" :> "v1" :> "products" :> Capture "id" Int :> Get '[JSON] Value
    :<|> "api" :> "v1" :> "products" :> Authorized :> ReqBody '[JSON] ProductInput :> PostCreated '[JSON] Value
    :<|> "api" :> "v1" :> "products" :> Authorized :> Capture "id" Int :> ReqBody '[JSON] ProductPatch :> Put '[JSON] Value
    :<|> "api" :> "v1" :> "products" :> Authorized :> Capture "id" Int :> DeleteNoContent

api :: Proxy API
api = Proxy

-- | A JSON error response.
failWith :: ServerError -> Text -> Handler a
failWith err message =
  throwError err {errBody = encode (object ["error" .= message]), errHeaders = [("Content-Type", "application/json")]}

-- | The claims of the bearer token in the Authorization header.
requireClaims :: Maybe Text -> Handler Claims
requireClaims header = case header >>= T.stripPrefix "Bearer " of
  Nothing -> failWith err401 "Unauthorized"
  Just token -> do
    verified <- liftIO (verifyToken token)
    maybe (failWith err401 "Invalid or expired token") pure verified

requireAdmin :: Maybe Text -> Handler Claims
requireAdmin header = do
  claims <- requireClaims header
  if claimsRole claims == "admin" then pure claims else failWith err403 "Admin role required"

session :: User -> Handler TokenResponse
session user = do
  token <- liftIO (signToken user)
  pure (TokenResponse token user)

server :: Store -> Server API
server store =
  pure "{{projectName}} API - Running"
    :<|> health
    :<|> health
    :<|> pure . resolveRequest
    :<|> register
    :<|> login
    :<|> me
    :<|> listAllUsers
    :<|> getUser
    :<|> removeUser
    :<|> listAllProducts
    :<|> getProduct
    :<|> createProduct
    :<|> updateProduct
    :<|> removeProduct
  where
    health = do
      now <- liftIO getCurrentTime
      pure (object ["status" .= ("healthy" :: Text), "timestamp" .= now, "version" .= ("1.0.0" :: Text)])

    register (Register email name password)
      | T.length password < 6 || T.null name || T.null email =
          failWith err400 "email, name and a password of at least 6 characters are required"
      | otherwise = do
          created <- liftIO (addUser store email name password "user")
          either (failWith err409) session created

    login (Login email password) = do
      found <- liftIO (findUserByEmail store email)
      case found of
        Just user | verifyPassword password (userPasswordHash user) -> session user
        _ -> failWith err401 "Invalid credentials"

    me header = do
      claims <- requireClaims header
      pure (object ["userId" .= claimsSub claims, "email" .= claimsEmail claims, "role" .= claimsRole claims])

    listAllUsers header = do
      _ <- requireAdmin header
      users <- liftIO (listUsers store)
      pure (object ["users" .= users, "count" .= length users])

    getUser header uid = do
      _ <- requireAdmin header
      found <- liftIO (findUserById store uid)
      maybe (failWith err404 "User not found") (\\user -> pure (object ["user" .= user])) found

    removeUser header uid = do
      _ <- requireAdmin header
      deleted <- liftIO (deleteUser store uid)
      if deleted then pure NoContent else failWith err404 "User not found"

    listAllProducts = do
      products <- liftIO (listProducts store)
      pure (object ["products" .= products, "count" .= length products])

    getProduct n = do
      found <- liftIO (findProduct store n)
      maybe (failWith err404 "Product not found") (\\p -> pure (object ["product" .= p])) found

    createProduct header input = do
      _ <- requireAdmin header
      created <- liftIO (addProduct store input)
      pure (object ["product" .= created])

    updateProduct header n changes = do
      _ <- requireAdmin header
      updated <- liftIO (patchProduct store n changes)
      maybe (failWith err404 "Product not found") (\\p -> pure (object ["product" .= p])) updated

    removeProduct header n = do
      _ <- requireAdmin header
      deleted <- liftIO (deleteProduct store n)
      if deleted then pure NoContent else failWith err404 "Product not found"

-- | The WAI application (a fresh in-memory store per call).
mkApp :: IO Application
mkApp = do
  store <- newStore
  pure $
    cors (const (Just policy)) (serve api (server store))
  where
    policy =
      simpleCorsResourcePolicy
        { corsRequestHeaders = ["Content-Type", "Authorization"]
        , corsMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        }
`,

    'src/Auth.hs': `{-# LANGUAGE OverloadedStrings #-}
module Auth
  ( Claims (..)
  , signToken
  , verifyToken
  , hashPassword
  , verifyPassword
  ) where

import qualified Crypto.KDF.BCrypt as BCrypt
import qualified Data.Aeson as Aeson
import qualified Data.ByteString as BS
import qualified Data.Map.Strict as Map
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Data.Time.Clock.POSIX (getPOSIXTime)
import qualified Web.JWT as JWT
import System.Environment (lookupEnv)

import Models (User (..))

-- | What a token carries about its owner.
data Claims = Claims
  { claimsSub :: Text
  , claimsEmail :: Text
  , claimsRole :: Text
  }

secretText :: IO Text
secretText = maybe "change-this-secret-in-production" T.pack <$> lookupEnv "JWT_SECRET"

-- | A token valid for seven days.
signToken :: User -> IO Text
signToken user = do
  secret <- secretText
  now <- getPOSIXTime
  let claimsSet =
        mempty
          { JWT.sub = JWT.stringOrURI (userId user)
          , JWT.exp = JWT.numericDate (now + 7 * 24 * 3600)
          , JWT.unregisteredClaims =
              JWT.ClaimsMap
                ( Map.fromList
                    [ ("email", Aeson.String (userEmail user))
                    , ("role", Aeson.String (userRole user))
                    ]
                )
          }
  pure (JWT.encodeSigned (JWT.hmacSecret secret) mempty claimsSet)

-- | The claims of a token with a valid signature that has not expired.
verifyToken :: Text -> IO (Maybe Claims)
verifyToken token = do
  secret <- secretText
  now <- getPOSIXTime
  pure $ do
    verified <- JWT.decodeAndVerifySignature (JWT.toVerify (JWT.hmacSecret secret)) token
    let claimsSet = JWT.claims verified
    expiry <- JWT.exp claimsSet
    if JWT.secondsSinceEpoch expiry <= realToFrac now
      then Nothing
      else do
        sub <- JWT.stringOrURIToText <$> JWT.sub claimsSet
        let extra = JWT.unClaimsMap (JWT.unregisteredClaims claimsSet)
            textClaim key = case Map.lookup key extra of
              Just (Aeson.String t) -> t
              _ -> ""
        pure (Claims sub (textClaim "email") (textClaim "role"))

-- | bcrypt (cost 10) with a fresh random salt; the result embeds the salt.
hashPassword :: Text -> IO BS.ByteString
hashPassword password = BCrypt.hashPassword 10 (TE.encodeUtf8 password)

verifyPassword :: Text -> BS.ByteString -> Bool
verifyPassword password hashed = BCrypt.validatePassword (TE.encodeUtf8 password) hashed
`,

    'src/Graphql.hs': `{-# LANGUAGE OverloadedStrings #-}
-- | The GraphQL surface served at /graphql: @type Query { hello: String!, health: String! }@.
module Graphql
  ( resolveRequest
  , resolveQuery
  , sdl
  ) where

import Data.Aeson (Value (..), object, (.=))
import Data.Aeson.Key (fromText)
import qualified Data.Aeson.KeyMap as KeyMap
import Data.Text (Text)
import qualified Data.Text as T

-- | Answers a decoded request body (@{"query": "{ hello }"}@).
resolveRequest :: Value -> Value
resolveRequest (Object body)
  | Just (String query) <- KeyMap.lookup "query" body = resolveQuery query
resolveRequest _ = resolveQuery ""

-- | Answers the fields named in the query text; anything else is an error.
resolveQuery :: Text -> Value
resolveQuery query
  | null selected = object ["errors" .= [object ["message" .= ("Query must select hello and/or health" :: Text)]]]
  | otherwise = object ["data" .= object selected]
  where
    selected = [fromText name .= String value | (name, value) <- fields, name \`T.isInfixOf\` query]
    fields = [("hello", "Hello from {{projectName}} GraphQL!"), ("health", "healthy")]

-- | The schema in SDL.
sdl :: Text
sdl =
  T.unlines
    [ "type Query {"
    , "  hello: String!"
    , "  health: String!"
    , "}"
    ]
`,

    'src/Models.hs': `{-# LANGUAGE OverloadedStrings #-}
module Models
  ( User (..)
  , Product (..)
  , Register (..)
  , Login (..)
  , ProductInput (..)
  , ProductPatch (..)
  , TokenResponse (..)
  ) where

import Data.Aeson
import qualified Data.ByteString as BS
import Data.Text (Text)
import Data.Time.Clock (UTCTime)

data User = User
  { userId :: Text
  , userEmail :: Text
  , userName :: Text
  , userRole :: Text -- "user" or "admin"
  , userPasswordHash :: BS.ByteString
  , userCreatedAt :: UTCTime
  }

-- | The password hash is never serialised.
instance ToJSON User where
  toJSON u =
    object
      [ "id" .= userId u
      , "email" .= userEmail u
      , "name" .= userName u
      , "role" .= userRole u
      , "createdAt" .= userCreatedAt u
      ]

data Product = Product
  { productId :: Int
  , productName :: Text
  , productDescription :: Maybe Text
  , productPrice :: Double
  , productStock :: Int
  , productCreatedAt :: UTCTime
  , productUpdatedAt :: UTCTime
  }

instance ToJSON Product where
  toJSON p =
    object
      [ "id" .= productId p
      , "name" .= productName p
      , "description" .= productDescription p
      , "price" .= productPrice p
      , "stock" .= productStock p
      , "createdAt" .= productCreatedAt p
      , "updatedAt" .= productUpdatedAt p
      ]

data Register = Register
  { registerEmail :: Text
  , registerName :: Text
  , registerPassword :: Text
  }

instance FromJSON Register where
  parseJSON = withObject "Register" $ \\o ->
    Register <$> o .: "email" <*> o .: "name" <*> o .: "password"

data Login = Login
  { loginEmail :: Text
  , loginPassword :: Text
  }

instance FromJSON Login where
  parseJSON = withObject "Login" $ \\o -> Login <$> o .: "email" <*> o .: "password"

data ProductInput = ProductInput
  { inputName :: Text
  , inputDescription :: Maybe Text
  , inputPrice :: Double
  , inputStock :: Int
  }

instance FromJSON ProductInput where
  parseJSON = withObject "ProductInput" $ \\o ->
    ProductInput
      <$> o .: "name"
      <*> o .:? "description"
      <*> o .: "price"
      <*> o .:? "stock" .!= 0

-- | A partial update: absent fields keep their value.
data ProductPatch = ProductPatch
  { patchName :: Maybe Text
  , patchDescription :: Maybe Text
  , patchPrice :: Maybe Double
  , patchStock :: Maybe Int
  }

instance FromJSON ProductPatch where
  parseJSON = withObject "ProductPatch" $ \\o ->
    ProductPatch
      <$> o .:? "name"
      <*> o .:? "description"
      <*> o .:? "price"
      <*> o .:? "stock"

data TokenResponse = TokenResponse
  { tokenValue :: Text
  , tokenUser :: User
  }

instance ToJSON TokenResponse where
  toJSON t = object ["token" .= tokenValue t, "user" .= tokenUser t]
`,

    'src/Store.hs': `{-# LANGUAGE OverloadedStrings #-}
-- | In-memory data store (STM). Replace with a real database for production use.
module Store
  ( Store
  , newStore
  , findUserByEmail
  , findUserById
  , listUsers
  , addUser
  , deleteUser
  , listProducts
  , findProduct
  , addProduct
  , patchProduct
  , deleteProduct
  ) where

import Control.Concurrent.STM
import Data.Maybe (fromMaybe)
import qualified Data.Map.Strict as Map
import Data.Text (Text)
import qualified Data.Text as T
import Data.Time.Clock (getCurrentTime)
import qualified Data.UUID as UUID
import qualified Data.UUID.V4 as UUID

import Auth (hashPassword)
import Models

data Store = Store
  { storeUsers :: TVar (Map.Map Text User)
  , storeProducts :: TVar (Map.Map Int Product)
  , storeNextProductId :: TVar Int
  }

-- | A store with the default admin (admin@example.com / admin123) and two sample products.
newStore :: IO Store
newStore = do
  now <- getCurrentTime
  adminHash <- hashPassword "admin123"
  let admin = User "1" "admin@example.com" "Admin User" "admin" adminHash now
      sample n name description price stock =
        Product n name (Just description) price stock now now
  Store
    <$> newTVarIO (Map.singleton "1" admin)
    <*> newTVarIO
      ( Map.fromList
          [ (1, sample 1 "Sample Product 1" "This is a sample product" 29.99 100)
          , (2, sample 2 "Sample Product 2" "Another sample product" 49.99 50)
          ]
      )
    <*> newTVarIO 3

normaliseEmail :: Text -> Text
normaliseEmail = T.toLower . T.strip

findUserByEmail :: Store -> Text -> IO (Maybe User)
findUserByEmail store email =
  find' <$> readTVarIO (storeUsers store)
  where
    find' = fmap snd . Map.lookupMin . Map.filter ((== normaliseEmail email) . userEmail)

findUserById :: Store -> Text -> IO (Maybe User)
findUserById store uid = Map.lookup uid <$> readTVarIO (storeUsers store)

listUsers :: Store -> IO [User]
listUsers store = Map.elems <$> readTVarIO (storeUsers store)

-- | Creates a user; fails when the email is already registered.
addUser :: Store -> Text -> Text -> Text -> Text -> IO (Either Text User)
addUser store email name password role = do
  now <- getCurrentTime
  uid <- UUID.toText <$> UUID.nextRandom
  passwordHash <- hashPassword password
  let user = User uid (normaliseEmail email) name role passwordHash now
  atomically $ do
    users <- readTVar (storeUsers store)
    if any ((== userEmail user) . userEmail) (Map.elems users)
      then pure (Left "Email already registered")
      else do
        writeTVar (storeUsers store) (Map.insert uid user users)
        pure (Right user)

deleteUser :: Store -> Text -> IO Bool
deleteUser store uid = atomically $ do
  users <- readTVar (storeUsers store)
  writeTVar (storeUsers store) (Map.delete uid users)
  pure (Map.member uid users)

listProducts :: Store -> IO [Product]
listProducts store = Map.elems <$> readTVarIO (storeProducts store)

findProduct :: Store -> Int -> IO (Maybe Product)
findProduct store n = Map.lookup n <$> readTVarIO (storeProducts store)

addProduct :: Store -> ProductInput -> IO Product
addProduct store input = do
  now <- getCurrentTime
  atomically $ do
    n <- readTVar (storeNextProductId store)
    writeTVar (storeNextProductId store) (n + 1)
    let product' =
          Product n (inputName input) (inputDescription input) (inputPrice input) (inputStock input) now now
    modifyTVar' (storeProducts store) (Map.insert n product')
    pure product'

patchProduct :: Store -> Int -> ProductPatch -> IO (Maybe Product)
patchProduct store n patch = do
  now <- getCurrentTime
  atomically $ do
    products <- readTVar (storeProducts store)
    case Map.lookup n products of
      Nothing -> pure Nothing
      Just p -> do
        let updated =
              p
                { productName = fromMaybe (productName p) (patchName patch)
                , productDescription = maybe (productDescription p) Just (patchDescription patch)
                , productPrice = fromMaybe (productPrice p) (patchPrice patch)
                , productStock = fromMaybe (productStock p) (patchStock patch)
                , productUpdatedAt = now
                }
        writeTVar (storeProducts store) (Map.insert n updated products)
        pure (Just updated)

deleteProduct :: Store -> Int -> IO Bool
deleteProduct store n = atomically $ do
  products <- readTVar (storeProducts store)
  writeTVar (storeProducts store) (Map.delete n products)
  pure (Map.member n products)
`},
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-servant-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A Haskell web application built with Servant'},
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: 'Developer'}],
  postInstall: [
    'stack setup',
    'stack build',
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: stack run"']};
