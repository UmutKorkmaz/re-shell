import { BackendTemplate } from '../types';

export const aspnetHotReloadTemplate: BackendTemplate = {
  id: 'aspnet-hotreload',
  name: 'aspnet-hotreload',
  displayName: 'ASP.NET Core with Hot Reload',
  description: 'High-productivity .NET API with dotnet watch hot reload and live development features',
  language: 'csharp',
  framework: 'aspnet-hotreload',
  version: '1.0.0',
  tags: ['aspnet', 'hotreload', 'watch', 'development', 'productivity'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing'],
  
  files: {
    // Project file with hot reload packages
    '{{serviceName}}.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <!-- Hot Reload Configuration -->
    <UseAppHost>true</UseAppHost>
    <EnableDefaultContentItems>false</EnableDefaultContentItems>
    <DefaultItemExcludes>$(DefaultItemExcludes);wwwroot/**</DefaultItemExcludes>
  </PropertyGroup>

  <PropertyGroup Condition="'$(Configuration)' == 'Debug'">
    <DefineConstants>DEBUG;TRACE</DefineConstants>
    <DebugType>portable</DebugType>
    <Optimize>false</Optimize>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <WarningLevel>4</WarningLevel>
    <!-- Enable Hot Reload -->
    <UseHotReload>true</UseHotReload>
    <SupportedOSPlatformVersion>10.0</SupportedOSPlatformVersion>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <!-- Hot Reload Development Packages -->
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation" Version="8.0.0" Condition="'$(Configuration)' == 'Debug'" />
    <PackageReference Include="Microsoft.Extensions.Logging.Debug" Version="8.0.0" Condition="'$(Configuration)' == 'Debug'" />
    <PackageReference Include="Microsoft.VisualStudio.Web.CodeGeneration.Design" Version="8.0.0" Condition="'$(Configuration)' == 'Debug'" />
  </ItemGroup>

  <!-- Watch Configuration for Hot Reload -->
  <ItemGroup>
    <Watch Include="**/*.cs" />
    <Watch Include="**/*.cshtml" />
    <Watch Include="**/*.css" />
    <Watch Include="**/*.js" />
    <Watch Include="**/*.json" Exclude="bin/**/*;obj/**/*" />
    <Watch Include="**/*.yml" />
    <Watch Include="**/*.yaml" />
    <Watch Remove="bin/**/*" />
    <Watch Remove="obj/**/*" />
    <Watch Remove="logs/**/*" />
    <Watch Remove="**/*.tmp" />
  </ItemGroup>

  <!-- Content Files for Watch -->
  <ItemGroup>
    <Content Include="appsettings*.json">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </Content>
    <Content Include="wwwroot/**/*" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

</Project>`,

    // Program.cs with hot reload optimizations
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;
using {{serviceName}}.Profiles;
using {{serviceName}}.Validators;
using {{serviceName}}.Extensions;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using FluentValidation;
using Serilog;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog with Hot Reload optimizations
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers();

// Add Razor Runtime Compilation for development hot reload
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddRazorPages().AddRazorRuntimeCompilation();
    builder.Services.AddMvc().AddRazorRuntimeCompilation();
}

builder.Services.AddEndpointsApiExplorer();

// Configure Entity Framework with optimizations for development
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (builder.Environment.IsEnvironment("Testing"))
    {
        options.UseInMemoryDatabase("TestDb");
    }
    else
    {
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
        options.UseSqlServer(connectionString);
        
        // Enable sensitive data logging and detailed errors in development
        if (builder.Environment.IsDevelopment())
        {
            options.EnableSensitiveDataLogging();
            options.EnableDetailedErrors();
            options.LogTo(Console.WriteLine, LogLevel.Information);
        }
    }
});

// Configure AutoMapper
builder.Services.AddAutoMapper(typeof(UserProfile), typeof(ProductProfile));

// Configure FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserDtoValidator>();

// Configure Swagger/OpenAPI with hot reload support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "{{serviceName}} API", 
        Version = "v1",
        Description = "High-productivity API with dotnet watch hot reload",
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

// Configure CORS for development
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("Development", policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
    });
}

// Register application services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Add development services
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddScoped<IDevelopmentService, DevelopmentService>();
    builder.Services.AddScoped<IHotReloadService, HotReloadService>();
}

var app = builder.Build();

// Configure the HTTP request pipeline with hot reload optimizations
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "{{serviceName}} API v1");
        c.RoutePrefix = string.Empty; // Set Swagger UI at apps root
        c.DisplayRequestDuration();
        c.EnableDeepLinking();
        c.EnableFilter();
        c.ShowExtensions();
        c.EnableValidator();
    });
    
    // Enable CORS for development
    app.UseCors("Development");
    
    // Add development middleware
    app.UseMiddleware<HotReloadMiddleware>();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Add development endpoints
if (app.Environment.IsDevelopment())
{
    app.MapGet("/dev/info", () => new
    {
        Environment = app.Environment.EnvironmentName,
        ProcessId = Environment.ProcessId,
        MachineName = Environment.MachineName,
        WorkingSet = GC.GetTotalMemory(false),
        AssemblyVersion = typeof(Program).Assembly.GetName().Version?.ToString(),
        DotNetVersion = Environment.Version.ToString(),
        HotReloadEnabled = true
    }).WithTags("Development");
    
    app.MapGet("/dev/reload", (IHotReloadService hotReloadService) => 
    {
        return hotReloadService.TriggerReload();
    }).WithTags("Development");
}

// Ensure database is created (skip in testing environment)
if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();
}

app.Run();

// Make the implicit Program class public for testing
public partial class Program { }`,

    // Hot Reload Middleware
    'Middleware/HotReloadMiddleware.cs': `using System.Diagnostics;

namespace {{serviceName}}.Extensions;

public class HotReloadMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<HotReloadMiddleware> _logger;
    private readonly IWebHostEnvironment _environment;

    public HotReloadMiddleware(RequestDelegate next, ILogger<HotReloadMiddleware> logger, IWebHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (_environment.IsDevelopment())
        {
            var stopwatch = Stopwatch.StartNew();
            
            // Add hot reload headers
            context.Response.Headers.Add("X-Hot-Reload", "enabled");
            context.Response.Headers.Add("X-Process-Id", Environment.ProcessId.ToString());
            
            try
            {
                await _next(context);
            }
            finally
            {
                stopwatch.Stop();
                
                // Log request details for development
                _logger.LogInformation("Request {Method} {Path} completed in {ElapsedMs}ms", 
                    context.Request.Method, 
                    context.Request.Path, 
                    stopwatch.ElapsedMilliseconds);
            }
        }
        else
        {
            await _next(context);
        }
    }
}`,

    // Hot Reload Service
    'Services/IHotReloadService.cs': `namespace {{serviceName}}.Services;

public interface IHotReloadService
{
    Task<object> TriggerReload();
    Task<object> GetReloadStatus();
    Task<object> GetWatchedFiles();
    Task ClearCache();
}`,

    'Services/HotReloadService.cs': `using System.Reflection;

namespace {{serviceName}}.Services;

public class HotReloadService : IHotReloadService
{
    private readonly ILogger<HotReloadService> _logger;
    private readonly IWebHostEnvironment _environment;
    private static readonly Dictionary<string, DateTime> _fileTimestamps = new();

    public HotReloadService(ILogger<HotReloadService> logger, IWebHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    public Task<object> TriggerReload()
    {
        _logger.LogInformation("Hot reload triggered manually");
        
        return Task.FromResult<object>(new
        {
            Message = "Hot reload triggered",
            Timestamp = DateTime.UtcNow,
            ProcessId = Environment.ProcessId,
            Environment = _environment.EnvironmentName,
            AssemblyVersion = Assembly.GetExecutingAssembly().GetName().Version?.ToString()
        });
    }

    public Task<object> GetReloadStatus()
    {
        var status = new
        {
            HotReloadEnabled = _environment.IsDevelopment(),
            ProcessId = Environment.ProcessId,
            StartTime = Process.GetCurrentProcess().StartTime,
            Uptime = DateTime.UtcNow - Process.GetCurrentProcess().StartTime,
            WorkingSet = GC.GetTotalMemory(false),
            GCCount = GC.CollectionCount(0),
            Environment = _environment.EnvironmentName,
            ContentRoot = _environment.ContentRootPath,
            WebRoot = _environment.WebRootPath
        };

        return Task.FromResult<object>(status);
    }

    public Task<object> GetWatchedFiles()
    {
        var watchedExtensions = new[] { ".cs", ".cshtml", ".css", ".js", ".json", ".yml", ".yaml" };
        var watchedFiles = new List<object>();

        if (Directory.Exists(_environment.ContentRootPath))
        {
            foreach (var extension in watchedExtensions)
            {
                var files = Directory.GetFiles(_environment.ContentRootPath, $"*{extension}", SearchOption.AllDirectories)
                    .Where(f => !f.Contains("bin") && !f.Contains("obj") && !f.Contains("logs"))
                    .Take(50) // Limit to prevent overwhelming response
                    .Select(f => new
                    {
                        Path = Path.GetRelativePath(_environment.ContentRootPath, f),
                        LastModified = File.GetLastWriteTime(f),
                        Size = new FileInfo(f).Length
                    });

                watchedFiles.AddRange(files);
            }
        }

        return Task.FromResult<object>(new
        {
            WatchedExtensions = watchedExtensions,
            TotalFiles = watchedFiles.Count,
            Files = watchedFiles.OrderByDescending(f => ((dynamic)f).LastModified).Take(20)
        });
    }

    public Task ClearCache()
    {
        _fileTimestamps.Clear();
        GC.Collect();
        GC.WaitForPendingFinalizers();
        
        _logger.LogInformation("Cache cleared and garbage collection triggered");
        
        return Task.CompletedTask;
    }
}`,

    // Development Service
    'Services/IDevelopmentService.cs': `namespace {{serviceName}}.Services;

public interface IDevelopmentService
{
    Task<object> GetSystemInfo();
    Task<object> GetDatabaseInfo();
    Task<object> GetConfigurationInfo();
    Task<object> GetEndpointsInfo();
    Task<object> GetHealthCheck();
}`,

    'Services/DevelopmentService.cs': `using Microsoft.EntityFrameworkCore;
using System.Reflection;
using {{serviceName}}.Data;

namespace {{serviceName}}.Services;

public class DevelopmentService : IDevelopmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<DevelopmentService> _logger;

    public DevelopmentService(
        ApplicationDbContext context, 
        IConfiguration configuration, 
        IWebHostEnvironment environment, 
        ILogger<DevelopmentService> logger)
    {
        _context = context;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    public Task<object> GetSystemInfo()
    {
        var systemInfo = new
        {
            Environment = _environment.EnvironmentName,
            MachineName = Environment.MachineName,
            ProcessId = Environment.ProcessId,
            UserName = Environment.UserName,
            OSVersion = Environment.OSVersion.ToString(),
            DotNetVersion = Environment.Version.ToString(),
            ProcessorCount = Environment.ProcessorCount,
            WorkingSet = Environment.WorkingSet,
            SystemPageSize = Environment.SystemPageSize,
            TickCount = Environment.TickCount64,
            AssemblyVersion = Assembly.GetExecutingAssembly().GetName().Version?.ToString(),
            ContentRootPath = _environment.ContentRootPath,
            WebRootPath = _environment.WebRootPath
        };

        return Task.FromResult<object>(systemInfo);
    }

    public async Task<object> GetDatabaseInfo()
    {
        try
        {
            var canConnect = await _context.Database.CanConnectAsync();
            var connectionString = _context.Database.GetConnectionString();
            
            var dbInfo = new
            {
                CanConnect = canConnect,
                DatabaseProvider = _context.Database.ProviderName,
                ConnectionString = MaskConnectionString(connectionString),
                PendingMigrations = await _context.Database.GetPendingMigrationsAsync(),
                AppliedMigrations = await _context.Database.GetAppliedMigrationsAsync()
            };

            return dbInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting database info");
            return new { Error = ex.Message, CanConnect = false };
        }
    }

    public Task<object> GetConfigurationInfo()
    {
        var configInfo = new
        {
            Environment = _environment.EnvironmentName,
            ConfigurationSources = _configuration.AsEnumerable()
                .Where(kvp => !IsSecretKey(kvp.Key))
                .ToDictionary(kvp => kvp.Key, kvp => kvp.Value),
            EnvironmentVariables = Environment.GetEnvironmentVariables()
                .Cast<System.Collections.DictionaryEntry>()
                .Where(de => !IsSecretKey(de.Key?.ToString() ?? ""))
                .ToDictionary(de => de.Key?.ToString() ?? "", de => de.Value?.ToString() ?? "")
        };

        return Task.FromResult<object>(configInfo);
    }

    public Task<object> GetEndpointsInfo()
    {
        // This would typically use IEndpointDataSource to get all registered endpoints
        var endpointsInfo = new
        {
            Message = "Endpoint discovery requires additional setup",
            DevelopmentEndpoints = new[]
            {
                "/dev/info",
                "/dev/reload", 
                "/dev/system",
                "/dev/database",
                "/dev/config",
                "/dev/health",
                "/swagger"
            },
            ApiEndpoints = new[]
            {
                "/api/users",
                "/api/products",
                "/api/orders"
            }
        };

        return Task.FromResult<object>(endpointsInfo);
    }

    public async Task<object> GetHealthCheck()
    {
        var healthChecks = new List<object>();

        // Database Health
        try
        {
            var canConnect = await _context.Database.CanConnectAsync();
            healthChecks.Add(new { Service = "Database", Status = canConnect ? "Healthy" : "Unhealthy" });
        }
        catch (Exception ex)
        {
            healthChecks.Add(new { Service = "Database", Status = "Unhealthy", Error = ex.Message });
        }

        // Memory Health
        var workingSet = Environment.WorkingSet;
        var memoryStatus = workingSet < 500_000_000 ? "Healthy" : "Warning"; // 500MB threshold
        healthChecks.Add(new { Service = "Memory", Status = memoryStatus, WorkingSet = workingSet });

        // GC Health
        var gen0Collections = GC.CollectionCount(0);
        var gen1Collections = GC.CollectionCount(1);
        var gen2Collections = GC.CollectionCount(2);
        healthChecks.Add(new 
        { 
            Service = "GarbageCollector", 
            Status = "Healthy", 
            Gen0Collections = gen0Collections,
            Gen1Collections = gen1Collections,
            Gen2Collections = gen2Collections
        });

        return new
        {
            OverallStatus = healthChecks.All(hc => ((dynamic)hc).Status == "Healthy") ? "Healthy" : "Degraded",
            Timestamp = DateTime.UtcNow,
            Checks = healthChecks
        };
    }

    private static string? MaskConnectionString(string? connectionString)
    {
        if (string.IsNullOrEmpty(connectionString))
            return connectionString;

        // Mask password in connection string
        return System.Text.RegularExpressions.Regex.Replace(
            connectionString,
            @"(Password|Pwd)=([^;]*)",
            "$1=***",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    private static bool IsSecretKey(string key)
    {
        var secretKeywords = new[] { "password", "secret", "key", "token", "connectionstring" };
        return secretKeywords.Any(keyword => key.ToLowerInvariant().Contains(keyword));
    }
}`,

    // Enhanced Development Controller
    'Controllers/DevelopmentController.cs': `using Microsoft.AspNetCore.Mvc;
using {{serviceName}}.Services;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Development utilities and hot reload support
/// </summary>
[ApiController]
[Route("dev")]
public class DevelopmentController : ControllerBase
{
    private readonly IDevelopmentService _developmentService;
    private readonly IHotReloadService _hotReloadService;
    private readonly IWebHostEnvironment _environment;

    public DevelopmentController(
        IDevelopmentService developmentService, 
        IHotReloadService hotReloadService,
        IWebHostEnvironment environment)
    {
        _developmentService = developmentService;
        _hotReloadService = hotReloadService;
        _environment = environment;
    }

    /// <summary>
    /// Get system information
    /// </summary>
    [HttpGet("system")]
    public async Task<ActionResult<object>> GetSystemInfo()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var info = await _developmentService.GetSystemInfo();
        return Ok(info);
    }

    /// <summary>
    /// Get database information
    /// </summary>
    [HttpGet("database")]
    public async Task<ActionResult<object>> GetDatabaseInfo()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var info = await _developmentService.GetDatabaseInfo();
        return Ok(info);
    }

    /// <summary>
    /// Get configuration information
    /// </summary>
    [HttpGet("config")]
    public async Task<ActionResult<object>> GetConfigInfo()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var info = await _developmentService.GetConfigurationInfo();
        return Ok(info);
    }

    /// <summary>
    /// Get endpoints information
    /// </summary>
    [HttpGet("endpoints")]
    public async Task<ActionResult<object>> GetEndpointsInfo()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var info = await _developmentService.GetEndpointsInfo();
        return Ok(info);
    }

    /// <summary>
    /// Get health check information
    /// </summary>
    [HttpGet("health")]
    public async Task<ActionResult<object>> GetHealthCheck()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var health = await _developmentService.GetHealthCheck();
        return Ok(health);
    }

    /// <summary>
    /// Trigger hot reload
    /// </summary>
    [HttpPost("reload")]
    public async Task<ActionResult<object>> TriggerReload()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var result = await _hotReloadService.TriggerReload();
        return Ok(result);
    }

    /// <summary>
    /// Get hot reload status
    /// </summary>
    [HttpGet("reload/status")]
    public async Task<ActionResult<object>> GetReloadStatus()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var status = await _hotReloadService.GetReloadStatus();
        return Ok(status);
    }

    /// <summary>
    /// Get watched files information
    /// </summary>
    [HttpGet("watch")]
    public async Task<ActionResult<object>> GetWatchedFiles()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        var files = await _hotReloadService.GetWatchedFiles();
        return Ok(files);
    }

    /// <summary>
    /// Clear application cache
    /// </summary>
    [HttpPost("cache/clear")]
    public async Task<ActionResult> ClearCache()
    {
        if (!_environment.IsDevelopment())
            return NotFound();

        await _hotReloadService.ClearCache();
        return Ok(new { Message = "Cache cleared successfully" });
    }
}`,

    // Basic entities and services for the template
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

    // Basic service stubs
    'Services/IUserService.cs': `using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public interface IUserService
{
    Task<IEnumerable<UserDto>> GetAllAsync();
    Task<UserDto?> GetByIdAsync(int id);
}`,

    'Services/UserService.cs': `using Microsoft.EntityFrameworkCore;
using AutoMapper;
using {{serviceName}}.Data;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public UserService(ApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<IEnumerable<UserDto>> GetAllAsync()
    {
        var users = await _context.Users.AsNoTracking().ToListAsync();
        return _mapper.Map<IEnumerable<UserDto>>(users);
    }

    public async Task<UserDto?> GetByIdAsync(int id)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        return user != null ? _mapper.Map<UserDto>(user) : null;
    }
}`,

    // Stub services
    'Services/IProductService.cs': `namespace {{serviceName}}.Services;
public interface IProductService { }`,
    
    'Services/ProductService.cs': `namespace {{serviceName}}.Services;
public class ProductService : IProductService { }`,
    
    'Services/IOrderService.cs': `namespace {{serviceName}}.Services;
public interface IOrderService { }`,
    
    'Services/OrderService.cs': `namespace {{serviceName}}.Services;
public class OrderService : IOrderService { }`,
    
    'Services/IAuthService.cs': `namespace {{serviceName}}.Services;
public interface IAuthService { }`,
    
    'Services/AuthService.cs': `namespace {{serviceName}}.Services;
public class AuthService : IAuthService { }`,

    // DTOs
    'DTOs/UserDtos.cs': `namespace {{serviceName}}.DTOs;

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
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
}`,

    // AutoMapper Profiles
    'Profiles/UserProfile.cs': `using AutoMapper;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Profiles;

public class UserProfile : Profile
{
    public UserProfile()
    {
        CreateMap<User, UserDto>();
        CreateMap<CreateUserDto, User>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => true))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => DateTime.UtcNow))
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Orders, opt => opt.Ignore());
    }
}`,

    'Profiles/ProductProfile.cs': `using AutoMapper;

namespace {{serviceName}}.Profiles;

public class ProductProfile : Profile
{
    public ProductProfile()
    {
        // Add product mappings here
    }
}`,

    // Validator
    'Validators/CreateUserDtoValidator.cs': `using FluentValidation;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Validators;

public class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .Length(2, 100);
            
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(255);
            
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(6)
            .MaximumLength(100);
    }
}`,

    // Configuration files
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
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/log-.txt",
          "rollingInterval": "Day",
          "outputTemplate": "[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} {Level:u3}] {Message:lj} {NewLine}{Exception}"
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
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  }
}`,

    // Hot reload scripts
    'scripts/watch.ps1': `#!/usr/bin/env pwsh

# Hot Reload Development Script for Windows PowerShell
Write-Host "Starting {{serviceName}} with Hot Reload..." -ForegroundColor Green

# Set environment for development
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:DOTNET_USE_POLLING_FILE_WATCHER = "true"

# Start the application with hot reload
try {
    Write-Host "Running: dotnet watch run --non-interactive" -ForegroundColor Yellow
    dotnet watch run --non-interactive --project {{serviceName}}.csproj
}
catch {
    Write-Host "Error starting application: $_" -ForegroundColor Red
    exit 1
}`,

    'scripts/watch.sh': `#!/bin/bash

# Hot Reload Development Script for Unix/Linux/macOS
echo "Starting {{serviceName}} with Hot Reload..."

# Set environment for development
export ASPNETCORE_ENVIRONMENT=Development
export DOTNET_USE_POLLING_FILE_WATCHER=true

# Start the application with hot reload
echo "Running: dotnet watch run --non-interactive"
dotnet watch run --non-interactive --project {{serviceName}}.csproj`,

    'scripts/build-and-watch.ps1': `#!/usr/bin/env pwsh

# Build and Watch Script for Development
Write-Host "Building and starting {{serviceName}} with Hot Reload..." -ForegroundColor Green

# Clean previous build
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
dotnet clean

# Restore packages
Write-Host "Restoring packages..." -ForegroundColor Yellow
dotnet restore

# Build the project
Write-Host "Building project..." -ForegroundColor Yellow
$buildResult = dotnet build --no-restore
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Please fix compilation errors." -ForegroundColor Red
    exit 1
}

# Set environment for development
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:DOTNET_USE_POLLING_FILE_WATCHER = "true"

# Start with hot reload
Write-Host "Starting application with hot reload..." -ForegroundColor Green
dotnet watch run --non-interactive --no-build`,

    'scripts/build-and-watch.sh': `#!/bin/bash

# Build and Watch Script for Development
echo "Building and starting {{serviceName}} with Hot Reload..."

# Clean previous build
echo "Cleaning previous build..."
dotnet clean

# Restore packages
echo "Restoring packages..."
dotnet restore

# Build the project
echo "Building project..."
if ! dotnet build --no-restore; then
    echo "Build failed. Please fix compilation errors."
    exit 1
fi

# Set environment for development
export ASPNETCORE_ENVIRONMENT=Development
export DOTNET_USE_POLLING_FILE_WATCHER=true

# Start with hot reload
echo "Starting application with hot reload..."
dotnet watch run --non-interactive --no-build`,

    // README.md
    'README.md': `# {{serviceName}} - ASP.NET Core with Hot Reload

High-productivity .NET 8 Web API with comprehensive dotnet watch hot reload support and live development features.

## 🚀 Hot Reload Features

- **Automatic Code Reloading**: Instant application restart on C# file changes
- **Configuration Hot Reload**: Live updates for appsettings.json changes
- **Static File Watching**: CSS, JavaScript, and content file monitoring
- **Development Middleware**: Enhanced debugging and development utilities
- **Real-time Feedback**: Immediate reflection of code changes without manual restart
- **Smart File Watching**: Optimized file system monitoring with exclusions
- **Development Endpoints**: Built-in utilities for development and debugging

## 📋 Prerequisites

- .NET 8.0 SDK
- SQL Server or SQL Server LocalDB
- Modern terminal (Windows Terminal, macOS Terminal, or Linux terminal)

## 🛠 Quick Start

### Using Scripts (Recommended)

#### Windows PowerShell
\`\`\`powershell
# Simple hot reload
.\\scripts\\watch.ps1

# Or build and watch
.\\scripts\\build-and-watch.ps1
\`\`\`

#### Unix/Linux/macOS
\`\`\`bash
# Make scripts executable
chmod +x scripts/*.sh

# Simple hot reload
./scripts/watch.sh

# Or build and watch
./scripts/build-and-watch.sh
\`\`\`

### Manual Commands

#### Basic Hot Reload
\`\`\`bash
# Set environment
export ASPNETCORE_ENVIRONMENT=Development
export DOTNET_USE_POLLING_FILE_WATCHER=true

# Start with hot reload
dotnet watch run
\`\`\`

#### Advanced Hot Reload
\`\`\`bash
# With additional options
dotnet watch run --non-interactive --project {{serviceName}}.csproj

# With specific launch profile
dotnet watch run --launch-profile Development

# With verbose output
dotnet watch run --verbose
\`\`\`

## 🔥 Hot Reload Capabilities

### What Triggers Reload
- **C# source files** (.cs): Immediate application restart
- **Configuration files** (.json): Configuration refresh
- **Static files** (.css, .js): Content refresh
- **Razor views** (.cshtml): View compilation refresh
- **Project files** (.csproj): Full rebuild and restart

### What's Excluded from Watching
- Build output directories (bin/, obj/)
- Log files and temporary files
- Package cache and dependencies
- IDE configuration files

### File Types Monitored
\`\`\`
*.cs         - C# source files
*.cshtml     - Razor views  
*.css        - Stylesheets
*.js         - JavaScript files
*.json       - Configuration files
*.yml/*.yaml - YAML configuration
\`\`\`

## 🛠 Development Workflow

### 1. Start Development Server
\`\`\`bash
# Navigate to project directory
cd {{serviceName}}

# Start hot reload
dotnet watch run
\`\`\`

### 2. Make Code Changes
- Edit any C# file in your IDE
- Save the file
- Watch the terminal for reload notification
- Application automatically restarts with changes

### 3. View Changes
- Open browser to \`https://localhost:5001\`
- Navigate to Swagger UI for API testing
- Changes are immediately reflected

### 4. Development Endpoints
When running in Development mode, access these utilities:

\`\`\`
GET  /dev/info          - Application information
GET  /dev/system        - System information  
GET  /dev/database      - Database status
GET  /dev/config        - Configuration details
GET  /dev/endpoints     - Available endpoints
GET  /dev/health        - Health check status
POST /dev/reload        - Manual reload trigger
GET  /dev/reload/status - Hot reload status
GET  /dev/watch         - Watched files info
POST /dev/cache/clear   - Clear application cache
\`\`\`

## ⚡ Performance Optimizations

### Fast Rebuild Configuration
The project is optimized for fast rebuilds:

\`\`\`xml
<PropertyGroup Condition="'$(Configuration)' == 'Debug'">
  <UseHotReload>true</UseHotReload>
  <DebugType>portable</DebugType>
  <Optimize>false</Optimize>
</PropertyGroup>
\`\`\`

### Smart File Watching
\`\`\`xml
<ItemGroup>
  <Watch Include="**/*.cs" />
  <Watch Include="**/*.cshtml" />
  <Watch Include="**/*.css" />
  <Watch Include="**/*.js" />
  <Watch Include="**/*.json" Exclude="bin/**/*;obj/**/*" />
  <Watch Remove="bin/**/*" />
  <Watch Remove="obj/**/*" />
  <Watch Remove="logs/**/*" />
</ItemGroup>
\`\`\`

### Development Dependencies
Hot reload packages are only included in Debug builds:
\`\`\`xml
<PackageReference Include="Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation" 
                  Version="8.0.0" 
                  Condition="'$(Configuration)' == 'Debug'" />
\`\`\`

## 🐛 Troubleshooting

### Hot Reload Not Working

1. **Check .NET Version**
   \`\`\`bash
   dotnet --version  # Should be 8.0+
   \`\`\`

2. **Verify Environment**
   \`\`\`bash
   echo $ASPNETCORE_ENVIRONMENT  # Should be 'Development'
   \`\`\`

3. **Enable Polling (if needed)**
   \`\`\`bash
   export DOTNET_USE_POLLING_FILE_WATCHER=true
   \`\`\`

4. **Check File Permissions**
   \`\`\`bash
   # Ensure files are writable
   chmod 644 **/*.cs
   \`\`\`

### Common Issues

#### "Failed to restart the application"
- Check for compilation errors
- Verify all dependencies are restored
- Ensure no syntax errors in code

#### "File watcher reached the maximum number of files"
- Exclude more directories from watching
- Increase system file watcher limits

#### "Hot reload not detecting changes"
- Enable polling file watcher
- Check antivirus software interference
- Verify file system permissions

### Debug Hot Reload
\`\`\`bash
# Run with verbose output
dotnet watch run --verbose

# Check what files are being watched
dotnet watch run --list
\`\`\`

## 🔧 Configuration

### Environment Variables
\`\`\`bash
# Essential for hot reload
ASPNETCORE_ENVIRONMENT=Development

# Enable polling if file events don't work
DOTNET_USE_POLLING_FILE_WATCHER=true

# Customize polling interval (milliseconds)
DOTNET_POLLING_FILE_WATCHER_INTERVAL=1000

# Disable hot reload if needed
DOTNET_WATCH_RESTART_ON_RUDE_EDIT=false
\`\`\`

### Project Configuration
\`\`\`xml
<!-- Enable hot reload features -->
<UseHotReload>true</UseHotReload>

<!-- Enable runtime compilation for views -->
<MvcRazorCompileOnPublish>false</MvcRazorCompileOnPublish>

<!-- Exclude files from content -->
<EnableDefaultContentItems>false</EnableDefaultContentItems>
\`\`\`

## 🚀 Advanced Features

### Custom File Watchers
Add custom file types to watch:
\`\`\`xml
<ItemGroup>
  <Watch Include="**/*.sql" />
  <Watch Include="**/*.xml" />
  <Watch Include="data/**/*.json" />
</ItemGroup>
\`\`\`

### Hot Reload Middleware
The template includes custom middleware for development:
\`\`\`csharp
// Adds development headers and request timing
app.UseMiddleware<HotReloadMiddleware>();
\`\`\`

### Development Services
Built-in development utilities:
\`\`\`csharp
// System information
services.AddScoped<IDevelopmentService, DevelopmentService>();

// Hot reload management  
services.AddScoped<IHotReloadService, HotReloadService>();
\`\`\`

## 📊 Monitoring

### Real-time Information
Access development information:
\`\`\`bash
# Get application status
curl https://localhost:5001/dev/info

# Check hot reload status
curl https://localhost:5001/dev/reload/status

# View watched files
curl https://localhost:5001/dev/watch
\`\`\`

### Performance Tracking
Monitor rebuild performance:
- Application startup time
- File change detection speed
- Reload completion time
- Memory usage during development

## 📚 Learn More

- [.NET Hot Reload Documentation](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-watch)
- [ASP.NET Core Development](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/)
- [dotnet watch Command](https://docs.microsoft.com/en-us/dotnet/core/tools/dotnet-watch)
- [File Watching in .NET](https://docs.microsoft.com/en-us/dotnet/api/system.io.filesystemwatcher)

This template provides the ultimate development experience with instant feedback and comprehensive hot reload capabilities for maximum productivity.
`
  }
};