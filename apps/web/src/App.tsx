import * as React from 'react';
import { LiveRegion, SkipLink } from '@re-shell/ui';
import { Loader2 } from 'lucide-react';
import { SCREENS, type ScreenDef, type ScreenId } from './shell/screens';
import { useScreenRoute } from './shell/useScreenRoute';
import { Sidebar } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';
import { useBrand } from './brand/BrandProvider';
import { documentTitle } from './brand/brand';
import { ErrorPanel } from './screens/shared/StatePanels';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

/**
 * Every screen is its own chunk: the shell (sidebar, topbar, hub status) ships in the entry bundle
 * and a screen's code (and heavy dependencies such as React Flow on the Workspace Graph) is only
 * downloaded when that screen is first opened. `pnpm --filter @re-shell/dashboard budget` enforces
 * the size of the entry and of every screen chunk.
 */
const OverviewScreen = React.lazy(() => import('./screens/OverviewScreen').then((m) => ({ default: m.OverviewScreen })));
const WorkspaceGraphScreen = React.lazy(() =>
  import('./screens/WorkspaceGraphScreen').then((m) => ({ default: m.WorkspaceGraphScreen }))
);
const TemplatesScreen = React.lazy(() => import('./screens/TemplatesScreen').then((m) => ({ default: m.TemplatesScreen })));
const CommandBuilderScreen = React.lazy(() =>
  import('./screens/CommandBuilderScreen').then((m) => ({ default: m.CommandBuilderScreen }))
);
const AssistantScreen = React.lazy(() => import('./screens/AssistantScreen').then((m) => ({ default: m.AssistantScreen })));
const JobsLogsScreen = React.lazy(() => import('./screens/JobsLogsScreen').then((m) => ({ default: m.JobsLogsScreen })));
const HealthScreen = React.lazy(() => import('./screens/HealthScreen').then((m) => ({ default: m.HealthScreen })));
const ScorecardScreen = React.lazy(() => import('./screens/ScorecardScreen').then((m) => ({ default: m.ScorecardScreen })));
const CatalogScreen = React.lazy(() => import('./screens/CatalogScreen').then((m) => ({ default: m.CatalogScreen })));
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));

function renderScreen(screen: ScreenDef, navigate: (next: ScreenId) => void): React.ReactElement {
  switch (screen.id) {
    case 'overview':
      return <OverviewScreen onNavigate={navigate} />;
    case 'graph':
      return <WorkspaceGraphScreen />;
    case 'templates':
      return <TemplatesScreen />;
    case 'commands':
      return <CommandBuilderScreen />;
    case 'assistant':
      return <AssistantScreen />;
    case 'jobs':
      return <JobsLogsScreen />;
    case 'health':
      return <HealthScreen />;
    case 'scorecard':
      return <ScorecardScreen />;
    case 'catalog':
      return <CatalogScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <PlaceholderScreen screen={screen} />;
  }
}

/** Shown while a screen's chunk downloads. A polite status so assistive tech hears it. */
function ScreenFallback({ label }: { label: string }): React.ReactElement {
  return (
    <div role="status" className="surface flex items-center gap-3 p-5 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-signal" aria-hidden="true" />
      <span>Loading {label}…</span>
    </div>
  );
}

interface BoundaryProps {
  label: string;
  children: React.ReactNode;
}

/**
 * A screen chunk can fail to load (offline, a stale tab after a deploy). Say so, with a retry that
 * re-attempts the import, instead of leaving a blank page.
 */
class ScreenBoundary extends React.Component<BoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <ErrorPanel
          title={`Could not load ${this.props.label}`}
          description={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function App(): React.ReactElement {
  const [activeScreen, navigate] = useScreenRoute();
  const current = SCREENS.find((screen) => screen.id === activeScreen) ?? SCREENS[0];
  const brand = useBrand();
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // The tab title names the screen and the product (a screen change is otherwise silent).
  React.useEffect(() => {
    document.title = documentTitle(current.label, brand);
  }, [current.label, brand]);

  // Screen changes are client-side, so the browser does not move focus for us: put it on the new
  // screen's <h1> (programmatic focus only, hence tabIndex -1) so keyboard and screen-reader users
  // land at the top of the new content instead of on a nav button that no longer matters.
  const previousScreen = React.useRef(activeScreen);
  React.useEffect(() => {
    if (previousScreen.current === activeScreen) return;
    previousScreen.current = activeScreen;
    headingRef.current?.focus();
  }, [activeScreen]);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg-0 text-foreground lg:grid-cols-[15rem_minmax(0,1fr)]">
      <SkipLink targetId="main-content" />
      <Sidebar activeScreen={activeScreen} onNavigate={navigate} />

      <div className="flex min-w-0 flex-col">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 p-4 outline-none lg:p-8">
          <div className="mb-6">
            <h1
              ref={headingRef}
              tabIndex={-1}
              data-testid="screen-label"
              className="font-display text-3xl font-bold tracking-tight outline-none"
            >
              {current.label}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{current.description}</p>
          </div>
          <ScreenBoundary key={current.id} label={current.label}>
            <React.Suspense fallback={<ScreenFallback label={current.label} />}>{renderScreen(current, navigate)}</React.Suspense>
          </ScreenBoundary>
        </main>
      </div>
      {/* Announces the screen on every navigation, including browser back/forward. */}
      <LiveRegion>{`${current.label} screen`}</LiveRegion>
    </div>
  );
}

export default App;
