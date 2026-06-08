import { BackendTemplate } from '../types';

export const akkaHttpTemplate: BackendTemplate = {
  id: 'akka-http',
  name: 'akka-http',
  displayName: 'Akka HTTP',
  description: 'Modern actor-based toolkit for building REST APIs in Scala',
  language: 'scala',
  framework: 'akka-http',
  version: '10.5.3',
  tags: ['scala', 'akka', 'actor', 'reactive', 'api', 'rest', 'jvm'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'streaming'],

  files: {
    // SBT build configuration
    'build.sbt': `name := "{{projectName}}"

version := "0.1.0"

scalaVersion := "2.13.12"

val AkkaVersion = "2.8.5"
val AkkaHttpVersion = "10.5.3"
val SlickVersion = "3.5.0"
val CirceVersion = "0.14.6"

libraryDependencies ++= Seq(
  // Akka
  "com.typesafe.akka" %% "akka-actor-typed" % AkkaVersion,
  "com.typesafe.akka" %% "akka-stream" % AkkaVersion,
  "com.typesafe.akka" %% "akka-http" % AkkaHttpVersion,
  "com.typesafe.akka" %% "akka-http-spray-json" % AkkaHttpVersion,

  // JSON with Circe
  "de.heikoseeberger" %% "akka-http-circe" % "1.39.2",
  "io.circe" %% "circe-core" % CirceVersion,
  "io.circe" %% "circe-generic" % CirceVersion,
  "io.circe" %% "circe-parser" % CirceVersion,

  // Database
  "com.typesafe.slick" %% "slick" % SlickVersion,
  "com.typesafe.slick" %% "slick-hikaricp" % SlickVersion,
  "org.postgresql" % "postgresql" % "42.7.1",
  "com.h2database" % "h2" % "2.2.224",

  // Authentication
  "com.github.jwt-scala" %% "jwt-circe" % "9.4.5",
  "com.github.t3hnar" %% "scala-bcrypt" % "4.3.0",

  // Configuration
  "com.typesafe" % "config" % "1.4.3",

  // Logging
  "ch.qos.logback" % "logback-classic" % "1.4.14",
  "com.typesafe.scala-logging" %% "scala-logging" % "3.9.5",

  // Swagger
  "com.github.swagger-akka-http" %% "swagger-akka-http" % "2.11.0",
  "jakarta.ws.rs" % "jakarta.ws.rs-api" % "3.1.0",

  // Testing
  "com.typesafe.akka" %% "akka-http-testkit" % AkkaHttpVersion % Test,
  "com.typesafe.akka" %% "akka-actor-testkit-typed" % AkkaVersion % Test,
  "org.scalatest" %% "scalatest" % "3.2.17" % Test
)

enablePlugins(JavaAppPackaging, DockerPlugin)

dockerBaseImage := "eclipse-temurin:17-jre-alpine"
dockerExposedPorts := Seq(8080)
`,

    // Project plugins
    'project/plugins.sbt': `addSbtPlugin("com.github.sbt" % "sbt-native-packager" % "1.9.16")
addSbtPlugin("io.spray" % "sbt-revolver" % "0.10.0")
`,

    // Build properties
    'project/build.properties': `sbt.version=1.9.7
`,

    // Main Application
    'src/main/scala/com/{{projectName}}/Main.scala': `package com.{{projectName}}

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import akka.http.scaladsl.Http
import com.{{projectName}}.config.{AppConfig, DatabaseConfig}
import com.{{projectName}}.routes.Routes
import com.typesafe.scalalogging.LazyLogging

import scala.concurrent.ExecutionContext
import scala.util.{Failure, Success}

object Main extends App with LazyLogging {
  implicit val system: ActorSystem[Nothing] = ActorSystem(Behaviors.empty, "{{projectName}}")
  implicit val ec: ExecutionContext = system.executionContext

  val config = AppConfig.load()

  // Initialize database
  DatabaseConfig.initialize(config)
  DatabaseConfig.runMigrations()

  val routes = new Routes(config)

  Http()
    .newServerAt(config.host, config.port)
    .bind(routes.allRoutes)
    .onComplete {
      case Success(binding) =>
        logger.info(s"Server started at http://\${binding.localAddress.getHostString}:\${binding.localAddress.getPort}")
        logger.info(s"Swagger UI available at http://\${binding.localAddress.getHostString}:\${binding.localAddress.getPort}/swagger")
      case Failure(ex) =>
        logger.error("Failed to bind HTTP server", ex)
        system.terminate()
    }
}
`,

    // Configuration
    'src/main/scala/com/{{projectName}}/config/AppConfig.scala': `package com.{{projectName}}.config

import com.typesafe.config.{Config, ConfigFactory}

case class AppConfig(
  host: String,
  port: Int,
  environment: String,
  dbHost: String,
  dbPort: Int,
  dbName: String,
  dbUser: String,
  dbPassword: String,
  useH2: Boolean,
  jwtSecret: String,
  jwtExpirationHours: Int,
  allowedOrigins: List[String]
) {
  def isDevelopment: Boolean = environment == "development"
  def isProduction: Boolean = environment == "production"
}

object AppConfig {
  def load(): AppConfig = {
    val config: Config = ConfigFactory.load()

    AppConfig(
      host = config.getString("server.host"),
      port = config.getInt("server.port"),
      environment = config.getString("server.environment"),
      dbHost = config.getString("database.host"),
      dbPort = config.getInt("database.port"),
      dbName = config.getString("database.name"),
      dbUser = config.getString("database.user"),
      dbPassword = config.getString("database.password"),
      useH2 = config.getBoolean("database.useH2"),
      jwtSecret = config.getString("jwt.secret"),
      jwtExpirationHours = config.getInt("jwt.expirationHours"),
      allowedOrigins = config.getString("cors.allowedOrigins").split(",").toList
    )
  }
}
`,

    // Database Configuration
    'src/main/scala/com/{{projectName}}/config/DatabaseConfig.scala': `package com.{{projectName}}.config

import com.typesafe.scalalogging.LazyLogging
import slick.jdbc.PostgresProfile.api._
import slick.jdbc.H2Profile

import scala.concurrent.Await
import scala.concurrent.duration._

object DatabaseConfig extends LazyLogging {
  private var _db: Database = _

  def db: Database = _db

  def initialize(config: AppConfig): Unit = {
    _db = if (config.useH2) {
      Database.forConfig("h2")
    } else {
      Database.forURL(
        url = s"jdbc:postgresql://\${config.dbHost}:\${config.dbPort}/\${config.dbName}",
        user = config.dbUser,
        password = config.dbPassword,
        driver = "org.postgresql.Driver"
      )
    }
    logger.info("Database connection initialized")
  }

  def runMigrations(): Unit = {
    import com.{{projectName}}.models.{Users, Products}

    val schema = Users.schema ++ Products.schema

    val setup = DBIO.seq(
      schema.createIfNotExists
    )

    Await.result(db.run(setup), 30.seconds)
    logger.info("Database migrations completed")
  }

  def close(): Unit = {
    if (_db != null) {
      _db.close()
    }
  }
}
`,

    // Models - User
    'src/main/scala/com/{{projectName}}/models/User.scala': `package com.{{projectName}}.models

import com.github.t3hnar.bcrypt._
import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._
import slick.jdbc.PostgresProfile.api._

import java.time.LocalDateTime

case class User(
  id: Long = 0L,
  email: String,
  password: String,
  name: String,
  role: String = "user",
  active: Boolean = true,
  createdAt: LocalDateTime = LocalDateTime.now(),
  updatedAt: LocalDateTime = LocalDateTime.now()
) {
  def setPassword(plainPassword: String): User = {
    copy(password = plainPassword.bcryptSafeBounded.getOrElse(plainPassword))
  }

  def checkPassword(plainPassword: String): Boolean = {
    plainPassword.isBcryptedSafeBounded(password).getOrElse(false)
  }

  def toResponse: UserResponse = UserResponse(
    id = id,
    email = email,
    name = name,
    role = role,
    active = active,
    createdAt = createdAt.toString
  )
}

case class UserResponse(
  id: Long,
  email: String,
  name: String,
  role: String,
  active: Boolean,
  createdAt: String
)

object UserResponse {
  implicit val encoder: Encoder[UserResponse] = deriveEncoder[UserResponse]
  implicit val decoder: Decoder[UserResponse] = deriveDecoder[UserResponse]
}

case class LoginRequest(email: String, password: String)
object LoginRequest {
  implicit val decoder: Decoder[LoginRequest] = deriveDecoder[LoginRequest]
}

case class RegisterRequest(email: String, password: String, name: String)
object RegisterRequest {
  implicit val decoder: Decoder[RegisterRequest] = deriveDecoder[RegisterRequest]
}

case class AuthResponse(token: String, user: UserResponse)
object AuthResponse {
  implicit val encoder: Encoder[AuthResponse] = deriveEncoder[AuthResponse]
}

class Users(tag: Tag) extends Table[User](tag, "users") {
  def id = column[Long]("id", O.PrimaryKey, O.AutoInc)
  def email = column[String]("email", O.Unique)
  def password = column[String]("password")
  def name = column[String]("name")
  def role = column[String]("role", O.Default("user"))
  def active = column[Boolean]("active", O.Default(true))
  def createdAt = column[LocalDateTime]("created_at")
  def updatedAt = column[LocalDateTime]("updated_at")

  def * = (id, email, password, name, role, active, createdAt, updatedAt).mapTo[User]
}

object Users extends TableQuery(new Users(_))
`,

    // Models - Product
    'src/main/scala/com/{{projectName}}/models/Product.scala': `package com.{{projectName}}.models

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._
import slick.jdbc.PostgresProfile.api._

import java.time.LocalDateTime

case class Product(
  id: Long = 0L,
  name: String,
  description: Option[String] = None,
  price: BigDecimal,
  stock: Int = 0,
  active: Boolean = true,
  createdAt: LocalDateTime = LocalDateTime.now(),
  updatedAt: LocalDateTime = LocalDateTime.now()
) {
  def toResponse: ProductResponse = ProductResponse(
    id = id,
    name = name,
    description = description,
    price = price.toDouble,
    stock = stock,
    active = active,
    createdAt = createdAt.toString,
    updatedAt = updatedAt.toString
  )
}

case class ProductResponse(
  id: Long,
  name: String,
  description: Option[String],
  price: Double,
  stock: Int,
  active: Boolean,
  createdAt: String,
  updatedAt: String
)

object ProductResponse {
  implicit val encoder: Encoder[ProductResponse] = deriveEncoder[ProductResponse]
  implicit val decoder: Decoder[ProductResponse] = deriveDecoder[ProductResponse]
}

case class CreateProductRequest(
  name: String,
  description: Option[String] = None,
  price: Double,
  stock: Int = 0
)
object CreateProductRequest {
  implicit val decoder: Decoder[CreateProductRequest] = deriveDecoder[CreateProductRequest]
}

case class UpdateProductRequest(
  name: Option[String] = None,
  description: Option[String] = None,
  price: Option[Double] = None,
  stock: Option[Int] = None,
  active: Option[Boolean] = None
)
object UpdateProductRequest {
  implicit val decoder: Decoder[UpdateProductRequest] = deriveDecoder[UpdateProductRequest]
}

case class PaginatedResponse[T](
  data: Seq[T],
  total: Long,
  page: Int,
  limit: Int
)
object PaginatedResponse {
  implicit def encoder[T: Encoder]: Encoder[PaginatedResponse[T]] = deriveEncoder[PaginatedResponse[T]]
}

class Products(tag: Tag) extends Table[Product](tag, "products") {
  def id = column[Long]("id", O.PrimaryKey, O.AutoInc)
  def name = column[String]("name")
  def description = column[Option[String]]("description")
  def price = column[BigDecimal]("price")
  def stock = column[Int]("stock", O.Default(0))
  def active = column[Boolean]("active", O.Default(true))
  def createdAt = column[LocalDateTime]("created_at")
  def updatedAt = column[LocalDateTime]("updated_at")

  def * = (id, name, description, price, stock, active, createdAt, updatedAt).mapTo[Product]
}

object Products extends TableQuery(new Products(_))
`,

    // Auth
    'src/main/scala/com/{{projectName}}/auth/JwtAuth.scala': `package com.{{projectName}}.auth

import akka.http.scaladsl.server.Directive1
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.model.StatusCodes
import com.{{projectName}}.config.AppConfig
import com.{{projectName}}.models.{User, Users}
import com.{{projectName}}.config.DatabaseConfig.db
import io.circe.syntax._
import io.circe.generic.auto._
import pdi.jwt.{JwtAlgorithm, JwtCirce, JwtClaim}
import slick.jdbc.PostgresProfile.api._

import java.time.Instant
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}

case class UserPrincipal(id: Long, email: String, role: String)

case class TokenPayload(userId: Long, email: String, role: String)

object JwtAuth {
  def generateToken(user: User, config: AppConfig): String = {
    val claim = JwtClaim(
      content = TokenPayload(user.id, user.email, user.role).asJson.noSpaces,
      issuedAt = Some(Instant.now.getEpochSecond),
      expiration = Some(Instant.now.plusSeconds(config.jwtExpirationHours * 3600).getEpochSecond)
    )

    JwtCirce.encode(claim, config.jwtSecret, JwtAlgorithm.HS256)
  }

  def validateToken(token: String, config: AppConfig): Option[UserPrincipal] = {
    JwtCirce.decode(token, config.jwtSecret, Seq(JwtAlgorithm.HS256)).toOption.flatMap { claim =>
      io.circe.parser.decode[TokenPayload](claim.content).toOption.map { payload =>
        UserPrincipal(payload.userId, payload.email, payload.role)
      }
    }
  }

  def authenticated(config: AppConfig)(implicit ec: ExecutionContext): Directive1[UserPrincipal] = {
    optionalHeaderValueByName("Authorization").flatMap {
      case Some(authHeader) if authHeader.startsWith("Bearer ") =>
        val token = authHeader.substring(7)
        validateToken(token, config) match {
          case Some(principal) =>
            // Verify user exists and is active
            onComplete(db.run(Users.filter(u => u.id === principal.id && u.active).result.headOption)).flatMap {
              case Success(Some(_)) => provide(principal)
              case _ => complete(StatusCodes.Unauthorized -> Map("error" -> "Invalid or expired token"))
            }
          case None =>
            complete(StatusCodes.Unauthorized -> Map("error" -> "Invalid token"))
        }
      case _ =>
        complete(StatusCodes.Unauthorized -> Map("error" -> "Authorization required"))
    }
  }

  def requireRole(roles: String*)(config: AppConfig)(implicit ec: ExecutionContext): Directive1[UserPrincipal] = {
    authenticated(config).flatMap { principal =>
      if (roles.contains(principal.role)) {
        provide(principal)
      } else {
        complete(StatusCodes.Forbidden -> Map("error" -> "Insufficient permissions"))
      }
    }
  }
}
`,

    // Routes - Main
    'src/main/scala/com/{{projectName}}/routes/Routes.scala': `package com.{{projectName}}.routes

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{ExceptionHandler, RejectionHandler, Route}
import ch.megard.akka.http.cors.scaladsl.CorsDirectives._
import ch.megard.akka.http.cors.scaladsl.settings.CorsSettings
import com.{{projectName}}.config.AppConfig
import com.typesafe.scalalogging.LazyLogging
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.generic.auto._

import scala.concurrent.ExecutionContext

class Routes(config: AppConfig)(implicit ec: ExecutionContext) extends LazyLogging {

  private val corsSettings = CorsSettings.defaultSettings
    .withAllowedOrigins(if (config.allowedOrigins.contains("*")) {
      ch.megard.akka.http.cors.scaladsl.model.HttpOriginMatcher.*
    } else {
      ch.megard.akka.http.cors.scaladsl.model.HttpOriginMatcher(
        config.allowedOrigins.map(akka.http.scaladsl.model.headers.HttpOrigin(_)): _*
      )
    })

  private implicit val exceptionHandler: ExceptionHandler = ExceptionHandler {
    case ex: Exception =>
      logger.error("Unhandled exception", ex)
      complete(StatusCodes.InternalServerError -> Map("error" -> "Internal server error"))
  }

  private implicit val rejectionHandler: RejectionHandler = RejectionHandler.default

  private val authRoutes = new AuthRoutes(config)
  private val userRoutes = new UserRoutes(config)
  private val productRoutes = new ProductRoutes(config)

  val allRoutes: Route = cors(corsSettings) {
    handleExceptions(exceptionHandler) {
      handleRejections(rejectionHandler) {
        concat(
          // Health check
          path("health") {
            get {
              complete(StatusCodes.OK -> Map(
                "status" -> "healthy",
                "timestamp" -> java.time.Instant.now().toString
              ))
            }
          },
          // API routes
          pathPrefix("api" / "v1") {
            concat(
              authRoutes.routes,
              userRoutes.routes,
              productRoutes.routes
            )
          }
        )
      }
    }
  }
}
`,

    // Routes - Auth
    'src/main/scala/com/{{projectName}}/routes/AuthRoutes.scala': `package com.{{projectName}}.routes

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import com.{{projectName}}.auth.JwtAuth
import com.{{projectName}}.config.{AppConfig, DatabaseConfig}
import com.{{projectName}}.models._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.generic.auto._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.ExecutionContext

class AuthRoutes(config: AppConfig)(implicit ec: ExecutionContext) {
  import DatabaseConfig.db

  val routes: Route = pathPrefix("auth") {
    concat(
      // Register
      path("register") {
        post {
          entity(as[RegisterRequest]) { request =>
            // Validation
            if (request.email.isBlank || !request.email.contains("@")) {
              complete(StatusCodes.BadRequest -> Map("error" -> "Valid email is required"))
            } else if (request.password.length < 6) {
              complete(StatusCodes.BadRequest -> Map("error" -> "Password must be at least 6 characters"))
            } else if (request.name.length < 2) {
              complete(StatusCodes.BadRequest -> Map("error" -> "Name must be at least 2 characters"))
            } else {
              val existingUserQuery = Users.filter(_.email === request.email).result.headOption

              onSuccess(db.run(existingUserQuery)) {
                case Some(_) =>
                  complete(StatusCodes.Conflict -> Map("error" -> "Email already registered"))
                case None =>
                  val newUser = User(
                    email = request.email,
                    password = "",
                    name = request.name
                  ).setPassword(request.password)

                  val insertAction = (Users returning Users.map(_.id) into ((user, id) => user.copy(id = id))) += newUser

                  onSuccess(db.run(insertAction)) { user =>
                    complete(StatusCodes.Created -> user.toResponse)
                  }
              }
            }
          }
        }
      },
      // Login
      path("login") {
        post {
          entity(as[LoginRequest]) { request =>
            val userQuery = Users.filter(_.email === request.email).result.headOption

            onSuccess(db.run(userQuery)) {
              case Some(user) if user.checkPassword(request.password) =>
                if (!user.active) {
                  complete(StatusCodes.Unauthorized -> Map("error" -> "Account is disabled"))
                } else {
                  val token = JwtAuth.generateToken(user, config)
                  complete(StatusCodes.OK -> AuthResponse(token, user.toResponse))
                }
              case _ =>
                complete(StatusCodes.Unauthorized -> Map("error" -> "Invalid credentials"))
            }
          }
        }
      }
    )
  }
}
`,

    // Routes - User
    'src/main/scala/com/{{projectName}}/routes/UserRoutes.scala': `package com.{{projectName}}.routes

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import com.{{projectName}}.auth.JwtAuth
import com.{{projectName}}.config.{AppConfig, DatabaseConfig}
import com.{{projectName}}.models._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.generic.auto._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.ExecutionContext

class UserRoutes(config: AppConfig)(implicit ec: ExecutionContext) {
  import DatabaseConfig.db

  val routes: Route = pathPrefix("users") {
    concat(
      // Get current user
      path("me") {
        get {
          JwtAuth.authenticated(config) { principal =>
            val userQuery = Users.filter(_.id === principal.id).result.headOption

            onSuccess(db.run(userQuery)) {
              case Some(user) => complete(StatusCodes.OK -> user.toResponse)
              case None => complete(StatusCodes.NotFound -> Map("error" -> "User not found"))
            }
          }
        } ~
        put {
          JwtAuth.authenticated(config) { principal =>
            entity(as[Map[String, String]]) { updates =>
              val updateName = updates.get("name")

              updateName match {
                case Some(newName) =>
                  val updateAction = Users.filter(_.id === principal.id)
                    .map(_.name)
                    .update(newName)

                  onSuccess(db.run(updateAction)) { _ =>
                    val userQuery = Users.filter(_.id === principal.id).result.headOption
                    onSuccess(db.run(userQuery)) {
                      case Some(user) => complete(StatusCodes.OK -> user.toResponse)
                      case None => complete(StatusCodes.NotFound -> Map("error" -> "User not found"))
                    }
                  }
                case None =>
                  complete(StatusCodes.BadRequest -> Map("error" -> "No updates provided"))
              }
            }
          }
        }
      },
      // List users (admin only)
      pathEnd {
        get {
          JwtAuth.requireRole("admin")(config) { _ =>
            val usersQuery = Users.result

            onSuccess(db.run(usersQuery)) { users =>
              complete(StatusCodes.OK -> users.map(_.toResponse))
            }
          }
        }
      },
      // Get user by ID
      path(LongNumber) { id =>
        get {
          JwtAuth.authenticated(config) { _ =>
            val userQuery = Users.filter(_.id === id).result.headOption

            onSuccess(db.run(userQuery)) {
              case Some(user) => complete(StatusCodes.OK -> user.toResponse)
              case None => complete(StatusCodes.NotFound -> Map("error" -> "User not found"))
            }
          }
        } ~
        delete {
          JwtAuth.requireRole("admin")(config) { _ =>
            val deleteAction = Users.filter(_.id === id).delete

            onSuccess(db.run(deleteAction)) { count =>
              if (count > 0) {
                complete(StatusCodes.NoContent)
              } else {
                complete(StatusCodes.NotFound -> Map("error" -> "User not found"))
              }
            }
          }
        }
      }
    )
  }
}
`,

    // Routes - Product
    'src/main/scala/com/{{projectName}}/routes/ProductRoutes.scala': `package com.{{projectName}}.routes

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import com.{{projectName}}.auth.JwtAuth
import com.{{projectName}}.config.{AppConfig, DatabaseConfig}
import com.{{projectName}}.models._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.generic.auto._
import slick.jdbc.PostgresProfile.api._

import java.time.LocalDateTime
import scala.concurrent.ExecutionContext

class ProductRoutes(config: AppConfig)(implicit ec: ExecutionContext) {
  import DatabaseConfig.db

  val routes: Route = pathPrefix("products") {
    concat(
      // List products
      pathEnd {
        get {
          parameters("page".as[Int].withDefault(1), "limit".as[Int].withDefault(10)) { (page, limit) =>
            val offset = (page - 1) * limit

            val countQuery = Products.filter(_.active).length.result
            val productsQuery = Products.filter(_.active).drop(offset).take(limit).result

            onSuccess(db.run(countQuery.zip(productsQuery))) { case (total, products) =>
              complete(StatusCodes.OK -> PaginatedResponse(
                data = products.map(_.toResponse),
                total = total.toLong,
                page = page,
                limit = limit
              ))
            }
          }
        } ~
        post {
          JwtAuth.requireRole("admin")(config) { _ =>
            entity(as[CreateProductRequest]) { request =>
              if (request.name.isBlank) {
                complete(StatusCodes.BadRequest -> Map("error" -> "Product name is required"))
              } else if (request.price < 0) {
                complete(StatusCodes.BadRequest -> Map("error" -> "Price must be non-negative"))
              } else {
                val newProduct = Product(
                  name = request.name,
                  description = request.description,
                  price = BigDecimal(request.price),
                  stock = request.stock
                )

                val insertAction = (Products returning Products.map(_.id) into ((product, id) => product.copy(id = id))) += newProduct

                onSuccess(db.run(insertAction)) { product =>
                  complete(StatusCodes.Created -> product.toResponse)
                }
              }
            }
          }
        }
      },
      // Get/Update/Delete product by ID
      path(LongNumber) { id =>
        get {
          val productQuery = Products.filter(_.id === id).result.headOption

          onSuccess(db.run(productQuery)) {
            case Some(product) => complete(StatusCodes.OK -> product.toResponse)
            case None => complete(StatusCodes.NotFound -> Map("error" -> "Product not found"))
          }
        } ~
        put {
          JwtAuth.requireRole("admin")(config) { _ =>
            entity(as[UpdateProductRequest]) { request =>
              val productQuery = Products.filter(_.id === id).result.headOption

              onSuccess(db.run(productQuery)) {
                case Some(product) =>
                  val updatedProduct = product.copy(
                    name = request.name.getOrElse(product.name),
                    description = request.description.orElse(product.description),
                    price = request.price.map(BigDecimal(_)).getOrElse(product.price),
                    stock = request.stock.getOrElse(product.stock),
                    active = request.active.getOrElse(product.active),
                    updatedAt = LocalDateTime.now()
                  )

                  val updateAction = Products.filter(_.id === id).update(updatedProduct)

                  onSuccess(db.run(updateAction)) { _ =>
                    complete(StatusCodes.OK -> updatedProduct.toResponse)
                  }
                case None =>
                  complete(StatusCodes.NotFound -> Map("error" -> "Product not found"))
              }
            }
          }
        } ~
        delete {
          JwtAuth.requireRole("admin")(config) { _ =>
            val deleteAction = Products.filter(_.id === id).delete

            onSuccess(db.run(deleteAction)) { count =>
              if (count > 0) {
                complete(StatusCodes.NoContent)
              } else {
                complete(StatusCodes.NotFound -> Map("error" -> "Product not found"))
              }
            }
          }
        }
      }
    )
  }
}
`,

    // Application configuration
    'src/main/resources/application.conf': `server {
  host = "0.0.0.0"
  host = \${?HOST}
  port = 8080
  port = \${?PORT}
  environment = "development"
  environment = \${?ENVIRONMENT}
}

database {
  host = "localhost"
  host = \${?DB_HOST}
  port = 5432
  port = \${?DB_PORT}
  name = "{{projectName}}"
  name = \${?DB_NAME}
  user = "postgres"
  user = \${?DB_USER}
  password = "password"
  password = \${?DB_PASSWORD}
  useH2 = true
  useH2 = \${?USE_H2}
}

jwt {
  secret = "your-secret-key"
  secret = \${?JWT_SECRET}
  expirationHours = 24
  expirationHours = \${?JWT_EXPIRATION_HOURS}
}

cors {
  allowedOrigins = "*"
  allowedOrigins = \${?ALLOWED_ORIGINS}
}

h2 {
  driver = "org.h2.Driver"
  url = "jdbc:h2:mem:{{projectName}};DB_CLOSE_DELAY=-1"
  connectionPool = "HikariCP"
  keepAliveConnection = true
}

akka {
  loglevel = "INFO"
  http {
    server {
      idle-timeout = 60s
      request-timeout = 30s
    }
  }
}
`,

    // Logback configuration
    'src/main/resources/logback.xml': `<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{YYYY-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
    </root>

    <logger name="akka" level="INFO"/>
    <logger name="slick" level="INFO"/>
</configuration>
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM sbtscala/scala-sbt:eclipse-temurin-17.0.4_1.8.0_2.13.10 AS builder

WORKDIR /app

# Copy build files first for better caching
COPY build.sbt .
COPY project ./project

# Download dependencies
RUN sbt update

# Copy source code
COPY src ./src

# Build application
RUN sbt stage

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application from builder
COPY --from=builder /app/target/universal/stage .

# Create non-root user
RUN addgroup -S -g 1000 appgroup && \\
    adduser -S -u 1000 -G appgroup appuser

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:8080/health || exit 1

CMD ["./bin/{{projectName}}"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - HOST=0.0.0.0
      - PORT=8080
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME={{projectName}}
      - DB_USER=postgres
      - DB_PASSWORD=password
      - USE_H2=false
      - JWT_SECRET=change-this-secret
    depends_on:
      - postgres

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

volumes:
  postgres_data:
`,

    // Test file
    'src/test/scala/com/{{projectName}}/RoutesSpec.scala': `package com.{{projectName}}

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.testkit.ScalatestRouteTest
import com.{{projectName}}.config.AppConfig
import com.{{projectName}}.routes.Routes
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

class RoutesSpec extends AnyWordSpec with Matchers with ScalatestRouteTest {

  val config = AppConfig(
    host = "localhost",
    port = 8080,
    environment = "test",
    dbHost = "localhost",
    dbPort = 5432,
    dbName = "test",
    dbUser = "test",
    dbPassword = "test",
    useH2 = true,
    jwtSecret = "test-secret",
    jwtExpirationHours = 24,
    allowedOrigins = List("*")
  )

  // Initialize database for tests
  com.{{projectName}}.config.DatabaseConfig.initialize(config)
  com.{{projectName}}.config.DatabaseConfig.runMigrations()

  val routes = new Routes(config)

  "Health endpoint" should {
    "return OK" in {
      Get("/health") ~> routes.allRoutes ~> check {
        status shouldEqual StatusCodes.OK
        responseAs[String] should include("healthy")
      }
    }
  }

  "Products endpoint" should {
    "return paginated results" in {
      Get("/api/v1/products") ~> routes.allRoutes ~> check {
        status shouldEqual StatusCodes.OK
        responseAs[String] should include("data")
      }
    }
  }
}
`,

    // README
    'README.md': `# {{projectName}}

A reactive REST API built with Akka HTTP in Scala.

## Features

- **Akka HTTP**: Modern actor-based HTTP framework
- **Akka Streams**: Reactive stream processing
- **Slick**: Functional relational mapping for Scala
- **Circe**: Type-safe JSON handling
- **JWT Authentication**: Secure token-based authentication
- **Docker Support**: Containerized deployment

## Requirements

- JDK 17+
- SBT 1.9+
- PostgreSQL (optional, H2 for development)
- Docker (optional)

## Quick Start

1. Clone the repository
2. Run with SBT:
   \`\`\`bash
   sbt run
   \`\`\`

3. Or run with Docker:
   \`\`\`bash
   docker-compose up
   \`\`\`

## Development

### Run tests
\`\`\`bash
sbt test
\`\`\`

### Hot reload
\`\`\`bash
sbt ~reStart
\`\`\`

### Build for production
\`\`\`bash
sbt stage
\`\`\`

## Project Structure

\`\`\`
src/main/scala/com/{{projectName}}/
├── auth/         # Authentication
├── config/       # Configuration
├── models/       # Data models
├── routes/       # API routes
└── Main.scala    # Entry point
\`\`\`
`
  }
};
