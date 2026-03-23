# Services, Tools, And Quality

These workflows cover polyglot builds, service runtime orchestration, project utilities, IDE setup, and automated testing.

## Universal Testing And IntelliSense

```bash
re-shell quality test run . --coverage --parallel
re-shell quality test list .
re-shell quality test frameworks --json
re-shell quality test info .
re-shell quality intellisense setup . --dry-run
re-shell quality intellisense list-languages
```

## Polyglot Service Builds And Deployment Plans

```bash
re-shell service polyglot list --json
re-shell service polyglot build-all --production --parallel --analyze
re-shell service polyglot generate-deployment kubernetes production --region eu-central-1
re-shell service polyglot deploy kubernetes staging --dry-run
```

## Runtime Operations For Local Services

```bash
re-shell service run up --build --scale api=2 worker=1
re-shell service run health --watch
re-shell service run logs api --follow --tail 200
re-shell service run restart api
re-shell service run scale worker 3
re-shell service run inspect api --json
re-shell service run exec api sh
```

## Service Migration And Optimization

```bash
re-shell service run migrate api fastify --source express --dry-run --generate-tests
re-shell service run optimize api --framework express --list-all
re-shell service run optimize api --framework express --apply
```

## Detection, Dry Runs, DI, And Rollback Utilities

```bash
re-shell tools detect --json
re-shell tools dry-run --verbose --impact
re-shell tools di-analyze --json
re-shell tools di-generate --output di-config.json
re-shell tools snapshots
re-shell tools rollback snapshot-001 --keep-backup
```

## Import, CI/CD, Hot Reload, Dev Mode, And IDE Setup

```bash
re-shell tools migrate import ../legacy-app --dry-run --backup
re-shell tools cicd generate --provider github --template advanced
re-shell tools cicd deploy staging
re-shell tools dev start --profile local --services api web
re-shell tools dev status --json
re-shell tools hotreload detect .
re-shell tools hotreload start . --framework fastify --verbose
re-shell tools devenv setup . --ide vscode --dry-run
re-shell tools devenv ports list
re-shell tools debug generate --framework fastify --language typescript --type backend --dry-run
```

## Git Submodules And Repository Utilities

```bash
re-shell tools submodule status
re-shell tools submodule add https://github.com/acme/shared-ui.git --path packages/shared-ui --branch main
re-shell tools submodule update
```
