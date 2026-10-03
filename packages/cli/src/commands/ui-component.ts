// `re-shell ui component new <Name>`: scaffold a component, its Storybook story and its
// vitest + axe test following the @re-shell/ui conventions, and register it in the
// group's barrel (src/components/<group>/index.ts).

import chalk from 'chalk';
import { fail, ok } from '../utils/json-output';
import { COMPONENT_GROUPS, renderComponent, type ComponentGroup } from '../utils/ui-component-templates';
import { isValidComponentName, toKebab } from '../utils/ui-names';
import { assertNoCollision, findUiPackage, UiScaffoldError, writeComponent } from '../utils/ui-package';

/** Options of `ui component new`. */
export interface UiComponentNewOptions {
  json?: boolean;
  workspace?: string;
  /** UI package directory (otherwise detected). */
  ui?: string;
  group?: string;
  description?: string;
  dryRun?: boolean;
  force?: boolean;
}

/** Payload of `ui component new --json`. */
export interface UiComponentNewResponse {
  name: string;
  group: ComponentGroup;
  package: string;
  files: string[];
  barrel: string;
  dryRun: boolean;
}

/**
 * Scaffold a component.
 *
 * @param name - PascalCase component name
 */
export async function runUiComponentNew(name: string, options: UiComponentNewOptions): Promise<void> {
  const json = Boolean(options.json);
  try {
    if (!isValidComponentName(name)) {
      throw new UiScaffoldError(`"${name}" is not a valid component name: use PascalCase (letters and digits, starting with a capital), e.g. ServiceStatus`);
    }
    const group = (options.group ?? 'ui') as ComponentGroup;
    if (!COMPONENT_GROUPS.includes(group)) {
      throw new UiScaffoldError(`--group must be one of ${COMPONENT_GROUPS.join(', ')}`);
    }
    const pkg = findUiPackage(options.workspace ?? process.cwd(), options.ui);
    assertNoCollision(pkg, group, name, Boolean(options.force));

    const sources = renderComponent({ name, kind: 'basic', group, fields: [], description: options.description });
    const written = writeComponent(pkg, group, name, sources, { dryRun: options.dryRun });
    const payload: UiComponentNewResponse = {
      name,
      group,
      package: pkg.name,
      files: written.files,
      barrel: written.barrel,
      dryRun: written.dryRun,
    };

    if (json) {
      ok(payload);
      return;
    }
    const verb = written.dryRun ? 'Would create' : 'Created';
    process.stdout.write(chalk.cyan.bold(`\n▶ ui component new ${name}\n\n`));
    for (const file of written.files) process.stdout.write(`  ${chalk.green(verb)}  ${file}\n`);
    process.stdout.write(`  ${chalk.green(written.dryRun ? 'Would update' : 'Updated')}  ${written.barrel} ${chalk.gray(`(export * from './${toKebab(name)}')`)}\n`);
    process.stdout.write(chalk.gray(`\n  Next: pnpm --filter ${pkg.name} test ${toKebab(name)} · pnpm --filter ${pkg.name} storybook\n\n`));
  } catch (error) {
    if (error instanceof UiScaffoldError) {
      if (json) {
        fail('UI_COMPONENT_ERROR', error.message, error.details);
      } else {
        process.stderr.write(chalk.red(`\n✗ ${error.message}\n`));
        process.exitCode = 1;
      }
      return;
    }
    throw error;
  }
}
