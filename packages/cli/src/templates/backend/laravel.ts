import { BackendTemplate } from '../types';

export const laravelTemplate: BackendTemplate = {
  id: 'laravel',
  name: 'laravel',
  displayName: 'Laravel Framework',
  description: 'JSON API on Laravel 13 with JWT auth, Spatie roles and permissions, Eloquent, queued jobs and GraphQL',
  language: 'php',
  framework: 'laravel',
  version: '13.x',
  tags: ['php', 'laravel', 'eloquent', 'mvc', 'api', 'jwt', 'graphql'],
  port: 8000,
  dependencies: {},
  features: ['authentication', 'authorization', 'database', 'validation', 'logging', 'testing', 'queue', 'graphql'],

  files: {
    'composer.json': `{
  "name": "re-shell/{{projectName}}",
  "type": "project",
  "description": "{{projectName}} - Laravel API Service",
  "keywords": ["laravel", "api", "microservice"],
  "license": "MIT",
  "require": {
    "php": "^8.3",
    "laravel/framework": "^13.0",
    "laravel/tinker": "^3.0",
    "predis/predis": "^3.0",
    "rebing/graphql-laravel": "^10.0",
    "spatie/laravel-activitylog": "^4.12",
    "spatie/laravel-permission": "^8.0",
    "tymon/jwt-auth": "^2.3"
  },
  "require-dev": {
    "fakerphp/faker": "^1.23",
    "laravel/pint": "^1.27",
    "mockery/mockery": "^1.6",
    "nunomaduro/collision": "^8.6",
    "phpunit/phpunit": "^12.5"
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
    "post-root-package-install": [
      "@php -r \\"file_exists('.env') || copy('.env.example', '.env');\\""
    ],
    "post-create-project-cmd": [
      "@php artisan key:generate --ansi",
      "@php artisan jwt:secret --force --ansi"
    ],
    "test": [
      "@php artisan test"
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
    "sort-packages": true
  },
  "minimum-stability": "stable",
  "prefer-stable": true
}
`,

    '.dockerignore': `# Composer
vendor/

# Laravel specific
storage/*.key
.env.backup
.phpunit.result.cache

# Framework cache
bootstrap/cache/*
!bootstrap/cache/.gitignore
storage/framework/cache/data/*
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
Dockerfile
`,

    '.env.example': `APP_NAME={{projectName}}
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
APP_FRONTEND_URL=http://localhost:3000

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE={{projectName}}_db
DB_USERNAME=root
DB_PASSWORD=

CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=array

REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="\${APP_NAME}"

# Generate with: php artisan jwt:secret
JWT_SECRET=
JWT_TTL=60
JWT_REFRESH_TTL=20160

# Schema introspection is off unless this is false (keep it off in production)
GRAPHQL_DISABLE_INTROSPECTION=false
`,

    '.gitignore': `/vendor
/node_modules
/public/storage
.env
.env.backup
.env.production
.phpunit.result.cache
/storage/*.key
/storage/pail
auth.json
Homestead.json
Homestead.yaml
npm-debug.log
yarn-error.log
`,

    'app/GraphQL/Queries/HealthQuery.php': `<?php

namespace App\\GraphQL\\Queries;

use GraphQL\\Type\\Definition\\Type;
use Rebing\\GraphQL\\Support\\Query;

class HealthQuery extends Query
{
    protected $attributes = [
        'name' => 'health',
        'description' => 'Service health check',
    ];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    /**
     * @param  array<string, mixed>  $args
     */
    public function resolve($root, array $args): bool
    {
        return true;
    }
}
`,

    'app/GraphQL/Queries/HelloQuery.php': `<?php

namespace App\\GraphQL\\Queries;

use GraphQL\\Type\\Definition\\Type;
use Rebing\\GraphQL\\Support\\Query;

class HelloQuery extends Query
{
    protected $attributes = [
        'name' => 'hello',
        'description' => 'A simple hello query',
    ];

    public function type(): Type
    {
        return Type::nonNull(Type::string());
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function args(): array
    {
        return [
            'name' => [
                'type' => Type::string(),
                'defaultValue' => 'World',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $args
     */
    public function resolve($root, array $args): string
    {
        return 'Hello, '.($args['name'] ?? 'World').'!';
    }
}
`,

    'app/Http/Controllers/Api/AuthController.php': `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Http\\Requests\\Auth\\LoginRequest;
use App\\Http\\Requests\\Auth\\RegisterRequest;
use App\\Http\\Resources\\UserResource;
use App\\Models\\User;
use App\\Services\\AuthService;
use Illuminate\\Auth\\Events\\PasswordReset;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Auth;
use Illuminate\\Support\\Facades\\Hash;
use Illuminate\\Support\\Facades\\Password;
use Illuminate\\Support\\Str;
use Spatie\\Permission\\Models\\Role;

class AuthController extends Controller
{
    public function __construct(protected AuthService $authService)
    {
        //
    }

    /**
     * Register a new user.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->safe()->only(['name', 'email', 'password']));

        $user->assignRole(Role::findOrCreate('user', 'api'));

        return $this->tokenResponse('User registered successfully', $user, $this->authService->generateToken($user), 201);
    }

    /**
     * Log in with email and password.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $token = $this->authService->attempt($request->only('email', 'password'));

        if ($token === false) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $user = Auth::guard('api')->user();
        $user->update(['last_login_at' => now()]);

        return $this->tokenResponse('Login successful', $user, $token);
    }

    public function me(): JsonResponse
    {
        return response()->json([
            'user' => new UserResource(Auth::guard('api')->user()),
        ]);
    }

    public function logout(): JsonResponse
    {
        $this->authService->logout();

        return response()->json(['message' => 'Successfully logged out']);
    }

    public function refresh(): JsonResponse
    {
        return response()->json([
            'access_token' => $this->authService->refresh(),
            'token_type' => 'bearer',
            'expires_in' => (int) config('jwt.ttl') * 60,
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = Auth::guard('api')->user();

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['error' => 'Current password is incorrect'], 400);
        }

        $user->update(['password' => $validated['new_password']]);

        return response()->json(['message' => 'Password changed successfully']);
    }

    /**
     * Email a password reset link (the answer never reveals whether the address exists).
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($validated);

        return response()->json(['message' => 'If the address is registered, a reset link has been sent']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password): void {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['error' => __($status)], 400);
        }

        return response()->json(['message' => 'Password has been reset']);
    }

    protected function tokenResponse(string $message, User $user, string $token, int $status = 200): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'user' => new UserResource($user),
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => (int) config('jwt.ttl') * 60,
        ], $status);
    }
}
`,

    'app/Http/Controllers/Api/OrderController.php': `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Jobs\\ProcessOrderJob;
use App\\Models\\Order;
use App\\Models\\User;
use App\\Services\\OrderService;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Pagination\\LengthAwarePaginator;
use Illuminate\\Support\\Facades\\Auth;

class OrderController extends Controller
{
    public function __construct(protected OrderService $orders)
    {
        //
    }

    /**
     * Customers list their own orders; users with manage-orders list everyone's.
     */
    public function index(Request $request): LengthAwarePaginator
    {
        $user = $this->user();

        return Order::query()
            ->with('items')
            ->when(! $user->can('manage-orders'), fn ($query) => $query->where('user_id', $user->id))
            ->latest('id')
            ->paginate($this->perPage($request));
    }

    public function show(Order $order): Order
    {
        $this->authorizeOrder($order);

        return $order->load('items.product');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $order = $this->orders->create($this->user(), $validated['items'], $validated['notes'] ?? null);

        ProcessOrderJob::dispatch($order);

        return response()->json($order->refresh()->load('items'), 201);
    }

    public function cancel(Order $order): Order
    {
        $this->authorizeOrder($order);

        return $this->orders->cancel($order)->load('items');
    }

    /**
     * Route middleware requires the manage-orders permission.
     */
    public function complete(Order $order): Order
    {
        return $this->orders->complete($order);
    }

    protected function user(): User
    {
        /** @var User $user */
        $user = Auth::guard('api')->user();

        return $user;
    }

    protected function authorizeOrder(Order $order): void
    {
        $user = $this->user();

        abort_unless($order->user_id === $user->id || $user->can('manage-orders'), 403, 'This order belongs to another user.');
    }
}
`,

    'app/Http/Controllers/Api/ProductController.php': `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\Product;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Pagination\\LengthAwarePaginator;
use Illuminate\\Support\\Str;
use Illuminate\\Validation\\Rule;

class ProductController extends Controller
{
    /**
     * List active products. Filters: search, category_id, featured, in_stock, per_page.
     */
    public function index(Request $request): LengthAwarePaginator
    {
        return Product::query()
            ->active()
            ->with('category')
            ->when($request->query('search'), function ($query, string $search) {
                $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"));
            })
            ->when($request->query('category_id'), fn ($query, $id) => $query->where('category_id', $id))
            ->when($request->boolean('featured'), fn ($query) => $query->featured())
            ->when($request->boolean('in_stock'), fn ($query) => $query->inStock())
            ->orderBy('id')
            ->paginate($this->perPage($request));
    }

    public function show(Product $product): Product
    {
        return $product->load('category');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $validated['slug'] ??= $this->uniqueSlug($validated['name']);

        $product = Product::create($validated);

        return response()->json($product->load('category'), 201);
    }

    public function update(Request $request, Product $product): Product
    {
        $validated = $request->validate($this->rules($product));

        $product->update($validated);

        return $product->load('category');
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json(['message' => 'Product deleted']);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    protected function rules(?Product $product = null): array
    {
        $required = $product === null ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', Rule::unique('products', 'slug')->ignore($product?->id)],
            'description' => ['nullable', 'string'],
            'price' => [$required, 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'sku' => [$required, 'string', 'max:100', Rule::unique('products', 'sku')->ignore($product?->id)],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('products', 'barcode')->ignore($product?->id)],
            'quantity' => ['sometimes', 'integer', 'min:0'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'dimensions' => ['nullable', 'array'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'meta_keywords' => ['nullable', 'string'],
        ];
    }

    protected function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'product';
        $slug = $base;
        $suffix = 2;

        while (Product::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
`,

    'app/Http/Controllers/Api/UserController.php': `<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Http\\Resources\\UserResource;
use App\\Models\\User;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\AnonymousResourceCollection;
use Illuminate\\Validation\\Rule;
use Spatie\\Permission\\Models\\Role;

/**
 * User administration (routes are guarded by the "admin" role).
 */
class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $users = User::query()
            ->with('roles')
            ->when($request->query('search'), function ($query, string $search) {
                $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
            })
            ->when($request->boolean('only_trashed'), fn ($query) => $query->onlyTrashed())
            ->orderBy('id')
            ->paginate($this->perPage($request));

        return UserResource::collection($users);
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user->load('roles'));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'role' => ['sometimes', 'string', Rule::exists('roles', 'name')->where('guard_name', 'api')],
        ]);

        $user = User::create(collect($validated)->except('role')->all());
        $user->assignRole(Role::findOrCreate($validated['role'] ?? 'user', 'api'));

        return (new UserResource($user->load('roles')))->response()->setStatusCode(201);
    }

    public function update(Request $request, User $user): UserResource
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'role' => ['sometimes', 'string', Rule::exists('roles', 'name')->where('guard_name', 'api')],
        ]);

        $user->update(collect($validated)->except('role')->all());

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        return new UserResource($user->load('roles'));
    }

    public function destroy(User $user): JsonResponse
    {
        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    public function restore(User $user): UserResource
    {
        $user->restore();

        return new UserResource($user->load('roles'));
    }

    public function forceDelete(User $user): JsonResponse
    {
        $user->forceDelete();

        return response()->json(['message' => 'User permanently deleted']);
    }
}
`,

    'app/Http/Controllers/Controller.php': `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;

abstract class Controller
{
    /**
     * Page size from the per_page query parameter, clamped to 1..100 (default 15).
     */
    protected function perPage(Request $request): int
    {
        return max(1, min($request->integer('per_page', 15), 100));
    }
}
`,

    'app/Http/Requests/Auth/LoginRequest.php': `<?php

namespace App\\Http\\Requests\\Auth;

use Illuminate\\Foundation\\Http\\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
`,

    'app/Http/Requests/Auth/RegisterRequest.php': `<?php

namespace App\\Http\\Requests\\Auth;

use Illuminate\\Foundation\\Http\\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }
}
`,

    'app/Http/Resources/UserResource.php': `<?php

namespace App\\Http\\Resources;

use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'city' => $this->city,
            'country' => $this->country,
            'is_active' => $this->is_active,
            'roles' => $this->getRoleNames(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
`,

    'app/Jobs/ProcessOrderJob.php': `<?php

namespace App\\Jobs;

use App\\Models\\Order;
use App\\Services\\OrderService;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Foundation\\Queue\\Queueable;
use Illuminate\\Support\\Facades\\Log;

class ProcessOrderJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [30, 60, 120];

    public function __construct(public Order $order)
    {
        //
    }

    public function handle(OrderService $orderService): void
    {
        Log::info('Processing order', ['order_id' => $this->order->id]);

        // Payment, stock and status change commit together, and only for a pending
        // order: a retry, a duplicate delivery or an order cancelled in the meantime
        // is skipped instead of charging and taking the stock twice.
        if (! $orderService->process($this->order)) {
            Log::info('Order is no longer pending, skipped', [
                'order_id' => $this->order->id,
                'status' => $this->order->status,
            ]);

            return;
        }

        // The order is processed and committed; a mail failure is reported, not retried.
        rescue(fn () => $orderService->sendConfirmationEmail($this->order));

        Log::info('Order processed', ['order_id' => $this->order->id]);
    }

    public function failed(\\Throwable $exception): void
    {
        Log::error('Order job failed', [
            'order_id' => $this->order->id,
            'error' => $exception->getMessage(),
        ]);

        // Only a still-pending order is marked failed (never one cancelled meanwhile).
        Order::whereKey($this->order->id)
            ->where('status', Order::STATUS_PENDING)
            ->update([
                'status' => Order::STATUS_FAILED,
                'failed_at' => now(),
                'failure_reason' => $exception->getMessage(),
            ]);
    }
}
`,

    'app/Models/Category.php': `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
`,

    'app/Models/Order.php': `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class Order extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id',
        'number',
        'status',
        'total',
        'notes',
        'processed_at',
        'failed_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'total' => 'decimal:2',
            'processed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
`,

    'app/Models/OrderItem.php': `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'quantity',
        'unit_price',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
`,

    'app/Models/Product.php': `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;
use Illuminate\\Database\\Eloquent\\SoftDeletes;
use Spatie\\Activitylog\\LogOptions;
use Spatie\\Activitylog\\Traits\\LogsActivity;

class Product extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

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
        'is_active',
        'is_featured',
        'weight',
        'dimensions',
        'meta_title',
        'meta_description',
        'meta_keywords',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'cost' => 'decimal:2',
            'weight' => 'decimal:2',
            'quantity' => 'integer',
            'dimensions' => 'array',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'price', 'quantity', 'is_active'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('products');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    public function scopeInStock($query)
    {
        return $query->where('quantity', '>', 0);
    }

    /**
     * The price a customer pays (the sale price when there is one).
     */
    public function getCurrentPriceAttribute(): string
    {
        return $this->sale_price ?? $this->price;
    }

    public function getIsOnSaleAttribute(): bool
    {
        return $this->sale_price !== null && (float) $this->sale_price < (float) $this->price;
    }

    public function getDiscountPercentageAttribute(): ?float
    {
        if (! $this->is_on_sale) {
            return null;
        }

        return round((((float) $this->price - (float) $this->sale_price) / (float) $this->price) * 100, 2);
    }
}
`,

    'app/Models/User.php': `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;
use Illuminate\\Database\\Eloquent\\SoftDeletes;
use Illuminate\\Foundation\\Auth\\User as Authenticatable;
use Illuminate\\Notifications\\Notifiable;
use Spatie\\Activitylog\\LogOptions;
use Spatie\\Activitylog\\Traits\\LogsActivity;
use Spatie\\Permission\\Traits\\HasRoles;
use Tymon\\JWTAuth\\Contracts\\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, HasRoles, LogsActivity, Notifiable, SoftDeletes;

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
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'email', 'is_active'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('users');
    }

    /**
     * The identifier stored in the subject claim of the JWT.
     */
    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /**
     * Custom claims added to the JWT.
     *
     * @return array<string, mixed>
     */
    public function getJWTCustomClaims(): array
    {
        return [
            'roles' => $this->getRoleNames()->all(),
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }
}
`,

    'app/Providers/AppServiceProvider.php': `<?php

namespace App\\Providers;

use Illuminate\\Auth\\Notifications\\ResetPassword;
use Illuminate\\Cache\\RateLimiting\\Limit;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\RateLimiter;
use Illuminate\\Support\\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // General API traffic: per user when a valid token is sent, per IP otherwise.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->getAuthIdentifier() ?: $request->ip());
        });

        // Login, registration and password reset: guessing credentials or tokens and
        // mail flooding are slowed down per IP.
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // There is no password.reset web route in an API: the reset mail links
        // to the frontend, which posts the token to /api/v1/auth/reset-password.
        ResetPassword::createUrlUsing(function ($user, string $token): string {
            $frontend = rtrim((string) config('frontend.url'), '/');

            return $frontend.'/reset-password?token='.$token.'&email='.urlencode($user->getEmailForPasswordReset());
        });
    }
}
`,

    'app/Services/AuthService.php': `<?php

namespace App\\Services;

use App\\Models\\User;
use Illuminate\\Support\\Facades\\Auth;
use Tymon\\JWTAuth\\JWTGuard;

class AuthService
{
    protected function guard(): JWTGuard
    {
        /** @var JWTGuard $guard */
        $guard = Auth::guard('api');

        return $guard;
    }

    /**
     * Issue a JWT for the given user.
     */
    public function generateToken(User $user): string
    {
        return $this->guard()->login($user);
    }

    /**
     * Validate credentials (active users only) and issue a JWT.
     *
     * @param  array{email: string, password: string}  $credentials
     */
    public function attempt(array $credentials): string|false
    {
        return $this->guard()->attempt($credentials + ['is_active' => true]);
    }

    public function logout(): void
    {
        $this->guard()->logout();
    }

    public function refresh(): string
    {
        return $this->guard()->refresh();
    }
}
`,

    'app/Services/OrderService.php': `<?php

namespace App\\Services;

use App\\Models\\Order;
use App\\Models\\Product;
use App\\Models\\User;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Log;
use Illuminate\\Support\\Facades\\Mail;
use Illuminate\\Support\\Str;
use Illuminate\\Validation\\ValidationException;

class OrderService
{
    /**
     * Create a pending order from a list of [product_id, quantity] lines.
     *
     * @param  array<int, array{product_id: int, quantity: int}>  $lines
     */
    public function create(User $user, array $lines, ?string $notes = null): Order
    {
        return DB::transaction(function () use ($user, $lines, $notes) {
            $order = Order::create([
                'user_id' => $user->id,
                'number' => 'ORD-'.strtoupper(Str::random(10)),
                'status' => Order::STATUS_PENDING,
                'total' => 0,
                'notes' => $notes,
            ]);

            $total = 0.0;

            foreach ($lines as $index => $line) {
                $product = Product::active()->find($line['product_id']);

                if ($product === null || $product->quantity < $line['quantity']) {
                    throw ValidationException::withMessages([
                        "items.$index.quantity" => ['Product is unavailable or not enough stock is left.'],
                    ]);
                }

                $unitPrice = (float) $product->current_price;
                $lineTotal = round($unitPrice * $line['quantity'], 2);

                $order->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $line['quantity'],
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                ]);

                $total += $lineTotal;
            }

            $order->update(['total' => round($total, 2)]);

            return $order->load('items');
        });
    }

    /**
     * Capture the payment and take the stock for a pending order, in one transaction.
     *
     * Returns false (and changes nothing) when the order is no longer pending: it was
     * cancelled before a worker picked it up, or an earlier attempt already processed
     * it. That makes the queued job safe to retry or to deliver twice.
     */
    public function process(Order $order): bool
    {
        $processed = DB::transaction(function () use ($order) {
            $locked = Order::query()->with('items')->lockForUpdate()->find($order->id);

            if ($locked === null || $locked->status !== Order::STATUS_PENDING) {
                return false;
            }

            $this->processPayment($locked);
            $this->updateInventory($locked);

            $locked->update([
                'status' => Order::STATUS_PROCESSING,
                'processed_at' => now(),
            ]);

            return true;
        });

        $order->refresh();

        return $processed;
    }

    /**
     * Capture the payment. This is a placeholder: call your payment provider here.
     */
    public function processPayment(Order $order): void
    {
        Log::info('Payment captured (simulated)', ['order_id' => $order->id, 'total' => $order->total]);
    }

    /**
     * Take the ordered quantities out of stock.
     */
    public function updateInventory(Order $order): void
    {
        DB::transaction(function () use ($order) {
            foreach ($order->items as $item) {
                $updated = Product::whereKey($item->product_id)
                    ->where('quantity', '>=', $item->quantity)
                    ->decrement('quantity', $item->quantity);

                if ($updated === 0) {
                    throw new \\RuntimeException("Not enough stock for product {$item->product_id}.");
                }
            }
        });
    }

    public function sendConfirmationEmail(Order $order): void
    {
        $order->loadMissing('user');

        Mail::raw(
            "Thank you for your order {$order->number}. Total: {$order->total}.",
            fn ($message) => $message->to($order->user->email)->subject("Order {$order->number} received"),
        );
    }

    public function cancel(Order $order): Order
    {
        DB::transaction(function () use ($order) {
            // Lock the row so a worker processing the order at the same time waits for us.
            $locked = Order::query()->with('items')->lockForUpdate()->findOrFail($order->id);

            if (! in_array($locked->status, [Order::STATUS_PENDING, Order::STATUS_PROCESSING], true)) {
                throw ValidationException::withMessages(['status' => ['Only pending or processing orders can be cancelled.']]);
            }

            // Stock was only taken once the order had been processed.
            if ($locked->processed_at !== null) {
                foreach ($locked->items as $item) {
                    Product::withTrashed()->whereKey($item->product_id)->increment('quantity', $item->quantity);
                }
            }

            $locked->update(['status' => Order::STATUS_CANCELLED]);
        });

        return $order->refresh();
    }

    public function complete(Order $order): Order
    {
        $updated = Order::whereKey($order->id)
            ->where('status', Order::STATUS_PROCESSING)
            ->update(['status' => Order::STATUS_COMPLETED]);

        if ($updated === 0) {
            throw ValidationException::withMessages(['status' => ['Only processing orders can be completed.']]);
        }

        return $order->refresh();
    }
}
`,

    'artisan': `#!/usr/bin/env php
<?php

use Illuminate\\Foundation\\Application;
use Symfony\\Component\\Console\\Input\\ArgvInput;

define('LARAVEL_START', microtime(true));

// Register the Composer autoloader...
require __DIR__.'/vendor/autoload.php';

// Bootstrap Laravel and handle the command...
/** @var Application $app */
$app = require_once __DIR__.'/bootstrap/app.php';

$status = $app->handleCommand(new ArgvInput);

exit($status);
`,

    'bootstrap/app.php': `<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Foundation\\Configuration\\Middleware;
use Illuminate\\Http\\Request;
use Spatie\\Permission\\Middleware\\PermissionMiddleware;
use Spatie\\Permission\\Middleware\\RoleMiddleware;
use Spatie\\Permission\\Middleware\\RoleOrPermissionMiddleware;
use Tymon\\JWTAuth\\Exceptions\\JWTException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // This is a JSON API: always answer errors (401, 403, 404, 422...) as JSON.
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $e) => true);

        // A missing, malformed, expired or blacklisted token (e.g. on /auth/refresh)
        // is an authentication failure, not a server error.
        $exceptions->dontReport(JWTException::class);
        $exceptions->render(fn (JWTException $e, Request $request) => response()->json([
            'message' => 'Unauthenticated.',
            'error' => $e->getMessage(),
        ], 401));
    })->create();
`,

    'bootstrap/cache/.gitignore': `*
!.gitignore
`,

    'bootstrap/providers.php': `<?php

use App\\Providers\\AppServiceProvider;

return [
    AppServiceProvider::class,
];
`,

    'config/auth.php': `<?php

use App\\Models\\User;

return [

    /*
    | This service is a stateless JSON API: the only guard is "api", backed by
    | tymon/jwt-auth (driver "jwt"). Spatie roles and permissions use it too.
    */
    'defaults' => [
        'guard' => 'api',
        'passwords' => 'users',
    ],

    'guards' => [
        'api' => [
            'driver' => 'jwt',
            'provider' => 'users',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => User::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => 'password_reset_tokens',
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => 10800,

];
`,

    'config/frontend.php': `<?php

return [

    // Base URL of the web frontend that password reset links point to.
    'url' => env('APP_FRONTEND_URL', env('APP_URL', 'http://localhost')),

];
`,

    'config/graphql.php': `<?php

use App\\GraphQL\\Queries\\HealthQuery;
use App\\GraphQL\\Queries\\HelloQuery;
use Rebing\\GraphQL\\GraphQL;
use Rebing\\GraphQL\\GraphQLController;

// Settings that are not listed here fall back to the defaults shipped by
// rebing/graphql-laravel 10 (see vendor/rebing/graphql-laravel/config/config.php):
// batching off, automatic persisted queries off. The endpoint is POST /graphql.
return [

    'route' => [
        'prefix' => 'graphql',
        'controller' => GraphQLController::class.'@query',
        'middleware' => ['throttle:api'],
        'group_attributes' => [],
    ],

    'default_schema' => 'default',

    'schemas' => [
        'default' => [
            'query' => [
                'hello' => HelloQuery::class,
                'health' => HealthQuery::class,
            ],
            'mutation' => [],
            'types' => [],
            'middleware' => null,
            // POST only (the package default since v10). To allow GET, also add
            // ReadOnlyOperationMiddleware to the execution middleware so GET cannot run mutations.
            'method' => ['POST'],
            'execution_middleware' => null,
            'route_attributes' => [],
        ],
    ],

    'types' => [],

    'error_formatter' => [GraphQL::class, 'formatError'],

    'errors_handler' => [GraphQL::class, 'handleErrors'],

    'security' => [
        'query_max_complexity' => 500,
        'query_max_depth' => 13,
        // Off unless GRAPHQL_DISABLE_INTROSPECTION=false (.env.example enables it for local development).
        'disable_introspection' => env('GRAPHQL_DISABLE_INTROSPECTION', true),
    ],

];
`,

    'database/factories/CategoryFactory.php': `<?php

namespace Database\\Factories;

use App\\Models\\Category;
use Illuminate\\Database\\Eloquent\\Factories\\Factory;
use Illuminate\\Support\\Str;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
`,

    'database/factories/ProductFactory.php': `<?php

namespace Database\\Factories;

use App\\Models\\Category;
use App\\Models\\Product;
use Illuminate\\Database\\Eloquent\\Factories\\Factory;
use Illuminate\\Support\\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name),
            'description' => fake()->paragraph(),
            'price' => fake()->randomFloat(2, 5, 500),
            'sku' => strtoupper(fake()->unique()->bothify('SKU-????-####')),
            'quantity' => fake()->numberBetween(0, 100),
            'category_id' => Category::factory(),
            'is_active' => true,
            'is_featured' => false,
        ];
    }

    public function onSale(): static
    {
        return $this->state(fn (array $attributes) => [
            'sale_price' => round($attributes['price'] * 0.8, 2),
        ]);
    }

    public function featured(): static
    {
        return $this->state(fn () => ['is_featured' => true]);
    }
}
`,

    'database/factories/UserFactory.php': `<?php

namespace Database\\Factories;

use App\\Models\\User;
use Illuminate\\Database\\Eloquent\\Factories\\Factory;
use Illuminate\\Support\\Facades\\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    protected static ?string $password = null;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'phone' => fake()->phoneNumber(),
            'city' => fake()->city(),
            'country' => fake()->country(),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
`,

    'database/migrations/2024_01_01_000001_create_users_table.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
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
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
`,

    'database/migrations/2024_01_01_000002_create_categories_table.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
`,

    'database/migrations/2024_01_01_000003_create_products_table.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
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
            $table->integer('quantity')->default(0)->index();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_featured')->default(false)->index();
            $table->decimal('weight', 8, 2)->nullable();
            $table->json('dimensions')->nullable();
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->text('meta_keywords')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
`,

    'database/migrations/2024_01_01_000004_create_orders_tables.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('number')->unique();
            $table->string('status')->default('pending')->index();
            $table->decimal('total', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
`,

    'database/migrations/2024_01_01_000005_create_permission_tables.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

// Tables for spatie/laravel-permission (teams disabled, default table names).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name');
            $table->string('guard_name');
            $table->timestamps();

            $table->unique(['name', 'guard_name']);
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('name');
            $table->string('guard_name');
            $table->timestamps();

            $table->unique(['name', 'guard_name']);
        });

        Schema::create('model_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type'], 'model_has_permissions_model_id_model_type_index');

            $table->foreign('permission_id')
                ->references('id')
                ->on('permissions')
                ->onDelete('cascade');

            $table->primary(['permission_id', 'model_id', 'model_type'], 'model_has_permissions_permission_model_type_primary');
        });

        Schema::create('model_has_roles', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id');
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type'], 'model_has_roles_model_id_model_type_index');

            $table->foreign('role_id')
                ->references('id')
                ->on('roles')
                ->onDelete('cascade');

            $table->primary(['role_id', 'model_id', 'model_type'], 'model_has_roles_role_model_type_primary');
        });

        Schema::create('role_has_permissions', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->unsignedBigInteger('role_id');

            $table->foreign('permission_id')
                ->references('id')
                ->on('permissions')
                ->onDelete('cascade');

            $table->foreign('role_id')
                ->references('id')
                ->on('roles')
                ->onDelete('cascade');

            $table->primary(['permission_id', 'role_id'], 'role_has_permissions_permission_id_role_id_primary');
        });

        app('cache')
            ->store(config('permission.cache.store') != 'default' ? config('permission.cache.store') : null)
            ->forget(config('permission.cache.key'));
    }

    public function down(): void
    {
        Schema::drop('role_has_permissions');
        Schema::drop('model_has_roles');
        Schema::drop('model_has_permissions');
        Schema::drop('roles');
        Schema::drop('permissions');
    }
};
`,

    'database/migrations/2024_01_01_000006_create_activity_log_table.php': `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

// Table for spatie/laravel-activitylog (create, event and batch_uuid stubs combined).
return new class extends Migration
{
    public function up(): void
    {
        Schema::connection(config('activitylog.database_connection'))->create(config('activitylog.table_name'), function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('log_name')->nullable();
            $table->text('description');
            $table->nullableMorphs('subject', 'subject');
            $table->string('event')->nullable();
            $table->nullableMorphs('causer', 'causer');
            $table->json('properties')->nullable();
            $table->uuid('batch_uuid')->nullable();
            $table->timestamps();
            $table->index('log_name');
        });
    }

    public function down(): void
    {
        Schema::connection(config('activitylog.database_connection'))->dropIfExists(config('activitylog.table_name'));
    }
};
`,

    'database/seeders/CategorySeeder.php': `<?php

namespace Database\\Seeders;

use App\\Models\\Category;
use Illuminate\\Database\\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Electronics', 'Books', 'Home & Garden', 'Clothing'] as $name) {
            Category::firstOrCreate(
                ['slug' => str($name)->slug()->toString()],
                ['name' => $name, 'is_active' => true],
            );
        }
    }
}
`,

    'database/seeders/DatabaseSeeder.php': `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            UserSeeder::class,
            CategorySeeder::class,
            ProductSeeder::class,
        ]);
    }
}
`,

    'database/seeders/ProductSeeder.php': `<?php

namespace Database\\Seeders;

use App\\Models\\Category;
use App\\Models\\Product;
use Illuminate\\Database\\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        if (Product::query()->exists()) {
            return;
        }

        foreach (Category::all() as $category) {
            Product::factory()->count(5)->create(['category_id' => $category->id]);
            Product::factory()->featured()->onSale()->create(['category_id' => $category->id]);
        }
    }
}
`,

    'database/seeders/RolePermissionSeeder.php': `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;
use Spatie\\Permission\\Models\\Permission;
use Spatie\\Permission\\Models\\Role;
use Spatie\\Permission\\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'view-users',
            'create-users',
            'edit-users',
            'delete-users',
            'manage-products',
            'view-orders',
            'manage-orders',
            'view-reports',
            'manage-settings',
        ];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'api');
        }

        Role::findOrCreate('admin', 'api')->syncPermissions(Permission::where('guard_name', 'api')->get());

        Role::findOrCreate('manager', 'api')->syncPermissions([
            'view-users',
            'manage-products',
            'view-orders',
            'manage-orders',
            'view-reports',
        ]);

        Role::findOrCreate('user', 'api')->syncPermissions(['view-orders']);
    }
}
`,

    'database/seeders/UserSeeder.php': `<?php

namespace Database\\Seeders;

use App\\Models\\User;
use Illuminate\\Database\\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Development accounts (password: "password"). Do not seed these in production.
     */
    public function run(): void
    {
        $accounts = [
            ['name' => 'Admin', 'email' => 'admin@example.com', 'role' => 'admin'],
            ['name' => 'Manager', 'email' => 'manager@example.com', 'role' => 'manager'],
            ['name' => 'Customer', 'email' => 'user@example.com', 'role' => 'user'],
        ];

        foreach ($accounts as $account) {
            $user = User::firstOrNew(['email' => $account['email']]);

            if (! $user->exists) {
                // email_verified_at is not mass assignable, so set the attributes directly.
                $user->forceFill([
                    'name' => $account['name'],
                    'password' => 'password',
                    'email_verified_at' => now(),
                ])->save();
            }

            $user->syncRoles([$account['role']]);
        }
    }
}
`,

    'docker-compose.yml': `services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: {{projectName}}
    container_name: {{projectName}}-app
    restart: unless-stopped
    working_dir: /var/www
    environment: &app-env
      APP_KEY: \${APP_KEY:?run "php artisan key:generate --show" and export APP_KEY}
      JWT_SECRET: \${JWT_SECRET:?run "php artisan jwt:secret --show" and export JWT_SECRET}
      DB_CONNECTION: mysql
      DB_HOST: db
      DB_PORT: 3306
      DB_DATABASE: {{projectName}}_db
      DB_USERNAME: {{projectName}}
      DB_PASSWORD: secret
      REDIS_CLIENT: predis
      REDIS_HOST: redis
      CACHE_STORE: redis
      QUEUE_CONNECTION: redis
      # Log to the container output: the bind-mounted storage/ is owned by the host user,
      # not by www-data, so the containers could not write storage/logs.
      LOG_CHANNEL: stderr
    volumes:
      - ./:/var/www
      - ./docker/php/local.ini:/usr/local/etc/php/conf.d/local.ini
    depends_on:
      - db
      - redis
    networks:
      - {{projectName}}-network

  webserver:
    image: nginx:alpine
    container_name: {{projectName}}-nginx
    restart: unless-stopped
    ports:
      - "8000:80"
    volumes:
      - ./:/var/www
      - ./docker/nginx/conf.d/:/etc/nginx/conf.d/
    depends_on:
      - app
    networks:
      - {{projectName}}-network

  db:
    image: mysql:8.4
    container_name: {{projectName}}-db
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      MYSQL_DATABASE: {{projectName}}_db
      MYSQL_ROOT_PASSWORD: secret
      MYSQL_PASSWORD: secret
      MYSQL_USER: {{projectName}}
    volumes:
      - dbdata:/var/lib/mysql
    networks:
      - {{projectName}}-network

  redis:
    image: redis:alpine
    container_name: {{projectName}}-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - {{projectName}}-network

  queue:
    image: {{projectName}}
    container_name: {{projectName}}-queue
    restart: unless-stopped
    working_dir: /var/www
    command: php artisan queue:work --sleep=3 --tries=3
    environment: *app-env
    volumes:
      - ./:/var/www
    depends_on:
      - app
    networks:
      - {{projectName}}-network

  scheduler:
    image: {{projectName}}
    container_name: {{projectName}}-scheduler
    restart: unless-stopped
    working_dir: /var/www
    command: php artisan schedule:work
    environment: *app-env
    volumes:
      - ./:/var/www
    depends_on:
      - app
    networks:
      - {{projectName}}-network

networks:
  {{projectName}}-network:
    driver: bridge

volumes:
  dbdata:
    driver: local
`,

    'docker/nginx/conf.d/app.conf': `server {
    listen 80;
    index index.php;
    root /var/www/public;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}
`,

    'docker/php/local.ini': `upload_max_filesize=40M
post_max_size=40M
memory_limit=256M
`,

    'Dockerfile': `FROM php:8.3-fpm

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    git \\
    curl \\
    unzip \\
    libzip-dev \\
    libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

# PHP extensions (the app talks to MySQL or PostgreSQL; Redis goes through predis)
RUN docker-php-ext-install pdo_mysql pdo_pgsql bcmath pcntl zip

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY --chown=www-data:www-data . /var/www

# Install dependencies (the application key and JWT secret come from the environment at runtime)
RUN composer install --no-interaction --no-dev --optimize-autoloader \\
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000

CMD ["php-fpm"]
`,

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
        <env name="APP_KEY" value="base64:dGVzdC1rZXktZm9yLXBocHVuaXQtb25seS0zMmJ5dGU="/>
        <env name="APP_MAINTENANCE_DRIVER" value="file"/>
        <env name="BCRYPT_ROUNDS" value="4"/>
        <env name="BROADCAST_CONNECTION" value="null"/>
        <env name="CACHE_STORE" value="array"/>
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
        <env name="DB_URL" value=""/>
        <env name="JWT_SECRET" value="phpunit-only-jwt-secret-with-at-least-32-bytes"/>
        <env name="MAIL_MAILER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
        <env name="SESSION_DRIVER" value="array"/>
    </php>
</phpunit>
`,

    'public/index.php': `<?php

use Illuminate\\Http\\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
(require_once __DIR__.'/../bootstrap/app.php')
    ->handleRequest(Request::capture());
`,

    'README.md': `# {{projectName}} - Laravel API Service

JSON API built with Laravel 13: JWT authentication, role and permission based access control, Eloquent models and migrations, queued order processing, activity logging and a small GraphQL endpoint.

## Stack

- Laravel 13 on PHP 8.3+
- \`tymon/jwt-auth\` for stateless bearer-token authentication (guard \`api\`)
- \`spatie/laravel-permission\` for roles and permissions
- \`spatie/laravel-activitylog\` for audit trails (users and products)
- \`rebing/graphql-laravel\` for the GraphQL endpoint
- Redis (through \`predis\`) for cache and queues, MySQL or PostgreSQL for data
- PHPUnit tests that run against in-memory SQLite

## Quick start

\`.env.example\` expects MySQL on 127.0.0.1:3306 and Redis on 127.0.0.1:6379 (cache and
queue); start them first or point the \`DB_*\`, \`CACHE_STORE\` and \`QUEUE_CONNECTION\` settings
elsewhere (the Docker setup below runs all of it in containers).

\`\`\`bash
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret
php artisan migrate --seed
php artisan serve
\`\`\`

The API is served on http://localhost:8000 (\`/api/health\`, \`/up\`, \`/graphql\`).
\`php artisan route:list\` shows every route.

\`php artisan migrate --seed\` creates the roles, the permissions and three development
accounts (\`admin@example.com\`, \`manager@example.com\`, \`user@example.com\`, password
\`password\`) plus sample categories and products. Do not seed those accounts in production.

### Docker

The compose file mounts the project into the containers for development, so run
\`composer install\` on the host first (the commands below need it too). The containers log
to their output (\`docker compose logs -f app queue\`).

\`\`\`bash
export APP_KEY=$(php artisan key:generate --show)
export JWT_SECRET=$(php artisan jwt:secret --show)
docker compose up -d --build
docker compose exec app php artisan migrate --seed
\`\`\`

## API

All routes are under \`/api/v1\`. Authenticated routes expect \`Authorization: Bearer <access_token>\`;
a missing, invalid or expired token answers 401. Requests are rate limited to 60 per minute
(per user, or per IP without a token) and the login, register and password reset routes to 10
per minute per IP (429 when exceeded); the limits are defined in \`AppServiceProvider\`.

### Authentication
- \`POST /auth/register\` - register (assigns the \`user\` role)
- \`POST /auth/login\` - log in, returns an access token
- \`POST /auth/refresh\` - exchange the current (possibly expired) token for a new one
- \`POST /auth/forgot-password\`, \`POST /auth/reset-password\` - password reset (the mail links to \`APP_FRONTEND_URL\`)
- \`POST /auth/logout\`, \`GET /auth/me\`, \`POST /auth/change-password\` (authenticated)

### Products
- \`GET /products\`, \`GET /products/{id}\` - public; filters \`search\`, \`category_id\`, \`featured\`, \`in_stock\`, \`per_page\`
- \`POST /products\`, \`PUT /products/{id}\`, \`DELETE /products/{id}\` - need the \`manage-products\` permission

### Orders (authenticated)
- \`GET /orders\`, \`GET /orders/{id}\` - own orders (everyone's with \`manage-orders\`)
- \`POST /orders\` - body \`{"items": [{"product_id": 1, "quantity": 2}]}\`; the order is then processed by a
  queued job (payment and stock in one transaction; a retried job or an order cancelled before the
  worker reached it is skipped)
- \`POST /orders/{id}/cancel\` - cancel a pending or processing order (stock is restored)
- \`POST /orders/{id}/complete\` - needs the \`manage-orders\` permission

### Users (\`admin\` role)
- \`GET /users\`, \`GET /users/{id}\`, \`POST /users\`, \`PUT /users/{id}\`, \`DELETE /users/{id}\`
- \`POST /users/{id}/restore\`, \`DELETE /users/{id}/force\`

### GraphQL

\`POST /graphql\` with \`{"query": "{ hello(name: \\"World\\") health }"}\`. Add queries and types in
\`app/GraphQL\` and register them in \`config/graphql.php\`. Schema introspection is disabled unless
\`GRAPHQL_DISABLE_INTROSPECTION=false\` (set in \`.env.example\` for local development).

## Queues and scheduler

\`\`\`bash
php artisan queue:work
php artisan schedule:work
\`\`\`

\`App\\Services\\OrderService::processPayment()\` is a placeholder: connect your payment provider there.

## Testing

\`\`\`bash
php artisan test
\`\`\`

## Production

\`\`\`bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
\`\`\`

Set \`APP_KEY\`, \`JWT_SECRET\`, the database and Redis settings in the environment.

## License

MIT
`,

    'routes/api.php': `<?php

use App\\Http\\Controllers\\Api\\AuthController;
use App\\Http\\Controllers\\Api\\OrderController;
use App\\Http\\Controllers\\Api\\ProductController;
use App\\Http\\Controllers\\Api\\UserController;
use Illuminate\\Support\\Facades\\Route;

/*
|--------------------------------------------------------------------------
| API Routes (served under /api)
|--------------------------------------------------------------------------
| GraphQL is served separately at /graphql (see config/graphql.php).
| The "api" and "auth" rate limiters are defined in AppServiceProvider.
*/

Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now()->toIso8601String(),
        'service' => config('app.name'),
        'version' => '1.0.0',
    ]);
});

// Public routes
Route::prefix('v1')->middleware('throttle:api')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('/auth/register', [AuthController::class, 'register']);
        Route::post('/auth/login', [AuthController::class, 'login']);
        Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
    });

    // Takes the current (possibly expired) token from the Authorization header.
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);

    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{product}', [ProductController::class, 'show']);
});

// Authenticated routes (JWT bearer token)
Route::prefix('v1')->middleware(['auth:api', 'throttle:api'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // Users (admin only)
    Route::middleware('role:admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
        Route::post('/users/{user}/restore', [UserController::class, 'restore'])->withTrashed();
        Route::delete('/users/{user}/force', [UserController::class, 'forceDelete'])->withTrashed();
    });

    // Products (the manage-products permission can modify)
    Route::middleware('permission:manage-products')->group(function () {
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{product}', [ProductController::class, 'update']);
        Route::delete('/products/{product}', [ProductController::class, 'destroy']);
    });

    // Orders (customers see their own, the manage-orders permission sees all)
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel']);
    Route::post('/orders/{order}/complete', [OrderController::class, 'complete'])
        ->middleware('permission:manage-orders');
});
`,

    'routes/console.php': `<?php

use Illuminate\\Foundation\\Inspiring;
use Illuminate\\Support\\Facades\\Artisan;
use Illuminate\\Support\\Facades\\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Drop activity log rows older than activitylog.delete_records_older_than_days.
Schedule::command('activitylog:clean')->daily();
`,

    'storage/app/.gitignore': `*
!public/
!.gitignore
`,

    'storage/app/public/.gitignore': `*
!.gitignore
`,

    'storage/framework/.gitignore': `compiled.php
config.php
down
events.scanned.php
maintenance.php
routes.php
routes.scanned.php
schedule-*
services.json
`,

    'storage/framework/cache/.gitignore': `*
!data/
!.gitignore
`,

    'storage/framework/cache/data/.gitignore': `*
!.gitignore
`,

    'storage/framework/sessions/.gitignore': `*
!.gitignore
`,

    'storage/framework/views/.gitignore': `*
!.gitignore
`,

    'storage/logs/.gitignore': `*
!.gitignore
`,

    'tests/Feature/AuthTest.php': `<?php

namespace Tests\\Feature;

use App\\Models\\User;
use Illuminate\\Auth\\Notifications\\ResetPassword;
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Illuminate\\Support\\Facades\\Notification;
use Tests\\TestCase;
use Tymon\\JWTAuth\\Facades\\JWTAuth;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register(): void
    {
        $userData = [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ];

        $response = $this->postJson('/api/v1/auth/register', $userData);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user' => ['id', 'name', 'email', 'roles'],
                'access_token',
                'token_type',
                'expires_in',
            ]);

        $this->assertDatabaseHas('users', ['email' => $userData['email']]);
        $this->assertSame(['user'], User::whereEmail($userData['email'])->first()->getRoleNames()->all());
    }

    public function test_registration_validates_input(): void
    {
        $this->postJson('/api/v1/auth/register', ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_user_can_login(): void
    {
        $user = User::factory()->create(['password' => 'password123']);

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password123',
        ])->assertStatus(200)
            ->assertJsonStructure(['message', 'user', 'access_token', 'token_type', 'expires_in']);

        // Only last_login_at changed: nothing the activity log tracks, so no empty entry.
        $this->assertDatabaseMissing('activity_log', ['subject_id' => $user->id, 'event' => 'updated']);
    }

    public function test_user_cannot_login_with_invalid_credentials(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertStatus(401)
            ->assertJson(['error' => 'Invalid credentials']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = User::factory()->inactive()->create();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertStatus(401);
    }

    public function test_authenticated_user_can_get_profile(): void
    {
        $user = User::factory()->create();
        $token = JWTAuth::fromUser($user);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/v1/auth/me')
            ->assertStatus(200)
            ->assertJsonPath('user.email', $user->email);
    }

    public function test_profile_requires_a_token(): void
    {
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = JWTAuth::fromUser($user);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/v1/auth/logout')
            ->assertStatus(200)
            ->assertJson(['message' => 'Successfully logged out']);
    }

    public function test_token_can_be_refreshed(): void
    {
        $user = User::factory()->create();
        $token = JWTAuth::fromUser($user);

        $refreshed = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/v1/auth/refresh')
            ->assertStatus(200)
            ->assertJsonStructure(['access_token', 'token_type', 'expires_in'])
            ->json('access_token');

        $this->assertNotSame($token, $refreshed);
    }

    public function test_refresh_without_a_valid_token_is_unauthenticated(): void
    {
        $this->postJson('/api/v1/auth/refresh')->assertStatus(401);

        $this->withHeaders(['Authorization' => 'Bearer not.a.jwt'])
            ->postJson('/api/v1/auth/refresh')
            ->assertStatus(401);
    }

    public function test_login_attempts_are_rate_limited(): void
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
                ->assertStatus(401);
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
            ->assertStatus(429);
    }

    public function test_user_can_change_password(): void
    {
        $user = User::factory()->create();
        $token = JWTAuth::fromUser($user);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'password',
                'new_password' => 'new-password-1',
                'new_password_confirmation' => 'new-password-1',
            ])->assertStatus(200);

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'new-password-1'])
            ->assertStatus(200);
    }

    public function test_password_can_be_reset_with_an_emailed_token(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertStatus(200);

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use (&$token) {
            $token = $notification->token;

            return true;
        });

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'reset-password-1',
            'password_confirmation' => 'reset-password-1',
        ])->assertStatus(200);

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'reset-password-1'])
            ->assertStatus(200);
    }
}
`,

    'tests/Feature/HealthAndGraphQLTest.php': `<?php

namespace Tests\\Feature;

use Tests\\TestCase;

class HealthAndGraphQLTest extends TestCase
{
    public function test_health_endpoint_reports_healthy(): void
    {
        $this->getJson('/api/health')
            ->assertStatus(200)
            ->assertJsonPath('status', 'healthy');
    }

    public function test_graphql_hello_query(): void
    {
        $this->postJson('/graphql', ['query' => '{ hello(name: "Laravel") }'])
            ->assertStatus(200)
            ->assertJsonPath('data.hello', 'Hello, Laravel!');
    }

    public function test_graphql_health_query(): void
    {
        $this->postJson('/graphql', ['query' => '{ health }'])
            ->assertStatus(200)
            ->assertJsonPath('data.health', true);
    }

    public function test_graphql_only_accepts_post(): void
    {
        $this->getJson('/graphql?query='.urlencode('{ health }'))->assertStatus(405);
    }
}
`,

    'tests/Feature/OrderTest.php': `<?php

namespace Tests\\Feature;

use App\\Jobs\\ProcessOrderJob;
use App\\Models\\Order;
use App\\Models\\Product;
use App\\Models\\User;
use App\\Services\\OrderService;
use Database\\Seeders\\RolePermissionSeeder;
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;

class OrderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    protected function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_an_order_is_created_and_processed(): void
    {
        $user = $this->userWithRole('user');
        $product = Product::factory()->create(['price' => 10, 'quantity' => 5]);

        $response = $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ], $this->bearer($user))->assertStatus(201)
            ->assertJsonPath('total', '20.00');

        // The queue runs synchronously in tests, so the job has already run.
        $response->assertJsonPath('status', Order::STATUS_PROCESSING);
        $this->assertSame(3, $product->refresh()->quantity);
    }

    public function test_an_order_cannot_exceed_the_stock(): void
    {
        $user = $this->userWithRole('user');
        $product = Product::factory()->create(['quantity' => 1]);

        $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ], $this->bearer($user))->assertStatus(422);

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_customers_only_see_their_own_orders(): void
    {
        $owner = $this->userWithRole('user');
        $other = $this->userWithRole('user');
        $product = Product::factory()->create(['quantity' => 10]);

        $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ], $this->bearer($owner))->assertStatus(201);

        $this->getJson('/api/v1/orders', $this->bearer($owner))->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/orders', $this->bearer($other))->assertJsonCount(0, 'data');

        $orderId = Order::first()->id;
        $this->getJson('/api/v1/orders/'.$orderId, $this->bearer($other))->assertStatus(403);
    }

    public function test_cancelling_an_order_restores_the_stock(): void
    {
        $user = $this->userWithRole('user');
        $product = Product::factory()->create(['quantity' => 5]);

        $orderId = $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ], $this->bearer($user))->json('id');

        $this->postJson("/api/v1/orders/{$orderId}/cancel", [], $this->bearer($user))
            ->assertStatus(200)
            ->assertJsonPath('status', Order::STATUS_CANCELLED);

        $this->assertSame(5, $product->refresh()->quantity);
    }

    public function test_only_managers_can_complete_orders(): void
    {
        $user = $this->userWithRole('user');
        $manager = $this->userWithRole('manager');
        $product = Product::factory()->create(['quantity' => 5]);

        $orderId = $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ], $this->bearer($user))->json('id');

        $this->postJson("/api/v1/orders/{$orderId}/complete", [], $this->bearer($user))->assertStatus(403);

        $this->postJson("/api/v1/orders/{$orderId}/complete", [], $this->bearer($manager))
            ->assertStatus(200)
            ->assertJsonPath('status', Order::STATUS_COMPLETED);
    }

    public function test_a_retried_job_does_not_take_the_stock_twice(): void
    {
        $user = $this->userWithRole('user');
        $product = Product::factory()->create(['quantity' => 5]);

        $orderId = $this->postJson('/api/v1/orders', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ], $this->bearer($user))->json('id');

        // A second delivery of the same job (retry, duplicate) finds the order processed.
        ProcessOrderJob::dispatchSync(Order::findOrFail($orderId));

        $this->assertSame(3, $product->refresh()->quantity);
    }

    public function test_an_order_cancelled_before_processing_is_not_processed(): void
    {
        $user = $this->userWithRole('user');
        $product = Product::factory()->create(['quantity' => 5]);

        $orders = app(OrderService::class);
        $order = $orders->create($user, [['product_id' => $product->id, 'quantity' => 2]]);
        $orders->cancel($order);

        // The worker picks the job up after the cancellation.
        ProcessOrderJob::dispatchSync($order);

        $this->assertSame(Order::STATUS_CANCELLED, $order->refresh()->status);
        $this->assertNull($order->processed_at);
        $this->assertSame(5, $product->refresh()->quantity);
    }
}
`,

    'tests/Feature/ProductTest.php': `<?php

namespace Tests\\Feature;

use App\\Models\\Category;
use App\\Models\\Product;
use App\\Models\\User;
use Database\\Seeders\\RolePermissionSeeder;
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    protected function actingAsRole(string $role): array
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $this->bearer($user);
    }

    public function test_products_are_public_and_paginated(): void
    {
        Product::factory()->count(3)->create();
        Product::factory()->create(['is_active' => false]);

        $this->getJson('/api/v1/products')
            ->assertStatus(200)
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('total', 3);
    }

    public function test_product_can_be_shown(): void
    {
        $product = Product::factory()->create();

        $this->getJson('/api/v1/products/'.$product->id)
            ->assertStatus(200)
            ->assertJsonPath('sku', $product->sku);
    }

    public function test_customers_cannot_create_products(): void
    {
        $this->postJson('/api/v1/products', ['name' => 'Widget'], $this->actingAsRole('user'))
            ->assertStatus(403);
    }

    public function test_anonymous_requests_cannot_create_products(): void
    {
        $this->postJson('/api/v1/products', ['name' => 'Widget'])->assertStatus(401);
    }

    public function test_managers_can_create_update_and_delete_products(): void
    {
        $headers = $this->actingAsRole('manager');
        $category = Category::factory()->create();

        $created = $this->postJson('/api/v1/products', [
            'name' => 'Blue Widget',
            'price' => 19.99,
            'sku' => 'WID-001',
            'quantity' => 10,
            'category_id' => $category->id,
        ], $headers)->assertStatus(201)
            ->assertJsonPath('slug', 'blue-widget');

        $id = $created->json('id');

        $this->putJson('/api/v1/products/'.$id, ['price' => 24.5], $headers)
            ->assertStatus(200)
            ->assertJsonPath('price', '24.50');

        $this->deleteJson('/api/v1/products/'.$id, [], $headers)->assertStatus(200);
        $this->getJson('/api/v1/products/'.$id)->assertStatus(404);
    }

    public function test_admins_can_manage_users(): void
    {
        $headers = $this->actingAsRole('admin');
        $target = User::factory()->create();

        $this->getJson('/api/v1/users', $headers)->assertStatus(200)->assertJsonStructure(['data']);

        $this->deleteJson('/api/v1/users/'.$target->id, [], $headers)->assertStatus(200);
        $this->assertSoftDeleted('users', ['id' => $target->id]);

        $this->postJson('/api/v1/users/'.$target->id.'/restore', [], $headers)->assertStatus(200);
        $this->assertNotSoftDeleted('users', ['id' => $target->id]);
    }

    public function test_customers_cannot_list_users(): void
    {
        $this->getJson('/api/v1/users', $this->actingAsRole('user'))->assertStatus(403);
    }
}
`,

    'tests/Feature/SeederTest.php': `<?php

namespace Tests\\Feature;

use App\\Models\\Category;
use App\\Models\\Product;
use App\\Models\\User;
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_creates_roles_accounts_and_catalog(): void
    {
        $this->seed();

        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertNotNull($admin->email_verified_at);
        $this->assertTrue(User::where('email', 'manager@example.com')->firstOrFail()->can('manage-orders'));
        $this->assertFalse(User::where('email', 'user@example.com')->firstOrFail()->can('manage-products'));

        $this->assertSame(4, Category::count());
        $this->assertSame(24, Product::count());

        // Seeding again changes nothing.
        $this->seed();
        $this->assertSame(3, User::count());
        $this->assertSame(24, Product::count());
    }
}
`,

    'tests/TestCase.php': `<?php

namespace Tests;

use App\\Models\\User;
use Illuminate\\Foundation\\Testing\\TestCase as BaseTestCase;
use Tymon\\JWTAuth\\Facades\\JWTAuth;
use Tymon\\JWTAuth\\JWT;

abstract class TestCase extends BaseTestCase
{
    /**
     * Authorization header for the given user.
     *
     * The application instance (and with it the cached JWT guard and parsed token)
     * lives for the whole test, so both are reset to let one test call the API as
     * several users.
     *
     * @return array<string, string>
     */
    protected function bearer(User $user): array
    {
        $this->app['auth']->forgetGuards();
        $this->app->make(JWT::class)->unsetToken();

        return ['Authorization' => 'Bearer '.JWTAuth::fromUser($user)];
    }
}
`,

    'tests/Unit/ProductPricingTest.php': `<?php

namespace Tests\\Unit;

use App\\Models\\Product;
use PHPUnit\\Framework\\TestCase;

class ProductPricingTest extends TestCase
{
    public function test_sale_price_is_used_when_present(): void
    {
        $product = new Product(['price' => '100.00', 'sale_price' => '80.00']);

        $this->assertTrue($product->is_on_sale);
        $this->assertSame('80.00', (string) $product->current_price);
        $this->assertSame(20.0, $product->discount_percentage);
    }

    public function test_regular_price_is_used_without_a_sale(): void
    {
        $product = new Product(['price' => '100.00']);

        $this->assertFalse($product->is_on_sale);
        $this->assertSame('100.00', (string) $product->current_price);
        $this->assertNull($product->discount_percentage);
    }
}
`,
  }
};
