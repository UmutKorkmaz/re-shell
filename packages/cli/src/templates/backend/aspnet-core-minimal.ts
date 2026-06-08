import { BackendTemplate } from '../types';

export const aspnetCoreMinimalTemplate: BackendTemplate = {
  id: 'aspnet-core-minimal',
  name: 'ASP.NET Core Minimal API',
  displayName: 'ASP.NET Core Minimal API',
  language: 'csharp' as const,
  framework: 'aspnet-core-minimal',
  description: 'Lightweight ASP.NET Core Minimal API with functional endpoints, Entity Framework, JWT authentication, and performance optimization',
  version: '1.0.0',
  tags: ['csharp', 'dotnet', 'aspnet-core', 'minimal-api', 'lightweight', 'performance', 'jwt', 'entity-framework'],
  port: 5000,
  
  files: {
    // Project file optimized for minimal API
    [`\${projectName}.csproj`]: `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <DocumentationFile>bin\\Debug\\net8.0\\\${projectName}.xml</DocumentationFile>
    <NoWarn>$(NoWarn);1591</NoWarn>
    <PublishAot>true</PublishAot>
    <InvariantGlobalization>true</InvariantGlobalization>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.1" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="FluentValidation" Version="11.8.0" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.3" />
    <PackageReference Include="StackExchange.Redis" Version="2.7.10" />
    <PackageReference Include="Microsoft.AspNetCore.RateLimiting" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.OutputCaching" Version="8.0.0" />
  </ItemGroup>

</Project>`,

    // Program.cs - Main entry point with minimal API endpoints
    'Program.cs': `using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using \${projectName}.Data;
using \${projectName}.Models;
using \${projectName}.Services;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Add Serilog
    builder.Host.UseSerilog();

    // Database context
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

    // JWT Authentication
    var jwtSettings = builder.Configuration.GetSection("JwtSettings");
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
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
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!)),
                ClockSkew = TimeSpan.Zero
            };
        });

    builder.Services.AddAuthorization();

    // Services
    builder.Services.AddScoped<IProductService, ProductService>();
    builder.Services.AddScoped<IAuthService, AuthService>();

    // Output caching
    builder.Services.AddOutputCache(options =>
    {
        options.AddBasePolicy(policy => policy.Expire(TimeSpan.FromMinutes(10)));
        options.AddPolicy("ProductsCache", policy => policy.Expire(TimeSpan.FromMinutes(5)));
    });

    // Rate limiting
    builder.Services.AddRateLimiter(options =>
    {
        options.AddFixedWindowLimiter("GlobalRateLimit", limiterOptions =>
        {
            limiterOptions.PermitLimit = 100;
            limiterOptions.Window = TimeSpan.FromMinutes(1);
            limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            limiterOptions.QueueLimit = 10;
        });

        options.AddFixedWindowLimiter("AuthRateLimit", limiterOptions =>
        {
            limiterOptions.PermitLimit = 10;
            limiterOptions.Window = TimeSpan.FromMinutes(1);
        });
    });

    // Redis cache
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = builder.Configuration.GetConnectionString("Redis");
    });

    // Swagger/OpenAPI
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo 
        { 
            Title = "\${projectName} Minimal API", 
            Version = "v1",
            Description = "High-performance ASP.NET Core Minimal API with functional endpoints"
        });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.ApiKey,
            Scheme = "Bearer"
        });

        c.AddSecurityRequirement(new OpenApiSecurityRequirement()
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                },
                Array.Empty<string>()
            }
        });
    });

    // CORS
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins("http://localhost:3000", "https://localhost:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    });

    var app = builder.Build();

    // Configure the HTTP request pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "\${projectName} Minimal API V1");
            c.RoutePrefix = string.Empty;
        });
    }

    app.UseHttpsRedirection();
    app.UseCors();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseRateLimiter();
    app.UseOutputCache();

    // Health check endpoint
    app.MapGet("/health", () => Results.Ok(new { 
        status = "healthy", 
        timestamp = DateTime.UtcNow,
        version = "1.0.0",
        environment = app.Environment.EnvironmentName
    }))
    .WithName("HealthCheck")
    .WithOpenApi();

    // Authentication endpoints
    app.MapPost("/auth/login", async (LoginRequest request, IAuthService authService) =>
    {
        var result = await authService.LoginAsync(request.Email, request.Password);
        
        if (!result.Success)
            return Results.Unauthorized();

        return Results.Ok(new { token = result.Token, user = result.User });
    })
    .WithName("Login")
    .WithOpenApi()
    .RequireRateLimiting("AuthRateLimit");

    app.MapPost("/auth/register", async (RegisterRequest request, IAuthService authService) =>
    {
        var result = await authService.RegisterAsync(request.Email, request.Password, request.FirstName, request.LastName);
        
        if (!result.Success)
            return Results.BadRequest(new { errors = result.Errors });

        return Results.Created($"/users/{result.User?.Id}", new { 
            message = "User created successfully", 
            user = result.User 
        });
    })
    .WithName("Register")
    .WithOpenApi()
    .RequireRateLimiting("AuthRateLimit");

    // Products endpoints
    app.MapGet("/products", async (IProductService productService) =>
    {
        var products = await productService.GetAllAsync();
        return Results.Ok(new { data = products, count = products.Count() });
    })
    .WithName("GetProducts")
    .WithOpenApi()
    .CacheOutput("ProductsCache");

    app.MapGet("/products/{id:int}", async (int id, IProductService productService) =>
    {
        var product = await productService.GetByIdAsync(id);
        return product != null ? Results.Ok(new { data = product }) : Results.NotFound();
    })
    .WithName("GetProduct")
    .WithOpenApi()
    .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(15)));

    app.MapGet("/products/category/{categoryId:int}", async (int categoryId, IProductService productService) =>
    {
        var products = await productService.GetByCategoryAsync(categoryId);
        return Results.Ok(new { data = products, count = products.Count() });
    })
    .WithName("GetProductsByCategory")
    .WithOpenApi()
    .CacheOutput("ProductsCache");

    app.MapPost("/products", [Authorize] async (CreateProductRequest request, IProductService productService) =>
    {
        var product = await productService.CreateAsync(request);
        return product != null 
            ? Results.Created($"/products/{product.Id}", new { data = product })
            : Results.BadRequest(new { message = "Failed to create product" });
    })
    .WithName("CreateProduct")
    .WithOpenApi()
    .RequireAuthorization();

    app.MapPut("/products/{id:int}", [Authorize] async (int id, UpdateProductRequest request, IProductService productService) =>
    {
        var product = await productService.UpdateAsync(id, request);
        return product != null 
            ? Results.Ok(new { data = product, message = "Product updated successfully" })
            : Results.NotFound();
    })
    .WithName("UpdateProduct")
    .WithOpenApi()
    .RequireAuthorization();

    app.MapDelete("/products/{id:int}", [Authorize] async (int id, IProductService productService) =>
    {
        var result = await productService.DeleteAsync(id);
        return result 
            ? Results.Ok(new { message = "Product deleted successfully" })
            : Results.NotFound();
    })
    .WithName("DeleteProduct")
    .WithOpenApi()
    .RequireAuthorization();

    // Categories endpoints
    app.MapGet("/categories", async (AppDbContext db) =>
    {
        var categories = await db.Categories
            .Where(c => c.IsActive)
            .Select(c => new { c.Id, c.Name, c.Description, c.CreatedAt })
            .ToListAsync();
        
        return Results.Ok(new { data = categories, count = categories.Count });
    })
    .WithName("GetCategories")
    .WithOpenApi()
    .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(30)));

    // Statistics endpoint
    app.MapGet("/stats", [Authorize] async (AppDbContext db) =>
    {
        var stats = new
        {
            TotalProducts = await db.Products.CountAsync(p => p.IsActive),
            TotalCategories = await db.Categories.CountAsync(c => c.IsActive),
            TotalUsers = await db.Users.CountAsync(u => u.IsActive),
            LowStockProducts = await db.Products.CountAsync(p => p.IsActive && p.Stock < 10),
            LastUpdated = DateTime.UtcNow
        };

        return Results.Ok(new { data = stats });
    })
    .WithName("GetStatistics")
    .WithOpenApi()
    .RequireAuthorization()
    .CacheOutput(policy => policy.Expire(TimeSpan.FromMinutes(5)));

    // Ensure database is created
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await context.Database.EnsureCreatedAsync();
    }

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// Request/Response DTOs
public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password
);

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password,
    [Required, MaxLength(50)] string FirstName,
    [Required, MaxLength(50)] string LastName
);

public record CreateProductRequest(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1000)] string? Description,
    [Required, Range(0.01, double.MaxValue)] decimal Price,
    [Range(0, int.MaxValue)] int Stock,
    [Required] int CategoryId
);

public record UpdateProductRequest(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1000)] string? Description,
    [Required, Range(0.01, double.MaxValue)] decimal Price,
    [Range(0, int.MaxValue)] int Stock,
    [Required] int CategoryId,
    bool IsActive = true
);`,

    // Database context - simplified for minimal API
    'Data/AppDbContext.cs': `using Microsoft.EntityFrameworkCore;
using \${projectName}.Models;

namespace \${projectName}.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Category> Categories { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User entity configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(100);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(50);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(50);
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Product entity configuration
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            entity.HasOne(p => p.Category)
                  .WithMany(c => c.Products)
                  .HasForeignKey(p => p.CategoryId);
        });

        // Category entity configuration
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });

        // Seed data
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Electronics", Description = "Electronic devices and accessories", CreatedAt = DateTime.UtcNow },
            new Category { Id = 2, Name = "Clothing", Description = "Apparel and fashion items", CreatedAt = DateTime.UtcNow },
            new Category { Id = 3, Name = "Books", Description = "Books and educational materials", CreatedAt = DateTime.UtcNow }
        );

        modelBuilder.Entity<Product>().HasData(
            new Product 
            { 
                Id = 1, 
                Name = "Laptop", 
                Description = "High-performance laptop for development", 
                Price = 1299.99m, 
                CategoryId = 1,
                Stock = 50,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Product 
            { 
                Id = 2, 
                Name = "T-Shirt", 
                Description = "Comfortable cotton t-shirt", 
                Price = 29.99m, 
                CategoryId = 2,
                Stock = 100,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}`,

    // Models - simplified for minimal API
    'Models/User.cs': `namespace \${projectName}.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
}`,

    'Models/Product.cs': `namespace \${projectName}.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}`,

    'Models/Category.cs': `namespace \${projectName}.Models;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}`,

    // Services for business logic
    'Services/IAuthService.cs': `using \${projectName}.Models;

namespace \${projectName}.Services;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(string email, string password);
    Task<AuthResult> RegisterAsync(string email, string password, string firstName, string lastName);
    string GenerateJwtToken(User user);
}

public class AuthResult
{
    public bool Success { get; set; }
    public string? Token { get; set; }
    public User? User { get; set; }
    public List<string> Errors { get; set; } = new();
}`,

    'Services/AuthService.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using \${projectName}.Data;
using \${projectName}.Models;

namespace \${projectName}.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(AppDbContext context, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        try
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive);
            
            if (user == null || !VerifyPassword(password, user.PasswordHash))
            {
                return new AuthResult { Success = false, Errors = ["Invalid credentials"] };
            }

            // Update last login
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);
            
            _logger.LogInformation("User {Email} logged in successfully", email);
            
            return new AuthResult 
            { 
                Success = true, 
                Token = token, 
                User = user 
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for {Email}", email);
            return new AuthResult { Success = false, Errors = ["Login failed"] };
        }
    }

    public async Task<AuthResult> RegisterAsync(string email, string password, string firstName, string lastName)
    {
        try
        {
            // Check if user exists
            if (await _context.Users.AnyAsync(u => u.Email == email))
            {
                return new AuthResult { Success = false, Errors = ["Email already exists"] };
            }

            var user = new User
            {
                Email = email,
                FirstName = firstName,
                LastName = lastName,
                PasswordHash = HashPassword(password),
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User {Email} registered successfully", email);
            
            return new AuthResult 
            { 
                Success = true, 
                User = user 
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration for {Email}", email);
            return new AuthResult { Success = false, Errors = ["Registration failed"] };
        }
    }

    public string GenerateJwtToken(User user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.GivenName, user.FirstName),
            new Claim(ClaimTypes.Surname, user.LastName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(Convert.ToDouble(jwtSettings["ExpirationInMinutes"])),
            Issuer = jwtSettings["Issuer"],
            Audience = jwtSettings["Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(secretKey), SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);

        return tokenHandler.WriteToken(token);
    }

    private static string HashPassword(string password)
    {
        using var hmac = new HMACSHA512();
        var salt = hmac.Key;
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
        
        return Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(hash);
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split(':');
        if (parts.Length != 2) return false;

        var salt = Convert.FromBase64String(parts[0]);
        var hash = Convert.FromBase64String(parts[1]);

        using var hmac = new HMACSHA512(salt);
        var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));

        return computedHash.SequenceEqual(hash);
    }
}`,

    'Services/IProductService.cs': `using \${projectName}.Models;

namespace \${projectName}.Services;

public interface IProductService
{
    Task<Product?> CreateAsync(CreateProductRequest request);
    Task<Product?> GetByIdAsync(int id);
    Task<IEnumerable<Product>> GetAllAsync();
    Task<IEnumerable<Product>> GetByCategoryAsync(int categoryId);
    Task<Product?> UpdateAsync(int id, UpdateProductRequest request);
    Task<bool> DeleteAsync(int id);
}`,

    'Services/ProductService.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Newtonsoft.Json;
using \${projectName}.Data;
using \${projectName}.Models;

namespace \${projectName}.Services;

public class ProductService : IProductService
{
    private readonly AppDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ProductService> _logger;
    private const int CacheExpirationMinutes = 15;

    public ProductService(AppDbContext context, IDistributedCache cache, ILogger<ProductService> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Product?> CreateAsync(CreateProductRequest request)
    {
        try
        {
            var product = new Product
            {
                Name = request.Name,
                Description = request.Description,
                Price = request.Price,
                Stock = request.Stock,
                CategoryId = request.CategoryId,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            // Clear cache
            await _cache.RemoveAsync("products_all");

            _logger.LogInformation("Product {ProductName} created with ID {ProductId}", product.Name, product.Id);
            
            return await GetByIdAsync(product.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating product");
            return null;
        }
    }

    public async Task<Product?> GetByIdAsync(int id)
    {
        try
        {
            var cacheKey = $"product_{id}";
            var cachedProduct = await _cache.GetStringAsync(cacheKey);
            
            if (!string.IsNullOrEmpty(cachedProduct))
            {
                return JsonConvert.DeserializeObject<Product>(cachedProduct);
            }

            var product = await _context.Products
                .Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == id && p.IsActive);

            if (product != null)
            {
                // Cache the result
                var cacheOptions = new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheExpirationMinutes)
                };
                await _cache.SetStringAsync(cacheKey, JsonConvert.SerializeObject(product), cacheOptions);
            }

            return product;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product {ProductId}", id);
            return null;
        }
    }

    public async Task<IEnumerable<Product>> GetAllAsync()
    {
        try
        {
            const string cacheKey = "products_all";
            var cachedProducts = await _cache.GetStringAsync(cacheKey);
            
            if (!string.IsNullOrEmpty(cachedProducts))
            {
                return JsonConvert.DeserializeObject<IEnumerable<Product>>(cachedProducts) ?? new List<Product>();
            }

            var products = await _context.Products
                .Include(p => p.Category)
                .Where(p => p.IsActive)
                .OrderBy(p => p.Name)
                .ToListAsync();

            // Cache the result
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheExpirationMinutes)
            };
            await _cache.SetStringAsync(cacheKey, JsonConvert.SerializeObject(products), cacheOptions);

            return products;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all products");
            return new List<Product>();
        }
    }

    public async Task<IEnumerable<Product>> GetByCategoryAsync(int categoryId)
    {
        try
        {
            var products = await _context.Products
                .Include(p => p.Category)
                .Where(p => p.CategoryId == categoryId && p.IsActive)
                .OrderBy(p => p.Name)
                .ToListAsync();

            return products;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products for category {CategoryId}", categoryId);
            return new List<Product>();
        }
    }

    public async Task<Product?> UpdateAsync(int id, UpdateProductRequest request)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null || !product.IsActive)
            {
                return null;
            }

            product.Name = request.Name;
            product.Description = request.Description;
            product.Price = request.Price;
            product.Stock = request.Stock;
            product.CategoryId = request.CategoryId;
            product.IsActive = request.IsActive;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Clear cache
            await _cache.RemoveAsync($"product_{id}");
            await _cache.RemoveAsync("products_all");

            _logger.LogInformation("Product {ProductId} updated", id);
            
            return product;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating product {ProductId}", id);
            return null;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return false;
            }

            product.IsActive = false;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Clear cache
            await _cache.RemoveAsync($"product_{id}");
            await _cache.RemoveAsync("products_all");

            _logger.LogInformation("Product {ProductId} deleted", id);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting product {ProductId}", id);
            return false;
        }
    }
}`,

    // Configuration files
    'appsettings.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Information"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database=\${projectName}MinimalDb;Trusted_Connection=true;MultipleActiveResultSets=true",
    "Redis": "localhost:6379"
  },
  "JwtSettings": {
    "SecretKey": "YourSuperSecretKeyThatIsAtLeast32CharactersLong!",
    "Issuer": "\${projectName}-minimal-api",
    "Audience": "\${projectName}-client",
    "ExpirationInMinutes": 60
  }
}`,

    'appsettings.Development.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore": "Information"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database=\${projectName}MinimalDevDb;Trusted_Connection=true;MultipleActiveResultSets=true",
    "Redis": "localhost:6379"
  }
}`,

    // Docker support
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Base runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

# Stage 2: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["\${projectName}.csproj", "."]
RUN dotnet restore "./\${projectName}.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "./\${projectName}.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Stage 3: Publish
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./\${projectName}.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false /p:PublishAot=true

# =============================================================================
# Stage 4: Final runtime image
# =============================================================================
FROM base AS final
WORKDIR /app

# Install curl for health checks and create non-root user
RUN apt-get update && apt-get install -y --no-install-recommends curl \\
    && useradd -m -u 1000 appuser \\
    && apt-get clean \\
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .
RUN chown -R appuser:appuser /app

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "\${projectName}.dll"]`,

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

    // Development setup
    'launchSettings.json': `{
  "$schema": "http://json.schemastore.org/launchsettings.json",
  "profiles": {
    "http": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "http://localhost:\${port || 5000}",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    "https": {
      "commandName": "Project",
      "dotnetRunMessages": true,
      "launchBrowser": true,
      "applicationUrl": "https://localhost:\${(port ? parseInt(port) + 1 : 5001)};http://localhost:\${port || 5000}",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}`,

    // README
    'README.md': `# \${projectName} - ASP.NET Core Minimal API

High-performance ASP.NET Core Minimal API with functional endpoints, JWT authentication, output caching, rate limiting, and comprehensive features.

## Features

- **Minimal API**: Functional endpoint definitions with high performance
- **Authentication**: JWT-based authentication with custom auth service
- **Output Caching**: Response caching with configurable policies
- **Rate Limiting**: Global and endpoint-specific rate limiting
- **Database**: Entity Framework Core with SQL Server
- **Caching**: Redis distributed caching
- **Logging**: Serilog with file and console outputs
- **API Documentation**: Swagger/OpenAPI integration
- **Performance**: AOT compilation support for optimal performance
- **Docker**: Containerization with AOT-optimized image
- **CORS**: Cross-origin resource sharing support

## Getting Started

### Prerequisites

- .NET 8.0 SDK
- SQL Server (LocalDB for development)
- Redis (optional, for caching)

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Restore dependencies:
   \`\`\`bash
   dotnet restore
   \`\`\`

4. Update the database:
   \`\`\`bash
   dotnet ef database update
   \`\`\`

5. Run the application:
   \`\`\`bash
   dotnet run
   \`\`\`

### Development

For hot reload during development:
\`\`\`bash
dotnet watch run
\`\`\`

### Docker

Build and run with Docker (AOT optimized):
\`\`\`bash
docker build -t \${projectName.toLowerCase()}-minimal-api .
docker run -p 8080:8080 \${projectName.toLowerCase()}-minimal-api
\`\`\`

## API Endpoints

### Health & Information
- \`GET /health\` - Health check endpoint

### Authentication
- \`POST /auth/login\` - Login user
- \`POST /auth/register\` - Register new user

### Products
- \`GET /products\` - Get all products (cached)
- \`GET /products/{id}\` - Get product by ID (cached)
- \`GET /products/category/{categoryId}\` - Get products by category
- \`POST /products\` - Create new product (requires authentication)
- \`PUT /products/{id}\` - Update product (requires authentication)
- \`DELETE /products/{id}\` - Delete product (requires authentication)

### Categories
- \`GET /categories\` - Get all categories (cached)

### Statistics
- \`GET /stats\` - Get system statistics (requires authentication, cached)

## Performance Features

### Output Caching
- Global cache policy: 10 minutes
- Products cache: 5 minutes
- Categories cache: 30 minutes
- Statistics cache: 5 minutes

### Rate Limiting
- Global rate limit: 100 requests per minute
- Auth endpoints: 10 requests per minute
- Configurable queue with FIFO processing

### AOT Compilation
The project supports Ahead-of-Time (AOT) compilation for optimal performance:
\`\`\`bash
dotnet publish -c Release
\`\`\`

## Configuration

### Database Connection
Update the connection string in \`appsettings.json\`:
\`\`\`json
{
  "ConnectionStrings": {
    "DefaultConnection": "Your SQL Server connection string"
  }
}
\`\`\`

### JWT Settings
Configure JWT settings in \`appsettings.json\`:
\`\`\`json
{
  "JwtSettings": {
    "SecretKey": "Your secret key (min 32 characters)",
    "Issuer": "your-issuer",
    "Audience": "your-audience",
    "ExpirationInMinutes": 60
  }
}
\`\`\`

### Redis Cache
Configure Redis connection:
\`\`\`json
{
  "ConnectionStrings": {
    "Redis": "localhost:6379"
  }
}
\`\`\`

## Project Structure

\`\`\`
\${projectName}/
├── Data/                # Database context
├── Models/              # Domain models
├── Services/            # Business logic services
├── Program.cs           # Minimal API endpoints and configuration
├── appsettings.json     # Configuration
└── README.md
\`\`\`

## Technologies Used

- **ASP.NET Core 8.0** - Minimal API framework
- **Entity Framework Core** - ORM
- **JWT Bearer** - Token-based authentication
- **Serilog** - Structured logging
- **Output Caching** - Response caching
- **Rate Limiting** - Request throttling
- **Swagger/OpenAPI** - API documentation
- **Redis** - Distributed caching
- **AOT Compilation** - Performance optimization
- **Docker** - Containerization

## Performance Characteristics

- **Fast Startup**: Minimal overhead with functional endpoints
- **Low Memory**: Optimized for cloud deployments
- **High Throughput**: Async endpoints with caching
- **AOT Ready**: Native compilation support for maximum performance

## License

This project is licensed under the MIT License.`
  },

  dependencies: {
    'Microsoft.AspNetCore.OpenApi': '^8.0.0',
    'Microsoft.EntityFrameworkCore': '^8.0.0',
    'Microsoft.EntityFrameworkCore.SqlServer': '^8.0.0',
    'Microsoft.EntityFrameworkCore.Tools': '^8.0.0',
    'Microsoft.EntityFrameworkCore.Design': '^8.0.0',
    'Microsoft.AspNetCore.Authentication.JwtBearer': '^8.0.0',
    'Swashbuckle.AspNetCore': '^6.5.0',
    'Serilog.AspNetCore': '^8.0.0',
    'FluentValidation': '^11.8.0',
    'StackExchange.Redis': '^2.7.10',
    'Microsoft.AspNetCore.RateLimiting': '^8.0.0',
    'Microsoft.AspNetCore.OutputCaching': '^8.0.0'
  },

  devDependencies: {
    'Microsoft.EntityFrameworkCore.InMemory': '^8.0.0'
  },

  features: [
    'authentication',
    'database',
    'caching',
    'logging',
    'documentation',
    'security',
    'validation',
    'rate-limiting',
    'cors',
    'rest-api',
    'docker'
  ]
};