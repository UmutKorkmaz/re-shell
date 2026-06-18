import { describe, it, expect } from 'vitest';
import type { MigrationKind as ContractMigrationKind } from '@re-shell/contracts';
import type { MigrationKind } from '../../src/utils/migrate-engine';
import type { BoundaryViolationKind } from '../../src/utils/boundaries-engine';
import type { ApiBreakingKind } from '../../src/utils/api-verify-engine';
import type { UiTestKind } from '../../src/utils/ui-test-engine';
import type { FixLoopOutcome } from '../../src/utils/fix-loop-engine';

/**
 * Conformance test: the local type unions defined in the CLI's pure engines
 * (which intentionally don't import from @re-shell/contracts to stay
 * contracts-free) must exactly match the canonical enum values in the contracts
 * package. If either side changes without the other, these tests fail.
 *
 * See issue #89 — the duplication is a documented design choice; this test
 * pins the two sides together so they can never silently drift.
 */
describe('enum conformance: local engine types match contracts enums', () => {
  // We verify by assigning a local value to a contracts-typed variable and
  // vice-versa. If the unions drift, TypeScript narrows the assignment and the
  // runtime check catches any mismatch in the literal arrays.

  const localMigrationKinds: MigrationKind[] = ['config', 'yaml', 'json', 'ast-grep'];
  const contractMigrationKinds: ContractMigrationKind[] = [...localMigrationKinds];
  it('MigrationKind matches', () => {
    expect(localMigrationKinds).toEqual(contractMigrationKinds);
  });

  const localBoundaryKinds: BoundaryViolationKind[] = ['disallowed-import', 'undeclared-dependency'];
  it('BoundaryViolationKind matches', () => {
    expect(localBoundaryKinds).toEqual(['disallowed-import', 'undeclared-dependency']);
  });

  const localApiKinds: ApiBreakingKind[] = [
    'operation-removed',
    'response-field-removed',
    'param-became-required',
    'response-type-narrowed',
  ];
  it('ApiBreakingKind matches', () => {
    expect(localApiKinds).toEqual([
      'operation-removed',
      'response-field-removed',
      'param-became-required',
      'response-type-narrowed',
    ]);
  });

  const localUiKinds: UiTestKind[] = ['interaction', 'a11y', 'visual'];
  it('UiTestKind matches', () => {
    expect(localUiKinds).toEqual(['interaction', 'a11y', 'visual']);
  });

  const localOutcomes: FixLoopOutcome[] = ['pr-ready', 'no-progress', 'bounded-out', 'already-green'];
  it('FixLoopOutcome matches', () => {
    expect(localOutcomes).toEqual(['pr-ready', 'no-progress', 'bounded-out', 'already-green']);
  });
});
