# Re-Shell CLI Tests

This directory contains tests for the Re-Shell CLI. The tests are organized into three categories:

1. **Unit Tests**: Test individual CLI command functions in isolation
2. **Integration Tests**: Test CLI commands by executing the actual CLI binary
3. **End-to-End Tests**: Test complete workflows involving multiple CLI commands

## Test Structure

```
tests/
├── unit/              # Unit tests for individual command functions
├── integration/       # Integration tests for CLI commands
├── e2e/               # End-to-end tests for complete workflows
├── utils/             # Utility functions for testing
└── README.md          # This file
```

## Running Tests

You can run the tests using the following npm scripts:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run end-to-end tests only
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Categories

### Unit Tests

Unit tests focus on testing individual command functions in isolation. They use mocks to avoid file system operations and external dependencies.

Example:
```typescript
// Test the createProject function
it('should create a Re-Shell project with specified options', async () => {
  await createProject('test-project', {
    org: 'custom-org',
    team: 'custom-team',
    description: 'Custom description',
    template: 'react-ts',
    packageManager: 'yarn'
  });

  // Assertions...
});
```

### Integration Tests

Integration tests execute the actual CLI binary and verify that commands work correctly. They create temporary files and directories for testing.

Example:
```typescript
// Test the create command
it('should create a new project with default options', () => {
  const { stdout, stderr } = runCommand(
    `node ${cliPath} create test-project --package-manager npm`,
    testDir
  );
  
  // Assertions...
});
```

### End-to-End Tests

End-to-end tests simulate complete user workflows, such as creating a project, adding microfrontends, and removing them.

Example:
```typescript
// Test a complete workflow
it('should create a complete project and add microfrontends', () => {
  // Create project
  runCliCommand(`node ${cliPath} create ${testProjectName}`, testBaseDir);
  
  // Add microfrontend
  runCliCommand(`node ${cliPath} add ${testMfName}`, projectDir);
  
  // List microfrontends
  const listResult = runCliCommand(`node ${cliPath} list`, projectDir);
  
  // Assertions...
});
```

## Test Utilities

The `utils` directory contains utility functions for testing:

- `runCliCommand`: Run a CLI command and return the result
- `createTestDirectory`: Create a temporary test directory
- `cleanupTestDirectory`: Clean up a test directory
- `verifyProjectStructure`: Verify a project structure
- `verifyMicrofrontendStructure`: Verify a microfrontend structure

## Adding New Tests

When adding new features to the CLI, follow these guidelines:

1. Add unit tests for new command functions
2. Add integration tests for new CLI commands
3. Update end-to-end tests if the new feature affects existing workflows
4. Add new end-to-end tests for new workflows

## Test Coverage

Run `npm run test:coverage` to generate a test coverage report. The report will show which parts of the code are covered by tests and which are not.

## Debugging Tests

To debug tests, you can use the `test:watch` script and focus on specific test files:

```bash
npm run test:watch -- tests/unit/cli-commands.test.ts
```

This will run the tests in watch mode and allow you to debug them interactively.
