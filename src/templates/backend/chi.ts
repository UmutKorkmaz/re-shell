import { BackendTemplate } from '../types';

export const chiTemplate: BackendTemplate = {
  id: 'chi',
  name: 'chi',
  displayName: 'Chi Router',
  description: 'Lightweight, idiomatic and composable router for building Go HTTP services',
  language: 'go',
  framework: 'chi',
  version: '5.0.11',
  tags: ['go', 'chi', 'api', 'rest', 'router', 'middleware', 'composable'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'rate-limiting'],
  
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
	github.com/go-chi/httplog v0.3.2
	github.com/joho/godotenv v1.5.1
	github.com/go-playground/validator/v10 v10.16.0
	github.com/swaggo/swag v1.16.2
	github.com/swaggo/http-swagger/v2 v2.0.2
	github.com/rs/zerolog v1.31.0
	github.com/redis/go-redis/v9 v9.3.1
	gorm.io/gorm v1.25.5
	gorm.io/driver/postgres v1.5.4
	gorm.io/driver/mysql v1.5.2
	gorm.io/driver/sqlite v1.5.4
	golang.org/x/crypto v0.17.0
	github.com/google/uuid v1.5.0
	github.com/lestrrat-go/jwx/v2 v2.0.19
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
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20231201235250-de7065d80cb9 // indirect
	github.com/jackc/pgx/v5 v5.5.1 // indirect
	github.com/jackc/puddle/v2 v2.2.1 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/lestrrat-go/blackmagic v1.0.2 // indirect
	github.com/lestrrat-go/httpcc v1.0.1 // indirect
	github.com/lestrrat-go/httprc v1.0.4 // indirect
	github.com/lestrrat-go/iter v1.0.2 // indirect
	github.com/lestrrat-go/option v1.0.1 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-sqlite3 v1.14.19 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/swaggo/files/v2 v2.0.0 // indirect
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
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"{{projectName}}/config"
	"{{projectName}}/database"
	_ "{{projectName}}/docs" // swagger docs
	"{{projectName}}/handlers"
	"{{projectName}}/middleware"
	"{{projectName}}/routes"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httplog"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	httpSwagger "github.com/swaggo/http-swagger/v2"
)

// @title           {{projectName}} API
// @version         1.0
// @description     API server for {{projectName}} built with Chi router
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Info().Msg("No .env file found")
	}

	// Initialize configuration
	cfg := config.New()

	// Initialize logger
	setupLogger(cfg)

	// Initialize database
	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatal().Err(err).Msg("Failed to run migrations")
	}

	// Create router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(httplog.RequestLogger(httplog.NewLogger("{{projectName}}", httplog.Options{
		JSON:             cfg.Environment == "production",
		Concise:          cfg.Environment == "production",
		RequestHeaders:   cfg.Environment == "development",
		MessageFieldName: "msg",
		TimeFieldFormat:  time.RFC3339,
		Tags: map[string]string{
			"version": "1.0.0",
			"env":     cfg.Environment}})))
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.Timeout(60 * time.Second))
	r.Use(chiMiddleware.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300}))
	r.Use(middleware.RateLimiter(cfg))
	r.Use(chiMiddleware.Heartbeat("/ping"))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(\`{"status":"healthy","time":"\` + time.Now().UTC().Format(time.RFC3339) + \`"}\`))
	})

	// Swagger documentation
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"),
		httpSwagger.DeepLinking(true),
		httpSwagger.DocExpansion("none"),
		httpSwagger.DomID("swagger-ui"),
	))

	// Initialize handlers
	h := handlers.NewHandler(db, cfg)

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		routes.RegisterRoutes(r, h, cfg)
	})

	// Custom 404 handler
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(\`{"error":"Resource not found"}\`))
	})

	// Custom 405 handler
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		w.Write([]byte(\`{"error":"Method not allowed"}\`))
	})

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second}

	// Start server in goroutine
	go func() {
		log.Info().Msgf("Starting server on port %d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Failed to start server")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}

func setupLogger(cfg *config.Config) {
	// Configure zerolog
	zerolog.TimeFieldFormat = time.RFC3339
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	if cfg.Environment == "development" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
		log.Logger = log.Output(zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339})
	}
}
`,

    // Configuration
    'config/config.go': `package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment string
	Port        int
	
	// Database
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	
	// JWT
	JWTSecret          string
	JWTExpirationHours int
	
	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	
	// Rate limiting
	RateLimitRequests int
	RateLimitDuration time.Duration
	
	// CORS
	AllowedOrigins []string
	
	// Logging
	LogLevel string
	LogJSON  bool
}

func New() *Config {
	return &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		Port:        getEnvAsInt("PORT", 8080),
		
		// Database
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnvAsInt("DB_PORT", 5432),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "password"),
		DBName:     getEnv("DB_NAME", "{{projectName}}"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		
		// JWT
		JWTSecret:          getEnv("JWT_SECRET", "your-secret-key-change-this"),
		JWTExpirationHours: getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
		
		// Redis
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),
		
		// Rate limiting
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitDuration: time.Duration(getEnvAsInt("RATE_LIMIT_DURATION_MINUTES", 1)) * time.Minute,
		
		// CORS
		AllowedOrigins: strings.Split(getEnv("ALLOWED_ORIGINS", "*"), ","),
		
		// Logging
		LogLevel: getEnv("LOG_LEVEL", "info"),
		LogJSON:  getEnvAsBool("LOG_JSON", false)}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
`,

    // Database
    'database/database.go': `package database

import (
	"fmt"
	"time"

	"{{projectName}}/config"
	"{{projectName}}/models"

	"github.com/rs/zerolog/log"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Initialize(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	switch cfg.DBHost {
	case "sqlite", ":memory:":
		dialector = sqlite.Open(cfg.DBName)
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)
		dialector = mysql.Open(dsn)
	default:
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode)
		dialector = postgres.Open(dsn)
	}

	// Configure GORM
	gormConfig := &gorm.Config{
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
		PrepareStmt: true}
	
	if cfg.Environment == "development" {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Silent)
	}

	db, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	log.Info().Msg("Database connection established")
	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Product{},
		&models.Order{},
		&models.OrderItem{},
	)
}
`,

    // Models
    'models/user.go': `package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID        uint           \`gorm:"primarykey" json:"id"\`
	CreatedAt time.Time      \`json:"created_at"\`
	UpdatedAt time.Time      \`json:"updated_at"\`
	DeletedAt gorm.DeletedAt \`gorm:"index" json:"-"\`
	
	Email     string \`gorm:"uniqueIndex;not null" json:"email" validate:"required,email"\`
	Password  string \`gorm:"not null" json:"-"\`
	FirstName string \`gorm:"not null" json:"first_name" validate:"required,min=2,max=50"\`
	LastName  string \`gorm:"not null" json:"last_name" validate:"required,min=2,max=50"\`
	Phone     string \`json:"phone,omitempty" validate:"omitempty,e164"\`
	Role      string \`gorm:"default:user" json:"role" validate:"omitempty,oneof=user admin manager"\`
	Active    bool   \`gorm:"default:true" json:"active"\`
	Verified  bool   \`gorm:"default:false" json:"verified"\`
	
	Orders []Order \`gorm:"foreignKey:UserID" json:"-"\`
}

func (u *User) SetPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}

type LoginRequest struct {
	Email    string \`json:"email" validate:"required,email"\`
	Password string \`json:"password" validate:"required,min=6"\`
}

type RegisterRequest struct {
	Email     string \`json:"email" validate:"required,email"\`
	Password  string \`json:"password" validate:"required,min=6,max=72"\`
	FirstName string \`json:"first_name" validate:"required,min=2,max=50"\`
	LastName  string \`json:"last_name" validate:"required,min=2,max=50"\`
	Phone     string \`json:"phone,omitempty" validate:"omitempty,e164"\`
}

type UpdateUserRequest struct {
	FirstName *string \`json:"first_name,omitempty" validate:"omitempty,min=2,max=50"\`
	LastName  *string \`json:"last_name,omitempty" validate:"omitempty,min=2,max=50"\`
	Phone     *string \`json:"phone,omitempty" validate:"omitempty,e164"\`
}

type ChangePasswordRequest struct {
	CurrentPassword string \`json:"current_password" validate:"required"\`
	NewPassword     string \`json:"new_password" validate:"required,min=6,max=72"\`
}

type UserResponse struct {
	ID        uint      \`json:"id"\`
	Email     string    \`json:"email"\`
	FirstName string    \`json:"first_name"\`
	LastName  string    \`json:"last_name"\`
	Phone     string    \`json:"phone,omitempty"\`
	Role      string    \`json:"role"\`
	Active    bool      \`json:"active"\`
	Verified  bool      \`json:"verified"\`
	CreatedAt time.Time \`json:"created_at"\`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:        u.ID,
		Email:     u.Email,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Phone:     u.Phone,
		Role:      u.Role,
		Active:    u.Active,
		Verified:  u.Verified,
		CreatedAt: u.CreatedAt}
}
`,

    'models/product.go': `package models

import (
	"time"

	"gorm.io/gorm"
)

type Product struct {
	ID        uint           \`gorm:"primarykey" json:"id"\`
	CreatedAt time.Time      \`json:"created_at"\`
	UpdatedAt time.Time      \`json:"updated_at"\`
	DeletedAt gorm.DeletedAt \`gorm:"index" json:"-"\`
	
	Name        string  \`gorm:"not null;index" json:"name" validate:"required,min=1,max=200"\`
	Description string  \`json:"description" validate:"max=1000"\`
	Price       float64 \`gorm:"not null;check:price >= 0" json:"price" validate:"required,min=0"\`
	Cost        float64 \`gorm:"not null;check:cost >= 0" json:"cost" validate:"required,min=0"\`
	Stock       int     \`gorm:"default:0;check:stock >= 0" json:"stock" validate:"min=0"\`
	SKU         string  \`gorm:"uniqueIndex;not null" json:"sku" validate:"required,min=3,max=50"\`
	Barcode     string  \`gorm:"uniqueIndex" json:"barcode,omitempty" validate:"omitempty,min=8,max=13"\`
	Category    string  \`gorm:"index;not null" json:"category" validate:"required,min=1,max=100"\`
	Brand       string  \`gorm:"index" json:"brand,omitempty" validate:"omitempty,max=100"\`
	Weight      float64 \`json:"weight,omitempty" validate:"omitempty,min=0"\`
	Dimensions  string  \`json:"dimensions,omitempty" validate:"omitempty,max=100"\`
	Active      bool    \`gorm:"default:true;index" json:"active"\`
	Featured    bool    \`gorm:"default:false;index" json:"featured"\`
	
	OrderItems []OrderItem \`gorm:"foreignKey:ProductID" json:"-"\`
}

type CreateProductRequest struct {
	Name        string  \`json:"name" validate:"required,min=1,max=200"\`
	Description string  \`json:"description" validate:"max=1000"\`
	Price       float64 \`json:"price" validate:"required,min=0"\`
	Cost        float64 \`json:"cost" validate:"required,min=0"\`
	Stock       int     \`json:"stock" validate:"min=0"\`
	SKU         string  \`json:"sku" validate:"required,min=3,max=50"\`
	Barcode     string  \`json:"barcode,omitempty" validate:"omitempty,min=8,max=13"\`
	Category    string  \`json:"category" validate:"required,min=1,max=100"\`
	Brand       string  \`json:"brand,omitempty" validate:"omitempty,max=100"\`
	Weight      float64 \`json:"weight,omitempty" validate:"omitempty,min=0"\`
	Dimensions  string  \`json:"dimensions,omitempty" validate:"omitempty,max=100"\`
}

type UpdateProductRequest struct {
	Name        *string  \`json:"name,omitempty" validate:"omitempty,min=1,max=200"\`
	Description *string  \`json:"description,omitempty" validate:"omitempty,max=1000"\`
	Price       *float64 \`json:"price,omitempty" validate:"omitempty,min=0"\`
	Cost        *float64 \`json:"cost,omitempty" validate:"omitempty,min=0"\`
	Stock       *int     \`json:"stock,omitempty" validate:"omitempty,min=0"\`
	Category    *string  \`json:"category,omitempty" validate:"omitempty,min=1,max=100"\`
	Brand       *string  \`json:"brand,omitempty" validate:"omitempty,max=100"\`
	Weight      *float64 \`json:"weight,omitempty" validate:"omitempty,min=0"\`
	Dimensions  *string  \`json:"dimensions,omitempty" validate:"omitempty,max=100"\`
	Active      *bool    \`json:"active,omitempty"\`
	Featured    *bool    \`json:"featured,omitempty"\`
}

type ProductListRequest struct {
	Page      int     \`json:"page" validate:"min=1"\`
	Limit     int     \`json:"limit" validate:"min=1,max=100"\`
	Search    string  \`json:"search,omitempty" validate:"omitempty,min=1,max=100"\`
	Category  string  \`json:"category,omitempty" validate:"omitempty,min=1,max=100"\`
	Brand     string  \`json:"brand,omitempty" validate:"omitempty,min=1,max=100"\`
	MinPrice  float64 \`json:"min_price,omitempty" validate:"omitempty,min=0"\`
	MaxPrice  float64 \`json:"max_price,omitempty" validate:"omitempty,min=0,gtefield=MinPrice"\`
	InStock   bool    \`json:"in_stock,omitempty"\`
	Featured  bool    \`json:"featured,omitempty"\`
	SortBy    string  \`json:"sort_by,omitempty" validate:"omitempty,oneof=name price created_at stock"\`
	SortOrder string  \`json:"sort_order,omitempty" validate:"omitempty,oneof=asc desc"\`
}
`,

    'models/order.go': `package models

import (
	"time"

	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusShipped    OrderStatus = "shipped"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusRefunded   OrderStatus = "refunded"
)

type Order struct {
	ID            uint           \`gorm:"primarykey" json:"id"\`
	CreatedAt     time.Time      \`json:"created_at"\`
	UpdatedAt     time.Time      \`json:"updated_at"\`
	DeletedAt     gorm.DeletedAt \`gorm:"index" json:"-"\`
	
	OrderNumber   string      \`gorm:"uniqueIndex;not null" json:"order_number"\`
	UserID        uint        \`gorm:"not null;index" json:"user_id"\`
	Status        OrderStatus \`gorm:"default:pending;index" json:"status"\`
	Subtotal      float64     \`gorm:"not null" json:"subtotal"\`
	Tax           float64     \`gorm:"not null" json:"tax"\`
	Shipping      float64     \`gorm:"not null" json:"shipping"\`
	Total         float64     \`gorm:"not null" json:"total"\`
	Currency      string      \`gorm:"default:USD" json:"currency"\`
	PaymentMethod string      \`json:"payment_method,omitempty"\`
	PaymentStatus string      \`gorm:"default:pending" json:"payment_status"\`
	Notes         string      \`json:"notes,omitempty"\`
	
	// Shipping info
	ShippingName    string \`json:"shipping_name"\`
	ShippingAddress string \`json:"shipping_address"\`
	ShippingCity    string \`json:"shipping_city"\`
	ShippingState   string \`json:"shipping_state"\`
	ShippingZip     string \`json:"shipping_zip"\`
	ShippingCountry string \`json:"shipping_country"\`
	
	User       User        \`gorm:"foreignKey:UserID" json:"user,omitempty"\`
	OrderItems []OrderItem \`gorm:"foreignKey:OrderID" json:"items,omitempty"\`
}

type OrderItem struct {
	ID        uint           \`gorm:"primarykey" json:"id"\`
	CreatedAt time.Time      \`json:"created_at"\`
	UpdatedAt time.Time      \`json:"updated_at"\`
	DeletedAt gorm.DeletedAt \`gorm:"index" json:"-"\`
	
	OrderID   uint    \`gorm:"not null;index" json:"order_id"\`
	ProductID uint    \`gorm:"not null;index" json:"product_id"\`
	Quantity  int     \`gorm:"not null;check:quantity > 0" json:"quantity"\`
	Price     float64 \`gorm:"not null" json:"price"\`
	Total     float64 \`gorm:"not null" json:"total"\`
	
	Product Product \`gorm:"foreignKey:ProductID" json:"product,omitempty"\`
}

type CreateOrderRequest struct {
	Items []struct {
		ProductID uint \`json:"product_id" validate:"required"\`
		Quantity  int  \`json:"quantity" validate:"required,min=1"\`
	} \`json:"items" validate:"required,min=1,dive"\`
	ShippingName    string \`json:"shipping_name" validate:"required"\`
	ShippingAddress string \`json:"shipping_address" validate:"required"\`
	ShippingCity    string \`json:"shipping_city" validate:"required"\`
	ShippingState   string \`json:"shipping_state" validate:"required"\`
	ShippingZip     string \`json:"shipping_zip" validate:"required"\`
	ShippingCountry string \`json:"shipping_country" validate:"required"\`
	PaymentMethod   string \`json:"payment_method,omitempty"\`
	Notes           string \`json:"notes,omitempty"\`
}

type UpdateOrderStatusRequest struct {
	Status OrderStatus \`json:"status" validate:"required,oneof=pending processing shipped delivered cancelled refunded"\`
}
`,

    // Handlers
    'handlers/handler.go': `package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"

	"{{projectName}}/config"

	"github.com/go-chi/render"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

type Handler struct {
	db       *gorm.DB
	cfg      *config.Config
	validate *validator.Validate
}

func NewHandler(db *gorm.DB, cfg *config.Config) *Handler {
	v := validator.New()
	
	// Register custom validators
	v.RegisterValidation("password", validatePassword)
	
	return &Handler{
		db:       db,
		cfg:      cfg,
		validate: v}
}

// Custom validation functions
func validatePassword(fl validator.FieldLevel) bool {
	password := fl.Field().String()
	// At least 6 characters, one uppercase, one lowercase, one digit
	if len(password) < 6 {
		return false
	}
	
	var hasUpper, hasLower, hasDigit bool
	for _, char := range password {
		switch {
		case 'A' <= char && char <= 'Z':
			hasUpper = true
		case 'a' <= char && char <= 'z':
			hasLower = true
		case '0' <= char && char <= '9':
			hasDigit = true
		}
	}
	
	return hasUpper && hasLower && hasDigit
}

// Response helpers
type ErrorResponse struct {
	Error   string            \`json:"error"\`
	Details []ValidationError \`json:"details,omitempty"\`
}

type ValidationError struct {
	Field   string \`json:"field"\`
	Message string \`json:"message"\`
}

func (h *Handler) respondWithError(w http.ResponseWriter, code int, message string) {
	render.Status(r, code)
	render.JSON(w, r, ErrorResponse{Error: message})
}

func (h *Handler) respondWithValidationError(w http.ResponseWriter, r *http.Request, err error) {
	var details []ValidationError
	
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			details = append(details, ValidationError{
				Field:   e.Field(),
				Message: h.getErrorMessage(e)})
		}
	}
	
	render.Status(r, http.StatusBadRequest)
	render.JSON(w, r, ErrorResponse{
		Error:   "Validation failed",
		Details: details})
}

func (h *Handler) getErrorMessage(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return "This field is required"
	case "email":
		return "Invalid email format"
	case "min":
		if e.Type().Kind() == reflect.String {
			return fmt.Sprintf("Must be at least %s characters", e.Param())
		}
		return fmt.Sprintf("Must be at least %s", e.Param())
	case "max":
		if e.Type().Kind() == reflect.String {
			return fmt.Sprintf("Must be at most %s characters", e.Param())
		}
		return fmt.Sprintf("Must be at most %s", e.Param())
	case "oneof":
		return fmt.Sprintf("Must be one of: %s", e.Param())
	case "e164":
		return "Invalid phone number format (use E.164 format)"
	case "password":
		return "Password must contain uppercase, lowercase, and digit"
	case "gtefield":
		return fmt.Sprintf("Must be greater than or equal to %s", e.Param())
	default:
		return "Invalid value"
	}
}

// Bind and validate request
func (h *Handler) bindAndValidate(r *http.Request, v interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return fmt.Errorf("invalid request format: %w", err)
	}
	
	if err := h.validate.Struct(v); err != nil {
		return err
	}
	
	return nil
}

// Pagination helpers
type PaginatedResponse struct {
	Data       interface{} \`json:"data"\`
	Total      int64       \`json:"total"\`
	Page       int         \`json:"page"\`
	Limit      int         \`json:"limit"\`
	TotalPages int         \`json:"total_pages"\`
	HasNext    bool        \`json:"has_next"\`
	HasPrev    bool        \`json:"has_prev"\`
}

func (h *Handler) paginate(query *gorm.DB, page, limit int, result interface{}) (*PaginatedResponse, error) {
	var total int64
	
	// Count total records
	countQuery := *query
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, err
	}
	
	// Calculate offset
	offset := (page - 1) * limit
	
	// Fetch paginated results
	if err := query.Offset(offset).Limit(limit).Find(result).Error; err != nil {
		return nil, err
	}
	
	// Calculate total pages
	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}
	
	return &PaginatedResponse{
		Data:       result,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1}, nil
}
`,

    'handlers/auth.go': `package handlers

import (
	"net/http"
	"time"

	"{{projectName}}/models"
	"{{projectName}}/utils"

	"github.com/go-chi/render"
	"github.com/rs/zerolog/log"
)

// @Summary Register a new user
// @Description Create a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param user body models.RegisterRequest true "User registration data"
// @Success 201 {object} models.UserResponse
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 409 {object} handlers.ErrorResponse
// @Router /auth/register [post]
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := h.bindAndValidate(r, &req); err != nil {
		if _, ok := err.(validator.ValidationErrors); ok {
			h.respondWithValidationError(w, r, err)
			return
		}
		h.respondWithError(w, http.StatusBadRequest, "Invalid request format")
		return
	}

	// Check if user exists
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		h.respondWithError(w, http.StatusConflict, "Email already registered")
		return
	}

	// Create new user
	user := models.User{
		Email:     req.Email,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Phone:     req.Phone}

	if err := user.SetPassword(req.Password); err != nil {
		log.Error().Err(err).Msg("Failed to hash password")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	if err := h.db.Create(&user).Error; err != nil {
		log.Error().Err(err).Msg("Failed to create user")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	log.Info().Uint("user_id", user.ID).Str("email", user.Email).Msg("User registered")
	
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, user.ToResponse())
}

// @Summary Login user
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body models.LoginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Router /auth/login [post]
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := h.bindAndValidate(r, &req); err != nil {
		if _, ok := err.(validator.ValidationErrors); ok {
			h.respondWithValidationError(w, r, err)
			return
		}
		h.respondWithError(w, http.StatusBadRequest, "Invalid request format")
		return
	}

	// Find user
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		h.respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Check password
	if !user.CheckPassword(req.Password) {
		h.respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Check if user is active
	if !user.Active {
		h.respondWithError(w, http.StatusUnauthorized, "Account is disabled")
		return
	}

	// Generate JWT token
	token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpirationHours)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate token")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to generate token")
		return
	}

	log.Info().Uint("user_id", user.ID).Str("email", user.Email).Msg("User logged in")

	render.JSON(w, r, map[string]interface{}{
		"token": token,
		"user":  user.ToResponse(),
		"expires_in": h.cfg.JWTExpirationHours * 3600, // in seconds
	})
}

// @Summary Get current user
// @Description Get the currently authenticated user
// @Tags auth
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} models.UserResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Router /auth/me [get]
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		h.respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	render.JSON(w, r, user.ToResponse())
}

// @Summary Change password
// @Description Change the current user's password
// @Tags auth
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body models.ChangePasswordRequest true "Password change data"
// @Success 200 {object} map[string]string
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Router /auth/change-password [post]
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(uint)

	var req models.ChangePasswordRequest
	if err := h.bindAndValidate(r, &req); err != nil {
		if _, ok := err.(validator.ValidationErrors); ok {
			h.respondWithValidationError(w, r, err)
			return
		}
		h.respondWithError(w, http.StatusBadRequest, "Invalid request format")
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		h.respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	// Verify current password
	if !user.CheckPassword(req.CurrentPassword) {
		h.respondWithError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}

	// Set new password
	if err := user.SetPassword(req.NewPassword); err != nil {
		log.Error().Err(err).Msg("Failed to hash password")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	if err := h.db.Save(&user).Error; err != nil {
		log.Error().Err(err).Msg("Failed to update user")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	log.Info().Uint("user_id", user.ID).Msg("Password changed")

	render.JSON(w, r, map[string]string{
		"message": "Password changed successfully"})
}
`,

    'handlers/user.go': `package handlers

import (
	"net/http"
	"strconv"

	"{{projectName}}/models"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/rs/zerolog/log"
)

// @Summary List all users
// @Description Get a list of all users (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} handlers.PaginatedResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 403 {object} handlers.ErrorResponse
// @Router /users [get]
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 10
	}

	var users []models.User
	query := h.db.Model(&models.User{})
	
	response, err := h.paginate(query, page, limit, &users)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch users")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	// Convert to response format
	userResponses := make([]models.UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = user.ToResponse()
	}
	response.Data = userResponses

	render.JSON(w, r, response)
}

// @Summary Get user by ID
// @Description Get a specific user by ID
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Success 200 {object} models.UserResponse
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 404 {object} handlers.ErrorResponse
// @Router /users/{id} [get]
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		h.respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	render.JSON(w, r, user.ToResponse())
}

// @Summary Update user
// @Description Update a user's information
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Param user body models.UpdateUserRequest true "User update data"
// @Success 200 {object} models.UserResponse
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 404 {object} handlers.ErrorResponse
// @Router /users/{id} [put]
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	idParam := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Check if user can update this profile
	currentUserID := r.Context().Value("userID").(uint)
	currentUserRole := r.Context().Value("userRole").(string)
	
	if currentUserID != uint(id) && currentUserRole != "admin" {
		h.respondWithError(w, http.StatusForbidden, "Cannot update other users")
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		h.respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	var req models.UpdateUserRequest
	if err := h.bindAndValidate(r, &req); err != nil {
		if _, ok := err.(validator.ValidationErrors); ok {
			h.respondWithValidationError(w, r, err)
			return
		}
		h.respondWithError(w, http.StatusBadRequest, "Invalid request format")
		return
	}

	// Update fields
	if req.FirstName != nil {
		user.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}
	if req.Phone != nil {
		user.Phone = *req.Phone
	}

	if err := h.db.Save(&user).Error; err != nil {
		log.Error().Err(err).Msg("Failed to update user")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to update user")
		return
	}

	log.Info().Uint("user_id", user.ID).Msg("User updated")
	render.JSON(w, r, user.ToResponse())
}

// @Summary Delete user
// @Description Delete a user (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Success 204
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 403 {object} handlers.ErrorResponse
// @Failure 404 {object} handlers.ErrorResponse
// @Router /users/{id} [delete]
func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Prevent self-deletion
	currentUserID := r.Context().Value("userID").(uint)
	if currentUserID == uint(id) {
		h.respondWithError(w, http.StatusBadRequest, "Cannot delete yourself")
		return
	}

	result := h.db.Delete(&models.User{}, id)
	if result.Error != nil {
		log.Error().Err(result.Error).Msg("Failed to delete user")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	if result.RowsAffected == 0 {
		h.respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	log.Info().Uint64("user_id", id).Msg("User deleted")
	w.WriteHeader(http.StatusNoContent)
}
`,

    'handlers/product.go': `package handlers

import (
	"net/http"
	"strconv"

	"{{projectName}}/models"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// @Summary List all products
// @Description Get a list of all products with pagination and filtering
// @Tags products
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param search query string false "Search in name and description"
// @Param category query string false "Filter by category"
// @Param brand query string false "Filter by brand"
// @Param min_price query number false "Minimum price"
// @Param max_price query number false "Maximum price"
// @Param in_stock query bool false "Only show in-stock items"
// @Param featured query bool false "Only show featured items"
// @Param sort_by query string false "Sort by field" Enums(name, price, created_at, stock)
// @Param sort_order query string false "Sort order" Enums(asc, desc)
// @Success 200 {object} handlers.PaginatedResponse
// @Router /products [get]
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	var req models.ProductListRequest
	
	// Parse query parameters
	req.Page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	if req.Page < 1 {
		req.Page = 1
	}
	
	req.Limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if req.Limit < 1 || req.Limit > 100 {
		req.Limit = 10
	}
	
	req.Search = r.URL.Query().Get("search")
	req.Category = r.URL.Query().Get("category")
	req.Brand = r.URL.Query().Get("brand")
	req.MinPrice, _ = strconv.ParseFloat(r.URL.Query().Get("min_price"), 64)
	req.MaxPrice, _ = strconv.ParseFloat(r.URL.Query().Get("max_price"), 64)
	req.InStock, _ = strconv.ParseBool(r.URL.Query().Get("in_stock"))
	req.Featured, _ = strconv.ParseBool(r.URL.Query().Get("featured"))
	req.SortBy = r.URL.Query().Get("sort_by")
	req.SortOrder = r.URL.Query().Get("sort_order")
	
	// Set defaults
	if req.SortBy == "" {
		req.SortBy = "created_at"
	}
	if req.SortOrder == "" {
		req.SortOrder = "desc"
	}

	// Validate request
	if err := h.validate.Struct(&req); err != nil {
		h.respondWithValidationError(w, r, err)
		return
	}

	// Build query
	query := h.db.Model(&models.Product{}).Where("active = ?", true)

	// Apply filters
	if req.Search != "" {
		search := "%" + req.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", search, search)
	}
	
	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}
	
	if req.Brand != "" {
		query = query.Where("brand = ?", req.Brand)
	}
	
	if req.MinPrice > 0 {
		query = query.Where("price >= ?", req.MinPrice)
	}
	
	if req.MaxPrice > 0 {
		query = query.Where("price <= ?", req.MaxPrice)
	}
	
	if req.InStock {
		query = query.Where("stock > 0")
	}
	
	if req.Featured {
		query = query.Where("featured = ?", true)
	}

	// Apply sorting
	orderClause := req.SortBy + " " + req.SortOrder
	query = query.Order(orderClause)

	// Execute pagination
	var products []models.Product
	response, err := h.paginate(query, req.Page, req.Limit, &products)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch products")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to fetch products")
		return
	}

	response.Data = products
	render.JSON(w, r, response)
}

// @Summary Get product by ID
// @Description Get a specific product by ID
// @Tags products
// @Accept json
// @Produce json
// @Param id path int true "Product ID"
// @Success 200 {object} models.Product
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 404 {object} handlers.ErrorResponse
// @Router /products/{id} [get]
func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			h.respondWithError(w, http.StatusNotFound, "Product not found")
			return
		}
		log.Error().Err(err).Msg("Failed to fetch product")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to fetch product")
		return
	}

	render.JSON(w, r, product)
}

// @Summary Create a new product
// @Description Create a new product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param product body models.CreateProductRequest true "Product data"
// @Success 201 {object} models.Product
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 409 {object} handlers.ErrorResponse
// @Router /products [post]
func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProductRequest
	if err := h.bindAndValidate(r, &req); err != nil {
		if _, ok := err.(validator.ValidationErrors); ok {
			h.respondWithValidationError(w, r, err)
			return
		}
		h.respondWithError(w, http.StatusBadRequest, "Invalid request format")
		return
	}

	// Check if SKU exists
	var existingProduct models.Product
	if err := h.db.Where("sku = ?", req.SKU).First(&existingProduct).Error; err == nil {
		h.respondWithError(w, http.StatusConflict, "Product with this SKU already exists")
		return
	}

	// Check if barcode exists
	if req.Barcode != "" {
		if err := h.db.Where("barcode = ?", req.Barcode).First(&existingProduct).Error; err == nil {
			h.respondWithError(w, http.StatusConflict, "Product with this barcode already exists")
			return
		}
	}

	product := models.Product{
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Cost:        req.Cost,
		Stock:       req.Stock,
		SKU:         req.SKU,
		Barcode:     req.Barcode,
		Category:    req.Category,
		Brand:       req.Brand,
		Weight:      req.Weight,
		Dimensions:  req.Dimensions,
		Active:      true}

	if err := h.db.Create(&product).Error; err != nil {
		log.Error().Err(err).Msg("Failed to create product")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to create product")
		return
	}

	log.Info().Uint("product_id", product.ID).Str("sku", product.SKU).Msg("Product created")
	
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, product)
}

// @Summary Update product
// @Description Update a product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "Product ID"
// @Param product body models.UpdateProductRequest true "Product update data"
// @Success 200 {object} models.Product
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 404 {object} handlers.ErrorResponse
// @Router /products/{id} [put]
func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			h.respondWithError(w, http.StatusNotFound, "Product not found")
			return
		}
		log.Error().Err(err).Msg("Failed to fetch product")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to fetch product")
		return
	}

	var req models.UpdateProductRequest
	if err := h.bindAndValidate(r, &req); err != nil {
		if _, ok := err.(validator.ValidationErrors); ok {
			h.respondWithValidationError(w, r, err)
			return
		}
		h.respondWithError(w, http.StatusBadRequest, "Invalid request format")
		return
	}

	// Update fields
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.Price != nil {
		product.Price = *req.Price
	}
	if req.Cost != nil {
		product.Cost = *req.Cost
	}
	if req.Stock != nil {
		product.Stock = *req.Stock
	}
	if req.Category != nil {
		product.Category = *req.Category
	}
	if req.Brand != nil {
		product.Brand = *req.Brand
	}
	if req.Weight != nil {
		product.Weight = *req.Weight
	}
	if req.Dimensions != nil {
		product.Dimensions = *req.Dimensions
	}
	if req.Active != nil {
		product.Active = *req.Active
	}
	if req.Featured != nil {
		product.Featured = *req.Featured
	}

	if err := h.db.Save(&product).Error; err != nil {
		log.Error().Err(err).Msg("Failed to update product")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to update product")
		return
	}

	log.Info().Uint("product_id", product.ID).Msg("Product updated")
	render.JSON(w, r, product)
}

// @Summary Delete product
// @Description Delete a product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "Product ID"
// @Success 204
// @Failure 400 {object} handlers.ErrorResponse
// @Failure 401 {object} handlers.ErrorResponse
// @Failure 404 {object} handlers.ErrorResponse
// @Router /products/{id} [delete]
func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		h.respondWithError(w, http.StatusBadRequest, "Invalid product ID")
		return
	}

	result := h.db.Delete(&models.Product{}, id)
	if result.Error != nil {
		log.Error().Err(result.Error).Msg("Failed to delete product")
		h.respondWithError(w, http.StatusInternalServerError, "Failed to delete product")
		return
	}

	if result.RowsAffected == 0 {
		h.respondWithError(w, http.StatusNotFound, "Product not found")
		return
	}

	log.Info().Uint64("product_id", id).Msg("Product deleted")
	w.WriteHeader(http.StatusNoContent)
}
`,

    // Routes
    'routes/routes.go': `package routes

import (
	"{{projectName}}/config"
	"{{projectName}}/handlers"
	"{{projectName}}/middleware"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, h *handlers.Handler, cfg *config.Config) {
	// Public routes
	r.Group(func(r chi.Router) {
		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Register)
			r.Post("/login", h.Login)
		})

		// Public product routes
		r.Route("/products", func(r chi.Router) {
			r.Get("/", h.ListProducts)
			r.Get("/{id}", h.GetProduct)
		})
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWT(cfg))

		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Get("/me", h.GetCurrentUser)
			r.Post("/change-password", h.ChangePassword)
		})

		// User routes
		r.Route("/users", func(r chi.Router) {
			r.With(middleware.RequireRole("admin")).Get("/", h.ListUsers)
			r.Get("/{id}", h.GetUser)
			r.Put("/{id}", h.UpdateUser)
			r.With(middleware.RequireRole("admin")).Delete("/{id}", h.DeleteUser)
		})

		// Product management routes
		r.Route("/products", func(r chi.Router) {
			r.With(middleware.RequireRole("admin", "manager")).Post("/", h.CreateProduct)
			r.With(middleware.RequireRole("admin", "manager")).Put("/{id}", h.UpdateProduct)
			r.With(middleware.RequireRole("admin")).Delete("/{id}", h.DeleteProduct)
		})

		// Order routes
		r.Route("/orders", func(r chi.Router) {
			r.Get("/", h.ListOrders)
			r.Post("/", h.CreateOrder)
			r.Get("/{id}", h.GetOrder)
			r.With(middleware.RequireRole("admin", "manager")).Put("/{id}/status", h.UpdateOrderStatus)
		})
	})
}
`,

    // Middleware
    'middleware/auth.go': `package middleware

import (
	"context"
	"net/http"
	"strings"

	"{{projectName}}/config"
	"{{projectName}}/utils"

	"github.com/go-chi/render"
)

func JWT(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "Authorization header required"})
				return
			}

			bearerToken := strings.Split(authHeader, " ")
			if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "Invalid authorization header format"})
				return
			}

			token := bearerToken[1]
			claims, err := utils.ValidateJWT(token, cfg.JWTSecret)
			if err != nil {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]string{"error": "Invalid or expired token"})
				return
			}

			// Add user info to context
			ctx := context.WithValue(r.Context(), "userID", claims.UserID)
			ctx = context.WithValue(ctx, "userEmail", claims.Email)
			ctx = context.WithValue(ctx, "userRole", claims.Role)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value("userRole").(string)
			if !ok {
				render.Status(r, http.StatusForbidden)
				render.JSON(w, r, map[string]string{"error": "Access denied"})
				return
			}

			// Check if user has required role
			for _, role := range roles {
				if userRole == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			render.Status(r, http.StatusForbidden)
			render.JSON(w, r, map[string]string{"error": "Insufficient permissions"})
		})
	}
}
`,

    'middleware/rate_limiter.go': `package middleware

import (
	"net/http"
	"time"

	"{{projectName}}/config"

	"github.com/go-chi/httprate"
)

func RateLimiter(cfg *config.Config) func(http.Handler) http.Handler {
	// Create rate limiter
	return httprate.Limit(
		cfg.RateLimitRequests,
		cfg.RateLimitDuration,
		httprate.WithKeyFuncs(httprate.KeyByIP, httprate.KeyByEndpoint),
		httprate.WithLimitHandler(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(\`{"error":"Rate limit exceeded"}\`))
		}),
	)
}
`,

    // Utils
    'utils/jwt.go': `package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

type JWTClaims struct {
	UserID uint   \`json:"user_id"\`
	Email  string \`json:"email"\`
	Role   string \`json:"role"\`
	jwt.RegisteredClaims
}

func GenerateJWT(userID uint, email, role, secret string, expirationHours int) (string, error) {
	// Create token
	token := jwt.New()
	
	// Set claims
	if err := token.Set(jwt.SubjectKey, email); err != nil {
		return "", err
	}
	if err := token.Set("user_id", userID); err != nil {
		return "", err
	}
	if err := token.Set("email", email); err != nil {
		return "", err
	}
	if err := token.Set("role", role); err != nil {
		return "", err
	}
	if err := token.Set(jwt.IssuedAtKey, time.Now().Unix()); err != nil {
		return "", err
	}
	if err := token.Set(jwt.ExpirationKey, time.Now().Add(time.Hour*time.Duration(expirationHours)).Unix()); err != nil {
		return "", err
	}

	// Sign token
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.HS256, []byte(secret)))
	if err != nil {
		return "", err
	}

	return string(signed), nil
}

func ValidateJWT(tokenString, secret string) (*JWTClaims, error) {
	// Parse and verify token
	token, err := jwt.Parse([]byte(tokenString), jwt.WithKey(jwa.HS256, []byte(secret)))
	if err != nil {
		return nil, err
	}

	// Extract claims
	userID, ok := token.Get("user_id")
	if !ok {
		return nil, errors.New("user_id claim not found")
	}

	email, ok := token.Get("email")
	if !ok {
		return nil, errors.New("email claim not found")
	}

	role, ok := token.Get("role")
	if !ok {
		return nil, errors.New("role claim not found")
	}

	// Convert userID to uint
	var uid uint
	switch v := userID.(type) {
	case float64:
		uid = uint(v)
	case int64:
		uid = uint(v)
	default:
		return nil, errors.New("invalid user_id type")
	}

	return &JWTClaims{
		UserID: uid,
		Email:  email.(string),
		Role:   role.(string)}, nil
}
`,

    'utils/order.go': `package utils

import (
	"crypto/rand"
	"fmt"
	"time"
)

// GenerateOrderNumber creates a unique order number
func GenerateOrderNumber() string {
	// Format: ORD-YYYYMMDD-XXXXXX
	date := time.Now().Format("20060102")
	
	// Generate random suffix
	b := make([]byte, 3)
	rand.Read(b)
	suffix := fmt.Sprintf("%X", b)
	
	return fmt.Sprintf("ORD-%s-%s", date, suffix)
}

// CalculateTax calculates tax based on subtotal
func CalculateTax(subtotal float64, taxRate float64) float64 {
	return subtotal * taxRate
}

// CalculateShipping calculates shipping cost based on weight and destination
func CalculateShipping(weight float64, destination string) float64 {
	// Simple shipping calculation
	baseRate := 5.0
	weightRate := weight * 0.5
	
	// Add zone surcharge
	zoneSurcharge := 0.0
	switch destination {
	case "international":
		zoneSurcharge = 15.0
	case "remote":
		zoneSurcharge = 10.0
	}
	
	return baseRate + weightRate + zoneSurcharge
}
`,

    // Environment file
    '.env.example': `# Environment
ENVIRONMENT=development

# Server
PORT=8080

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME={{projectName}}
DB_SSLMODE=disable

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRATION_HOURS=24

# Redis
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_DURATION_MINUTES=1

# CORS
ALLOWED_ORIGINS=*

# Logging
LOG_LEVEL=info
LOG_JSON=false
`,

    // Docker files
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Generate swagger docs
RUN go install github.com/swaggo/swag/cmd/swag@latest
RUN swag init

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM alpine:latest

# Install runtime dependencies and curl for health checks
RUN apk --no-cache add ca-certificates tzdata curl

# Create non-root user
RUN addgroup -g 1000 -S appgroup && \\
    adduser -u 1000 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder --chown=appuser:appgroup /app/main .
COPY --from=builder --chown=appuser:appgroup /app/docs ./docs

# Copy .env file if needed
COPY --from=builder --chown=appuser:appgroup /app/.env.example .env

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:8080/health || exit 1

# Run the application
CMD ["./main"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENVIRONMENT=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=password
      - DB_NAME={{projectName}}
      - REDIS_ADDR=redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
    command: air

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
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
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
`,

    // Makefile
    'Makefile': `# Variables
APP_NAME={{projectName}}
MAIN_FILE=main.go
DOCKER_IMAGE={{projectName}}:latest
POSTGRES_CONTAINER={{projectName}}_postgres
REDIS_CONTAINER={{projectName}}_redis

# Go commands
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Build the application
build:
	$(GOBUILD) -o $(APP_NAME) -v $(MAIN_FILE)

# Build for production (optimized)
build-prod:
	CGO_ENABLED=0 GOOS=linux $(GOBUILD) -a -installsuffix cgo -ldflags="-s -w" -o $(APP_NAME) $(MAIN_FILE)

# Run the application
run:
	$(GOCMD) run $(MAIN_FILE)

# Run with hot reload
dev:
	air

# Test the application
test:
	$(GOTEST) -v ./...

# Test with coverage
test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Benchmark tests
bench:
	$(GOTEST) -bench=. -benchmem ./...

# Clean build artifacts
clean:
	$(GOCLEAN)
	rm -f $(APP_NAME)
	rm -f coverage.out coverage.html

# Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Update dependencies
deps-update:
	$(GOGET) -u ./...
	$(GOMOD) tidy

# Verify dependencies
deps-verify:
	$(GOMOD) verify

# Generate swagger documentation
swagger:
	swag init --parseDependency --parseInternal

# Format code
fmt:
	$(GOCMD) fmt ./...
	gofumpt -w .

# Lint code
lint:
	golangci-lint run --timeout=5m

# Security scan
security:
	gosec -fmt=json -out=security.json ./...
	@echo "Security scan complete. Check security.json for results."

# Vulnerability check
vuln-check:
	govulncheck ./...

# Docker build
docker-build:
	docker build -t $(DOCKER_IMAGE) .

# Docker run
docker-run:
	docker-compose up

# Docker stop
docker-stop:
	docker-compose down

# Database migrations
migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir db/migrations -seq $$name

migrate-up:
	migrate -database "postgres://postgres:password@localhost:5432/$(APP_NAME)?sslmode=disable" -path db/migrations up

migrate-down:
	migrate -database "postgres://postgres:password@localhost:5432/$(APP_NAME)?sslmode=disable" -path db/migrations down

migrate-force:
	@read -p "Enter version to force: " version; \
	migrate -database "postgres://postgres:password@localhost:5432/$(APP_NAME)?sslmode=disable" -path db/migrations force $$version

# Install development tools
install-tools:
	go install github.com/cosmtrek/air@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/securego/gosec/v2/cmd/gosec@latest
	go install mvdan.cc/gofumpt@latest
	go install golang.org/x/vuln/cmd/govulncheck@latest
	go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Run all quality checks
check: fmt lint test security vuln-check

.PHONY: build build-prod run dev test test-coverage bench clean deps deps-update deps-verify swagger fmt lint security vuln-check docker-build docker-run docker-stop migrate-create migrate-up migrate-down migrate-force install-tools check
`,

    // README
    'README.md': `# {{projectName}}

A high-performance REST API built with Chi router in Go.

## Features

- **Chi Router**: Lightweight, idiomatic and composable router
- **JWT Authentication**: Secure token-based authentication
- **GORM ORM**: Database abstraction with auto-migrations
- **Swagger Documentation**: Auto-generated API documentation
- **Request Validation**: Input validation with custom validators
- **Structured Logging**: JSON logs with zerolog
- **Rate Limiting**: Request throttling with configurable limits
- **CORS Support**: Configurable cross-origin requests
- **Middleware**: Composable middleware stack
- **Hot Reload**: Development with Air
- **Docker Support**: Containerized deployment
- **Testing**: Unit and integration tests
- **Security**: Built-in security headers and practices

## Requirements

- Go 1.21+
- PostgreSQL (or MySQL/SQLite)
- Redis (optional, for distributed rate limiting)
- Docker (optional)

## Quick Start

1. Clone the repository
2. Copy \`.env.example\` to \`.env\` and configure
3. Install dependencies:
   \`\`\`bash
   make deps
   \`\`\`

4. Run with hot reload:
   \`\`\`bash
   make dev
   \`\`\`

5. Or run with Docker:
   \`\`\`bash
   make docker-run
   \`\`\`

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8080/swagger/index.html

## Development

### Install tools
\`\`\`bash
make install-tools
\`\`\`

### Run tests
\`\`\`bash
make test
\`\`\`

### Run all quality checks
\`\`\`bash
make check
\`\`\`

### Test coverage
\`\`\`bash
make test-coverage
\`\`\`

### Generate Swagger docs
\`\`\`bash
make swagger
\`\`\`

### Format code
\`\`\`bash
make fmt
\`\`\`

### Lint code
\`\`\`bash
make lint
\`\`\`

### Security scan
\`\`\`bash
make security
\`\`\`

### Vulnerability check
\`\`\`bash
make vuln-check
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`GET /api/v1/auth/me\` - Get current user
- \`POST /api/v1/auth/change-password\` - Change password

### Users
- \`GET /api/v1/users\` - List users (admin)
- \`GET /api/v1/users/:id\` - Get user
- \`PUT /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user (admin)

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product
- \`POST /api/v1/products\` - Create product (admin/manager)
- \`PUT /api/v1/products/:id\` - Update product (admin/manager)
- \`DELETE /api/v1/products/:id\` - Delete product (admin)

### Orders
- \`GET /api/v1/orders\` - List orders
- \`POST /api/v1/orders\` - Create order
- \`GET /api/v1/orders/:id\` - Get order
- \`PUT /api/v1/orders/:id/status\` - Update order status (admin/manager)

## Project Structure

\`\`\`
.
├── config/         # Configuration
├── database/       # Database connection and migrations
├── docs/          # Swagger documentation
├── handlers/      # HTTP handlers
├── middleware/    # HTTP middleware
├── models/        # Data models
├── routes/        # Route definitions
├── utils/         # Utility functions
├── main.go        # Application entry point
├── Dockerfile     # Docker configuration
├── docker-compose.yml
├── Makefile       # Build automation
└── README.md
\`\`\`

## Chi Router Features

Chi provides:
- **Lightweight**: Small, fast router with zero dependencies
- **Composable**: Build complex routing patterns with ease
- **Middleware**: Rich middleware ecosystem
- **Compatible**: 100% compatible with net/http
- **Contextual**: Built on Go's context package
`
  }
};