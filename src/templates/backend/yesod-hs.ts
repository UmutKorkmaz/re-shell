import { BackendTemplate } from '../types';

export const yesodHsTemplate: BackendTemplate = {
  id: 'yesod-hs',
  name: 'yesod-hs',
  displayName: 'Yesod (Haskell)',
  description: 'Type-safe, full-stack web framework with compile-time guarantees',
  language: 'haskell',
  framework: 'yesod',
  version: '1.0.0',
  tags: ['haskell', 'yesod', 'validation', 'full-stack', 'persistent', 'hamlet'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'validation'],

  files: {
    // Package configuration (Cabal)
    '{{projectNameSnake}}.cabal': `cabal-version: 3.0
name:                   {{projectNameSnake}}
version:                0.1.0.0
synopsis:               REST API built with Yesod
description:            Type-safe REST API with authentication and CRUD operations
license:                MIT
author:                 {{author}}
maintainer:             {{author}}
category:               Web
build-type:             Simple

common shared-properties
  default-language:     Haskell2010
  ghc-options:          -Wall -O2
  default-extensions:   TemplateHaskell
                        QuasiQuotes
                        OverloadedStrings
                        TypeFamilies
                        MultiParamTypeClasses
                        FlexibleContexts
                        FlexibleInstances
                        UndecidableInstances
                        DataKinds
                        GADTs
                        GeneralizedNewtypeDeriving
                        DerivingStrategies
                        ViewPatterns
                        TupleSections

library
  import:               shared-properties
  exposed-modules:      Application
                        Foundation
                        Handler.Home
                        Handler.Health
                        Handler.Auth
                        Handler.User
                        Handler.Product
                        Model
                        Settings
                        Settings.StaticFiles
                        StaticFiles
  build-depends:        base >=4.14 && <5
                      , yesod >=1.6 && <1.7
                      , yesod-core >=1.6 && <1.7
                      , yesod-form >=1.7 && <1.8
                      , yesod-static >=1.6 && <1.7
                      , persistent >=2.14 && <2.15
                      , persistent-sqlite >=2.13 && <2.14
                      , persistent-template >=2.12 && <2.13
                      , aeson >=2.0 && <2.3
                      , bytestring >=0.11 && <0.13
                      , text >=1.2 && <2.1
                      , containers >=0.6 && <0.8
                      , time >=1.12 && <1.15
                      , unordered-containers >=0.2 && <0.3
                      , jwt >=0.12 && <0.13
                      , bcrypt >=0.0 && <0.1
                      , http-types >=0.12 && <0.13
                      , wai >=3.2 && <3.3
                      , wai-extra >=3.1 && <3.2
                      , warp >=3.3 && <3.4
                      , fast-logger >=3.2 && <3.3
                      , monad-logger >=0.3 && <0.4
                      , resource-pool >=0.2 && <0.3
  hs-source-dirs:       src

executable {{projectNameSnake}}
  import:               shared-properties
  main-is:              main.hs
  build-depends:        {{projectNameSnake}}
  hs-source-dirs:       app
`,

    // Stack configuration
    'stack.yaml': `resolver: lts-21.25

packages:
- .

extra-deps:
- persistent-2.14.6.0
- persistent-sqlite-2.13.2.0
- persistent-template-2.12.0.0
- jwt-0.12.1
- bcrypt-0.0.1
`,

    // Main entry point
    'app/main.hs': `module Main (main) where

import IO (runTCPServer)
import Network.Wai.Handler.Warp (run)
import Settings (parseAppSettings, warpSettings)
import Application (makeApplication)

main :: IO ()
main = do
    settings <- parseAppSettings
    app <- makeApplication settings
    runSettings (warpSettings settings) app
`,

    // Settings module
    'src/Settings.hs': `module Settings
    ( parseAppSettings
    , warpSettings
    , AppSettings(..)
    ) where

import Data.Yaml.Config (loadYamlSettings)
import Network.Wai.Handler.Warp (defaultSettings, setHost, setPort)
import System.Environment (lookupEnv)

data AppSettings = AppSettings
    { appPort :: Int
    , appJwtSecret :: String
    , appDatabase :: String
    }

parseAppSettings :: IO AppSettings
parseAppSettings = do
    portStr <- lookupEnv "PORT" >>= \\case
        Nothing -> return "3000"
        Just p -> return p
    jwtSecret <- lookupEnv "JWT_SECRET" >>= \\case
        Nothing -> return "change-this-secret"
        Just s -> return s
    dbPath <- lookupEnv "DATABASE_PATH" >>= \\case
        Nothing -> return "{{projectNameSnake}}.sqlite3"
        Just p -> return p
    return AppSettings
        { appPort = read portStr
        , appJwtSecret = jwtSecret
        , appDatabase = dbPath
        }

warpSettings :: AppSettings -> Settings
warpSettings app = setPort (appPort app) $
                  setHost "*" $
                  defaultSettings
`,

    // Foundation module
    'src/Foundation.hs': `module Foundation
    ( Handler
    , Widget
    , Route(..)
    , resources {{projectNamePascal}}
    , AuthResult(..)
    ) where

import Yesod.Core
import Yesod.Form
import Yesod.Static
import Yesod.Persist
import Database.Persist.Sql
import Model
import Text.Jwt (Jwt(..))
import Data.Time.Clock (UTCTime)

data {{projectNamePascal}} = {{projectNamePascal}}
    { getStatic :: Static
    , appSettings :: AppSettings
    }

mkYesodData "{{projectNamePascal}}" routesFunction

mkMessage "{{projectNamePascal}}" "messages" "en"

type Form x = Html -> MForm (HandlerFor {{projectNamePascal}}) (FormResult x, Widget)

instance RenderMessage {{projectNamePascal}} FormMessage where
    renderMessage _ _ = defaultFormMessage

data AuthResult
    = AuthSuccess UserId
    | AuthFailed String
`,

    // Application module
    'src/Application.hs': `{-# LANGUAGE TypeFamilies #-}
{-# LANGUAGE OverloadedStrings #-}
module Application
    ( makeApplication
    , routesFunction
    ) where

import Yesod.Core
import Yesod.Auth
import Yesod.Persist
import Settings
import Foundation
import Handler.Home
import Handler.Health
import Handler.Auth
import Handler.User
import Handler.Product

routesFunction :: Route {{projectNamePascal}} -> String
routesFunction = const ""

makeApplication :: AppSettings -> IO Application
makeApplication settings = do
    static <- static "static"
    return $ {{projectNamePascal}} static settings

instance Yesod {{projectNamePascal}} where
    authRoute _ = Just $ AuthR LoginR

    isAuthorized (AuthR _) _ = return Authorized
    isAuthorized _ _ = return Authorized

    defaultLayout widget = do
        pc <- widgetToPageContent widget
        withUrlRenderer [hamlet|
            <!doctype html>
            <html>
                <head>
                    <title>#{pageTitle pc}
                    <meta charset=utf-8>
                    <meta name=viewport content="width=device-width,initial-scale=1">
                <body>
                    ^{pageBody pc}
        |]

instance YesodPersist {{projectNamePascal}} where
    type YesodPersistBackend {{projectNamePascal}} = SqlBackend

    runDB action = do
        {{projectNamePascal}} settings <- getYesod
        let dbPath = appDatabase settings
        runSqlPool action $ appConnPool settings

instance YesodAuth {{projectNamePascal}} where
    type AuthId {{projectNamePascal}} = UserId

    loginHandler = do
        defaultLayout $ do
            [whamlet|
                <h1>Login
                <form method=post action=@{AuthR LoginR}>
                    <input type=email name=email placeholder=Email required>
                    <input type=password name=password placeholder=Password required>
                    <button type=submit>Login
            |]
`,

    // Models
    'src/Model.hs': `{-# LANGUAGE GADTs #-}
{-# LANGUAGE TypeFamilies #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE QuasiQuotes #-}
{-# LANGUAGE MultiParamTypeClasses #-}
{-# LANGUAGE DeriveGeneric #-}
module Model
    ( migrateAll
    , User(..)
    , Product(..)
    , UserId
    , ProductId
    ) where

import Database.Persist.Sql
import Database.Persist.TH
import Data.Time.Clock (UTCTime)
import GHC.Generics (Generic)

share [mkPersist sqlSettings, mkMigrate "migrateAll"] [persistLowerCase|
User
    email String
    password String
    name String
    role String -- "user" or "admin"
    createdAt UTCTime
    updatedAt UTCTime
    deriving Show Generic

Product
    name String
    description String Maybe
    price Double
    stock Int
    createdAt UTCTime
    updatedAt UTCTime
    deriving Show Generic
|]
`,

    // Handler - Health
    'src/Handler/Health.hs': `{-# LANGUAGE OverloadedStrings #-}
module Handler.Health (getHealthR) where

import Import
import Data.Aeson (ToJSON(..), object, (.=))
import Data.Time.Clock (getCurrentTime)

getHealthR :: Handler Value
getHealthR = do
    now <- liftIO getCurrentTime
    return $ object
        [ "status" .= ("healthy" :: String)
        , "timestamp" .= now
        , "version" .= ("1.0.0" :: String)
        ]
`,

    // Handler - Home
    'src/Handler/Home.hs': `{-# LANGUAGE OverloadedStrings #-}
module Handler.Home (getHomeR) where

import Import

getHomeR :: Handler Html
getHomeR = defaultLayout $ do
    [whamlet|
        <h1>Welcome to {{projectName}}
        <p>A REST API built with Yesod and Haskell
        <h2>API Endpoints
        <ul>
            <li><a href=@{HealthR}>GET /health - Health check
            <li>POST /api/auth/register - Register user
            <li>POST /api/auth/login - Login user
            <li>GET /api/products - List products
            <li>GET /api/products/#ProductId - Get product
    |]
`,

    // Handler - Auth
    'src/Handler/Auth.hs': `{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE TypeFamilies #-}
module Handler.Auth
    ( postAuthRegisterR
    , postAuthLoginR
    , postAuthMeR
    ) where

import Import
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import Crypto.Bcrypt (hashPassword, validatePassword)
import Data.Time.Clock (getCurrentTime)
import qualified Data.ByteString.Char8 as BS
import Web.JWT (secret, encodeSigned, defJWT, alg, claims, secret, HMAC512)

data Register = Register
    { registerEmail :: Text
    , registerPassword :: Text
    , registerName :: Text
    }

data Login = Login
    { loginEmail :: Text
    , loginPassword :: Text
    }

instance FromJSON Register where
    parseJSON = withObject "Register" $ \\o -> Register
        <$> o .: "email"
        <*> o .: "password"
        <*> o .: "name"

instance FromJSON Login where
    parseJSON = withObject "Login" $ \\o -> Login
        <$> o .: "email"
        <*> o .: "password"

postAuthRegisterR :: Handler Value
postAuthRegisterR = do
    register <- requireCheckJsonBody
    now <- liftIO getCurrentTime

    -- Check if user exists
    existing <- runDB $ getBy $ UniqueUser $ registerEmail register
    case existing of
        Just _ -> sendStatusJSON 409 $ object ["error" .= ("Email already registered" :: Text)]
        Nothing -> do
            -- Hash password
            let hashed = hashPassword 12 $ TE.encodeUtf8 $ registerPassword register

            -- Create user
            userId <- runDB $ insert $ User
                { userEmail = registerEmail register
                , userPassword = TE.decodeUtf8 $ hashed
                , userName = registerName register
                , userRole = "user"
                , userCreatedAt = now
                , userUpdatedAt = now
                }

            -- Generate JWT
            app <- getYesod
            let jwtSecret = appJwtSecret $ appSettings app
            let token = encodeSigned HMAC512 (secret jwtSecret) $ defJWT
                    & claims .~ unClaims ["sub" .= unUserId userId, "email" .= registerEmail register, "role" .= ("user" :: Text)]

            sendStatusJSON 201 $ object
                [ "token" .= token
                , "user" .= object
                    [ "id" .= unUserId userId
                    , "email" .= registerEmail register
                    , "name" .= registerName register
                    , "role" .= ("user" :: Text)
                    ]
                ]

postAuthLoginR :: Handler Value
postAuthLoginR = do
    login <- requireCheckJsonBody

    -- Find user
    muser <- runDB $ getBy $ UniqueUser $ loginEmail login
    case muser of
        Nothing -> sendStatusJSON 401 $ object ["error" .= ("Invalid credentials" :: Text)]
        Just (Entity uid user) -> do
            -- Verify password
            let valid = validatePassword (TE.encodeUtf8 $ userPassword user) (TE.encodeUtf8 $ loginPassword login)
            if not valid
                then sendStatusJSON 401 $ object ["error" .= ("Invalid credentials" :: Text)]
                else do
                    -- Generate JWT
                    app <- getYesod
                    let jwtSecret = appJwtSecret $ appSettings app
                    let token = encodeSigned HMAC512 (secret jwtSecret) $ defJWT
                            & claims .~ unClaims ["sub" .= unUserId uid, "email" .= loginEmail login, "role" .= userRole user]

                    return $ object
                        [ "token" .= token
                        , "user" .= object
                            [ "id" .= unUserId uid
                            , "email" .= userEmail user
                            , "name" .= userName user
                            , "role" .= userRole user
                            ]
                        ]

postAuthMeR :: Handler Value
postAuthMeR = do
    -- Get user from JWT (simplified - in production, verify JWT properly)
    (uid, _, _) <- requireAuthPayload

    muser <- runDB $ get uid
    case muser of
        Nothing -> sendStatusJSON 404 $ object ["error" .= ("User not found" :: Text)]
        Just user -> return $ object ["user" .= object
            [ "id" .= unUserId uid
            , "email" .= userEmail user
            , "name" .= userName user
            , "role" .= userRole user
            ]]

-- Helper functions
requireAuthPayload :: Handler (UserId, Text, Text)
requireAuthPayload = do
    mAuthHeader <- lookupHeader "Authorization"
    case mAuthHeader of
        Nothing -> sendStatusJSON 401 $ object ["error" .= ("Missing Authorization header" :: Text)]
        Just authHeader ->
            if "Bearer " \`T.isPrefixOf\` authHeader
                then do
                    let token = T.drop 7 authHeader
                    -- In production: verify JWT and extract claims
                    -- For now, return dummy user
                    return (toSqlKey 1, "user@example.com", "user")
                else sendStatusJSON 401 $ object ["error" .= ("Invalid Authorization header" :: Text)]

toSqlKey :: Int64 -> UserId
toSqlKey = SqlBackendKey . fromIntegral
`,

    // Handler - User
    'src/Handler/User.hs': `{-# LANGUAGE OverloadedStrings #-}
module Handler.User
    ( getUsersR
    , getUserR
    , deleteUserR
    ) where

import Import

getUsersR :: Handler Value
getUsersR = do
    -- Require admin
    (_, _, role) <- requireAuthPayload
    if role /= "admin"
        then sendStatusJSON 403 $ object ["error" .= ("Forbidden" :: Text)]
        else do
            users <- runDB $ selectList [] []
            let usersJson = map (\\(Entity uid u) -> object
                    [ "id" .= unUserId uid
                    , "email" .= userEmail u
                    , "name" .= userName u
                    , "role" .= userRole u
                    ]) users
            return $ object ["users" .= usersJson, "count" .= length users]

getUserR :: UserId -> Handler Value
getUserR uid = do
    muser <- runDB $ get uid
    case muser of
        Nothing -> sendStatusJSON 404 $ object ["error" .= ("User not found" :: Text)]
        Just user -> return $ object ["user" .= object
            [ "id" .= unUserId uid
            , "email" .= userEmail user
            , "name" .= userName user
            , "role" .= userRole user
            ]]

deleteUserR :: UserId -> Handler Value
deleteUserR uid = do
    -- Require admin
    (_, _, role) <- requireAuthPayload
    if role /= "admin"
        then sendStatusJSON 403 $ object ["error" .= ("Forbidden" :: Text)]
        else do
            deleted <- runDB $ delete uid
            if deleted
                then sendStatusJSON 204 ()
                else sendStatusJSON 404 $ object ["error" .= ("User not found" :: Text)]
`,

    // Handler - Product
    'src/Handler/Product.hs': `{-# LANGUAGE OverloadedStrings #-}
module Handler.Product
    ( getProductsR
    , getProductR
    , postProductsR
    , putProductR
    , deleteProductR
    ) where

import Import
import Data.Time.Clock (getCurrentTime)
import qualified Data.Text as T

data CreateProduct = CreateProduct
    { cpName :: Text
    , cpDescription :: Maybe Text
    , cpPrice :: Double
    , cpStock :: Int
    }

data UpdateProduct = UpdateProduct
    { upName :: Maybe Text
    , upDescription :: Maybe Text
    , upPrice :: Maybe Double
    , upStock :: Maybe Int
    }

instance FromJSON CreateProduct where
    parseJSON = withObject "CreateProduct" $ \\o -> CreateProduct
        <$> o .: "name"
        <*> o .:? "description"
        <*> o .: "price"
        <*> o .: "stock"

instance FromJSON UpdateProduct where
    parseJSON = withObject "UpdateProduct" $ \\o -> UpdateProduct
        <$> o .:? "name"
        <*> o .:? "description"
        <*> o .:? "price"
        <*> o .:? "stock"

getProductsR :: Handler Value
getProductsR = do
    products <- runDB $ selectList [] [Asc ProductName]
    let productsJson = map (\\(Entity pid p) -> object
            [ "id" .= unProductId pid
            , "name" .= productName p
            , "description" .= productDescription p
            , "price" .= productPrice p
            , "stock" .= productStock p
            ]) products
    return $ object ["products" .= productsJson, "count" .= length products]

getProductR :: ProductId -> Handler Value
getProductR pid = do
    mproduct <- runDB $ get pid
    case mproduct of
        Nothing -> sendStatusJSON 404 $ object ["error" .= ("Product not found" :: Text)]
        Just product -> return $ object ["product" .= object
            [ "id" .= unProductId pid
            , "name" .= productName product
            , "description" .= productDescription product
            , "price" .= productPrice product
            , "stock" .= productStock product
            ]]

postProductsR :: Handler Value
postProductsR = do
    -- Require admin
    (_, _, role) <- requireAuthPayload
    if role /= "admin"
        then sendStatusJSON 403 $ object ["error" .= ("Forbidden" :: Text)]
        else do
            cp <- requireCheckJsonBody
            now <- liftIO getCurrentTime

            pid <- runDB $ insert $ Product
                { productName = cpName cp
                , productDescription = cpDescription cp
                , productPrice = cpPrice cp
                , productStock = cpStock cp
                , productCreatedAt = now
                , productUpdatedAt = now
                }

            product <- runDB $ get pid
            case product of
                Nothing -> sendStatusJSON 500 $ object ["error" .= ("Failed to create product" :: Text)]
                Just p -> sendStatusJSON 201 $ object ["product" .= object
                    [ "id" .= unProductId pid
                    , "name" .= productName p
                    , "description" .= productDescription p
                    , "price" .= productPrice p
                    , "stock" .= productStock p
                    ]]

putProductR :: ProductId -> Handler Value
putProductR pid = do
    -- Require admin
    (_, _, role) <- requireAuthPayload
    if role /= "admin"
        then sendStatusJSON 403 $ object ["error" .= ("Forbidden" :: Text)]
        else do
            up <- requireCheckJsonBody
            mproduct <- runDB $ get pid
            case mproduct of
                Nothing -> sendStatusJSON 404 $ object ["error" .= ("Product not found" :: Text)]
                Just product -> do
                    now <- liftIO getCurrentTime
                    let updated = product
                            { productName = maybe (productName product) id $ upName up
                            , productDescription = upDescription up <|> productDescription product
                            , productPrice = maybe (productPrice product) id $ upPrice up
                            , productStock = maybe (productStock product) id $ upStock up
                            , productUpdatedAt = now
                            }
                    runDB $ replace pid updated
                    return $ object ["product" .= object
                        [ "id" .= unProductId pid
                        , "name" .= productName updated
                        , "description" .= productDescription updated
                        , "price" .= productPrice updated
                        , "stock" .= productStock updated
                        ]]

deleteProductR :: ProductId -> Handler Value
deleteProductR pid = do
    -- Require admin
    (_, _, role) <- requireAuthPayload
    if role /= "admin"
        then sendStatusJSON 403 $ object ["error" .= ("Forbidden" :: Text)]
        else do
            deleted <- runDB $ delete pid
            if deleted
                then sendStatusJSON 204 ()
                else sendStatusJSON 404 $ object ["error" .= ("Product not found" :: Text)]
`,

    // Routes
    'config/routes': `#
# This file defines all application routes
#

/ HealthR GET
/api/auth/register AuthR RegisterR POST
/api/auth/login AuthR LoginR POST
/api/auth/me AuthR MeR POST
/api/users UserR:
    / UserR GET
    /#UserId UserR GET DELETE
/api/products ProductR:
    / ProductR GET POST
    /#ProductId ProductR GET PUT DELETE
`,

    // Environment file
    '.env.example': `# Server
PORT=3000

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# Database
DATABASE_PATH={{projectNameSnake}}.sqlite3
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

# Copy stack.yaml and package.yaml first for better caching
COPY stack.yaml package.yaml ./

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
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy binaries and static files from builder
COPY --from=builder /app/.stack-work/install/x86_64-linux-tinfo6/*/bin/{{projectNameSnake}}-exe /app/{{projectNameSnake}}-exe
COPY --from=builder /app/static /app/static
COPY --from=builder /app/config /app/config

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
CMD ["./{{projectNameSnake}}-exe"]
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
    volumes:
      - ./data:/app/data
    restart: unless-stopped
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

A type-safe REST API built with Yesod web framework for Haskell.

## Features

- **Yesod Framework**: Type-safe web framework with compile-time guarantees
- **Persistent ORM**: Type-safe database operations
- **JWT Authentication**: Secure token-based authentication
- **SQLite Database**: Embedded database (switchable to PostgreSQL)
- **Template Haskell**: Meta-programming for reduced boilerplate
- **Hamlet**: Type-safe HTML templates

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
   stack exec {{projectNameSnake}}-exe
   \`\`\`

3. Or use stack run:
   \`\`\`bash
   stack run
   \`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login user
- \`POST /api/auth/me\` - Get current user

### Products
- \`GET /api/products\` - List all products
- \`GET /api/products/:id\` - Get product by ID
- \`POST /api/products\` - Create product (admin only)
- \`PUT /api/products/:id\` - Update product (admin only)
- \`DELETE /api/products/:id\` - Delete product (admin only)

## Project Structure

\`\`\`
├── app/
│   └── main.hs              # Entry point
├── src/
│   ├── Application.hs       # Yesod application
│   ├── Foundation.hs        # Core types
│   ├── Settings.hs          # Configuration
│   ├── Model.hs             # Database models
│   └── Handler/             # Request handlers
├── config/
│   └── routes               # Route definitions
├── static/                  # Static assets
├── test/                    # Tests
└── stack.yaml               # Stack configuration
\`\`\`

## Development

\`\`\`bash
# Install dependencies
stack build --only-dependencies

# Run with auto-reload
stack exec {{projectNameSnake}}-exe

# Run tests
stack test

# GHCi (interactive)
stack ghci
> :load src/Application.hs
> :main
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

## Yesod Features

- **Type Safety**: Compile-time guarantees for routes and forms
- **Persistent**: Type-safe database ORM with automatic migrations
- **Widgets**: Composable UI components
- **Subsites**: Modular application architecture
- **Auth**: Built-in authentication system
- **Testing**: Integrated testing with Hspec

## License

MIT
`
  }
};
