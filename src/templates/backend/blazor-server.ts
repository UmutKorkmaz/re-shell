import { BackendTemplate } from '../types';

export const blazorServerTemplate: BackendTemplate = {
  id: 'blazor-server',
  name: 'blazor-server',
  displayName: 'Blazor Server App',
  description: 'Full-stack .NET web application with server-side Blazor',
  language: 'csharp',
  framework: 'blazor-server',
  version: '1.0.0',
  tags: ['blazor', 'server-side', 'web', 'spa', 'websockets'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'authorization', 'database', 'caching', 'logging', 'websockets', 'rest-api'],
  
  files: {
    // Project file
    '{{serviceName}}.csproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.Console" Version="5.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="5.0.0" />
    <PackageReference Include="AutoMapper" Version="12.0.1" />
    <PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" Version="12.0.1" />
    <PackageReference Include="FluentValidation.AspNetCore" Version="11.3.0" />
    <PackageReference Include="MediatR" Version="12.2.0" />
    <PackageReference Include="StackExchange.Redis" Version="2.7.10" />
  </ItemGroup>

</Project>`,

    // Program.cs
    'Program.cs': `using {{serviceName}}.Data;
using {{serviceName}}.Services;
using {{serviceName}}.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;
using AutoMapper;
using FluentValidation;
using MediatR;
using {{serviceName}}.Hubs;

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
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add Identity
builder.Services.AddDefaultIdentity<ApplicationUser>(options => 
{
    options.SignIn.RequireConfirmedAccount = false;
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
})
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>();

// Add Blazor services
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// Add SignalR
builder.Services.AddSignalR();

// Add Redis (if configured)
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

// Add AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Add MediatR
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

// Add application services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IDataService, DataService>();

// Add HTTP client
builder.Services.AddHttpClient();

var app = builder.Build();

// Configure the HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");
app.MapHub<NotificationHub>("/notificationHub");

// Seed database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    
    await DbInitializer.InitializeAsync(context, userManager, roleManager);
}

app.Run();`,

    // Models
    'Models/ApplicationUser.cs': `using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.Models;

public class ApplicationUser : IdentityUser
{
    [MaxLength(100)]
    public string? FirstName { get; set; }
    
    [MaxLength(100)]
    public string? LastName { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public bool IsActive { get; set; } = true;
    
    public string FullName => $"{FirstName} {LastName}".Trim();
}`,

    'Models/TodoItem.cs': `using System.ComponentModel.DataAnnotations;

namespace {{serviceName}}.Models;

public class TodoItem
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    public bool IsCompleted { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? CompletedAt { get; set; }
    
    [Required]
    public string UserId { get; set; } = string.Empty;
    
    public ApplicationUser? User { get; set; }
}`,

    // Data
    'Data/ApplicationDbContext.cs': `using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<TodoItem> TodoItems { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Configure TodoItem
        builder.Entity<TodoItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.IsCompleted });
        });
    }
}`,

    'Data/DbInitializer.cs': `using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Models;

namespace {{serviceName}}.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        // Ensure database is created
        await context.Database.EnsureCreatedAsync();

        // Create roles
        var roles = new[] { "Admin", "User" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        // Create default admin user
        var adminEmail = "admin@{{serviceName}}.com";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        
        if (adminUser == null)
        {
            adminUser = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FirstName = "Admin",
                LastName = "User",
                EmailConfirmed = true,
                IsActive = true
            };

            var result = await userManager.CreateAsync(adminUser, "Admin123!");
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }

        // Seed some sample data
        if (!context.TodoItems.Any())
        {
            var sampleTodos = new[]
            {
                new TodoItem
                {
                    Title = "Welcome to {{serviceName}}!",
                    Description = "This is a sample todo item to get you started.",
                    UserId = adminUser.Id,
                    IsCompleted = false
                },
                new TodoItem
                {
                    Title = "Explore Blazor Components",
                    Description = "Check out the various Blazor components and features.",
                    UserId = adminUser.Id,
                    IsCompleted = false
                }
            };

            context.TodoItems.AddRange(sampleTodos);
            await context.SaveChangesAsync();
        }
    }
}`,

    // Services
    'Services/IUserService.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public interface IUserService
{
    Task<IEnumerable<ApplicationUser>> GetUsersAsync();
    Task<ApplicationUser?> GetUserByIdAsync(string id);
    Task<ApplicationUser?> GetUserByEmailAsync(string email);
    Task<bool> UpdateUserAsync(ApplicationUser user);
    Task<bool> DeactivateUserAsync(string id);
}`,

    'Services/UserService.cs': `using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Data;
using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public class UserService : IUserService
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<UserService> _logger;

    public UserService(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        ILogger<UserService> logger)
    {
        _context = context;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<IEnumerable<ApplicationUser>> GetUsersAsync()
    {
        try
        {
            return await _context.Users
                .Where(u => u.IsActive)
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users");
            return new List<ApplicationUser>();
        }
    }

    public async Task<ApplicationUser?> GetUserByIdAsync(string id)
    {
        try
        {
            return await _userManager.FindByIdAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user by ID: {UserId}", id);
            return null;
        }
    }

    public async Task<ApplicationUser?> GetUserByEmailAsync(string email)
    {
        try
        {
            return await _userManager.FindByEmailAsync(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving user by email: {Email}", email);
            return null;
        }
    }

    public async Task<bool> UpdateUserAsync(ApplicationUser user)
    {
        try
        {
            var result = await _userManager.UpdateAsync(user);
            return result.Succeeded;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user: {UserId}", user.Id);
            return false;
        }
    }

    public async Task<bool> DeactivateUserAsync(string id)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user != null)
            {
                user.IsActive = false;
                var result = await _userManager.UpdateAsync(user);
                return result.Succeeded;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deactivating user: {UserId}", id);
            return false;
        }
    }
}`,

    'Services/IDataService.cs': `using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public interface IDataService
{
    Task<IEnumerable<TodoItem>> GetTodoItemsAsync(string userId);
    Task<TodoItem?> GetTodoItemByIdAsync(int id, string userId);
    Task<TodoItem> CreateTodoItemAsync(TodoItem todoItem);
    Task<bool> UpdateTodoItemAsync(TodoItem todoItem);
    Task<bool> DeleteTodoItemAsync(int id, string userId);
    Task<bool> ToggleTodoItemAsync(int id, string userId);
    Task<int> GetTodoCountAsync(string userId);
    Task<int> GetCompletedTodoCountAsync(string userId);
}`,

    'Services/DataService.cs': `using Microsoft.EntityFrameworkCore;
using {{serviceName}}.Data;
using {{serviceName}}.Models;

namespace {{serviceName}}.Services;

public class DataService : IDataService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DataService> _logger;

    public DataService(ApplicationDbContext context, ILogger<DataService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<TodoItem>> GetTodoItemsAsync(string userId)
    {
        try
        {
            return await _context.TodoItems
                .Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving todo items for user: {UserId}", userId);
            return new List<TodoItem>();
        }
    }

    public async Task<TodoItem?> GetTodoItemByIdAsync(int id, string userId)
    {
        try
        {
            return await _context.TodoItems
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving todo item: {TodoId} for user: {UserId}", id, userId);
            return null;
        }
    }

    public async Task<TodoItem> CreateTodoItemAsync(TodoItem todoItem)
    {
        try
        {
            _context.TodoItems.Add(todoItem);
            await _context.SaveChangesAsync();
            return todoItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating todo item for user: {UserId}", todoItem.UserId);
            throw;
        }
    }

    public async Task<bool> UpdateTodoItemAsync(TodoItem todoItem)
    {
        try
        {
            _context.TodoItems.Update(todoItem);
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating todo item: {TodoId}", todoItem.Id);
            return false;
        }
    }

    public async Task<bool> DeleteTodoItemAsync(int id, string userId)
    {
        try
        {
            var todoItem = await _context.TodoItems
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
            
            if (todoItem != null)
            {
                _context.TodoItems.Remove(todoItem);
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting todo item: {TodoId} for user: {UserId}", id, userId);
            return false;
        }
    }

    public async Task<bool> ToggleTodoItemAsync(int id, string userId)
    {
        try
        {
            var todoItem = await _context.TodoItems
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
            
            if (todoItem != null)
            {
                todoItem.IsCompleted = !todoItem.IsCompleted;
                todoItem.CompletedAt = todoItem.IsCompleted ? DateTime.UtcNow : null;
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error toggling todo item: {TodoId} for user: {UserId}", id, userId);
            return false;
        }
    }

    public async Task<int> GetTodoCountAsync(string userId)
    {
        try
        {
            return await _context.TodoItems
                .CountAsync(t => t.UserId == userId && !t.IsCompleted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting todo count for user: {UserId}", userId);
            return 0;
        }
    }

    public async Task<int> GetCompletedTodoCountAsync(string userId)
    {
        try
        {
            return await _context.TodoItems
                .CountAsync(t => t.UserId == userId && t.IsCompleted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting completed todo count for user: {UserId}", userId);
            return 0;
        }
    }
}`,

    'Services/INotificationService.cs': `namespace {{serviceName}}.Services;

public interface INotificationService
{
    Task SendNotificationAsync(string userId, string message);
    Task BroadcastNotificationAsync(string message);
    Task SendToGroupAsync(string groupName, string message);
}`,

    'Services/NotificationService.cs': `using Microsoft.AspNetCore.SignalR;
using {{serviceName}}.Hubs;

namespace {{serviceName}}.Services;

public class NotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IHubContext<NotificationHub> hubContext, ILogger<NotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task SendNotificationAsync(string userId, string message)
    {
        try
        {
            await _hubContext.Clients.User(userId).SendAsync("ReceiveNotification", message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification to user: {UserId}", userId);
        }
    }

    public async Task BroadcastNotificationAsync(string message)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error broadcasting notification");
        }
    }

    public async Task SendToGroupAsync(string groupName, string message)
    {
        try
        {
            await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification to group: {GroupName}", groupName);
        }
    }
}`,

    // SignalR Hub
    'Hubs/NotificationHub.cs': `using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace {{serviceName}}.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"User_{userId}");
        }
        await base.OnDisconnectedAsync(exception);
    }
}`,

    // Pages
    'Pages/_ViewStart.cshtml': `@{
    Layout = "_Layout";
}`,

    'Pages/_ViewImports.cshtml': `@using System.Net.Http
@using Microsoft.AspNetCore.Authorization
@using Microsoft.AspNetCore.Components.Authorization
@using Microsoft.AspNetCore.Components.Forms
@using Microsoft.AspNetCore.Components.Routing
@using Microsoft.AspNetCore.Components.Web
@using Microsoft.AspNetCore.Components.Web.Virtualization
@using Microsoft.JSInterop
@using {{serviceName}}
@using {{serviceName}}.Data
@using {{serviceName}}.Models
@using {{serviceName}}.Services
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers`,

    'Pages/Shared/_Layout.cshtml': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@ViewData["Title"] - {{serviceName}}</title>
    <base href="~/" />
    <link href="css/bootstrap/bootstrap.min.css" rel="stylesheet" />
    <link href="css/app.css" rel="stylesheet" />
    <link href="{{serviceName}}.styles.css" rel="stylesheet" />
    <link href="_content/Microsoft.AspNetCore.Components.Web/css/blazor.web.css" rel="stylesheet" />
</head>
<body>
    @RenderBody()

    <div id="blazor-error-ui">
        <environment include="Staging,Production">
            An error has occurred. This application may no longer respond until reloaded.
        </environment>
        <environment include="Development">
            An unhandled exception has occurred. See browser dev tools for details.
        </environment>
        <a href="" class="reload">Reload</a>
        <a class="dismiss">🗙</a>
    </div>

    <script src="_framework/blazor.server.js"></script>
    <script src="~/js/signalr/dist/browser/signalr.js"></script>
    <script src="~/js/app.js"></script>
</body>
</html>`,

    'Pages/_Host.cshtml': `@page "/"
@namespace {{serviceName}}.Pages
@addTagHelper *, Microsoft.AspNetCore.Mvc.TagHelpers
@{
    Layout = "_Layout";
}

<component type="typeof(App)" render-mode="ServerPrerendered" />`,

    'Pages/Error.cshtml': `@page "/Error"
@model ErrorModel
@{
    ViewData["Title"] = "Error";
}

<h1 class="text-danger">Error.</h1>
<h2 class="text-danger">An error occurred while processing your request.</h2>

@if (Model.ShowRequestId)
{
    <p>
        <strong>Request ID:</strong> <code>@Model.RequestId</code>
    </p>
}

<h3>Development Mode</h3>
<p>
    Swapping to <strong>Development</strong> environment will display more detailed information about the error that occurred.
</p>
<p>
    <strong>The Development environment shouldn't be enabled for deployed applications.</strong>
    It can result in displaying sensitive information from exceptions to end users.
    For local debugging, enable the <strong>Development</strong> environment by setting the <strong>ASPNETCORE_ENVIRONMENT</strong> environment variable to <strong>Development</strong>
    and restarting the app.
</p>`,

    'Pages/Error.cshtml.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Diagnostics;

namespace {{serviceName}}.Pages;

[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
[IgnoreAntiforgeryToken]
public class ErrorModel : PageModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);

    private readonly ILogger<ErrorModel> _logger;

    public ErrorModel(ILogger<ErrorModel> logger)
    {
        _logger = logger;
    }

    public void OnGet()
    {
        RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
    }
}`,

    // Blazor Components
    'App.razor': `<CascadingAuthenticationState>
    <Router AppAssembly="@typeof(App).Assembly">
        <Found Context="routeData">
            <AuthorizeRouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)">
                <NotAuthorized>
                    @if (context.User.Identity?.IsAuthenticated != true)
                    {
                        <RedirectToLogin />
                    }
                    else
                    {
                        <p role="alert">You are not authorized to access this resource.</p>
                    }
                </NotAuthorized>
            </AuthorizeRouteView>
            <FocusOnNavigate RouteData="@routeData" Selector="h1" />
        </Found>
        <NotFound>
            <PageTitle>Not found</PageTitle>
            <LayoutView Layout="@typeof(MainLayout)">
                <p role="alert">Sorry, there's nothing at this address.</p>
            </LayoutView>
        </NotFound>
    </Router>
</CascadingAuthenticationState>`,

    'Shared/MainLayout.razor': `@inherits LayoutViewBase

<div class="page">
    <div class="sidebar">
        <NavMenu />
    </div>

    <main>
        <div class="top-row px-4 auth">
            <LoginDisplay />
            <a href="https://docs.microsoft.com/aspnet/" target="_blank">About</a>
        </div>

        <article class="content px-4">
            @Body
        </article>
    </main>
</div>`,

    'Shared/NavMenu.razor': `<div class="top-row ps-3 navbar navbar-dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="">{{serviceName}}</a>
        <button title="Navigation menu" class="navbar-toggler" @onclick="ToggleNavMenu">
            <span class="navbar-toggler-icon"></span>
        </button>
    </div>
</div>

<div class="@NavMenuCssClass nav-scrollable" @onclick="CollapseNavMenu">
    <nav class="flex-column">
        <div class="nav-item px-3">
            <NavLink class="nav-link" href="" Match="NavLinkMatch.All">
                <span class="oi oi-home" aria-hidden="true"></span> Home
            </NavLink>
        </div>
        <div class="nav-item px-3">
            <NavLink class="nav-link" href="todos">
                <span class="oi oi-list-rich" aria-hidden="true"></span> Todos
            </NavLink>
        </div>
        <div class="nav-item px-3">
            <NavLink class="nav-link" href="users" Match="NavLinkMatch.Prefix">
                <span class="oi oi-people" aria-hidden="true"></span> Users
            </NavLink>
        </div>
    </nav>
</div>

@code {
    private bool collapseNavMenu = true;

    private string? NavMenuCssClass => collapseNavMenu ? "collapse" : null;

    private void ToggleNavMenu()
    {
        collapseNavMenu = !collapseNavMenu;
    }

    private void CollapseNavMenu()
    {
        collapseNavMenu = true;
    }
}`,

    'Shared/LoginDisplay.razor': `<AuthorizeView>
    <Authorized>
        <a href="Identity/Account/Manage">Hello, @context.User.Identity?.Name!</a>
        <form method="post" action="Identity/Account/LogOut">
            <button type="submit" class="nav-link btn btn-link">Log out</button>
        </form>
    </Authorized>
    <NotAuthorized>
        <a href="Identity/Account/Register">Register</a>
        <a href="Identity/Account/Login">Log in</a>
    </NotAuthorized>
</AuthorizeView>`,

    'Shared/RedirectToLogin.razor': `@inject NavigationManager Navigation
@code {
    protected override void OnInitialized()
    {
        Navigation.NavigateTo($"Identity/Account/Login?returnUrl={Uri.EscapeDataString(Navigation.Uri)}", forceLoad: true);
    }
}`,

    // Pages
    'Components/Pages/Home.razor': `@page "/"
@inject IDataService DataService
@inject IUserService UserService
@inject AuthenticationStateProvider AuthenticationStateProvider

<PageTitle>Home</PageTitle>

<div class="mb-4">
    <h1>Welcome to {{serviceName}}!</h1>
    <p class="lead">A modern Blazor Server application with real-time features.</p>
</div>

<AuthorizeView>
    <Authorized>
        <div class="row">
            <div class="col-md-4">
                <div class="card bg-primary text-white mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h5 class="card-title">Active Todos</h5>
                                <h2 class="mb-0">@activeTodos</h2>
                            </div>
                            <div class="align-self-center">
                                <i class="fa fa-tasks fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-success text-white mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h5 class="card-title">Completed</h5>
                                <h2 class="mb-0">@completedTodos</h2>
                            </div>
                            <div class="align-self-center">
                                <i class="fa fa-check-circle fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-info text-white mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h5 class="card-title">Total Users</h5>
                                <h2 class="mb-0">@totalUsers</h2>
                            </div>
                            <div class="align-self-center">
                                <i class="fa fa-users fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Quick Actions</h5>
                    </div>
                    <div class="card-body">
                        <a href="/todos" class="btn btn-primary me-2">Manage Todos</a>
                        <a href="/users" class="btn btn-secondary me-2">View Users</a>
                        <button class="btn btn-info" @onclick="RefreshData">Refresh Data</button>
                    </div>
                </div>
            </div>
        </div>
    </Authorized>
    <NotAuthorized>
        <div class="text-center">
            <h2>Please log in to access the application</h2>
            <a href="Identity/Account/Login" class="btn btn-primary">Log In</a>
            <a href="Identity/Account/Register" class="btn btn-secondary">Register</a>
        </div>
    </NotAuthorized>
</AuthorizeView>

@code {
    private int activeTodos;
    private int completedTodos;
    private int totalUsers;

    protected override async Task OnInitializedAsync()
    {
        await RefreshData();
    }

    private async Task RefreshData()
    {
        var authState = await AuthenticationStateProvider.GetAuthenticationStateAsync();
        if (authState.User.Identity?.IsAuthenticated == true)
        {
            var userId = authState.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userId))
            {
                activeTodos = await DataService.GetTodoCountAsync(userId);
                completedTodos = await DataService.GetCompletedTodoCountAsync(userId);
            }

            var users = await UserService.GetUsersAsync();
            totalUsers = users.Count();
        }

        StateHasChanged();
    }
}`,

    'Components/Pages/Todos.razor': `@page "/todos"
@inject IDataService DataService
@inject AuthenticationStateProvider AuthenticationStateProvider
@inject IJSRuntime JSRuntime
@inject INotificationService NotificationService

<PageTitle>Todo Items</PageTitle>

<div class="d-flex justify-content-between align-items-center mb-4">
    <h1>Todo Items</h1>
    <button class="btn btn-primary" @onclick="ShowCreateModal">
        <i class="fa fa-plus"></i> Add Todo
    </button>
</div>

@if (todos.Any())
{
    <div class="row">
        @foreach (var todo in todos)
        {
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card @(todo.IsCompleted ? "bg-light" : "")">
                    <div class="card-body">
                        <h5 class="card-title @(todo.IsCompleted ? "text-decoration-line-through text-muted" : "")">
                            @todo.Title
                        </h5>
                        @if (!string.IsNullOrEmpty(todo.Description))
                        {
                            <p class="card-text @(todo.IsCompleted ? "text-muted" : "")">@todo.Description</p>
                        }
                        <small class="text-muted">
                            Created: @todo.CreatedAt.ToString("MMM dd, yyyy")
                            @if (todo.CompletedAt.HasValue)
                            {
                                <br />Completed: @todo.CompletedAt.Value.ToString("MMM dd, yyyy")
                            }
                        </small>
                        <div class="mt-2">
                            <button class="btn btn-sm @(todo.IsCompleted ? "btn-outline-warning" : "btn-outline-success")" 
                                    @onclick="() => ToggleTodo(todo.Id)">
                                @(todo.IsCompleted ? "Mark Pending" : "Mark Complete")
                            </button>
                            <button class="btn btn-sm btn-outline-primary" @onclick="() => EditTodo(todo)">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" @onclick="() => DeleteTodo(todo.Id)">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        }
    </div>
}
else
{
    <div class="text-center">
        <p class="lead">No todo items found.</p>
        <button class="btn btn-primary" @onclick="ShowCreateModal">
            Create your first todo
        </button>
    </div>
}

<!-- Create/Edit Modal -->
@if (showModal)
{
    <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5)">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">@(editingTodo?.Id > 0 ? "Edit Todo" : "Create Todo")</h5>
                    <button type="button" class="btn-close" @onclick="HideModal"></button>
                </div>
                <div class="modal-body">
                    <EditForm Model="@editingTodo" OnValidSubmit="@SaveTodo">
                        <DataAnnotationsValidator />
                        <ValidationSummary />
                        
                        <div class="mb-3">
                            <label for="title" class="form-label">Title</label>
                            <InputText id="title" class="form-control" @bind-Value="editingTodo!.Title" />
                            <ValidationMessage For="@(() => editingTodo.Title)" />
                        </div>
                        
                        <div class="mb-3">
                            <label for="description" class="form-label">Description</label>
                            <InputTextArea id="description" class="form-control" @bind-Value="editingTodo.Description" rows="3" />
                            <ValidationMessage For="@(() => editingTodo.Description)" />
                        </div>
                        
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @onclick="HideModal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </div>
                    </EditForm>
                </div>
            </div>
        </div>
    </div>
}

@code {
    private List<TodoItem> todos = new();
    private bool showModal = false;
    private TodoItem? editingTodo;
    private string? currentUserId;

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthenticationStateProvider.GetAuthenticationStateAsync();
        currentUserId = authState.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        
        if (!string.IsNullOrEmpty(currentUserId))
        {
            await LoadTodos();
        }
    }

    private async Task LoadTodos()
    {
        if (!string.IsNullOrEmpty(currentUserId))
        {
            var todoItems = await DataService.GetTodoItemsAsync(currentUserId);
            todos = todoItems.ToList();
            StateHasChanged();
        }
    }

    private void ShowCreateModal()
    {
        editingTodo = new TodoItem { UserId = currentUserId! };
        showModal = true;
    }

    private void EditTodo(TodoItem todo)
    {
        editingTodo = new TodoItem
        {
            Id = todo.Id,
            Title = todo.Title,
            Description = todo.Description,
            IsCompleted = todo.IsCompleted,
            UserId = todo.UserId
        };
        showModal = true;
    }

    private void HideModal()
    {
        showModal = false;
        editingTodo = null;
    }

    private async Task SaveTodo()
    {
        if (editingTodo != null && !string.IsNullOrEmpty(currentUserId))
        {
            if (editingTodo.Id == 0)
            {
                await DataService.CreateTodoItemAsync(editingTodo);
                await NotificationService.SendNotificationAsync(currentUserId, $"Todo '{editingTodo.Title}' created successfully!");
            }
            else
            {
                await DataService.UpdateTodoItemAsync(editingTodo);
                await NotificationService.SendNotificationAsync(currentUserId, $"Todo '{editingTodo.Title}' updated successfully!");
            }

            await LoadTodos();
            HideModal();
        }
    }

    private async Task ToggleTodo(int id)
    {
        if (!string.IsNullOrEmpty(currentUserId))
        {
            await DataService.ToggleTodoItemAsync(id, currentUserId);
            await LoadTodos();
            
            var todo = todos.FirstOrDefault(t => t.Id == id);
            if (todo != null)
            {
                var status = todo.IsCompleted ? "completed" : "reopened";
                await NotificationService.SendNotificationAsync(currentUserId, $"Todo '{todo.Title}' {status}!");
            }
        }
    }

    private async Task DeleteTodo(int id)
    {
        var todo = todos.FirstOrDefault(t => t.Id == id);
        if (todo != null && await JSRuntime.InvokeAsync<bool>("confirm", $"Are you sure you want to delete '{todo.Title}'?"))
        {
            if (!string.IsNullOrEmpty(currentUserId))
            {
                await DataService.DeleteTodoItemAsync(id, currentUserId);
                await LoadTodos();
                await NotificationService.SendNotificationAsync(currentUserId, $"Todo '{todo.Title}' deleted!");
            }
        }
    }
}`,

    'Components/Pages/Users.razor': `@page "/users"
@inject IUserService UserService
@attribute [Authorize(Roles = "Admin")]

<PageTitle>Users</PageTitle>

<div class="d-flex justify-content-between align-items-center mb-4">
    <h1>Users</h1>
    <span class="badge bg-primary">@users.Count() Total Users</span>
</div>

@if (users.Any())
{
    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach (var user in users)
                        {
                            <tr>
                                <td>@user.FullName</td>
                                <td>@user.Email</td>
                                <td>
                                    <span class="badge @(user.IsActive ? "bg-success" : "bg-danger")">
                                        @(user.IsActive ? "Active" : "Inactive")
                                    </span>
                                </td>
                                <td>@user.CreatedAt.ToString("MMM dd, yyyy")</td>
                                <td>
                                    @if (user.IsActive)
                                    {
                                        <button class="btn btn-sm btn-warning" @onclick="() => DeactivateUser(user.Id)">
                                            Deactivate
                                        </button>
                                    }
                                </td>
                            </tr>
                        }
                    </tbody>
                </table>
            </div>
        </div>
    </div>
}
else
{
    <div class="text-center">
        <p class="lead">No users found.</p>
    </div>
}

@code {
    private IEnumerable<ApplicationUser> users = new List<ApplicationUser>();

    protected override async Task OnInitializedAsync()
    {
        await LoadUsers();
    }

    private async Task LoadUsers()
    {
        users = await UserService.GetUsersAsync();
        StateHasChanged();
    }

    private async Task DeactivateUser(string userId)
    {
        await UserService.DeactivateUserAsync(userId);
        await LoadUsers();
    }
}`,

    // Static files
    'wwwroot/css/app.css': `@import url('open-iconic/font/css/open-iconic-bootstrap.min.css');

html, body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

h1:focus {
    outline: none;
}

a, .btn-link {
    color: #0071c1;
}

.btn-primary {
    color: #fff;
    background-color: #1b6ec2;
    border-color: #1861ac;
}

.btn:focus, .btn:active:focus, .btn-link.nav-link:focus, .form-control:focus, .form-check-input:focus {
  box-shadow: 0 0 0 0.1rem white, 0 0 0 0.25rem #258cfb;
}

.content {
    padding-top: 1.1rem;
}

.valid.modified:not([type=checkbox]) {
    outline: 1px solid #26b050;
}

.invalid {
    outline: 1px solid red;
}

.validation-message {
    color: red;
}

#blazor-error-ui {
    background: lightyellow;
    bottom: 0;
    box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.2);
    display: none;
    left: 0;
    padding: 0.6rem 1.25rem 0.7rem 1.25rem;
    position: fixed;
    width: 100%;
    z-index: 1000;
}

#blazor-error-ui .dismiss {
    cursor: pointer;
    position: absolute;
    right: 0.75rem;
    top: 0.5rem;
}

.blazor-error-boundary {
    background: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNDkiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIG92ZXJmbG93PSJoaWRkZW4iPjxkZWZzPjxjbGlwUGF0aCBpZD0iY2xpcDAiPjxyZWN0IHg9IjIzNSIgeT0iNTEiIHdpZHRoPSI1NiIgaGVpZ2h0PSI0OSIvPjwvY2xpcFBhdGg+PC9kZWZzPjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMCkiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0yMzUgLTUxKSI+PHBhdGggZD0iTTI2My41MDYgNTFDMjY0LjcxNyA1MSAyNjUuODEzIDUxLjQ4MzcgMjY2LjYwNiA1Mi4yNjU4TDI2Ny4wNTIgNTIuNzk4NyAyNjcuNTM5IDUzLjYyODMgMjkwLjE4NSA5Mi4xODMxIDI5MC41NDUgOTIuNzk1IDI5MC42NTYgOTIuOTk2QzI5MC44NzcgOTMuNTEzIDI5MSA5NC4wODE1IDI5MSA5NC42NzgyIDI5MSA5Ny4wNjUxIDI4OS4wMzggOTkuMDI3NCAyODYuNjUxIDk5LjAyNzRMMjQ2LjM1OCA5OS4wMjc0QzI0My45NzEgOTkuMDI3NCAyNDIuMDA5IDk3LjA2NTEgMjQyLjAwOSA5NC42NzgyIDI0Mi4wMDkgOTQuMDgxNSAyNDIuMTMxIDkzLjUxMyAyNDIuMzUyIDkyLjk5NkwyNDIuNDYzIDkyLjc5NSAyNDIuODIzIDkyLjE4MzEgMjY1LjQ2OSA1My42MjgzTDI2NS45NTYgNTIuNzk4NyAyNjYuNDAyIDUyLjI2NThDMjY3LjE5NSA1MS40ODM3IDI2OC4yOTEgNTEgMjY5LjUwMiA1MUgyNjkuNTAyWiIgZmlsbD0iI0ZGNTF0QiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9Im5vbmUiLz48cGF0aCBkPSJNMjY3LjI2NyA2Mi4yMTgyTDI2Ny4yNjcgNzYuMzI0NUMyNjcuMjY3IDc3LjYzMjMgMjY2LjIwNSA3OC42OTQxIDI2NC44OTcgNzguNjk0MUMyNjMuNTg5IDc4LjY5NDEgMjYyLjUyNyA3Ny42MzIzIDI2Mi41MjcgNzYuMzI0NUwyNjIuNTI3IDYyLjIxODJDMjYyLjUyNyA2MC45MTA0IDI2My41ODkgNTkuODQ4NiAyNjQuODk3IDU5Ljg0ODZDMjY2LjIwNSA1OS44NDg2IDI2Ny4yNjcgNjAuOTEwNCAyNjcuMjY3IDYyLjIxODJaIiBmaWxsPSIjRkZGRkZGIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0ibm9uZSIvPjxwYXRoIGQ9Ik0yNjQuODk5IDg0LjAxODZDMjY1LjE4NCA4NC4wMTg2IDI2NS40MTQgODQuMjQ5IDI2NS40MTQgODQuNTMzNkMyNjUuNDE0IDg0LjgxODIgMjY1LjE4NCA4NS4wNDg2IDI2NC44OTkgODUuMDQ4NkMyNjQuNjE0IDg1LjA0ODYgMjY0LjM4NCA4NC44MTgyIDI2NC4zODQgODQuNTMzNkMyNjQuMzg0IDg0LjI0OSAyNjQuNjE0IDg0LjAxODYgMjY0Ljg5OSA4NC4wMTg2WiIgZmlsbD0iI0ZGRkZGRiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9Im5vbmUiLz48L2c+PC9zdmc+) no-repeat 1rem/1.8rem, #b32121;
    padding: 1rem 1rem 1rem 3.7rem;
    color: white;
}

.blazor-error-boundary::after {
    content: "An error has occurred."
}

.loading-progress {
    position: relative;
    display: block;
    width: 8rem;
    height: 8rem;
    margin: 20vh auto 1rem auto;
}

.loading-progress circle {
    fill: none;
    stroke: #e0e0e0;
    stroke-width: 0.6rem;
    transform-origin: 50% 50%;
    transform: rotate(-90deg);
}

.loading-progress circle:last-child {
    stroke: #1b6ec2;
    stroke-dasharray: calc(3.141 * var(--blazor-load-percentage, 0%) * 0.8), 500%;
    transition: stroke-dasharray 0.05s ease-in-out;
}

.loading-progress-text {
    position: absolute;
    text-align: center;
    font-weight: bold;
    inset: calc(20vh + 3.25rem) 0 auto 0.2rem;
}

.loading-progress-text:after {
    content: var(--blazor-load-percentage-text, "Loading");
}

.page {
    position: relative;
    display: flex;
    flex-direction: column;
}

.main {
    flex: 1;
}

.sidebar {
    background-image: linear-gradient(180deg, rgb(5, 39, 103) 0%, #3a0647 70%);
}

.top-row {
    background-color: #f7f7f7;
    border-bottom: 1px solid #d6d5d5;
    justify-content: flex-end;
    height: 3.5rem;
    display: flex;
    align-items: center;
}

.top-row ::deep a, .top-row ::deep .btn-link {
    white-space: nowrap;
    margin-left: 1.5rem;
    text-decoration: none;
}

.top-row ::deep a:hover, .top-row ::deep .btn-link:hover {
    text-decoration: underline;
}

.top-row ::deep a:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (max-width: 640.98px) {
    .top-row:not(.auth) {
        display: none;
    }

    .top-row.auth {
        justify-content: space-between;
    }

    .top-row ::deep a, .top-row ::deep .btn-link {
        margin-left: 0;
    }
}

@media (min-width: 641px) {
    .page {
        flex-direction: row;
    }

    .sidebar {
        width: 250px;
        height: 100vh;
        position: sticky;
        top: 0;
    }

    .top-row {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .top-row.auth ::deep a:first-child {
        flex: 1;
        text-align: right;
        width: 0;
    }

    .top-row, article {
        padding-left: 2rem !important;
        padding-right: 1.5rem !important;
    }
}

.sidebar {
    flex-shrink: 0;
}

.sidebar .top-row {
    background-color: rgba(0,0,0,0.4);
}

.sidebar .navbar-brand {
    font-size: 1.1rem;
}

.sidebar .navbar-nav {
    padding-top: 1rem;
}

.sidebar .nav-item {
    font-size: 0.9rem;
    padding-bottom: 0.5rem;
}

.sidebar .nav-item:first-of-type {
    padding-top: 1rem;
}

.sidebar .nav-item:last-of-type {
    padding-bottom: 1rem;
}

.sidebar .nav-item ::deep a {
    color: #d7d7d7;
    border-radius: 4px;
    height: 3rem;
    display: flex;
    align-items: center;
    line-height: 3rem;
}

.sidebar .nav-item ::deep a.active {
    background-color: rgba(255,255,255,0.37);
    color: white;
}

.sidebar .nav-item ::deep a:hover {
    background-color: rgba(255,255,255,0.1);
    color: white;
}`,

    'wwwroot/js/app.js': `// SignalR connection for real-time notifications
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/notificationHub")
    .build();

// Start the connection
connection.start().then(function () {
    console.log("SignalR Connected");
}).catch(function (err) {
    console.error(err.toString());
});

// Listen for notifications
connection.on("ReceiveNotification", function (message) {
    // Create a toast notification
    showToast(message);
});

// Function to show toast notifications
function showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast show position-fixed top-0 end-0 m-3';
    toast.style.zIndex = '9999';
    toast.innerHTML = \`
        <div class="toast-header">
            <strong class="me-auto">Notification</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            \${message}
        </div>
    \`;

    // Add to body
    document.body.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);

    // Remove on close button click
    toast.querySelector('.btn-close').addEventListener('click', () => {
        toast.remove();
    });
}

// Export for use in Blazor
window.blazorCulture = {
    get: () => window.localStorage['BlazorCulture'],
    set: (value) => window.localStorage['BlazorCulture'] = value
};`,

    // Configuration files
    'appsettings.json': `{
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\\\mssqllocaldb;Database={{serviceName}}Db;Trusted_Connection=true;MultipleActiveResultSets=true",
    "Redis": ""
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

A modern Blazor Server application with real-time features, authentication, and comprehensive functionality.

## Features

- **Blazor Server**: Server-side rendering with SignalR for real-time updates
- **Authentication**: ASP.NET Core Identity with role-based authorization
- **Real-time Notifications**: SignalR integration for live notifications
- **Entity Framework Core**: Code-first database approach with migrations
- **Responsive UI**: Bootstrap-based responsive design
- **Structured Logging**: Serilog with multiple output targets
- **Caching**: Redis support with fallback to in-memory caching
- **AutoMapper**: Object-to-object mapping
- **FluentValidation**: Comprehensive input validation
- **MediatR**: CQRS pattern implementation

## Getting Started

### Prerequisites

- .NET 8.0 SDK
- SQL Server or SQL Server LocalDB
- Redis (optional, for distributed caching)

### Installation

1. Clone the repository
2. Update the connection string in \`appsettings.json\`
3. Run the application:

\`\`\`bash
dotnet run
\`\`\`

### Database Setup

The application will automatically create and seed the database on first run.

Default admin user:
- Email: admin@{{serviceName}}.com
- Password: Admin123!

## Development

### Hot Reload

The application supports hot reload in development mode:

\`\`\`bash
dotnet watch run
\`\`\`

### Database Migrations

To add a new migration:

\`\`\`bash
dotnet ef migrations add MigrationName
dotnet ef database update
\`\`\`

## Docker Support

Build and run with Docker:

\`\`\`bash
docker build -t {{serviceName}} .
docker run -p {{port}}:8080 {{serviceName}}
\`\`\`

## Architecture

- **Components**: Reusable Blazor components
- **Services**: Business logic and data access
- **Models**: Entity models and DTOs
- **Hubs**: SignalR hubs for real-time communication
- **Data**: Entity Framework DbContext and configuration

## Security Features

- JWT Bearer authentication
- Role-based authorization
- Input validation with FluentValidation
- SQL injection protection via Entity Framework
- HTTPS enforcement
- Secure headers and CORS configuration

## Performance Features

- Server-side rendering for fast initial load
- Real-time updates without page refresh
- Efficient caching strategies
- Connection pooling
- Optimized database queries

## Testing

Run tests with:

\`\`\`bash
dotnet test
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
`
  }
};