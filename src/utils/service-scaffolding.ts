import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { analyzeProject } from './framework-detection';

/**
 * Service Scaffolding with Best Practices
 * Generates service scaffolds following framework-specific best practices
 */

export interface ScaffoldConfig {
  name: string;
  type: 'module' | 'service' | 'controller' | 'middleware' | 'entity' | 'repository';
  framework: string;
  language: string;
  path?: string;
  features?: string[];
  bestPractices?: boolean;
}

export interface ScaffoldResult {
  files: Array<{ path: string; content: string }>;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  warnings: string[];
}

export interface BestPracticeRule {
  name: string;
  category: 'security' | 'performance' | 'maintainability' | 'testing' | 'documentation';
  description: string;
  severity: 'error' | 'warning' | 'info';
  check?: (content: string) => boolean;
  fix?: (content: string) => string;
}

// Best practices rules per framework
const BEST_PRACTICES: Record<string, BestPracticeRule[]> = {
  nestjs: [
    {
      name: 'dependency-injection',
      category: 'maintainability',
      description: 'Use dependency injection for all services',
      severity: 'error',
      check: (content) => content.includes('@Injectable()'),
    },
    {
      name: 'input-validation',
      category: 'security',
      description: 'Validate all input DTOs with class-validator',
      severity: 'error',
      check: (content) => content.includes('class-validator') || content.includes('@Is'),
    },
    {
      name: 'error-handling',
      category: 'maintainability',
      description: 'Use proper exception filters',
      severity: 'warning',
      check: (content) => content.includes('HttpException') || content.includes('try-catch'),
    },
    {
      name: 'api-documentation',
      category: 'documentation',
      description: 'Add Swagger decorators for API documentation',
      severity: 'info',
      check: (content) => content.includes('@ApiTags') || content.includes('@ApiOperation'),
    },
    {
      name: 'environment-config',
      category: 'security',
      description: 'Use ConfigService for environment variables',
      severity: 'error',
      check: (content) => !content.includes('process.env') || content.includes('ConfigService'),
    },
  ],
  express: [
    {
      name: 'async-error-handling',
      category: 'maintainability',
      description: 'Handle async errors properly',
      severity: 'error',
      check: (content) => content.includes('catch') || content.includes('express-async-errors'),
    },
    {
      name: 'input-validation',
      category: 'security',
      description: 'Validate request input',
      severity: 'warning',
      check: (content) => content.includes('joi') || content.includes('zod') || content.includes('celebrate'),
    },
    {
      name: 'cors',
      category: 'security',
      description: 'Configure CORS properly',
      severity: 'error',
      check: (content) => content.includes('cors'),
    },
    {
      name: 'helmet-security',
      category: 'security',
      description: 'Use Helmet for security headers',
      severity: 'error',
      check: (content) => content.includes('helmet'),
    },
    {
      name: 'rate-limiting',
      category: 'security',
      description: 'Implement rate limiting',
      severity: 'warning',
      check: (content) => content.includes('rate-limit') || content.includes('express-rate-limit'),
    },
  ],
  react: [
    {
      name: 'typescript',
      category: 'maintainability',
      description: 'Use TypeScript for type safety',
      severity: 'info',
      check: (content) => content.endsWith('.ts') || content.endsWith('.tsx'),
    },
    {
      name: 'prop-types',
      category: 'maintainability',
      description: 'Define prop types for components',
      severity: 'warning',
      check: (content) => content.includes('interface') || content.includes('PropTypes'),
    },
    {
      name: 'hooks',
      category: 'maintainability',
      description: 'Use functional components with hooks',
      severity: 'info',
      check: (content) => content.includes('useState') || content.includes('useEffect'),
    },
  ],
};

/**
 * Generate service scaffold with best practices
 */
export async function generateScaffold(config: ScaffoldConfig): Promise<ScaffoldResult> {
  console.log(chalk.cyan.bold(`\n🔧 Generating Service Scaffold: ${config.name}\n`));
  console.log(chalk.gray(`Type: ${config.type}`));
  console.log(chalk.gray(`Framework: ${config.framework}`));
  console.log(chalk.gray(`Language: ${config.language}\n`));

  const result: ScaffoldResult = {
    files: [],
    dependencies: [],
    devDependencies: [],
    scripts: {},
    warnings: [],
  };

  // Generate files based on type and framework
  switch (config.type) {
    case 'module':
      generateModuleScaffold(config, result);
      break;
    case 'service':
      generateServiceScaffold(config, result);
      break;
    case 'controller':
      generateControllerScaffold(config, result);
      break;
    case 'middleware':
      generateMiddlewareScaffold(config, result);
      break;
    case 'entity':
      generateEntityScaffold(config, result);
      break;
    case 'repository':
      generateRepositoryScaffold(config, result);
      break;
    default:
      result.warnings.push(`Unknown scaffold type: ${config.type}`);
  }

  // Apply best practices
  if (config.bestPractices !== false) {
    applyBestPractices(config, result);
  }

  // Display warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  Warnings:\n'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ${warning}`));
    }
    console.log('');
  }

  console.log(chalk.green(`✓ Generated ${result.files.length} file(s)\n`));

  return result;
}

/**
 * Generate module scaffold
 */
function generateModuleScaffold(config: ScaffoldConfig, result: ScaffoldResult): void {
  const moduleName = toKebabCase(config.name);
  const className = toPascalCase(config.name);

  if (config.framework === 'nestjs') {
    generateNestJSModule(moduleName, className, result);
  } else if (config.framework === 'express') {
    generateExpressModule(moduleName, className, result);
  } else if (config.framework === 'react') {
    generateReactModule(moduleName, className, result);
  } else {
    generateGenericModule(moduleName, className, config, result);
  }
}

/**
 * Generate NestJS module with best practices
 */
function generateNestJSModule(
  moduleName: string,
  className: string,
  result: ScaffoldResult
): void {
  // Dependencies
  result.dependencies.push(
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/platform-express',
    'class-validator',
    'class-transformer',
    'rxjs'
  );

  result.devDependencies.push(
    '@types/node',
    'typescript',
    '@nestjs/swagger'
  );

  // Module file
  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.module.ts`,
    content: generateNestJSModuleFile(className, moduleName),
  });

  // Controller file
  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.controller.ts`,
    content: generateNestJSController(className, moduleName),
  });

  // Service file
  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.service.ts`,
    content: generateNestJSService(className, moduleName),
  });

  // DTO file
  result.files.push({
    path: `src/modules/${moduleName}/dto/create-${moduleName}.dto.ts`,
    content: generateNestJSDTO(className, moduleName, 'create'),
  });

  result.files.push({
    path: `src/modules/${moduleName}/dto/update-${moduleName}.dto.ts`,
    content: generateNestJSDTO(className, moduleName, 'update'),
  });

  // Entity file (if TypeORM)
  result.files.push({
    path: `src/modules/${moduleName}/entities/${moduleName}.entity.ts`,
    content: generateNestJSEntity(className, moduleName),
  });

  // Test file
  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.controller.spec.ts`,
    content: generateNestJSTest(className, moduleName, 'controller'),
  });

  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.service.spec.ts`,
    content: generateNestJSTest(className, moduleName, 'service'),
  });
}

/**
 * Generate NestJS module file
 */
function generateNestJSModuleFile(className: string, moduleName: string): string {
  const cc = toCamelCase(className);
  return `import { Module } from '@nestjs/common';
import { ${className}Controller } from './${moduleName}.controller';
import { ${className}Service } from './${moduleName}.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${className} } from './entities/${moduleName}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${className}])],
  controllers: [${className}Controller],
  providers: [${className}Service],
  exports: [${className}Service],
})
export class ${className}Module {}
`;
}

/**
 * Generate NestJS controller with best practices
 */
function generateNestJSController(className: string, moduleName: string): string {
  const cc = toCamelCase(className);
  return `import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ${className}Service } from './${moduleName}.service';
import { Create${className}Dto } from './dto/create-${moduleName}.dto';
import { Update${className}Dto } from './dto/update-${moduleName}.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('${moduleName}')
@Controller('${moduleName}')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ${className}Controller {
  constructor(private readonly ${cc}Service: ${className}Service) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ${className}' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '${className} created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad request' })
  async create(
    @Body() create${className}Dto: Create${className}Dto,
  ) {
    try {
      const result = await this.${cc}Service.create(create${className}Dto);
      return {
        success: true,
        data: result,
        message: '${className} created successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all ${className} items' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Items retrieved successfully' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.${cc}Service.findAll({
      page: page || 1,
      limit: limit || 10,
    });
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ${className} by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const result = await this.${cc}Service.findOne(id);
    return {
      success: true,
      data: result,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ${className}' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() update${className}Dto: Update${className}Dto,
  ) {
    const result = await this.${cc}Service.update(id, update${className}Dto);
    return {
      success: true,
      data: result,
      message: '${className} updated successfully',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ${className}' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.${cc}Service.remove(id);
    return {
      success: true,
      message: '${className} deleted successfully',
    };
  }
}
`;
}

/**
 * Generate NestJS service with best practices
 */
function generateNestJSService(className: string, moduleName: string): string {
  const cc = toCamelCase(className);
  return `import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${className} } from './entities/${moduleName}.entity';
import { Create${className}Dto } from './dto/create-${moduleName}.dto';
import { Update${className}Dto } from './dto/update-${moduleName}.dto';

@Injectable()
export class ${className}Service {
  constructor(
    @InjectRepository(${className})
    private readonly ${cc}Repository: Repository<${className}>,
  ) {}

  async create(create${className}Dto: Create${className}Dto): Promise<${className}> {
    try {
      const item = this.${cc}Repository.create(create${className}Dto);
      return await this.${cc}Repository.save(item);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new ConflictException('${className} already exists');
      }
      throw error;
    }
  }

  async findAll(pagination: {
    page: number;
    limit: number;
  }): Promise<{
    data: ${className}[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const [data, total] = await this.${cc}Repository.findAndCount({
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findOne(id: number): Promise<${className}> {
    const item = await this.${cc}Repository.findOne({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(\`${className} with ID \${id} not found\`);
    }

    return item;
  }

  async update(
    id: number,
    update${className}Dto: Update${className}Dto,
  ): Promise<${className}> {
    await this.findOne(id); // Check if exists

    await this.${cc}Repository.update(id, update${className}Dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // Check if exists
    await this.${cc}Repository.delete(id);
  }

  // Custom business logic methods can be added here
  async findByCriteria(criteria: any): Promise<${className}[]> {
    return await this.${cc}Repository.find({
      where: criteria,
    });
  }
}
`;
}

/**
 * Generate NestJS DTO with validation
 */
function generateNestJSDTO(className: string, moduleName: string, type: 'create' | 'update'): string {
  const validationDecorators = `
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)`;

  return `import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsEmail,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDate,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create${className}Dto {
  @ApiProperty({ example: 'example', description: 'Name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'example@domain.com', description: 'Email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Add more fields as needed
}

export class Update${className}Dto {
  @ApiPropertyOptional({ example: 'example', description: 'Name' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'example@domain.com', description: 'Email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Add more fields as needed
}
`;
}

/**
 * Generate NestJS entity
 */
function generateNestJSEntity(className: string, moduleName: string): string {
  return `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('${moduleName}')
export class ${className} {
  @ApiProperty({ example: 1, description: 'Unique identifier' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Example Name', description: 'Name' })
  @Column()
  name: string;

  @ApiPropertyOptional({ example: 'example@domain.com', description: 'Email' })
  @Column({ unique: true, nullable: true })
  email?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Active status' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Deletion timestamp' })
  @DeleteDateColumn()
  deletedAt?: Date;
}
`;
}

/**
 * Generate NestJS test file
 */
function generateNestJSTest(className: string, moduleName: string, type: 'controller' | 'service'): string {
  const testedClass = type === 'controller' ? `${className}Controller` : `${className}Service`;
  const subject = type === 'controller' ? 'controller' : 'service';

  return `import { Test, TestingModule } from '@nestjs/testing';
import { ${testedClass} } from './${moduleName}.${subject}';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ${className} } from './entities/${moduleName}.entity';
import { Repository } from 'typeorm';
import { Create${className}Dto } from './dto/create-${moduleName}.dto';

describe('${testedClass}', () => {
  let ${subject}: ${testedClass};
  let repository: Repository<${className}>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      ${type === 'controller'
        ? `controllers: [${testedClass}],`
        : `providers: [${testedClass}],`
      }
      providers: [
        ${testedClass},
        {
          provide: getRepositoryToken(${className}),
          useValue: mockRepository,
        },
      ],
    }).compile();

    ${subject} = module.get<${testedClass}>(${testedClass});
    repository = module.get<Repository<${className}>>(getRepositoryToken(${className}));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(${subject}).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a ${className}', async () => {
      const create${className}Dto: Create${className}Dto = {
        name: 'Test ${className}',
        email: 'test@example.com',
      };

      const mock${className} = { id: 1, ...create${className}Dto };

      mockRepository.create.mockReturnValue(mock${className});
      mockRepository.save.mockResolvedValue(mock${className});

      const result = await ${subject}.create(create${className}Dto);

      expect(result).toEqual(mock${className});
      expect(mockRepository.create).toHaveBeenCalledWith(create${className}Dto);
      expect(mockRepository.save).toHaveBeenCalledWith(mock${className});
    });
  });

  describe('findAll', () => {
    it('should return an array of ${className} items', async () => {
      const mock${className}s = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ];

      mockRepository.findAndCount.mockResolvedValue([mock${className}s, 2]);

      const result = await ${subject}.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mock${className}s);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return a single ${className} by ID', async () => {
      const mock${className} = { id: 1, name: 'Test ${className}' };

      mockRepository.findOne.mockResolvedValue(mock${className});

      const result = await ${subject}.findOne(1);

      expect(result).toEqual(mock${className});
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if ${className} not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(${subject}.findOne(999)).rejects.toThrow('NotFoundException');
    });
  });

  describe('update', () => {
    it('should update a ${className}', async () => {
      const update${className}Dto = { name: 'Updated Name' };
      const mock${className} = {
        id: 1,
        name: 'Updated Name',
      };

      mockRepository.findOne.mockResolvedValue(mock${className});
      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findOne.mockResolvedValue(mock${className});

      const result = await ${subject}.update(1, update${className}Dto);

      expect(result).toEqual(mock${className});
    });
  });

  describe('remove', () => {
    it('should delete a ${className}', async () => {
      const mock${className} = { id: 1, name: 'Test ${className}' };

      mockRepository.findOne.mockResolvedValue(mock${className});
      mockRepository.delete.mockResolvedValue(undefined);

      await ${subject}.remove(1);

      expect(mockRepository.delete).toHaveBeenCalledWith(1);
    });
  });
});
`;
}

/**
 * Generate Express module
 */
function generateExpressModule(moduleName: string, className: string, result: ScaffoldResult): void {
  result.dependencies.push('express', 'joi', 'helmet', 'cors', 'express-rate-limit');

  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.router.ts`,
    content: generateExpressRouter(className, moduleName),
  });

  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.controller.ts`,
    content: generateExpressController(className, moduleName),
  });

  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.service.ts`,
    content: generateExpressService(className, moduleName),
  });

  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.validation.ts`,
    content: generateExpressValidation(className, moduleName),
  });
}

/**
 * Generate Express router
 */
function generateExpressRouter(className: string, moduleName: string): string {
  return `import { Router } from 'express';
import { ${className}Controller } from './${moduleName}.controller';
import { validate${className} } from './${moduleName}.validation';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const controller = new ${className}Controller();

// Apply middleware
router.use(rateLimiter);

// Routes
router.post('/', validate${className}('create'), authMiddleware, (req, res) =>
  controller.create(req, res),
);

router.get('/', authMiddleware, (req, res) => controller.findAll(req, res));

router.get('/:id', authMiddleware, (req, res) => controller.findOne(req, res));

router.put('/:id', validate${className}('update'), authMiddleware, (req, res) =>
  controller.update(req, res),
);

router.delete('/:id', authMiddleware, (req, res) => controller.remove(req, res));

export default router;
`;
}

/**
 * Generate Express controller
 */
function generateExpressController(className: string, moduleName: string): string {
  return `import { Request, Response, NextFunction } from 'express';
import { ${className}Service } from './${moduleName}.service';
import { asyncHandler } from '../utils/async-handler';

export class ${className}Controller {
  private service: ${className}Service;

  constructor() {
    this.service = new ${className}Service();
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.service.create(req.body);
    res.status(201).json({
      success: true,
      data,
      message: '${className} created successfully',
    });
  });

  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    const data = await this.service.findAll({
      page: Number(page),
      limit: Number(limit),
    });
    res.json({
      success: true,
      ...data,
    });
  });

  findOne = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = await this.service.findOne(Number(id));
    res.json({
      success: true,
      data,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = await this.service.update(Number(id), req.body);
    res.json({
      success: true,
      data,
      message: '${className} updated successfully',
    });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.remove(Number(id));
    res.json({
      success: true,
      message: '${className} deleted successfully',
    });
  });
}
`;
}

/**
 * Generate Express service
 */
function generateExpressService(className: string, moduleName: string): string {
  return `import { ${className} } from './entities/${moduleName}.entity';

export class ${className}Service {
  async create(data: any): Promise<${className}> {
    // Implement creation logic
    throw new Error('Not implemented');
  }

  async findAll pagination: {
    page: number;
    limit: number;
  }): Promise<{
    data: ${className}[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Implement find all logic
    throw new Error('Not implemented');
  }

  async findOne(id: number): Promise<${className}> {
    // Implement find one logic
    throw new Error('Not implemented');
  }

  async update(id: number, data: any): Promise<${className}> {
    // Implement update logic
    throw new Error('Not implemented');
  }

  async remove(id: number): Promise<void> {
    // Implement delete logic
    throw new Error('Not implemented');
  }
}
`;
}

/**
 * Generate Express validation
 */
function generateExpressValidation(className: string, moduleName: string): string {
  return `import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

const create${className}Schema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().optional(),
  description: Joi.string().max(500).optional(),
  isActive: Joi.boolean().optional(),
});

const update${className}Schema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().optional(),
  description: Joi.string().max(500).optional(),
  isActive: Joi.boolean().optional(),
});

export const validate${className} = (type: 'create' | 'update') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = type === 'create' ? create${className}Schema : update${className}Schema;
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    req.body = value;
    next();
  };
};
`;
}

/**
 * Generate React component module
 */
function generateReactModule(moduleName: string, className: string, result: ScaffoldResult): void {
  result.dependencies.push('react');

  result.files.push({
    path: `src/components/${moduleName}/${moduleName}.tsx`,
    content: generateReactComponent(className, moduleName),
  });

  result.files.push({
    path: `src/components/${moduleName}/${moduleName}.test.tsx`,
    content: generateReactTest(className, moduleName),
  });

  result.files.push({
    path: `src/components/${moduleName}/${moduleName}.types.ts`,
    content: generateReactTypes(className, moduleName),
  });

  result.files.push({
    path: `src/components/${moduleName}/index.ts`,
    content: `export { ${className} } from './${moduleName}';\nexport type { ${className}Props } from './${moduleName}.types';\n`,
  });
}

/**
 * Generate React component
 */
function generateReactComponent(className: string, moduleName: string): string {
  return `import React from 'react';
import { ${className}Props } from './${moduleName}.types';
import './${moduleName}.css';

export const ${className}: React.FC<${className}Props> = ({
  title,
  variant = 'default',
  className = '',
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={\`${className} ${className}--\${variant} \${className}\`}
      onClick={handleClick}
    >
      <h2>{title}</h2>
    </div>
  );
};

export default ${className};
`;
}

/**
 * Generate React types
 */
function generateReactTypes(className: string, moduleName: string): string {
  return `export interface ${className}Props {
  /**
   * Title text for the component
   */
  title: string;

  /**
   * Visual variant
   */
  variant?: 'default' | 'primary' | 'secondary';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Click handler
   */
  onClick?: () => void;
}
`;
}

/**
 * Generate React test
 */
function generateReactTest(className: string, moduleName: string): string {
  return `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ${className} } from './${moduleName}';

describe('${className}', () => {
  const defaultProps = {
    title: 'Test ${className}',
  };

  it('renders correctly', () => {
    render(<${className} {...defaultProps} />);
    expect(screen.getByText('Test ${className}')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<${className} {...defaultProps} onClick={handleClick} />);

    const component = screen.getByText('Test ${className}');
    fireEvent.click(component);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <${className} {...defaultProps} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
`;
}

/**
 * Generate service scaffold
 */
function generateServiceScaffold(config: ScaffoldConfig, result: ScaffoldResult): void {
  const serviceName = toKebabCase(config.name);
  const className = toPascalCase(config.name);
  const cc = toCamelCase(className);

  result.files.push({
    path: `src/services/${serviceName}.ts`,
    content: `// ${className} Service
// Business logic for ${config.name}

export class ${className}Service {
  constructor() {
    // Initialize dependencies
  }

  async execute(input: any): Promise<any> {
    // Implement service logic
    throw new Error('Not implemented');
  }
}

export const ${cc}Service = new ${className}Service();
`,
  });
}

/**
 * Generate controller scaffold
 */
function generateControllerScaffold(config: ScaffoldConfig, result: ScaffoldResult): void {
  // Already handled in module generation
}

/**
 * Generate middleware scaffold
 */
function generateMiddlewareScaffold(config: ScaffoldConfig, result: ScaffoldResult): void {
  const middlewareName = toKebabCase(config.name);
  const className = toPascalCase(config.name);
  const cc = toCamelCase(className);

  if (config.framework === 'express' || config.framework === 'nestjs') {
    result.files.push({
      path: `src/middleware/${middlewareName}.middleware.ts`,
      content: `import { Request, Response, NextFunction } from 'express';

export function ${cc}Middleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Implement middleware logic
  try {
    // Add your middleware logic here
    next();
  } catch (error) {
    next(error);
  }
}
`,
    });
  }
}

/**
 * Generate entity scaffold
 */
function generateEntityScaffold(config: ScaffoldConfig, result: ScaffoldResult): void {
  const entityName = toKebabCase(config.name);
  const className = toPascalCase(config.name);

  result.files.push({
    path: `src/entities/${entityName}.entity.ts`,
    content: `export interface ${className} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  // Add more fields
}

export class ${className}Entity implements ${className} {
  id: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<${className}>) {
    Object.assign(this, data);
  }
}
`,
  });
}

/**
 * Generate repository scaffold
 */
function generateRepositoryScaffold(config: ScaffoldConfig, result: ScaffoldResult): void {
  const repoName = toKebabCase(config.name);
  const className = toPascalCase(config.name);

  result.files.push({
    path: `src/repositories/${repoName}.repository.ts`,
    content: `export interface ${className}Repository {
  findById(id: string): Promise<any>;
  findAll(): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
}

export class ${className}RepositoryImpl implements ${className}Repository {
  async findById(id: string): Promise<any> {
    // Implement find logic
    throw new Error('Not implemented');
  }

  async findAll(): Promise<any[]> {
    // Implement find all logic
    throw new Error('Not implemented');
  }

  async create(data: any): Promise<any> {
    // Implement create logic
    throw new Error('Not implemented');
  }

  async update(id: string, data: any): Promise<any> {
    // Implement update logic
    throw new Error('Not implemented');
  }

  async delete(id: string): Promise<void> {
    // Implement delete logic
    throw new Error('Not implemented');
  }
}
`,
  });
}

/**
 * Generate generic module
 */
function generateGenericModule(
  moduleName: string,
  className: string,
  config: ScaffoldConfig,
  result: ScaffoldResult
): void {
  result.files.push({
    path: `src/modules/${moduleName}/${moduleName}.ts`,
    content: `// ${className} Module for ${config.framework}
// Generated by re-shell scaffolding

export class ${className} {
  constructor() {
    // Initialize
  }

  // Add methods
}
`,
  });
}

/**
 * Apply best practices to generated files
 */
function applyBestPractices(config: ScaffoldConfig, result: ScaffoldResult): void {
  const rules = BEST_PRACTICES[config.framework] || [];

  for (const rule of rules) {
    if (rule.check && rule.fix) {
      result.files.forEach(file => {
        if (!rule.check!(file.content)) {
          file.content = rule.fix!(file.content);
        }
      });
    }
  }
}

/**
 * Helper: Convert to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\s/g, '');
}

/**
 * Helper: Convert to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Helper: Convert to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
