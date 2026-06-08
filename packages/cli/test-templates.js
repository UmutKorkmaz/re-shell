#!/usr/bin/env node

const { backendTemplates } = require('./dist/templates/backend');

console.log('🧪 Testing Re-Shell CLI Templates\n');

// Group templates by language
const templatesByLanguage = {};
let totalTemplates = 0;
let validTemplates = 0;

for (const [id, template] of Object.entries(backendTemplates)) {
  totalTemplates++;
  
  const language = template.language;
  if (!templatesByLanguage[language]) {
    templatesByLanguage[language] = [];
  }
  
  // Validate template structure
  const errors = [];
  
  if (!template.id) errors.push('Missing id');
  if (!template.name) errors.push('Missing name');
  if (!template.displayName) errors.push('Missing displayName');
  if (!template.description) errors.push('Missing description');
  if (!template.language) errors.push('Missing language');
  if (!template.framework) errors.push('Missing framework');
  if (!template.version) errors.push('Missing version');
  if (!template.tags || !Array.isArray(template.tags)) errors.push('Missing or invalid tags');
  if (!template.files || typeof template.files !== 'object') errors.push('Missing or invalid files');
  if (!template.features || !Array.isArray(template.features)) errors.push('Missing or invalid features');
  
  // Check for essential files based on language
  const essentialFiles = {
    typescript: ['package.json', 'tsconfig.json'],
    javascript: ['package.json'],
    python: ['requirements.txt'],
    rust: ['Cargo.toml'],
    go: ['go.mod'],
    java: ['pom.xml'], // Either pom.xml OR build.gradle is fine
    csharp: ['.csproj'],
    php: ['composer.json'],
    ruby: ['Gemfile'],
    lua: [] // Lua templates vary significantly
  };
  
  const requiredFiles = essentialFiles[language] || [];
  const missingFiles = requiredFiles.filter(file => {
    return !Object.keys(template.files).some(f => f.includes(file));
  });
  
  if (missingFiles.length > 0) {
    errors.push(`Missing essential files: ${missingFiles.join(', ')}`);
  }
  
  const status = errors.length === 0 ? '✅' : '❌';
  if (errors.length === 0) validTemplates++;
  
  templatesByLanguage[language].push({
    id,
    framework: template.framework,
    displayName: template.displayName,
    status,
    errors
  });
}

// Display results
console.log(`📊 Template Summary: ${validTemplates}/${totalTemplates} valid\n`);

// Sort languages alphabetically
const languages = Object.keys(templatesByLanguage).sort();

for (const language of languages) {
  const templates = templatesByLanguage[language];
  console.log(`\n🔤 ${language.toUpperCase()} (${templates.length} templates)`);
  console.log('─'.repeat(50));
  
  for (const template of templates) {
    console.log(`  ${template.status} ${template.displayName} (${template.framework})`);
    if (template.errors.length > 0) {
      for (const error of template.errors) {
        console.log(`     ⚠️  ${error}`);
      }
    }
  }
}

// Summary statistics
console.log('\n📈 Statistics by Language:');
console.log('─'.repeat(50));

for (const language of languages) {
  const templates = templatesByLanguage[language];
  const valid = templates.filter(t => t.status === '✅').length;
  const percentage = ((valid / templates.length) * 100).toFixed(0);
  console.log(`  ${language.padEnd(12)} ${valid}/${templates.length} (${percentage}%)`);
}

// List all available templates
console.log('\n📋 All Available Templates:');
console.log('─'.repeat(50));

const allTemplateIds = Object.keys(backendTemplates).sort();
for (let i = 0; i < allTemplateIds.length; i += 3) {
  const row = allTemplateIds.slice(i, i + 3).map(id => id.padEnd(25)).join('');
  console.log(`  ${row}`);
}

console.log('\n✨ Testing complete!');

// Exit with error if any templates are invalid
if (validTemplates < totalTemplates) {
  process.exit(1);
}