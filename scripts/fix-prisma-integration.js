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

function fixTemplate(templateName) {
  const templatePath = path.join(__dirname, '../src/templates/backend', `${templateName}.ts`);
  
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template not found: ${templatePath}`);
    return false;
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  
  // Fix scripts section - remove improperly formatted scripts and add them correctly
  content = content.replace(
    /(\s*"clean": "rimraf dist"[^}]*?)(\s*"db:generate":[^}]*?})/s,
    '$1,\n    "db:generate": "prisma generate",\n    "db:push": "prisma db push",\n    "db:migrate": "prisma migrate dev",\n    "db:migrate:deploy": "prisma migrate deploy",\n    "db:migrate:reset": "prisma migrate reset",\n    "db:studio": "prisma studio",\n    "db:seed": "tsx prisma/seed.ts"\n  }'
  );

  // Clean up any duplicate or malformed entries
  content = content.replace(/\s*"db:generate":[^,}]*,?\s*"db:push":[^,}]*,?\s*"db:migrate":[^,}]*,?/g, '');
  
  // Write the content back
  fs.writeFileSync(templatePath, content);
  console.log(`✅ Fixed ${templateName} template`);
  return true;
}

console.log('🔧 Fixing Prisma integration in templates...\n');

let successCount = 0;
templates.forEach(template => {
  if (fixTemplate(template)) {
    successCount++;
  }
});

console.log(`\n📊 Summary: ${successCount}/${templates.length} templates fixed`);
console.log('🎉 Prisma integration fixes completed!');