import { BackendTemplate } from '../types';

export const aspnetCoreWebApiTemplate: BackendTemplate = {
  id: 'aspnet-core-webapi',
  name: 'ASP.NET Core Web API',
  displayName: 'ASP.NET Core Web API',
  language: 'csharp' as const,
  framework: 'aspnet-core-webapi',
  description: 'Enterprise-grade ASP.NET Core Web API with controllers, dependency injection, Entity Framework, JWT authentication, and comprehensive testing',
  version: '1.0.0',
  tags: ['csharp', 'dotnet', 'aspnet-core', 'web-api', 'enterprise', 'rest-api', 'jwt', 'entity-framework', 'swagger'],
  port: 5000,
  
  files: {
    // Project file with all required packages
    [`\${projectName}.csproj`]: `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <DocumentationFile>bin\\Debug\\net8.0\\\${projectName}.xml</DocumentationFile>
    <NoWarn>$(NoWarn);1591</NoWarn>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.1" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.3" />
    <PackageReference Include="StackExchange.Redis" Version="2.7.10" />
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Versioning" Version="5.1.0" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Versioning.ApiExplorer" Version="5.1.0" />
  </ItemGroup>

</Project>`,

    // Program.cs - Main entry point with comprehensive configuration
    'Program.cs': `using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Reflection;
using System.Text;
using \${projectName}.Data;
using \${projectName}.Models;
using \${projectName}.Services;
using \${projectName}.Middleware;
using \${projectName}.Extensions;

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

    // Add services to the container
    builder.Services.AddControllers();

    // Database context
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

    // Identity
    builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
        .AddEntityFrameworkStores<ApplicationDbContext>()
        .AddDefaultTokenProviders();

    // JWT Authentication
    var jwtSettings = builder.Configuration.GetSection("JwtSettings");
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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!))
        };
    });

    // AutoMapper
    builder.Services.AddAutoMapper(Assembly.GetExecutingAssembly());

    // Business services
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IProductService, ProductService>();
    builder.Services.AddScoped<ITokenService, TokenService>();

    // Redis cache
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = builder.Configuration.GetConnectionString("Redis");
    });

    // API versioning
    builder.Services.AddApiVersioning(opt =>
    {
        opt.DefaultApiVersion = new Microsoft.AspNetCore.Mvc.ApiVersion(1, 0);
        opt.AssumeDefaultVersionWhenUnspecified = true;
        opt.ApiVersionReader = Microsoft.AspNetCore.Mvc.ApiVersionReader.Combine(
            new Microsoft.AspNetCore.Mvc.QueryStringApiVersionReader("apiVersion"),
            new Microsoft.AspNetCore.Mvc.HeaderApiVersionReader("X-Version"),
            new Microsoft.AspNetCore.Mvc.UrlSegmentApiVersionReader()
        );
    });

    builder.Services.AddVersionedApiExplorer(setup =>
    {
        setup.GroupNameFormat = "'v'VVV";
        setup.SubstituteApiVersionInUrl = true;
    });

    // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo 
        { 
            Title = "\${projectName} API", 
            Version = "v1",
            Description = "A comprehensive ASP.NET Core Web API with authentication and CRUD operations",
            Contact = new OpenApiContact
            {
                Name = "API Support",
                Email = "support@\${projectName.toLowerCase()}.com"
            }
        });

        // Set the comments path for the Swagger JSON and UI
        var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        c.IncludeXmlComments(xmlPath);

        // Add JWT authentication
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme. Example: \\"Authorization: Bearer {token}\\"",
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
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    },
                    Scheme = "authorization",
                    Name = "Bearer",
                    In = ParameterLocation.Header},
                new List<string>()
            }
        });
    });

    // CORS
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowSpecificOrigin",
            policy =>
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
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "\${projectName} API V1");
            c.RoutePrefix = string.Empty; // Set Swagger UI at app's root
        });
    }

    // Custom middleware
    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseMiddleware<RequestLoggingMiddleware>();

    app.UseHttpsRedirection();
    app.UseCors("AllowSpecificOrigin");
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();

    // Ensure database is created
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        context.Database.EnsureCreated();
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
}`,

    // Database context
    'Data/ApplicationDbContext.cs': `using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using \${projectName}.Models;

namespace \${projectName}.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

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

        // Order entity configuration
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            entity.HasOne(o => o.User)
                  .WithMany()
                  .HasForeignKey(o => o.UserId);
        });

        // OrderItem entity configuration
        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalPrice).HasColumnType("decimal(18,2)");
            
            entity.HasOne(oi => oi.Order)
                  .WithMany(o => o.OrderItems)
                  .HasForeignKey(oi => oi.OrderId);
                  
            entity.HasOne(oi => oi.Product)
                  .WithMany()
                  .HasForeignKey(oi => oi.ProductId);
        });

        // Seed data
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Electronics", Description = "Electronic devices and accessories" },
            new Category { Id = 2, Name = "Clothing", Description = "Apparel and fashion items" },
            new Category { Id = 3, Name = "Books", Description = "Books and educational materials" }
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

    // Models
    'Models/ApplicationUser.cs': `using Microsoft.AspNetCore.Identity;

namespace \${projectName}.Models;

public class ApplicationUser : IdentityUser
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
}`,

    'Models/Product.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.Models;

public class Product
{
    public int Id { get; set; }
    
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0")]
    public decimal Price { get; set; }
    
    [Range(0, int.MaxValue)]
    public int Stock { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    [Required]
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}`,

    'Models/Category.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.Models;

public class Category
{
    public int Id { get; set; }
    
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(500)]
    public string? Description { get; set; }
    
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}`,

    'Models/Order.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.Models;

public class Order
{
    public int Id { get; set; }
    
    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }
    
    [Required]
    public decimal TotalAmount { get; set; }
    
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}

public enum OrderStatus
{
    Pending = 0,
    Processing = 1,
    Shipped = 2,
    Delivered = 3,
    Cancelled = 4
}`,

    'Models/OrderItem.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.Models;

public class OrderItem
{
    public int Id { get; set; }
    
    [Required]
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    
    [Required]
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    
    [Required]
    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }
    
    [Required]
    public decimal UnitPrice { get; set; }
    
    [Required]
    public decimal TotalPrice { get; set; }
}`,

    // DTOs
    'DTOs/UserRegisterDto.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.DTOs;

public class UserRegisterDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;
    
    [Required]
    [Compare("Password")]
    public string ConfirmPassword { get; set; } = string.Empty;
    
    [Required]
    [StringLength(50)]
    public string FirstName { get; set; } = string.Empty;
    
    [Required]
    [StringLength(50)]
    public string LastName { get; set; } = string.Empty;
}`,

    'DTOs/UserLoginDto.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.DTOs;

public class UserLoginDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    public string Password { get; set; } = string.Empty;
}`,

    'DTOs/ProductDto.cs': `using System.ComponentModel.DataAnnotations;

namespace \${projectName}.DTOs;

public class ProductCreateDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal Price { get; set; }
    
    [Range(0, int.MaxValue)]
    public int Stock { get; set; }
    
    [Required]
    public int CategoryId { get; set; }
}

public class ProductUpdateDto : ProductCreateDto
{
    public bool IsActive { get; set; } = true;
}

public class ProductResponseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; }
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}`,

    // Services
    'Services/IUserService.cs': `using \${projectName}.DTOs;
using \${projectName}.Models;

namespace \${projectName}.Services;

public interface IUserService
{
    Task<ApplicationUser?> RegisterAsync(UserRegisterDto dto);
    Task<ApplicationUser?> LoginAsync(UserLoginDto dto);
    Task<ApplicationUser?> GetByIdAsync(string id);
    Task<ApplicationUser?> GetByEmailAsync(string email);
    Task<bool> UpdateAsync(string id, ApplicationUser user);
    Task<bool> DeleteAsync(string id);
    Task<IEnumerable<ApplicationUser>> GetAllAsync();
}`,

    'Services/UserService.cs': `using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using \${projectName}.DTOs;
using \${projectName}.Models;

namespace \${projectName}.Services;

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ILogger<UserService> _logger;

    public UserService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ILogger<UserService> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
    }

    public async Task<ApplicationUser?> RegisterAsync(UserRegisterDto dto)
    {
        try
        {
            var user = new ApplicationUser
            {
                UserName = dto.Email,
                Email = dto.Email,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, dto.Password);
            
            if (result.Succeeded)
            {
                _logger.LogInformation("User {Email} registered successfully", dto.Email);
                return user;
            }

            foreach (var error in result.Errors)
            {
                _logger.LogWarning("Registration error for {Email}: {Error}", dto.Email, error.Description);
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering user {Email}", dto.Email);
            return null;
        }
    }

    public async Task<ApplicationUser?> LoginAsync(UserLoginDto dto)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(dto.Email);
            if (user == null || !user.IsActive)
            {
                return null;
            }

            var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, false);
            
            if (result.Succeeded)
            {
                user.LastLoginAt = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);
                _logger.LogInformation("User {Email} logged in successfully", dto.Email);
                return user;
            }

            _logger.LogWarning("Failed login attempt for {Email}", dto.Email);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for {Email}", dto.Email);
            return null;
        }
    }

    public async Task<ApplicationUser?> GetByIdAsync(string id)
    {
        return await _userManager.FindByIdAsync(id);
    }

    public async Task<ApplicationUser?> GetByEmailAsync(string email)
    {
        return await _userManager.FindByEmailAsync(email);
    }

    public async Task<bool> UpdateAsync(string id, ApplicationUser user)
    {
        try
        {
            var existingUser = await _userManager.FindByIdAsync(id);
            if (existingUser == null)
            {
                return false;
            }

            existingUser.FirstName = user.FirstName;
            existingUser.LastName = user.LastName;
            existingUser.PhoneNumber = user.PhoneNumber;

            var result = await _userManager.UpdateAsync(existingUser);
            return result.Succeeded;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user {Id}", id);
            return false;
        }
    }

    public async Task<bool> DeleteAsync(string id)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return false;
            }

            user.IsActive = false;
            var result = await _userManager.UpdateAsync(user);
            return result.Succeeded;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user {Id}", id);
            return false;
        }
    }

    public async Task<IEnumerable<ApplicationUser>> GetAllAsync()
    {
        return await _userManager.Users.Where(u => u.IsActive).ToListAsync();
    }
}`,

    'Services/IProductService.cs': `using \${projectName}.DTOs;
using \${projectName}.Models;

namespace \${projectName}.Services;

public interface IProductService
{
    Task<ProductResponseDto?> CreateAsync(ProductCreateDto dto);
    Task<ProductResponseDto?> GetByIdAsync(int id);
    Task<IEnumerable<ProductResponseDto>> GetAllAsync();
    Task<IEnumerable<ProductResponseDto>> GetByCategoryAsync(int categoryId);
    Task<ProductResponseDto?> UpdateAsync(int id, ProductUpdateDto dto);
    Task<bool> DeleteAsync(int id);
    Task<bool> UpdateStockAsync(int id, int quantity);
}`,

    'Services/ProductService.cs': `using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Newtonsoft.Json;
using \${projectName}.Data;
using \${projectName}.DTOs;
using \${projectName}.Models;

namespace \${projectName}.Services;

public class ProductService : IProductService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IDistributedCache _cache;
    private readonly ILogger<ProductService> _logger;
    private const int CacheExpirationMinutes = 30;

    public ProductService(
        ApplicationDbContext context,
        IMapper mapper,
        IDistributedCache cache,
        ILogger<ProductService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ProductResponseDto?> CreateAsync(ProductCreateDto dto)
    {
        try
        {
            var product = _mapper.Map<Product>(dto);
            product.CreatedAt = DateTime.UtcNow;

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

    public async Task<ProductResponseDto?> GetByIdAsync(int id)
    {
        try
        {
            var cacheKey = $"product_{id}";
            var cachedProduct = await _cache.GetStringAsync(cacheKey);
            
            if (!string.IsNullOrEmpty(cachedProduct))
            {
                return JsonConvert.DeserializeObject<ProductResponseDto>(cachedProduct);
            }

            var product = await _context.Products
                .Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == id && p.IsActive);

            if (product == null)
            {
                return null;
            }

            var productDto = _mapper.Map<ProductResponseDto>(product);
            productDto.CategoryName = product.Category?.Name;

            // Cache the result
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheExpirationMinutes)
            };
            await _cache.SetStringAsync(cacheKey, JsonConvert.SerializeObject(productDto), cacheOptions);

            return productDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting product {ProductId}", id);
            return null;
        }
    }

    public async Task<IEnumerable<ProductResponseDto>> GetAllAsync()
    {
        try
        {
            const string cacheKey = "products_all";
            var cachedProducts = await _cache.GetStringAsync(cacheKey);
            
            if (!string.IsNullOrEmpty(cachedProducts))
            {
                return JsonConvert.DeserializeObject<IEnumerable<ProductResponseDto>>(cachedProducts) ?? 
                       new List<ProductResponseDto>();
            }

            var products = await _context.Products
                .Include(p => p.Category)
                .Where(p => p.IsActive)
                .OrderBy(p => p.Name)
                .ToListAsync();

            var productDtos = products.Select(p =>
            {
                var dto = _mapper.Map<ProductResponseDto>(p);
                dto.CategoryName = p.Category?.Name;
                return dto;
            }).ToList();

            // Cache the result
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(CacheExpirationMinutes)
            };
            await _cache.SetStringAsync(cacheKey, JsonConvert.SerializeObject(productDtos), cacheOptions);

            return productDtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all products");
            return new List<ProductResponseDto>();
        }
    }

    public async Task<IEnumerable<ProductResponseDto>> GetByCategoryAsync(int categoryId)
    {
        try
        {
            var products = await _context.Products
                .Include(p => p.Category)
                .Where(p => p.CategoryId == categoryId && p.IsActive)
                .OrderBy(p => p.Name)
                .ToListAsync();

            return products.Select(p =>
            {
                var dto = _mapper.Map<ProductResponseDto>(p);
                dto.CategoryName = p.Category?.Name;
                return dto;
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting products for category {CategoryId}", categoryId);
            return new List<ProductResponseDto>();
        }
    }

    public async Task<ProductResponseDto?> UpdateAsync(int id, ProductUpdateDto dto)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null || !product.IsActive)
            {
                return null;
            }

            _mapper.Map(dto, product);
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Clear cache
            await _cache.RemoveAsync($"product_{id}");
            await _cache.RemoveAsync("products_all");

            _logger.LogInformation("Product {ProductId} updated", id);
            
            return await GetByIdAsync(id);
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

    public async Task<bool> UpdateStockAsync(int id, int quantity)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null || !product.IsActive)
            {
                return false;
            }

            product.Stock = quantity;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Clear cache
            await _cache.RemoveAsync($"product_{id}");
            await _cache.RemoveAsync("products_all");

            _logger.LogInformation("Product {ProductId} stock updated to {Quantity}", id, quantity);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating stock for product {ProductId}", id);
            return false;
        }
    }
}`,

    'Services/ITokenService.cs': `using \${projectName}.Models;

namespace \${projectName}.Services;

public interface ITokenService
{
    string GenerateJwtToken(ApplicationUser user);
    string GenerateRefreshToken();
    bool ValidateJwtToken(string token);
}`,

    'Services/TokenService.cs': `using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using \${projectName}.Models;

namespace \${projectName}.Services;

public class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<TokenService> _logger;

    public TokenService(IConfiguration configuration, ILogger<TokenService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public string GenerateJwtToken(ApplicationUser user)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.UserName!),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim("firstName", user.FirstName ?? ""),
            new Claim("lastName", user.LastName ?? ""),
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

        _logger.LogInformation("JWT token generated for user {UserId}", user.Id);
        
        return tokenHandler.WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public bool ValidateJwtToken(string token)
    {
        try
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var secretKey = Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!);

            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings["Issuer"],
                ValidAudience = jwtSettings["Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(secretKey),
                ClockSkew = TimeSpan.Zero
            };

            tokenHandler.ValidateToken(token, validationParameters, out SecurityToken validatedToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "JWT token validation failed");
            return false;
        }
    }
}`,

    // Controllers
    'Controllers/AuthController.cs': `using Microsoft.AspNetCore.Mvc;
using \${projectName}.DTOs;
using \${projectName}.Services;

namespace \${projectName}.Controllers;

/// <summary>
/// Authentication controller for user registration and login
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IUserService userService,
        ITokenService tokenService,
        ILogger<AuthController> logger)
    {
        _userService = userService;
        _tokenService = tokenService;
        _logger = logger;
    }

    /// <summary>
    /// Register a new user
    /// </summary>
    /// <param name="dto">User registration data</param>
    /// <returns>User registration result</returns>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] UserRegisterDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var user = await _userService.RegisterAsync(dto);
        if (user == null)
        {
            return BadRequest(new { message = "User registration failed" });
        }

        var token = _tokenService.GenerateJwtToken(user);

        return Ok(new
        {
            message = "User registered successfully",
            user = new
            {
                id = user.Id,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName
            },
            token
        });
    }

    /// <summary>
    /// Authenticate user and return JWT token
    /// </summary>
    /// <param name="dto">User login credentials</param>
    /// <returns>Authentication result with JWT token</returns>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] UserLoginDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var user = await _userService.LoginAsync(dto);
        if (user == null)
        {
            return Unauthorized(new { message = "Invalid credentials" });
        }

        var token = _tokenService.GenerateJwtToken(user);

        return Ok(new
        {
            message = "Login successful",
            user = new
            {
                id = user.Id,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName,
                lastLoginAt = user.LastLoginAt
            },
            token
        });
    }

    /// <summary>
    /// Validate JWT token
    /// </summary>
    /// <param name="token">JWT token to validate</param>
    /// <returns>Token validation result</returns>
    [HttpPost("validate")]
    public IActionResult ValidateToken([FromBody] string token)
    {
        var isValid = _tokenService.ValidateJwtToken(token);
        
        return Ok(new { isValid });
    }
}`,

    'Controllers/ProductsController.cs': `using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using \${projectName}.DTOs;
using \${projectName}.Services;

namespace \${projectName}.Controllers;

/// <summary>
/// Products management controller
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(
        IProductService productService,
        ILogger<ProductsController> logger)
    {
        _productService = productService;
        _logger = logger;
    }

    /// <summary>
    /// Get all products
    /// </summary>
    /// <returns>List of products</returns>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var products = await _productService.GetAllAsync();
        return Ok(new { data = products, count = products.Count() });
    }

    /// <summary>
    /// Get product by ID
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <returns>Product details</returns>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _productService.GetByIdAsync(id);
        if (product == null)
        {
            return NotFound(new { message = "Product not found" });
        }

        return Ok(new { data = product });
    }

    /// <summary>
    /// Get products by category
    /// </summary>
    /// <param name="categoryId">Category ID</param>
    /// <returns>List of products in the category</returns>
    [HttpGet("category/{categoryId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByCategory(int categoryId)
    {
        var products = await _productService.GetByCategoryAsync(categoryId);
        return Ok(new { data = products, count = products.Count() });
    }

    /// <summary>
    /// Create a new product
    /// </summary>
    /// <param name="dto">Product creation data</param>
    /// <returns>Created product</returns>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductCreateDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var product = await _productService.CreateAsync(dto);
        if (product == null)
        {
            return BadRequest(new { message = "Product creation failed" });
        }

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, new { data = product });
    }

    /// <summary>
    /// Update an existing product
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <param name="dto">Product update data</param>
    /// <returns>Updated product</returns>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] ProductUpdateDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var product = await _productService.UpdateAsync(id, dto);
        if (product == null)
        {
            return NotFound(new { message = "Product not found" });
        }

        return Ok(new { data = product, message = "Product updated successfully" });
    }

    /// <summary>
    /// Delete a product
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <returns>Deletion result</returns>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _productService.DeleteAsync(id);
        if (!result)
        {
            return NotFound(new { message = "Product not found" });
        }

        return Ok(new { message = "Product deleted successfully" });
    }

    /// <summary>
    /// Update product stock
    /// </summary>
    /// <param name="id">Product ID</param>
    /// <param name="quantity">New stock quantity</param>
    /// <returns>Stock update result</returns>
    [HttpPatch("{id}/stock")]
    public async Task<IActionResult> UpdateStock(int id, [FromBody] int quantity)
    {
        if (quantity < 0)
        {
            return BadRequest(new { message = "Stock quantity cannot be negative" });
        }

        var result = await _productService.UpdateStockAsync(id, quantity);
        if (!result)
        {
            return NotFound(new { message = "Product not found" });
        }

        return Ok(new { message = "Stock updated successfully" });
    }
}`,

    // Middleware
    'Middleware/ExceptionHandlingMiddleware.cs': `using System.Net;
using System.Text.Json;

namespace \${projectName}.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        
        var response = new
        {
            error = new
            {
                message = "An error occurred while processing your request",
                details = exception.Message,
                timestamp = DateTime.UtcNow
            }
        };

        switch (exception)
        {
            case ArgumentException:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                break;
            case UnauthorizedAccessException:
                context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                break;
            case KeyNotFoundException:
                context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                break;
            default:
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                break;
        }

        var jsonResponse = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(jsonResponse);
    }
}`,

    'Middleware/RequestLoggingMiddleware.cs': `namespace \${projectName}.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var startTime = DateTime.UtcNow;
        
        _logger.LogInformation("Request {Method} {Path} started at {StartTime}",
            context.Request.Method,
            context.Request.Path,
            startTime);

        await _next(context);

        var endTime = DateTime.UtcNow;
        var duration = endTime - startTime;

        _logger.LogInformation("Request {Method} {Path} completed with {StatusCode} in {Duration}ms",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            duration.TotalMilliseconds);
    }
}`,

    // Extensions
    'Extensions/ServiceCollectionExtensions.cs': `using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using \${projectName}.Data;
using \${projectName}.Models;
using \${projectName}.Services;

namespace \${projectName}.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Database
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        // Identity
        services.AddIdentity<ApplicationUser, IdentityRole>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 6;
            options.User.RequireUniqueEmail = true;
        })
        .AddEntityFrameworkStores<ApplicationDbContext>()
        .AddDefaultTokenProviders();

        // JWT Authentication
        var jwtSettings = configuration.GetSection("JwtSettings");
        services.AddAuthentication(options =>
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
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!))
            };
        });

        // Business Services
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ITokenService, TokenService>();

        // AutoMapper
        services.AddAutoMapper(typeof(Program));

        return services;
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
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database=\${projectName}Db;Trusted_Connection=true;MultipleActiveResultSets=true",
    "Redis": "localhost:6379"
  },
  "JwtSettings": {
    "SecretKey": "YourSuperSecretKeyThatIsAtLeast32CharactersLong!",
    "Issuer": "\${projectName}-api",
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
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database=\${projectName}DevDb;Trusted_Connection=true;MultipleActiveResultSets=true",
    "Redis": "localhost:6379"
  }
}`,

    // AutoMapper Profile
    'Profiles/MappingProfile.cs': `using AutoMapper;
using \${projectName}.DTOs;
using \${projectName}.Models;

namespace \${projectName}.Profiles;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Product mappings
        CreateMap<ProductCreateDto, Product>();
        CreateMap<ProductUpdateDto, Product>();
        CreateMap<Product, ProductResponseDto>();

        // User mappings
        CreateMap<UserRegisterDto, ApplicationUser>()
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.Email));
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
EXPOSE 8081

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
RUN dotnet publish "./\${projectName}.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

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
    'README.md': `# \${projectName} - ASP.NET Core Web API

Enterprise-grade ASP.NET Core Web API with comprehensive features including authentication, authorization, data access, caching, and more.

## Features

- **Authentication & Authorization**: JWT-based authentication with Identity framework
- **Database**: Entity Framework Core with SQL Server
- **Caching**: Redis distributed caching
- **Logging**: Serilog with file and console outputs
- **API Documentation**: Swagger/OpenAPI with XML documentation
- **Validation**: FluentValidation for model validation
- **Mapping**: AutoMapper for object-to-object mapping
- **Testing**: xUnit with FluentAssertions and Moq
- **Docker**: Multi-stage Dockerfile for containerization
- **Hot Reload**: dotnet watch for development

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

Build and run with Docker:
\`\`\`bash
docker build -t \${projectName.toLowerCase()}-api .
docker run -p 8080:8080 \${projectName.toLowerCase()}-api
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/auth/register\` - Register a new user
- \`POST /api/auth/login\` - Login user
- \`POST /api/auth/validate\` - Validate JWT token

### Products
- \`GET /api/products\` - Get all products
- \`GET /api/products/{id}\` - Get product by ID
- \`GET /api/products/category/{categoryId}\` - Get products by category
- \`POST /api/products\` - Create new product (requires authentication)
- \`PUT /api/products/{id}\` - Update product (requires authentication)
- \`DELETE /api/products/{id}\` - Delete product (requires authentication)
- \`PATCH /api/products/{id}/stock\` - Update product stock (requires authentication)

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

## Testing

Run tests:
\`\`\`bash
dotnet test
\`\`\`

## Project Structure

\`\`\`
\${projectName}/
├── Controllers/          # API controllers
├── Data/                # Database context and configurations
├── DTOs/                # Data Transfer Objects
├── Extensions/          # Service collection extensions
├── Middleware/          # Custom middleware
├── Models/              # Domain models
├── Profiles/            # AutoMapper profiles
├── Services/            # Business logic services
├── Program.cs           # Application entry point
└── README.md
\`\`\`

## Technologies Used

- **ASP.NET Core 8.0** - Web framework
- **Entity Framework Core** - ORM
- **Identity Framework** - Authentication and authorization
- **JWT Bearer** - Token-based authentication
- **Serilog** - Structured logging
- **AutoMapper** - Object mapping
- **FluentValidation** - Model validation
- **Swagger/OpenAPI** - API documentation
- **Redis** - Distributed caching
- **xUnit** - Testing framework
- **Docker** - Containerization

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
    'Microsoft.AspNetCore.Identity.EntityFrameworkCore': '^8.0.0',
    'Swashbuckle.AspNetCore': '^6.5.0',
    'Serilog.AspNetCore': '^8.0.0',
    'AutoMapper': '^12.0.1',
    'FluentValidation.AspNetCore': '^11.3.0',
    'StackExchange.Redis': '^2.7.10'
  },

  devDependencies: {
    'Microsoft.EntityFrameworkCore.InMemory': '^8.0.0'
  },

  features: [
    'authentication',
    'authorization',
    'database',
    'caching',
    'logging',
    'monitoring',
    'testing',
    'documentation',
    'security',
    'validation',
    'cors',
    'rest-api',
    'docker'
  ]
};