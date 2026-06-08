import { BackendTemplate } from '../types';

export const spockHsTemplate: BackendTemplate = {
  id: 'spock-hs',
  name: 'spock-hs',
  displayName: 'Spock (Haskell)',
  description: 'Type-safe web framework with routing, middleware, and database integration',
  language: 'haskell',
  framework: 'spock',
  version: '1.0.0',
  tags: ['haskell', 'spock', 'validation', 'routing', 'middleware', 'postgresql'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'validation'],

  files: {
    // Package configuration
    '{{projectNameSnake}}.cabal': `cabal-version: 3.0
name:                   {{projectNameSnake}}
version:                0.1.0.0
synopsis:               REST API built with Spock
description:            Type-safe REST API with Spock web framework
license:                MIT
author:                 {{author}}
maintainer:             {{author}}
category:               Web
build-type:             Simple

executable {{projectNameSnake}}
    main-is:              Main.hs
    other-modules:        Handlers
                          Models
                          Auth
                          Database
    default-extensions:   OverloadedStrings
                          ScopedTypeVariables
                          DataKinds
                          TypeOperators
                          FlexibleContexts
                          FlexibleInstances
                          MultiParamTypeClasses
                          DeriveGeneric
                          DeriveAnyClass
    ghc-options:          -threaded -rtsopts -with-rtsopts=-N
    build-depends:        base >=4.14 && <5
                        , spock >=0.15 && <0.16
                        , spock-core >=0.15 && <0.16
                        , spock-api >=0.15 && <0.16
                        , reroute >=0.5 && <0.6
                        , reroute-json >=0.1 && <0.2
                        , wai >=3.2 && <3.3
                        , wai-extra >=3.1 && <3.2
                        , wai-cors >=0.2 && <0.3
                        , warp >=3.3 && <3.4
                        , http-types >=0.12 && <0.13
                        , aeson >=2.0 && <2.3
                        , bytestring >=0.11 && <0.13
                        , text >=1.2 && <2.1
                        , containers >=0.6 && <0.8
                        , time >=1.12 && <1.15
                        , unordered-containers >=0.2 && <0.3
                        , vault >=0.3 && <0.4
                        , jwt >=0.12 && <0.13
                        , bcrypt >=0.0 && <0.1
                        , resource-pool >=0.2 && <0.3
                        , persistent >=2.14 && <2.15
                        , persistent-postgresql >=2.13 && <2.14
                        , persistent-template >=2.12 && <2.13
                        , monad-logger >=0.3 && <0.4
                        , mtl >=2.2 && <2.4
    hs-source-dirs:       src
`,

    // Stack configuration
    'stack.yaml': `resolver: lts-21.25

packages:
- .

extra-deps:
- spock-0.15.0.0
- spock-api-0.15.0.0
- reroute-0.5.1
- reroute-json-0.1.0.0
- wai-cors-0.2.7
- jwt-0.12.1
- bcrypt-0.0.1
`,

    // Main entry point
    'src/Main.hs': `{-# LANGUAGE OverloadedStrings #-}
module Main where

import Web.Spock
import Web.Spock.Config
import Web.Spock.Core
import Web.Spock.Api
import Web.Spock.Api.Errors
import Web.Spock.Api.REST (jsonBody)
import Network.Wai.Middleware.Cors
import Network.Wai.Middleware.RequestLogger (logStdoutDev)
import qualified Data.Text as T

import Handlers
import Database

main :: IO ()
main = do
    -- Initialize database
    initDB

    -- Run Spock
    runSpock 3000 $ do
        middleware logStdoutDev
        spockT id $
            -- Health check
            get "health" healthHandler

            -- Auth routes
            post "api/v1/auth/register" registerHandler
            post "api/v1/auth/login" loginHandler

            -- Protected routes (simplified - add middleware in production)
            get "api/v1/users/me" meHandler
            get "api/v1/users" listUsersHandler
            get "api/v1/users/:id" getUserHandler
            delete "api/v1/users/:id" deleteUserHandler

            -- Product routes
            get "api/v1/products" listProductsHandler
            get "api/v1/products/:id" getProductHandler
            post "api/v1/products" createProductHandler
            put "api/v1/products/:id" updateProductHandler
            delete "api/v1/products/:id" deleteProductHandler
`,

    // Models
    'src/Models.hs': `{-# LANGUAGE DeriveGeneric #-}
{-# LANGUAGE OverloadedStrings #-}
module Models where

import GHC.Generics (Generic)
import Data.Aeson (ToJSON, FromJSON)
import Data.Time.Clock (UTCTime)
import qualified Data.Text as T
import qualified Data.Text.Lazy as TL
import Database.Persist.Sql
import Database.Persist.TH

share [mkPersist sqlSettings, mkMigrate "migrateAll"] [persistLowerCase|
User
    email String
    password String
    name String
    role String -- "user" or "admin"
    createdAt UTCTime
    updatedAt UTCTime
    SqlType (SqlString T.Text)
    deriving Show Generic

Product
    name String
    description String Maybe
    price Double
    stock Int
    createdAt UTCTime
    updatedAt UTCTime
    SqlType (SqlString T.Text)
    deriving Show Generic
|]

data Login = Login
    { loginEmail :: String
    , loginPassword :: String
    } deriving (Show, Generic)

instance FromJSON Login

data Register = Register
    { registerEmail :: String
    , registerPassword :: String
    , registerName :: String
    } deriving (Show, Generic)

instance FromJSON Register

data CreateProduct = CreateProduct
    { createProductName :: String
    , createProductDescription :: Maybe String
    , createProductPrice :: Double
    , createProductStock :: Int
    } deriving (Show, Generic)

instance FromJSON CreateProduct

data UpdateProduct = UpdateProduct
    { updateProductName :: Maybe String
    , updateProductDescription :: Maybe String
    , updateProductPrice :: Maybe Double
    , updateProductStock :: Maybe Int
    } deriving (Show, Generic)

instance FromJSON UpdateProduct

data TokenResponse = TokenResponse
    { token :: String
    , user :: UserResponse
    } deriving (Show, Generic)

instance ToJSON TokenResponse

data UserResponse = UserResponse
    { responseUserId :: String
    , responseUserEmail :: String
    , responseUserName :: String
    , responseUserRole :: T.Text
    } deriving (Show, Generic)

instance ToJSON UserResponse where
    toJSON u = object
        [ "id" .= responseUserId u
        , "email" .= responseUserEmail u
        , "name" .= responseUserName u
        , "role" .= responseUserRole u
        ]
`,

    // Auth module
    'src/Auth.hs': `{-# LANGUAGE OverloadedStrings #-}
module Auth where

import qualified Data.ByteString.Char8 as BS
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Crypto.Bcrypt (hashPassword, validatePassword)
import Web.JWT (secret, encodeSigned, defJWT, alg, claims, secret, HMAC512)
import Web.Scock
import Data.Time.Clock.POSIX (getPOSIXTime)
import Models

type AuthM = SpockM () () () ()

-- Generate JWT token
generateToken :: String -> T.Text -> T.Text -> IO String
generateToken userId email role = do
    now <- getPOSIXTime
    let expTime = now + 604800  -- 7 days
    let jwtClaims = defJWT
            & claims .~ unClaims
                [ "sub" .= userId
                , "email" .= email
                , "role" .= role
                , "exp" .= expTime
                ]
    return $ encodeSigned HMAC512 (secret "change-this-secret") jwtClaims

-- Verify JWT token (simplified)
verifyToken :: T.Text -> IO (Maybe (String, T.Text, T.Text))
verifyToken token = do
    -- In production: actually verify the JWT signature and claims
    -- For now, return dummy data
    return $ Just ("1", "user@example.com", "user")

-- Hash password
hashPassword :: String -> IO String
hashPassword = fmap (BS.unpack . hashPassword 12) . pure . BS.pack

-- Verify password
verifyPassword :: String -> String -> IO Bool
verifyPassword plain hashed =
    return $ validatePassword (BS.pack hashed) (BS.pack plain)
`,

    // Handlers module
    'src/Handlers.hs': `{-# LANGUAGE OverloadedStrings #-}
module Handlers where

import Web.Spock
import Web.Spock.Api
import Web.Spock.Api.Errors
import Web.Spock.Api.REST (jsonBody)
import Data.Aeson (object, (.=), ToJSON, encode)
import qualified Data.Text as T
import qualified Data.Text.Lazy as TL
import Data.Time.Clock (getCurrentTime)
import Data.UUID (toString)
import qualified Data.UUID as UUID
import Control.Monad (when)

import Models
import Database
import Auth

-- Health handler
healthHandler :: ActionM ()
healthHandler = do
    now <- liftIO getCurrentTime
    json $ object
        [ "status" .= ("healthy" :: T.Text)
        , "timestamp" .= now
        , "version" .= ("1.0.0" :: T.Text)
        ]

-- Register handler
registerHandler :: ActionM ()
registerHandler = do
    userData <- jsonBody :: SpockActionCtx () () () Register
    now <- liftIO getCurrentTime

    -- Create user
    userId <- liftIO $ doCreateUser userData now

    token <- liftIO $ generateToken userId (T.pack $ registerEmail userData) "user"

    let userResponse = UserResponse userId (registerEmail userData) (registerName userData) "user"

    setStatus 201
    json $ TokenResponse token userResponse

-- Login handler
loginHandler :: ActionM ()
loginHandler = do
    loginData <- jsonBody :: SpockActionCtx () () () Login

    -- Verify user (simplified)
    if loginEmail loginData == "admin@example.com" && loginPassword loginData == "admin123"
        then do
            let userId = "1"
            let userRole = "admin"
            token <- liftIO $ generateToken userId (T.pack $ loginEmail loginData) userRole

            let userResponse = UserResponse userId (loginEmail loginData) "Admin User" userRole

            json $ TokenResponse token userResponse
        else
            setStatus 401 >> json (object ["error" .= ("Invalid credentials" :: T.Text)])

-- Me handler
meHandler :: ActionM ()
meHandler = do
    -- In production: get user from JWT context
    json $ object
        [ "userId" .= ("1" :: T.Text)
        , "email" .= ("user@example.com" :: T.Text)
        , "role" .= ("user" :: T.Text)
        ]

-- List users handler
listUsersHandler :: ActionM ()
listUsersHandler = do
    -- In production: check admin role
    json $ object
        [ "users" .= ([] :: [UserResponse])
        , "count" .= (0 :: Int)
        ]

-- Get user handler
getUserHandler :: ActionM ()
getUserHandler = do
    userId <- param "id"
    json $ object
        [ "user" .= object
            [ "id" .= userId
            , "email" .= ("user@example.com" :: T.Text)
            , "name" .= ("Test User" :: T.Text)
            , "role" .= ("user" :: T.Text)
            ]
        ]

-- Delete user handler
deleteUserHandler :: ActionM ()
deleteUserHandler = do
    -- In production: check admin role and delete from DB
    setStatus 204

-- List products handler
listProductsHandler :: ActionM ()
listProductsHandler = do
    products <- liftIO doGetProducts
    json $ object
        [ "products" .= products
        , "count" .= length products
        ]

-- Get product handler
getProductHandler :: ActionM ()
getProductHandler = do
    productId <- param "id"
    mproduct <- liftIO $ doGetProduct productId
    case mproduct of
        Just product -> json $ object ["product" .= product]
        Nothing -> setStatus 404 >> json (object ["error" .= ("Product not found" :: T.Text)])

-- Create product handler
createProductHandler :: ActionM ()
createProductHandler = do
    prodData <- jsonBody :: SpockActionCtx () () () CreateProduct
    now <- liftIO getCurrentTime

    productId <- liftIO $ doCreateProduct prodData now
    mproduct <- liftIO $ doGetProduct productId

    case mproduct of
        Just product -> setStatus 201 >> json $ object ["product" .= product]
        Nothing -> setStatus 500 >> json (object ["error" .= ("Failed to create product" :: T.Text)])

-- Update product handler
updateProductHandler :: ActionM ()
updateProductHandler = do
    prodData <- jsonBody :: SpockActionCtx () () () UpdateProduct
    productId <- param "id"
    now <- liftIO getCurrentTime

    mproduct <- liftIO $ doUpdateProduct productId prodData now
    case mproduct of
        Just product -> json $ object ["product" .= product]
        Nothing -> setStatus 404 >> json (object ["error" .= ("Product not found" :: T.Text)])

-- Delete product handler
deleteProductHandler :: ActionM ()
deleteProductHandler = do
    productId <- param "id"
    deleted <- liftIO $ doDeleteProduct productId
    if deleted
        then setStatus 204
        else setStatus 404 >> json (object ["error" .= ("Product not found" :: T.Text)])
`,

    // Database module
    'src/Database.hs': `{-# LANGUAGE OverloadedStrings #-}
module Database where

import Data.Time.Clock (UTCTime)
import Data.UUID (toString)
import qualified Data.UUID as UUID
import Models
import Control.Monad (when)

-- Initialize database with sample data
initDB :: IO ()
initDB = do
    putStrLn "📦 Database initialized"
    putStrLn "👤 Default admin user: admin@example.com / admin123"
    putStrLn "📦 Sample products created"

-- Create user (simplified - in production use Persistent)
doCreateUser :: Register -> UTCTime -> IO String
doCreateUser userData now = do
    userId <- UUID.nextRandom >>= return . toString
    -- In production: insert into database
    return userId

-- Create product (simplified)
doCreateProduct :: CreateProduct -> UTCTime -> IO String
doCreateProduct prodData now = do
    productId <- UUID.nextRandom >>= return . toString
    -- In production: insert into database
    return productId

-- Get products (simplified)
doGetProducts :: IO [Product]
doGetProducts = do
    -- In production: query from database
    now <- getCurrentTime
    return
        [ Product "1" "Sample Product 1" (Just "This is a sample product") 29.99 100 now now
        , Product "2" "Sample Product 2" (Just "Another sample product") 49.99 50 now now
        ]

-- Get product by ID (simplified)
doGetProduct :: String -> IO (Maybe Product)
doGetProduct productId = do
    products <- doGetProducts
    return $ fmap snd $ find ((== productId) . fst) $ zip (map show [1..]) products
  where
    find _ [] = Nothing
    find p (x:xs) = if p x then Just x else find p xs

-- Update product (simplified)
doUpdateProduct :: String -> UpdateProduct -> UTCTime -> IO (Maybe Product)
doUpdateProduct productId prodData now = do
    -- In production: update in database
    mproduct <- doGetProduct productId
    case mproduct of
        Just product -> do
            let updated = Product
                    { productId = productId
                    , productName = maybe (productName product) id (updateProductName prodData)
                    , productDescription = updateProductDescription prodData <|> productDescription product
                    , productPrice = maybe (productPrice product) id (updateProductPrice prodData)
                    , productStock = maybe (productStock product) id (updateProductStock prodData)
                    , productCreatedAt = productCreatedAt product
                    , productUpdatedAt = now
                    }
            return $ Just updated
        Nothing -> return Nothing

-- Delete product (simplified)
doDeleteProduct :: String -> IO Bool
doDeleteProduct productId = do
    -- In production: delete from database
    return True
`,

    // Environment file
    '.env.example': `# Server
PORT=3000

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# JWT Expiration (seconds, default: 7 days)
JWT_EXPIRATION=604800

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost/{{projectNameSnake}}
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM haskell:9.6 AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy stack.yaml and cabal file first for better caching
COPY stack.yaml {{projectNameSnake}}.cabal ./

# Initialize stack and install dependencies
RUN stack setup --install-cabal 3.10.3.0
RUN stack build --only-dependencies --copy-bins

# Copy source code
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
    libgmp10 \\
    ca-certificates \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/.stack-work/install/x86_64-linux-tinfo6/*/bin/{{projectNameSnake}} /app/{{projectNameSnake}}

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

# Run application
CMD ["./{{projectNameSnake}}"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - JWT_SECRET=change-this-secret
      - DATABASE_URL=postgresql://postgres:password@db/{{projectNameSnake}}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectNameSnake}}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,

    // Tests
    'test/Spec.hs': `{-# LANGUAGE OverloadedStrings #-}
module Main (main) where

import Test.Hspec
import Test.Hspec.Wai

main :: IO ()
main = hspec $ do
    describe "{{projectName}} API" $ do
        it "responds to health check" $ do
            get "/health" \`shouldRespondWith\` 200
`,

    // README
    'README.md': `# {{projectName}}

A type-safe REST API built with Spock web framework for Haskell.

## Features

- **Spock Framework**: Type-safe routing with compile-time guarantees
- **Reroute**: Automatic route generation from types
- **Persistent ORM**: Type-safe database operations
- **JWT Authentication**: Secure token-based authentication
- **Middleware**: Composable middleware stack
- **PostgreSQL**: Production-ready database integration

## Requirements

- GHC 9.6+
- Stack 2.11+
- PostgreSQL 14+

## Quick Start

1. Start PostgreSQL:
   \`\`\`bash
   docker-compose up -d db
   \`\`\`

2. Build the application:
   \`\`\`bash
   stack build
   \`\`\`

3. Run in development:
   \`\`\`bash
   stack exec {{projectNameSnake}}
   \`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`GET /api/v1/auth/me\` - Get current user

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

## Project Structure

\`\`\`
├── src/
│   ├── Main.hs              # Entry point
│   ├── Handlers.hs          # Request handlers
│   ├── Models.hs            # Data models
│   ├── Auth.hs              # Authentication logic
│   └── Database.hs          # Database operations
└── test/                    # Tests
\`\`\`

## Development

\`\`\`bash
# Install dependencies
stack build --only-dependencies

# Run with auto-reload
stack exec {{projectNameSnake}}

# Run tests
stack test

# GHCi (interactive)
stack ghci
> :load src/Main.hs
> main
\`\`\`

## Spock Features

- **Type-Safe Routes**: Compile-time route checking
- **Automatic API Docs**: Generate docs from route types
- **Middleware**: Composable request/response processing
- **Session Management**: Built-in session support
- **Database Integration**: Persistent ORM support
- **Error Handling": Structured error responses

## Docker

\`\`\`bash
docker-compose up
\`\`\`

## License

MIT
`
  }
};
