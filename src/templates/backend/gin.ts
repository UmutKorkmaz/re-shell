import { BackendTemplate } from '../types';

export const ginTemplate: BackendTemplate = {
  id: 'gin',
  name: 'gin',
  displayName: 'Gin Framework',
  description: 'Fast HTTP web framework for Go with middleware support and JSON validation',
  language: 'go',
  framework: 'gin',
  version: '1.9.1',
  tags: ['go', 'gin', 'api', 'rest', 'middleware', 'performance'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation'],
  
  files: {
    // Go module configuration
    'go.mod': `module {{projectName}}

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/joho/godotenv v1.5.1
	github.com/go-playground/validator/v10 v10.16.0
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/swaggo/gin-swagger v1.6.0
	github.com/swaggo/swag v1.16.2
	github.com/swaggo/files v1.0.1
	github.com/sirupsen/logrus v1.9.3
	github.com/gin-contrib/cors v1.5.0
	github.com/gin-contrib/requestid v0.0.6
	github.com/gin-contrib/gzip v0.0.6
	github.com/ulule/limiter/v3 v3.11.2
	github.com/redis/go-redis/v9 v9.3.1
	gorm.io/gorm v1.25.5
	gorm.io/driver/postgres v1.5.4
	gorm.io/driver/mysql v1.5.2
	gorm.io/driver/sqlite v1.5.4
	golang.org/x/crypto v0.17.0
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/PuerkitoBio/purell v1.2.1 // indirect
	github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578 // indirect
	github.com/bytedance/sonic v1.10.2 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/chenzhuoyu/base64x v0.0.0-20230717121745-296ad89f973d // indirect
	github.com/chenzhuoyu/iasm v0.9.1 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/gin-contrib/sse v0.1.0 // indirect
	github.com/go-openapi/jsonpointer v0.20.2 // indirect
	github.com/go-openapi/jsonreference v0.20.4 // indirect
	github.com/go-openapi/spec v0.20.13 // indirect
	github.com/go-openapi/swag v0.22.7 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/google/uuid v1.5.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20231201235250-de7065d80cb9 // indirect
	github.com/jackc/pgx/v5 v5.5.1 // indirect
	github.com/jackc/puddle/v2 v2.2.1 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/cpuid/v2 v2.2.6 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-sqlite3 v1.14.19 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/pelletier/go-toml/v2 v2.1.1 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	github.com/ugorji/go/codec v1.2.12 // indirect
	golang.org/x/arch v0.6.0 // indirect
	golang.org/x/net v0.19.0 // indirect
	golang.org/x/sync v0.5.0 // indirect
	golang.org/x/sys v0.15.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	golang.org/x/tools v0.16.1 // indirect
	google.golang.org/protobuf v1.31.0 // indirect
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
	_ "{{projectName}}/docs" // swagger docs
	"{{projectName}}/middleware"
	"{{projectName}}/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title           {{projectName}} API
// @version         1.0
// @description     API server for {{projectName}} built with Gin framework
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
		log.Println("No .env file found")
	}

	// Initialize configuration
	cfg := config.New()

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize database
	db, err := database.Initialize(cfg)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Run migrations
	if err := database.Migrate(db); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	// Create Gin router
	router := gin.New()

	// Global middleware
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.CORS(cfg))
	router.Use(middleware.Gzip())
	router.Use(middleware.RateLimiter(cfg))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"time":   time.Now().UTC()})
	})

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API routes
	api := router.Group("/api/v1")
	{
		routes.RegisterAuthRoutes(api, db, cfg)
		routes.RegisterUserRoutes(api, db, cfg)
		routes.RegisterProductRoutes(api, db)
	}

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second}

	// Start server in goroutine
	go func() {
		log.Printf("Starting server on port %d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
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
		JWTSecret:          getEnv("JWT_SECRET", "your-secret-key"),
		JWTExpirationHours: getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
		
		// Redis
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),
		
		// Rate limiting
		RateLimitRequests: getEnvAsInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitDuration: time.Duration(getEnvAsInt("RATE_LIMIT_DURATION_MINUTES", 1)) * time.Minute,
		
		// CORS
		AllowedOrigins: []string{getEnv("ALLOWED_ORIGINS", "*")}}
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
`,

    // Database package
    'database/database.go': `package database

import (
	"fmt"
	"log"

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
	gormConfig := &gorm.Config{}
	if cfg.Environment == "development" {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Silent)
	}

	db, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connection established")
	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Product{},
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
	
	Email    string \`gorm:"uniqueIndex;not null" json:"email" binding:"required,email"\`
	Password string \`gorm:"not null" json:"-"\`
	Name     string \`gorm:"not null" json:"name" binding:"required,min=2,max=100"\`
	Role     string \`gorm:"default:user" json:"role"\`
	Active   bool   \`gorm:"default:true" json:"active"\`
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
	Email    string \`json:"email" binding:"required,email"\`
	Password string \`json:"password" binding:"required,min=6"\`
}

type RegisterRequest struct {
	Email    string \`json:"email" binding:"required,email"\`
	Password string \`json:"password" binding:"required,min=6"\`
	Name     string \`json:"name" binding:"required,min=2,max=100"\`
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
	
	Name        string  \`gorm:"not null" json:"name" binding:"required,min=1,max=200"\`
	Description string  \`json:"description"\`
	Price       float64 \`gorm:"not null" json:"price" binding:"required,min=0"\`
	Stock       int     \`gorm:"default:0" json:"stock" binding:"min=0"\`
	Active      bool    \`gorm:"default:true" json:"active"\`
}

type CreateProductRequest struct {
	Name        string  \`json:"name" binding:"required,min=1,max=200"\`
	Description string  \`json:"description"\`
	Price       float64 \`json:"price" binding:"required,min=0"\`
	Stock       int     \`json:"stock" binding:"min=0"\`
}

type UpdateProductRequest struct {
	Name        *string  \`json:"name,omitempty" binding:"omitempty,min=1,max=200"\`
	Description *string  \`json:"description,omitempty"\`
	Price       *float64 \`json:"price,omitempty" binding:"omitempty,min=0"\`
	Stock       *int     \`json:"stock,omitempty" binding:"omitempty,min=0"\`
	Active      *bool    \`json:"active,omitempty"\`
}
`,

    // Middleware
    'middleware/auth.go': `package middleware

import (
	"net/http"
	"strings"

	"{{projectName}}/config"
	"{{projectName}}/utils"

	"github.com/gin-gonic/gin"
)

func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		token := bearerToken[1]
		claims, err := utils.ValidateJWT(token, cfg.JWTSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("userRole", claims.Role)

		c.Next()
	}
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid role"})
			c.Abort()
			return
		}

		// Check if user has required role
		for _, role := range roles {
			if roleStr == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}
`,

    'middleware/cors.go': `package middleware

import (
	"{{projectName}}/config"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS(cfg *config.Config) gin.HandlerFunc {
	config := cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Request-ID"},
		ExposeHeaders:    []string{"Content-Length", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           12 * 3600, // 12 hours
	}

	return cors.New(config)
}
`,

    'middleware/logger.go': `package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func Logger() gin.HandlerFunc {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.WithFields(logrus.Fields{
			"timestamp":   param.TimeStamp.Format(time.RFC3339),
			"status_code": param.StatusCode,
			"latency":     param.Latency,
			"client_ip":   param.ClientIP,
			"method":      param.Method,
			"path":        param.Path,
			"request_id":  param.Request.Header.Get("X-Request-ID"),
			"error":       param.ErrorMessage}).Info("HTTP Request")

		return ""
	})
}

func Recovery() gin.HandlerFunc {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})

	return gin.RecoveryWithWriter(logger.Out)
}
`,

    'middleware/rate_limiter.go': `package middleware

import (
	"net/http"

	"{{projectName}}/config"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/ulule/limiter/v3"
	"github.com/ulule/limiter/v3/drivers/store/redis"
)

func RateLimiter(cfg *config.Config) gin.HandlerFunc {
	// Create Redis client
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB})

	// Create store
	store, err := redis.NewStoreWithOptions(client, limiter.StoreOptions{
		Prefix: "rate_limit"})
	if err != nil {
		// Fallback to memory store if Redis fails
		store = limiter.NewMemoryStore()
	}

	// Create rate limiter
	rate := limiter.Rate{
		Period: cfg.RateLimitDuration,
		Limit:  int64(cfg.RateLimitRequests)}
	
	instance := limiter.New(store, rate)

	return func(c *gin.Context) {
		context, err := instance.Get(c.Request.Context(), c.ClientIP())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Rate limiter error"})
			c.Abort()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", string(context.Limit))
		c.Header("X-RateLimit-Remaining", string(context.Remaining))
		c.Header("X-RateLimit-Reset", string(context.Reset))

		if context.Reached {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
			c.Abort()
			return
		}

		c.Next()
	}
}
`,

    'middleware/common.go': `package middleware

import (
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"
)

func RequestID() gin.HandlerFunc {
	return requestid.New()
}

func Gzip() gin.HandlerFunc {
	return gzip.Gzip(gzip.DefaultCompression)
}
`,

    // Routes
    'routes/auth.go': `package routes

import (
	"net/http"

	"{{projectName}}/config"
	"{{projectName}}/models"
	"{{projectName}}/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterAuthRoutes(router *gin.RouterGroup, db *gorm.DB, cfg *config.Config) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", register(db))
		auth.POST("/login", login(db, cfg))
	}
}

// @Summary Register a new user
// @Description Create a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param user body models.RegisterRequest true "User registration data"
// @Success 201 {object} models.UserResponse
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /auth/register [post]
func register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check if user exists
		var existingUser models.User
		if err := db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}

		// Create new user
		user := models.User{
			Email: req.Email,
			Name:  req.Name}

		if err := user.SetPassword(req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		c.JSON(http.StatusCreated, user.ToResponse())
	}
}

// @Summary Login user
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body models.LoginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /auth/login [post]
func login(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Find user
		var user models.User
		if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Check password
		if !user.CheckPassword(req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}

		// Check if user is active
		if !user.Active {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Account is disabled"})
			return
		}

		// Generate JWT token
		token, err := utils.GenerateJWT(user.ID, user.Email, user.Role, cfg.JWTSecret, cfg.JWTExpirationHours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user":  user.ToResponse()})
	}
}
`,

    'routes/user.go': `package routes

import (
	"net/http"
	"strconv"

	"{{projectName}}/config"
	"{{projectName}}/middleware"
	"{{projectName}}/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterUserRoutes(router *gin.RouterGroup, db *gorm.DB, cfg *config.Config) {
	users := router.Group("/users")
	users.Use(middleware.Auth(cfg))
	{
		users.GET("", middleware.RequireRole("admin"), listUsers(db))
		users.GET("/:id", getUser(db))
		users.GET("/me", getCurrentUser(db))
		users.PUT("/me", updateCurrentUser(db))
		users.DELETE("/:id", middleware.RequireRole("admin"), deleteUser(db))
	}
}

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
func listUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		if err := db.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}

		response := make([]models.UserResponse, len(users))
		for i, user := range users {
			response[i] = user.ToResponse()
		}

		c.JSON(http.StatusOK, response)
	}
}

// @Summary Get user by ID
// @Description Get a specific user by ID
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Success 200 {object} models.UserResponse
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /users/{id} [get]
func getUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}

		var user models.User
		if err := db.First(&user, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		c.JSON(http.StatusOK, user.ToResponse())
	}
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
func getCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		c.JSON(http.StatusOK, user.ToResponse())
	}
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
func updateCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Remove fields that shouldn't be updated
		delete(updates, "id")
		delete(updates, "email")
		delete(updates, "role")
		delete(updates, "password")

		if err := db.Model(&user).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}

		c.JSON(http.StatusOK, user.ToResponse())
	}
}

// @Summary Delete user
// @Description Delete a user (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "User ID"
// @Success 204
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /users/{id} [delete]
func deleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}

		result := db.Delete(&models.User{}, id)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
			return
		}

		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		c.Status(http.StatusNoContent)
	}
}
`,

    'routes/product.go': `package routes

import (
	"net/http"
	"strconv"

	"{{projectName}}/middleware"
	"{{projectName}}/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterProductRoutes(router *gin.RouterGroup, db *gorm.DB) {
	products := router.Group("/products")
	{
		products.GET("", listProducts(db))
		products.GET("/:id", getProduct(db))
		products.POST("", middleware.RequireRole("admin"), createProduct(db))
		products.PUT("/:id", middleware.RequireRole("admin"), updateProduct(db))
		products.DELETE("/:id", middleware.RequireRole("admin"), deleteProduct(db))
	}
}

// @Summary List all products
// @Description Get a list of all products with pagination
// @Tags products
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} map[string]interface{}
// @Router /products [get]
func listProducts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		offset := (page - 1) * limit

		var products []models.Product
		var total int64

		db.Model(&models.Product{}).Where("active = ?", true).Count(&total)
		if err := db.Where("active = ?", true).Offset(offset).Limit(limit).Find(&products).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":  products,
			"total": total,
			"page":  page,
			"limit": limit})
	}
}

// @Summary Get product by ID
// @Description Get a specific product by ID
// @Tags products
// @Accept json
// @Produce json
// @Param id path int true "Product ID"
// @Success 200 {object} models.Product
// @Failure 404 {object} map[string]string
// @Router /products/{id} [get]
func getProduct(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		var product models.Product
		if err := db.First(&product, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		c.JSON(http.StatusOK, product)
	}
}

// @Summary Create a new product
// @Description Create a new product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param product body models.CreateProductRequest true "Product data"
// @Success 201 {object} models.Product
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /products [post]
func createProduct(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CreateProductRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		product := models.Product{
			Name:        req.Name,
			Description: req.Description,
			Price:       req.Price,
			Stock:       req.Stock,
			Active:      true}

		if err := db.Create(&product).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
			return
		}

		c.JSON(http.StatusCreated, product)
	}
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
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /products/{id} [put]
func updateProduct(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		var product models.Product
		if err := db.First(&product, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		var req models.UpdateProductRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		if req.Stock != nil {
			product.Stock = *req.Stock
		}
		if req.Active != nil {
			product.Active = *req.Active
		}

		if err := db.Save(&product).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
			return
		}

		c.JSON(http.StatusOK, product)
	}
}

// @Summary Delete product
// @Description Delete a product (admin only)
// @Tags products
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "Product ID"
// @Success 204
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /products/{id} [delete]
func deleteProduct(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		result := db.Delete(&models.Product{}, id)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete product"})
			return
		}

		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		c.Status(http.StatusNoContent)
	}
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

func GenerateJWT(userID uint, email, role, secret string, expirationHours int) (string, error) {
	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * time.Duration(expirationHours))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now())}}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateJWT(tokenString, secret string) (*JWTClaims, error) {
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

    // Air configuration for hot reload
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
  include_file = []
  kill_delay = "0s"
  log = "build-errors.log"
  poll = false
  poll_interval = 0
  post_cmd = []
  pre_cmd = []
  rerun = false
  rerun_delay = 500
  send_interrupt = false
  stop_on_error = false

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  main_only = false
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
  keep_scroll = true
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
migrate-up:
	migrate -database "postgres://postgres:password@localhost:5432/$(APP_NAME)?sslmode=disable" -path db/migrations up

migrate-down:
	migrate -database "postgres://postgres:password@localhost:5432/$(APP_NAME)?sslmode=disable" -path db/migrations down

# Install development tools
install-tools:
	go install github.com/cosmtrek/air@latest
	go install github.com/swaggo/swag/cmd/swag@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

.PHONY: build run dev test test-coverage clean deps deps-update swagger fmt lint docker-build docker-run docker-stop migrate-up migrate-down install-tools
`,

    // README
    'README.md': `# {{projectName}}

A high-performance REST API built with Gin framework in Go.

## Features

- **Gin Framework**: Fast HTTP web framework
- **JWT Authentication**: Secure token-based authentication
- **GORM ORM**: Database abstraction with migrations
- **Swagger Documentation**: Auto-generated API documentation
- **Rate Limiting**: Request throttling with Redis
- **Structured Logging**: JSON logs with Logrus
- **CORS Support**: Configurable cross-origin requests
- **Hot Reload**: Development with Air
- **Docker Support**: Containerized deployment
- **Testing**: Unit and integration tests

## Requirements

- Go 1.21+
- PostgreSQL (or MySQL/SQLite)
- Redis (for rate limiting)
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

## Project Structure

\`\`\`
.
├── config/         # Configuration
├── database/       # Database connection and migrations
├── docs/          # Swagger documentation
├── middleware/    # HTTP middleware
├── models/        # Data models
├── routes/        # API routes
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