// Shared Prisma ORM configuration for all Node.js backend templates
// This provides consistent database integration across all frameworks

export interface PrismaConfig {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: Record<string, string>;
  scripts: Record<string, string>;
  postInstallCommands: string[];
}

export const getPrismaConfig = (): PrismaConfig => ({
  dependencies: {
    '@prisma/client': '^5.8.1',
    'bcrypt': '^5.1.1',
    'uuid': '^9.0.1'
  },
  devDependencies: {
    'prisma': '^5.8.1',
    '@types/bcrypt': '^5.0.2',
    '@types/uuid': '^9.0.7'
  },
  scripts: {
    'db:generate': 'prisma generate',
    'db:push': 'prisma db push',
    'db:migrate': 'prisma migrate dev',
    'db:migrate:deploy': 'prisma migrate deploy',
    'db:migrate:reset': 'prisma migrate reset',
    'db:studio': 'prisma studio',
    'db:seed': 'tsx prisma/seed.ts'
  },
  files: {
    'prisma/schema.prisma': `// Prisma schema file
// For more information about Prisma schema: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  posts     Post[]
  profile   Profile?

  @@map("users")
}

model Profile {
  id       String  @id @default(cuid())
  bio      String?
  avatar   String?
  userId   String  @unique
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("posts")
}

enum Role {
  USER
  ADMIN
}`,
    'prisma/seed.ts': `import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
      profile: {
        create: {
          bio: 'System administrator',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
        }
      }
    },
    include: {
      profile: true
    }
  });

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Test User',
      password: userPassword,
      role: 'USER',
      profile: {
        create: {
          bio: 'Regular user for testing',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'
        }
      },
      posts: {
        create: [
          {
            title: 'First Post',
            content: 'This is my first post using Prisma!',
            published: true
          },
          {
            title: 'Draft Post',
            content: 'This is a draft post.',
            published: false
          }
        ]
      }
    },
    include: {
      profile: true,
      posts: true
    }
  });

  console.log('✅ Created admin user:', { id: admin.id, email: admin.email });
  console.log('✅ Created test user:', { id: user.id, email: user.email });
  console.log(\`✅ Created \${user.posts.length} posts for test user\`);
  
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });`,
    'src/lib/prisma.ts': `import { PrismaClient } from '@prisma/client';

declare global {
  // Prevent multiple instances during development
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});`,
    'src/services/userService.ts': `import { PrismaClient, User, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: 'USER' | 'ADMIN';
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  bio?: string;
  avatar?: string;
}

export interface PaginatedUsers {
  users: (User & { profile?: any })[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class UserService {
  async findById(id: string): Promise<(User & { profile?: any }) | null> {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        posts: {
          where: { published: true },
          select: {
            id: true,
            title: true,
            createdAt: true
          }
        }
      }
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  async createUser(userData: CreateUserData): Promise<User & { profile?: any }> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    return await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        password: hashedPassword,
        role: userData.role || 'USER',
        profile: {
          create: {
            bio: \`Welcome \${userData.name}!\`,
            avatar: \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${uuidv4()}\`
          }
        }
      },
      include: {
        profile: true
      }
    });
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User & { profile?: any }> {
    const { bio, avatar, ...userUpdates } = updates;
    
    return await prisma.user.update({
      where: { id },
      data: {
        ...userUpdates,
        ...(bio || avatar ? {
          profile: {
            update: {
              ...(bio && { bio }),
              ...(avatar && { avatar })
            }
          }
        } : {})
      },
      include: {
        profile: true
      }
    });
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id }
    });
  }

  async getUsers(
    page: number = 1, 
    limit: number = 10, 
    search?: string
  ): Promise<PaginatedUsers> {
    const skip = (page - 1) * limit;
    
    const where: Prisma.UserWhereInput = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { bio: { contains: search, mode: 'insensitive' } } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
          _count: {
            select: { posts: true }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const pages = Math.ceil(total / limit);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    };
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    recentUsers: number;
  }> {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, adminUsers, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { createdAt: { gte: lastWeek } } })
    ]);

    return {
      totalUsers,
      activeUsers: totalUsers, // Could be enhanced with activity tracking
      adminUsers,
      recentUsers
    };
  }
}`,
    '.env.example': `# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"

# Alternative database providers (uncomment as needed)
# DATABASE_URL="mysql://username:password@localhost:3306/mydb"
# DATABASE_URL="sqlite:./dev.db"
# DATABASE_URL="mongodb://username:password@localhost:27017/mydb"

# Prisma Configuration
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"

# Application Configuration
NODE_ENV=development
PORT=3000

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h

# Other environment variables...`
  },
  postInstallCommands: [
    'npx prisma generate',
    'echo "📋 Don\'t forget to:"',
    'echo "1. Set up your DATABASE_URL in .env"',
    'echo "2. Run: npm run db:push (for development)"',
    'echo "3. Run: npm run db:seed (to seed sample data)"',
    'echo "4. Optional: npm run db:studio (to open Prisma Studio)"'
  ]
});

export const getPrismaHealthCheck = (): string => `
  async checkDatabase(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await prisma.$queryRaw\`SELECT 1\`;
      const latency = Date.now() - start;
      
      return { status: 'ok', latency };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { status: 'error' };
    }
  }
`;

export const getPrismaDockerCompose = (): string => `
  # Add this to your docker-compose.yml for PostgreSQL
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${DB_USER:-myuser}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-mypassword}
      POSTGRES_DB: \${DB_NAME:-mydb}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-myuser} -d \${DB_NAME:-mydb}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres_data:
`;

export const getPrismaReadmeSection = (): string => `
## Database Integration

This template includes comprehensive **Prisma ORM** integration for type-safe database operations.

### Quick Start

1. **Configure Database**:
   \`\`\`bash
   # Copy environment file
   cp .env.example .env
   
   # Edit DATABASE_URL in .env
   DATABASE_URL="postgresql://username:password@localhost:5432/mydb"
   \`\`\`

2. **Initialize Database**:
   \`\`\`bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database (development)
   npm run db:push
   
   # Or run migrations (production)
   npm run db:migrate
   \`\`\`

3. **Seed Sample Data**:
   \`\`\`bash
   npm run db:seed
   \`\`\`

### Database Commands

- \`npm run db:generate\` - Generate Prisma client
- \`npm run db:push\` - Push schema changes (development)
- \`npm run db:migrate\` - Create and run migrations
- \`npm run db:migrate:deploy\` - Deploy migrations (production)
- \`npm run db:migrate:reset\` - Reset database and run all migrations
- \`npm run db:studio\` - Open Prisma Studio (database GUI)
- \`npm run db:seed\` - Seed database with sample data

### Schema

The default schema includes:
- **Users**: Authentication and user management
- **Profiles**: Extended user information
- **Posts**: Sample content model
- **Roles**: RBAC support (USER, ADMIN)

### Supported Databases

- **PostgreSQL** (recommended for production)
- **MySQL** 
- **SQLite** (development/testing)
- **MongoDB** (via Prisma connector)

### Production Deployment

1. Set \`DATABASE_URL\` environment variable
2. Run migrations: \`npm run db:migrate:deploy\`
3. Optional: Seed data: \`npm run db:seed\`

### Prisma Studio

Access the database GUI:
\`\`\`bash
npm run db:studio
# Opens http://localhost:5555
\`\`\`
`;