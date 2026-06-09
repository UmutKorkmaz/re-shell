import * as React from 'react';
import { cn } from '@re-shell/ui';
import { SCREENS, type ScreenId } from './screens';
import { NAV_SECTIONS } from './nav';

interface SidebarProps {
  activeScreen: ScreenId;
  onNavigate: (next: ScreenId) => void;
}

const SCREEN_LABELS = new Map(SCREENS.map((screen) => [screen.id, screen.label] as const));

/**
 * Mission-control left rail: a layered near-black surface with a brand mark,
 * section-grouped nav, and a ◆ signal indicator on the active item. The active
 * row lifts onto the raised elevation with an accent-tinted label so it reads as
 * the current focus without rainbow color.
 */
export function Sidebar({ activeScreen, onNavigate }: SidebarProps): React.ReactElement {
  return (
    <aside
      className="flex flex-col gap-6 border-b border-border bg-bg-1 p-4 shadow-elev-1 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:gap-7 lg:p-5"
      aria-label="Dashboard navigation"
    >
      <BrandMark />

      <nav className="flex flex-col gap-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-1.5">
            <div className="label-eyebrow px-2 lg:px-2.5">{section.label}</div>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.id === activeScreen;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors duration-fast',
                        'focus-visible:shadow-focus-ring',
                        isActive
                          ? 'bg-bg-2 text-foreground shadow-elev-1'
                          : 'text-muted-foreground hover:bg-bg-2/60 hover:text-foreground'
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-0 top-1/2 -translate-y-1/2 text-[0.6rem] leading-none text-signal transition-opacity duration-fast',
                          isActive ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        ◆
                      </span>
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors duration-fast',
                          isActive ? 'text-signal' : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <span className="truncate">{SCREEN_LABELS.get(item.id) ?? item.id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto hidden lg:block">
        <div className="hairline pt-3">
          <p className="label-eyebrow">Re-Shell CLI</p>
          <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">control surface</p>
        </div>
      </div>
    </aside>
  );
}

function BrandMark(): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-md border border-border-strong bg-bg-0 text-signal shadow-elev-1"
      >
        <span className="text-base leading-none">◆</span>
      </span>
      <div className="min-w-0">
        <div className="font-display text-base font-bold tracking-tight">Re-Shell</div>
        <div className="label-eyebrow">Mission Control</div>
      </div>
    </div>
  );
}
