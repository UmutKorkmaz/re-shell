import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { runCloudDeploy, runIacGenerate, runIacValidate } from '../commands/cloud-iac';

const collect = (value: string, previous: string[]): string[] => [...previous, value];

/**
 * Adds `generate` and `validate` to the `cloud iac` command: Terraform for
 * AWS (ECS Fargate), Azure (Container Apps) and GCP (Cloud Run) generated from
 * the workspace v2 config.
 */
export function registerIacSubcommands(iac: Command): void {
  iac
    .command('generate')
    .description('Generate Terraform from the workspace v2 config: ECS Fargate (aws), Container Apps (azure) or Cloud Run (gcp)')
    .requiredOption('--provider <provider>', 'Cloud provider (aws|azure|gcp)')
    .option('--services <names>', 'Comma-separated service names (default: all)')
    .option('--out <dir>', 'Output directory for the Terraform files')
    .option('--validate', 'Run terraform fmt -check, init -backend=false and validate on the output')
    .option('--dry-run', 'Render the files without writing them')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (options: Record<string, unknown>) => {
        await runIacGenerate({
          provider: String(options.provider),
          services: options.services as string | undefined,
          out: options.out as string | undefined,
          validate: Boolean(options.validate),
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
        });
      })
    );

  iac
    .command('validate')
    .description('Validate a Terraform directory: fmt -check, init -backend=false, validate (fails unless they really ran and passed)')
    .argument('<dir>', 'Directory containing the Terraform files')
    .option('--in-place', 'Run in the directory itself instead of a temporary copy (keeps .terraform/)')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (dir: string, options: Record<string, unknown>) => {
        await runIacValidate({ dir, inPlace: Boolean(options.inPlace), json: Boolean(options.json) });
      })
    );
}

/**
 * Registers `cloud deploy`: applies generated Terraform after verifying cloud
 * credentials; `terraform apply` only runs with an explicit `--yes`.
 */
export function registerCloudDeployCommand(cloud: Command): void {
  cloud
    .command('deploy')
    .description('Deploy generated Terraform (credentials are checked first; apply requires --yes)')
    .requiredOption('--provider <provider>', 'Cloud provider (aws|azure|gcp)')
    .option('--dir <dir>', 'Directory with the generated Terraform (default: ./infra/<provider>)')
    .option('--region <region>', 'Region (aws, gcp) or location (azure)')
    .option('--image-tag <service=tag>', 'Image tag for a service (repeatable)', collect, [] as string[])
    .option('--var <name=value>', 'Extra terraform variable (repeatable)', collect, [] as string[])
    .option('--yes', 'Run terraform apply (without it only init + plan run and the command stops)')
    .option('--dry-run', 'Print the terraform commands without executing them')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (options: Record<string, unknown>) => {
        await runCloudDeploy({
          provider: String(options.provider),
          dir: options.dir as string | undefined,
          region: options.region as string | undefined,
          imageTags: options.imageTag as string[],
          vars: options.var as string[],
          yes: Boolean(options.yes),
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
        });
      })
    );
}
