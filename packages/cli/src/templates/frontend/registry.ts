import type { FrameworkConfig } from '../../utils/framework';
import type { BaseTemplate, TemplateContext } from '../index';
import { ReactTemplate } from './react';
import { VueTemplate } from './vue';
import { SvelteTemplate } from './svelte';
import { NextJsTemplate } from './next';
import { RemixTemplate } from './remix';
import { GatsbyTemplate } from './gatsby';
import { NuxtTemplate } from './nuxt';
import { QuasarTemplate } from './quasar';
import { AngularTemplate } from './angular';
import { ViteReactTemplate } from './vite-react';
import { SvelteKitTemplate } from './sveltekit';
import { SolidJsTemplate } from './solid-js';
import { QwikTemplate } from './qwik';
import { LitTemplate } from './lit';
import { StencilTemplate } from './stencil';
import { AlpineTemplate } from './alpine';
import { PreactTemplate } from './preact';
import { MithrilTemplate } from './mithril';
import { HyperappTemplate } from './hyperapp';
import { AstroTemplate } from './astro';
import { EleventyTemplate } from './eleventy';
import { VuePressTemplate } from './vuepress';
import { DocusaurusTemplate } from './docusaurus';
import { GridsomeTemplate } from './gridsome';
import { ScullyTemplate } from './scully';
import { JekyllTemplate } from './jekyll';
import { HugoTemplate } from './hugo';
import { HexoTemplate } from './hexo';
import { ZolaTemplate } from './zola';
import { CreateReactAppTemplate } from './create-react-app';
import { VueCliTemplate } from './vue-cli';
import { AngularCliTemplate } from './angular-cli';
import { ViteSvelteTemplate } from './vite-svelte';
import { ReactModuleFederationTemplate } from './react-module-federation';
import { VueModuleFederationTemplate } from './vue-module-federation';
import { AngularModuleFederationTemplate } from './angular-module-federation';
import { SvelteModuleFederationTemplate } from './svelte-module-federation';
import { NxAngularTemplate } from './nx-angular';
import { AnalogTemplate } from './analog';

type FrontendTemplateConstructor = new (
  framework: FrameworkConfig,
  context: TemplateContext
) => BaseTemplate;

/**
 * Every frontend framework id that has a real scaffold template, mapped to the
 * template class that renders it. This is the single source of truth for
 * "which `--frontend` / `--framework` values can actually be scaffolded".
 */
const FRONTEND_TEMPLATES: Record<string, FrontendTemplateConstructor> = {
  react: ReactTemplate,
  'react-ts': ReactTemplate,
  vue: VueTemplate,
  'vue-ts': VueTemplate,
  svelte: SvelteTemplate,
  'svelte-ts': SvelteTemplate,
  next: NextJsTemplate,
  remix: RemixTemplate,
  gatsby: GatsbyTemplate,
  nuxt: NuxtTemplate,
  quasar: QuasarTemplate,
  angular: AngularTemplate,
  'vite-react': ViteReactTemplate,
  sveltekit: SvelteKitTemplate,
  'solid-js': SolidJsTemplate,
  qwik: QwikTemplate,
  lit: LitTemplate,
  stencil: StencilTemplate,
  alpine: AlpineTemplate,
  preact: PreactTemplate,
  mithril: MithrilTemplate,
  hyperapp: HyperappTemplate,
  astro: AstroTemplate,
  eleventy: EleventyTemplate,
  vuepress: VuePressTemplate,
  docusaurus: DocusaurusTemplate,
  gridsome: GridsomeTemplate,
  scully: ScullyTemplate,
  jekyll: JekyllTemplate,
  hugo: HugoTemplate,
  hexo: HexoTemplate,
  zola: ZolaTemplate,
  'create-react-app': CreateReactAppTemplate,
  cra: CreateReactAppTemplate,
  'vue-cli': VueCliTemplate,
  'angular-cli': AngularCliTemplate,
  'vite-svelte': ViteSvelteTemplate,
  'react-module-federation': ReactModuleFederationTemplate,
  'vue-module-federation': VueModuleFederationTemplate,
  'angular-module-federation': AngularModuleFederationTemplate,
  'svelte-module-federation': SvelteModuleFederationTemplate,
  'nx-angular': NxAngularTemplate,
  analog: AnalogTemplate,
};

/**
 * Whether a frontend framework id has a scaffold template.
 *
 * @param id - Framework id such as `react-ts`.
 * @returns `true` when {@link createFrontendTemplate} can render it.
 */
export function hasFrontendTemplate(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FRONTEND_TEMPLATES, id);
}

/**
 * List every frontend framework id that can be scaffolded.
 *
 * @returns The ids, in registry order.
 */
export function listFrontendTemplateIds(): string[] {
  return Object.keys(FRONTEND_TEMPLATES);
}

/**
 * Instantiate the scaffold template for a frontend framework.
 *
 * @param framework - Framework configuration identifying which template to use.
 * @param context - Template context used for file generation.
 * @returns A `BaseTemplate` subclass instance for the framework.
 * @throws if the framework has no scaffold template (never silently falls back
 *   to a different framework).
 */
export function createFrontendTemplate(
  framework: FrameworkConfig,
  context: TemplateContext
): BaseTemplate {
  if (!hasFrontendTemplate(framework.name)) {
    throw new Error(`No scaffold template for frontend framework "${framework.name}"`);
  }
  const Template = FRONTEND_TEMPLATES[framework.name];
  return new Template(framework, context);
}
