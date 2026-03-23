import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * GraphQL Federation Generation
 *
 * Generate GraphQL federated services with schema stitching,
 * automatic type merging, and cross-language support.
 */

export interface GraphQLField {
  name: string;
  type: string;
  description?: string;
  args?: GraphQLArgument[];
  resolve?: string;
}

export interface GraphQLArgument {
  name: string;
  type: string;
  description?: string;
  defaultValue?: any;
}

export interface GraphQLType {
  name: string;
  kind: 'object' | 'interface' | 'input' | 'enum' | 'union' | 'scalar';
  description?: string;
  fields?: GraphQLField[];
  values?: string[]; // For enums
  types?: string[]; // For unions
}

export interface GraphQLService {
  name: string;
  version: string;
  types: GraphQLType[];
  queries: GraphQLField[];
  mutations: GraphQLField[];
  subscriptions: GraphQLField[];
  description: string;
  extends?: string[]; // Services this extends
}

export interface GraphQLFederation {
  language: string;
  gatewayCode: string;
  serviceCode: string;
  schemaSDL: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate GraphQL federated service
 */
export async function generateGraphQLService(
  serviceName: string,
  types: GraphQLType[],
  queries: GraphQLField[],
  mutations: GraphQLField[],
  projectPath: string = process.cwd()
): Promise<GraphQLService> {
  const service: GraphQLService = {
    name: serviceName,
    version: 'v1',
    types,
    queries,
    mutations,
    subscriptions: [],
    description: `${serviceName} GraphQL service`,
  };

  return service;
}

/**
 * Generate default GraphQL schema for CRUD operations
 */
export function generateGraphQLSchema(resource: string): {
  types: GraphQLType[];
  queries: GraphQLField[];
  mutations: GraphQLField[];
} {
  const resourceName = toPascalCase(resource);
  const pluralName = resource + 's';

  return {
    types: [
      {
        name: resourceName,
        kind: 'object',
        description: `${resourceName} type`,
        fields: [
          { name: 'id', type: 'ID!', description: 'Unique identifier' },
          { name: 'name', type: 'String', description: `${resourceName} name` },
          { name: 'description', type: 'String', description: `${resourceName} description` },
          { name: 'createdAt', type: 'String', description: 'Creation timestamp' },
          { name: 'updatedAt', type: 'String', description: 'Last update timestamp' },
        ],
      },
      {
        name: `${resourceName}Input`,
        kind: 'input',
        description: `${resourceName} input type`,
        fields: [
          { name: 'name', type: 'String', description: `${resourceName} name` },
          { name: 'description', type: 'String', description: `${resourceName} description` },
        ],
      },
    ],
    queries: [
      {
        name: pluralName,
        type: `[${resourceName}!]!`,
        description: `Get all ${pluralName}`,
        args: [
          { name: 'limit', type: 'Int', description: 'Limit results' },
          { name: 'offset', type: 'Int', description: 'Offset for pagination' },
        ],
      },
      {
        name: resource,
        type: `${resourceName}`,
        description: `Get a specific ${resource}`,
        args: [{ name: 'id', type: 'ID!', description: `${resourceName} ID` }],
      },
    ],
    mutations: [
      {
        name: `create${resourceName}`,
        type: resourceName,
        description: `Create a new ${resource}`,
        args: [
          { name: 'input', type: `${resourceName}Input!`, description: `${resourceName} data` },
        ],
      },
      {
        name: `update${resourceName}`,
        type: resourceName,
        description: `Update a ${resource}`,
        args: [
          { name: 'id', type: 'ID!', description: `${resourceName} ID` },
          { name: 'input', type: `${resourceName}Input!`, description: `${resourceName} data` },
        ],
      },
      {
        name: `delete${resourceName}`,
        type: 'Boolean',
        description: `Delete a ${resource}`,
        args: [{ name: 'id', type: 'ID!', description: `${resourceName} ID` }],
      },
    ],
  };
}

/**
 * Generate GraphQL federation for language
 */
export async function generateGraphQLFederation(
  service: GraphQLService,
  language: string
): Promise<GraphQLFederation> {
  let federation: GraphQLFederation;

  switch (language) {
    case 'typescript':
      federation = generateTypeScriptGraphQL(service);
      break;
    case 'python':
      federation = generatePythonGraphQL(service);
      break;
    case 'go':
      federation = generateGoGraphQL(service);
      break;
    default:
      federation = generateGenericGraphQL(service, language);
  }

  return federation;
}

/**
 * Generate TypeScript GraphQL federation
 */
function generateTypeScriptGraphQL(service: GraphQLService): GraphQLFederation {
  return {
    language: 'typescript',
    gatewayCode: generateTypeScriptGateway(service),
    serviceCode: generateTypeScriptService(service),
    schemaSDL: generateSDL(service),
    dependencies: [
      '@apollo/gateway',
      '@apollo/server',
      'graphql',
      '@graphql-tools/load-files',
      '@graphql-tools/merge',
    ],
    buildInstructions: [
      'npm install @apollo/gateway @apollo/server graphql',
      'Copy gateway code to gateway.ts',
      'Copy service code to service.ts',
      'Start gateway: npm run start:gateway',
      'Start service: npm run start:service',
    ],
  };
}

function generateTypeScriptGateway(service: GraphQLService): string {
  return `import { ApolloServer } from '@apollo/server';
import { ApolloGateway, IntrospectAndCompose, LocalGraphQLDataSource } from '@apollo/gateway';
import { readFileSync } from 'fs';
import { join } from 'path';

// Gateway configuration
const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      {
        name: '${toSnakeCase(service.name)}',
        url: 'http://localhost:4001/graphql',
      },
      // Add more subgraphs here
    ],
  }),
});

async function startGateway() {
  const server = new ApolloServer({
    gateway,
    // Subscriptions are unsupported but enabled for now.
    subscriptionPassthrough: true,
  });

  const { url } = await server.start();
  console.log(\`🚀 Gateway ready at \${url}\`);
}

startGateway().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

function generateTypeScriptService(service: GraphQLService): string {
  const typeDefs = generateSDL(service);

  const resolvers = service.queries
    .map((query) => {
      return `  ${toCamelCase(query.name)}: (_parent: any, args: any, _context: any, _info: any) => {
    // TODO: Implement ${query.name}
    return { id: '1', name: 'Test', createdAt: new Date().toISOString() };
  },`;
    })
    .join('\n');

  const mutationResolvers = service.mutations
    .map((mutation) => {
      return `  ${toCamelCase(mutation.name)}: (_parent: any, args: any, _context: any, _info: any) => {
    // TODO: Implement ${mutation.name}
    return { id: args.id, ...args.input, createdAt: new Date().toISOString() };
  },`;
    })
    .join('\n');

  return `import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const typeDefs = \`
${typeDefs}
\`;

const resolvers = {
  Query: {
${resolvers}
  },
  Mutation: {
${mutationResolvers}
  },
};

interface ContextValue {
  token?: string;
}

async function startService() {
  const server = new ApolloServer<ContextValue>({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    context: async () => {
      // Context creation logic
      return {};
    },
  });

  console.log(\`🚀 ${service.name} service ready at \${url}\`);
}

startService().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

/**
 * Generate Python GraphQL federation
 */
function generatePythonGraphQL(service: GraphQLService): GraphQLFederation {
  return {
    language: 'python',
    gatewayCode: generatePythonGateway(service),
    serviceCode: generatePythonService(service),
    schemaSDL: generateSDL(service),
    dependencies: [
      'ariadne',
      'graphql-core',
      'uvicorn',
      'httpx',
    ],
    buildInstructions: [
      'pip install ariadne graphql-core uvicorn',
      'Copy gateway code to gateway.py',
      'Copy service code to service.py',
      'Start gateway: python gateway.py',
      'Start service: python service.py',
    ],
  };
}

function generatePythonGateway(service: GraphQLService): string {
  return `from ariadne import QueryType, MutationType, make_executable_schema
from ariadne.asgi import GraphQL
from starlette.applications import Starlette
from starlette.routing import Route
from httpx import AsyncClient
import uvicorn

# Gateway
type_defs = '''
    type Query {
        _service: String!
    }

    type Mutation {
        _service: String!
    }
'''

query = QueryType()
mutation = MutationType()

@query.field("_service")
async def resolve_service(*_):
    return "Gateway"

@mutation.field("_service")
async def resolve_mutation_service(*_):
    return "Gateway"

schema = make_executable_schema(type_defs, [query, mutation])

app = GraphQL(schema)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)
`;
}

function generatePythonService(service: GraphQLService): string {
  const queries = service.queries
    .map(
      (q) => `@query.field("${q.name}")
async def resolve_${toSnakeCase(q.name)}(obj, info, **kwargs):
    # TODO: Implement ${q.name}
    return {"id": "1", "name": "Test", "createdAt": "2024-01-01T00:00:00Z"}`
    )
    .join('\n\n');

  const mutations = service.mutations
    .map(
      (m) => `@mutation.field("${m.name}")
async def resolve_${toSnakeCase(m.name)}(obj, info, **kwargs):
    # TODO: Implement ${m.name}
    return {"id": kwargs.get("id"), "createdAt": "2024-01-01T00:00:00Z"}`
    )
    .join('\n\n');

  return `from ariadne import QueryType, MutationType, make_executable_schema
from ariadne.asgi import GraphQL
import uvicorn

type_defs = '''
${generateSDL(service)}
'''

query = QueryType()
mutation = MutationType()

${queries}

${mutations}

schema = make_executable_schema(type_defs, [query, mutation])

app = GraphQL(schema)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4001)
`;
}

/**
 * Generate Go GraphQL federation
 */
function generateGoGraphQL(service: GraphQLService): GraphQLFederation {
  return {
    language: 'go',
    gatewayCode: generateGoGateway(service),
    serviceCode: generateGoService(service),
    schemaSDL: generateSDL(service),
    dependencies: [
      'github.com/99designs/gqlgen',
      'github.com/gin-gonic/gin',
    ],
    buildInstructions: [
      'go install github.com/99designs/gqlgen@latest',
      'go run github.com/99designs/gqlgen generate',
      'Copy gateway code to gateway/main.go',
      'Copy service code to service/main.go',
      'Start gateway: go run gateway/main.go',
      'Start service: go run service/main.go',
    ],
  };
}

function generateGoGateway(service: GraphQLService): string {
  return `package main

import (
    "log"
    "net/http"
    "github.com/99designs/gqlgen/graphql/handler"
    "github.com/99designs/gqlgen/graphql/playground"
)

func main() {
    // TODO: Implement gateway with subgraph stitching
    http.Handle("/", playground.Handler("GraphQL playground", "/query"))
    http.Handle("/query", handler.New(&{}))

    log.Println("Gateway running on http://localhost:4000")
    log.Fatal(http.ListenAndServe(":4000", nil))
}
`;
}

function generateGoService(service: GraphQLService): string {
  return `package main

import (
    "log"
    "net/http"
    "github.com/99designs/gqlgen/graphql/handler"
    "github.com/99designs/gqlgen/graphql/playground"
)

func main() {
    // TODO: Implement GraphQL service
    http.Handle("/", playground.Handler("GraphQL playground", "/query"))
    http.Handle("/query", handler.New(&{}))

    log.Println("${service.name} service running on http://localhost:4001")
    log.Fatal(http.ListenAndServe(":4001", nil))
}
`;
}

/**
 * Generate generic GraphQL federation
 */
function generateGenericGraphQL(
  service: GraphQLService,
  language: string
): GraphQLFederation {
  return {
    language,
    gatewayCode: `// TODO: Implement GraphQL gateway for ${language}`,
    serviceCode: `// TODO: Implement GraphQL service for ${language}`,
    schemaSDL: generateSDL(service),
    dependencies: [],
    buildInstructions: [
      `Install GraphQL framework for ${language}`,
      `Implement gateway code`,
      `Implement service code`,
      `Configure federation subgraphs`,
    ],
  };
}

/**
 * Generate GraphQL SDL (Schema Definition Language)
 */
function generateSDL(service: GraphQLService): string {
  let sdl = `# ${service.description}
# Version: ${service.version}

`;

  // Types
  for (const type of service.types) {
    if (type.kind === 'enum') {
      sdl += `enum ${type.name} {\n`;
      for (const value of type.values || []) {
        sdl += `  ${value}\n`;
      }
      sdl += '}\n\n';
    } else if (type.kind === 'input') {
      sdl += `input ${type.name} {\n`;
      for (const field of type.fields || []) {
        const desc = field.description ? ` # ${field.description}` : '';
        sdl += `  ${field.name}: ${field.type}${desc}\n`;
      }
      sdl += '}\n\n';
    } else {
      const kind = type.kind === 'interface' ? 'interface' : 'type';
      sdl += `${kind} ${type.name} {\n`;
      for (const field of type.fields || []) {
        const desc = field.description ? ` # ${field.description}` : '';
        sdl += `  ${field.name}: ${field.type}${desc}\n`;
      }
      sdl += '}\n\n';
    }
  }

  // Queries
  if (service.queries.length > 0) {
    sdl += 'extend type Query {\n';
    for (const query of service.queries) {
      const args = query.args
        ?.map((arg) => {
          const def = arg.defaultValue ? ` = ${JSON.stringify(arg.defaultValue)}` : '';
          return `${arg.name}: ${arg.type}${def}`;
        })
        .join(', ');
      const argList = args ? `(${args})` : '';
      const desc = query.description ? ` # ${query.description}` : '';
      sdl += `  ${query.name}${argList}: ${query.type}${desc}\n`;
    }
    sdl += '}\n\n';
  }

  // Mutations
  if (service.mutations.length > 0) {
    sdl += 'extend type Mutation {\n';
    for (const mutation of service.mutations) {
      const args = mutation.args
        ?.map((arg) => {
          const def = arg.defaultValue ? ` = ${JSON.stringify(arg.defaultValue)}` : '';
          return `${arg.name}: ${arg.type}${def}`;
        })
        .join(', ');
      const argList = args ? `(${args})` : '';
      const desc = mutation.description ? ` # ${mutation.description}` : '';
      sdl += `  ${mutation.name}${argList}: ${mutation.type}${desc}\n`;
    }
    sdl += '}\n\n';
  }

  return sdl;
}

/**
 * Write GraphQL federation files
 */
export async function writeGraphQLFederationFiles(
  serviceName: string,
  federation: GraphQLFederation,
  outputPath: string
): Promise<void> {
  await fs.ensureDir(outputPath);

  // Write gateway code
  if (federation.gatewayCode) {
    const gatewayFile = path.join(outputPath, `${serviceName}-gateway.${getFileExtension(federation.language)}`);
    await fs.writeFile(gatewayFile, federation.gatewayCode);
  }

  // Write service code
  if (federation.serviceCode) {
    const serviceFile = path.join(outputPath, `${serviceName}-service.${getFileExtension(federation.language)}`);
    await fs.writeFile(serviceFile, federation.serviceCode);
  }

  // Write SDL schema
  if (federation.schemaSDL) {
    const schemaFile = path.join(outputPath, `${serviceName}.graphql`);
    await fs.writeFile(schemaFile, federation.schemaSDL);
  }

  // Write build instructions
  const readmeFile = path.join(outputPath, 'BUILD.md');
  const readmeContent = generateBuildREADME(serviceName, federation);
  await fs.writeFile(readmeFile, readmeContent);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    python: 'py',
    go: 'go',
    csharp: 'cs',
  };
  return extensions[language] || 'txt';
}

function generateBuildREADME(serviceName: string, federation: GraphQLFederation): string {
  return `# GraphQL Federation Build Instructions for ${serviceName}

## Language: ${federation.language.toUpperCase()}

## Architecture

This setup includes:
- **GraphQL Gateway**: Routes queries to downstream services
- **GraphQL Service**: Implements the federated schema
- **Schema Stitching**: Combines multiple services into single graph

## Dependencies

\`\`\`bash
${federation.dependencies.map((dep) => getInstallCommand(dep, federation.language)).join('\n')}
\`\`\`

## Build Steps

${federation.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Usage

### Gateway (port 4000)
\`\`\`bash
${getStartCommand(federation.language, 'gateway')}
\`\`\`

### Service (port 4001)
\`\`\`bash
${getStartCommand(federation.language, 'service')}
\`\`\`

## Testing

Access the GraphQL playground:
- Gateway: http://localhost:4000
- Service: http://localhost:4001

## Schema

The schema is defined in \`${serviceName}.graphql\`.

## Federation

The gateway uses Apollo Federation to combine multiple services:
- Each service defines its own schema
- The gateway stitches schemas together
- Services can be developed independently

## Example Query

\`\`\`graphql
query Example {
  ${serviceName.toLowerCase()}s {
    id
    name
  }
}
\`\`\`
`;
}

function getInstallCommand(dep: string, language: string): string {
  const commands: Record<string, (dep: string) => string> = {
    typescript: (dep) => `npm install ${dep}`,
    python: (dep) => `pip install ${dep}`,
    go: (dep) => `go get ${dep}`,
    csharp: (dep) => `dotnet add package ${dep}`,
  };

  const fn = commands[language];
  return fn ? fn(dep) : `# Install ${dep} for ${language}`;
}

function getStartCommand(language: string, type: string): string {
  const commands: Record<string, string> = {
    typescript: `npm run start:${type}`,
    python: `python ${type}.py`,
    go: `go run ${type}/main.go`,
    csharp: `dotnet run --project ${type}`,
  };

  return commands[language] || `# Start ${type}`;
}

/**
 * Display GraphQL service info
 */
export async function displayGraphQLService(service: GraphQLService): Promise<void> {
  console.log(chalk.bold(`\n🔗 GraphQL Service: ${service.name}\n`));
  console.log(chalk.cyan(`Version: ${service.version}`));
  console.log(chalk.cyan(`Description: ${service.description}\n`));

  if (service.types.length > 0) {
    console.log(chalk.bold('Types:\n'));

    for (const type of service.types) {
      console.log(chalk.cyan(`  ${type.kind.toUpperCase()} ${type.name}`));
      if (type.fields && type.fields.length > 0) {
        for (const field of type.fields.slice(0, 5)) {
          console.log(`    ${field.name}: ${field.type}`);
        }
        if (type.fields.length > 5) {
          console.log(chalk.gray(`    ... and ${type.fields.length - 5} more`));
        }
      }
      if (type.values && type.values.length > 0) {
        console.log(`    ${type.values.slice(0, 5).join(', ')}`);
        if (type.values.length > 5) {
          console.log(chalk.gray(`    ... and ${type.values.length - 5} more`));
        }
      }
      console.log('');
    }
  }

  if (service.queries.length > 0) {
    console.log(chalk.bold('Queries:\n'));

    for (const query of service.queries) {
      const args = query.args?.map((a) => a.name).join(', ') || '';
      const argList = args ? `(${args})` : '';
      console.log(`  ${chalk.green(query.name)}${argList}: ${query.type}`);
      if (query.description) {
        console.log(chalk.gray(`    ${query.description}`));
      }
      console.log('');
    }
  }

  if (service.mutations.length > 0) {
    console.log(chalk.bold('Mutations:\n'));

    for (const mutation of service.mutations) {
      const args = mutation.args?.map((a) => a.name).join(', ') || '';
      const argList = args ? `(${args})` : '';
      console.log(`  ${chalk.yellow(mutation.name)}${argList}: ${mutation.type}`);
      if (mutation.description) {
        console.log(chalk.gray(`    ${mutation.description}`));
      }
      console.log('');
    }
  }
}

/**
 * Helper functions
 */
function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return (
    str.charAt(0).toLowerCase() + str.slice(1).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  );
}
