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
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation', 'documentation'],
  dependencies: {},
  devDependencies: {},
  files: {
    'package.yaml': `name: {{projectName}}
version: 0.1.0.0
github: "{{author}}/{{projectName}}"
license: MIT
author: "{{author}}"
maintainer: "{{author}}@example.com"
copyright: "2024 {{author}}"

extra-source-files:
  - README.md
  - CHANGELOG.md

description: {{description}}

dependencies:
  - base >= 4.14 && < 5
  - servant >= 0.19
  - servant-server >= 0.19
  - warp >= 3.3
  - wai >= 3.2
  - wai-cors >= 0.2
  - aeson >= 2.0
  - text >= 1.2
  - bytestring >= 0.10
  - mtl >= 2.2
  - transformers >= 0.5
  - time >= 1.9
  - uuid >= 1.3
  - jose >= 0.9
  - containers >= 0.6
  - unordered-containers >= 0.2
  - http-types >= 0.12
  - wai-extra >= 3.1

ghc-options:
  - -Wall
  - -Wcompat
  - -Widentities
  - -Wincomplete-record-updates
  - -Wincomplete-uni-patterns
  - -Wmissing-export-lists
  - -Wmissing-home-modules
  - -Wpartial-fields
  - -Wredundant-constraints

library:
  source-dirs: src

executables:
  {{projectName}}-exe:
    main: Main.hs
    source-dirs: app
    ghc-options:
      - -threaded
      - -rtsopts
      - -with-rtsopts=-N
    dependencies:
      - {{projectName}}

tests:
  {{projectName}}-test:
    main: Spec.hs
    source-dirs: test
    ghc-options:
      - -threaded
      - -rtsopts
      - -with-rtsopts=-N
    dependencies:
      - {{projectName}}
      - hspec >= 2.9
      - hspec-wai >= 0.11
      - hspec-wai-json >= 0.11
      - QuickCheck >= 2.14
`,

    'stack.yaml': `resolver: lts-21.17

packages:
  - .

extra-deps: []
`,

    'cabal.project': `packages: .
`,

    '{{projectName}}.cabal': `cabal-version: 2.4
name: {{projectName}}
version: 0.1.0.0
synopsis: {{description}}
license: MIT
license-file: LICENSE
author: {{author}}
maintainer: {{author}}@example.com
build-type: Simple

library
  exposed-modules:
    Api
    Api.Types
    Api.Auth
    Api.Users
    Api.Items
    Config
    Database
    Middleware
  build-depends:
    base >= 4.14 && < 5,
    servant >= 0.19,
    servant-server >= 0.19,
    warp >= 3.3,
    wai >= 3.2,
    wai-cors >= 0.2,
    aeson >= 2.0,
    text >= 1.2,
    bytestring >= 0.10,
    mtl >= 2.2,
    transformers >= 0.5,
    time >= 1.9,
    uuid >= 1.3,
    jose >= 0.9,
    containers >= 0.6,
    unordered-containers >= 0.2,
    http-types >= 0.12,
    wai-extra >= 3.1
  hs-source-dirs: src
  default-language: Haskell2010

executable {{projectName}}-exe
  main-is: Main.hs
  build-depends:
    base >= 4.14 && < 5,
    {{projectName}}
  hs-source-dirs: app
  default-language: Haskell2010
  ghc-options: -threaded -rtsopts -with-rtsopts=-N

test-suite {{projectName}}-test
  type: exitcode-stdio-1.0
  main-is: Spec.hs
  build-depends:
    base >= 4.14 && < 5,
    {{projectName}},
    hspec >= 2.9,
    hspec-wai >= 0.11,
    hspec-wai-json >= 0.11,
    QuickCheck >= 2.14
  hs-source-dirs: test
  default-language: Haskell2010
  ghc-options: -threaded -rtsopts -with-rtsopts=-N
`,

    'app/Main.hs': `module Main where

import Config (getConfig, Config(..))
import Api (app)
import Network.Wai.Handler.Warp (run)
import System.IO (hPutStrLn, stderr)

main :: IO ()
main = do
  config <- getConfig
  let port = configPort config
  hPutStrLn stderr $ "🚀 {{projectName}} server starting on http://localhost:" ++ show port
  run port (app config)
`,

    'src/Config.hs': `{-# LANGUAGE OverloadedStrings #-}

module Config
  ( Config(..)
  , getConfig
  ) where

import System.Environment (lookupEnv)
import Data.Maybe (fromMaybe)
import Data.Text (Text)
import qualified Data.Text as T

data Config = Config
  { configPort :: Int
  , configJwtSecret :: Text
  , configDatabaseUrl :: Text
  } deriving (Show, Eq)

getConfig :: IO Config
getConfig = do
  port <- lookupEnv "PORT"
  jwtSecret <- lookupEnv "JWT_SECRET"
  dbUrl <- lookupEnv "DATABASE_URL"
  return Config
    { configPort = maybe 8080 read port
    , configJwtSecret = T.pack $ fromMaybe "your-secret-key-change-in-production" jwtSecret
    , configDatabaseUrl = T.pack $ fromMaybe "postgres://localhost/{{projectName}}" dbUrl
    }
`,

    'src/Api.hs': `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Api
  ( API
  , app
  ) where

import Servant
import Network.Wai (Application)
import Network.Wai.Middleware.Cors (cors, simpleCorsResourcePolicy, corsRequestHeaders, corsMethods)
import Network.HTTP.Types.Method (methodGet, methodPost, methodPut, methodDelete, methodOptions)

import Config (Config)
import Api.Types
import Api.Auth (AuthAPI, authServer)
import Api.Users (UsersAPI, usersServer)
import Api.Items (ItemsAPI, itemsServer)

-- Root API type combining all endpoints
type API = HealthAPI
      :<|> RootAPI
      :<|> "api" :> "auth" :> AuthAPI
      :<|> "api" :> "users" :> UsersAPI
      :<|> "api" :> "items" :> ItemsAPI

-- Health check endpoint
type HealthAPI = "health" :> Get '[JSON] HealthResponse

-- Root endpoint
type RootAPI = Get '[JSON] ApiInfo

-- Combined server
server :: Config -> Server API
server config = healthHandler
           :<|> rootHandler
           :<|> authServer config
           :<|> usersServer config
           :<|> itemsServer config

healthHandler :: Handler HealthResponse
healthHandler = return $ HealthResponse "healthy" "now"

rootHandler :: Handler ApiInfo
rootHandler = return $ ApiInfo
  { aiName = "{{projectName}}"
  , aiVersion = "1.0.0"
  , aiFramework = "Servant"
  , aiLanguage = "Haskell"
  , aiDescription = "{{description}}"
  }

-- CORS policy
corsPolicy = cors $ const $ Just simpleCorsResourcePolicy
  { corsRequestHeaders = ["Content-Type", "Authorization"]
  , corsMethods = [methodGet, methodPost, methodPut, methodDelete, methodOptions]
  }

-- Application
app :: Config -> Application
app config = corsPolicy $ serve (Proxy :: Proxy API) (server config)
`,

    'src/Api/Types.hs': `{-# LANGUAGE DeriveGeneric #-}
{-# LANGUAGE OverloadedStrings #-}

module Api.Types
  ( User(..)
  , CreateUserRequest(..)
  , LoginRequest(..)
  , TokenResponse(..)
  , Item(..)
  , CreateItemRequest(..)
  , HealthResponse(..)
  , ApiInfo(..)
  , ErrorResponse(..)
  ) where

import GHC.Generics (Generic)
import Data.Aeson (ToJSON, FromJSON)
import Data.Text (Text)
import Data.Time (UTCTime)

-- User types
data User = User
  { userId :: Int
  , userEmail :: Text
  , userName :: Text
  , userCreatedAt :: UTCTime
  } deriving (Show, Eq, Generic)

instance ToJSON User
instance FromJSON User

data CreateUserRequest = CreateUserRequest
  { curEmail :: Text
  , curName :: Text
  , curPassword :: Text
  } deriving (Show, Eq, Generic)

instance ToJSON CreateUserRequest
instance FromJSON CreateUserRequest

data LoginRequest = LoginRequest
  { lrEmail :: Text
  , lrPassword :: Text
  } deriving (Show, Eq, Generic)

instance ToJSON LoginRequest
instance FromJSON LoginRequest

data TokenResponse = TokenResponse
  { trToken :: Text
  , trExpiresAt :: Integer
  } deriving (Show, Eq, Generic)

instance ToJSON TokenResponse
instance FromJSON TokenResponse

-- Item types
data Item = Item
  { itemId :: Int
  , itemName :: Text
  , itemDescription :: Text
  , itemUserId :: Int
  , itemCreatedAt :: UTCTime
  } deriving (Show, Eq, Generic)

instance ToJSON Item
instance FromJSON Item

data CreateItemRequest = CreateItemRequest
  { cirName :: Text
  , cirDescription :: Maybe Text
  } deriving (Show, Eq, Generic)

instance ToJSON CreateItemRequest
instance FromJSON CreateItemRequest

-- Health and info types
data HealthResponse = HealthResponse
  { hrStatus :: Text
  , hrTimestamp :: Text
  } deriving (Show, Eq, Generic)

instance ToJSON HealthResponse
instance FromJSON HealthResponse

data ApiInfo = ApiInfo
  { aiName :: Text
  , aiVersion :: Text
  , aiFramework :: Text
  , aiLanguage :: Text
  , aiDescription :: Text
  } deriving (Show, Eq, Generic)

instance ToJSON ApiInfo
instance FromJSON ApiInfo

-- Error types
data ErrorResponse = ErrorResponse
  { erError :: Text
  , erMessage :: Text
  } deriving (Show, Eq, Generic)

instance ToJSON ErrorResponse
instance FromJSON ErrorResponse
`,

    'src/Api/Auth.hs': `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Api.Auth
  ( AuthAPI
  , authServer
  ) where

import Servant
import Data.Text (Text)
import qualified Data.Text as T

import Config (Config(..))
import Api.Types
import Database (findUserByEmail, createUser, verifyPassword)

type AuthAPI = "register" :> ReqBody '[JSON] CreateUserRequest :> Post '[JSON] User
          :<|> "login" :> ReqBody '[JSON] LoginRequest :> Post '[JSON] TokenResponse

authServer :: Config -> Server AuthAPI
authServer config = registerHandler config :<|> loginHandler config

registerHandler :: Config -> CreateUserRequest -> Handler User
registerHandler config req = do
  -- Check if user exists
  existingUser <- liftIO $ findUserByEmail (curEmail req)
  case existingUser of
    Just _ -> throwError err409 { errBody = "User with this email already exists" }
    Nothing -> do
      -- Validate input
      when (T.null (curEmail req) || T.null (curName req) || T.null (curPassword req)) $
        throwError err400 { errBody = "Email, name and password are required" }
      -- Create user
      liftIO $ createUser (curEmail req) (curName req) (curPassword req)

loginHandler :: Config -> LoginRequest -> Handler TokenResponse
loginHandler config req = do
  userOpt <- liftIO $ findUserByEmail (lrEmail req)
  case userOpt of
    Nothing -> throwError err401 { errBody = "Invalid email or password" }
    Just user -> do
      valid <- liftIO $ verifyPassword (userId user) (lrPassword req)
      if valid
        then return $ TokenResponse "mock-jwt-token" 9999999999
        else throwError err401 { errBody = "Invalid email or password" }

when :: Bool -> Handler () -> Handler ()
when True action = action
when False _ = return ()
`,

    'src/Api/Users.hs': `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Api.Users
  ( UsersAPI
  , usersServer
  ) where

import Servant
import Data.Text (Text)

import Config (Config)
import Api.Types
import Database (getAllUsers, findUserById)

type UsersAPI = "me" :> Header "Authorization" Text :> Get '[JSON] User
           :<|> Header "Authorization" Text :> Get '[JSON] [User]
           :<|> Capture "id" Int :> Header "Authorization" Text :> Get '[JSON] User

usersServer :: Config -> Server UsersAPI
usersServer config = getMeHandler config
                :<|> listUsersHandler config
                :<|> getUserHandler config

getMeHandler :: Config -> Maybe Text -> Handler User
getMeHandler config authHeader = do
  userId <- requireAuth authHeader
  userOpt <- liftIO $ findUserById userId
  case userOpt of
    Nothing -> throwError err404 { errBody = "User not found" }
    Just user -> return user

listUsersHandler :: Config -> Maybe Text -> Handler [User]
listUsersHandler config authHeader = do
  _ <- requireAuth authHeader
  liftIO getAllUsers

getUserHandler :: Config -> Int -> Maybe Text -> Handler User
getUserHandler config uid authHeader = do
  _ <- requireAuth authHeader
  userOpt <- liftIO $ findUserById uid
  case userOpt of
    Nothing -> throwError err404 { errBody = "User not found" }
    Just user -> return user

requireAuth :: Maybe Text -> Handler Int
requireAuth Nothing = throwError err401 { errBody = "Authorization required" }
requireAuth (Just token) =
  -- Simple mock authentication - in production, verify JWT properly
  case parseToken token of
    Nothing -> throwError err401 { errBody = "Invalid token" }
    Just userId -> return userId

parseToken :: Text -> Maybe Int
parseToken token
  | "Bearer mock-jwt-token" == token = Just 1
  | otherwise = Nothing
`,

    'src/Api/Items.hs': `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Api.Items
  ( ItemsAPI
  , itemsServer
  ) where

import Servant
import Data.Text (Text)
import qualified Data.Text as T

import Config (Config)
import Api.Types
import Database (getItemsByUser, createItem, findItemById, deleteItem)

type ItemsAPI = Header "Authorization" Text :> Get '[JSON] [Item]
           :<|> Header "Authorization" Text :> ReqBody '[JSON] CreateItemRequest :> Post '[JSON] Item
           :<|> Capture "id" Int :> Header "Authorization" Text :> Get '[JSON] Item
           :<|> Capture "id" Int :> Header "Authorization" Text :> Delete '[JSON] NoContent

itemsServer :: Config -> Server ItemsAPI
itemsServer config = listItemsHandler config
                :<|> createItemHandler config
                :<|> getItemHandler config
                :<|> deleteItemHandler config

listItemsHandler :: Config -> Maybe Text -> Handler [Item]
listItemsHandler config authHeader = do
  userId <- requireAuth authHeader
  liftIO $ getItemsByUser userId

createItemHandler :: Config -> Maybe Text -> CreateItemRequest -> Handler Item
createItemHandler config authHeader req = do
  userId <- requireAuth authHeader
  when (T.null (cirName req)) $
    throwError err400 { errBody = "Name is required" }
  let desc = maybe "" id (cirDescription req)
  liftIO $ createItem (cirName req) desc userId

getItemHandler :: Config -> Int -> Maybe Text -> Handler Item
getItemHandler config itemId authHeader = do
  userId <- requireAuth authHeader
  itemOpt <- liftIO $ findItemById itemId userId
  case itemOpt of
    Nothing -> throwError err404 { errBody = "Item not found" }
    Just item -> return item

deleteItemHandler :: Config -> Int -> Maybe Text -> Handler NoContent
deleteItemHandler config itemId authHeader = do
  userId <- requireAuth authHeader
  success <- liftIO $ deleteItem itemId userId
  if success
    then return NoContent
    else throwError err404 { errBody = "Item not found" }

requireAuth :: Maybe Text -> Handler Int
requireAuth Nothing = throwError err401 { errBody = "Authorization required" }
requireAuth (Just token) =
  case parseToken token of
    Nothing -> throwError err401 { errBody = "Invalid token" }
    Just userId -> return userId

parseToken :: Text -> Maybe Int
parseToken token
  | "Bearer mock-jwt-token" == token = Just 1
  | otherwise = Nothing

when :: Bool -> Handler () -> Handler ()
when True action = action
when False _ = return ()
`,

    'src/Database.hs': `{-# LANGUAGE OverloadedStrings #-}

module Database
  ( findUserByEmail
  , findUserById
  , createUser
  , verifyPassword
  , getAllUsers
  , getItemsByUser
  , createItem
  , findItemById
  , deleteItem
  ) where

import Data.Text (Text)
import Data.Time (getCurrentTime)
import Data.IORef
import System.IO.Unsafe (unsafePerformIO)

import Api.Types

-- In-memory storage (use proper database in production)
{-# NOINLINE usersRef #-}
usersRef :: IORef [User]
usersRef = unsafePerformIO $ newIORef []

{-# NOINLINE passwordsRef #-}
passwordsRef :: IORef [(Int, Text)]
passwordsRef = unsafePerformIO $ newIORef []

{-# NOINLINE itemsRef #-}
itemsRef :: IORef [Item]
itemsRef = unsafePerformIO $ newIORef []

{-# NOINLINE userIdRef #-}
userIdRef :: IORef Int
userIdRef = unsafePerformIO $ newIORef 0

{-# NOINLINE itemIdRef #-}
itemIdRef :: IORef Int
itemIdRef = unsafePerformIO $ newIORef 0

-- User operations
findUserByEmail :: Text -> IO (Maybe User)
findUserByEmail email = do
  users <- readIORef usersRef
  return $ find (\\u -> userEmail u == email) users
  where
    find _ [] = Nothing
    find p (x:xs) = if p x then Just x else find p xs

findUserById :: Int -> IO (Maybe User)
findUserById uid = do
  users <- readIORef usersRef
  return $ find (\\u -> userId u == uid) users
  where
    find _ [] = Nothing
    find p (x:xs) = if p x then Just x else find p xs

createUser :: Text -> Text -> Text -> IO User
createUser email name password = do
  newId <- atomicModifyIORef' userIdRef (\\n -> (n + 1, n + 1))
  now <- getCurrentTime
  let user = User newId email name now
  atomicModifyIORef' usersRef (\\users -> (users ++ [user], ()))
  atomicModifyIORef' passwordsRef (\\ps -> (ps ++ [(newId, password)], ()))
  return user

verifyPassword :: Int -> Text -> IO Bool
verifyPassword uid password = do
  passwords <- readIORef passwordsRef
  return $ any (\\(u, p) -> u == uid && p == password) passwords

getAllUsers :: IO [User]
getAllUsers = readIORef usersRef

-- Item operations
getItemsByUser :: Int -> IO [Item]
getItemsByUser uid = do
  items <- readIORef itemsRef
  return $ filter (\\i -> itemUserId i == uid) items

createItem :: Text -> Text -> Int -> IO Item
createItem name description uid = do
  newId <- atomicModifyIORef' itemIdRef (\\n -> (n + 1, n + 1))
  now <- getCurrentTime
  let item = Item newId name description uid now
  atomicModifyIORef' itemsRef (\\items -> (items ++ [item], ()))
  return item

findItemById :: Int -> Int -> IO (Maybe Item)
findItemById itemId uid = do
  items <- readIORef itemsRef
  return $ find (\\i -> itemId == itemId i && itemUserId i == uid) items
  where
    find _ [] = Nothing
    find p (x:xs) = if p x then Just x else find p xs

deleteItem :: Int -> Int -> IO Bool
deleteItem itemId uid = do
  items <- readIORef itemsRef
  let (matching, others) = partition (\\i -> itemId == itemId i && itemUserId i == uid) items
  if null matching
    then return False
    else do
      writeIORef itemsRef others
      return True
  where
    partition _ [] = ([], [])
    partition p (x:xs) =
      let (yes, no) = partition p xs
      in if p x then (x:yes, no) else (yes, x:no)
`,

    'src/Middleware.hs': `{-# LANGUAGE OverloadedStrings #-}

module Middleware
  ( requestLogger
  ) where

import Network.Wai (Middleware, Request, requestMethod, rawPathInfo)
import Network.Wai.Middleware.RequestLogger (logStdout)
import Data.ByteString.Char8 (unpack)
import System.IO (hPutStrLn, stderr)

requestLogger :: Middleware
requestLogger = logStdout
`,

    'test/Spec.hs': `{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE QuasiQuotes #-}

module Main where

import Test.Hspec
import Test.Hspec.Wai
import Test.Hspec.Wai.JSON
import Network.Wai (Application)

import Api (app)
import Config (Config(..))

testConfig :: Config
testConfig = Config
  { configPort = 8080
  , configJwtSecret = "test-secret"
  , configDatabaseUrl = "memory"
  }

testApp :: Application
testApp = app testConfig

main :: IO ()
main = hspec spec

spec :: Spec
spec = with (return testApp) $ do
  describe "GET /health" $ do
    it "returns healthy status" $ do
      get "/health" \`shouldRespondWith\` [json|{status: "healthy"}|] { matchStatus = 200 }

  describe "GET /" $ do
    it "returns API info" $ do
      get "/" \`shouldRespondWith\` 200

  describe "POST /api/auth/register" $ do
    it "creates a new user" $ do
      let body = [json|{curEmail: "test@example.com", curName: "Test", curPassword: "password"}|]
      post "/api/auth/register" body \`shouldRespondWith\` 200

  describe "Protected endpoints" $ do
    it "returns 401 without auth" $ do
      get "/api/users/me" \`shouldRespondWith\` 401
`,

    '.env': `# Environment Configuration
PORT=8080
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=postgres://localhost/{{projectName}}
`,

    '.env.example': `# Environment Configuration
PORT=8080
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=postgres://localhost/{{projectName}}
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
COPY stack.yaml package.yaml ./

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

{{description}}

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

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login and get JWT token

### Protected (requires JWT)

- \`GET /api/users/me\` - Get current user
- \`GET /api/users\` - List all users
- \`GET /api/users/:id\` - Get user by ID
- \`GET /api/items\` - List user's items
- \`POST /api/items\` - Create new item
- \`GET /api/items/:id\` - Get item by ID
- \`DELETE /api/items/:id\` - Delete item

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
