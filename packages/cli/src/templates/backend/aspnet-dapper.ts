import { BackendTemplate } from '../types';

export const aspnetDapperTemplate: BackendTemplate = {
  id: 'aspnet-dapper',
  name: 'aspnet-dapper',
  displayName: 'ASP.NET Core with Dapper',
  description: 'High-performance .NET API with Dapper micro-ORM',
  language: 'csharp',
  framework: 'aspnet-dapper',
  version: '1.0.0',
  tags: ['aspnet', 'dapper', 'micro-orm', 'performance', 'sql'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'database', 'caching', 'logging', 'monitoring', 'testing'],
  
  files: {
    // Project file
    '{{serviceName}}.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Dapper" Version="2.1.24" />
    <PackageReference Include="Dapper.Contrib" Version="2.0.78" />
    <PackageReference Include="System.Data.SqlClient" Version="4.8.5" />
    <PackageReference Include="Microsoft.Data.SqlClient" Version="5.1.1" />
    <PackageReference Include="Npgsql" Version="8.0.0" />
    <PackageReference Include="MySql.Data" Version="8.2.0" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks.SqlServer" Version="8.0.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="StackExchange.Redis" Version="2.7.10" />
    <PackageReference Include="Polly" Version="8.2.0" />
    <PackageReference Include="Polly.Extensions.Http" Version="3.0.0" />
  </ItemGroup>

</Project>`,

    // Program.cs
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using {{serviceName}}.Configuration;
using Microsoft.Data.SqlClient;
using System.Data;
using Serilog;
using AutoMapper;
using FluentValidation;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Polly;
using Polly.Extensions.Http;

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
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Configure Swagger/OpenAPI
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "{{serviceName}} API", 
        Version = "v1",
        Description = "High-performance API built with ASP.NET Core and Dapper",
        Contact = new OpenApiContact
        {
            Name = "{{serviceName}} Team",
            Email = "team@{{serviceName}}.com"
        }
    });
    
    // Include XML comments
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);
    
    // JWT Bearer configuration
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configure Database Connection
builder.Services.AddScoped<IDbConnection>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    return new SqlConnection(connectionString);
});

// Configure Redis (optional)
if (!string.IsNullOrEmpty(builder.Configuration.GetConnectionString("Redis")))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = builder.Configuration.GetConnectionString("Redis");
    });
}
else
{
    builder.Services.AddMemoryCache();
}

// Configure AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Configure FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!))
    };
});

builder.Services.AddAuthorization();

// Configure HTTP Client with Polly
builder.Services.AddHttpClient("retryClient")
    .AddPolicyHandler(GetRetryPolicy());

// Register repositories and services
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Configure Database Initialization
builder.Services.AddScoped<IDatabaseInitializer, DatabaseInitializer>();

// Add health checks
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")!, name: "database");

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "{{serviceName}} API v1");
        c.RoutePrefix = string.Empty; // Serve Swagger UI at root
    });
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var dbInitializer = scope.ServiceProvider.GetRequiredService<IDatabaseInitializer>();
    await dbInitializer.InitializeAsync();
}

app.Run();

static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .WaitAndRetryAsync(
            retryCount: 3,
            sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
}`,

    // Models
    'Models/User.cs': `using System.ComponentModel.DataAnnotations;
using Dapper.Contrib.Extensions;

namespace {{serviceName}}.Models;

[Table("Users")]
public class User
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;
    
    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;
    
    [Phone]
    [MaxLength(20)]
    public string? Phone { get; set; }
    
    [MaxLength(255)]
    public string? PasswordHash { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    [Computed]
    public string FullName => $"{FirstName} {LastName}".Trim();
}`,

    'Models/Product.cs': `using System.ComponentModel.DataAnnotations;
using Dapper.Contrib.Extensions;

namespace {{serviceName}}.Models;

[Table("Products")]
public class Product
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    public decimal Price { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Category { get; set; } = string.Empty;
    
    public int StockQuantity { get; set; }
    
    [MaxLength(50)]
    public string? SKU { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}`,

    'Models/Order.cs': `using System.ComponentModel.DataAnnotations;
using Dapper.Contrib.Extensions;

namespace {{serviceName}}.Models;

[Table("Orders")]
public class Order
{
    [Key]
    public int Id { get; set; }
    
    public int UserId { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string OrderNumber { get; set; } = string.Empty;
    
    public decimal TotalAmount { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = "Pending";
    
    public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    
    public DateTime? ShippedDate { get; set; }
    
    public DateTime? DeliveredDate { get; set; }
    
    [MaxLength(500)]
    public string? ShippingAddress { get; set; }
    
    [MaxLength(1000)]
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    [Computed]
    public User? User { get; set; }
    
    [Computed]
    public List<OrderItem> Items { get; set; } = new();
}`,

    'Models/OrderItem.cs': `using System.ComponentModel.DataAnnotations;
using Dapper.Contrib.Extensions;

namespace {{serviceName}}.Models;

[Table("OrderItems")]
public class OrderItem
{
    [Key]
    public int Id { get; set; }
    
    public int OrderId { get; set; }
    
    public int ProductId { get; set; }
    
    public int Quantity { get; set; }
    
    public decimal UnitPrice { get; set; }
    
    public decimal TotalPrice { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [Computed]
    public Product? Product { get; set; }
}`,

    // DTOs
    'DTOs/UserDto.cs': `namespace {{serviceName}}.DTOs;

public class UserDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public string FullName { get; set; } = string.Empty;
}

public class CreateUserDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Password { get; set; } = string.Empty;
}

public class UpdateUserDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsActive { get; set; }
}`,

    'DTOs/ProductDto.cs': `namespace {{serviceName}}.DTOs;

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Category { get; set; } = string.Empty;
    public int StockQuantity { get; set; }
    public string? SKU { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Category { get; set; } = string.Empty;
    public int StockQuantity { get; set; }
    public string? SKU { get; set; }
}

public class UpdateProductDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string Category { get; set; } = string.Empty;
    public int StockQuantity { get; set; }
    public string? SKU { get; set; }
    public bool IsActive { get; set; }
}`,

    'DTOs/OrderDto.cs': `namespace {{serviceName}}.DTOs;

public class OrderDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public DateTime? ShippedDate { get; set; }
    public DateTime? DeliveredDate { get; set; }
    public string? ShippingAddress { get; set; }
    public string? Notes { get; set; }
    public UserDto? User { get; set; }
    public List<OrderItemDto> Items { get; set; } = new();
}

public class CreateOrderDto
{
    public int UserId { get; set; }
    public string? ShippingAddress { get; set; }
    public string? Notes { get; set; }
    public List<CreateOrderItemDto> Items { get; set; } = new();
}

public class OrderItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public ProductDto? Product { get; set; }
}

public class CreateOrderItemDto
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}`,

    'DTOs/AuthDto.cs': `namespace {{serviceName}}.DTOs;

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime Expires { get; set; }
    public UserDto User { get; set; } = null!;
}`,

    // Repositories
    'Repositories/IUserRepository.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task<User?> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetAllAsync();
    Task<IEnumerable<User>> GetPagedAsync(int page, int pageSize);
    Task<int> GetCountAsync();
    Task<int> CreateAsync(User user);
    Task<bool> UpdateAsync(User user);
    Task<bool> DeleteAsync(int id);
    Task<bool> ExistsAsync(int id);
    Task<bool> EmailExistsAsync(string email, int? excludeId = null);
}`,

    'Repositories/UserRepository.cs': `using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using Dapper;
using Dapper.Contrib.Extensions;
using System.Data;

namespace {{serviceName}}.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IDbConnection _connection;
    private readonly ILogger<UserRepository> _logger;

    public UserRepository(IDbConnection connection, ILogger<UserRepository> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async Task<User?> GetByIdAsync(int id)
    {
        try
        {
            return await _connection.GetAsync<User>(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user by ID: {UserId}", id);
            throw;
        }
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        try
        {
            const string sql = "SELECT * FROM Users WHERE Email = @Email AND IsActive = 1";
            return await _connection.QueryFirstOrDefaultAsync<User>(sql, new { Email = email });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user by email: {Email}", email);
            throw;
        }
    }

    public async Task<IEnumerable<User>> GetAllAsync()
    {
        try
        {
            const string sql = "SELECT * FROM Users WHERE IsActive = 1 ORDER BY FirstName, LastName";
            return await _connection.QueryAsync<User>(sql);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all users");
            throw;
        }
    }

    public async Task<IEnumerable<User>> GetPagedAsync(int page, int pageSize)
    {
        try
        {
            var offset = (page - 1) * pageSize;
            const string sql = @"
                SELECT * FROM Users 
                WHERE IsActive = 1 
                ORDER BY FirstName, LastName
                OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY";
            
            return await _connection.QueryAsync<User>(sql, new { Offset = offset, PageSize = pageSize });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting paged users: Page {Page}, PageSize {PageSize}", page, pageSize);
            throw;
        }
    }

    public async Task<int> GetCountAsync()
    {
        try
        {
            const string sql = "SELECT COUNT(*) FROM Users WHERE IsActive = 1";
            return await _connection.QuerySingleAsync<int>(sql);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user count");
            throw;
        }
    }

    public async Task<int> CreateAsync(User user)
    {
        try
        {
            user.CreatedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            
            const string sql = @"
                INSERT INTO Users (FirstName, LastName, Email, Phone, PasswordHash, IsActive, CreatedAt, UpdatedAt)
                VALUES (@FirstName, @LastName, @Email, @Phone, @PasswordHash, @IsActive, @CreatedAt, @UpdatedAt);
                SELECT CAST(SCOPE_IDENTITY() as int);";
            
            var id = await _connection.QuerySingleAsync<int>(sql, user);
            user.Id = id;
            
            _logger.LogInformation("Created user: {UserId} - {Email}", id, user.Email);
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user: {Email}", user.Email);
            throw;
        }
    }

    public async Task<bool> UpdateAsync(User user)
    {
        try
        {
            user.UpdatedAt = DateTime.UtcNow;
            
            const string sql = @"
                UPDATE Users 
                SET FirstName = @FirstName, LastName = @LastName, Email = @Email, 
                    Phone = @Phone, IsActive = @IsActive, UpdatedAt = @UpdatedAt
                WHERE Id = @Id";
            
            var affected = await _connection.ExecuteAsync(sql, user);
            
            _logger.LogInformation("Updated user: {UserId}", user.Id);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user: {UserId}", user.Id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        try
        {
            const string sql = "UPDATE Users SET IsActive = 0, UpdatedAt = @UpdatedAt WHERE Id = @Id";
            var affected = await _connection.ExecuteAsync(sql, new { Id = id, UpdatedAt = DateTime.UtcNow });
            
            _logger.LogInformation("Soft deleted user: {UserId}", id);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user: {UserId}", id);
            throw;
        }
    }

    public async Task<bool> ExistsAsync(int id)
    {
        try
        {
            const string sql = "SELECT COUNT(*) FROM Users WHERE Id = @Id AND IsActive = 1";
            var count = await _connection.QuerySingleAsync<int>(sql, new { Id = id });
            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if user exists: {UserId}", id);
            throw;
        }
    }

    public async Task<bool> EmailExistsAsync(string email, int? excludeId = null)
    {
        try
        {
            var sql = "SELECT COUNT(*) FROM Users WHERE Email = @Email AND IsActive = 1";
            var parameters = new { Email = email };
            
            if (excludeId.HasValue)
            {
                sql += " AND Id != @ExcludeId";
                parameters = new { Email = email, ExcludeId = excludeId.Value };
            }
            
            var count = await _connection.QuerySingleAsync<int>(sql, parameters);
            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if email exists: {Email}", email);
            throw;
        }
    }
}`,

    'Repositories/IProductRepository.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Repositories;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(int id);
    Task<Product?> GetBySKUAsync(string sku);
    Task<IEnumerable<Product>> GetAllAsync();
    Task<IEnumerable<Product>> GetPagedAsync(int page, int pageSize, string? category = null, string? search = null);
    Task<IEnumerable<Product>> GetByCategoryAsync(string category);
    Task<int> GetCountAsync(string? category = null, string? search = null);
    Task<int> CreateAsync(Product product);
    Task<bool> UpdateAsync(Product product);
    Task<bool> DeleteAsync(int id);
    Task<bool> UpdateStockAsync(int id, int quantity);
    Task<bool> ExistsAsync(int id);
}`,

    'Repositories/ProductRepository.cs': `using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using Dapper;
using System.Data;
using System.Text;

namespace {{serviceName}}.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly IDbConnection _connection;
    private readonly ILogger<ProductRepository> _logger;

    public ProductRepository(IDbConnection connection, ILogger<ProductRepository> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async Task<Product?> GetByIdAsync(int id)
    {
        try
        {
            const string sql = "SELECT * FROM Products WHERE Id = @Id AND IsActive = 1";
            return await _connection.QueryFirstOrDefaultAsync<Product>(sql, new { Id = id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product by ID: {ProductId}", id);
            throw;
        }
    }

    public async Task<Product?> GetBySKUAsync(string sku)
    {
        try
        {
            const string sql = "SELECT * FROM Products WHERE SKU = @SKU AND IsActive = 1";
            return await _connection.QueryFirstOrDefaultAsync<Product>(sql, new { SKU = sku });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product by SKU: {SKU}", sku);
            throw;
        }
    }

    public async Task<IEnumerable<Product>> GetAllAsync()
    {
        try
        {
            const string sql = "SELECT * FROM Products WHERE IsActive = 1 ORDER BY Name";
            return await _connection.QueryAsync<Product>(sql);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all products");
            throw;
        }
    }

    public async Task<IEnumerable<Product>> GetPagedAsync(int page, int pageSize, string? category = null, string? search = null)
    {
        try
        {
            var offset = (page - 1) * pageSize;
            var sqlBuilder = new StringBuilder(@"
                SELECT * FROM Products 
                WHERE IsActive = 1");
            
            var parameters = new DynamicParameters();
            parameters.Add("Offset", offset);
            parameters.Add("PageSize", pageSize);
            
            if (!string.IsNullOrEmpty(category))
            {
                sqlBuilder.Append(" AND Category = @Category");
                parameters.Add("Category", category);
            }
            
            if (!string.IsNullOrEmpty(search))
            {
                sqlBuilder.Append(" AND (Name LIKE @Search OR Description LIKE @Search)");
                parameters.Add("Search", $"%{search}%");
            }
            
            sqlBuilder.Append(" ORDER BY Name OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY");
            
            return await _connection.QueryAsync<Product>(sqlBuilder.ToString(), parameters);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting paged products: Page {Page}, PageSize {PageSize}", page, pageSize);
            throw;
        }
    }

    public async Task<IEnumerable<Product>> GetByCategoryAsync(string category)
    {
        try
        {
            const string sql = "SELECT * FROM Products WHERE Category = @Category AND IsActive = 1 ORDER BY Name";
            return await _connection.QueryAsync<Product>(sql, new { Category = category });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products by category: {Category}", category);
            throw;
        }
    }

    public async Task<int> GetCountAsync(string? category = null, string? search = null)
    {
        try
        {
            var sqlBuilder = new StringBuilder("SELECT COUNT(*) FROM Products WHERE IsActive = 1");
            var parameters = new DynamicParameters();
            
            if (!string.IsNullOrEmpty(category))
            {
                sqlBuilder.Append(" AND Category = @Category");
                parameters.Add("Category", category);
            }
            
            if (!string.IsNullOrEmpty(search))
            {
                sqlBuilder.Append(" AND (Name LIKE @Search OR Description LIKE @Search)");
                parameters.Add("Search", $"%{search}%");
            }
            
            return await _connection.QuerySingleAsync<int>(sqlBuilder.ToString(), parameters);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product count");
            throw;
        }
    }

    public async Task<int> CreateAsync(Product product)
    {
        try
        {
            product.CreatedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;
            
            const string sql = @"
                INSERT INTO Products (Name, Description, Price, Category, StockQuantity, SKU, IsActive, CreatedAt, UpdatedAt)
                VALUES (@Name, @Description, @Price, @Category, @StockQuantity, @SKU, @IsActive, @CreatedAt, @UpdatedAt);
                SELECT CAST(SCOPE_IDENTITY() as int);";
            
            var id = await _connection.QuerySingleAsync<int>(sql, product);
            product.Id = id;
            
            _logger.LogInformation("Created product: {ProductId} - {Name}", id, product.Name);
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product: {Name}", product.Name);
            throw;
        }
    }

    public async Task<bool> UpdateAsync(Product product)
    {
        try
        {
            product.UpdatedAt = DateTime.UtcNow;
            
            const string sql = @"
                UPDATE Products 
                SET Name = @Name, Description = @Description, Price = @Price, 
                    Category = @Category, StockQuantity = @StockQuantity, 
                    SKU = @SKU, IsActive = @IsActive, UpdatedAt = @UpdatedAt
                WHERE Id = @Id";
            
            var affected = await _connection.ExecuteAsync(sql, product);
            
            _logger.LogInformation("Updated product: {ProductId}", product.Id);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product: {ProductId}", product.Id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        try
        {
            const string sql = "UPDATE Products SET IsActive = 0, UpdatedAt = @UpdatedAt WHERE Id = @Id";
            var affected = await _connection.ExecuteAsync(sql, new { Id = id, UpdatedAt = DateTime.UtcNow });
            
            _logger.LogInformation("Soft deleted product: {ProductId}", id);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product: {ProductId}", id);
            throw;
        }
    }

    public async Task<bool> UpdateStockAsync(int id, int quantity)
    {
        try
        {
            const string sql = @"
                UPDATE Products 
                SET StockQuantity = @Quantity, UpdatedAt = @UpdatedAt 
                WHERE Id = @Id AND IsActive = 1";
            
            var affected = await _connection.ExecuteAsync(sql, new 
            { 
                Id = id, 
                Quantity = quantity, 
                UpdatedAt = DateTime.UtcNow 
            });
            
            _logger.LogInformation("Updated stock for product {ProductId}: {Quantity}", id, quantity);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating stock for product: {ProductId}", id);
            throw;
        }
    }

    public async Task<bool> ExistsAsync(int id)
    {
        try
        {
            const string sql = "SELECT COUNT(*) FROM Products WHERE Id = @Id AND IsActive = 1";
            var count = await _connection.QuerySingleAsync<int>(sql, new { Id = id });
            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if product exists: {ProductId}", id);
            throw;
        }
    }
}`,

    'Repositories/IOrderRepository.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Repositories;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id);
    Task<Order?> GetByOrderNumberAsync(string orderNumber);
    Task<IEnumerable<Order>> GetByUserIdAsync(int userId);
    Task<IEnumerable<Order>> GetPagedAsync(int page, int pageSize, string? status = null);
    Task<int> GetCountAsync(string? status = null);
    Task<int> CreateAsync(Order order);
    Task<bool> UpdateAsync(Order order);
    Task<bool> UpdateStatusAsync(int id, string status);
    Task<bool> DeleteAsync(int id);
    Task<List<OrderItem>> GetOrderItemsAsync(int orderId);
    Task<int> CreateOrderItemAsync(OrderItem orderItem);
}`,

    'Repositories/OrderRepository.cs': `using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using Dapper;
using System.Data;
using System.Text;

namespace {{serviceName}}.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly IDbConnection _connection;
    private readonly ILogger<OrderRepository> _logger;

    public OrderRepository(IDbConnection connection, ILogger<OrderRepository> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async Task<Order?> GetByIdAsync(int id)
    {
        try
        {
            const string sql = @"
                SELECT o.*, u.Id, u.FirstName, u.LastName, u.Email, u.Phone
                FROM Orders o
                INNER JOIN Users u ON o.UserId = u.Id
                WHERE o.Id = @Id";
            
            var orderDict = new Dictionary<int, Order>();
            
            var orders = await _connection.QueryAsync<Order, User, Order>(
                sql,
                (order, user) =>
                {
                    if (!orderDict.TryGetValue(order.Id, out var orderEntry))
                    {
                        orderEntry = order;
                        orderEntry.User = user;
                        orderDict.Add(order.Id, orderEntry);
                    }
                    return orderEntry;
                },
                new { Id = id },
                splitOn: "Id");
            
            var result = orders.FirstOrDefault();
            if (result != null)
            {
                result.Items = await GetOrderItemsAsync(result.Id);
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting order by ID: {OrderId}", id);
            throw;
        }
    }

    public async Task<Order?> GetByOrderNumberAsync(string orderNumber)
    {
        try
        {
            const string sql = "SELECT * FROM Orders WHERE OrderNumber = @OrderNumber";
            var order = await _connection.QueryFirstOrDefaultAsync<Order>(sql, new { OrderNumber = orderNumber });
            
            if (order != null)
            {
                order.Items = await GetOrderItemsAsync(order.Id);
            }
            
            return order;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting order by number: {OrderNumber}", orderNumber);
            throw;
        }
    }

    public async Task<IEnumerable<Order>> GetByUserIdAsync(int userId)
    {
        try
        {
            const string sql = "SELECT * FROM Orders WHERE UserId = @UserId ORDER BY OrderDate DESC";
            var orders = await _connection.QueryAsync<Order>(sql, new { UserId = userId });
            
            foreach (var order in orders)
            {
                order.Items = await GetOrderItemsAsync(order.Id);
            }
            
            return orders;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting orders by user ID: {UserId}", userId);
            throw;
        }
    }

    public async Task<IEnumerable<Order>> GetPagedAsync(int page, int pageSize, string? status = null)
    {
        try
        {
            var offset = (page - 1) * pageSize;
            var sqlBuilder = new StringBuilder("SELECT * FROM Orders WHERE 1=1");
            var parameters = new DynamicParameters();
            parameters.Add("Offset", offset);
            parameters.Add("PageSize", pageSize);
            
            if (!string.IsNullOrEmpty(status))
            {
                sqlBuilder.Append(" AND Status = @Status");
                parameters.Add("Status", status);
            }
            
            sqlBuilder.Append(" ORDER BY OrderDate DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY");
            
            return await _connection.QueryAsync<Order>(sqlBuilder.ToString(), parameters);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting paged orders: Page {Page}, PageSize {PageSize}", page, pageSize);
            throw;
        }
    }

    public async Task<int> GetCountAsync(string? status = null)
    {
        try
        {
            var sqlBuilder = new StringBuilder("SELECT COUNT(*) FROM Orders WHERE 1=1");
            var parameters = new DynamicParameters();
            
            if (!string.IsNullOrEmpty(status))
            {
                sqlBuilder.Append(" AND Status = @Status");
                parameters.Add("Status", status);
            }
            
            return await _connection.QuerySingleAsync<int>(sqlBuilder.ToString(), parameters);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting order count");
            throw;
        }
    }

    public async Task<int> CreateAsync(Order order)
    {
        try
        {
            order.CreatedAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;
            order.OrderDate = DateTime.UtcNow;
            
            const string sql = @"
                INSERT INTO Orders (UserId, OrderNumber, TotalAmount, Status, OrderDate, ShippingAddress, Notes, CreatedAt, UpdatedAt)
                VALUES (@UserId, @OrderNumber, @TotalAmount, @Status, @OrderDate, @ShippingAddress, @Notes, @CreatedAt, @UpdatedAt);
                SELECT CAST(SCOPE_IDENTITY() as int);";
            
            var id = await _connection.QuerySingleAsync<int>(sql, order);
            order.Id = id;
            
            _logger.LogInformation("Created order: {OrderId} - {OrderNumber}", id, order.OrderNumber);
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating order: {OrderNumber}", order.OrderNumber);
            throw;
        }
    }

    public async Task<bool> UpdateAsync(Order order)
    {
        try
        {
            order.UpdatedAt = DateTime.UtcNow;
            
            const string sql = @"
                UPDATE Orders 
                SET TotalAmount = @TotalAmount, Status = @Status, ShippedDate = @ShippedDate,
                    DeliveredDate = @DeliveredDate, ShippingAddress = @ShippingAddress,
                    Notes = @Notes, UpdatedAt = @UpdatedAt
                WHERE Id = @Id";
            
            var affected = await _connection.ExecuteAsync(sql, order);
            
            _logger.LogInformation("Updated order: {OrderId}", order.Id);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating order: {OrderId}", order.Id);
            throw;
        }
    }

    public async Task<bool> UpdateStatusAsync(int id, string status)
    {
        try
        {
            const string sql = "UPDATE Orders SET Status = @Status, UpdatedAt = @UpdatedAt WHERE Id = @Id";
            var affected = await _connection.ExecuteAsync(sql, new 
            { 
                Id = id, 
                Status = status, 
                UpdatedAt = DateTime.UtcNow 
            });
            
            _logger.LogInformation("Updated order status: {OrderId} -> {Status}", id, status);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating order status: {OrderId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        try
        {
            const string sql = "DELETE FROM Orders WHERE Id = @Id";
            var affected = await _connection.ExecuteAsync(sql, new { Id = id });
            
            _logger.LogInformation("Deleted order: {OrderId}", id);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting order: {OrderId}", id);
            throw;
        }
    }

    public async Task<List<OrderItem>> GetOrderItemsAsync(int orderId)
    {
        try
        {
            const string sql = @"
                SELECT oi.*, p.Id, p.Name, p.Description, p.Price, p.Category, p.SKU
                FROM OrderItems oi
                INNER JOIN Products p ON oi.ProductId = p.Id
                WHERE oi.OrderId = @OrderId";
            
            var orderItemDict = new Dictionary<int, OrderItem>();
            
            var orderItems = await _connection.QueryAsync<OrderItem, Product, OrderItem>(
                sql,
                (orderItem, product) =>
                {
                    if (!orderItemDict.TryGetValue(orderItem.Id, out var orderItemEntry))
                    {
                        orderItemEntry = orderItem;
                        orderItemEntry.Product = product;
                        orderItemDict.Add(orderItem.Id, orderItemEntry);
                    }
                    return orderItemEntry;
                },
                new { OrderId = orderId },
                splitOn: "Id");
            
            return orderItems.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting order items for order: {OrderId}", orderId);
            throw;
        }
    }

    public async Task<int> CreateOrderItemAsync(OrderItem orderItem)
    {
        try
        {
            orderItem.CreatedAt = DateTime.UtcNow;
            
            const string sql = @"
                INSERT INTO OrderItems (OrderId, ProductId, Quantity, UnitPrice, TotalPrice, CreatedAt)
                VALUES (@OrderId, @ProductId, @Quantity, @UnitPrice, @TotalPrice, @CreatedAt);
                SELECT CAST(SCOPE_IDENTITY() as int);";
            
            var id = await _connection.QuerySingleAsync<int>(sql, orderItem);
            orderItem.Id = id;
            
            return id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating order item for order: {OrderId}", orderItem.OrderId);
            throw;
        }
    }
}`,

    // Services
    'Services/IUserService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IUserService
{
    Task<UserDto?> GetByIdAsync(int id);
    Task<UserDto?> GetByEmailAsync(string email);
    Task<IEnumerable<UserDto>> GetAllAsync();
    Task<(IEnumerable<UserDto> Users, int TotalCount)> GetPagedAsync(int page, int pageSize);
    Task<UserDto> CreateAsync(CreateUserDto createUserDto);
    Task<UserDto?> UpdateAsync(int id, UpdateUserDto updateUserDto);
    Task<bool> DeleteAsync(int id);
    Task<bool> ExistsAsync(int id);
}`,

    'Services/UserService.cs': `using {{serviceName}}.DTOs;
using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using AutoMapper;
using BCrypt.Net;

namespace {{serviceName}}.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IMapper _mapper;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository userRepository, IMapper mapper, ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<UserDto?> GetByIdAsync(int id)
    {
        var user = await _userRepository.GetByIdAsync(id);
        return user == null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> GetByEmailAsync(string email)
    {
        var user = await _userRepository.GetByEmailAsync(email);
        return user == null ? null : _mapper.Map<UserDto>(user);
    }

    public async Task<IEnumerable<UserDto>> GetAllAsync()
    {
        var users = await _userRepository.GetAllAsync();
        return _mapper.Map<IEnumerable<UserDto>>(users);
    }

    public async Task<(IEnumerable<UserDto> Users, int TotalCount)> GetPagedAsync(int page, int pageSize)
    {
        var users = await _userRepository.GetPagedAsync(page, pageSize);
        var totalCount = await _userRepository.GetCountAsync();
        
        return (_mapper.Map<IEnumerable<UserDto>>(users), totalCount);
    }

    public async Task<UserDto> CreateAsync(CreateUserDto createUserDto)
    {
        // Check if email already exists
        if (await _userRepository.EmailExistsAsync(createUserDto.Email))
        {
            throw new InvalidOperationException($"User with email {createUserDto.Email} already exists");
        }

        var user = _mapper.Map<User>(createUserDto);
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(createUserDto.Password);
        
        await _userRepository.CreateAsync(user);
        
        _logger.LogInformation("Created user: {UserId} - {Email}", user.Id, user.Email);
        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> UpdateAsync(int id, UpdateUserDto updateUserDto)
    {
        var existingUser = await _userRepository.GetByIdAsync(id);
        if (existingUser == null)
        {
            return null;
        }

        // Check if email already exists for another user
        if (await _userRepository.EmailExistsAsync(updateUserDto.Email, id))
        {
            throw new InvalidOperationException($"User with email {updateUserDto.Email} already exists");
        }

        _mapper.Map(updateUserDto, existingUser);
        await _userRepository.UpdateAsync(existingUser);
        
        _logger.LogInformation("Updated user: {UserId}", id);
        return _mapper.Map<UserDto>(existingUser);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        if (!await _userRepository.ExistsAsync(id))
        {
            return false;
        }

        var result = await _userRepository.DeleteAsync(id);
        if (result)
        {
            _logger.LogInformation("Deleted user: {UserId}", id);
        }
        
        return result;
    }

    public async Task<bool> ExistsAsync(int id)
    {
        return await _userRepository.ExistsAsync(id);
    }
}`,

    'Services/IProductService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IProductService
{
    Task<ProductDto?> GetByIdAsync(int id);
    Task<ProductDto?> GetBySKUAsync(string sku);
    Task<IEnumerable<ProductDto>> GetAllAsync();
    Task<(IEnumerable<ProductDto> Products, int TotalCount)> GetPagedAsync(int page, int pageSize, string? category = null, string? search = null);
    Task<IEnumerable<ProductDto>> GetByCategoryAsync(string category);
    Task<ProductDto> CreateAsync(CreateProductDto createProductDto);
    Task<ProductDto?> UpdateAsync(int id, UpdateProductDto updateProductDto);
    Task<bool> DeleteAsync(int id);
    Task<bool> UpdateStockAsync(int id, int quantity);
    Task<bool> ExistsAsync(int id);
}`,

    'Services/ProductService.cs': `using {{serviceName}}.DTOs;
using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using AutoMapper;

namespace {{serviceName}}.Services;

public class ProductService : IProductService
{
    private readonly IProductRepository _productRepository;
    private readonly IMapper _mapper;
    private readonly ILogger<ProductService> _logger;

    public ProductService(IProductRepository productRepository, IMapper mapper, ILogger<ProductService> logger)
    {
        _productRepository = productRepository;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ProductDto?> GetByIdAsync(int id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        return product == null ? null : _mapper.Map<ProductDto>(product);
    }

    public async Task<ProductDto?> GetBySKUAsync(string sku)
    {
        var product = await _productRepository.GetBySKUAsync(sku);
        return product == null ? null : _mapper.Map<ProductDto>(product);
    }

    public async Task<IEnumerable<ProductDto>> GetAllAsync()
    {
        var products = await _productRepository.GetAllAsync();
        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<(IEnumerable<ProductDto> Products, int TotalCount)> GetPagedAsync(int page, int pageSize, string? category = null, string? search = null)
    {
        var products = await _productRepository.GetPagedAsync(page, pageSize, category, search);
        var totalCount = await _productRepository.GetCountAsync(category, search);
        
        return (_mapper.Map<IEnumerable<ProductDto>>(products), totalCount);
    }

    public async Task<IEnumerable<ProductDto>> GetByCategoryAsync(string category)
    {
        var products = await _productRepository.GetByCategoryAsync(category);
        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<ProductDto> CreateAsync(CreateProductDto createProductDto)
    {
        var product = _mapper.Map<Product>(createProductDto);
        
        // Generate SKU if not provided
        if (string.IsNullOrEmpty(product.SKU))
        {
            product.SKU = GenerateSKU(product.Name, product.Category);
        }
        
        await _productRepository.CreateAsync(product);
        
        _logger.LogInformation("Created product: {ProductId} - {Name}", product.Id, product.Name);
        return _mapper.Map<ProductDto>(product);
    }

    public async Task<ProductDto?> UpdateAsync(int id, UpdateProductDto updateProductDto)
    {
        var existingProduct = await _productRepository.GetByIdAsync(id);
        if (existingProduct == null)
        {
            return null;
        }

        _mapper.Map(updateProductDto, existingProduct);
        await _productRepository.UpdateAsync(existingProduct);
        
        _logger.LogInformation("Updated product: {ProductId}", id);
        return _mapper.Map<ProductDto>(existingProduct);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        if (!await _productRepository.ExistsAsync(id))
        {
            return false;
        }

        var result = await _productRepository.DeleteAsync(id);
        if (result)
        {
            _logger.LogInformation("Deleted product: {ProductId}", id);
        }
        
        return result;
    }

    public async Task<bool> UpdateStockAsync(int id, int quantity)
    {
        if (!await _productRepository.ExistsAsync(id))
        {
            return false;
        }

        var result = await _productRepository.UpdateStockAsync(id, quantity);
        if (result)
        {
            _logger.LogInformation("Updated stock for product {ProductId}: {Quantity}", id, quantity);
        }
        
        return result;
    }

    public async Task<bool> ExistsAsync(int id)
    {
        return await _productRepository.ExistsAsync(id);
    }

    private static string GenerateSKU(string name, string category)
    {
        var namePrefix = new string(name.Take(3).ToArray()).ToUpper();
        var categoryPrefix = new string(category.Take(2).ToArray()).ToUpper();
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        
        return $"{categoryPrefix}-{namePrefix}-{timestamp}";
    }
}`,

    'Services/IOrderService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IOrderService
{
    Task<OrderDto?> GetByIdAsync(int id);
    Task<OrderDto?> GetByOrderNumberAsync(string orderNumber);
    Task<IEnumerable<OrderDto>> GetByUserIdAsync(int userId);
    Task<(IEnumerable<OrderDto> Orders, int TotalCount)> GetPagedAsync(int page, int pageSize, string? status = null);
    Task<OrderDto> CreateAsync(CreateOrderDto createOrderDto);
    Task<OrderDto?> UpdateStatusAsync(int id, string status);
    Task<bool> DeleteAsync(int id);
}`,

    'Services/OrderService.cs': `using {{serviceName}}.DTOs;
using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using AutoMapper;

namespace {{serviceName}}.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IProductRepository _productRepository;
    private readonly IUserRepository _userRepository;
    private readonly IMapper _mapper;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepository,
        IProductRepository productRepository,
        IUserRepository userRepository,
        IMapper mapper,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
        _userRepository = userRepository;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<OrderDto?> GetByIdAsync(int id)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        return order == null ? null : _mapper.Map<OrderDto>(order);
    }

    public async Task<OrderDto?> GetByOrderNumberAsync(string orderNumber)
    {
        var order = await _orderRepository.GetByOrderNumberAsync(orderNumber);
        return order == null ? null : _mapper.Map<OrderDto>(order);
    }

    public async Task<IEnumerable<OrderDto>> GetByUserIdAsync(int userId)
    {
        var orders = await _orderRepository.GetByUserIdAsync(userId);
        return _mapper.Map<IEnumerable<OrderDto>>(orders);
    }

    public async Task<(IEnumerable<OrderDto> Orders, int TotalCount)> GetPagedAsync(int page, int pageSize, string? status = null)
    {
        var orders = await _orderRepository.GetPagedAsync(page, pageSize, status);
        var totalCount = await _orderRepository.GetCountAsync(status);
        
        return (_mapper.Map<IEnumerable<OrderDto>>(orders), totalCount);
    }

    public async Task<OrderDto> CreateAsync(CreateOrderDto createOrderDto)
    {
        // Validate user exists
        if (!await _userRepository.ExistsAsync(createOrderDto.UserId))
        {
            throw new InvalidOperationException($"User with ID {createOrderDto.UserId} does not exist");
        }

        // Validate all products exist and calculate totals
        decimal totalAmount = 0;
        var orderItems = new List<OrderItem>();

        foreach (var itemDto in createOrderDto.Items)
        {
            var product = await _productRepository.GetByIdAsync(itemDto.ProductId);
            if (product == null)
            {
                throw new InvalidOperationException($"Product with ID {itemDto.ProductId} does not exist");
            }

            if (product.StockQuantity < itemDto.Quantity)
            {
                throw new InvalidOperationException($"Insufficient stock for product {product.Name}. Available: {product.StockQuantity}, Requested: {itemDto.Quantity}");
            }

            var orderItem = new OrderItem
            {
                ProductId = itemDto.ProductId,
                Quantity = itemDto.Quantity,
                UnitPrice = product.Price,
                TotalPrice = product.Price * itemDto.Quantity
            };

            orderItems.Add(orderItem);
            totalAmount += orderItem.TotalPrice;
        }

        // Create order
        var order = new Order
        {
            UserId = createOrderDto.UserId,
            OrderNumber = GenerateOrderNumber(),
            TotalAmount = totalAmount,
            Status = "Pending",
            ShippingAddress = createOrderDto.ShippingAddress,
            Notes = createOrderDto.Notes
        };

        var orderId = await _orderRepository.CreateAsync(order);

        // Create order items
        foreach (var orderItem in orderItems)
        {
            orderItem.OrderId = orderId;
            await _orderRepository.CreateOrderItemAsync(orderItem);

            // Update product stock
            var product = await _productRepository.GetByIdAsync(orderItem.ProductId);
            await _productRepository.UpdateStockAsync(orderItem.ProductId, product!.StockQuantity - orderItem.Quantity);
        }

        // Retrieve the complete order with items
        var createdOrder = await _orderRepository.GetByIdAsync(orderId);
        
        _logger.LogInformation("Created order: {OrderId} - {OrderNumber}", orderId, order.OrderNumber);
        return _mapper.Map<OrderDto>(createdOrder);
    }

    public async Task<OrderDto?> UpdateStatusAsync(int id, string status)
    {
        var existingOrder = await _orderRepository.GetByIdAsync(id);
        if (existingOrder == null)
        {
            return null;
        }

        await _orderRepository.UpdateStatusAsync(id, status);
        
        // Update timestamps based on status
        if (status == "Shipped" && existingOrder.ShippedDate == null)
        {
            existingOrder.ShippedDate = DateTime.UtcNow;
        }
        else if (status == "Delivered" && existingOrder.DeliveredDate == null)
        {
            existingOrder.DeliveredDate = DateTime.UtcNow;
        }

        existingOrder.Status = status;
        await _orderRepository.UpdateAsync(existingOrder);
        
        _logger.LogInformation("Updated order status: {OrderId} -> {Status}", id, status);
        return _mapper.Map<OrderDto>(existingOrder);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var existingOrder = await _orderRepository.GetByIdAsync(id);
        if (existingOrder == null)
        {
            return false;
        }

        // Restore product stock
        foreach (var item in existingOrder.Items)
        {
            var product = await _productRepository.GetByIdAsync(item.ProductId);
            if (product != null)
            {
                await _productRepository.UpdateStockAsync(item.ProductId, product.StockQuantity + item.Quantity);
            }
        }

        var result = await _orderRepository.DeleteAsync(id);
        if (result)
        {
            _logger.LogInformation("Deleted order: {OrderId}", id);
        }
        
        return result;
    }

    private static string GenerateOrderNumber()
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var random = new Random().Next(1000, 9999);
        return $"ORD-{timestamp}-{random}";
    }
}`,

    'Services/IAuthService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IAuthService
{
    Task<AuthResponseDto?> LoginAsync(LoginDto loginDto);
    Task<AuthResponseDto> RegisterAsync(CreateUserDto createUserDto);
    Task<string> GenerateJwtTokenAsync(UserDto user);
    Task<bool> ValidatePasswordAsync(string email, string password);
}`,

    'Services/AuthService.cs': `using {{serviceName}}.DTOs;
using {{serviceName}}.Repositories;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;

namespace {{serviceName}}.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IUserService _userService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IUserService userService,
        IConfiguration configuration,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _userService = userService;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto loginDto)
    {
        var user = await _userRepository.GetByEmailAsync(loginDto.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for email: {Email}", loginDto.Email);
            return null;
        }

        if (!user.IsActive)
        {
            _logger.LogWarning("Login attempt for inactive user: {Email}", loginDto.Email);
            return null;
        }

        var userDto = await _userService.GetByEmailAsync(loginDto.Email);
        var token = await GenerateJwtTokenAsync(userDto!);
        
        _logger.LogInformation("Successful login for user: {Email}", loginDto.Email);
        
        return new AuthResponseDto
        {
            Token = token,
            Expires = DateTime.UtcNow.AddHours(24),
            User = userDto!
        };
    }

    public async Task<AuthResponseDto> RegisterAsync(CreateUserDto createUserDto)
    {
        var userDto = await _userService.CreateAsync(createUserDto);
        var token = await GenerateJwtTokenAsync(userDto);
        
        _logger.LogInformation("User registered and logged in: {Email}", createUserDto.Email);
        
        return new AuthResponseDto
        {
            Token = token,
            Expires = DateTime.UtcNow.AddHours(24),
            User = userDto
        };
    }

    public async Task<string> GenerateJwtTokenAsync(UserDto user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = jwtSettings["SecretKey"];
        var issuer = jwtSettings["Issuer"];
        var audience = jwtSettings["Audience"];

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("jti", Guid.NewGuid().ToString()),
            new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<bool> ValidatePasswordAsync(string email, string password)
    {
        var user = await _userRepository.GetByEmailAsync(email);
        return user != null && BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
    }
}`,

    // Controllers
    'Controllers/UsersController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.DTOs;
using {{serviceName}}.Services;

namespace {{serviceName}}.Controllers;

/// <summary>
/// User management endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    /// <summary>
    /// Get all users with pagination
    /// </summary>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 10)</param>
    /// <returns>Paginated list of users</returns>
    [HttpGet]
    public async Task<ActionResult<object>> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try
        {
            var (users, totalCount) = await _userService.GetPagedAsync(page, pageSize);
            
            return Ok(new
            {
                data = users,
                pagination = new
                {
                    page,
                    pageSize,
                    totalCount,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting users");
            return StatusCode(500, "An error occurred while retrieving users");
        }
    }

    /// <summary>
    /// Get user by ID
    /// </summary>
    /// <param name="id">User ID</param>
    /// <returns>User details</returns>
    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetUser(int id)
    {
        try
        {
            var user = await _userService.GetByIdAsync(id);
            if (user == null)
            {
                return NotFound($"User with ID {id} not found");
            }

            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user by ID: {UserId}", id);
            return StatusCode(500, "An error occurred while retrieving the user");
        }
    }

    /// <summary>
    /// Create a new user
    /// </summary>
    /// <param name="createUserDto">User creation data</param>
    /// <returns>Created user</returns>
    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto createUserDto)
    {
        try
        {
            var user = await _userService.CreateAsync(createUserDto);
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user");
            return StatusCode(500, "An error occurred while creating the user");
        }
    }

    /// <summary>
    /// Update an existing user
    /// </summary>
    /// <param name="id">User ID</param>
    /// <param name="updateUserDto">User update data</param>
    /// <returns>Updated user</returns>
    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> UpdateUser(int id, [FromBody] UpdateUserDto updateUserDto)
    {
        try
        {
            var user = await _userService.UpdateAsync(id, updateUserDto);
            if (user == null)
            {
                return NotFound($"User with ID {id} not found");
            }

            return Ok(user);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user: {UserId}", id);
            return StatusCode(500, "An error occurred while updating the user");
        }
    }

    /// <summary>
    /// Delete a user
    /// </summary>
    /// <param name="id">User ID</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        try
        {
            var result = await _userService.DeleteAsync(id);
            if (!result)
            {
                return NotFound($"User with ID {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user: {UserId}", id);
            return StatusCode(500, "An error occurred while deleting the user");
        }
    }
}`,

    'Controllers/ProductsController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.DTOs;
using {{serviceName}}.Services;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Product management endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(IProductService productService, ILogger<ProductsController> logger)
    {
        _productService = productService;
        _logger = logger;
    }

    /// <summary>
    /// Get all products with pagination and filtering
    /// </summary>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 10)</param>
    /// <param name="category">Filter by category</param>
    /// <param name="search">Search in name and description</param>
    /// <returns>Paginated list of products</returns>
    [HttpGet]
    public async Task<ActionResult<object>> GetProducts(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 10,
        [FromQuery] string? category = null,
        [FromQuery] string? search = null)
    {
        try
        {
            var (products, totalCount) = await _productService.GetPagedAsync(page, pageSize, category, search);
            
            return Ok(new
            {
                data = products,
                pagination = new
                {
                    page,
                    pageSize,
                    totalCount,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                },
                filters = new
                {
                    category,
                    search
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products");
            return StatusCode(500, "An error occurred while retrieving products");
        }
    }

    /// <summary>
    /// Get product by ID
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <returns>Product details</returns>
    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> GetProduct(int id)
    {
        try
        {
            var product = await _productService.GetByIdAsync(id);
            if (product == null)
            {
                return NotFound($"Product with ID {id} not found");
            }

            return Ok(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product by ID: {ProductId}", id);
            return StatusCode(500, "An error occurred while retrieving the product");
        }
    }

    /// <summary>
    /// Get products by category
    /// </summary>
    /// <param name="category">Category name</param>
    /// <returns>List of products in category</returns>
    [HttpGet("category/{category}")]
    public async Task<ActionResult<IEnumerable<ProductDto>>> GetProductsByCategory(string category)
    {
        try
        {
            var products = await _productService.GetByCategoryAsync(category);
            return Ok(products);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products by category: {Category}", category);
            return StatusCode(500, "An error occurred while retrieving products");
        }
    }

    /// <summary>
    /// Create a new product
    /// </summary>
    /// <param name="createProductDto">Product creation data</param>
    /// <returns>Created product</returns>
    [HttpPost]
    public async Task<ActionResult<ProductDto>> CreateProduct([FromBody] CreateProductDto createProductDto)
    {
        try
        {
            var product = await _productService.CreateAsync(createProductDto);
            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product");
            return StatusCode(500, "An error occurred while creating the product");
        }
    }

    /// <summary>
    /// Update an existing product
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <param name="updateProductDto">Product update data</param>
    /// <returns>Updated product</returns>
    [HttpPut("{id}")]
    public async Task<ActionResult<ProductDto>> UpdateProduct(int id, [FromBody] UpdateProductDto updateProductDto)
    {
        try
        {
            var product = await _productService.UpdateAsync(id, updateProductDto);
            if (product == null)
            {
                return NotFound($"Product with ID {id} not found");
            }

            return Ok(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product: {ProductId}", id);
            return StatusCode(500, "An error occurred while updating the product");
        }
    }

    /// <summary>
    /// Update product stock
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <param name="quantity">New stock quantity</param>
    /// <returns>No content</returns>
    [HttpPatch("{id}/stock")]
    public async Task<IActionResult> UpdateStock(int id, [FromBody] int quantity)
    {
        try
        {
            var result = await _productService.UpdateStockAsync(id, quantity);
            if (!result)
            {
                return NotFound($"Product with ID {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating stock for product: {ProductId}", id);
            return StatusCode(500, "An error occurred while updating product stock");
        }
    }

    /// <summary>
    /// Delete a product
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        try
        {
            var result = await _productService.DeleteAsync(id);
            if (!result)
            {
                return NotFound($"Product with ID {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product: {ProductId}", id);
            return StatusCode(500, "An error occurred while deleting the product");
        }
    }
}`,

    'Controllers/OrdersController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.DTOs;
using {{serviceName}}.Services;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Order management endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(IOrderService orderService, ILogger<OrdersController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }

    /// <summary>
    /// Get all orders with pagination and filtering
    /// </summary>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 10)</param>
    /// <param name="status">Filter by status</param>
    /// <returns>Paginated list of orders</returns>
    [HttpGet]
    public async Task<ActionResult<object>> GetOrders(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 10,
        [FromQuery] string? status = null)
    {
        try
        {
            var (orders, totalCount) = await _orderService.GetPagedAsync(page, pageSize, status);
            
            return Ok(new
            {
                data = orders,
                pagination = new
                {
                    page,
                    pageSize,
                    totalCount,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                },
                filters = new
                {
                    status
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting orders");
            return StatusCode(500, "An error occurred while retrieving orders");
        }
    }

    /// <summary>
    /// Get order by ID
    /// </summary>
    /// <param name="id">Order ID</param>
    /// <returns>Order details</returns>
    [HttpGet("{id}")]
    public async Task<ActionResult<OrderDto>> GetOrder(int id)
    {
        try
        {
            var order = await _orderService.GetByIdAsync(id);
            if (order == null)
            {
                return NotFound($"Order with ID {id} not found");
            }

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting order by ID: {OrderId}", id);
            return StatusCode(500, "An error occurred while retrieving the order");
        }
    }

    /// <summary>
    /// Get orders by user ID
    /// </summary>
    /// <param name="userId">User ID</param>
    /// <returns>List of user orders</returns>
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<IEnumerable<OrderDto>>> GetOrdersByUser(int userId)
    {
        try
        {
            var orders = await _orderService.GetByUserIdAsync(userId);
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting orders by user ID: {UserId}", userId);
            return StatusCode(500, "An error occurred while retrieving orders");
        }
    }

    /// <summary>
    /// Create a new order
    /// </summary>
    /// <param name="createOrderDto">Order creation data</param>
    /// <returns>Created order</returns>
    [HttpPost]
    public async Task<ActionResult<OrderDto>> CreateOrder([FromBody] CreateOrderDto createOrderDto)
    {
        try
        {
            var order = await _orderService.CreateAsync(createOrderDto);
            return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating order");
            return StatusCode(500, "An error occurred while creating the order");
        }
    }

    /// <summary>
    /// Update order status
    /// </summary>
    /// <param name="id">Order ID</param>
    /// <param name="status">New status</param>
    /// <returns>Updated order</returns>
    [HttpPatch("{id}/status")]
    public async Task<ActionResult<OrderDto>> UpdateOrderStatus(int id, [FromBody] string status)
    {
        try
        {
            var order = await _orderService.UpdateStatusAsync(id, status);
            if (order == null)
            {
                return NotFound($"Order with ID {id} not found");
            }

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating order status: {OrderId}", id);
            return StatusCode(500, "An error occurred while updating the order status");
        }
    }

    /// <summary>
    /// Delete an order
    /// </summary>
    /// <param name="id">Order ID</param>
    /// <returns>No content</returns>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteOrder(int id)
    {
        try
        {
            var result = await _orderService.DeleteAsync(id);
            if (!result)
            {
                return NotFound($"Order with ID {id} not found");
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting order: {OrderId}", id);
            return StatusCode(500, "An error occurred while deleting the order");
        }
    }
}`,

    'Controllers/AuthController.cs': `using Microsoft.AspNetCore.Mvc;
using {{serviceName}}.DTOs;
using {{serviceName}}.Services;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Authentication endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Authenticate user and return JWT token
    /// </summary>
    /// <param name="loginDto">Login credentials</param>
    /// <returns>Authentication response with JWT token</returns>
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto loginDto)
    {
        try
        {
            var result = await _authService.LoginAsync(loginDto);
            if (result == null)
            {
                return Unauthorized("Invalid email or password");
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login");
            return StatusCode(500, "An error occurred during login");
        }
    }

    /// <summary>
    /// Register new user and return JWT token
    /// </summary>
    /// <param name="createUserDto">User registration data</param>
    /// <returns>Authentication response with JWT token</returns>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] CreateUserDto createUserDto)
    {
        try
        {
            var result = await _authService.RegisterAsync(createUserDto);
            return CreatedAtAction(nameof(Login), result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration");
            return StatusCode(500, "An error occurred during registration");
        }
    }
}`,

    // AutoMapper Profile
    'Mappings/MappingProfile.cs': `using AutoMapper;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // User mappings
        CreateMap<User, UserDto>();
        CreateMap<CreateUserDto, User>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());
        CreateMap<UpdateUserDto, User>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());

        // Product mappings
        CreateMap<Product, ProductDto>();
        CreateMap<CreateProductDto, Product>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());
        CreateMap<UpdateProductDto, Product>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());

        // Order mappings
        CreateMap<Order, OrderDto>();
        CreateMap<CreateOrderDto, Order>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OrderNumber, opt => opt.Ignore())
            .ForMember(dest => dest.TotalAmount, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => "Pending"))
            .ForMember(dest => dest.OrderDate, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Items, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore());

        // Order Item mappings
        CreateMap<OrderItem, OrderItemDto>();
        CreateMap<CreateOrderItemDto, OrderItem>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OrderId, opt => opt.Ignore())
            .ForMember(dest => dest.UnitPrice, opt => opt.Ignore())
            .ForMember(dest => dest.TotalPrice, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Product, opt => opt.Ignore());
    }
}`,

    // Database Initialization
    'Data/IDatabaseInitializer.cs': `namespace {{serviceName}}.Data;

public interface IDatabaseInitializer
{
    Task InitializeAsync();
    Task SeedDataAsync();
}`,

    'Data/DatabaseInitializer.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Models;
using {{serviceName}}.Repositories;
using Dapper;
using System.Data;
using BCrypt.Net;

namespace {{serviceName}}.Data;

public class DatabaseInitializer : IDatabaseInitializer
{
    private readonly IDbConnection _connection;
    private readonly IUserRepository _userRepository;
    private readonly IProductRepository _productRepository;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(
        IDbConnection connection,
        IUserRepository userRepository,
        IProductRepository productRepository,
        ILogger<DatabaseInitializer> logger)
    {
        _connection = connection;
        _userRepository = userRepository;
        _productRepository = productRepository;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        try
        {
            await CreateTablesAsync();
            await SeedDataAsync();
            _logger.LogInformation("Database initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing database");
            throw;
        }
    }

    private async Task CreateTablesAsync()
    {
        // Create Users table
        await _connection.ExecuteAsync(@"
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
            CREATE TABLE Users (
                Id int IDENTITY(1,1) PRIMARY KEY,
                FirstName nvarchar(100) NOT NULL,
                LastName nvarchar(100) NOT NULL,
                Email nvarchar(200) NOT NULL UNIQUE,
                Phone nvarchar(20),
                PasswordHash nvarchar(255),
                IsActive bit NOT NULL DEFAULT 1,
                CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE()
            )");

        // Create Products table
        await _connection.ExecuteAsync(@"
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Products' AND xtype='U')
            CREATE TABLE Products (
                Id int IDENTITY(1,1) PRIMARY KEY,
                Name nvarchar(200) NOT NULL,
                Description nvarchar(1000),
                Price decimal(18,2) NOT NULL,
                Category nvarchar(100) NOT NULL,
                StockQuantity int NOT NULL DEFAULT 0,
                SKU nvarchar(50),
                IsActive bit NOT NULL DEFAULT 1,
                CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE()
            )");

        // Create Orders table
        await _connection.ExecuteAsync(@"
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Orders' AND xtype='U')
            CREATE TABLE Orders (
                Id int IDENTITY(1,1) PRIMARY KEY,
                UserId int NOT NULL,
                OrderNumber nvarchar(50) NOT NULL UNIQUE,
                TotalAmount decimal(18,2) NOT NULL,
                Status nvarchar(50) NOT NULL DEFAULT 'Pending',
                OrderDate datetime2 NOT NULL DEFAULT GETUTCDATE(),
                ShippedDate datetime2,
                DeliveredDate datetime2,
                ShippingAddress nvarchar(500),
                Notes nvarchar(1000),
                CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            )");

        // Create OrderItems table
        await _connection.ExecuteAsync(@"
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrderItems' AND xtype='U')
            CREATE TABLE OrderItems (
                Id int IDENTITY(1,1) PRIMARY KEY,
                OrderId int NOT NULL,
                ProductId int NOT NULL,
                Quantity int NOT NULL,
                UnitPrice decimal(18,2) NOT NULL,
                TotalPrice decimal(18,2) NOT NULL,
                CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                FOREIGN KEY (OrderId) REFERENCES Orders(Id) ON DELETE CASCADE,
                FOREIGN KEY (ProductId) REFERENCES Products(Id)
            )");

        // Create indexes
        await _connection.ExecuteAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Email')
            CREATE INDEX IX_Users_Email ON Users(Email);
            
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_Category')
            CREATE INDEX IX_Products_Category ON Products(Category);
            
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Products_SKU')
            CREATE INDEX IX_Products_SKU ON Products(SKU);
            
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Orders_UserId')
            CREATE INDEX IX_Orders_UserId ON Orders(UserId);
            
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Orders_Status')
            CREATE INDEX IX_Orders_Status ON Orders(Status);
            
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OrderItems_OrderId')
            CREATE INDEX IX_OrderItems_OrderId ON OrderItems(OrderId);
            
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OrderItems_ProductId')
            CREATE INDEX IX_OrderItems_ProductId ON OrderItems(ProductId);
        ");

        _logger.LogInformation("Database tables created successfully");
    }

    public async Task SeedDataAsync()
    {
        // Check if data already exists
        var userCount = await _connection.QuerySingleAsync<int>("SELECT COUNT(*) FROM Users");
        if (userCount > 0)
        {
            _logger.LogInformation("Database already contains data, skipping seeding");
            return;
        }

        // Seed users
        var users = new[]
        {
            new User
            {
                FirstName = "Admin",
                LastName = "User",
                Email = "admin@{{serviceName}}.com",
                Phone = "+1-555-0001",
                PasswordHash = BCrypt.HashPassword("Admin123!"),
                IsActive = true
            },
            new User
            {
                FirstName = "John",
                LastName = "Doe",
                Email = "john.doe@example.com",
                Phone = "+1-555-0002",
                PasswordHash = BCrypt.HashPassword("User123!"),
                IsActive = true
            },
            new User
            {
                FirstName = "Jane",
                LastName = "Smith",
                Email = "jane.smith@example.com",
                Phone = "+1-555-0003",
                PasswordHash = BCrypt.HashPassword("User123!"),
                IsActive = true
            }
        };

        foreach (var user in users)
        {
            await _userRepository.CreateAsync(user);
        }

        // Seed products
        var products = new[]
        {
            new Product { Name = "Laptop Pro", Description = "High-performance laptop for professionals", Price = 1299.99m, Category = "Electronics", StockQuantity = 50, SKU = "LAP-PRO-001" },
            new Product { Name = "Wireless Mouse", Description = "Ergonomic wireless mouse", Price = 29.99m, Category = "Electronics", StockQuantity = 200, SKU = "MOU-WIR-001" },
            new Product { Name = "Keyboard Mechanical", Description = "RGB mechanical keyboard", Price = 89.99m, Category = "Electronics", StockQuantity = 75, SKU = "KEY-MEC-001" },
            new Product { Name = "Monitor 4K", Description = "27-inch 4K monitor", Price = 399.99m, Category = "Electronics", StockQuantity = 30, SKU = "MON-4K-001" },
            new Product { Name = "Office Chair", Description = "Ergonomic office chair", Price = 249.99m, Category = "Furniture", StockQuantity = 25, SKU = "CHA-OFF-001" },
            new Product { Name = "Desk Lamp", Description = "Adjustable LED desk lamp", Price = 39.99m, Category = "Furniture", StockQuantity = 100, SKU = "LAM-DES-001" },
            new Product { Name = "Coffee Mug", Description = "Ceramic coffee mug", Price = 12.99m, Category = "Kitchen", StockQuantity = 500, SKU = "MUG-COF-001" },
            new Product { Name = "Water Bottle", Description = "Stainless steel water bottle", Price = 19.99m, Category = "Kitchen", StockQuantity = 150, SKU = "BOT-WAT-001" }
        };

        foreach (var product in products)
        {
            await _productRepository.CreateAsync(product);
        }

        _logger.LogInformation("Database seeded successfully");
    }
}`,

    // Configuration files
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true",
    "Redis": ""
  },
  "JwtSettings": {
    "SecretKey": "YourSuperSecretKeyThatIsAtLeast32CharactersLong!",
    "Issuer": "{{serviceName}}",
    "Audience": "{{serviceName}}-users",
    "ExpiryHours": 24
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.File"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.Hosting.Lifetime": "Information"
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
  "JwtSettings": {
    "SecretKey": "DevelopmentKeyThatIsAtLeast32CharactersLong!",
    "Issuer": "{{serviceName}}-dev",
    "Audience": "{{serviceName}}-dev-users",
    "ExpiryHours": 24
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Information",
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
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

# Health check
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

    // README
    'README.md': `# {{serviceName}}

A high-performance .NET API built with ASP.NET Core and Dapper micro-ORM for optimal database performance.

## Features

- **ASP.NET Core 8.0**: Latest .NET framework with minimal APIs
- **Dapper**: High-performance micro-ORM for database operations
- **JWT Authentication**: Secure token-based authentication
- **AutoMapper**: Object-to-object mapping
- **Serilog**: Structured logging with multiple sinks
- **Swagger/OpenAPI**: Interactive API documentation
- **Health Checks**: Built-in health monitoring
- **Redis Caching**: Optional distributed caching
- **Polly**: Resilience and transient-fault handling
- **BCrypt**: Secure password hashing
- **FluentValidation**: Request validation
- **Docker Support**: Container-ready deployment

## Getting Started

### Prerequisites

- .NET 8.0 SDK
- SQL Server or SQL Server LocalDB
- Redis (optional, for caching)

### Installation

1. Clone the repository
2. Update the connection string in \`appsettings.json\`
3. Run the application:

\`\`\`bash
dotnet run
\`\`\`

The API will be available at \`https://localhost:5001\` and Swagger UI at the root path.

### Database Setup

The application will automatically create and seed the database on first run with:
- Sample users (admin@{{serviceName}}.com / Admin123!)
- Sample products across different categories
- Database tables with proper indexes

### Authentication

The API uses JWT Bearer tokens. To authenticate:

1. **Register a new user:**
   \`\`\`
   POST /api/auth/register
   {
     "firstName": "John",
     "lastName": "Doe", 
     "email": "john@example.com",
     "password": "Password123!"
   }
   \`\`\`

2. **Login:**
   \`\`\`
   POST /api/auth/login
   {
     "email": "john@example.com",
     "password": "Password123!"
   }
   \`\`\`

3. **Use the returned token in Authorization header:**
   \`\`\`
   Authorization: Bearer <your-jwt-token>
   \`\`\`

## API Endpoints

### Authentication
- \`POST /api/auth/login\` - Authenticate user
- \`POST /api/auth/register\` - Register new user

### Users
- \`GET /api/users\` - Get paginated users
- \`GET /api/users/{id}\` - Get user by ID
- \`POST /api/users\` - Create new user
- \`PUT /api/users/{id}\` - Update user
- \`DELETE /api/users/{id}\` - Delete user

### Products
- \`GET /api/products\` - Get paginated products with filtering
- \`GET /api/products/{id}\` - Get product by ID
- \`GET /api/products/category/{category}\` - Get products by category
- \`POST /api/products\` - Create new product
- \`PUT /api/products/{id}\` - Update product
- \`PATCH /api/products/{id}/stock\` - Update product stock
- \`DELETE /api/products/{id}\` - Delete product

### Orders
- \`GET /api/orders\` - Get paginated orders with filtering
- \`GET /api/orders/{id}\` - Get order by ID
- \`GET /api/orders/user/{userId}\` - Get orders by user
- \`POST /api/orders\` - Create new order
- \`PATCH /api/orders/{id}/status\` - Update order status
- \`DELETE /api/orders/{id}\` - Delete order

### Health
- \`GET /health\` - Health check endpoint

## Development

### Hot Reload

The application supports hot reload in development mode:

\`\`\`bash
dotnet watch run
\`\`\`

### Database Migrations

Since this project uses Dapper instead of Entity Framework, database schema changes are managed through:

1. Update the table creation scripts in \`DatabaseInitializer.cs\`
2. Add migration logic if needed
3. The application will automatically apply changes on startup

### Adding New Features

1. **Add Models**: Define your data models in \`Models/\`
2. **Add DTOs**: Create request/response DTOs in \`DTOs/\`
3. **Add Repository Interface**: Define data access interface in \`Repositories/\`
4. **Implement Repository**: Implement using Dapper in \`Repositories/\`
5. **Add Service Interface**: Define business logic interface in \`Services/\`
6. **Implement Service**: Implement business logic in \`Services/\`
7. **Add Controller**: Create API endpoints in \`Controllers/\`
8. **Update AutoMapper**: Add mapping profiles in \`Mappings/\`
9. **Register Services**: Add DI registration in \`Program.cs\`

## Configuration

### JWT Settings
Configure JWT authentication in \`appsettings.json\`:

\`\`\`json
{
  "JwtSettings": {
    "SecretKey": "YourSecretKeyHere",
    "Issuer": "{{serviceName}}",
    "Audience": "{{serviceName}}-users",
    "ExpiryHours": 24
  }
}
\`\`\`

### Database Connection
Update connection strings for your environment:

\`\`\`json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database={{serviceName}};Trusted_Connection=true;",
    "Redis": "localhost:6379"
  }
}
\`\`\`

## Performance Features

- **Dapper Micro-ORM**: Direct SQL execution with minimal overhead
- **Connection Pooling**: Efficient database connection management
- **Redis Caching**: Optional distributed caching for improved performance
- **Async/Await**: Non-blocking asynchronous operations throughout
- **Pagination**: Efficient data retrieval for large datasets
- **Indexing**: Optimized database indexes for common queries
- **HTTP Client Retry**: Resilient external service calls with Polly

## Security Features

- **JWT Bearer Authentication**: Stateless authentication
- **Password Hashing**: BCrypt with salt for secure password storage
- **Input Validation**: FluentValidation for request validation
- **SQL Injection Protection**: Parameterized queries with Dapper
- **CORS Configuration**: Configurable cross-origin requests
- **HTTPS Enforcement**: SSL/TLS encryption
- **Health Checks**: Monitor application and database health

## Docker Support

Build and run with Docker:

\`\`\`bash
# Build image
docker build -t {{serviceName}} .

# Run container
docker run -p {{port}}:8080 {{serviceName}}

# Run with environment variables
docker run -p {{port}}:8080 \\
  -e ConnectionStrings__DefaultConnection="Server=host.docker.internal;Database={{serviceName}};Trusted_Connection=true;" \\
  {{serviceName}}
\`\`\`

## Testing

The project includes comprehensive testing setup:

\`\`\`bash
# Run all tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
`
  }
};