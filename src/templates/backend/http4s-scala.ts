import { BackendTemplate } from '../types';

export const http4sScalaTemplate: BackendTemplate = {
  id: 'http4s-scala',
  name: 'http4s-scala',
  displayName: 'http4s (Scala)',
  description: 'Functional HTTP library for Scala with Cats Effect and type-safe middleware',
  language: 'scala',
  framework: 'http4s',
  version: '1.0.0',
  tags: ['scala', 'http4s', 'microservices', 'cats-effect', 'fs2', 'circe'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'microservices'],

  files: {
    // Build configuration
    'build.sbt': `name := "{{projectNameSnake}}"

version := "0.1.0-SNAPSHOT"

scalaVersion := "3.3.1"

libraryDependencies ++= Seq(
  "org.typelevel" %% "cats-effect" % "3.5.1",
  "org.http4s" %% "http4s-ember-server" % "1.0.0-M40",
  "org.http4s" %% "http4s-ember-client" % "1.0.0-M40",
  "org.http4s" %% "http4s-dsl" % "1.0.0-M40",
  "org.http4s" %% "http4s-circe" % "1.0.0-M40",
  "io.circe" %% "circe-generic" % "0.15.0-M1",
  "io.circe" %% "circe-parser" % "0.15.0-M1",
  "org.http4s" %% "http4s-jwt-auth" % "1.0.0-M40",
  "com.github.pureconfig" %% "pureconfig-core" % "0.17.4",
  "ch.qos.logback" % "logback-classic" % "1.4.11",
  "org.typelevel" %% "log4cats-slf4j" % "2.6.0"
)

scalacOptions ++= Seq(
  "-deprecation",
  "-feature",
  "-Xfatal-warnings"
)
`,

    // Main application
    'src/main/scala/{{projectPackage}}/Main.scala': `package {{projectPackage}}

import cats.effect._
import cats.effect.std.Console
import cats.syntax.all._
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.server.middleware.Logger
import fs2.io.net.Network
import org.http4s.implicits._
import {{projectPackage}}.routes._

object Main extends IOApp.Simple {

  override def run: IO[Unit] = {
    val app = (
      HealthRoutes.routes <+>
      AuthRoutes.routes <+>
      ProductRoutes.routes
    ).orNotFound

    EmberServerBuilder.default[IO]
      .withHost("0.0.0.0")
      .withPort(8080)
      .withHttpApp(
        Logger.httpApp(true, true)(app)
      )
      .build
      .use(_ => IO.never)
      .evalMap(server => IO(println(s"🚀 Server running at http://localhost:8080")))
      .evalMap(_ => IO(println(s"📚 API docs: http://localhost:8080/api/v1/health")))
      .compile
      .drain
  }
}
`,

    // Models
    'src/main/scala/{{projectPackage}}/models/User.scala': `package {{projectPackage}}.models

import io.circe.generic.auto._
import io.circe.syntax._
import java.time.Instant
import java.util.UUID

case class User(
  id: UUID,
  email: String,
  password: String,
  name: String,
  role: Role,
  createdAt: Instant,
  updatedAt: Instant
)

case class UserResponse(
  id: UUID,
  email: String,
  name: String,
  role: Role
)

case class RegisterRequest(
  email: String,
  password: String,
  name: String
)

case class LoginRequest(
  email: String,
  password: String
)

case class AuthResponse(
  token: String,
  user: UserResponse
)

enum Role {
  case USER, ADMIN
}
`,

    'src/main/scala/{{projectPackage}}/models/Product.scala': `package {{projectPackage}}.models

import io.circe.generic.auto._
import java.time.Instant
import java.util.UUID

case class Product(
  id: UUID,
  name: String,
  description: Option[String],
  price: Double,
  stock: Int,
  createdAt: Instant,
  updatedAt: Instant
)

case class CreateProductRequest(
  name: String,
  description: Option[String],
  price: Double,
  stock: Int
)

case class UpdateProductRequest(
  name: Option[String],
  description: Option[String],
  price: Option[Double],
  stock: Option[Int]
)
`,

    // In-memory database
    'src/main/scala/{{projectPackage}}/database/Database.scala': `package {{projectPackage}}.database

import {{projectPackage}}.models._
import cats.effect._
import cats.effect.std.Console
import java.time.Instant
import java.util.UUID
import scala.collection.mutable

object Database {
  private val users = mutable.Map[UUID, User]()
  private val products = mutable.Map[UUID, Product]()

  def init[F[_] : Sync : Console]: F[Unit] = Sync[F].delay {
    val admin = User(
      id = UUID.fromString("00000000-0000-0000-0000-000000000001"),
      email = "admin@example.com",
      password = "$2a$12$dummy", // In production, hash this
      name = "Admin User",
      role = Role.ADMIN,
      createdAt = Instant.now(),
      updatedAt = Instant.now()
    )
    val now = Instant.now()
    val prod1 = Product(
      id = UUID.fromString("00000000-0000-0000-0000-000000000001"),
      name = "Sample Product 1",
      description = Some("This is a sample product"),
      price = 29.99,
      stock = 100,
      createdAt = now,
      updatedAt = now
    )
    val prod2 = Product(
      id = UUID.fromString("00000000-0000-0000-0000-000000000002"),
      name = "Sample Product 2",
      description = Some("Another sample product"),
      price = 49.99,
      stock = 50,
      createdAt = now,
      updatedAt = now
    )

    users += (admin.id -> admin)
    products += (prod1.id -> prod1)
    products += (prod2.id -> prod2)

    println("📦 Database initialized")
    println("👤 Default admin: admin@example.com / admin123")
  }

  def findUserByEmail(email: String): Option[User] =
    users.values.find(_.email == email)

  def findUserById(id: UUID): Option[User] =
    users.get(id)

  def createUser(user: User): User = {
    users += (user.id -> user)
    user
  }

  def getAllUsers: List[User] =
    users.values.toList

  def findProductById(id: UUID): Option[Product] =
    products.get(id)

  def getAllProducts: List[Product] =
    products.values.toList

  def createProduct(product: Product): Product = {
    products += (product.id -> product)
    product
  }

  def updateProduct(id: UUID, updates: UpdateProductRequest): Option[Product] =
    products.get(id).map { product =>
      val updated = product.copy(
        name = updates.name.getOrElse(product.name),
        description = updates.description.getOrElse(product.description),
        price = updates.price.getOrElse(product.price),
        stock = updates.stock.getOrElse(product.stock),
        updatedAt = Instant.now()
      )
      products += (id -> updated)
      updated
    }

  def deleteProduct(id: UUID): Boolean =
    products.remove(id).isDefined
}
`,

    // Services
    'src/main/scala/{{projectPackage}}/services/AuthService.scala': `package {{projectPackage}}.services

import {{projectPackage}}.models._
import {{projectPackage}}.database.Database
import cats.effect._
import java.util.UUID

object AuthService {
  def register(request: RegisterRequest): IO[User] = IO {
    val user = User(
      id = UUID.randomUUID(),
      email = request.email,
      password = request.password, // In production, hash this
      name = request.name,
      role = Role.USER,
      createdAt = java.time.Instant.now(),
      updatedAt = java.time.Instant.now()
    )
    Database.createUser(user)
  }

  def login(request: LoginRequest): IO[Option[User]] = IO {
    Database.findUserByEmail(request.email).filter { user =>
      request.password == user.password // In production, verify hash
    }
  }

  def generateToken(user: User): String = {
    // In production, use real JWT library
    s"jwt-token-for-\${user.id}"
  }
}
`,

    // Routes - Health
    'src/main/scala/{{projectPackage}}/routes/HealthRoutes.scala': `package {{projectPackage}}.routes

import cats.effect._
import org.http4s._
import org.http4s.dsl.io._
import org.http4s.circe._
import io.circe.generic.auto._
import java.time.Instant

object HealthRoutes {
  case class HealthResponse(
    status: String,
    timestamp: String,
    version: String
  )

  val routes: HttpRoutes[IO] = HttpRoutes.of[IO] {
    case GET -> Root / "api" / "v1" / "health" =>
      Ok(HealthResponse(
        status = "healthy",
        timestamp = Instant.now().toString,
        version = "1.0.0"
      ))
  }
}
`,

    // Routes - Auth
    'src/main/scala/{{projectPackage}}/routes/AuthRoutes.scala': `package {{projectPackage}}.routes

import cats.effect._
import org.http4s._
import org.http4s.dsl.io._
import org.http4s.circe._
import io.circe.generic.auto._
import {{projectPackage}}.models._
import {{projectPackage}}.services.AuthService
import {{projectPackage}}.database.Database

object AuthRoutes {
  val routes: HttpRoutes[IO] = HttpRoutes.of[IO] {
    case req @ POST -> Root / "api" / "v1" / "auth" / "register" =>
      for {
        request <- req.as[RegisterRequest]
        userExists <- IO.pure(Database.findUserByEmail(request.email).isDefined)
        response <- if (userExists) {
          Conflict("Email already registered")
        } else {
          for {
            user <- AuthService.register(request)
            token = AuthService.generateToken(user)
            userResponse = UserResponse(user.id, user.email, user.name, user.role)
            resp <- Created(AuthResponse(token, userResponse))
          } yield resp
        }
      } yield response

    case req @ POST -> Root / "api" / "v1" / "auth" / "login" =>
      for {
        request <- req.as[LoginRequest]
        userOpt <- AuthService.login(request)
        response <- userOpt match {
          case Some(user) =>
            val token = AuthService.generateToken(user)
            val userResponse = UserResponse(user.id, user.email, user.name, user.role)
            Ok(AuthResponse(token, userResponse))
          case None =>
            Unauthorized("Invalid credentials")
        }
      } yield response
  }
}
`,

    // Routes - Products
    'src/main/scala/{{projectPackage}}/routes/ProductRoutes.scala': `package {{projectPackage}}.routes

import cats.effect._
import org.http4s._
import org.http4s.dsl.io._
import org.http4s.circe._
import io.circe.generic.auto._
import {{projectPackage}}.models._
import {{projectPackage}}.database.Database
import java.util.UUID

object ProductRoutes {
  val routes: HttpRoutes[IO] = HttpRoutes.of[IO] {
    case GET -> Root / "api" / "v1" / "products" =>
      val products = Database.getAllProducts
      Ok(Map("products" -> products, "count" -> products.size))

    case GET -> Root / "api" / "v1" / "products" / UUIDVar(id) =>
      Database.findProductById(id) match {
        case Some(product) => Ok(Map("product" -> product))
        case None => NotFound("Product not found")
      }

    case req @ POST -> Root / "api" / "v1" / "products" =>
      for {
        request <- req.as[CreateProductRequest]
        product <- IO {
          Product(
            id = UUID.randomUUID(),
            name = request.name,
            description = request.description,
            price = request.price,
            stock = request.stock,
            createdAt = java.time.Instant.now(),
            updatedAt = java.time.Instant.now()
          )
        }
        created <- IO(Database.createProduct(product))
        response <- Created(Map("product" -> created))
      } yield response

    case (req @ PUT -> Root / "api" / "v1" / "products" / UUIDVar(id)) =>
      for {
        request <- req.as[UpdateProductRequest]
        updated <- IO(Database.updateProduct(id, request))
        response <- updated match {
          case Some(product) => Ok(Map("product" -> product))
          case None => NotFound("Product not found")
        }
      } yield response

    case DELETE -> Root / "api" / "v1" / "products" / UUIDVar(id) =>
      val deleted = Database.deleteProduct(id)
      if (deleted) NoContent()
      else NotFound("Product not found")
  }
}
`,

    // Dockerfile
    'Dockerfile': `FROM eclipse-temurin:17-jdk-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY build.sbt project build.sbt project/
COPY src ./src
RUN sbt compile
CMD ["sbt", "run"]
EXPOSE 8080
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
`,

    // Tests
    'src/test/scala/{{projectPackage}}/MainSpec.scala': `package {{projectPackage}}

import cats.effect._
import munit.CatsEffectSuite

class MainSpec extends CatsEffectSuite {

  test("sanity check") {
    assert(1 + 1 == 2)
  }
}
`,

    // README
    'README.md': `# {{projectName}}

Functional REST API built with http4s and Scala.

## Features

- **http4s**: Functional HTTP library
- **Cats Effect**: Functional effects
- **Circe**: JSON encoding/decoding
- **Fs2**: Streaming
- **Pure functional**: Type-safe and composable

## Requirements

- JDK 17+
- Scala 3.3+

## Quick Start

\`\`\`bash
sbt run
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
