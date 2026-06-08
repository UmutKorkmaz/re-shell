import { BackendTemplate } from '../types';

/**
 * Cross-Framework Component Sharing Template
 * Complete system for sharing components across React, Vue, Angular, and Svelte
 */
export const crossFrameworkComponentSharingTemplate: BackendTemplate = {
  id: 'cross-framework-component-sharing',
  name: 'Cross-Framework Component Sharing',
  displayName: 'Cross-Framework Component Sharing System',
  description: 'Complete system for building and sharing components across React, Vue, Angular, and Svelte using Web Components and framework adapters',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['web-components', 'cross-framework', 'component-sharing', 'react', 'vue', 'angular', 'svelte'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'lit': '^3.0.0',
    '@lit/react': '^1.0.0',
    'vue': '^3.3.0',
    'rxjs': '^7.8.0',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/node': '^20.5.0',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
    'vite': '^5.0.0',
    '@vitejs/plugin-react': '^4.0.0',
    '@vitejs/plugin-vue': '^4.0.0',
    '@angular-devkit/build-angular': '^17.0.0',
    'rollup-plugin-svelte': '^7.1.0',
    'svelte': '^4.0.0',
  },
  features: ['rest-api', 'documentation'],

  files: {
    'package.json': `{
  "name": "{{name}}-component-sharing",
  "version": "1.0.0",
  "description": "{{name}} - Cross-Framework Component Sharing System",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc && npm run build:components",
    "build:components": "vite build",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "lit": "^3.0.0",
    "@lit/react": "^1.0.0",
    "vue": "^3.3.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "vite": "^5.0.0"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment",
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,

    'vite.config.ts': `import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'components/index.ts'),
      name: 'SharedComponents',
      formats: ['es', 'umd'],
      fileName: (format) => \`shared-components.\${format}.js\`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'vue', 'rxjs', 'lit'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          vue: 'Vue',
          rxjs: 'rxjs',
          lit: 'lit',
        },
      },
    },
  },
});
`,

    'src/index.ts': `// Cross-Framework Component Sharing Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Serve component registry
app.get('/api/components', (req, res) => {
  res.json({
    components: [
      {
        name: 'Button',
        tag: 'shared-button',
        description: 'A reusable button component',
        props: {
          label: { type: 'string', required: true },
          variant: { type: 'enum', values: ['primary', 'secondary', 'tertiary'], default: 'primary' },
          disabled: { type: 'boolean', default: false },
          onClick: { type: 'function' },
        },
        events: ['click'],
        frameworks: ['react', 'vue', 'angular', 'svelte', 'web-component'],
      },
      {
        name: 'Card',
        tag: 'shared-card',
        description: 'A content card component',
        props: {
          title: { type: 'string' },
          content: { type: 'string' },
          elevation: { type: 'number', default: 1 },
        },
        slots: ['header', 'content', 'footer'],
        frameworks: ['react', 'vue', 'angular', 'svelte', 'web-component'],
      },
      {
        name: 'Modal',
        tag: 'shared-modal',
        description: 'A modal dialog component',
        props: {
          open: { type: 'boolean', required: true },
          title: { type: 'string' },
          closable: { type: 'boolean', default: true },
        },
        events: ['open', 'close'],
        slots: ['header', 'body', 'footer'],
        frameworks: ['react', 'vue', 'angular', 'svelte', 'web-component'],
      },
    ],
  });
});

// Serve component bundles
app.use('/dist', express.static('dist'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || {{port}};
app.listen(PORT, () => {
  console.log(\`🚀 Component Sharing Server running on port \${PORT}\`);
  console.log(\`📦 Component registry: /api/components\`);
  console.log(\`📦 Component bundles: /dist\`);
});
`,

    // Web Components (using Lit)
    'components/web-components/Button.ts': `// Button Web Component
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

@customElement('shared-button')
export class SharedButton extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) variant: ButtonVariant = 'primary';
  @property({ type: Boolean }) disabled = false;

  static styles = css\`
    :host {
      display: inline-block;
    }

    .button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .button.primary {
      background-color: #1976d2;
      color: white;
    }

    .button.primary:hover:not(:disabled) {
      background-color: #1565c0;
    }

    .button.secondary {
      background-color: #f5f5f5;
      color: #333;
    }

    .button.secondary:hover:not(:disabled) {
      background-color: #e0e0e0;
    }

    .button.tertiary {
      background-color: transparent;
      color: #1976d2;
      border: 1px solid #1976d2;
    }

    .button.tertiary:hover:not(:disabled) {
      background-color: rgba(25, 118, 210, 0.04);
    }
  \`;

  private handleClick() {
    if (this.disabled) return;

    this.dispatchEvent(
      new CustomEvent('click', {
        detail: { variant: this.variant },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html\`
      <button
        class="button \${this.variant}"
        ?disabled=\${this.disabled}
        @click=\${this.handleClick}
      >
        \${this.label}
      </button>
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'shared-button': SharedButton;
  }
}
`,

    'components/web-components/Card.ts': `// Card Web Component
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('shared-card')
export class SharedCard extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) content = '';
  @property({ type: Number }) elevation = 1;

  static styles = css\`
    :host {
      display: block;
    }

    .card {
      background: white;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 \${var(--elevation, 1)}px 3px rgba(0, 0, 0, 0.12);
    }

    .card-header {
      font-size: 1.25rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .card-content {
      color: #666;
      line-height: 1.6;
    }

    .card-footer {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }
  \`;

  render() {
    return html\`
      <div class="card" style="--elevation: \${this.elevation}">
        <slot name="header">
          \${this.title ? html\`<div class="card-header">\${this.title}</div>\` : ''}
        </slot>

        <div class="card-content">
          <slot name="content">
            \${this.content}
          </slot>
        </div>

        <slot name="footer"></slot>
      </div>
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'shared-card': SharedCard;
  }
}
`,

    'components/web-components/Modal.ts': `// Modal Web Component
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('shared-modal')
export class SharedModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) title = '';
  @property({ type: Boolean }) closable = true;

  static styles = css\`
    :host {
      display: contents;
    }

    .overlay {
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

    .overlay[hidden] {
      display: none;
    }

    .modal {
      background: white;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .modal-header {
      padding: 1rem;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 500;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;
    }

    .modal-body {
      padding: 1rem;
    }

    .modal-footer {
      padding: 1rem;
      border-top: 1px solid #eee;
      text-align: right;
    }
  \`;

  private handleClose() {
    if (this.closable) {
      this.open = false;
      this.dispatchEvent(
        new CustomEvent('close', {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  render() {
    return html\`
      <div class="overlay" ?hidden=\${!this.open} @click=\${(e: Event) => {
        if (e.target === e.currentTarget) this.handleClose();
      }}>
        <div class="modal" @click=\${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <slot name="header">
              <div class="modal-title">\${this.title}</div>
            </slot>
            \${this.closable ? html\`
              <button class="modal-close" @click=\${this.handleClose}>&times;</button>
            \` : ''}
          </div>

          <div class="modal-body">
            <slot></slot>
          </div>

          <slot name="footer">
            <div class="modal-footer">
              <button @click=\${this.handleClose}>Close</button>
            </div>
          </slot>
        </div>
      </div>
    \`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'shared-modal': SharedModal;
  }
}
`,

    // React Wrappers
    'components/react/Button.tsx': `// React Button Wrapper
import React, { createRef } from 'react';
import { createReactComponent } from '@lit/react';
import { SharedButton } from '../web-components/Button';

export const Button = createReactComponent(React, 'shared-button');

// Or as a function component if needed
export interface ButtonProps {
  label?: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  disabled?: boolean;
  onClick?: () => void;
}

export const ButtonFn: React.FC<ButtonProps> = ({ label, variant = 'primary', disabled = false, onClick }) => {
  const ref = createRef<{ element: SharedButton }>();

  React.useEffect(() => {
    const element = ref.current?.element;
    if (element && onClick) {
      element.addEventListener('click', onClick);
      return () => {
        element.removeEventListener('click', onClick);
      };
    }
  }, [onClick]);

  return (
    <shared-button
      ref={ref}
      label={label}
      variant={variant}
      disabled={disabled}
    />
  );
};
`,

    'components/react/Card.tsx': `// React Card Wrapper
import React from 'react';
import { createReactComponent } from '@lit/react';

export const Card = createReactComponent(React, 'shared-card');

export interface CardProps {
  title?: string;
  content?: string;
  elevation?: number;
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const CardFn: React.FC<CardProps> = ({ title, content, elevation = 1, header, children, footer }) => {
  return (
    <shared-card title={title} content={content} elevation={elevation}>
      {header && <slot name="header" slot="header">{header}</slot>}
      {children && <slot name="content" slot="content">{children}</slot>}
      {footer && <slot name="footer" slot="footer">{footer}</slot>}
    </shared-card>
  );
};
`,

    'components/react/Modal.tsx': `// React Modal Wrapper
import React, { useEffect, useRef } from 'react';
import { createReactComponent } from '@lit/react';
import { SharedModal } from '../web-components/Modal';

export const Modal = createReactComponent(React, 'shared-modal');

export interface ModalProps {
  open?: boolean;
  title?: string;
  closable?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const ModalFn: React.FC<ModalProps> = ({ open = false, title, closable = true, onClose, children, footer }) => {
  const ref = useRef<{ element: SharedModal }>(null);

  useEffect(() => {
    const element = ref.current?.element;
    if (element && onClose) {
      element.addEventListener('close', onClose);
      return () => {
        element.removeEventListener('close', onClose);
      };
    }
  }, [onClose]);

  return (
    <shared-modal
      ref={ref}
      open={open}
      title={title}
      closable={closable}
    >
      {children}
      {footer && <slot name="footer" slot="footer">{footer}</slot>}
    </shared-modal>
  );
};
`,

    'components/react/index.ts': `// React Components Export
export { Button, ButtonFn } from './Button';
export { Card, CardFn } from './Card';
export { Modal, ModalFn } from './Modal';
`,

    // Vue Wrappers
    'components/vue/Button.ts': `// Vue Button Wrapper
import { defineComponent, defineCustomElement } from 'vue';
import { SharedButton } from '../web-components/Button';

// Register web component
customElements.define('shared-button', SharedButton);

export const Button = defineComponent({
  name: 'SharedButton',
  props: {
    label: String,
    variant: {
      type: String as () => 'primary' | 'secondary' | 'tertiary',
      default: 'primary',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  setup(props, { emit }) {
    const handleClick = () => {
      emit('click');
    };

    return () => (
      <shared-button
        label={props.label}
        variant={props.variant}
        disabled={props.disabled}
        onClick={handleClick}
      />
    );
  },
});
`,

    'components/vue/Card.ts': `// Vue Card Wrapper
import { defineComponent } from 'vue';
import { SharedCard } from '../web-components/Card';

customElements.define('shared-card', SharedCard);

export const Card = defineComponent({
  name: 'SharedCard',
  props: {
    title: String,
    content: String,
    elevation: {
      type: Number,
      default: 1,
    },
  },
  setup(props, { slots }) {
    return () => (
      <shared-card title={props.title} content={props.content} elevation={props.elevation}>
        {slots.header?.() && <slot name="header" slot="header">{slots.header?.()}</slot>}
        {slots.default?.() && <slot name="content" slot="content">{slots.default?.()}</slot>}
        {slots.footer?.() && <slot name="footer" slot="footer">{slots.footer?.()}</slot>}
      </shared-card>
    );
  },
});
`,

    'components/vue/Modal.ts': `// Vue Modal Wrapper
import { defineComponent, watch } from 'vue';
import { SharedModal } from '../web-components/Modal';

customElements.define('shared-modal', SharedModal);

export const Modal = defineComponent({
  name: 'SharedModal',
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    title: String,
    closable: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['close'],
  setup(props, { emit, slots }) {
    const handleClose = () => {
      emit('close');
    };

    return () => (
      <shared-modal
        open={props.open}
        title={props.title}
        closable={props.closable}
        onClose={handleClose}
      >
        {slots.default?.()}
        {slots.footer?.() && <slot name="footer" slot="footer">{slots.footer?.()}</slot>}
      </shared-modal>
    );
  },
});
`,

    'components/vue/index.ts': `// Vue Components Export
export { Button } from './Button';
export { Card } from './Card';
export { Modal } from './Modal';
`,

    // Angular Wrappers
    'components/angular/button.component.ts': `// Angular Button Wrapper
import { Component, Input, Output, EventEmitter, NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'shared-button-wrapper',
  template: \`
    <shared-button
      [label]="label"
      [variant]="variant"
      [disabled]="disabled"
      (click)="handleClick()"
    ></shared-button>
  \`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ButtonComponent {
  @Input() label = '';
  @Input() variant: 'primary' | 'secondary' | 'tertiary' = 'primary';
  @Input() disabled = false;

  @Output() click = new EventEmitter<void>();

  handleClick() {
    if (!this.disabled) {
      this.click.emit();
    }
  }
}

@NgModule({
  declarations: [ButtonComponent],
  exports: [ButtonComponent],
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ButtonModule {}
`,

    'components/angular/card.component.ts': `// Angular Card Wrapper
import { Component, Input, NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'shared-card-wrapper',
  template: \`
    <shared-card [title]="title" [content]="content" [elevation]="elevation">
      <ng-content select="[slot=header]" slot="header"></ng-content>
      <ng-content select="[slot=content]" slot="content"></ng-content>
      <ng-content select="[slot=footer]" slot="footer"></ng-content>
    </shared-card>
  \`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CardComponent {
  @Input() title = '';
  @Input() content = '';
  @Input() elevation = 1;
}

@NgModule({
  declarations: [CardComponent],
  exports: [CardComponent],
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CardModule {}
`,

    'components/angular/modal.component.ts': `// Angular Modal Wrapper
import { Component, Input, Output, EventEmitter, NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'shared-modal-wrapper',
  template: \`
    <shared-modal
      [open]="open"
      [title]="title"
      [closable]="closable"
      (close)="handleClose()"
    >
      <ng-content></ng-content>
      <ng-content select="[slot=footer]" slot="footer"></ng-content>
    </shared-modal>
  \`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() closable = true;

  @Output() close = new EventEmitter<void>();

  handleClose() {
    this.close.emit();
  }
}

@NgModule({
  declarations: [ModalComponent],
  exports: [ModalComponent],
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ModalModule {}
`,

    'components/angular/index.ts': `// Angular Components Export
export { ButtonComponent, ButtonModule } from './button.component';
export { CardComponent, CardModule } from './card.component';
export { ModalComponent, ModalModule } from './modal.component';
`,

    // Svelte Wrappers
    'components/svelte/Button.svelte': `<!-- Svelte Button Wrapper -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { SharedButton } from '../web-components/Button';

  export let label: string = '';
  export let variant: 'primary' | 'secondary' | 'tertiary' = 'primary';
  export let disabled: boolean = false;

  let element: SharedButton;

  function handleClick() {
    if (!disabled) {
      dispatch('click', { variant });
    }
  }

  onMount(() => {
    element.addEventListener('click', handleClick);
    return () => {
      element.removeEventListener('click', handleClick);
    };
  });
</script>

<shared-button
  bind:this={element}
  {label}
  {variant}
  {disabled}
/>
`,

    'components/svelte/Card.svelte': `<!-- Svelte Card Wrapper -->
<script lang="ts">
  export let title: string = '';
  export let content: string = '';
  export let elevation: number = 1;
</script>

<shared-card {title} {content} {elevation}>
  <slot name="header" slot="header" />
  <slot name="content" slot="content" />
  <slot name="footer" slot="footer" />
</shared-card>
`,

    'components/svelte/Modal.svelte': `<!-- Svelte Modal Wrapper -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { SharedModal } from '../web-components/Modal';

  export let open: boolean = false;
  export let title: string = '';
  export let closable: boolean = true;

  let element: SharedModal;

  function handleClose() {
    dispatch('close');
  }

  onMount(() => {
    element.addEventListener('close', handleClose);
    return () => {
      element.removeEventListener('close', handleClose);
    };
  });
</script>

<shared-modal
  bind:this={element}
  {open}
  {title}
  {closable}
>
  <slot />
  <slot name="footer" slot="footer" />
</shared-modal>
`,

    'components/svelte/index.ts': `// Svelte Components Export
export { default as Button } from './Button.svelte';
export { default as Card } from './Card.svelte';
export { default as Modal } from './Modal.svelte';
`,

    // Main export
    'components/index.ts': `// Component Library Entry Point

// Web Components
export { SharedButton } from './web-components/Button';
export { SharedCard } from './web-components/Card';
export { SharedModal } from './web-components/Modal';

// React
export * from './react/index';

// Vue
export * from './vue/index';

// Angular
export * from './angular/index';

// Svelte
export * from './svelte/index';

// Types
export interface ComponentMetadata {
  name: string;
  tag: string;
  description: string;
  props: Record<string, PropMetadata>;
  events?: string[];
  slots?: string[];
  frameworks: string[];
}

export interface PropMetadata {
  type: string;
  required?: boolean;
  default?: any;
  values?: any[];
}
`,

    // Documentation
    'README.md': `# Cross-Framework Component Sharing System

Complete system for building and sharing components across React, Vue, Angular, and Svelte using Web Components.

## Features

- **Web Components**: Framework-agnostic components using Lit
- **Framework Wrappers**: Ready-to-use components for React, Vue, Angular, and Svelte
- **Type Safety**: Full TypeScript support across all frameworks
- **Shared Styling**: Consistent design system across all implementations
- **Event Handling**: Standardized event system
- **Slots Support**: Content projection for flexible layouts

## Installation

\`\`\`bash
npm install
\`\`\`

## Building Components

\`\`\`bash
npm run build:components
\`\`\`

This generates:
- \`dist/shared-components.es.js\` - ES Module format
- \`dist/shared-components.umd.js\` - UMD format

## Usage

### Web Components (Vanilla JS)

\`\`\`html
<script type="module" src="/dist/shared-components.es.js"></script>

<shared-button label="Click me" variant="primary"></shared-button>
<shared-card title="Hello" content="World"></shared-card>
<shared-modal open={true} title="Dialog"></shared-modal>
\`\`\`

### React

\`\`\`tsx
import { Button, Card, Modal } from '@re-shell/shared-components/react';

function App() {
  return (
    <>
      <Button label="Click me" variant="primary" onClick={() => console.log('clicked')} />
      <Card title="Hello" content="World" />
      <Modal open={true} title="Dialog" onClose={() => {}}>
        Content here
      </Modal>
    </>
  );
}
\`\`\`

### Vue

\`\`\`vue
<template>
  <Button label="Click me" variant="primary" @click="handleClick" />
  <Card title="Hello" content="World" />
  <Modal :open="true" title="Dialog" @close="handleClose">
    Content here
  </Modal>
</template>

<script setup>
import { Button, Card, Modal } from '@re-shell/shared-components/vue';
</script>
\`\`\`

### Angular

\`\`\`typescript
import { ButtonModule, CardModule, ModalModule } from '@re-shell/shared-components/angular';

@NgModule({
  imports: [ButtonModule, CardModule, ModalModule],
})
export class AppModule {}

// In template
<shared-button-wrapper label="Click me" (click)="handleClick()"></shared-button-wrapper>
<shared-card-wrapper title="Hello" content="World"></shared-card-wrapper>
<shared-modal-wrapper [open]="true" title="Dialog" (close)="handleClose()"></shared-modal-wrapper>
\`\`\`

### Svelte

\`\`\`svelte
<script>
  import { Button, Card, Modal } from '@re-shell/shared-components/svelte';
</script>

<Button label="Click me" variant="primary" on:click={handleClick} />
<Card title="Hello" content="World" />
<Modal open={true} title="Dialog" on:close={handleClose}>
  Content here
</Modal>
\`\`\`

## Component API

### Button

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | string | - | Button text |
| variant | 'primary' | 'secondary' | 'tertiary' | 'primary' | Button style |
| disabled | boolean | false | Disable button |

| Event | Payload | Description |
|-------|---------|-------------|
| click | { variant } | Button clicked |

### Card

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | Card title |
| content | string | - | Card content |
| elevation | number | 1 | Shadow depth |

| Slot | Description |
|------|-------------|
| header | Custom header |
| content | Custom content |
| footer | Custom footer |

### Modal

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | - | Show modal |
| title | string | - | Modal title |
| closable | boolean | true | Show close button |

| Event | Description |
|-------|-------------|
| open | Modal opened |
| close | Modal closed |

| Slot | Description |
|------|-------------|
| default | Modal content |
| footer | Modal footer |

## Creating New Components

1. Create web component using Lit
2. Generate framework wrappers
3. Add to exports
4. Build and publish

See the existing components for examples.
`,
  },
};
