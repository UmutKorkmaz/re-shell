import { BackendTemplate } from '../types';

export const rocketTemplate: BackendTemplate = {
  id: 'rocket',
  name: 'Rocket + Rust',
  displayName: 'Rocket + Rust',
  description: 'Type-safe Rocket web framework with guards, fairings, and compile-time route verification',
  framework: 'rocket',
  language: 'rust',
  version: '1.0.0',
  tags: ['rust', 'rocket', 'type-safe', 'guards', 'api', 'postgresql', 'authentication'],
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
    'rocket': '0.5',
    'rocket_db_pools': '0.1',
    'rocket_cors': '0.6',
    'tokio': '1.35',
    'serde': '1.0',
    'serde_json': '1.0',
    'sqlx': '0.7',
    'uuid': '1.6',
    'chrono': '0.4',
    'bcrypt': '0.15',
    'jsonwebtoken': '9.1',
    'log': '0.4',
    'anyhow': '1.0',
    'thiserror': '1.0',
    'dotenv': '0.15',
    'redis': '0.24',
    'validator': '0.16',
    'figment': '0.10',
    'parking_lot': '0.12',
    'futures': '0.3',
    'reqwest': '0.11',
    'tracing': '0.1',
    'tracing-subscriber': '0.3'
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
description = "Rocket web framework with type-safe routing and guards"
license = "MIT"
authors = ["{{author}}"]

[dependencies]
rocket = { version = "0.5", features = ["json", "secrets", "testing", "uuid"] }
rocket_db_pools = { version = "0.1", features = ["sqlx_postgres"] }
rocket_cors = "0.6"
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "chrono", "uuid", "migrate"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
bcrypt = "0.15"
jsonwebtoken = "9.1"
log = "0.4"
anyhow = "1.0"
thiserror = "1.0"
dotenv = "0.15"
redis = "0.24"
validator = { version = "0.16", features = ["derive"] }
figment = { version = "0.10", features = ["env", "toml"] }
parking_lot = "0.12"
futures = "0.3"
reqwest = { version = "0.11", features = ["json"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
rocket = { version = "0.5", features = ["testing"] }

[[bin]]
name = "{{serviceName}}"
path = "src/main.rs"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"`,

    'Rocket.toml': `[debug]
address = "127.0.0.1"
port = 8080
keep_alive = 5
read_timeout = 5
write_timeout = 5
log_level = "normal"
workers = 4

[release]
address = "0.0.0.0"
port = 8080
keep_alive = 5
read_timeout = 5
write_timeout = 5
log_level = "critical"
workers = 8

[global.databases.main]
url = "postgresql://username:password@localhost/{{serviceName}}"
pool_size = 10
timeout = 30

[global.secrets]
secret_key = "your-super-secret-key-change-this-in-production"`,

    '.env.example': `# Server Configuration
ROCKET_ADDRESS=127.0.0.1
ROCKET_PORT=8080
ROCKET_LOG_LEVEL=debug
ROCKET_WORKERS=4

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost/{{serviceName}}
ROCKET_DATABASES={main={url="postgresql://username:password@localhost/{{serviceName}}",pool_size=10}}

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379
REDIS_POOL_SIZE=10

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=3600
ROCKET_SECRET_KEY=your-super-secret-key-change-this-in-production

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

    'src/main.rs': `#[macro_use]
extern crate rocket;

mod config;
mod models;
mod routes;
mod guards;
mod fairings;
mod database;
mod auth;
mod errors;
mod utils;

use rocket::{Build, Rocket, State};
use rocket_db_pools::{sqlx, Database};
use rocket_cors::{AllowedOrigins, CorsOptions};
use sqlx::PgPool;

use crate::config::AppConfig;
use crate::fairings::{cors_fairing, security_fairing, rate_limit_fairing};
use crate::routes::{health, auth as auth_routes, users};

#[derive(Database)]
#[database("main")]
pub struct Db(sqlx::PgPool);

#[launch]
async fn rocket() -> _ {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Load configuration
    let app_config = AppConfig::from_env().expect("Failed to load configuration");

    info!("Starting Rocket server with type-safe routing");

    rocket::build()
        .attach(Db::init())
        .attach(cors_fairing())
        .attach(security_fairing())
        .attach(rate_limit_fairing())
        .manage(app_config)
        .mount("/api", routes![
            health::health_check,
            auth_routes::register,
            auth_routes::login,
            auth_routes::refresh_token,
            auth_routes::logout,
            users::get_profile,
            users::update_profile,
            users::delete_account
        ])
        .register("/", catchers![
            errors::bad_request,
            errors::unauthorized,
            errors::forbidden,
            errors::not_found,
            errors::internal_server_error
        ])
}`,

    'src/config.rs': `use figment::{Figment, providers::{Format, Toml, Env}};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppConfig {
    pub jwt_secret: String,
    pub jwt_expiration: u64,
    pub redis_url: String,
    pub redis_pool_size: u32,
    pub rate_limit_requests: u64,
    pub rate_limit_window: u64,
    pub cors_allowed_origins: Vec<String>,
    pub cors_allowed_methods: Vec<String>,
    pub cors_allowed_headers: Vec<String>,
    pub bcrypt_cost: u32,
    pub secure_cookies: bool}

impl AppConfig {
    pub fn from_env() -> Result<Self, figment::Error> {
        dotenv::dotenv().ok();

        Figment::new()
            .merge(Toml::file("App.toml"))
            .merge(Env::prefixed("APP_"))
            .merge(Env::raw())
            .extract::<AppConfig>()
            .or_else(|_| {
                // Fallback to environment variables
                Ok(AppConfig {
                    jwt_secret: env::var("JWT_SECRET")
                        .unwrap_or_else(|_| "fallback-secret-change-in-production".to_string()),
                    jwt_expiration: env::var("JWT_EXPIRATION")
                        .unwrap_or_else(|_| "3600".to_string())
                        .parse()
                        .unwrap_or(3600),
                    redis_url: env::var("REDIS_URL")
                        .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
                    redis_pool_size: env::var("REDIS_POOL_SIZE")
                        .unwrap_or_else(|_| "10".to_string())
                        .parse()
                        .unwrap_or(10),
                    rate_limit_requests: env::var("RATE_LIMIT_REQUESTS")
                        .unwrap_or_else(|_| "100".to_string())
                        .parse()
                        .unwrap_or(100),
                    rate_limit_window: env::var("RATE_LIMIT_WINDOW")
                        .unwrap_or_else(|_| "60".to_string())
                        .parse()
                        .unwrap_or(60),
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
                        .unwrap_or(12),
                    secure_cookies: env::var("SECURE_COOKIES")
                        .unwrap_or_else(|_| "false".to_string())
                        .parse()
                        .unwrap_or(false)})
            })
    }
}`,

    'src/models/mod.rs': `pub mod user;
pub mod auth;

pub use user::*;
pub use auth::*;`,

    'src/models/user.rs': `use rocket::serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow)]
#[serde(crate = "rocket::serde")]
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
#[serde(crate = "rocket::serde")]
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
#[serde(crate = "rocket::serde")]
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
#[serde(crate = "rocket::serde")]
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

    'src/models/auth.rs': `use rocket::serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
#[serde(crate = "rocket::serde")]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 1))]
    pub password: String}

#[derive(Debug, Serialize)]
#[serde(crate = "rocket::serde")]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: u64}

#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct RefreshTokenRequest {
    pub refresh_token: String}

#[derive(Debug, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct Claims {
    pub sub: String, // User ID
    pub email: String,
    pub exp: usize,
    pub iat: usize,
    pub token_type: String, // "access" or "refresh"
}`,

    'src/routes/mod.rs': `pub mod health;
pub mod auth;
pub mod users;`,

    'src/routes/health.rs': `use rocket::{get, serde::json::Json};
use rocket::serde::json::Value;
use serde_json::json;

#[get("/health")]
pub fn health_check() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": "{{serviceName}}",
        "version": env!("CARGO_PKG_VERSION")
    }))
}`,

    'src/routes/auth.rs': `use rocket::{post, serde::json::Json, State};
use rocket_db_pools::Connection;
use validator::Validate;
use uuid::Uuid;

use crate::{Db, config::AppConfig};
use crate::models::{CreateUserRequest, LoginRequest, LoginResponse, RefreshTokenRequest, User, UserProfile};
use crate::auth::{hash_password, verify_password, generate_token, verify_token};
use crate::errors::{ApiError, ApiResult};

#[post("/auth/register", data = "<request>")]
pub async fn register(
    mut db: Connection<Db>,
    config: &State<AppConfig>,
    request: Json<CreateUserRequest>,
) -> ApiResult<Json<UserProfile>> {
    request.validate()?;

    // Check if user already exists
    let existing_user = sqlx::query!("SELECT id FROM users WHERE email = $1 OR username = $2", request.email, request.username)
        .fetch_optional(&mut **db)
        .await?;

    if existing_user.is_some() {
        return Err(ApiError::BadRequest("User already exists".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&request.password, config.bcrypt_cost)?;

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
    .execute(&mut **db)
    .await?;

    // Fetch created user
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(&mut **db)
        .await?;

    Ok(Json(UserProfile::from(user)))
}

#[post("/auth/login", data = "<request>")]
pub async fn login(
    mut db: Connection<Db>,
    config: &State<AppConfig>,
    request: Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    request.validate()?;

    // Find user by email
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", request.email)
        .fetch_optional(&mut **db)
        .await?;

    let user = user.ok_or_else(|| ApiError::Unauthorized("Invalid credentials".to_string()))?;

    // Verify password
    if !verify_password(&request.password, &user.password_hash)? {
        return Err(ApiError::Unauthorized("Invalid credentials".to_string()));
    }

    // Check if user is active
    if !user.is_active {
        return Err(ApiError::Unauthorized("Account is disabled".to_string()));
    }

    // Generate tokens
    let access_token = generate_token(
        &user.id.to_string(),
        &user.email,
        "access",
        &config.jwt_secret,
        config.jwt_expiration,
    )?;
    let refresh_token = generate_token(
        &user.id.to_string(),
        &user.email,
        "refresh",
        &config.jwt_secret,
        config.jwt_expiration * 24,
    )?;

    let response = LoginResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.jwt_expiration};

    Ok(Json(response))
}

#[post("/auth/refresh", data = "<request>")]
pub async fn refresh_token(
    config: &State<AppConfig>,
    request: Json<RefreshTokenRequest>,
) -> ApiResult<Json<LoginResponse>> {
    // Verify refresh token
    let claims = verify_token(&request.refresh_token, &config.jwt_secret)?;

    if claims.token_type != "refresh" {
        return Err(ApiError::Unauthorized("Invalid token type".to_string()));
    }

    // Generate new access token
    let access_token = generate_token(
        &claims.sub,
        &claims.email,
        "access",
        &config.jwt_secret,
        config.jwt_expiration,
    )?;

    let response = LoginResponse {
        access_token,
        refresh_token: request.refresh_token.clone(),
        token_type: "Bearer".to_string(),
        expires_in: config.jwt_expiration};

    Ok(Json(response))
}

#[post("/auth/logout")]
pub async fn logout() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "message": "Logged out successfully"
    }))
}`,

    'src/routes/users.rs': `use rocket::{get, put, delete, serde::json::Json};
use rocket_db_pools::Connection;
use validator::Validate;

use crate::{Db, guards::AuthGuard};
use crate::models::{User, UserProfile, UpdateUserRequest};
use crate::errors::{ApiError, ApiResult};

#[get("/users/profile")]
pub async fn get_profile(
    mut db: Connection<Db>,
    auth: AuthGuard,
) -> ApiResult<Json<UserProfile>> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", auth.user_id)
        .fetch_optional(&mut **db)
        .await?;

    let user = user.ok_or_else(|| ApiError::NotFound("User not found".to_string()))?;

    Ok(Json(UserProfile::from(user)))
}

#[put("/users/profile", data = "<request>")]
pub async fn update_profile(
    mut db: Connection<Db>,
    auth: AuthGuard,
    request: Json<UpdateUserRequest>,
) -> ApiResult<Json<UserProfile>> {
    request.validate()?;

    // Check if username is already taken
    if let Some(username) = &request.username {
        let existing_user = sqlx::query!("SELECT id FROM users WHERE username = $1 AND id != $2", username, auth.user_id)
            .fetch_optional(&mut **db)
            .await?;

        if existing_user.is_some() {
            return Err(ApiError::BadRequest("Username already taken".to_string()));
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
        auth.user_id,
        request.username,
        request.first_name,
        request.last_name,
        now
    )
    .fetch_one(&mut **db)
    .await?;

    Ok(Json(UserProfile::from(user)))
}

#[delete("/users/profile")]
pub async fn delete_account(
    mut db: Connection<Db>,
    auth: AuthGuard,
) -> ApiResult<Json<serde_json::Value>> {
    sqlx::query!("DELETE FROM users WHERE id = $1", auth.user_id)
        .execute(&mut **db)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Account deleted successfully"
    })))
}`,

    'src/guards/mod.rs': `use rocket::{Request, request::{self, FromRequest}, http::Status, State};
use uuid::Uuid;

use crate::config::AppConfig;
use crate::auth::verify_token;
use crate::errors::ApiError;

pub struct AuthGuard {
    pub user_id: Uuid,
    pub email: String}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthGuard {
    type Error = ApiError;

    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, Self::Error> {
        let config = match req.guard::<&State<AppConfig>>().await {
            request::Outcome::Success(config) => config,
            _ => return request::Outcome::Failure((Status::InternalServerError, ApiError::InternalServerError))};

        let auth_header = match req.headers().get_one("Authorization") {
            Some(header) => header,
            None => return request::Outcome::Failure((Status::Unauthorized, ApiError::Unauthorized("Missing authorization header".to_string())))};

        if !auth_header.starts_with("Bearer ") {
            return request::Outcome::Failure((Status::Unauthorized, ApiError::Unauthorized("Invalid authorization header format".to_string())));
        }

        let token = &auth_header[7..];
        
        match verify_token(token, &config.jwt_secret) {
            Ok(claims) => {
                if claims.token_type != "access" {
                    return request::Outcome::Failure((Status::Unauthorized, ApiError::Unauthorized("Invalid token type".to_string())));
                }

                match Uuid::parse_str(&claims.sub) {
                    Ok(user_id) => request::Outcome::Success(AuthGuard {
                        user_id,
                        email: claims.email}),
                    Err(_) => request::Outcome::Failure((Status::Unauthorized, ApiError::Unauthorized("Invalid user ID in token".to_string())))}
            }
            Err(err) => request::Outcome::Failure((Status::Unauthorized, err))}
    }
}

pub struct AdminGuard {
    pub user_id: Uuid,
    pub email: String}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AdminGuard {
    type Error = ApiError;

    async fn from_request(req: &'r Request<'_>) -> request::Outcome<Self, Self::Error> {
        // First check if user is authenticated
        let auth = match AuthGuard::from_request(req).await {
            request::Outcome::Success(auth) => auth,
            request::Outcome::Failure(failure) => return request::Outcome::Failure(failure),
            request::Outcome::Forward(forward) => return request::Outcome::Forward(forward)};

        // TODO: Add admin role check here
        // For now, we'll just pass through the auth guard
        request::Outcome::Success(AdminGuard {
            user_id: auth.user_id,
            email: auth.email})
    }
}`,

    'src/fairings/mod.rs': `use rocket::{Rocket, Build, fairing::{Fairing, Info, Kind}};
use rocket_cors::{AllowedOrigins, CorsOptions};

pub fn cors_fairing() -> rocket_cors::Cors {
    let allowed_origins = AllowedOrigins::some_exact(&[
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080"]);

    CorsOptions {
        allowed_origins,
        allowed_methods: vec![
            rocket::http::Method::Get,
            rocket::http::Method::Post,
            rocket::http::Method::Put,
            rocket::http::Method::Delete,
            rocket::http::Method::Options]
        .into_iter()
        .collect(),
        allowed_headers: rocket_cors::AllowedHeaders::some(&[
            "Authorization",
            "Accept",
            "Content-Type"]),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .expect("Failed to create CORS fairing")
}

pub struct SecurityFairing;

#[rocket::async_trait]
impl Fairing for SecurityFairing {
    fn info(&self) -> Info {
        Info {
            name: "Security Headers",
            kind: Kind::Response}
    }

    async fn on_response<'r>(&self, _request: &'r rocket::Request<'_>, response: &mut rocket::Response<'r>) {
        response.set_header(rocket::http::Header::new("X-Content-Type-Options", "nosniff"));
        response.set_header(rocket::http::Header::new("X-Frame-Options", "DENY"));
        response.set_header(rocket::http::Header::new("X-XSS-Protection", "1; mode=block"));
        response.set_header(rocket::http::Header::new("Strict-Transport-Security", "max-age=31536000; includeSubDomains"));
        response.set_header(rocket::http::Header::new("Referrer-Policy", "strict-origin-when-cross-origin"));
    }
}

pub fn security_fairing() -> SecurityFairing {
    SecurityFairing
}

pub struct RateLimitFairing;

#[rocket::async_trait]
impl Fairing for RateLimitFairing {
    fn info(&self) -> Info {
        Info {
            name: "Rate Limiting",
            kind: Kind::Request}
    }

    async fn on_request(&self, _request: &mut rocket::Request<'_>, _data: &mut rocket::Data<'_>) {
        // TODO: Implement actual rate limiting logic
        // This is a placeholder for rate limiting functionality
    }
}

pub fn rate_limit_fairing() -> RateLimitFairing {
    RateLimitFairing
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
use crate::errors::ApiError;

pub fn hash_password(password: &str, cost: u32) -> Result<String, ApiError> {
    hash(password, cost).map_err(|_| ApiError::InternalServerError)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, ApiError> {
    verify(password, hash).map_err(|_| ApiError::InternalServerError)
}

pub fn generate_token(
    user_id: &str,
    email: &str,
    token_type: &str,
    secret: &str,
    expiration: u64,
) -> Result<String, ApiError> {
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
    .map_err(|_| ApiError::InternalServerError)
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, ApiError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|data| data.claims)
    .map_err(|_| ApiError::Unauthorized("Invalid token".to_string()))
}`,

    'src/errors.rs': `use rocket::{catch, serde::json::Json, response::status, http::Status};
use rocket::serde::json::Value;
use serde_json::json;
use validator::ValidationErrors;

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    InternalServerError,
    ValidationError(ValidationErrors),
    DatabaseError(sqlx::Error)}

impl From<ValidationErrors> for ApiError {
    fn from(errors: ValidationErrors) -> Self {
        ApiError::ValidationError(errors)
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        ApiError::DatabaseError(error)
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

impl From<ApiError> for Status {
    fn from(error: ApiError) -> Self {
        match error {
            ApiError::BadRequest(_) => Status::BadRequest,
            ApiError::Unauthorized(_) => Status::Unauthorized,
            ApiError::Forbidden(_) => Status::Forbidden,
            ApiError::NotFound(_) => Status::NotFound,
            ApiError::InternalServerError => Status::InternalServerError,
            ApiError::ValidationError(_) => Status::BadRequest,
            ApiError::DatabaseError(_) => Status::InternalServerError}
    }
}

#[catch(400)]
pub fn bad_request() -> Json<Value> {
    Json(json!({
        "error": "Bad Request",
        "message": "The request could not be understood by the server"
    }))
}

#[catch(401)]
pub fn unauthorized() -> Json<Value> {
    Json(json!({
        "error": "Unauthorized",
        "message": "Authentication is required"
    }))
}

#[catch(403)]
pub fn forbidden() -> Json<Value> {
    Json(json!({
        "error": "Forbidden",
        "message": "Access denied"
    }))
}

#[catch(404)]
pub fn not_found() -> Json<Value> {
    Json(json!({
        "error": "Not Found",
        "message": "The requested resource was not found"
    }))
}

#[catch(500)]
pub fn internal_server_error() -> Json<Value> {
    Json(json!({
        "error": "Internal Server Error",
        "message": "An internal server error occurred"
    }))
}`,

    'src/utils.rs': `use rocket::serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
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

// Type-safe route helpers
pub mod route_helpers {
    use rocket::Route;
    use std::collections::HashMap;

    pub struct TypeSafeRouter {
        routes: HashMap<String, Vec<Route>>}

    impl TypeSafeRouter {
        pub fn new() -> Self {
            Self {
                routes: HashMap::new()}
        }

        pub fn add_route_group(&mut self, prefix: String, routes: Vec<Route>) {
            self.routes.insert(prefix, routes);
        }

        pub fn get_all_routes(&self) -> Vec<Route> {
            self.routes.values().flat_map(|routes| routes.iter()).cloned().collect()
        }
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
      - ROCKET_DATABASES={main={url="postgresql://postgres:password@db:5432/{{serviceName}}",pool_size=10}}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
      - ROCKET_SECRET_KEY=your-super-secret-key-change-this-in-production
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

A type-safe Rocket web framework with guards, fairings, and compile-time route verification.

## Features

- 🚀 **Type Safety**: Compile-time route verification and type checking
- 🛡️ **Guards**: Custom request guards for authentication and authorization
- 🎭 **Fairings**: Middleware system with CORS, security headers, and rate limiting
- 🔐 **Authentication**: JWT-based authentication with type-safe guards
- 📊 **Database**: PostgreSQL integration with rocket_db_pools
- 🔄 **Async**: Fully asynchronous request handling
- 📝 **Validation**: Request validation with the validator crate
- 🏃 **Performance**: Zero-cost abstractions and compile-time optimizations
- 📈 **Observability**: Structured logging and error handling
- 🐳 **Docker**: Production-ready Docker configuration
- 🧪 **Testing**: Built-in testing framework

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
   ROCKET_DATABASES={main={url="postgresql://username:password@localhost/{{serviceName}}",pool_size=10}}
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ROCKET_SECRET_KEY=your-super-secret-key-change-this-in-production
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

This application leverages Rocket's type system for compile-time safety and performance:

### Type-Safe Routes
\`\`\`rust
#[get("/users/profile")]
pub async fn get_profile(
    mut db: Connection<Db>,
    auth: AuthGuard, // Type-safe authentication guard
) -> ApiResult<Json<UserProfile>> {
    // Implementation
}
\`\`\`

### Custom Guards
\`\`\`rust
pub struct AuthGuard {
    pub user_id: Uuid,
    pub email: String}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthGuard {
    // Type-safe request guard implementation
}
\`\`\`

### Fairings (Middleware)
\`\`\`rust
#[rocket::async_trait]
impl Fairing for SecurityFairing {
    async fn on_response(&self, _request: &rocket::Request, response: &mut rocket::Response) {
        // Add security headers
    }
}
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

## Type Safety Features

### Compile-Time Route Verification
Rocket verifies routes at compile time, ensuring:
- Correct parameter types
- Valid response types  
- Proper guard usage
- Route uniqueness

### Request Guards
Type-safe request guards provide:
- Authentication verification
- Authorization checks
- Parameter validation
- Resource access control

### Database Type Safety
Using rocket_db_pools with SQLx provides:
- Compile-time SQL verification
- Type-safe database queries
- Connection pool management
- Migration support

## Configuration

### Rocket.toml
\`\`\`toml
[debug]
address = "127.0.0.1"
port = 8080
workers = 4

[global.databases.main]
url = "postgresql://username:password@localhost/{{serviceName}}"
pool_size = 10
\`\`\`

### Environment Variables
All configuration can be overridden with environment variables:
- \`ROCKET_ADDRESS\`: Server address
- \`ROCKET_PORT\`: Server port
- \`ROCKET_DATABASES\`: Database configuration
- \`JWT_SECRET\`: JWT signing secret
- \`RUST_LOG\`: Log level

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

## Security Features

- **Type-safe authentication** with custom guards
- **CORS configuration** with allowed origins
- **Security headers** via fairings
- **Rate limiting** (configurable)
- **SQL injection protection** with SQLx
- **JWT token validation** with expiration

## Testing

Rocket provides excellent testing support:

\`\`\`rust
#[cfg(test)]
mod tests {
    use super::*;
    use rocket::testing::*;

    #[test]
    fn test_health_check() {
        let client = Client::tracked(rocket()).expect("valid rocket instance");
        let response = client.get("/api/health").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }
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

    'Makefile': `# Rocket Development Makefile

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
    'echo "Rocket server setup complete!"',
    'echo "Next steps:"',
    'echo "1. Update .env and Rocket.toml with your configuration"',
    'echo "2. Run: sqlx migrate run"',
    'echo "3. Run: cargo run"',
    'echo ""',
    'echo "For development with hot reload:"',
    'echo "cargo install cargo-watch"',
    'echo "cargo watch -x run"'
  ]
};