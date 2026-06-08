import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from 're-shell-ui';
import type { ScreenDef } from '../shell/screens';

interface PlaceholderScreenProps {
  screen: ScreenDef;
}

/**
 * Stand-in for the six screens whose full implementations land in the next
 * wave. The shell, nav, and routing are real now; these panels just describe
 * what will fill the content area.
 */
export function PlaceholderScreen({ screen }: PlaceholderScreenProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{screen.label}</CardTitle>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <CardDescription>{screen.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This screen is part of the next wave. The shell and secure hub transport are wired up;
          the panel content will be built on top of the same {`{ commandId, params }`} hooks the
          Overview already uses.
        </p>
      </CardContent>
    </Card>
  );
}
