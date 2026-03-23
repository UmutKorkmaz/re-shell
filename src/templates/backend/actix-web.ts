import { BackendTemplate } from '../types';

export const actixWebTemplate: BackendTemplate = {
  id: 'actix-web',
  name: 'Actix-Web + Rust',
  displayName: 'Actix-Web + Rust',
  description: 'High-performance Actix-Web API server with async handlers, middleware, authentication, and PostgreSQL integration',
  framework: 'actix-web',
  language: 'rust',
  version: '1.0.0',
  tags: ['rust', 'actix-web', 'high-performance', 'api', 'postgresql', 'authentication'],
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
    'actix-web': '4.4',
    'actix-cors': '0.6',
    'actix-web-middleware-redirect-scheme': '4.0',
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
    'actix-session': '0.9',
    'actix-identity': '0.7',
    'actix-governor': '0.5',
    'validator': '0.16',
    'mime': '0.3',
    'futures': '0.3',
    'reqwest': '0.11',
    'tracing': '0.1',
    'tracing-subscriber': '0.3',
    'tracing-actix-web': '0.7'
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
description = "Actix-Web API server with async handlers and middleware"
license = "MIT"
authors = ["{{author}}"]

[dependencies]
actix-web = "4.4"
actix-cors = "0.6"
actix-web-middleware-redirect-scheme = "4.0"
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
actix-session = "0.9"
actix-identity = "0.7"
actix-governor = "0.5"
validator = { version = "0.16", features = ["derive"] }
mime = "0.3"
futures = "0.3"
reqwest = { version = "0.11", features = ["json"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tracing-actix-web = "0.7"

[dev-dependencies]
actix-rt = "2.9"
actix-web-test = "4.0"

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
mod middleware;
mod database;
mod auth;
mod errors;
mod utils;

use actix_web::{web, App, HttpServer, middleware::Logger};
use actix_cors::Cors;
use actix_governor::{Governor, GovernorConfigBuilder};
use sqlx::PgPool;
use std::time::Duration;
use tracing_actix_web::TracingLogger;

use crate::config::Config;
use crate::database::create_pool;
use crate::handlers::{health, auth as auth_handlers, users};
use crate::middleware::{auth::AuthMiddleware, security::SecurityMiddleware};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
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

    // Configure rate limiting
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(config.rate_limit_requests)
        .burst_size(config.rate_limit_requests * 2)
        .finish()
        .unwrap();

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin_fn(|origin, _req_head| {
                config.cors_allowed_origins.contains(&origin.to_string())
            })
            .allowed_methods(config.cors_allowed_methods.clone())
            .allowed_headers(config.cors_allowed_headers.clone())
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(db_pool.clone()))
            .app_data(web::Data::new(config.clone()))
            .wrap(TracingLogger::default())
            .wrap(Logger::default())
            .wrap(cors)
            .wrap(Governor::new(&governor_conf))
            .wrap(SecurityMiddleware::default())
            .service(
                web::scope("/api")
                    .service(health::health_check)
                    .service(
                        web::scope("/auth")
                            .service(auth_handlers::register)
                            .service(auth_handlers::login)
                            .service(auth_handlers::refresh_token)
                            .service(auth_handlers::logout)
                    )
                    .service(
                        web::scope("/users")
                            .wrap(AuthMiddleware::new())
                            .service(users::get_profile)
                            .service(users::update_profile)
                            .service(users::delete_account)
                    )
            )
    })
    .bind((config.host.clone(), config.port))?
    .run()
    .await
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

    'src/handlers/health.rs': `use actix_web::{get, HttpResponse, Result};
use serde_json::json;

#[get("/health")]
pub async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": "{{serviceName}}",
        "version": env!("CARGO_PKG_VERSION")
    })))
}`,

    'src/handlers/auth.rs': `use actix_web::{post, web, HttpResponse, Result};
use sqlx::PgPool;
use validator::Validate;

use crate::config::Config;
use crate::models::{CreateUserRequest, LoginRequest, LoginResponse, RefreshTokenRequest, User, UserProfile};
use crate::auth::{hash_password, verify_password, generate_token, verify_token};
use crate::errors::AppError;

#[post("/register")]
pub async fn register(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    req: web::Json<CreateUserRequest>,
) -> Result<HttpResponse, AppError> {
    req.validate()?;

    // Check if user already exists
    let existing_user = sqlx::query!("SELECT id FROM users WHERE email = $1 OR username = $2", req.email, req.username)
        .fetch_optional(pool.get_ref())
        .await?;

    if existing_user.is_some() {
        return Err(AppError::BadRequest("User already exists".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&req.password, config.bcrypt_cost)?;

    // Create user
    let user_id = uuid::Uuid::new_v4();
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
    .execute(pool.get_ref())
    .await?;

    // Fetch created user
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool.get_ref())
        .await?;

    Ok(HttpResponse::Created().json(UserProfile::from(user)))
}

#[post("/login")]
pub async fn login(
    pool: web::Data<PgPool>,
    config: web::Data<Config>,
    req: web::Json<LoginRequest>,
) -> Result<HttpResponse, AppError> {
    req.validate()?;

    // Find user by email
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", req.email)
        .fetch_optional(pool.get_ref())
        .await?;

    let user = user.ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

    // Verify password
    if !verify_password(&req.password, &user.password_hash)? {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    // Check if user is active
    if !user.is_active {
        return Err(AppError::Unauthorized("Account is disabled".to_string()));
    }

    // Generate tokens
    let access_token = generate_token(&user.id.to_string(), &user.email, "access", &config.jwt_secret, config.jwt_expiration)?;
    let refresh_token = generate_token(&user.id.to_string(), &user.email, "refresh", &config.jwt_secret, config.jwt_expiration * 24)?;

    let response = LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.jwt_expiration};

    Ok(HttpResponse::Ok().json(response))
}

#[post("/refresh")]
pub async fn refresh_token(
    config: web::Data<Config>,
    req: web::Json<RefreshTokenRequest>,
) -> Result<HttpResponse, AppError> {
    // Verify refresh token
    let claims = verify_token(&req.refresh_token, &config.jwt_secret)?;

    if claims.token_type != "refresh" {
        return Err(AppError::Unauthorized("Invalid token type".to_string()));
    }

    // Generate new access token
    let access_token = generate_token(&claims.sub, &claims.email, "access", &config.jwt_secret, config.jwt_expiration)?;

    let response = LoginResponse {
        access_token,
        refresh_token: req.refresh_token.clone(),
        token_type: "Bearer".to_string(),
        expires_in: config.jwt_expiration};

    Ok(HttpResponse::Ok().json(response))
}

#[post("/logout")]
pub async fn logout() -> Result<HttpResponse, AppError> {
    // In a real application, you would invalidate the token here
    // For now, we'll just return success
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Logged out successfully"
    })))
}`,

    'src/handlers/users.rs': `use actix_web::{get, put, delete, web, HttpResponse, Result, HttpRequest};
use sqlx::PgPool;
use validator::Validate;
use uuid::Uuid;

use crate::models::{User, UserProfile, UpdateUserRequest};
use crate::errors::AppError;

#[get("/profile")]
pub async fn get_profile(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let user_id = req.extensions().get::<Uuid>()
        .ok_or_else(|| AppError::Unauthorized("User not authenticated".to_string()))?;

    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_optional(pool.get_ref())
        .await?;

    let user = user.ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(HttpResponse::Ok().json(UserProfile::from(user)))
}

#[put("/profile")]
pub async fn update_profile(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    update_req: web::Json<UpdateUserRequest>,
) -> Result<HttpResponse, AppError> {
    update_req.validate()?;

    let user_id = req.extensions().get::<Uuid>()
        .ok_or_else(|| AppError::Unauthorized("User not authenticated".to_string()))?;

    // Check if username is already taken
    if let Some(username) = &update_req.username {
        let existing_user = sqlx::query!("SELECT id FROM users WHERE username = $1 AND id != $2", username, user_id)
            .fetch_optional(pool.get_ref())
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
        user_id,
        update_req.username,
        update_req.first_name,
        update_req.last_name,
        now
    )
    .fetch_one(pool.get_ref())
    .await?;

    Ok(HttpResponse::Ok().json(UserProfile::from(user)))
}

#[delete("/profile")]
pub async fn delete_account(
    pool: web::Data<PgPool>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let user_id = req.extensions().get::<Uuid>()
        .ok_or_else(|| AppError::Unauthorized("User not authenticated".to_string()))?;

    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(pool.get_ref())
        .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Account deleted successfully"
    })))
}`,

    'src/middleware/mod.rs': `pub mod auth;
pub mod security;`,

    'src/middleware/auth.rs': `use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage};
use futures::future::{ready, Ready};
use std::{
    future::{self, LocalBoxFuture},
    pin::Pin,
    task::{Context, Poll}};
use uuid::Uuid;

use crate::auth::extract_user_from_request;
use crate::errors::AppError;

pub struct AuthMiddleware {
    required: bool}

impl AuthMiddleware {
    pub fn new() -> Self {
        Self { required: true }
    }

    pub fn optional() -> Self {
        Self { required: false }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service,
            required: self.required}))
    }
}

pub struct AuthMiddlewareService<S> {
    service: S,
    required: bool}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let required = self.required;
        
        Box::pin(async move {
            match extract_user_from_request(&req).await {
                Ok(user_id) => {
                    req.extensions_mut().insert(user_id);
                    let fut = self.service.call(req);
                    fut.await
                }
                Err(err) if required => {
                    Err(actix_web::error::ErrorUnauthorized(err))
                }
                Err(_) => {
                    let fut = self.service.call(req);
                    fut.await
                }
            }
        })
    }
}`,

    'src/middleware/security.rs': `use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse};
use futures::future::{ready, Ready};
use std::{
    future::{self, LocalBoxFuture},
    pin::Pin,
    task::{Context, Poll}};

pub struct SecurityMiddleware;

impl Default for SecurityMiddleware {
    fn default() -> Self {
        Self
    }
}

impl<S, B> Transform<S, ServiceRequest> for SecurityMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = SecurityMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SecurityMiddlewareService { service }))
    }
}

pub struct SecurityMiddlewareService<S> {
    service: S}

impl<S, B> Service<ServiceRequest> for SecurityMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        Box::pin(async move {
            let mut res = self.service.call(req).await?;
            
            // Add security headers
            let headers = res.headers_mut();
            headers.insert(
                actix_web::http::header::HeaderName::from_static("x-content-type-options"),
                actix_web::http::HeaderValue::from_static("nosniff"),
            );
            headers.insert(
                actix_web::http::header::HeaderName::from_static("x-frame-options"),
                actix_web::http::HeaderValue::from_static("DENY"),
            );
            headers.insert(
                actix_web::http::header::HeaderName::from_static("x-xss-protection"),
                actix_web::http::HeaderValue::from_static("1; mode=block"),
            );
            headers.insert(
                actix_web::http::header::HeaderName::from_static("strict-transport-security"),
                actix_web::http::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
            );
            headers.insert(
                actix_web::http::header::HeaderName::from_static("referrer-policy"),
                actix_web::http::HeaderValue::from_static("strict-origin-when-cross-origin"),
            );

            Ok(res)
        })
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

    'src/auth.rs': `use actix_web::{dev::ServiceRequest, web};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use uuid::Uuid;
use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::Claims;
use crate::errors::AppError;
use crate::config::Config;

pub fn hash_password(password: &str, cost: u32) -> Result<String, AppError> {
    hash(password, cost).map_err(|_| AppError::InternalServerError("Failed to hash password".to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    verify(password, hash).map_err(|_| AppError::InternalServerError("Failed to verify password".to_string()))
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
}

pub async fn extract_user_from_request(req: &ServiceRequest) -> Result<Uuid, AppError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid authorization header".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err(AppError::Unauthorized("Invalid authorization header format".to_string()));
    }

    let token = &auth_header[7..];
    
    let config = req.app_data::<web::Data<Config>>()
        .ok_or_else(|| AppError::InternalServerError("Configuration not found".to_string()))?;

    let claims = verify_token(token, &config.jwt_secret)?;

    if claims.token_type != "access" {
        return Err(AppError::Unauthorized("Invalid token type".to_string()));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in token".to_string()))?;

    Ok(user_id)
}`,

    'src/errors.rs': `use actix_web::{HttpResponse, ResponseError};
use std::fmt;
use sqlx::Error as SqlxError;
use validator::ValidationErrors;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    InternalServerError(String),
    ValidationError(ValidationErrors),
    DatabaseError(SqlxError)}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::BadRequest(msg) => write!(f, "Bad Request: {}", msg),
            AppError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            AppError::InternalServerError(msg) => write!(f, "Internal Server Error: {}", msg),
            AppError::ValidationError(errors) => write!(f, "Validation Error: {:?}", errors),
            AppError::DatabaseError(err) => write!(f, "Database Error: {}", err)}
    }
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        match self {
            AppError::BadRequest(msg) => HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Bad Request",
                "message": msg
            })),
            AppError::Unauthorized(msg) => HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized",
                "message": msg
            })),
            AppError::NotFound(msg) => HttpResponse::NotFound().json(serde_json::json!({
                "error": "Not Found",
                "message": msg
            })),
            AppError::InternalServerError(msg) => HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal Server Error",
                "message": msg
            })),
            AppError::ValidationError(errors) => HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Validation Error",
                "details": errors
            })),
            AppError::DatabaseError(_) => HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal Server Error",
                "message": "Database operation failed"
            }))}
    }
}

impl From<ValidationErrors> for AppError {
    fn from(errors: ValidationErrors) -> Self {
        AppError::ValidationError(errors)
    }
}

impl From<SqlxError> for AppError {
    fn from(error: SqlxError) -> Self {
        AppError::DatabaseError(error)
    }
}`,

    'src/utils.rs': `use serde::{Deserialize, Serialize};
use actix_web::{HttpResponse, Result};

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

pub fn success_response<T: Serialize>(data: T) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse::success(data)))
}

pub fn success_response_with_message<T: Serialize>(data: T, message: String) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(ApiResponse::success_with_message(data, message)))
}

pub fn error_response(status: actix_web::http::StatusCode, error: String) -> Result<HttpResponse> {
    Ok(HttpResponse::build(status).json(ApiResponse::<()>::error(error)))
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

A high-performance Actix-Web API server with async handlers, middleware, authentication, and PostgreSQL integration.

## Features

- 🚀 **High Performance**: Built with Actix-Web and Rust for maximum performance
- 🔐 **Authentication**: JWT-based authentication with refresh tokens
- 🛡️ **Security**: Built-in security middleware and CORS support
- 📊 **Database**: PostgreSQL integration with SQLx and migrations
- 🔄 **Async**: Fully asynchronous request handling
- 📝 **Validation**: Request validation with the validator crate
- 🏃 **Rate Limiting**: Built-in rate limiting with actix-governor
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

    'Makefile': `# Actix-Web Development Makefile

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
    'echo "Actix-Web server setup complete!"',
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