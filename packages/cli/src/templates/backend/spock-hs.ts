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
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'validation', 'graphql'],

  files: {

    // Stack configuration
    'stack.yaml': `resolver: lts-21.25

packages:
- .
`,

    // Models
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

    // Auth module
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

    // GraphQL module (Morpheus schema + resolver)
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
    libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy stack.yaml and cabal file first for better caching
COPY stack.yaml {{projectName}}.cabal ./

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
COPY --from=builder /app/.stack-work/install/x86_64-linux-tinfo6/*/bin/{{projectName}} /app/{{projectName}}

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
CMD ["./{{projectName}}"]
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

import Data.Aeson (Value (..), decode)
import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy as LBS
import qualified Data.Aeson.KeyMap as KeyMap
import Data.Text.Encoding (encodeUtf8)
import System.Environment (setEnv)
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
main = do
  setEnv "QUIET" "1"
  hspec $ with mkApp $ do
    describe "API" $ do
      it "responds to the health check" $
        get "/health" \`shouldRespondWith\` 200

      it "lists the seeded products" $
        get "/api/v1/products" \`shouldRespondWith\` 200

      it "rejects bad credentials and unauthenticated requests" $ do
        postJson "/api/v1/auth/login" "{\\"email\\":\\"admin@example.com\\",\\"password\\":\\"nope\\"}" \`shouldRespondWith\` 401
        get "/api/v1/auth/me" \`shouldRespondWith\` 401

      it "logs in the admin, who can then create products" $ do
        response <- postJson "/api/v1/auth/login" "{\\"email\\":\\"admin@example.com\\",\\"password\\":\\"admin123\\"}"
        case tokenFrom response of
          Just (String token) -> do
            let headers = [("Authorization", "Bearer " <> encodeUtf8 token), ("Content-Type", "application/json")]
            request "POST" "/api/v1/products" headers "{\\"name\\":\\"Widget\\",\\"price\\":9.5}" \`shouldRespondWith\` 201
            request "GET" "/api/v1/auth/me" headers "" \`shouldRespondWith\` 200
          _ -> liftIO (expectationFailure "no token in the login response")

      it "answers GraphQL" $
        postJson "/graphql" "{\\"query\\":\\"{ hello health }\\"}" \`shouldRespondWith\` 200
`,

    // README
    'README.md': `# {{projectName}}

A type-safe REST API built with Spock web framework for Haskell.

## Features

- **Spock Framework**: Type-safe routing with compile-time guarantees
- **JWT Authentication**: Secure token-based authentication
- **Middleware**: Composable middleware stack
- **In-memory store**: STM-backed data (swap in a database for production)

## Requirements

- GHC 9.4+
- Stack 2.11+

## Quick Start

1. Build the application:
   \`\`\`bash
   stack build
   \`\`\`

2. Run in development:
   \`\`\`bash
   stack exec {{projectName}}
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
├── app/Main.hs              # Entry point (PORT, default 3000)
├── src/
│   ├── App.hs               # Spock routes and the WAI application
│   ├── Models.hs            # Data models and JSON
│   ├── Store.hs             # In-memory data store (STM)
│   ├── Auth.hs              # JWT (jwt) and bcrypt (crypton)
│   └── Graphql.hs           # GraphQL surface (POST /graphql)
└── test/Spec.hs             # hspec-wai tests
\`\`\`

## Development

\`\`\`bash
# Install dependencies
stack build --only-dependencies

# Run with auto-reload
stack exec {{projectName}}

# Run tests
stack test

# GHCi (interactive)
stack ghci
> :load src/App.hs
\`\`\`

## Spock Features

- **Type-Safe Routes**: Compile-time route checking
- **Middleware**: Composable request/response processing
- **Session Management**: Built-in session support (unused here: the API is stateless JWT)

## Docker

\`\`\`bash
docker-compose up
\`\`\`

## License

MIT
`,

    'app/Main.hs': `module Main (main) where

import Network.Wai.Handler.Warp (run)
import System.Environment (lookupEnv)
import Text.Read (readMaybe)

import App (mkApp)

main :: IO ()
main = do
  port <- maybe 3000 id . (>>= readMaybe) <$> lookupEnv "PORT"
  app <- mkApp
  putStrLn ("Server running at http://localhost:" ++ show port)
  run port app
`,

    'src/App.hs': `{-# LANGUAGE OverloadedStrings #-}
module App (mkApp) where

import Control.Monad.IO.Class (MonadIO, liftIO)
import Data.Aeson (Value, object, (.=))
import Data.Text (Text)
import qualified Data.Text as T
import Data.Time.Clock (getCurrentTime)
import Network.HTTP.Types.Status (Status, status200, status201, status204, status400, status401, status403, status404, status409)
import Network.Wai (Application)
import Network.Wai.Middleware.Cors
import Web.Spock
import Web.Spock.Config

import Auth
import Graphql (resolveRequest)
import Models
import Store

-- | Responds with a JSON error.
failWith :: MonadIO m => Status -> Text -> ActionCtxT ctx m ()
failWith code message = do
  setStatus code
  json (object ["error" .= message])

-- | Runs the action for a request with a valid bearer token.
withClaims :: MonadIO m => (Claims -> ActionCtxT ctx m ()) -> ActionCtxT ctx m ()
withClaims action = do
  authorization <- header "Authorization"
  case authorization >>= T.stripPrefix "Bearer " of
    Nothing -> failWith status401 "Unauthorized"
    Just token -> do
      verified <- liftIO (verifyToken token)
      maybe (failWith status401 "Invalid or expired token") action verified

-- | Runs the action for an admin.
withAdmin :: MonadIO m => (Claims -> ActionCtxT ctx m ()) -> ActionCtxT ctx m ()
withAdmin action = withClaims $ \\claims ->
  if claimsRole claims == "admin"
    then action claims
    else failWith status403 "Admin role required"

session :: MonadIO m => Status -> User -> ActionCtxT ctx m ()
session code user = do
  token <- liftIO (signToken user)
  setStatus code
  json (TokenResponse token user)

-- | The WAI application (a fresh in-memory store per call).
mkApp :: IO Application
mkApp = do
  store <- newStore
  cfg <- defaultSpockCfg () PCNoDatabase ()
  spockAsApp (spock cfg (routes store))

routes :: Store -> SpockM () () () ()
routes store = do
  middleware $
    cors . const . Just $
      simpleCorsResourcePolicy
        { corsMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        , corsRequestHeaders = ["Content-Type", "Authorization"]
        }

  get root $ text "{{projectName}} API - Running"

  -- Health check
  let health = do
        now <- liftIO getCurrentTime
        json (object ["status" .= ("healthy" :: Text), "timestamp" .= now, "version" .= ("1.0.0" :: Text)])
  get "health" health
  get ("api" <//> "v1" <//> "health") health

  -- GraphQL endpoint
  post "graphql" $ do
    query <- jsonBody' :: ActionCtxT () (WebStateM () () ()) Value
    json (resolveRequest query)

  -- Auth routes
  post ("api" <//> "v1" <//> "auth" <//> "register") $ do
    Register email name password <- jsonBody'
    if T.length password < 6 || T.null name || T.null email
      then failWith status400 "email, name and a password of at least 6 characters are required"
      else do
        created <- liftIO (addUser store email name password "user")
        either (failWith status409) (session status201) created

  post ("api" <//> "v1" <//> "auth" <//> "login") $ do
    Login email password <- jsonBody'
    found <- liftIO (findUserByEmail store email)
    case found of
      Just user | verifyPassword password (userPasswordHash user) -> session status200 user
      _ -> failWith status401 "Invalid credentials"

  get ("api" <//> "v1" <//> "auth" <//> "me") $ withClaims $ \\claims ->
    json (object ["userId" .= claimsSub claims, "email" .= claimsEmail claims, "role" .= claimsRole claims])

  -- User routes (admin only)
  get ("api" <//> "v1" <//> "users") $ withAdmin $ \\_ -> do
    users <- liftIO (listUsers store)
    json (object ["users" .= users, "count" .= length users])

  get ("api" <//> "v1" <//> "users" <//> var) $ \\uid -> withAdmin $ \\_ -> do
    found <- liftIO (findUserById store uid)
    maybe (failWith status404 "User not found") (\\user -> json (object ["user" .= user])) found

  delete ("api" <//> "v1" <//> "users" <//> var) $ \\uid -> withAdmin $ \\_ -> do
    deleted <- liftIO (deleteUser store uid)
    if deleted then setStatus status204 else failWith status404 "User not found"

  -- Product routes
  get ("api" <//> "v1" <//> "products") $ do
    products <- liftIO (listProducts store)
    json (object ["products" .= products, "count" .= length products])

  get ("api" <//> "v1" <//> "products" <//> var) $ \\n -> do
    found <- liftIO (findProduct store n)
    maybe (failWith status404 "Product not found") (\\p -> json (object ["product" .= p])) found

  post ("api" <//> "v1" <//> "products") $ withAdmin $ \\_ -> do
    input <- jsonBody'
    created <- liftIO (addProduct store input)
    setStatus status201
    json (object ["product" .= created])

  put ("api" <//> "v1" <//> "products" <//> var) $ \\n -> withAdmin $ \\_ -> do
    changes <- jsonBody'
    updated <- liftIO (patchProduct store n changes)
    maybe (failWith status404 "Product not found") (\\p -> json (object ["product" .= p])) updated

  delete ("api" <//> "v1" <//> "products" <//> var) $ \\n -> withAdmin $ \\_ -> do
    deleted <- liftIO (deleteProduct store n)
    if deleted then setStatus status204 else failWith status404 "Product not found"
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
`,

    '{{projectName}}.cabal': `cabal-version:       2.4
name:                {{projectName}}
version:             0.1.0.0
synopsis:            REST API built with Spock
description:         Type-safe REST API with the Spock web framework
license:             MIT
author:              re-shell
maintainer:          re-shell
category:            Web
build-type:          Simple

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
                    , Spock >=0.14 && <0.15
                    , Spock-core >=0.14 && <0.15
                    , aeson >=2.0 && <2.3
                    , bytestring >=0.11 && <0.13
                    , containers >=0.6 && <0.8
                    , crypton >=0.33 && <1.1
                    , http-types >=0.12 && <0.13
                    , jwt >=0.11 && <0.12
                    , stm >=2.5 && <2.6
                    , text >=1.2 && <2.2
                    , time >=1.12 && <1.15
                    , uuid >=1.3 && <1.4
                    , wai >=3.2 && <3.3
                    , wai-cors >=0.2 && <0.3
                    , wai-extra >=3.1 && <3.2

executable {{projectName}}
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
`
  }
};
