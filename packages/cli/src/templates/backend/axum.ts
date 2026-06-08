import { BackendTemplate } from '../types';

export const axumTemplate: BackendTemplate = {
  id: 'axum',
  name: 'Axum + Rust',
  displayName: 'Axum + Rust',
  description: 'Modern Axum web framework with tower middleware, async support, and extractors',
  framework: 'axum',
  language: 'rust',
  version: '1.0.0',
  tags: ['rust', 'axum', 'tower', 'extractors', 'api', 'postgresql', 'authentication'],
  port: 8080,
  features: [
    'authentication',
    'authorization',
    'database',
    'caching',
    'logging',
    'monitoring',
    'testing',
    'documentation',
    'security',
    'validation',
    'rate-limiting',
    'cors',
    'compression',
    'rest-api',
    'docker'
  ],
  dependencies: {
    'axum': '0.7',
    'axum-extra': '0.9',
    'tower': '0.4',
    'tower-http': '0.5',
    'tokio': '1.35',
    'serde': '1.0',
    'serde_json': '1.0',
    'sqlx': '0.7',
    'uuid': '1.6',
    'chrono': '0.4',
    'bcrypt': '0.15',
    'jsonwebtoken': '9.1',
    'tracing': '0.1',
    'tracing-subscriber': '0.3',
    'anyhow': '1.0',
    'thiserror': '1.0',
    'dotenv': '0.15',
    'redis': '0.24',
    'validator': '0.16',
    'hyper': '1.0',
    'futures': '0.3',
    'reqwest': '0.11',
    'mime': '0.3',
    'bytes': '1.5',
    'headers': '0.4'
  },
  devDependencies: {
    'cargo-watch': 'latest',
    'cargo-audit': 'latest',
    'cargo-tarpaulin': 'latest'
  },
  files: {
    'Cargo.toml': `[package]
name = "{{serviceName}}"
version = "0.1.0"
edition = "2021"
description = "Axum web framework with tower middleware and async support"
license = "MIT"
authors = ["{{author}}"]

[dependencies]
axum = { version = "0.7", features = ["macros"] }
axum-extra = { version = "0.9", features = ["typed-header"] }
tower = { version = "0.4", features = ["util", "timeout", "load-shed", "limit"] }
tower-http = { version = "0.5", features = ["cors", "compression-gzip", "trace", "request-id", "util"] }
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "chrono", "uuid"] }
uuid = { version = "1.6", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
bcrypt = "0.15"
jsonwebtoken = "9.1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
anyhow = "1.0"
thiserror = "1.0"
dotenv = "0.15"
redis = "0.24"
validator = { version = "0.16", features = ["derive"] }
hyper = { version = "1.0", features = ["full"] }
futures = "0.3"
reqwest = { version = "0.11", features = ["json"] }
mime = "0.3"
bytes = "1.5"
headers = "0.4"

[dev-dependencies]
tokio-test = "0.4"
tower = { version = "0.4", features = ["test-util"] }

[[bin]]
name = "{{serviceName}}"
path = "src/main.rs"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"`,

    '.env.example': `# Server Configuration
HOST=127.0.0.1
PORT=8080
RUST_LOG=info
RUST_BACKTRACE=1

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost/{{serviceName}}
DATABASE_MAX_CONNECTIONS=10

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379
REDIS_POOL_SIZE=10

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=3600

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization

# Security
BCRYPT_COST=12
SECURE_COOKIES=false

# Tower Configuration
TOWER_TIMEOUT_SECONDS=30
TOWER_CONCURRENCY_LIMIT=1000
TOWER_RATE_LIMIT_REQUESTS=100
TOWER_RATE_LIMIT_WINDOW=60`,

    'src/main.rs': `mod config;
mod models;
mod handlers;
mod middleware;
mod extractors;
mod database;
mod auth;
mod errors;
mod utils;
mod state;

use std::net::SocketAddr;
use std::time::Duration;

use axum::{
    routing::{get, post, put, delete},
    Router,
    middleware::from_fn};
use tower::{ServiceBuilder, limit::ConcurrencyLimitLayer, timeout::TimeoutLayer};
use tower_http::{
    cors::CorsLayer,
    compression::CompressionLayer,
    trace::TraceLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    services::ServeDir};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::database::create_pool;
use crate::handlers::{health, auth as auth_handlers, users};
use crate::middleware::{auth::auth_middleware, security::security_middleware};
use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "{{serviceName}}=debug,tower_http=debug,axum::rejection=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env()?;
    
    // Create database connection pool
    let db_pool = create_pool(&config.database_url, config.database_max_connections).await?;

    // Run database migrations
    sqlx::migrate!("./migrations").run(&db_pool).await?;

    tracing::info!("Starting Axum server at {}:{}", config.host, config.port);

    // Create application state
    let state = AppState::new(config.clone(), db_pool);

    // Build our application with routes and middleware
    let app = Router::new()
        // API routes
        .route("/api/health", get(health::health_check))
        .nest("/api/auth", auth_routes())
        .nest("/api/users", user_routes())
        // Static file serving (optional)
        .nest_service("/static", ServeDir::new("static"))
        // Global middleware stack
        .layer(
            ServiceBuilder::new()
                // High level logging of requests and responses
                .layer(TraceLayer::new_for_http())
                // Generate request IDs
                .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
                .layer(PropagateRequestIdLayer::x_request_id())
                // CORS
                .layer(cors_layer(&config))
                // Compression
                .layer(CompressionLayer::new())
                // Security middleware
                .layer(from_fn(security_middleware))
                // Timeout requests after 30 seconds
                .layer(TimeoutLayer::new(Duration::from_secs(config.tower_timeout_seconds)))
                // Limit concurrency
                .layer(ConcurrencyLimitLayer::new(config.tower_concurrency_limit))
        )
        .with_state(state);

    // Parse socket address
    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;

    // Create listener
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Listening on {}", addr);

    // Start server
    axum::serve(listener, app).await?;

    Ok(())
}

fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/register", post(auth_handlers::register))
        .route("/login", post(auth_handlers::login))
        .route("/refresh", post(auth_handlers::refresh_token))
        .route("/logout", post(auth_handlers::logout))
}

fn user_routes() -> Router<AppState> {
    Router::new()
        .route("/profile", get(users::get_profile))
        .route("/profile", put(users::update_profile))
        .route("/profile", delete(users::delete_account))
        .layer(from_fn(auth_middleware))
}

fn cors_layer(config: &Config) -> CorsLayer {
    use tower_http::cors::{Any, CorsLayer};

    if config.cors_allowed_origins.contains(&"*".to_string()) {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any)
    } else {
        let origins: Vec<_> = config.cors_allowed_origins
            .iter()
            .filter_map(|origin| origin.parse().ok())
            .collect();

        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                axum::http::Method::GET,
                axum::http::Method::POST,
                axum::http::Method::PUT,
                axum::http::Method::DELETE,
                axum::http::Method::OPTIONS])
            .allow_headers([
                axum::http::header::CONTENT_TYPE,
                axum::http::header::AUTHORIZATION])
    }
}`,

    'src/config.rs': `use serde::Deserialize;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub database_max_connections: u32,
    pub redis_url: String,
    pub redis_pool_size: u32,
    pub jwt_secret: String,
    pub jwt_expiration: u64,
    pub rate_limit_requests: u64,
    pub rate_limit_window: u64,
    pub cors_allowed_origins: Vec<String>,
    pub cors_allowed_methods: Vec<String>,
    pub cors_allowed_headers: Vec<String>,
    pub bcrypt_cost: u32,
    pub secure_cookies: bool,
    pub tower_timeout_seconds: u64,
    pub tower_concurrency_limit: usize,
    pub tower_rate_limit_requests: u64,
    pub tower_rate_limit_window: u64}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenv::dotenv().ok();

        Ok(Config {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,
            database_url: env::var("DATABASE_URL")?,
            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            redis_pool_size: env::var("REDIS_POOL_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
            jwt_secret: env::var("JWT_SECRET")?,
            jwt_expiration: env::var("JWT_EXPIRATION")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()?,
            rate_limit_requests: env::var("RATE_LIMIT_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()?,
            rate_limit_window: env::var("RATE_LIMIT_WINDOW")
                .unwrap_or_else(|_| "60".to_string())
                .parse()?,
            cors_allowed_origins: env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            cors_allowed_methods: env::var("CORS_ALLOWED_METHODS")
                .unwrap_or_else(|_| "GET,POST,PUT,DELETE,OPTIONS".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            cors_allowed_headers: env::var("CORS_ALLOWED_HEADERS")
                .unwrap_or_else(|_| "Content-Type,Authorization".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            bcrypt_cost: env::var("BCRYPT_COST")
                .unwrap_or_else(|_| "12".to_string())
                .parse()?,
            secure_cookies: env::var("SECURE_COOKIES")
                .unwrap_or_else(|_| "false".to_string())
                .parse()?,
            tower_timeout_seconds: env::var("TOWER_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()?,
            tower_concurrency_limit: env::var("TOWER_CONCURRENCY_LIMIT")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()?,
            tower_rate_limit_requests: env::var("TOWER_RATE_LIMIT_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()?,
            tower_rate_limit_window: env::var("TOWER_RATE_LIMIT_WINDOW")
                .unwrap_or_else(|_| "60".to_string())
                .parse()?})
    }
}`,

    'src/state.rs': `use sqlx::PgPool;
use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: PgPool}

impl AppState {
    pub fn new(config: Config, db: PgPool) -> Self {
        Self { config, db }
    }
}`,

    'src/models/mod.rs': `pub mod user;
pub mod auth;

pub use user::*;
pub use auth::*;`,

    'src/models/user.rs': `use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub password_hash: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 3, max = 50))]
    pub username: String,
    #[validate(length(min = 8))]
    pub password: String,
    #[validate(length(max = 100))]
    pub first_name: Option<String>,
    #[validate(length(max = 100))]
    pub last_name: Option<String>}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateUserRequest {
    #[validate(length(min = 3, max = 50))]
    pub username: Option<String>,
    #[validate(length(max = 100))]
    pub first_name: Option<String>,
    #[validate(length(max = 100))]
    pub last_name: Option<String>}

impl From<User> for UserProfile {
    fn from(user: User) -> Self {
        UserProfile {
            id: user.id,
            email: user.email,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active,
            is_verified: user.is_verified,
            created_at: user.created_at,
            updated_at: user.updated_at}
    }
}`,

    'src/models/auth.rs': `use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 1))]
    pub password: String}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: u64}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // User ID
    pub email: String,
    pub exp: usize,
    pub iat: usize,
    pub token_type: String, // "access" or "refresh"
}`,

    'src/handlers/mod.rs': `pub mod health;
pub mod auth;
pub mod users;`,

    'src/handlers/health.rs': `use axum::{response::Json, extract::State};
use serde_json::{json, Value};

use crate::state::AppState;

pub async fn health_check(State(_state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": "{{serviceName}}",
        "version": env!("CARGO_PKG_VERSION")
    }))
}`,

    'src/handlers/auth.rs': `use axum::{extract::State, response::Json};
use uuid::Uuid;
use validator::Validate;

use crate::state::AppState;
use crate::models::{CreateUserRequest, LoginRequest, LoginResponse, RefreshTokenRequest, User, UserProfile};
use crate::auth::{hash_password, verify_password, generate_token, verify_token};
use crate::errors::{AppError, AppResult};

pub async fn register(
    State(state): State<AppState>,
    Json(request): Json<CreateUserRequest>,
) -> AppResult<Json<UserProfile>> {
    request.validate()?;

    // Check if user already exists
    let existing_user = sqlx::query!("SELECT id FROM users WHERE email = $1 OR username = $2", request.email, request.username)
        .fetch_optional(&state.db)
        .await?;

    if existing_user.is_some() {
        return Err(AppError::BadRequest("User already exists".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&request.password, state.config.bcrypt_cost)?;

    // Create user
    let user_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query!(
        r#"
        INSERT INTO users (id, email, username, password_hash, first_name, last_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        user_id,
        request.email,
        request.username,
        password_hash,
        request.first_name,
        request.last_name,
        now,
        now
    )
    .execute(&state.db)
    .await?;

    // Fetch created user
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(UserProfile::from(user)))
}

pub async fn login(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> AppResult<Json<LoginResponse>> {
    request.validate()?;

    // Find user by email
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", request.email)
        .fetch_optional(&state.db)
        .await?;

    let user = user.ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

    // Verify password
    if !verify_password(&request.password, &user.password_hash)? {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    // Check if user is active
    if !user.is_active {
        return Err(AppError::Unauthorized("Account is disabled".to_string()));
    }

    // Generate tokens
    let access_token = generate_token(
        &user.id.to_string(),
        &user.email,
        "access",
        &state.config.jwt_secret,
        state.config.jwt_expiration,
    )?;
    let refresh_token = generate_token(
        &user.id.to_string(),
        &user.email,
        "refresh",
        &state.config.jwt_secret,
        state.config.jwt_expiration * 24,
    )?;

    let response = LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration};

    Ok(Json(response))
}

pub async fn refresh_token(
    State(state): State<AppState>,
    Json(request): Json<RefreshTokenRequest>,
) -> AppResult<Json<LoginResponse>> {
    // Verify refresh token
    let claims = verify_token(&request.refresh_token, &state.config.jwt_secret)?;

    if claims.token_type != "refresh" {
        return Err(AppError::Unauthorized("Invalid token type".to_string()));
    }

    // Generate new access token
    let access_token = generate_token(
        &claims.sub,
        &claims.email,
        "access",
        &state.config.jwt_secret,
        state.config.jwt_expiration,
    )?;

    let response = LoginResponse {
        access_token,
        refresh_token: request.refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: state.config.jwt_expiration};

    Ok(Json(response))
}

pub async fn logout() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "message": "Logged out successfully"
    }))
}`,

    'src/handlers/users.rs': `use axum::{extract::State, response::Json};
use validator::Validate;

use crate::state::AppState;
use crate::models::{User, UserProfile, UpdateUserRequest};
use crate::extractors::AuthUser;
use crate::errors::{AppError, AppResult};

pub async fn get_profile(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> AppResult<Json<UserProfile>> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", auth_user.user_id)
        .fetch_optional(&state.db)
        .await?;

    let user = user.ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserProfile::from(user)))
}

pub async fn update_profile(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(request): Json<UpdateUserRequest>,
) -> AppResult<Json<UserProfile>> {
    request.validate()?;

    // Check if username is already taken
    if let Some(username) = &request.username {
        let existing_user = sqlx::query!("SELECT id FROM users WHERE username = $1 AND id != $2", username, auth_user.user_id)
            .fetch_optional(&state.db)
            .await?;

        if existing_user.is_some() {
            return Err(AppError::BadRequest("Username already taken".to_string()));
        }
    }

    // Update user
    let now = chrono::Utc::now();
    let user = sqlx::query_as!(
        User,
        r#"
        UPDATE users 
        SET 
            username = COALESCE($2, username),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            updated_at = $5
        WHERE id = $1
        RETURNING *
        "#,
        auth_user.user_id,
        request.username,
        request.first_name,
        request.last_name,
        now
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(UserProfile::from(user)))
}

pub async fn delete_account(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    sqlx::query!("DELETE FROM users WHERE id = $1", auth_user.user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Account deleted successfully"
    })))
}`,

    'src/middleware/mod.rs': `pub mod auth;
pub mod security;`,

    'src/middleware/auth.rs': `use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response};

use crate::state::AppState;
use crate::auth::verify_token;
use crate::errors::AppError;

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|header| header.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(AppError::Unauthorized("Invalid authorization header format".to_string()));
    }

    let token = &auth_header[7..];
    let claims = verify_token(token, &state.config.jwt_secret)?;

    if claims.token_type != "access" {
        return Err(AppError::Unauthorized("Invalid token type".to_string()));
    }

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in token".to_string()))?;

    // Add user info to request extensions
    request.extensions_mut().insert(user_id);
    request.extensions_mut().insert(claims.email);

    Ok(next.run(request).await)
}`,

    'src/middleware/security.rs': `use axum::{
    extract::Request,
    middleware::Next,
    response::Response};

pub async fn security_middleware(
    request: Request,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;

    // Add security headers
    let headers = response.headers_mut();
    headers.insert(
        "x-content-type-options",
        "nosniff".parse().unwrap(),
    );
    headers.insert(
        "x-frame-options",
        "DENY".parse().unwrap(),
    );
    headers.insert(
        "x-xss-protection",
        "1; mode=block".parse().unwrap(),
    );
    headers.insert(
        "strict-transport-security",
        "max-age=31536000; includeSubDomains".parse().unwrap(),
    );
    headers.insert(
        "referrer-policy",
        "strict-origin-when-cross-origin".parse().unwrap(),
    );

    response
}`,

    'src/extractors/mod.rs': `use axum::{
    async_trait,
    extract::{FromRequestParts, Request},
    http::request::Parts};
use uuid::Uuid;

use crate::errors::AppError;

pub struct AuthUser {
    pub user_id: Uuid,
    pub email: String}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts
            .extensions
            .get::<Uuid>()
            .copied()
            .ok_or_else(|| AppError::Unauthorized("User not authenticated".to_string()))?;

        let email = parts
            .extensions
            .get::<String>()
            .cloned()
            .ok_or_else(|| AppError::Unauthorized("Email not found".to_string()))?;

        Ok(AuthUser { user_id, email })
    }
}

pub struct OptionalAuthUser {
    pub user: Option<AuthUser>}

#[async_trait]
impl<S> FromRequestParts<S> for OptionalAuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts.extensions.get::<Uuid>().copied();
        let email = parts.extensions.get::<String>().cloned();

        let user = match (user_id, email) {
            (Some(user_id), Some(email)) => Some(AuthUser { user_id, email }),
            _ => None};

        Ok(OptionalAuthUser { user })
    }
}`,

    'src/database.rs': `use sqlx::{PgPool, postgres::PgPoolOptions};
use anyhow::Result;

pub async fn create_pool(database_url: &str, max_connections: u32) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .connect(database_url)
        .await?;

    Ok(pool)
}`,

    'src/auth.rs': `use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::Claims;
use crate::errors::AppError;

pub fn hash_password(password: &str, cost: u32) -> Result<String, AppError> {
    hash(password, cost).map_err(|_| AppError::InternalServerError("Failed to hash password".to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    verify(password, hash).map_err(|_| AppError::InternalServerError("Failed to verify password".to_string()))
}

pub fn generate_token(
    user_id: &str,
    email: &str,
    token_type: &str,
    secret: &str,
    expiration: u64,
) -> Result<String, AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp: (now + expiration) as usize,
        iat: now as usize,
        token_type: token_type.to_string()};

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|_| AppError::InternalServerError("Failed to generate token".to_string()))
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))
}`,

    'src/errors.rs': `use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json};
use serde_json::json;
use validator::ValidationErrors;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    InternalServerError(String),
    ValidationError(ValidationErrors),
    DatabaseError(sqlx::Error)}

impl From<ValidationErrors> for AppError {
    fn from(errors: ValidationErrors) -> Self {
        AppError::ValidationError(errors)
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        AppError::DatabaseError(error)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(error: anyhow::Error) -> Self {
        AppError::InternalServerError(error.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            AppError::Unauthorized(message) => (StatusCode::UNAUTHORIZED, message),
            AppError::NotFound(message) => (StatusCode::NOT_FOUND, message),
            AppError::InternalServerError(message) => (StatusCode::INTERNAL_SERVER_ERROR, message),
            AppError::ValidationError(_) => (StatusCode::BAD_REQUEST, "Validation error".to_string()),
            AppError::DatabaseError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())};

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16()
        }));

        (status, body).into_response()
    }
}`,

    'src/utils.rs': `use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
    pub error: Option<String>}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
            error: None}
    }

    pub fn success_with_message(data: T, message: String) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: Some(message),
            error: None}
    }

    pub fn error(error: String) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            data: None,
            message: None,
            error: Some(error)}
    }
}

// Tower service utilities
pub mod tower_utils {
    use std::time::Duration;
    use tower::{ServiceBuilder, Layer};
    use tower::limit::{ConcurrencyLimitLayer, RateLimitLayer};
    use tower::timeout::TimeoutLayer;
    use tower::load_shed::LoadShedLayer;

    pub fn build_middleware_stack<S>() -> ServiceBuilder<
        impl Layer<S> + Clone,
    > {
        ServiceBuilder::new()
            .load_shed()
            .concurrency_limit(1000)
            .timeout(Duration::from_secs(30))
            .rate_limit(100, Duration::from_secs(60))
    }

    pub fn create_rate_limiter(requests: u64, window: Duration) -> RateLimitLayer {
        RateLimitLayer::new(requests, window)
    }

    pub fn create_timeout_layer(timeout: Duration) -> TimeoutLayer {
        TimeoutLayer::new(timeout)
    }

    pub fn create_concurrency_limit(limit: usize) -> ConcurrencyLimitLayer {
        ConcurrencyLimitLayer::new(limit)
    }

    pub fn create_load_shed() -> LoadShedLayer {
        LoadShedLayer::new()
    }
}`,

    'migrations/001_initial.sql': `-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/{{serviceName}}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
      - RUST_LOG=info
    depends_on:
      - db
      - redis
    volumes:
      - ./src:/app/src
    command: cargo watch -x run

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB={{serviceName}}
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:`,

    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM rust:1.75 as builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM debian:bookworm-slim

# Install runtime dependencies and curl for health checks
RUN apt-get update && apt-get install -y \\
    ca-certificates \\
    libpq-dev \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

COPY --from=builder /app/target/release/{{serviceName}} /app/{{serviceName}}
COPY --from=builder /app/migrations /app/migrations

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["./{{serviceName}}"]`,

    '.dockerignore': `target/
.env
.env.local
.git
.gitignore
README.md
docker-compose.yml
Dockerfile`,

    'README.md': `# {{serviceName}}

A modern Axum web framework with tower middleware, async support, and extractors.

## Features

- 🚀 **High Performance**: Built with Axum and tower for maximum performance
- 🎭 **Tower Middleware**: Comprehensive middleware stack with timeouts, rate limiting, and compression
- 🔐 **Authentication**: JWT-based authentication with custom extractors
- 🛡️ **Security**: Built-in security headers and CORS support
- 📊 **Database**: PostgreSQL integration with SQLx
- 🔄 **Async**: Fully asynchronous with Tokio runtime
- 📝 **Validation**: Request validation with the validator crate
- 🏃 **Extractors**: Custom extractors for type-safe request handling
- 📈 **Observability**: Structured logging and tracing
- 🐳 **Docker**: Production-ready Docker configuration
- 🧪 **Testing**: Comprehensive test framework setup

## Quick Start

### Prerequisites

- Rust 1.75+
- PostgreSQL 12+
- Redis 6+

### Development Setup

1. **Clone and setup**:
   \`\`\`bash
   cd {{serviceName}}
   cp .env.example .env
   \`\`\`

2. **Update environment variables** in \`.env\`:
   \`\`\`env
   DATABASE_URL=postgresql://username:password@localhost/{{serviceName}}
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   \`\`\`

3. **Setup database**:
   \`\`\`bash
   createdb {{serviceName}}
   sqlx migrate run
   \`\`\`

4. **Run the server**:
   \`\`\`bash
   cargo run
   \`\`\`

### Docker Development

\`\`\`bash
docker-compose up -d
\`\`\`

## Architecture

This application leverages Axum's modern async architecture with tower middleware:

### Tower Middleware Stack
\`\`\`rust
let app = Router::new()
    .layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
            .layer(CorsLayer::new())
            .layer(CompressionLayer::new())
            .layer(TimeoutLayer::new(Duration::from_secs(30)))
            .layer(ConcurrencyLimitLayer::new(1000))
    );
\`\`\`

### Custom Extractors
\`\`\`rust
pub async fn protected_handler(
    State(state): State<AppState>,
    auth_user: AuthUser, // Custom extractor
) -> AppResult<Json<Response>> {
    // Handler implementation
}
\`\`\`

### State Management
\`\`\`rust
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: PgPool}
\`\`\`

## API Endpoints

### Health Check
- \`GET /api/health\` - Service health status

### Authentication
- \`POST /api/auth/register\` - User registration
- \`POST /api/auth/login\` - User login
- \`POST /api/auth/refresh\` - Refresh access token
- \`POST /api/auth/logout\` - Logout user

### Users (Protected)
- \`GET /api/users/profile\` - Get user profile
- \`PUT /api/users/profile\` - Update user profile  
- \`DELETE /api/users/profile\` - Delete user account

## Development

### Hot Reload
\`\`\`bash
cargo install cargo-watch
cargo watch -x run
\`\`\`

### Database Migrations
\`\`\`bash
# Create new migration
sqlx migrate add <migration_name>

# Run migrations
sqlx migrate run

# Revert last migration
sqlx migrate revert
\`\`\`

### Testing
\`\`\`bash
cargo test
\`\`\`

### Code Coverage
\`\`\`bash
cargo install cargo-tarpaulin
cargo tarpaulin --out Html
\`\`\`

## Tower Middleware Features

### Request/Response Processing
- **Tracing**: Request/response logging with correlation IDs
- **Compression**: Gzip compression for responses
- **CORS**: Configurable cross-origin resource sharing
- **Security Headers**: Automatic security header injection
- **Timeout**: Request timeout handling
- **Rate Limiting**: Configurable rate limiting per client
- **Concurrency Control**: Maximum concurrent request limits

### Error Handling
Axum provides excellent error handling with custom error types:

\`\`\`rust
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            // ... other error types
        };
        
        (status, Json(json!({"error": message}))).into_response()
    }
}
\`\`\`

## Configuration

### Environment Variables
All configuration is handled through environment variables:

- \`HOST\`: Server host (default: 127.0.0.1)
- \`PORT\`: Server port (default: 8080)
- \`DATABASE_URL\`: PostgreSQL connection string
- \`JWT_SECRET\`: JWT signing secret
- \`TOWER_TIMEOUT_SECONDS\`: Request timeout in seconds
- \`TOWER_CONCURRENCY_LIMIT\`: Maximum concurrent requests
- \`RUST_LOG\`: Log level (debug, info, warn, error)

### Tower Configuration
Tower middleware can be configured via environment variables:

- \`TOWER_RATE_LIMIT_REQUESTS\`: Requests per window
- \`TOWER_RATE_LIMIT_WINDOW\`: Rate limit window in seconds
- \`TOWER_TIMEOUT_SECONDS\`: Request timeout
- \`TOWER_CONCURRENCY_LIMIT\`: Concurrency limit

## Production Deployment

### Docker
\`\`\`bash
docker build -t {{serviceName}} .
docker run -p 8080:8080 --env-file .env {{serviceName}}
\`\`\`

### Binary
\`\`\`bash
cargo build --release
./target/release/{{serviceName}}
\`\`\`

## Advanced Features

### Custom Extractors
Create type-safe extractors for common patterns:

\`\`\`rust
#[async_trait]
impl<S> FromRequestParts<S> for AuthUser {
    type Rejection = AppError;
    
    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // Implementation
    }
}
\`\`\`

### Middleware Composition
Build complex middleware stacks:

\`\`\`rust
use tower::ServiceBuilder;

let middleware = ServiceBuilder::new()
    .layer(auth_layer)
    .layer(rate_limit_layer)
    .layer(timeout_layer);
\`\`\`

## Testing

Axum provides excellent testing support with tower's test utilities:

\`\`\`rust
#[tokio::test]
async fn test_health_endpoint() {
    let app = create_app().await;
    
    let response = app
        .oneshot(Request::builder().uri("/api/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
        
    assert_eq!(response.status(), StatusCode::OK);
}
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.`,

    'sqlx-data.json': `{
  "db": "PostgreSQL",
  "queries": []
}`,

    'Makefile': `# Axum Development Makefile

.PHONY: dev build test clean docker-up docker-down migrate format lint audit

# Development
dev:
	cargo watch -x run

build:
	cargo build --release

# Testing
test:
	cargo test

test-coverage:
	cargo tarpaulin --out Html

# Database
migrate:
	sqlx migrate run

migrate-revert:
	sqlx migrate revert

migrate-add:
	@read -p "Migration name: " name; \\
	sqlx migrate add $$name

# Code Quality
format:
	cargo fmt

lint:
	cargo clippy -- -D warnings

audit:
	cargo audit

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker build -t {{serviceName}} .

# Cleanup
clean:
	cargo clean
	docker-compose down -v
	docker system prune -f

# Production
release:
	cargo build --release
	strip target/release/{{serviceName}}

# Install tools
install-tools:
	cargo install cargo-watch cargo-audit cargo-tarpaulin sqlx-cli

# Setup
setup: install-tools
	cp .env.example .env
	@echo "Please update .env with your configuration"
	@echo "Then run: make migrate && make dev"`
  },
  postInstall: [
    'cargo build',
    'echo "Axum server setup complete!"',
    'echo "Next steps:"',
    'echo "1. Update .env with your database credentials"',
    'echo "2. Run: sqlx migrate run"',
    'echo "3. Run: cargo run"',
    'echo ""',
    'echo "For development with hot reload:"',
    'echo "cargo install cargo-watch"',
    'echo "cargo watch -x run"'
  ]
};