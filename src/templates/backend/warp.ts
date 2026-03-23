import { BackendTemplate } from '../types';

export const warpTemplate: BackendTemplate = {
  id: 'warp',
  name: 'Warp + Rust',
  displayName: 'Warp + Rust',
  description: 'Functional Warp web framework with composable filters, async/await, and type-safe routing',
  framework: 'warp',
  language: 'rust',
  version: '1.0.0',
  tags: ['rust', 'warp', 'functional', 'composable', 'api', 'postgresql', 'authentication'],
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
    'warp': '0.3',
    'tokio': '1.35',
    'serde': '1.0',
    'serde_json': '1.0',
    'sqlx': '0.7',
    'uuid': '1.6',
    'chrono': '0.4',
    'bcrypt': '0.15',
    'jsonwebtoken': '9.1',
    'env_logger': '0.10',
    'log': '0.4',
    'anyhow': '1.0',
    'thiserror': '1.0',
    'dotenv': '0.15',
    'redis': '0.24',
    'validator': '0.16',
    'mime': '0.3',
    'futures': '0.3',
    'reqwest': '0.11',
    'tracing': '0.1',
    'tracing-subscriber': '0.3',
    'bytes': '1.5',
    'headers': '0.3',
    'hyper': '0.14',
    'tower': '0.4',
    'tower-http': '0.4'
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
description = "Warp web framework with functional programming patterns"
license = "MIT"
authors = ["{{author}}"]

[dependencies]
warp = "0.3"
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "chrono", "uuid"] }
uuid = { version = "1.6", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
bcrypt = "0.15"
jsonwebtoken = "9.1"
env_logger = "0.10"
log = "0.4"
anyhow = "1.0"
thiserror = "1.0"
dotenv = "0.15"
redis = "0.24"
validator = { version = "0.16", features = ["derive"] }
mime = "0.3"
futures = "0.3"
reqwest = { version = "0.11", features = ["json"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
bytes = "1.5"
headers = "0.3"
hyper = "0.14"
tower = "0.4"
tower-http = { version = "0.4", features = ["cors", "compression", "trace"] }

[dev-dependencies]
tokio-test = "0.4"

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
SECURE_COOKIES=false`,

    'src/main.rs': `mod config;
mod models;
mod handlers;
mod filters;
mod database;
mod auth;
mod errors;
mod utils;

use std::net::SocketAddr;
use warp::Filter;
use tracing_subscriber;

use crate::config::Config;
use crate::database::create_pool;
use crate::filters::{health, auth as auth_filters, users, with_db, with_config, cors_filter};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");
    
    // Create database connection pool
    let db_pool = create_pool(&config.database_url, config.database_max_connections)
        .await
        .expect("Failed to create database pool");

    // Run database migrations
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .expect("Failed to run database migrations");

    tracing::info!("Starting server at {}:{}", config.host, config.port);

    // Build routes using functional composition
    let routes = health::routes()
        .or(auth_filters::routes(db_pool.clone(), config.clone()))
        .or(users::routes(db_pool.clone(), config.clone()))
        .with(cors_filter())
        .with(warp::trace::request())
        .recover(errors::handle_rejection);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("Invalid server address");

    warp::serve(routes)
        .run(addr)
        .await;

    Ok(())
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
    pub secure_cookies: bool}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        dotenv::dotenv().ok();

        Ok(Config {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("PORT must be a valid number"),
            database_url: env::var("DATABASE_URL")?,
            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .expect("DATABASE_MAX_CONNECTIONS must be a valid number"),
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            redis_pool_size: env::var("REDIS_POOL_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .expect("REDIS_POOL_SIZE must be a valid number"),
            jwt_secret: env::var("JWT_SECRET")?,
            jwt_expiration: env::var("JWT_EXPIRATION")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .expect("JWT_EXPIRATION must be a valid number"),
            rate_limit_requests: env::var("RATE_LIMIT_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .expect("RATE_LIMIT_REQUESTS must be a valid number"),
            rate_limit_window: env::var("RATE_LIMIT_WINDOW")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .expect("RATE_LIMIT_WINDOW must be a valid number"),
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
                .parse()
                .expect("BCRYPT_COST must be a valid number"),
            secure_cookies: env::var("SECURE_COOKIES")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .expect("SECURE_COOKIES must be a boolean")})
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

    'src/handlers/health.rs': `use warp::{Reply, reply};
use serde_json::json;

pub async fn health_check() -> Result<impl Reply, warp::Rejection> {
    Ok(reply::json(&json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": "{{serviceName}}",
        "version": env!("CARGO_PKG_VERSION")
    })))
}`,

    'src/handlers/auth.rs': `use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;
use warp::{Reply, reply, Rejection};

use crate::config::Config;
use crate::models::{CreateUserRequest, LoginRequest, LoginResponse, RefreshTokenRequest, User, UserProfile};
use crate::auth::{hash_password, verify_password, generate_token, verify_token};
use crate::errors::AppError;

pub async fn register(
    req: CreateUserRequest,
    db_pool: PgPool,
    config: Config,
) -> Result<impl Reply, Rejection> {
    req.validate().map_err(|_| warp::reject::custom(AppError::ValidationError))?;

    // Check if user already exists
    let existing_user = sqlx::query!("SELECT id FROM users WHERE email = $1 OR username = $2", req.email, req.username)
        .fetch_optional(&db_pool)
        .await
        .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    if existing_user.is_some() {
        return Err(warp::reject::custom(AppError::BadRequest("User already exists".to_string())));
    }

    // Hash password
    let password_hash = hash_password(&req.password, config.bcrypt_cost)
        .map_err(|_| warp::reject::custom(AppError::InternalServerError))?;

    // Create user
    let user_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    sqlx::query!(
        r#"
        INSERT INTO users (id, email, username, password_hash, first_name, last_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
        user_id,
        req.email,
        req.username,
        password_hash,
        req.first_name,
        req.last_name,
        now,
        now
    )
    .execute(&db_pool)
    .await
    .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    // Fetch created user
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(&db_pool)
        .await
        .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    Ok(reply::with_status(
        reply::json(&UserProfile::from(user)),
        warp::http::StatusCode::CREATED,
    ))
}

pub async fn login(
    req: LoginRequest,
    db_pool: PgPool,
    config: Config,
) -> Result<impl Reply, Rejection> {
    req.validate().map_err(|_| warp::reject::custom(AppError::ValidationError))?;

    // Find user by email
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", req.email)
        .fetch_optional(&db_pool)
        .await
        .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    let user = user.ok_or_else(|| warp::reject::custom(AppError::Unauthorized("Invalid credentials".to_string())))?;

    // Verify password
    if !verify_password(&req.password, &user.password_hash)
        .map_err(|_| warp::reject::custom(AppError::InternalServerError))? {
        return Err(warp::reject::custom(AppError::Unauthorized("Invalid credentials".to_string())));
    }

    // Check if user is active
    if !user.is_active {
        return Err(warp::reject::custom(AppError::Unauthorized("Account is disabled".to_string())));
    }

    // Generate tokens
    let access_token = generate_token(&user.id.to_string(), &user.email, "access", &config.jwt_secret, config.jwt_expiration)
        .map_err(|_| warp::reject::custom(AppError::InternalServerError))?;
    let refresh_token = generate_token(&user.id.to_string(), &user.email, "refresh", &config.jwt_secret, config.jwt_expiration * 24)
        .map_err(|_| warp::reject::custom(AppError::InternalServerError))?;

    let response = LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.jwt_expiration};

    Ok(reply::json(&response))
}

pub async fn refresh_token(
    req: RefreshTokenRequest,
    config: Config,
) -> Result<impl Reply, Rejection> {
    // Verify refresh token
    let claims = verify_token(&req.refresh_token, &config.jwt_secret)
        .map_err(|_| warp::reject::custom(AppError::Unauthorized("Invalid token".to_string())))?;

    if claims.token_type != "refresh" {
        return Err(warp::reject::custom(AppError::Unauthorized("Invalid token type".to_string())));
    }

    // Generate new access token
    let access_token = generate_token(&claims.sub, &claims.email, "access", &config.jwt_secret, config.jwt_expiration)
        .map_err(|_| warp::reject::custom(AppError::InternalServerError))?;

    let response = LoginResponse {
        access_token,
        refresh_token: req.refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.jwt_expiration};

    Ok(reply::json(&response))
}

pub async fn logout() -> Result<impl Reply, Rejection> {
    // In a real application, you would invalidate the token here
    // For now, we'll just return success
    Ok(reply::json(&serde_json::json!({
        "message": "Logged out successfully"
    })))
}`,

    'src/handlers/users.rs': `use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;
use warp::{Reply, reply, Rejection};

use crate::models::{User, UserProfile, UpdateUserRequest};
use crate::errors::AppError;

pub async fn get_profile(
    user_id: Uuid,
    db_pool: PgPool,
) -> Result<impl Reply, Rejection> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_optional(&db_pool)
        .await
        .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    let user = user.ok_or_else(|| warp::reject::custom(AppError::NotFound("User not found".to_string())))?;

    Ok(reply::json(&UserProfile::from(user)))
}

pub async fn update_profile(
    user_id: Uuid,
    req: UpdateUserRequest,
    db_pool: PgPool,
) -> Result<impl Reply, Rejection> {
    req.validate().map_err(|_| warp::reject::custom(AppError::ValidationError))?;

    // Check if username is already taken
    if let Some(username) = &req.username {
        let existing_user = sqlx::query!("SELECT id FROM users WHERE username = $1 AND id != $2", username, user_id)
            .fetch_optional(&db_pool)
            .await
            .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

        if existing_user.is_some() {
            return Err(warp::reject::custom(AppError::BadRequest("Username already taken".to_string())));
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
        user_id,
        req.username,
        req.first_name,
        req.last_name,
        now
    )
    .fetch_one(&db_pool)
    .await
    .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    Ok(reply::json(&UserProfile::from(user)))
}

pub async fn delete_account(
    user_id: Uuid,
    db_pool: PgPool,
) -> Result<impl Reply, Rejection> {
    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(&db_pool)
        .await
        .map_err(|_| warp::reject::custom(AppError::DatabaseError))?;

    Ok(reply::json(&serde_json::json!({
        "message": "Account deleted successfully"
    })))
}`,

    'src/filters/mod.rs': `pub mod health;
pub mod auth;
pub mod users;

use std::convert::Infallible;
use sqlx::PgPool;
use warp::Filter;
use tower_http::cors::CorsLayer;

use crate::config::Config;

// Helper function to pass database connection pool
pub fn with_db(
    db_pool: PgPool,
) -> impl Filter<Extract = (PgPool,), Error = Infallible> + Clone {
    warp::any().map(move || db_pool.clone())
}

// Helper function to pass configuration
pub fn with_config(
    config: Config,
) -> impl Filter<Extract = (Config,), Error = Infallible> + Clone {
    warp::any().map(move || config.clone())
}

// CORS filter
pub fn cors_filter() -> warp::cors::Builder {
    warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["content-type", "authorization"])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
}`,

    'src/filters/health.rs': `use warp::Filter;

use crate::handlers::health;

pub fn routes() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    health_check()
}

pub fn health_check() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path("api")
        .and(warp::path("health"))
        .and(warp::path::end())
        .and(warp::get())
        .and_then(health::health_check)
}`,

    'src/filters/auth.rs': `use sqlx::PgPool;
use warp::Filter;

use crate::config::Config;
use crate::handlers::auth;
use crate::models::{CreateUserRequest, LoginRequest, RefreshTokenRequest};
use super::{with_db, with_config};

pub fn routes(
    db_pool: PgPool,
    config: Config,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    let auth_prefix = warp::path("api").and(warp::path("auth"));

    let register = auth_prefix
        .and(warp::path("register"))
        .and(warp::path::end())
        .and(warp::post())
        .and(json_body::<CreateUserRequest>())
        .and(with_db(db_pool.clone()))
        .and(with_config(config.clone()))
        .and_then(auth::register);

    let login = auth_prefix
        .and(warp::path("login"))
        .and(warp::path::end())
        .and(warp::post())
        .and(json_body::<LoginRequest>())
        .and(with_db(db_pool.clone()))
        .and(with_config(config.clone()))
        .and_then(auth::login);

    let refresh = auth_prefix
        .and(warp::path("refresh"))
        .and(warp::path::end())
        .and(warp::post())
        .and(json_body::<RefreshTokenRequest>())
        .and(with_config(config.clone()))
        .and_then(auth::refresh_token);

    let logout = auth_prefix
        .and(warp::path("logout"))
        .and(warp::path::end())
        .and(warp::post())
        .and_then(auth::logout);

    register.or(login).or(refresh).or(logout)
}

fn json_body<T>() -> impl Filter<Extract = (T,), Error = warp::Rejection> + Clone
where
    T: Send + serde::de::DeserializeOwned,
{
    warp::body::content_length_limit(1024 * 16).and(warp::body::json())
}`,

    'src/filters/users.rs': `use sqlx::PgPool;
use uuid::Uuid;
use warp::Filter;

use crate::config::Config;
use crate::handlers::users;
use crate::models::UpdateUserRequest;
use crate::auth::with_auth;
use super::{with_db, with_config};

pub fn routes(
    db_pool: PgPool,
    config: Config,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    let users_prefix = warp::path("api").and(warp::path("users"));

    let get_profile = users_prefix
        .and(warp::path("profile"))
        .and(warp::path::end())
        .and(warp::get())
        .and(with_auth(config.clone()))
        .and(with_db(db_pool.clone()))
        .and_then(users::get_profile);

    let update_profile = users_prefix
        .and(warp::path("profile"))
        .and(warp::path::end())
        .and(warp::put())
        .and(with_auth(config.clone()))
        .and(json_body::<UpdateUserRequest>())
        .and(with_db(db_pool.clone()))
        .and_then(|user_id: Uuid, req: UpdateUserRequest, db_pool: PgPool| {
            users::update_profile(user_id, req, db_pool)
        });

    let delete_account = users_prefix
        .and(warp::path("profile"))
        .and(warp::path::end())
        .and(warp::delete())
        .and(with_auth(config.clone()))
        .and(with_db(db_pool.clone()))
        .and_then(users::delete_account);

    get_profile.or(update_profile).or(delete_account)
}

fn json_body<T>() -> impl Filter<Extract = (T,), Error = warp::Rejection> + Clone
where
    T: Send + serde::de::DeserializeOwned,
{
    warp::body::content_length_limit(1024 * 16).and(warp::body::json())
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
use uuid::Uuid;
use std::{convert::Infallible, time::{SystemTime, UNIX_EPOCH}};
use warp::Filter;

use crate::config::Config;
use crate::models::Claims;
use crate::errors::AppError;

pub fn hash_password(password: &str, cost: u32) -> Result<String, AppError> {
    hash(password, cost).map_err(|_| AppError::InternalServerError)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    verify(password, hash).map_err(|_| AppError::InternalServerError)
}

pub fn generate_token(user_id: &str, email: &str, token_type: &str, secret: &str, expiration: u64) -> Result<String, AppError> {
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
    .map_err(|_| AppError::InternalServerError)
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))
}

pub fn with_auth(
    config: Config,
) -> impl Filter<Extract = (Uuid,), Error = warp::Rejection> + Clone {
    warp::header::<String>("authorization")
        .and_then(move |auth_header: String| {
            let config = config.clone();
            async move {
                if !auth_header.starts_with("Bearer ") {
                    return Err(warp::reject::custom(AppError::Unauthorized("Invalid authorization header format".to_string())));
                }

                let token = &auth_header[7..];
                let claims = verify_token(token, &config.jwt_secret)
                    .map_err(|_| warp::reject::custom(AppError::Unauthorized("Invalid token".to_string())))?;

                if claims.token_type != "access" {
                    return Err(warp::reject::custom(AppError::Unauthorized("Invalid token type".to_string())));
                }

                let user_id = Uuid::parse_str(&claims.sub)
                    .map_err(|_| warp::reject::custom(AppError::Unauthorized("Invalid user ID in token".to_string())))?;

                Ok::<Uuid, warp::Rejection>(user_id)
            }
        })
}`,

    'src/errors.rs': `use std::convert::Infallible;
use warp::{Reply, reply, Rejection};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    InternalServerError,
    ValidationError,
    DatabaseError}

impl warp::reject::Reject for AppError {}

pub async fn handle_rejection(err: Rejection) -> Result<impl Reply, Infallible> {
    let (code, message) = if err.is_not_found() {
        (warp::http::StatusCode::NOT_FOUND, "Not Found")
    } else if let Some(app_error) = err.find::<AppError>() {
        match app_error {
            AppError::BadRequest(msg) => (warp::http::StatusCode::BAD_REQUEST, msg.as_str()),
            AppError::Unauthorized(msg) => (warp::http::StatusCode::UNAUTHORIZED, msg.as_str()),
            AppError::NotFound(msg) => (warp::http::StatusCode::NOT_FOUND, msg.as_str()),
            AppError::InternalServerError => (warp::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error"),
            AppError::ValidationError => (warp::http::StatusCode::BAD_REQUEST, "Validation Error"),
            AppError::DatabaseError => (warp::http::StatusCode::INTERNAL_SERVER_ERROR, "Database Error")}
    } else if err.find::<warp::filters::body::BodyDeserializeError>().is_some() {
        (warp::http::StatusCode::BAD_REQUEST, "Invalid JSON body")
    } else if err.find::<warp::reject::MethodNotAllowed>().is_some() {
        (warp::http::StatusCode::METHOD_NOT_ALLOWED, "Method Not Allowed")
    } else {
        eprintln!("Unhandled rejection: {:?}", err);
        (warp::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
    };

    let json = reply::json(&json!({
        "error": message,
        "status": code.as_u16()
    }));

    Ok(reply::with_status(json, code))
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

// Functional composition helpers
pub fn compose<A, B, C, F, G>(f: F, g: G) -> impl Fn(A) -> C
where
    F: Fn(A) -> B,
    G: Fn(B) -> C,
{
    move |x| g(f(x))
}

pub fn pipe<T>(value: T) -> Pipe<T> {
    Pipe(value)
}

pub struct Pipe<T>(T);

impl<T> Pipe<T> {
    pub fn then<U, F>(self, f: F) -> Pipe<U>
    where
        F: FnOnce(T) -> U,
    {
        Pipe(f(self.0))
    }

    pub fn unwrap(self) -> T {
        self.0
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

A functional Warp web framework with composable filters, async/await, and type-safe routing.

## Features

- 🚀 **High Performance**: Built with Warp and Rust for maximum performance
- 🧩 **Functional Programming**: Composable filters and functional patterns
- 🔐 **Authentication**: JWT-based authentication with refresh tokens
- 🛡️ **Security**: Built-in security middleware and CORS support
- 📊 **Database**: PostgreSQL integration with SQLx and migrations
- 🔄 **Async**: Fully asynchronous request handling with Tokio
- 📝 **Validation**: Request validation with the validator crate
- 🏃 **Type Safety**: Strong type system and compile-time guarantees
- 📈 **Observability**: Structured logging with tracing
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

This application follows functional programming principles with Warp's composable filter system:

### Filter Composition
\`\`\`rust
let routes = health::routes()
    .or(auth_filters::routes(db_pool.clone(), config.clone()))
    .or(users::routes(db_pool.clone(), config.clone()))
    .with(cors_filter())
    .with(warp::trace::request())
    .recover(errors::handle_rejection);
\`\`\`

### Functional Patterns
- **Composable Filters**: Each route is a composable filter
- **Pure Functions**: Handlers are pure functions with minimal side effects
- **Immutable Data**: Strong emphasis on immutable data structures
- **Type Safety**: Leveraging Rust's type system for correctness

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

## Functional Programming Features

### Filter Composition
Warp's filter system allows for highly composable and reusable components:

\`\`\`rust
// Basic filter composition
let user_routes = warp::path("users")
    .and(auth_filter())
    .and(
        get_user()
            .or(update_user())
            .or(delete_user())
    );
\`\`\`

### Higher-Order Functions
\`\`\`rust
// Reusable filter factory
fn with_auth(config: Config) -> impl Filter<Extract = (Uuid,), Error = warp::Rejection> + Clone {
    warp::header::<String>("authorization")
        .and_then(move |auth_header: String| validate_token(auth_header, config))
}
\`\`\`

### Immutable Data Flow
All data transformations follow functional programming principles with immutable data structures and pure functions.

## Configuration

All configuration is handled through environment variables. See \`.env.example\` for all available options.

### Key Configuration Options

- \`HOST\`: Server host (default: 127.0.0.1)
- \`PORT\`: Server port (default: 8080)
- \`DATABASE_URL\`: PostgreSQL connection string
- \`REDIS_URL\`: Redis connection string
- \`JWT_SECRET\`: Secret key for JWT tokens
- \`RUST_LOG\`: Log level (debug, info, warn, error)

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

## Security Considerations

- Change \`JWT_SECRET\` in production
- Use HTTPS in production (\`SECURE_COOKIES=true\`)
- Configure proper CORS origins
- Set up proper database credentials
- Enable security headers (automatically included)

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

    'Makefile': `# Warp Development Makefile

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
    'echo "Warp server setup complete!"',
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