import { BackendTemplate } from '../types';

export const fiberTemplate: BackendTemplate = {
  id: 'fiber',
  name: 'fiber',
  displayName: 'Fiber Framework',
  description: 'Express-inspired web framework written in Go with zero memory allocation and performance',
  language: 'go',
  framework: 'fiber',
  version: '2.52.0',
  tags: ['go', 'fiber', 'api', 'rest', 'express-like', 'performance', 'zero-allocation'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets', 'session-management'],
  
  files: {
    // Go module configuration
    'go.mod': `module {{projectName}}

go 1.21

require (
	github.com/gofiber/fiber/v2 v2.52.0
	github.com/gofiber/jwt/v4 v4.0.0
	github.com/gofiber/swagger v1.0.0
	github.com/gofiber/websocket/v2 v2.2.1
	github.com/gofiber/contrib/fiberzap/v2 v2.0.0
	github.com/gofiber/storage/redis/v3 v3.1.0
	github.com/joho/godotenv v1.5.1
	github.com/go-playground/validator/v10 v10.16.0
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/swaggo/swag v1.16.2
	go.uber.org/zap v1.26.0
	github.com/redis/go-redis/v9 v9.3.1
	gorm.io/gorm v1.25.5
	gorm.io/driver/postgres v1.5.4
	gorm.io/driver/mysql v1.5.2
	gorm.io/driver/sqlite v1.5.4
	golang.org/x/crypto v0.17.0
	github.com/google/uuid v1.5.0
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/PuerkitoBio/purell v1.2.1 // indirect
	github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578 // indirect
	github.com/andybalholm/brotli v1.1.0 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/fasthttp/websocket v1.5.7 // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/go-openapi/jsonpointer v0.20.2 // indirect
	github.com/go-openapi/jsonreference v0.20.4 // indirect
	github.com/go-openapi/spec v0.20.13 // indirect
	github.com/go-openapi/swag v0.22.7 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20231201235250-de7065d80cb9 // indirect
	github.com/jackc/pgx/v5 v5.5.1 // indirect
	github.com/jackc/puddle/v2 v2.2.1 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/klauspost/compress v1.17.4 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.15 // indirect
	github.com/mattn/go-sqlite3 v1.14.19 // indirect
	github.com/philhofer/fwd v1.1.2 // indirect
	github.com/rivo/uniseg v0.4.4 // indirect
	github.com/savsgio/dictpool v0.0.0-20221023140959-7bf2e61cea94 // indirect
	github.com/savsgio/gotils v0.0.0-20230208104028-c358bd845dee // indirect
	github.com/swaggo/files/v2 v2.0.0 // indirect
	github.com/tinylib/msgp v1.1.9 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasthttp v1.51.0 // indirect
	github.com/valyala/tcplisten v1.0.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
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
	"fmt"
	"log"
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

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/swagger"
	"github.com/gofiber/contrib/fiberzap/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

// @title           {{projectName}} API
// @version         1.0
// @description     API server for {{projectName}} built with Fiber framework
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:3000
// @BasePath  /api/v1

// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize configuration
	cfg := config.New()

	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	if cfg.Environment == "development" {
		logger, _ = zap.NewDevelopment()
	}
	defer logger.Sync()

	// Initialize database
	db, err := database.Initialize(cfg)
	if err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}

	// Run migrations
	if err := database.Migrate(db); err != nil {
		logger.Fatal("Failed to run migrations", zap.Error(err))
	}

	// Create Fiber app with configuration
	app := fiber.New(fiber.Config{
		AppName:               "{{projectName}}",
		ServerHeader:          "Fiber",
		DisableStartupMessage: false,
		Prefork:               cfg.Prefork,
		StrictRouting:         true,
		CaseSensitive:         true,
		BodyLimit:             4 * 1024 * 1024, // 4MB
		ReadTimeout:           10 * time.Second,
		WriteTimeout:          10 * time.Second,
		IdleTimeout:           120 * time.Second,
		ErrorHandler:          middleware.CustomErrorHandler})

	// Global middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(fiberzap.New(fiberzap.Config{
		Logger: logger,
		Fields: []string{"requestId", "latency", "status", "method", "url", "ip"}}))
	app.Use(helmet.New())
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID",
		ExposeHeaders:    "X-Request-ID",
		AllowCredentials: true,
		MaxAge:           86400}))
	app.Use(middleware.RateLimiter(cfg))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "healthy",
			"time":   time.Now().UTC()})
	})

	// Swagger documentation
	app.Get("/swagger/*", swagger.New())

	// WebSocket upgrade middleware
	app.Use("/api/v1/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// Initialize handlers
	h := handlers.NewHandler(db, cfg, logger)

	// API routes
	api := app.Group("/api/v1")
	routes.SetupRoutes(api, h, cfg)

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		logger.Info("Shutting down server...")
		if err := app.Shutdown(); err != nil {
			logger.Error("Server shutdown error", zap.Error(err))
		}
	}()

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("Starting server", zap.String("address", addr))
	
	if err := app.Listen(addr); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
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
	Prefork     bool
	
	// Database
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	
	// JWT
	JWTSecret             string
	JWTAccessExpiration   time.Duration
	JWTRefreshExpiration  time.Duration
	
	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	
	// Rate limiting
	RateLimitRequests int
	RateLimitDuration time.Duration
	
	// CORS
	AllowedOrigins string
	
	// Session
	SessionSecret     string
	SessionExpiration time.Duration
}

func New() *Config {
	return &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		Port:        getEnvAsInt("PORT", 3000),
		Prefork:     getEnvAsBool("PREFORK", false),
		
		// Database
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnvAsInt("DB_PORT", 5432),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "password"),
		DBName:     getEnv("DB_NAME", "{{projectName}}"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		
		// JWT
		JWTSecret:            getEnv("JWT_SECRET", "your-secret-key-change-this"),
		JWTAccessExpiration:  time.Duration(getEnvAsInt("JWT_ACCESS_EXPIRATION_MINUTES", 15)) * time.Minute,
		JWTRefreshExpiration: time.Duration(getEnvAsInt("JWT_REFRESH_EXPIRATION_DAYS", 7)) * 24 * time.Hour,
		
		// Redis
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),
		
		// Rate limiting
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitDuration: time.Duration(getEnvAsInt("RATE_LIMIT_DURATION_MINUTES", 1)) * time.Minute,
		
		// CORS
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "*"),
		
		// Session
		SessionSecret:     getEnv("SESSION_SECRET", "session-secret-change-this"),
		SessionExpiration: time.Duration(getEnvAsInt("SESSION_EXPIRATION_HOURS", 24)) * time.Hour}
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

	"{{projectName}}/config"
	"{{projectName}}/models"

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
		PrepareStmt: true,
		QueryFields: true}
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

	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Product{},
		&models.RefreshToken{},
		&models.Session{},
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
	
	Email    string \`gorm:"uniqueIndex;not null" json:"email" validate:"required,email"\`
	Password string \`gorm:"not null" json:"-"\`
	Name     string \`gorm:"not null" json:"name" validate:"required,min=2,max=100"\`
	Avatar   string \`json:"avatar,omitempty"\`
	Bio      string \`json:"bio,omitempty" validate:"max=500"\`
	Role     string \`gorm:"default:user" json:"role" validate:"omitempty,oneof=user admin moderator"\`
	Active   bool   \`gorm:"default:true" json:"active"\`
	Verified bool   \`gorm:"default:false" json:"verified"\`
	
	RefreshTokens []RefreshToken \`gorm:"foreignKey:UserID" json:"-"\`
	Sessions      []Session      \`gorm:"foreignKey:UserID" json:"-"\`
}

type RefreshToken struct {
	ID        uint      \`gorm:"primarykey" json:"id"\`
	Token     string    \`gorm:"uniqueIndex;not null" json:"token"\`
	UserID    uint      \`gorm:"not null" json:"user_id"\`
	ExpiresAt time.Time \`gorm:"not null" json:"expires_at"\`
	CreatedAt time.Time \`json:"created_at"\`
}

type Session struct {
	ID        string    \`gorm:"primarykey" json:"id"\`
	UserID    uint      \`gorm:"not null;index" json:"user_id"\`
	Data      string    \`json:"data"\`
	ExpiresAt time.Time \`gorm:"not null;index" json:"expires_at"\`
	CreatedAt time.Time \`json:"created_at"\`
	UpdatedAt time.Time \`json:"updated_at"\`
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

type LoginRequest struct {
	Email    string \`json:"email" validate:"required,email"\`
	Password string \`json:"password" validate:"required,min=6"\`
}

type RegisterRequest struct {
	Email    string \`json:"email" validate:"required,email"\`
	Password string \`json:"password" validate:"required,min=6,max=72"\`
	Name     string \`json:"name" validate:"required,min=2,max=100"\`
}

type UpdateProfileRequest struct {
	Name   *string \`json:"name,omitempty" validate:"omitempty,min=2,max=100"\`
	Avatar *string \`json:"avatar,omitempty" validate:"omitempty,url"\`
	Bio    *string \`json:"bio,omitempty" validate:"omitempty,max=500"\`
}

type ChangePasswordRequest struct {
	CurrentPassword string \`json:"current_password" validate:"required"\`
	NewPassword     string \`json:"new_password" validate:"required,min=6,max=72"\`
}

type RefreshTokenRequest struct {
	RefreshToken string \`json:"refresh_token" validate:"required"\`
}

type TokenResponse struct {
	AccessToken  string \`json:"access_token"\`
	RefreshToken string \`json:"refresh_token"\`
	TokenType    string \`json:"token_type"\`
	ExpiresIn    int    \`json:"expires_in"\`
}

type UserResponse struct {
	ID        uint      \`json:"id"\`
	Email     string    \`json:"email"\`
	Name      string    \`json:"name"\`
	Avatar    string    \`json:"avatar,omitempty"\`
	Bio       string    \`json:"bio,omitempty"\`
	Role      string    \`json:"role"\`
	Active    bool      \`json:"active"\`
	Verified  bool      \`json:"verified"\`
	CreatedAt time.Time \`json:"created_at"\`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Avatar:    u.Avatar,
		Bio:       u.Bio,
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
	
	Name        string   \`gorm:"not null;index" json:"name" validate:"required,min=1,max=200"\`
	Description string   \`json:"description" validate:"max=1000"\`
	Price       float64  \`gorm:"not null" json:"price" validate:"required,min=0"\`
	Stock       int      \`gorm:"default:0" json:"stock" validate:"min=0"\`
	SKU         string   \`gorm:"uniqueIndex" json:"sku" validate:"required,min=3,max=50"\`
	Category    string   \`gorm:"index" json:"category" validate:"required,min=1,max=100"\`
	Tags        []string \`gorm:"type:text[]" json:"tags"\`
	Images      []string \`gorm:"type:text[]" json:"images"\`
	Active      bool     \`gorm:"default:true;index" json:"active"\`
	Featured    bool     \`gorm:"default:false;index" json:"featured"\`
}

type CreateProductRequest struct {
	Name        string   \`json:"name" validate:"required,min=1,max=200"\`
	Description string   \`json:"description" validate:"max=1000"\`
	Price       float64  \`json:"price" validate:"required,min=0"\`
	Stock       int      \`json:"stock" validate:"min=0"\`
	SKU         string   \`json:"sku" validate:"required,min=3,max=50"\`
	Category    string   \`json:"category" validate:"required,min=1,max=100"\`
	Tags        []string \`json:"tags" validate:"max=10,dive,min=1,max=50"\`
	Images      []string \`json:"images" validate:"max=10,dive,url"\`
}

type UpdateProductRequest struct {
	Name        *string   \`json:"name,omitempty" validate:"omitempty,min=1,max=200"\`
	Description *string   \`json:"description,omitempty" validate:"omitempty,max=1000"\`
	Price       *float64  \`json:"price,omitempty" validate:"omitempty,min=0"\`
	Stock       *int      \`json:"stock,omitempty" validate:"omitempty,min=0"\`
	Category    *string   \`json:"category,omitempty" validate:"omitempty,min=1,max=100"\`
	Tags        *[]string \`json:"tags,omitempty" validate:"omitempty,max=10,dive,min=1,max=50"\`
	Images      *[]string \`json:"images,omitempty" validate:"omitempty,max=10,dive,url"\`
	Active      *bool     \`json:"active,omitempty"\`
	Featured    *bool     \`json:"featured,omitempty"\`
}

type ProductListRequest struct {
	Page     int      \`query:"page" validate:"min=1"\`
	Limit    int      \`query:"limit" validate:"min=1,max=100"\`
	Category string   \`query:"category" validate:"omitempty,min=1,max=100"\`
	Tags     []string \`query:"tags" validate:"omitempty,max=5,dive,min=1,max=50"\`
	Search   string   \`query:"search" validate:"omitempty,min=1,max=100"\`
	MinPrice float64  \`query:"min_price" validate:"omitempty,min=0"\`
	MaxPrice float64  \`query:"max_price" validate:"omitempty,min=0,gtefield=MinPrice"\`
	Featured bool     \`query:"featured"\`
	SortBy   string   \`query:"sort_by" validate:"omitempty,oneof=name price created_at stock"\`
	Order    string   \`query:"order" validate:"omitempty,oneof=asc desc"\`
}

type PaginatedResponse struct {
	Data       interface{} \`json:"data"\`
	Total      int64       \`json:"total"\`
	Page       int         \`json:"page"\`
	Limit      int         \`json:"limit"\`
	TotalPages int         \`json:"total_pages"\`
	HasNext    bool        \`json:"has_next"\`
	HasPrev    bool        \`json:"has_prev"\`
}
`,

    // Handlers
    'handlers/handler.go': `package handlers

import (
	"{{projectName}}/config"

	"github.com/go-playground/validator/v10"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Handler struct {
	db       *gorm.DB
	cfg      *config.Config
	logger   *zap.Logger
	validate *validator.Validate
}

func NewHandler(db *gorm.DB, cfg *config.Config, logger *zap.Logger) *Handler {
	v := validator.New()
	
	// Register custom validators
	v.RegisterValidation("password", validatePassword)
	
	return &Handler{
		db:       db,
		cfg:      cfg,
		logger:   logger,
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

// Validation error response
type ValidationErrorResponse struct {
	Error  string            \`json:"error"\`
	Fields []ValidationError \`json:"fields,omitempty"\`
}

type ValidationError struct {
	Field   string \`json:"field"\`
	Message string \`json:"message"\`
}

func (h *Handler) formatValidationErrors(err error) ValidationErrorResponse {
	var errors []ValidationError
	
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			errors = append(errors, ValidationError{
				Field:   e.Field(),
				Message: h.getErrorMessage(e)})
		}
	}
	
	return ValidationErrorResponse{
		Error:  "Validation failed",
		Fields: errors}
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
	case "url":
		return "Invalid URL format"
	case "password":
		return "Password must contain uppercase, lowercase, and digit"
	case "gtefield":
		return fmt.Sprintf("Must be greater than or equal to %s", e.Param())
	default:
		return "Invalid value"
	}
}

// Common error responses
func (h *Handler) unauthorizedError() fiber.Map {
	return fiber.Map{
		"error": "Unauthorized"}
}

func (h *Handler) forbiddenError() fiber.Map {
	return fiber.Map{
		"error": "Forbidden"}
}

func (h *Handler) notFoundError(resource string) fiber.Map {
	return fiber.Map{
		"error": fmt.Sprintf("%s not found", resource)}
}

func (h *Handler) internalError() fiber.Map {
	return fiber.Map{
		"error": "Internal server error"}
}
`,

    'handlers/auth.go': `package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"time"

	"{{projectName}}/models"
	"{{projectName}}/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// @Summary Register a new user
// @Description Create a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param user body models.RegisterRequest true "User registration data"
// @Success 201 {object} models.UserResponse
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 409 {object} map[string]string
// @Router /auth/register [post]
func (h *Handler) Register(c *fiber.Ctx) error {
	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Check if user exists
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Email already registered"})
	}

	// Create new user
	user := models.User{
		Email: req.Email,
		Name:  req.Name}

	if err := user.SetPassword(req.Password); err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	if err := h.db.Create(&user).Error; err != nil {
		h.logger.Error("Failed to create user", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	h.logger.Info("User registered", zap.Uint("user_id", user.ID), zap.String("email", user.Email))
	return c.Status(fiber.StatusCreated).JSON(user.ToResponse())
}

// @Summary Login user
// @Description Authenticate user and return JWT tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body models.LoginRequest true "Login credentials"
// @Success 200 {object} models.TokenResponse
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 401 {object} map[string]string
// @Router /auth/login [post]
func (h *Handler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Find user
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials"})
	}

	// Check password
	if !user.CheckPassword(req.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials"})
	}

	// Check if user is active
	if !user.Active {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Account is disabled"})
	}

	// Generate tokens
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTAccessExpiration)
	if err != nil {
		h.logger.Error("Failed to generate access token", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	refreshToken, err := h.generateRefreshToken()
	if err != nil {
		h.logger.Error("Failed to generate refresh token", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	// Save refresh token
	refreshTokenModel := models.RefreshToken{
		Token:     refreshToken,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(h.cfg.JWTRefreshExpiration)}

	if err := h.db.Create(&refreshTokenModel).Error; err != nil {
		h.logger.Error("Failed to save refresh token", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	// Create session
	session := models.Session{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(h.cfg.SessionExpiration)}

	if err := h.db.Create(&session).Error; err != nil {
		h.logger.Error("Failed to create session", zap.Error(err))
	}

	// Set session cookie
	c.Cookie(&fiber.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Expires:  session.ExpiresAt,
		HTTPOnly: true,
		Secure:   h.cfg.Environment == "production",
		SameSite: "Lax"})

	h.logger.Info("User logged in", zap.Uint("user_id", user.ID), zap.String("email", user.Email))

	return c.JSON(models.TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWTAccessExpiration.Seconds())})
}

// @Summary Refresh access token
// @Description Get a new access token using refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body models.RefreshTokenRequest true "Refresh token"
// @Success 200 {object} models.TokenResponse
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 401 {object} map[string]string
// @Router /auth/refresh [post]
func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var req models.RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Find refresh token
	var refreshToken models.RefreshToken
	if err := h.db.Where("token = ?", req.RefreshToken).First(&refreshToken).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid refresh token"})
	}

	// Check if expired
	if time.Now().After(refreshToken.ExpiresAt) {
		h.db.Delete(&refreshToken)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Refresh token expired"})
	}

	// Get user
	var user models.User
	if err := h.db.First(&user, refreshToken.UserID).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not found"})
	}

	// Generate new access token
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTAccessExpiration)
	if err != nil {
		h.logger.Error("Failed to generate access token", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	return c.JSON(models.TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: req.RefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWTAccessExpiration.Seconds())})
}

// @Summary Logout user
// @Description Logout user and invalidate tokens
// @Tags auth
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} map[string]string
// @Router /auth/logout [post]
func (h *Handler) Logout(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	// Delete all refresh tokens
	h.db.Where("user_id = ?", userID).Delete(&models.RefreshToken{})

	// Delete session
	sessionID := c.Cookies("session_id")
	if sessionID != "" {
		h.db.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&models.Session{})
	}

	// Clear session cookie
	c.Cookie(&fiber.Cookie{
		Name:     "session_id",
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   h.cfg.Environment == "production",
		SameSite: "Lax"})

	h.logger.Info("User logged out", zap.Uint("user_id", userID))

	return c.JSON(fiber.Map{
		"message": "Successfully logged out"})
}

func (h *Handler) generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
`,

    'handlers/user.go': `package handlers

import (
	"strconv"

	"{{projectName}}/models"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// @Summary List all users
// @Description Get a list of all users (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} models.PaginatedResponse
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /users [get]
func (h *Handler) ListUsers(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	offset := (page - 1) * limit

	var users []models.User
	var total int64

	h.db.Model(&models.User{}).Count(&total)
	if err := h.db.Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		h.logger.Error("Failed to fetch users", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	response := make([]models.UserResponse, len(users))
	for i, user := range users {
		response[i] = user.ToResponse()
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return c.JSON(models.PaginatedResponse{
		Data:       response,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
		HasPrev:    page > 1})
}

// @Summary Get user by ID
// @Description Get a specific user by ID
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Success 200 {object} models.UserResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /users/{id} [get]
func (h *Handler) GetUser(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID"})
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("User"))
	}

	return c.JSON(user.ToResponse())
}

// @Summary Get current user
// @Description Get the currently authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} models.UserResponse
// @Failure 401 {object} map[string]string
// @Router /users/me [get]
func (h *Handler) GetCurrentUser(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("User"))
	}

	return c.JSON(user.ToResponse())
}

// @Summary Update current user profile
// @Description Update the currently authenticated user's profile
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param user body models.UpdateProfileRequest true "Profile update data"
// @Success 200 {object} models.UserResponse
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 401 {object} map[string]string
// @Router /users/me [put]
func (h *Handler) UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("User"))
	}

	var req models.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Update fields
	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.Avatar != nil {
		user.Avatar = *req.Avatar
	}
	if req.Bio != nil {
		user.Bio = *req.Bio
	}

	if err := h.db.Save(&user).Error; err != nil {
		h.logger.Error("Failed to update user", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	h.logger.Info("User profile updated", zap.Uint("user_id", user.ID))
	return c.JSON(user.ToResponse())
}

// @Summary Change password
// @Description Change the currently authenticated user's password
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body models.ChangePasswordRequest true "Password change data"
// @Success 200 {object} map[string]string
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 401 {object} map[string]string
// @Router /users/me/password [put]
func (h *Handler) ChangePassword(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("User"))
	}

	var req models.ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Check current password
	if !user.CheckPassword(req.CurrentPassword) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Current password is incorrect"})
	}

	// Set new password
	if err := user.SetPassword(req.NewPassword); err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	if err := h.db.Save(&user).Error; err != nil {
		h.logger.Error("Failed to update password", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	// Invalidate all refresh tokens
	h.db.Where("user_id = ?", userID).Delete(&models.RefreshToken{})

	h.logger.Info("User password changed", zap.Uint("user_id", user.ID))
	return c.JSON(fiber.Map{
		"message": "Password changed successfully"})
}

// @Summary Delete user
// @Description Delete a user (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /users/{id} [delete]
func (h *Handler) DeleteUser(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID"})
	}

	result := h.db.Delete(&models.User{}, id)
	if result.Error != nil {
		h.logger.Error("Failed to delete user", zap.Error(result.Error))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("User"))
	}

	h.logger.Info("User deleted", zap.Uint64("user_id", id))
	return c.SendStatus(fiber.StatusNoContent)
}
`,

    'handlers/product.go': `package handlers

import (
	"math"
	"strconv"

	"{{projectName}}/models"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// @Summary List all products
// @Description Get a list of all products with pagination and filtering
// @Tags products
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Param category query string false "Filter by category"
// @Param tags query []string false "Filter by tags"
// @Param search query string false "Search in name and description"
// @Param min_price query number false "Minimum price"
// @Param max_price query number false "Maximum price"
// @Param featured query bool false "Filter featured products"
// @Param sort_by query string false "Sort by field" Enums(name, price, created_at, stock)
// @Param order query string false "Sort order" Enums(asc, desc)
// @Success 200 {object} models.PaginatedResponse
// @Router /products [get]
func (h *Handler) ListProducts(c *fiber.Ctx) error {
	var req models.ProductListRequest
	
	// Parse query parameters
	if err := c.QueryParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid query parameters"})
	}

	// Set defaults
	if req.Page < 1 {
		req.Page = 1
	}
	if req.Limit < 1 || req.Limit > 100 {
		req.Limit = 10
	}
	if req.Order == "" {
		req.Order = "desc"
	}
	if req.SortBy == "" {
		req.SortBy = "created_at"
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Build query
	query := h.db.Model(&models.Product{}).Where("active = ?", true)

	// Apply filters
	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}

	if len(req.Tags) > 0 {
		query = query.Where("tags && ?", pq.Array(req.Tags))
	}

	if req.Search != "" {
		searchPattern := "%" + req.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchPattern, searchPattern)
	}

	if req.MinPrice > 0 {
		query = query.Where("price >= ?", req.MinPrice)
	}

	if req.MaxPrice > 0 {
		query = query.Where("price <= ?", req.MaxPrice)
	}

	if req.Featured {
		query = query.Where("featured = ?", true)
	}

	// Count total
	var total int64
	query.Count(&total)

	// Apply sorting
	orderClause := req.SortBy + " " + req.Order
	query = query.Order(orderClause)

	// Apply pagination
	offset := (req.Page - 1) * req.Limit
	var products []models.Product
	if err := query.Offset(offset).Limit(req.Limit).Find(&products).Error; err != nil {
		h.logger.Error("Failed to fetch products", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	totalPages := int(math.Ceil(float64(total) / float64(req.Limit)))

	return c.JSON(models.PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
		HasNext:    req.Page < totalPages,
		HasPrev:    req.Page > 1})
}

// @Summary Get product by ID
// @Description Get a specific product by ID
// @Tags products
// @Accept json
// @Produce json
// @Param id path int true "Product ID"
// @Success 200 {object} models.Product
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /products/{id} [get]
func (h *Handler) GetProduct(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid product ID"})
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("Product"))
		}
		h.logger.Error("Failed to fetch product", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	return c.JSON(product)
}

// @Summary Create a new product
// @Description Create a new product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param product body models.CreateProductRequest true "Product data"
// @Success 201 {object} models.Product
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 401 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /products [post]
func (h *Handler) CreateProduct(c *fiber.Ctx) error {
	var req models.CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
	}

	// Check if SKU exists
	var existingProduct models.Product
	if err := h.db.Where("sku = ?", req.SKU).First(&existingProduct).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Product with this SKU already exists"})
	}

	product := models.Product{
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Stock:       req.Stock,
		SKU:         req.SKU,
		Category:    req.Category,
		Tags:        req.Tags,
		Images:      req.Images,
		Active:      true}

	if err := h.db.Create(&product).Error; err != nil {
		h.logger.Error("Failed to create product", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	h.logger.Info("Product created", zap.Uint("product_id", product.ID), zap.String("sku", product.SKU))
	return c.Status(fiber.StatusCreated).JSON(product)
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
// @Failure 400 {object} handlers.ValidationErrorResponse
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /products/{id} [put]
func (h *Handler) UpdateProduct(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid product ID"})
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("Product"))
		}
		h.logger.Error("Failed to fetch product", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	var req models.UpdateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request format"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(h.formatValidationErrors(err))
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
	if req.Stock != nil {
		product.Stock = *req.Stock
	}
	if req.Category != nil {
		product.Category = *req.Category
	}
	if req.Tags != nil {
		product.Tags = *req.Tags
	}
	if req.Images != nil {
		product.Images = *req.Images
	}
	if req.Active != nil {
		product.Active = *req.Active
	}
	if req.Featured != nil {
		product.Featured = *req.Featured
	}

	if err := h.db.Save(&product).Error; err != nil {
		h.logger.Error("Failed to update product", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	h.logger.Info("Product updated", zap.Uint("product_id", product.ID))
	return c.JSON(product)
}

// @Summary Delete product
// @Description Delete a product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "Product ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /products/{id} [delete]
func (h *Handler) DeleteProduct(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid product ID"})
	}

	result := h.db.Delete(&models.Product{}, id)
	if result.Error != nil {
		h.logger.Error("Failed to delete product", zap.Error(result.Error))
		return c.Status(fiber.StatusInternalServerError).JSON(h.internalError())
	}

	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(h.notFoundError("Product"))
	}

	h.logger.Info("Product deleted", zap.Uint64("product_id", id))
	return c.SendStatus(fiber.StatusNoContent)
}
`,

    'handlers/websocket.go': `package handlers

import (
	"encoding/json"
	"time"

	"github.com/gofiber/websocket/v2"
	"go.uber.org/zap"
)

type WebSocketMessage struct {
	Type    string          \`json:"type"\`
	Payload json.RawMessage \`json:"payload"\`
}

type WebSocketClient struct {
	Conn   *websocket.Conn
	UserID uint
	Send   chan WebSocketMessage
}

var clients = make(map[uint]*WebSocketClient)
var broadcast = make(chan WebSocketMessage)

// @Summary WebSocket endpoint
// @Description WebSocket connection for real-time communication
// @Tags websocket
// @Security Bearer
// @Router /ws [get]
func (h *Handler) WebSocketHandler(c *websocket.Conn) {
	userID := c.Locals("userID").(uint)
	
	client := &WebSocketClient{
		Conn:   c,
		UserID: userID,
		Send:   make(chan WebSocketMessage, 256)}
	
	clients[userID] = client
	defer func() {
		delete(clients, userID)
		close(client.Send)
	}()

	h.logger.Info("WebSocket connection established", zap.Uint("user_id", userID))

	// Send welcome message
	welcome := WebSocketMessage{
		Type:    "welcome",
		Payload: json.RawMessage(\`{"message":"Connected to WebSocket","user_id":\` + strconv.Itoa(int(userID)) + \`}\`)}
	
	if err := c.WriteJSON(welcome); err != nil {
		h.logger.Error("Failed to send welcome message", zap.Error(err))
		return
	}

	// Start goroutines for reading and writing
	go client.writePump(h.logger)
	client.readPump(h.logger)
}

func (c *WebSocketClient) readPump(logger *zap.Logger) {
	defer c.Conn.Close()
	
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg WebSocketMessage
		if err := c.Conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Error("WebSocket error", zap.Error(err))
			}
			break
		}

		logger.Debug("Received WebSocket message", 
			zap.Uint("user_id", c.UserID),
			zap.String("type", msg.Type))

		// Handle different message types
		switch msg.Type {
		case "ping":
			c.Send <- WebSocketMessage{
				Type:    "pong",
				Payload: msg.Payload}
		
		case "broadcast":
			// Broadcast message to all connected clients
			broadcast <- msg
		
		default:
			c.Send <- WebSocketMessage{
				Type:    "error",
				Payload: json.RawMessage(\`{"message":"Unknown message type"}\`)}
		}
	}
}

func (c *WebSocketClient) writePump(logger *zap.Logger) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteJSON(message); err != nil {
				logger.Error("Failed to write message", zap.Error(err))
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Broadcast handler
func init() {
	go func() {
		for {
			msg := <-broadcast
			for _, client := range clients {
				select {
				case client.Send <- msg:
				default:
					close(client.Send)
					delete(clients, client.UserID)
				}
			}
		}
	}()
}
`,

    // Routes
    'routes/routes.go': `package routes

import (
	"{{projectName}}/config"
	"{{projectName}}/handlers"
	"{{projectName}}/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func SetupRoutes(api fiber.Router, h *handlers.Handler, cfg *config.Config) {
	// Auth routes
	auth := api.Group("/auth")
	{
		auth.Post("/register", h.Register)
		auth.Post("/login", h.Login)
		auth.Post("/refresh", h.RefreshToken)
		auth.Post("/logout", middleware.JWT(cfg), h.Logout)
	}

	// User routes
	users := api.Group("/users")
	users.Use(middleware.JWT(cfg))
	{
		users.Get("", middleware.RequireRole("admin"), h.ListUsers)
		users.Get("/me", h.GetCurrentUser)
		users.Put("/me", h.UpdateProfile)
		users.Put("/me/password", h.ChangePassword)
		users.Get("/:id", h.GetUser)
		users.Delete("/:id", middleware.RequireRole("admin"), h.DeleteUser)
	}

	// Product routes
	products := api.Group("/products")
	{
		products.Get("", h.ListProducts)
		products.Get("/:id", h.GetProduct)
		
		// Protected routes
		products.Use(middleware.JWT(cfg))
		products.Post("", middleware.RequireRole("admin"), h.CreateProduct)
		products.Put("/:id", middleware.RequireRole("admin"), h.UpdateProduct)
		products.Delete("/:id", middleware.RequireRole("admin"), h.DeleteProduct)
	}

	// WebSocket endpoint
	api.Get("/ws", middleware.JWT(cfg), websocket.New(h.WebSocketHandler))

	// Server-Sent Events endpoint
	api.Get("/sse", middleware.JWT(cfg), h.SSEHandler)
}
`,

    // Middleware
    'middleware/auth.go': `package middleware

import (
	"strings"

	"{{projectName}}/config"
	"{{projectName}}/utils"

	"github.com/gofiber/fiber/v2"
	jwtware "github.com/gofiber/jwt/v4"
	"github.com/golang-jwt/jwt/v5"
)

func JWT(cfg *config.Config) fiber.Handler {
	return jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{
			Key: []byte(cfg.JWTSecret)},
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token"})
		},
		SuccessHandler: func(c *fiber.Ctx) error {
			user := c.Locals("user").(*jwt.Token)
			claims := user.Claims.(jwt.MapClaims)
			
			userID := uint(claims["user_id"].(float64))
			email := claims["email"].(string)
			role := claims["role"].(string)
			
			c.Locals("userID", userID)
			c.Locals("userEmail", email)
			c.Locals("userRole", role)
			
			return c.Next()
		},
		TokenLookup: "header:Authorization",
		AuthScheme:  "Bearer"})
}

func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userRole, ok := c.Locals("userRole").(string)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Access denied"})
		}

		for _, role := range roles {
			if userRole == role {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Insufficient permissions"})
	}
}

func OptionalJWT(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" {
			return c.Next()
		}

		parts := strings.Split(auth, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Next()
		}

		token := parts[1]
		claims, err := utils.ValidateToken(token, cfg.JWTSecret)
		if err != nil {
			return c.Next()
		}

		c.Locals("userID", claims.UserID)
		c.Locals("userEmail", claims.Email)
		c.Locals("userRole", claims.Role)

		return c.Next()
	}
}
`,

    'middleware/rate_limiter.go': `package middleware

import (
	"time"

	"{{projectName}}/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/storage/redis/v3"
)

func RateLimiter(cfg *config.Config) fiber.Handler {
	// Try Redis storage first
	storage := redis.New(redis.Config{
		Host:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		Database: cfg.RedisDB})

	// Test connection
	if err := storage.Set("test", []byte("test"), 1*time.Second); err != nil {
		// Fallback to in-memory storage
		storage = nil
	}

	config := limiter.Config{
		Max:        cfg.RateLimitRequests,
		Expiration: cfg.RateLimitDuration,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Rate limit exceeded"})
		},
		SkipFailedRequests:     false,
		SkipSuccessfulRequests: false}

	if storage != nil {
		config.Storage = storage
	}

	return limiter.New(config)
}
`,

    'middleware/error_handler.go': `package middleware

import (
	"github.com/gofiber/fiber/v2"
)

func CustomErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal server error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	}

	// Don't expose internal error details in production
	if code == fiber.StatusInternalServerError && c.App().Config().AppName != "" {
		message = "Internal server error"
	}

	return c.Status(code).JSON(fiber.Map{
		"error": message,
		"code":  code})
}
`,

    // Utils
    'utils/jwt.go': `package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	UserID uint   \`json:"user_id"\`
	Email  string \`json:"email"\`
	Role   string \`json:"role"\`
	jwt.RegisteredClaims
}

func GenerateAccessToken(userID uint, email, role, secret string, expiration time.Duration) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now())}}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateToken(tokenString, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
`,

    // Environment file
    '.env.example': `# Environment
ENVIRONMENT=development

# Server
PORT=3000
PREFORK=false

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME={{projectName}}
DB_SSLMODE=disable

# JWT
JWT_SECRET=your-secret-key-change-this
JWT_ACCESS_EXPIRATION_MINUTES=15
JWT_REFRESH_EXPIRATION_DAYS=7

# Redis
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_DURATION_MINUTES=1

# CORS
ALLOWED_ORIGINS=*

# Session
SESSION_SECRET=session-secret-change-this
SESSION_EXPIRATION_HOURS=24
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

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata curl

# Create non-root user
RUN addgroup -g 1000 appgroup && \\
    adduser -S -u 1000 -G appgroup appuser

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .
COPY --from=builder /app/docs ./docs

# Copy .env file if needed
COPY --from=builder /app/.env.example .env

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

# Run the application
CMD ["./main"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`,

    // Makefile
    'Makefile': `# Variables
APP_NAME={{projectName}}
MAIN_FILE=main.go
DOCKER_IMAGE={{projectName}}:latest

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
	$(GOCMD) tool cover -html=coverage.out

# Benchmark tests
bench:
	$(GOTEST) -bench=. -benchmem ./...

# Clean build artifacts
clean:
	$(GOCLEAN)
	rm -f $(APP_NAME)
	rm -f coverage.out

# Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Update dependencies
deps-update:
	$(GOGET) -u ./...
	$(GOMOD) tidy

# Generate swagger documentation
swagger:
	swag init

# Format code
fmt:
	$(GOCMD) fmt ./...
	gofumpt -w .

# Lint code
lint:
	golangci-lint run

# Security scan
security:
	gosec ./...

# Docker build
docker-build:
	docker build -t $(DOCKER_IMAGE) .

# Docker run
docker-run:
	docker-compose up

# Docker stop
docker-stop:
	docker-compose down

# Install development tools
install-tools:
	go install github.com/cosmtrek/air@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/securego/gosec/v2/cmd/gosec@latest
	go install mvdan.cc/gofumpt@latest

.PHONY: build run dev test test-coverage bench clean deps deps-update swagger fmt lint security docker-build docker-run docker-stop install-tools
`,

    // README
    'README.md': `# {{projectName}}

A high-performance REST API built with Fiber framework in Go.

## Features

- **Fiber Framework**: Express-inspired web framework with zero memory allocation
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **GORM ORM**: Database abstraction with auto-migrations
- **Swagger Documentation**: Auto-generated API documentation
- **Request Validation**: Input validation with custom validators
- **Structured Logging**: JSON logs with Zap
- **Rate Limiting**: Request throttling with Redis or in-memory fallback
- **WebSocket Support**: Real-time bidirectional communication
- **Server-Sent Events**: Real-time server push
- **Session Management**: Secure session handling
- **CORS Support**: Configurable cross-origin requests
- **Hot Reload**: Development with Air
- **Docker Support**: Containerized deployment
- **Testing**: Unit and integration tests

## Requirements

- Go 1.21+
- PostgreSQL (or MySQL/SQLite)
- Redis (optional, for rate limiting)
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
- Swagger UI: http://localhost:3000/swagger/index.html

## Performance

Fiber is built on top of Fasthttp, which is up to 10x faster than net/http. Key performance features:

- Zero memory allocation router
- Efficient middleware system
- Built-in connection pooling
- Prefork mode for multi-core systems

## Development

### Install tools
\`\`\`bash
make install-tools
\`\`\`

### Run tests
\`\`\`bash
make test
\`\`\`

### Run benchmarks
\`\`\`bash
make bench
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

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/refresh\` - Refresh access token
- \`POST /api/v1/auth/logout\` - Logout user

### Users
- \`GET /api/v1/users\` - List users (admin)
- \`GET /api/v1/users/:id\` - Get user
- \`GET /api/v1/users/me\` - Get current user
- \`PUT /api/v1/users/me\` - Update profile
- \`PUT /api/v1/users/me/password\` - Change password
- \`DELETE /api/v1/users/:id\` - Delete user (admin)

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product
- \`POST /api/v1/products\` - Create product (admin)
- \`PUT /api/v1/products/:id\` - Update product (admin)
- \`DELETE /api/v1/products/:id\` - Delete product (admin)

### Real-time
- \`WS /api/v1/ws\` - WebSocket connection
- \`GET /api/v1/sse\` - Server-Sent Events

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
`
  }
};