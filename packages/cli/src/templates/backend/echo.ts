import { BackendTemplate } from '../types';

export const echoTemplate: BackendTemplate = {
  id: 'echo',
  name: 'echo',
  displayName: 'Echo Framework',
  description: 'High performance, minimalist Go web framework with automatic TLS and HTTP/2 support',
  language: 'go',
  framework: 'echo',
  version: '4.11.4',
  tags: ['go', 'echo', 'api', 'rest', 'validation', 'performance', 'http2'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],
  
  files: {
    // Go module configuration
    'go.mod': `module {{projectName}}

go 1.21

require (
	github.com/labstack/echo/v4 v4.11.4
	github.com/joho/godotenv v1.5.1
	github.com/go-playground/validator/v10 v10.16.0
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/swaggo/echo-swagger v1.4.1
	github.com/swaggo/swag v1.16.2
	go.uber.org/zap v1.26.0
	github.com/redis/go-redis/v9 v9.3.1
	gorm.io/gorm v1.25.5
	gorm.io/driver/postgres v1.5.4
	gorm.io/driver/mysql v1.5.2
	gorm.io/driver/sqlite v1.5.4
	golang.org/x/crypto v0.17.0
	golang.org/x/time v0.5.0
	github.com/gorilla/websocket v1.5.1
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/PuerkitoBio/purell v1.2.1 // indirect
	github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/ghodss/yaml v1.0.0 // indirect
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
	github.com/labstack/gommon v0.4.2 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-sqlite3 v1.14.19 // indirect
	github.com/swaggo/files/v2 v2.0.0 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/net v0.19.0 // indirect
	golang.org/x/sync v0.5.0 // indirect
	golang.org/x/sys v0.15.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	golang.org/x/tools v0.16.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
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
	"time"

	"{{projectName}}/config"
	"{{projectName}}/database"
	_ "{{projectName}}/docs" // swagger docs
	"{{projectName}}/handlers"
	"{{projectName}}/middleware"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	echoSwagger "github.com/swaggo/echo-swagger"
	"go.uber.org/zap"
)

// @title           {{projectName}} API
// @version         1.0
// @description     API server for {{projectName}} built with Echo framework
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
		fmt.Println("No .env file found")
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

	// Create Echo instance
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	// Custom error handler
	e.HTTPErrorHandler = middleware.CustomHTTPErrorHandler

	// Global middleware
	e.Use(echoMiddleware.RequestIDWithConfig(echoMiddleware.RequestIDConfig{
		Generator: middleware.GenerateRequestID}))
	e.Use(middleware.ZapLogger(logger))
	e.Use(echoMiddleware.Recover())
	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-Request-ID"},
		ExposeHeaders:    []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           86400}))
	e.Use(echoMiddleware.GzipWithConfig(echoMiddleware.GzipConfig{
		Level: 5}))
	e.Use(middleware.RateLimiter(cfg))
	e.Use(echoMiddleware.SecureWithConfig(echoMiddleware.SecureConfig{
		XSSProtection:         "1; mode=block",
		ContentTypeNosniff:    "nosniff",
		XFrameOptions:         "DENY",
		HSTSMaxAge:            3600,
		ContentSecurityPolicy: "default-src 'self'"}))

	// Health check
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"status": "healthy",
			"time":   time.Now().UTC()})
	})

	// Swagger documentation
	e.GET("/swagger/*", echoSwagger.WrapHandler)

	// Initialize handlers
	h := handlers.NewHandler(db, cfg, logger)

	// API routes
	api := e.Group("/api/v1")
	{
		// Auth routes
		auth := api.Group("/auth")
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
		auth.POST("/refresh", h.RefreshToken)

		// User routes
		users := api.Group("/users")
		users.Use(middleware.JWT(cfg.JWTSecret))
		users.GET("", h.ListUsers, middleware.RequireRole("admin"))
		users.GET("/:id", h.GetUser)
		users.GET("/me", h.GetCurrentUser)
		users.PUT("/me", h.UpdateCurrentUser)
		users.DELETE("/:id", h.DeleteUser, middleware.RequireRole("admin"))

		// Product routes
		products := api.Group("/products")
		products.GET("", h.ListProducts)
		products.GET("/:id", h.GetProduct)
		products.Use(middleware.JWT(cfg.JWTSecret))
		products.POST("", h.CreateProduct, middleware.RequireRole("admin"))
		products.PUT("/:id", h.UpdateProduct, middleware.RequireRole("admin"))
		products.DELETE("/:id", h.DeleteProduct, middleware.RequireRole("admin"))

		// WebSocket endpoint
		ws := api.Group("/ws")
		ws.Use(middleware.JWT(cfg.JWTSecret))
		ws.GET("", h.WebSocketHandler)
	}

	// Start server
	go func() {
		address := fmt.Sprintf(":%d", cfg.Port)
		logger.Info("Starting server", zap.String("address", address))
		
		if cfg.TLSEnabled {
			if err := e.StartTLS(address, cfg.TLSCertFile, cfg.TLSKeyFile); err != nil && err != http.ErrServerClosed {
				logger.Fatal("Failed to start TLS server", zap.Error(err))
			}
		} else {
			if err := e.Start(address); err != nil && err != http.ErrServerClosed {
				logger.Fatal("Failed to start server", zap.Error(err))
			}
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	// Graceful shutdown
	logger.Info("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
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
	AllowedOrigins []string
	
	// TLS
	TLSEnabled  bool
	TLSCertFile string
	TLSKeyFile  string
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
		AllowedOrigins: strings.Split(getEnv("ALLOWED_ORIGINS", "*"), ","),
		
		// TLS
		TLSEnabled:  getEnvAsBool("TLS_ENABLED", false),
		TLSCertFile: getEnv("TLS_CERT_FILE", ""),
		TLSKeyFile:  getEnv("TLS_KEY_FILE", "")}
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

	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Product{},
		&models.RefreshToken{},
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
	Role     string \`gorm:"default:user" json:"role" validate:"omitempty,oneof=user admin"\`
	Active   bool   \`gorm:"default:true" json:"active"\`
	
	RefreshTokens []RefreshToken \`gorm:"foreignKey:UserID" json:"-"\`
}

type RefreshToken struct {
	ID        uint      \`gorm:"primarykey" json:"id"\`
	Token     string    \`gorm:"uniqueIndex;not null" json:"token"\`
	UserID    uint      \`gorm:"not null" json:"user_id"\`
	ExpiresAt time.Time \`gorm:"not null" json:"expires_at"\`
	CreatedAt time.Time \`json:"created_at"\`
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
	Role      string    \`json:"role"\`
	Active    bool      \`json:"active"\`
	CreatedAt time.Time \`json:"created_at"\`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Role:      u.Role,
		Active:    u.Active,
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
	
	Name        string  \`gorm:"not null" json:"name" validate:"required,min=1,max=200"\`
	Description string  \`json:"description" validate:"max=1000"\`
	Price       float64 \`gorm:"not null" json:"price" validate:"required,min=0"\`
	Stock       int     \`gorm:"default:0" json:"stock" validate:"min=0"\`
	SKU         string  \`gorm:"uniqueIndex" json:"sku" validate:"required,min=3,max=50"\`
	Category    string  \`json:"category" validate:"required,min=1,max=100"\`
	Active      bool    \`gorm:"default:true" json:"active"\`
}

type CreateProductRequest struct {
	Name        string  \`json:"name" validate:"required,min=1,max=200"\`
	Description string  \`json:"description" validate:"max=1000"\`
	Price       float64 \`json:"price" validate:"required,min=0"\`
	Stock       int     \`json:"stock" validate:"min=0"\`
	SKU         string  \`json:"sku" validate:"required,min=3,max=50"\`
	Category    string  \`json:"category" validate:"required,min=1,max=100"\`
}

type UpdateProductRequest struct {
	Name        *string  \`json:"name,omitempty" validate:"omitempty,min=1,max=200"\`
	Description *string  \`json:"description,omitempty" validate:"omitempty,max=1000"\`
	Price       *float64 \`json:"price,omitempty" validate:"omitempty,min=0"\`
	Stock       *int     \`json:"stock,omitempty" validate:"omitempty,min=0"\`
	Category    *string  \`json:"category,omitempty" validate:"omitempty,min=1,max=100"\`
	Active      *bool    \`json:"active,omitempty"\`
}

type ProductListRequest struct {
	Page     int    \`query:"page" validate:"min=1"\`
	Limit    int    \`query:"limit" validate:"min=1,max=100"\`
	Category string \`query:"category" validate:"omitempty,min=1,max=100"\`
	Search   string \`query:"search" validate:"omitempty,min=1,max=100"\`
	SortBy   string \`query:"sort_by" validate:"omitempty,oneof=name price created_at"\`
	Order    string \`query:"order" validate:"omitempty,oneof=asc desc"\`
}

type PaginatedResponse struct {
	Data       interface{} \`json:"data"\`
	Total      int64       \`json:"total"\`
	Page       int         \`json:"page"\`
	Limit      int         \`json:"limit"\`
	TotalPages int         \`json:"total_pages"\`
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
	return &Handler{
		db:       db,
		cfg:      cfg,
		logger:   logger,
		validate: validator.New()}
}

// Custom validation errors
type ValidationError struct {
	Field   string \`json:"field"\`
	Message string \`json:"message"\`
}

func (h *Handler) formatValidationErrors(err error) []ValidationError {
	var errors []ValidationError
	
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			errors = append(errors, ValidationError{
				Field:   e.Field(),
				Message: h.getErrorMessage(e)})
		}
	}
	
	return errors
}

func (h *Handler) getErrorMessage(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return "This field is required"
	case "email":
		return "Invalid email format"
	case "min":
		return "Value is too short"
	case "max":
		return "Value is too long"
	case "oneof":
		return "Invalid value"
	default:
		return "Invalid value"
	}
}
`,

    'handlers/auth.go': `package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"time"

	"{{projectName}}/models"
	"{{projectName}}/utils"

	"github.com/labstack/echo/v4"
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
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /auth/register [post]
func (h *Handler) Register(c echo.Context) error {
	var req models.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"errors": h.formatValidationErrors(err)})
	}

	// Check if user exists
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return echo.NewHTTPError(http.StatusConflict, "Email already registered")
	}

	// Create new user
	user := models.User{
		Email: req.Email,
		Name:  req.Name}

	if err := user.SetPassword(req.Password); err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user")
	}

	if err := h.db.Create(&user).Error; err != nil {
		h.logger.Error("Failed to create user", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create user")
	}

	h.logger.Info("User registered", zap.Uint("user_id", user.ID), zap.String("email", user.Email))
	return c.JSON(http.StatusCreated, user.ToResponse())
}

// @Summary Login user
// @Description Authenticate user and return JWT tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body models.LoginRequest true "Login credentials"
// @Success 200 {object} models.TokenResponse
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/login [post]
func (h *Handler) Login(c echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"errors": h.formatValidationErrors(err)})
	}

	// Find user
	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}

	// Check password
	if !user.CheckPassword(req.Password) {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid credentials")
	}

	// Check if user is active
	if !user.Active {
		return echo.NewHTTPError(http.StatusUnauthorized, "Account is disabled")
	}

	// Generate tokens
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTAccessExpiration)
	if err != nil {
		h.logger.Error("Failed to generate access token", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	refreshToken, err := h.generateRefreshToken()
	if err != nil {
		h.logger.Error("Failed to generate refresh token", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	// Save refresh token
	refreshTokenModel := models.RefreshToken{
		Token:     refreshToken,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(h.cfg.JWTRefreshExpiration)}

	if err := h.db.Create(&refreshTokenModel).Error; err != nil {
		h.logger.Error("Failed to save refresh token", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save token")
	}

	h.logger.Info("User logged in", zap.Uint("user_id", user.ID), zap.String("email", user.Email))

	return c.JSON(http.StatusOK, models.TokenResponse{
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
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/refresh [post]
func (h *Handler) RefreshToken(c echo.Context) error {
	var req models.RefreshTokenRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"errors": h.formatValidationErrors(err)})
	}

	// Find refresh token
	var refreshToken models.RefreshToken
	if err := h.db.Where("token = ?", req.RefreshToken).First(&refreshToken).Error; err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid refresh token")
	}

	// Check if expired
	if time.Now().After(refreshToken.ExpiresAt) {
		h.db.Delete(&refreshToken)
		return echo.NewHTTPError(http.StatusUnauthorized, "Refresh token expired")
	}

	// Get user
	var user models.User
	if err := h.db.First(&user, refreshToken.UserID).Error; err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "User not found")
	}

	// Generate new access token
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Email, user.Role, h.cfg.JWTSecret, h.cfg.JWTAccessExpiration)
	if err != nil {
		h.logger.Error("Failed to generate access token", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(http.StatusOK, models.TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: req.RefreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(h.cfg.JWTAccessExpiration.Seconds())})
}

func (h *Handler) generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// Clean up expired refresh tokens periodically
func (h *Handler) CleanupExpiredTokens() {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		result := h.db.Where("expires_at < ?", time.Now()).Delete(&models.RefreshToken{})
		if result.Error != nil {
			h.logger.Error("Failed to cleanup expired tokens", zap.Error(result.Error))
		} else {
			h.logger.Info("Cleaned up expired tokens", zap.Int64("count", result.RowsAffected))
		}
	}
}
`,

    'handlers/user.go': `package handlers

import (
	"net/http"
	"strconv"

	"{{projectName}}/models"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

// @Summary List all users
// @Description Get a list of all users (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {array} models.UserResponse
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /users [get]
func (h *Handler) ListUsers(c echo.Context) error {
	var users []models.User
	if err := h.db.Find(&users).Error; err != nil {
		h.logger.Error("Failed to fetch users", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch users")
	}

	response := make([]models.UserResponse, len(users))
	for i, user := range users {
		response[i] = user.ToResponse()
	}

	return c.JSON(http.StatusOK, response)
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
func (h *Handler) GetUser(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, user.ToResponse())
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
func (h *Handler) GetCurrentUser(c echo.Context) error {
	userID := c.Get("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, user.ToResponse())
}

// @Summary Update current user
// @Description Update the currently authenticated user's profile
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param user body map[string]string true "User update data"
// @Success 200 {object} models.UserResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /users/me [put]
func (h *Handler) UpdateCurrentUser(c echo.Context) error {
	userID := c.Get("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	var updates map[string]interface{}
	if err := c.Bind(&updates); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	// Remove fields that shouldn't be updated
	delete(updates, "id")
	delete(updates, "email")
	delete(updates, "role")
	delete(updates, "password")

	if err := h.db.Model(&user).Updates(updates).Error; err != nil {
		h.logger.Error("Failed to update user", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update user")
	}

	h.logger.Info("User updated", zap.Uint("user_id", user.ID))
	return c.JSON(http.StatusOK, user.ToResponse())
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
func (h *Handler) DeleteUser(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid user ID")
	}

	result := h.db.Delete(&models.User{}, id)
	if result.Error != nil {
		h.logger.Error("Failed to delete user", zap.Error(result.Error))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete user")
	}

	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	h.logger.Info("User deleted", zap.Uint64("user_id", id))
	return c.NoContent(http.StatusNoContent)
}
`,

    'handlers/product.go': `package handlers

import (
	"math"
	"net/http"
	"strconv"

	"{{projectName}}/models"

	"github.com/labstack/echo/v4"
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
// @Param search query string false "Search in name and description"
// @Param sort_by query string false "Sort by field" Enums(name, price, created_at)
// @Param order query string false "Sort order" Enums(asc, desc)
// @Success 200 {object} models.PaginatedResponse
// @Router /products [get]
func (h *Handler) ListProducts(c echo.Context) error {
	var req models.ProductListRequest
	
	// Set defaults
	req.Page = 1
	req.Limit = 10
	req.Order = "desc"
	req.SortBy = "created_at"
	
	// Bind query parameters
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid query parameters")
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"errors": h.formatValidationErrors(err)})
	}

	// Build query
	query := h.db.Model(&models.Product{}).Where("active = ?", true)

	// Apply filters
	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}

	if req.Search != "" {
		searchPattern := "%" + req.Search + "%"
		query = query.Where("name LIKE ? OR description LIKE ?", searchPattern, searchPattern)
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
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch products")
	}

	totalPages := int(math.Ceil(float64(total) / float64(req.Limit)))

	return c.JSON(http.StatusOK, models.PaginatedResponse{
		Data:       products,
		Total:      total,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages})
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
func (h *Handler) GetProduct(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid product ID")
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return echo.NewHTTPError(http.StatusNotFound, "Product not found")
		}
		h.logger.Error("Failed to fetch product", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch product")
	}

	return c.JSON(http.StatusOK, product)
}

// @Summary Create a new product
// @Description Create a new product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param product body models.CreateProductRequest true "Product data"
// @Success 201 {object} models.Product
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /products [post]
func (h *Handler) CreateProduct(c echo.Context) error {
	var req models.CreateProductRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"errors": h.formatValidationErrors(err)})
	}

	// Check if SKU exists
	var existingProduct models.Product
	if err := h.db.Where("sku = ?", req.SKU).First(&existingProduct).Error; err == nil {
		return echo.NewHTTPError(http.StatusConflict, "Product with this SKU already exists")
	}

	product := models.Product{
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Stock:       req.Stock,
		SKU:         req.SKU,
		Category:    req.Category,
		Active:      true}

	if err := h.db.Create(&product).Error; err != nil {
		h.logger.Error("Failed to create product", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create product")
	}

	h.logger.Info("Product created", zap.Uint("product_id", product.ID), zap.String("sku", product.SKU))
	return c.JSON(http.StatusCreated, product)
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
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /products/{id} [put]
func (h *Handler) UpdateProduct(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid product ID")
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return echo.NewHTTPError(http.StatusNotFound, "Product not found")
		}
		h.logger.Error("Failed to fetch product", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch product")
	}

	var req models.UpdateProductRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request format")
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"error":  "Validation failed",
			"errors": h.formatValidationErrors(err)})
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
	if req.Active != nil {
		product.Active = *req.Active
	}

	if err := h.db.Save(&product).Error; err != nil {
		h.logger.Error("Failed to update product", zap.Error(err))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update product")
	}

	h.logger.Info("Product updated", zap.Uint("product_id", product.ID))
	return c.JSON(http.StatusOK, product)
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
func (h *Handler) DeleteProduct(c echo.Context) error {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid product ID")
	}

	result := h.db.Delete(&models.Product{}, id)
	if result.Error != nil {
		h.logger.Error("Failed to delete product", zap.Error(result.Error))
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete product")
	}

	if result.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "Product not found")
	}

	h.logger.Info("Product deleted", zap.Uint64("product_id", id))
	return c.NoContent(http.StatusNoContent)
}
`,

    'handlers/websocket.go': `package handlers

import (
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024}

type WebSocketMessage struct {
	Type    string      \`json:"type"\`
	Payload interface{} \`json:"payload"\`
}

// @Summary WebSocket endpoint
// @Description WebSocket connection for real-time communication
// @Tags websocket
// @Security Bearer
// @Router /ws [get]
func (h *Handler) WebSocketHandler(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		h.logger.Error("Failed to upgrade connection", zap.Error(err))
		return err
	}
	defer ws.Close()

	userID := c.Get("userID").(uint)
	h.logger.Info("WebSocket connection established", zap.Uint("user_id", userID))

	// Send welcome message
	welcome := WebSocketMessage{
		Type: "welcome",
		Payload: map[string]interface{}{
			"message": "Connected to WebSocket",
			"user_id": userID}}
	
	if err := ws.WriteJSON(welcome); err != nil {
		h.logger.Error("Failed to send welcome message", zap.Error(err))
		return err
	}

	// Message handling loop
	for {
		var msg WebSocketMessage
		if err := ws.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				h.logger.Error("WebSocket error", zap.Error(err))
			}
			break
		}

		h.logger.Debug("Received WebSocket message", 
			zap.Uint("user_id", userID),
			zap.String("type", msg.Type))

		// Handle different message types
		switch msg.Type {
		case "ping":
			response := WebSocketMessage{
				Type:    "pong",
				Payload: msg.Payload}
			if err := ws.WriteJSON(response); err != nil {
				h.logger.Error("Failed to send pong", zap.Error(err))
				break
			}
		
		case "echo":
			response := WebSocketMessage{
				Type:    "echo_response",
				Payload: msg.Payload}
			if err := ws.WriteJSON(response); err != nil {
				h.logger.Error("Failed to send echo response", zap.Error(err))
				break
			}
		
		default:
			response := WebSocketMessage{
				Type: "error",
				Payload: map[string]string{
					"message": "Unknown message type"}}
			if err := ws.WriteJSON(response); err != nil {
				h.logger.Error("Failed to send error response", zap.Error(err))
				break
			}
		}
	}

	h.logger.Info("WebSocket connection closed", zap.Uint("user_id", userID))
	return nil
}
`,

    // Middleware
    'middleware/auth.go': `package middleware

import (
	"strings"

	"{{projectName}}/utils"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func JWT(secret string) echo.MiddlewareFunc {
	return middleware.JWTWithConfig(middleware.JWTConfig{
		SigningKey: []byte(secret),
		TokenLookup: "header:Authorization",
		AuthScheme: "Bearer",
		Claims: &utils.JWTClaims{},
		ErrorHandler: func(err error) error {
			return echo.NewHTTPError(401, "Invalid or expired token")
		},
		SuccessHandler: func(c echo.Context) {
			user := c.Get("user").(*jwt.Token)
			claims := user.Claims.(*utils.JWTClaims)
			
			c.Set("userID", claims.UserID)
			c.Set("userEmail", claims.Email)
			c.Set("userRole", claims.Role)
		}})
}

func RequireRole(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userRole, ok := c.Get("userRole").(string)
			if !ok {
				return echo.NewHTTPError(403, "Access denied")
			}

			for _, role := range roles {
				if userRole == role {
					return next(c)
				}
			}

			return echo.NewHTTPError(403, "Insufficient permissions")
		}
	}
}

func ExtractToken(authHeader string) (string, error) {
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return "", echo.NewHTTPError(401, "Invalid authorization header format")
	}
	return parts[1], nil
}
`,

    'middleware/logger.go': `package middleware

import (
	"time"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

func ZapLogger(logger *zap.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			err := next(c)
			if err != nil {
				c.Error(err)
			}

			req := c.Request()
			res := c.Response()

			fields := []zap.Field{
				zap.String("remote_ip", c.RealIP()),
				zap.String("host", req.Host),
				zap.String("method", req.Method),
				zap.String("uri", req.RequestURI),
				zap.Int("status", res.Status),
				zap.Int64("size", res.Size),
				zap.String("user_agent", req.UserAgent()),
				zap.Duration("latency", time.Since(start)),
				zap.String("request_id", c.Request().Header.Get(echo.HeaderXRequestID))}

			// Add user ID if authenticated
			if userID, ok := c.Get("userID").(uint); ok {
				fields = append(fields, zap.Uint("user_id", userID))
			}

			// Log based on status code
			switch {
			case res.Status >= 500:
				logger.Error("Server error", fields...)
			case res.Status >= 400:
				logger.Warn("Client error", fields...)
			case res.Status >= 300:
				logger.Info("Redirect", fields...)
			default:
				logger.Info("Success", fields...)
			}

			return err
		}
	}
}
`,

    'middleware/rate_limiter.go': `package middleware

import (
	"fmt"
	"net/http"
	"time"

	"{{projectName}}/config"

	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

var limiters = make(map[string]*rate.Limiter)

func RateLimiter(cfg *config.Config) echo.MiddlewareFunc {
	// Try to use Redis for distributed rate limiting
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB})

	// Test Redis connection
	ctx := context.Background()
	_, err := rdb.Ping(ctx).Result()
	useRedis := err == nil

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			key := fmt.Sprintf("rate_limit:%s", ip)

			if useRedis {
				// Redis-based rate limiting
				pipe := rdb.Pipeline()
				incr := pipe.Incr(ctx, key)
				pipe.Expire(ctx, key, cfg.RateLimitDuration)
				_, err := pipe.Exec(ctx)
				
				if err != nil {
					return echo.NewHTTPError(http.StatusInternalServerError, "Rate limiter error")
				}

				count := incr.Val()
				if count > int64(cfg.RateLimitRequests) {
					return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded")
				}

				// Set rate limit headers
				c.Response().Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", cfg.RateLimitRequests))
				c.Response().Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", cfg.RateLimitRequests-int(count)))
				c.Response().Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(cfg.RateLimitDuration).Unix()))
			} else {
				// In-memory rate limiting fallback
				limiter, exists := limiters[ip]
				if !exists {
					limiter = rate.NewLimiter(rate.Every(cfg.RateLimitDuration/time.Duration(cfg.RateLimitRequests)), cfg.RateLimitRequests)
					limiters[ip] = limiter
				}

				if !limiter.Allow() {
					return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded")
				}
			}

			return next(c)
		}
	}
}
`,

    'middleware/error_handler.go': `package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func CustomHTTPErrorHandler(err error, c echo.Context) {
	code := http.StatusInternalServerError
	message := "Internal server error"
	
	if he, ok := err.(*echo.HTTPError); ok {
		code = he.Code
		message = fmt.Sprintf("%v", he.Message)
	}

	// Don't expose internal error details in production
	if code == http.StatusInternalServerError && c.Echo().Debug == false {
		message = "Internal server error"
	}

	// Send response
	if !c.Response().Committed {
		if c.Request().Method == http.MethodHead {
			c.NoContent(code)
		} else {
			c.JSON(code, map[string]interface{}{
				"error": message,
				"code":  code})
		}
	}
}
`,

    'middleware/request_id.go': `package middleware

import (
	"github.com/google/uuid"
)

func GenerateRequestID() string {
	return uuid.New().String()
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

    // Test files
    'handlers/auth_test.go': `package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"{{projectName}}/config"
	"{{projectName}}/database"
	"{{projectName}}/models"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB() (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = database.Migrate(db)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func TestRegister(t *testing.T) {
	// Setup
	e := echo.New()
	db, err := setupTestDB()
	assert.NoError(t, err)

	cfg := &config.Config{
		JWTSecret:           "test-secret",
		JWTAccessExpiration: time.Hour}

	logger, _ := zap.NewDevelopment()
	h := NewHandler(db, cfg, logger)

	// Test successful registration
	user := models.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User"}

	body, _ := json.Marshal(user)
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err = h.Register(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var response models.UserResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, user.Email, response.Email)
	assert.Equal(t, user.Name, response.Name)

	// Test duplicate email
	req = httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)

	err = h.Register(c)
	assert.Error(t, err)
	httpError := err.(*echo.HTTPError)
	assert.Equal(t, http.StatusConflict, httpError.Code)
}

func TestLogin(t *testing.T) {
	// Setup
	e := echo.New()
	db, err := setupTestDB()
	assert.NoError(t, err)

	cfg := &config.Config{
		JWTSecret:            "test-secret",
		JWTAccessExpiration:  time.Hour,
		JWTRefreshExpiration: 24 * time.Hour}

	logger, _ := zap.NewDevelopment()
	h := NewHandler(db, cfg, logger)

	// Create test user
	user := models.User{
		Email: "test@example.com",
		Name:  "Test User"}
	user.SetPassword("password123")
	db.Create(&user)

	// Test successful login
	loginReq := models.LoginRequest{
		Email:    "test@example.com",
		Password: "password123"}

	body, _ := json.Marshal(loginReq)
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err = h.Login(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.TokenResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.NotEmpty(t, response.AccessToken)
	assert.NotEmpty(t, response.RefreshToken)

	// Test invalid password
	loginReq.Password = "wrongpassword"
	body, _ = json.Marshal(loginReq)
	req = httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	c = e.NewContext(req, rec)

	err = h.Login(c)
	assert.Error(t, err)
	httpError := err.(*echo.HTTPError)
	assert.Equal(t, http.StatusUnauthorized, httpError.Code)
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

# TLS (optional)
TLS_ENABLED=false
TLS_CERT_FILE=
TLS_KEY_FILE=
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

.PHONY: build run dev test test-coverage clean deps deps-update swagger fmt lint security docker-build docker-run docker-stop install-tools
`,

    // README
    'README.md': `# {{projectName}}

A high-performance REST API built with Echo framework in Go.

## Features

- **Echo Framework**: High performance, minimalist web framework
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **GORM ORM**: Database abstraction with auto-migrations
- **Swagger Documentation**: Auto-generated API documentation
- **Request Validation**: Input validation with custom error messages
- **Structured Logging**: JSON logs with Zap
- **Rate Limiting**: Request throttling with Redis or in-memory fallback
- **WebSocket Support**: Real-time communication
- **CORS Support**: Configurable cross-origin requests
- **TLS Support**: Optional HTTPS with auto-TLS
- **Hot Reload**: Development with Air
- **Docker Support**: Containerized deployment
- **Testing**: Unit and integration tests with testify

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

### Users
- \`GET /api/v1/users\` - List users (admin)
- \`GET /api/v1/users/:id\` - Get user
- \`GET /api/v1/users/me\` - Get current user
- \`PUT /api/v1/users/me\` - Update current user
- \`DELETE /api/v1/users/:id\` - Delete user (admin)

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product
- \`POST /api/v1/products\` - Create product (admin)
- \`PUT /api/v1/products/:id\` - Update product (admin)
- \`DELETE /api/v1/products/:id\` - Delete product (admin)

### WebSocket
- \`WS /api/v1/ws\` - WebSocket connection

## Project Structure

\`\`\`
.
├── config/         # Configuration
├── database/       # Database connection and migrations
├── docs/          # Swagger documentation
├── handlers/      # HTTP handlers
├── middleware/    # HTTP middleware
├── models/        # Data models
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