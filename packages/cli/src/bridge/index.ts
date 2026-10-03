// Registers the cross-language service bridge commands (P9-B) on the `service`
// command group. Called once from groups/service.group.ts.
//
//   re-shell service link <consumer> <provider>
//   re-shell service unlink <consumer> <provider>
//   re-shell service validate
//   re-shell service bridge diff --base <spec> --head <spec>
//   re-shell service bridge mock --spec <file...>
//   re-shell service bridge async --transport kafka|redis-streams
//   re-shell service bridge gateway --services a,b | --subgraph name=sdl[@url]

import { Command } from 'commander';

import { createAsyncCommand, withTimeout } from '../utils/error-handler';
import { runDiff, runLink, runUnlink, runValidate } from './commands';
import { runAsync } from './async/command';
import { runGateway } from './gateway-command';
import { runMock } from './mock-command';

/**
 * Attach the bridge subcommands.
 *
 * @param serviceCommand - The `service` command (receives link/unlink/validate).
 * @param bridgeCommand - The `service bridge` command (receives diff, async, ...).
 */
export function registerBridgeCommands(serviceCommand: Command, bridgeCommand: Command): void {
  serviceCommand
    .command('link <consumer> <provider>')
    .description(
      "Link a consumer service to a provider: derive the provider's contract from its own spec, generate a typed client inside the consumer, and record the dependency in re-shell.workspaces.yaml"
    )
    .option('--spec <file>', "Provider spec (OpenAPI yaml/json, .proto or GraphQL SDL); default: discovered in the provider's directory")
    .option('--protocol <protocol>', 'rest | grpc | graphql (needed only when the provider has several specs)')
    .option('--lang <langs>', "Client languages, comma separated: ts,python,go (default: the consumer's language)")
    .option('--out <dir>', 'Where to write the client (default: <consumer>/clients/<provider>-<protocol>)')
    .option('--go-module <path>', 'Go module path of the generated Go client')
    .option('--no-compile-stubs', 'gRPC: do not compile protobuf stubs even when protoc is available')
    .option('--config <file>', 'Workspace config path (default: discovered in the current directory)')
    .option('--dry-run', 'Plan the link and generate in memory, but write nothing')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (consumer: string, provider: string, options) => {
        await withTimeout(
          () =>
            runLink({
              consumer,
              provider,
              spec: options.spec,
              protocol: options.protocol,
              lang: options.lang,
              out: options.out,
              goModule: options.goModule,
              compileStubs: options.compileStubs,
              configPath: options.config,
              dryRun: options.dryRun,
              json: options.json,
            }),
          600000
        );
      })
    );

  serviceCommand
    .command('unlink <consumer> <provider>')
    .description('Remove the recorded link (and dependsOn edge) from a consumer to a provider')
    .option('--protocol <protocol>', 'Only remove the link for this protocol')
    .option('--keep-dependency', 'Keep the dependsOn entry')
    .option('--remove-client', 'Also delete the generated client directory (only if it carries the bridge marker)')
    .option('--config <file>', 'Workspace config path')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (consumer: string, provider: string, options) => {
        await runUnlink({
          consumer,
          provider,
          protocol: options.protocol,
          keepDependency: options.keepDependency,
          removeClient: options.removeClient,
          configPath: options.config,
          json: options.json,
        });
      })
    );

  serviceCommand
    .command('validate')
    .description(
      'Validate service links: every link resolves, linked contracts are still compatible with the provider, and the dependency graph has no cycles (exit 1 when invalid)'
    )
    .option('--config <file>', 'Workspace config path')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async options => {
        await runValidate({ configPath: options.config, json: options.json });
      })
    );

  bridgeCommand
    .command('diff')
    .description(
      'Classify the changes between two versions of a contract (OpenAPI, .proto or GraphQL SDL) as breaking, dangerous or non-breaking; exits 1 on breaking changes'
    )
    .requiredOption('--base <spec>', 'The previous contract')
    .requiredOption('--head <spec>', 'The new contract')
    .option('--strict', 'Also fail on dangerous (potentially breaking) changes')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async options => {
        await runDiff({ base: options.base, head: options.head, strict: options.strict, json: options.json });
      })
    );
  bridgeCommand
    .command('mock')
    .description(
      'Run a universal mock server: REST (OpenAPI examples/schemas), GraphQL (mocked resolvers from SDL) and gRPC (from .proto) from the services\' own specs'
    )
    .requiredOption('--spec <file...>', 'Spec file(s): any mix of OpenAPI (yaml/json), .proto and GraphQL SDL')
    .option('--port <port>', 'HTTP port for REST + GraphQL (0 = ephemeral)', '4010')
    .option('--grpc-port <port>', 'gRPC port (default: HTTP port + 1)')
    .option('--host <host>', 'Interface to bind', '127.0.0.1')
    .option('--timeout <seconds>', 'Stop automatically after N seconds')
    .option('--json', 'Emit one JSON envelope once the server is listening')
    .action(
      createAsyncCommand(async options => {
        await runMock({
          specs: options.spec,
          port: Number(options.port),
          grpcPort: options.grpcPort === undefined ? undefined : Number(options.grpcPort),
          host: options.host,
          timeout: options.timeout === undefined ? undefined : Number(options.timeout),
          json: options.json,
        });
      })
    );
  bridgeCommand
    .command('gateway')
    .description(
      "Compose several services' GraphQL SDLs into one gateway: Apollo Federation 2 supergraph (composition is run for real) or a schema-stitching gateway"
    )
    .option('--services <names>', "Workspace services whose GraphQL SDL (found in the service directory) joins the gateway, comma separated")
    .option('--subgraph <spec...>', 'Explicit subgraph: name=path/to/schema.graphql[@http://host:port/graphql]')
    .option('--mode <mode>', 'federation (Apollo Federation 2 composition) | stitch (@graphql-tools/stitch)', 'federation')
    .option('--out <dir>', 'Directory to write the gateway into')
    .option('--dry-run', 'Compose and validate, but write nothing')
    .option('--config <file>', 'Workspace config path')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async options => {
        await runGateway({
          services: options.services ? String(options.services).split(',').map((x: string) => x.trim()).filter(Boolean) : undefined,
          subgraphs: options.subgraph,
          mode: options.mode,
          out: options.out,
          dryRun: options.dryRun,
          configPath: options.config,
          json: options.json,
        });
      })
    );
  bridgeCommand
    .command('async')
    .description(
      'Generate typed async producers/consumers (Kafka or Redis Streams) from an async contract: envelopes with correlationId/schemaVersion/traceparent, version upcasters, discovery, circuit breaker + retry, dead-letter channels'
    )
    .option('--transport <transport>', 'kafka | redis-streams')
    .option('--spec <file>', 'Async contract (default: ./async.yaml)')
    .option('--service <name>', 'Service name (default: from the contract)')
    .option('--lang <langs>', 'ts,python (default: ts,python for redis-streams; ts for kafka)')
    .option('--out <dir>', 'Directory to write the package into')
    .option('--dry-run', 'Generate in memory, write nothing')
    .option('--verify', 'Type-check the TypeScript output with tsc and the Python output with py_compile + mypy')
    .option('--init', 'Write a starter async.yaml (does not overwrite)')
    .option('--config <file>', 'Workspace config path (used to emit services.registry.json)')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async options => {
        await withTimeout(
          () =>
            runAsync({
              transport: options.transport,
              spec: options.spec,
              service: options.service,
              lang: options.lang,
              out: options.out,
              dryRun: options.dryRun,
              verify: options.verify,
              init: options.init,
              configPath: options.config,
              json: options.json,
            }),
          600000
        );
      })
    );
}
