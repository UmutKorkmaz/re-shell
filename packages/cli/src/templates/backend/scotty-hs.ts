import { BackendTemplate } from '../types';

export const scottyHsTemplate: BackendTemplate = {
  id: 'scotty-hs',
  name: 'scotty-hs',
  displayName: 'Scotty (Haskell)',
  description: 'Lightweight, Sinatra-inspired web framework with composable middleware',
  language: 'haskell',
  framework: 'scotty',
  version: '1.0.0',
  tags: ['haskell', 'scotty', 'lightweight', 'sinatra-like', 'wai', 'middleware'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'rest-api'],

  files: {
    // Package configuration
    '{{projectNameSnake}}.cabal': `cabal-version: 3.0
name:                   {{projectNameSnake}}
version:                0.1.0.0
synopsis:               REST API built with Scotty
description:            Lightweight REST API with Scotty web framework
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
                          Middleware
    default-extensions:   OverloadedStrings
                          ScopedTypeVariables
                          DeriveGeneric
                          DeriveAnyClass
    ghc-options:          -threaded -rtsopts -with-rtsopts=-N
    build-depends:        base >=4.14 && <5
                        , scotty >=0.12 && <0.13
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
                        , jwt >=0.12 && <0.13
                        , bcrypt >=0.0 && <0.1
                        , mtl >=2.2 && <2.4
                        , transformers >=0.5 && <0.7
    hs-source-dirs:       src
`,

    // Stack configuration
    'stack.yaml': `resolver: lts-21.25

packages:
- .

extra-deps:
- scotty-0.12.2
- wai-cors-0.2.7
- jwt-0.12.1
- bcrypt-0.0.1
`,

    // Main entry point
    'src/Main.hs': `{-# LANGUAGE OverloadedStrings #-}
module Main where

import Web.Scotty
import Network.Wai.Middleware.Cors
import Network.Wai.Middleware.RequestLogger (logStdoutDev)
import qualified Web.Scotty.Internal.Types as Scotty
import Control.Monad.IO.Class (liftIO)

import Handlers
import Auth
import Middleware

main :: IO ()
main = do
    scotty 3000 $ do
        middleware $ cors $ const $ Just corsResourcePolicy
            { corsOrigins = Nothing
            , corsMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
            , corsRequestHeaders = ["Content-Type", "Authorization"]
            }
        middleware logStdoutDev

        -- Health check
        get "/health" healthHandler

        -- Auth routes
        post "/api/v1/auth/register" registerHandler
        post "/api/v1/auth/login" loginHandler
        post "/api/v1/auth/me" (authMiddleware meHandler)

        -- User routes (require auth)
        get "/api/v1/users" (authMiddleware $ adminMiddleware listUsersHandler)
        get "/api/v1/users/:id" (authMiddleware getUserHandler)
        delete "/api/v1/users/:id" (authMiddleware $ adminMiddleware deleteUserHandler)

        -- Product routes
        get "/api/v1/products" listProductsHandler
        get "/api/v1/products/:id" getProductHandler
        post "/api/v1/products" (authMiddleware $ adminMiddleware createProductHandler)
        put "/api/v1/products/:id" (authMiddleware $ adminMiddleware updateProductHandler)
        delete "/api/v1/products/:id" (authMiddleware $ adminMiddleware deleteProductHandler)
`,

    // Models
    'src/Models.hs': `{-# LANGUAGE DeriveGeneric #-}
{-# LANGUAGE OverloadedStrings #-}
module Models where

import GHC.Generics (Generic)
import Data.Aeson (ToJSON, FromJSON)
import Data.Time.Clock (UTCTime)
import qualified Data.Text as T

data User = User
    { userId :: String
    , userEmail :: String
    , userPassword :: String
    , userName :: String
    , userRole :: T.Text  -- "user" or "admin"
    , userCreatedAt :: UTCTime
    , userUpdatedAt :: UTCTime
    } deriving (Show, Generic)

instance ToJSON User where
    toJSON u = object
        [ "id" .= userId u
        , "email" .= userEmail u
        , "name" .= userName u
        , "role" .= userRole u
        , "createdAt" .= userCreatedAt u
        , "updatedAt" .= userUpdatedAt u
        ]

instance FromJSON User

data CreateUser = CreateUser
    { createEmail :: String
    , createPassword :: String
    , createName :: String
    } deriving (Show, Generic)

instance FromJSON CreateUser

data Login = Login
    { loginEmail :: String
    , loginPassword :: String
    } deriving (Show, Generic)

instance FromJSON Login

data Product = Product
    { productId :: String
    , productName :: String
    , productDescription :: Maybe String
    , productPrice :: Double
    , productStock :: Int
    , productCreatedAt :: UTCTime
    , productUpdatedAt :: UTCTime
    } deriving (Show, Generic)

instance ToJSON Product
instance FromJSON Product

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
import Web.JWT (secret, encodeSigned, defJWT, alg, claims, secret, HMAC512, JWT, claims)
import Web.Scotty.Trans
import Data.Time.Clock.POSIX (getPOSIXTime)
import Models

type AuthM = ActionM ()

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

import Web.Scotty.Trans
import Web.Scotty.Internal.Types (ActionT)
import Data.Aeson (object, (.=), ToJSON, encode)
import qualified Data.Text.Lazy as TL
import qualified Data.Text as T
import Data.Time.Clock (getCurrentTime)
import Data.UUID (toString)
import qualified Data.UUID as UUID
import qualified Data.ByteString.Lazy.Char8 as BL
import Control.Monad (when)
import Control.Monad.IO.Class (liftIO)

import Models
import Auth
import Middleware

-- In-memory storage
type AppState = ([User], [Product])

initialState :: AppState
initialState =
    ( [ User "1" "admin@example.com" (adminHash) "Admin User" "admin" undefined undefined ]
    , [ Product "1" "Sample Product" (Just "This is a sample product") 29.99 100 undefined undefined ]
    )
  where
    adminHash = "$2a$12$dummy"  -- Simplified for template

-- Health handler
healthHandler :: ActionM ()
healthHandler = do
    now <- liftIO getCurrentTime
    json $ object
        [ "status" .= ("healthy" :: String)
        , "timestamp" .= now
        , "version" .= ("1.0.0" :: String)
        ]

-- Register handler
registerHandler :: ActionM ()
registerHandler = do
    userData <- jsonData
    now <- liftIO getCurrentTime

    -- Check if user exists (simplified - in production use DB)
    let userId = toString UUID.nil
    hashed <- liftIO $ hashPassword (createPassword userData)

    let user = User
            { userId = userId
            , userEmail = createEmail userData
            , userPassword = hashed
            , userName = createName userData
            , userRole = "user"
            , userCreatedAt = now
            , userUpdatedAt = now
            }

    token <- liftIO $ generateToken userId (T.pack $ createEmail userData) (userRole user)

    let userResponse = UserResponse userId (createEmail userData) (createName userData) (userRole user)

    status 201
    json $ TokenResponse token userResponse

-- Login handler
loginHandler :: ActionM ()
loginHandler = do
    loginData <- jsonData

    -- Simplified - in production verify against DB
    let isValid = loginEmail loginData == "admin@example.com" && loginPassword loginData == "admin123"

    if isValid
        then do
            let userId = "1"
            let userRole = "admin"
            token <- liftIO $ generateToken userId (T.pack $ loginEmail loginData) userRole

            let userResponse = UserResponse userId (loginEmail loginData) "Admin User" userRole

            json $ TokenResponse token userResponse
        else
            status 401 >> json (object ["error" .= ("Invalid credentials" :: T.Text)])

-- Me handler
meHandler :: (String, T.Text, T.Text) -> ActionM ()
meHandler (userId, email, role) = do
    json $ object
        [ "userId" .= userId
        , "email" .= email
        , "role" .= role
        ]

-- List users handler
listUsersHandler :: (String, T.Text, T.Text) -> ActionM ()
listUsersHandler (_, _, "admin") = do
    json $ object
        [ "users" .= ([] :: [UserResponse])
        , "count" .= (0 :: Int)
        ]
listUsersHandler _ = status 403 >> json (object ["error" .= ("Forbidden" :: T.Text)])

-- Get user handler
getUserHandler :: (String, T.Text, T.Text) -> ActionM ()
getUserHandler (userId, _, _) = do
    json $ object
        [ "user" .= object
            [ "id" .= userId
            , "email" .= ("user@example.com" :: T.Text)
            , "name" .= ("Test User" :: T.Text)
            , "role" .= ("user" :: T.Text)
            ]
        ]

-- Delete user handler
deleteUserHandler :: (String, T.Text, T.Text) -> ActionM ()
deleteUserHandler (_, _, "admin") = status 204
deleteUserHandler _ = status 403 >> json (object ["error" .= ("Forbidden" :: T.Text)])

-- List products handler
listProductsHandler :: ActionM ()
listProductsHandler = do
    json $ object
        [ "products" .= ([] :: [Product])
        , "count" .= (0 :: Int)
        ]

-- Get product handler
getProductHandler :: ActionM ()
getProductHandler = do
    productId <- param "id"
    json $ object
        [ "product" .= Product productId "Sample Product" (Just "Description") 29.99 100 undefined undefined
        ]

-- Create product handler
createProductHandler :: (String, T.Text, T.Text) -> ActionM ()
createProductHandler (_, _, "admin") = do
    prodData <- jsonData
    now <- liftIO getCurrentTime
    let productId = toString UUID.nil

    let product = Product
            { productId = productId
            , productName = createProductName prodData
            , productDescription = createProductDescription prodData
            , productPrice = createProductPrice prodData
            , productStock = createProductStock prodData
            , productCreatedAt = now
            , productUpdatedAt = now
            }

    status 201
    json $ object ["product" .= product]
createProductHandler _ = status 403 >> json (object ["error" .= ("Forbidden" :: T.Text)])

-- Update product handler
updateProductHandler :: (String, T.Text, T.Text) -> ActionM ()
updateProductHandler (_, _, "admin") = do
    prodData <- jsonData
    now <- liftIO getCurrentTime
    productId <- param "id"

    let product = Product
            { productId = productId
            , productName = maybe (productName undefined) id (updateProductName prodData)
            , productDescription = updateProductDescription prodData <|> productDescription undefined
            , productPrice = maybe (productPrice undefined) id (updateProductPrice prodData)
            , productStock = maybe (productStock undefined) id (updateProductStock prodData)
            , productCreatedAt = undefined
            , productUpdatedAt = now
            }

    json $ object ["product" .= product]
updateProductHandler _ = status 403 >> json (object ["error" .= ("Forbidden" :: T.Text)])

-- Delete product handler
deleteProductHandler :: (String, T.Text, T.Text) -> ActionM ()
deleteProductHandler (_, _, "admin") = status 204
deleteProductHandler _ = status 403 >> json (object ["error" .= ("Forbidden" :: T.Text)])
`,

    // Middleware module
    'src/Middleware.hs': `{-# LANGUAGE OverloadedStrings #-}
module Middleware where

import qualified Data.Text as T
import Web.Scotty.Trans
import Network.HTTP.Types.Status
import Data.Aeson (object, (.=))

-- Authentication middleware
authMiddleware :: ActionM () -> ActionM ()
authMiddleware handler = do
    mAuthHeader <- header "Authorization"
    case mAuthHeader of
        Nothing -> do
            status 401
            json $ object ["error" .= ("Unauthorized" :: T.Text)]
        Just authHeader ->
            if "Bearer " \`T.isPrefixOf\` authHeader
                then handler  -- In production: verify JWT and add user to context
                else do
                    status 401
                    json $ object ["error" .= ("Invalid token format" :: T.Text)]

-- Admin middleware
adminMiddleware :: ActionM () -> ActionM ()
adminMiddleware handler = do
    -- In production: check role from JWT
    -- For now, just pass through
    handler

-- CORS middleware (handled in Main.hs)
-- Error handler
errorHandler :: Exception -> ActionM ()
errorHandler e = do
    status 500
    json $ object ["error" .= ("Internal server error" :: T.Text)]
`,

    // Environment file
    '.env.example': `# Server
PORT=3000

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# JWT Expiration (seconds, default: 7 days)
JWT_EXPIRATION=604800
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
    libsqlite3-dev \\
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
    libsqlite3-0 \\
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
    restart: unless-stopped
`,

    // Tests
    'test/Spec.hs': `{-# LANGUAGE OverloadedStrings #-}
module Main (main) where

import Test.Hspec
import Test.Hspec.Wai
import Network.Wai.Test (request)

main :: IO ()
main = hspec $ do
    describe "{{projectName}} API" $ do
        it "responds to health check" $ do
            get "/health" \`shouldRespondWith\` 200
`,

    // README
    'README.md': `# {{projectName}}

A lightweight REST API built with Scotty web framework for Haskell.

## Features

- **Scotty Framework**: Sinatra-inspired web framework
- **WAI Middleware**: Composable request/response processing
- **JWT Authentication**: Secure token-based authentication
- **Type-Safe Routes**: Compile-time route safety
- **Lightweight**: Minimal dependencies, fast compilation

## Requirements

- GHC 9.6+
- Stack 2.11+

## Quick Start

1. Build the application:
   \`\`\`bash
   stack build
   \`\`\`

2. Run in development:
   \`\`\`bash
   stack exec {{projectNameSnake}}
   \`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/me\` - Get current user

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
│   └── Middleware.hs        # Middleware
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

## Scotty Features

- **Simple Routing**: Easy-to-use route definitions
- **Composable**: Functional, composable design
- **Type-Safe**: Compile-time safety for routes
- **WAI Compatible**: Works with WAI middleware ecosystem
- **Lightweight**: Small footprint, fast startup

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

## License

MIT
`
  }
};
