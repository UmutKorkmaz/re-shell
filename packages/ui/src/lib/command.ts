import type { CommandSpec, CommandSpecInput } from '@/contracts';
type CommandOptions = Record<string, string | boolean | undefined>;

export function quoteShellArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatCommand(command: readonly string[]): string {
  return command.map(quoteShellArg).join(' ');
}

export function formatCommandSpec(spec: Pick<CommandSpec, 'command'>): string {
  return formatCommand(spec.command);
}

export function createReShellCommand(
  args: readonly string[],
  options: CommandOptions = {}
): string[] {
  const command = ['re-shell', ...args];

  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) {
      return;
    }

    const normalizedKey = normalizeFlagName(key);
    const flag = normalizedKey.length === 1 ? `-${normalizedKey}` : `--${normalizedKey}`;
    command.push(flag);

    if (value !== true) {
      command.push(String(value));
    }
  });

  return command;
}

export function createCommandSpec(input: CommandSpecInput): CommandSpecInput {
  return {
    ...input,
    command: [...input.command],
    commandText: input.commandText ?? formatCommand(input.command)
  };
}

export function normalizeFlagName(value: string): string {
  const key = value.replace(/^-+/, '');

  if (key.length === 1) {
    return key;
  }

  return key
    .replace(/_/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

export async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
