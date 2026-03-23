import { BackendTemplate } from '../types';

export const symfonyTemplate: BackendTemplate = {
  id: 'symfony',
  name: 'symfony',
  displayName: 'Symfony Framework',
  description: 'Enterprise PHP framework with bundles, services, forms, and Doctrine ORM',
  language: 'php',
  framework: 'symfony',
  version: '6.4',
  tags: ['php', 'symfony', 'doctrine', 'bundles', 'enterprise', 'api'],
  port: 8000,
  dependencies: {},
  features: ['authentication', 'database', 'validation', 'logging', 'testing', 'security'],
  
  files: {
    // Composer configuration
    'composer.json': `{
  "type": "project",
  "license": "proprietary",
  "minimum-stability": "stable",
  "prefer-stable": true,
  "require": {
    "php": ">=8.1",
    "ext-ctype": "*",
    "ext-iconv": "*",
    "doctrine/doctrine-bundle": "^2.11",
    "doctrine/doctrine-migrations-bundle": "^3.3",
    "doctrine/orm": "^2.17",
    "lexik/jwt-authentication-bundle": "^2.19",
    "nelmio/cors-bundle": "^2.4",
    "nelmio/api-doc-bundle": "^4.19",
    "phpdocumentor/reflection-docblock": "^5.3",
    "phpstan/phpdoc-parser": "^1.24",
    "sensio/framework-extra-bundle": "^6.2",
    "symfony/asset": "6.4.*",
    "symfony/console": "6.4.*",
    "symfony/doctrine-messenger": "6.4.*",
    "symfony/dotenv": "6.4.*",
    "symfony/expression-language": "6.4.*",
    "symfony/flex": "^2",
    "symfony/form": "6.4.*",
    "symfony/framework-bundle": "6.4.*",
    "symfony/http-client": "6.4.*",
    "symfony/intl": "6.4.*",
    "symfony/mailer": "6.4.*",
    "symfony/mime": "6.4.*",
    "symfony/monolog-bundle": "^3.10",
    "symfony/notifier": "6.4.*",
    "symfony/process": "6.4.*",
    "symfony/property-access": "6.4.*",
    "symfony/property-info": "6.4.*",
    "symfony/rate-limiter": "6.4.*",
    "symfony/runtime": "6.4.*",
    "symfony/security-bundle": "6.4.*",
    "symfony/serializer": "6.4.*",
    "symfony/string": "6.4.*",
    "symfony/translation": "6.4.*",
    "symfony/twig-bundle": "6.4.*",
    "symfony/uid": "6.4.*",
    "symfony/validator": "6.4.*",
    "symfony/web-link": "6.4.*",
    "symfony/yaml": "6.4.*",
    "twig/extra-bundle": "^2.12|^3.0",
    "twig/twig": "^2.12|^3.0"
  },
  "require-dev": {
    "doctrine/doctrine-fixtures-bundle": "^3.5",
    "phpunit/phpunit": "^9.5",
    "symfony/browser-kit": "6.4.*",
    "symfony/css-selector": "6.4.*",
    "symfony/debug-bundle": "6.4.*",
    "symfony/maker-bundle": "^1.52",
    "symfony/phpunit-bridge": "^7.0",
    "symfony/stopwatch": "6.4.*",
    "symfony/web-profiler-bundle": "6.4.*"
  },
  "config": {
    "allow-plugins": {
      "php-http/discovery": true,
      "symfony/flex": true,
      "symfony/runtime": true
    },
    "sort-packages": true
  },
  "autoload": {
    "psr-4": {
      "App\\\\": "src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "App\\\\Tests\\\\": "tests/"
    }
  },
  "replace": {
    "symfony/polyfill-ctype": "*",
    "symfony/polyfill-iconv": "*",
    "symfony/polyfill-php72": "*",
    "symfony/polyfill-php73": "*",
    "symfony/polyfill-php74": "*",
    "symfony/polyfill-php80": "*",
    "symfony/polyfill-php81": "*"
  },
  "scripts": {
    "auto-scripts": {
      "cache:clear": "symfony-cmd",
      "assets:install %PUBLIC_DIR%": "symfony-cmd"
    },
    "post-install-cmd": [
      "@auto-scripts"
    ],
    "post-update-cmd": [
      "@auto-scripts"
    ]
  },
  "conflict": {
    "symfony/symfony": "*"
  },
  "extra": {
    "symfony": {
      "allow-contrib": false,
      "require": "6.4.*"
    }
  }
}`,

    // Environment configuration
    '.env': `# In all environments, the following files are loaded if they exist,
# the latter taking precedence over the former:
#
#  * .env                contains default values for the environment variables needed by the app
#  * .env.local          uncommitted file with local overrides
#  * .env.$APP_ENV       committed environment-specific defaults
#  * .env.$APP_ENV.local uncommitted environment-specific overrides
#
# Real environment variables win over .env files.
#
# DO NOT DEFINE PRODUCTION SECRETS IN THIS FILE NOR IN ANY OTHER COMMITTED FILES.
# https://symfony.com/doc/current/configuration/secrets.html
#
# Run "composer dump-env prod" to compile .env files for production use (requires symfony/flex >=1.2).
# https://symfony.com/doc/current/best_practices.html#use-environment-variables-for-infrastructure-configuration

###> symfony/framework-bundle ###
APP_ENV=dev
APP_SECRET=change_me
###< symfony/framework-bundle ###

###> doctrine/doctrine-bundle ###
# Format described at https://www.doctrine-project.org/projects/doctrine-dbal/en/latest/reference/configuration.html#connecting-using-a-url
# IMPORTANT: You MUST configure your server version, either here or in config/packages/doctrine.yaml
#
# DATABASE_URL="sqlite:///%kernel.project_dir%/var/data.db"
# DATABASE_URL="mysql://app:!ChangeMe!@127.0.0.1:3306/app?serverVersion=8.0.32&charset=utf8mb4"
# DATABASE_URL="mysql://app:!ChangeMe!@127.0.0.1:3306/app?serverVersion=10.11.2-MariaDB&charset=utf8mb4"
DATABASE_URL="postgresql://app:!ChangeMe!@127.0.0.1:5432/app?serverVersion=15&charset=utf8"
###< doctrine/doctrine-bundle ###

###> symfony/messenger ###
# Choose one of the transports below
# MESSENGER_TRANSPORT_DSN=amqp://guest:guest@localhost:5672/%2f/messages
# MESSENGER_TRANSPORT_DSN=redis://localhost:6379/messages
MESSENGER_TRANSPORT_DSN=doctrine://default?auto_setup=0
###< symfony/messenger ###

###> symfony/mailer ###
# MAILER_DSN=null://null
###< symfony/mailer ###

###> lexik/jwt-authentication-bundle ###
JWT_SECRET_KEY=%kernel.project_dir%/config/jwt/private.pem
JWT_PUBLIC_KEY=%kernel.project_dir%/config/jwt/public.pem
JWT_PASSPHRASE=change_me
JWT_TTL=3600
###< lexik/jwt-authentication-bundle ###

###> nelmio/cors-bundle ###
CORS_ALLOW_ORIGIN='^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$'
###< nelmio/cors-bundle ###`,

    // Symfony configuration
    'config/packages/framework.yaml': `framework:
  secret: '%env(APP_SECRET)%'
  #csrf_protection: true
  http_method_override: false
  handle_all_throwables: true

  # Enables session support. Note that the session will ONLY be started if you read or write from it.
  # Remove or comment this section to explicitly disable session support.
  session:
    handler_id: null
    cookie_secure: auto
    cookie_samesite: lax
    storage_factory_id: session.storage.factory.native

  #esi: true
  #fragments: true
  php_errors:
    log: true

  rate_limiter:
    # Define rate limiters
    anonymous_api:
      policy: 'sliding_window'
      limit: 100
      interval: '60 minutes'
    authenticated_api:
      policy: 'sliding_window'
      limit: 1000
      interval: '60 minutes'

when@test:
  framework:
    test: true
    session:
      storage_factory_id: session.storage.factory.mock_file`,

    // Security configuration
    'config/packages/security.yaml': `security:
  enable_authenticator_manager: true
  # https://symfony.com/doc/current/security.html#registering-the-user-hashing-passwords
  password_hashers:
    Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface: 'auto'
  # https://symfony.com/doc/current/security.html#loading-the-user-the-user-provider
  providers:
    # used to reload user from session & other features (e.g. switch_user)
    app_user_provider:
      entity:
        class: App\\Entity\\User
        property: email
  firewalls:
    login:
      pattern: ^/api/login
      stateless: true
      json_login:
        check_path: /api/login_check
        success_handler: lexik_jwt_authentication.handler.authentication_success
        failure_handler: lexik_jwt_authentication.handler.authentication_failure

    api:
      pattern:   ^/api
      stateless: true
      jwt: ~

    dev:
      pattern: ^/(_(profiler|wdt)|css|images|js)/
      security: false

  # Easy way to control access for large sections of your site
  # Note: Only the *first* access control that matches will be used
  access_control:
    - { path: ^/api/health, roles: PUBLIC_ACCESS }
    - { path: ^/api/login, roles: PUBLIC_ACCESS }
    - { path: ^/api/register, roles: PUBLIC_ACCESS }
    - { path: ^/api/docs, roles: PUBLIC_ACCESS }
    - { path: ^/api, roles: IS_AUTHENTICATED_FULLY }

when@test:
  security:
    password_hashers:
      # By default, password hashers are resource intensive and take time. This is
      # important to generate secure password hashes. In tests however, secure hashes
      # are not important, waste resources and increase test times. The following
      # reduces the work factor to the lowest possible values.
      Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface:
        algorithm: auto
        cost: 4 # Lowest possible value for bcrypt
        time_cost: 3 # Lowest possible value for argon
        memory_cost: 10 # Lowest possible value for argon`,

    // Doctrine configuration
    'config/packages/doctrine.yaml': `doctrine:
  dbal:
    url: '%env(resolve:DATABASE_URL)%'

    # IMPORTANT: You MUST configure your server version,
    # either here or in the DATABASE_URL env var (see .env file)
    #server_version: '15'

    profiling_collect_backtrace: '%kernel.debug%'
  orm:
    auto_generate_proxy_classes: true
    enable_lazy_ghost_objects: true
    report_fields_where_declared: true
    validate_xml_mapping: true
    naming_strategy: doctrine.orm.naming_strategy.underscore_number_aware
    auto_mapping: true
    mappings:
      App:
        type: attribute
        is_bundle: false
        dir: '%kernel.project_dir%/src/Entity'
        prefix: 'App\\Entity'
        alias: App

when@test:
  doctrine:
    dbal:
      # "TEST_TOKEN" is typically set by ParaTest
      dbname_suffix: '_test%env(default::TEST_TOKEN)%'

when@prod:
  doctrine:
    orm:
      auto_generate_proxy_classes: false
      proxy_dir: '%kernel.build_dir%/doctrine/orm/Proxies'
      query_cache_driver:
        type: pool
        pool: doctrine.system_cache_pool
      result_cache_driver:
        type: pool
        pool: doctrine.result_cache_pool

  framework:
    cache:
      pools:
        doctrine.result_cache_pool:
          adapter: cache.app
        doctrine.system_cache_pool:
          adapter: cache.system`,

    // Routing configuration
    'config/routes.yaml': `controllers:
  resource:
    path: ../src/Controller/
    namespace: App\\Controller
  type: attribute

api_login_check:
  path: /api/login_check`,

    // API Controller
    'src/Controller/ApiController.php': `<?php

namespace App\\Controller;

use Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;
use Symfony\\Component\\HttpFoundation\\JsonResponse;
use Symfony\\Component\\Routing\\Annotation\\Route;

#[Route('/api', name: 'api_')]
abstract class ApiController extends AbstractController
{
    /**
     * Returns a JSON response
     */
    protected function respondWithSuccess($data = null, string $message = 'Success', int $status = 200): JsonResponse
    {
        return $this->json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], $status);
    }

    /**
     * Returns a JSON error response
     */
    protected function respondWithError(string $message = 'Error', int $status = 400, array $errors = []): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
        }

        return $this->json($response, $status);
    }

    /**
     * Returns validation errors
     */
    protected function respondWithValidationErrors(array $errors): JsonResponse
    {
        return $this->respondWithError('Validation failed', 422, $errors);
    }
}`,

    // User Controller
    'src/Controller/UserController.php': `<?php

namespace App\\Controller;

use App\\Entity\\User;
use App\\Form\\UserType;
use App\\Repository\\UserRepository;
use Doctrine\\ORM\\EntityManagerInterface;
use Symfony\\Component\\HttpFoundation\\Request;
use Symfony\\Component\\HttpFoundation\\Response;
use Symfony\\Component\\Routing\\Annotation\\Route;
use Symfony\\Component\\Security\\Http\\Attribute\\IsGranted;
use Symfony\\Component\\PasswordHasher\\Hasher\\UserPasswordHasherInterface;
use Symfony\\Component\\Serializer\\SerializerInterface;
use Symfony\\Component\\Validator\\Validator\\ValidatorInterface;
use OpenApi\\Attributes as OA;
use Nelmio\\ApiDocBundle\\Annotation\\Model;
use Nelmio\\ApiDocBundle\\Annotation\\Security;

#[Route('/api/users')]
#[OA\\Tag(name: 'Users')]
class UserController extends ApiController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private UserRepository $userRepository,
        private SerializerInterface $serializer,
        private ValidatorInterface $validator,
        private UserPasswordHasherInterface $passwordHasher
    ) {
    }

    #[Route('', name: 'user_index', methods: ['GET'])]
    #[IsGranted('ROLE_ADMIN')]
    #[OA\\Get(
        summary: 'Get all users',
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number',
                schema: new OA\\Schema(type: 'integer', default: 1)
            ),
            new OA\\Parameter(
                name: 'limit',
                in: 'query',
                description: 'Items per page',
                schema: new OA\\Schema(type: 'integer', default: 10)
            )
        ],
        responses: [
            new OA\\Response(
                response: 200,
                description: 'List of users',
                content: new OA\\JsonContent(
                    type: 'array',
                    items: new OA\\Items(ref: new Model(type: User::class, groups: ['user:read']))
                )
            )
        ]
    )]
    public function index(Request $request): Response
    {
        $page = $request->query->getInt('page', 1);
        $limit = $request->query->getInt('limit', 10);

        $users = $this->userRepository->findPaginated($page, $limit);
        
        return $this->respondWithSuccess($users);
    }

    #[Route('/{id}', name: 'user_show', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[OA\\Get(
        summary: 'Get user by ID',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\\Response(
                response: 200,
                description: 'User details',
                content: new OA\\JsonContent(ref: new Model(type: User::class, groups: ['user:read']))
            ),
            new OA\\Response(response: 404, description: 'User not found')
        ]
    )]
    public function show(User $user): Response
    {
        // Check if user can view this profile
        if ($this->getUser() !== $user && !$this->isGranted('ROLE_ADMIN')) {
            return $this->respondWithError('Access denied', 403);
        }

        return $this->respondWithSuccess($user);
    }

    #[Route('', name: 'user_create', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    #[OA\\Post(
        summary: 'Create new user',
        security: [['bearerAuth' => []]],
        requestBody: new OA\\RequestBody(
            required: true,
            content: new OA\\JsonContent(ref: new Model(type: User::class, groups: ['user:write']))
        ),
        responses: [
            new OA\\Response(
                response: 201,
                description: 'User created',
                content: new OA\\JsonContent(ref: new Model(type: User::class, groups: ['user:read']))
            ),
            new OA\\Response(response: 422, description: 'Validation error')
        ]
    )]
    public function create(Request $request): Response
    {
        $data = json_decode($request->getContent(), true);
        
        $user = new User();
        $form = $this->createForm(UserType::class, $user);
        $form->submit($data);

        if (!$form->isValid()) {
            $errors = [];
            foreach ($form->getErrors(true) as $error) {
                $errors[$error->getOrigin()->getName()] = $error->getMessage();
            }
            return $this->respondWithValidationErrors($errors);
        }

        // Hash password
        if (isset($data['password'])) {
            $hashedPassword = $this->passwordHasher->hashPassword($user, $data['password']);
            $user->setPassword($hashedPassword);
        }

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $this->respondWithSuccess($user, 'User created successfully', 201);
    }

    #[Route('/{id}', name: 'user_update', methods: ['PUT', 'PATCH'])]
    #[IsGranted('ROLE_USER')]
    #[OA\\Put(
        summary: 'Update user',
        security: [['bearerAuth' => []]],
        requestBody: new OA\\RequestBody(
            required: true,
            content: new OA\\JsonContent(ref: new Model(type: User::class, groups: ['user:write']))
        ),
        responses: [
            new OA\\Response(
                response: 200,
                description: 'User updated',
                content: new OA\\JsonContent(ref: new Model(type: User::class, groups: ['user:read']))
            ),
            new OA\\Response(response: 403, description: 'Access denied'),
            new OA\\Response(response: 404, description: 'User not found')
        ]
    )]
    public function update(Request $request, User $user): Response
    {
        // Check if user can update this profile
        if ($this->getUser() !== $user && !$this->isGranted('ROLE_ADMIN')) {
            return $this->respondWithError('Access denied', 403);
        }

        $data = json_decode($request->getContent(), true);
        
        $form = $this->createForm(UserType::class, $user);
        $form->submit($data, $request->getMethod() !== 'PATCH');

        if (!$form->isValid()) {
            $errors = [];
            foreach ($form->getErrors(true) as $error) {
                $errors[$error->getOrigin()->getName()] = $error->getMessage();
            }
            return $this->respondWithValidationErrors($errors);
        }

        // Hash password if provided
        if (isset($data['password'])) {
            $hashedPassword = $this->passwordHasher->hashPassword($user, $data['password']);
            $user->setPassword($hashedPassword);
        }

        $this->entityManager->flush();

        return $this->respondWithSuccess($user, 'User updated successfully');
    }

    #[Route('/{id}', name: 'user_delete', methods: ['DELETE'])]
    #[IsGranted('ROLE_ADMIN')]
    #[OA\\Delete(
        summary: 'Delete user',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\\Response(response: 204, description: 'User deleted'),
            new OA\\Response(response: 404, description: 'User not found')
        ]
    )]
    public function delete(User $user): Response
    {
        $this->entityManager->remove($user);
        $this->entityManager->flush();

        return $this->respondWithSuccess(null, 'User deleted successfully', 204);
    }
}`,

    // User Entity
    'src/Entity/User.php': `<?php

namespace App\\Entity;

use App\\Repository\\UserRepository;
use Doctrine\\Common\\Collections\\ArrayCollection;
use Doctrine\\Common\\Collections\\Collection;
use Doctrine\\DBAL\\Types\\Types;
use Doctrine\\ORM\\Mapping as ORM;
use Symfony\\Bridge\\Doctrine\\Validator\\Constraints\\UniqueEntity;
use Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface;
use Symfony\\Component\\Security\\Core\\User\\UserInterface;
use Symfony\\Component\\Serializer\\Annotation\\Groups;
use Symfony\\Component\\Validator\\Constraints as Assert;

#[ORM\\Entity(repositoryClass: UserRepository::class)]
#[ORM\\Table(name: '\`user\`')]
#[ORM\\HasLifecycleCallbacks]
#[UniqueEntity(fields: ['email'], message: 'There is already an account with this email')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\\Id]
    #[ORM\\GeneratedValue]
    #[ORM\\Column]
    #[Groups(['user:read'])]
    private ?int $id = null;

    #[ORM\\Column(length: 180, unique: true)]
    #[Assert\\NotBlank]
    #[Assert\\Email]
    #[Groups(['user:read', 'user:write'])]
    private ?string $email = null;

    #[ORM\\Column]
    #[Groups(['user:read'])]
    private array $roles = [];

    /**
     * @var string The hashed password
     */
    #[ORM\\Column]
    private ?string $password = null;

    #[ORM\\Column(length: 255)]
    #[Assert\\NotBlank]
    #[Assert\\Length(min: 2, max: 255)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $firstName = null;

    #[ORM\\Column(length: 255)]
    #[Assert\\NotBlank]
    #[Assert\\Length(min: 2, max: 255)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $lastName = null;

    #[ORM\\Column(length: 255, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $phone = null;

    #[ORM\\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $address = null;

    #[ORM\\Column]
    #[Groups(['user:read'])]
    private ?\\DateTimeImmutable $createdAt = null;

    #[ORM\\Column]
    #[Groups(['user:read'])]
    private ?\\DateTimeImmutable $updatedAt = null;

    #[ORM\\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    #[Groups(['user:read'])]
    private ?\\DateTimeInterface $lastLoginAt = null;

    #[ORM\\Column]
    #[Groups(['user:read', 'user:write'])]
    private bool $isActive = true;

    #[ORM\\OneToMany(mappedBy: 'user', targetEntity: Product::class)]
    private Collection $products;

    public function __construct()
    {
        $this->products = new ArrayCollection();
        $this->roles = ['ROLE_USER'];
    }

    #[ORM\\PrePersist]
    public function setCreatedAtValue(): void
    {
        $this->createdAt = new \\DateTimeImmutable();
        $this->updatedAt = new \\DateTimeImmutable();
    }

    #[ORM\\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \\DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;
        return $this;
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    /**
     * @see UserInterface
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    public function setRoles(array $roles): static
    {
        $this->roles = $roles;
        return $this;
    }

    /**
     * @see PasswordAuthenticatedUserInterface
     */
    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;
        return $this;
    }

    /**
     * @see UserInterface
     */
    public function eraseCredentials(): void
    {
        // If you store any temporary, sensitive data on the user, clear it here
        // $this->plainPassword = null;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function setFirstName(string $firstName): static
    {
        $this->firstName = $firstName;
        return $this;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function setLastName(string $lastName): static
    {
        $this->lastName = $lastName;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getFullName(): string
    {
        return $this->firstName . ' ' . $this->lastName;
    }

    // Additional getters and setters...
}`,

    // User Form Type
    'src/Form/UserType.php': `<?php

namespace App\\Form;

use App\\Entity\\User;
use Symfony\\Component\\Form\\AbstractType;
use Symfony\\Component\\Form\\Extension\\Core\\Type\\EmailType;
use Symfony\\Component\\Form\\Extension\\Core\\Type\\PasswordType;
use Symfony\\Component\\Form\\Extension\\Core\\Type\\TextType;
use Symfony\\Component\\Form\\Extension\\Core\\Type\\CheckboxType;
use Symfony\\Component\\Form\\FormBuilderInterface;
use Symfony\\Component\\OptionsResolver\\OptionsResolver;
use Symfony\\Component\\Validator\\Constraints\\Length;
use Symfony\\Component\\Validator\\Constraints\\NotBlank;

class UserType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('email', EmailType::class, [
                'constraints' => [
                    new NotBlank(['message' => 'Please enter an email'])]])
            ->add('firstName', TextType::class, [
                'constraints' => [
                    new NotBlank(['message' => 'Please enter a first name']),
                    new Length([
                        'min' => 2,
                        'minMessage' => 'First name should be at least {{ limit }} characters',
                        'max' => 255])]])
            ->add('lastName', TextType::class, [
                'constraints' => [
                    new NotBlank(['message' => 'Please enter a last name']),
                    new Length([
                        'min' => 2,
                        'minMessage' => 'Last name should be at least {{ limit }} characters',
                        'max' => 255])]])
            ->add('phone', TextType::class, [
                'required' => false])
            ->add('address', TextType::class, [
                'required' => false])
            ->add('isActive', CheckboxType::class, [
                'required' => false]);

        // Only add password field for new users
        if (!$options['is_edit']) {
            $builder->add('plainPassword', PasswordType::class, [
                'mapped' => false,
                'constraints' => [
                    new NotBlank(['message' => 'Please enter a password']),
                    new Length([
                        'min' => 6,
                        'minMessage' => 'Your password should be at least {{ limit }} characters',
                        'max' => 4096])]]);
        }
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
            'is_edit' => false,
            'csrf_protection' => false, // Disable for API
        ]);
    }
}`,

    // Authentication Controller
    'src/Controller/AuthController.php': `<?php

namespace App\\Controller;

use App\\Entity\\User;
use App\\Repository\\UserRepository;
use Doctrine\\ORM\\EntityManagerInterface;
use Symfony\\Component\\HttpFoundation\\Request;
use Symfony\\Component\\HttpFoundation\\Response;
use Symfony\\Component\\Routing\\Annotation\\Route;
use Symfony\\Component\\PasswordHasher\\Hasher\\UserPasswordHasherInterface;
use Symfony\\Component\\Validator\\Validator\\ValidatorInterface;
use Lexik\\Bundle\\JWTAuthenticationBundle\\Services\\JWTTokenManagerInterface;
use OpenApi\\Attributes as OA;
use Nelmio\\ApiDocBundle\\Annotation\\Model;

#[Route('/api')]
#[OA\\Tag(name: 'Authentication')]
class AuthController extends ApiController
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private UserRepository $userRepository,
        private UserPasswordHasherInterface $passwordHasher,
        private ValidatorInterface $validator,
        private JWTTokenManagerInterface $jwtManager
    ) {
    }

    #[Route('/register', name: 'api_register', methods: ['POST'])]
    #[OA\\Post(
        summary: 'Register new user',
        requestBody: new OA\\RequestBody(
            required: true,
            content: new OA\\JsonContent(
                required: ['email', 'password', 'firstName', 'lastName'],
                properties: [
                    new OA\\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\\Property(property: 'password', type: 'string', minLength: 6),
                    new OA\\Property(property: 'firstName', type: 'string'),
                    new OA\\Property(property: 'lastName', type: 'string')]
            )
        ),
        responses: [
            new OA\\Response(
                response: 201,
                description: 'User registered successfully',
                content: new OA\\JsonContent(
                    properties: [
                        new OA\\Property(property: 'user', ref: new Model(type: User::class, groups: ['user:read'])),
                        new OA\\Property(property: 'token', type: 'string')]
                )
            ),
            new OA\\Response(response: 400, description: 'Invalid input'),
            new OA\\Response(response: 409, description: 'Email already exists')
        ]
    )]
    public function register(Request $request): Response
    {
        $data = json_decode($request->getContent(), true);

        // Check if email already exists
        $existingUser = $this->userRepository->findOneBy(['email' => $data['email'] ?? '']);
        if ($existingUser) {
            return $this->respondWithError('Email already registered', 409);
        }

        $user = new User();
        $user->setEmail($data['email'] ?? '');
        $user->setFirstName($data['firstName'] ?? '');
        $user->setLastName($data['lastName'] ?? '');

        // Hash password
        $hashedPassword = $this->passwordHasher->hashPassword($user, $data['password'] ?? '');
        $user->setPassword($hashedPassword);

        // Validate user
        $errors = $this->validator->validate($user);
        if (count($errors) > 0) {
            $errorMessages = [];
            foreach ($errors as $error) {
                $errorMessages[$error->getPropertyPath()] = $error->getMessage();
            }
            return $this->respondWithValidationErrors($errorMessages);
        }

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        // Generate JWT token
        $token = $this->jwtManager->create($user);

        return $this->respondWithSuccess([
            'user' => $user,
            'token' => $token
        ], 'User registered successfully', 201);
    }

    #[Route('/me', name: 'api_me', methods: ['GET'])]
    #[OA\\Get(
        summary: 'Get current user profile',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\\Response(
                response: 200,
                description: 'Current user profile',
                content: new OA\\JsonContent(ref: new Model(type: User::class, groups: ['user:read']))
            ),
            new OA\\Response(response: 401, description: 'Unauthorized')
        ]
    )]
    public function me(): Response
    {
        $user = $this->getUser();

        if (!$user) {
            return $this->respondWithError('Unauthorized', 401);
        }

        return $this->respondWithSuccess($user);
    }
}`,

    // Health Check Controller
    'src/Controller/HealthController.php': `<?php

namespace App\\Controller;

use Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;
use Symfony\\Component\\HttpFoundation\\JsonResponse;
use Symfony\\Component\\Routing\\Annotation\\Route;
use OpenApi\\Attributes as OA;

#[Route('/api')]
class HealthController extends AbstractController
{
    #[Route('/health', name: 'api_health', methods: ['GET'])]
    #[OA\\Get(
        summary: 'Health check endpoint',
        description: 'Returns the current health status of the application',
        responses: [
            new OA\\Response(
                response: 200,
                description: 'Application is healthy',
                content: new OA\\JsonContent(
                    properties: [
                        new OA\\Property(property: 'status', type: 'string', example: 'healthy'),
                        new OA\\Property(property: 'timestamp', type: 'string', format: 'date-time'),
                        new OA\\Property(property: 'version', type: 'string'),
                        new OA\\Property(property: 'environment', type: 'string')
                    ]
                )
            )
        ]
    )]
    public function health(): JsonResponse
    {
        return $this->json([
            'status' => 'healthy',
            'timestamp' => new \\DateTime(),
            'version' => $this->getParameter('app.version') ?? '1.0.0',
            'environment' => $this->getParameter('kernel.environment')
        ]);
    }
}`,

    // PHPUnit configuration
    'phpunit.xml.dist': `<?xml version="1.0" encoding="UTF-8"?>

<!-- https://phpunit.readthedocs.io/en/latest/configuration.html -->
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         backupGlobals="false"
         colors="true"
         bootstrap="tests/bootstrap.php"
         convertDeprecationsToExceptions="false"
>
    <php>
        <ini name="display_errors" value="1" />
        <ini name="error_reporting" value="-1" />
        <server name="APP_ENV" value="test" force="true" />
        <server name="SHELL_VERBOSITY" value="-1" />
        <server name="SYMFONY_PHPUNIT_REMOVE" value="" />
        <server name="SYMFONY_PHPUNIT_VERSION" value="9.5" />
    </php>

    <testsuites>
        <testsuite name="Project Test Suite">
            <directory>tests</directory>
        </testsuite>
    </testsuites>

    <coverage processUncoveredFiles="true">
        <include>
            <directory suffix=".php">src</directory>
        </include>
    </coverage>

    <listeners>
        <listener class="Symfony\\Bridge\\PhpUnit\\SymfonyTestsListener" />
    </listeners>

    <extensions>
    </extensions>
</phpunit>`,


    // Graceful shutdown handler
    'bin/shutdown.php': `#!/usr/bin/env php
<?php

/**
 * Graceful shutdown handler for Symfony
 *
 * This script handles SIGTERM and SIGINT signals for graceful shutdown
 * Run it with: php bin/shutdown.php
 */

use App\\Kernel;
use Symfony\\Bundle\\FrameworkBundle\\Console\\Application;
use Symfony\\Component\\Console\\Input\\ArgvInput;
use Symfony\\Component\\Dotenv\\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

if (file_exists(dirname(__DIR__).'/bootstrap.php')) {
    require dirname(__DIR__).'/bootstrap.php';
}

if ($_SERVER['APP_DEBUG']) {
    umask(0000);
}

if (class_exists(Dotenv::class)) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}

// Signal handler function
function handleSignal(int $signal): void
{
    $signalName = $signal === SIGTERM ? 'SIGTERM' : 'SIGINT';
    echo "\\n{$signalName} signal received: initiating graceful shutdown\\n";

    // Close database connections
    echo "Closing database connections...\\n";
    // Doctrine connections are automatically closed when script ends

    // Clear cache if needed
    echo "Flushing any pending operations...\\n";

    echo "Graceful shutdown completed\\n";
    exit(0);
}

// Register signal handlers
pcntl_async_signals(true);
pcntl_signal(SIGTERM, 'handleSignal');
pcntl_signal(SIGINT, 'handleSignal');

echo "Graceful shutdown handler registered. Press Ctrl+C to test.\\n";
echo "Waiting for signals...\\n";

// Keep script running
while (true) {
    sleep(1);
}
`,


    // Functional test example
    'tests/Controller/UserControllerTest.php': `<?php

namespace App\\Tests\\Controller;

use App\\Entity\\User;
use Doctrine\\ORM\\EntityManagerInterface;
use Symfony\\Bundle\\FrameworkBundle\\Test\\WebTestCase;
use Symfony\\Component\\PasswordHasher\\Hasher\\UserPasswordHasherInterface;
use Lexik\\Bundle\\JWTAuthenticationBundle\\Services\\JWTTokenManagerInterface;

class UserControllerTest extends WebTestCase
{
    private ?EntityManagerInterface $entityManager;
    private ?UserPasswordHasherInterface $passwordHasher;
    private ?JWTTokenManagerInterface $jwtManager;

    protected function setUp(): void
    {
        $kernel = self::bootKernel();

        $this->entityManager = $kernel->getContainer()
            ->get('doctrine')
            ->getManager();

        $this->passwordHasher = $kernel->getContainer()
            ->get(UserPasswordHasherInterface::class);

        $this->jwtManager = $kernel->getContainer()
            ->get(JWTTokenManagerInterface::class);
    }

    public function testRegister(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json'], json_encode([
            'email' => 'test@example.com',
            'password' => 'password123',
            'firstName' => 'Test',
            'lastName' => 'User']));

        $this->assertResponseIsSuccessful();
        $this->assertResponseStatusCodeSame(201);

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('data', $response);
        $this->assertArrayHasKey('user', $response['data']);
        $this->assertArrayHasKey('token', $response['data']);
        $this->assertEquals('test@example.com', $response['data']['user']['email']);
    }

    public function testGetUserProfile(): void
    {
        $client = static::createClient();

        // Create a test user
        $user = new User();
        $user->setEmail('profile@example.com');
        $user->setFirstName('Profile');
        $user->setLastName('Test');
        $user->setPassword($this->passwordHasher->hashPassword($user, 'password123'));

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        // Generate JWT token
        $token = $this->jwtManager->create($user);

        $client->request('GET', '/api/me', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token]);

        $this->assertResponseIsSuccessful();
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertEquals('profile@example.com', $response['data']['email']);
    }

    public function testUnauthorizedAccess(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/users');

        $this->assertResponseStatusCodeSame(401);
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        // Clean up
        $this->entityManager->close();
        $this->entityManager = null;
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
    libpq-dev \\
    zip \\
    unzip

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql pdo_pgsql mbstring exif pcntl bcmath gd

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install APCu
RUN pecl install apcu && docker-php-ext-enable apcu

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Install Symfony CLI
RUN curl -sS https://get.symfony.com/cli/installer | bash
RUN mv /root/.symfony*/bin/symfony /usr/local/bin/symfony

# Set working directory
WORKDIR /var/www

# Copy existing application directory contents
COPY . /var/www

# Copy existing application directory permissions
COPY --chown=www-data:www-data . /var/www

# Install dependencies
RUN composer install --no-interaction --optimize-autoloader

# Generate JWT keys
RUN php bin/console lexik:jwt:generate-keypair --skip-if-exists

# Clear cache
RUN php bin/console cache:clear --env=prod

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
    container_name: {{serviceName}}-app
    restart: unless-stopped
    tty: true
    environment:
      SERVICE_NAME: app
      SERVICE_TAGS: dev
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
    tty: true
    ports:
      - "8000:80"
    volumes:
      - ./:/var/www
      - ./docker/nginx/conf.d/:/etc/nginx/conf.d/
    networks:
      - {{serviceName}}-network

  db:
    image: postgres:15-alpine
    container_name: {{serviceName}}-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ChangeMe
    volumes:
      - dbdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - {{serviceName}}-network

  redis:
    image: redis:7-alpine
    container_name: {{serviceName}}-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
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

# Symfony cache
var/cache/*
var/log/*
public/build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Git
.git/
.gitignore

# Docker
docker-compose.yml
Dockerfile`,

    // README
    'README.md': `# {{serviceName}} - Symfony API

Enterprise PHP API built with Symfony framework, featuring bundles, services, forms, and Doctrine ORM.

## Features

- 🔐 **JWT Authentication**: Secure token-based authentication
- 🗄️ **Doctrine ORM**: Powerful database abstraction with migrations
- 📦 **Bundle Architecture**: Modular and reusable components
- 🔧 **Service Container**: Dependency injection and service management
- 📝 **Form System**: Powerful form building and validation
- 🧪 **Testing**: PHPUnit testing framework
- 🐳 **Docker Ready**: Complete containerization setup
- 📚 **API Documentation**: Auto-generated with NelmioApiDocBundle

## Quick Start

### Requirements

- PHP >= 8.1
- Composer
- PostgreSQL/MySQL
- Redis
- Docker (optional)

### Installation

1. Install dependencies:
\`\`\`bash
composer install
\`\`\`

2. Configure environment:
\`\`\`bash
cp .env .env.local
# Edit .env.local with your database credentials
\`\`\`

3. Generate JWT keys:
\`\`\`bash
php bin/console lexik:jwt:generate-keypair
\`\`\`

4. Run migrations:
\`\`\`bash
php bin/console doctrine:migrations:migrate
\`\`\`

5. Load fixtures (optional):
\`\`\`bash
php bin/console doctrine:fixtures:load
\`\`\`

6. Start development server:
\`\`\`bash
symfony server:start
# or
php -S localhost:8000 -t public
\`\`\`

### Docker Setup

\`\`\`bash
docker-compose up -d
docker-compose exec app php bin/console doctrine:migrations:migrate
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/register\` - Register new user
- \`POST /api/login_check\` - Login user
- \`GET /api/me\` - Get authenticated user

### Users (Admin only)
- \`GET /api/users\` - List users
- \`GET /api/users/{id}\` - Get user details
- \`POST /api/users\` - Create user
- \`PUT /api/users/{id}\` - Update user
- \`DELETE /api/users/{id}\` - Delete user

## API Documentation

Access the interactive API documentation at:
- Swagger UI: \`http://localhost:8000/api/doc\`
- ReDoc: \`http://localhost:8000/api/doc.json\`

## Console Commands

- \`php bin/console list\` - List all commands
- \`php bin/console make:entity\` - Create new entity
- \`php bin/console make:controller\` - Create new controller
- \`php bin/console doctrine:migrations:diff\` - Generate migration
- \`php bin/console cache:clear\` - Clear cache
- \`php bin/console debug:router\` - Debug routes

## Testing

Run tests:
\`\`\`bash
php bin/phpunit
# or
./vendor/bin/phpunit
\`\`\`

With coverage:
\`\`\`bash
XDEBUG_MODE=coverage php bin/phpunit --coverage-html coverage
\`\`\`

## Development

### Creating a new feature

1. Create entity:
\`\`\`bash
php bin/console make:entity Product
\`\`\`

2. Generate migration:
\`\`\`bash
php bin/console make:migration
\`\`\`

3. Run migration:
\`\`\`bash
php bin/console doctrine:migrations:migrate
\`\`\`

4. Create controller:
\`\`\`bash
php bin/console make:controller ProductController
\`\`\`

### Debugging

- Web Profiler: \`/_profiler\` (dev environment)
- Debug toolbar: Shown at bottom of pages
- Logs: \`var/log/dev.log\`

## Production Deployment

1. Install production dependencies:
\`\`\`bash
composer install --no-dev --optimize-autoloader
\`\`\`

2. Clear and warm cache:
\`\`\`bash
php bin/console cache:clear --env=prod
php bin/console cache:warmup --env=prod
\`\`\`

3. Install assets:
\`\`\`bash
php bin/console assets:install --env=prod
\`\`\`

4. Run migrations:
\`\`\`bash
php bin/console doctrine:migrations:migrate --env=prod
\`\`\`

## License

MIT
`
  }
};