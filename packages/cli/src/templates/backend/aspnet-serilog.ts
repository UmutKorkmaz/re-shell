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
    <PackageReference Include="Serilog.Sinks.Email" Version="2.4.0" />
    <PackageReference Include="Serilog.Sinks.MSSqlServer" Version="6.3.0" />
    <PackageReference Include="Serilog.Sinks.Elasticsearch" Version="9.0.3" />
    <PackageReference Include="Serilog.Sinks.ApplicationInsights" Version="4.0.0" />
    <!-- Formatting and Filtering -->
    <PackageReference Include="Serilog.Formatting.Compact" Version="2.0.0" />
    <PackageReference Include="Serilog.Formatting.Elasticsearch" Version="9.0.3" />
    <PackageReference Include="Serilog.Filters.Expressions" Version="2.1.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.0" />
  </ItemGroup>

</Project>`,

    // Program.cs with comprehensive Serilog configuration
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;
using {{serviceName}}.Profiles;
using {{serviceName}}.Validators;
using {{serviceName}}.Infrastructure.Logging;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using FluentValidation;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Formatting.Elasticsearch;
using Serilog.Filters.Expressions;
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
    Log.Information("Starting up {{serviceName}} application");

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
            .Enrich.WithUserName()
            .Enrich.WithProperty("Application", "{{serviceName}}")
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
                path: "logs/{{serviceName}}.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
            .WriteTo.File(
                new CompactJsonFormatter(),
                path: "logs/{{serviceName}}-.json",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7);

        // Error-only file sink
        configuration.WriteTo.Logger(lc => lc
            .Filter.ByIncludingOnly(Matching.FromSource<{{serviceName}}.Controllers>())
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
        if (!string.IsNullOrEmpty(config.GetConnectionString("DefaultConnection")))
        {
            configuration.WriteTo.MSSqlServer(
                connectionString: config.GetConnectionString("DefaultConnection"),
                sinkOptions: new Serilog.Sinks.MSSqlServer.MSSqlServerSinkOptions
                {
                    TableName = "Logs",
                    SchemaName = "dbo",
                    AutoCreateSqlTable = true,
                    BatchPostingLimit = 1000,
                    Period = TimeSpan.FromSeconds(10)
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
                IndexFormat = "{{serviceName}}-logs-{0:yyyy.MM.dd}",
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
            configuration.WriteTo.Email(new Serilog.Sinks.Email.EmailSinkOptions
            {
                From = config.GetValue<string>("Serilog:Email:From") ?? "noreply@{{serviceName}}.com",
                To = config.GetValue<string>("Serilog:Email:To") ?? "admin@{{serviceName}}.com",
                Subject = "{{serviceName}} Critical Error",
                SmtpServer = smtpServer,
                Port = config.GetValue<int>("Serilog:Email:Port", 587),
                EnableSsl = config.GetValue<bool>("Serilog:Email:EnableSsl", true),
                Username = config.GetValue<string>("Serilog:Email:Username"),
                Password = config.GetValue<string>("Serilog:Email:Password"),
                RestrictedToMinimumLevel = LogEventLevel.Fatal,
                BatchPostingLimit = 5,
                Period = TimeSpan.FromMinutes(2)
            });
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
                .MinimumLevel.Override("{{serviceName}}", LogEventLevel.Information)
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
            Title = "{{serviceName}} API", 
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
        .AddDbContext<ApplicationDbContext>();

    var app = builder.Build();

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
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "{{serviceName}} API V1");
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

    Log.Information("{{serviceName}} application started successfully");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "{{serviceName}} application terminated unexpectedly");
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

namespace {{serviceName}}.Services;

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
using Serilog.Context;

namespace {{serviceName}}.Services;

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
    'Services/IPerformanceMonitoringService.cs': `namespace {{serviceName}}.Services;

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
using Serilog.Context;

namespace {{serviceName}}.Services;

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
using Serilog.Context;

namespace {{serviceName}}.Infrastructure.Logging;

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
using Serilog.Context;

namespace {{serviceName}}.Infrastructure.Logging;

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

        var errorResponse = new
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

namespace {{serviceName}}.Infrastructure.Logging;

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
}`
  }
};