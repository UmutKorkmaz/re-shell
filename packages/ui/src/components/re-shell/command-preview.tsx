import * as React from 'react';
import { Check, Clipboard, Play, ShieldAlert, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, type HeadingElement } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { copyTextToClipboard, formatCommand } from '@/lib/command';
import { cn } from '@/lib/utils';
import { useChangeFlash } from '@/hooks/useChangeFlash';
import { LiveRegion } from '@/components/primitives/live-region';
import type { CommandSpec, CommandSpecInput } from '@/contracts';

type CommandPreviewSpec = Pick<
  CommandSpecInput,
  'title' | 'description' | 'command' | 'destructive' | 'dryRunSupported' | 'commandText'
> &
  Partial<Pick<CommandSpecInput, 'requiresConfirmation'>>;

export interface CommandPreviewProps {
  spec: CommandPreviewSpec;
  onCopy?: (commandText: string) => void | Promise<void>;
  onDryRun?: () => void;
  onRun?: () => void;
  className?: string;
  /** Element of the title (default `h2`); use a deeper level when nested under another heading. */
  headingAs?: HeadingElement;
}

export function CommandPreview({
  spec,
  onCopy,
  onDryRun,
  onRun,
  className,
  headingAs
}: CommandPreviewProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const commandText = spec.commandText ?? formatCommand(spec.command);
  const flash = useChangeFlash(commandText);

  React.useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    const copiedToClipboard = await copyTextToClipboard(commandText);
    await onCopy?.(commandText);
    setCopied(true);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = setTimeout(() => setCopied(false), copiedToClipboard ? 1200 : 1800);
  };

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle as={headingAs} className="flex items-center gap-2 text-base">
              <Terminal className="size-4" />
              {spec.title}
            </CardTitle>
            {spec.description ? <CardDescription>{spec.description}</CardDescription> : null}
          </div>
          {spec.destructive ? (
            <Badge variant="critical" className="w-fit gap-1">
              <ShieldAlert className="size-3" />
              {spec.requiresConfirmation ? 'Confirmation required' : 'Destructive'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea label="Command text" className="max-h-32 rounded-md border border-border bg-bg-0 shadow-elev-1">
          <pre
            key={flash.key}
            className={cn(
              "re-shell-mono min-w-max p-3 pl-7 text-foreground before:absolute before:left-3 before:select-none before:text-signal before:content-['$'] relative",
              flash.className
            )}
          >
            {commandText}
          </pre>
        </ScrollArea>
        <LiveRegion>{copied ? 'Command copied to clipboard' : ''}</LiveRegion>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="justify-start">
            {copied ? <Check className="size-4 text-signal" /> : <Clipboard className="size-4" />}
            {copied ? 'Copied' : 'Copy command'}
          </Button>
          {spec.dryRunSupported ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDryRun}
              disabled={!onDryRun}
              className="justify-start"
            >
              Dry run
            </Button>
          ) : null}
          {onRun ? (
            <Button
              type="button"
              variant={spec.destructive ? 'destructive' : 'default'}
              size="sm"
              onClick={onRun}
              className="justify-start"
            >
              <Play className="size-4" />
              Run
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
