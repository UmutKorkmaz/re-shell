import * as React from 'react';
import type { ThemePack } from '@re-shell/contracts';
import { Alert, Badge, Button, Input, Label, cn, useToast } from '@re-shell/ui';
import { Check, Eye, Palette, Trash2, Undo2 } from 'lucide-react';
import {
  ThemeInstallError,
  fetchThemePack,
  readThemePackFile,
} from '../../theme/theme-packs';
import { useThemePacks } from '../../theme/useThemePacks';

/**
 * Settings -> Appearance: install theme packs from a URL or a file, preview one without saving it,
 * apply it (persisted), or remove it. Packs are validated by the contracts schema (OKLCH tokens,
 * radius, fonts, WCAG AA contrast) BEFORE they are stored, and every failure is shown with the
 * exact problems found. The built-in theme is always one click away.
 */
export function AppearancePanel(): React.ReactElement {
  const { installed, activeId, previewId, install, remove, apply, preview } = useThemePacks();
  const { toast } = useToast();
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<{ message: string; details: readonly string[] } | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const previewing = installed.find((pack) => pack.id === previewId);

  const finishInstall = (pack: ThemePack): void => {
    try {
      install(pack);
    } catch (error) {
      setProblem({ message: error instanceof Error ? error.message : 'Could not install the theme.', details: [] });
      return;
    }
    setProblem(null);
    toast({ title: `Installed "${pack.name}"`, description: 'Preview it or apply it below.', tone: 'healthy' });
  };

  const run = async (task: () => Promise<ThemePack>): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      finishInstall(await task());
    } catch (error) {
      if (error instanceof ThemeInstallError) setProblem({ message: error.message, details: error.problems });
      else setProblem({ message: error instanceof Error ? error.message : 'Could not install the theme.', details: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface overflow-hidden" aria-labelledby="appearance-heading">
      <div className="border-b border-border px-5 py-3.5">
        <h2 id="appearance-heading" className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight">
          <Palette className="size-3.5 text-signal" aria-hidden="true" />
          Appearance
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Theme packs: OKLCH colours, corner radius and fonts, installed from a URL or a file.
        </p>
      </div>

      <div className="grid gap-5 p-5">
        {previewing ? (
          <Alert tone="info" title={`Previewing "${previewing.name}"`} data-testid="theme-preview-banner">
            <span>Nothing is saved until you apply it.</span>
            <span className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => { apply(previewing.id); toast({ title: `Applied "${previewing.name}"`, tone: 'healthy' }); }}>
                <Check className="size-4" aria-hidden="true" />
                Apply
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => preview(null)}>
                <Undo2 className="size-4" aria-hidden="true" />
                Revert preview
              </Button>
            </span>
          </Alert>
        ) : null}

        <div>
          <h3 className="label-eyebrow mb-2">Themes</h3>
          <ul className="grid gap-2" aria-label="Installed themes">
            <ThemeRow
              name="Built-in"
              description="The default Re-Shell theme (dark first, light companion)."
              active={activeId === null}
              previewing={false}
              onApply={() => { apply(null); toast({ title: 'Restored the built-in theme', tone: 'info' }); }}
            />
            {installed.map((pack) => (
              <ThemeRow
                key={pack.id}
                name={pack.name}
                version={pack.version}
                description={pack.description}
                schemes={(['light', 'dark'] as const).filter((scheme) => pack.colors[scheme] !== undefined)}
                active={activeId === pack.id}
                previewing={previewId === pack.id}
                onPreview={() => preview(previewId === pack.id ? null : pack.id)}
                onApply={() => { apply(pack.id); toast({ title: `Applied "${pack.name}"`, tone: 'healthy' }); }}
                onRemove={() => { remove(pack.id); toast({ title: `Removed "${pack.name}"`, tone: 'info' }); }}
              />
            ))}
          </ul>
          {installed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No theme packs installed yet.</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <form
            className="grid gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => fetchThemePack(url));
            }}
          >
            <Label htmlFor="theme-url">Install from URL</Label>
            <div className="flex gap-2">
              <Input
                id="theme-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com/midnight-lime.json"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                aria-describedby="theme-url-hint"
              />
              <Button type="submit" variant="secondary" disabled={busy || url.trim() === ''}>
                Install
              </Button>
            </div>
            <p id="theme-url-hint" className="text-sm text-muted-foreground">
              https only. The server must allow cross-origin requests.
            </p>
          </form>

          <div className="grid gap-1.5">
            <Label htmlFor="theme-file">Install from file</Label>
            <Input
              id="theme-file"
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              disabled={busy}
              aria-describedby="theme-file-hint"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void run(() => readThemePackFile(file)).finally(() => {
                  if (fileInput.current) fileInput.current.value = '';
                });
              }}
            />
            <p id="theme-file-hint" className="text-sm text-muted-foreground">
              A <span className="font-mono">.json</span> theme pack, up to 64 KB.
            </p>
          </div>
        </div>

        {problem ? (
          <Alert tone="critical" title={problem.message} data-testid="theme-install-error">
            {problem.details.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[0.8125rem]">
                {problem.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}
      </div>
    </section>
  );
}

interface ThemeRowProps {
  name: string;
  version?: string;
  description?: string;
  schemes?: readonly ('light' | 'dark')[];
  active: boolean;
  previewing: boolean;
  onPreview?: () => void;
  onApply: () => void;
  onRemove?: () => void;
}

function ThemeRow({ name, version, description, schemes, active, previewing, onPreview, onApply, onRemove }: ThemeRowProps): React.ReactElement {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5',
        active ? 'border-signal/60 bg-bg-2' : 'border-border bg-bg-1'
      )}
      data-active={active || undefined}
      data-previewing={previewing || undefined}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{name}</span>
          {version ? <span className="font-mono text-xs tabular-nums text-muted-foreground">v{version}</span> : null}
          {active ? <Badge variant="healthy">Active</Badge> : null}
          {previewing ? <Badge variant="info">Previewing</Badge> : null}
          {schemes?.map((scheme) => (
            <Badge key={scheme} variant="outline" className="normal-case tracking-normal">
              {scheme}
            </Badge>
          ))}
        </div>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {onPreview ? (
          <Button type="button" size="sm" variant="outline" aria-pressed={previewing} aria-label={`${previewing ? 'Stop previewing' : 'Preview'} ${name}`} onClick={onPreview}>
            <Eye className="size-4" aria-hidden="true" />
            Preview
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={active} aria-label={`Apply ${name}`} onClick={onApply}>
          Apply
        </Button>
        {onRemove ? (
          <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${name}`} onClick={onRemove}>
            <Trash2 className="size-4" aria-hidden="true" />
            Remove
          </Button>
        ) : null}
      </div>
    </li>
  );
}
