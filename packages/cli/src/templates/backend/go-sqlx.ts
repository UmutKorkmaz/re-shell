import { BackendTemplate } from '../types';

export const goSqlxTemplate: BackendTemplate = {
  id: 'go-sqlx',
  name: 'go-sqlx',
  displayName: 'Go API with sqlx',
  description: 'Fast Go API with sqlx for raw SQL queries with compile-time type safety',
  language: 'go',
  framework: 'chi-sqlx',
  version: '1.3.5',
  tags: ['go', 'sqlx', 'api', 'rest', 'raw-sql', 'type-safe', 'performance'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'database', 'documentation', 'rate-limiting'],
  
  files: {
    // Go module configuration
    'go.mod': `module {{projectName}}

go 1.21

require (
	github.com/go-chi/chi/v5 v5.0.11
	github.com/go-chi/cors v1.2.1
	github.com/go-chi/httprate v0.8.0
	github.com/go-chi/jwtauth/v5 v5.3.0
	github.com/go-chi/render v1.0.3
	github.com/joho/godotenv v1.5.1
	github.com/jmoiron/sqlx v1.3.5
	github.com/lib/pq v1.10.9
	github.com/go-sql-driver/mysql v1.7.1
	github.com/mattn/go-sqlite3 v1.14.19
	github.com/go-playground/validator/v10 v10.16.0
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/golang-migrate/migrate/v4 v4.17.0
	github.com/swaggo/swag v1.16.2
	github.com/swaggo/http-swagger/v2 v2.0.2
	github.com/rs/zerolog v1.31.0
	golang.org/x/crypto v0.17.0
	github.com/google/uuid v1.5.0
	github.com/redis/go-redis/v9 v9.3.1
	github.com/ulule/limiter/v3 v3.11.2
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/PuerkitoBio/purell v1.2.1 // indirect
	github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578 // indirect
	github.com/ajg/form v1.5.1 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/go-openapi/jsonpointer v0.20.2 // indirect
	github.com/go-openapi/jsonreference v0.20.4 // indirect
	github.com/go-openapi/spec v0.20.13 // indirect
	github.com/go-openapi/swag v0.22.7 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/lestrrat-go/blackmagic v1.0.2 // indirect
	github.com/lestrrat-go/httpcc v1.0.1 // indirect
	github.com/lestrrat-go/httprc v1.0.4 // indirect
	github.com/lestrrat-go/iter v1.0.2 // indirect
	github.com/lestrrat-go/jwx/v2 v2.0.19 // indirect
	github.com/lestrrat-go/option v1.0.1 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/swaggo/files/v2 v2.0.0 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	golang.org/x/net v0.19.0 // indirect
	golang.org/x/sync v0.5.0 // indirect
	golang.org/x/sys v0.15.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	golang.org/x/tools v0.16.1 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
`,

    // Main application entry point
    'main.go': `package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"{{projectName}}/config"
	"{{projectName}}/database"
	"{{projectName}}/handlers"
	"{{projectName}}/middleware"
	"{{projectName}}/routes"

	_ "{{projectName}}/docs" // swagger docs

	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
)

// @title {{projectName}} API
// @version 1.0
// @description Fast Go API with sqlx for raw SQL queries
// @contact.name API Support
// @contact.email support@example.com
// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize configuration
	cfg := config.Load()

	// Initialize logger
	logger := initLogger(cfg.LogLevel)

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer db.Close()

	// Run migrations
	if err := database.Migrate(cfg.DatabaseURL); err != nil {
		logger.Fatal().Err(err).Msg("Failed to run migrations")
	}

	// Initialize handlers
	h := handlers.New(db, logger, cfg)

	// Setup routes
	router := routes.Setup(h, cfg)

	// Setup server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second}

	// Start server
	go func() {
		logger.Info().Int("port", cfg.Port).Msg("Starting server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("Failed to start server")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	logger.Info().Msg("Server exited")
}

func initLogger(level string) *zerolog.Logger {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	logLevel, err := zerolog.ParseLevel(level)
	if err != nil {
		logLevel = zerolog.InfoLevel
	}

	logger := zerolog.New(os.Stdout).
		Level(logLevel).
		With().
		Timestamp().
		Caller().
		Logger()

	return &logger
}
`,

    // Configuration
    'config/config.go': `package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port         int
	DatabaseURL  string
	JWTSecret    string
	LogLevel     string
	RedisURL     string
	JWTExpiry    time.Duration
	RefreshExpiry time.Duration
}

func Load() *Config {
	return &Config{
		Port:         getEnvAsInt("PORT", 8080),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://user:password@localhost/dbname?sslmode=disable"),
		JWTSecret:    getEnv("JWT_SECRET", "your-secret-key"),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTExpiry:    time.Duration(getEnvAsInt("JWT_EXPIRY_MINUTES", 15)) * time.Minute,
		RefreshExpiry: time.Duration(getEnvAsInt("REFRESH_EXPIRY_DAYS", 7)) * 24 * time.Hour}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}
`,

    // Database package
    'database/database.go': `package database

import (
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

// Initialize creates a new database connection
func Initialize(databaseURL string) (*sqlx.DB, error) {
	driver, err := getDriver(databaseURL)
	if err != nil {
		return nil, err
	}

	db, err := sqlx.Open(driver, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

func getDriver(databaseURL string) (string, error) {
	switch {
	case contains(databaseURL, "postgres://") || contains(databaseURL, "postgresql://"):
		return "postgres", nil
	case contains(databaseURL, "mysql://"):
		return "mysql", nil
	case contains(databaseURL, "sqlite://") || databaseURL == ":memory:":
		return "sqlite3", nil
	default:
		return "", fmt.Errorf("unsupported database URL: %s", databaseURL)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && s[:len(substr)] == substr
}
`,

    'database/migrations.go': `package database

import (
	"embed"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/mysql"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrate runs database migrations
func Migrate(databaseURL string) error {
	driver, err := getDriver(databaseURL)
	if err != nil {
		return err
	}

	// Create source from embedded files
	source, err := iofs.New(migrations, "migrations")
	if err != nil {
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	// Create migrator
	m, err := migrate.NewWithSourceInstance("iofs", source, databaseURL)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}
`,

    // Migrations
    'database/migrations/001_create_users_table.up.sql': `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
`,

    'database/migrations/001_create_users_table.down.sql': `DROP TABLE IF EXISTS users;`,

    'database/migrations/002_create_products_table.up.sql': `CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category VARCHAR(100) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
`,

    'database/migrations/002_create_products_table.down.sql': `DROP TABLE IF EXISTS products;`,

    'database/migrations/003_create_orders_table.up.sql': `CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
`,

    'database/migrations/003_create_orders_table.down.sql': `DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
`,

    // Queries
    'database/queries/users.go': `package queries

const (
	// User queries
	InsertUser = \`
		INSERT INTO users (email, password_hash, name, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, name, role, active, created_at, updated_at\`

	GetUserByID = \`
		SELECT id, email, name, role, active, created_at, updated_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL\`

	GetUserByEmail = \`
		SELECT id, email, password_hash, name, role, active, created_at, updated_at
		FROM users
		WHERE email = $1 AND deleted_at IS NULL\`

	UpdateUser = \`
		UPDATE users
		SET email = $1, name = $2, role = $3, active = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $5 AND deleted_at IS NULL
		RETURNING id, email, name, role, active, created_at, updated_at\`

	DeleteUser = \`
		UPDATE users
		SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND deleted_at IS NULL\`

	ListUsers = \`
		SELECT id, email, name, role, active, created_at, updated_at
		FROM users
		WHERE deleted_at IS NULL
		AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
		AND ($2 = '' OR role = $2)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4\`

	CountUsers = \`
		SELECT COUNT(*)
		FROM users
		WHERE deleted_at IS NULL
		AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
		AND ($2 = '' OR role = $2)\`
)
`,

    'database/queries/products.go': `package queries

const (
	// Product queries
	InsertProduct = \`
		INSERT INTO products (name, description, price, stock, category, sku)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, description, price, stock, category, sku, active, created_at, updated_at\`

	GetProductByID = \`
		SELECT id, name, description, price, stock, category, sku, active, created_at, updated_at
		FROM products
		WHERE id = $1 AND deleted_at IS NULL\`

	UpdateProduct = \`
		UPDATE products
		SET name = $1, description = $2, price = $3, stock = $4, category = $5, 
		    sku = $6, active = $7, updated_at = CURRENT_TIMESTAMP
		WHERE id = $8 AND deleted_at IS NULL
		RETURNING id, name, description, price, stock, category, sku, active, created_at, updated_at\`

	UpdateProductStock = \`
		UPDATE products
		SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND deleted_at IS NULL
		RETURNING stock\`

	DeleteProduct = \`
		UPDATE products
		SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND deleted_at IS NULL\`

	ListProducts = \`
		SELECT id, name, description, price, stock, category, sku, active, created_at, updated_at
		FROM products
		WHERE deleted_at IS NULL
		AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
		AND ($2 = '' OR category = $2)
		AND ($3 = 0 OR price >= $3)
		AND ($4 = 0 OR price <= $4)
		ORDER BY created_at DESC
		LIMIT $5 OFFSET $6\`

	CountProducts = \`
		SELECT COUNT(*)
		FROM products
		WHERE deleted_at IS NULL
		AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
		AND ($2 = '' OR category = $2)
		AND ($3 = 0 OR price >= $3)
		AND ($4 = 0 OR price <= $4)\`
)
`,

    // Models
    'models/user.go': `package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           string    \`db:"id" json:"id"\`
	Email        string    \`db:"email" json:"email"\`
	PasswordHash string    \`db:"password_hash" json:"-"\`
	Name         string    \`db:"name" json:"name"\`
	Role         string    \`db:"role" json:"role"\`
	Active       bool      \`db:"active" json:"active"\`
	CreatedAt    time.Time \`db:"created_at" json:"created_at"\`
	UpdatedAt    time.Time \`db:"updated_at" json:"updated_at"\`
	DeletedAt    *time.Time \`db:"deleted_at" json:"-"\`
}

func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hashedPassword)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

type CreateUserRequest struct {
	Email    string \`json:"email" validate:"required,email"\`
	Password string \`json:"password" validate:"required,min=8"\`
	Name     string \`json:"name" validate:"required,min=1,max=255"\`
	Role     string \`json:"role" validate:"omitempty,oneof=user admin moderator"\`
}

type UpdateUserRequest struct {
	Email  string \`json:"email" validate:"omitempty,email"\`
	Name   string \`json:"name" validate:"omitempty,min=1,max=255"\`
	Role   string \`json:"role" validate:"omitempty,oneof=user admin moderator"\`
	Active *bool  \`json:"active" validate:"omitempty"\`
}

type LoginRequest struct {
	Email    string \`json:"email" validate:"required,email"\`
	Password string \`json:"password" validate:"required"\`
}

type LoginResponse struct {
	AccessToken  string \`json:"access_token"\`
	RefreshToken string \`json:"refresh_token"\`
	User         *User  \`json:"user"\`
}
`,

    'models/product.go': `package models

import (
	"time"
)

type Product struct {
	ID          string     \`db:"id" json:"id"\`
	Name        string     \`db:"name" json:"name"\`
	Description string     \`db:"description" json:"description"\`
	Price       float64    \`db:"price" json:"price"\`
	Stock       int        \`db:"stock" json:"stock"\`
	Category    string     \`db:"category" json:"category"\`
	SKU         string     \`db:"sku" json:"sku"\`
	Active      bool       \`db:"active" json:"active"\`
	CreatedAt   time.Time  \`db:"created_at" json:"created_at"\`
	UpdatedAt   time.Time  \`db:"updated_at" json:"updated_at"\`
	DeletedAt   *time.Time \`db:"deleted_at" json:"-"\`
}

type CreateProductRequest struct {
	Name        string  \`json:"name" validate:"required,min=1,max=255"\`
	Description string  \`json:"description" validate:"max=1000"\`
	Price       float64 \`json:"price" validate:"required,min=0"\`
	Stock       int     \`json:"stock" validate:"min=0"\`
	Category    string  \`json:"category" validate:"required,min=1,max=100"\`
	SKU         string  \`json:"sku" validate:"required,min=1,max=100"\`
}

type UpdateProductRequest struct {
	Name        string  \`json:"name" validate:"omitempty,min=1,max=255"\`
	Description string  \`json:"description" validate:"omitempty,max=1000"\`
	Price       float64 \`json:"price" validate:"omitempty,min=0"\`
	Stock       int     \`json:"stock" validate:"omitempty,min=0"\`
	Category    string  \`json:"category" validate:"omitempty,min=1,max=100"\`
	SKU         string  \`json:"sku" validate:"omitempty,min=1,max=100"\`
	Active      *bool   \`json:"active" validate:"omitempty"\`
}

type ListProductsRequest struct {
	Search   string  \`json:"search" form:"search"\`
	Category string  \`json:"category" form:"category"\`
	MinPrice float64 \`json:"min_price" form:"min_price"\`
	MaxPrice float64 \`json:"max_price" form:"max_price"\`
	Page     int     \`json:"page" form:"page" validate:"min=1"\`
	Limit    int     \`json:"limit" form:"limit" validate:"min=1,max=100"\`
}
`,

    'models/pagination.go': `package models

type PaginationRequest struct {
	Page  int \`json:"page" form:"page" validate:"min=1"\`
	Limit int \`json:"limit" form:"limit" validate:"min=1,max=100"\`
}

type PaginationResponse struct {
	Total int \`json:"total"\`
	Page  int \`json:"page"\`
	Limit int \`json:"limit"\`
	Pages int \`json:"pages"\`
}

func NewPaginationResponse(total, page, limit int) PaginationResponse {
	pages := total / limit
	if total%limit > 0 {
		pages++
	}

	return PaginationResponse{
		Total: total,
		Page:  page,
		Limit: limit,
		Pages: pages}
}
`,

    // Handlers
    'handlers/handlers.go': `package handlers

import (
	"{{projectName}}/config"

	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog"
)

type Handlers struct {
	db     *sqlx.DB
	logger *zerolog.Logger
	config *config.Config
}

func New(db *sqlx.DB, logger *zerolog.Logger, config *config.Config) *Handlers {
	return &Handlers{
		db:     db,
		logger: logger,
		config: config}
}
`,

    'handlers/users.go': `package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"{{projectName}}/database/queries"
	"{{projectName}}/models"
	"{{projectName}}/utils"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

var validate = validator.New()

// CreateUser godoc
// @Summary Create a new user
// @Description Create a new user with the provided information
// @Tags users
// @Accept json
// @Produce json
// @Param user body models.CreateUserRequest true "User information"
// @Success 201 {object} models.User
// @Failure 400 {object} utils.ErrorResponse
// @Failure 409 {object} utils.ErrorResponse
// @Router /users [post]
func (h *Handlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, utils.ErrBadRequest(err))
		return
	}

	if err := validate.Struct(req); err != nil {
		render.Render(w, r, utils.ErrValidation(err))
		return
	}

	user := &models.User{
		Email: req.Email,
		Name:  req.Name,
		Role:  req.Role}

	if user.Role == "" {
		user.Role = "user"
	}

	if err := user.SetPassword(req.Password); err != nil {
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	err := h.db.Get(user, queries.InsertUser, user.Email, user.PasswordHash, user.Name, user.Role)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to create user")
		if utils.IsDuplicateError(err) {
			render.Render(w, r, utils.ErrConflict("user with this email already exists"))
			return
		}
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, user)
}

// GetUser godoc
// @Summary Get a user by ID
// @Description Get user information by user ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 200 {object} models.User
// @Failure 404 {object} utils.ErrorResponse
// @Security Bearer
// @Router /users/{id} [get]
func (h *Handlers) GetUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	
	if _, err := uuid.Parse(userID); err != nil {
		render.Render(w, r, utils.ErrBadRequest(errors.New("invalid user ID format")))
		return
	}

	var user models.User
	err := h.db.Get(&user, queries.GetUserByID, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			render.Render(w, r, utils.ErrNotFound("user not found"))
			return
		}
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to get user")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	render.JSON(w, r, user)
}

// UpdateUser godoc
// @Summary Update a user
// @Description Update user information
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Param user body models.UpdateUserRequest true "User update information"
// @Success 200 {object} models.User
// @Failure 400 {object} utils.ErrorResponse
// @Failure 404 {object} utils.ErrorResponse
// @Security Bearer
// @Router /users/{id} [put]
func (h *Handlers) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	
	if _, err := uuid.Parse(userID); err != nil {
		render.Render(w, r, utils.ErrBadRequest(errors.New("invalid user ID format")))
		return
	}

	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, utils.ErrBadRequest(err))
		return
	}

	if err := validate.Struct(req); err != nil {
		render.Render(w, r, utils.ErrValidation(err))
		return
	}

	// Get existing user
	var user models.User
	err := h.db.Get(&user, queries.GetUserByID, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			render.Render(w, r, utils.ErrNotFound("user not found"))
			return
		}
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to get user")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	// Update fields
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.Active != nil {
		user.Active = *req.Active
	}

	// Execute update
	err = h.db.Get(&user, queries.UpdateUser, user.Email, user.Name, user.Role, user.Active, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to update user")
		if utils.IsDuplicateError(err) {
			render.Render(w, r, utils.ErrConflict("user with this email already exists"))
			return
		}
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	render.JSON(w, r, user)
}

// DeleteUser godoc
// @Summary Delete a user
// @Description Soft delete a user by ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 204 "No Content"
// @Failure 404 {object} utils.ErrorResponse
// @Security Bearer
// @Router /users/{id} [delete]
func (h *Handlers) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	
	if _, err := uuid.Parse(userID); err != nil {
		render.Render(w, r, utils.ErrBadRequest(errors.New("invalid user ID format")))
		return
	}

	result, err := h.db.Exec(queries.DeleteUser, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to delete user")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	if rowsAffected == 0 {
		render.Render(w, r, utils.ErrNotFound("user not found"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListUsers godoc
// @Summary List users
// @Description Get a paginated list of users
// @Tags users
// @Accept json
// @Produce json
// @Param search query string false "Search term"
// @Param role query string false "Filter by role"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} map[string]interface{}
// @Security Bearer
// @Router /users [get]
func (h *Handlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")
	page := utils.ParseIntOrDefault(r.URL.Query().Get("page"), 1)
	limit := utils.ParseIntOrDefault(r.URL.Query().Get("limit"), 10)

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	offset := (page - 1) * limit

	// Get total count
	var total int
	err := h.db.Get(&total, queries.CountUsers, search, role)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to count users")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	// Get users
	var users []models.User
	err = h.db.Select(&users, queries.ListUsers, search, role, limit, offset)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list users")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	pagination := models.NewPaginationResponse(total, page, limit)

	render.JSON(w, r, map[string]interface{}{
		"users":      users,
		"pagination": pagination})
}

// Login godoc
// @Summary User login
// @Description Authenticate user and return JWT tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body models.LoginRequest true "Login credentials"
// @Success 200 {object} models.LoginResponse
// @Failure 401 {object} utils.ErrorResponse
// @Router /auth/login [post]
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, utils.ErrBadRequest(err))
		return
	}

	if err := validate.Struct(req); err != nil {
		render.Render(w, r, utils.ErrValidation(err))
		return
	}

	var user models.User
	err := h.db.Get(&user, queries.GetUserByEmail, req.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			render.Render(w, r, utils.ErrUnauthorized("invalid credentials"))
			return
		}
		h.logger.Error().Err(err).Msg("Failed to get user by email")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	if !user.CheckPassword(req.Password) {
		render.Render(w, r, utils.ErrUnauthorized("invalid credentials"))
		return
	}

	if !user.Active {
		render.Render(w, r, utils.ErrForbidden("account is inactive"))
		return
	}

	// Generate tokens
	accessToken, err := utils.GenerateToken(user.ID, "access", h.config.JWTSecret, h.config.JWTExpiry)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to generate access token")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	refreshToken, err := utils.GenerateToken(user.ID, "refresh", h.config.JWTSecret, h.config.RefreshExpiry)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to generate refresh token")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	response := models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         &user}

	render.JSON(w, r, response)
}
`,

    'handlers/products.go': `package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"{{projectName}}/database/queries"
	"{{projectName}}/models"
	"{{projectName}}/utils"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/google/uuid"
)

// CreateProduct godoc
// @Summary Create a new product
// @Description Create a new product with the provided information
// @Tags products
// @Accept json
// @Produce json
// @Param product body models.CreateProductRequest true "Product information"
// @Success 201 {object} models.Product
// @Failure 400 {object} utils.ErrorResponse
// @Failure 409 {object} utils.ErrorResponse
// @Security Bearer
// @Router /products [post]
func (h *Handlers) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, utils.ErrBadRequest(err))
		return
	}

	if err := validate.Struct(req); err != nil {
		render.Render(w, r, utils.ErrValidation(err))
		return
	}

	var product models.Product
	err := h.db.Get(&product, queries.InsertProduct, req.Name, req.Description, req.Price, req.Stock, req.Category, req.SKU)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to create product")
		if utils.IsDuplicateError(err) {
			render.Render(w, r, utils.ErrConflict("product with this SKU already exists"))
			return
		}
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, product)
}

// GetProduct godoc
// @Summary Get a product by ID
// @Description Get product information by product ID
// @Tags products
// @Accept json
// @Produce json
// @Param id path string true "Product ID"
// @Success 200 {object} models.Product
// @Failure 404 {object} utils.ErrorResponse
// @Router /products/{id} [get]
func (h *Handlers) GetProduct(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	
	if _, err := uuid.Parse(productID); err != nil {
		render.Render(w, r, utils.ErrBadRequest(errors.New("invalid product ID format")))
		return
	}

	var product models.Product
	err := h.db.Get(&product, queries.GetProductByID, productID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			render.Render(w, r, utils.ErrNotFound("product not found"))
			return
		}
		h.logger.Error().Err(err).Str("product_id", productID).Msg("Failed to get product")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	render.JSON(w, r, product)
}

// UpdateProduct godoc
// @Summary Update a product
// @Description Update product information
// @Tags products
// @Accept json
// @Produce json
// @Param id path string true "Product ID"
// @Param product body models.UpdateProductRequest true "Product update information"
// @Success 200 {object} models.Product
// @Failure 400 {object} utils.ErrorResponse
// @Failure 404 {object} utils.ErrorResponse
// @Security Bearer
// @Router /products/{id} [put]
func (h *Handlers) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	
	if _, err := uuid.Parse(productID); err != nil {
		render.Render(w, r, utils.ErrBadRequest(errors.New("invalid product ID format")))
		return
	}

	var req models.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, utils.ErrBadRequest(err))
		return
	}

	if err := validate.Struct(req); err != nil {
		render.Render(w, r, utils.ErrValidation(err))
		return
	}

	// Get existing product
	var product models.Product
	err := h.db.Get(&product, queries.GetProductByID, productID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			render.Render(w, r, utils.ErrNotFound("product not found"))
			return
		}
		h.logger.Error().Err(err).Str("product_id", productID).Msg("Failed to get product")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	// Update fields
	if req.Name != "" {
		product.Name = req.Name
	}
	if req.Description != "" {
		product.Description = req.Description
	}
	if req.Price > 0 {
		product.Price = req.Price
	}
	if req.Stock >= 0 {
		product.Stock = req.Stock
	}
	if req.Category != "" {
		product.Category = req.Category
	}
	if req.SKU != "" {
		product.SKU = req.SKU
	}
	if req.Active != nil {
		product.Active = *req.Active
	}

	// Execute update
	err = h.db.Get(&product, queries.UpdateProduct, 
		product.Name, product.Description, product.Price, product.Stock, 
		product.Category, product.SKU, product.Active, productID)
	if err != nil {
		h.logger.Error().Err(err).Str("product_id", productID).Msg("Failed to update product")
		if utils.IsDuplicateError(err) {
			render.Render(w, r, utils.ErrConflict("product with this SKU already exists"))
			return
		}
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	render.JSON(w, r, product)
}

// DeleteProduct godoc
// @Summary Delete a product
// @Description Soft delete a product by ID
// @Tags products
// @Accept json
// @Produce json
// @Param id path string true "Product ID"
// @Success 204 "No Content"
// @Failure 404 {object} utils.ErrorResponse
// @Security Bearer
// @Router /products/{id} [delete]
func (h *Handlers) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	
	if _, err := uuid.Parse(productID); err != nil {
		render.Render(w, r, utils.ErrBadRequest(errors.New("invalid product ID format")))
		return
	}

	result, err := h.db.Exec(queries.DeleteProduct, productID)
	if err != nil {
		h.logger.Error().Err(err).Str("product_id", productID).Msg("Failed to delete product")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	if rowsAffected == 0 {
		render.Render(w, r, utils.ErrNotFound("product not found"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListProducts godoc
// @Summary List products
// @Description Get a paginated list of products
// @Tags products
// @Accept json
// @Produce json
// @Param search query string false "Search term"
// @Param category query string false "Filter by category"
// @Param min_price query number false "Minimum price"
// @Param max_price query number false "Maximum price"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} map[string]interface{}
// @Router /products [get]
func (h *Handlers) ListProducts(w http.ResponseWriter, r *http.Request) {
	req := models.ListProductsRequest{
		Search:   r.URL.Query().Get("search"),
		Category: r.URL.Query().Get("category"),
		MinPrice: utils.ParseFloatOrDefault(r.URL.Query().Get("min_price"), 0),
		MaxPrice: utils.ParseFloatOrDefault(r.URL.Query().Get("max_price"), 0),
		Page:     utils.ParseIntOrDefault(r.URL.Query().Get("page"), 1),
		Limit:    utils.ParseIntOrDefault(r.URL.Query().Get("limit"), 10)}

	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 || req.Limit > 100 {
		req.Limit = 10
	}

	offset := (req.Page - 1) * req.Limit

	// Get total count
	var total int
	err := h.db.Get(&total, queries.CountProducts, req.Search, req.Category, req.MinPrice, req.MaxPrice)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to count products")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	// Get products
	var products []models.Product
	err = h.db.Select(&products, queries.ListProducts, 
		req.Search, req.Category, req.MinPrice, req.MaxPrice, req.Limit, offset)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list products")
		render.Render(w, r, utils.ErrInternalServer(err))
		return
	}

	pagination := models.NewPaginationResponse(total, req.Page, req.Limit)

	render.JSON(w, r, map[string]interface{}{
		"products":   products,
		"pagination": pagination})
}
`,

    // Routes
    'routes/routes.go': `package routes

import (
	"net/http"

	"{{projectName}}/config"
	"{{projectName}}/handlers"
	"{{projectName}}/middleware"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

func Setup(h *handlers.Handlers, cfg *config.Config) chi.Router {
	r := chi.NewRouter()

	// Middleware
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Compress(5))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "https://localhost:*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300}))

	// Rate limiting
	r.Use(middleware.RateLimiter(cfg.RedisURL))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Swagger documentation
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"),
	))

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Group(func(r chi.Router) {
			// Auth
			r.Post("/auth/login", h.Login)
			r.Post("/users", h.CreateUser)

			// Products (public read)
			r.Get("/products", h.ListProducts)
			r.Get("/products/{id}", h.GetProduct)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.JWTAuth(cfg.JWTSecret))

			// Users
			r.Get("/users", h.ListUsers)
			r.Get("/users/{id}", h.GetUser)
			r.Put("/users/{id}", h.UpdateUser)
			r.Delete("/users/{id}", h.DeleteUser)

			// Products (protected write)
			r.Post("/products", h.CreateProduct)
			r.Put("/products/{id}", h.UpdateProduct)
			r.Delete("/products/{id}", h.DeleteProduct)
		})
	})

	return r
}
`,

    // Middleware
    'middleware/auth.go': `package middleware

import (
	"context"
	"net/http"
	"strings"

	"{{projectName}}/utils"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

func JWTAuth(secret string) func(http.Handler) http.Handler {
	tokenAuth := jwtauth.New("HS256", []byte(secret), nil)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, claims, err := jwtauth.FromContext(r.Context())

			if err != nil {
				render.Render(w, r, utils.ErrUnauthorized("missing or invalid token"))
				return
			}

			if token == nil || !token.Valid {
				render.Render(w, r, utils.ErrUnauthorized("invalid token"))
				return
			}

			// Check token type
			tokenType, ok := claims["type"].(string)
			if !ok || tokenType != "access" {
				render.Render(w, r, utils.ErrUnauthorized("invalid token type"))
				return
			}

			// Add user ID to context
			userID, ok := claims["user_id"].(string)
			if !ok {
				render.Render(w, r, utils.ErrUnauthorized("invalid token claims"))
				return
			}

			ctx := context.WithValue(r.Context(), "user_id", userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserIDFromContext(ctx context.Context) string {
	userID, _ := ctx.Value("user_id").(string)
	return userID
}
`,

    'middleware/rate_limiter.go': `package middleware

import (
	"context"
	"net/http"
	"time"

	"{{projectName}}/utils"

	"github.com/go-chi/httprate"
	"github.com/go-chi/render"
	"github.com/redis/go-redis/v9"
)

func RateLimiter(redisURL string) func(http.Handler) http.Handler {
	// Parse Redis URL
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		// Fallback to in-memory rate limiter
		return httprate.LimitByIP(100, 1*time.Minute)
	}

	// Create Redis client
	client := redis.NewClient(opt)

	// Test connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		// Fallback to in-memory rate limiter
		return httprate.LimitByIP(100, 1*time.Minute)
	}

	// Use Redis-backed rate limiter
	return httprate.Limit(
		100,
		1*time.Minute,
		httprate.WithKeyFuncs(httprate.KeyByIP),
		httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
			render.Render(w, r, utils.ErrTooManyRequests("rate limit exceeded"))
		}),
	)
}
`,

    // Utils
    'utils/errors.go': `package utils

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/render"
	"github.com/go-playground/validator/v10"
)

type ErrorResponse struct {
	Err            error \`json:"-"\`
	HTTPStatusCode int   \`json:"-"\`

	StatusText string \`json:"status"\`
	AppCode    int64  \`json:"code,omitempty"\`
	ErrorText  string \`json:"error,omitempty"\`
}

func (e *ErrorResponse) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, e.HTTPStatusCode)
	return nil
}

func ErrBadRequest(err error) render.Renderer {
	return &ErrorResponse{
		Err:            err,
		HTTPStatusCode: http.StatusBadRequest,
		StatusText:     "Bad request",
		ErrorText:      err.Error()}
}

func ErrValidation(err error) render.Renderer {
	var errText string
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		var errors []string
		for _, e := range validationErrors {
			errors = append(errors, formatValidationError(e))
		}
		errText = strings.Join(errors, "; ")
	} else {
		errText = err.Error()
	}

	return &ErrorResponse{
		Err:            err,
		HTTPStatusCode: http.StatusBadRequest,
		StatusText:     "Validation failed",
		ErrorText:      errText}
}

func ErrUnauthorized(message string) render.Renderer {
	return &ErrorResponse{
		HTTPStatusCode: http.StatusUnauthorized,
		StatusText:     "Unauthorized",
		ErrorText:      message}
}

func ErrForbidden(message string) render.Renderer {
	return &ErrorResponse{
		HTTPStatusCode: http.StatusForbidden,
		StatusText:     "Forbidden",
		ErrorText:      message}
}

func ErrNotFound(message string) render.Renderer {
	return &ErrorResponse{
		HTTPStatusCode: http.StatusNotFound,
		StatusText:     "Not found",
		ErrorText:      message}
}

func ErrConflict(message string) render.Renderer {
	return &ErrorResponse{
		HTTPStatusCode: http.StatusConflict,
		StatusText:     "Conflict",
		ErrorText:      message}
}

func ErrInternalServer(err error) render.Renderer {
	return &ErrorResponse{
		Err:            err,
		HTTPStatusCode: http.StatusInternalServerError,
		StatusText:     "Internal server error",
		ErrorText:      "An error occurred processing your request"}
}

func ErrTooManyRequests(message string) render.Renderer {
	return &ErrorResponse{
		HTTPStatusCode: http.StatusTooManyRequests,
		StatusText:     "Too many requests",
		ErrorText:      message}
}

func formatValidationError(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", e.Field())
	case "email":
		return fmt.Sprintf("%s must be a valid email", e.Field())
	case "min":
		return fmt.Sprintf("%s must be at least %s", e.Field(), e.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s", e.Field(), e.Param())
	default:
		return fmt.Sprintf("%s is invalid", e.Field())
	}
}

func IsDuplicateError(err error) bool {
	return strings.Contains(err.Error(), "duplicate key") || 
		   strings.Contains(err.Error(), "UNIQUE constraint") ||
		   strings.Contains(err.Error(), "Duplicate entry")
}
`,

    'utils/jwt.go': `package utils

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func GenerateToken(userID, tokenType, secret string, expiry time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"type":    tokenType,
		"exp":     time.Now().Add(expiry).Unix(),
		"iat":     time.Now().Unix(),
		"jti":     uuid.New().String()}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateToken(tokenString, secret string) (*jwt.Token, jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, nil, jwt.ErrTokenInvalidClaims
	}

	return token, claims, nil
}
`,

    'utils/helpers.go': `package utils

import (
	"strconv"
)

func ParseIntOrDefault(s string, defaultValue int) int {
	if value, err := strconv.Atoi(s); err == nil {
		return value
	}
	return defaultValue
}

func ParseFloatOrDefault(s string, defaultValue float64) float64 {
	if value, err := strconv.ParseFloat(s, 64); err == nil {
		return value
	}
	return defaultValue
}
`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Generate swagger docs
RUN go install github.com/swaggo/swag/cmd/swag@latest
RUN swag init

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server .

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 -S app && \
    adduser -u 1000 -S app -G app

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .
COPY --from=builder /app/docs ./docs
COPY --chown=app:app .env.example .env

# Copy migration files
COPY --from=builder /app/database/migrations ./database/migrations

# Change ownership
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./server"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DATABASE_URL=postgres://postgres:password@postgres:5432/{{projectName}}?sslmode=disable
      - JWT_SECRET=your-secret-key
      - LOG_LEVEL=info
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectName}}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
`,

    // Makefile
    'Makefile': `.PHONY: all build run test clean migrate swagger lint fmt vet

# Variables
BINARY_NAME=server
DOCKER_IMAGE={{projectName}}:latest
GO_FILES=$(shell find . -name '*.go' -type f)

# Build the application
all: clean build

build:
	@echo "Building..."
	go build -o $(BINARY_NAME) -v

# Run the application
run: swagger build
	@echo "Running..."
	./$(BINARY_NAME)

# Run with hot reload
dev:
	@echo "Running with hot reload..."
	air

# Clean build artifacts
clean:
	@echo "Cleaning..."
	go clean
	rm -f $(BINARY_NAME)

# Run tests
test:
	@echo "Running tests..."
	go test -v -race -cover ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Generate swagger documentation
swagger:
	@echo "Generating swagger docs..."
	swag init

# Run database migrations
migrate-up:
	@echo "Running migrations..."
	migrate -path database/migrations -database "$\${DATABASE_URL}" up

migrate-down:
	@echo "Rolling back migrations..."
	migrate -path database/migrations -database "$\${DATABASE_URL}" down

migrate-create:
	@echo "Creating new migration..."
	migrate create -ext sql -dir database/migrations -seq $(name)

# Lint the code
lint:
	@echo "Linting..."
	golangci-lint run

# Format the code
fmt:
	@echo "Formatting..."
	go fmt ./...

# Run go vet
vet:
	@echo "Vetting..."
	go vet ./...

# Install dependencies
deps:
	@echo "Installing dependencies..."
	go mod download
	go install github.com/cosmtrek/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	go install -tags 'postgres mysql sqlite3' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Docker commands
docker-build:
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE) .

docker-run:
	@echo "Running Docker container..."
	docker run -p 8080:8080 $(DOCKER_IMAGE)

docker-compose-up:
	@echo "Starting services with docker-compose..."
	docker-compose up -d

docker-compose-down:
	@echo "Stopping services..."
	docker-compose down

# Security scan
security:
	@echo "Running security scan..."
	gosec ./...

# Update dependencies
update-deps:
	@echo "Updating dependencies..."
	go get -u ./...
	go mod tidy
`,

    '.air.toml': `root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  args_bin = []
  bin = "./tmp/main"
  cmd = "go build -o ./tmp/main ."
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata", "docs"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = ""
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html"]
  kill_delay = "0s"
  log = "build-errors.log"
  send_interrupt = false
  stop_on_error = true

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
`,

    '.env.example': `# Server configuration
PORT=8080

# Database configuration
DATABASE_URL=postgres://user:password@localhost/dbname?sslmode=disable
# DATABASE_URL=mysql://user:password@tcp(localhost:3306)/dbname
# DATABASE_URL=sqlite:///path/to/database.db

# JWT configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRY_MINUTES=15
REFRESH_EXPIRY_DAYS=7

# Logging
LOG_LEVEL=info

# Redis configuration
REDIS_URL=redis://localhost:6379/0
`,

    '.gitignore': `# Binaries for programs and plugins
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary, built with go test -c
*.test

# Output of the go coverage tool
*.out
coverage.html

# Dependency directories
vendor/

# Go workspace file
go.work

# Environment files
.env
.env.local
.env.*.local

# IDE files
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Build output
server
{{projectName}}
/tmp
/dist

# Swagger docs
docs/

# Logs
*.log

# Air tmp directory
tmp/
`,

    'README.md': `# {{projectName}}

Fast Go API with sqlx for raw SQL queries with compile-time type safety.

## Features

- High-performance HTTP router with Chi
- Raw SQL queries with sqlx for type safety
- Database migrations with golang-migrate
- JWT authentication with access and refresh tokens
- Request validation
- Comprehensive error handling
- Redis-backed rate limiting
- Structured logging with Zerolog
- Swagger/OpenAPI documentation
- Docker and Docker Compose setup
- Hot reload development with Air
- Support for PostgreSQL, MySQL, and SQLite

## Prerequisites

- Go 1.21 or higher
- Docker and Docker Compose (optional)
- PostgreSQL, MySQL, or SQLite

## Quick Start

1. Clone the repository:
   \`\`\`bash
   git clone <repository-url>
   cd {{projectName}}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   make deps
   \`\`\`

3. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Run database migrations:
   \`\`\`bash
   make migrate-up
   \`\`\`

5. Generate Swagger documentation:
   \`\`\`bash
   make swagger
   \`\`\`

6. Run the application:
   \`\`\`bash
   make run
   \`\`\`

   Or with Docker Compose:
   \`\`\`bash
   docker-compose up
   \`\`\`

## Development

### Hot Reload

Run the server with hot reload:
\`\`\`bash
make dev
\`\`\`

### Testing

Run tests:
\`\`\`bash
make test
\`\`\`

Run tests with coverage:
\`\`\`bash
make test-coverage
\`\`\`

### Database Migrations

Create a new migration:
\`\`\`bash
make migrate-create name=create_new_table
\`\`\`

Run migrations:
\`\`\`bash
make migrate-up
\`\`\`

Rollback migrations:
\`\`\`bash
make migrate-down
\`\`\`

### Linting

\`\`\`bash
make lint
\`\`\`

## API Documentation

After running \`make swagger\`, the API documentation is available at:
- Swagger UI: http://localhost:8080/swagger/

## Architecture

- \`config/\` - Configuration management
- \`database/\` - Database connection and migrations
- \`handlers/\` - HTTP request handlers
- \`middleware/\` - HTTP middleware
- \`models/\` - Data models and validation
- \`routes/\` - Route definitions
- \`utils/\` - Utility functions
- \`docs/\` - Generated Swagger documentation

## Why sqlx?

sqlx provides several advantages over ORMs:
- Type-safe SQL queries at compile time
- Full control over SQL queries
- Better performance with raw SQL
- Named parameters and struct scanning
- Support for complex queries and database-specific features

## Security

- JWT-based authentication
- Secure password hashing with bcrypt
- Rate limiting to prevent abuse
- Request validation
- CORS configuration

## License

[Your License]
`
  }
};