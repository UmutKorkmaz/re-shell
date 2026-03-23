import { BackendTemplate } from '../types';

export const playScalaTemplate: BackendTemplate = {
  id: 'play-scala',
  name: 'play-scala',
  displayName: 'Play Framework (Scala)',
  description: 'High-velocity web framework for Scala with reactive, type-safe, and non-blocking I/O',
  language: 'scala',
  framework: 'play',
  version: '1.0.0',
  tags: ['scala', 'play', 'reactive', 'akka', 'websockets', 'type-safe'],
  port: 9000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

  files: {
    // Build configuration
    'build.sbt': `name := "{{projectNamePascal}}"

version := "1.0.0"

lazy val root = (project in file("."))
  .enablePlugins(PlayScala)
  .settings(
    scalaVersion := "2.13.12",
    scalacOptions ++= Seq(
      "-feature",
      "-deprecation",
      "-Xfatal-warnings"
    ),
    libraryDependencies ++= Seq(
      guice,
      ws,
      "org.playframework" %% "play-json" % "2.10.0",
      "com.typesafe.play" %% "play-slick" % "5.1.0",
      "com.typesafe.slick" %% "slick" % "3.4.1",
      "com.typesafe.slick" %% "slick-hikaricp" % "3.4.1",
      "com.h2database" % "h2" % "2.2.224",
      "com.github.jwt-scala" %% "jwt-play-json" % "9.4.3",
      "com.typesafe.play" %% "play-mailer" % "8.0.1",
      "com.typesafe.akka" %% "akka-testkit" % "2.8.5" % Test,
      specs2 % Test,
    ),
  )

// Add SbtWeb settings for asset compilation
pipelineStages := Seq(scalaJsBundler)
`,

    // Project plugins
    'project/plugins.sbt': `// The Play plugin
addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.9.0")

// Scala.js plugin (for optional frontend)
addSbtPlugin("org.scala-js" % "sbt-scalajs" % "1.13.2")
`,

    // Project build properties
    'project/build.properties': `sbt.version=1.9.7
`,

    // Routes file
    'conf/routes': `# Routes
# This file defines all application routes (Higher priority routes first)
# ~~~~

# An example controller showing a sample home page
GET     /                           controllers.HomeController.index()

# Health check
GET     /health                     controllers.HealthController.health()

# API v1 routes
+api/v1/auth
POST    /api/v1/auth/register       controllers.AuthController.register()
POST    /api/v1/auth/login          controllers.AuthController.login()
GET     /api/v1/auth/me             controllers.AuthController.me()

+api/v1/users
GET     /api/v1/users               controllers.UserController.list()
GET     /api/v1/users/:id           controllers.UserController.get(id: String)
DELETE  /api/v1/users/:id           controllers.UserController.delete(id: String)

+api/v1/products
GET     /api/v1/products            controllers.ProductController.list()
GET     /api/v1/products/:id        controllers.ProductController.get(id: String)
POST    /api/v1/products            controllers.ProductController.create()
PUT     /api/v1/products/:id        controllers.ProductController.update(id: String)
DELETE  /api/v1/products/:id        controllers.ProductController.delete(id: String)

# Map static resources from the /public folder to the /assets URL path
GET     /assets/*file               controllers.Assets.versioned(path="/public", file: Asset)
`,

    // Application configuration
    'conf/application.conf': `# Application configuration
# ~~~~

# Secret key
# ~~~~~
# The secret key is used to secure cryptographics functions.
play.http.secret.key = "change-this-secret-in-production"

# Application configuration
play.application.loader = "{{projectNamePascal}}Loader"

# Database configuration
# ~~~~~
# Default database configuration
db.default.driver = "org.h2.Driver"
db.default.url = "jdbc:h2:mem:play;MODE=PostgreSQL"
db.default.username = "sa"
db.default.password = ""

# JPA configuration
# jpa.default=defaultPersistenceUnit

# JWT configuration
jwt.secret = "change-this-secret-in-production"
jwt.expiration = 604800 # 7 days in seconds

# CORS configuration
play.filters.cors {
  pathPrefixes = ["/"]
  allowedOrigins = ["*"]
  allowedHttpMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  allowedHttpHeaders = ["Accept", "Authorization", "Content-Type", "X-Requested-With"]
  preflightMaxAge = 3 days
}

# CSRF configuration
# play.filters.csrf.enabled = false

# Evolutions
# ~~~~~
# You can disable evolutions if needed
# play.evolutions.enabled = false
# play.evolutions.autoApply = true

# Log configuration
# ~~~~~
logger.root = INFO
logger.play = INFO
logger.application = DEBUG

# Play mailer
# ~~~~~
play.mailer {
  host = "smtp.example.com"
  port = 587
  user = "user"
  password = "password"
  from = "{{projectName}} <noreply@example.com>"
}
`,

    // Logback configuration
    'conf/logback.xml': `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <conversionRule conversionWord="coloredLevel" converterClass="play.api.libs.logback.ColoredLevel" />

  <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
    <encoder>
      <pattern>%coloredLevel %logger{15} - %message%n%xException{20}</pattern>
    </encoder>
  </appender>

  <logger name="play" level="INFO" />
  <logger name="application" level="DEBUG" />

  <root level="INFO">
    <appender-ref ref="STDOUT" />
  </root>
</configuration>
`,

    // Main application loader
    'app/{{projectNameSnake}}Loader.scala': `import play.api.ApplicationLoader
import play.api.Configuration
import play.api.inject._
import play.api.routing.Router
import router.Routes

class {{projectNamePascal}}Loader extends ApplicationLoader {
  def load(context: ApplicationLoader.Context) = {
    new {{projectNamePascal}}AppComponents(context).application
  }
}

class {{projectNamePascal}}AppComponents(context: ApplicationLoader.Context)
  extends BuiltInComponentsFromContext(context)
  with play.filters.HttpFiltersComponents
  with play.api.i18n.I18nComponents
  with play.api.mvc.EssentialFilter {

  lazy val router: Router = new Routes(httpErrorHandler, homeController, healthController, authController, userController, productController, assets)

  lazy val homeController = new controllers.HomeController(controllerComponents)
  lazy val healthController = new controllers.HealthController(controllerComponents)
  lazy val authController = new controllers.AuthController(controllerComponents)
  lazy val userController = new controllers.UserController(controllerComponents)
  lazy val productController = new controllers.ProductController(controllerComponents)

  lazy val assets = new controllers.Assets(httpErrorHandler)

  override lazy val httpFilters = Seq(corsFilter)
}
`,

    // Health controller
    'app/controllers/HealthController.scala': `package controllers

import javax.inject._
import play.api.mvc._
import play.api.libs.json.Json

@Singleton
class HealthController @Inject()(val controllerComponents: ControllerComponents)
  extends BaseController {

  def health() = Action { implicit request: Request[AnyContent] =>
    Ok(Json.obj(
      "status" -> "healthy",
      "timestamp" -> java.time.Instant.now().toString(),
      "version" -> "1.0.0"
    ))
  }
}
`,

    // Home controller
    'app/controllers/HomeController.scala': `package controllers

import javax.inject._
import play.api.mvc._

@Singleton
class HomeController @Inject()(val controllerComponents: ControllerComponents)
  extends BaseController {

  def index() = Action { implicit request: Request[AnyContent] =>
    Ok(views.html.index("{{projectName}} API"))
  }
}
`,

    // Models
    'app/models/User.scala': `package models

import play.api.libs.json._
import java.time.Instant

case class User(
  id: String,
  email: String,
  password: String,
  name: String,
  role: String,
  createdAt: Instant,
  updatedAt: Instant
)

object User {
  implicit val formats: Format[User] = Json.format[User]

  def toResponse(user: User): JsObject = Json.obj(
    "id" -> user.id,
    "email" -> user.email,
    "name" -> user.name,
    "role" -> user.role,
    "createdAt" -> user.createdAt.toString,
    "updatedAt" -> user.updatedAt.toString
  )
}

case class UserCreate(
  email: String,
  password: String,
  name: String
)

object UserCreate {
  implicit val formats: Format[UserCreate] = Json.format[UserCreate]
}

case class UserLogin(
  email: String,
  password: String
)

object UserLogin {
  implicit val formats: Format[UserLogin] = Json.format[UserLogin]
}
`,

    'app/models/Product.scala': `package models

import play.api.libs.json._
import java.time.Instant

case class Product(
  id: String,
  name: String,
  description: Option[String],
  price: BigDecimal,
  stock: Int,
  createdAt: Instant,
  updatedAt: Instant
)

object Product {
  implicit val formats: Format[Product] = Json.format[Product]
}

case class ProductCreate(
  name: String,
  description: Option[String],
  price: BigDecimal,
  stock: Int
)

object ProductCreate {
  implicit val formats: Format[ProductCreate] = Json.format[ProductCreate]
}

case class ProductUpdate(
  name: Option[String],
  description: Option[String],
  price: Option[BigDecimal],
  stock: Option[Int]
)

object ProductUpdate {
  implicit val formats: Format[ProductUpdate] = Json.format[ProductUpdate]
}
`,

    // Database repository
    'app/repository/Database.scala': `package repository

import models._
import play.api.db._
import javax.inject._
import scala.concurrent.{Future, ExecutionContext}
import java.time.Instant
import java.util.UUID

@Singleton
class UserRepository @Inject()(dbApi: DBApi)(implicit ec: ExecutionContext) {
  private val db = dbApi.database("default")

  private var users = Map[String, User]()

  // Initialize with admin user
  {
    val adminId = UUID.randomUUID().toString
    val adminPassword = hashPassword("admin123")
    users = users + (adminId -> User(
      id = adminId,
      email = "admin@example.com",
      password = adminPassword,
      name = "Admin User",
      role = "admin",
      createdAt = Instant.now(),
      updatedAt = Instant.now()
    ))
    println(s"✅ Database initialized with admin user: admin@example.com / admin123")
  }

  private def hashPassword(password: String): String = {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    val hash = digest.digest(password.getBytes("UTF-8"))
    hash.map("%02x".format(_)).mkString
  }

  def findByEmail(email: String): Future[Option[User]] = Future {
    users.values.find(u => u.email == email)
  }

  def findById(id: String): Future[Option[User]] = Future {
    users.get(id).map(u => u.copy(password = ""))
  }

  def list(): Future[Seq[User]] = Future {
    users.values.map(u => u.copy(password = "")).toSeq
  }

  def create(user: UserCreate): Future[User] = Future {
    val id = UUID.randomUUID().toString
    val hashedPassword = hashPassword(user.password)
    val newUser = User(
      id = id,
      email = user.email,
      password = hashedPassword,
      name = user.name,
      role = "user",
      createdAt = Instant.now(),
      updatedAt = Instant.now()
    )
    users = users + (id -> newUser)
    newUser.copy(password = "")
  }

  def update(id: String, updates: User): Future[Option[User]] = Future {
    users.get(id).map { user =>
      val updated = user.copy(
        name = updates.name,
        updatedAt = Instant.now()
      )
      users = users + (id -> updated)
      updated.copy(password = "")
    }
  }

  def delete(id: String): Future[Boolean] = Future {
    users.get(id).exists { _ =>
      users = users - id
      true
    }
  }

  def verifyPassword(email: String, password: String): Future[Option[User]] = Future {
    users.values.find(u => u.email == email).filter { user =>
      val hashedPassword = hashPassword(password)
      user.password == hashedPassword
    }.map(_.copy(password = ""))
  }
}

@Singleton
class ProductRepository @Inject()(dbApi: DBApi)(implicit ec: ExecutionContext) {
  private var products = Map[String, Product]()

  // Initialize with sample products
  {
    val now = Instant.now()
    products = products + ("1" -> Product(
      id = "1",
      name = "Sample Product 1",
      description = Some("This is a sample product"),
      price = BigDecimal("29.99"),
      stock = 100,
      createdAt = now,
      updatedAt = now
    ))
    products = products + ("2" -> Product(
      id = "2",
      name = "Sample Product 2",
      description = Some("Another sample product"),
      price = BigDecimal("49.99"),
      stock = 50,
      createdAt = now,
      updatedAt = now
    ))
    println("✅ Database initialized with sample products")
  }

  def list(): Future[Seq[Product]] = Future(products.values.toSeq)

  def findById(id: String): Future[Option[Product]] = Future(products.get(id))

  def create(product: ProductCreate): Future[Product] = Future {
    val id = UUID.randomUUID().toString
    val now = Instant.now()
    val newProduct = Product(
      id = id,
      name = product.name,
      description = product.description,
      price = product.price,
      stock = product.stock,
      createdAt = now,
      updatedAt = now
    )
    products = products + (id -> newProduct)
    newProduct
  }

  def update(id: String, updates: ProductUpdate): Future[Option[Product]] = Future {
    products.get(id).map { product =>
      val updated = product.copy(
        name = updates.name.getOrElse(product.name),
        description = updates.description.orElse(product.description),
        price = updates.price.getOrElse(product.price),
        stock = updates.stock.getOrElse(product.stock),
        updatedAt = Instant.now()
      )
      products = products + (id -> updated)
      updated
    }
  }

  def delete(id: String): Future[Boolean] = Future {
    products.get(id).exists { _ =>
      products = products - id
      true
    }
  }
}
`,

    // Auth service
    'app/services/AuthService.scala': `package services

import models._
import repository.UserRepository
import pdi.jwt._
import javax.inject._
import scala.concurrent.{Future, ExecutionContext}
import play.api.Configuration

@Singleton
class AuthService @Inject()(
  userRepo: UserRepository,
  config: Configuration
)(implicit ec: ExecutionContext) {

  private val secretKey = config.get[String]("jwt.secret")
  private val expiration = config.get[Int]("jwt.expiration")

  def register(userCreate: UserCreate): Future[(User, String)] = {
    userRepo.create(userCreate).map { user =>
      val token = createToken(user)
      user -> token
    }
  }

  def login(userLogin: UserLogin): Future[Option[(User, String)]] = {
    userRepo.verifyPassword(userLogin.email, userLogin.password).map {
      case Some(user) =>
        val token = createToken(user.copy(password = ""))
        Some(user.copy(password = "") -> token)
      case None => None
    }
  }

  private def createToken(user: User): String = {
    val claim = JwtClaim(
      subject = Some(user.id),
      expiration = Some(System.currentTimeMillis() / 1000 + expiration)
    ) + ("email", user.email) + ("role", user.role)

    Jwt.encode(claim, secretKey, JwtAlgorithm.HS256)
  }

  def validateToken(token: String): Option[JwtClaim] = {
    Jwt.decode(token, secretKey, Seq(JwtAlgorithm.HS256)).toOption
  }

  def getUserIdFromToken(token: String): Option[String] = {
    validateToken(token).flatMap(_.subject)
  }
}
`,

    // Auth action
    'app/actions/AuthenticatedAction.scala': `package actions

import play.api.mvc._
import play.api.libs.json._
import services.AuthService
import scala.concurrent.{Future, ExecutionContext}
import javax.inject._

class AuthenticatedRequest[A](
  val userId: String,
  val userEmail: String,
  val userRole: String,
  request: Request[A]
) extends WrappedRequest[A](request)

@Singleton
class AuthenticatedAction @Inject()(
  authService: AuthService,
  parser: BodyParsers.Default
)(implicit ec: ExecutionContext) extends ActionBuilderImpl[AuthenticatedRequest, AnyContent](parser) {

  override def invokeBlock[A](request: Request[A], block: AuthenticatedRequest[A] => Future[Result]): Future[Result] = {
    request.headers.get("Authorization") match {
      case Some(tokenHeader) if tokenHeader.startsWith("Bearer ") =>
        val token = tokenHeader.substring(7)
        authService.validateToken(token) match {
          case Some(claim) =>
            val userId = claim.subject.getOrElse("")
            val email = claim.toJson.as[JsObject].value.get("email").map(_.as[String]).getOrElse("")
            val role = claim.toJson.as[JsObject].value.get("role").map(_.as[String]).getOrElse("user")
            block(new AuthenticatedRequest(userId, email, role, request))

          case None =>
            Future.successful(Results.Unauthorized(Json.obj("error" -> "Invalid token")))
        }

      case _ =>
        Future.successful(Results.Unauthorized(Json.obj("error" -> "Missing Authorization header")))
    }
  }
}

@Singleton
class AdminAction @Inject()(
  authenticatedAction: AuthenticatedAction,
  parser: BodyParsers.Default
)(implicit ec: ExecutionContext) extends ActionBuilderImpl[AuthenticatedRequest, AnyContent](parser) {

  override def invokeBlock[A](request: Request[A], block: AuthenticatedRequest[A] => Future[Result]): Future[Result] = {
    authenticatedAction.invokeBlock(request, { req =>
      if (req.userRole == "admin") {
        block(req)
      } else {
        Future.successful(Results.Forbidden(Json.obj("error" -> "Admin access required")))
      }
    })
  }
}
`,

    // Controllers
    'app/controllers/AuthController.scala': `package controllers

import javax.inject._
import play.api.mvc._
import play.api.libs.json._
import models._
import services.AuthService
import actions.AuthenticatedAction
import scala.concurrent.{ExecutionContext, Future}

@Singleton
class AuthController @Inject()(
  val controllerComponents: ControllerComponents,
  authService: AuthService,
  authenticatedAction: AuthenticatedAction
)(implicit ec: ExecutionContext) extends BaseController {

  def register() = Action.async(parse.json) { implicit request =>
    request.body.validate[UserCreate].fold(
      errors => Future.successful(BadRequest(Json.obj("error" -> "Invalid data"))),
      userCreate =>
        authService.register(userCreate).map { case (user, token) =>
          Created(Json.obj(
            "token" -> token,
            "user" -> User.toResponse(user)
          ))
        }
    )
  }

  def login() = Action.async(parse.json) { implicit request =>
    request.body.validate[UserLogin].fold(
      errors => Future.successful(BadRequest(Json.obj("error" -> "Invalid data"))),
      userLogin =>
        authService.login(userLogin).map {
          case Some((user, token)) =>
            Ok(Json.obj(
              "token" -> token,
              "user" -> User.toResponse(user)
            ))
          case None =>
            Unauthorized(Json.obj("error" -> "Invalid credentials"))
        }
    )
  }

  def me() = authenticatedAction.async { implicit request =>
    Ok(Json.obj(
      "userId" -> request.userId,
      "email" -> request.userEmail,
      "role" -> request.userRole
    ))
  }
}
`,

    'app/controllers/UserController.scala': `package controllers

import javax.inject._
import play.api.mvc._
import play.api.libs.json._
import models._
import repository.UserRepository
import actions.{AuthenticatedAction, AdminAction}
import scala.concurrent.{ExecutionContext, Future}

@Singleton
class UserController @Inject()(
  val controllerComponents: ControllerComponents,
  userRepo: UserRepository,
  adminAction: AdminAction,
  authenticatedAction: AuthenticatedAction
)(implicit ec: ExecutionContext) extends BaseController {

  def list() = adminAction.async { implicit request =>
    userRepo.list().map { users =>
      Ok(Json.obj("users" -> Json.arr(users.map(User.toResponse)), "count" -> users.size))
    }
  }

  def get(id: String) = authenticatedAction.async { implicit request =>
    userRepo.findById(id).map {
      case Some(user) => Ok(Json.obj("user" -> User.toResponse(user)))
      case None => NotFound(Json.obj("error" -> "User not found"))
    }
  }

  def delete(id: String) = adminAction.async { implicit request =>
    userRepo.delete(id).map {
      case true => NoContent
      case false => NotFound(Json.obj("error" -> "User not found"))
    }
  }
}
`,

    'app/controllers/ProductController.scala': `package controllers

import javax.inject._
import play.api.mvc._
import play.api.libs.json._
import models._
import repository.ProductRepository
import actions.AdminAction
import scala.concurrent.{ExecutionContext, Future}

@Singleton
class ProductController @Inject()(
  val controllerComponents: ControllerComponents,
  productRepo: ProductRepository,
  adminAction: AdminAction
)(implicit ec: ExecutionContext) extends BaseController {

  def list() = Action.async { implicit request =>
    productRepo.list().map { products =>
      Ok(Json.obj("products" -> Json.toJson(products), "count" -> products.size))
    }
  }

  def get(id: String) = Action.async { implicit request =>
    productRepo.findById(id).map {
      case Some(product) => Ok(Json.obj("product" -> product))
      case None => NotFound(Json.obj("error" -> "Product not found"))
    }
  }

  def create() = adminAction.async(parse.json) { implicit request =>
    request.body.validate[ProductCreate].fold(
      errors => Future.successful(BadRequest(Json.obj("error" -> "Invalid data"))),
      productCreate =>
        productRepo.create(productCreate).map { product =>
          Created(Json.obj("product" -> product))
        }
    )
  }

  def update(id: String) = adminAction.async(parse.json) { implicit request =>
    request.body.validate[ProductUpdate].fold(
      errors => Future.successful(BadRequest(Json.obj("error" -> "Invalid data"))),
      productUpdate =>
        productRepo.update(id, productUpdate).map {
          case Some(product) => Ok(Json.obj("product" -> product))
          case None => NotFound(Json.obj("error" -> "Product not found"))
        }
    )
  }

  def delete(id: String) = adminAction.async { implicit request =>
    productRepo.delete(id).map {
      case true => NoContent
      case false => NotFound(Json.obj("error" -> "Product not found"))
    }
  }
}
`,

    // Views
    'app/views/index.scala.html': `@(title: String)

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@title</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
        }
        h1 { color: #333; }
        .endpoint {
            background: #f5f5f5;
            padding: 0.5rem;
            margin: 0.25rem 0;
            border-radius: 4px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <h1>Welcome to @title</h1>
    <p>A REST API built with Play Framework and Scala</p>

    <h2>API Endpoints</h2>
    <div class="endpoint">GET /health - Health check</div>
    <div class="endpoint">POST /api/v1/auth/register - Register user</div>
    <div class="endpoint">POST /api/v1/auth/login - Login user</div>
    <div class="endpoint">GET /api/v1/products - List products</div>
    <div class="endpoint">GET /api/v1/products/:id - Get product</div>
    <div class="endpoint">POST /api/v1/products - Create product (admin)</div>
    <div class="endpoint">PUT /api/v1/products/:id - Update product (admin)</div>
    <div class="endpoint">DELETE /api/v1/products/:id - Delete product (admin)</div>

    <h2>Default Credentials</h2>
    <p>Email: admin@example.com</p>
    <p>Password: admin123</p>
</body>
</html>
`,

    // Environment file
    '.env.example': `# Play Framework configuration
# Run with: sbt run

# Server configuration
# http.port=9000

# JWT secret (change in production!)
# jwt.secret=change-this-secret-in-production

# Database
# db.default.url="jdbc:h2:mem:play"
# db.default.username=sa
# db.default.password=""

# CORS
# play.filters.cors.allowedOrigins=["http://localhost:3000"]
`,

    // Dockerfile
    'Dockerfile': `FROM hseeberger/scala-sbt:eclipse-temurin-17-alpine

WORKDIR /app

# Copy build files
COPY build.sbt project/ ./

# Cache dependencies
RUN sbt compile

# Copy source
COPY . .

# Expose port
EXPOSE 9000

# Run application
CMD ["sbt", "run"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "9000:9000"
    environment:
      - JWT_SECRET=change-this-secret
    restart: unless-stopped
`,

    // Tests
    'test/controllers/AuthControllerSpec.scala': `package controllers

import org.scalatestplus.play._
import org.scalatestplus.play.guice._
import play.api.test._
import play.api.test.Helpers._
import play.api.libs.json._

class AuthControllerSpec extends PlaySpec with GuiceOneAppPerTest with Injecting {

  "AuthController" should {

    "register a new user" in {
      val controller = inject[AuthController]
      val request = FakeRequest(POST, "/api/v1/auth/register")
        .withJsonBody(Json.obj(
          "email" -> "test@example.com",
          "password" -> "password123",
          "name" -> "Test User"
        ))

      val result = call(controller.register(), request)

      status(result) mustBe CREATED
      val json = contentAsJson(result)
      (json  "token").asOpt[String] mustBe defined
      (json  "user"  "email").as[String] mustBe "test@example.com"
    }

    "login with valid credentials" in {
      val controller = inject[AuthController]
      val request = FakeRequest(POST, "/api/v1/auth/login")
        .withJsonBody(Json.obj(
          "email" -> "admin@example.com",
          "password" -> "admin123"
        ))

      val result = call(controller.login(), request)

      status(result) mustBe OK
      val json = contentAsJson(result)
      (json  "token").asOpt[String] mustBe defined
    }
  }
}
`,

    // README
    'README.md': `# {{projectName}}

A high-velocity REST API built with Play Framework and Scala.

## Features

- **Play Framework**: Reactive web framework for Scala
- **Type-Safe**: Compile-time safety with Scala's type system
- **Non-blocking I/O**: Built on Akka for async processing
- **JWT Authentication**: Secure token-based auth
- **Slick**: Functional relational mapping for database
- **H2 Database**: In-memory database (switchable to PostgreSQL)
- **CORS Support**: Cross-origin resource sharing
- **Docker Ready**: Containerized deployment

## Requirements

- Java 17+
- Scala 2.13
- Sbt 1.9+

## Quick Start

1. Run the application:
   \`\`\`bash
   sbt run
   \`\`\`

2. Visit http://localhost:9000

## Available Commands

\`\`\`bash
sbt run              # Run in development
sbt compile          # Compile the project
sbt test             # Run tests
sbt dist             # Create distributable package
sbt "stage"          # Stage for production
\`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`GET /api/v1/auth/me\` - Get current user

### Users
- \`GET /api/v1/users\` - List all users (admin only)
- \`GET /api/v1/users/:id\` - Get user by ID
- \`DELETE /api/v1/users/:id\` - Delete user (admin only)

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
├── app/
│   ├── controllers/    # Request handlers
│   ├── models/         # Data models
│   ├── repository/     # Database layer
│   ├── services/       # Business logic
│   ├── actions/        # Custom actions
│   └── views/          # Templates
├── conf/
│   ├── application.conf # Configuration
│   ├── routes          # URL routing
│   └── logback.xml     # Logging
├── project/            # Sbt configuration
└── test/               # Tests
\`\`\`

## Play Framework Features

- **Hot Reload**: Auto-reload on code changes in development
- **Type-Safe Routes**: Compile-time checked routing
- **Async/Non-blocking**: Built on Akka for scalability
- **WebSocket Support**: Real-time communication
- **I18n Support**: Built-in internationalization
- **Asset Compilation**: CoffeeScript, LESS, Sass support

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 9000:9000 {{projectName}}
\`\`\`

## License

MIT
`
  }
};
