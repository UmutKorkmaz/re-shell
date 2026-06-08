import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

// Coverage-only config: same scoped includes/thresholds as the base config, but
// the slow, process-spawning suites are excluded from the RUN so coverage stays
// one-shot and never goes silent. Those suites (integration/interactive/e2e)
// build and exec the real CLI + PTY and contribute almost nothing to the scoped
// include surface anyway — coverage is earned by the fast unit/contract suites.
export default mergeConfig(baseConfig, {
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/integration/**',
      'tests/interactive/**',
      'tests/e2e/**',
    ],
  },
});
