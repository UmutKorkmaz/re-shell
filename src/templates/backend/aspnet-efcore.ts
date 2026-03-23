import { BackendTemplate } from '../types';

export const aspnetEFCoreTemplate: BackendTemplate = {
  id: 'aspnet-efcore',
  name: 'aspnet-efcore',
  displayName: 'ASP.NET Core with Entity Framework Core',
  description: 'Enterprise .NET API with EF Core migrations and advanced database patterns',
  language: 'csharp',
  framework: 'aspnet-efcore',
  version: '1.0.0',
  tags: ['aspnet', 'efcore', 'migrations', 'database', 'database'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing'],
  
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
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Analyzers" Version="8.0.0" />
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.0" />
  </ItemGroup>

</Project>`,

    // Program.cs
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;
using {{serviceName}}.Profiles;
using {{serviceName}}.Validators;
using {{serviceName}}.Infrastructure;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using FluentValidation;
using Serilog;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

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

// Configure Entity Framework with connection string selection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (builder.Environment.IsDevelopment())
{
    connectionString = builder.Configuration.GetConnectionString("DevelopmentConnection") ?? connectionString;
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (builder.Environment.IsEnvironment("Testing"))
    {
        options.UseInMemoryDatabase("TestDb");
    }
    else
    {
        options.UseSqlServer(connectionString, sqlOptions =>
        {
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorNumbersToAdd: null);
            sqlOptions.CommandTimeout(30);
        });
        
        // Enable sensitive data logging in development
        if (builder.Environment.IsDevelopment())
        {
            options.EnableSensitiveDataLogging();
            options.EnableDetailedErrors();
        }
    }
});

// Configure AutoMapper
builder.Services.AddAutoMapper(typeof(UserProfile), typeof(ProductProfile), typeof(OrderProfile));

// Configure FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserDtoValidator>();

// Configure Swagger/OpenAPI
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "{{serviceName}} API", 
        Version = "v1",
        Description = "Enterprise API with Entity Framework Core and migrations",
        Contact = new OpenApiContact
        {
            Name = "{{serviceName}} Team",
            Email = "team@{{serviceName}}.com"
        }
    });
    
    // Include XML comments
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
    
    // Configure JWT authentication in Swagger
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

// Register application services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IAuditService, AuditService>();

// Register infrastructure services
builder.Services.AddScoped<IDatabaseSeeder, DatabaseSeeder>();
builder.Services.AddScoped<IMigrationService, MigrationService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Database initialization and migration (skip in testing environment)
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var migrationService = scope.ServiceProvider.GetRequiredService<IMigrationService>();
    
    // Apply pending migrations
    await migrationService.ApplyMigrationsAsync();
    
    // Seed initial data if needed
    if (app.Environment.IsDevelopment())
    {
        var seeder = scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>();
        await seeder.SeedAsync();
    }
}

app.Run();

// Make the implicit Program class public for testing
public partial class Program { }`,

    // Models/User.cs
    'Models/User.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(Email), IsUnique = true)]
[Index(nameof(CreatedAt))]
public class User : BaseEntity
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    [EmailAddress]
    [StringLength(255)]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    public string PasswordHash { get; set; } = string.Empty;
    
    [StringLength(20)]
    public string? PhoneNumber { get; set; }
    
    public DateTime DateOfBirth { get; set; }
    
    [StringLength(500)]
    public string? Address { get; set; }
    
    [StringLength(100)]
    public string? City { get; set; }
    
    [StringLength(100)]
    public string? Country { get; set; }
    
    [StringLength(10)]
    public string? PostalCode { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public bool IsEmailVerified { get; set; } = false;
    
    public DateTime? LastLoginAt { get; set; }
    
    // Navigation properties
    public virtual ICollection<Order> Orders { get; set; } = new List<Order>();
    public virtual ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}`,

    // Models/Product.cs
    'Models/Product.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(Name))]
[Index(nameof(CategoryId))]
[Index(nameof(Price))]
[Index(nameof(CreatedAt))]
public class Product : BaseEntity
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    [Range(0.01, 999999.99)]
    public decimal Price { get; set; }
    
    [Required]
    public int CategoryId { get; set; }
    
    [StringLength(50)]
    public string? Brand { get; set; }
    
    [StringLength(50)]
    public string? SKU { get; set; }
    
    public int StockQuantity { get; set; }
    
    public int MinStockLevel { get; set; } = 0;
    
    [StringLength(500)]
    public string? ImageUrl { get; set; }
    
    [Column(TypeName = "decimal(5,2)")]
    [Range(0, 100)]
    public decimal? DiscountPercentage { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public bool IsFeatured { get; set; } = false;
    
    [Column(TypeName = "decimal(3,2)")]
    [Range(0, 5)]
    public decimal? Rating { get; set; }
    
    public int ReviewCount { get; set; } = 0;
    
    public DateTime? DiscountStartDate { get; set; }
    
    public DateTime? DiscountEndDate { get; set; }
    
    // Navigation properties
    public virtual Category Category { get; set; } = null!;
    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public virtual ICollection<ProductTag> ProductTags { get; set; } = new List<ProductTag>();
    public virtual ICollection<ProductImage> ProductImages { get; set; } = new List<ProductImage>();
}`,

    // Models/Category.cs
    'Models/Category.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(Name), IsUnique = true)]
[Index(nameof(ParentCategoryId))]
public class Category : BaseEntity
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(500)]
    public string? Description { get; set; }
    
    [StringLength(100)]
    public string? Slug { get; set; }
    
    public int? ParentCategoryId { get; set; }
    
    [StringLength(500)]
    public string? ImageUrl { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public int SortOrder { get; set; } = 0;
    
    // Navigation properties
    public virtual Category? ParentCategory { get; set; }
    public virtual ICollection<Category> SubCategories { get; set; } = new List<Category>();
    public virtual ICollection<Product> Products { get; set; } = new List<Product>();
}`,

    // Models/Order.cs
    'Models/Order.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(OrderNumber), IsUnique = true)]
[Index(nameof(UserId))]
[Index(nameof(Status))]
[Index(nameof(CreatedAt))]
public class Order : BaseEntity
{
    [Required]
    public int UserId { get; set; }
    
    [Required]
    [StringLength(50)]
    public string OrderNumber { get; set; } = string.Empty;
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal SubtotalAmount { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal TaxAmount { get; set; } = 0;
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal ShippingAmount { get; set; } = 0;
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; } = 0;
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }
    
    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Pending";
    
    [StringLength(50)]
    public string? PaymentStatus { get; set; } = "Pending";
    
    [StringLength(50)]
    public string? PaymentMethod { get; set; }
    
    [StringLength(100)]
    public string? PaymentTransactionId { get; set; }
    
    [StringLength(500)]
    public string? ShippingAddress { get; set; }
    
    [StringLength(100)]
    public string? ShippingCity { get; set; }
    
    [StringLength(100)]
    public string? ShippingCountry { get; set; }
    
    [StringLength(20)]
    public string? ShippingPostalCode { get; set; }
    
    [StringLength(500)]
    public string? BillingAddress { get; set; }
    
    [StringLength(100)]
    public string? BillingCity { get; set; }
    
    [StringLength(100)]
    public string? BillingCountry { get; set; }
    
    [StringLength(20)]
    public string? BillingPostalCode { get; set; }
    
    [StringLength(1000)]
    public string? Notes { get; set; }
    
    public DateTime? ShippedAt { get; set; }
    
    public DateTime? DeliveredAt { get; set; }
    
    [StringLength(100)]
    public string? TrackingNumber { get; set; }
    
    // Navigation properties
    public virtual User User { get; set; } = null!;
    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public virtual ICollection<OrderStatusHistory> StatusHistory { get; set; } = new List<OrderStatusHistory>();
}`,

    // Models/OrderItem.cs
    'Models/OrderItem.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(OrderId))]
[Index(nameof(ProductId))]
public class OrderItem : BaseEntity
{
    [Required]
    public int OrderId { get; set; }
    
    [Required]
    public int ProductId { get; set; }
    
    [Required]
    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; } = 0;
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalPrice { get; set; }
    
    [StringLength(200)]
    public string? ProductName { get; set; } // Snapshot of product name at time of order
    
    [StringLength(50)]
    public string? ProductSKU { get; set; } // Snapshot of product SKU at time of order
    
    // Navigation properties
    public virtual Order Order { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
}`,

    // Models/BaseEntity.cs
    'Models/BaseEntity.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.Models;

public abstract class BaseEntity
{
    [Key]
    public int Id { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    [StringLength(100)]
    public string? CreatedBy { get; set; }
    
    [StringLength(100)]
    public string? UpdatedBy { get; set; }
    
    [Timestamp]
    public byte[]? RowVersion { get; set; }
}`,

    // Models/UserRole.cs
    'Models/UserRole.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(UserId), nameof(Role), IsUnique = true)]
public class UserRole : BaseEntity
{
    [Required]
    public int UserId { get; set; }
    
    [Required]
    [StringLength(50)]
    public string Role { get; set; } = string.Empty;
    
    [StringLength(200)]
    public string? Description { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime? ExpiresAt { get; set; }
    
    // Navigation properties
    public virtual User User { get; set; } = null!;
}`,

    // Models/ProductTag.cs
    'Models/ProductTag.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(ProductId), nameof(Tag), IsUnique = true)]
public class ProductTag : BaseEntity
{
    [Required]
    public int ProductId { get; set; }
    
    [Required]
    [StringLength(50)]
    public string Tag { get; set; } = string.Empty;
    
    // Navigation properties
    public virtual Product Product { get; set; } = null!;
}`,

    // Models/ProductImage.cs
    'Models/ProductImage.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(ProductId))]
public class ProductImage : BaseEntity
{
    [Required]
    public int ProductId { get; set; }
    
    [Required]
    [StringLength(500)]
    public string ImageUrl { get; set; } = string.Empty;
    
    [StringLength(200)]
    public string? AltText { get; set; }
    
    public bool IsPrimary { get; set; } = false;
    
    public int SortOrder { get; set; } = 0;
    
    // Navigation properties
    public virtual Product Product { get; set; } = null!;
}`,

    // Models/OrderStatusHistory.cs
    'Models/OrderStatusHistory.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(OrderId))]
[Index(nameof(CreatedAt))]
public class OrderStatusHistory : BaseEntity
{
    [Required]
    public int OrderId { get; set; }
    
    [Required]
    [StringLength(50)]
    public string FromStatus { get; set; } = string.Empty;
    
    [Required]
    [StringLength(50)]
    public string ToStatus { get; set; } = string.Empty;
    
    [StringLength(500)]
    public string? Notes { get; set; }
    
    [StringLength(100)]
    public string? ChangedBy { get; set; }
    
    // Navigation properties
    public virtual Order Order { get; set; } = null!;
}`,

    // Models/AuditLog.cs
    'Models/AuditLog.cs': `using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace {{serviceName}}.Models;

[Index(nameof(UserId))]
[Index(nameof(EntityType))]
[Index(nameof(Action))]
[Index(nameof(CreatedAt))]
public class AuditLog : BaseEntity
{
    public int? UserId { get; set; }
    
    [Required]
    [StringLength(100)]
    public string EntityType { get; set; } = string.Empty;
    
    [Required]
    public string EntityId { get; set; } = string.Empty;
    
    [Required]
    [StringLength(50)]
    public string Action { get; set; } = string.Empty; // Create, Update, Delete
    
    [StringLength(100)]
    public string? UserEmail { get; set; }
    
    [StringLength(45)]
    public string? IPAddress { get; set; }
    
    [StringLength(500)]
    public string? UserAgent { get; set; }
    
    public string? OldValues { get; set; } // JSON
    
    public string? NewValues { get; set; } // JSON
    
    [StringLength(500)]
    public string? Changes { get; set; } // Summary of changes
    
    // Navigation properties
    public virtual User? User { get; set; }
}`,

    // Data/ApplicationDbContext.cs
    'Data/ApplicationDbContext.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Models;
using {{serviceName}}.Data.Configurations;

namespace {{serviceName}}.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    // DbSets
    public DbSet<User> Users { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<UserRole> UserRoles { get; set; }
    public DbSet<ProductTag> ProductTags { get; set; }
    public DbSet<ProductImage> ProductImages { get; set; }
    public DbSet<OrderStatusHistory> OrderStatusHistory { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply entity configurations
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new ProductConfiguration());
        modelBuilder.ApplyConfiguration(new CategoryConfiguration());
        modelBuilder.ApplyConfiguration(new OrderConfiguration());
        modelBuilder.ApplyConfiguration(new OrderItemConfiguration());
        modelBuilder.ApplyConfiguration(new UserRoleConfiguration());
        modelBuilder.ApplyConfiguration(new ProductTagConfiguration());
        modelBuilder.ApplyConfiguration(new ProductImageConfiguration());
        modelBuilder.ApplyConfiguration(new OrderStatusHistoryConfiguration());
        modelBuilder.ApplyConfiguration(new AuditLogConfiguration());

        // Global query filters
        modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);
        modelBuilder.Entity<Product>().HasQueryFilter(p => !p.IsDeleted);
        modelBuilder.Entity<Category>().HasQueryFilter(c => !c.IsDeleted);
        modelBuilder.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        // Configure decimal precision globally
        foreach (var property in modelBuilder.Model.GetEntityTypes()
            .SelectMany(t => t.GetProperties())
            .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            property.SetColumnType("decimal(18,2)");
        }

        // Set default values
        modelBuilder.Entity<User>()
            .Property(u => u.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        modelBuilder.Entity<Product>()
            .Property(p => p.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        modelBuilder.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasDefaultValueSql("GETUTCDATE()");

        // Seed initial data
        SeedInitialData(modelBuilder);
    }

    public override int SaveChanges()
    {
        AddTimestamps();
        return base.SaveChanges();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        AddTimestamps();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void AddTimestamps()
    {
        var entities = ChangeTracker.Entries()
            .Where(x => x.Entity is BaseEntity && (x.State == EntityState.Added || x.State == EntityState.Modified));

        foreach (var entity in entities)
        {
            var baseEntity = (BaseEntity)entity.Entity;
            
            if (entity.State == EntityState.Added)
            {
                baseEntity.CreatedAt = DateTime.UtcNow;
            }
            else if (entity.State == EntityState.Modified)
            {
                baseEntity.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private static void SeedInitialData(ModelBuilder modelBuilder)
    {
        // Seed Categories
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Electronics", Description = "Electronic devices and gadgets", Slug = "electronics", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Category { Id = 2, Name = "Computers", Description = "Computers and accessories", Slug = "computers", ParentCategoryId = 1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new Category { Id = 3, Name = "Smartphones", Description = "Mobile phones and accessories", Slug = "smartphones", ParentCategoryId = 1, IsActive = true, CreatedAt = DateTime.UtcNow },
            new Category { Id = 4, Name = "Clothing", Description = "Apparel and fashion", Slug = "clothing", IsActive = true, CreatedAt = DateTime.UtcNow },
            new Category { Id = 5, Name = "Books", Description = "Books and literature", Slug = "books", IsActive = true, CreatedAt = DateTime.UtcNow }
        );

        // Seed Products
        modelBuilder.Entity<Product>().HasData(
            new Product
            {
                Id = 1,
                Name = "Laptop Pro 15",
                Description = "High-performance laptop for professionals",
                Price = 1299.99m,
                CategoryId = 2,
                Brand = "TechCorp",
                SKU = "LAP-PRO-15",
                StockQuantity = 50,
                MinStockLevel = 10,
                ImageUrl = "/images/laptop-pro-15.jpg",
                IsActive = true,
                IsFeatured = true,
                Rating = 4.5m,
                ReviewCount = 128,
                CreatedAt = DateTime.UtcNow
            },
            new Product
            {
                Id = 2,
                Name = "Wireless Mouse",
                Description = "Ergonomic wireless mouse with precision tracking",
                Price = 49.99m,
                CategoryId = 2,
                Brand = "TechCorp",
                SKU = "MSE-WRL-001",
                StockQuantity = 200,
                MinStockLevel = 20,
                ImageUrl = "/images/wireless-mouse.jpg",
                IsActive = true,
                Rating = 4.2m,
                ReviewCount = 89,
                CreatedAt = DateTime.UtcNow
            },
            new Product
            {
                Id = 3,
                Name = "Smartphone X",
                Description = "Latest smartphone with advanced features",
                Price = 799.99m,
                CategoryId = 3,
                Brand = "MobileTech",
                SKU = "PHN-X-128",
                StockQuantity = 75,
                MinStockLevel = 15,
                ImageUrl = "/images/smartphone-x.jpg",
                IsActive = true,
                IsFeatured = true,
                Rating = 4.7m,
                ReviewCount = 234,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}

// Extension for soft delete
public static class ApplicationDbContextExtensions
{
    public static void AddSoftDeleteProperty(this ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                entityType.AddProperty("IsDeleted", typeof(bool));
            }
        }
    }
}`,

    // Data/Configurations/UserConfiguration.cs
    'Data/Configurations/UserConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(u => u.PasswordHash)
            .IsRequired();

        builder.Property(u => u.PhoneNumber)
            .HasMaxLength(20);

        builder.Property(u => u.Address)
            .HasMaxLength(500);

        builder.Property(u => u.City)
            .HasMaxLength(100);

        builder.Property(u => u.Country)
            .HasMaxLength(100);

        builder.Property(u => u.PostalCode)
            .HasMaxLength(10);

        // Indexes
        builder.HasIndex(u => u.Email)
            .IsUnique()
            .HasDatabaseName("IX_Users_Email");

        builder.HasIndex(u => u.CreatedAt)
            .HasDatabaseName("IX_Users_CreatedAt");

        builder.HasIndex(u => u.IsActive)
            .HasDatabaseName("IX_Users_IsActive");

        // Relationships
        builder.HasMany(u => u.Orders)
            .WithOne(o => o.User)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(u => u.UserRoles)
            .WithOne(ur => ur.User)
            .HasForeignKey(ur => ur.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.AuditLogs)
            .WithOne(al => al.User)
            .HasForeignKey(al => al.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}`,

    // Data/Configurations/ProductConfiguration.cs
    'Data/Configurations/ProductConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.Description)
            .HasMaxLength(1000);

        builder.Property(p => p.Price)
            .IsRequired()
            .HasColumnType("decimal(18,2)");

        builder.Property(p => p.Brand)
            .HasMaxLength(50);

        builder.Property(p => p.SKU)
            .HasMaxLength(50);

        builder.Property(p => p.ImageUrl)
            .HasMaxLength(500);

        builder.Property(p => p.DiscountPercentage)
            .HasColumnType("decimal(5,2)");

        builder.Property(p => p.Rating)
            .HasColumnType("decimal(3,2)");

        // Indexes
        builder.HasIndex(p => p.Name)
            .HasDatabaseName("IX_Products_Name");

        builder.HasIndex(p => p.CategoryId)
            .HasDatabaseName("IX_Products_CategoryId");

        builder.HasIndex(p => p.Price)
            .HasDatabaseName("IX_Products_Price");

        builder.HasIndex(p => p.SKU)
            .IsUnique()
            .HasDatabaseName("IX_Products_SKU");

        builder.HasIndex(p => p.IsActive)
            .HasDatabaseName("IX_Products_IsActive");

        builder.HasIndex(p => p.IsFeatured)
            .HasDatabaseName("IX_Products_IsFeatured");

        // Relationships
        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.OrderItems)
            .WithOne(oi => oi.Product)
            .HasForeignKey(oi => oi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.ProductTags)
            .WithOne(pt => pt.Product)
            .HasForeignKey(pt => pt.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.ProductImages)
            .WithOne(pi => pi.Product)
            .HasForeignKey(pi => pi.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // Check constraints
        builder.HasCheckConstraint("CK_Products_Price", "Price > 0");
        builder.HasCheckConstraint("CK_Products_StockQuantity", "StockQuantity >= 0");
        builder.HasCheckConstraint("CK_Products_MinStockLevel", "MinStockLevel >= 0");
        builder.HasCheckConstraint("CK_Products_DiscountPercentage", "DiscountPercentage >= 0 AND DiscountPercentage <= 100");
        builder.HasCheckConstraint("CK_Products_Rating", "Rating >= 0 AND Rating <= 5");
    }
}`,

    // Data/Configurations/CategoryConfiguration.cs
    'Data/Configurations/CategoryConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(c => c.Description)
            .HasMaxLength(500);

        builder.Property(c => c.Slug)
            .HasMaxLength(100);

        builder.Property(c => c.ImageUrl)
            .HasMaxLength(500);

        // Indexes
        builder.HasIndex(c => c.Name)
            .IsUnique()
            .HasDatabaseName("IX_Categories_Name");

        builder.HasIndex(c => c.ParentCategoryId)
            .HasDatabaseName("IX_Categories_ParentCategoryId");

        builder.HasIndex(c => c.Slug)
            .IsUnique()
            .HasDatabaseName("IX_Categories_Slug");

        // Self-referencing relationship
        builder.HasOne(c => c.ParentCategory)
            .WithMany(c => c.SubCategories)
            .HasForeignKey(c => c.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(c => c.Products)
            .WithOne(p => p.Category)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}`,

    // Data/Configurations/OrderConfiguration.cs
    'Data/Configurations/OrderConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.OrderNumber)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(o => o.SubtotalAmount)
            .IsRequired()
            .HasColumnType("decimal(18,2)");

        builder.Property(o => o.TaxAmount)
            .HasColumnType("decimal(18,2)");

        builder.Property(o => o.ShippingAmount)
            .HasColumnType("decimal(18,2)");

        builder.Property(o => o.DiscountAmount)
            .HasColumnType("decimal(18,2)");

        builder.Property(o => o.TotalAmount)
            .IsRequired()
            .HasColumnType("decimal(18,2)");

        builder.Property(o => o.Status)
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("Pending");

        builder.Property(o => o.PaymentStatus)
            .HasMaxLength(50)
            .HasDefaultValue("Pending");

        builder.Property(o => o.PaymentMethod)
            .HasMaxLength(50);

        builder.Property(o => o.PaymentTransactionId)
            .HasMaxLength(100);

        builder.Property(o => o.ShippingAddress)
            .HasMaxLength(500);

        builder.Property(o => o.ShippingCity)
            .HasMaxLength(100);

        builder.Property(o => o.ShippingCountry)
            .HasMaxLength(100);

        builder.Property(o => o.ShippingPostalCode)
            .HasMaxLength(20);

        builder.Property(o => o.BillingAddress)
            .HasMaxLength(500);

        builder.Property(o => o.BillingCity)
            .HasMaxLength(100);

        builder.Property(o => o.BillingCountry)
            .HasMaxLength(100);

        builder.Property(o => o.BillingPostalCode)
            .HasMaxLength(20);

        builder.Property(o => o.Notes)
            .HasMaxLength(1000);

        builder.Property(o => o.TrackingNumber)
            .HasMaxLength(100);

        // Indexes
        builder.HasIndex(o => o.OrderNumber)
            .IsUnique()
            .HasDatabaseName("IX_Orders_OrderNumber");

        builder.HasIndex(o => o.UserId)
            .HasDatabaseName("IX_Orders_UserId");

        builder.HasIndex(o => o.Status)
            .HasDatabaseName("IX_Orders_Status");

        builder.HasIndex(o => o.CreatedAt)
            .HasDatabaseName("IX_Orders_CreatedAt");

        builder.HasIndex(o => o.PaymentStatus)
            .HasDatabaseName("IX_Orders_PaymentStatus");

        // Relationships
        builder.HasOne(o => o.User)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.OrderItems)
            .WithOne(oi => oi.Order)
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(o => o.StatusHistory)
            .WithOne(osh => osh.Order)
            .HasForeignKey(osh => osh.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Check constraints
        builder.HasCheckConstraint("CK_Orders_SubtotalAmount", "SubtotalAmount >= 0");
        builder.HasCheckConstraint("CK_Orders_TaxAmount", "TaxAmount >= 0");
        builder.HasCheckConstraint("CK_Orders_ShippingAmount", "ShippingAmount >= 0");
        builder.HasCheckConstraint("CK_Orders_DiscountAmount", "DiscountAmount >= 0");
        builder.HasCheckConstraint("CK_Orders_TotalAmount", "TotalAmount >= 0");
    }
}`,

    // Data/Configurations/OrderItemConfiguration.cs
    'Data/Configurations/OrderItemConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems");

        builder.HasKey(oi => oi.Id);

        builder.Property(oi => oi.Quantity)
            .IsRequired();

        builder.Property(oi => oi.UnitPrice)
            .IsRequired()
            .HasColumnType("decimal(18,2)");

        builder.Property(oi => oi.DiscountAmount)
            .HasColumnType("decimal(18,2)");

        builder.Property(oi => oi.TotalPrice)
            .IsRequired()
            .HasColumnType("decimal(18,2)");

        builder.Property(oi => oi.ProductName)
            .HasMaxLength(200);

        builder.Property(oi => oi.ProductSKU)
            .HasMaxLength(50);

        // Indexes
        builder.HasIndex(oi => oi.OrderId)
            .HasDatabaseName("IX_OrderItems_OrderId");

        builder.HasIndex(oi => oi.ProductId)
            .HasDatabaseName("IX_OrderItems_ProductId");

        // Relationships
        builder.HasOne(oi => oi.Order)
            .WithMany(o => o.OrderItems)
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(oi => oi.Product)
            .WithMany(p => p.OrderItems)
            .HasForeignKey(oi => oi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // Check constraints
        builder.HasCheckConstraint("CK_OrderItems_Quantity", "Quantity > 0");
        builder.HasCheckConstraint("CK_OrderItems_UnitPrice", "UnitPrice >= 0");
        builder.HasCheckConstraint("CK_OrderItems_DiscountAmount", "DiscountAmount >= 0");
        builder.HasCheckConstraint("CK_OrderItems_TotalPrice", "TotalPrice >= 0");
    }
}`,

    // Data/Configurations/UserRoleConfiguration.cs
    'Data/Configurations/UserRoleConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("UserRoles");

        builder.HasKey(ur => ur.Id);

        builder.Property(ur => ur.Role)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(ur => ur.Description)
            .HasMaxLength(200);

        // Indexes
        builder.HasIndex(ur => new { ur.UserId, ur.Role })
            .IsUnique()
            .HasDatabaseName("IX_UserRoles_UserId_Role");

        // Relationships
        builder.HasOne(ur => ur.User)
            .WithMany(u => u.UserRoles)
            .HasForeignKey(ur => ur.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}`,

    // Data/Configurations/ProductTagConfiguration.cs
    'Data/Configurations/ProductTagConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class ProductTagConfiguration : IEntityTypeConfiguration<ProductTag>
{
    public void Configure(EntityTypeBuilder<ProductTag> builder)
    {
        builder.ToTable("ProductTags");

        builder.HasKey(pt => pt.Id);

        builder.Property(pt => pt.Tag)
            .IsRequired()
            .HasMaxLength(50);

        // Indexes
        builder.HasIndex(pt => new { pt.ProductId, pt.Tag })
            .IsUnique()
            .HasDatabaseName("IX_ProductTags_ProductId_Tag");

        builder.HasIndex(pt => pt.Tag)
            .HasDatabaseName("IX_ProductTags_Tag");

        // Relationships
        builder.HasOne(pt => pt.Product)
            .WithMany(p => p.ProductTags)
            .HasForeignKey(pt => pt.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}`,

    // Data/Configurations/ProductImageConfiguration.cs
    'Data/Configurations/ProductImageConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.ToTable("ProductImages");

        builder.HasKey(pi => pi.Id);

        builder.Property(pi => pi.ImageUrl)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(pi => pi.AltText)
            .HasMaxLength(200);

        // Indexes
        builder.HasIndex(pi => pi.ProductId)
            .HasDatabaseName("IX_ProductImages_ProductId");

        builder.HasIndex(pi => pi.IsPrimary)
            .HasDatabaseName("IX_ProductImages_IsPrimary");

        // Relationships
        builder.HasOne(pi => pi.Product)
            .WithMany(p => p.ProductImages)
            .HasForeignKey(pi => pi.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}`,

    // Data/Configurations/OrderStatusHistoryConfiguration.cs
    'Data/Configurations/OrderStatusHistoryConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> builder)
    {
        builder.ToTable("OrderStatusHistory");

        builder.HasKey(osh => osh.Id);

        builder.Property(osh => osh.FromStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(osh => osh.ToStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(osh => osh.Notes)
            .HasMaxLength(500);

        builder.Property(osh => osh.ChangedBy)
            .HasMaxLength(100);

        // Indexes
        builder.HasIndex(osh => osh.OrderId)
            .HasDatabaseName("IX_OrderStatusHistory_OrderId");

        builder.HasIndex(osh => osh.CreatedAt)
            .HasDatabaseName("IX_OrderStatusHistory_CreatedAt");

        // Relationships
        builder.HasOne(osh => osh.Order)
            .WithMany(o => o.StatusHistory)
            .HasForeignKey(osh => osh.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}`,

    // Data/Configurations/AuditLogConfiguration.cs
    'Data/Configurations/AuditLogConfiguration.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");

        builder.HasKey(al => al.Id);

        builder.Property(al => al.EntityType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(al => al.EntityId)
            .IsRequired();

        builder.Property(al => al.Action)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(al => al.UserEmail)
            .HasMaxLength(100);

        builder.Property(al => al.IPAddress)
            .HasMaxLength(45);

        builder.Property(al => al.UserAgent)
            .HasMaxLength(500);

        builder.Property(al => al.Changes)
            .HasMaxLength(500);

        // Store JSON as text
        builder.Property(al => al.OldValues)
            .HasColumnType("nvarchar(max)");

        builder.Property(al => al.NewValues)
            .HasColumnType("nvarchar(max)");

        // Indexes
        builder.HasIndex(al => al.UserId)
            .HasDatabaseName("IX_AuditLogs_UserId");

        builder.HasIndex(al => al.EntityType)
            .HasDatabaseName("IX_AuditLogs_EntityType");

        builder.HasIndex(al => al.Action)
            .HasDatabaseName("IX_AuditLogs_Action");

        builder.HasIndex(al => al.CreatedAt)
            .HasDatabaseName("IX_AuditLogs_CreatedAt");

        // Relationships
        builder.HasOne(al => al.User)
            .WithMany(u => u.AuditLogs)
            .HasForeignKey(al => al.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}`,

    // Infrastructure/IMigrationService.cs
    'Infrastructure/IMigrationService.cs': `namespace {{serviceName}}.Infrastructure;

public interface IMigrationService
{
    Task ApplyMigrationsAsync();
    Task<bool> HasPendingMigrationsAsync();
    Task<IEnumerable<string>> GetPendingMigrationsAsync();
    Task<IEnumerable<string>> GetAppliedMigrationsAsync();
    Task ResetDatabaseAsync();
    Task<bool> DatabaseExistsAsync();
    Task CreateDatabaseAsync();
    Task DropDatabaseAsync();
}`,

    // Infrastructure/MigrationService.cs
    'Infrastructure/MigrationService.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Data;

namespace {{serviceName}}.Infrastructure;

public class MigrationService : IMigrationService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MigrationService> _logger;

    public MigrationService(ApplicationDbContext context, ILogger<MigrationService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ApplyMigrationsAsync()
    {
        try
        {
            _logger.LogInformation("Checking for pending migrations...");
            
            var pendingMigrations = await GetPendingMigrationsAsync();
            if (pendingMigrations.Any())
            {
                _logger.LogInformation("Found {Count} pending migrations. Applying...", pendingMigrations.Count());
                
                foreach (var migration in pendingMigrations)
                {
                    _logger.LogInformation("Pending migration: {Migration}", migration);
                }
                
                await _context.Database.MigrateAsync();
                _logger.LogInformation("Migrations applied successfully");
            }
            else
            {
                _logger.LogInformation("No pending migrations found");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying migrations");
            throw;
        }
    }

    public async Task<bool> HasPendingMigrationsAsync()
    {
        try
        {
            var pendingMigrations = await _context.Database.GetPendingMigrationsAsync();
            return pendingMigrations.Any();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking for pending migrations");
            throw;
        }
    }

    public async Task<IEnumerable<string>> GetPendingMigrationsAsync()
    {
        try
        {
            return await _context.Database.GetPendingMigrationsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting pending migrations");
            throw;
        }
    }

    public async Task<IEnumerable<string>> GetAppliedMigrationsAsync()
    {
        try
        {
            return await _context.Database.GetAppliedMigrationsAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting applied migrations");
            throw;
        }
    }

    public async Task ResetDatabaseAsync()
    {
        try
        {
            _logger.LogWarning("Resetting database - all data will be lost!");
            
            await _context.Database.EnsureDeletedAsync();
            await _context.Database.MigrateAsync();
            
            _logger.LogInformation("Database reset completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting database");
            throw;
        }
    }

    public async Task<bool> DatabaseExistsAsync()
    {
        try
        {
            return await _context.Database.CanConnectAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking database existence");
            return false;
        }
    }

    public async Task CreateDatabaseAsync()
    {
        try
        {
            _logger.LogInformation("Creating database...");
            await _context.Database.EnsureCreatedAsync();
            _logger.LogInformation("Database created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating database");
            throw;
        }
    }

    public async Task DropDatabaseAsync()
    {
        try
        {
            _logger.LogWarning("Dropping database - all data will be lost!");
            await _context.Database.EnsureDeletedAsync();
            _logger.LogInformation("Database dropped successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error dropping database");
            throw;
        }
    }
}`,

    // Infrastructure/IDatabaseSeeder.cs
    'Infrastructure/IDatabaseSeeder.cs': `namespace {{serviceName}}.Infrastructure;

public interface IDatabaseSeeder
{
    Task SeedAsync();
    Task SeedUsersAsync();
    Task SeedCategoriesAsync();
    Task SeedProductsAsync();
    Task SeedOrdersAsync();
    Task ClearAllDataAsync();
}`,

    // Infrastructure/DatabaseSeeder.cs
    'Infrastructure/DatabaseSeeder.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Data;
using {{serviceName}}.Models;
using BCrypt.Net;

namespace {{serviceName}}.Infrastructure;

public class DatabaseSeeder : IDatabaseSeeder
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DatabaseSeeder> _logger;

    public DatabaseSeeder(ApplicationDbContext context, ILogger<DatabaseSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        try
        {
            _logger.LogInformation("Starting database seeding...");

            await SeedUsersAsync();
            await SeedCategoriesAsync();
            await SeedProductsAsync();
            await SeedOrdersAsync();

            _logger.LogInformation("Database seeding completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during database seeding");
            throw;
        }
    }

    public async Task SeedUsersAsync()
    {
        if (!await _context.Users.AnyAsync())
        {
            _logger.LogInformation("Seeding users...");

            var users = new List<User>
            {
                new()
                {
                    Name = "John Doe",
                    Email = "john.doe@example.com",
                    PasswordHash = BCrypt.HashPassword("Password123!"),
                    PhoneNumber = "+1234567890",
                    DateOfBirth = new DateTime(1990, 1, 15),
                    Address = "123 Main St",
                    City = "New York",
                    Country = "USA",
                    PostalCode = "10001",
                    IsActive = true,
                    IsEmailVerified = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Name = "Jane Smith",
                    Email = "jane.smith@example.com",
                    PasswordHash = BCrypt.HashPassword("Password123!"),
                    PhoneNumber = "+1234567891",
                    DateOfBirth = new DateTime(1985, 5, 22),
                    Address = "456 Oak Ave",
                    City = "Los Angeles",
                    Country = "USA",
                    PostalCode = "90210",
                    IsActive = true,
                    IsEmailVerified = true,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Name = "Admin User",
                    Email = "admin@example.com",
                    PasswordHash = BCrypt.HashPassword("AdminPass123!"),
                    PhoneNumber = "+1234567892",
                    DateOfBirth = new DateTime(1980, 3, 10),
                    Address = "789 Admin Blvd",
                    City = "Chicago",
                    Country = "USA",
                    PostalCode = "60601",
                    IsActive = true,
                    IsEmailVerified = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            _context.Users.AddRange(users);
            await _context.SaveChangesAsync();

            // Add user roles
            var adminUser = users.First(u => u.Email == "admin@example.com");
            var userRoles = new List<UserRole>
            {
                new() { UserId = adminUser.Id, Role = "Admin", Description = "System Administrator", IsActive = true, CreatedAt = DateTime.UtcNow },
                new() { UserId = adminUser.Id, Role = "User", Description = "Regular User", IsActive = true, CreatedAt = DateTime.UtcNow }
            };

            var regularUsers = users.Where(u => u.Email != "admin@example.com");
            foreach (var user in regularUsers)
            {
                userRoles.Add(new UserRole { UserId = user.Id, Role = "User", Description = "Regular User", IsActive = true, CreatedAt = DateTime.UtcNow });
            }

            _context.UserRoles.AddRange(userRoles);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Seeded {Count} users", users.Count);
        }
    }

    public async Task SeedCategoriesAsync()
    {
        if (!await _context.Categories.AnyAsync())
        {
            _logger.LogInformation("Seeding categories...");

            var categories = new List<Category>
            {
                new() { Name = "Electronics", Description = "Electronic devices and gadgets", Slug = "electronics", IsActive = true, SortOrder = 1, CreatedAt = DateTime.UtcNow },
                new() { Name = "Clothing", Description = "Apparel and fashion", Slug = "clothing", IsActive = true, SortOrder = 2, CreatedAt = DateTime.UtcNow },
                new() { Name = "Books", Description = "Books and literature", Slug = "books", IsActive = true, SortOrder = 3, CreatedAt = DateTime.UtcNow },
                new() { Name = "Home & Garden", Description = "Home and garden products", Slug = "home-garden", IsActive = true, SortOrder = 4, CreatedAt = DateTime.UtcNow },
                new() { Name = "Sports & Outdoors", Description = "Sports and outdoor equipment", Slug = "sports-outdoors", IsActive = true, SortOrder = 5, CreatedAt = DateTime.UtcNow }
            };

            _context.Categories.AddRange(categories);
            await _context.SaveChangesAsync();

            // Add subcategories
            var electronics = categories.First(c => c.Name == "Electronics");
            var clothing = categories.First(c => c.Name == "Clothing");

            var subCategories = new List<Category>
            {
                new() { Name = "Computers", Description = "Computers and accessories", Slug = "computers", ParentCategoryId = electronics.Id, IsActive = true, SortOrder = 1, CreatedAt = DateTime.UtcNow },
                new() { Name = "Smartphones", Description = "Mobile phones and accessories", Slug = "smartphones", ParentCategoryId = electronics.Id, IsActive = true, SortOrder = 2, CreatedAt = DateTime.UtcNow },
                new() { Name = "Audio", Description = "Audio equipment and accessories", Slug = "audio", ParentCategoryId = electronics.Id, IsActive = true, SortOrder = 3, CreatedAt = DateTime.UtcNow },
                new() { Name = "Men's Clothing", Description = "Men's apparel", Slug = "mens-clothing", ParentCategoryId = clothing.Id, IsActive = true, SortOrder = 1, CreatedAt = DateTime.UtcNow },
                new() { Name = "Women's Clothing", Description = "Women's apparel", Slug = "womens-clothing", ParentCategoryId = clothing.Id, IsActive = true, SortOrder = 2, CreatedAt = DateTime.UtcNow }
            };

            _context.Categories.AddRange(subCategories);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Seeded {Count} categories", categories.Count + subCategories.Count);
        }
    }

    public async Task SeedProductsAsync()
    {
        if (!await _context.Products.AnyAsync())
        {
            _logger.LogInformation("Seeding products...");

            var computers = await _context.Categories.FirstAsync(c => c.Name == "Computers");
            var smartphones = await _context.Categories.FirstAsync(c => c.Name == "Smartphones");
            var audio = await _context.Categories.FirstAsync(c => c.Name == "Audio");

            var products = new List<Product>
            {
                new()
                {
                    Name = "MacBook Pro 16-inch",
                    Description = "Apple MacBook Pro with M2 Pro chip, 16-inch Liquid Retina XDR display",
                    Price = 2499.99m,
                    CategoryId = computers.Id,
                    Brand = "Apple",
                    SKU = "MBP-16-M2P-512",
                    StockQuantity = 25,
                    MinStockLevel = 5,
                    ImageUrl = "/images/macbook-pro-16.jpg",
                    IsActive = true,
                    IsFeatured = true,
                    Rating = 4.8m,
                    ReviewCount = 156,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Name = "iPhone 15 Pro",
                    Description = "iPhone 15 Pro with titanium design, 48MP Main camera, and A17 Pro chip",
                    Price = 999.99m,
                    CategoryId = smartphones.Id,
                    Brand = "Apple",
                    SKU = "IPH-15P-128-TIT",
                    StockQuantity = 50,
                    MinStockLevel = 10,
                    ImageUrl = "/images/iphone-15-pro.jpg",
                    IsActive = true,
                    IsFeatured = true,
                    Rating = 4.7m,
                    ReviewCount = 289,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Name = "Dell XPS 13",
                    Description = "Dell XPS 13 laptop with Intel Core i7, 16GB RAM, 512GB SSD",
                    Price = 1299.99m,
                    CategoryId = computers.Id,
                    Brand = "Dell",
                    SKU = "XPS-13-I7-16-512",
                    StockQuantity = 30,
                    MinStockLevel = 8,
                    ImageUrl = "/images/dell-xps-13.jpg",
                    IsActive = true,
                    Rating = 4.5m,
                    ReviewCount = 94,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Name = "Samsung Galaxy S24 Ultra",
                    Description = "Samsung Galaxy S24 Ultra with S Pen, 200MP camera, and 1TB storage",
                    Price = 1199.99m,
                    CategoryId = smartphones.Id,
                    Brand = "Samsung",
                    SKU = "GAL-S24U-1TB-BLK",
                    StockQuantity = 40,
                    MinStockLevel = 12,
                    ImageUrl = "/images/galaxy-s24-ultra.jpg",
                    IsActive = true,
                    IsFeatured = true,
                    Rating = 4.6m,
                    ReviewCount = 203,
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Name = "Sony WH-1000XM5",
                    Description = "Sony WH-1000XM5 wireless noise canceling headphones",
                    Price = 349.99m,
                    CategoryId = audio.Id,
                    Brand = "Sony",
                    SKU = "WH1000XM5-BLK",
                    StockQuantity = 75,
                    MinStockLevel = 15,
                    ImageUrl = "/images/sony-wh1000xm5.jpg",
                    IsActive = true,
                    Rating = 4.9m,
                    ReviewCount = 412,
                    CreatedAt = DateTime.UtcNow
                }
            };

            _context.Products.AddRange(products);
            await _context.SaveChangesAsync();

            // Add product tags
            var productTags = new List<ProductTag>();
            foreach (var product in products)
            {
                if (product.Brand == "Apple")
                {
                    productTags.AddRange(new[]
                    {
                        new ProductTag { ProductId = product.Id, Tag = "premium", CreatedAt = DateTime.UtcNow },
                        new ProductTag { ProductId = product.Id, Tag = "apple", CreatedAt = DateTime.UtcNow }
                    });
                }
                
                if (product.IsFeatured)
                {
                    productTags.Add(new ProductTag { ProductId = product.Id, Tag = "featured", CreatedAt = DateTime.UtcNow });
                }
                
                if (product.CategoryId == smartphones.Id)
                {
                    productTags.Add(new ProductTag { ProductId = product.Id, Tag = "mobile", CreatedAt = DateTime.UtcNow });
                }
            }

            _context.ProductTags.AddRange(productTags);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Seeded {Count} products", products.Count);
        }
    }

    public async Task SeedOrdersAsync()
    {
        if (!await _context.Orders.AnyAsync())
        {
            _logger.LogInformation("Seeding orders...");

            var users = await _context.Users.Where(u => u.Email != "admin@example.com").ToListAsync();
            var products = await _context.Products.ToListAsync();

            var orders = new List<Order>();
            var orderItems = new List<OrderItem>();

            foreach (var user in users.Take(2))
            {
                var order = new Order
                {
                    UserId = user.Id,
                    OrderNumber = $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..8].ToUpper()}",
                    Status = "Completed",
                    PaymentStatus = "Paid",
                    PaymentMethod = "Credit Card",
                    PaymentTransactionId = $"TXN-{Guid.NewGuid().ToString()[..12].ToUpper()}",
                    ShippingAddress = user.Address,
                    ShippingCity = user.City,
                    ShippingCountry = user.Country,
                    ShippingPostalCode = user.PostalCode,
                    BillingAddress = user.Address,
                    BillingCity = user.City,
                    BillingCountry = user.Country,
                    BillingPostalCode = user.PostalCode,
                    CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(1, 30))
                };

                var selectedProducts = products.OrderBy(x => Guid.NewGuid()).Take(Random.Shared.Next(1, 4)).ToList();
                decimal subtotal = 0;

                foreach (var product in selectedProducts)
                {
                    var quantity = Random.Shared.Next(1, 3);
                    var unitPrice = product.Price;
                    var totalPrice = unitPrice * quantity;

                    var orderItem = new OrderItem
                    {
                        Order = order,
                        ProductId = product.Id,
                        Quantity = quantity,
                        UnitPrice = unitPrice,
                        TotalPrice = totalPrice,
                        ProductName = product.Name,
                        ProductSKU = product.SKU,
                        CreatedAt = order.CreatedAt
                    };

                    orderItems.Add(orderItem);
                    subtotal += totalPrice;
                }

                order.SubtotalAmount = subtotal;
                order.TaxAmount = subtotal * 0.08m; // 8% tax
                order.ShippingAmount = subtotal > 100 ? 0 : 9.99m; // Free shipping over $100
                order.TotalAmount = order.SubtotalAmount + order.TaxAmount + order.ShippingAmount;
                
                orders.Add(order);
            }

            _context.Orders.AddRange(orders);
            await _context.SaveChangesAsync();

            _context.OrderItems.AddRange(orderItems);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Seeded {Count} orders with {ItemCount} order items", orders.Count, orderItems.Count);
        }
    }

    public async Task ClearAllDataAsync()
    {
        _logger.LogWarning("Clearing all data from database...");

        _context.OrderItems.RemoveRange(_context.OrderItems);
        _context.Orders.RemoveRange(_context.Orders);
        _context.ProductTags.RemoveRange(_context.ProductTags);
        _context.ProductImages.RemoveRange(_context.ProductImages);
        _context.Products.RemoveRange(_context.Products);
        _context.Categories.RemoveRange(_context.Categories);
        _context.UserRoles.RemoveRange(_context.UserRoles);
        _context.Users.RemoveRange(_context.Users);
        _context.AuditLogs.RemoveRange(_context.AuditLogs);

        await _context.SaveChangesAsync();

        _logger.LogInformation("All data cleared from database");
    }
}`,

    // Services/ICategoryService.cs
    'Services/ICategoryService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface ICategoryService
{
    Task<IEnumerable<CategoryDto>> GetAllAsync();
    Task<CategoryDto?> GetByIdAsync(int id);
    Task<CategoryDto?> GetBySlugAsync(string slug);
    Task<IEnumerable<CategoryDto>> GetRootCategoriesAsync();
    Task<IEnumerable<CategoryDto>> GetSubCategoriesAsync(int parentId);
}`,

    // Services/CategoryService.cs
    'Services/CategoryService.cs': `using Microsoft.EntityFrameworkCore;
using AutoMapper;
using {{serviceName}}.Data;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public class CategoryService : ICategoryService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public CategoryService(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<IEnumerable<CategoryDto>> GetAllAsync()
    {
        var categories = await _context.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<CategoryDto>>(categories);
    }

    public async Task<CategoryDto?> GetByIdAsync(int id)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.IsActive);

        return category != null ? _mapper.Map<CategoryDto>(category) : null;
    }

    public async Task<CategoryDto?> GetBySlugAsync(string slug)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

        return category != null ? _mapper.Map<CategoryDto>(category) : null;
    }

    public async Task<IEnumerable<CategoryDto>> GetRootCategoriesAsync()
    {
        var categories = await _context.Categories
            .Where(c => c.ParentCategoryId == null && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<CategoryDto>>(categories);
    }

    public async Task<IEnumerable<CategoryDto>> GetSubCategoriesAsync(int parentId)
    {
        var categories = await _context.Categories
            .Where(c => c.ParentCategoryId == parentId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<CategoryDto>>(categories);
    }
}`,

    // Services/IAuditService.cs
    'Services/IAuditService.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public interface IAuditService
{
    Task LogAsync(string entityType, string entityId, string action, object? oldValues = null, object? newValues = null, int? userId = null, string? userEmail = null);
    Task<IEnumerable<AuditLog>> GetAuditLogsAsync(string entityType, string entityId);
    Task<IEnumerable<AuditLog>> GetUserAuditLogsAsync(int userId);
}`,

    // Services/AuditService.cs
    'Services/AuditService.cs': `using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using {{serviceName}}.Data;
using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public class AuditService : IAuditService
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditService(ApplicationDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task LogAsync(string entityType, string entityId, string action, object? oldValues = null, object? newValues = null, int? userId = null, string? userEmail = null)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();
        var userAgent = httpContext?.Request?.Headers["User-Agent"].ToString();

        var auditLog = new AuditLog
        {
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            UserId = userId,
            UserEmail = userEmail,
            IPAddress = ipAddress,
            UserAgent = userAgent,
            OldValues = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
            NewValues = newValues != null ? JsonSerializer.Serialize(newValues) : null,
            Changes = GenerateChangesSummary(oldValues, newValues),
            CreatedAt = DateTime.UtcNow
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<AuditLog>> GetAuditLogsAsync(string entityType, string entityId)
    {
        return await _context.AuditLogs
            .Where(al => al.EntityType == entityType && al.EntityId == entityId)
            .OrderByDescending(al => al.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<AuditLog>> GetUserAuditLogsAsync(int userId)
    {
        return await _context.AuditLogs
            .Where(al => al.UserId == userId)
            .OrderByDescending(al => al.CreatedAt)
            .Take(100) // Limit to last 100 actions
            .ToListAsync();
    }

    private static string? GenerateChangesSummary(object? oldValues, object? newValues)
    {
        if (oldValues == null && newValues == null)
            return null;

        if (oldValues == null)
            return "Created new record";

        if (newValues == null)
            return "Deleted record";

        return "Updated record";
    }
}`,

    // Stubs for other required files...
    'DTOs/CategoryDtos.cs': `namespace {{serviceName}}.DTOs;

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Slug { get; set; }
    public int? ParentCategoryId { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}`,

    // appsettings.json
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true",
    "DevelopmentConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}DevDb;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "JwtSettings": {
    "SecretKey": "your-256-bit-secret-key-here-make-it-long-and-secure",
    "Issuer": "{{serviceName}}",
    "Audience": "{{serviceName}}Users",
    "ExpirationDays": 7
  },
  "Serilog": {
    "Using": ["Serilog.Sinks.Console", "Serilog.Sinks.File"],
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning",
        "Microsoft.EntityFrameworkCore": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/log-.txt",
          "rollingInterval": "Day",
          "outputTemplate": "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      }
    ],
    "Enrich": ["FromLogContext"]
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  },
  "AllowedHosts": "*"
}`,

    // README.md
    'README.md': `# {{serviceName}} - ASP.NET Core with Entity Framework Core

Enterprise-grade .NET 8 Web API with comprehensive Entity Framework Core implementation, migrations, and advanced database patterns.

## 🚀 Features

- **Entity Framework Core 8.0**: Latest ORM with performance optimizations
- **Code-First Migrations**: Automated database schema management
- **Advanced Entity Configurations**: Fluent API configurations and constraints
- **Database Seeding**: Automated initial data population
- **Migration Management**: Service for handling database updates
- **Audit Logging**: Comprehensive change tracking and audit trails
- **Soft Delete**: Logical deletion with global query filters
- **Multi-Environment Support**: Different connection strings per environment
- **Connection Resilience**: Retry policies and timeout configurations
- **Complex Relationships**: One-to-many, many-to-many, self-referencing
- **Performance Optimizations**: Indexes, query filters, and eager loading

## 📋 Prerequisites

- .NET 8.0 SDK
- SQL Server 2019+ or SQL Server LocalDB
- Entity Framework Core CLI tools

## 🛠 Setup

1. **Install EF Core Tools:**
   \`\`\`bash
   dotnet tool install --global dotnet-ef
   \`\`\`

2. **Clone and navigate:**
   \`\`\`bash
   cd {{serviceName}}
   dotnet restore
   \`\`\`

3. **Update connection string in appsettings.json**

4. **Create and apply migrations:**
   \`\`\`bash
   # Create initial migration
   dotnet ef migrations add InitialCreate
   
   # Apply migrations to database
   dotnet ef database update
   \`\`\`

5. **Run the application:**
   \`\`\`bash
   dotnet run
   \`\`\`

## 🗄 Database Schema

### Core Entities
- **Users**: User accounts with roles and audit trails
- **Categories**: Hierarchical product categories
- **Products**: Product catalog with tags and images
- **Orders**: Order management with status tracking
- **OrderItems**: Order line items with product snapshots

### Supporting Entities
- **UserRoles**: Role-based access control
- **ProductTags**: Product tagging system
- **ProductImages**: Product image gallery
- **OrderStatusHistory**: Order status change tracking
- **AuditLogs**: Comprehensive audit logging

## 🔧 Migration Commands

### Basic Migration Operations
\`\`\`bash
# Create a new migration
dotnet ef migrations add <MigrationName>

# Apply pending migrations
dotnet ef database update

# Revert to specific migration
dotnet ef database update <MigrationName>

# Remove last migration (if not applied)
dotnet ef migrations remove

# Generate SQL script for migrations
dotnet ef migrations script

# List all migrations
dotnet ef migrations list
\`\`\`

### Advanced Migration Scenarios
\`\`\`bash
# Create migration for specific context
dotnet ef migrations add <Name> --context ApplicationDbContext

# Apply migrations to specific environment
dotnet ef database update --environment Production

# Generate script from specific migration to latest
dotnet ef migrations script <FromMigration> <ToMigration>

# Generate idempotent script (safe to run multiple times)
dotnet ef migrations script --idempotent

# Generate script with data
dotnet ef migrations script --data
\`\`\`

## 🏗 Entity Framework Patterns

### 1. Entity Configuration
\`\`\`csharp
public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");
        builder.HasKey(p => p.Id);
        
        builder.Property(p => p.Price)
            .HasColumnType("decimal(18,2)");
            
        builder.HasIndex(p => p.SKU)
            .IsUnique();
            
        builder.HasCheckConstraint("CK_Products_Price", "Price > 0");
    }
}
\`\`\`

### 2. Migration Service Usage
\`\`\`csharp
// In Program.cs
using var scope = app.Services.CreateScope();
var migrationService = scope.ServiceProvider.GetRequiredService<IMigrationService>();

// Apply pending migrations
await migrationService.ApplyMigrationsAsync();

// Check for pending migrations
var hasPending = await migrationService.HasPendingMigrationsAsync();
\`\`\`

### 3. Database Seeding
\`\`\`csharp
// Automatic seeding in development
if (app.Environment.IsDevelopment())
{
    var seeder = scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>();
    await seeder.SeedAsync();
}
\`\`\`

### 4. Audit Logging
\`\`\`csharp
// Automatic audit logging
await _auditService.LogAsync("Product", product.Id.ToString(), "Create", 
    oldValues: null, newValues: product, userId: currentUserId);
\`\`\`

## 📊 Database Features

### Indexes and Performance
- **Clustered Indexes**: Primary keys with identity columns
- **Non-Clustered Indexes**: Foreign keys, search fields, and filters
- **Unique Indexes**: Email addresses, SKUs, and business keys
- **Composite Indexes**: Multi-column queries and relationships

### Constraints and Validation
- **Check Constraints**: Data validation at database level
- **Foreign Key Constraints**: Referential integrity
- **Unique Constraints**: Business rule enforcement
- **Default Values**: Automatic timestamp generation

### Query Optimizations
- **Global Query Filters**: Soft delete and tenant filtering
- **Eager Loading**: Include() for related data
- **Projection**: Select only required columns
- **Compiled Queries**: Pre-compiled LINQ expressions

## 🔍 Migration Best Practices

### 1. Migration Naming
Use descriptive names that indicate the change:
\`\`\`bash
dotnet ef migrations add AddProductImageTable
dotnet ef migrations add UpdateUserEmailIndex
dotnet ef migrations add AddOrderStatusEnum
\`\`\`

### 2. Data Migrations
Include data changes in migrations:
\`\`\`csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateTable(/* ... */);
    
    // Seed initial data
    migrationBuilder.InsertData(
        table: "Categories",
        columns: new[] { "Id", "Name", "Slug" },
        values: new object[] { 1, "Electronics", "electronics" });
}
\`\`\`

### 3. Rollback Strategy
Always test rollback scenarios:
\`\`\`bash
# Test rollback before applying to production
dotnet ef database update <PreviousMigration>
dotnet ef database update  # Apply latest again
\`\`\`

### 4. Production Deployments
Generate scripts for production:
\`\`\`bash
# Generate production script
dotnet ef migrations script --idempotent --output migration.sql

# Review script before applying to production
# Apply script using SQL Server Management Studio or sqlcmd
\`\`\`

## 🚀 Advanced Features

### Connection Resilience
\`\`\`csharp
options.UseSqlServer(connectionString, sqlOptions =>
{
    sqlOptions.EnableRetryOnFailure(
        maxRetryCount: 3,
        maxRetryDelay: TimeSpan.FromSeconds(5),
        errorNumbersToAdd: null);
    sqlOptions.CommandTimeout(30);
});
\`\`\`

### Global Query Filters
\`\`\`csharp
modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);
modelBuilder.Entity<Product>().HasQueryFilter(p => p.IsActive);
\`\`\`

### Automatic Timestamps
\`\`\`csharp
public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
{
    AddTimestamps();
    return await base.SaveChangesAsync(cancellationToken);
}
\`\`\`

### Audit Change Tracking
\`\`\`csharp
var entities = ChangeTracker.Entries()
    .Where(x => x.Entity is BaseEntity && x.State == EntityState.Modified);

foreach (var entity in entities)
{
    // Log changes to audit table
}
\`\`\`

## 📈 Performance Monitoring

### Query Logging
Enable detailed EF Core logging:
\`\`\`json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.EntityFrameworkCore.Database.Command": "Information"
    }
  }
}
\`\`\`

### Performance Counters
Monitor key metrics:
- Query execution times
- Number of queries per request
- Database connection pool usage
- Migration application time

## 🧪 Testing with EF Core

### In-Memory Database Testing
\`\`\`csharp
services.AddDbContext<ApplicationDbContext>(options =>
    options.UseInMemoryDatabase("TestDb"));
\`\`\`

### Integration Testing
\`\`\`csharp
public class DatabaseIntegrationTests
{
    [Fact]
    public async Task CanCreateAndRetrieveUser()
    {
        // Test actual database operations
    }
}
\`\`\`

## 📚 Learn More

- [Entity Framework Core Documentation](https://docs.microsoft.com/en-us/ef/core/)
- [EF Core Migrations](https://docs.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
- [EF Core Performance](https://docs.microsoft.com/en-us/ef/core/performance/)
- [Code First Conventions](https://docs.microsoft.com/en-us/ef/core/modeling/)

This template demonstrates enterprise-level Entity Framework Core usage with comprehensive migration management, performance optimizations, and production-ready patterns.
`
  }
};