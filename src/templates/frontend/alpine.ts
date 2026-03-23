import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class AlpineTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Vite config
    files.push({
      path: 'vite.config.js',
      content: this.generateViteConfig()
    });

    // Index HTML
    files.push({
      path: 'index.html',
      content: this.generateIndexHtml()
    });

    // CSS
    files.push({
      path: 'src/styles.css',
      content: this.generateStyles()
    });

    // JavaScript
    files.push({
      path: 'src/app.js',
      content: this.generateApp()
    });

    // HTMX integration
    files.push({
      path: 'src/htmx.js',
      content: this.generateHtmx()
    });

    // Components
    files.push({
      path: 'src/components/counter.js',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/modal.js',
      content: this.generateModal()
    });

    files.push({
      path: 'src/components/dropdown.js',
      content: this.generateDropdown()
    });

    files.push({
      path: 'src/components/tabs.js',
      content: this.generateTabs()
    });

    // HTML pages
    files.push({
      path: 'src/pages/home.html',
      content: this.generateHomePage()
    });

    files.push({
      path: 'src/pages/about.html',
      content: this.generateAboutPage()
    });

    // Utils
    files.push({
      path: 'src/utils/api.js',
      content: this.generateApiUtils()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // .gitignore
    files.push({
      path: '.gitignore',
      content: this.generateGitignore()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.0.1',
      description: `${this.context.name} - Alpine.js with HTMX`,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        test: 'echo "No tests configured" && exit 0'
      },
      dependencies: {
        'alpinejs': '^3.13.5',
        'htmx.org': '^1.9.10',
        '@alpinejs/focus': '^3.13.5',
        '@alpinejs/intersect': '^3.13.5',
        '@alpinejs/persist': '^3.13.5',
        '@alpinejs/mask': '^3.13.5'
      },
      devDependencies: {
        'vite': '^5.0.12'
      }
    };
  }

  protected generateViteConfig() {
    return `import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './src/index.html',
        home: './src/pages/home.html',
        about: './src/pages/about.html',
      },
    },
  },
  server: {
    port: ${this.context.port || 5173},
    open: true,
  },
});
`;
  }

  private generateIndexHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.context.name}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app" x-data="app()">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="container">
        <div class="nav-brand">
          <h1>${this.context.name}</h1>
          <span class="badge">Alpine.js + HTMX</span>
        </div>
        <ul class="nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/pages/home.html">Examples</a></li>
          <li><a href="/pages/about.html">About</a></li>
        </ul>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <h2 x-text="greeting"></h2>
        <p>Progressive enhancement with Alpine.js and HTMX</p>
        <div class="hero-actions">
          <button @click="showModal = true" class="btn btn-primary">
            Get Started
          </button>
          <a href="/pages/home.html" class="btn btn-secondary">
            View Examples
          </a>
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features">
      <div class="container">
        <h3>Why Alpine.js + HTMX?</h3>
        <div class="grid">
          <div class="card">
            <div class="card-icon">🪶</div>
            <h4>Lightweight</h4>
            <p>Alpine.js is only 15KB gzipped. HTMX adds interactivity without complex JavaScript.</p>
          </div>
          <div class="card">
            <div class="card-icon">⚡</div>
            <h4>Progressive</h4>
            <p>Enhance your markup with behavior. No build step required for basic usage.</p>
          </div>
          <div class="card">
            <div class="card-icon">🎯</div>
            <h4>Simple</h4>
            <p>Write less JavaScript. Focus on HTML attributes and declarative syntax.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Counter Demo -->
    <section class="demo">
      <div class="container">
        <h3>Interactive Counter</h3>
        <div x-data="counter()" class="counter-component">
          <button @click="decrement()" class="btn btn-secondary">−</button>
          <span class="count" x-text="count"></span>
          <button @click="increment()" class="btn btn-secondary">+</button>
        </div>
      </div>
    </section>

    <!-- Modal -->
    <div x-show="showModal" class="modal" x-transition.opacity>
      <div class="modal-content" x-transition:enter="transition ease-out duration-300"
           x-transition:enter-start="opacity-0 scale-90"
           x-transition:enter-end="opacity-100 scale-100"
           x-transition:leave="transition ease-in duration-200"
           x-transition:leave-start="opacity-100 scale-100"
           x-transition:leave-end="opacity-0 scale-90">
        <span @click="showModal = false" class="modal-close">&times;</span>
        <h2>Welcome to ${this.context.name}!</h2>
        <p>This is a modal built with Alpine.js transitions.</p>
        <p>Try the navigation links to see more examples.</p>
        <button @click="showModal = false" class="btn btn-primary">Close</button>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="container">
        <p>&copy; <span x-text="new Date().getFullYear()"></span> ${this.context.name}. Built with Alpine.js and HTMX.</p>
      </div>
    </footer>
  </div>

  <script type="module" src="/app.js"></script>
</body>
</html>
`;
  }

  private generateStyles() {
    return `/**
 * Global Styles
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #77c4d3;
  --secondary: #3b82f6;
  --accent: #8b5cf6;
  --dark: #1f2937;
  --light: #f9fafb;
  --gray: #6b7280;
  --success: #10b981;
  --danger: #ef4444;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--dark);
  background: var(--light);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Navigation */
.navbar {
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand h1 {
  font-size: 1.5rem;
  color: var(--primary);
}

.nav-brand .badge {
  background: var(--accent);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.nav-links {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.nav-links a {
  color: var(--dark);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--primary);
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
  padding: 6rem 0;
  text-align: center;
}

.hero h2 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-primary {
  background: white;
  color: var(--primary);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Features Section */
.features {
  padding: 4rem 0;
}

.features h3 {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 3rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.card h4 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--primary);
}

.card p {
  color: var(--gray);
}

/* Demo Section */
.demo {
  background: white;
  padding: 4rem 0;
}

.demo h3 {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 2rem;
}

.counter-component {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.count {
  font-size: 2rem;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--gray);
}

.modal-close:hover {
  color: var(--dark);
}

/* Footer */
.footer {
  background: var(--dark);
  color: white;
  text-align: center;
  padding: 2rem 0;
  margin-top: 4rem;
}

/* Responsive */
@media (max-width: 768px) {
  .nav-links {
    flex-direction: column;
    gap: 0.5rem;
  }

  .hero h2 {
    font-size: 2rem;
  }

  .hero-actions {
    flex-direction: column;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}

/* HTMX Extensions */
[htmx-request] {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.htmx-indicator {
  display: none;
}

.htmx-request .htmx-indicator {
  display: inline;
}
`;
  }

  private generateApp() {
    return `import Alpine from 'alpinejs';
import focus from '@alpinejs/focus';
import persist from '@alpinejs/persist';
import { counter } from './components/counter.js';
import { modal } from './components/modal.js';
import { dropdown } from './components/dropdown.js';
import { tabs } from './components/tabs.js';

// Register Alpine plugins
Alpine.plugin(focus);
Alpine.plugin(persist);

// Register components
Alpine.data('app', () => ({
  greeting: 'Welcome to Alpine.js!',
  showModal: false,
}));

Alpine.data('counter', counter);
Alpine.data('modal', modal);
Alpine.data('dropdown', dropdown);
Alpine.data('tabs', tabs);

// Start Alpine
Alpine.start();
`;
  }

  private generateHtmx() {
    return `/**
 * HTMX Configuration and Extensions
 */

// Initialize HTMX with custom configuration
document.body.addEventListener('htmx:config', function(evt) {
  // Configure HTMX behavior
  evt.detail.useTemplateFragments = true;
});

// HTMX event listeners
document.body.addEventListener('htmx:beforeRequest', function(evt) {
  console.log('HTMX request starting:', evt.detail);
});

document.body.addEventListener('htmx:afterRequest', function(evt) {
  console.log('HTMX request complete:', evt.detail);
});

document.body.addEventListener('htmx:responseError', function(evt) {
  console.error('HTMX request error:', evt.detail);
});

// HTMX loading indicator
document.body.addEventListener('htmx:beforeRequest', function(evt) {
  document.body.classList.add('htmx-request');
});

document.body.addEventListener('htmx:afterRequest', function(evt) {
  document.body.classList.remove('htmx-request');
});
`;
  }

  private generateCounter() {
    return `/**
 * Counter Component
 * @returns {Object} Counter data and methods
 */
export function counter() {
  return {
    count: 0,
    min: 0,
    max: 100,

    increment() {
      if (this.count < this.max) {
        this.count++;
      }
    },

    decrement() {
      if (this.count > this.min) {
        this.count--;
      }
    },

    reset() {
      this.count = 0;
    },

    get isAtMin() {
      return this.count <= this.min;
    },

    get isAtMax() {
      return this.count >= this.max;
    },
  };
}
`;
  }

  private generateModal() {
    return `/**
 * Modal Component
 * @param {string} id - Modal ID
 * @returns {Object} Modal data and methods
 */
export function modal(id = 'modal') {
  return {
    id,
    isOpen: false,
    title: '',
    content: '',

    open(title, content) {
      this.title = title;
      this.content = content;
      this.isOpen = true;
    },

    close() {
      this.isOpen = false;
    },

    toggle() {
      this.isOpen = !this.isOpen;
    },
  };
}
`;
  }

  private generateDropdown() {
    return `/**
 * Dropdown Component
 * @returns {Object} Dropdown data and methods
 */
export function dropdown() {
  return {
    isOpen: false,
    selectedOption: null,
    options: [
      { id: 1, label: 'Option 1' },
      { id: 2, label: 'Option 2' },
      { id: 3, label: 'Option 3' },
    ],

    toggle() {
      this.isOpen = !this.isOpen;
    },

    close() {
      this.isOpen = false;
    },

    select(option) {
      this.selectedOption = option;
      this.close();
    },

    get selectedLabel() {
      return this.selectedOption ? this.selectedOption.label : 'Select an option';
    },
  };
}
`;
  }

  private generateTabs() {
    return `/**
 * Tabs Component
 * @returns {Object} Tabs data and methods
 */
export function tabs() {
  return {
    activeTab: 'tab1',
    tabs: [
      { id: 'tab1', label: 'Tab 1', content: 'Content for Tab 1' },
      { id: 'tab2', label: 'Tab 2', content: 'Content for Tab 2' },
      { id: 'tab3', label: 'Tab 3', content: 'Content for Tab 3' },
    ],

    setActiveTab(tabId) {
      this.activeTab = tabId;
    },

    get activeContent() {
      const tab = this.tabs.find(t => t.id === this.activeTab);
      return tab ? tab.content : '';
    },
  };
}
`;
  }

  private generateHomePage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Examples - ${this.context.name}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app" x-data="app()">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="container">
        <div class="nav-brand">
          <h1><a href="/">${this.context.name}</a></h1>
        </div>
        <ul class="nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/pages/home.html">Examples</a></li>
          <li><a href="/pages/about.html">About</a></li>
        </ul>
      </div>
    </nav>

    <div class="container">
      <h1>Alpine.js Examples</h1>

      <!-- Dropdown Example -->
      <section class="demo-section">
        <h2>Dropdown</h2>
        <div x-data="dropdown()" class="dropdown">
          <button @click="toggle()" class="btn btn-secondary" x-text="selectedLabel"></button>
          <ul x-show="isOpen" @click.away="close()" class="dropdown-menu">
            <template x-for="option in options" :key="option.id">
              <li @click="select(option)" x-text="option.label"></li>
            </template>
          </ul>
        </div>
      </section>

      <!-- Tabs Example -->
      <section class="demo-section">
        <h2>Tabs</h2>
        <div x-data="tabs()" class="tabs">
          <div class="tab-buttons">
            <template x-for="tab in tabs" :key="tab.id">
              <button
                @click="setActiveTab(tab.id)"
                :class="{ active: activeTab === tab.id }"
                x-text="tab.label"
              ></button>
            </template>
          </div>
          <div class="tab-content" x-text="activeContent"></div>
        </div>
      </section>

      <!-- Persistent Counter -->
      <section class="demo-section">
        <h2>Persistent Counter</h2>
        <div x-data="{ count: $persist(0) }" class="counter-component">
          <button @click="count--" class="btn btn-secondary">−</button>
          <span class="count" x-text="count"></span>
          <button @click="count++" class="btn btn-secondary">+</button>
          <p class="hint">This counter persists across page reloads!</p>
        </div>
      </section>

      <!-- Search Filter -->
      <section class="demo-section">
        <h2>Search Filter</h2>
        <div x-data="{ search: '', items: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'] }">
          <input
            type="text"
            x-model="search"
            placeholder="Search fruits..."
            class="search-input"
          >
          <ul class="search-results">
            <template x-for="item in items.filter(i => i.toLowerCase().includes(search.toLowerCase()))" :key="item">
              <li x-text="item"></li>
            </template>
          </ul>
        </div>
      </section>
    </div>
  </div>

  <script type="module" src="/app.js"></script>
  <style>
    .demo-section {
      margin: 3rem 0;
      padding: 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .dropdown {
      position: relative;
      display: inline-block;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      list-style: none;
      padding: 0.5rem 0;
      min-width: 200px;
    }

    .dropdown-menu li {
      padding: 0.5rem 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .dropdown-menu li:hover {
      background: var(--light);
    }

    .tabs {
      width: 100%;
    }

    .tab-buttons {
      display: flex;
      gap: 0.5rem;
      border-bottom: 2px solid var(--gray);
      margin-bottom: 1rem;
    }

    .tab-buttons button {
      padding: 0.5rem 1rem;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab-buttons button.active {
      border-bottom: 2px solid var(--primary);
      color: var(--primary);
    }

    .tab-content {
      padding: 1rem;
      background: var(--light);
      border-radius: 8px;
    }

    .hint {
      margin-top: 1rem;
      color: var(--gray);
      font-size: 0.875rem;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--gray);
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .search-results {
      list-style: none;
      padding: 0;
    }

    .search-results li {
      padding: 0.5rem;
      border-bottom: 1px solid var(--light);
    }

    .search-results li:hover {
      background: var(--light);
    }
  </style>
</body>
</html>
`;
  }

  private generateAboutPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - ${this.context.name}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app" x-data="app()">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="container">
        <div class="nav-brand">
          <h1><a href="/">${this.context.name}</a></h1>
        </div>
        <ul class="nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/pages/home.html">Examples</a></li>
          <li><a href="/pages/about.html">About</a></li>
        </ul>
      </div>
    </nav>

    <div class="container">
      <h1>About ${this.context.name}</h1>

      <section class="features">
        <h2>Technologies</h2>
        <div class="grid">
          <div class="card">
            <div class="card-icon">🏔️</div>
            <h4>Alpine.js</h4>
            <p>A rugged, minimal JavaScript framework for adding behavior to your markup.</p>
            <a href="https://alpinejs.dev" target="_blank">Learn More →</a>
          </div>
          <div class="card">
            <div class="card-icon">⚡</div>
            <h4>HTMX</h4>
            <p>High power tools for HTML that allows you to access AJAX, CSS Transitions, and more.</p>
            <a href="https://htmx.org" target="_blank">Learn More →</a>
          </div>
          <div class="card">
            <div class="card-icon">🔧</div>
            <h4>Vite</h4>
            <p>Next generation frontend tooling with hot module replacement and optimized builds.</p>
            <a href="https://vitejs.dev" target="_blank">Learn More →</a>
          </div>
        </div>
      </section>

      <section class="demo-section">
        <h2>Why This Stack?</h2>
        <p>
          This template combines the simplicity of Alpine.js with the power of HTMX to create
          modern, interactive web applications without the complexity of heavy frameworks like
          React or Vue.
        </p>
        <h3>Benefits:</h3>
        <ul>
          <li>🪶 Lightweight - Small bundle sizes</li>
          <li>⚡ Fast - No virtual DOM overhead</li>
          <li>🎯 Simple - Write less JavaScript</li>
          <li>🔧 Progressive - Enhance existing HTML</li>
          <li>📦 Easy - No build step required for basic usage</li>
        </ul>
      </section>

      <section class="demo-section">
        <h2>HTMX Integration</h2>
        <p>
          HTMX allows you to access modern browser features directly from HTML. Use attributes like:
        </p>
        <ul>
          <li><code>hx-get</code> - Make GET requests</li>
          <li><code>hx-post</code> - Make POST requests</li>
          <li><code>hx-swap</code> - Control content swapping</li>
          <li><code>hx-target</code> - Target elements for updates</li>
        </ul>
        <p>
          This template includes HTMX configuration and event listeners for seamless integration.
        </p>
      </section>
    </div>
  </div>

  <script type="module" src="/app.js"></script>
  <style>
    .demo-section {
      margin: 3rem 0;
      padding: 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .demo-section ul {
      margin-top: 1rem;
    }

    .demo-section li {
      margin: 0.5rem 0;
    }

    .demo-section code {
      background: var(--light);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-family: monospace;
    }

    .card a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }

    .card a:hover {
      text-decoration: underline;
    }
  </style>
</body>
</html>
`;
  }

  private generateApiUtils() {
    return `/**
 * API Utility Functions
 */

/**
 * Make a GET request
 * @param {string} url - The URL to fetch
 * @returns {Promise} The response data
 */
export async function get(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  return response.json();
}

/**
 * Make a POST request
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @returns {Promise} The response data
 */
export async function post(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  return response.json();
}

/**
 * Make a PUT request
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @returns {Promise} The response data
 */
export async function put(url, data) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  return response.json();
}

/**
 * Make a DELETE request
 * @param {string} url - The URL to fetch
 * @returns {Promise} The response data
 */
export async function del(url) {
  const response = await fetch(url, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  return response.json();
}
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

An Alpine.js + HTMX application built with Vite for modern, lightweight web development.

## Overview

This template combines Alpine.js for reactive behavior and HTMX for dynamic content updates, providing a progressive enhancement approach to building modern web applications without the complexity of heavy frameworks.

## Features

- 🪶 **Lightweight** - Alpine.js is only 15KB gzipped
- ⚡ **Fast** - No virtual DOM overhead
- 🎯 **Simple** - Declarative syntax in HTML
- 🔧 **Progressive** - Enhance existing markup
- 📦 **No Build** - Works without a build step for basic usage
- 🚀 **HTMX** - Dynamic content updates with HTML attributes
- 🔌 **Plugins** - Focus, Persist, Intersect, Mask included

## Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
\`\`\`

## Alpine.js Components

### Counter

A simple counter with increment/decrement functionality.

\`\`\`html
<div x-data="counter()">
  <button @click="decrement()">−</button>
  <span x-text="count"></span>
  <button @click="increment()">+</button>
</div>
\`\`\`

### Modal

A reusable modal component with transitions.

\`\`\`html
<div x-data="modal()">
  <button @click="open('Title', 'Content')">Open Modal</button>

  <div x-show="isOpen" class="modal">
    <div class="modal-content">
      <span @click="close()">&times;</span>
      <h2 x-text="title"></h2>
      <p x-text="content"></p>
    </div>
  </div>
</div>
\`\`\`

### Dropdown

A dropdown menu component.

\`\`\`html
<div x-data="dropdown()">
  <button @click="toggle()" x-text="selectedLabel"></button>
  <ul x-show="isOpen" @click.away="close()">
    <template x-for="option in options">
      <li @click="select(option)" x-text="option.label"></li>
    </template>
  </ul>
</div>
\`\`\`

### Tabs

A tabbed interface component.

\`\`\`html
<div x-data="tabs()">
  <div class="tab-buttons">
    <template x-for="tab in tabs">
      <button @click="setActiveTab(tab.id)" x-text="tab.label"></button>
    </template>
  </div>
  <div x-text="activeContent"></div>
</div>
\`\`\`

## HTMX Integration

HTMX allows you to make AJAX requests directly from HTML:

\`\`\`html
<!-- GET request -->
<button hx-get="/api/data" hx-target="#result">
  Load Data
</button>

<!-- POST request -->
<form hx-post="/api/submit" hx-swap="outerHTML">
  <input type="text" name="value" />
  <button type="submit">Submit</button>
</form>

<!-- With indicators -->
<div hx-get="/api/slow">
  <span class="htmx-indicator">Loading...</span>
</div>
\`\`\`

## Alpine.js Plugins

### Focus
Automatically trap focus inside modals and dropdowns.

### Persist
Persist state across page reloads using localStorage.

\`\`\`html
<div x-data="{ count: $persist(0) }">
  <button @click="count++" x-text="count"></button>
</div>
\`\`\`

### Mask
Format input values (phone numbers, dates, etc.).

## Vite Configuration

The project uses Vite for fast development and optimized production builds:

- Hot Module Replacement (HMR)
- Optimized bundle size
- ES module support
- Multi-page app support

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── components/     # Alpine.js components
│   ├── pages/          # HTML pages
│   ├── app.js          # Main app entry
│   ├── htmx.js         # HTMX configuration
│   ├── styles.css      # Global styles
│   └── index.html      # Entry HTML
├── dist/               # Build output
├── index.html
├── package.json
├── vite.config.js
└── README.md
\`\`\`

## Docker

Build and run with Docker:

\`\`\`bash
# Build image
docker build -t ${this.context.normalizedName} .

# Run container
docker-compose up

# Access at http://localhost:80
\`\`\`

## Examples

Visit the examples page to see:
- Dropdown component
- Tabs component
- Persistent counter
- Search filter
- And more!

## Resources

- [Alpine.js Documentation](https://alpinejs.dev/)
- [HTMX Documentation](https://htmx.org/)
- [Vite Documentation](https://vitejs.dev/)

## License

MIT
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Alpine.js + HTMX

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Install a simple HTTP server
RUN npm install -g serve

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`;
  }

  private generateGitignore() {
    return `# Dependencies
node_modules/

# Build outputs
dist/
build/

# Logs
logs/
*.log
npm-debug.log*

# Editor directories and files
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
`;
  }
}
