import { SCREENS, type ScreenDef, type ScreenId } from './shell/screens';
import { useScreenRoute } from './shell/useScreenRoute';
import { Sidebar } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';
import { OverviewScreen } from './screens/OverviewScreen';
import { WorkspaceGraphScreen } from './screens/WorkspaceGraphScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { CommandBuilderScreen } from './screens/CommandBuilderScreen';
import { AssistantScreen } from './screens/AssistantScreen';
import { JobsLogsScreen } from './screens/JobsLogsScreen';
import { HealthScreen } from './screens/HealthScreen';
import { ScorecardScreen } from './screens/ScorecardScreen';
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
    case 'assistant':
      return <AssistantScreen />;
    case 'jobs':
      return <JobsLogsScreen />;
    case 'health':
      return <HealthScreen />;
    case 'scorecard':
      return <ScorecardScreen />;
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
    <div className="grid min-h-screen grid-cols-1 bg-bg-0 text-foreground lg:grid-cols-[15rem_minmax(0,1fr)]">
      <Sidebar activeScreen={activeScreen} onNavigate={navigate} />

      <div className="flex min-w-0 flex-col">
        <Topbar current={current} />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-8">
          <header className="mb-6">
            <p className="max-w-2xl text-sm text-muted-foreground">{current.description}</p>
          </header>
          {renderScreen(current, navigate)}
        </main>
      </div>
    </div>
  );
}

export default App;
