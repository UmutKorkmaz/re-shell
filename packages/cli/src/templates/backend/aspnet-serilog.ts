import { BackendTemplate } from '../types';

export const aspnetSerilogTemplate: BackendTemplate = {
  id: 'aspnet-serilog',
  name: 'aspnet-serilog',
  displayName: 'ASP.NET Core with Serilog Logging',
  description: 'Enterprise .NET API with comprehensive Serilog structured logging and multiple sinks',
  language: 'csharp',
  framework: 'aspnet-serilog',
  version: '1.0.0',
  tags: ['aspnet', 'serilog', 'logging', 'structured-logging', 'monitoring'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing'],
  
  files: {
    // Project file with Serilog packages
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
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <!-- Comprehensive Serilog Package Collection -->
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Extensions.Hosting" Version="8.0.0" />
    <PackageReference Include="Serilog.Extensions.Logging" Version="8.0.0" />
    <PackageReference Include="Serilog.Enrichers.Environment" Version="2.3.0" />
    <PackageReference Include="Serilog.Enrichers.Process" Version="2.0.2" />
    <PackageReference Include="Serilog.Enrichers.Thread" Version="3.1.0" />
    <PackageReference Include="Serilog.Enrichers.CorrelationId" Version="3.0.1" />
    <PackageReference Include="Serilog.Enrichers.ClientInfo" Version="2.0.3" />
    <!-- Serilog Sinks -->
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.RollingFile" Version="3.3.0" />
    <PackageReference Include="Serilog.Sinks.Seq" Version="6.0.0" />
    <PackageReference Include="Serilog.Sinks.EventLog" Version="3.1.0" />
    <PackageReference Include="Serilog.Sinks.Email" Version="4.1.0" />
    <PackageReference Include="Serilog.Sinks.MSSqlServer" Version="6.3.0" />
    <PackageReference Include="Serilog.Sinks.Elasticsearch" Version="9.0.3" />
    <PackageReference Include="Serilog.Sinks.ApplicationInsights" Version="4.0.0" />
    <!-- Formatting and Filtering -->
    <PackageReference Include="Serilog.Formatting.Compact" Version="2.0.0" />
    <PackageReference Include="Serilog.Formatting.Elasticsearch" Version="9.0.3" />
    <PackageReference Include="Serilog.Filters.Expressions" Version="2.1.0" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.3" />
  </ItemGroup>

</Project>`,

    // Program.cs with comprehensive Serilog configuration
    'Program.cs': `using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.Services;
using {{projectNamePascal}}.Models;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Profiles;
using {{projectNamePascal}}.Validators;
using {{projectNamePascal}}.Infrastructure.Logging;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using FluentValidation;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Formatting.Elasticsearch;
using Serilog.Filters.Expressions;
using Serilog.Filters;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

// Early Serilog configuration - bootstrap logger
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting up {{projectName}} application");

    var builder = WebApplication.CreateBuilder(args);

    // Configure comprehensive Serilog logging
    builder.Host.UseSerilog((context, services, configuration) =>
    {
        var env = context.HostingEnvironment;
        var config = context.Configuration;
        
        configuration
            .ReadFrom.Configuration(config)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .Enrich.WithEnvironmentName()
            .Enrich.WithMachineName()
            .Enrich.WithProcessId()
            .Enrich.WithProcessName()
            .Enrich.WithThreadId()
            .Enrich.WithCorrelationId()
            .Enrich.WithClientIp()
            .Enrich.WithEnvironmentUserName()
            .Enrich.WithProperty("Application", "{{projectName}}")
            .Enrich.WithProperty("Version", "1.0.0");

        // Console sink with different formatting per environment
        if (env.IsDevelopment())
        {
            configuration.WriteTo.Console(
                outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}");
        }
        else
        {
            configuration.WriteTo.Console(new CompactJsonFormatter());
        }

        // File sinks with rolling policies
        configuration
            .WriteTo.File(
                path: "logs/{{projectName}}.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
            .WriteTo.File(
                new CompactJsonFormatter(),
                path: "logs/{{projectName}}-.json",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7);

        // Error-only file sink
        configuration.WriteTo.Logger(lc => lc
            .Filter.ByIncludingOnly(Matching.FromSource("{{projectNamePascal}}.Controllers"))
            .WriteTo.File(
                path: "logs/errors-.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 30,
                restrictedToMinimumLevel: LogEventLevel.Error));

        // Performance logging sink
        configuration.WriteTo.Logger(lc => lc
            .Filter.ByIncludingOnly("@mt like '%Performance%'")
            .WriteTo.File(
                path: "logs/performance-.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} {Message:lj} {Properties:j}{NewLine}"));

        // Database sink for structured logging (if SQL Server is available)
        if (!env.IsEnvironment("Testing") && !string.IsNullOrEmpty(config.GetConnectionString("DefaultConnection")))
        {
            configuration.WriteTo.MSSqlServer(
                connectionString: config.GetConnectionString("DefaultConnection"),
                sinkOptions: new Serilog.Sinks.MSSqlServer.MSSqlServerSinkOptions
                {
                    TableName = "Logs",
                    SchemaName = "dbo",
                    AutoCreateSqlTable = true,
                    BatchPostingLimit = 1000,
                    BatchPeriod = TimeSpan.FromSeconds(10)
                },
                restrictedToMinimumLevel: LogEventLevel.Information);
        }

        // Seq sink (if Seq URL is configured)
        var seqUrl = config.GetValue<string>("Serilog:Seq:ServerUrl");
        if (!string.IsNullOrEmpty(seqUrl))
        {
            configuration.WriteTo.Seq(seqUrl, apiKey: config.GetValue<string>("Serilog:Seq:ApiKey"));
        }

        // Elasticsearch sink (if Elasticsearch URL is configured)
        var elasticsearchUrl = config.GetValue<string>("Serilog:Elasticsearch:NodeUris");
        if (!string.IsNullOrEmpty(elasticsearchUrl))
        {
            configuration.WriteTo.Elasticsearch(new Serilog.Sinks.Elasticsearch.ElasticsearchSinkOptions(new Uri(elasticsearchUrl))
            {
                IndexFormat = "{{projectName}}-logs-{0:yyyy.MM.dd}",
                AutoRegisterTemplate = true,
                AutoRegisterTemplateVersion = Serilog.Sinks.Elasticsearch.AutoRegisterTemplateVersion.ESv7,
                CustomFormatter = new ElasticsearchJsonFormatter(),
                FailureCallback = e => Console.WriteLine("Unable to submit event " + e.MessageTemplate),
                EmitEventFailure = Serilog.Sinks.Elasticsearch.EmitEventFailureHandling.WriteToSelfLog |
                                   Serilog.Sinks.Elasticsearch.EmitEventFailureHandling.WriteToFailureSink,
                FailureSink = new Serilog.Sinks.File.FileSink("logs/elasticsearch-failures-.txt", new CompactJsonFormatter(), null)
            });
        }

        // Application Insights sink (if configured)
        var appInsightsKey = config.GetValue<string>("ApplicationInsights:InstrumentationKey");
        if (!string.IsNullOrEmpty(appInsightsKey))
        {
            configuration.WriteTo.ApplicationInsights(appInsightsKey, TelemetryConverter.Traces);
        }

        // Email sink for critical errors
        var smtpServer = config.GetValue<string>("Serilog:Email:SmtpServer");
        if (!string.IsNullOrEmpty(smtpServer))
        {
            var emailUser = config.GetValue<string>("Serilog:Email:Username");
            var emailPassword = config.GetValue<string>("Serilog:Email:Password");
            var enableSsl = config.GetValue<bool>("Serilog:Email:EnableSsl", true);

            configuration.WriteTo.Email(
                new Serilog.Sinks.Email.EmailSinkOptions
                {
                    From = config.GetValue<string>("Serilog:Email:From") ?? "noreply@{{projectName}}.com",
                    To = new List<string> { config.GetValue<string>("Serilog:Email:To") ?? "admin@{{projectName}}.com" },
                    Subject = new Serilog.Formatting.Display.MessageTemplateTextFormatter("{{projectName}} Critical Error: {Message}"),
                    Host = smtpServer,
                    Port = config.GetValue<int>("Serilog:Email:Port", 587),
                    ConnectionSecurity = enableSsl
                        ? MailKit.Security.SecureSocketOptions.StartTls
                        : MailKit.Security.SecureSocketOptions.Auto,
                    Credentials = string.IsNullOrEmpty(emailUser)
                        ? null
                        : new System.Net.NetworkCredential(emailUser, emailPassword)
                },
                restrictedToMinimumLevel: LogEventLevel.Fatal);
        }

        // Set minimum log levels based on environment
        if (env.IsDevelopment())
        {
            configuration.MinimumLevel.Debug()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
                .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
                .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Information);
        }
        else if (env.IsStaging())
        {
            configuration.MinimumLevel.Information()
                .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
                .MinimumLevel.Override("System", LogEventLevel.Warning);
        }
        else // Production
        {
            configuration.MinimumLevel.Warning()
                .MinimumLevel.Override("{{projectName}}", LogEventLevel.Information)
                .MinimumLevel.Override("Microsoft", LogEventLevel.Error)
                .MinimumLevel.Override("System", LogEventLevel.Error);
        }

        // Add filters to reduce noise
        configuration
            .Filter.ByExcluding(Matching.FromSource("Microsoft.AspNetCore.StaticFiles"))
            .Filter.ByExcluding(Matching.WithProperty<string>("RequestPath", path => path.StartsWith("/health")))
            .Filter.ByExcluding("@mt like '%swagger%'")
            .Filter.ByExcluding("@mt like '%favicon%'");
    });

    // Add services to the container
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();

    // Configure Entity Framework
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
    {
        if (builder.Environment.IsEnvironment("Testing"))
        {
            options.UseInMemoryDatabase("TestDb");
        }
        else
        {
            options.UseSqlServer(connectionString);
        }
        
        // Enable sensitive data logging in development
        if (builder.Environment.IsDevelopment())
        {
            options.EnableSensitiveDataLogging();
            options.EnableDetailedErrors();
        }
    });

    // AutoMapper
    builder.Services.AddAutoMapper(typeof(UserProfile));

    // FluentValidation
    builder.Services.AddValidatorsFromAssemblyContaining<CreateUserValidator>();

    // Custom services
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IProductService, ProductService>();
    builder.Services.AddScoped<IAuditService, AuditService>();
    builder.Services.AddScoped<ILoggingService, LoggingService>();
    builder.Services.AddScoped<IPerformanceMonitoringService, PerformanceMonitoringService>();

    // Authentication
    var jwtKey = builder.Configuration["Jwt:Key"] ?? "YourSecretKeyHere";
    var key = Encoding.ASCII.GetBytes(jwtKey);

    builder.Services.AddAuthentication(x =>
    {
        x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(x =>
    {
        x.RequireHttpsMetadata = false;
        x.SaveToken = true;
        x.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    });

    // Swagger/OpenAPI
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo 
        { 
            Title = "{{projectName}} API", 
            Version = "v1",
            Description = "Enterprise .NET API with comprehensive Serilog logging"
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

        // Include XML comments
        var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        c.IncludeXmlComments(xmlPath);
    });

    // Health checks
    builder.Services.AddHealthChecks()
        .AddDbContextCheck<ApplicationDbContext>();

    var app = builder.Build();

    // Create the schema for the in-memory test database and local development databases.
    if (app.Environment.IsEnvironment("Testing") || app.Environment.IsDevelopment())
    {
        using var scope = app.Services.CreateScope();
        try
        {
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreated();
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not create the database; check the DefaultConnection connection string");
        }
    }

    // Request logging middleware
    app.UseSerilogRequestLogging(options =>
    {
        options.MessageTemplate = "Handled {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
        options.GetLevel = (httpContext, elapsed, ex) => ex != null 
            ? LogEventLevel.Error 
            : httpContext.Response.StatusCode > 499 
                ? LogEventLevel.Error 
                : LogEventLevel.Information;
        
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        {
            diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
            diagnosticContext.Set("RequestScheme", httpContext.Request.Scheme);
            diagnosticContext.Set("UserAgent", httpContext.Request.Headers.UserAgent.FirstOrDefault());
            diagnosticContext.Set("ContentType", httpContext.Request.ContentType);
            diagnosticContext.Set("ContentLength", httpContext.Request.ContentLength);
            
            if (httpContext.User.Identity?.IsAuthenticated == true)
            {
                diagnosticContext.Set("UserId", httpContext.User.Identity.Name);
            }
        };
    });

    // Configure the HTTP request pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "{{projectName}} API V1");
            c.RoutePrefix = string.Empty;
        });
    }

    app.UseHttpsRedirection();
    app.UseAuthentication();
    app.UseAuthorization();

    // Custom middleware for performance monitoring and additional logging
    app.UseMiddleware<PerformanceLoggingMiddleware>();
    app.UseMiddleware<ErrorLoggingMiddleware>();
    app.UseMiddleware<CorrelationIdMiddleware>();

    app.MapControllers();

    // Health check endpoints
    app.MapHealthChecks("/health");
    app.MapHealthChecks("/health/ready");

    Log.Information("{{projectName}} application started successfully");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "{{projectName}} application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}`,

    // Enhanced logging configuration file
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "Jwt": {
    "Key": "YourSecretKeyHereChangeInProduction",
    "Issuer": "{{serviceName}}",
    "Audience": "{{serviceName}}Users",
    "ExpiryInHours": 24
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore": "Information",
        "System": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/{{serviceName}}.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 7,
          "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      }
    ],
    "Enrich": [
      "FromLogContext",
      "WithEnvironmentName", 
      "WithMachineName",
      "WithProcessId",
      "WithThreadId"
    ],
    "Properties": {
      "Application": "{{serviceName}}"
    },
    "Seq": {
      "ServerUrl": "",
      "ApiKey": ""
    },
    "Elasticsearch": {
      "NodeUris": ""
    },
    "Email": {
      "SmtpServer": "",
      "Port": 587,
      "EnableSsl": true,
      "Username": "",
      "Password": "",
      "From": "noreply@{{serviceName}}.com",
      "To": "admin@{{serviceName}}.com"
    }
  },
  "ApplicationInsights": {
    "InstrumentationKey": ""
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}`,

    // Development environment configuration
    'appsettings.Development.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}DevDb;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Debug",
      "Override": {
        "Microsoft": "Information",
        "Microsoft.AspNetCore": "Warning",
        "Microsoft.EntityFrameworkCore": "Information",
        "Microsoft.EntityFrameworkCore.Database.Command": "Information"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/dev/{{serviceName}}-dev.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 3,
          "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact",
          "path": "logs/dev/{{serviceName}}-dev-.json",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 3
        }
      }
    ]
  }
}`,

    // Production environment configuration
    'appsettings.Production.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=productionserver;Database={{serviceName}}ProdDb;User Id=appuser;Password=securepassword;TrustServerCertificate=true"
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Warning",
      "Override": {
        "{{serviceName}}": "Information",
        "Microsoft": "Error",
        "System": "Error"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact"
        }
      },
      {
        "Name": "File",
        "Args": {
          "formatter": "Serilog.Formatting.Compact.CompactJsonFormatter, Serilog.Formatting.Compact",
          "path": "/var/log/{{serviceName}}/{{serviceName}}-.json",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 30
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "/var/log/{{serviceName}}/errors-.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 90,
          "restrictedToMinimumLevel": "Error",
          "outputTemplate": "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}"
        }
      }
    ]
  }
}`,

    // Logging service interface
    'Services/ILoggingService.cs': `using Serilog;

namespace {{projectNamePascal}}.Services;

public interface ILoggingService
{
    void LogInformation(string message, params object[] args);
    void LogInformation<T>(string message, T context, params object[] args);
    void LogWarning(string message, params object[] args);
    void LogWarning<T>(string message, T context, params object[] args);
    void LogError(Exception exception, string message, params object[] args);
    void LogError<T>(Exception exception, string message, T context, params object[] args);
    void LogCritical(Exception exception, string message, params object[] args);
    void LogDebug(string message, params object[] args);
    void LogPerformance(string operationName, TimeSpan duration, bool success = true);
    void LogAudit(string action, string userId, object? data = null);
    void LogSecurity(string eventType, string userId, string details);
    void LogBusinessEvent(string eventName, object data);
    IDisposable BeginScope<TState>(TState state);
}`,

    // Logging service implementation
    'Services/LoggingService.cs': `using Serilog;
using ILogger = Serilog.ILogger;
using Serilog.Context;

namespace {{projectNamePascal}}.Services;

public class LoggingService : ILoggingService
{
    private readonly ILogger _logger;

    public LoggingService(ILogger logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public void LogInformation(string message, params object[] args)
    {
        _logger.Information(message, args);
    }

    public void LogInformation<T>(string message, T context, params object[] args)
    {
        using (LogContext.PushProperty("Context", context, true))
        {
            _logger.Information(message, args);
        }
    }

    public void LogWarning(string message, params object[] args)
    {
        _logger.Warning(message, args);
    }

    public void LogWarning<T>(string message, T context, params object[] args)
    {
        using (LogContext.PushProperty("Context", context, true))
        {
            _logger.Warning(message, args);
        }
    }

    public void LogError(Exception exception, string message, params object[] args)
    {
        _logger.Error(exception, message, args);
    }

    public void LogError<T>(Exception exception, string message, T context, params object[] args)
    {
        using (LogContext.PushProperty("Context", context, true))
        {
            _logger.Error(exception, message, args);
        }
    }

    public void LogCritical(Exception exception, string message, params object[] args)
    {
        _logger.Fatal(exception, message, args);
    }

    public void LogDebug(string message, params object[] args)
    {
        _logger.Debug(message, args);
    }

    public void LogPerformance(string operationName, TimeSpan duration, bool success = true)
    {
        using (LogContext.PushProperty("PerformanceMetric", true))
        using (LogContext.PushProperty("OperationName", operationName))
        using (LogContext.PushProperty("Duration", duration.TotalMilliseconds))
        using (LogContext.PushProperty("Success", success))
        {
            if (success)
            {
                _logger.Information("Performance: {OperationName} completed in {Duration:0.00}ms", 
                    operationName, duration.TotalMilliseconds);
            }
            else
            {
                _logger.Warning("Performance: {OperationName} failed after {Duration:0.00}ms", 
                    operationName, duration.TotalMilliseconds);
            }
        }
    }

    public void LogAudit(string action, string userId, object? data = null)
    {
        using (LogContext.PushProperty("AuditEvent", true))
        using (LogContext.PushProperty("Action", action))
        using (LogContext.PushProperty("UserId", userId))
        using (LogContext.PushProperty("AuditData", data, true))
        {
            _logger.Information("Audit: User {UserId} performed action {Action}", userId, action);
        }
    }

    public void LogSecurity(string eventType, string userId, string details)
    {
        using (LogContext.PushProperty("SecurityEvent", true))
        using (LogContext.PushProperty("EventType", eventType))
        using (LogContext.PushProperty("UserId", userId))
        using (LogContext.PushProperty("SecurityDetails", details))
        {
            _logger.Warning("Security: {EventType} for user {UserId} - {Details}", eventType, userId, details);
        }
    }

    public void LogBusinessEvent(string eventName, object data)
    {
        using (LogContext.PushProperty("BusinessEvent", true))
        using (LogContext.PushProperty("EventName", eventName))
        using (LogContext.PushProperty("EventData", data, true))
        {
            _logger.Information("Business Event: {EventName}", eventName);
        }
    }

    public IDisposable BeginScope<TState>(TState state)
    {
        return LogContext.PushProperty("Scope", state, true);
    }
}`,

    // Performance monitoring service interface
    'Services/IPerformanceMonitoringService.cs': `namespace {{projectNamePascal}}.Services;

public interface IPerformanceMonitoringService
{
    IDisposable StartOperation(string operationName);
    void RecordMetric(string metricName, double value, string unit = "ms");
    void RecordCounter(string counterName, int increment = 1);
    void LogSlowOperation(string operationName, TimeSpan duration, TimeSpan threshold);
}`,

    // Performance monitoring service implementation
    'Services/PerformanceMonitoringService.cs': `using System.Diagnostics;
using Serilog;
using ILogger = Serilog.ILogger;
using Serilog.Context;

namespace {{projectNamePascal}}.Services;

public class PerformanceMonitoringService : IPerformanceMonitoringService
{
    private readonly ILogger _logger;
    private readonly ILoggingService _loggingService;

    public PerformanceMonitoringService(ILogger logger, ILoggingService loggingService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _loggingService = loggingService ?? throw new ArgumentNullException(nameof(loggingService));
    }

    public IDisposable StartOperation(string operationName)
    {
        return new OperationTimer(operationName, _loggingService);
    }

    public void RecordMetric(string metricName, double value, string unit = "ms")
    {
        using (LogContext.PushProperty("MetricName", metricName))
        using (LogContext.PushProperty("MetricValue", value))
        using (LogContext.PushProperty("MetricUnit", unit))
        {
            _logger.Information("Metric: {MetricName} = {MetricValue} {MetricUnit}", metricName, value, unit);
        }
    }

    public void RecordCounter(string counterName, int increment = 1)
    {
        using (LogContext.PushProperty("CounterName", counterName))
        using (LogContext.PushProperty("CounterIncrement", increment))
        {
            _logger.Information("Counter: {CounterName} incremented by {CounterIncrement}", counterName, increment);
        }
    }

    public void LogSlowOperation(string operationName, TimeSpan duration, TimeSpan threshold)
    {
        if (duration > threshold)
        {
            using (LogContext.PushProperty("SlowOperation", true))
            using (LogContext.PushProperty("OperationName", operationName))
            using (LogContext.PushProperty("Duration", duration.TotalMilliseconds))
            using (LogContext.PushProperty("Threshold", threshold.TotalMilliseconds))
            {
                _logger.Warning("Slow operation detected: {OperationName} took {Duration:0.00}ms (threshold: {Threshold:0.00}ms)",
                    operationName, duration.TotalMilliseconds, threshold.TotalMilliseconds);
            }
        }
    }

    private class OperationTimer : IDisposable
    {
        private readonly string _operationName;
        private readonly ILoggingService _loggingService;
        private readonly Stopwatch _stopwatch;
        private bool _disposed;

        public OperationTimer(string operationName, ILoggingService loggingService)
        {
            _operationName = operationName;
            _loggingService = loggingService;
            _stopwatch = Stopwatch.StartNew();
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _stopwatch.Stop();
                _loggingService.LogPerformance(_operationName, _stopwatch.Elapsed);
                _disposed = true;
            }
        }
    }
}`,

    // Middleware for performance logging
    'Infrastructure/Middleware/PerformanceLoggingMiddleware.cs': `using System.Diagnostics;
using Serilog;
using ILogger = Serilog.ILogger;
using Serilog.Context;

namespace {{projectNamePascal}}.Infrastructure.Logging;

public class PerformanceLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger _logger;
    private readonly TimeSpan _slowRequestThreshold;

    public PerformanceLoggingMiddleware(RequestDelegate next, ILogger logger, IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _slowRequestThreshold = TimeSpan.FromMilliseconds(
            configuration.GetValue<int>("Logging:SlowRequestThresholdMs", 1000));
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        
        using (LogContext.PushProperty("RequestId", context.TraceIdentifier))
        using (LogContext.PushProperty("RequestPath", context.Request.Path))
        using (LogContext.PushProperty("RequestMethod", context.Request.Method))
        {
            try
            {
                await _next(context);
            }
            finally
            {
                stopwatch.Stop();
                var elapsed = stopwatch.Elapsed;
                
                if (elapsed > _slowRequestThreshold)
                {
                    _logger.Warning("Slow request detected: {RequestMethod} {RequestPath} took {ElapsedMs:0.00}ms",
                        context.Request.Method, context.Request.Path, elapsed.TotalMilliseconds);
                }

                // Log performance metrics
                using (LogContext.PushProperty("ElapsedMs", elapsed.TotalMilliseconds))
                using (LogContext.PushProperty("StatusCode", context.Response.StatusCode))
                {
                    _logger.Information("Request performance: {RequestMethod} {RequestPath} - {StatusCode} in {ElapsedMs:0.00}ms",
                        context.Request.Method, context.Request.Path, context.Response.StatusCode, elapsed.TotalMilliseconds);
                }
            }
        }
    }
}`,

    // Middleware for error logging
    'Infrastructure/Middleware/ErrorLoggingMiddleware.cs': `using System.Net;
using System.Text.Json;
using Serilog;
using ILogger = Serilog.ILogger;
using Serilog.Context;

namespace {{projectNamePascal}}.Infrastructure.Logging;

public class ErrorLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger _logger;
    private readonly IWebHostEnvironment _environment;

    public ErrorLoggingMiddleware(RequestDelegate next, ILogger logger, IWebHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await LogAndHandleErrorAsync(context, ex);
        }
    }

    private async Task LogAndHandleErrorAsync(HttpContext context, Exception exception)
    {
        using (LogContext.PushProperty("RequestId", context.TraceIdentifier))
        using (LogContext.PushProperty("RequestPath", context.Request.Path))
        using (LogContext.PushProperty("RequestMethod", context.Request.Method))
        using (LogContext.PushProperty("UserAgent", context.Request.Headers.UserAgent.ToString()))
        using (LogContext.PushProperty("RemoteIP", context.Connection.RemoteIpAddress?.ToString()))
        {
            _logger.Error(exception, "Unhandled exception occurred during request {RequestMethod} {RequestPath}",
                context.Request.Method, context.Request.Path);
        }

        var response = context.Response;
        response.ContentType = "application/json";

        var (statusCode, message) = GetErrorResponse(exception);
        response.StatusCode = statusCode;

        object errorResponse = new
        {
            error = new
            {
                message = message,
                requestId = context.TraceIdentifier,
                timestamp = DateTime.UtcNow
            }
        };

        if (_environment.IsDevelopment())
        {
            errorResponse = new
            {
                error = new
                {
                    message = exception.Message,
                    detail = exception.ToString(),
                    requestId = context.TraceIdentifier,
                    timestamp = DateTime.UtcNow
                }
            };
        }

        var jsonResponse = JsonSerializer.Serialize(errorResponse);
        await response.WriteAsync(jsonResponse);
    }

    private static (int statusCode, string message) GetErrorResponse(Exception exception)
    {
        return exception switch
        {
            ArgumentException _ => ((int)HttpStatusCode.BadRequest, "Invalid request parameters"),
            UnauthorizedAccessException _ => ((int)HttpStatusCode.Unauthorized, "Unauthorized access"),
            NotImplementedException _ => ((int)HttpStatusCode.NotImplemented, "Feature not implemented"),
            KeyNotFoundException _ => ((int)HttpStatusCode.NotFound, "Resource not found"),
            TimeoutException _ => ((int)HttpStatusCode.RequestTimeout, "Request timeout"),
            _ => ((int)HttpStatusCode.InternalServerError, "An internal server error occurred")
        };
    }
}`,

    // Correlation ID middleware
    'Infrastructure/Middleware/CorrelationIdMiddleware.cs': `using Serilog.Context;

namespace {{projectNamePascal}}.Infrastructure.Logging;

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string CorrelationIdHeaderName = "X-Correlation-ID";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = GetOrCreateCorrelationId(context);
        
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            // Add correlation ID to response headers
            context.Response.Headers.Add(CorrelationIdHeaderName, correlationId);
            
            await _next(context);
        }
    }

    private static string GetOrCreateCorrelationId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue(CorrelationIdHeaderName, out var correlationId) && 
            !string.IsNullOrEmpty(correlationId))
        {
            return correlationId!;
        }

        return Guid.NewGuid().ToString();
    }
}`,

    // README for Serilog configuration
    'docs/SERILOG_CONFIGURATION.md': `# Serilog Configuration Guide

## Overview

This {{serviceName}} API includes comprehensive Serilog structured logging with multiple sinks and enrichers.

## Features

### Enrichers
- **Environment Information**: Machine name, environment name
- **Process Information**: Process ID, process name, thread ID
- **Correlation ID**: Request correlation tracking
- **Client Information**: IP address, user agent
- **User Context**: Authenticated user information

### Sinks

#### Console Sink
- Development: Human-readable format
- Production: JSON format for log aggregation

#### File Sinks
- **Main Log**: \`logs/{{serviceName}}.log\` - All log levels
- **JSON Log**: \`logs/{{serviceName}}-.json\` - Structured JSON format
- **Error Log**: \`logs/errors-.log\` - Error level and above
- **Performance Log**: \`logs/performance-.log\` - Performance metrics

#### Database Sink (SQL Server)
- Structured logging to database table
- Batch posting for performance
- Auto-table creation

#### External Sinks
- **Seq**: Centralized log server
- **Elasticsearch**: Search and analytics
- **Application Insights**: Azure monitoring
- **Email**: Critical error notifications

## Configuration

### Environment Variables

\`\`\`bash
# Seq Configuration
SERILOG__SEQ__SERVERURL=http://localhost:5341
SERILOG__SEQ__APIKEY=your-api-key

# Elasticsearch Configuration
SERILOG__ELASTICSEARCH__NODEURIS=http://localhost:9200

# Email Configuration
SERILOG__EMAIL__SMTPSERVER=smtp.gmail.com
SERILOG__EMAIL__USERNAME=your-email@domain.com
SERILOG__EMAIL__PASSWORD=your-password
\`\`\`

### appsettings.json Structure

\`\`\`json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      // Sink configurations
    ],
    "Enrich": [
      "FromLogContext",
      "WithEnvironmentName"
    ]
  }
}
\`\`\`

## Usage Examples

### Basic Logging

\`\`\`csharp
// In controller or service
private readonly ILoggingService _logger;

// Information logging
_logger.LogInformation("User created successfully with ID {UserId}", userId);

// Error logging
_logger.LogError(exception, "Failed to create user {UserData}", userData);
\`\`\`

### Performance Monitoring

\`\`\`csharp
// Method timing
using var operation = _performanceService.StartOperation("CreateUser");
// ... your code ...
// Automatically logs performance on dispose

// Manual performance logging
_logger.LogPerformance("DatabaseQuery", TimeSpan.FromMilliseconds(150));
\`\`\`

### Audit Logging

\`\`\`csharp
_logger.LogAudit("UserCreated", userId, new { Email = user.Email });
_logger.LogSecurity("LoginAttempt", userId, "Successful login");
\`\`\`

### Structured Logging

\`\`\`csharp
// With context
_logger.LogInformation("Processing order {OrderId} for customer {CustomerId}", 
    orderId, customerId);

// With complex objects
_logger.LogInformation("Order processed {@Order}", order);
\`\`\`

## Middleware

### Performance Logging
- Tracks request duration
- Identifies slow requests
- Logs performance metrics

### Error Logging
- Captures unhandled exceptions
- Provides structured error responses
- Environment-specific error details

### Correlation ID
- Tracks requests across services
- Enables distributed tracing
- Automatic header management

## Log Levels by Environment

### Development
- Debug and above
- EF Core command logging enabled
- Sensitive data logging enabled

### Staging
- Information and above
- Reduced Microsoft logging

### Production
- Warning and above for most sources
- Information for application logs
- Error only for Microsoft/System logs

## Best Practices

1. **Use structured logging**: Always use message templates with parameters
2. **Include context**: Add relevant properties for searchability
3. **Performance awareness**: Use appropriate log levels
4. **Correlation tracking**: Ensure correlation IDs flow through systems
5. **Security**: Don't log sensitive information
6. **Monitoring**: Set up alerts on error patterns

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check minimum log level configuration
2. **Poor performance**: Adjust batch posting limits
3. **Disk space**: Configure retention policies
4. **External sinks failing**: Check connection strings and credentials

### Log Analysis Queries

#### Seq Queries
\`\`\`
// Find slow requests
ElapsedMs > 1000

// Find errors by user
@Level = 'Error' and UserId = 'specific-user-id'

// Performance trends
select avg(ElapsedMs) from stream group by time(1h)
\`\`\`

## Monitoring and Alerts

### Key Metrics to Monitor
- Error rate by endpoint
- Average response time
- Failed authentication attempts
- Database connection issues
- External service failures

### Recommended Alerts
- Error rate > 5% over 5 minutes
- Average response time > 2 seconds
- Failed logins > 10 per minute
- Disk space < 10% remaining
\`
}`,

    'Controllers/UsersController.cs': `using AutoMapper;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;
using {{projectNamePascal}}.Services;

namespace {{projectNamePascal}}.Controllers;

/// <summary>User management endpoints.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateUserRequest> _createValidator;
    private readonly IValidator<UpdateUserRequest> _updateValidator;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserService userService,
        IMapper mapper,
        IValidator<CreateUserRequest> createValidator,
        IValidator<UpdateUserRequest> updateValidator,
        ILogger<UsersController> logger)
    {
        _userService = userService;
        _mapper = mapper;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
        _logger = logger;
    }

    /// <summary>Lists users with optional search, sorting and pagination.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserResponse>>> GetUsers(
        string? search = null, int page = 1, int pageSize = 10, string sortBy = "createdAt", string sortOrder = "desc")
    {
        _logger.LogInformation("Listing users (search: {Search}, page: {Page}, pageSize: {PageSize})", search, page, pageSize);

        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10;

        try
        {
            var users = await _userService.GetUsersAsync(search, page, pageSize, sortBy, sortOrder);
            return Ok(_mapper.Map<PagedResult<UserResponse>>(users));
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid parameters for GetUsers");
            return BadRequest(new ErrorResponse { Message = ex.Message });
        }
    }

    /// <summary>Gets a user by id.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserResponse>> GetUser(int id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        if (user == null)
        {
            _logger.LogWarning("User {UserId} not found", id);
            return NotFound(new ErrorResponse { Message = $"User with ID {id} not found" });
        }

        return Ok(_mapper.Map<UserResponse>(user));
    }

    /// <summary>Creates a user.</summary>
    [HttpPost]
    public async Task<ActionResult<UserResponse>> CreateUser(CreateUserRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            _logger.LogWarning("Rejected user creation: {ErrorCount} validation errors", validation.Errors.Count);
            return BadRequest(new ValidationErrorResponse
            {
                Errors = validation.Errors.GroupBy(e => e.PropertyName).ToDictionary(g => g.Key, g => g.First().ErrorMessage)
            });
        }

        try
        {
            var created = await _userService.CreateUserAsync(_mapper.Map<User>(request));
            _logger.LogInformation("Created user {UserId}", created.Id);
            return CreatedAtAction(nameof(GetUser), new { id = created.Id }, _mapper.Map<UserResponse>(created));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "User creation conflict for {Email}", request.Email);
            return Conflict(new ErrorResponse { Message = ex.Message });
        }
    }

    /// <summary>Updates a user. Omitted fields are left unchanged.</summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserResponse>> UpdateUser(int id, UpdateUserRequest request)
    {
        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            return BadRequest(new ValidationErrorResponse
            {
                Errors = validation.Errors.GroupBy(e => e.PropertyName).ToDictionary(g => g.Key, g => g.First().ErrorMessage)
            });
        }

        var user = await _userService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new ErrorResponse { Message = $"User with ID {id} not found" });
        }

        _mapper.Map(request, user);
        var updated = await _userService.UpdateUserAsync(user);
        return Ok(_mapper.Map<UserResponse>(updated));
    }

    /// <summary>Soft-deletes a user.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new ErrorResponse { Message = $"User with ID {id} not found" });
        }

        await _userService.DeleteUserAsync(id);
        return NoContent();
    }
}
`,

    'DTOs/CommonDtos.cs': `namespace {{projectNamePascal}}.DTOs;

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
}

public class SearchRequest
{
    public string? Query { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public bool? IsActive { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public class SearchResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public string? Query { get; set; }
}

public class ErrorResponse
{
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
}

public class ValidationErrorResponse
{
    public string Message { get; set; } = "One or more validation errors occurred";
    public Dictionary<string, string> Errors { get; set; } = new();
}
`,

    'DTOs/UserDtos.cs': `using System.ComponentModel.DataAnnotations;

namespace {{projectNamePascal}}.DTOs;

/// <summary>Postal address supplied when creating or updating a user.</summary>
public class AddressRequest
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
}

/// <summary>Postal address returned for a user.</summary>
public class AddressResponse
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
}

/// <summary>Payload for creating a user.</summary>
public class CreateUserRequest
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public AddressRequest? Address { get; set; }
}

/// <summary>Payload for updating a user. Omitted (null) fields are left unchanged.</summary>
public class UpdateUserRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? PhoneNumber { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public AddressRequest? Address { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>A user as returned by the API.</summary>
public class UserResponse
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public AddressResponse? Address { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
`,

    'Data/ApplicationDbContext.cs': `using Microsoft.EntityFrameworkCore;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256);
            e.OwnsOne(u => u.Address);
            // Soft delete: deleted users are hidden from every query.
            e.HasQueryFilter(u => !u.IsDeleted);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.Property(p => p.Price).HasPrecision(18, 2);
        });
    }
}
`,

    'Models/AuditLog.cs': `namespace {{projectNamePascal}}.Models;

public class AuditLog
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
`,

    'Models/Product.cs': `namespace {{projectNamePascal}}.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
`,

    'Models/User.cs': `namespace {{projectNamePascal}}.Models;

public class User
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public UserAddress? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class UserAddress
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
}
`,

    'Profiles/UserProfile.cs': `using AutoMapper;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Profiles;

public class UserProfile : Profile
{
    public UserProfile()
    {
        CreateMap<UserAddress, AddressResponse>();
        CreateMap<AddressRequest, UserAddress>();

        CreateMap<User, UserResponse>();

        CreateMap<CreateUserRequest, User>()
            .ForMember(d => d.PasswordHash, o => o.MapFrom(s => BCrypt.Net.BCrypt.HashPassword(s.Password)))
            .ForMember(d => d.Id, o => o.Ignore())
            .ForMember(d => d.IsActive, o => o.Ignore())
            .ForMember(d => d.IsDeleted, o => o.Ignore())
            .ForMember(d => d.CreatedAt, o => o.Ignore())
            .ForMember(d => d.UpdatedAt, o => o.Ignore());

        // Only fields present in the request are applied to the existing user.
        CreateMap<UpdateUserRequest, User>()
            .ForAllMembers(o => o.Condition((src, dest, srcMember) => srcMember != null));

        CreateMap(typeof(PagedResult<>), typeof(PagedResult<>));
        CreateMap(typeof(SearchResult<>), typeof(SearchResult<>));
    }
}
`,

    'Services/AuditService.cs': `using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public class AuditService : IAuditService
{
    private readonly ApplicationDbContext _db;

    public AuditService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task LogAsync(string action, string entityName, string? entityId = null, string? details = null)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            Details = details,
        });
        await _db.SaveChangesAsync();
    }
}
`,

    'Services/IAuditService.cs': `namespace {{projectNamePascal}}.Services;

public interface IAuditService
{
    Task LogAsync(string action, string entityName, string? entityId = null, string? details = null);
}
`,

    'Services/IProductService.cs': `using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public interface IProductService
{
    Task<List<Product>> GetProductsAsync();
    Task<Product?> GetProductByIdAsync(int id);
    Task<Product> CreateProductAsync(Product product);
}
`,

    'Services/IUserService.cs': `using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public interface IUserService
{
    Task<PagedResult<User>> GetUsersAsync(string? search, int page, int pageSize, string sortBy, string sortOrder);
    Task<User?> GetUserByIdAsync(int id);
    Task<User> CreateUserAsync(User user);
    Task<User> UpdateUserAsync(User user);
    Task DeleteUserAsync(int id);
    Task<SearchResult<User>> SearchUsersAsync(SearchRequest request);
}
`,

    'Services/ProductService.cs': `using Microsoft.EntityFrameworkCore;
using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public class ProductService : IProductService
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditService _audit;

    public ProductService(ApplicationDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public Task<List<Product>> GetProductsAsync() => _db.Products.AsNoTracking().OrderBy(p => p.Name).ToListAsync();

    public Task<Product?> GetProductByIdAsync(int id) => _db.Products.FirstOrDefaultAsync(p => p.Id == id);

    public async Task<Product> CreateProductAsync(Product product)
    {
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("create", nameof(Product), product.Id.ToString());
        return product;
    }
}
`,

    'Services/UserService.cs': `using Microsoft.EntityFrameworkCore;
using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _db;
    private readonly IAuditService _audit;

    public UserService(ApplicationDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<PagedResult<User>> GetUsersAsync(string? search, int page, int pageSize, string sortBy, string sortOrder)
    {
        var query = _db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(term) ||
                u.LastName.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term));
        }

        var descending = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        query = (sortBy ?? "createdAt").ToLowerInvariant() switch
        {
            "name" => descending ? query.OrderByDescending(u => u.LastName).ThenByDescending(u => u.FirstName)
                                 : query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName),
            "email" => descending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "createdat" => descending ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt),
            _ => throw new ArgumentException($"Unsupported sort field '{sortBy}'. Use name, email or createdAt."),
        };

        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new PagedResult<User> { Items = items, Page = page, PageSize = pageSize, TotalCount = total };
    }

    public Task<User?> GetUserByIdAsync(int id) => _db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public async Task<User> CreateUserAsync(User user)
    {
        var email = user.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email))
        {
            throw new InvalidOperationException("A user with this email already exists");
        }

        user.Email = email;
        user.CreatedAt = DateTime.UtcNow;
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("create", nameof(User), user.Id.ToString());
        return user;
    }

    public async Task<User> UpdateUserAsync(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("update", nameof(User), user.Id.ToString());
        return user;
    }

    public async Task DeleteUserAsync(int id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return;

        user.IsDeleted = true;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("delete", nameof(User), id.ToString());
    }

    public async Task<SearchResult<User>> SearchUsersAsync(SearchRequest request)
    {
        var query = _db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var term = request.Query.Trim().ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(term) ||
                u.LastName.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(request.City))
            query = query.Where(u => u.Address != null && u.Address.City == request.City);
        if (!string.IsNullOrWhiteSpace(request.Country))
            query = query.Where(u => u.Address != null && u.Address.Country == request.Country);
        if (request.IsActive.HasValue)
            query = query.Where(u => u.IsActive == request.IsActive.Value);

        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var total = await query.CountAsync();
        var items = await query.OrderBy(u => u.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new SearchResult<User> { Items = items, TotalCount = total, Query = request.Query };
    }
}
`,

    'Validators/UserValidators.cs': `using FluentValidation;
using {{projectNamePascal}}.DTOs;

namespace {{projectNamePascal}}.Validators;

public class AddressRequestValidator : AbstractValidator<AddressRequest>
{
    public AddressRequestValidator()
    {
        RuleFor(a => a.Street).NotEmpty().MaximumLength(200);
        RuleFor(a => a.City).NotEmpty().MaximumLength(100);
        RuleFor(a => a.PostalCode).NotEmpty().MaximumLength(20);
        RuleFor(a => a.Country).NotEmpty().MaximumLength(100);
    }
}

public class CreateUserValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        RuleFor(u => u.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(u => u.LastName).NotEmpty().MaximumLength(100);
        RuleFor(u => u.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(u => u.Password)
            .NotEmpty()
            .MinimumLength(8).WithMessage("Password must be at least 8 characters long")
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter")
            .Matches("[0-9]").WithMessage("Password must contain a digit");
        RuleFor(u => u.PhoneNumber).MaximumLength(30);
        RuleFor(u => u.DateOfBirth)
            .Must(d => d is null || d.Value <= DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("Date of birth cannot be in the future");
        RuleFor(u => u.Address!).SetValidator(new AddressRequestValidator()).When(u => u.Address != null);
    }
}

public class UpdateUserValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserValidator()
    {
        RuleFor(u => u.FirstName).MaximumLength(100);
        RuleFor(u => u.LastName).MaximumLength(100);
        RuleFor(u => u.PhoneNumber).MaximumLength(30);
        RuleFor(u => u.DateOfBirth)
            .Must(d => d is null || d.Value <= DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("Date of birth cannot be in the future");
        RuleFor(u => u.Address!).SetValidator(new AddressRequestValidator()).When(u => u.Address != null);
    }
}
`
  }
};