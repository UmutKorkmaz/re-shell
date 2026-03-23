import { BackendTemplate } from '../types';

export const aspnetSwaggerTemplate: BackendTemplate = {
  id: 'aspnet-swagger',
  name: 'aspnet-swagger',
  displayName: 'ASP.NET Core with Swagger/OpenAPI',
  description: 'Enterprise .NET API with comprehensive Swagger/OpenAPI documentation and XML comments',
  language: 'csharp',
  framework: 'aspnet-swagger',
  version: '1.0.0',
  tags: ['aspnet', 'swagger', 'swagger', 'documentation', 'xml-docs'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing'],
  
  files: {
    // Project file with Swagger and XML documentation packages
    '{{serviceName}}.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <!-- Enable XML documentation generation -->
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <DocumentationFile>$(OutputPath)$(AssemblyName).xml</DocumentationFile>
    <NoWarn>$(NoWarn);1591</NoWarn> <!-- Disable missing XML comment warnings -->
    <IncludeOpenAPIAnalyzers>true</IncludeOpenAPIAnalyzers>
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
    <!-- Comprehensive Swagger/OpenAPI Packages -->
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />
    <PackageReference Include="Swashbuckle.AspNetCore.Annotations" Version="6.5.0" />
    <PackageReference Include="Swashbuckle.AspNetCore.Filters" Version="7.0.12" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Versioning" Version="5.1.0" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Versioning.ApiExplorer" Version="5.1.0" />
    <PackageReference Include="Microsoft.OpenApi" Version="1.6.14" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.0" />
    <!-- Additional documentation and analysis tools -->
    <PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" Version="8.0.0" />
    <PackageReference Include="NSwag.AspNetCore" Version="13.20.0" />
    <PackageReference Include="NSwag.MSBuild" Version="13.20.0" />
  </ItemGroup>

  <!-- XML Documentation files to include -->
  <ItemGroup>
    <Content Include="docs/**/*" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

  <!-- NSwag configuration for code generation -->
  <Target Name="NSwag" AfterTargets="PostBuildEvent" Condition="'$(Configuration)' == 'Debug'">
    <Exec Command="$(NSwagExe_Net80) run nswag.json" />
  </Target>

</Project>`,

    // Program.cs with comprehensive Swagger configuration
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using {{serviceName}}.DTOs;
using {{serviceName}}.Profiles;
using {{serviceName}}.Validators;
using {{serviceName}}.Infrastructure.Swagger;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using FluentValidation;
using Serilog;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Swashbuckle.AspNetCore.Annotations;
using Swashbuckle.AspNetCore.Filters;
using System.Text;
using System.Reflection;

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
builder.Services.AddControllers(options =>
{
    // Add custom model binding and validation
    options.SuppressAsyncSuffixInActionNames = false;
})
.AddNewtonsoftJson(options =>
{
    // Configure JSON serialization for Swagger
    options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
    options.SerializerSettings.NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore;
});

// API versioning
builder.Services.AddApiVersioning(opt =>
{
    opt.DefaultApiVersion = new ApiVersion(1, 0);
    opt.AssumeDefaultVersionWhenUnspecified = true;
    opt.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new QueryStringApiVersionReader("version"),
        new HeaderApiVersionReader("X-Version"),
        new MediaTypeApiVersionReader("ver")
    );
});

builder.Services.AddVersionedApiExplorer(setup =>
{
    setup.GroupNameFormat = "'v'VVV";
    setup.SubstituteApiVersionInUrl = true;
});

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

// AutoMapper
builder.Services.AddAutoMapper(typeof(UserProfile));

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserValidator>();

// Custom services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IAuditService, AuditService>();

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

// Configure comprehensive Swagger/OpenAPI
builder.Services.AddSwaggerGen(c =>
{
    // Basic API information
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "{{serviceName}} API",
        Description = "A comprehensive .NET API with full OpenAPI documentation",
        TermsOfService = new Uri("https://{{serviceName}}.com/terms"),
        Contact = new OpenApiContact
        {
            Name = "{{serviceName}} Support",
            Email = "support@{{serviceName}}.com",
            Url = new Uri("https://{{serviceName}}.com/contact")
        },
        License = new OpenApiLicense
        {
            Name = "MIT License",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    c.SwaggerDoc("v2", new OpenApiInfo
    {
        Version = "v2",
        Title = "{{serviceName}} API v2",
        Description = "Version 2 of the {{serviceName}} API with enhanced features",
        TermsOfService = new Uri("https://{{serviceName}}.com/terms"),
        Contact = new OpenApiContact
        {
            Name = "{{serviceName}} Support",
            Email = "support@{{serviceName}}.com",
            Url = new Uri("https://{{serviceName}}.com/contact")
        },
        License = new OpenApiLicense
        {
            Name = "MIT License",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    // Enable annotations
    c.EnableAnnotations();

    // Include XML comments
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }

    // Include XML comments from referenced assemblies
    var assemblies = AppDomain.CurrentDomain.GetAssemblies();
    foreach (var assembly in assemblies)
    {
        var assemblyXmlPath = Path.Combine(AppContext.BaseDirectory, $"{assembly.GetName().Name}.xml");
        if (File.Exists(assemblyXmlPath))
        {
            c.IncludeXmlComments(assemblyXmlPath);
        }
    }

    // Add JWT Bearer authentication
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' followed by a space and your JWT token. Example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
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

    // Add API Key authentication
    c.AddSecurityDefinition("ApiKey", new OpenApiSecurityScheme
    {
        Name = "X-API-Key",
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Description = "API Key authentication"
    });

    // Custom schema mappings
    c.MapType<DateTime>(() => new OpenApiSchema
    {
        Type = "string",
        Format = "date-time",
        Example = new Microsoft.OpenApi.Any.OpenApiString(DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"))
    });

    c.MapType<DateOnly>(() => new OpenApiSchema
    {
        Type = "string",
        Format = "date",
        Example = new Microsoft.OpenApi.Any.OpenApiString(DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"))
    });

    c.MapType<TimeOnly>(() => new OpenApiSchema
    {
        Type = "string",
        Format = "time",
        Example = new Microsoft.OpenApi.Any.OpenApiString(TimeOnly.FromDateTime(DateTime.UtcNow).ToString("HH:mm:ss"))
    });

    // Custom operation filters
    c.OperationFilter<SwaggerDefaultValues>();
    c.OperationFilter<AuthorizeCheckOperationFilter>();
    c.OperationFilter<AddResponseHeadersFilter>();

    // Custom schema filters
    c.SchemaFilter<RequiredNotNullableSchemaFilter>();
    c.SchemaFilter<EnumSchemaFilter>();

    // Document filters
    c.DocumentFilter<TagDescriptionsDocumentFilter>();

    // Group actions by namespace
    c.TagActionsBy(api => new[] { api.GroupName ?? api.ActionDescriptor.RouteValues["controller"] });
    c.DocInclusionPredicate((name, api) => true);

    // Custom ordering
    c.OrderActionsBy(apiDesc => $"{apiDesc.ActionDescriptor.RouteValues["controller"]}_{apiDesc.HttpMethod}");

    // Add examples
    c.ExampleFilters();

    // Configure for different environments
    if (builder.Environment.IsDevelopment())
    {
        c.DescribeAllParametersInCamelCase();
    }
});

// Add example filters
builder.Services.AddSwaggerExamplesFromAssemblyOf<UserCreateExample>();

// Add Swagger annotations
builder.Services.AddSwaggerAnnotations();

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContext<ApplicationDbContext>();

var app = builder.Build();

var apiVersionDescriptionProvider = app.Services.GetRequiredService<IApiVersionDescriptionProvider>();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.UseSwagger(c =>
    {
        c.RouteTemplate = "swagger/{documentName}/swagger.json";
        c.PreSerializeFilters.Add((swaggerDoc, httpReq) =>
        {
            swaggerDoc.Servers = new List<OpenApiServer>
            {
                new OpenApiServer { Url = $"{httpReq.Scheme}://{httpReq.Host.Value}" }
            };
        });
    });

    app.UseSwaggerUI(c =>
    {
        // Add endpoints for each API version
        foreach (var description in apiVersionDescriptionProvider.ApiVersionDescriptions)
        {
            c.SwaggerEndpoint(
                $"/swagger/{description.GroupName}/swagger.json",
                $"{{serviceName}} API {description.GroupName.ToUpperInvariant()}"
            );
        }

        // Customize Swagger UI
        c.RoutePrefix = string.Empty; // Serve at root
        c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
        c.DefaultModelExpandDepth(2);
        c.DefaultModelRendering(Swashbuckle.AspNetCore.SwaggerUI.ModelRendering.Example);
        c.DisplayRequestDuration();
        c.EnableDeepLinking();
        c.EnableFilter();
        c.EnableValidator();
        c.ShowExtensions();
        c.ShowCommonExtensions();
        c.EnablePersistAuthorization();

        // Custom CSS and JavaScript
        c.InjectStylesheet("/swagger-ui/custom.css");
        c.InjectJavascript("/swagger-ui/custom.js");

        // OAuth configuration (if needed)
        c.OAuthClientId("swagger-ui");
        c.OAuthAppName("{{serviceName}} API");
        c.OAuthUsePkce();

        // Additional configuration
        c.ConfigObject.AdditionalItems.Add("requestSnippetsEnabled", true);
        c.ConfigObject.AdditionalItems.Add("syntaxHighlight", new Dictionary<string, object>
        {
            ["activated"] = true,
            ["theme"] = "tomorrow-night"
        });
    });

    // Serve ReDoc as alternative documentation
    app.UseReDoc(c =>
    {
        c.RoutePrefix = "redoc";
        c.SpecUrl("/swagger/v1/swagger.json");
        c.DocumentTitle = "{{serviceName}} API Documentation";
        c.EnableUntrustedSpec();
        c.ScrollYOffset(10);
        c.HideHostname();
        c.HideDownloadButton();
        c.ExpandResponses("200,201");
        c.RequiredPropsFirst();
        c.NoAutoAuth();
        c.PathInMiddlePanel();
        c.HideLoading();
        c.NativeScrollbars();
        c.DisableSearch();
        c.OnlyRequiredInSamples();
        c.SortPropsAlphabetically();
    });
}

// Request logging middleware
app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

// Serve static files for Swagger customization
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health check endpoints
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready");

// API documentation endpoints
app.MapGet("/", () => Results.Redirect("/swagger"));
app.MapGet("/docs", () => Results.Redirect("/swagger"));
app.MapGet("/api-docs", () => Results.Redirect("/swagger"));

app.Run();`,

    // Enhanced user controller with comprehensive documentation
    'Controllers/UsersController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using {{serviceName}}.Services;
using {{serviceName}}.DTOs;
using {{serviceName}}.Models;
using AutoMapper;
using FluentValidation;
using Swashbuckle.AspNetCore.Annotations;
using Swashbuckle.AspNetCore.Filters;
using System.Net;

namespace {{serviceName}}.Controllers;

/// <summary>
/// Manages user operations including registration, authentication, and profile management
/// </summary>
/// <remarks>
/// This controller provides comprehensive user management functionality with full CRUD operations.
/// All endpoints are documented with OpenAPI specifications and include proper error handling.
/// </remarks>
[ApiController]
[ApiVersion("1.0")]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Produces("application/json")]
[SwaggerTag("User Management", "Operations related to user accounts and profiles")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateUserRequest> _createValidator;
    private readonly IValidator<UpdateUserRequest> _updateValidator;
    private readonly ILogger<UsersController> _logger;

    /// <summary>
    /// Initializes a new instance of the UsersController
    /// </summary>
    /// <param name="userService">User service for business logic</param>
    /// <param name="mapper">AutoMapper instance for object mapping</param>
    /// <param name="createValidator">Validator for user creation requests</param>
    /// <param name="updateValidator">Validator for user update requests</param>
    /// <param name="logger">Logger instance for logging operations</param>
    public UsersController(
        IUserService userService,
        IMapper mapper,
        IValidator<CreateUserRequest> createValidator,
        IValidator<UpdateUserRequest> updateValidator,
        ILogger<UsersController> logger)
    {
        _userService = userService ?? throw new ArgumentNullException(nameof(userService));
        _mapper = mapper ?? throw new ArgumentNullException(nameof(mapper));
        _createValidator = createValidator ?? throw new ArgumentNullException(nameof(createValidator));
        _updateValidator = updateValidator ?? throw new ArgumentNullException(nameof(updateValidator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Retrieves all users with optional filtering and pagination
    /// </summary>
    /// <param name="search">Optional search term to filter users by name or email</param>
    /// <param name="page">Page number for pagination (default: 1)</param>
    /// <param name="pageSize">Number of items per page (default: 10, max: 100)</param>
    /// <param name="sortBy">Field to sort by (name, email, createdAt)</param>
    /// <param name="sortOrder">Sort order (asc, desc)</param>
    /// <returns>A paginated list of users</returns>
    /// <response code="200">Returns the list of users</response>
    /// <response code="400">Invalid pagination or sort parameters</response>
    /// <response code="401">Unauthorized access</response>
    /// <response code="500">Internal server error</response>
    [HttpGet]
    [Authorize]
    [SwaggerOperation(
        Summary = "Get all users",
        Description = "Retrieves a paginated list of users with optional search and sorting capabilities",
        OperationId = "GetUsers",
        Tags = new[] { "Users" }
    )]
    [SwaggerResponse(200, "Users retrieved successfully", typeof(PagedResult<UserResponse>))]
    [SwaggerResponse(400, "Invalid request parameters", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized", typeof(ErrorResponse))]
    [SwaggerResponse(500, "Internal server error", typeof(ErrorResponse))]
    [SwaggerResponseExample(200, typeof(UserListExample))]
    public async Task<ActionResult<PagedResult<UserResponse>>> GetUsers(
        [FromQuery, SwaggerParameter("Search term for filtering users")] string? search = null,
        [FromQuery, SwaggerParameter("Page number (1-based)")] int page = 1,
        [FromQuery, SwaggerParameter("Items per page (1-100)")] int pageSize = 10,
        [FromQuery, SwaggerParameter("Sort field (name, email, createdAt)")] string sortBy = "createdAt",
        [FromQuery, SwaggerParameter("Sort order (asc, desc)")] string sortOrder = "desc")
    {
        try
        {
            _logger.LogInformation("Getting users with search: {Search}, page: {Page}, pageSize: {PageSize}", 
                search, page, pageSize);

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10;

            var users = await _userService.GetUsersAsync(search, page, pageSize, sortBy, sortOrder);
            var response = _mapper.Map<PagedResult<UserResponse>>(users);

            return Ok(response);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid parameters for GetUsers");
            return BadRequest(new ErrorResponse { Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users");
            return StatusCode(500, new ErrorResponse { Message = "An error occurred while retrieving users" });
        }
    }

    /// <summary>
    /// Retrieves a specific user by their unique identifier
    /// </summary>
    /// <param name="id">The unique identifier of the user</param>
    /// <returns>The user details</returns>
    /// <response code="200">User found and returned</response>
    /// <response code="404">User not found</response>
    /// <response code="401">Unauthorized access</response>
    /// <response code="500">Internal server error</response>
    [HttpGet("{id:int}")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Get user by ID",
        Description = "Retrieves detailed information about a specific user",
        OperationId = "GetUserById",
        Tags = new[] { "Users" }
    )]
    [SwaggerResponse(200, "User found", typeof(UserResponse))]
    [SwaggerResponse(404, "User not found", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized", typeof(ErrorResponse))]
    [SwaggerResponse(500, "Internal server error", typeof(ErrorResponse))]
    [SwaggerResponseExample(200, typeof(UserResponseExample))]
    [SwaggerResponseExample(404, typeof(NotFoundErrorExample))]
    public async Task<ActionResult<UserResponse>> GetUser(
        [FromRoute, SwaggerParameter("User ID", Required = true)] int id)
    {
        try
        {
            _logger.LogInformation("Getting user with ID: {UserId}", id);

            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found", id);
                return NotFound(new ErrorResponse { Message = $"User with ID {id} not found" });
            }

            var response = _mapper.Map<UserResponse>(user);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user {UserId}", id);
            return StatusCode(500, new ErrorResponse { Message = "An error occurred while retrieving the user" });
        }
    }

    /// <summary>
    /// Creates a new user account
    /// </summary>
    /// <param name="request">User creation details</param>
    /// <returns>The created user</returns>
    /// <response code="201">User created successfully</response>
    /// <response code="400">Invalid user data or validation errors</response>
    /// <response code="409">User with email already exists</response>
    /// <response code="500">Internal server error</response>
    [HttpPost]
    [SwaggerOperation(
        Summary = "Create new user",
        Description = "Creates a new user account with the provided information",
        OperationId = "CreateUser",
        Tags = new[] { "Users" }
    )]
    [SwaggerResponse(201, "User created successfully", typeof(UserResponse))]
    [SwaggerResponse(400, "Invalid request data", typeof(ValidationErrorResponse))]
    [SwaggerResponse(409, "Email already exists", typeof(ErrorResponse))]
    [SwaggerResponse(500, "Internal server error", typeof(ErrorResponse))]
    [SwaggerRequestExample(typeof(CreateUserRequest), typeof(UserCreateExample))]
    [SwaggerResponseExample(201, typeof(UserCreatedExample))]
    [SwaggerResponseExample(400, typeof(ValidationErrorExample))]
    public async Task<ActionResult<UserResponse>> CreateUser(
        [FromBody, SwaggerRequestBody("User creation data", Required = true)] CreateUserRequest request)
    {
        try
        {
            _logger.LogInformation("Creating new user with email: {Email}", request.Email);

            var validationResult = await _createValidator.ValidateAsync(request);
            if (!validationResult.IsValid)
            {
                var errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage);
                return BadRequest(new ValidationErrorResponse { Errors = errors });
            }

            var user = _mapper.Map<User>(request);
            var createdUser = await _userService.CreateUserAsync(user);
            var response = _mapper.Map<UserResponse>(createdUser);

            _logger.LogInformation("User created successfully with ID: {UserId}", createdUser.Id);

            return CreatedAtAction(nameof(GetUser), new { id = createdUser.Id }, response);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("email"))
        {
            _logger.LogWarning(ex, "Attempt to create user with existing email: {Email}", request.Email);
            return Conflict(new ErrorResponse { Message = "A user with this email already exists" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user with email: {Email}", request.Email);
            return StatusCode(500, new ErrorResponse { Message = "An error occurred while creating the user" });
        }
    }

    /// <summary>
    /// Updates an existing user's information
    /// </summary>
    /// <param name="id">The unique identifier of the user to update</param>
    /// <param name="request">Updated user information</param>
    /// <returns>The updated user</returns>
    /// <response code="200">User updated successfully</response>
    /// <response code="400">Invalid request data or validation errors</response>
    /// <response code="404">User not found</response>
    /// <response code="401">Unauthorized access</response>
    /// <response code="500">Internal server error</response>
    [HttpPut("{id:int}")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Update user",
        Description = "Updates an existing user's information",
        OperationId = "UpdateUser",
        Tags = new[] { "Users" }
    )]
    [SwaggerResponse(200, "User updated successfully", typeof(UserResponse))]
    [SwaggerResponse(400, "Invalid request data", typeof(ValidationErrorResponse))]
    [SwaggerResponse(404, "User not found", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized", typeof(ErrorResponse))]
    [SwaggerResponse(500, "Internal server error", typeof(ErrorResponse))]
    [SwaggerRequestExample(typeof(UpdateUserRequest), typeof(UserUpdateExample))]
    [SwaggerResponseExample(200, typeof(UserUpdatedExample))]
    public async Task<ActionResult<UserResponse>> UpdateUser(
        [FromRoute, SwaggerParameter("User ID", Required = true)] int id,
        [FromBody, SwaggerRequestBody("Updated user data", Required = true)] UpdateUserRequest request)
    {
        try
        {
            _logger.LogInformation("Updating user with ID: {UserId}", id);

            var validationResult = await _updateValidator.ValidateAsync(request);
            if (!validationResult.IsValid)
            {
                var errors = validationResult.Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage);
                return BadRequest(new ValidationErrorResponse { Errors = errors });
            }

            var existingUser = await _userService.GetUserByIdAsync(id);
            if (existingUser == null)
            {
                _logger.LogWarning("User with ID {UserId} not found for update", id);
                return NotFound(new ErrorResponse { Message = $"User with ID {id} not found" });
            }

            _mapper.Map(request, existingUser);
            var updatedUser = await _userService.UpdateUserAsync(existingUser);
            var response = _mapper.Map<UserResponse>(updatedUser);

            _logger.LogInformation("User {UserId} updated successfully", id);

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user {UserId}", id);
            return StatusCode(500, new ErrorResponse { Message = "An error occurred while updating the user" });
        }
    }

    /// <summary>
    /// Deletes a user account (soft delete)
    /// </summary>
    /// <param name="id">The unique identifier of the user to delete</param>
    /// <returns>No content if successful</returns>
    /// <response code="204">User deleted successfully</response>
    /// <response code="404">User not found</response>
    /// <response code="401">Unauthorized access</response>
    /// <response code="500">Internal server error</response>
    [HttpDelete("{id:int}")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Delete user",
        Description = "Soft deletes a user account (user data is retained but marked as deleted)",
        OperationId = "DeleteUser",
        Tags = new[] { "Users" }
    )]
    [SwaggerResponse(204, "User deleted successfully")]
    [SwaggerResponse(404, "User not found", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized", typeof(ErrorResponse))]
    [SwaggerResponse(500, "Internal server error", typeof(ErrorResponse))]
    public async Task<IActionResult> DeleteUser(
        [FromRoute, SwaggerParameter("User ID", Required = true)] int id)
    {
        try
        {
            _logger.LogInformation("Deleting user with ID: {UserId}", id);

            var user = await _userService.GetUserByIdAsync(id);
            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found for deletion", id);
                return NotFound(new ErrorResponse { Message = $"User with ID {id} not found" });
            }

            await _userService.DeleteUserAsync(id);

            _logger.LogInformation("User {UserId} deleted successfully", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user {UserId}", id);
            return StatusCode(500, new ErrorResponse { Message = "An error occurred while deleting the user" });
        }
    }

    /// <summary>
    /// Searches users by various criteria (v2 endpoint with enhanced features)
    /// </summary>
    /// <param name="query">Search query</param>
    /// <param name="filters">Advanced search filters</param>
    /// <returns>Search results</returns>
    /// <response code="200">Search completed successfully</response>
    /// <response code="400">Invalid search parameters</response>
    /// <response code="401">Unauthorized access</response>
    [HttpPost("search")]
    [MapToApiVersion("2.0")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Advanced user search (v2)",
        Description = "Performs advanced search across user data with multiple criteria",
        OperationId = "SearchUsersV2",
        Tags = new[] { "Users" }
    )]
    [SwaggerResponse(200, "Search results", typeof(SearchResult<UserResponse>))]
    [SwaggerResponse(400, "Invalid search parameters", typeof(ErrorResponse))]
    [SwaggerResponse(401, "Unauthorized", typeof(ErrorResponse))]
    public async Task<ActionResult<SearchResult<UserResponse>>> SearchUsers(
        [FromBody] SearchRequest query)
    {
        try
        {
            _logger.LogInformation("Performing advanced user search");
            
            var results = await _userService.SearchUsersAsync(query);
            var response = _mapper.Map<SearchResult<UserResponse>>(results);
            
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing user search");
            return StatusCode(500, new ErrorResponse { Message = "An error occurred during search" });
        }
    }
}`,

    // Swagger configuration and filters
    'Infrastructure/Swagger/SwaggerDefaultValues.cs': `using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace {{serviceName}}.Infrastructure.Swagger;

public class SwaggerDefaultValues : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var apiDescription = context.ApiDescription;

        operation.Deprecated |= apiDescription.IsDeprecated();

        foreach (var responseType in context.ApiDescription.SupportedResponseTypes)
        {
            var responseKey = responseType.IsDefaultResponse ? "default" : responseType.StatusCode.ToString();
            var response = operation.Responses[responseKey];

            foreach (var contentType in response.Content.Keys)
            {
                if (responseType.ApiResponseFormats.All(x => x.MediaType != contentType))
                {
                    response.Content.Remove(contentType);
                }
            }
        }

        if (operation.Parameters == null)
            return;

        foreach (var parameter in operation.Parameters)
        {
            var description = apiDescription.ParameterDescriptions.First(p => p.Name == parameter.Name);
            parameter.Description ??= description.ModelMetadata?.Description;

            if (parameter.Schema.Default == null && description.DefaultValue != null)
            {
                parameter.Schema.Default = new Microsoft.OpenApi.Any.OpenApiString(description.DefaultValue.ToString());
            }

            parameter.Required |= description.IsRequired;
        }
    }
}`,

    'Infrastructure/Swagger/AuthorizeCheckOperationFilter.cs': `using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace {{serviceName}}.Infrastructure.Swagger;

public class AuthorizeCheckOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var hasAuthorize = context.MethodInfo.DeclaringType?.GetCustomAttributes(true)
            .Union(context.MethodInfo.GetCustomAttributes(true))
            .OfType<AuthorizeAttribute>()
            .Any() ?? false;

        if (hasAuthorize)
        {
            operation.Responses.Add("401", new OpenApiResponse { Description = "Unauthorized" });
            operation.Responses.Add("403", new OpenApiResponse { Description = "Forbidden" });

            operation.Security = new List<OpenApiSecurityRequirement>
            {
                new OpenApiSecurityRequirement
                {
                    [
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        }
                    ] = new[] { "Bearer" }
                }
            };
        }
    }
}`,

    'Infrastructure/Swagger/RequiredNotNullableSchemaFilter.cs': `using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace {{serviceName}}.Infrastructure.Swagger;

public class RequiredNotNullableSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties == null)
            return;

        var notNullableProperties = schema
            .Properties
            .Where(x => !x.Value.Nullable && !schema.Required.Contains(x.Key))
            .ToList();

        foreach (var property in notNullableProperties)
        {
            schema.Required.Add(property.Key);
        }
    }
}`,

    'Infrastructure/Swagger/EnumSchemaFilter.cs': `using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.ComponentModel;

namespace {{serviceName}}.Infrastructure.Swagger;

public class EnumSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type.IsEnum)
        {
            schema.Enum.Clear();
            foreach (var enumValue in Enum.GetValues(context.Type))
            {
                var member = context.Type.GetMember(enumValue.ToString()!)[0];
                var description = member.GetCustomAttributes(typeof(DescriptionAttribute), false)
                    .Cast<DescriptionAttribute>()
                    .FirstOrDefault()?.Description;

                schema.Enum.Add(new Microsoft.OpenApi.Any.OpenApiString(enumValue.ToString()));
                
                if (description != null)
                {
                    if (schema.Extensions.ContainsKey("x-enum-descriptions"))
                    {
                        var descriptions = (Dictionary<string, object>)schema.Extensions["x-enum-descriptions"];
                        descriptions[enumValue.ToString()!] = description;
                    }
                    else
                    {
                        schema.Extensions.Add("x-enum-descriptions", new Dictionary<string, object>
                        {
                            [enumValue.ToString()!] = description
                        });
                    }
                }
            }
        }
    }
}`,

    'Infrastructure/Swagger/TagDescriptionsDocumentFilter.cs': `using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace {{serviceName}}.Infrastructure.Swagger;

public class TagDescriptionsDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        swaggerDoc.Tags = new List<OpenApiTag>
        {
            new OpenApiTag
            {
                Name = "Users",
                Description = "Operations related to user management, authentication, and profiles"
            },
            new OpenApiTag
            {
                Name = "Products",
                Description = "Product catalog management and inventory operations"
            },
            new OpenApiTag
            {
                Name = "Orders",
                Description = "Order processing, tracking, and management"
            },
            new OpenApiTag
            {
                Name = "Authentication",
                Description = "User authentication, token management, and security operations"
            }
        };
    }
}`,

    'Infrastructure/Swagger/AddResponseHeadersFilter.cs': `using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace {{serviceName}}.Infrastructure.Swagger;

public class AddResponseHeadersFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        foreach (var response in operation.Responses)
        {
            response.Value.Headers ??= new Dictionary<string, OpenApiHeader>();

            response.Value.Headers.Add("X-Correlation-ID", new OpenApiHeader
            {
                Description = "Unique request correlation identifier",
                Schema = new OpenApiSchema { Type = "string" }
            });

            response.Value.Headers.Add("X-Request-ID", new OpenApiHeader
            {
                Description = "Unique request identifier",
                Schema = new OpenApiSchema { Type = "string" }
            });

            response.Value.Headers.Add("X-RateLimit-Remaining", new OpenApiHeader
            {
                Description = "Number of requests remaining in current time window",
                Schema = new OpenApiSchema { Type = "integer" }
            });
        }
    }
}`,

    // Swagger example providers
    'Infrastructure/Swagger/Examples/UserCreateExample.cs': `using Swashbuckle.AspNetCore.Filters;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Infrastructure.Swagger;

public class UserCreateExample : IExamplesProvider<CreateUserRequest>
{
    public CreateUserRequest GetExamples()
    {
        return new CreateUserRequest
        {
            FirstName = "John",
            LastName = "Doe",
            Email = "john.doe@example.com",
            Password = "SecurePassword123!",
            PhoneNumber = "+1-555-123-4567",
            DateOfBirth = new DateOnly(1990, 5, 15),
            Address = new AddressRequest
            {
                Street = "123 Main St",
                City = "Springfield",
                State = "IL",
                PostalCode = "62701",
                Country = "United States"
            }
        };
    }
}`,

    'Infrastructure/Swagger/Examples/UserResponseExample.cs': `using Swashbuckle.AspNetCore.Filters;
using {{serviceName}}.DTOs;

namespace {{serviceName}}.Infrastructure.Swagger;

public class UserResponseExample : IExamplesProvider<UserResponse>
{
    public UserResponse GetExamples()
    {
        return new UserResponse
        {
            Id = 1,
            FirstName = "John",
            LastName = "Doe",
            Email = "john.doe@example.com",
            PhoneNumber = "+1-555-123-4567",
            DateOfBirth = new DateOnly(1990, 5, 15),
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-5),
            IsActive = true,
            Address = new AddressResponse
            {
                Street = "123 Main St",
                City = "Springfield",
                State = "IL",
                PostalCode = "62701",
                Country = "United States"
            }
        };
    }
}`,

    // Static files for Swagger customization
    'wwwroot/swagger-ui/custom.css': `.swagger-ui .topbar {
    background-color: #2c3e50;
}

.swagger-ui .topbar .download-url-wrapper {
    display: none;
}

.swagger-ui .info .title {
    color: #2c3e50;
}

.swagger-ui .scheme-container {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 10px;
    margin: 10px 0;
}

.swagger-ui .opblock.opblock-post {
    border-color: #28a745;
    background: rgba(40, 167, 69, 0.1);
}

.swagger-ui .opblock.opblock-get {
    border-color: #17a2b8;
    background: rgba(23, 162, 184, 0.1);
}

.swagger-ui .opblock.opblock-put {
    border-color: #ffc107;
    background: rgba(255, 193, 7, 0.1);
}

.swagger-ui .opblock.opblock-delete {
    border-color: #dc3545;
    background: rgba(220, 53, 69, 0.1);
}

.swagger-ui .opblock-summary {
    font-weight: 600;
}

.swagger-ui .opblock .opblock-section-header h4 {
    font-size: 16px;
    margin: 0;
}

.swagger-ui .model-box {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
}

.swagger-ui .model .model-title {
    color: #495057;
    font-weight: 600;
}`,

    'wwwroot/swagger-ui/custom.js': `// Custom JavaScript for Swagger UI enhancements
window.addEventListener('DOMContentLoaded', function() {
    // Add custom functionality
    console.log('{{serviceName}} API Documentation loaded');
    
    // Add copy-to-clipboard functionality for code examples
    function addCopyButtons() {
        const codeBlocks = document.querySelectorAll('pre code');
        codeBlocks.forEach(function(codeBlock) {
            const button = document.createElement('button');
            button.className = 'copy-button';
            button.textContent = 'Copy';
            button.style.cssText = 'position: absolute; top: 5px; right: 5px; padding: 4px 8px; font-size: 12px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;';
            
            const pre = codeBlock.parentNode;
            pre.style.position = 'relative';
            pre.appendChild(button);
            
            button.addEventListener('click', function() {
                navigator.clipboard.writeText(codeBlock.textContent).then(function() {
                    button.textContent = 'Copied!';
                    setTimeout(() => {
                        button.textContent = 'Copy';
                    }, 2000);
                });
            });
        });
    }
    
    // Add copy buttons after a delay to ensure content is loaded
    setTimeout(addCopyButtons, 1000);
    
    // Re-add copy buttons when new content is loaded
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                addCopyButtons();
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});`,

    // NSwag configuration for code generation
    'nswag.json': `{
  "runtime": "Net80",
  "defaultVariables": null,
  "documentGenerator": {
    "aspNetCoreToOpenApi": {
      "project": "{{serviceName}}.csproj",
      "msBuildProjectExtensionsPath": null,
      "configuration": null,
      "runtime": null,
      "targetFramework": null,
      "noBuild": false,
      "msBuildOutputPath": null,
      "verbose": true,
      "workingDirectory": null,
      "aspNetCoreEnvironment": "Development",
      "output": null,
      "newLineBehavior": "Auto"
    }
  },
  "codeGenerators": {
    "openApiToCSharpClient": {
      "clientBaseClass": null,
      "configurationClass": null,
      "generateClientClasses": true,
      "generateClientInterfaces": true,
      "clientBaseInterface": null,
      "injectHttpClient": true,
      "disposeHttpClient": true,
      "protectedMethods": [],
      "generateExceptionClasses": true,
      "exceptionClass": "ApiException",
      "wrapDtoExceptions": true,
      "useHttpClientCreationMethod": false,
      "httpClientType": "System.Net.Http.HttpClient",
      "useHttpRequestMessageCreationMethod": false,
      "useBaseUrl": true,
      "generateBaseUrlProperty": true,
      "generateSyncMethods": false,
      "generatePrepareRequestAndProcessResponseAsAsyncMethods": false,
      "exposeJsonSerializerSettings": false,
      "clientClassAccessModifier": "public",
      "typeAccessModifier": "public",
      "generateContractsOutput": false,
      "contractsNamespace": null,
      "contractsOutputFilePath": null,
      "parameterDateTimeFormat": "s",
      "parameterDateFormat": "yyyy-MM-dd",
      "generateUpdateJsonSerializerSettingsMethod": true,
      "useRequestAndResponseSerializationSettings": false,
      "serializeTypeInformation": false,
      "queryNullValue": "",
      "className": "{controller}Client",
      "operationGenerationMode": "MultipleClientsFromOperationId",
      "additionalNamespaceUsages": [],
      "additionalContractNamespaceUsages": [],
      "generateOptionalParameters": false,
      "generateJsonMethods": false,
      "enforceFlagEnums": false,
      "parameterArrayType": "System.Collections.Generic.IEnumerable",
      "parameterDictionaryType": "System.Collections.Generic.IDictionary",
      "responseArrayType": "System.Collections.Generic.ICollection",
      "responseDictionaryType": "System.Collections.Generic.IDictionary",
      "wrapResponses": false,
      "wrapResponseMethods": [],
      "generateResponseClasses": true,
      "responseClass": "SwaggerResponse",
      "namespace": "{{serviceName}}.ApiClient",
      "requiredPropertiesMustBeDefined": true,
      "dateType": "System.DateTimeOffset",
      "jsonConverters": null,
      "anyType": "object",
      "dateTimeType": "System.DateTimeOffset",
      "timeType": "System.TimeSpan",
      "timeSpanType": "System.TimeSpan",
      "arrayType": "System.Collections.Generic.ICollection",
      "arrayInstanceType": "System.Collections.ObjectModel.Collection",
      "dictionaryType": "System.Collections.Generic.IDictionary",
      "dictionaryInstanceType": "System.Collections.Generic.Dictionary",
      "arrayBaseType": "System.Collections.ObjectModel.Collection",
      "dictionaryBaseType": "System.Collections.Generic.Dictionary",
      "classStyle": "Poco",
      "jsonLibrary": "NewtonsoftJson",
      "generateDefaultValues": true,
      "generateDataAnnotations": true,
      "excludedTypeNames": [],
      "excludedParameterNames": [],
      "handleReferences": false,
      "generateImmutableArrayProperties": false,
      "generateImmutableDictionaryProperties": false,
      "jsonSerializerSettingsTransformationMethod": null,
      "inlineNamedArrays": false,
      "inlineNamedDictionaries": false,
      "inlineNamedTuples": true,
      "inlineNamedAny": false,
      "generateDtoTypes": true,
      "generateOptionalPropertiesAsNullable": false,
      "generateNullableReferenceTypes": false,
      "templateDirectory": null,
      "typeNameGeneratorType": null,
      "propertyNameGeneratorType": null,
      "enumNameGeneratorType": null,
      "serviceHost": null,
      "serviceSchemes": null,
      "output": "Generated/ApiClient.cs"
    },
    "openApiToTypeScriptClient": {
      "className": "{controller}Client",
      "moduleName": "",
      "namespace": "",
      "typeScriptVersion": 4.3,
      "template": "Angular",
      "promiseType": "Promise",
      "httpClass": "HttpClient",
      "withCredentials": false,
      "useSingletonProvider": false,
      "injectionTokenType": "InjectionToken",
      "rxJsVersion": 7.0,
      "dateTimeType": "Date",
      "nullValue": "Null",
      "generateClientClasses": true,
      "generateClientInterfaces": false,
      "generateOptionalParameters": false,
      "exportTypes": true,
      "wrapDtoExceptions": false,
      "exceptionClass": "SwaggerException",
      "clientBaseClass": null,
      "wrapResponses": false,
      "wrapResponseMethods": [],
      "generateResponseClasses": true,
      "responseClass": "SwaggerResponse",
      "protectedMethods": [],
      "configurationClass": null,
      "useTransformOptionsMethod": false,
      "useTransformResultMethod": false,
      "generateDtoTypes": true,
      "operationGenerationMode": "MultipleClientsFromOperationId",
      "markOptionalProperties": true,
      "generateCloneMethod": false,
      "typeStyle": "Class",
      "classTypes": [],
      "extendedClasses": [],
      "extensionCode": null,
      "generateDefaultValues": true,
      "excludedTypeNames": [],
      "excludedParameterNames": [],
      "handleReferences": false,
      "generateConstructorInterface": true,
      "convertConstructorInterfaceData": false,
      "importRequiredTypes": true,
      "useGetBaseUrlMethod": false,
      "baseUrlTokenName": "API_BASE_URL",
      "queryNullValue": "",
      "inlineNamedDictionaries": false,
      "inlineNamedAny": false,
      "templateDirectory": null,
      "typeNameGeneratorType": null,
      "propertyNameGeneratorType": null,
      "enumNameGeneratorType": null,
      "serviceHost": null,
      "serviceSchemes": null,
      "output": "Generated/api-client.ts"
    }
  }
}`,

    // Documentation README
    'docs/API_DOCUMENTATION.md': `# {{serviceName}} API Documentation

## Overview

This API provides comprehensive user and product management capabilities with full OpenAPI/Swagger documentation.

## Features

### 📚 Documentation
- **Swagger UI**: Interactive API documentation at \`/swagger\`
- **ReDoc**: Alternative documentation at \`/redoc\`
- **OpenAPI Specification**: Machine-readable API definitions
- **XML Comments**: Comprehensive inline documentation
- **Code Generation**: Automatic client generation with NSwag

### 🔒 Security
- JWT Bearer authentication
- API Key support
- Comprehensive security schemes
- Rate limiting headers

### 📖 API Versioning
- URL path versioning (\`/api/v1/\`, \`/api/v2/\`)
- Header versioning (\`X-Version\`)
- Query parameter versioning (\`?version=1.0\`)
- Media type versioning

### 🎨 Customization
- Custom CSS styling
- Enhanced JavaScript functionality
- Copy-to-clipboard for code examples
- Syntax highlighting

## Endpoints

### Users API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | \`/api/v1/users\` | Get all users with pagination |
| GET | \`/api/v1/users/{id}\` | Get user by ID |
| POST | \`/api/v1/users\` | Create new user |
| PUT | \`/api/v1/users/{id}\` | Update user |
| DELETE | \`/api/v1/users/{id}\` | Delete user (soft delete) |
| POST | \`/api/v2/users/search\` | Advanced user search (v2) |

### Authentication

All endpoints except user creation require authentication. Include the JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### Response Headers

All responses include:
- \`X-Correlation-ID\`: Request correlation identifier
- \`X-Request-ID\`: Unique request identifier
- \`X-RateLimit-Remaining\`: Rate limit information

## Examples

### Create User

\`\`\`http
POST /api/v1/users
Content-Type: application/json
Authorization: Bearer <token>

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "phoneNumber": "+1-555-123-4567",
  "dateOfBirth": "1990-05-15",
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62701",
    "country": "United States"
  }
}
\`\`\`

### Get Users with Pagination

\`\`\`http
GET /api/v1/users?page=1&pageSize=10&search=john&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <token>
\`\`\`

## Error Handling

The API returns structured error responses:

\`\`\`json
{
  "message": "Error description",
  "details": "Additional error details",
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "abc123"
}
\`\`\`

### Validation Errors

\`\`\`json
{
  "errors": {
    "firstName": "First name is required",
    "email": "Invalid email format"
  }
}
\`\`\`

## Status Codes

- \`200\` - Success
- \`201\` - Created
- \`204\` - No Content
- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`403\` - Forbidden
- \`404\` - Not Found
- \`409\` - Conflict
- \`500\` - Internal Server Error

## Code Generation

### C# Client

Generate a C# client using NSwag:

\`\`\`bash
dotnet build
# Client will be generated at Generated/ApiClient.cs
\`\`\`

### TypeScript Client

Generate a TypeScript client:

\`\`\`bash
npm install -g nswag
nswag run nswag.json
# Client will be generated at Generated/api-client.ts
\`\`\`

## Development

### Local Development

1. Start the API: \`dotnet run\`
2. Open Swagger UI: \`http://localhost:5000\`
3. Open ReDoc: \`http://localhost:5000/redoc\`

### Customization

#### Custom CSS
Edit \`wwwroot/swagger-ui/custom.css\` to customize the appearance.

#### Custom JavaScript
Edit \`wwwroot/swagger-ui/custom.js\` to add functionality.

#### XML Documentation
Add XML comments to controllers and models for enhanced documentation.

## Best Practices

1. **Always document**: Add XML comments to all public APIs
2. **Use examples**: Provide request/response examples
3. **Version appropriately**: Use semantic versioning
4. **Handle errors**: Provide meaningful error messages
5. **Secure endpoints**: Require authentication where appropriate
6. **Test thoroughly**: Use the interactive documentation for testing
`
  }
};