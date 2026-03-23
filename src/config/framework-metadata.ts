// Framework Metadata Registry
// Comprehensive framework and language metadata for multi-language service definitions

export interface LanguageMetadata {
  name: string;
  displayName: string;
  extensions: string[];
  packageManager: {
    name: string;
    lockFile: string;
    configFile: string;
    installCmd: string;
    addCmd: string;
    removeCmd: string;
  };
  buildTools: BuildTool[];
  testFrameworks: TestFramework[];
  filePatterns: {
    source: string[];
    test: string;
    config: string[];
  };
  dockerBaseImages: {
    alpine?: string;
    slim?: string;
    default: string;
  };
  defaultPort?: number;
}

export interface FrameworkMetadata {
  id: string;
  name: string;
  displayName: string;
  language: string;
  type: 'frontend' | 'backend' | 'mobile' | 'desktop';
  versions: string[];
  latestVersion: string;
  description: string;
  officialDocs: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  configFiles: string[];
  scripts: Record<string, string>;
  features: string[];
}

export interface BuildTool {
  name: string;
  command: string;
  configFile: string;
}

export interface TestFramework {
  name: string;
  command: string;
  configFile: string;
  coverageTool?: string;
}

export const languageRegistry: Record<string, LanguageMetadata> = {
  typescript: {
    name: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    packageManager: {
      name: 'npm',
      lockFile: 'package-lock.json',
      configFile: 'package.json',
      installCmd: 'npm install',
      addCmd: 'npm add',
      removeCmd: 'npm remove',
    },
    buildTools: [
      { name: 'tsc', command: 'tsc', configFile: 'tsconfig.json' },
      { name: 'webpack', command: 'webpack', configFile: 'webpack.config.js' },
      { name: 'vite', command: 'vite', configFile: 'vite.config.ts' },
      { name: 'esbuild', command: 'esbuild', configFile: 'esbuild.config.js' },
      { name: 'rollup', command: 'rollup', configFile: 'rollup.config.js' },
    ],
    testFrameworks: [
      { name: 'jest', command: 'jest', configFile: 'jest.config.js', coverageTool: 'istanbul' },
      { name: 'vitest', command: 'vitest', configFile: 'vitest.config.ts', coverageTool: 'c8' },
      { name: 'mocha', command: 'mocha', configFile: '.mocharc.js' },
      { name: 'jasmine', command: 'jasmine', configFile: 'jasmine.json' },
    ],
    filePatterns: {
      source: ['src/**/*.ts', 'src/**/*.tsx'],
      test: '**/*.test.ts',
      config: ['tsconfig.json', 'package.json'],
    },
    dockerBaseImages: {
      alpine: 'node:20-alpine',
      slim: 'node:20-slim',
      default: 'node:20',
    },
    defaultPort: 3000,
  },

  javascript: {
    name: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx'],
    packageManager: {
      name: 'npm',
      lockFile: 'package-lock.json',
      configFile: 'package.json',
      installCmd: 'npm install',
      addCmd: 'npm add',
      removeCmd: 'npm remove',
    },
    buildTools: [
      { name: 'webpack', command: 'webpack', configFile: 'webpack.config.js' },
      { name: 'vite', command: 'vite', configFile: 'vite.config.js' },
      { name: 'esbuild', command: 'esbuild', configFile: 'esbuild.config.js' },
      { name: 'rollup', command: 'rollup', configFile: 'rollup.config.js' },
    ],
    testFrameworks: [
      { name: 'jest', command: 'jest', configFile: 'jest.config.js', coverageTool: 'istanbul' },
      { name: 'mocha', command: 'mocha', configFile: '.mocharc.js' },
      { name: 'jasmine', command: 'jasmine', configFile: 'jasmine.json' },
    ],
    filePatterns: {
      source: ['src/**/*.js', 'src/**/*.jsx'],
      test: '**/*.test.js',
      config: ['package.json'],
    },
    dockerBaseImages: {
      alpine: 'node:20-alpine',
      slim: 'node:20-slim',
      default: 'node:20',
    },
    defaultPort: 3000,
  },

  python: {
    name: 'python',
    displayName: 'Python',
    extensions: ['.py'],
    packageManager: {
      name: 'pip',
      lockFile: 'requirements.lock',
      configFile: 'requirements.txt',
      installCmd: 'pip install -r requirements.txt',
      addCmd: 'pip add',
      removeCmd: 'pip uninstall -y',
    },
    buildTools: [
      { name: 'setuptools', command: 'python setup.py', configFile: 'setup.py' },
      { name: 'poetry', command: 'poetry', configFile: 'pyproject.toml' },
    ],
    testFrameworks: [
      { name: 'pytest', command: 'pytest', configFile: 'pytest.ini', coverageTool: 'pytest-cov' },
      { name: 'unittest', command: 'python -m unittest', configFile: 'test_*.py' },
    ],
    filePatterns: {
      source: ['**/*.py'],
      test: 'test_*.py',
      config: ['requirements.txt', 'setup.py', 'pyproject.toml'],
    },
    dockerBaseImages: {
      alpine: 'python:3.11-alpine',
      slim: 'python:3.11-slim',
      default: 'python:3.11',
    },
    defaultPort: 8000,
  },

  go: {
    name: 'go',
    displayName: 'Go',
    extensions: ['.go'],
    packageManager: {
      name: 'go',
      lockFile: 'go.sum',
      configFile: 'go.mod',
      installCmd: 'go mod download',
      addCmd: 'go get',
      removeCmd: 'go mod tidy',
    },
    buildTools: [
      { name: 'go build', command: 'go build', configFile: 'go.mod' },
    ],
    testFrameworks: [
      { name: 'testing', command: 'go test', configFile: '*_test.go', coverageTool: 'go tool cover' },
    ],
    filePatterns: {
      source: ['**/*.go'],
      test: '**/*_test.go',
      config: ['go.mod', 'go.sum'],
    },
    dockerBaseImages: {
      alpine: 'golang:1.21-alpine',
      default: 'golang:1.21',
    },
    defaultPort: 8080,
  },

  rust: {
    name: 'rust',
    displayName: 'Rust',
    extensions: ['.rs'],
    packageManager: {
      name: 'cargo',
      lockFile: 'Cargo.lock',
      configFile: 'Cargo.toml',
      installCmd: 'cargo fetch',
      addCmd: 'cargo add',
      removeCmd: 'cargo remove',
    },
    buildTools: [
      { name: 'cargo', command: 'cargo build', configFile: 'Cargo.toml' },
    ],
    testFrameworks: [
      { name: 'cargo test', command: 'cargo test', configFile: 'tests/**/*.rs', coverageTool: 'tarpaulin' },
    ],
    filePatterns: {
      source: ['src/**/*.rs'],
      test: 'tests/**/*.rs',
      config: ['Cargo.toml', 'Cargo.lock'],
    },
    dockerBaseImages: {
      alpine: 'rust:1.72-alpine',
      slim: 'rust:1.72-slim',
      default: 'rust:1.72',
    },
    defaultPort: 8080,
  },

  java: {
    name: 'java',
    displayName: 'Java',
    extensions: ['.java'],
    packageManager: {
      name: 'maven',
      lockFile: 'pom.xml',
      configFile: 'pom.xml',
      installCmd: 'mvn install',
      addCmd: 'mvn dependency:add',
      removeCmd: 'mvn dependency:purge',
    },
    buildTools: [
      { name: 'maven', command: 'mvn', configFile: 'pom.xml' },
      { name: 'gradle', command: 'gradle', configFile: 'build.gradle' },
    ],
    testFrameworks: [
      { name: 'junit', command: 'mvn test', configFile: 'src/test/**/*.java', coverageTool: 'jacoco' },
    ],
    filePatterns: {
      source: ['src/main/**/*.java'],
      test: 'src/test/**/*.java',
      config: ['pom.xml', 'build.gradle'],
    },
    dockerBaseImages: {
      alpine: 'eclipse-temurin:21-jre-alpine',
      slim: 'eclipse-temurin:21-jre',
      default: 'eclipse-temurin:21-jdk',
    },
    defaultPort: 8080,
  },

  ruby: {
    name: 'ruby',
    displayName: 'Ruby',
    extensions: ['.rb'],
    packageManager: {
      name: 'bundler',
      lockFile: 'Gemfile.lock',
      configFile: 'Gemfile',
      installCmd: 'bundle install',
      addCmd: 'bundle add',
      removeCmd: 'bundle remove',
    },
    buildTools: [
      { name: 'rake', command: 'rake', configFile: 'Rakefile' },
    ],
    testFrameworks: [
      { name: 'rspec', command: 'rspec', configFile: 'spec/**/*.rb', coverageTool: 'simplecov' },
      { name: 'minitest', command: 'ruby test/**/*_test.rb', configFile: 'test/**/*_test.rb' },
    ],
    filePatterns: {
      source: ['**/*.rb'],
      test: 'test/**/*.rb',
      config: ['Gemfile', 'Rakefile'],
    },
    dockerBaseImages: {
      alpine: 'ruby:3.2-alpine',
      slim: 'ruby:3.2-slim',
      default: 'ruby:3.2',
    },
    defaultPort: 3000,
  },

  php: {
    name: 'php',
    displayName: 'PHP',
    extensions: ['.php'],
    packageManager: {
      name: 'composer',
      lockFile: 'composer.lock',
      configFile: 'composer.json',
      installCmd: 'composer install',
      addCmd: 'composer require',
      removeCmd: 'composer remove',
    },
    buildTools: [
      { name: 'composer', command: 'composer', configFile: 'composer.json' },
    ],
    testFrameworks: [
      { name: 'phpunit', command: 'phpunit', configFile: 'phpunit.xml', coverageTool: 'php-code-coverage' },
    ],
    filePatterns: {
      source: ['src/**/*.php'],
      test: 'tests/**/*.php',
      config: ['composer.json', 'phpunit.xml'],
    },
    dockerBaseImages: {
      alpine: 'php:8.2-alpine',
      default: 'php:8.2-cli',
    },
    defaultPort: 8000,
  },
};

export const frameworkRegistry: FrameworkMetadata[] = [
  // TypeScript Frameworks
  {
    id: 'react',
    name: 'react',
    displayName: 'React',
    language: 'typescript',
    type: 'frontend',
    versions: ['18.2.0', '18.1.0', '17.0.2'],
    latestVersion: '18.2.0',
    description: 'A JavaScript library for building user interfaces',
    officialDocs: 'https://react.dev/',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'vite': '^5.0.0',
      '@vitejs/plugin-react': '^4.2.0',
      typescript: '^5.2.0',
    },
    configFiles: ['vite.config.ts', 'tsconfig.json'],
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      test: 'vitest',
    },
    features: ['jsx', 'tsx', 'fast-refresh', 'router', 'state-management'],
  },
  {
    id: 'vue',
    name: 'vue',
    displayName: 'Vue.js',
    language: 'typescript',
    type: 'frontend',
    versions: ['3.3.0', '3.2.0'],
    latestVersion: '3.3.0',
    description: 'Progressive JavaScript framework',
    officialDocs: 'https://vuejs.org/',
    dependencies: {
      vue: '^3.3.0',
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^4.5.0',
      vite: '^5.0.0',
      typescript: '^5.2.0',
    },
    configFiles: ['vite.config.ts', 'tsconfig.json'],
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    features: ['sfc', 'composition-api', 'typescript', 'router', 'pinia'],
  },
  {
    id: 'express',
    name: 'express',
    displayName: 'Express',
    language: 'typescript',
    type: 'backend',
    versions: ['4.18.2'],
    latestVersion: '4.18.2',
    description: 'Fast, unopinionated, minimalist web framework',
    officialDocs: 'https://expressjs.com/',
    dependencies: {
      express: '^4.18.2',
    },
    devDependencies: {
      '@types/express': '^4.17.17',
      '@types/node': '^20.5.0',
      typescript: '^5.2.0',
      'ts-node': '^10.9.1',
    },
    configFiles: ['tsconfig.json'],
    scripts: {
      dev: 'ts-node src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
    },
    features: ['rest-api', 'middleware', 'routing', 'templates'],
  },
  {
    id: 'nestjs',
    name: 'nestjs',
    displayName: 'NestJS',
    language: 'typescript',
    type: 'backend',
    versions: ['10.2.0', '10.1.0'],
    latestVersion: '10.2.0',
    description: 'A progressive Node.js framework',
    officialDocs: 'https://nestjs.com/',
    dependencies: {
      '@nestjs/common': '^10.2.0',
      '@nestjs/core': '^10.2.0',
      '@nestjs/platform-express': '^10.2.0',
      'reflect-metadata': '^0.1.13',
    },
    devDependencies: {
      '@nestjs/cli': '^10.2.0',
      '@nestjs/schematics': '^10.0.0',
      typescript: '^5.2.0',
    },
    configFiles: ['nest-cli.json', 'tsconfig.json'],
    scripts: {
      build: 'nest build',
      start: 'nest start',
      'start:dev': 'nest start --watch',
      'start:debug': 'nest start --debug --watch',
    },
    features: ['di', 'decorators', 'graphql', 'websockets', 'microservices'],
  },
  {
    id: 'fastify',
    name: 'fastify',
    displayName: 'Fastify',
    language: 'typescript',
    type: 'backend',
    versions: ['4.24.0'],
    latestVersion: '4.24.0',
    description: 'Fast and low overhead web framework',
    officialDocs: 'https://fastify.dev/',
    dependencies: {
      fastify: '^4.24.0',
    },
    devDependencies: {
      '@types/node': '^20.5.0',
      typescript: '^5.2.0',
    },
    configFiles: ['tsconfig.json'],
    scripts: {
      dev: 'ts-node src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
    },
    features: ['performance', 'schema', 'plugins', 'logging'],
  },
  // Python Frameworks
  {
    id: 'fastapi',
    name: 'fastapi',
    displayName: 'FastAPI',
    language: 'python',
    type: 'backend',
    versions: ['0.103.0', '0.102.0'],
    latestVersion: '0.103.0',
    description: 'Modern, fast web framework for building APIs',
    officialDocs: 'https://fastapi.tiangolo.com/',
    dependencies: {
      fastapi: '^0.103.0',
      uvicorn: '^0.23.0',
      pydantic: '^2.3.0',
    },
    devDependencies: {
      pytest: '^7.4.0',
      'pytest-asyncio': '^0.21.0',
    },
    configFiles: ['pyproject.toml'],
    scripts: {
      dev: 'uvicorn src.main:app --reload',
      start: 'uvicorn src.main:app',
      test: 'pytest',
    },
    features: ['async', 'openapi', 'type-validation', 'dependency-injection'],
  },
  {
    id: 'django',
    name: 'django',
    displayName: 'Django',
    language: 'python',
    type: 'backend',
    versions: ['4.2.0', '4.1.0'],
    latestVersion: '4.2.0',
    description: 'The web framework for perfectionists with deadlines',
    officialDocs: 'https://www.djangoproject.com/',
    dependencies: {
      django: '^4.2.0',
      'djangorestframework': '^3.14.0',
    },
    devDependencies: {
      django: '^4.2.0',
      pytest: '^7.4.0',
      'pytest-django': '^4.5.0',
    },
    configFiles: ['manage.py', 'settings.py'],
    scripts: {
      dev: 'python manage.py runserver',
      start: 'gunicorn wsgi:application',
      test: 'pytest',
    },
    features: ['orm', 'admin', 'auth', 'middleware', 'templates'],
  },
  {
    id: 'flask',
    name: 'flask',
    displayName: 'Flask',
    language: 'python',
    type: 'backend',
    versions: ['3.0.0', '2.3.0'],
    latestVersion: '3.0.0',
    description: 'A microframework for Python',
    officialDocs: 'https://flask.palletsprojects.com/',
    dependencies: {
      flask: '^3.0.0',
    },
    devDependencies: {
      pytest: '^7.4.0',
    },
    configFiles: ['app.py'],
    scripts: {
      dev: 'flask run',
      start: 'gunicorn app:app',
      test: 'pytest',
    },
    features: ['microframework', 'flexible', 'extensions', 'routing'],
  },
  // Go Frameworks
  {
    id: 'gin',
    name: 'gin',
    displayName: 'Gin',
    language: 'go',
    type: 'backend',
    versions: ['1.9.1'],
    latestVersion: '1.9.1',
    description: 'High-performance HTTP web framework',
    officialDocs: 'https://gin-gonic.com/',
    dependencies: {
      'github.com/gin-gonic/gin': 'v1.9.1',
    },
    configFiles: ['go.mod'],
    scripts: {
      dev: 'go run main.go',
      build: 'go build -o app',
      start: './app',
      test: 'go test ./...',
    },
    features: ['performance', 'middleware', 'json', 'routing'],
  },
  {
    id: 'fiber',
    name: 'fiber',
    displayName: 'Fiber',
    language: 'go',
    type: 'backend',
    versions: ['2.48.0'],
    latestVersion: '2.48.0',
    description: 'Express inspired web framework',
    officialDocs: 'https://gofiber.io/',
    dependencies: {
      'github.com/gofiber/fiber/v2': 'v2.48.0',
    },
    configFiles: ['go.mod'],
    scripts: {
      dev: 'go run main.go',
      build: 'go build -o app',
      start: './app',
      test: 'go test ./...',
    },
    features: ['performance', 'express-like', 'websocket', 'templates'],
  },
  // Rust Frameworks
  {
    id: 'actix',
    name: 'actix',
    displayName: 'Actix Web',
    language: 'rust',
    type: 'backend',
    versions: ['4.4.0'],
    latestVersion: '4.4.0',
    description: 'Powerful, pragmatic web framework',
    officialDocs: 'https://actix.rs/',
    dependencies: {
      actix_web: '4.4.0',
    },
    devDependencies: {},
    configFiles: ['Cargo.toml'],
    scripts: {
      dev: 'cargo run',
      build: 'cargo build --release',
      start: './target/release/app',
      test: 'cargo test',
    },
    features: ['performance', 'async', 'websocket', 'macros'],
  },
  // Java Frameworks
  {
    id: 'spring-boot',
    name: 'spring-boot',
    displayName: 'Spring Boot',
    language: 'java',
    type: 'backend',
    versions: ['3.1.0', '3.0.0', '2.7.0'],
    latestVersion: '3.1.0',
    description: 'Build production-grade applications',
    officialDocs: 'https://spring.io/projects/spring-boot',
    dependencies: {},
    devDependencies: {},
    configFiles: ['pom.xml', 'build.gradle'],
    scripts: {
      dev: 'mvn spring-boot:run',
      build: 'mvn package',
      start: 'java -jar target/*.jar',
      test: 'mvn test',
    },
    features: ['ioc', 'aop', 'security', 'data', 'mvc', 'websocket'],
  },
];

export function getLanguageMetadata(language: string): LanguageMetadata | undefined {
  return languageRegistry[language];
}

export function getFrameworkMetadata(framework: string): FrameworkMetadata | undefined {
  return frameworkRegistry.find((f) => f.id === framework || f.name === framework);
}

export function getFrameworksByLanguage(language: string): FrameworkMetadata[] {
  return frameworkRegistry.filter((f) => f.language === language);
}

export function getFrameworksByType(type: 'frontend' | 'backend' | 'mobile' | 'desktop'): FrameworkMetadata[] {
  return frameworkRegistry.filter((f) => f.type === type);
}
