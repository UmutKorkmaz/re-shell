import { BackendTemplate } from '../types';

export const aspnetJwtTemplate: BackendTemplate = {
  id: 'aspnet-jwt',
  name: 'aspnet-jwt',
  displayName: 'ASP.NET Core with JWT Authentication',
  description: 'Enterprise .NET API with comprehensive JWT authentication and authorization middleware',
  language: 'csharp',
  framework: 'aspnet-jwt',
  version: '1.0.0',
  tags: ['aspnet', 'jwt', 'authentication', 'authorization', 'security'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing'],
  
  files: {
    // Project file with JWT and security packages
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
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Swashbuckle.AspNetCore.Annotations" Version="6.5.0" />
    <!-- Comprehensive JWT and Security Packages -->
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.UI" Version="8.0.0" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.3" />
    <PackageReference Include="Microsoft.IdentityModel.Tokens" Version="7.0.3" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.Google" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.Facebook" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.MicrosoftAccount" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.DataProtection.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore" Version="8.0.0" />
    <!-- Rate limiting and security -->
    <PackageReference Include="AspNetCoreRateLimit" Version="5.0.0" />
    <!-- Email and SMS services -->
    <PackageReference Include="SendGrid" Version="9.28.1" />
    <PackageReference Include="Twilio" Version="6.14.1" />
  </ItemGroup>

</Project>`,

    // Program.cs with comprehensive JWT configuration
    'Program.cs': `using Microsoft.AspNetCore.DataProtection;
using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.Services;
using {{projectNamePascal}}.Models;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Profiles;
using {{projectNamePascal}}.Validators;
using {{projectNamePascal}}.Infrastructure.Security;
using {{projectNamePascal}}.Infrastructure.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using AutoMapper;
using FluentValidation;
using Serilog;
using Microsoft.OpenApi.Models;
using AspNetCoreRateLimit;
using System.Text;
using System.Security.Claims;

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
});

// Configure Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole<int>>(options =>
{
    // Password settings
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequireUppercase = true;
    options.Password.RequiredLength = 8;
    options.Password.RequiredUniqueChars = 1;

    // Lockout settings
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User settings
    options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
    options.User.RequireUniqueEmail = true;

    // Email confirmation
    options.SignIn.RequireConfirmedEmail = true;
    options.SignIn.RequireConfirmedPhoneNumber = false;

    // Two-factor authentication
    options.Tokens.AuthenticatorTokenProvider = TokenOptions.DefaultAuthenticatorProvider;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders()
.AddTokenProvider<EmailConfirmationTokenProvider<ApplicationUser>>("emailconfirmation")
.AddTokenProvider<PhoneNumberTokenProvider<ApplicationUser>>("sms");

// Configure token lifespans
builder.Services.Configure<DataProtectionTokenProviderOptions>(opt =>
{
    opt.TokenLifespan = TimeSpan.FromHours(24);
});

builder.Services.Configure<EmailConfirmationTokenProviderOptions>(opt =>
{
    opt.TokenLifespan = TimeSpan.FromDays(3);
});

// JWT Configuration
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? "YourSecretKeyHereChangeInProduction";
var key = Encoding.UTF8.GetBytes(secretKey);

builder.Services.Configure<JwtSettings>(jwtSettings);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.SaveToken = true;
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ClockSkew = TimeSpan.FromMinutes(5),
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = ClaimTypes.NameIdentifier
    };

    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            Log.Warning("JWT Authentication failed: {Error}", context.Exception.Message);
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            Log.Information("JWT Token validated for user: {User}", context.Principal?.Identity?.Name);
            return Task.CompletedTask;
        },
        OnChallenge = context =>
        {
            Log.Warning("JWT Challenge: {Error}", context.Error);
            return Task.CompletedTask;
        }
    };
});

// External providers are only registered when their credentials are configured; an empty
// ClientId makes the OAuth handlers throw on every request.
var authBuilder = builder.Services.AddAuthentication();

if (!string.IsNullOrEmpty(builder.Configuration["Authentication:Google:ClientId"]))
{
    authBuilder.AddGoogle(options =>
    {
        options.ClientId = builder.Configuration["Authentication:Google:ClientId"]!;
        options.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"] ?? "";
    });
}

if (!string.IsNullOrEmpty(builder.Configuration["Authentication:Facebook:AppId"]))
{
    authBuilder.AddFacebook(options =>
    {
        options.AppId = builder.Configuration["Authentication:Facebook:AppId"]!;
        options.AppSecret = builder.Configuration["Authentication:Facebook:AppSecret"] ?? "";
    });
}

if (!string.IsNullOrEmpty(builder.Configuration["Authentication:Microsoft:ClientId"]))
{
    authBuilder.AddMicrosoftAccount(options =>
    {
        options.ClientId = builder.Configuration["Authentication:Microsoft:ClientId"]!;
        options.ClientSecret = builder.Configuration["Authentication:Microsoft:ClientSecret"] ?? "";
    });
}

// Authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));

    options.AddPolicy("ModeratorOrAdmin", policy =>
        policy.RequireRole("Moderator", "Admin"));

    options.AddPolicy("EmailConfirmed", policy =>
        policy.RequireClaim("email_verified", "true"));

    options.AddPolicy("TwoFactorEnabled", policy =>
        policy.RequireClaim("amr", "mfa"));

    options.AddPolicy("MinimumAge", policy =>
        policy.Requirements.Add(new MinimumAgeRequirement(18)));

    options.AddPolicy("SameUserOrAdmin", policy =>
        policy.Requirements.Add(new SameUserOrAdminRequirement()));
});

// Rate limiting
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.Configure<IpRateLimitPolicies>(builder.Configuration.GetSection("IpRateLimitPolicies"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// Custom services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ISmsService, SmsService>();
builder.Services.AddScoped<ITwoFactorService, TwoFactorService>();
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<IUserClaimsService, UserClaimsService>();

// AutoMapper
builder.Services.AddAutoMapper(typeof(UserProfile));

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<LoginRequestValidator>();

// Authorization handlers
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, MinimumAgeHandler>();
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, SameUserOrAdminHandler>();

// Data protection
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<ApplicationDbContext>()
    .SetApplicationName("{{projectName}}")
    .SetDefaultKeyLifetime(TimeSpan.FromDays(90));

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "https://localhost:3000" })
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Swagger/OpenAPI
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "{{projectName}} API", 
        Version = "v1",
        Description = "Enterprise .NET API with comprehensive JWT authentication"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: 'Bearer 12345abcdef'",
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

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);
});

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>();

var app = builder.Build();

// No EF migrations are shipped: create the schema (and seed the roles) outside production.
// Use \`dotnet ef migrations add Initial\` and \`dotnet ef database update\` for production databases.
if (!app.Environment.IsProduction())
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreated();
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "{{projectName}} API V1");
        c.RoutePrefix = string.Empty;
        c.OAuthClientId("swagger");
        c.OAuthAppName("{{projectName}} API");
        c.OAuthUsePkce();
    });
}

// Security headers middleware
app.UseMiddleware<SecurityHeadersMiddleware>();

// Rate limiting
app.UseIpRateLimiting();

// Request logging
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "Handled {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000} ms";
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("UserAgent", httpContext.Request.Headers.UserAgent.FirstOrDefault());
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            diagnosticContext.Set("UserId", httpContext.User.Identity.Name);
        }
    };
});

app.UseHttpsRedirection();

// CORS
app.UseCors("AllowSpecificOrigins");

// Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// Custom middleware
app.UseMiddleware<JwtMiddleware>();
app.UseMiddleware<AuditMiddleware>();

app.MapControllers();

// Health check endpoints
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready");

app.Run();`,

    // JWT Token Service
    'Services/IJwtTokenService.cs': `using {{projectNamePascal}}.Models;
using System.Security.Claims;

namespace {{projectNamePascal}}.Services;

public interface IJwtTokenService
{
    Task<string> GenerateAccessTokenAsync(ApplicationUser user);
    Task<string> GenerateRefreshTokenAsync();
    Task<ClaimsPrincipal?> ValidateTokenAsync(string token);
    Task<bool> IsTokenValidAsync(string token, string userId);
    Task RevokeTokenAsync(string token);
    Task RevokeAllUserTokensAsync(string userId);
    Task<string> GeneratePasswordResetTokenAsync(ApplicationUser user);
    Task<bool> ValidatePasswordResetTokenAsync(ApplicationUser user, string token);
    Task<string> GenerateEmailConfirmationTokenAsync(ApplicationUser user);
    Task<bool> ValidateEmailConfirmationTokenAsync(ApplicationUser user, string token);
}`,

    'Services/JwtTokenService.cs': `using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.Models;
using {{projectNamePascal}}.Infrastructure.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace {{projectNamePascal}}.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtSettings _jwtSettings;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<JwtTokenService> _logger;

    public JwtTokenService(
        IOptions<JwtSettings> jwtSettings,
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext context,
        ILogger<JwtTokenService> logger)
    {
        _jwtSettings = jwtSettings.Value;
        _userManager = userManager;
        _context = context;
        _logger = logger;
    }

    public async Task<string> GenerateAccessTokenAsync(ApplicationUser user)
    {
        var claims = await GetUserClaimsAsync(user);
        
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpirationMinutes),
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        // Store token in database for tracking
        await StoreTokenAsync(user.Id, tokenString, "access", DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpirationMinutes));

        _logger.LogInformation("Generated access token for user {UserId}", user.Id);
        return tokenString;
    }

    public async Task<string> GenerateRefreshTokenAsync()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public async Task<ClaimsPrincipal?> ValidateTokenAsync(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_jwtSettings.SecretKey);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _jwtSettings.Issuer,
                ValidateAudience = true,
                ValidAudience = _jwtSettings.Audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
            
            if (validatedToken is JwtSecurityToken jwtToken && 
                jwtToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return principal;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Token validation failed");
            return null;
        }
    }

    public async Task<bool> IsTokenValidAsync(string token, string userId)
    {
        var storedToken = await _context.UserTokens
            .FirstOrDefaultAsync(t => t.Value == token && t.UserId == int.Parse(userId) && !t.IsRevoked);

        return storedToken != null && storedToken.ExpiryDate > DateTime.UtcNow;
    }

    public async Task RevokeTokenAsync(string token)
    {
        var storedToken = await _context.UserTokens
            .FirstOrDefaultAsync(t => t.Value == token);

        if (storedToken != null)
        {
            storedToken.IsRevoked = true;
            storedToken.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Token revoked: {TokenId}", storedToken.Id);
        }
    }

    public async Task RevokeAllUserTokensAsync(string userId)
    {
        var userTokens = await _context.UserTokens
            .Where(t => t.UserId == int.Parse(userId) && !t.IsRevoked)
            .ToListAsync();

        foreach (var token in userTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("All tokens revoked for user {UserId}", userId);
    }

    public async Task<string> GeneratePasswordResetTokenAsync(ApplicationUser user)
    {
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        
        // Store token for tracking
        await StoreTokenAsync(user.Id, token, "password_reset", DateTime.UtcNow.AddHours(24));
        
        return token;
    }

    public async Task<bool> ValidatePasswordResetTokenAsync(ApplicationUser user, string token)
    {
        var isValid = await _userManager.VerifyUserTokenAsync(
            user, 
            _userManager.Options.Tokens.PasswordResetTokenProvider, 
            "ResetPassword", 
            token);

        if (isValid)
        {
            var storedToken = await _context.UserTokens
                .FirstOrDefaultAsync(t => t.Value == token && t.UserId == user.Id && t.Type == "password_reset");
            
            return storedToken != null && !storedToken.IsRevoked && storedToken.ExpiryDate > DateTime.UtcNow;
        }

        return false;
    }

    public async Task<string> GenerateEmailConfirmationTokenAsync(ApplicationUser user)
    {
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        
        // Store token for tracking
        await StoreTokenAsync(user.Id, token, "email_confirmation", DateTime.UtcNow.AddDays(3));
        
        return token;
    }

    public async Task<bool> ValidateEmailConfirmationTokenAsync(ApplicationUser user, string token)
    {
        var isValid = await _userManager.VerifyUserTokenAsync(
            user, 
            _userManager.Options.Tokens.EmailConfirmationTokenProvider, 
            "EmailConfirmation", 
            token);

        if (isValid)
        {
            var storedToken = await _context.UserTokens
                .FirstOrDefaultAsync(t => t.Value == token && t.UserId == user.Id && t.Type == "email_confirmation");
            
            return storedToken != null && !storedToken.IsRevoked && storedToken.ExpiryDate > DateTime.UtcNow;
        }

        return false;
    }

    private async Task<List<Claim>> GetUserClaimsAsync(ApplicationUser user)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.UserName ?? ""),
            new Claim(ClaimTypes.Email, user.Email ?? ""),
            new Claim("jti", Guid.NewGuid().ToString()),
            new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)};

        if (user.EmailConfirmed)
        {
            claims.Add(new Claim("email_verified", "true"));
        }

        if (user.TwoFactorEnabled)
        {
            claims.Add(new Claim("amr", "mfa"));
        }

        // Add user roles
        var roles = await _userManager.GetRolesAsync(user);
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        // Add custom claims
        var userClaims = await _userManager.GetClaimsAsync(user);
        claims.AddRange(userClaims);

        return claims;
    }

    private async Task StoreTokenAsync(int userId, string tokenValue, string type, DateTime expiryDate)
    {
        var userToken = new UserToken
        {
            UserId = userId,
            Type = type,
            Value = tokenValue,
            CreatedAt = DateTime.UtcNow,
            ExpiryDate = expiryDate,
            IsRevoked = false
        };

        _context.UserTokens.Add(userToken);
        await _context.SaveChangesAsync();
    }
}`,

    // Authentication Service
    'Services/IAuthService.cs': `using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request);
    Task<bool> LogoutAsync(string token);
    Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request);
    Task<bool> ResetPasswordAsync(ResetPasswordRequest request);
    Task<bool> ConfirmEmailAsync(ConfirmEmailRequest request);
    Task<bool> ResendEmailConfirmationAsync(string email);
    Task<TwoFactorResponse> EnableTwoFactorAsync(string userId);
    Task<bool> VerifyTwoFactorAsync(VerifyTwoFactorRequest request);
    Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request);
    Task<ExternalLoginResponse> HandleExternalLoginAsync(string provider, string returnUrl);
}`,

    'Services/AuthService.cs': `using System.Security.Claims;
using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using AutoMapper;

namespace {{projectNamePascal}}.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IJwtTokenService _tokenService;
    private readonly IEmailService _emailService;
    private readonly ISmsService _smsService;
    private readonly ITwoFactorService _twoFactorService;
    private readonly IPasswordService _passwordService;
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IJwtTokenService tokenService,
        IEmailService emailService,
        ISmsService smsService,
        ITwoFactorService twoFactorService,
        IPasswordService passwordService,
        ApplicationDbContext context,
        IMapper mapper,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _emailService = emailService;
        _smsService = smsService;
        _twoFactorService = twoFactorService;
        _passwordService = passwordService;
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                _logger.LogWarning("Login attempt with non-existent email: {Email}", request.Email);
                return new AuthResponse { Success = false, Message = "Invalid credentials" };
            }

            if (!user.EmailConfirmed)
            {
                _logger.LogWarning("Login attempt with unconfirmed email: {Email}", request.Email);
                return new AuthResponse { Success = false, Message = "Please confirm your email before logging in" };
            }

            var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
            
            if (result.IsLockedOut)
            {
                _logger.LogWarning("User account locked out: {UserId}", user.Id);
                return new AuthResponse { Success = false, Message = "Account locked due to multiple failed login attempts" };
            }

            if (result.RequiresTwoFactor)
            {
                var twoFactorToken = await _twoFactorService.GenerateTwoFactorTokenAsync(user);
                await _smsService.SendTwoFactorCodeAsync(user.PhoneNumber!, twoFactorToken);
                
                return new AuthResponse 
                { 
                    Success = false, 
                    RequiresTwoFactor = true,
                    Message = "Two-factor authentication required. Check your SMS for the code." 
                };
            }

            if (!result.Succeeded)
            {
                _logger.LogWarning("Failed login attempt for user: {UserId}", user.Id);
                return new AuthResponse { Success = false, Message = "Invalid credentials" };
            }

            var accessToken = await _tokenService.GenerateAccessTokenAsync(user);
            var refreshToken = await _tokenService.GenerateRefreshTokenAsync();

            // Store refresh token
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("User logged in successfully: {UserId}", user.Id);

            return new AuthResponse
            {
                Success = true,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresAt = DateTime.UtcNow.AddMinutes(60),
                User = _mapper.Map<UserResponse>(user)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for email: {Email}", request.Email);
            return new AuthResponse { Success = false, Message = "An error occurred during login" };
        }
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        try
        {
            var existingUser = await _userManager.FindByEmailAsync(request.Email);
            if (existingUser != null)
            {
                return new AuthResponse { Success = false, Message = "Email already registered" };
            }

            var user = new ApplicationUser
            {
                UserName = request.Email,
                Email = request.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                PhoneNumber = request.PhoneNumber,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                return new AuthResponse { Success = false, Message = errors };
            }

            // Assign default role
            await _userManager.AddToRoleAsync(user, "User");

            // Generate email confirmation token
            var emailToken = await _tokenService.GenerateEmailConfirmationTokenAsync(user);
            await _emailService.SendEmailConfirmationAsync(user.Email, emailToken);

            _logger.LogInformation("User registered successfully: {UserId}", user.Id);

            return new AuthResponse
            {
                Success = true,
                Message = "Registration successful. Please check your email to confirm your account.",
                User = _mapper.Map<UserResponse>(user)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration for email: {Email}", request.Email);
            return new AuthResponse { Success = false, Message = "An error occurred during registration" };
        }
    }

    public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request)
    {
        try
        {
            var principal = await _tokenService.ValidateTokenAsync(request.AccessToken);
            if (principal == null)
            {
                return new AuthResponse { Success = false, Message = "Invalid access token" };
            }

            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var user = await _userManager.FindByIdAsync(userId!);

            if (user == null || user.RefreshToken != request.RefreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                return new AuthResponse { Success = false, Message = "Invalid refresh token" };
            }

            var newAccessToken = await _tokenService.GenerateAccessTokenAsync(user);
            var newRefreshToken = await _tokenService.GenerateRefreshTokenAsync();

            user.RefreshToken = newRefreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _userManager.UpdateAsync(user);

            return new AuthResponse
            {
                Success = true,
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken,
                ExpiresAt = DateTime.UtcNow.AddMinutes(60),
                User = _mapper.Map<UserResponse>(user)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during token refresh");
            return new AuthResponse { Success = false, Message = "An error occurred during token refresh" };
        }
    }

    public async Task<bool> LogoutAsync(string token)
    {
        try
        {
            await _tokenService.RevokeTokenAsync(token);
            _logger.LogInformation("User logged out successfully");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            return false;
        }
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null || !user.EmailConfirmed)
            {
                // Don't reveal that the user does not exist or is not confirmed
                return true;
            }

            var token = await _tokenService.GeneratePasswordResetTokenAsync(user);
            await _emailService.SendPasswordResetAsync(user.Email!, token);

            _logger.LogInformation("Password reset email sent to: {Email}", request.Email);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending password reset email to: {Email}", request.Email);
            return false;
        }
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return false;
            }

            var isValidToken = await _tokenService.ValidatePasswordResetTokenAsync(user, request.Token);
            if (!isValidToken)
            {
                return false;
            }

            var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
            if (result.Succeeded)
            {
                // Revoke all existing tokens
                await _tokenService.RevokeAllUserTokensAsync(user.Id.ToString());
                _logger.LogInformation("Password reset successful for user: {UserId}", user.Id);
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during password reset for email: {Email}", request.Email);
            return false;
        }
    }

    public async Task<bool> ConfirmEmailAsync(ConfirmEmailRequest request)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return false;
            }

            var isValidToken = await _tokenService.ValidateEmailConfirmationTokenAsync(user, request.Token);
            if (!isValidToken)
            {
                return false;
            }

            var result = await _userManager.ConfirmEmailAsync(user, request.Token);
            if (result.Succeeded)
            {
                _logger.LogInformation("Email confirmed for user: {UserId}", user.Id);
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error confirming email for: {Email}", request.Email);
            return false;
        }
    }

    public async Task<bool> ResendEmailConfirmationAsync(string email)
    {
        try
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user == null || user.EmailConfirmed)
            {
                return true; // Don't reveal if user exists or is already confirmed
            }

            var token = await _tokenService.GenerateEmailConfirmationTokenAsync(user);
            await _emailService.SendEmailConfirmationAsync(user.Email!, token);

            _logger.LogInformation("Email confirmation resent to: {Email}", email);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resending email confirmation to: {Email}", email);
            return false;
        }
    }

    public async Task<TwoFactorResponse> EnableTwoFactorAsync(string userId)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return new TwoFactorResponse { Success = false, Message = "User not found" };
            }

            var authenticatorKey = await _userManager.GetAuthenticatorKeyAsync(user);
            if (string.IsNullOrEmpty(authenticatorKey))
            {
                await _userManager.ResetAuthenticatorKeyAsync(user);
                authenticatorKey = await _userManager.GetAuthenticatorKeyAsync(user);
            }

            var qrCodeUri = _twoFactorService.GenerateQrCodeUri(user.Email!, authenticatorKey!);

            return new TwoFactorResponse
            {
                Success = true,
                AuthenticatorKey = authenticatorKey,
                QrCodeUri = qrCodeUri
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error enabling two-factor authentication for user: {UserId}", userId);
            return new TwoFactorResponse { Success = false, Message = "An error occurred" };
        }
    }

    public async Task<bool> VerifyTwoFactorAsync(VerifyTwoFactorRequest request)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(request.UserId);
            if (user == null)
            {
                return false;
            }

            var isValid = await _userManager.VerifyTwoFactorTokenAsync(user, _userManager.Options.Tokens.AuthenticatorTokenProvider, request.Code);
            if (isValid)
            {
                await _userManager.SetTwoFactorEnabledAsync(user, true);
                _logger.LogInformation("Two-factor authentication enabled for user: {UserId}", user.Id);
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying two-factor code for user: {UserId}", request.UserId);
            return false;
        }
    }

    public async Task<bool> ChangePasswordAsync(string userId, ChangePasswordRequest request)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return false;
            }

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (result.Succeeded)
            {
                // Revoke all existing tokens
                await _tokenService.RevokeAllUserTokensAsync(userId);
                _logger.LogInformation("Password changed for user: {UserId}", userId);
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing password for user: {UserId}", userId);
            return false;
        }
    }

    public async Task<ExternalLoginResponse> HandleExternalLoginAsync(string provider, string returnUrl)
    {
        try
        {
            var info = await _signInManager.GetExternalLoginInfoAsync();
            if (info == null)
            {
                return new ExternalLoginResponse { Success = false, Message = "Error loading external login information" };
            }

            // Sign in the user with this external login provider if the user already has a login
            var result = await _signInManager.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, isPersistent: false, bypassTwoFactor: true);
            
            if (result.Succeeded)
            {
                var user = await _userManager.FindByLoginAsync(info.LoginProvider, info.ProviderKey);
                var token = await _tokenService.GenerateAccessTokenAsync(user!);
                
                return new ExternalLoginResponse 
                { 
                    Success = true, 
                    AccessToken = token,
                    User = _mapper.Map<UserResponse>(user)
                };
            }

            if (result.IsLockedOut)
            {
                return new ExternalLoginResponse { Success = false, Message = "Account locked" };
            }

            // If the user does not have an account, then ask the user to create an account
            var email = info.Principal.FindFirstValue(ClaimTypes.Email);
            if (string.IsNullOrEmpty(email))
            {
                return new ExternalLoginResponse { Success = false, Message = "Email not provided by external provider" };
            }

            var existingUser = await _userManager.FindByEmailAsync(email);
            if (existingUser != null)
            {
                // Link the external login to existing user
                var addLoginResult = await _userManager.AddLoginAsync(existingUser, info);
                if (addLoginResult.Succeeded)
                {
                    await _signInManager.SignInAsync(existingUser, isPersistent: false);
                    var token = await _tokenService.GenerateAccessTokenAsync(existingUser);
                    
                    return new ExternalLoginResponse 
                    { 
                        Success = true, 
                        AccessToken = token,
                        User = _mapper.Map<UserResponse>(existingUser)
                    };
                }
            }

            return new ExternalLoginResponse 
            { 
                Success = false, 
                RequiresRegistration = true,
                Email = email,
                Provider = provider
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling external login");
            return new ExternalLoginResponse { Success = false, Message = "An error occurred during external login" };
        }
    }
}`,

    // JWT Settings Configuration
    'Infrastructure/Security/JwtSettings.cs': `namespace {{projectNamePascal}}.Infrastructure.Security;

public class JwtSettings
{
    public string SecretKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int AccessTokenExpirationMinutes { get; set; } = 60;
    public int RefreshTokenExpirationDays { get; set; } = 7;
    public bool RequireHttpsMetadata { get; set; } = true;
    public bool SaveToken { get; set; } = true;
    public bool ValidateIssuer { get; set; } = true;
    public bool ValidateAudience { get; set; } = true;
    public bool ValidateLifetime { get; set; } = true;
    public bool ValidateIssuerSigningKey { get; set; } = true;
    public int ClockSkewMinutes { get; set; } = 5;
}`,

    // Enhanced User model with JWT support
    'Models/ApplicationUser.cs': `using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace {{projectNamePascal}}.Models;

public class ApplicationUser : IdentityUser<int>
{
    [Required]
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }

    // Navigation properties
    public virtual ICollection<UserToken> UserTokens { get; set; } = new List<UserToken>();
    public virtual ICollection<UserLogin> UserLogins { get; set; } = new List<UserLogin>();
    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public string FullName => $"{FirstName} {LastName}";
}`,

    'Models/UserToken.cs': `using System.ComponentModel.DataAnnotations;

namespace {{projectNamePascal}}.Models;

public class UserToken
{
    public int Id { get; set; }
    
    public int UserId { get; set; }
    public virtual ApplicationUser User { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty; // access, refresh, password_reset, email_confirmation

    [Required]
    public string Value { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiryDate { get; set; }
    
    public bool IsRevoked { get; set; } = false;
    public DateTime? RevokedAt { get; set; }
    
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}`,

    // Authentication Controller
    'Controllers/AuthController.cs': `using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{projectNamePascal}}.Services;
using {{projectNamePascal}}.DTOs;
using FluentValidation;
using Swashbuckle.AspNetCore.Annotations;

namespace {{projectNamePascal}}.Controllers;

/// <summary>
/// Handles authentication and authorization operations
/// </summary>
[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
[SwaggerTag("Authentication", "User authentication, registration, and token management")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IValidator<LoginRequest> _loginValidator;
    private readonly IValidator<RegisterRequest> _registerValidator;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        IValidator<LoginRequest> loginValidator,
        IValidator<RegisterRequest> registerValidator,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _loginValidator = loginValidator;
        _registerValidator = registerValidator;
        _logger = logger;
    }

    /// <summary>
    /// Authenticates a user and returns JWT tokens
    /// </summary>
    /// <param name="request">Login credentials</param>
    /// <returns>Authentication response with tokens</returns>
    [HttpPost("login")]
    [SwaggerOperation(
        Summary = "User login",
        Description = "Authenticates user credentials and returns access and refresh tokens"
    )]
    [SwaggerResponse(200, "Login successful", typeof(AuthResponse))]
    [SwaggerResponse(400, "Invalid credentials or validation errors", typeof(ErrorResponse))]
    [SwaggerResponse(423, "Account locked", typeof(ErrorResponse))]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var validationResult = await _loginValidator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            var errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage);
            return BadRequest(new ValidationErrorResponse { Errors = errors });
        }

        var result = await _authService.LoginAsync(request);
        
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse { Message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Registers a new user account
    /// </summary>
    /// <param name="request">Registration details</param>
    /// <returns>Registration response</returns>
    [HttpPost("register")]
    [SwaggerOperation(
        Summary = "User registration",
        Description = "Creates a new user account and sends email verification"
    )]
    [SwaggerResponse(201, "Registration successful", typeof(AuthResponse))]
    [SwaggerResponse(400, "Invalid data or user already exists", typeof(ErrorResponse))]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var validationResult = await _registerValidator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            var errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage);
            return BadRequest(new ValidationErrorResponse { Errors = errors });
        }

        var result = await _authService.RegisterAsync(request);
        
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse { Message = result.Message });
        }

        return CreatedAtAction(nameof(Register), result);
    }

    /// <summary>
    /// Refreshes JWT access token using refresh token
    /// </summary>
    /// <param name="request">Refresh token request</param>
    /// <returns>New access and refresh tokens</returns>
    [HttpPost("refresh")]
    [SwaggerOperation(
        Summary = "Refresh access token",
        Description = "Generates new access token using valid refresh token"
    )]
    [SwaggerResponse(200, "Token refreshed successfully", typeof(AuthResponse))]
    [SwaggerResponse(400, "Invalid refresh token", typeof(ErrorResponse))]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request);
        
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse { Message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Logs out the current user and revokes tokens
    /// </summary>
    /// <returns>Logout confirmation</returns>
    [HttpPost("logout")]
    [Authorize]
    [SwaggerOperation(
        Summary = "User logout",
        Description = "Revokes user tokens and logs out the current session"
    )]
    [SwaggerResponse(200, "Logout successful")]
    [SwaggerResponse(401, "Unauthorized")]
    public async Task<IActionResult> Logout()
    {
        var token = Request.Headers.Authorization.ToString().Replace("Bearer ", "");
        await _authService.LogoutAsync(token);
        
        return Ok(new { message = "Logout successful" });
    }

    /// <summary>
    /// Initiates password reset process
    /// </summary>
    /// <param name="request">Forgot password request</param>
    /// <returns>Reset confirmation</returns>
    [HttpPost("forgot-password")]
    [SwaggerOperation(
        Summary = "Forgot password",
        Description = "Sends password reset email to the user"
    )]
    [SwaggerResponse(200, "Password reset email sent")]
    [SwaggerResponse(400, "Invalid email", typeof(ErrorResponse))]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        await _authService.ForgotPasswordAsync(request);
        return Ok(new { message = "If the email exists, a password reset link has been sent" });
    }

    /// <summary>
    /// Resets user password using reset token
    /// </summary>
    /// <param name="request">Reset password request</param>
    /// <returns>Reset confirmation</returns>
    [HttpPost("reset-password")]
    [SwaggerOperation(
        Summary = "Reset password",
        Description = "Resets user password using the reset token from email"
    )]
    [SwaggerResponse(200, "Password reset successful")]
    [SwaggerResponse(400, "Invalid token or request", typeof(ErrorResponse))]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var result = await _authService.ResetPasswordAsync(request);
        
        if (!result)
        {
            return BadRequest(new ErrorResponse { Message = "Invalid token or request" });
        }

        return Ok(new { message = "Password reset successful" });
    }

    /// <summary>
    /// Confirms user email address
    /// </summary>
    /// <param name="request">Email confirmation request</param>
    /// <returns>Confirmation result</returns>
    [HttpPost("confirm-email")]
    [SwaggerOperation(
        Summary = "Confirm email",
        Description = "Confirms user email address using the confirmation token"
    )]
    [SwaggerResponse(200, "Email confirmed successfully")]
    [SwaggerResponse(400, "Invalid token", typeof(ErrorResponse))]
    public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailRequest request)
    {
        var result = await _authService.ConfirmEmailAsync(request);
        
        if (!result)
        {
            return BadRequest(new ErrorResponse { Message = "Invalid confirmation token" });
        }

        return Ok(new { message = "Email confirmed successfully" });
    }

    /// <summary>
    /// Resends email confirmation
    /// </summary>
    /// <param name="email">User email address</param>
    /// <returns>Resend confirmation</returns>
    [HttpPost("resend-confirmation")]
    [SwaggerOperation(
        Summary = "Resend email confirmation",
        Description = "Resends email confirmation link to the user"
    )]
    [SwaggerResponse(200, "Confirmation email sent")]
    public async Task<IActionResult> ResendEmailConfirmation([FromBody] string email)
    {
        await _authService.ResendEmailConfirmationAsync(email);
        return Ok(new { message = "If the email exists and is not confirmed, a confirmation link has been sent" });
    }

    /// <summary>
    /// Enables two-factor authentication for user
    /// </summary>
    /// <returns>Two-factor setup information</returns>
    [HttpPost("enable-2fa")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Enable two-factor authentication",
        Description = "Generates QR code and setup key for two-factor authentication"
    )]
    [SwaggerResponse(200, "Two-factor setup information", typeof(TwoFactorResponse))]
    [SwaggerResponse(401, "Unauthorized")]
    public async Task<ActionResult<TwoFactorResponse>> EnableTwoFactor()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var result = await _authService.EnableTwoFactorAsync(userId);
        
        if (!result.Success)
        {
            return BadRequest(new ErrorResponse { Message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Verifies two-factor authentication code
    /// </summary>
    /// <param name="request">Verification request</param>
    /// <returns>Verification result</returns>
    [HttpPost("verify-2fa")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Verify two-factor authentication",
        Description = "Verifies the two-factor authentication code and completes setup"
    )]
    [SwaggerResponse(200, "Two-factor authentication verified")]
    [SwaggerResponse(400, "Invalid code", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized")]
    public async Task<IActionResult> VerifyTwoFactor([FromBody] VerifyTwoFactorRequest request)
    {
        var result = await _authService.VerifyTwoFactorAsync(request);
        
        if (!result)
        {
            return BadRequest(new ErrorResponse { Message = "Invalid verification code" });
        }

        return Ok(new { message = "Two-factor authentication enabled successfully" });
    }

    /// <summary>
    /// Changes user password
    /// </summary>
    /// <param name="request">Change password request</param>
    /// <returns>Change confirmation</returns>
    [HttpPost("change-password")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Change password",
        Description = "Changes the current user's password"
    )]
    [SwaggerResponse(200, "Password changed successfully")]
    [SwaggerResponse(400, "Invalid current password", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var result = await _authService.ChangePasswordAsync(userId, request);
        
        if (!result)
        {
            return BadRequest(new ErrorResponse { Message = "Invalid current password" });
        }

        return Ok(new { message = "Password changed successfully" });
    }
}`,

    // JWT configuration in appsettings
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{projectName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true"
  },
  "JwtSettings": {
    "SecretKey": "YourSecretKeyHereChangeInProduction123456789",
    "Issuer": "{{projectName}}",
    "Audience": "{{projectName}}Users",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 7,
    "RequireHttpsMetadata": false,
    "SaveToken": true,
    "ValidateIssuer": true,
    "ValidateAudience": true,
    "ValidateLifetime": true,
    "ValidateIssuerSigningKey": true,
    "ClockSkewMinutes": 5
  },
  "Authentication": {
    "Google": {
      "ClientId": "",
      "ClientSecret": ""
    },
    "Facebook": {
      "AppId": "",
      "AppSecret": ""
    },
    "Microsoft": {
      "ClientId": "",
      "ClientSecret": ""
    }
  },
  "IpRateLimiting": {
    "EnableEndpointRateLimiting": true,
    "StackBlockedRequests": false,
    "RealIpHeader": "X-Real-IP",
    "ClientIdHeader": "X-ClientId",
    "GeneralRules": [
      {
        "Endpoint": "*",
        "Period": "1m",
        "Limit": 60
      },
      {
        "Endpoint": "*",
        "Period": "1h",
        "Limit": 1000
      },
      {
        "Endpoint": "POST:/api/v1/auth/login",
        "Period": "1m",
        "Limit": 5
      },
      {
        "Endpoint": "POST:/api/v1/auth/register",
        "Period": "1h",
        "Limit": 10
      }
    ]
  },
  "Cors": {
    "AllowedOrigins": ["https://localhost:3000", "https://yourdomain.com"]
  },
  "Serilog": {
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
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} <s:{SourceContext}>{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/{{projectName}}.log",
          "rollingInterval": "Day",
          "retainedFileCountLimit": 7
        }
      }
    ]
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}`,

    // Production configuration
    'appsettings.Production.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=productionserver;Database={{projectName}}ProdDb;User Id=appuser;Password=securepassword;TrustServerCertificate=true"
  },
  "JwtSettings": {
    "SecretKey": "ProductionSecretKeyAtLeast32CharactersLong!",
    "RequireHttpsMetadata": true,
    "AccessTokenExpirationMinutes": 30,
    "RefreshTokenExpirationDays": 1
  },
  "IpRateLimiting": {
    "GeneralRules": [
      {
        "Endpoint": "*",
        "Period": "1m",
        "Limit": 30
      },
      {
        "Endpoint": "*",
        "Period": "1h",
        "Limit": 500
      },
      {
        "Endpoint": "POST:/api/v1/auth/login",
        "Period": "1m",
        "Limit": 3
      },
      {
        "Endpoint": "POST:/api/v1/auth/register",
        "Period": "1h",
        "Limit": 5
      }
    ]
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Warning",
      "Override": {
        "{{projectName}}": "Information",
        "Microsoft": "Error",
        "System": "Error"
      }
    }
  }
}`,

    // README for JWT Authentication
    'docs/JWT_AUTHENTICATION.md': `# JWT Authentication Guide

## Overview

This {{projectName}} API implements comprehensive JWT (JSON Web Token) authentication with support for:

- User registration and email verification
- Login with JWT token generation
- Token refresh mechanism
- Password reset functionality
- Two-factor authentication (2FA)
- External OAuth providers (Google, Facebook, Microsoft)
- Role-based authorization
- Rate limiting
- Account lockout protection

## Features

### 🔐 Security Features
- JWT access and refresh tokens
- Password hashing with BCrypt
- Account lockout after failed attempts
- Rate limiting on authentication endpoints
- Two-factor authentication support
- External OAuth integration
- Email verification required
- Secure password reset flow

### 🛡️ Token Management
- Short-lived access tokens (configurable)
- Long-lived refresh tokens
- Token revocation on logout
- Automatic token cleanup
- Correlation tracking

### 📧 Communication
- Email verification
- Password reset emails
- SMS for 2FA codes
- Account lockout notifications

## Authentication Flow

### 1. User Registration

\`\`\`http
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "phoneNumber": "+1-555-123-4567"
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "message": "Registration successful. Please check your email to confirm your account.",
  "user": {
    "id": 1,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
\`\`\`

### 2. Email Confirmation

\`\`\`http
POST /api/v1/auth/confirm-email
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "token": "confirmation-token-from-email"
}
\`\`\`

### 3. User Login

\`\`\`http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "ZGFzZGFzZGFzZGFzZGFzZGFzZA==",
  "expiresAt": "2024-01-01T12:00:00Z",
  "user": {
    "id": 1,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["User"]
  }
}
\`\`\`

### 4. Using Access Token

Include the access token in the Authorization header:

\`\`\`http
GET /api/v1/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

### 5. Token Refresh

\`\`\`http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "accessToken": "expired-or-valid-access-token",
  "refreshToken": "valid-refresh-token"
}
\`\`\`

## Authorization Policies

### Built-in Policies

- **AdminOnly**: Requires Admin role
- **ModeratorOrAdmin**: Requires Moderator or Admin role
- **EmailConfirmed**: Requires verified email
- **TwoFactorEnabled**: Requires 2FA enabled
- **MinimumAge**: Requires user to be 18+
- **SameUserOrAdmin**: Resource owner or admin only

### Usage Examples

\`\`\`csharp
[Authorize(Policy = "AdminOnly")]
public async Task<IActionResult> GetAllUsers() { }

[Authorize(Policy = "SameUserOrAdmin")]
public async Task<IActionResult> UpdateUser(int id) { }

[Authorize(Policy = "EmailConfirmed")]
public async Task<IActionResult> CreatePost() { }
\`\`\`

## Two-Factor Authentication

### 1. Enable 2FA

\`\`\`http
POST /api/v1/auth/enable-2fa
Authorization: Bearer <access-token>
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "authenticatorKey": "JBSWY3DPEHPK3PXP",
  "qrCodeUri": "otpauth://totp/MyApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp"
}
\`\`\`

### 2. Verify 2FA Setup

\`\`\`http
POST /api/v1/auth/verify-2fa
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "userId": "1",
  "code": "123456"
}
\`\`\`

## Password Management

### Forgot Password

\`\`\`http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "john.doe@example.com"
}
\`\`\`

### Reset Password

\`\`\`http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123!"
}
\`\`\`

### Change Password

\`\`\`http
POST /api/v1/auth/change-password
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewPassword123!"
}
\`\`\`

## Rate Limiting

### Default Limits

- General endpoints: 60 requests/minute, 1000 requests/hour
- Login: 5 attempts/minute
- Registration: 10 attempts/hour

### Rate Limit Headers

Responses include rate limit information:
\`\`\`
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
\`\`\`

## External OAuth

### Supported Providers

- Google
- Facebook
- Microsoft

### Configuration

Set up OAuth applications and configure in appsettings.json:

\`\`\`json
{
  "Authentication": {
    "Google": {
      "ClientId": "your-google-client-id",
      "ClientSecret": "your-google-client-secret"
    },
    "Facebook": {
      "AppId": "your-facebook-app-id",
      "AppSecret": "your-facebook-app-secret"
    },
    "Microsoft": {
      "ClientId": "your-microsoft-client-id",
      "ClientSecret": "your-microsoft-client-secret"
    }
  }
}
\`\`\`

## Security Best Practices

### 1. Token Security
- Use HTTPS in production
- Store tokens securely on client
- Implement token rotation
- Set appropriate expiration times

### 2. Password Security
- Enforce strong password policies
- Use BCrypt for hashing
- Implement account lockout
- Monitor failed login attempts

### 3. Rate Limiting
- Configure appropriate limits
- Monitor for abuse patterns
- Implement progressive delays
- Use IP-based limiting

### 4. Email Security
- Verify email ownership
- Use secure email templates
- Implement email rate limiting
- Monitor suspicious patterns

## Error Handling

### Common Error Responses

#### 400 Bad Request
\`\`\`json
{
  "message": "Invalid credentials",
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "abc123"
}
\`\`\`

#### 401 Unauthorized
\`\`\`json
{
  "message": "Token expired or invalid",
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`

#### 423 Locked
\`\`\`json
{
  "message": "Account locked due to multiple failed login attempts",
  "lockoutEnd": "2024-01-01T00:15:00Z"
}
\`\`\`

#### 429 Too Many Requests
\`\`\`json
{
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
\`\`\`

## Configuration

### JWT Settings

\`\`\`json
{
  "JwtSettings": {
    "SecretKey": "your-secret-key-at-least-32-chars",
    "Issuer": "YourApp",
    "Audience": "YourAppUsers",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 7,
    "RequireHttpsMetadata": true
  }
}
\`\`\`

### Identity Settings

Password requirements, lockout settings, and user options are configured in Program.cs.

## Monitoring and Logging

### Logged Events
- Login attempts (success/failure)
- Token generation and validation
- Password changes
- Account lockouts
- 2FA setup and verification
- External login attempts

### Metrics to Monitor
- Failed login rate
- Token refresh frequency
- Account lockout frequency
- 2FA adoption rate
- External login usage

## Testing

### Unit Tests
- Token generation and validation
- Password hashing and verification
- Rate limiting logic
- Authorization policies

### Integration Tests
- Authentication flows
- Token refresh scenarios
- Password reset workflows
- 2FA setup and verification

### Security Tests
- Token tampering attempts
- Rate limiting validation
- Account lockout testing
- CORS policy verification
`,

    'DTOs/AuthDtos.cs': `using System.ComponentModel.DataAnnotations;

namespace {{projectNamePascal}}.DTOs;

public class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string ConfirmPassword { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Phone]
    public string? PhoneNumber { get; set; }
}

public class RefreshTokenRequest
{
    [Required]
    public string AccessToken { get; set; } = string.Empty;

    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;
}

public class ConfirmEmailRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;
}

public class VerifyTwoFactorRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Code { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    public string NewPassword { get; set; } = string.Empty;
}

public class UserResponse
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool EmailConfirmed { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class AuthResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool RequiresTwoFactor { get; set; }
    public UserResponse? User { get; set; }
}

public class TwoFactorResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? AuthenticatorKey { get; set; }
    public string? QrCodeUri { get; set; }
}

public class ExternalLoginResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? AccessToken { get; set; }
    public UserResponse? User { get; set; }
    public bool RequiresRegistration { get; set; }
    public string? Email { get; set; }
    public string? Provider { get; set; }
}

public class ErrorResponse
{
    public string? Message { get; set; }
}

public class ValidationErrorResponse
{
    public Dictionary<string, string> Errors { get; set; } = new();
}
`,

    'Data/ApplicationDbContext.cs': `using {{projectNamePascal}}.Models;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace {{projectNamePascal}}.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<int>, int>, IDataProtectionKeyContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<UserToken> UserTokens => Set<UserToken>();
    public DbSet<UserLogin> UserLogins => Set<UserLogin>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Keys used by ASP.NET Core data protection (see Program.cs)
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(u => u.Email);
            entity.HasQueryFilter(u => !u.IsDeleted);
        });

        builder.Entity<UserToken>(entity =>
        {
            entity.HasIndex(t => new { t.UserId, t.Type });
            entity.HasOne(t => t.User).WithMany(u => u.UserTokens).HasForeignKey(t => t.UserId);
        });

        builder.Entity<UserLogin>(entity =>
        {
            entity.HasOne(l => l.User).WithMany(u => u.UserLogins).HasForeignKey(l => l.UserId);
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.HasIndex(a => a.Timestamp);
            entity.HasOne(a => a.User).WithMany(u => u.AuditLogs).HasForeignKey(a => a.UserId);
        });

        // Roles used by the authorization policies in Program.cs
        builder.Entity<IdentityRole<int>>().HasData(
            new IdentityRole<int> { Id = 1, Name = "User", NormalizedName = "USER", ConcurrencyStamp = "role-user" },
            new IdentityRole<int> { Id = 2, Name = "Moderator", NormalizedName = "MODERATOR", ConcurrencyStamp = "role-moderator" },
            new IdentityRole<int> { Id = 3, Name = "Admin", NormalizedName = "ADMIN", ConcurrencyStamp = "role-admin" });
    }
}
`,

    'Infrastructure/Middleware/AuditMiddleware.cs': `using System.Security.Claims;
using {{projectNamePascal}}.Data;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Infrastructure.Middleware;

/// <summary>Records every state-changing request (POST, PUT, PATCH, DELETE) in the audit log.</summary>
public class AuditMiddleware
{
    private static readonly HashSet<string> AuditedMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post, HttpMethods.Put, HttpMethods.Patch, HttpMethods.Delete
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<AuditMiddleware> _logger;

    public AuditMiddleware(RequestDelegate next, ILogger<AuditMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext dbContext)
    {
        await _next(context);

        if (!AuditedMethods.Contains(context.Request.Method))
        {
            return;
        }

        try
        {
            var userId = int.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (int?)null;

            dbContext.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                Action = $"{context.Request.Method} {context.Request.Path}",
                Path = context.Request.Path,
                StatusCode = context.Response.StatusCode,
                IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                Timestamp = DateTime.UtcNow
            });
            await dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Auditing must never break the request
            _logger.LogError(ex, "Could not write the audit log entry");
        }
    }
}
`,

    'Infrastructure/Middleware/JwtMiddleware.cs': `using System.Security.Claims;
using {{projectNamePascal}}.Services;

namespace {{projectNamePascal}}.Infrastructure.Middleware;

/// <summary>
/// Rejects access tokens that were revoked (logout, password change): a signed token is only
/// honored while its record in the token store is still valid.
/// </summary>
public class JwtMiddleware
{
    private readonly RequestDelegate _next;

    public JwtMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IJwtTokenService tokenService)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var token = context.Request.Headers.Authorization.ToString().Replace("Bearer ", string.Empty);
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!string.IsNullOrEmpty(token) && !string.IsNullOrEmpty(userId) && !await tokenService.IsTokenValidAsync(token, userId))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { message = "Token has been revoked or has expired" });
                return;
            }
        }

        await _next(context);
    }
}
`,

    'Infrastructure/Middleware/SecurityHeadersMiddleware.cs': `namespace {{projectNamePascal}}.Infrastructure.Middleware;

/// <summary>Adds the standard hardening headers to every response.</summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["X-XSS-Protection"] = "0";
        headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";

        await _next(context);
    }
}
`,

    'Infrastructure/Security/AuthorizationRequirements.cs': `using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;

namespace {{projectNamePascal}}.Infrastructure.Security;

/// <summary>Requires a "date_of_birth" claim (yyyy-MM-dd) that makes the user at least N years old.</summary>
public class MinimumAgeRequirement : IAuthorizationRequirement
{
    public MinimumAgeRequirement(int minimumAge) => MinimumAge = minimumAge;

    public int MinimumAge { get; }
}

public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, MinimumAgeRequirement requirement)
    {
        var claim = context.User.FindFirst("date_of_birth");
        if (claim != null && DateTime.TryParse(claim.Value, out var dateOfBirth))
        {
            var today = DateTime.UtcNow.Date;
            var age = today.Year - dateOfBirth.Year;
            if (dateOfBirth.Date > today.AddYears(-age))
            {
                age--;
            }

            if (age >= requirement.MinimumAge)
            {
                context.Succeed(requirement);
            }
        }

        return Task.CompletedTask;
    }
}

/// <summary>The caller may act on the user in the route ("id") or must be an Admin.</summary>
public class SameUserOrAdminRequirement : IAuthorizationRequirement
{
}

public class SameUserOrAdminHandler : AuthorizationHandler<SameUserOrAdminRequirement>
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SameUserOrAdminHandler(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, SameUserOrAdminRequirement requirement)
    {
        if (context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var routeId = _httpContextAccessor.HttpContext?.Request.RouteValues["id"]?.ToString();
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (routeId != null && routeId == userId)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
`,

    'Infrastructure/Security/EmailConfirmationTokenProvider.cs': `using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace {{projectNamePascal}}.Infrastructure.Security;

public class EmailConfirmationTokenProviderOptions : DataProtectionTokenProviderOptions
{
    public EmailConfirmationTokenProviderOptions()
    {
        Name = "EmailConfirmationTokenProvider";
        TokenLifespan = TimeSpan.FromDays(3);
    }
}

/// <summary>Data-protection token provider with its own (longer) lifespan for email confirmation.</summary>
public class EmailConfirmationTokenProvider<TUser> : DataProtectorTokenProvider<TUser> where TUser : class
{
    public EmailConfirmationTokenProvider(
        IDataProtectionProvider dataProtectionProvider,
        IOptions<EmailConfirmationTokenProviderOptions> options,
        ILogger<DataProtectorTokenProvider<TUser>> logger)
        : base(dataProtectionProvider, options, logger)
    {
    }
}
`,

    'Models/AuditLog.cs': `using System.ComponentModel.DataAnnotations;

namespace {{projectNamePascal}}.Models;

public class AuditLog
{
    public int Id { get; set; }

    public int? UserId { get; set; }
    public virtual ApplicationUser? User { get; set; }

    [Required, MaxLength(200)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Path { get; set; }

    public int StatusCode { get; set; }
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
`,

    'Models/UserLogin.cs': `namespace {{projectNamePascal}}.Models;

/// <summary>A successful or failed sign-in attempt, kept for security auditing.</summary>
public class UserLogin
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public virtual ApplicationUser User { get; set; } = null!;

    public DateTime LoggedInAt { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public bool Succeeded { get; set; }
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
        CreateMap<ApplicationUser, UserResponse>()
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src => src.UserName ?? string.Empty))
            .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.Email ?? string.Empty));
    }
}
`,

    'Services/EmailService.cs': `using SendGrid;
using SendGrid.Helpers.Mail;

namespace {{projectNamePascal}}.Services;

/// <summary>
/// Sends mail through SendGrid when SendGrid:ApiKey is configured; otherwise the message is only
/// logged, which is what you want in development.
/// </summary>
public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task SendEmailConfirmationAsync(string email, string token) =>
        SendAsync(email, "Confirm your email address",
            $"Use this token to confirm your email address: {token}");

    public Task SendPasswordResetAsync(string email, string token) =>
        SendAsync(email, "Reset your password",
            $"Use this token to reset your password: {token}");

    private async Task SendAsync(string to, string subject, string body)
    {
        var apiKey = _configuration["SendGrid:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogInformation("SendGrid is not configured; email to {To} not sent: {Subject} / {Body}", to, subject, body);
            return;
        }

        var from = new EmailAddress(_configuration["SendGrid:FromEmail"] ?? "noreply@example.com", _configuration["SendGrid:FromName"] ?? "{{projectNamePascal}}");
        var message = MailHelper.CreateSingleEmail(from, new EmailAddress(to), subject, body, body);
        var response = await new SendGridClient(apiKey).SendEmailAsync(message);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("SendGrid rejected the email to {To}: {Status}", to, response.StatusCode);
        }
    }
}
`,

    'Services/IEmailService.cs': `namespace {{projectNamePascal}}.Services;

public interface IEmailService
{
    Task SendEmailConfirmationAsync(string email, string token);
    Task SendPasswordResetAsync(string email, string token);
}
`,

    'Services/IPasswordService.cs': `namespace {{projectNamePascal}}.Services;

public interface IPasswordService
{
    string GenerateTemporaryPassword(int length = 16);
    bool MeetsPolicy(string password);
}
`,

    'Services/ISmsService.cs': `namespace {{projectNamePascal}}.Services;

public interface ISmsService
{
    Task SendTwoFactorCodeAsync(string phoneNumber, string code);
}
`,

    'Services/ITwoFactorService.cs': `using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public interface ITwoFactorService
{
    /// <summary>Generates a short-lived code that is delivered by SMS.</summary>
    Task<string> GenerateTwoFactorTokenAsync(ApplicationUser user);

    /// <summary>Builds the otpauth:// URI authenticator apps scan as a QR code.</summary>
    string GenerateQrCodeUri(string email, string authenticatorKey);
}
`,

    'Services/IUserClaimsService.cs': `using System.Security.Claims;
using {{projectNamePascal}}.Models;

namespace {{projectNamePascal}}.Services;

public interface IUserClaimsService
{
    Task<IList<Claim>> GetClaimsAsync(ApplicationUser user);
}
`,

    'Services/IUserService.cs': `using {{projectNamePascal}}.DTOs;

namespace {{projectNamePascal}}.Services;

public interface IUserService
{
    Task<UserResponse?> GetByIdAsync(int id);
    Task<IReadOnlyList<UserResponse>> ListAsync(int page = 1, int pageSize = 20);
    Task<bool> DeactivateAsync(int id);
}
`,

    'Services/PasswordService.cs': `using System.Security.Cryptography;

namespace {{projectNamePascal}}.Services;

public class PasswordService : IPasswordService
{
    private const string Lower = "abcdefghijkmnopqrstuvwxyz";
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Digits = "23456789";
    private const string Symbols = "!@#$%^&*-_=+?";

    public string GenerateTemporaryPassword(int length = 16)
    {
        if (length < 8)
        {
            throw new ArgumentOutOfRangeException(nameof(length), "A password needs at least 8 characters.");
        }

        // One character of each class first, then fill from the full alphabet
        var all = Lower + Upper + Digits + Symbols;
        var characters = new List<char>
        {
            Pick(Lower), Pick(Upper), Pick(Digits), Pick(Symbols)
        };

        while (characters.Count < length)
        {
            characters.Add(Pick(all));
        }

        // Fisher-Yates shuffle with a cryptographic source
        for (var i = characters.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (characters[i], characters[j]) = (characters[j], characters[i]);
        }

        return new string(characters.ToArray());
    }

    /// <summary>Mirrors the Identity password options configured in Program.cs.</summary>
    public bool MeetsPolicy(string password) =>
        password.Length >= 8
        && password.Any(char.IsDigit)
        && password.Any(char.IsLower)
        && password.Any(char.IsUpper)
        && password.Any(c => !char.IsLetterOrDigit(c));

    private static char Pick(string alphabet) => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
}
`,

    'Services/SmsService.cs': `using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace {{projectNamePascal}}.Services;

/// <summary>
/// Sends SMS through Twilio when Twilio:AccountSid, Twilio:AuthToken and Twilio:FromNumber are
/// configured; otherwise the code is only logged (development).
/// </summary>
public class SmsService : ISmsService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmsService> _logger;

    public SmsService(IConfiguration configuration, ILogger<SmsService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendTwoFactorCodeAsync(string phoneNumber, string code)
    {
        var accountSid = _configuration["Twilio:AccountSid"];
        var authToken = _configuration["Twilio:AuthToken"];
        var fromNumber = _configuration["Twilio:FromNumber"];

        if (string.IsNullOrWhiteSpace(accountSid) || string.IsNullOrWhiteSpace(authToken) || string.IsNullOrWhiteSpace(fromNumber))
        {
            _logger.LogInformation("Twilio is not configured; two-factor code for {Phone} not sent", phoneNumber);
            return;
        }

        TwilioClient.Init(accountSid, authToken);
        await MessageResource.CreateAsync(
            to: new PhoneNumber(phoneNumber),
            from: new PhoneNumber(fromNumber),
            body: $"Your verification code is {code}");
    }
}
`,

    'Services/TwoFactorService.cs': `using {{projectNamePascal}}.Models;
using Microsoft.AspNetCore.Identity;
using System.Text.Encodings.Web;

namespace {{projectNamePascal}}.Services;

public class TwoFactorService : ITwoFactorService
{
    private const string Issuer = "{{projectNamePascal}}";

    private readonly UserManager<ApplicationUser> _userManager;

    public TwoFactorService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public Task<string> GenerateTwoFactorTokenAsync(ApplicationUser user) =>
        _userManager.GenerateTwoFactorTokenAsync(user, TokenOptions.DefaultPhoneProvider);

    public string GenerateQrCodeUri(string email, string authenticatorKey)
    {
        var encoder = UrlEncoder.Default;
        return $"otpauth://totp/{encoder.Encode(Issuer)}:{encoder.Encode(email)}?secret={authenticatorKey}&issuer={encoder.Encode(Issuer)}&digits=6";
    }
}
`,

    'Services/UserClaimsService.cs': `using System.Security.Claims;
using {{projectNamePascal}}.Models;
using Microsoft.AspNetCore.Identity;

namespace {{projectNamePascal}}.Services;

public class UserClaimsService : IUserClaimsService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public UserClaimsService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<IList<Claim>> GetClaimsAsync(ApplicationUser user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new("full_name", user.FullName)
        };

        foreach (var role in await _userManager.GetRolesAsync(user))
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        claims.AddRange(await _userManager.GetClaimsAsync(user));
        return claims;
    }
}
`,

    'Services/UserService.cs': `using AutoMapper;
using {{projectNamePascal}}.DTOs;
using {{projectNamePascal}}.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace {{projectNamePascal}}.Services;

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IMapper _mapper;

    public UserService(UserManager<ApplicationUser> userManager, IMapper mapper)
    {
        _userManager = userManager;
        _mapper = mapper;
    }

    public async Task<UserResponse?> GetByIdAsync(int id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        return user == null ? null : _mapper.Map<UserResponse>(user);
    }

    public async Task<IReadOnlyList<UserResponse>> ListAsync(int page = 1, int pageSize = 20)
    {
        var users = await _userManager.Users
            .OrderBy(u => u.Id)
            .Skip((Math.Max(page, 1) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return _mapper.Map<List<UserResponse>>(users);
    }

    public async Task<bool> DeactivateAsync(int id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user == null)
        {
            return false;
        }

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded;
    }
}
`,

    'Validators/AuthValidators.cs': `using FluentValidation;
using {{projectNamePascal}}.DTOs;

namespace {{projectNamePascal}}.Validators;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter")
            .Matches("[0-9]").WithMessage("Password must contain a digit")
            .Matches("[^a-zA-Z0-9]").WithMessage("Password must contain a special character");
        RuleFor(x => x.ConfirmPassword).Equal(x => x.Password).WithMessage("Passwords do not match");
        RuleFor(x => x.PhoneNumber).Matches(@"^\\+?[0-9 ()-]{7,20}$").When(x => !string.IsNullOrEmpty(x.PhoneNumber));
    }
}
`
  }
};