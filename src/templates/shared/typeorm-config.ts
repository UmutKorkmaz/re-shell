// Shared TypeORM configuration for all Node.js backend templates
// This provides comprehensive database integration with migrations and entity management

export interface TypeORMConfig {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: Record<string, string>;
  scripts: Record<string, string>;
  postInstallCommands: string[];
}

export const getTypeORMConfig = (): TypeORMConfig => ({
  dependencies: {
    'typeorm': '^0.3.19',
    'reflect-metadata': '^0.2.1',
    'class-validator': '^0.14.1',
    'class-transformer': '^0.5.1',
    'bcrypt': '^5.1.1',
    'uuid': '^9.0.1',
    // Database drivers (users can choose which to include)
    'pg': '^8.11.3',          // PostgreSQL
    'mysql2': '^3.9.1',       // MySQL
    'sqlite3': '^5.1.7'       // SQLite
  },
  devDependencies: {
    '@types/bcrypt': '^5.0.2',
    '@types/uuid': '^9.0.7',
    '@types/pg': '^8.11.2',
    'ts-node': '^10.9.2'
  },
  scripts: {
    'db:generate': 'typeorm-ts-node-commonjs migration:generate -d src/config/database.ts',
    'db:migrate': 'typeorm-ts-node-commonjs migration:run -d src/config/database.ts',
    'db:migrate:revert': 'typeorm-ts-node-commonjs migration:revert -d src/config/database.ts',
    'db:schema:sync': 'typeorm-ts-node-commonjs schema:sync -d src/config/database.ts',
    'db:schema:drop': 'typeorm-ts-node-commonjs schema:drop -d src/config/database.ts',
    'db:seed': 'tsx src/database/seeds/index.ts',
    'entity:create': 'typeorm-ts-node-commonjs entity:create'
  },
  files: {
    'src/config/database.ts': `import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Profile } from '../entities/Profile';
import { Post } from '../entities/Post';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: (process.env.DB_TYPE as any) || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'mydb',
  
  // Development settings
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  
  // Entity configuration
  entities: [User, Profile, Post],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/database/subscribers/*.ts'],
  
  // Additional options
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
  },
});

// Database health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    await AppDataSource.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closeDatabaseConnection = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
};`,
    'src/entities/User.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Profile } from './Profile';
import { Post } from './Post';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @IsEmail()
  email: string;

  @Column()
  @IsNotEmpty()
  name: string;

  @Column()
  @MinLength(6)
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToOne(() => Profile, (profile) => profile.user, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  profile: Profile;

  @OneToMany(() => Post, (post) => post.author, {
    cascade: true,
  })
  posts: Post[];

  // Virtual properties
  get isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  get isModerator(): boolean {
    return this.role === UserRole.MODERATOR;
  }
}`,
    'src/entities/Profile.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IsOptional, IsUrl, IsPhoneNumber } from 'class-validator';
import { User } from './User';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @IsOptional()
  bio: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsUrl()
  avatar: string;

  @Column({ nullable: true })
  @IsOptional()
  @IsUrl()
  website: string;

  @Column({ nullable: true })
  @IsOptional()
  location: string;

  @Column({ type: 'date', nullable: true })
  @IsOptional()
  birthday: Date;

  @Column({ nullable: true })
  @IsOptional()
  @IsPhoneNumber()
  phone: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToOne(() => User, (user) => user.profile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;
}`,
    'src/entities/Post.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { User } from './User';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('posts')
@Index(['slug'], { unique: true })
@Index(['status', 'createdAt'])
@Index(['authorId', 'status'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @Column({ nullable: true })
  featuredImage: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  likeCount: number;

  @Column({ nullable: true })
  publishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: 'CASCADE',
  })
  author: User;

  @Column()
  authorId: string;

  // Hooks
  @BeforeInsert()
  @BeforeUpdate()
  generateSlug() {
    if (this.title && !this.slug) {
      this.slug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  generateExcerpt() {
    if (this.content && !this.excerpt) {
      this.excerpt = this.content.substring(0, 200).trim() + '...';
    }
  }

  @BeforeUpdate()
  updatePublishedAt() {
    if (this.status === PostStatus.PUBLISHED && !this.publishedAt) {
      this.publishedAt = new Date();
    }
  }

  // Virtual properties
  get isPublished(): boolean {
    return this.status === PostStatus.PUBLISHED;
  }

  get isDraft(): boolean {
    return this.status === PostStatus.DRAFT;
  }

  get isArchived(): boolean {
    return this.status === PostStatus.ARCHIVED;
  }
}`,
    'src/database/seeds/index.ts': `import 'reflect-metadata';
import { AppDataSource } from '../../config/database';
import { User, UserRole } from '../../entities/User';
import { Profile } from '../../entities/Profile';
import { Post, PostStatus } from '../../entities/Post';
import * as bcrypt from 'bcrypt';

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Initialize database connection
    await AppDataSource.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const profileRepository = AppDataSource.getRepository(Profile);
    const postRepository = AppDataSource.getRepository(Post);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    let adminUser = await userRepository.findOne({ where: { email: 'admin@example.com' } });
    
    if (!adminUser) {
      adminUser = userRepository.create({
        email: 'admin@example.com',
        name: 'Admin User',
        password: adminPassword,
        role: UserRole.ADMIN,
        isActive: true,
        lastLoginAt: new Date(),
      });
      await userRepository.save(adminUser);

      // Create admin profile
      const adminProfile = profileRepository.create({
        bio: 'System administrator with full access privileges',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        website: 'https://admin.example.com',
        location: 'System',
        isVerified: true,
        isPublic: true,
        userId: adminUser.id,
      });
      await profileRepository.save(adminProfile);

      console.log('✅ Created admin user:', { id: adminUser.id, email: adminUser.email });
    }

    // Create regular user
    const userPassword = await bcrypt.hash('user123', 12);
    let regularUser = await userRepository.findOne({ where: { email: 'user@example.com' } });
    
    if (!regularUser) {
      regularUser = userRepository.create({
        email: 'user@example.com',
        name: 'Regular User',
        password: userPassword,
        role: UserRole.USER,
        isActive: true,
      });
      await userRepository.save(regularUser);

      // Create user profile
      const userProfile = profileRepository.create({
        bio: 'Regular user for testing and demonstrations',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
        location: 'Testing Environment',
        isVerified: false,
        isPublic: true,
        userId: regularUser.id,
      });
      await profileRepository.save(userProfile);

      console.log('✅ Created regular user:', { id: regularUser.id, email: regularUser.email });
    }

    // Create moderator user
    const moderatorPassword = await bcrypt.hash('moderator123', 12);
    let moderatorUser = await userRepository.findOne({ where: { email: 'moderator@example.com' } });
    
    if (!moderatorUser) {
      moderatorUser = userRepository.create({
        email: 'moderator@example.com',
        name: 'Moderator User',
        password: moderatorPassword,
        role: UserRole.MODERATOR,
        isActive: true,
      });
      await userRepository.save(moderatorUser);

      // Create moderator profile
      const moderatorProfile = profileRepository.create({
        bio: 'Content moderator with review privileges',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=moderator',
        location: 'Moderation Center',
        isVerified: true,
        isPublic: true,
        userId: moderatorUser.id,
      });
      await profileRepository.save(moderatorProfile);

      console.log('✅ Created moderator user:', { id: moderatorUser.id, email: moderatorUser.email });
    }

    // Create sample posts
    const samplePosts = [
      {
        title: 'Getting Started with TypeORM',
        content: 'TypeORM is a powerful Object-Relational Mapping library that provides type safety and excellent developer experience. In this post, we will explore the basics of setting up TypeORM with a Node.js application.',
        status: PostStatus.PUBLISHED,
        tags: ['typeorm', 'nodejs', 'typescript', 'database'],
        authorId: regularUser.id,
      },
      {
        title: 'Advanced Entity Relationships',
        content: 'Understanding entity relationships is crucial for building robust database schemas. This post covers one-to-one, one-to-many, and many-to-many relationships in TypeORM.',
        status: PostStatus.PUBLISHED,
        tags: ['typeorm', 'relationships', 'entities'],
        authorId: regularUser.id,
      },
      {
        title: 'Database Migrations Best Practices',
        content: 'Managing database schema changes in production requires careful planning and execution. Learn about migration strategies and best practices.',
        status: PostStatus.DRAFT,
        tags: ['migrations', 'database', 'production'],
        authorId: adminUser.id,
      },
      {
        title: 'Query Optimization Techniques',
        content: 'Optimizing database queries is essential for application performance. This comprehensive guide covers indexing, query analysis, and optimization strategies.',
        status: PostStatus.PUBLISHED,
        tags: ['optimization', 'performance', 'queries'],
        authorId: moderatorUser.id,
      },
      {
        title: 'Archived Legacy Post',
        content: 'This is an example of an archived post that is no longer active but preserved for historical purposes.',
        status: PostStatus.ARCHIVED,
        tags: ['archived', 'legacy'],
        authorId: adminUser.id,
      },
    ];

    for (const postData of samplePosts) {
      const existingPost = await postRepository.findOne({ where: { title: postData.title } });
      if (!existingPost) {
        const post = postRepository.create(postData);
        await postRepository.save(post);
      }
    }

    const postCount = await postRepository.count();
    console.log(\`✅ Created sample posts: \${postCount} posts total\`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📋 Test Credentials:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  User: user@example.com / user123');
    console.log('  Moderator: moderator@example.com / moderator123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run seeding
seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});`,
    'src/services/userService.ts': `import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { Profile } from '../entities/Profile';
import * as bcrypt from 'bcrypt';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  location?: string;
  phone?: string;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export class UserService {
  private userRepository: Repository<User>;
  private profileRepository: Repository<Profile>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.profileRepository = AppDataSource.getRepository(Profile);
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['profile', 'posts'],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password
      },
    });
  }

  async findByEmail(email: string, includePassword = false): Promise<User | null> {
    const select: any = {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    };

    if (includePassword) {
      select.password = true;
    }

    return await this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
      select,
    });
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    // Create user
    const user = this.userRepository.create({
      ...userData,
      password: hashedPassword,
      role: userData.role || UserRole.USER,
    });
    
    const savedUser = await this.userRepository.save(user);

    // Create default profile
    const profile = this.profileRepository.create({
      bio: \`Welcome \${userData.name}!\`,
      avatar: \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${savedUser.id}\`,
      isVerified: false,
      isPublic: true,
      userId: savedUser.id,
    });
    
    await this.profileRepository.save(profile);

    // Return user with profile
    return await this.findById(savedUser.id)!;
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Separate user and profile updates
    const { bio, avatar, website, location, phone, ...userUpdates } = updates;
    
    // Update user fields
    if (Object.keys(userUpdates).length > 0) {
      await this.userRepository.update(id, userUpdates);
    }

    // Update profile fields
    const profileUpdates = { bio, avatar, website, location, phone };
    const hasProfileUpdates = Object.values(profileUpdates).some(value => value !== undefined);
    
    if (hasProfileUpdates) {
      await this.profileRepository.update(
        { userId: id },
        Object.fromEntries(
          Object.entries(profileUpdates).filter(([_, value]) => value !== undefined)
        )
      );
    }

    // Return updated user
    return await this.findById(id)!;
  }

  async deleteUser(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new Error('User not found');
    }
  }

  async getUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: UserRole
  ): Promise<PaginatedUsers> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .select([
        'user.id',
        'user.email', 
        'user.name',
        'user.role',
        'user.isActive',
        'user.lastLoginAt',
        'user.createdAt',
        'user.updatedAt',
        'profile.bio',
        'profile.avatar',
        'profile.isVerified',
      ]);

    if (search) {
      query.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR profile.bio ILIKE :search)',
        { search: \`%\${search}%\` }
      );
    }

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    query.orderBy('user.createdAt', 'DESC');

    const [users, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const pages = Math.ceil(total / limit);

    return {
      users,
      total,
      page,
      limit,
      pages,
    };
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email, true);
    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    
    // Return user without password
    return await this.findById(user.id);
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    moderatorUsers: number;
    recentUsers: number;
  }> {
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      moderatorUsers,
      recentUsers,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
      this.userRepository.count({ where: { role: UserRole.MODERATOR } }),
      this.userRepository
        .createQueryBuilder('user')
        .where('user.createdAt >= :date', { 
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
        })
        .getCount(),
    ]);

    return {
      totalUsers,
      activeUsers,
      adminUsers,
      moderatorUsers,
      recentUsers,
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isActive: false });
  }

  async activateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isActive: true });
  }
}`,
    '.env.example': `# Database Configuration
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=mydb

# Alternative database configurations (uncomment as needed)
# MySQL
# DB_TYPE=mysql
# DB_PORT=3306

# SQLite (for development)
# DB_TYPE=sqlite
# DB_DATABASE=./database.sqlite

# Application Configuration
NODE_ENV=development
PORT=3000

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h

# Other environment variables...`
  },
  postInstallCommands: [
    'echo "📋 TypeORM Setup Instructions:"',
    'echo "1. Configure your database in .env"',
    'echo "2. Run: npm run db:migrate (to create tables)"',
    'echo "3. Run: npm run db:seed (to add sample data)"',
    'echo "4. Optional: npm run entity:create <EntityName> (to create new entities)"',
    'echo ""',
    'echo "💡 Database Management:"',
    'echo "- npm run db:generate <MigrationName> (create migration)"',
    'echo "- npm run db:migrate (run migrations)"',
    'echo "- npm run db:migrate:revert (revert last migration)"',
    'echo "- npm run db:schema:sync (sync schema - development only)"'
  ]
});

export const getTypeORMHealthCheck = (): string => `
  async checkDatabase(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await AppDataSource.query('SELECT 1');
      const latency = Date.now() - start;
      
      return { status: 'ok', latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'error' };
    }
  }
`;

export const getTypeORMDockerCompose = (): string => `
  # Add this to your docker-compose.yml for PostgreSQL
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${DB_USERNAME:-postgres}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-password}
      POSTGRES_DB: \${DB_DATABASE:-mydb}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USERNAME:-postgres} -d \${DB_DATABASE:-mydb}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres_data:
`;

export const getTypeORMReadmeSection = (): string => `
## Database Integration (TypeORM)

This template includes comprehensive **TypeORM** integration for enterprise-grade database operations.

### Quick Start

1. **Configure Database**:
   \`\`\`bash
   # Copy environment file
   cp .env.example .env
   
   # Edit database settings in .env
   DB_TYPE=postgres
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=password
   DB_DATABASE=mydb
   \`\`\`

2. **Initialize Database**:
   \`\`\`bash
   # Run migrations to create tables
   npm run db:migrate
   
   # Seed database with sample data
   npm run db:seed
   \`\`\`

### Database Commands

- \`npm run db:migrate\` - Run pending migrations
- \`npm run db:migrate:revert\` - Revert last migration
- \`npm run db:generate <name>\` - Generate new migration
- \`npm run db:schema:sync\` - Sync schema (development only)
- \`npm run db:schema:drop\` - Drop all tables
- \`npm run db:seed\` - Seed database with sample data
- \`npm run entity:create <name>\` - Create new entity

### Entity Schema

The application includes these entities:
- **User**: Authentication and user management with roles
- **Profile**: Extended user information and preferences  
- **Post**: Content management with status workflow

### Features

- **🔐 Role-Based Access**: USER, ADMIN, MODERATOR roles
- **✅ Validation**: Class-validator decorators for data integrity
- **🔄 Migrations**: Version-controlled schema changes
- **🌱 Seeding**: Sample data for development and testing
- **🏃 Performance**: Optimized queries with proper indexing
- **🛡️ Security**: Prepared statements and SQL injection prevention

### Supported Databases

- **PostgreSQL** (recommended for production)
- **MySQL/MariaDB**
- **SQLite** (development/testing)
- **Microsoft SQL Server**
- **Oracle** (with additional configuration)

### Entity Relationships

\`\`\`typescript
User (1) ←→ (1) Profile
User (1) ←→ (∞) Post
\`\`\`

### Migration Workflow

1. Modify entities in \`src/entities/\`
2. Generate migration: \`npm run db:generate AddNewFeature\`
3. Review generated migration in \`src/database/migrations/\`
4. Apply migration: \`npm run db:migrate\`

### Production Deployment

1. Set production database credentials in environment
2. Run migrations: \`npm run db:migrate\`
3. Optional: Seed initial data: \`npm run db:seed\`
4. Never use \`db:schema:sync\` in production
`;

export const getTypeORMServerIntegration = (): string => `
// Add this to your main server file
import 'reflect-metadata';
import { AppDataSource } from './config/database';

async function startServer() {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('✅ Database connection established');
    
    // Start your server here
    // ...
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await AppDataSource.destroy();
  process.exit(0);
});

startServer();
`;