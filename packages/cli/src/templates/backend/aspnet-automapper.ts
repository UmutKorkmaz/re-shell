import { BackendTemplate } from '../types';

export const aspnetAutoMapperTemplate: BackendTemplate = {
  id: 'aspnet-automapper',
  name: 'aspnet-automapper',
  displayName: 'ASP.NET Core with AutoMapper',
  description: 'Enterprise .NET API with AutoMapper object-to-object mapping',
  language: 'csharp',
  framework: 'aspnet-automapper',
  version: '1.0.0',
  tags: ['aspnet', 'automapper', 'dto', 'mapping', 'enterprise'],
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
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="AutoMapper.EF6" Version="2.1.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
  </ItemGroup>

</Project>`,

    // Program.cs
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;
using {{serviceName}}.Profiles;
using {{serviceName}}.Validators;
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

// Configure Entity Framework
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

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
        Description = "Enterprise API with AutoMapper object-to-object mapping",
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

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();
}

app.Run();`,

    // Models/User.cs
    'Models/User.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.Models;

public class User
{
    public int Id { get; set; }
    
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
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    public virtual ICollection<Order> Orders { get; set; } = new List<Order>();
}`,

    // Models/Product.cs
    'Models/Product.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace {{serviceName}}.Models;

public class Product
{
    public int Id { get; set; }
    
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal Price { get; set; }
    
    [StringLength(100)]
    public string? Category { get; set; }
    
    [StringLength(50)]
    public string? Brand { get; set; }
    
    public int StockQuantity { get; set; }
    
    [StringLength(500)]
    public string? ImageUrl { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}`,

    // Models/Order.cs
    'Models/Order.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace {{serviceName}}.Models;

public class Order
{
    public int Id { get; set; }
    
    [Required]
    public int UserId { get; set; }
    
    [Required]
    [StringLength(50)]
    public string OrderNumber { get; set; } = string.Empty;
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }
    
    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Pending";
    
    [StringLength(500)]
    public string? ShippingAddress { get; set; }
    
    [StringLength(500)]
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation properties
    public virtual User User { get; set; } = null!;
    public virtual ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}`,

    // Models/OrderItem.cs
    'Models/OrderItem.cs': `using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace {{serviceName}}.Models;

public class OrderItem
{
    public int Id { get; set; }
    
    [Required]
    public int OrderId { get; set; }
    
    [Required]
    public int ProductId { get; set; }
    
    [Required]
    public int Quantity { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }
    
    [Required]
    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalPrice { get; set; }
    
    // Navigation properties
    public virtual Order Order { get; set; } = null!;
    public virtual Product Product { get; set; } = null!;
}`,

    // DTOs/UserDtos.cs
    'DTOs/UserDtos.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.DTOs;

public class UserDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateUserDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    [EmailAddress]
    [StringLength(255)]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    [StringLength(100, MinimumLength = 6)]
    public string Password { get; set; } = string.Empty;
    
    [StringLength(20)]
    public string? PhoneNumber { get; set; }
    
    public DateTime DateOfBirth { get; set; }
    
    [StringLength(500)]
    public string? Address { get; set; }
    
    [StringLength(100)]
    public string? City { get; set; }
    
    [StringLength(100)]
    public string? Country { get; set; }
}

public class UpdateUserDto
{
    [StringLength(100)]
    public string? Name { get; set; }
    
    [EmailAddress]
    [StringLength(255)]
    public string? Email { get; set; }
    
    [StringLength(20)]
    public string? PhoneNumber { get; set; }
    
    public DateTime? DateOfBirth { get; set; }
    
    [StringLength(500)]
    public string? Address { get; set; }
    
    [StringLength(100)]
    public string? City { get; set; }
    
    [StringLength(100)]
    public string? Country { get; set; }
    
    public bool? IsActive { get; set; }
}

public class UserSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int TotalOrders { get; set; }
    public decimal TotalSpent { get; set; }
}`,

    // DTOs/ProductDtos.cs
    'DTOs/ProductDtos.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.DTOs;

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? Category { get; set; }
    public string? Brand { get; set; }
    public int StockQuantity { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateProductDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;
    
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal Price { get; set; }
    
    [StringLength(100)]
    public string? Category { get; set; }
    
    [StringLength(50)]
    public string? Brand { get; set; }
    
    [Required]
    [Range(0, int.MaxValue)]
    public int StockQuantity { get; set; }
    
    [StringLength(500)]
    public string? ImageUrl { get; set; }
}

public class UpdateProductDto
{
    [StringLength(200)]
    public string? Name { get; set; }
    
    [StringLength(1000)]
    public string? Description { get; set; }
    
    [Range(0.01, double.MaxValue)]
    public decimal? Price { get; set; }
    
    [StringLength(100)]
    public string? Category { get; set; }
    
    [StringLength(50)]
    public string? Brand { get; set; }
    
    [Range(0, int.MaxValue)]
    public int? StockQuantity { get; set; }
    
    [StringLength(500)]
    public string? ImageUrl { get; set; }
    
    public bool? IsActive { get; set; }
}

public class ProductSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? Category { get; set; }
    public int StockQuantity { get; set; }
    public bool IsActive { get; set; }
}`,

    // DTOs/OrderDtos.cs
    'DTOs/OrderDtos.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.DTOs;

public class OrderDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ShippingAddress { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation DTOs
    public UserDto? User { get; set; }
    public List<OrderItemDto> OrderItems { get; set; } = new();
}

public class CreateOrderDto
{
    [Required]
    public int UserId { get; set; }
    
    [StringLength(500)]
    public string? ShippingAddress { get; set; }
    
    [StringLength(500)]
    public string? Notes { get; set; }
    
    [Required]
    public List<CreateOrderItemDto> OrderItems { get; set; } = new();
}

public class UpdateOrderDto
{
    [StringLength(50)]
    public string? Status { get; set; }
    
    [StringLength(500)]
    public string? ShippingAddress { get; set; }
    
    [StringLength(500)]
    public string? Notes { get; set; }
}

public class OrderItemDto
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TotalPrice { get; set; }
    
    // Navigation DTO
    public ProductDto? Product { get; set; }
}

public class CreateOrderItemDto
{
    [Required]
    public int ProductId { get; set; }
    
    [Required]
    [Range(1, int.MaxValue)]
    public int Quantity { get; set; }
}

public class OrderSummaryDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int ItemCount { get; set; }
    public string CustomerName { get; set; } = string.Empty;
}`,

    // Profiles/UserProfile.cs
    'Profiles/UserProfile.cs': `using AutoMapper;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Profiles;

/// <summary>
/// AutoMapper profile for User entity mappings
/// </summary>
public class UserProfile : Profile
{
    public UserProfile()
    {
        // User -> UserDto (basic mapping)
        CreateMap<User, UserDto>();
        
        // CreateUserDto -> User (creation mapping)
        CreateMap<CreateUserDto, User>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore()) // Will be set separately
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Orders, opt => opt.Ignore());
        
        // UpdateUserDto -> User (update mapping)
        CreateMap<UpdateUserDto, User>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.Orders, opt => opt.Ignore())
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));
        
        // User -> UserSummaryDto (summary mapping with calculated fields)
        CreateMap<User, UserSummaryDto>()
            .ForMember(dest => dest.TotalOrders, opt => opt.MapFrom(src => src.Orders.Count))
            .ForMember(dest => dest.TotalSpent, opt => opt.MapFrom(src => src.Orders.Sum(o => o.TotalAmount)));
    }
}`,

    // Profiles/ProductProfile.cs
    'Profiles/ProductProfile.cs': `using AutoMapper;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Profiles;

/// <summary>
/// AutoMapper profile for Product entity mappings
/// </summary>
public class ProductProfile : Profile
{
    public ProductProfile()
    {
        // Product -> ProductDto (basic mapping)
        CreateMap<Product, ProductDto>();
        
        // CreateProductDto -> Product (creation mapping)
        CreateMap<CreateProductDto, Product>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.OrderItems, opt => opt.Ignore());
        
        // UpdateProductDto -> Product (update mapping)
        CreateMap<UpdateProductDto, Product>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.OrderItems, opt => opt.Ignore())
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));
        
        // Product -> ProductSummaryDto (summary mapping)
        CreateMap<Product, ProductSummaryDto>();
    }
}`,

    // Profiles/OrderProfile.cs
    'Profiles/OrderProfile.cs': `using AutoMapper;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Profiles;

/// <summary>
/// AutoMapper profile for Order entity mappings
/// </summary>
public class OrderProfile : Profile
{
    public OrderProfile()
    {
        // Order -> OrderDto (basic mapping with navigation properties)
        CreateMap<Order, OrderDto>();
        
        // CreateOrderDto -> Order (creation mapping)
        CreateMap<CreateOrderDto, Order>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OrderNumber, opt => opt.MapFrom(src => GenerateOrderNumber()))
            .ForMember(dest => dest.TotalAmount, opt => opt.Ignore()) // Will be calculated
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => "Pending"))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.OrderItems, opt => opt.Ignore()); // Will be mapped separately
        
        // UpdateOrderDto -> Order (update mapping)
        CreateMap<UpdateOrderDto, Order>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.UserId, opt => opt.Ignore())
            .ForMember(dest => dest.OrderNumber, opt => opt.Ignore())
            .ForMember(dest => dest.TotalAmount, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.User, opt => opt.Ignore())
            .ForMember(dest => dest.OrderItems, opt => opt.Ignore())
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));
        
        // OrderItem -> OrderItemDto (basic mapping)
        CreateMap<OrderItem, OrderItemDto>();
        
        // CreateOrderItemDto -> OrderItem (creation mapping)
        CreateMap<CreateOrderItemDto, OrderItem>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OrderId, opt => opt.Ignore())
            .ForMember(dest => dest.UnitPrice, opt => opt.Ignore()) // Will be set from product
            .ForMember(dest => dest.TotalPrice, opt => opt.Ignore()) // Will be calculated
            .ForMember(dest => dest.Order, opt => opt.Ignore())
            .ForMember(dest => dest.Product, opt => opt.Ignore());
        
        // Order -> OrderSummaryDto (summary mapping with calculated fields)
        CreateMap<Order, OrderSummaryDto>()
            .ForMember(dest => dest.ItemCount, opt => opt.MapFrom(src => src.OrderItems.Sum(oi => oi.Quantity)))
            .ForMember(dest => dest.CustomerName, opt => opt.MapFrom(src => src.User.Name));
    }
    
    /// <summary>
    /// Generates a unique order number
    /// </summary>
    private static string GenerateOrderNumber()
    {
        return $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..8].ToUpper()}";
    }
}`,

    // Validators/CreateUserDtoValidator.cs
    'Validators/CreateUserDtoValidator.cs': `using FluentValidation;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Validators;

public class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .Length(2, 100)
            .WithMessage("Name must be between 2 and 100 characters");
            
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(255)
            .WithMessage("Valid email address is required");
            
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(6)
            .MaximumLength(100)
            .Matches(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*d)")
            .WithMessage("Password must contain at least one lowercase letter, one uppercase letter, and one digit");
            
        RuleFor(x => x.PhoneNumber)
            .MaximumLength(20)
            .When(x => !string.IsNullOrEmpty(x.PhoneNumber));
            
        RuleFor(x => x.DateOfBirth)
            .LessThan(DateTime.Now.AddYears(-13))
            .WithMessage("User must be at least 13 years old");
            
        RuleFor(x => x.Address)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.Address));
            
        RuleFor(x => x.City)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.City));
            
        RuleFor(x => x.Country)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.Country));
    }
}`,

    // Validators/CreateProductDtoValidator.cs
    'Validators/CreateProductDtoValidator.cs': `using FluentValidation;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Validators;

public class CreateProductDtoValidator : AbstractValidator<CreateProductDto>
{
    public CreateProductDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .Length(2, 200)
            .WithMessage("Product name must be between 2 and 200 characters");
            
        RuleFor(x => x.Description)
            .MaximumLength(1000)
            .When(x => !string.IsNullOrEmpty(x.Description));
            
        RuleFor(x => x.Price)
            .GreaterThan(0)
            .WithMessage("Price must be greater than 0");
            
        RuleFor(x => x.Category)
            .MaximumLength(100)
            .When(x => !string.IsNullOrEmpty(x.Category));
            
        RuleFor(x => x.Brand)
            .MaximumLength(50)
            .When(x => !string.IsNullOrEmpty(x.Brand));
            
        RuleFor(x => x.StockQuantity)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Stock quantity cannot be negative");
            
        RuleFor(x => x.ImageUrl)
            .MaximumLength(500)
            .Must(BeAValidUrl)
            .WithMessage("ImageUrl must be a valid URL")
            .When(x => !string.IsNullOrEmpty(x.ImageUrl));
    }
    
    private static bool BeAValidUrl(string? url)
    {
        if (string.IsNullOrEmpty(url))
            return true;
            
        return Uri.TryCreate(url, UriKind.Absolute, out var result) 
               && (result.Scheme == Uri.UriSchemeHttp || result.Scheme == Uri.UriSchemeHttps);
    }
}`,

    // Validators/CreateOrderDtoValidator.cs
    'Validators/CreateOrderDtoValidator.cs': `using FluentValidation;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Validators;

public class CreateOrderDtoValidator : AbstractValidator<CreateOrderDto>
{
    public CreateOrderDtoValidator()
    {
        RuleFor(x => x.UserId)
            .GreaterThan(0)
            .WithMessage("Valid User ID is required");
            
        RuleFor(x => x.ShippingAddress)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.ShippingAddress));
            
        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .When(x => !string.IsNullOrEmpty(x.Notes));
            
        RuleFor(x => x.OrderItems)
            .NotEmpty()
            .WithMessage("Order must contain at least one item");
            
        RuleForEach(x => x.OrderItems)
            .SetValidator(new CreateOrderItemDtoValidator());
    }
}

public class CreateOrderItemDtoValidator : AbstractValidator<CreateOrderItemDto>
{
    public CreateOrderItemDtoValidator()
    {
        RuleFor(x => x.ProductId)
            .GreaterThan(0)
            .WithMessage("Valid Product ID is required");
            
        RuleFor(x => x.Quantity)
            .GreaterThan(0)
            .WithMessage("Quantity must be greater than 0");
    }
}`,

    // Data/ApplicationDbContext.cs
    'Data/ApplicationDbContext.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.PasswordHash).IsRequired();
        });

        // Product configuration
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
        });

        // Order configuration
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.OrderNumber).IsUnique();
            entity.Property(e => e.OrderNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Orders)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // OrderItem configuration
        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalPrice).HasColumnType("decimal(18,2)");
            
            entity.HasOne(e => e.Order)
                  .WithMany(o => o.OrderItems)
                  .HasForeignKey(e => e.OrderId)
                  .OnDelete(DeleteBehavior.Cascade);
                  
            entity.HasOne(e => e.Product)
                  .WithMany(p => p.OrderItems)
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Seed data
        SeedData(modelBuilder);
    }

    private static void SeedData(ModelBuilder modelBuilder)
    {
        // Seed Products
        modelBuilder.Entity<Product>().HasData(
            new Product
            {
                Id = 1,
                Name = "Laptop Pro 15",
                Description = "High-performance laptop for professionals",
                Price = 1299.99m,
                Category = "Electronics",
                Brand = "TechCorp",
                StockQuantity = 50,
                ImageUrl = "https://example.com/laptop.jpg",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Product
            {
                Id = 2,
                Name = "Wireless Mouse",
                Description = "Ergonomic wireless mouse with precision tracking",
                Price = 49.99m,
                Category = "Electronics",
                Brand = "TechCorp",
                StockQuantity = 200,
                ImageUrl = "https://example.com/mouse.jpg",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new Product
            {
                Id = 3,
                Name = "Office Chair",
                Description = "Comfortable ergonomic office chair",
                Price = 299.99m,
                Category = "Furniture",
                Brand = "ComfortPlus",
                StockQuantity = 30,
                ImageUrl = "https://example.com/chair.jpg",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}`,

    // Services/IUserService.cs
    'Services/IUserService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IUserService
{
    Task<UserDto?> GetByIdAsync(int id);
    Task<UserDto?> GetByEmailAsync(string email);
    Task<IEnumerable<UserDto>> GetAllAsync();
    Task<IEnumerable<UserSummaryDto>> GetSummariesAsync();
    Task<UserDto> CreateAsync(CreateUserDto createUserDto);
    Task<UserDto?> UpdateAsync(int id, UpdateUserDto updateUserDto);
    Task<bool> DeleteAsync(int id);
    Task<bool> ExistsAsync(int id);
    Task<bool> EmailExistsAsync(string email);
}`,

    // Services/UserService.cs
    'Services/UserService.cs': `using Microsoft.EntityFrameworkCore;
using AutoMapper;
using {{serviceName}}.Data;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;
using BCrypt.Net;

namespace {{serviceName}}.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<UserService> _logger;

    public UserService(ApplicationDbContext context, IMapper mapper, ILogger<UserService> logger)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<UserDto?> GetByIdAsync(int id)
    {
        _logger.LogInformation("Getting user by ID: {UserId}", id);
        
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id);

        return user != null ? _mapper.Map<UserDto>(user) : null;
    }

    public async Task<UserDto?> GetByEmailAsync(string email)
    {
        _logger.LogInformation("Getting user by email: {Email}", email);
        
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email);

        return user != null ? _mapper.Map<UserDto>(user) : null;
    }

    public async Task<IEnumerable<UserDto>> GetAllAsync()
    {
        _logger.LogInformation("Getting all users");
        
        var users = await _context.Users
            .AsNoTracking()
            .OrderBy(u => u.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<UserDto>>(users);
    }

    public async Task<IEnumerable<UserSummaryDto>> GetSummariesAsync()
    {
        _logger.LogInformation("Getting user summaries");
        
        var users = await _context.Users
            .Include(u => u.Orders)
            .AsNoTracking()
            .OrderBy(u => u.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<UserSummaryDto>>(users);
    }

    public async Task<UserDto> CreateAsync(CreateUserDto createUserDto)
    {
        _logger.LogInformation("Creating new user with email: {Email}", createUserDto.Email);
        
        // Check if email already exists
        if (await EmailExistsAsync(createUserDto.Email))
        {
            throw new InvalidOperationException($"User with email {createUserDto.Email} already exists");
        }

        var user = _mapper.Map<User>(createUserDto);
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(createUserDto.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        _logger.LogInformation("User created successfully with ID: {UserId}", user.Id);
        
        return _mapper.Map<UserDto>(user);
    }

    public async Task<UserDto?> UpdateAsync(int id, UpdateUserDto updateUserDto)
    {
        _logger.LogInformation("Updating user with ID: {UserId}", id);
        
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            _logger.LogWarning("User not found with ID: {UserId}", id);
            return null;
        }

        // Check if email is being updated and already exists
        if (!string.IsNullOrEmpty(updateUserDto.Email) && 
            updateUserDto.Email != user.Email && 
            await EmailExistsAsync(updateUserDto.Email))
        {
            throw new InvalidOperationException($"User with email {updateUserDto.Email} already exists");
        }

        _mapper.Map(updateUserDto, user);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("User updated successfully with ID: {UserId}", id);
        
        return _mapper.Map<UserDto>(user);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        _logger.LogInformation("Deleting user with ID: {UserId}", id);
        
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            _logger.LogWarning("User not found with ID: {UserId}", id);
            return false;
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        _logger.LogInformation("User deleted successfully with ID: {UserId}", id);
        
        return true;
    }

    public async Task<bool> ExistsAsync(int id)
    {
        return await _context.Users.AnyAsync(u => u.Id == id);
    }

    public async Task<bool> EmailExistsAsync(string email)
    {
        return await _context.Users.AnyAsync(u => u.Email == email);
    }
}`,

    // Services/IProductService.cs
    'Services/IProductService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IProductService
{
    Task<ProductDto?> GetByIdAsync(int id);
    Task<IEnumerable<ProductDto>> GetAllAsync();
    Task<IEnumerable<ProductSummaryDto>> GetSummariesAsync();
    Task<IEnumerable<ProductDto>> GetByCategoryAsync(string category);
    Task<ProductDto> CreateAsync(CreateProductDto createProductDto);
    Task<ProductDto?> UpdateAsync(int id, UpdateProductDto updateProductDto);
    Task<bool> DeleteAsync(int id);
    Task<bool> ExistsAsync(int id);
}`,

    // Services/ProductService.cs
    'Services/ProductService.cs': `using Microsoft.EntityFrameworkCore;
using AutoMapper;
using {{serviceName}}.Data;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public class ProductService : IProductService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<ProductService> _logger;

    public ProductService(ApplicationDbContext context, IMapper mapper, ILogger<ProductService> logger)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ProductDto?> GetByIdAsync(int id)
    {
        _logger.LogInformation("Getting product by ID: {ProductId}", id);
        
        var product = await _context.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        return product != null ? _mapper.Map<ProductDto>(product) : null;
    }

    public async Task<IEnumerable<ProductDto>> GetAllAsync()
    {
        _logger.LogInformation("Getting all products");
        
        var products = await _context.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<IEnumerable<ProductSummaryDto>> GetSummariesAsync()
    {
        _logger.LogInformation("Getting product summaries");
        
        var products = await _context.Products
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<ProductSummaryDto>>(products);
    }

    public async Task<IEnumerable<ProductDto>> GetByCategoryAsync(string category)
    {
        _logger.LogInformation("Getting products by category: {Category}", category);
        
        var products = await _context.Products
            .AsNoTracking()
            .Where(p => p.Category == category)
            .OrderBy(p => p.Name)
            .ToListAsync();

        return _mapper.Map<IEnumerable<ProductDto>>(products);
    }

    public async Task<ProductDto> CreateAsync(CreateProductDto createProductDto)
    {
        _logger.LogInformation("Creating new product: {ProductName}", createProductDto.Name);
        
        var product = _mapper.Map<Product>(createProductDto);

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Product created successfully with ID: {ProductId}", product.Id);
        
        return _mapper.Map<ProductDto>(product);
    }

    public async Task<ProductDto?> UpdateAsync(int id, UpdateProductDto updateProductDto)
    {
        _logger.LogInformation("Updating product with ID: {ProductId}", id);
        
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            _logger.LogWarning("Product not found with ID: {ProductId}", id);
            return null;
        }

        _mapper.Map(updateProductDto, product);
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Product updated successfully with ID: {ProductId}", id);
        
        return _mapper.Map<ProductDto>(product);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        _logger.LogInformation("Deleting product with ID: {ProductId}", id);
        
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            _logger.LogWarning("Product not found with ID: {ProductId}", id);
            return false;
        }

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Product deleted successfully with ID: {ProductId}", id);
        
        return true;
    }

    public async Task<bool> ExistsAsync(int id)
    {
        return await _context.Products.AnyAsync(p => p.Id == id);
    }
}`,

    // Services/IOrderService.cs
    'Services/IOrderService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IOrderService
{
    Task<OrderDto?> GetByIdAsync(int id);
    Task<IEnumerable<OrderDto>> GetAllAsync();
    Task<IEnumerable<OrderSummaryDto>> GetSummariesAsync();
    Task<IEnumerable<OrderDto>> GetByUserIdAsync(int userId);
    Task<OrderDto> CreateAsync(CreateOrderDto createOrderDto);
    Task<OrderDto?> UpdateAsync(int id, UpdateOrderDto updateOrderDto);
    Task<bool> DeleteAsync(int id);
    Task<bool> ExistsAsync(int id);
}`,

    // Services/OrderService.cs
    'Services/OrderService.cs': `using Microsoft.EntityFrameworkCore;
using AutoMapper;
using {{serviceName}}.Data;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public class OrderService : IOrderService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<OrderService> _logger;

    public OrderService(ApplicationDbContext context, IMapper mapper, ILogger<OrderService> logger)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<OrderDto?> GetByIdAsync(int id)
    {
        _logger.LogInformation("Getting order by ID: {OrderId}", id);
        
        var order = await _context.Orders
            .Include(o => o.User)
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == id);

        return order != null ? _mapper.Map<OrderDto>(order) : null;
    }

    public async Task<IEnumerable<OrderDto>> GetAllAsync()
    {
        _logger.LogInformation("Getting all orders");
        
        var orders = await _context.Orders
            .Include(o => o.User)
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .AsNoTracking()
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return _mapper.Map<IEnumerable<OrderDto>>(orders);
    }

    public async Task<IEnumerable<OrderSummaryDto>> GetSummariesAsync()
    {
        _logger.LogInformation("Getting order summaries");
        
        var orders = await _context.Orders
            .Include(o => o.User)
            .Include(o => o.OrderItems)
            .AsNoTracking()
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return _mapper.Map<IEnumerable<OrderSummaryDto>>(orders);
    }

    public async Task<IEnumerable<OrderDto>> GetByUserIdAsync(int userId)
    {
        _logger.LogInformation("Getting orders by user ID: {UserId}", userId);
        
        var orders = await _context.Orders
            .Include(o => o.User)
            .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
            .AsNoTracking()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return _mapper.Map<IEnumerable<OrderDto>>(orders);
    }

    public async Task<OrderDto> CreateAsync(CreateOrderDto createOrderDto)
    {
        _logger.LogInformation("Creating new order for user ID: {UserId}", createOrderDto.UserId);
        
        using var transaction = await _context.Database.BeginTransactionAsync();
        
        try
        {
            // Validate user exists
            var userExists = await _context.Users.AnyAsync(u => u.Id == createOrderDto.UserId);
            if (!userExists)
            {
                throw new InvalidOperationException($"User with ID {createOrderDto.UserId} does not exist");
            }

            // Create the order
            var order = _mapper.Map<Order>(createOrderDto);
            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            // Create order items
            decimal totalAmount = 0;
            foreach (var createOrderItemDto in createOrderDto.OrderItems)
            {
                var product = await _context.Products.FindAsync(createOrderItemDto.ProductId);
                if (product == null)
                {
                    throw new InvalidOperationException($"Product with ID {createOrderItemDto.ProductId} does not exist");
                }

                if (product.StockQuantity < createOrderItemDto.Quantity)
                {
                    throw new InvalidOperationException($"Insufficient stock for product {product.Name}. Available: {product.StockQuantity}, Requested: {createOrderItemDto.Quantity}");
                }

                var orderItem = _mapper.Map<OrderItem>(createOrderItemDto);
                orderItem.OrderId = order.Id;
                orderItem.UnitPrice = product.Price;
                orderItem.TotalPrice = product.Price * createOrderItemDto.Quantity;
                
                _context.OrderItems.Add(orderItem);
                
                // Update product stock
                product.StockQuantity -= createOrderItemDto.Quantity;
                product.UpdatedAt = DateTime.UtcNow;
                
                totalAmount += orderItem.TotalPrice;
            }

            // Update order total
            order.TotalAmount = totalAmount;
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            _logger.LogInformation("Order created successfully with ID: {OrderId}", order.Id);
            
            // Return the complete order with related data
            return await GetByIdAsync(order.Id) ?? throw new InvalidOperationException("Failed to retrieve created order");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OrderDto?> UpdateAsync(int id, UpdateOrderDto updateOrderDto)
    {
        _logger.LogInformation("Updating order with ID: {OrderId}", id);
        
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            _logger.LogWarning("Order not found with ID: {OrderId}", id);
            return null;
        }

        _mapper.Map(updateOrderDto, order);
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Order updated successfully with ID: {OrderId}", id);
        
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        _logger.LogInformation("Deleting order with ID: {OrderId}", id);
        
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            _logger.LogWarning("Order not found with ID: {OrderId}", id);
            return false;
        }

        _context.Orders.Remove(order);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Order deleted successfully with ID: {OrderId}", id);
        
        return true;
    }

    public async Task<bool> ExistsAsync(int id)
    {
        return await _context.Orders.AnyAsync(o => o.Id == id);
    }
}`,

    // Services/IAuthService.cs
    'Services/IAuthService.cs': `namespace {{serviceName}}.Services;

public interface IAuthService
{
    Task<string> AuthenticateAsync(string email, string password);
    Task<bool> ValidateTokenAsync(string token);
}`,

    // Services/AuthService.cs
    'Services/AuthService.cs': `using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using {{serviceName}}.Data;
using BCrypt.Net;

namespace {{serviceName}}.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(ApplicationDbContext context, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string> AuthenticateAsync(string email, string password)
    {
        _logger.LogInformation("Authenticating user with email: {Email}", email);
        
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email && u.IsActive);

        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            _logger.LogWarning("Authentication failed for email: {Email}", email);
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        var token = GenerateJwtToken(user.Id, user.Email, user.Name);
        
        _logger.LogInformation("User authenticated successfully: {Email}", email);
        
        return token;
    }

    public async Task<bool> ValidateTokenAsync(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecretKey"]!);
            
            tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _configuration["JwtSettings:Issuer"],
                ValidateAudience = true,
                ValidAudience = _configuration["JwtSettings:Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out SecurityToken validatedToken);

            return true;
        }
        catch
        {
            return false;
        }
    }

    private string GenerateJwtToken(int userId, string email, string name)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecretKey"]!);
        
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Name, name)
            }),
            Expires = DateTime.UtcNow.AddDays(7),
            Issuer = _configuration["JwtSettings:Issuer"],
            Audience = _configuration["JwtSettings:Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}`,

    // Controllers/UsersController.cs
    'Controllers/UsersController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.Services;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Users management controller
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
    /// Get all users
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
    {
        try
        {
            var users = await _userService.GetAllAsync();
            return Ok(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting users");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get user summaries with order statistics
    /// </summary>
    [HttpGet("summaries")]
    public async Task<ActionResult<IEnumerable<UserSummaryDto>>> GetUserSummaries()
    {
        try
        {
            var summaries = await _userService.GetSummariesAsync();
            return Ok(summaries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting user summaries");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get user by ID
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while getting user {UserId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Create a new user
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto createUserDto)
    {
        try
        {
            var user = await _userService.CreateAsync(createUserDto);
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while creating user");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Update user
    /// </summary>
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
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while updating user {UserId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Delete user
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while deleting user {UserId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }
}`,

    // Controllers/ProductsController.cs
    'Controllers/ProductsController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.Services;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Products management controller
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
    /// Get all products
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ProductDto>>> GetProducts()
    {
        try
        {
            var products = await _productService.GetAllAsync();
            return Ok(products);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting products");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get product summaries
    /// </summary>
    [HttpGet("summaries")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ProductSummaryDto>>> GetProductSummaries()
    {
        try
        {
            var summaries = await _productService.GetSummariesAsync();
            return Ok(summaries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting product summaries");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get products by category
    /// </summary>
    [HttpGet("category/{category}")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ProductDto>>> GetProductsByCategory(string category)
    {
        try
        {
            var products = await _productService.GetByCategoryAsync(category);
            return Ok(products);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting products by category {Category}", category);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get product by ID
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
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
            _logger.LogError(ex, "Error occurred while getting product {ProductId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Create a new product
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while creating product");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Update product
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while updating product {ProductId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Delete product
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while deleting product {ProductId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }
}`,

    // Controllers/OrdersController.cs
    'Controllers/OrdersController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.Services;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Orders management controller
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
    /// Get all orders
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<OrderDto>>> GetOrders()
    {
        try
        {
            var orders = await _orderService.GetAllAsync();
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting orders");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get order summaries
    /// </summary>
    [HttpGet("summaries")]
    public async Task<ActionResult<IEnumerable<OrderSummaryDto>>> GetOrderSummaries()
    {
        try
        {
            var summaries = await _orderService.GetSummariesAsync();
            return Ok(summaries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting order summaries");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get orders by user ID
    /// </summary>
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<IEnumerable<OrderDto>>> GetOrdersByUserId(int userId)
    {
        try
        {
            var orders = await _orderService.GetByUserIdAsync(userId);
            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while getting orders for user {UserId}", userId);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Get order by ID
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while getting order {OrderId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Create a new order
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while creating order");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Update order
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<OrderDto>> UpdateOrder(int id, [FromBody] UpdateOrderDto updateOrderDto)
    {
        try
        {
            var order = await _orderService.UpdateAsync(id, updateOrderDto);
            if (order == null)
            {
                return NotFound($"Order with ID {id} not found");
            }

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while updating order {OrderId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Delete order
    /// </summary>
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
            _logger.LogError(ex, "Error occurred while deleting order {OrderId}", id);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }
}`,

    // Controllers/AuthController.cs
    'Controllers/AuthController.cs': `using Microsoft.AspNetCore.Mvc;
using {{serviceName}}.Services;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Authentication controller
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
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult<object>> Login([FromBody] LoginDto loginDto)
    {
        try
        {
            var token = await _authService.AuthenticateAsync(loginDto.Email, loginDto.Password);
            return Ok(new { token, expiresAt = DateTime.UtcNow.AddDays(7) });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during login for email: {Email}", loginDto.Email);
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    /// <summary>
    /// Validate JWT token
    /// </summary>
    [HttpPost("validate")]
    public async Task<ActionResult<object>> ValidateToken([FromBody] ValidateTokenDto validateTokenDto)
    {
        try
        {
            var isValid = await _authService.ValidateTokenAsync(validateTokenDto.Token);
            return Ok(new { isValid });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during token validation");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }
}

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ValidateTokenDto
{
    public string Token { get; set; } = string.Empty;
}`,

    // appsettings.json
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true"
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
        "System": "Warning"
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
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}`,

    // appsettings.Development.json
    'appsettings.Development.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}DevDb;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Debug",
      "Override": {
        "Microsoft": "Information",
        "System": "Information"
      }
    }
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}`,

    // README.md
    'README.md': `# {{serviceName}} - ASP.NET Core with AutoMapper

Enterprise-grade .NET 8 Web API demonstrating comprehensive AutoMapper object-to-object mapping patterns.

## 🚀 Features

- **AutoMapper Integration**: Comprehensive mapping between entities and DTOs
- **Entity Framework Core**: Full ORM with SQL Server support
- **Advanced Mapping Patterns**: Custom mappings, conditional mappings, and calculated fields
- **JWT Authentication**: Secure token-based authentication
- **FluentValidation**: Comprehensive input validation
- **Structured Logging**: Serilog with multiple sinks
- **Swagger/OpenAPI**: Interactive API documentation
- **Enterprise Architecture**: Repository pattern, dependency injection

## 📋 Prerequisites

- .NET 8.0 SDK
- SQL Server or SQL Server LocalDB
- Visual Studio 2022 or VS Code

## 🛠 Setup

1. **Clone and navigate:**
   \`\`\`bash
   cd {{serviceName}}
   \`\`\`

2. **Install dependencies:**
   \`\`\`bash
   dotnet restore
   \`\`\`

3. **Update connection string in appsettings.json**

4. **Run the application:**
   \`\`\`bash
   dotnet run
   \`\`\`

5. **Access Swagger UI:**
   \`\`\`
   https://localhost:5001/swagger
   \`\`\`

## 🗺 AutoMapper Configurations

### User Mappings
- **User ↔ UserDto**: Basic property mapping
- **CreateUserDto → User**: Creation mapping with defaults
- **UpdateUserDto → User**: Partial update mapping with conditions
- **User → UserSummaryDto**: Calculated fields (TotalOrders, TotalSpent)

### Product Mappings
- **Product ↔ ProductDto**: Standard mappings
- **CreateProductDto → Product**: Creation with auto-generated fields
- **UpdateProductDto → Product**: Conditional updates for non-null properties

### Order Mappings
- **Order ↔ OrderDto**: Complex mapping with navigation properties
- **CreateOrderDto → Order**: Order number generation
- **Order → OrderSummaryDto**: Aggregate calculations

## 🔧 AutoMapper Features Demonstrated

### Custom Value Resolvers
\`\`\`csharp
.ForMember(dest => dest.OrderNumber, opt => opt.MapFrom(src => GenerateOrderNumber()))
\`\`\`

### Conditional Mapping
\`\`\`csharp
.ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null))
\`\`\`

### Calculated Properties
\`\`\`csharp
.ForMember(dest => dest.TotalOrders, opt => opt.MapFrom(src => src.Orders.Count))
\`\`\`

### Ignored Properties
\`\`\`csharp
.ForMember(dest => dest.Id, opt => opt.Ignore())
\`\`\`

## 📊 API Endpoints

### Authentication
- **POST** \`/api/auth/login\` - User login
- **POST** \`/api/auth/validate\` - Token validation

### Users
- **GET** \`/api/users\` - Get all users
- **GET** \`/api/users/summaries\` - Get user summaries with order stats
- **GET** \`/api/users/{id}\` - Get user by ID
- **POST** \`/api/users\` - Create user
- **PUT** \`/api/users/{id}\` - Update user
- **DELETE** \`/api/users/{id}\` - Delete user

### Products
- **GET** \`/api/products\` - Get all products
- **GET** \`/api/products/summaries\` - Get product summaries
- **GET** \`/api/products/category/{category}\` - Get products by category
- **GET** \`/api/products/{id}\` - Get product by ID
- **POST** \`/api/products\` - Create product (requires auth)
- **PUT** \`/api/products/{id}\` - Update product (requires auth)
- **DELETE** \`/api/products/{id}\` - Delete product (requires auth)

### Orders
- **GET** \`/api/orders\` - Get all orders (requires auth)
- **GET** \`/api/orders/summaries\` - Get order summaries (requires auth)
- **GET** \`/api/orders/user/{userId}\` - Get orders by user (requires auth)
- **GET** \`/api/orders/{id}\` - Get order by ID (requires auth)
- **POST** \`/api/orders\` - Create order (requires auth)
- **PUT** \`/api/orders/{id}\` - Update order (requires auth)
- **DELETE** \`/api/orders/{id}\` - Delete order (requires auth)

## 🏗 Architecture

\`\`\`
{{serviceName}}/
├── Controllers/          # API controllers
├── Services/            # Business logic layer
├── Models/              # Entity models
├── DTOs/                # Data transfer objects
├── Profiles/            # AutoMapper profiles
├── Validators/          # FluentValidation validators
├── Data/                # Entity Framework context
└── Program.cs           # Application entry point
\`\`\`

## 🔒 Security Features

- JWT Bearer token authentication
- Password hashing with BCrypt
- Input validation with FluentValidation
- SQL injection protection via Entity Framework
- CORS configuration for cross-origin requests

## 📝 Configuration

### JWT Settings (appsettings.json)
\`\`\`json
{
  "JwtSettings": {
    "SecretKey": "your-256-bit-secret-key-here",
    "Issuer": "{{serviceName}}",
    "Audience": "{{serviceName}}Users",
    "ExpirationDays": 7
  }
}
\`\`\`

### Database Connection
\`\`\`json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true"
  }
}
\`\`\`

## 🧪 Testing the API

### Create a User
\`\`\`bash
curl -X POST "https://localhost:5001/api/users" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123",
    "dateOfBirth": "1990-01-01"
  }'
\`\`\`

### Login
\`\`\`bash
curl -X POST "https://localhost:5001/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
\`\`\`

### Create an Order (with token)
\`\`\`bash
curl -X POST "https://localhost:5001/api/orders" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "userId": 1,
    "shippingAddress": "123 Main St, City, State",
    "orderItems": [
      { "productId": 1, "quantity": 2 },
      { "productId": 2, "quantity": 1 }
    ]
  }'
\`\`\`

## 📚 AutoMapper Best Practices Demonstrated

1. **Profile Organization**: Separate profiles per entity type
2. **Convention-based Mapping**: Leverage AutoMapper conventions
3. **Custom Mappings**: Handle complex transformations
4. **Conditional Mapping**: Map only when conditions are met
5. **Calculated Properties**: Derive values from related entities
6. **Validation**: Combine with FluentValidation for robust DTOs

## 🔍 Logging

The application uses Serilog for structured logging:
- Console output for development
- File output with daily rolling
- Structured JSON logging
- Different log levels per environment

Log files are stored in the \`logs/\` directory.

## 🚀 Production Considerations

- Update JWT secret key
- Configure production database connection
- Set up proper CORS policies
- Configure log retention policies
- Implement rate limiting
- Add health checks
- Set up monitoring and alerting

## 📖 Learn More

- [AutoMapper Documentation](https://docs.automapper.org/)
- [Entity Framework Core](https://docs.microsoft.com/en-us/ef/core/)
- [ASP.NET Core](https://docs.microsoft.com/en-us/aspnet/core/)
- [FluentValidation](https://docs.fluentvalidation.net/)
- [Serilog](https://serilog.net/)

This template demonstrates enterprise-level AutoMapper usage patterns for building maintainable and scalable .NET applications.
`,

    // Dockerfile
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Base runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5000
EXPOSE 5001

# Stage 2: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["{{serviceName}}.csproj", "."]
RUN dotnet restore "./{{serviceName}}.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "{{serviceName}}.csproj" -c Release -o /app/build

# Stage 3: Publish
FROM build AS publish
RUN dotnet publish "{{serviceName}}.csproj" -c Release -o /app/publish /p:UseAppHost=false

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
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "{{serviceName}}.dll"]`,

    // docker-compose.yml
    'docker-compose.yml': `version: '3.8'

services:
  {{serviceName}}:
    build: .
    ports:
      - "5000:5000"
      - "5001:5001"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=https://+:5001;http://+:5000
      - ASPNETCORE_Kestrel__Certificates__Default__Password=password
      - ASPNETCORE_Kestrel__Certificates__Default__Path=/https/aspnetapp.pfx
    volumes:
      - ~/.aspnet/https:/https:ro
    depends_on:
      - sqlserver

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: "YourStrong@Passw0rd"
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql

volumes:
  sqlserver_data:`,

    // .gitignore
    '.gitignore': `## Ignore Visual Studio temporary files, build results, and
## files generated by popular Visual Studio add-ons.
##
## Get latest from https://github.com/github/gitignore/blob/master/VisualStudio.gitignore

# User-specific files
*.rsuser
*.suo
*.user
*.userosscache
*.sln.docstates

# User-specific files (MonoDevelop/Xamarin Studio)
*.userprefs

# Mono auto generated files
mono_crash.*

# Build results
[Dd]ebug/
[Dd]ebugPublic/
[Rr]elease/
[Rr]eleases/
x64/
x86/
[Ww][Ii][Nn]32/
[Aa][Rr][Mm]/
[Aa][Rr][Mm]64/
bld/
[Bb]in/
[Oo]bj/
[Ll]og/
[Ll]ogs/

# Visual Studio 2015/2017 cache/options directory
.vs/
# Uncomment if you have tasks that create the project's static files in wwwroot
#wwwroot/

# Visual Studio 2017 auto generated files
Generated\\ Files/

# MSTest test Results
[Tt]est[Rr]esult*/
[Bb]uild[Ll]og.*

# NUnit
*.VisualState.xml
TestResult.xml
nunit-*.xml

# Build Results of an ATL Project
[Dd]ebugPS/
[Rr]eleasePS/
dlldata.c

# Benchmark Results
BenchmarkDotNet.Artifacts/

# .NET Core
project.lock.json
project.fragment.lock.json
artifacts/

# ASP.NET Scaffolding
ScaffoldingReadMe.txt

# StyleCop
StyleCopReport.xml

# Files built by Visual Studio
*_i.c
*_p.c
*_h.h
*.ilk
*.meta
*.obj
*.iobj
*.pch
*.pdb
*.ipdb
*.pgc
*.pgd
*.rsp
*.sbr
*.tlb
*.tli
*.tlh
*.tmp
*.tmp_proj
*_wpftmp.csproj
*.log
*.vspscc
*.vssscc
.builds
*.pidb
*.svclog
*.scc

# Chutzpah Test files
_Chutzpah*

# Visual C++ cache files
ipch/
*.aps
*.ncb
*.opendb
*.opensdf
*.sdf
*.cachefile
*.VC.db
*.VC.VC.opendb

# Visual Studio profiler
*.psess
*.vsp
*.vspx
*.sap

# Visual Studio Trace Files
*.e2e

# TFS 2012 Local Workspace
$tf/

# Guidance Automation Toolkit
*.gpState

# ReSharper is a .NET coding add-in
_ReSharper*/
*.[Rr]e[Ss]harper
*.DotSettings.user

# TeamCity is a build add-in
_TeamCity*

# DotCover is a Code Coverage Tool
*.dotCover

# AxoCover is a Code Coverage Tool
.axoCover/*
!.axoCover/settings.json

# Coverlet is a free, cross platform Code Coverage Tool
coverage*.json
coverage*.xml
coverage*.info

# Visual Studio code coverage results
*.coverage
*.coveragexml

# NCrunch
_NCrunch_*
.*crunch*.local.xml
nCrunchTemp_*

# MightyMoose
*.mm.*
AutoTest.Net/

# Web workbench (sass)
.sass-cache/

# Installshield output folder
[Ee]xpress/

# DocProject is a documentation generator add-in
DocProject/buildhelp/
DocProject/Help/*.HxT
DocProject/Help/*.HxC
DocProject/Help/*.hhc
DocProject/Help/*.hhk
DocProject/Help/*.hhp
DocProject/Help/Html2
DocProject/Help/html

# Click-Once directory
publish/

# Publish Web Output
*.[Pp]ublish.xml
*.azurePubxml
# Note: Comment the next line if you want to checkin your web deploy settings,
# but database connection strings (with potential passwords) will be unencrypted
*.pubxml
*.publishproj

# Microsoft Azure Web App publish settings. Comment the next line if you want to
# checkin your Azure Web App publish settings, but sensitive information contained
# in these files may be disclosed.  Uncomment to allow.
# *.azurePubxml

# Microsoft Azure Build Output
csx/
*.build.csdef

# Microsoft Azure Emulator
ecf/
rcf/

# Windows Store app package directories and files
AppPackages/
BundleArtifacts/
Package.StoreAssociation.xml
_pkginfo.txt
*.appx
*.appxbundle
*.appxupload

# Visual Studio cache files
# files ending in .cache can be ignored
*.[Cc]ache
# but keep track of directories ending in .cache
!?*.[Cc]ache/

# Others
ClientBin/
~$*
*~
*.dbmdl
*.dbproj.schemaview
*.jfm
*.pfx
*.publishsettings
orleans.codegen.cs

# Including strong name files can present a security risk
# (https://github.com/github/gitignore/pull/2483#issue-259490424)
#*.snk

# Since there are multiple workflows, uncomment the next line to ignore bower_components
# (https://github.com/github/gitignore/pull/1529#issuecomment-104372622)
#bower_components/

# RIA/Silverlight projects
Generated_Code/

# Backup & report files from converting an old project file
# to a newer Visual Studio version. Backup files are not needed,
# because we have git ;-)
_UpgradeReport_Files/
Backup*/
UpgradeLog*.XML
UpgradeLog*.htm
CrystalReportsBackup*/

# SQL Server files
*.mdf
*.ldf
*.ndf

# Business Intelligence projects
*.rdl.data
*.bim.layout
*.bim_*.settings
*.rptproj.rsuser
*- [Bb]ackup.rdl
*- [Bb]ackup ([0-9]).rdl
*- [Bb]ackup ([0-9][0-9]).rdl

# Microsoft Fakes
FakesAssemblies/

# GhostDoc plugin setting file
*.GhostDoc.xml

# Node.js Tools for Visual Studio
.ntvs_analysis.dat
node_modules/

# Visual Studio 6 build log
*.plg

# Visual Studio 6 workspace options file
*.opt

# Visual Studio 6 auto-generated workspace file (contains which files were open etc.)
*.vbw

# Visual Studio LightSwitch build output
**/*.HTMLClient/GeneratedArtifacts
**/*.DesktopClient/GeneratedArtifacts
**/*.DesktopClient/ModelManifest.xml
**/*.Server/GeneratedArtifacts
**/*.Server/ModelManifest.xml
_Pvt_Extensions

# Paket dependency manager
.paket/paket.exe
paket-files/

# FAKE - F# Make
.fake/

# CodeRush personal settings
.cr/personal

# Python Tools for Visual Studio (PTVS)
__pycache__/
*.pyc

# Cake - Uncomment if you are using it
# tools/**
# !tools/packages.config

# Tabs Studio
*.tss

# Telerik's JustMock configuration file
*.jmconfig

# BizTalk build output
*.btp.cs
*.btm.cs
*.odx.cs
*.xsd.cs

# OpenCover UI analysis results
OpenCover/

# Azure Stream Analytics local run output
ASALocalRun/

# MSBuild Binary and Structured Log
*.binlog

# NVidia Nsight GPU debugger configuration file
*.nvuser

# MFractors (Xamarin productivity tool) working folder
.mfractor/

# Local History for Visual Studio
.localhistory/

# BeatPulse healthcheck temp database
healthchecksdb

# Backup folder for Package Reference Convert tool in Visual Studio 2017
MigrationBackup/

# Ionide (cross platform F# VS Code tools) working folder
.ionide/

# Fody - auto-generated XML schema
FodyWeavers.xsd

# Application specific
logs/
*.db
*.sqlite
*.sqlite3`
  }
};