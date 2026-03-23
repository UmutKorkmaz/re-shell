import { BackendTemplate } from '../types';

export const grpcServiceTemplate: BackendTemplate = {
  id: 'grpc-service',
  name: 'grpc-service',
  displayName: 'gRPC Service',
  description: 'High-performance gRPC service with Protocol Buffers',
  language: 'csharp',
  framework: 'grpc',
  version: '1.0.0',
  tags: ['grpc', 'protobuf', 'microservice', 'api'],
  port: 5000,
  dependencies: {},
  features: ['logging', 'monitoring', 'testing', 'security'],
  
  files: {
    // Project file
    '{{serviceName}}.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <Protobuf Include="Protos\\{{serviceName}}.proto" GrpcServices="Server" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Grpc.AspNetCore" Version="2.59.0" />
    <PackageReference Include="Grpc.AspNetCore.Server.Reflection" Version="2.59.0" />
    <PackageReference Include="protobuf-net.Grpc.AspNetCore" Version="1.1.1" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks" Version="8.0.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation" Version="11.8.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
  </ItemGroup>

</Project>`,

    // Protocol Buffer definitions
    'Protos/{{serviceName}}.proto': `syntax = "proto3";

option csharp_namespace = "{{serviceName}}.Protos";

package {{serviceName}};

// User service definition
service UserService {
  // Gets a user by ID
  rpc GetUser (GetUserRequest) returns (UserReply);
  
  // Creates a new user
  rpc CreateUser (CreateUserRequest) returns (UserReply);
  
  // Updates an existing user
  rpc UpdateUser (UpdateUserRequest) returns (UserReply);
  
  // Deletes a user
  rpc DeleteUser (DeleteUserRequest) returns (DeleteUserReply);
  
  // Lists users with pagination
  rpc ListUsers (ListUsersRequest) returns (ListUsersReply);
  
  // Server streaming: Watch user changes
  rpc WatchUsers (WatchUsersRequest) returns (stream UserChangeNotification);
}

// Product service definition
service ProductService {
  // Gets a product by ID
  rpc GetProduct (GetProductRequest) returns (ProductReply);
  
  // Creates a new product
  rpc CreateProduct (CreateProductRequest) returns (ProductReply);
  
  // Updates an existing product
  rpc UpdateProduct (UpdateProductRequest) returns (ProductReply);
  
  // Deletes a product
  rpc DeleteProduct (DeleteProductRequest) returns (DeleteProductReply);
  
  // Lists products with pagination and filtering
  rpc ListProducts (ListProductsRequest) returns (ListProductsReply);
  
  // Client streaming: Batch create products
  rpc BatchCreateProducts (stream CreateProductRequest) returns (BatchCreateProductsReply);
  
  // Bidirectional streaming: Real-time product updates
  rpc StreamProductUpdates (stream ProductUpdateRequest) returns (stream ProductUpdateReply);
}

// User messages
message GetUserRequest {
  int32 id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
  string phone = 3;
  repeated string roles = 4;
}

message UpdateUserRequest {
  int32 id = 1;
  string name = 2;
  string email = 3;
  string phone = 4;
  repeated string roles = 5;
}

message DeleteUserRequest {
  int32 id = 1;
}

message DeleteUserReply {
  bool success = 1;
  string message = 2;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;
  string order_by = 4;
}

message ListUsersReply {
  repeated UserReply users = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

message WatchUsersRequest {
  repeated string user_ids = 1;
}

message UserChangeNotification {
  ChangeType change_type = 1;
  UserReply user = 2;
  
  enum ChangeType {
    UNKNOWN = 0;
    CREATED = 1;
    UPDATED = 2;
    DELETED = 3;
  }
}

message UserReply {
  int32 id = 1;
  string name = 2;
  string email = 3;
  string phone = 4;
  repeated string roles = 5;
  google.protobuf.Timestamp created_at = 6;
  google.protobuf.Timestamp updated_at = 7;
}

// Product messages
message GetProductRequest {
  int32 id = 1;
}

message CreateProductRequest {
  string name = 1;
  string description = 2;
  double price = 3;
  string category = 4;
  int32 stock_quantity = 5;
  repeated string tags = 6;
}

message UpdateProductRequest {
  int32 id = 1;
  string name = 2;
  string description = 3;
  double price = 4;
  string category = 5;
  int32 stock_quantity = 6;
  repeated string tags = 7;
}

message DeleteProductRequest {
  int32 id = 1;
}

message DeleteProductReply {
  bool success = 1;
  string message = 2;
}

message ListProductsRequest {
  int32 page_size = 1;
  string page_token = 2;
  string category_filter = 3;
  double min_price = 4;
  double max_price = 5;
  string search_query = 6;
  string order_by = 7;
}

message ListProductsReply {
  repeated ProductReply products = 1;
  string next_page_token = 2;
  int32 total_count = 3;
}

message BatchCreateProductsReply {
  repeated ProductReply products = 1;
  int32 success_count = 2;
  int32 error_count = 3;
  repeated string errors = 4;
}

message ProductUpdateRequest {
  int32 product_id = 1;
  string field = 2;
  string value = 3;
}

message ProductUpdateReply {
  bool success = 1;
  string message = 2;
  ProductReply product = 3;
}

message ProductReply {
  int32 id = 1;
  string name = 2;
  string description = 3;
  double price = 4;
  string category = 5;
  int32 stock_quantity = 6;
  repeated string tags = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
}

// Import well-known types
import "google/protobuf/timestamp.proto";`,

    // Program.cs
    'Program.cs': `using {{serviceName}}.Services;
using {{serviceName}}.Data;
using {{serviceName}}.Interceptors;
using Microsoft.EntityFrameworkCore;
using Serilog;
using AutoMapper;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add gRPC services
builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<LoggingInterceptor>();
    options.Interceptors.Add<ExceptionInterceptor>();
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

// Add gRPC reflection (for development)
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddGrpcReflection();
}

// Add AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Add application services
builder.Services.AddScoped<IUserDataService, UserDataService>();
builder.Services.AddScoped<IProductDataService, ProductDataService>();

// Add health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>();

var app = builder.Build();

// Configure the HTTP request pipeline
app.MapGrpcService<UserGrpcService>();
app.MapGrpcService<ProductGrpcService>();

// Add gRPC reflection (for development)
if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService();
}

// Add health check endpoint
app.MapHealthChecks("/health");

// Default HTTP endpoint
app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();
}

app.Run();`,

    // Models
    'Models/User.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.Models;

public class User
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;
    
    [Phone]
    [MaxLength(20)]
    public string? Phone { get; set; }
    
    public List<string> Roles { get; set; } = new();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}`,

    'Models/Product.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace {{serviceName}}.Models;

public class Product
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }
    
    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;
    
    public int StockQuantity { get; set; }
    
    public List<string> Tags { get; set; } = new();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}`,

    // Data
    'Data/ApplicationDbContext.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Models;
using System.Text.Json;

namespace {{serviceName}}.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure User entity
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            // Store roles as JSON
            entity.Property(e => e.Roles)
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                  .HasColumnType("nvarchar(max)");
            
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Configure Product entity
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Category).IsRequired().HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            // Store tags as JSON
            entity.Property(e => e.Tags)
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                  .HasColumnType("nvarchar(max)");
            
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.Price);
        });
    }
}`,

    // Services
    'Services/IUserDataService.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public interface IUserDataService
{
    Task<User?> GetUserByIdAsync(int id);
    Task<User> CreateUserAsync(User user);
    Task<User> UpdateUserAsync(User user);
    Task<bool> DeleteUserAsync(int id);
    Task<(List<User> Users, int TotalCount)> GetUsersAsync(int pageSize, int skip, string? filter = null, string? orderBy = null);
}`,

    'Services/UserDataService.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Data;
using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public class UserDataService : IUserDataService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<UserDataService> _logger;

    public UserDataService(ApplicationDbContext context, ILogger<UserDataService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<User?> GetUserByIdAsync(int id)
    {
        try
        {
            return await _context.Users.FindAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user with ID: {UserId}", id);
            throw;
        }
    }

    public async Task<User> CreateUserAsync(User user)
    {
        try
        {
            user.CreatedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Created user with ID: {UserId}", user.Id);
            return user;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user: {UserEmail}", user.Email);
            throw;
        }
    }

    public async Task<User> UpdateUserAsync(User user)
    {
        try
        {
            user.UpdatedAt = DateTime.UtcNow;
            
            _context.Users.Update(user);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Updated user with ID: {UserId}", user.Id);
            return user;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user with ID: {UserId}", user.Id);
            throw;
        }
    }

    public async Task<bool> DeleteUserAsync(int id)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return false;
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Deleted user with ID: {UserId}", id);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user with ID: {UserId}", id);
            throw;
        }
    }

    public async Task<(List<User> Users, int TotalCount)> GetUsersAsync(int pageSize, int skip, string? filter = null, string? orderBy = null)
    {
        try
        {
            var query = _context.Users.AsQueryable();

            // Apply filter
            if (!string.IsNullOrEmpty(filter))
            {
                query = query.Where(u => u.Name.Contains(filter) || u.Email.Contains(filter));
            }

            var totalCount = await query.CountAsync();

            // Apply ordering
            query = orderBy?.ToLower() switch
            {
                "name" => query.OrderBy(u => u.Name),
                "email" => query.OrderBy(u => u.Email),
                "created" => query.OrderBy(u => u.CreatedAt),
                _ => query.OrderByDescending(u => u.CreatedAt)
            };

            var users = await query
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync();

            return (users, totalCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users");
            throw;
        }
    }
}`,

    'Services/IProductDataService.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public interface IProductDataService
{
    Task<Product?> GetProductByIdAsync(int id);
    Task<Product> CreateProductAsync(Product product);
    Task<Product> UpdateProductAsync(Product product);
    Task<bool> DeleteProductAsync(int id);
    Task<(List<Product> Products, int TotalCount)> GetProductsAsync(int pageSize, int skip, string? categoryFilter = null, decimal? minPrice = null, decimal? maxPrice = null, string? searchQuery = null, string? orderBy = null);
    Task<List<Product>> BatchCreateProductsAsync(List<Product> products);
}`,

    'Services/ProductDataService.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Data;
using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public class ProductDataService : IProductDataService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ProductDataService> _logger;

    public ProductDataService(ApplicationDbContext context, ILogger<ProductDataService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Product?> GetProductByIdAsync(int id)
    {
        try
        {
            return await _context.Products.FindAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving product with ID: {ProductId}", id);
            throw;
        }
    }

    public async Task<Product> CreateProductAsync(Product product)
    {
        try
        {
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;
            
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Created product with ID: {ProductId}", product.Id);
            return product;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product: {ProductName}", product.Name);
            throw;
        }
    }

    public async Task<Product> UpdateProductAsync(Product product)
    {
        try
        {
            product.UpdatedAt = DateTime.UtcNow;
            
            _context.Products.Update(product);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Updated product with ID: {ProductId}", product.Id);
            return product;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product with ID: {ProductId}", product.Id);
            throw;
        }
    }

    public async Task<bool> DeleteProductAsync(int id)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return false;
            }

            _context.Products.Remove(product);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Deleted product with ID: {ProductId}", id);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product with ID: {ProductId}", id);
            throw;
        }
    }

    public async Task<(List<Product> Products, int TotalCount)> GetProductsAsync(int pageSize, int skip, string? categoryFilter = null, decimal? minPrice = null, decimal? maxPrice = null, string? searchQuery = null, string? orderBy = null)
    {
        try
        {
            var query = _context.Products.AsQueryable();

            // Apply filters
            if (!string.IsNullOrEmpty(categoryFilter))
            {
                query = query.Where(p => p.Category == categoryFilter);
            }

            if (minPrice.HasValue)
            {
                query = query.Where(p => p.Price >= minPrice.Value);
            }

            if (maxPrice.HasValue)
            {
                query = query.Where(p => p.Price <= maxPrice.Value);
            }

            if (!string.IsNullOrEmpty(searchQuery))
            {
                query = query.Where(p => p.Name.Contains(searchQuery) || 
                                        p.Description!.Contains(searchQuery));
            }

            var totalCount = await query.CountAsync();

            // Apply ordering
            query = orderBy?.ToLower() switch
            {
                "name" => query.OrderBy(p => p.Name),
                "price" => query.OrderBy(p => p.Price),
                "category" => query.OrderBy(p => p.Category),
                "created" => query.OrderBy(p => p.CreatedAt),
                _ => query.OrderByDescending(p => p.CreatedAt)
            };

            var products = await query
                .Skip(skip)
                .Take(pageSize)
                .ToListAsync();

            return (products, totalCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving products");
            throw;
        }
    }

    public async Task<List<Product>> BatchCreateProductsAsync(List<Product> products)
    {
        try
        {
            var now = DateTime.UtcNow;
            foreach (var product in products)
            {
                product.CreatedAt = now;
                product.UpdatedAt = now;
            }

            _context.Products.AddRange(products);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Batch created {Count} products", products.Count);
            return products;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error batch creating products");
            throw;
        }
    }
}`,

    // gRPC Services
    'Services/UserGrpcService.cs': `using Grpc.Core;
using AutoMapper;
using {{serviceName}}.Protos;
using {{serviceName}}.Models;
using Google.Protobuf.WellKnownTypes;

namespace {{serviceName}}.Services;

public class UserGrpcService : UserService.UserServiceBase
{
    private readonly IUserDataService _userDataService;
    private readonly IMapper _mapper;
    private readonly ILogger<UserGrpcService> _logger;

    public UserGrpcService(IUserDataService userDataService, IMapper mapper, ILogger<UserGrpcService> logger)
    {
        _userDataService = userDataService;
        _mapper = mapper;
        _logger = logger;
    }

    public override async Task<UserReply> GetUser(GetUserRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Getting user with ID: {UserId}", request.Id);
            
            var user = await _userDataService.GetUserByIdAsync(request.Id);
            if (user == null)
            {
                throw new RpcException(new Status(StatusCode.NotFound, $"User with ID {request.Id} not found"));
            }

            return _mapper.Map<UserReply>(user);
        }
        catch (RpcException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user with ID: {UserId}", request.Id);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<UserReply> CreateUser(CreateUserRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Creating user with email: {Email}", request.Email);
            
            var user = _mapper.Map<User>(request);
            var createdUser = await _userDataService.CreateUserAsync(user);
            
            return _mapper.Map<UserReply>(createdUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user with email: {Email}", request.Email);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<UserReply> UpdateUser(UpdateUserRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Updating user with ID: {UserId}", request.Id);
            
            var existingUser = await _userDataService.GetUserByIdAsync(request.Id);
            if (existingUser == null)
            {
                throw new RpcException(new Status(StatusCode.NotFound, $"User with ID {request.Id} not found"));
            }

            _mapper.Map(request, existingUser);
            var updatedUser = await _userDataService.UpdateUserAsync(existingUser);
            
            return _mapper.Map<UserReply>(updatedUser);
        }
        catch (RpcException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user with ID: {UserId}", request.Id);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<DeleteUserReply> DeleteUser(DeleteUserRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Deleting user with ID: {UserId}", request.Id);
            
            var deleted = await _userDataService.DeleteUserAsync(request.Id);
            
            return new DeleteUserReply
            {
                Success = deleted,
                Message = deleted ? "User deleted successfully" : "User not found"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user with ID: {UserId}", request.Id);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<ListUsersReply> ListUsers(ListUsersRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Listing users with page size: {PageSize}", request.PageSize);
            
            var pageSize = Math.Max(1, Math.Min(request.PageSize, 100)); // Limit page size
            var skip = string.IsNullOrEmpty(request.PageToken) ? 0 : int.Parse(request.PageToken);
            
            var (users, totalCount) = await _userDataService.GetUsersAsync(
                pageSize, skip, request.Filter, request.OrderBy);
            
            var reply = new ListUsersReply
            {
                TotalCount = totalCount,
                NextPageToken = (skip + pageSize < totalCount) ? (skip + pageSize).ToString() : ""
            };
            
            reply.Users.AddRange(users.Select(u => _mapper.Map<UserReply>(u)));
            
            return reply;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing users");
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task WatchUsers(WatchUsersRequest request, IServerStreamWriter<UserChangeNotification> responseStream, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Starting user watch for {Count} users", request.UserIds.Count);
            
            // This is a simplified example. In a real implementation, you would:
            // 1. Set up database change tracking
            // 2. Use SignalR or other real-time mechanism
            // 3. Monitor for changes and stream them back
            
            while (!context.CancellationToken.IsCancellationRequested)
            {
                // Simulate checking for changes every 5 seconds
                await Task.Delay(5000, context.CancellationToken);
                
                // In a real implementation, you would check for actual changes
                // For demo purposes, we'll just send a heartbeat notification
                var notification = new UserChangeNotification
                {
                    ChangeType = UserChangeNotification.Types.ChangeType.Unknown,
                    User = new UserReply
                    {
                        Id = 0,
                        Name = "Heartbeat",
                        Email = "heartbeat@example.com"
                    }
                };
                
                await responseStream.WriteAsync(notification);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("User watch cancelled");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in user watch");
            throw;
        }
    }
}`,

    'Services/ProductGrpcService.cs': `using Grpc.Core;
using AutoMapper;
using {{serviceName}}.Protos;
using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public class ProductGrpcService : ProductService.ProductServiceBase
{
    private readonly IProductDataService _productDataService;
    private readonly IMapper _mapper;
    private readonly ILogger<ProductGrpcService> _logger;

    public ProductGrpcService(IProductDataService productDataService, IMapper mapper, ILogger<ProductGrpcService> logger)
    {
        _productDataService = productDataService;
        _mapper = mapper;
        _logger = logger;
    }

    public override async Task<ProductReply> GetProduct(GetProductRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Getting product with ID: {ProductId}", request.Id);
            
            var product = await _productDataService.GetProductByIdAsync(request.Id);
            if (product == null)
            {
                throw new RpcException(new Status(StatusCode.NotFound, $"Product with ID {request.Id} not found"));
            }

            return _mapper.Map<ProductReply>(product);
        }
        catch (RpcException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product with ID: {ProductId}", request.Id);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<ProductReply> CreateProduct(CreateProductRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Creating product: {ProductName}", request.Name);
            
            var product = _mapper.Map<Product>(request);
            var createdProduct = await _productDataService.CreateProductAsync(product);
            
            return _mapper.Map<ProductReply>(createdProduct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product: {ProductName}", request.Name);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<ProductReply> UpdateProduct(UpdateProductRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Updating product with ID: {ProductId}", request.Id);
            
            var existingProduct = await _productDataService.GetProductByIdAsync(request.Id);
            if (existingProduct == null)
            {
                throw new RpcException(new Status(StatusCode.NotFound, $"Product with ID {request.Id} not found"));
            }

            _mapper.Map(request, existingProduct);
            var updatedProduct = await _productDataService.UpdateProductAsync(existingProduct);
            
            return _mapper.Map<ProductReply>(updatedProduct);
        }
        catch (RpcException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product with ID: {ProductId}", request.Id);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<DeleteProductReply> DeleteProduct(DeleteProductRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Deleting product with ID: {ProductId}", request.Id);
            
            var deleted = await _productDataService.DeleteProductAsync(request.Id);
            
            return new DeleteProductReply
            {
                Success = deleted,
                Message = deleted ? "Product deleted successfully" : "Product not found"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product with ID: {ProductId}", request.Id);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<ListProductsReply> ListProducts(ListProductsRequest request, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Listing products with page size: {PageSize}", request.PageSize);
            
            var pageSize = Math.Max(1, Math.Min(request.PageSize, 100));
            var skip = string.IsNullOrEmpty(request.PageToken) ? 0 : int.Parse(request.PageToken);
            
            var (products, totalCount) = await _productDataService.GetProductsAsync(
                pageSize, skip, request.CategoryFilter, 
                request.MinPrice > 0 ? (decimal)request.MinPrice : null,
                request.MaxPrice > 0 ? (decimal)request.MaxPrice : null,
                request.SearchQuery, request.OrderBy);
            
            var reply = new ListProductsReply
            {
                TotalCount = totalCount,
                NextPageToken = (skip + pageSize < totalCount) ? (skip + pageSize).ToString() : ""
            };
            
            reply.Products.AddRange(products.Select(p => _mapper.Map<ProductReply>(p)));
            
            return reply;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing products");
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task<BatchCreateProductsReply> BatchCreateProducts(IAsyncStreamReader<CreateProductRequest> requestStream, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Starting batch product creation");
            
            var products = new List<Product>();
            var errors = new List<string>();
            
            await foreach (var request in requestStream.ReadAllAsync())
            {
                try
                {
                    var product = _mapper.Map<Product>(request);
                    products.Add(product);
                }
                catch (Exception ex)
                {
                    errors.Add($"Error mapping product '{request.Name}': {ex.Message}");
                }
            }
            
            var createdProducts = new List<Product>();
            if (products.Any())
            {
                createdProducts = await _productDataService.BatchCreateProductsAsync(products);
            }
            
            var reply = new BatchCreateProductsReply
            {
                SuccessCount = createdProducts.Count,
                ErrorCount = errors.Count
            };
            
            reply.Products.AddRange(createdProducts.Select(p => _mapper.Map<ProductReply>(p)));
            reply.Errors.AddRange(errors);
            
            _logger.LogInformation("Batch creation completed: {SuccessCount} success, {ErrorCount} errors", 
                reply.SuccessCount, reply.ErrorCount);
            
            return reply;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in batch product creation");
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error"));
        }
    }

    public override async Task StreamProductUpdates(IAsyncStreamReader<ProductUpdateRequest> requestStream, IServerStreamWriter<ProductUpdateReply> responseStream, ServerCallContext context)
    {
        try
        {
            _logger.LogInformation("Starting product update stream");
            
            await foreach (var request in requestStream.ReadAllAsync())
            {
                try
                {
                    var product = await _productDataService.GetProductByIdAsync(request.ProductId);
                    if (product == null)
                    {
                        var errorReply = new ProductUpdateReply
                        {
                            Success = false,
                            Message = $"Product with ID {request.ProductId} not found"
                        };
                        await responseStream.WriteAsync(errorReply);
                        continue;
                    }

                    // Apply the update based on the field
                    switch (request.Field.ToLower())
                    {
                        case "name":
                            product.Name = request.Value;
                            break;
                        case "description":
                            product.Description = request.Value;
                            break;
                        case "price":
                            if (decimal.TryParse(request.Value, out var price))
                                product.Price = price;
                            break;
                        case "category":
                            product.Category = request.Value;
                            break;
                        case "stock":
                            if (int.TryParse(request.Value, out var stock))
                                product.StockQuantity = stock;
                            break;
                        default:
                            var invalidReply = new ProductUpdateReply
                            {
                                Success = false,
                                Message = $"Invalid field: {request.Field}"
                            };
                            await responseStream.WriteAsync(invalidReply);
                            continue;
                    }

                    var updatedProduct = await _productDataService.UpdateProductAsync(product);
                    
                    var successReply = new ProductUpdateReply
                    {
                        Success = true,
                        Message = $"Updated {request.Field} successfully",
                        Product = _mapper.Map<ProductReply>(updatedProduct)
                    };
                    
                    await responseStream.WriteAsync(successReply);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating product {ProductId}", request.ProductId);
                    
                    var errorReply = new ProductUpdateReply
                    {
                        Success = false,
                        Message = $"Error updating product: {ex.Message}"
                    };
                    await responseStream.WriteAsync(errorReply);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in product update stream");
            throw;
        }
    }
}`,

    // Mapping Profiles
    'Mappings/MappingProfile.cs': `using AutoMapper;
using {{serviceName}}.Models;
using {{serviceName}}.Protos;
using Google.Protobuf.WellKnownTypes;

namespace {{serviceName}}.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // User mappings
        CreateMap<CreateUserRequest, User>()
            .ForMember(dest => dest.Roles, opt => opt.MapFrom(src => src.Roles.ToList()));

        CreateMap<UpdateUserRequest, User>()
            .ForMember(dest => dest.Roles, opt => opt.MapFrom(src => src.Roles.ToList()));

        CreateMap<User, UserReply>()
            .ForMember(dest => dest.Roles, opt => opt.MapFrom(src => src.Roles))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => Timestamp.FromDateTime(src.CreatedAt)))
            .ForMember(dest => dest.UpdatedAt, opt => opt.MapFrom(src => Timestamp.FromDateTime(src.UpdatedAt)));

        // Product mappings
        CreateMap<CreateProductRequest, Product>()
            .ForMember(dest => dest.Price, opt => opt.MapFrom(src => (decimal)src.Price))
            .ForMember(dest => dest.Tags, opt => opt.MapFrom(src => src.Tags.ToList()));

        CreateMap<UpdateProductRequest, Product>()
            .ForMember(dest => dest.Price, opt => opt.MapFrom(src => (decimal)src.Price))
            .ForMember(dest => dest.Tags, opt => opt.MapFrom(src => src.Tags.ToList()));

        CreateMap<Product, ProductReply>()
            .ForMember(dest => dest.Price, opt => opt.MapFrom(src => (double)src.Price))
            .ForMember(dest => dest.Tags, opt => opt.MapFrom(src => src.Tags))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => Timestamp.FromDateTime(src.CreatedAt)))
            .ForMember(dest => dest.UpdatedAt, opt => opt.MapFrom(src => Timestamp.FromDateTime(src.UpdatedAt)));
    }
}`,

    // Interceptors
    'Interceptors/LoggingInterceptor.cs': `using Grpc.Core;
using Grpc.Core.Interceptors;

namespace {{serviceName}}.Interceptors;

public class LoggingInterceptor : Interceptor
{
    private readonly ILogger<LoggingInterceptor> _logger;

    public LoggingInterceptor(ILogger<LoggingInterceptor> logger)
    {
        _logger = logger;
    }

    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        var methodName = context.Method;
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
        _logger.LogInformation("Starting gRPC call: {Method}", methodName);
        
        try
        {
            var response = await continuation(request, context);
            stopwatch.Stop();
            
            _logger.LogInformation("Completed gRPC call: {Method} in {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
            
            return response;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            _logger.LogError(ex, "Error in gRPC call: {Method} after {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
            
            throw;
        }
    }

    public override async Task<TResponse> ClientStreamingServerHandler<TRequest, TResponse>(
        IAsyncStreamReader<TRequest> requestStream,
        ServerCallContext context,
        ClientStreamingServerMethod<TRequest, TResponse> continuation)
    {
        var methodName = context.Method;
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
        _logger.LogInformation("Starting client streaming gRPC call: {Method}", methodName);
        
        try
        {
            var response = await continuation(requestStream, context);
            stopwatch.Stop();
            
            _logger.LogInformation("Completed client streaming gRPC call: {Method} in {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
            
            return response;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            _logger.LogError(ex, "Error in client streaming gRPC call: {Method} after {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
            
            throw;
        }
    }

    public override async Task ServerStreamingServerHandler<TRequest, TResponse>(
        TRequest request,
        IServerStreamWriter<TResponse> responseStream,
        ServerCallContext context,
        ServerStreamingServerMethod<TRequest, TResponse> continuation)
    {
        var methodName = context.Method;
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
        _logger.LogInformation("Starting server streaming gRPC call: {Method}", methodName);
        
        try
        {
            await continuation(request, responseStream, context);
            stopwatch.Stop();
            
            _logger.LogInformation("Completed server streaming gRPC call: {Method} in {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            _logger.LogError(ex, "Error in server streaming gRPC call: {Method} after {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
            
            throw;
        }
    }

    public override async Task DuplexStreamingServerHandler<TRequest, TResponse>(
        IAsyncStreamReader<TRequest> requestStream,
        IServerStreamWriter<TResponse> responseStream,
        ServerCallContext context,
        DuplexStreamingServerMethod<TRequest, TResponse> continuation)
    {
        var methodName = context.Method;
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
        _logger.LogInformation("Starting bidirectional streaming gRPC call: {Method}", methodName);
        
        try
        {
            await continuation(requestStream, responseStream, context);
            stopwatch.Stop();
            
            _logger.LogInformation("Completed bidirectional streaming gRPC call: {Method} in {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            _logger.LogError(ex, "Error in bidirectional streaming gRPC call: {Method} after {ElapsedMilliseconds}ms", 
                methodName, stopwatch.ElapsedMilliseconds);
            
            throw;
        }
    }
}`,

    'Interceptors/ExceptionInterceptor.cs': `using Grpc.Core;
using Grpc.Core.Interceptors;

namespace {{serviceName}}.Interceptors;

public class ExceptionInterceptor : Interceptor
{
    private readonly ILogger<ExceptionInterceptor> _logger;

    public ExceptionInterceptor(ILogger<ExceptionInterceptor> logger)
    {
        _logger = logger;
    }

    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            return await continuation(request, context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in gRPC method: {Method}", context.Method);
            throw HandleException(ex);
        }
    }

    public override async Task<TResponse> ClientStreamingServerHandler<TRequest, TResponse>(
        IAsyncStreamReader<TRequest> requestStream,
        ServerCallContext context,
        ClientStreamingServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            return await continuation(requestStream, context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in client streaming gRPC method: {Method}", context.Method);
            throw HandleException(ex);
        }
    }

    public override async Task ServerStreamingServerHandler<TRequest, TResponse>(
        TRequest request,
        IServerStreamWriter<TResponse> responseStream,
        ServerCallContext context,
        ServerStreamingServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            await continuation(request, responseStream, context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in server streaming gRPC method: {Method}", context.Method);
            throw HandleException(ex);
        }
    }

    public override async Task DuplexStreamingServerHandler<TRequest, TResponse>(
        IAsyncStreamReader<TRequest> requestStream,
        IServerStreamWriter<TResponse> responseStream,
        ServerCallContext context,
        DuplexStreamingServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            await continuation(requestStream, responseStream, context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in bidirectional streaming gRPC method: {Method}", context.Method);
            throw HandleException(ex);
        }
    }

    private static RpcException HandleException(Exception ex)
    {
        return ex switch
        {
            RpcException rpcEx => rpcEx,
            ArgumentException argEx => new RpcException(new Status(StatusCode.InvalidArgument, argEx.Message)),
            UnauthorizedAccessException => new RpcException(new Status(StatusCode.Unauthenticated, "Unauthorized")),
            InvalidOperationException invEx => new RpcException(new Status(StatusCode.FailedPrecondition, invEx.Message)),
            NotImplementedException => new RpcException(new Status(StatusCode.Unimplemented, "Method not implemented")),
            TimeoutException => new RpcException(new Status(StatusCode.DeadlineExceeded, "Request timeout")),
            _ => new RpcException(new Status(StatusCode.Internal, "Internal server error"))
        };
    }
}`,

    // Configuration files
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Kestrel": {
    "EndpointDefaults": {
      "Protocols": "Http2"
    }
  },
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.File"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.Hosting.Lifetime": "Information",
        "Grpc": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "theme": "Serilog.Sinks.SystemConsole.Themes.AnsiConsoleTheme::Code, Serilog.Sinks.Console",
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/log-.txt",
          "rollingInterval": "Day",
          "outputTemplate": "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithThreadId"]
  }
}`,

    'appsettings.Development.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}DevDb;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Information",
      "Microsoft.EntityFrameworkCore.Database.Command": "Information",
      "Grpc": "Debug"
    }
  }
}`,

    // Docker files
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Base runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Stage 2: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["{{serviceName}}.csproj", "."]
RUN dotnet restore "./{{serviceName}}.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "./{{serviceName}}.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Stage 3: Publish
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./{{serviceName}}.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# =============================================================================
# Stage 4: Final runtime image
# =============================================================================
FROM base AS final
WORKDIR /app

# Install curl for health checks and create non-root user
RUN apt-get update && apt-get install -y --no-install-recommends curl \\
    && useradd -m -u 1000 app \\
    && apt-get clean \\
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .
RUN chown -R app:app /app

USER app

# Health check (gRPC health check via grpc.health.v1.Health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "{{serviceName}}.dll"]`,

    '.dockerignore': `**/.dockerignore
**/.env
**/.git
**/.gitignore
**/.project
**/.settings
**/.toolstarget
**/.vs
**/.vscode
**/*.*proj.user
**/*.dbmdl
**/*.jfm
**/azds.yaml
**/bin
**/charts
**/docker-compose*
**/Dockerfile*
**/node_modules
**/npm-debug.log
**/obj
**/secrets.dev.yaml
**/values.dev.yaml
LICENSE
README.md`,

    // Client example
    'client-example.py': `#!/usr/bin/env python3
"""
Example gRPC client for {{serviceName}} service
"""
import grpc
import asyncio
from typing import AsyncIterator

# Import generated protobuf files
# pip install grpcio grpcio-tools
# python -m grpc_tools.protoc -I./Protos --python_out=. --grpc_python_out=. Protos/{{serviceName}}.proto

import {{serviceName}}_pb2
import {{serviceName}}_pb2_grpc

async def main():
    # Connect to the gRPC server
    async with grpc.aio.insecure_channel('localhost:{{port}}') as channel:
        # Create stubs
        user_stub = {{serviceName}}_pb2_grpc.UserServiceStub(channel)
        product_stub = {{serviceName}}_pb2_grpc.ProductServiceStub(channel)
        
        print("Connected to {{serviceName}} gRPC service")
        
        # Example 1: Create a user
        create_user_request = {{serviceName}}_pb2.CreateUserRequest(
            name="John Doe",
            email="john.doe@example.com",
            phone="+1-555-0123",
            roles=["user", "admin"]
        )
        
        user = await user_stub.CreateUser(create_user_request)
        print(f"Created user: {user.name} (ID: {user.id})")
        
        # Example 2: Get the user
        get_user_request = {{serviceName}}_pb2.GetUserRequest(id=user.id)
        retrieved_user = await user_stub.GetUser(get_user_request)
        print(f"Retrieved user: {retrieved_user.name}")
        
        # Example 3: Create a product
        create_product_request = {{serviceName}}_pb2.CreateProductRequest(
            name="Laptop",
            description="High-performance laptop",
            price=999.99,
            category="Electronics",
            stock_quantity=10,
            tags=["laptop", "computer", "electronics"]
        )
        
        product = await product_stub.CreateProduct(create_product_request)
        print(f"Created product: {product.name} (ID: {product.id})")
        
        # Example 4: List products
        list_products_request = {{serviceName}}_pb2.ListProductsRequest(
            page_size=10,
            category_filter="Electronics"
        )
        
        products_response = await product_stub.ListProducts(list_products_request)
        print(f"Found {len(products_response.products)} products")
        for prod in products_response.products:
            print(f"  - {prod.name}: $\\{prod.price}")
        
        # Example 5: Server streaming - Watch users
        print("\\nWatching for user changes (press Ctrl+C to stop)...")
        watch_request = {{serviceName}}_pb2.WatchUsersRequest(user_ids=[str(user.id)])
        
        try:
            async for notification in user_stub.WatchUsers(watch_request):
                print(f"User change: {notification.change_type} - {notification.user.name}")
        except KeyboardInterrupt:
            print("Stopped watching")
        except grpc.RpcError as e:
            print(f"RPC error: {e}")

if __name__ == '__main__':
    asyncio.run(main())`,

    // README
    'README.md': `# {{serviceName}}

A high-performance gRPC service built with ASP.NET Core and Protocol Buffers.

## Features

- **gRPC Services**: High-performance binary protocol communication
- **Protocol Buffers**: Efficient serialization with type safety
- **Entity Framework Core**: Code-first database approach with migrations
- **AutoMapper**: Object-to-object mapping between entities and DTOs
- **Structured Logging**: Serilog with multiple output targets
- **Health Checks**: Built-in health monitoring endpoints
- **Interceptors**: Logging and exception handling middleware
- **Streaming Support**: Unary, server streaming, client streaming, and bidirectional streaming
- **Reflection**: gRPC reflection for development and tooling

## Getting Started

### Prerequisites

- .NET 8.0 SDK
- SQL Server or SQL Server LocalDB
- gRPC client tools (optional, for testing)

### Installation

1. Clone the repository
2. Update the connection string in \`appsettings.json\`
3. Run the application:

\`\`\`bash
dotnet run
\`\`\`

### gRPC Endpoints

The service provides the following gRPC services:

#### UserService
- \`GetUser\` - Get a user by ID
- \`CreateUser\` - Create a new user
- \`UpdateUser\` - Update an existing user
- \`DeleteUser\` - Delete a user
- \`ListUsers\` - List users with pagination
- \`WatchUsers\` - Server streaming for user changes

#### ProductService  
- \`GetProduct\` - Get a product by ID
- \`CreateProduct\` - Create a new product
- \`UpdateProduct\` - Update an existing product
- \`DeleteProduct\` - Delete a product
- \`ListProducts\` - List products with filtering and pagination
- \`BatchCreateProducts\` - Client streaming for batch creation
- \`StreamProductUpdates\` - Bidirectional streaming for real-time updates

### Testing with grpcurl

Install grpcurl for testing:

\`\`\`bash
# Install grpcurl
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest

# List available services
grpcurl -plaintext localhost:{{port}} list

# List methods for UserService
grpcurl -plaintext localhost:{{port}} list {{serviceName}}.UserService

# Create a user
grpcurl -plaintext \\
  -d '{"name": "John Doe", "email": "john@example.com", "phone": "+1-555-0123", "roles": ["user"]}' \\
  localhost:{{port}} {{serviceName}}.UserService/CreateUser

# Get a user
grpcurl -plaintext \\
  -d '{"id": 1}' \\
  localhost:{{port}} {{serviceName}}.UserService/GetUser

# List users
grpcurl -plaintext \\
  -d '{"page_size": 10}' \\
  localhost:{{port}} {{serviceName}}.UserService/ListUsers
\`\`\`

### Client Development

Generate client code for your preferred language:

#### C#
\`\`\`bash
# Already included in the project via Protobuf package reference
\`\`\`

#### Python
\`\`\`bash
pip install grpcio grpcio-tools
python -m grpc_tools.protoc -I./Protos --python_out=. --grpc_python_out=. Protos/{{serviceName}}.proto
\`\`\`

#### Go
\`\`\`bash
protoc --go_out=. --go-grpc_out=. Protos/{{serviceName}}.proto
\`\`\`

#### Node.js
\`\`\`bash
npm install @grpc/grpc-js @grpc/proto-loader
\`\`\`

### Database Setup

The application will automatically create and seed the database on first run.

To manually manage migrations:

\`\`\`bash
# Add a migration
dotnet ef migrations add MigrationName

# Update database
dotnet ef database update
\`\`\`

## Development

### Hot Reload

The application supports hot reload in development mode:

\`\`\`bash
dotnet watch run
\`\`\`

### Adding New Services

1. Define your service and messages in \`Protos/{{serviceName}}.proto\`
2. Create your service implementation in \`Services/\`
3. Register the service in \`Program.cs\`
4. Add AutoMapper mappings if needed

### Interceptors

The service includes two interceptors:

- **LoggingInterceptor**: Logs all gRPC calls with timing information
- **ExceptionInterceptor**: Handles exceptions and converts them to appropriate gRPC status codes

## Docker Support

Build and run with Docker:

\`\`\`bash
docker build -t {{serviceName}} .
docker run -p {{port}}:8080 {{serviceName}}
\`\`\`

## Architecture

- **Controllers**: gRPC service implementations
- **Services**: Business logic and data access
- **Models**: Entity models for database
- **Protos**: Protocol Buffer definitions
- **Data**: Entity Framework DbContext and configuration
- **Interceptors**: gRPC middleware for cross-cutting concerns
- **Mappings**: AutoMapper profiles for entity/DTO mapping

## Performance Features

- HTTP/2 protocol for efficient multiplexing
- Binary serialization with Protocol Buffers
- Connection pooling and reuse
- Streaming support for large datasets
- Efficient database queries with Entity Framework

## Security Considerations

- Input validation with model binding
- Exception handling to prevent information leakage
- Structured logging without sensitive data
- Health checks without exposing system internals

## Monitoring

- Health check endpoint at \`/health\`
- Structured logging with Serilog
- gRPC interceptors for request tracking
- Entity Framework logging for database operations

## Testing

Run tests with:

\`\`\`bash
dotnet test
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
`
  }
};