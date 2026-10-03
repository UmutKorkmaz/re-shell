// Source templates for `re-shell ui component new` and the offline path of
// `re-shell ui generate`. Pure: input in, three TSX source strings out.
//
// The output follows the @re-shell/ui conventions exactly:
//   - `React.forwardRef`, `cn()` from '@/lib/utils', `data-slot`, token classes only
//     (bg-card, text-muted-foreground, ... never raw colours), mono + tabular-nums for numbers
//   - shadcn primitives from '@/components/ui/*' (Card, Badge, Input, Label, Button, ScrollArea)
//   - a Storybook CSF3 story with a `play` interaction test
//   - a vitest + vitest-axe test ('@/test/axe')
//
// Everything produced here is typechecked by `ui-typecheck.ts` before it is written.

import { toCamel, toKebab, toLabel, toPascal } from './ui-names';

/** The component families the generator can produce. */
export type ComponentKind = 'basic' | 'card' | 'table' | 'form' | 'list' | 'badge';

/** Which packages/ui folder the component lives in (also its Storybook title prefix). */
export type ComponentGroup = 'ui' | 're-shell' | 'primitives';

export const COMPONENT_GROUPS: readonly ComponentGroup[] = ['ui', 're-shell', 'primitives'];

/** The data type of one generated field. */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'email' | 'password' | 'status';

/** One field of a generated card / table / form / list. */
export interface FieldSpec {
  /** camelCase identifier used as the object key. */
  readonly key: string;
  /** Human label. */
  readonly label: string;
  readonly type: FieldType;
}

/** What a template needs. */
export interface TemplateInput {
  readonly name: string;
  readonly kind: ComponentKind;
  readonly group: ComponentGroup;
  readonly fields: readonly FieldSpec[];
  /** One-line description used in doc comments. */
  readonly description?: string;
}

/** The three generated source files. */
export interface GeneratedFiles {
  readonly component: string;
  readonly story: string;
  readonly test: string;
}

/** The Storybook title prefix for a group. */
export const GROUP_TITLE: Readonly<Record<ComponentGroup, string>> = {
  ui: 'UI',
  're-shell': 'Re-Shell',
  primitives: 'Primitives',
};

/** Deterministic sample value (as TS source) for a field, used by stories and tests. */
export function sampleLiteral(field: FieldSpec, index: number): string {
  switch (field.type) {
    case 'number':
      return String(3000 + index);
    case 'boolean':
      return 'true';
    case 'date':
      return "'2026-01-15'";
    case 'email':
      return "'dev@example.com'";
    case 'password':
      return "'secret-value'";
    case 'status':
      return "'healthy'";
    default:
      return `'${field.label} ${index + 1}'`;
  }
}

/** The text a field's sample value renders as in the DOM. */
export function sampleText(field: FieldSpec, index: number): string {
  switch (field.type) {
    case 'number':
      return String(3000 + index);
    case 'boolean':
      return 'Yes';
    case 'date':
      return '2026-01-15';
    case 'email':
      return 'dev@example.com';
    case 'password':
      return 'secret-value';
    case 'status':
      return 'healthy';
    default:
      return `${field.label} ${index + 1}`;
  }
}

function tsType(type: FieldType): string {
  switch (type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

function sampleObject(fields: readonly FieldSpec[], indent: string, offset = 0): string {
  return fields.map((field, index) => `${indent}${field.key}: ${sampleLiteral(field, index + offset)}`).join(',\n');
}

const STATUS_HELPERS = `
const STATUS_VARIANTS = {
  healthy: 'healthy',
  ok: 'healthy',
  passing: 'healthy',
  running: 'healthy',
  success: 'healthy',
  warn: 'warn',
  warning: 'warn',
  degraded: 'warn',
  error: 'critical',
  failed: 'critical',
  critical: 'critical',
  down: 'critical',
} as const;

function statusVariant(value: string): 'healthy' | 'warn' | 'critical' | 'info' {
  return (STATUS_VARIANTS as Record<string, 'healthy' | 'warn' | 'critical'>)[value.toLowerCase()] ?? 'info';
}
`;

/** Source of the value renderer shared by the card, table and list templates. */
function renderValueFn(fields: readonly FieldSpec[], valueType: string): string {
  const hasStatus = fields.some((f) => f.type === 'status');
  const hasBoolean = fields.some((f) => f.type === 'boolean');
  return `${hasStatus ? STATUS_HELPERS : ''}
type FieldKind = 'string' | 'number' | 'boolean' | 'date' | 'email' | 'password' | 'status';

/** Render one value. Numbers use the mono face with tabular numerals (design system rule). */
function renderValue(kind: FieldKind, value: ${valueType}): React.ReactNode {
  switch (kind) {
    case 'number':
      return <span className="font-mono tabular-nums">{String(value)}</span>;
    case 'boolean':
      return ${hasBoolean ? "<Badge variant={value ? 'healthy' : 'outline'}>{value ? 'Yes' : 'No'}</Badge>" : 'String(value)'};
    case 'date':
      return (
        <time dateTime={String(value)} className="font-mono tabular-nums">
          {String(value)}
        </time>
      );
    case 'status':
      return ${hasStatus ? "<Badge variant={statusVariant(String(value))}>{String(value)}</Badge>" : 'String(value)'};
    default:
      return String(value);
  }
}
`;
}

function fieldTable(fields: readonly FieldSpec[], constName: string, keyType: string): string {
  const rows = fields
    .map((f) => `  { key: '${f.key}', label: '${f.label}', kind: '${f.type}' },`)
    .join('\n');
  return `const ${constName} = [\n${rows}\n] as const satisfies ReadonlyArray<{ key: ${keyType}; label: string; kind: FieldKind }>;\n`;
}

function interfaceBody(fields: readonly FieldSpec[], readonly = true): string {
  return fields.map((f) => `  ${readonly ? 'readonly ' : ''}${f.key}: ${tsType(f.type)};`).join('\n');
}

function header(input: TemplateInput, summary: string): string {
  return `/**\n * ${input.description ?? summary}\n *\n * Generated by \`re-shell ui\` following the @re-shell/ui conventions: token colours\n * only, mono + tabular-nums for numbers, labelled and keyboard-operable controls.\n */\n`;
}

// ---------------------------------------------------------------------------
// component templates
// ---------------------------------------------------------------------------

function basicComponent(input: TemplateInput): string {
  const { name } = input;
  const kebab = toKebab(name);
  const variantsConst = `${toCamel(name)}Variants`;
  return `${header(input, `${name}: a themed container with tone variants.`)}import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const ${variantsConst} = cva('rounded-lg border p-4 text-sm shadow-elev-1', {
  variants: {
    tone: {
      neutral: 'border-border bg-card text-card-foreground',
      info: 'border-info/40 bg-info/10 text-foreground',
      healthy: 'border-healthy/40 bg-healthy/10 text-foreground',
      warn: 'border-warn/40 bg-warn/10 text-foreground',
      critical: 'border-critical/40 bg-critical/10 text-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface ${name}Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof ${variantsConst}> {}

const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(({ className, tone, ...props }, ref) => (
  <div ref={ref} data-slot="${kebab}" className={cn(${variantsConst}({ tone }), className)} {...props} />
));
${name}.displayName = '${name}';

export { ${name}, ${variantsConst} };
`;
}

function cardComponent(input: TemplateInput): string {
  const { name, fields } = input;
  const kebab = toKebab(name);
  const hasBadge = fields.some((f) => f.type === 'status' || f.type === 'boolean');
  return `${header(input, `${name}: a titled card that lists ${fields.map((f) => f.label.toLowerCase()).join(', ')}.`)}import * as React from 'react';

${hasBadge ? "import { Badge } from '@/components/ui/badge';\n" : ''}import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** The values ${name} displays. */
export interface ${name}Data {
${interfaceBody(fields)}
}

export interface ${name}Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  description?: string;
  data: ${name}Data;
}
${renderValueFn(fields, `${name}Data[keyof ${name}Data]`)}
${fieldTable(fields, 'FIELDS', `keyof ${name}Data`)}
const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(
  ({ title, description, data, className, ...props }, ref) => (
    <Card ref={ref} data-slot="${kebab}" className={cn('min-w-0', className)} {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
          {FIELDS.map((field) => (
            <React.Fragment key={field.key}>
              <dt className="label-eyebrow">{field.label}</dt>
              <dd className="min-w-0 break-words">{renderValue(field.kind, data[field.key])}</dd>
            </React.Fragment>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
);
${name}.displayName = '${name}';

export { ${name} };
`;
}

function tableComponent(input: TemplateInput): string {
  const { name, fields } = input;
  const kebab = toKebab(name);
  const hasBadge = fields.some((f) => f.type === 'status' || f.type === 'boolean');
  return `${header(input, `${name}: a dense data table (h-9 rows, mono tabular numbers) with an accessible caption.`)}import * as React from 'react';

${hasBadge ? "import { Badge } from '@/components/ui/badge';\n" : ''}import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/** One table row. */
export interface ${name}Row {
${interfaceBody(fields)}
}

export interface ${name}Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Accessible name of the table (rendered as a visually hidden caption). */
  caption: string;
  rows: readonly ${name}Row[];
  /** Stable key per row; defaults to the row index. */
  getRowKey?: (row: ${name}Row, index: number) => React.Key;
  emptyMessage?: string;
}
${renderValueFn(fields, `${name}Row[keyof ${name}Row]`)}
${fieldTable(fields, 'COLUMNS', `keyof ${name}Row`)}
const ${name} = React.forwardRef<HTMLDivElement, ${name}Props>(
  ({ caption, rows, getRowKey, emptyMessage = 'No rows to show.', className, ...props }, ref) => (
    <div ref={ref} data-slot="${kebab}" className={cn('rounded-lg border border-border bg-card shadow-elev-1', className)} {...props}>
      <ScrollArea label={caption}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-8 border-b border-border text-left">
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" className="label-eyebrow px-3 font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="h-9">
                <td colSpan={COLUMNS.length} className="px-3 text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={getRowKey ? getRowKey(row, index) : index} className="h-9 border-b border-border last:border-b-0 hover:bg-bg-2/60">
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-3">
                      {renderValue(column.kind, row[column.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  )
);
${name}.displayName = '${name}';

export { ${name} };
`;
}

function listComponent(input: TemplateInput): string {
  const { name, fields } = input;
  const kebab = toKebab(name);
  const [primary, ...rest] = fields;
  const hasBadge = fields.some((f) => f.type === 'status' || f.type === 'boolean');
  return `${header(input, `${name}: a list of items, ${primary.label.toLowerCase()} first.`)}import * as React from 'react';

${hasBadge ? "import { Badge } from '@/components/ui/badge';\n" : ''}import { cn } from '@/lib/utils';

/** One list item. */
export interface ${name}Item {
${interfaceBody(fields)}
}

export interface ${name}Props extends Omit<React.HTMLAttributes<HTMLUListElement>, 'children'> {
  items: readonly ${name}Item[];
  /** Stable key per item; defaults to the primary field. */
  getItemKey?: (item: ${name}Item, index: number) => React.Key;
  emptyMessage?: string;
}
${renderValueFn(fields, `${name}Item[keyof ${name}Item]`)}
${fieldTable(rest.length > 0 ? rest : [], 'DETAILS', `keyof ${name}Item`)}
const ${name} = React.forwardRef<HTMLUListElement, ${name}Props>(
  ({ items, getItemKey, emptyMessage = 'Nothing to show.', className, ...props }, ref) => {
    if (items.length === 0) {
      return (
        <p data-slot="${kebab}-empty" className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      );
    }
    return (
      <ul ref={ref} data-slot="${kebab}" className={cn('divide-y divide-border rounded-lg border border-border bg-card shadow-elev-1', className)} {...props}>
        {items.map((item, index) => (
          <li key={getItemKey ? getItemKey(item, index) : String(item.${primary.key})} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
            <span className="font-medium">{renderValue('${primary.type}', item.${primary.key})}</span>
            <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {DETAILS.map((detail) => (
                <span key={detail.key}>
                  <span className="sr-only">{detail.label}: </span>
                  {renderValue(detail.kind, item[detail.key])}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    );
  }
);
${name}.displayName = '${name}';

export { ${name} };
`;
}

function formComponent(input: TemplateInput): string {
  const { name, fields } = input;
  const kebab = toKebab(name);
  const inputType = (f: FieldSpec): string =>
    f.type === 'email' ? 'email' : f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
  const initial = fields
    .map((f) => `  ${f.key}: ${f.type === 'boolean' ? 'false' : "''"},`)
    .join('\n');
  const valuesBody = fields.map((f) => `  ${f.key}: ${f.type === 'boolean' ? 'boolean' : 'string'};`).join('\n');
  const spec = fields
    .map((f) => `  { key: '${f.key}', label: '${f.label}', kind: '${f.type}', input: '${inputType(f)}' },`)
    .join('\n');
  return `${header(input, `${name}: a validated form with a labelled control per field.`)}import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** The form values. Numbers and dates are kept as the strings the inputs produce. */
export interface ${name}Values {
${valuesBody}
}

type ${name}Errors = Partial<Record<keyof ${name}Values, string>>;

export interface ${name}Props extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'children'> {
  initialValues?: Partial<${name}Values>;
  /** Called with the values once validation passes. */
  onSubmit?: (values: ${name}Values) => void;
  submitLabel?: string;
}

const DEFAULT_VALUES: ${name}Values = {
${initial}
};

const FIELDS = [
${spec}
] as const satisfies ReadonlyArray<{ key: keyof ${name}Values; label: string; kind: string; input: string }>;

const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

/** Required text fields must be filled; emails must look like emails. */
export function validate${name}(values: ${name}Values): ${name}Errors {
  const errors: ${name}Errors = {};
  for (const field of FIELDS) {
    const value = values[field.key];
    if (field.kind === 'boolean') continue;
    if (typeof value !== 'string' || value.trim() === '') {
      errors[field.key] = \`\${field.label} is required.\`;
    } else if (field.kind === 'email' && !EMAIL_PATTERN.test(value)) {
      errors[field.key] = 'Enter a valid email address.';
    }
  }
  return errors;
}

const ${name} = React.forwardRef<HTMLFormElement, ${name}Props>(
  ({ initialValues, onSubmit, submitLabel = 'Submit', className, ...props }, ref) => {
    const baseId = React.useId();
    const [values, setValues] = React.useState<${name}Values>({ ...DEFAULT_VALUES, ...initialValues });
    const [errors, setErrors] = React.useState<${name}Errors>({});

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const found = validate${name}(values);
      setErrors(found);
      const firstInvalid = FIELDS.find((field) => found[field.key] !== undefined);
      if (firstInvalid) {
        // Move focus to the first problem so keyboard and screen-reader users land on it.
        document.getElementById(\`\${baseId}-\${firstInvalid.key}\`)?.focus();
        return;
      }
      onSubmit?.(values);
    };

    return (
      <form
        ref={ref}
        data-slot="${kebab}"
        noValidate
        onSubmit={handleSubmit}
        className={cn('grid max-w-md gap-4', className)}
        {...props}
      >
        {FIELDS.map((field) => {
          const id = \`\${baseId}-\${field.key}\`;
          const error = errors[field.key];
          if (field.kind === 'boolean') {
            return (
              <div key={field.key} className="flex items-center gap-2">
                <input
                  id={id}
                  type="checkbox"
                  className="size-4 rounded-sm border border-control accent-[var(--signal)]"
                  checked={Boolean(values[field.key])}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.checked }))}
                />
                <Label htmlFor={id}>{field.label}</Label>
              </div>
            );
          }
          return (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                type={field.input}
                value={String(values[field.key])}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? \`\${id}-error\` : undefined}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              />
              {error ? (
                <p id={\`\${id}-error\`} className="text-sm text-critical">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
        <Button type="submit" className="w-fit">
          {submitLabel}
        </Button>
      </form>
    );
  }
);
${name}.displayName = '${name}';

export { ${name} };
`;
}

const TONE_BY_WORD: ReadonlyArray<readonly [RegExp, 'healthy' | 'warn' | 'critical']> = [
  [/^(ok|healthy|pass|passing|passed|success|succeeded|running|up|active|ready|online|live)$/, 'healthy'],
  [/^(warn|warning|degraded|slow|pending|stale|partial|unstable|queued)$/, 'warn'],
  [/^(error|fail|failed|failing|critical|down|offline|broken|blocked|stopped)$/, 'critical'],
];

/** Map a status word to a Badge tone (default `info`). */
export function toneForStatus(word: string): 'healthy' | 'warn' | 'critical' | 'info' {
  for (const [pattern, tone] of TONE_BY_WORD) {
    if (pattern.test(word.toLowerCase())) return tone;
  }
  return 'info';
}

function badgeComponent(input: TemplateInput): string {
  const { name, fields } = input;
  const kebab = toKebab(name);
  const values = fields.map((f) => f.key);
  const union = values.map((v) => `'${v}'`).join(' | ');
  const tones = fields.map((f) => `  ${f.key}: '${toneForStatus(f.key)}',`).join('\n');
  const labels = fields.map((f) => `  ${f.key}: '${f.label}',`).join('\n');
  return `${header(input, `${name}: a status badge. Colour is never the only signal: the status name is the text.`)}import * as React from 'react';

import { Badge } from '@/components/ui/badge';

/** The states ${name} can show. */
export type ${name}Value = ${union};

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

export interface ${name}Props extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: ${name}Value;
  /** Override the visible text (defaults to the state's label). */
  label?: string;
}

const TONES: Record<${name}Value, BadgeVariant> = {
${tones}
};

const LABELS: Record<${name}Value, string> = {
${labels}
};

const ${name} = React.forwardRef<HTMLSpanElement, ${name}Props>(({ value, label, ...props }, ref) => (
  <Badge ref={ref} data-slot="${kebab}" variant={TONES[value]} {...props}>
    {label ?? LABELS[value]}
  </Badge>
));
${name}.displayName = '${name}';

export { ${name} };
`;
}

// ---------------------------------------------------------------------------
// stories
// ---------------------------------------------------------------------------

function storyHeader(input: TemplateInput): string {
  const kebab = toKebab(input.name);
  return `import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { ${input.name} } from './${kebab}';
`;
}

function storyFor(input: TemplateInput): string {
  const { name, kind, fields, group } = input;
  const title = `${GROUP_TITLE[group]}/${name}`;
  const first = fields[0];
  switch (kind) {
    case 'card': {
      return `${storyHeader(input)}
const meta = {
  title: '${title}',
  component: ${name},
  parameters: { layout: 'padded' },
  args: {
    title: '${name}',
    description: 'Generated story',
    className: 'max-w-md',
    data: {
${sampleObject(fields, '      ')},
    },
  },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 2, name: '${name}' })).toBeVisible();
    await expect(canvas.getByText('${first.label}')).toBeVisible();
  },
};
`;
    }
    case 'table': {
      return `${storyHeader(input)}
const meta = {
  title: '${title}',
  component: ${name},
  parameters: { layout: 'padded' },
  args: {
    caption: '${name} rows',
    rows: [
      {
${sampleObject(fields, '        ')},
      },
      {
${sampleObject(fields, '        ', 1)},
      },
    ],
  },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const table = within(canvasElement).getByRole('table', { name: '${name} rows' });
    await expect(within(table).getAllByRole('row')).toHaveLength(3);
    await expect(within(table).getByRole('columnheader', { name: '${first.label}' })).toBeVisible();
  },
};

export const Empty: Story = {
  args: { rows: [], emptyMessage: 'Nothing here yet.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Nothing here yet.')).toBeVisible();
  },
};
`;
    }
    case 'list': {
      return `${storyHeader(input)}
const meta = {
  title: '${title}',
  component: ${name},
  parameters: { layout: 'padded' },
  args: {
    className: 'max-w-lg',
    items: [
      {
${sampleObject(fields, '        ')},
      },
      {
${sampleObject(fields, '        ', 1)},
      },
    ],
  },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(2);
  },
};

export const Empty: Story = {
  args: { items: [], emptyMessage: 'Nothing to show.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Nothing to show.')).toBeVisible();
  },
};
`;
    }
    case 'form': {
      const valid = fields
        .map((f, index) => `${f.key}: ${f.type === 'boolean' ? 'true' : f.type === 'email' ? "'dev@example.com'" : f.type === 'number' ? "'42'" : f.type === 'date' ? "'2026-01-15'" : `'${f.label} ${index + 1}'`}`)
        .join(', ');
      return `import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ${name} } from './${toKebab(name)}';

const meta = {
  title: '${title}',
  component: ${name},
  parameters: { layout: 'padded' },
  args: { onSubmit: fn() },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShowsValidationErrors: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
    await expect(args.onSubmit).not.toHaveBeenCalled();
    // Focus lands on the first invalid control.
    await expect(canvas.getByLabelText('${first.label}')).toHaveFocus();
  },
};

export const SubmitsValidValues: Story = {
  args: { initialValues: { ${valid} } },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Submit' }));
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};
`;
    }
    case 'badge': {
      return `${storyHeader(input)}
const meta = {
  title: '${title}',
  component: ${name},
  args: { value: '${first.key}' },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('${first.label}')).toBeVisible();
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
${fields.map((f) => `      <${name} value="${f.key}" />`).join('\n')}
    </div>
  ),
};
`;
    }
    default: {
      return `${storyHeader(input)}
const meta = {
  title: '${title}',
  component: ${name},
  args: { children: '${name} content' },
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('${name} content')).toBeVisible();
  },
};

export const Tones: Story = {
  render: (args) => (
    <div className="grid max-w-md gap-3">
      {(['neutral', 'info', 'healthy', 'warn', 'critical'] as const).map((tone) => (
        <${name} key={tone} {...args} tone={tone}>
          {tone}
        </${name}>
      ))}
    </div>
  ),
};
`;
    }
  }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

function testFor(input: TemplateInput): string {
  const { name, kind, fields } = input;
  const kebab = toKebab(name);
  const first = fields[0];
  const head = (userEvent: boolean): string => `import { render, screen${kind === 'table' || kind === 'list' ? ', within' : ''} } from '@testing-library/react';
${userEvent ? "import userEvent from '@testing-library/user-event';\n" : ''}import { describe, expect, it${userEvent ? ', vi' : ''} } from 'vitest';

import { expectNoA11yViolations } from '@/test/axe';
import { ${name} } from './${kebab}';
`;
  switch (kind) {
    case 'card':
      return `${head(false)}
const data = {
${sampleObject(fields, '  ')},
};

describe('${name}', () => {
  it('renders the title and every field', () => {
    render(<${name} title="${name} title" data={data} />);
    expect(screen.getByRole('heading', { level: 2, name: '${name} title' })).toBeInTheDocument();
${fields.map((f, i) => `    expect(screen.getByText('${f.label}')).toBeInTheDocument();\n    expect(screen.getAllByText('${sampleText(f, i)}').length).toBeGreaterThan(0);`).join('\n')}
  });

  it('has no axe violations', async () => {
    const { container } = render(<${name} title="${name} title" description="About" data={data} />);
    await expectNoA11yViolations(container);
  });
});
`;
    case 'table':
      return `${head(false)}
const rows = [
  {
${sampleObject(fields, '    ')},
  },
  {
${sampleObject(fields, '    ', 1)},
  },
];

describe('${name}', () => {
  it('renders a captioned table with a header cell per column and a row per item', () => {
    render(<${name} caption="${name} rows" rows={rows} />);
    const table = screen.getByRole('table', { name: '${name} rows' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(${fields.length});
    expect(within(table).getAllByRole('row')).toHaveLength(${2 + 1});
  });

  it('shows the empty message when there are no rows', () => {
    render(<${name} caption="${name} rows" rows={[]} emptyMessage="Nothing here yet." />);
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<${name} caption="${name} rows" rows={rows} />);
    await expectNoA11yViolations(container);
  });
});
`;
    case 'list':
      return `${head(false)}
const items = [
  {
${sampleObject(fields, '    ')},
  },
  {
${sampleObject(fields, '    ', 1)},
  },
];

describe('${name}', () => {
  it('renders one list item per entry', () => {
    render(<${name} items={items} />);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('${sampleText(first, 0)}')).toBeInTheDocument();
  });

  it('shows the empty message when there are no items', () => {
    render(<${name} items={[]} emptyMessage="Nothing to show." />);
    expect(screen.getByText('Nothing to show.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<${name} items={items} />);
    await expectNoA11yViolations(container);
  });
});
`;
    case 'form': {
      const filled = fields
        .map((f, i) => `${f.key}: ${f.type === 'boolean' ? 'true' : f.type === 'email' ? "'dev@example.com'" : f.type === 'number' ? "'42'" : f.type === 'date' ? "'2026-01-15'" : `'${f.label} ${i + 1}'`}`)
        .join(', ');
      return `${head(true)}
describe('${name}', () => {
  it('blocks submit, reports the problem and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<${name} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('${first.label}')).toHaveFocus();
${first.type === 'boolean' ? '' : `    expect(screen.getByLabelText('${first.label}')).toBeInvalid();\n    expect(screen.getByText('${first.label} is required.')).toBeInTheDocument();`}
  });

  it('submits the values once they are valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<${name} initialValues={{ ${filled} }} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations', async () => {
    const { container } = render(<${name} />);
    await expectNoA11yViolations(container);
  });
});
`;
    }
    case 'badge':
      return `${head(false)}
describe('${name}', () => {
  it('shows the state as text, not only colour', () => {
${fields.map((f) => `    const { unmount: unmount${toPascal(f.key)} } = render(<${name} value="${f.key}" />);\n    expect(screen.getByText('${f.label}')).toBeInTheDocument();\n    unmount${toPascal(f.key)}();`).join('\n')}
  });

  it('allows the text to be overridden', () => {
    render(<${name} value="${first.key}" label="Custom" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<${name} value="${first.key}" />);
    await expectNoA11yViolations(container);
  });
});
`;
    default:
      return `${head(false)}
describe('${name}', () => {
  it('renders its children and forwards props', () => {
    render(<${name} data-testid="root">content</${name}>);
    expect(screen.getByTestId('root')).toHaveTextContent('content');
    expect(screen.getByTestId('root')).toHaveAttribute('data-slot', '${kebab}');
  });

  it('applies the tone variant', () => {
    render(
      <${name} tone="critical" data-testid="root">
        x
      </${name}>
    );
    expect(screen.getByTestId('root').className).toContain('border-critical');
  });

  it('has no axe violations', async () => {
    const { container } = render(<${name}>content</${name}>);
    await expectNoA11yViolations(container);
  });
});
`;
  }
}

/** Default fields when the description names none. */
export function defaultFields(kind: ComponentKind): FieldSpec[] {
  const f = (name: string, type: FieldType): FieldSpec => ({ key: toCamel(name), label: toLabel(name), type });
  switch (kind) {
    case 'card':
      return [f('name', 'string'), f('status', 'status')];
    case 'table':
      return [f('name', 'string'), f('status', 'status')];
    case 'form':
      return [f('name', 'string'), f('email', 'email')];
    case 'list':
      return [f('name', 'string'), f('status', 'status')];
    case 'badge':
      return [f('healthy', 'status'), f('warning', 'status'), f('critical', 'status')];
    default:
      return [];
  }
}

/**
 * Render the component, story and test sources for `input`.
 *
 * @throws {Error} when a kind that needs fields receives none
 */
export function renderComponent(input: TemplateInput): GeneratedFiles {
  if (input.kind !== 'basic' && input.fields.length === 0) {
    throw new Error(`a ${input.kind} needs at least one field`);
  }
  const component =
    input.kind === 'card'
      ? cardComponent(input)
      : input.kind === 'table'
        ? tableComponent(input)
        : input.kind === 'list'
          ? listComponent(input)
          : input.kind === 'form'
            ? formComponent(input)
            : input.kind === 'badge'
              ? badgeComponent(input)
              : basicComponent(input);
  return { component, story: storyFor(input), test: testFor(input) };
}
