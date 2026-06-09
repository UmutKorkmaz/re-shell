import { Button } from '@re-shell/ui';
import { SCREENS, type ScreenDef, type ScreenId } from './shell/screens';
import { useScreenRoute } from './shell/useScreenRoute';
import { OverviewScreen } from './screens/OverviewScreen';
import { WorkspaceGraphScreen } from './screens/WorkspaceGraphScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { CommandBuilderScreen } from './screens/CommandBuilderScreen';
import { JobsLogsScreen } from './screens/JobsLogsScreen';
import { HealthScreen } from './screens/HealthScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';

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
    case 'jobs':
      return <JobsLogsScreen />;
    case 'health':
      return <HealthScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <PlaceholderScreen screen={screen} />;
  }
}

function App(): React.ReactElement {
  const [activeScreen, navigate] = useScreenRoute();
  const current = SCREENS.find((screen) => screen.id === activeScreen) ?? SCREENS[0];

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside
        className="flex flex-col gap-6 border-b border-border bg-card p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:p-6"
        aria-label="Dashboard navigation"
      >
        <div>
          <div className="text-lg font-semibold tracking-tight">Re-Shell</div>
          <p className="mt-1 text-sm text-muted-foreground">Workspace operations</p>
        </div>
        <nav className="flex flex-wrap gap-2 lg:flex-col">
          {SCREENS.map((screen) => {
            const isActive = screen.id === activeScreen;
            return (
              <Button
                key={screen.id}
                type="button"
                variant={isActive ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(screen.id as ScreenId)}
              >
                {screen.label}
              </Button>
            );
          })}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-6xl p-4 lg:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{current.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
        </header>
        {renderScreen(current, navigate)}
      </main>
    </div>
  );
}

export default App;
