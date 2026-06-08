#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const templates = [
  'express-ts',
  'fastify-ts', 
  'nestjs-ts',
  'koa-ts',
  'hapi-ts'
];

// Prisma dependencies to add
const prismaDependencies = {
  '@prisma/client': '^5.8.1',
  'bcrypt': '^5.1.1',
  'uuid': '^9.0.1'
};

const prismaDevDependencies = {
  'prisma': '^5.8.1',
  '@types/bcrypt': '^5.0.2',
  '@types/uuid': '^9.0.7'
};

const prismaScripts = {
  'db:generate': 'prisma generate',
  'db:push': 'prisma db push',
  'db:migrate': 'prisma migrate dev',
  'db:migrate:deploy': 'prisma migrate deploy',
  'db:migrate:reset': 'prisma migrate reset',
  'db:studio': 'prisma studio',
  'db:seed': 'tsx prisma/seed.ts'
};

function updateTemplate(templateName) {
  const templatePath = path.join(__dirname, '../src/templates/backend', `${templateName}.ts`);
  
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template not found: ${templatePath}`);
    return false;
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  
  // Update dependencies section
  Object.entries(prismaDependencies).forEach(([dep, version]) => {
    // Add to dependencies if not already present
    if (!content.includes(`'${dep}'`) && !content.includes(`"${dep}"`)) {
      content = content.replace(
        /(dependencies:\s*{[^}]*)(},)/s,
        `$1    '${dep}': '${version}',\n  $2`
      );
    }
  });

  // Update devDependencies section  
  Object.entries(prismaDevDependencies).forEach(([dep, version]) => {
    if (!content.includes(`'${dep}'`) && !content.includes(`"${dep}"`)) {
      content = content.replace(
        /(devDependencies:\s*{[^}]*)(},)/s,
        `$1    '${dep}': '${version}',\n  $2`
      );
    }
  });

  // Add Prisma scripts to package.json scripts section
  Object.entries(prismaScripts).forEach(([script, command]) => {
    if (!content.includes(`"${script}"`) && !content.includes(`'${script}'`)) {
      // Find the scripts section in the template
      content = content.replace(
        /(scripts:\s*{[^}]*?)(\s*})/s,
        `$1        '${script}': '${command}',\n      $2`
      );
    }
  });

  // Add Prisma schema file
  if (!content.includes('prisma/schema.prisma')) {
    const prismaSchemaContent = `    'prisma/schema.prisma': \`// Prisma schema file
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
}
\`,`;

    // Add to files section
    content = content.replace(
      /(files:\s*{[^}]*?)(\s*},)/s,
      `$1${prismaSchemaContent}\n  $2`
    );
  }

  // Add Prisma seed file
  if (!content.includes('prisma/seed.ts')) {
    const prismaSeedContent = `    'prisma/seed.ts': \`import { PrismaClient } from '@prisma/client';
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
  console.log(\\\`✅ Created \\\${user.posts.length} posts for test user\\\`);
  
  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
\`,`;

    content = content.replace(
      /(files:\s*{[^}]*?)(\s*},)/s,
      `$1${prismaSeedContent}\n  $2`
    );
  }

  // Add Prisma client lib file
  if (!content.includes('src/lib/prisma.ts')) {
    const prismaLibContent = `    'src/lib/prisma.ts': \`import { PrismaClient } from '@prisma/client';

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
});
\`,`;

    content = content.replace(
      /(files:\s*{[^}]*?)(\s*},)/s,
      `$1${prismaLibContent}\n  $2`
    );
  }

  // Add DATABASE_URL to .env.example
  if (content.includes('.env.example') && !content.includes('DATABASE_URL')) {
    content = content.replace(
      /('.env.example':\s*`[^`]*)/,
      `$1

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"

# Prisma Configuration
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"`
    );
  }

  // Add Prisma documentation to README
  if (content.includes('## Features') && !content.includes('**🗄️ Database Integration**')) {
    content = content.replace(
      /(## Features[^#]*)/,
      `$1- **🗄️ Database Integration**: Prisma ORM with PostgreSQL, MySQL, SQLite support
`
    );
  }

  // Add Prisma commands to postInstall
  if (content.includes('postInstall:') && !content.includes('npx prisma generate')) {
    content = content.replace(
      /(postInstall:\s*\[[^\]]*)/,
      `$1    'npx prisma generate',
    'echo "📋 Database setup:"',
    'echo "1. Set DATABASE_URL in .env"',
    'echo "2. Run: npm run db:push"',
    'echo "3. Run: npm run db:seed"',`
    );
  }

  // Write updated content
  fs.writeFileSync(templatePath, content);
  console.log(`✅ Updated ${templateName} template with Prisma integration`);
  return true;
}

// Update all templates
console.log('🚀 Adding Prisma ORM integration to all Node.js templates...\n');

let successCount = 0;
templates.forEach(template => {
  if (updateTemplate(template)) {
    successCount++;
  }
});

console.log(`\n📊 Summary: ${successCount}/${templates.length} templates updated successfully`);
console.log('🎉 Prisma integration completed!');