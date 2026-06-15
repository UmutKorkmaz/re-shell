import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  GaugeCircle,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  ListTree,
  Settings as SettingsIcon,
  SquareTerminal,
  Workflow,
} from 'lucide-react';
import type { ScreenId } from './screens';

/**
 * Presentation metadata for the shell navigation — kept separate from
 * {@link ScreenId}/`SCREENS` (the data/route contract) so restyling the chrome
 * never touches the routing surface. Each screen maps to one icon; screens are
 * grouped into labelled sections for a scannable mission-control sidebar.
 */
export interface NavItem {
  readonly id: ScreenId;
  readonly icon: LucideIcon;
}

export interface NavSection {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', icon: LayoutDashboard },
      { id: 'graph', icon: GitBranch },
    ],
  },
  {
    label: 'Build',
    items: [
      { id: 'templates', icon: ListTree },
      { id: 'commands', icon: SquareTerminal },
      { id: 'assistant', icon: Bot },
    ],
  },
  {
    label: 'Operate',
    items: [
      { id: 'jobs', icon: Workflow },
      { id: 'health', icon: HeartPulse },
      { id: 'scorecard', icon: GaugeCircle },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'settings', icon: SettingsIcon }],
  },
];
