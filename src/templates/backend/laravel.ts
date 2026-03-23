import { BackendTemplate } from '../types';

export const laravelTemplate: BackendTemplate = {
  id: 'laravel',
  name: 'laravel',
  displayName: 'Laravel Framework',
  description: 'Enterprise PHP framework with Eloquent ORM, migrations, queues, and comprehensive features',
  language: 'php',
  framework: 'laravel',
  version: '10.x',
  tags: ['php', 'laravel', 'eloquent', 'mvc', 'api', 'enterprise'],
  port: 8000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing', 'queue'],
  
  files: {
    // Composer configuration
    'composer.json': `{
  "name": "re-shell/{{serviceName}}",
  "type": "project",
  "description": "{{serviceName}} - Laravel API Service",
  "keywords": ["laravel", "api", "microservice"],
  "license": "MIT",
  "require": {
    "php": "^8.1",
    "laravel/framework": "^10.0",
    "laravel/sanctum": "^3.2",
    "laravel/tinker": "^2.8",
    "predis/predis": "^2.0",
    "guzzlehttp/guzzle": "^7.5",
    "spatie/laravel-permission": "^5.10",
    "spatie/laravel-query-builder": "^5.3",
    "spatie/laravel-fractal": "^6.0",
    "spatie/laravel-backup": "^8.1",
    "spatie/laravel-activitylog": "^4.7",
    "barryvdh/laravel-cors": "^3.0",
    "fruitcake/laravel-cors": "^3.0",
    "laravel/horizon": "^5.15",
    "laravel/telescope": "^4.14",
    "tymon/jwt-auth": "^2.0",
    "maatwebsite/excel": "^3.1",
    "barryvdh/laravel-dompdf": "^2.0",
    "intervention/image": "^2.7",
    "league/flysystem-aws-s3-v3": "^3.0"
  },
  "require-dev": {
    "fakerphp/faker": "^1.21",
    "laravel/pint": "^1.10",
    "laravel/sail": "^1.21",
    "mockery/mockery": "^1.5",
    "nunomaduro/collision": "^7.0",
    "phpunit/phpunit": "^10.0",
    "spatie/laravel-ignition": "^2.0",
    "barryvdh/laravel-ide-helper": "^2.13",
    "barryvdh/laravel-debugbar": "^3.8",
    "pestphp/pest": "^2.6",
    "pestphp/pest-plugin-laravel": "^2.0"
  },
  "autoload": {
    "psr-4": {
      "App\\\\": "app/",
      "Database\\\\Factories\\\\": "database/factories/",
      "Database\\\\Seeders\\\\": "database/seeders/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "Tests\\\\": "tests/"
    }
  },
  "scripts": {
    "post-autoload-dump": [
      "Illuminate\\\\Foundation\\\\ComposerScripts::postAutoloadDump",
      "@php artisan package:discover --ansi"
    ],
    "post-update-cmd": [
      "@php artisan vendor:publish --tag=laravel-assets --ansi --force"
    ],
    "post-root-package-install": [
      "@php -r \\"file_exists('.env') || copy('.env.example', '.env');\\""
    ],
    "post-create-project-cmd": [
      "@php artisan key:generate --ansi"
    ],
    "test": [
      "@php artisan test"
    ],
    "test-coverage": [
      "@php artisan test --coverage"
    ],
    "format": [
      "@php ./vendor/bin/pint"
    ]
  },
  "extra": {
    "laravel": {
      "dont-discover": []
    }
  },
  "config": {
    "optimize-autoloader": true,
    "preferred-install": "dist",
    "sort-packages": true,
    "allow-plugins": {
      "pestphp/pest-plugin": true,
      "php-http/discovery": true
    }
  },
  "minimum-stability": "stable",
  "prefer-stable": true
}`,

    // Environment configuration
    '.env.example': `APP_NAME={{serviceName}}
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE={{serviceName}}_db
DB_USERNAME=root
DB_PASSWORD=

BROADCAST_DRIVER=log
CACHE_DRIVER=redis
FILESYSTEM_DISK=local
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120

MEMCACHED_HOST=127.0.0.1

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="\${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_HOST=
PUSHER_PORT=443
PUSHER_SCHEME=https
PUSHER_APP_CLUSTER=mt1

VITE_APP_NAME="\${APP_NAME}"
VITE_PUSHER_APP_KEY="\${PUSHER_APP_KEY}"
VITE_PUSHER_HOST="\${PUSHER_HOST}"
VITE_PUSHER_PORT="\${PUSHER_PORT}"
VITE_PUSHER_SCHEME="\${PUSHER_SCHEME}"
VITE_PUSHER_APP_CLUSTER="\${PUSHER_APP_CLUSTER}"

JWT_SECRET=
JWT_TTL=60
JWT_REFRESH_TTL=20160`,

    // Application bootstrap
    'bootstrap/app.php': `<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Foundation\\Configuration\\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \\Laravel\\Sanctum\\Http\\Middleware\\EnsureFrontendRequestsAreStateful::class]);

        $middleware->alias([
            'verified' => \\App\\Http\\Middleware\\EnsureEmailIsVerified::class,
            'role' => \\Spatie\\Permission\\Middlewares\\RoleMiddleware::class,
            'permission' => \\Spatie\\Permission\\Middlewares\\PermissionMiddleware::class,
            'role_or_permission' => \\Spatie\\Permission\\Middlewares\\RoleOrPermissionMiddleware::class,
            'jwt.auth' => \\App\\Http\\Middleware\\JwtMiddleware::class,
            'api.throttle' => \\App\\Http\\Middleware\\ThrottleRequests::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();`,

    // API routes
    'routes/api.php': `<?php

use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\Api\\AuthController;
use App\\Http\\Controllers\\Api\\UserController;
use App\\Http\\Controllers\\Api\\ProductController;
use App\\Http\\Controllers\\Api\\OrderController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::prefix('v1')->group(function () {
    // Authentication
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

    // Public product routes
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
});

// Protected routes
Route::prefix('v1')->middleware(['jwt.auth', 'api.throttle:60,1'])->group(function () {
    // Authentication
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // Users (Admin only)
    Route::middleware(['role:admin'])->group(function () {
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/restore', [UserController::class, 'restore']);
        Route::delete('/users/{user}/force', [UserController::class, 'forceDelete']);
    });

    // Products (Admin can modify)
    Route::middleware(['permission:manage-products'])->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    });

    // Orders
    Route::apiResource('orders', OrderController::class);
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel']);
    Route::post('/orders/{order}/complete', [OrderController::class, 'complete']);
});

// Health check
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now()->toIso8601String(),
        'service' => config('app.name'),
        'version' => '1.0.0'
    ]);
});`,

    // Authentication Controller
    'app/Http/Controllers/Api/AuthController.php': `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Http\\Requests\\Auth\\LoginRequest;
use App\\Http\\Requests\\Auth\\RegisterRequest;
use App\\Http\\Resources\\UserResource;
use App\\Models\\User;
use App\\Services\\AuthService;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Support\\Facades\\Hash;

class AuthController extends Controller
{
    protected AuthService $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Register a new user
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password)]);

        $user->assignRole('user');

        $token = $this->authService->generateToken($user);

        return response()->json([
            'message' => 'User registered successfully',
            'user' => new UserResource($user),
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => config('jwt.ttl') * 60
        ], 201);
    }

    /**
     * Login user
     */
    public function login(LoginRequest $request): JsonResponse
    {
        if (!$token = $this->authService->attempt($request->only('email', 'password'))) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $user = auth()->user();
        $user->update(['last_login_at' => now()]);

        return response()->json([
            'message' => 'Login successful',
            'user' => new UserResource($user),
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => config('jwt.ttl') * 60
        ]);
    }

    /**
     * Get authenticated user
     */
    public function me(): JsonResponse
    {
        return response()->json([
            'user' => new UserResource(auth()->user())
        ]);
    }

    /**
     * Logout user
     */
    public function logout(): JsonResponse
    {
        $this->authService->logout();

        return response()->json([
            'message' => 'Successfully logged out'
        ]);
    }

    /**
     * Refresh token
     */
    public function refresh(): JsonResponse
    {
        $token = $this->authService->refresh();

        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => config('jwt.ttl') * 60
        ]);
    }

    /**
     * Change password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed']);

        $user = auth()->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['error' => 'Current password is incorrect'], 400);
        }

        $user->update([
            'password' => Hash::make($request->new_password)
        ]);

        return response()->json([
            'message' => 'Password changed successfully'
        ]);
    }
}`,

    // User Model with Eloquent
    'app/Models/User.php': `<?php

namespace App\\Models;

use Illuminate\\Contracts\\Auth\\MustVerifyEmail;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\SoftDeletes;
use Illuminate\\Foundation\\Auth\\User as Authenticatable;
use Illuminate\\Notifications\\Notifiable;
use Laravel\\Sanctum\\HasApiTokens;
use Spatie\\Permission\\Traits\\HasRoles;
use Spatie\\Activitylog\\Traits\\LogsActivity;
use Spatie\\Activitylog\\LogOptions;
use Tymon\\JWTAuth\\Contracts\\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, SoftDeletes, LogsActivity;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'address',
        'city',
        'country',
        'postal_code',
        'avatar',
        'is_active',
        'last_login_at'];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token'];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'is_active' => 'boolean',
        'password' => 'hashed'];

    /**
     * Activity log options
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'email', 'is_active'])
            ->logOnlyDirty()
            ->useLogName('users');
    }

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     */
    public function getJWTCustomClaims()
    {
        return [
            'roles' => $this->getRoleNames(),
            'permissions' => $this->getAllPermissions()->pluck('name')];
    }

    /**
     * User's orders
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /**
     * User's addresses
     */
    public function addresses()
    {
        return $this->hasMany(Address::class);
    }

    /**
     * Scope for active users
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Check if user is admin
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }
}`,

    // Product Model
    'app/Models/Product.php': `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\SoftDeletes;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;
use Spatie\\Activitylog\\Traits\\LogsActivity;
use Spatie\\Activitylog\\LogOptions;

class Product extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'sale_price',
        'cost',
        'sku',
        'barcode',
        'quantity',
        'category_id',
        'brand_id',
        'is_active',
        'is_featured',
        'weight',
        'dimensions',
        'meta_title',
        'meta_description',
        'meta_keywords'];

    protected $casts = [
        'price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'cost' => 'decimal:2',
        'weight' => 'decimal:2',
        'dimensions' => 'array',
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'];

    /**
     * Activity log options
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'price', 'quantity', 'is_active'])
            ->logOnlyDirty()
            ->useLogName('products');
    }

    /**
     * Product category
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Product brand
     */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * Product images
     */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class);
    }

    /**
     * Product attributes
     */
    public function attributes(): HasMany
    {
        return $this->hasMany(ProductAttribute::class);
    }

    /**
     * Product tags
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'product_tags');
    }

    /**
     * Order items
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Scope for active products
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for featured products
     */
    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    /**
     * Scope for in-stock products
     */
    public function scopeInStock($query)
    {
        return $query->where('quantity', '>', 0);
    }

    /**
     * Get the current price (sale price if available)
     */
    public function getCurrentPriceAttribute()
    {
        return $this->sale_price ?? $this->price;
    }

    /**
     * Check if product is on sale
     */
    public function getIsOnSaleAttribute(): bool
    {
        return $this->sale_price !== null && $this->sale_price < $this->price;
    }

    /**
     * Get discount percentage
     */
    public function getDiscountPercentageAttribute(): ?float
    {
        if (!$this->is_on_sale) {
            return null;
        }

        return round((($this->price - $this->sale_price) / $this->price) * 100, 2);
    }
}`,

    // Migration for users table
    'database/migrations/2024_01_01_000001_create_users_table.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->nullable();
            $table->string('postal_code')->nullable();
            $table->string('avatar')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            $table->index('email');
            $table->index('is_active');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};`,

    // Migration for products table
    'database/migrations/2024_01_01_000002_create_products_table.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('sale_price', 10, 2)->nullable();
            $table->decimal('cost', 10, 2)->nullable();
            $table->string('sku')->unique();
            $table->string('barcode')->nullable()->unique();
            $table->integer('quantity')->default(0);
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->decimal('weight', 8, 2)->nullable();
            $table->json('dimensions')->nullable();
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->text('meta_keywords')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('slug');
            $table->index('sku');
            $table->index('is_active');
            $table->index('is_featured');
            $table->index('quantity');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};`,

    // Queue Job example
    'app/Jobs/ProcessOrderJob.php': `<?php

namespace App\\Jobs;

use App\\Models\\Order;
use App\\Services\\OrderService;
use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Foundation\\Bus\\Dispatchable;
use Illuminate\\Queue\\InteractsWithQueue;
use Illuminate\\Queue\\SerializesModels;
use Illuminate\\Support\\Facades\\Log;

class ProcessOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $backoff = [30, 60, 120];

    protected Order $order;

    /**
     * Create a new job instance.
     */
    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Execute the job.
     */
    public function handle(OrderService $orderService): void
    {
        try {
            Log::info('Processing order', ['order_id' => $this->order->id]);

            // Process payment
            $orderService->processPayment($this->order);

            // Update inventory
            $orderService->updateInventory($this->order);

            // Send confirmation email
            $orderService->sendConfirmationEmail($this->order);

            // Update order status
            $this->order->update([
                'status' => 'processing',
                'processed_at' => now()]);

            Log::info('Order processed successfully', ['order_id' => $this->order->id]);
        } catch (\\Exception $e) {
            Log::error('Order processing failed', [
                'order_id' => $this->order->id,
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\\Throwable $exception): void
    {
        Log::error('Order job failed', [
            'order_id' => $this->order->id,
            'error' => $exception->getMessage()
        ]);

        $this->order->update([
            'status' => 'failed',
            'failed_at' => now(),
            'failure_reason' => $exception->getMessage()
        ]);
    }
}`,

    // Database Seeder
    'database/seeders/DatabaseSeeder.php': `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            UserSeeder::class,
            CategorySeeder::class,
            BrandSeeder::class,
            ProductSeeder::class]);
    }
}`,

    // Role and Permission Seeder
    'database/seeders/RolePermissionSeeder.php': `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;
use Spatie\\Permission\\Models\\Role;
use Spatie\\Permission\\Models\\Permission;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\\Spatie\\Permission\\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions
        $permissions = [
            'view-users',
            'create-users',
            'edit-users',
            'delete-users',
            'manage-products',
            'view-orders',
            'manage-orders',
            'view-reports',
            'manage-settings'];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission, 'guard_name' => 'api']);
        }

        // Create roles and assign permissions
        $adminRole = Role::create(['name' => 'admin', 'guard_name' => 'api']);
        $adminRole->givePermissionTo(Permission::all());

        $managerRole = Role::create(['name' => 'manager', 'guard_name' => 'api']);
        $managerRole->givePermissionTo([
            'view-users',
            'manage-products',
            'view-orders',
            'manage-orders',
            'view-reports']);

        $userRole = Role::create(['name' => 'user', 'guard_name' => 'api']);
        $userRole->givePermissionTo([
            'view-orders']);
    }
}`,

    // PHPUnit configuration
    'phpunit.xml': `<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
>
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>app</directory>
        </include>
    </source>
    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="BCRYPT_ROUNDS" value="4"/>
        <env name="CACHE_DRIVER" value="array"/>
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
        <env name="MAIL_MAILER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
        <env name="SESSION_DRIVER" value="array"/>
        <env name="TELESCOPE_ENABLED" value="false"/>
    </php>
</phpunit>`,

    // Feature test example
    'tests/Feature/AuthTest.php': `<?php

namespace Tests\\Feature;

use App\\Models\\User;
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Illuminate\\Foundation\\Testing\\WithFaker;
use Tests\\TestCase;
use Tymon\\JWTAuth\\Facades\\JWTAuth;

class AuthTest extends TestCase
{
    use RefreshDatabase, WithFaker;

    public function test_user_can_register(): void
    {
        $userData = [
            'name' => $this->faker->name,
            'email' => $this->faker->unique()->safeEmail,
            'password' => 'password123',
            'password_confirmation' => 'password123'];

        $response = $this->postJson('/api/v1/auth/register', $userData);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'name', 'email'],
                'access_token',
                'token_type',
                'expires_in'
            ]);

        $this->assertDatabaseHas('users', [
            'email' => $userData['email']
        ]);
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'password' => bcrypt('password123')
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password123']);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user',
                'access_token',
                'token_type',
                'expires_in'
            ]);
    }

    public function test_user_cannot_login_with_invalid_credentials(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password']);

        $response->assertStatus(401)
            ->assertJson([
                'error' => 'Invalid credentials'
            ]);
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $user = User::factory()->create();
        $token = JWTAuth::fromUser($user);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token])->getJson('/api/v1/auth/me');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email']
            ]);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = JWTAuth::fromUser($user);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token])->postJson('/api/v1/auth/logout');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Successfully logged out'
            ]);
    }
}`,

    // Docker configuration
    'Dockerfile': `FROM php:8.2-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    curl \\
    libpng-dev \\
    libonig-dev \\
    libxml2-dev \\
    zip \\
    unzip \\
    libpq-dev \\
    libzip-dev \\
    redis-tools

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql pdo_pgsql mbstring exif pcntl bcmath gd zip

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy existing application directory contents
COPY . /var/www

# Copy existing application directory permissions
COPY --chown=www-data:www-data . /var/www

# Install dependencies
RUN composer install --no-interaction --optimize-autoloader

# Generate key
RUN php artisan key:generate

# Optimize application
RUN php artisan config:cache && \\
    php artisan route:cache && \\
    php artisan view:cache

# Change current user to www
USER www-data

# Expose port 9000 and start php-fpm server
EXPOSE 9000

# Health check - verify PHP-FPM is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD php-fpm-healthcheck || exit 1

CMD ["php-fpm"]`,

    // Docker Compose configuration
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: {{serviceName}}
    container_name: {{serviceName}}-app
    restart: unless-stopped
    working_dir: /var/www
    volumes:
      - ./:/var/www
      - ./docker/php/local.ini:/usr/local/etc/php/conf.d/local.ini
    networks:
      - {{serviceName}}-network

  webserver:
    image: nginx:alpine
    container_name: {{serviceName}}-nginx
    restart: unless-stopped
    ports:
      - "8000:80"
    volumes:
      - ./:/var/www
      - ./docker/nginx/conf.d/:/etc/nginx/conf.d/
    networks:
      - {{serviceName}}-network

  db:
    image: mysql:8.0
    container_name: {{serviceName}}-db
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_DATABASE: {{serviceName}}_db
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_PASSWORD: secret
      MYSQL_USER: {{serviceName}}
    volumes:
      - dbdata:/var/lib/mysql
      - ./docker/mysql/my.cnf:/etc/mysql/my.cnf
    networks:
      - {{serviceName}}-network

  redis:
    image: redis:alpine
    container_name: {{serviceName}}-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - {{serviceName}}-network

  queue:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: {{serviceName}}-queue
    restart: unless-stopped
    command: php artisan queue:work --sleep=3 --tries=3
    volumes:
      - ./:/var/www
    depends_on:
      - app
      - db
      - redis
    networks:
      - {{serviceName}}-network

  scheduler:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: {{serviceName}}-scheduler
    restart: unless-stopped
    command: php artisan schedule:work
    volumes:
      - ./:/var/www
    depends_on:
      - app
      - db
    networks:
      - {{serviceName}}-network

networks:
  {{serviceName}}-network:
    driver: bridge

volumes:
  dbdata:
    driver: local`,

    '.dockerignore': `# Composer
vendor/
composer.lock

# Laravel specific
storage/*.key
.env.backup
.phpunit.result.cache

# Framework cache
bootstrap/cache/*
storage/framework/cache/*
storage/framework/sessions/*
storage/framework/views/*

# Logs
*.log
storage/logs/*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Git
.git/
.gitignore

# Docker
docker-compose.yml
Dockerfile`,

    // Artisan console script
    'artisan': `#!/usr/bin/env php
<?php

define('LARAVEL_START', microtime(true));

/*
|--------------------------------------------------------------------------
| Register The Auto Loader
|--------------------------------------------------------------------------
*/

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';

/*
|--------------------------------------------------------------------------
| Run The Artisan Application
|--------------------------------------------------------------------------
*/

$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);

$status = $kernel->handle(
    $input = new Symfony\\Component\\Console\\Input\\ArgvInput,
    new Symfony\\Component\\Console\\Output\\ConsoleOutput
);

/*
|--------------------------------------------------------------------------
| Shutdown The Application
|--------------------------------------------------------------------------
*/

$kernel->terminate($input, $status);

exit($status);`,

    // README
    'README.md': `# {{serviceName}} - Laravel API Service

Enterprise PHP API built with Laravel framework, featuring Eloquent ORM, queue management, and comprehensive authentication.

## Features

- 🔐 **JWT Authentication**: Secure token-based authentication
- 🗄️ **Eloquent ORM**: Powerful database abstraction with migrations
- 📦 **Queue Management**: Background job processing with Redis
- 🔒 **Role-Based Access Control**: Spatie Laravel Permission integration
- 📊 **Activity Logging**: Comprehensive audit trails
- 🧪 **Testing**: PHPUnit and Pest testing frameworks
- 🐳 **Docker Ready**: Complete containerization setup
- 📝 **API Documentation**: Auto-generated with Laravel Sanctum

## Quick Start

### Requirements

- PHP >= 8.1
- Composer
- MySQL/PostgreSQL
- Redis
- Docker (optional)

### Installation

1. Install dependencies:
\`\`\`bash
composer install
\`\`\`

2. Configure environment:
\`\`\`bash
cp .env.example .env
php artisan key:generate
\`\`\`

3. Run migrations:
\`\`\`bash
php artisan migrate --seed
\`\`\`

4. Start development server:
\`\`\`bash
php artisan serve
\`\`\`

### Docker Setup

\`\`\`bash
docker-compose up -d
docker-compose exec app php artisan migrate --seed
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/logout\` - Logout user
- \`POST /api/v1/auth/refresh\` - Refresh JWT token
- \`GET /api/v1/auth/me\` - Get authenticated user

### Users (Admin only)
- \`GET /api/v1/users\` - List users
- \`GET /api/v1/users/{id}\` - Get user details
- \`POST /api/v1/users\` - Create user
- \`PUT /api/v1/users/{id}\` - Update user
- \`DELETE /api/v1/users/{id}\` - Delete user

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/{id}\` - Get product details
- \`POST /api/v1/products\` - Create product (admin)
- \`PUT /api/v1/products/{id}\` - Update product (admin)
- \`DELETE /api/v1/products/{id}\` - Delete product (admin)

## Queue Workers

Start queue workers:
\`\`\`bash
php artisan queue:work
\`\`\`

Run Laravel Horizon (if installed):
\`\`\`bash
php artisan horizon
\`\`\`

## Testing

Run tests:
\`\`\`bash
php artisan test
# or
./vendor/bin/pest
\`\`\`

With coverage:
\`\`\`bash
php artisan test --coverage
\`\`\`

## Artisan Commands

- \`php artisan migrate\` - Run migrations
- \`php artisan db:seed\` - Seed database
- \`php artisan cache:clear\` - Clear cache
- \`php artisan queue:work\` - Process queue jobs
- \`php artisan schedule:work\` - Run scheduled tasks
- \`php artisan telescope\` - Open Telescope dashboard

## Development Tools

- **Laravel Telescope**: Debug assistant
- **Laravel Horizon**: Queue monitoring
- **Laravel Debugbar**: Development debugging
- **IDE Helper**: Enhanced IDE support

## Production Deployment

1. Optimize for production:
\`\`\`bash
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache
\`\`\`

2. Run migrations:
\`\`\`bash
php artisan migrate --force
\`\`\`

3. Start queue workers and scheduler:
\`\`\`bash
php artisan queue:work --daemon
php artisan schedule:work
\`\`\`

## License

MIT
`
  }
};